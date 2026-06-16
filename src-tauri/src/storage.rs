use std::path::PathBuf;
use anyhow::Result;
use chrono::{Duration, Local, NaiveDate, Datelike};
use dirs::data_dir;
use crate::models::{Achievement, PracticeSession, WeeklyStats, BattleRecord, BattleRecordDisplay, LeaderboardEntry, BattleRound};
use crate::AppState;

pub struct Storage {
    db_path: PathBuf,
    conn: Option<rusqlite::Connection>,
}

unsafe impl Send for Storage {}
unsafe impl Sync for Storage {}

impl Storage {
    pub fn new() -> Result<Self> {
        let mut db_path = data_dir().unwrap_or_else(|| PathBuf::from("."));
        db_path.push("MIDITrainer");
        std::fs::create_dir_all(&db_path)?;
        db_path.push("midi_trainer.db");
        
        let conn = rusqlite::Connection::open(&db_path)?;
        Self::init_db(&conn)?;
        
        Ok(Self {
            db_path,
            conn: Some(conn),
        })
    }

    fn init_db(conn: &rusqlite::Connection) -> Result<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS practice_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_type TEXT NOT NULL,
                duration_secs INTEGER NOT NULL,
                accuracy REAL NOT NULL,
                date TEXT NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS achievements (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                unlocked INTEGER DEFAULT 0,
                progress REAL DEFAULT 0,
                unlocked_at DATETIME
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS battle_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player1_name TEXT NOT NULL,
                player2_name TEXT NOT NULL,
                scale_type TEXT NOT NULL,
                octaves INTEGER NOT NULL,
                difficulty TEXT NOT NULL DEFAULT 'easy',
                rounds TEXT NOT NULL,
                p1_wins INTEGER NOT NULL DEFAULT 0,
                p2_wins INTEGER NOT NULL DEFAULT 0,
                winner TEXT NOT NULL,
                total_duration_ms INTEGER NOT NULL,
                date TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        let _ = conn.execute(
            "ALTER TABLE battle_records ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'easy'",
            [],
        );

        Self::init_achievements(conn)?;
        Self::init_default_settings(conn)?;

        Ok(())
    }

    fn init_achievements(conn: &rusqlite::Connection) -> Result<()> {
        let achievements = vec![
            ("streak_7", "持之以恒", "连续练习7�?),
            ("scale_perfect", "完美音阶", "某个音阶练习正确率达�?00%"),
            ("all_major_scales", "大调大师", "完成所有大调音阶练�?),
            ("rhythm_perfect", "节奏大师", "节奏练习Perfect率超�?0%"),
            ("sight_reading_50", "视奏达人", "视奏训练连续50个音正确"),
            ("first_practice", "初出茅庐", "完成第一次练�?),
            ("practice_10h", "勤学苦练", "累计练习时长达到10小时"),
            ("chord_master", "和弦达人", "掌握10种不同的和弦"),
            ("all_minor_scales", "小调行家", "完成所有小调音阶练�?),
            ("blues_master", "布鲁斯之�?, "完成布鲁斯音阶练�?),
            ("pentatonic_master", "五声高手", "掌握五声音阶"),
            ("modes_explorer", "调式探索�?, "尝试所有教会调�?),
            ("perfect_chord", "精准和弦", "某个和弦练习正确�?00%"),
            ("daily_goal", "目标达成", "完成每日练习目标"),
            ("streak_30", "月度达人", "连续练习30�?),
        ];

        for (id, name, desc) in achievements {
            conn.execute(
                "INSERT OR IGNORE INTO achievements (id, name, description) VALUES (?1, ?2, ?3)",
                [id, name, desc],
            )?;
        }

        Ok(())
    }

    fn init_default_settings(conn: &rusqlite::Connection) -> Result<()> {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            ["daily_goal_minutes", "30"],
        )?;
        Ok(())
    }

    fn get_conn(&self) -> &rusqlite::Connection {
        self.conn.as_ref().unwrap()
    }

    pub fn save_session(&self, session: PracticeSession) -> Result<i64> {
        let conn = self.get_conn();
        conn.execute(
            "INSERT INTO practice_sessions (module_type, duration_secs, accuracy, date, details)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            [
                &session.module_type,
                &session.duration_secs.to_string(),
                &session.accuracy.to_string(),
                &session.date.format("%Y-%m-%d").to_string(),
                &session.details.unwrap_or_default(),
            ],
        )?;
        
        Ok(conn.last_insert_rowid())
    }

    pub fn get_history(&self, limit: u32) -> Result<Vec<PracticeSession>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT id, module_type, duration_secs, accuracy, date, details 
             FROM practice_sessions 
             ORDER BY date DESC, id DESC 
             LIMIT ?1",
        )?;
        
        let sessions = stmt.query_map([limit.to_string()], |row| {
            let date_str: String = row.get(4)?;
            let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                .unwrap_or_else(|_| Local::now().date_naive());
            
            Ok(PracticeSession {
                id: Some(row.get(0)?),
                module_type: row.get(1)?,
                duration_secs: row.get(2)?,
                accuracy: row.get(3)?,
                date,
                details: row.get(5)?,
            })
        })?;
        
        Ok(sessions.filter_map(|s| s.ok()).collect())
    }

    pub fn get_weekly_stats(&self) -> Result<WeeklyStats> {
        let conn = self.get_conn();
        let today = Local::now().date_naive();
        let week_start = today - Duration::days(6);
        
        let mut stmt = conn.prepare(
            "SELECT date, SUM(duration_secs) as total_secs, AVG(accuracy) as avg_accuracy
             FROM practice_sessions
             WHERE date >= ?1
             GROUP BY date
             ORDER BY date ASC",
        )?;
        
        let mut daily_map: Vec<(String, u32)> = Vec::new();
        let mut total_minutes = 0u32;
        
        for i in 0..7 {
            let d = week_start + Duration::days(i);
            let d_str = d.format("%Y-%m-%d").to_string();
            let weekday = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.weekday().num_days_from_sunday() as usize];
            daily_map.push((format!("{} {}", d_str, weekday), 0));
        }
        
        let rows = stmt.query_map([week_start.format("%Y-%m-%d").to_string()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, f32>(2)?))
        })?;
        
        for row in rows {
            if let Ok((date_str, secs, _acc)) = row {
                let mins = (secs as u32) / 60;
                total_minutes += mins;
                
                if let Some(entry) = daily_map.iter_mut().find(|(d, _)| d.starts_with(&date_str)) {
                    entry.1 = mins;
                }
            }
        }
        
        let mut module_stmt = conn.prepare(
            "SELECT module_type, AVG(accuracy) as avg_accuracy
             FROM practice_sessions
             WHERE date >= ?1
             GROUP BY module_type",
        )?;
        
        let module_rows = module_stmt.query_map([week_start.format("%Y-%m-%d").to_string()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f32>(1)?))
        })?;
        
        let mut module_accuracy = Vec::new();
        for row in module_rows {
            if let Ok((module, acc)) = row {
                module_accuracy.push((module, acc));
            }
        }
        
        Ok(WeeklyStats {
            total_minutes,
            daily_minutes: daily_map,
            module_accuracy,
        })
    }

    pub fn get_streak(&self) -> Result<u32> {
        let conn = self.get_conn();
        let today = Local::now().date_naive();
        
        let mut stmt = conn.prepare(
            "SELECT DISTINCT date FROM practice_sessions ORDER BY date DESC",
        )?;
        
        let dates: Vec<String> = stmt.query_map([], |row| row.get(0))?
            .filter_map(|d| d.ok())
            .collect();
        
        let mut streak = 0;
        let mut check_date = today;
        
        for date_str in &dates {
            if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                if d == check_date {
                    streak += 1;
                    check_date = check_date - Duration::days(1);
                } else if d < check_date {
                    break;
                }
            }
        }
        
        Ok(streak)
    }

    pub fn get_achievements(&self) -> Result<Vec<Achievement>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, unlocked, progress, unlocked_at 
             FROM achievements 
             ORDER BY id",
        )?;
        
        let achievements = stmt.query_map([], |row| {
            use chrono::TimeZone;
            let unlocked_at_str: Option<String> = row.get(5)?;
            let unlocked_at = unlocked_at_str.and_then(|s| {
                chrono::DateTime::parse_from_rfc3339(&s).ok().map(|dt| dt.with_timezone(&chrono::Utc))
            });
            
            Ok(Achievement {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                unlocked: row.get::<_, i64>(3)? != 0,
                progress: row.get(4)?,
                unlocked_at,
            })
        })?;
        
        Ok(achievements.filter_map(|a| a.ok()).collect())
    }

    pub fn unlock_achievement(&self, id: &str) -> Result<bool> {
        let conn = self.get_conn();
        
        let mut stmt = conn.prepare("SELECT unlocked FROM achievements WHERE id = ?1")?;
        let already_unlocked: i64 = stmt.query_row([id], |row| row.get(0)).unwrap_or(0);
        
        if already_unlocked != 0 {
            return Ok(false);
        }
        
        conn.execute(
            "UPDATE achievements SET unlocked = 1, progress = 1.0, unlocked_at = datetime('now') WHERE id = ?1",
            [id],
        )?;
        
        Ok(true)
    }

    pub fn get_daily_goal(&self) -> Result<u32> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'daily_goal_minutes'")?;
        let value: String = stmt.query_row([], |row| row.get(0)).unwrap_or_else(|_| "30".to_string());
        Ok(value.parse().unwrap_or(30))
    }

    pub fn set_daily_goal(&self, minutes: u32) -> Result<()> {
        let conn = self.get_conn();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_goal_minutes', ?1)",
            [minutes.to_string()],
        )?;
        Ok(())
    }

    pub fn get_today_practice_time(&self) -> Result<u32> {
        let conn = self.get_conn();
        let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
        
        let mut stmt = conn.prepare(
            "SELECT COALESCE(SUM(duration_secs), 0) FROM practice_sessions WHERE date = ?1",
        )?;
        
        let secs: i64 = stmt.query_row([today], |row| row.get(0)).unwrap_or(0);
        Ok(secs as u32)
    }

    pub fn save_battle_record(&self, record: BattleRecord) -> Result<i64> {
        let conn = self.get_conn();
        conn.execute(
            "INSERT INTO battle_records (
                player1_name, player2_name, scale_type, octaves, difficulty, rounds,
                p1_wins, p2_wins, winner, total_duration_ms, date
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            [
                &record.player1_name,
                &record.player2_name,
                &record.scale_type,
                &record.octaves.to_string(),
                &record.difficulty,
                &record.rounds,
                &record.p1_wins.to_string(),
                &record.p2_wins.to_string(),
                &record.winner,
                &record.total_duration_ms.to_string(),
                &record.date.format("%Y-%m-%d").to_string(),
            ],
        )?;
        
        Ok(conn.last_insert_rowid())
    }

    pub fn get_battle_history(&self, limit: u32) -> Result<Vec<BattleRecordDisplay>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT id, player1_name, player2_name, p1_wins, p2_wins, winner, date, created_at
             FROM battle_records 
             ORDER BY created_at DESC 
             LIMIT ?1",
        )?;
        
        let records = stmt.query_map([limit.to_string()], |row| {
            Ok(BattleRecordDisplay {
                id: row.get(0)?,
                player1_name: row.get(1)?,
                player2_name: row.get(2)?,
                p1_wins: row.get(3)?,
                p2_wins: row.get(4)?,
                winner: row.get(5)?,
                date: row.get(6)?,
            })
        })?;
        
        Ok(records.filter_map(|r| r.ok()).collect())
    }

    pub fn get_leaderboard(&self, limit: u32) -> Result<Vec<LeaderboardEntry>> {
        let conn = self.get_conn();
        
        let mut stmt = conn.prepare(
            "SELECT 
                player_name,
                COUNT(*) as total_games,
                SUM(CASE WHEN winner = player_name THEN 1 ELSE 0 END) as wins,
                SUM(total_duration_ms / 2.0) as total_player_duration,
                SUM(CASE 
                    WHEN p1_wins + p2_wins < 3 THEN 3 
                    ELSE p1_wins + p2_wins 
                END) as total_rounds
             FROM (
                 SELECT 
                     player1_name as player_name,
                     winner,
                     total_duration_ms,
                     p1_wins,
                     p2_wins
                 FROM battle_records
                 UNION ALL
                 SELECT 
                     player2_name as player_name,
                     winner,
                     total_duration_ms,
                     p1_wins,
                     p2_wins
                 FROM battle_records
             ) AS player_stats
             GROUP BY player_name
             ORDER BY 
                (wins * 1.0 / COUNT(*)) DESC,
                COUNT(*) DESC,
                total_player_duration ASC
             LIMIT ?1",
        )?;
        
        let entries = stmt.query_map([limit.to_string()], |row| {
            let player_name: String = row.get(0)?;
            let total_games: u32 = row.get(1)?;
            let wins: u32 = row.get(2)?;
            let total_player_duration: f64 = row.get(3)?;
            let total_rounds: i64 = row.get(4)?;
            
            let win_rate = if total_games > 0 {
                wins as f64 / total_games as f64
            } else {
                0.0
            };
            
            let avg_duration_per_round_ms = if total_rounds > 0 {
                (total_player_duration / total_rounds as f64) as u64
            } else {
                0
            };
            
            Ok(LeaderboardEntry {
                rank: 0,
                player_name,
                total_games,
                wins,
                win_rate,
                avg_duration_per_round_ms,
                avg_errors_per_round: 0.0,
            })
        })?;
        
        let mut result: Vec<LeaderboardEntry> = entries.filter_map(|e| e.ok()).collect();
        for (i, entry) in result.iter_mut().enumerate() {
            entry.rank = (i + 1) as u32;
        }
        
        Ok(result)
    }
}

#[tauri::command]
pub fn save_practice_session(state: tauri::State<AppState>, session: PracticeSession) -> Result<i64, String> {
    state.storage.lock()
        .save_session(session)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_practice_history(state: tauri::State<AppState>, limit: u32) -> Result<Vec<PracticeSession>, String> {
    state.storage.lock()
        .get_history(limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_weekly_stats(state: tauri::State<AppState>) -> Result<WeeklyStats, String> {
    state.storage.lock()
        .get_weekly_stats()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_streak(state: tauri::State<AppState>) -> Result<u32, String> {
    state.storage.lock()
        .get_streak()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_achievements(state: tauri::State<AppState>) -> Result<Vec<Achievement>, String> {
    state.storage.lock()
        .get_achievements()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unlock_achievement(state: tauri::State<AppState>, id: String) -> Result<bool, String> {
    state.storage.lock()
        .unlock_achievement(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_daily_goal(state: tauri::State<AppState>) -> Result<u32, String> {
    state.storage.lock()
        .get_daily_goal()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_daily_goal(state: tauri::State<AppState>, minutes: u32) -> Result<(), String> {
    state.storage.lock()
        .set_daily_goal(minutes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_today_practice_time(state: tauri::State<AppState>) -> Result<u32, String> {
    state.storage.lock()
        .get_today_practice_time()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_battle_record(state: tauri::State<AppState>, record: BattleRecord) -> Result<i64, String> {
    state.storage.lock()
        .save_battle_record(record)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_battle_history(state: tauri::State<AppState>, limit: u32) -> Result<Vec<BattleRecordDisplay>, String> {
    state.storage.lock()
        .get_battle_history(limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_leaderboard(state: tauri::State<AppState>, limit: u32) -> Result<Vec<LeaderboardEntry>, String> {
    state.storage.lock()
        .get_leaderboard(limit)
        .map_err(|e| e.to_string())
}
