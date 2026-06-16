import { useState, useEffect, useCallback, useRef } from "react";
import VirtualKeyboard from "../components/VirtualKeyboard";
import { CHORDS, getChordNotes, getInversionName, midiNoteToName, NOTE_NAMES } from "../utils/musicTheory";
import { useAppStore } from "../store/appStore";
import "../styles/practice.css";

type ChordMode = "play" | "ear";

const ChordPractice = () => {
  const { activeNotes, savePracticeSession, noteOn: storeNoteOn, noteOff: storeNoteOff } = useAppStore();
  
  const [selectedChord, setSelectedChord] = useState(CHORDS[0]);
  const [rootNote, setRootNote] = useState(60);
  const [inversion, setInversion] = useState(0);
  const [mode, setMode] = useState<ChordMode>("play");
  
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [practiceChords, setPracticeChords] = useState<{ chord: typeof CHORDS[0]; root: number; inversion: number }[]>([]);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const [earOptions, setEarOptions] = useState<typeof CHORDS[0][]>([]);
  
  const [stats, setStats] = useState({
    total: 0,
    correct: 0,
    wrong: 0,
    startTime: 0,
  });
  
  const [showResults, setShowResults] = useState(false);
  const pressedNotesRef = useRef<number[]>([]);
  const prevActiveCountRef = useRef(0);
  const chordStartTimeRef = useRef<number>(0);

  const generatePracticeChords = useCallback(() => {
    const chords: typeof practiceChords = [];
    const roots = [60, 62, 64, 65, 67, 69, 71];
    
    for (let i = 0; i < 10; i++) {
      const chord = CHORDS[Math.floor(Math.random() * CHORDS.length)];
      const root = roots[Math.floor(Math.random() * roots.length)];
      const inv = Math.floor(Math.random() * Math.min(3, chord.intervals.length));
      chords.push({ chord, root, inversion: inv });
    }
    
    setPracticeChords(chords);
  }, []);

  useEffect(() => {
    if (mode === "ear" && isPracticing && practiceChords.length > 0) {
      const current = practiceChords[currentChordIndex];
      const options = [current.chord];
      while (options.length < 4) {
        const randomChord = CHORDS[Math.floor(Math.random() * CHORDS.length)];
        if (!options.find(c => c.name === randomChord.name)) {
          options.push(randomChord);
        }
      }
      setEarOptions(options.sort(() => Math.random() - 0.5));
    }
  }, [mode, isPracticing, currentChordIndex, practiceChords]);

  useEffect(() => {
    if (!isPracticing) return;

    const currentCount = activeNotes.size;
    const prevCount = prevActiveCountRef.current;

    if (mode === "play") {
      if (currentCount > prevCount) {
        for (const [note] of activeNotes) {
          if (!pressedNotesRef.current.includes(note)) {
            pressedNotesRef.current.push(note);
          }
        }
      }

      if (currentCount === 0 && prevCount > 0 && pressedNotesRef.current.length > 0) {
        checkChord();
      }
    }

    prevActiveCountRef.current = currentCount;
  }, [activeNotes, isPracticing, mode, currentChordIndex, practiceChords]);

  const checkChord = () => {
    if (practiceChords.length === 0) return;
    
    const current = practiceChords[currentChordIndex];
    const targetNotes = getChordNotes(current.root, current.chord, current.inversion);
    const pressed = [...pressedNotesRef.current].sort((a, b) => a - b);
    
    const targetSorted = [...targetNotes].sort((a, b) => a - b);
    const isCorrect = pressed.length === targetSorted.length && 
      pressed.every((n, i) => n === targetSorted[i]);

    setStats(prev => ({
      ...prev,
      total: prev.total + 1,
    }));

    if (isCorrect) {
      setLastResult("correct");
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      
      setTimeout(() => {
        nextChord();
      }, 500);
    } else {
      setLastResult("wrong");
      setStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
      
      setTimeout(() => {
        setLastResult(null);
        pressedNotesRef.current = [];
      }, 500);
    }
  };

  const nextChord = () => {
    setLastResult(null);
    pressedNotesRef.current = [];
    
    if (currentChordIndex < practiceChords.length - 1) {
      setCurrentChordIndex(prev => prev + 1);
      chordStartTimeRef.current = Date.now();
    } else {
      finishPractice();
    }
  };

  const handleEarGuess = (chord: typeof CHORDS[0]) => {
    if (practiceChords.length === 0) return;
    
    const current = practiceChords[currentChordIndex];
    const isCorrect = chord.name === current.chord.name;

    setStats(prev => ({
      ...prev,
      total: prev.total + 1,
    }));

    if (isCorrect) {
      setLastResult("correct");
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      
      setTimeout(() => {
        nextChord();
      }, 500);
    } else {
      setLastResult("wrong");
      setStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
      
      setTimeout(() => {
        setLastResult(null);
      }, 500);
    }
  };

  const playChord = async (notes: number[]) => {
    for (const note of notes) {
      await storeNoteOn(note, 100);
    }
    
    setTimeout(async () => {
      for (const note of notes) {
        await storeNoteOff(note);
      }
    }, 1500);
  };

  const replayChord = () => {
    if (mode === "ear" && practiceChords.length > 0) {
      const current = practiceChords[currentChordIndex];
      const notes = getChordNotes(current.root, current.chord, current.inversion);
      playChord(notes);
    }
  };

  const startPractice = () => {
    generatePracticeChords();
    setIsPracticing(true);
    setCurrentChordIndex(0);
    setShowResults(false);
    setStats({
      total: 0,
      correct: 0,
      wrong: 0,
      startTime: Date.now(),
    });
    pressedNotesRef.current = [];
    chordStartTimeRef.current = Date.now();
    
    if (mode === "ear") {
      setTimeout(() => {
        if (practiceChords.length > 0) {
          const current = practiceChords[0];
          const notes = getChordNotes(current.root, current.chord, current.inversion);
          playChord(notes);
        }
      }, 500);
    }
  };

  const finishPractice = () => {
    setIsPracticing(false);
    setShowResults(true);
    
    const durationSecs = Math.floor((Date.now() - stats.startTime) / 1000);
    const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
    
    savePracticeSession({
      module_type: "chord",
      duration_secs: durationSecs,
      accuracy,
      date: new Date().toISOString().split("T")[0],
      details: JSON.stringify({
        mode,
        selectedChord: selectedChord.name,
      }),
    });
  };

  const currentChordData = practiceChords[currentChordIndex];
  const displayChord = isPracticing && currentChordData 
    ? currentChordData 
    : { chord: selectedChord, root: rootNote, inversion };

  const highlightedNotes = getChordNotes(displayChord.root, displayChord.chord, displayChord.inversion);
  
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  const rootNoteOptions = [];
  for (let i = 48; i <= 72; i++) {
    if (![49, 51, 54, 56, 58, 61, 63, 66, 68, 70].includes(i)) {
      rootNoteOptions.push(i);
    }
  }

  return (
    <div className="practice-page">
      <div className="page-header">
        <h1 className="page-title">和弦练习</h1>
        <p className="page-description">练习和弦的弹奏与听辨</p>
      </div>

      <div className="practice-layout">
        <div className="practice-sidebar">
          <div className="card mb-4">
            <h3 className="card-title">练习模式</h3>
            <div className="mode-tabs">
              <button 
                className={`mode-tab ${mode === "play" ? "active" : ""}`}
                onClick={() => setMode("play")}
              >
                弹奏模式
              </button>
              <button 
                className={`mode-tab ${mode === "ear" ? "active" : ""}`}
                onClick={() => setMode("ear")}
              >
                听辨模式
              </button>
            </div>
          </div>

          {!isPracticing && (
            <>
              <div className="card mb-4">
                <h3 className="card-title">和弦类型</h3>
                <div className="chord-buttons">
                  {CHORDS.map((chord) => (
                    <button
                      key={chord.name}
                      className={`chord-btn ${selectedChord.name === chord.name ? "selected" : ""}`}
                      onClick={() => setSelectedChord(chord)}
                    >
                      {chord.nameCn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card mb-4">
                <h3 className="card-title">设置</h3>
                <div className="setting-item">
                  <label>根音</label>
                  <select 
                    className="select" 
                    value={rootNote}
                    onChange={(e) => setRootNote(Number(e.target.value))}
                  >
                    {rootNoteOptions.map(note => (
                      <option key={note} value={note}>
                        {midiNoteToName(note)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="setting-item">
                  <label>转位</label>
                  <select 
                    className="select" 
                    value={inversion}
                    onChange={(e) => setInversion(Number(e.target.value))}
                  >
                    {[0, 1, 2].map(inv => (
                      <option key={inv} value={inv}>
                        {getInversionName(inv, selectedChord.intervals.length)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <button 
            className="btn btn-primary w-full"
            onClick={isPracticing ? finishPractice : startPractice}
          >
            {isPracticing ? "结束练习" : "开始练习"}
          </button>
        </div>

        <div className="practice-main">
          <div className={`card practice-display ${lastResult || ""}`}>
            {isPracticing && mode === "ear" ? (
              <div className="chord-display">
                <div className="chord-name">听辨和弦</div>
                <div className="chord-notes mb-4">
                  第 {currentChordIndex + 1} / {practiceChords.length} 题
                </div>
                <button className="btn btn-secondary" onClick={replayChord}>
                  🔊 再听一次
                </button>
                {lastResult === "correct" && (
                  <div className="result-indicator correct mt-4">✓ 正确！</div>
                )}
                {lastResult === "wrong" && (
                  <div className="result-indicator wrong mt-4">✗ 错误，正确答案是 {currentChordData?.chord.nameCn}</div>
                )}
                
                {earOptions.length > 0 && (
                  <div className="chord-buttons mt-6">
                    {earOptions.map((chord) => (
                      <button
                        key={chord.name}
                        className="chord-btn"
                        onClick={() => handleEarGuess(chord)}
                        disabled={lastResult !== null}
                      >
                        {chord.nameCn}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="chord-display">
                <div className="chord-name">
                  {NOTE_NAMES[displayChord.root % 12]} {displayChord.chord.nameCn}
                  {displayChord.inversion > 0 && ` (${getInversionName(displayChord.inversion, displayChord.chord.intervals.length)})`}
                </div>
                <div className="chord-notes">
                  组成音: {getChordNotes(displayChord.root, displayChord.chord, displayChord.inversion)
                    .map(n => midiNoteToName(n)).join(" - ")}
                </div>
                {isPracticing && (
                  <div className="mt-4">
                    <span className="info-label">进度: {currentChordIndex + 1} / {practiceChords.length}</span>
                    {lastResult === "correct" && <span className="result-indicator correct ml-4">✓ 正确！</span>}
                    {lastResult === "wrong" && <span className="result-indicator wrong ml-4">✗ 再试试</span>}
                  </div>
                )}
                {!isPracticing && (
                  <button 
                    className="btn btn-secondary mt-4"
                    onClick={() => playChord(highlightedNotes)}
                  >
                    🔊 试听
                  </button>
                )}
              </div>
            )}

            <div className="practice-info mt-6">
              <div className="info-item">
                <span className="info-label">正确率</span>
                <span className={`info-value ${accuracy >= 80 ? "text-success" : accuracy >= 60 ? "text-warning" : "text-error"}`}>
                  {accuracy}%
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">正确</span>
                <span className="info-value text-success">{stats.correct}</span>
              </div>
              <div className="info-item">
                <span className="info-label">错误</span>
                <span className="info-value text-error">{stats.wrong}</span>
              </div>
            </div>
          </div>

          <div className="keyboard-preview">
            <VirtualKeyboard
              activeNotes={activeNotes}
              highlightedNotes={highlightedNotes}
              startNote={36}
              endNote={84}
            />
          </div>

          {showResults && (
            <div className="card results-card">
              <h3 className="card-title">练习结果</h3>
              <div className="results-grid grid grid-3">
                <div className="result-item">
                  <div className="result-value">{accuracy}%</div>
                  <div className="result-label">正确率</div>
                </div>
                <div className="result-item">
                  <div className="result-value">{stats.correct}</div>
                  <div className="result-label">正确</div>
                </div>
                <div className="result-item">
                  <div className="result-value">{stats.wrong}</div>
                  <div className="result-label">错误</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChordPractice;
