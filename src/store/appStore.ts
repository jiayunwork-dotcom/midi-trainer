import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface MidiDevice {
  id: number;
  name: string;
}

export interface ActiveNote {
  note: number;
  velocity: number;
  timestamp: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress: number;
  unlocked_at?: string;
}

export interface PracticeSession {
  id?: number;
  module_type: string;
  duration_secs: number;
  accuracy: number;
  date: string;
  details?: string;
}

export interface WeeklyStats {
  total_minutes: number;
  daily_minutes: [string, number][];
  module_accuracy: [string, number][];
}

export interface BattleRound {
  roundNumber: number;
  rootNote: number;
  p1DurationMs: number;
  p1Errors: number;
  p2DurationMs: number;
  p2Errors: number;
  winner: string | null;
}

export interface BattleRecord {
  id?: number;
  player1Name: string;
  player2Name: string;
  scaleType: string;
  octaves: number;
  rounds: string;
  p1Wins: number;
  p2Wins: number;
  winner: string;
  totalDurationMs: number;
  date: string;
  createdAt?: string;
}

export interface BattleRecordDisplay {
  id: number;
  player1Name: string;
  player2Name: string;
  p1Wins: number;
  p2Wins: number;
  winner: string;
  date: string;
}

interface AppState {
  midiDevices: MidiDevice[];
  midiDevice: MidiDevice | null;
  activeNotes: Map<number, ActiveNote>;
  volume: number;
  soundPreset: "piano" | "electric_piano" | "organ";
  dailyGoal: number;
  todayPracticeTime: number;
  streak: number;
  achievements: Achievement[];
  weeklyStats: WeeklyStats | null;
  
  setVolume: (v: number) => void;
  setSoundPreset: (p: "piano" | "electric_piano" | "organ") => void;
  setDailyGoal: (minutes: number) => void;
  
  initMidiListener: () => Promise<void>;
  listMidiDevices: () => Promise<void>;
  connectMidiDevice: (id: number) => Promise<void>;
  disconnectMidiDevice: () => Promise<void>;
  
  noteOn: (note: number, velocity: number) => Promise<void>;
  noteOff: (note: number) => Promise<void>;
  
  loadStats: () => Promise<void>;
  loadAchievements: () => Promise<void>;
  savePracticeSession: (session: PracticeSession) => Promise<number>;
  saveBattleRecord: (record: BattleRecord) => Promise<number>;
  loadBattleHistory: (limit?: number) => Promise<BattleRecordDisplay[]>;
  
  showAchievementNotification: (achievement: Achievement) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  midiDevices: [],
  midiDevice: null,
  activeNotes: new Map(),
  volume: 0.7,
  soundPreset: "piano",
  dailyGoal: 30,
  todayPracticeTime: 0,
  streak: 0,
  achievements: [],
  weeklyStats: null,

  setVolume: (v) => {
    set({ volume: v });
    invoke("set_volume", { volume: v }).catch(console.error);
  },

  setSoundPreset: (p) => {
    set({ soundPreset: p });
    invoke("set_sound_preset", { preset: p }).catch(console.error);
  },

  setDailyGoal: async (minutes) => {
    set({ dailyGoal: minutes });
    await invoke("set_daily_goal", { minutes }).catch(console.error);
  },

  initMidiListener: async () => {
    await listen("midi-note", (event: any) => {
      const { note, velocity, isNoteOn } = event.payload;
      const activeNotes = new Map(get().activeNotes);
      
      if (isNoteOn) {
        activeNotes.set(note, {
          note,
          velocity,
          timestamp: Date.now(),
        });
      } else {
        activeNotes.delete(note);
      }
      
      set({ activeNotes });
    });

    await listen("midi-sustain", (event: any) => {
      const { isDown } = event.payload;
      if (isDown) {
        invoke("sustain_pedal_down").catch(console.error);
      } else {
        invoke("sustain_pedal_up").catch(console.error);
      }
    });

    get().listMidiDevices();
    get().loadStats();
    get().loadAchievements();
  },

  listMidiDevices: async () => {
    try {
      const devices = await invoke<MidiDevice[]>("list_midi_devices");
      set({ midiDevices: devices });
    } catch (e) {
      console.error("Failed to list MIDI devices:", e);
    }
  },

  connectMidiDevice: async (id: number) => {
    try {
      await invoke("connect_midi_device", { deviceId: id });
      const devices = get().midiDevices;
      const device = devices.find(d => d.id === id);
      if (device) {
        set({ midiDevice: device });
      }
    } catch (e) {
      console.error("Failed to connect MIDI device:", e);
    }
  },

  disconnectMidiDevice: async () => {
    try {
      await invoke("disconnect_midi_device");
      set({ midiDevice: null });
    } catch (e) {
      console.error("Failed to disconnect MIDI device:", e);
    }
  },

  noteOn: async (note: number, velocity: number) => {
    const activeNotes = new Map(get().activeNotes);
    activeNotes.set(note, { note, velocity, timestamp: Date.now() });
    set({ activeNotes });
    
    await invoke("note_on", { note, velocity }).catch(console.error);
  },

  noteOff: async (note: number) => {
    const activeNotes = new Map(get().activeNotes);
    activeNotes.delete(note);
    set({ activeNotes });
    
    await invoke("note_off", { note }).catch(console.error);
  },

  loadStats: async () => {
    try {
      const [streak, goal, todayTime, weekly] = await Promise.all([
        invoke<number>("get_streak"),
        invoke<number>("get_daily_goal"),
        invoke<number>("get_today_practice_time"),
        invoke<WeeklyStats>("get_weekly_stats"),
      ]);
      
      set({
        streak,
        dailyGoal: goal,
        todayPracticeTime: todayTime,
        weeklyStats: weekly,
      });
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
  },

  loadAchievements: async () => {
    try {
      const achievements = await invoke<Achievement[]>("get_achievements");
      set({ achievements });
    } catch (e) {
      console.error("Failed to load achievements:", e);
    }
  },

  savePracticeSession: async (session: PracticeSession) => {
    try {
      const id = await invoke<number>("save_practice_session", { session });
      get().loadStats();
      return id;
    } catch (e) {
      console.error("Failed to save session:", e);
      return -1;
    }
  },

  saveBattleRecord: async (record: BattleRecord) => {
    try {
      const id = await invoke<number>("save_battle_record", { record });
      return id;
    } catch (e) {
      console.error("Failed to save battle record:", e);
      return -1;
    }
  },

  loadBattleHistory: async (limit = 10) => {
    try {
      const history = await invoke<BattleRecordDisplay[]>("get_battle_history", { limit });
      return history;
    } catch (e) {
      console.error("Failed to load battle history:", e);
      return [];
    }
  },

  showAchievementNotification: (achievement: Achievement) => {
    // 可以在这里添加通知逻辑
    console.log("Achievement unlocked:", achievement.name);
  },
}));
