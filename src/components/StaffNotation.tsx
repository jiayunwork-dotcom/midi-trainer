import React from "react";
import "../styles/staff.css";

export interface StaffNoteData {
  id: number;
  note: number;
  x: number;
  duration: number;
  hit: boolean;
  missed: boolean;
  accidental?: "#" | "b" | "♮" | null;
  dotted?: boolean;
}

interface StaffNotationProps {
  notes: StaffNoteData[];
  clef?: "treble" | "bass" | "grand";
  width?: number;
  height?: number;
  judgmentLineX?: number;
  showKeySignature?: boolean;
  keySignature?: number;
}

const STAFF_LINE_SPACING = 10;
const NOTEHEAD_WIDTH = 14;
const NOTEHEAD_HEIGHT = 10;

const noteToStaffPosition = (midiNote: number, clef: "treble" | "bass"): number => {
  if (clef === "treble") {
    const topLineF = 77;
    const stepsFromTopLine = (topLineF - midiNote) / 2;
    return stepsFromTopLine * STAFF_LINE_SPACING + 10;
  } else {
    const topLineA = 57;
    const stepsFromTopLine = (topLineA - midiNote) / 2;
    return stepsFromTopLine * STAFF_LINE_SPACING + 10;
  }
};

const getAccidental = (midiNote: number, keySignature: number): "#" | "b" | "♮" | null => {
  const noteInOctave = midiNote % 12;
  const isSharp = [1, 3, 6, 8, 10].includes(noteInOctave);
  const isFlat = [1, 3, 6, 8, 10].map(n => (n + 1) % 12).includes(noteInOctave);
  
  if (keySignature > 0) {
    const sharpsInKey = [1, 8, 3, 10, 5, 0, 7].slice(0, keySignature);
    if (sharpsInKey.includes(noteInOctave)) return null;
    if (isSharp) return "#";
    if (isFlat) return "♮";
  } else if (keySignature < 0) {
    const flatsInKey = [8, 1, 6, 11, 4, 9, 2].slice(0, -keySignature);
    if (flatsInKey.includes(noteInOctave)) return null;
    if (isFlat) return "b";
    if (isSharp) return "♮";
  } else {
    if (isSharp) return "#";
  }
  return null;
};

const needsLedgerLine = (midiNote: number, clef: "treble" | "bass"): { above: number[]; below: number[] } => {
  const above: number[] = [];
  const below: number[] = [];
  const pos = noteToStaffPosition(midiNote, clef);
  
  if (clef === "treble") {
    if (pos < 0) {
      for (let i = -1; i >= pos; i -= 2) {
        above.push(i);
      }
    }
    if (pos > 40) {
      for (let i = 40; i <= pos; i += 2) {
        below.push(i);
      }
    }
  } else {
    if (pos < 0) {
      for (let i = -1; i >= pos; i -= 2) {
        above.push(i);
      }
    }
    if (pos > 40) {
      for (let i = 40; i <= pos; i += 2) {
        below.push(i);
      }
    }
  }
  
  return { above, below };
};

const StaffNotation: React.FC<StaffNotationProps> = ({
  notes,
  clef = "treble",
  width = 900,
  height = 220,
  judgmentLineX = 20,
  showKeySignature = true,
  keySignature = 0,
}) => {
  const staffStartX = 60;
  const staffWidth = width - staffStartX - 20;
  
  const renderStaffLines = (yOffset: number) => {
    const lines = [];
    for (let i = 0; i < 5; i++) {
      const y = yOffset + i * STAFF_LINE_SPACING;
      lines.push(
        <line
          key={`line-${i}`}
          x1={staffStartX}
          y1={y}
          x2={width - 10}
          y2={y}
          stroke="#3a3a5a"
          strokeWidth="1"
        />
      );
    }
    return lines;
  };

  const renderClef = (clefType: "treble" | "bass", x: number, y: number) => {
    if (clefType === "treble") {
      return (
        <g transform={`translate(${x}, ${y})`}>
          <path
            d="M 15 20 C 10 30, 5 40, 15 50 C 25 60, 35 55, 35 45 L 35 15 L 30 5 L 40 5 L 40 45 C 40 55, 30 65, 20 60 C 10 55, 5 40, 15 20 Z"
            fill="none"
            stroke="#e8e8f0"
            strokeWidth="2"
          />
          <circle cx="35" cy="35" r="3" fill="#e8e8f0" />
        </g>
      );
    } else {
      return (
        <g transform={`translate(${x}, ${y})`}>
          <path
            d="M 15 10 C 10 15, 10 25, 15 30 L 15 50 C 10 55, 10 65, 15 70 C 20 75, 30 75, 35 70 C 40 65, 40 55, 35 50 L 35 30 C 40 25, 40 15, 35 10 C 30 5, 20 5, 15 10 Z"
            fill="none"
            stroke="#e8e8f0"
            strokeWidth="2"
          />
          <circle cx="25" cy="30" r="3" fill="#e8e8f0" />
          <circle cx="25" cy="50" r="3" fill="#e8e8f0" />
          <text x="42" y="35" fill="#e8e8f0" fontSize="24" fontWeight="bold">:</text>
        </g>
      );
    }
  };

  const renderKeySignature = (yOffset: number) => {
    if (!showKeySignature || keySignature === 0) return null;
    
    const sharps = ["F♯", "C♯", "G♯", "D♯", "A♯", "E♯", "B♯"];
    const flats = ["B♭", "E♭", "A♭", "D♭", "G♭", "C♭", "F♭"];
    const symbols = keySignature > 0 ? sharps.slice(0, keySignature) : flats.slice(0, -keySignature);
    const positions = keySignature > 0 
      ? [2, 18, 6, 22, 10, 26, 14]
      : [22, 10, 26, 14, 30, 18, 34];
    
    return symbols.map((symbol, i) => (
      <text
        key={`key-${i}`}
        x={staffStartX + 40 + i * 18}
        y={yOffset + positions[i]}
        fill="#e8e8f0"
        fontSize="14"
        fontWeight="bold"
      >
        {symbol.includes("♯") ? "♯" : "♭"}
      </text>
    ));
  };

  const renderNote = (note: StaffNoteData, yOffset: number, clefType: "treble" | "bass") => {
    const staffY = noteToStaffPosition(note.note, clefType);
    const actualY = yOffset + staffY;
    const actualX = staffStartX + (note.x / 100) * staffWidth;
    const accidental = note.accidental || getAccidental(note.note, keySignature);
    const ledger = needsLedgerLine(note.note, clefType);
    const isOnLine = Math.abs(staffY % 10) < 1;
    const stemUp = staffY > 20;
    
    let noteColor = "#e8e8f0";
    if (note.hit) noteColor = "#10b981";
    if (note.missed) noteColor = "#ef4444";
    
    const fillNote = note.duration >= 1;
    const stemHeight = 30;
    const stemY = stemUp ? actualY - stemHeight : actualY + stemHeight;
    
    return (
      <g key={`note-${note.id}`}>
        {ledger.above.map((pos, i) => (
          <line
            key={`ledger-above-${i}`}
            x1={actualX - 12}
            y1={yOffset + pos}
            x2={actualX + 12}
            y2={yOffset + pos}
            stroke="#3a3a5a"
            strokeWidth="1"
          />
        ))}
        {ledger.below.map((pos, i) => (
          <line
            key={`ledger-below-${i}`}
            x1={actualX - 12}
            y1={yOffset + pos}
            x2={actualX + 12}
            y2={yOffset + pos}
            stroke="#3a3a5a"
            strokeWidth="1"
          />
        ))}
        
        {accidental && (
          <text
            x={actualX - 24}
            y={actualY + 4}
            fill={noteColor}
            fontSize="16"
            fontWeight="bold"
          >
            {accidental}
          </text>
        )}
        
        <ellipse
          cx={actualX}
          cy={actualY}
          rx={NOTEHEAD_WIDTH / 2}
          ry={NOTEHEAD_HEIGHT / 2}
          fill={fillNote ? noteColor : "none"}
          stroke={noteColor}
          strokeWidth="1.5"
          transform={`rotate(-15, ${actualX}, ${actualY})`}
        />
        
        {note.dotted && (
          <circle
            cx={actualX + 14}
            cy={isOnLine ? actualY - 5 : actualY}
            r="3"
            fill={noteColor}
          />
        )}
        
        {note.duration <= 2 && (
          <line
            x1={stemUp ? actualX + 6 : actualX - 6}
            y1={actualY}
            x2={stemUp ? actualX + 6 : actualX - 6}
            y2={stemY}
            stroke={noteColor}
            strokeWidth="1.5"
          />
        )}
        
        {note.duration < 1 && (
          <>
            <line
              x1={stemUp ? actualX + 6 : actualX - 6}
              y1={stemY}
              x2={stemUp ? actualX + 20 : actualX - 20}
              y2={stemY + 3}
              stroke={noteColor}
              strokeWidth="1.5"
            />
            {note.duration < 0.5 && (
              <line
                x1={stemUp ? actualX + 6 : actualX - 6}
                y1={stemY + 8}
                x2={stemUp ? actualX + 20 : actualX - 20}
                y2={stemY + 11}
                stroke={noteColor}
                strokeWidth="1.5"
              />
            )}
          </>
        )}
      </g>
    );
  };

  const renderBarLines = (yOffset: number) => {
    return (
      <>
        <line
          x1={staffStartX}
          y1={yOffset}
          x2={staffStartX}
          y2={yOffset + 40}
          stroke="#3a3a5a"
          strokeWidth="2"
        />
        <line
          x1={width - 10}
          y1={yOffset}
          x2={width - 10}
          y2={yOffset + 40}
          stroke="#3a3a5a"
          strokeWidth="2"
        />
      </>
    );
  };

  const trebleY = clef === "bass" ? 0 : clef === "grand" ? 0 : 0;
  const bassY = clef === "grand" ? 100 : 0;

  return (
    <div className="staff-notation" style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="staffGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="100%" stopColor="#16213e" />
          </linearGradient>
        </defs>
        
        <rect x="0" y="0" width={width} height={height} fill="url(#staffGradient)" rx="8" />
        
        {(clef === "treble" || clef === "grand") && (
          <g>
            {renderStaffLines(trebleY + 10)}
            {renderClef("treble", staffStartX - 50, trebleY - 15)}
            {renderKeySignature(trebleY + 10)}
            {renderBarLines(trebleY + 10)}
            {notes.filter(n => n.note >= 60).map(n => renderNote(n, trebleY + 10, "treble"))}
          </g>
        )}
        
        {(clef === "bass" || clef === "grand") && (
          <g>
            {renderStaffLines(bassY + 10)}
            {renderClef("bass", staffStartX - 45, bassY - 35)}
            {renderKeySignature(bassY + 10)}
            {renderBarLines(bassY + 10)}
            {notes.filter(n => n.note < 60).map(n => renderNote(n, bassY + 10, "bass"))}
          </g>
        )}
        
        <line
          x1={staffStartX + (judgmentLineX / 100) * staffWidth}
          y1="0"
          x2={staffStartX + (judgmentLineX / 100) * staffWidth}
          y2={height}
          stroke="#10b981"
          strokeWidth="2"
          strokeDasharray="5,5"
          opacity="0.7"
        />
        
        <rect
          x={staffStartX + (judgmentLineX / 100) * staffWidth - 30}
          y="0"
          width="60"
          height={height}
          fill="#10b981"
          opacity="0.05"
        />
      </svg>
    </div>
  );
};

export default StaffNotation;
