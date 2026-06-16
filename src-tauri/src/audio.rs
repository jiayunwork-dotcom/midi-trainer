use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use parking_lot::Mutex;
use rodio::{source::Source, OutputStream, OutputStreamHandle, Sink, Decoder};
use crate::models::{AdsrParams, SoundPreset};
use crate::AppState;

const SAMPLE_RATE: u32 = 44100;
const SAMPLING_ROOT_NOTES: [u8; 8] = [24, 36, 48, 60, 72, 84, 96, 108];

struct PianoSample {
    samples: Vec<f32>,
    root_note: u8,
    sample_rate: u32,
}

impl PianoSample {
    fn generate(root_note: u8, duration_secs: f32, velocity: f32) -> Self {
        let freq = note_to_freq(root_note);
        let total_samples = (SAMPLE_RATE as f32 * duration_secs) as usize;
        let mut samples = Vec::with_capacity(total_samples);
        
        let harmonics = [
            (1.0, 1.0),
            (2.0, 0.55),
            (3.0, 0.32),
            (4.0, 0.18),
            (5.0, 0.10),
            (6.0, 0.06),
            (7.0, 0.04),
        ];

        let attack_samples = (SAMPLE_RATE as f32 * 0.008) as usize;
        let decay_samples = (SAMPLE_RATE as f32 * 0.3) as usize;
        let sustain_level = 0.35 + velocity * 0.2;
        
        let key_detune = (rand::random::<f32>() - 0.5) * 0.002;
        let stereo_phase = rand::random::<f32>() * 0.001;

        for i in 0..total_samples {
            let t = i as f32 / SAMPLE_RATE as f32;
            let mut sample = 0.0;
            
            for (harmonic, amplitude) in harmonics.iter() {
                let phase = (freq * harmonic + key_detune * freq) * t * 2.0 * std::f32::consts::PI;
                let inharmonic = 1.0 + harmonic * harmonic * 0.0003;
                sample += (phase * inharmonic + stereo_phase).sin() * amplitude;
            }
            
            let hammer_click = if t < 0.005 {
                (t / 0.005) * (rand::random::<f32>() - 0.5) * 0.15 * velocity
            } else {
                0.0
            };
            
            let envelope = if i < attack_samples {
                (i as f32 / attack_samples as f32).powf(0.5)
            } else if i < attack_samples + decay_samples {
                let decay_progress = (i - attack_samples) as f32 / decay_samples as f32;
                1.0 - (1.0 - sustain_level) * (1.0 - (1.0 - decay_progress).powi(3))
            } else {
                let release_t = (i - attack_samples - decay_samples) as f32 / (total_samples - attack_samples - decay_samples) as f32;
                sustain_level * (-release_t * 2.5).exp()
            };

            sample = (sample + hammer_click) * envelope * (0.5 + velocity * 0.5);
            sample = sample.tanh();
            samples.push(sample);
        }

        Self {
            samples,
            root_note,
            sample_rate: SAMPLE_RATE,
        }
    }

    fn get_pitched_source(&self, target_note: u8, velocity: f32, adsr: &AdsrParams) -> SampledNoteSource {
        let pitch_ratio = note_to_freq(target_note) / note_to_freq(self.root_note);
        
        SampledNoteSource {
            samples: &self.samples,
            sample_rate: self.sample_rate,
            pitch_ratio,
            velocity_gain: 0.2 + velocity * 0.8,
            position: 0.0,
            elapsed: 0.0,
            is_releasing: false,
            release_start: 0.0,
            release_value: 0.0,
            adsr: adsr.clone(),
        }
    }
}

struct SampledNoteSource<'a> {
    samples: &'a [f32],
    sample_rate: u32,
    pitch_ratio: f32,
    velocity_gain: f32,
    position: f32,
    elapsed: f32,
    is_releasing: bool,
    release_start: f32,
    release_value: f32,
    adsr: AdsrParams,
}

impl<'a> SampledNoteSource<'a> {
    fn adsr_gain(&mut self) -> f32 {
        let t = self.elapsed;
        let a = self.adsr.attack;
        let d = self.adsr.decay;
        let s = self.adsr.sustain;
        let r = self.adsr.release;

        if self.is_releasing {
            let rt = self.elapsed - self.release_start;
            if rt < r {
                return self.release_value * (1.0 - rt / r);
            } else {
                return 0.0;
            }
        }

        if t < a {
            t / a
        } else if t < a + d {
            1.0 - (1.0 - s) * ((t - a) / d)
        } else {
            s
        }
    }

    pub fn trigger_release(&mut self) {
        if !self.is_releasing {
            self.is_releasing = true;
            self.release_start = self.elapsed;
            self.release_value = self.adsr_gain();
        }
    }
}

impl<'a> Iterator for SampledNoteSource<'a> {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.position >= self.samples.len() as f32 - 1.0 {
            return None;
        }

        let pos_floor = self.position.floor();
        let pos_frac = self.position - pos_floor;
        let idx = pos_floor as usize;

        let sample = if idx + 1 < self.samples.len() {
            let y0 = self.samples[idx];
            let y1 = self.samples[idx + 1];
            y0 + pos_frac * (y1 - y0)
        } else {
            self.samples[idx]
        };

        let adsr_gain = self.adsr_gain();
        if adsr_gain <= 0.0001 && self.is_releasing {
            return None;
        }

        let dt = 1.0 / self.sample_rate as f32;
        self.position += self.pitch_ratio;
        self.elapsed += dt;

        Some(sample * adsr_gain * self.velocity_gain)
    }
}

impl<'a> Source for SampledNoteSource<'a> {
    fn current_frame_len(&self) -> Option<usize> {
        None
    }

    fn channels(&self) -> u16 {
        1
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        None
    }
}

struct ActiveNote {
    sink: Option<Sink>,
    _source: Option<Box<dyn Iterator<Item = f32> + Send + 'static>>,
    start_time: f64,
    release_time: Option<f64>,
}

pub struct AudioEngine {
    stream: Option<OutputStream>,
    stream_handle: Option<OutputStreamHandle>,
    piano_samples: HashMap<u8, Arc<PianoSample>>,
    active_notes: Arc<Mutex<HashMap<u8, ActiveNote>>>,
    sustain_notes: Vec<u8>,
    is_sustain_down: bool,
    volume: f32,
    preset: SoundPreset,
    adsr: AdsrParams,
}

unsafe impl Send for AudioEngine {}
unsafe impl Sync for AudioEngine {}

impl AudioEngine {
    pub fn new() -> Self {
        let (stream, stream_handle) = match OutputStream::try_default() {
            Ok((s, h)) => (Some(s), Some(h)),
            Err(e) => {
                eprintln!("Failed to initialize audio output: {}", e);
                (None, None)
            }
        };

        let mut piano_samples = HashMap::new();
        for &root_note in &SAMPLING_ROOT_NOTES {
            let sample = Arc::new(PianoSample::generate(root_note, 3.5, 0.7));
            piano_samples.insert(root_note, sample);
        }

        Self {
            stream,
            stream_handle,
            piano_samples,
            active_notes: Arc::new(Mutex::new(HashMap::new())),
            sustain_notes: Vec::new(),
            is_sustain_down: false,
            volume: 0.7,
            preset: SoundPreset::Piano,
            adsr: AdsrParams {
                attack: 0.005,
                decay: 0.25,
                sustain: 0.4,
                release: 0.35,
            },
        }
    }

    fn get_closest_sample(&self, note: u8) -> Option<&PianoSample> {
        let mut closest_note = SAMPLING_ROOT_NOTES[0];
        let mut min_diff = (note as i32 - closest_note as i32).abs();

        for &root in &SAMPLING_ROOT_NOTES {
            let diff = (note as i32 - root as i32).abs();
            if diff < min_diff {
                min_diff = diff;
                closest_note = root;
            }
        }

        self.piano_samples.get(&closest_note).map(|s| s.as_ref())
    }

    fn apply_preset_filter(&self, source: impl Iterator<Item = f32> + Send + 'static, note: u8) -> Box<dyn Iterator<Item = f32> + Send + 'static> {
        match self.preset {
            SoundPreset::Piano => Box::new(source),
            SoundPreset::ElectricPiano => {
                let mut chorus_phase = 0.0f32;
                let mut delay_buf = vec![0.0f32; 512];
                let mut delay_pos = 0usize;
                
                Box::new(source.map(move |s| {
                    chorus_phase += 0.01;
                    let chorus_depth = 5.0 + (chorus_phase * 2.0 * std::f32::consts::PI).sin() * 2.0;
                    
                    let delay_idx = (delay_pos + 256 + chorus_depth as usize) % 512;
                    let delayed = delay_buf[delay_idx];
                    
                    delay_buf[delay_pos] = s;
                    delay_pos = (delay_pos + 1) % 512;
                    
                    (s * 0.8 + delayed * 0.4) * 1.2
                }))
            }
            SoundPreset::Organ => {
                let drawbars = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1];
                let freq = note_to_freq(note);
                let mut phases = [0.0f32; 9];
                
                Box::new(source.map(move |s| {
                    let mut organ_sample = 0.0;
                    for (i, (harmonic, drawbar)) in [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0].iter().zip(drawbars.iter()).enumerate() {
                        organ_sample += (phases[i] * freq * harmonic * 2.0 * std::f32::consts::PI).sin() * drawbar;
                        phases[i] += 1.0 / SAMPLE_RATE as f32;
                        if phases[i] >= 1.0 { phases[i] -= 1.0; }
                    }
                    
                    organ_sample * 0.4 + s * 0.1
                }))
            }
        }
    }

    pub fn note_on(&mut self, note: u8, velocity: u8) {
        if self.stream_handle.is_none() {
            return;
        }

        let vel = velocity as f32 / 127.0;
        
        if self.sustain_notes.contains(&note) {
            self.sustain_notes.retain(|&n| n != note);
        }

        let mut active = self.active_notes.lock();
        if let Some(mut existing) = active.remove(&note) {
            if let Some(sink) = existing.sink.take() {
                drop(sink);
            }
        }

        if let Some(sample) = self.get_closest_sample(note) {
            let pitched = sample.get_pitched_source(note, vel, &self.adsr);
            let filtered = self.apply_preset_filter(pitched, note);
            
            let volume = self.volume;
            let adjusted = filtered.map(move |s| s * volume);
            
            if let Ok(sink) = Sink::try_new(self.stream_handle.as_ref().unwrap()) {
                sink.append(adjusted);
                sink.play();
                
                active.insert(note, ActiveNote {
                    sink: Some(sink),
                    _source: None,
                    start_time: current_time_secs(),
                    release_time: None,
                });
            }
        }
    }

    pub fn note_off(&mut self, note: u8) {
        if self.is_sustain_down {
            if !self.sustain_notes.contains(&note) {
                self.sustain_notes.push(note);
            }
            return;
        }
        
        self.release_note(note);
    }

    fn release_note(&mut self, note: u8) {
        let mut active = self.active_notes.lock();
        if let Some(active_note) = active.get_mut(&note) {
            active_note.release_time = Some(current_time_secs());
            
            if let Some(sink) = active_note.sink.as_ref() {
                let release_ms = (self.adsr.release * 1000.0) as u64;
                sink.fade_out(Duration::from_millis(release_ms));
            }
        }

        let notes = self.active_notes.clone();
        let adsr = self.adsr.clone();
        let volume = self.volume;
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis((adsr.release * 1200.0) as u64)).await;
            let mut active = notes.lock();
            active.remove(&note);
        });
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.volume = volume.clamp(0.0, 1.0);
    }

    pub fn set_sound_preset(&mut self, preset: SoundPreset) {
        self.preset = preset;
    }

    pub fn sustain_down(&mut self) {
        self.is_sustain_down = true;
    }

    pub fn sustain_up(&mut self) {
        self.is_sustain_down = false;
        let notes_to_release: Vec<u8> = self.sustain_notes.drain(..).collect();
        for note in notes_to_release {
            self.release_note(note);
        }
    }

    pub fn set_adsr(&mut self, adsr: AdsrParams) {
        self.adsr = adsr;
    }
}

fn note_to_freq(note: u8) -> f32 {
    440.0 * 2.0f32.powf((note as f32 - 69.0) / 12.0)
}

fn current_time_secs() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

#[tauri::command]
pub fn note_on(state: tauri::State<AppState>, note: u8, velocity: u8) {
    state.audio.lock().note_on(note, velocity);
}

#[tauri::command]
pub fn note_off(state: tauri::State<AppState>, note: u8) {
    state.audio.lock().note_off(note);
}

#[tauri::command]
pub fn set_volume(state: tauri::State<AppState>, volume: f32) {
    state.audio.lock().set_volume(volume);
}

#[tauri::command]
pub fn set_sound_preset(state: tauri::State<AppState>, preset: SoundPreset) {
    state.audio.lock().set_sound_preset(preset);
}

#[tauri::command]
pub fn sustain_pedal_down(state: tauri::State<AppState>) {
    state.audio.lock().sustain_down();
}

#[tauri::command]
pub fn sustain_pedal_up(state: tauri::State<AppState>) {
    state.audio.lock().sustain_up();
}

#[tauri::command]
pub fn set_adsr(state: tauri::State<AppState>, adsr: AdsrParams) {
    state.audio.lock().set_adsr(adsr);
}
