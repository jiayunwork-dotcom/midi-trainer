use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::Mutex;
use rodio::{source::Source, OutputStream, OutputStreamHandle, Sink};
use crate::models::{AdsrParams, SoundPreset};
use crate::AppState;

const SAMPLE_RATE: u32 = 44100;

struct ActiveNote {
    frequency: f32,
    velocity: f32,
    start_time: f64,
    release_time: Option<f64>,
    phase: f32,
    phase2: f32,
    phase3: f32,
}

pub struct AudioEngine {
    _stream: Option<OutputStream>,
    stream_handle: Option<OutputStreamHandle>,
    sinks: HashMap<u8, Sink>,
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
        let (stream, stream_handle) = OutputStream::try_default().ok().unzip();
        
        Self {
            _stream: stream,
            stream_handle,
            sinks: HashMap::new(),
            active_notes: Arc::new(Mutex::new(HashMap::new())),
            sustain_notes: Vec::new(),
            is_sustain_down: false,
            volume: 0.7,
            preset: SoundPreset::Piano,
            adsr: AdsrParams {
                attack: 0.01,
                decay: 0.3,
                sustain: 0.6,
                release: 0.5,
            },
        }
    }

    pub fn note_on(&mut self, note: u8, velocity: u8) {
        let freq = note_to_freq(note);
        let vel = velocity as f32 / 127.0;
        
        self.active_notes.lock().insert(note, ActiveNote {
            frequency: freq,
            velocity: vel,
            start_time: current_time_secs(),
            release_time: None,
            phase: 0.0,
            phase2: 0.0,
            phase3: 0.0,
        });
        
        if self.sustain_notes.contains(&note) {
            self.sustain_notes.retain(|&n| n != note);
        }
        
        self.play_note_synth(note, freq, vel);
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
        let mut notes = self.active_notes.lock();
        if let Some(n) = notes.get_mut(&note) {
            n.release_time = Some(current_time_secs());
        }
        
        if let Some(sink) = self.sinks.get(&note) {
            let release_ms = (self.adsr.release * 1000.0) as u32;
            sink.fade_out(std::time::Duration::from_millis(release_ms as u64));
        }
    }

    fn play_note_synth(&mut self, note: u8, freq: f32, velocity: f32) {
        if self.stream_handle.is_none() {
            return;
        }
        
        if let Some(sink) = self.sinks.remove(&note) {
            drop(sink);
        }
        
        if let Ok(sink) = Sink::try_new(self.stream_handle.as_ref().unwrap()) {
            let source = SynthSource::new(
                freq,
                velocity * self.volume,
                self.preset.clone(),
                self.adsr.clone(),
            );
            
            sink.append(source);
            sink.play();
            self.sinks.insert(note, sink);
        }
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

struct SynthSource {
    freq: f32,
    velocity: f32,
    preset: SoundPreset,
    adsr: AdsrParams,
    sample_rate: u32,
    phase: f32,
    phase2: f32,
    phase3: f32,
    elapsed: f32,
    is_releasing: bool,
    release_start: f32,
    release_value: f32,
}

impl SynthSource {
    fn new(freq: f32, velocity: f32, preset: SoundPreset, adsr: AdsrParams) -> Self {
        Self {
            freq,
            velocity,
            preset,
            adsr,
            sample_rate: SAMPLE_RATE,
            phase: 0.0,
            phase2: 0.0,
            phase3: 0.0,
            elapsed: 0.0,
            is_releasing: false,
            release_start: 0.0,
            release_value: 0.0,
        }
    }

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

    fn trigger_release(&mut self) {
        if !self.is_releasing {
            self.is_releasing = true;
            self.release_start = self.elapsed;
            self.release_value = self.adsr_gain();
        }
    }
}

impl Iterator for SynthSource {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sr = self.sample_rate as f32;
        let dt = 1.0 / sr;
        
        let gain = self.adsr_gain() * self.velocity;
        
        if gain <= 0.0001 && self.is_releasing {
            return None;
        }

        let sample = match self.preset {
            SoundPreset::Piano => {
                let fundamental = (self.phase * 2.0 * std::f32::consts::PI).sin();
                let harmonic2 = (self.phase2 * 2.0 * std::f32::consts::PI).sin() * 0.5;
                let harmonic3 = (self.phase3 * 2.0 * std::f32::consts::PI).sin() * 0.25;
                let mut s = fundamental + harmonic2 + harmonic3;
                
                let key_vel = self.velocity;
                let bright = 0.3 + key_vel * 0.7;
                s = s * bright;
                
                let t = self.elapsed;
                if t < 0.01 {
                    s *= t / 0.01;
                }
                
                s * 0.3
            }
            SoundPreset::ElectricPiano => {
                let fundamental = (self.phase * 2.0 * std::f32::consts::PI).sin();
                let mod_freq = self.freq * 3.0;
                let modulation = (self.phase * mod_freq / self.freq * 2.0 * std::f32::consts::PI).sin();
                let fm = (self.phase * 2.0 * std::f32::consts::PI + modulation * 0.5).sin();
                let mut s = fundamental * 0.6 + fm * 0.4;
                
                let tremolo = (self.elapsed * 6.0 * 2.0 * std::f32::consts::PI).sin() * 0.05 + 0.95;
                s *= tremolo;
                
                s * 0.35
            }
            SoundPreset::Organ => {
                let f1 = (self.phase * 2.0 * std::f32::consts::PI).sin();
                let f2 = (self.phase2 * 2.0 * std::f32::consts::PI).sin();
                let f3 = (self.phase3 * 2.0 * std::f32::consts::PI).sin();
                let f4 = (self.phase * 2.0 * 2.0 * std::f32::consts::PI).sin() * 0.5;
                let s = (f1 + f2 * 0.7 + f3 * 0.5 + f4 * 0.3) * 0.2;
                s
            }
        };

        self.phase += self.freq / sr;
        self.phase2 += self.freq * 2.0 / sr;
        self.phase3 += self.freq * 3.0 / sr;
        
        if self.phase >= 1.0 { self.phase -= 1.0; }
        if self.phase2 >= 1.0 { self.phase2 -= 1.0; }
        if self.phase3 >= 1.0 { self.phase3 -= 1.0; }
        
        self.elapsed += dt;
        
        if self.elapsed > 5.0 && !self.is_releasing {
            self.trigger_release();
        }

        Some(sample * gain)
    }
}

impl Source for SynthSource {
    fn current_frame_len(&self) -> Option<usize> {
        None
    }

    fn channels(&self) -> u16 {
        1
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<std::time::Duration> {
        None
    }
}

#[tauri::command]
pub fn note_on(state: tauri::State<AppState>, note: u8, velocity: u8) -> () {
    state.audio.lock().note_on(note, velocity);
}

#[tauri::command]
pub fn note_off(state: tauri::State<AppState>, note: u8) -> () {
    state.audio.lock().note_off(note);
}

#[tauri::command]
pub fn set_volume(state: tauri::State<AppState>, volume: f32) -> () {
    state.audio.lock().set_volume(volume);
}

#[tauri::command]
pub fn set_sound_preset(state: tauri::State<AppState>, preset: SoundPreset) -> () {
    state.audio.lock().set_sound_preset(preset);
}

#[tauri::command]
pub fn sustain_pedal_down(state: tauri::State<AppState>) -> () {
    state.audio.lock().sustain_down();
}

#[tauri::command]
pub fn sustain_pedal_up(state: tauri::State<AppState>) -> () {
    state.audio.lock().sustain_up();
}

#[tauri::command]
pub fn set_adsr(state: tauri::State<AppState>, adsr: AdsrParams) -> () {
    state.audio.lock().set_adsr(adsr);
}
