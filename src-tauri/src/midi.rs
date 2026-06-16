use std::sync::Arc;
use parking_lot::Mutex;
use midir::{MidiInput, MidiInputConnection, Ignore};
use tauri::AppHandle;
use crate::models::MidiDevice;
use crate::AppState;

pub struct MidiManager {
    midi_in: Option<MidiInput>,
    connection: Option<MidiInputConnection<()>>,
    connected_device: Option<MidiDevice>,
    app_handle: Option<AppHandle>,
}

unsafe impl Send for MidiManager {}
unsafe impl Sync for MidiManager {}

impl MidiManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let mut midi_in = MidiInput::new("MIDI Trainer Input").ok();
        if let Some(ref mut m) = midi_in {
            m.ignore(Ignore::None);
        }
        
        Self {
            midi_in,
            connection: None,
            connected_device: None,
            app_handle: Some(app_handle),
        }
    }

    pub fn list_devices(&self) -> Vec<MidiDevice> {
        let mut devices = Vec::new();
        
        if let Some(ref midi_in) = self.midi_in {
            for (i, port) in midi_in.ports().iter().enumerate() {
                if let Ok(name) = midi_in.port_name(port) {
                    devices.push(MidiDevice {
                        id: i,
                        name,
                    });
                }
            }
        }
        
        devices
    }

    pub fn connect(&mut self, device_id: usize) -> Result<(), String> {
        if self.connection.is_some() {
            self.disconnect();
        }

        let midi_in = self.midi_in.take().ok_or("MIDI input not available")?;
        let ports = midi_in.ports();
        
        if device_id >= ports.len() {
            self.midi_in = Some(midi_in);
            return Err("Invalid device ID".to_string());
        }

        let port = &ports[device_id];
        let port_name = midi_in.port_name(port).map_err(|e| e.to_string())?;
        
        let app_handle = self.app_handle.clone().ok_or("App handle not available")?;
        
        let conn = midi_in.connect(
            port,
            "midi-trainer-input",
            move |_stamp, message, _| {
                handle_midi_message(message, &app_handle);
            },
            (),
        ).map_err(|e| e.to_string())?;

        self.connection = Some(conn);
        self.connected_device = Some(MidiDevice {
            id: device_id,
            name: port_name,
        });
        
        Ok(())
    }

    pub fn disconnect(&mut self) {
        self.connection = None;
        self.connected_device = None;
        
        if self.midi_in.is_none() {
            self.midi_in = MidiInput::new("MIDI Trainer Input").ok();
            if let Some(ref mut m) = self.midi_in {
                m.ignore(Ignore::None);
            }
        }
    }

    pub fn get_connected(&self) -> Option<MidiDevice> {
        self.connected_device.clone()
    }
}

fn handle_midi_message(message: &[u8], app_handle: &AppHandle) {
    if message.is_empty() {
        return;
    }

    let status = message[0];
    let channel = status & 0x0F;
    let message_type = status & 0xF0;

    match message_type {
        0x90 => {
            if message.len() >= 3 {
                let note = message[1];
                let velocity = message[2];
                let is_note_on = velocity > 0;
                
                let event = serde_json::json!({
                    "note": note,
                    "velocity": velocity,
                    "isNoteOn": is_note_on,
                    "channel": channel,
                    "timestamp": js_sys_now(),
                });
                
                let _ = app_handle.emit("midi-note", &event);
            }
        }
        0x80 => {
            if message.len() >= 3 {
                let note = message[1];
                let velocity = message[2];
                
                let event = serde_json::json!({
                    "note": note,
                    "velocity": velocity,
                    "isNoteOn": false,
                    "channel": channel,
                    "timestamp": js_sys_now(),
                });
                
                let _ = app_handle.emit("midi-note", &event);
            }
        }
        0xB0 => {
            if message.len() >= 3 {
                let controller = message[1];
                let value = message[2];
                
                if controller == 64 {
                    let is_down = value >= 64;
                    let _ = app_handle.emit("midi-sustain", &serde_json::json!({ "isDown": is_down }));
                }
            }
        }
        _ => {}
    }
}

fn js_sys_now() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[tauri::command]
pub fn list_midi_devices(state: tauri::State<AppState>) -> Vec<MidiDevice> {
    state.midi.lock().list_devices()
}

#[tauri::command]
pub fn connect_midi_device(state: tauri::State<AppState>, device_id: usize) -> Result<(), String> {
    state.midi.lock().connect(device_id)
}

#[tauri::command]
pub fn disconnect_midi_device(state: tauri::State<AppState>) -> () {
    state.midi.lock().disconnect()
}

#[tauri::command]
pub fn get_connected_device(state: tauri::State<AppState>) -> Option<MidiDevice> {
    state.midi.lock().get_connected()
}
