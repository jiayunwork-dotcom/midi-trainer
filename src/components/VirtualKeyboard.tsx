import { useCallback, useEffect, useRef, useState } from "react";
import { isBlackKey, midiNoteToOctave, midiNoteToNoteName } from "../utils/musicTheory";
import { useAppStore } from "../store/appStore";
import "../styles/keyboard.css";

interface VirtualKeyboardProps {
  activeNotes: Map<number, { note: number; velocity: number; timestamp: number }>;
  highlightedNotes?: number[];
  targetNote?: number | null;
  showNoteNames?: boolean;
  startNote?: number;
  endNote?: number;
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
  replayNotes?: Map<number, { correct: boolean; targetNote: number }>;
}

const VirtualKeyboard = ({
  activeNotes,
  highlightedNotes = [],
  targetNote = null,
  showNoteNames = true,
  startNote = 21,
  endNote = 108,
  onNoteOn,
  onNoteOff,
  replayNotes = new Map(),
}: VirtualKeyboardProps) => {
  const keyboardRef = useRef<HTMLDivElement>(null);
  const [whiteKeys, setWhiteKeys] = useState<number[]>([]);
  const [blackKeys, setBlackKeys] = useState<number[]>([]);
  const { noteOn: storeNoteOn, noteOff: storeNoteOff } = useAppStore();

  useEffect(() => {
    const white: number[] = [];
    const black: number[] = [];
    
    for (let note = startNote; note <= endNote; note++) {
      if (isBlackKey(note)) {
        black.push(note);
      } else {
        white.push(note);
      }
    }
    
    setWhiteKeys(white);
    setBlackKeys(black);
  }, [startNote, endNote]);

  const handleMouseDown = useCallback((note: number, e: React.MouseEvent) => {
    e.preventDefault();
    const velocity = 100;
    if (onNoteOn) {
      onNoteOn(note, velocity);
    } else {
      storeNoteOn(note, velocity);
    }
  }, [onNoteOn, storeNoteOn]);

  const handleMouseUp = useCallback((note: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (onNoteOff) {
      onNoteOff(note);
    } else {
      storeNoteOff(note);
    }
  }, [onNoteOff, storeNoteOff]);

  const handleMouseLeave = useCallback((note: number) => {
    const active = activeNotes.has(note);
    if (active) {
      if (onNoteOff) {
        onNoteOff(note);
      } else {
        storeNoteOff(note);
      }
    }
  }, [activeNotes, onNoteOff, storeNoteOff]);

  const isHighlighted = (note: number) => highlightedNotes.includes(note);
  const isTarget = (note: number) => targetNote === note;
  const getReplayState = (note: number) => replayNotes.get(note);

  const getVelocityColor = (velocity: number, isBlack: boolean) => {
    const intensity = velocity / 127;
    if (isBlack) {
      const lightness = Math.floor(20 + intensity * 30);
      return `hsl(220, 60%, ${lightness}%)`;
    } else {
      const lightness = Math.floor(70 - intensity * 40);
      return `hsl(220, 80%, ${lightness}%)`;
    }
  };

  const whiteKeyWidth = 100 / whiteKeys.length;

  const getBlackKeyPosition = (note: number) => {
    const whiteIndexBefore = whiteKeys.findIndex(w => w > note) - 1;
    if (whiteIndexBefore < 0) return 0;
    return (whiteIndexBefore + 1) * whiteKeyWidth - (whiteKeyWidth * 0.3);
  };

  const getWhiteKeyIndex = (note: number) => {
    return whiteKeys.indexOf(note);
  };

  const shouldShowOctaveLabel = (note: number) => {
    return midiNoteToNoteName(note) === "C";
  };

  return (
    <div className="virtual-keyboard" ref={keyboardRef}>
      <div className="keyboard-keys">
        {whiteKeys.map((note) => {
          const active = activeNotes.get(note);
          const highlighted = isHighlighted(note);
          const target = isTarget(note);
          const replayState = getReplayState(note);
          const octave = midiNoteToOctave(note);
          const noteName = midiNoteToNoteName(note);
          
          let bgColor = "#f5f5f5";
          let classNames = "white-key";
          
          if (replayState) {
            classNames += replayState.correct ? " replay-correct" : " replay-wrong";
          } else if (active) {
            bgColor = getVelocityColor(active.velocity, false);
            classNames += " active";
          } else if (target) {
            classNames += " target";
          } else if (highlighted) {
            classNames += " highlighted";
          }
          
          return (
            <div
              key={note}
              className={classNames}
              style={{
                left: `${getWhiteKeyIndex(note) * whiteKeyWidth}%`,
                width: `${whiteKeyWidth}%`,
                backgroundColor: bgColor,
              }}
              onMouseDown={(e) => handleMouseDown(note, e)}
              onMouseUp={(e) => handleMouseUp(note, e)}
              onMouseLeave={() => handleMouseLeave(note)}
            >
              {showNoteNames && shouldShowOctaveLabel(note) && (
                <span className="octave-label">C{octave}</span>
              )}
              {showNoteNames && (
                <span className="note-name">{noteName}</span>
              )}
            </div>
          );
        })}
        
        {blackKeys.map((note) => {
          const active = activeNotes.get(note);
          const highlighted = isHighlighted(note);
          const target = isTarget(note);
          const replayState = getReplayState(note);
          
          let bgColor = "#1a1a2e";
          let classNames = "black-key";
          
          if (replayState) {
            classNames += replayState.correct ? " replay-correct" : " replay-wrong";
          } else if (active) {
            bgColor = getVelocityColor(active.velocity, true);
            classNames += " active";
          } else if (target) {
            classNames += " target";
          } else if (highlighted) {
            classNames += " highlighted";
          }
          
          return (
            <div
              key={note}
              className={classNames}
              style={{
                left: `${getBlackKeyPosition(note)}%`,
                width: `${whiteKeyWidth * 0.6}%`,
                backgroundColor: bgColor,
              }}
              onMouseDown={(e) => handleMouseDown(note, e)}
              onMouseUp={(e) => handleMouseUp(note, e)}
              onMouseLeave={() => handleMouseLeave(note)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default VirtualKeyboard;
