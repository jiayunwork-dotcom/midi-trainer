import { useState, useEffect, useRef, useCallback } from "react";
import VirtualKeyboard from "../components/VirtualKeyboard";
import StaffNotation, { StaffNoteData } from "../components/StaffNotation";
import { isBlackKey } from "../utils/musicTheory";
import { useAppStore } from "../store/appStore";
import "../styles/practice.css";
import "../styles/sight-reading.css";

type Difficulty = "beginner" | "easy" | "medium" | "hard";
type ClefType = "treble" | "bass" | "grand";

interface HitResult {
  note: number;
  timeDeviation: number;
  pitchCorrect: boolean;
  judgment: string;
}

const SightReading = () => {
  const { activeNotes, savePracticeSession } = useAppStore();
  
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [clef, setClef] = useState<ClefType>("treble");
  const [isPracticing, setIsPracticing] = useState(false);
  const [notes, setNotes] = useState<StaffNoteData[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lastResult, setLastResult] = useState<HitResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  const [stats, setStats] = useState({
    total: 0,
    correct: 0,
    wrong: 0,
    startTime: 0,
  });
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const noteIdRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const prevActiveNotesRef = useRef<Map<number, any>>(new Map());
  const hitNotesRef = useRef<Set<number>>(new Set());
  const practiceStartRef = useRef<number>(0);

  const getDifficultySettings = useCallback(() => {
    switch (difficulty) {
      case "beginner":
        return {
          noteRange: [60, 72],
          hasSharps: false,
          speed: 45,
          spawnInterval: 1800,
          noteDurations: [4, 2, 1],
          hasChords: false,
          keySignature: 0,
          hasDotted: false,
        };
      case "easy":
        return {
          noteRange: [55, 77],
          hasSharps: false,
          speed: 65,
          spawnInterval: 1400,
          noteDurations: [2, 1, 0.5],
          hasChords: false,
          keySignature: 0,
          hasDotted: false,
        };
      case "medium":
        return {
          noteRange: [48, 84],
          hasSharps: true,
          speed: 85,
          spawnInterval: 1100,
          noteDurations: [1, 0.5, 0.25],
          hasChords: false,
          keySignature: Math.random() > 0.5 ? 1 : -1,
          hasDotted: true,
        };
      case "hard":
        return {
          noteRange: [40, 88],
          hasSharps: true,
          speed: 115,
          spawnInterval: 900,
          noteDurations: [1, 0.5, 0.25],
          hasChords: true,
          keySignature: Math.floor(Math.random() * 5) - 2,
          hasDotted: true,
        };
    }
  }, [difficulty]);

  const spawnNote = useCallback(() => {
    const settings = getDifficultySettings();
    const [minNote, maxNote] = settings.noteRange;
    
    let note: number;
    if (settings.hasSharps) {
      note = Math.floor(Math.random() * (maxNote - minNote + 1)) + minNote;
    } else {
      const whiteNotes = [];
      for (let n = minNote; n <= maxNote; n++) {
        if (!isBlackKey(n)) whiteNotes.push(n);
      }
      note = whiteNotes[Math.floor(Math.random() * whiteNotes.length)];
    }

    const duration = settings.noteDurations[
      Math.floor(Math.random() * settings.noteDurations.length)
    ];
    
    const isDotted = settings.hasDotted && Math.random() > 0.7;

    const newNote: StaffNoteData = {
      id: noteIdRef.current++,
      note,
      x: 115,
      duration: isDotted ? duration * 1.5 : duration,
      hit: false,
      missed: false,
      dotted: isDotted,
    };

    setNotes(prev => [...prev, newNote]);
  }, [getDifficultySettings]);

  useEffect(() => {
    if (!isPracticing) return;

    const settings = getDifficultySettings();
    const judgeLine = 20;
    const judgmentWindow = 150;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      setNotes(prev => {
        const updated = prev.map(note => ({
          ...note,
          x: note.x - (settings.speed / 1000) * delta,
        }));

        updated.forEach(note => {
          if (!note.hit && !note.missed && note.x < judgeLine - judgmentWindow / 10) {
            note.missed = true;
            setStats(s => ({ ...s, total: s.total + 1, wrong: s.wrong + 1 }));
            setCombo(0);
            setLastResult({
              note: note.note,
              timeDeviation: 999,
              pitchCorrect: false,
              judgment: "Miss",
            });
            setTimeout(() => setLastResult(null), 500);
          }
        });

        return updated.filter(n => n.x > -20);
      });

      spawnTimerRef.current += delta;
      if (spawnTimerRef.current >= settings.spawnInterval) {
        spawnTimerRef.current = 0;
        spawnNote();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPracticing, getDifficultySettings, spawnNote]);

  useEffect(() => {
    if (!isPracticing) return;

    const checkHit = (noteNum: number) => {
      const judgeLine = 20;
      
      setNotes(prev => {
        let hitNote: StaffNoteData | null = null;
        let minDistance = Infinity;

        for (const n of prev) {
          if (!n.hit && !n.missed) {
            const distance = Math.abs(n.x - judgeLine);
            if (distance < minDistance && distance < 18) {
              minDistance = distance;
              hitNote = n;
            }
          }
        }

        if (hitNote !== null) {
          const isPitchCorrect = hitNote.note === noteNum;
          const timeDeviation = Math.abs(minDistance) * 10;
          
          let judgment: string;
          let scoreAdd = 0;

          if (isPitchCorrect) {
            if (timeDeviation < 30) {
              judgment = "Perfect";
              scoreAdd = 100;
            } else if (timeDeviation < 80) {
              judgment = "Good";
              scoreAdd = 75;
            } else {
              judgment = "OK";
              scoreAdd = 50;
            }

            setCombo(c => {
              const newCombo = c + 1;
              setMaxCombo(m => Math.max(m, newCombo));
              return newCombo;
            });

            setScore(s => s + scoreAdd + Math.floor(combo * 5));
            setStats(s => ({ ...s, total: s.total + 1, correct: s.correct + 1 }));
            
            setLastResult({
              note: noteNum,
              timeDeviation,
              pitchCorrect: true,
              judgment,
            });
            setTimeout(() => setLastResult(null), 500);

            return prev.map(n => 
              n.id === hitNote!.id ? { ...n, hit: true } : n
            );
          } else {
            judgment = "Wrong";
            setCombo(0);
            setStats(s => ({ ...s, total: s.total + 1, wrong: s.wrong + 1 }));
            
            setLastResult({
              note: noteNum,
              timeDeviation,
              pitchCorrect: false,
              judgment,
            });
            setTimeout(() => setLastResult(null), 500);
          }
        }

        return prev;
      });
    };

    const currentNotes = activeNotes;
    const prevNotes = prevActiveNotesRef.current;

    for (const [note] of currentNotes) {
      if (!prevNotes.has(note) && !hitNotesRef.current.has(note)) {
        hitNotesRef.current.add(note);
        checkHit(note);
        
        setTimeout(() => {
          hitNotesRef.current.delete(note);
        }, 200);
      }
    }

    prevActiveNotesRef.current = new Map(currentNotes);
  }, [activeNotes, isPracticing, combo]);

  const startPractice = () => {
    setIsPracticing(true);
    setNotes([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setShowResults(false);
    setStats({
      total: 0,
      correct: 0,
      wrong: 0,
      startTime: Date.now(),
    });
    noteIdRef.current = 0;
    lastTimeRef.current = 0;
    spawnTimerRef.current = 0;
    prevActiveNotesRef.current = new Map();
    hitNotesRef.current = new Set();
    practiceStartRef.current = Date.now();
    
    setTimeout(spawnNote, 1000);
  };

  const finishPractice = () => {
    setIsPracticing(false);
    setShowResults(true);

    const durationSecs = Math.floor((Date.now() - practiceStartRef.current) / 1000);
    const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;

    savePracticeSession({
      module_type: "sight_reading",
      duration_secs: durationSecs,
      accuracy,
      date: new Date().toISOString().split("T")[0],
      details: JSON.stringify({
        difficulty,
        score,
        maxCombo,
      }),
    });
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const settings = getDifficultySettings();

  const difficultyLevels = [
    { value: "beginner" as Difficulty, label: "初级" },
    { value: "easy" as Difficulty, label: "简单" },
    { value: "medium" as Difficulty, label: "中等" },
    { value: "hard" as Difficulty, label: "困难" },
  ];
  
  const clefOptions = [
    { value: "treble" as ClefType, label: "高音谱号", symbol: "𝄞" },
    { value: "bass" as ClefType, label: "低音谱号", symbol: "𝄢" },
    { value: "grand" as ClefType, label: "大谱表", symbol: "𝄞𝄢" },
  ];

  return (
    <div className="practice-page">
      <div className="page-header">
        <h1 className="page-title">视奏训练</h1>
        <p className="page-description">音符从右向左滚动，到达判定线时弹出对应的音</p>
      </div>

      <div className="practice-layout">
        <div className="practice-sidebar">
          <div className="card mb-4">
            <h3 className="card-title">难度选择</h3>
            <div className="difficulty-selector">
              {difficultyLevels.map((d) => (
                <button
                  key={d.value}
                  className={`difficulty-btn ${difficulty === d.value ? "active" : ""}`}
                  onClick={() => setDifficulty(d.value)}
                  disabled={isPracticing}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="card mb-4">
            <h3 className="card-title">谱号选择</h3>
            <div className="difficulty-selector">
              {clefOptions.map((c) => (
                <button
                  key={c.value}
                  className={`difficulty-btn ${clef === c.value ? "active" : ""}`}
                  onClick={() => setClef(c.value)}
                  disabled={isPracticing}
                >
                  <span style={{ fontSize: "18px", marginRight: "4px" }}>{c.symbol}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {isPracticing && (
            <div className="card mb-4">
              <h3 className="card-title">当前状态</h3>
              <div className="setting-item">
                <label>分数</label>
                <div className="text-xl font-bold text-success">{score}</div>
              </div>
              <div className="setting-item">
                <label>连击</label>
                <div className="text-xl font-bold text-warning">{combo}</div>
              </div>
              <div className="setting-item">
                <label>正确率</label>
                <div className="text-xl font-bold">{accuracy}%</div>
              </div>
              <div className="setting-item">
                <label>当前音符</label>
                <div className="text-sm">
                  {notes.filter(n => !n.hit && !n.missed && n.x < 35).map(n => {
                    const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
                    const octave = Math.floor(n.note / 12) - 1;
                    const noteName = noteNames[n.note % 12];
                    return <span key={n.id} className="inline-block bg-accent/20 px-2 py-1 rounded mr-1">
                      {noteName}{octave}
                    </span>;
                  })}
                </div>
              </div>
            </div>
          )}

          <button 
            className="btn btn-primary w-full"
            onClick={isPracticing ? finishPractice : startPractice}
          >
            {isPracticing ? "结束练习" : "开始练习"}
          </button>
        </div>

        <div className="practice-main">
          <div className="card">
            <div className="staff-container">
              <StaffNotation
                notes={notes}
                clef={clef}
                width={880}
                height={clef === "grand" ? 280 : 180}
                judgmentLineX={20}
                showKeySignature={true}
                keySignature={settings.keySignature}
              />

              {lastResult && (
                <div className={`judgment-display ${lastResult.judgment.toLowerCase()}`}>
                  {lastResult.judgment}
                  {lastResult.pitchCorrect && (
                    <span className="ml-2 text-sm opacity-80">
                      {lastResult.timeDeviation < 30 ? "±" : ""}{Math.round(lastResult.timeDeviation)}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between text-sm text-secondary mt-2">
              <span>← 音符从右向左滚动</span>
              <span>判定线 ↑</span>
              <span>速度: {settings.speed}</span>
            </div>
          </div>

          <div className="keyboard-preview">
            <VirtualKeyboard
              activeNotes={activeNotes}
              highlightedNotes={notes.filter(n => !n.hit && !n.missed && n.x < 35).map(n => n.note)}
              startNote={36}
              endNote={88}
            />
          </div>

          {showResults && (
            <div className="card results-card">
              <h3 className="card-title">练习结果</h3>
              <div className="results-grid grid grid-4 mb-4">
                <div className="result-item">
                  <div className="result-value">{score}</div>
                  <div className="result-label">总分</div>
                </div>
                <div className="result-item">
                  <div className="result-value">{accuracy}%</div>
                  <div className="result-label">正确率</div>
                </div>
                <div className="result-item">
                  <div className="result-value">{maxCombo}</div>
                  <div className="result-label">最大连击</div>
                </div>
                <div className="result-item">
                  <div className="result-value">{stats.total}</div>
                  <div className="result-label">总音符数</div>
                </div>
              </div>
              
              <div className="card">
                <h4 className="text-sm font-semibold mb-2 text-secondary">判定标准</h4>
                <div className="grid grid-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                    <span>Perfect &lt;30ms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                    <span>Good &lt;80ms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                    <span>OK &lt;150ms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400"></span>
                    <span>Miss &gt;150ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isPracticing && !showResults && (
            <div className="card">
              <h3 className="card-title">练习说明</h3>
              <div className="tips-content">
                <div className="tip-item">
                  <span className="tip-number">1</span>
                  <p>音符从右向左滚动，到达绿色判定线时弹出对应的音</p>
                </div>
                <div className="tip-item">
                  <span className="tip-number">2</span>
                  <p>同时需要<strong>音高正确</strong>和<strong>时机准确</strong>才能得分</p>
                </div>
                <div className="tip-item">
                  <span className="tip-number">3</span>
                  <p>判定等级：Perfect(&lt;30ms)、Good(&lt;80ms)、OK(&lt;150ms)、Miss</p>
                </div>
                <div className="tip-item">
                  <span className="tip-number">4</span>
                  <p>五线谱包含谱号、调号、升降号、附点等完整乐谱元素</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SightReading;
