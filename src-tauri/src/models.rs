use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDate};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MidiDevice {
    pub id: usize,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteEvent {
    pub note: u8,
    pub velocity: u8,
    pub is_note_on: bool,
    pub timestamp: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeSession {
    pub id: Option<i64>,
    pub module_type: String,
    pub duration_secs: u32,
    pub accuracy: f32,
    pub date: NaiveDate,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyStats {
    pub total_minutes: u32,
    pub daily_minutes: Vec<(String, u32)>,
    pub module_accuracy: Vec<(String, f32)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub unlocked: bool,
    pub progress: f32,
    pub unlocked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdsrParams {
    pub attack: f32,
    pub decay: f32,
    pub sustain: f32,
    pub release: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SoundPreset {
    Piano,
    ElectricPiano,
    Organ,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyEvent {
    pub note: u8,
    pub target_note: u8,
    pub is_correct: bool,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BattleRound {
    pub round_number: u32,
    pub root_note: u8,
    pub scale_notes: Vec<u8>,
    pub p1_duration_ms: u64,
    pub p1_errors: u32,
    pub p1_key_events: Vec<KeyEvent>,
    pub p2_duration_ms: u64,
    pub p2_errors: u32,
    pub p2_key_events: Vec<KeyEvent>,
    pub winner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BattleRecord {
    pub id: Option<i64>,
    pub player1_name: String,
    pub player2_name: String,
    pub scale_type: String,
    pub octaves: u32,
    pub difficulty: String,
    pub rounds: String,
    pub p1_wins: u32,
    pub p2_wins: u32,
    pub p1_total_errors: u32,
    pub p2_total_errors: u32,
    pub p1_total_duration_ms: u64,
    pub p2_total_duration_ms: u64,
    pub winner: String,
    pub total_duration_ms: u64,
    pub date: NaiveDate,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub player_name: String,
    pub total_games: u32,
    pub wins: u32,
    pub win_rate: f64,
    pub avg_duration_per_round_ms: u64,
    pub avg_errors_per_round: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BattleRecordDisplay {
    pub id: i64,
    pub player1_name: String,
    pub player2_name: String,
    pub p1_wins: u32,
    pub p2_wins: u32,
    pub winner: String,
    pub date: String,
}
