export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function midiNoteToName(note: number, useFlats = false): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
  const octave = Math.floor(note / 12) - 1;
  const noteName = names[note % 12];
  return `${noteName}${octave}`;
}

export function midiNoteToNoteName(note: number, useFlats = false): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
  return names[note % 12];
}

export function midiNoteToOctave(note: number): number {
  return Math.floor(note / 12) - 1;
}

export function isBlackKey(note: number): boolean {
  const n = note % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

export function noteNameToMidi(noteName: string, octave: number): number {
  const names = NOTE_NAMES;
  const index = names.indexOf(noteName);
  if (index === -1) return -1;
  return (octave + 1) * 12 + index;
}

export interface ScaleData {
  name: string;
  nameCn: string;
  intervals: number[];
}

export const SCALES: ScaleData[] = [
  { name: "major", nameCn: "自然大调", intervals: [0, 2, 4, 5, 7, 9, 11, 12] },
  { name: "natural_minor", nameCn: "自然小调", intervals: [0, 2, 3, 5, 7, 8, 10, 12] },
  { name: "harmonic_minor", nameCn: "和声小调", intervals: [0, 2, 3, 5, 7, 8, 11, 12] },
  { name: "melodic_minor", nameCn: "旋律小调", intervals: [0, 2, 3, 5, 7, 9, 11, 12] },
  { name: "pentatonic_major", nameCn: "五声音阶(大调)", intervals: [0, 2, 4, 7, 9, 12] },
  { name: "pentatonic_minor", nameCn: "五声音阶(小调)", intervals: [0, 3, 5, 7, 10, 12] },
  { name: "blues", nameCn: "布鲁斯音阶", intervals: [0, 3, 5, 6, 7, 10, 12] },
  { name: "dorian", nameCn: "多利亚调式", intervals: [0, 2, 3, 5, 7, 9, 10, 12] },
  { name: "mixolydian", nameCn: "混合利底亚", intervals: [0, 2, 4, 5, 7, 9, 10, 12] },
  { name: "whole_tone", nameCn: "全音阶", intervals: [0, 2, 4, 6, 8, 10, 12] },
];

export function getScaleNotes(rootNote: number, scale: ScaleData, octaves = 1): number[] {
  const notes: number[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    let intervals: number[];
    if (oct === 0) {
      intervals = scale.intervals;
    } else if (oct < octaves - 1) {
      intervals = scale.intervals.slice(1);
    } else {
      intervals = scale.intervals.slice(1, -1);
    }
    for (const interval of intervals) {
      const note = rootNote + interval + oct * 12;
      if (note <= 108) {
        notes.push(note);
      }
    }
  }
  if (octaves > 1) {
    const finalNote = rootNote + octaves * 12;
    if (finalNote <= 108) {
      notes.push(finalNote);
    }
  }
  return notes;
}

export interface ChordData {
  name: string;
  nameCn: string;
  intervals: number[];
  symbol: string;
}

export const CHORDS: ChordData[] = [
  { name: "major", nameCn: "大三和弦", intervals: [0, 4, 7], symbol: "maj" },
  { name: "minor", nameCn: "小三和弦", intervals: [0, 3, 7], symbol: "min" },
  { name: "augmented", nameCn: "增三和弦", intervals: [0, 4, 8], symbol: "aug" },
  { name: "diminished", nameCn: "减三和弦", intervals: [0, 3, 6], symbol: "dim" },
  { name: "dominant_7th", nameCn: "属七和弦", intervals: [0, 4, 7, 10], symbol: "7" },
  { name: "major_7th", nameCn: "大七和弦", intervals: [0, 4, 7, 11], symbol: "maj7" },
  { name: "minor_7th", nameCn: "小七和弦", intervals: [0, 3, 7, 10], symbol: "m7" },
  { name: "diminished_7th", nameCn: "减七和弦", intervals: [0, 3, 6, 9], symbol: "dim7" },
  { name: "half_diminished_7th", nameCn: "半减七和弦", intervals: [0, 3, 6, 10], symbol: "m7b5" },
  { name: "sus4", nameCn: "挂四和弦", intervals: [0, 5, 7], symbol: "sus4" },
  { name: "sus2", nameCn: "挂二和弦", intervals: [0, 2, 7], symbol: "sus2" },
  { name: "add9", nameCn: "加九和弦", intervals: [0, 4, 7, 14], symbol: "add9" },
];

export function getChordNotes(rootNote: number, chord: ChordData, inversion = 0): number[] {
  let notes = chord.intervals.map(i => rootNote + i);
  
  for (let i = 0; i < inversion; i++) {
    if (notes.length > 0) {
      const first = notes.shift()!;
      notes.push(first + 12);
    }
  }
  
  return notes;
}

export function getInversionName(inversion: number, _totalNotes: number): string {
  if (inversion === 0) return "原位";
  if (inversion === 1) return "第一转位";
  if (inversion === 2) return "第二转位";
  if (inversion === 3) return "第三转位";
  return `第${inversion}转位`;
}

export const NOTE_DURATIONS = [
  { name: "全音符", value: 4, symbol: "𝅝" },
  { name: "二分音符", value: 2, symbol: "𝅗𝅥" },
  { name: "四分音符", value: 1, symbol: "♩" },
  { name: "八分音符", value: 0.5, symbol: "♪" },
  { name: "十六分音符", value: 0.25, symbol: "𝅘𝅥𝅯" },
];

export const TIME_SIGNATURES = [
  { name: "4/4", beats: 4, beatValue: 4 },
  { name: "3/4", beats: 3, beatValue: 4 },
  { name: "2/4", beats: 2, beatValue: 4 },
  { name: "6/8", beats: 6, beatValue: 8 },
  { name: "9/8", beats: 9, beatValue: 8 },
];

export function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export const CHORD_PROGRESSIONS = [
  { name: "I-V-vi-IV", nameCn: "流行经典进行", degrees: [0, 4, 5, 3], types: ["major", "major", "minor", "major"] },
  { name: "ii-V-I", nameCn: "爵士经典进行", degrees: [2, 4, 0], types: ["minor", "dominant_7th", "major_7th"] },
  { name: "I-IV-V-I", nameCn: "古典进行", degrees: [0, 3, 4, 0], types: ["major", "major", "major", "major"] },
  { name: "I-vi-IV-V", nameCn: "50年代进行", degrees: [0, 5, 3, 4], types: ["major", "minor", "major", "major"] },
  { name: "vi-IV-I-V", nameCn: "伤感进行", degrees: [5, 3, 0, 4], types: ["minor", "major", "major", "major"] },
  { name: "I-ii-IV-V", nameCn: "抒情进行", degrees: [0, 2, 3, 4], types: ["major", "minor", "major", "major"] },
  { name: "I-V-vi-iii-IV-I-ii-V", nameCn: "卡农进行", degrees: [0, 4, 5, 2, 3, 0, 2, 4], types: ["major", "major", "minor", "minor", "major", "major", "minor", "major"] },
  { name: "i-iv-v-i", nameCn: "小调进行", degrees: [0, 3, 4, 0], types: ["minor", "minor", "minor", "minor"] },
];

export const KEY_SIGNATURES = [
  { name: "C", midi: 60, type: "major" as const, nameCn: "C大调" },
  { name: "G", midi: 67, type: "major" as const, nameCn: "G大调" },
  { name: "D", midi: 62, type: "major" as const, nameCn: "D大调" },
  { name: "A", midi: 69, type: "major" as const, nameCn: "A大调" },
  { name: "E", midi: 64, type: "major" as const, nameCn: "E大调" },
  { name: "F", midi: 65, type: "major" as const, nameCn: "F大调" },
  { name: "Bb", midi: 70, type: "major" as const, nameCn: "降B大调" },
  { name: "Eb", midi: 63, type: "major" as const, nameCn: "降E大调" },
  { name: "Am", midi: 69, type: "minor" as const, nameCn: "a小调" },
  { name: "Em", midi: 64, type: "minor" as const, nameCn: "e小调" },
  { name: "Dm", midi: 62, type: "minor" as const, nameCn: "d小调" },
  { name: "Bm", midi: 71, type: "minor" as const, nameCn: "b小调" },
];

export function getProgressionChords(
  keyRoot: number, 
  progression: typeof CHORD_PROGRESSIONS[0],
  isMinorKey: boolean
): { chord: ChordData; root: number }[] {
  const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
  const minorScaleIntervals = [0, 2, 3, 5, 7, 8, 10];
  
  const scaleIntervals = isMinorKey ? minorScaleIntervals : majorScaleIntervals;
  
  return progression.degrees.map((degree, index) => {
    const interval = scaleIntervals[degree];
    const root = keyRoot + interval;
    const chordType = progression.types[index];
    const chord = CHORDS.find(c => c.name === chordType) || CHORDS[0];
    return { chord, root };
  });
}
