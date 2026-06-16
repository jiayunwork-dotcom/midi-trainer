#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod midi;
mod audio;
mod storage;
mod models;

use std::sync::Arc;
use parking_lot::Mutex;
use tauri::Manager;

use midi::MidiManager;
use audio::AudioEngine;
use storage::Storage;

pub struct AppState {
    pub midi: Arc<Mutex<MidiManager>>,
    pub audio: Arc<Mutex<AudioEngine>>,
    pub storage: Arc<Mutex<Storage>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            let midi_manager = Arc::new(Mutex::new(MidiManager::new(app_handle.clone())));
            let audio_engine = Arc::new(Mutex::new(AudioEngine::new()));
            let storage = Arc::new(Mutex::new(Storage::new().expect("Failed to initialize storage")));

            app.manage(AppState {
                midi: midi_manager,
                audio: audio_engine,
                storage,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // MIDI commands
            midi::list_midi_devices,
            midi::connect_midi_device,
            midi::disconnect_midi_device,
            midi::get_connected_device,
            
            // Audio commands
            audio::note_on,
            audio::note_off,
            audio::set_volume,
            audio::set_sound_preset,
            audio::sustain_pedal_down,
            audio::sustain_pedal_up,
            audio::set_adsr,
            
            // Storage commands
            storage::save_practice_session,
            storage::get_practice_history,
            storage::get_weekly_stats,
            storage::get_streak,
            storage::get_achievements,
            storage::unlock_achievement,
            storage::get_daily_goal,
            storage::set_daily_goal,
            storage::get_today_practice_time,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
