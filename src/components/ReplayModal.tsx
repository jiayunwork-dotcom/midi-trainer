import { useState, useEffect, useRef, useMemo } from "react";
import VirtualKeyboard from "./VirtualKeyboard";
import { BattleRound, KeyEvent } from "../store/appStore";
import { midiNoteToName } from "../utils/musicTheory";
import "../styles/replay.css";

interface ReplayModalProps {
  round: BattleRound;
  player1Name: string;
  player2Name: string;
  onClose: () => void;
}

interface ReplayEvent {
  player: 1 | 2;
  event: KeyEvent;
  absoluteTime: number;
}

const ReplayModal = ({ round, player1Name, player2Name, onClose }: ReplayModalProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [highlightedNote, setHighlightedNote] = useState<{ note: number; correct: boolean; targetNote: number } | null>(null);
  
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const p1Duration = round.p1DurationMs;
  const p2Duration = round.p2DurationMs;
  const totalDuration = p1Duration + p2Duration;

  const allEvents = useMemo<ReplayEvent[]>(() => {
    const p1Events: ReplayEvent[] = round.p1KeyEvents.map(e => ({
      player: 1,
      event: e,
      absoluteTime: e.timestampMs,
    }));
    const p2Events: ReplayEvent[] = round.p2KeyEvents.map(e => ({
      player: 2,
      event: e,
      absoluteTime: p1Duration + e.timestampMs,
    }));
    return [...p1Events, ...p2Events].sort((a, b) => a.absoluteTime - b.absoluteTime);
  }, [round, p1Duration]);

  const keyboardRange = useMemo(() => {
    const allNotes = [...round.scaleNotes, ...round.p1KeyEvents.map(e => e.note), ...round.p2KeyEvents.map(e => e.note)];
    const min = Math.min(...allNotes);
    const max = Math.max(...allNotes);
    return {
      startNote: Math.max(12, min - 2),
      endNote: Math.min(108, max + 2),
    };
  }, [round]);

  const getCurrentProgressInfo = () => {
    if (currentTime < p1Duration) {
      return {
        player: 1 as const,
        playerName: player1Name,
        progress: (currentTime / p1Duration) * 50,
        timeInPlayer: currentTime,
        playerDuration: p1Duration,
      };
    } else {
      return {
        player: 2 as const,
        playerName: player2Name,
        progress: 50 + ((currentTime - p1Duration) / p2Duration) * 50,
        timeInPlayer: currentTime - p1Duration,
        playerDuration: p2Duration,
      };
    }
  };

  const progressInfo = getCurrentProgressInfo();

  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const play = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
      setCurrentEventIndex(-1);
      setHighlightedNote(null);
      setCurrentPlayer(1);
      pausedTimeRef.current = 0;
    }
    
    setIsPlaying(true);
    startTimeRef.current = performance.now() - pausedTimeRef.current * speed;
  };

  const pause = () => {
    setIsPlaying(false);
    pausedTimeRef.current = currentTime;
    stopAnimation();
  };

  const reset = () => {
    stopAnimation();
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentEventIndex(-1);
    setHighlightedNote(null);
    setCurrentPlayer(1);
    pausedTimeRef.current = 0;
  };

  useEffect(() => {
    if (!isPlaying) return;

    const animate = (now: number) => {
      const elapsed = (now - startTimeRef.current) / speed;
      const clampedTime = Math.min(elapsed, totalDuration);
      
      setCurrentTime(clampedTime);
      setCurrentPlayer(clampedTime < p1Duration ? 1 : 2);

      let nextEventIndex = currentEventIndex;
      for (let i = currentEventIndex + 1; i < allEvents.length; i++) {
        if (allEvents[i].absoluteTime <= clampedTime) {
          nextEventIndex = i;
        } else {
          break;
        }
      }

      if (nextEventIndex !== currentEventIndex && nextEventIndex >= 0) {
        const evt = allEvents[nextEventIndex];
        setHighlightedNote({
          note: evt.event.note,
          correct: evt.event.isCorrect,
          targetNote: evt.event.targetNote,
        });
        
        setTimeout(() => {
          setHighlightedNote(prev => {
            if (prev && prev.note === evt.event.note) {
              return null;
            }
            return prev;
          });
        }, 300);
        
        setCurrentEventIndex(nextEventIndex);
      }

      if (clampedTime >= totalDuration) {
        setIsPlaying(false);
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => stopAnimation();
  }, [isPlaying, speed, currentEventIndex, allEvents, totalDuration, p1Duration]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " ") {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, onClose]);

  const highlightedNotes = useMemo(() => {
    const notes = new Map<number, { correct: boolean; targetNote: number }>();
    if (highlightedNote) {
      notes.set(highlightedNote.note, { correct: highlightedNote.correct, targetNote: highlightedNote.targetNote });
    }
    return notes;
  }, [highlightedNote]);

  const emptyMap = useMemo(() => new Map<number, any>(), []);

  return (
    <div className="replay-overlay" onClick={onClose}>
      <div className="replay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="replay-header">
          <h2>🎬 回合回放</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="replay-player-info">
          <div className={`player-tag ${currentPlayer === 1 ? "active" : ""} p1`}>
            <span className="player-indicator">P1</span>
            <span className="player-name">{player1Name}</span>
            {currentPlayer === 1 && isPlaying && <span className="playing-indicator">▶ 播放中</span>}
          </div>
          <div className="player-divider">VS</div>
          <div className={`player-tag ${currentPlayer === 2 ? "active" : ""} p2`}>
            <span className="player-indicator">P2</span>
            <span className="player-name">{player2Name}</span>
            {currentPlayer === 2 && isPlaying && <span className="playing-indicator">▶ 播放中</span>}
          </div>
        </div>

        <div className="replay-progress-container">
          <div className="progress-track">
            <div className="progress-segment p1" style={{ width: `${(p1Duration / totalDuration) * 100}%` }} />
            <div className="progress-segment p2" style={{ width: `${(p2Duration / totalDuration) * 100}%` }} />
            <div 
              className="progress-bar" 
              style={{ width: `${progressInfo.progress}%` }}
            />
          </div>
          <div className="progress-labels">
            <span>P1: {(p1Duration / 1000).toFixed(1)}s</span>
            <span>
              {progressInfo.playerName}: {(progressInfo.timeInPlayer / 1000).toFixed(1)}s / {(progressInfo.playerDuration / 1000).toFixed(1)}s
            </span>
            <span>P2: {(p2Duration / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {highlightedNote && !highlightedNote.correct && (
          <div className="wrong-note-hint">
            <span className="hint-label">目标音:</span>
            <span className="hint-note">{midiNoteToName(highlightedNote.targetNote)}</span>
          </div>
        )}

        <div className="replay-keyboard">
          <VirtualKeyboard
            activeNotes={emptyMap}
            highlightedNotes={round.scaleNotes}
            targetNote={null}
            startNote={keyboardRange.startNote}
            endNote={keyboardRange.endNote}
            showNoteNames={true}
            replayNotes={highlightedNotes}
          />
        </div>

        <div className="event-list-container">
          <h4>按键记录</h4>
          <div className="event-list">
            {allEvents.map((evt, idx) => (
              <div 
                key={idx} 
                className={`event-item ${evt.player === 1 ? "p1" : "p2"} ${idx <= currentEventIndex ? "played" : ""} ${idx === currentEventIndex ? "current" : ""}`}
              >
                <span className="event-player">P{evt.player}</span>
                <span className={`event-note ${evt.event.isCorrect ? "correct" : "wrong"}`}>
                  {midiNoteToName(evt.event.note)}
                  {!evt.event.isCorrect && <span className="target-hint">→{midiNoteToName(evt.event.targetNote)}</span>}
                </span>
                <span className="event-time">{(evt.event.timestampMs / 1000).toFixed(2)}s</span>
                <span className="event-result">{evt.event.isCorrect ? "✓" : "✗"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="replay-controls">
          <button className="control-btn" onClick={reset} title="重新开始">
            ⏮ 重置
          </button>
          <button className="control-btn primary" onClick={isPlaying ? pause : play}>
            {isPlaying ? "⏸ 暂停" : "▶ 播放"}
          </button>
          <div className="speed-control">
            <span>速度:</span>
            <button 
              className={`speed-btn ${speed === 1 ? "active" : ""}`}
              onClick={() => setSpeed(1)}
            >
              1x
            </button>
            <button 
              className={`speed-btn ${speed === 2 ? "active" : ""}`}
              onClick={() => setSpeed(2)}
            >
              2x
            </button>
          </div>
        </div>

        <div className="replay-footer">
          <p className="hint-text">按 空格键 播放/暂停，按 ESC 关闭</p>
        </div>
      </div>
    </div>
  );
};

export default ReplayModal;
