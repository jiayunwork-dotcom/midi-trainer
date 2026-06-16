import { create } from "zustand";
import { SCALES, ScaleData, getScaleNotes } from "../utils/musicTheory";
import { BattleRound, BattleRecord, KeyEvent } from "./appStore";

export type BattlePhase = "lobby" | "countdown" | "playing" | "roundBreak" | "finished";
export type CurrentPlayer = 1 | 2;
export type DifficultyMode = "easy" | "medium" | "hard";

export interface PlayerState {
  name: string;
  ready: boolean;
  currentNoteIndex: number;
  correctNotes: number;
  wrongNotes: number;
  startTime: number;
  durationMs: number;
  isTurn: boolean;
  keyEvents: KeyEvent[];
}

export interface BattleState {
  phase: BattlePhase;
  countdown: number;
  breakCountdown: number;
  currentRound: number;
  totalRounds: number;
  currentPlayer: CurrentPlayer;
  difficulty: DifficultyMode;
  
  player1: PlayerState;
  player2: PlayerState;
  
  selectedScale: ScaleData;
  octaves: number;
  rootNote: number;
  scaleNotes: number[];
  
  rounds: BattleRound[];
  currentRoundData: BattleRound | null;
  finalRecord: BattleRecord | null;
  
  setPlayerName: (player: CurrentPlayer, name: string) => void;
  setPlayerReady: (player: CurrentPlayer, ready: boolean) => void;
  setSelectedScale: (scale: ScaleData) => void;
  setOctaves: (octaves: number) => void;
  setDifficulty: (difficulty: DifficultyMode) => void;
  
  startCountdown: () => void;
  startBattle: () => void;
  
  generateRoundScale: () => void;
  handleNotePlayed: (note: number) => "correct" | "wrong" | null;
  switchPlayer: () => void;
  finishRound: () => void;
  startNextRound: () => void;
  
  resetBattle: () => void;
}

const DIFFICULTY_CONFIG: Record<DifficultyMode, { name: string; desc: string }> = {
  easy: { name: "简单", desc: "正序弹奏音阶" },
  medium: { name: "中等", desc: "正序+反序弹奏" },
  hard: { name: "困难", desc: "随机顺序弹奏" },
};

export { DIFFICULTY_CONFIG };

const createInitialPlayerState = (playerNum: 1 | 2): PlayerState => ({
  name: `Player ${playerNum}`,
  ready: false,
  currentNoteIndex: 0,
  correctNotes: 0,
  wrongNotes: 0,
  startTime: 0,
  durationMs: 0,
  isTurn: playerNum === 1,
  keyEvents: [],
});

let countdownInterval: ReturnType<typeof setInterval> | null = null;

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const useBattleStore = create<BattleState>((set, get) => ({
  phase: "lobby",
  countdown: 3,
  breakCountdown: 5,
  currentRound: 1,
  totalRounds: 3,
  currentPlayer: 1,
  difficulty: "easy",
  
  player1: createInitialPlayerState(1),
  player2: createInitialPlayerState(2),
  
  selectedScale: SCALES[0],
  octaves: 2,
  rootNote: 60,
  scaleNotes: [],
  
  rounds: [],
  currentRoundData: null,
  finalRecord: null,

  setPlayerName: (player, name) => {
    const key = player === 1 ? "player1" : "player2";
    set(state => ({
      [key]: { ...state[key], name },
    }));
  },

  setPlayerReady: (player, ready) => {
    const key = player === 1 ? "player1" : "player2";
    const prevState = get();
    
    const wasInCountdown = prevState.phase === "countdown";
    
    set(state => ({
      [key]: { ...state[key], ready },
    }));
    
    const state = get();
    
    if (wasInCountdown && !ready) {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      set({ phase: "lobby", countdown: 3 });
      return;
    }
    
    if (!wasInCountdown && state.player1.ready && state.player2.ready) {
      get().startCountdown();
    }
  },

  setSelectedScale: (scale) => {
    set({ selectedScale: scale });
  },

  setOctaves: (octaves) => {
    set({ octaves });
  },

  setDifficulty: (difficulty) => {
    set({ difficulty });
  },

  startCountdown: () => {
    set({ phase: "countdown", countdown: 3 });
    
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    
    countdownInterval = setInterval(() => {
      const current = get().countdown;
      if (current > 1) {
        set({ countdown: current - 1 });
      } else {
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        get().startBattle();
      }
    }, 1000);
  },

  startBattle: () => {
    get().generateRoundScale();
    set({
      phase: "playing",
      currentRound: 1,
      rounds: [],
      player1: {
        ...get().player1,
        currentNoteIndex: 0,
        correctNotes: 0,
        wrongNotes: 0,
        startTime: Date.now(),
        durationMs: 0,
        isTurn: true,
        keyEvents: [],
      },
      player2: {
        ...get().player2,
        currentNoteIndex: 0,
        correctNotes: 0,
        wrongNotes: 0,
        startTime: 0,
        durationMs: 0,
        isTurn: false,
        keyEvents: [],
      },
      currentPlayer: 1,
    });
  },

  generateRoundScale: () => {
    const rootNoteOptions: number[] = [];
    for (let i = 48; i <= 72; i++) {
      if (![49, 51, 54, 56, 58, 61, 63, 66, 68, 70].includes(i)) {
        rootNoteOptions.push(i);
      }
    }
    const randomRoot = rootNoteOptions[Math.floor(Math.random() * rootNoteOptions.length)];
    const baseNotes = getScaleNotes(randomRoot, get().selectedScale, get().octaves);
    
    const difficulty = get().difficulty;
    let finalNotes: number[];
    
    if (difficulty === "easy") {
      finalNotes = baseNotes;
    } else if (difficulty === "medium") {
      const descendingNotes = baseNotes.slice(0, -1).reverse();
      finalNotes = [...baseNotes, ...descendingNotes];
    } else {
      finalNotes = shuffleArray(baseNotes);
    }
    
    set({
      rootNote: randomRoot,
      scaleNotes: finalNotes,
    });
  },

  handleNotePlayed: (note) => {
    const state = get();
    if (state.phase !== "playing") return null;
    
    const playerKey = state.currentPlayer === 1 ? "player1" : "player2";
    const player = state[playerKey];
    const targetNote = state.scaleNotes[player.currentNoteIndex];
    const isCorrect = note === targetNote;
    
    const keyEvent: KeyEvent = {
      note,
      targetNote,
      isCorrect,
      timestampMs: Date.now() - player.startTime,
    };
    
    const newKeyEvents = [...player.keyEvents, keyEvent];
    
    if (isCorrect) {
      const newIndex = player.currentNoteIndex + 1;
      const newCorrectNotes = player.correctNotes + 1;
      
      if (newIndex >= state.scaleNotes.length) {
        const durationMs = Date.now() - player.startTime;
        
        set({
          [playerKey]: {
            ...player,
            currentNoteIndex: newIndex,
            correctNotes: newCorrectNotes,
            durationMs,
            keyEvents: newKeyEvents,
          },
        });
        
        get().switchPlayer();
        return "correct";
      }
      
      set({
        [playerKey]: {
          ...player,
          currentNoteIndex: newIndex,
          correctNotes: newCorrectNotes,
          keyEvents: newKeyEvents,
        },
      });
      
      return "correct";
    } else {
      set({
        [playerKey]: {
          ...player,
          wrongNotes: player.wrongNotes + 1,
          keyEvents: newKeyEvents,
        },
      });
      
      return "wrong";
    }
  },

  switchPlayer: () => {
    const state = get();
    
    if (state.currentPlayer === 1) {
      set({
        currentPlayer: 2,
        player1: { ...state.player1, isTurn: false },
        player2: { 
          ...state.player2, 
          isTurn: true, 
          startTime: Date.now(),
          currentNoteIndex: 0,
          correctNotes: 0,
          wrongNotes: 0,
          keyEvents: [],
        },
      });
    } else {
      get().finishRound();
    }
  },

  finishRound: () => {
    const state = get();
    
    const p1Score = state.player1.durationMs + state.player1.wrongNotes * 1000;
    const p2Score = state.player2.durationMs + state.player2.wrongNotes * 1000;
    
    let winner: string | null = null;
    if (p1Score < p2Score) {
      winner = state.player1.name;
    } else if (p2Score < p1Score) {
      winner = state.player2.name;
    }
    
    const roundData: BattleRound = {
      roundNumber: state.currentRound,
      rootNote: state.rootNote,
      scaleNotes: state.scaleNotes,
      p1DurationMs: state.player1.durationMs,
      p1Errors: state.player1.wrongNotes,
      p1KeyEvents: state.player1.keyEvents,
      p2DurationMs: state.player2.durationMs,
      p2Errors: state.player2.wrongNotes,
      p2KeyEvents: state.player2.keyEvents,
      winner,
    };
    
    const newRounds = [...state.rounds, roundData];
    const isLastRound = state.currentRound >= state.totalRounds;
    
    if (isLastRound) {
      let p1Wins = 0;
      let p2Wins = 0;
      let totalP1Duration = 0;
      let totalP2Duration = 0;
      
      for (const round of newRounds) {
        totalP1Duration += round.p1DurationMs;
        totalP2Duration += round.p2DurationMs;
        
        if (round.winner === state.player1.name) {
          p1Wins++;
        } else if (round.winner === state.player2.name) {
          p2Wins++;
        }
      }
      
      let finalWinner: string;
      if (p1Wins > p2Wins) {
        finalWinner = state.player1.name;
      } else if (p2Wins > p1Wins) {
        finalWinner = state.player2.name;
      } else {
        finalWinner = totalP1Duration < totalP2Duration ? state.player1.name : state.player2.name;
      }
      
      const finalRecord: BattleRecord = {
        player1Name: state.player1.name,
        player2Name: state.player2.name,
        scaleType: state.selectedScale.name,
        octaves: state.octaves,
        difficulty: state.difficulty,
        rounds: JSON.stringify(newRounds),
        p1Wins,
        p2Wins,
        winner: finalWinner,
        totalDurationMs: totalP1Duration + totalP2Duration,
        date: new Date().toISOString().split("T")[0],
      };
      
      set({
        phase: "roundBreak",
        breakCountdown: 5,
        rounds: newRounds,
        currentRoundData: roundData,
        finalRecord,
      });
    } else {
      set({
        phase: "roundBreak",
        breakCountdown: 5,
        rounds: newRounds,
        currentRoundData: roundData,
      });
    }
    
    const interval = setInterval(() => {
      const current = get().breakCountdown;
      if (current > 1) {
        set({ breakCountdown: current - 1 });
      } else {
        clearInterval(interval);
        if (isLastRound) {
          set({ phase: "finished" });
        } else {
          get().startNextRound();
        }
      }
    }, 1000);
  },

  startNextRound: () => {
    const state = get();
    get().generateRoundScale();
    
    set({
      phase: "playing",
      currentRound: state.currentRound + 1,
      currentPlayer: 1,
      player1: {
        ...state.player1,
        currentNoteIndex: 0,
        correctNotes: 0,
        wrongNotes: 0,
        startTime: Date.now(),
        durationMs: 0,
        isTurn: true,
        keyEvents: [],
      },
      player2: {
        ...state.player2,
        currentNoteIndex: 0,
        correctNotes: 0,
        wrongNotes: 0,
        startTime: 0,
        durationMs: 0,
        isTurn: false,
        keyEvents: [],
      },
    });
  },

  resetBattle: () => {
    set({
      phase: "lobby",
      countdown: 3,
      breakCountdown: 5,
      currentRound: 1,
      currentPlayer: 1,
      player1: { ...createInitialPlayerState(1), name: get().player1.name },
      player2: { ...createInitialPlayerState(2), name: get().player2.name },
      rootNote: 60,
      scaleNotes: [],
      rounds: [],
      currentRoundData: null,
      finalRecord: null,
    });
  },
}));
