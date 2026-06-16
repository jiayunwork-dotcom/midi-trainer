import { useState, useEffect, useRef, useCallback } from "react";
import VirtualKeyboard from "../components/VirtualKeyboard";
import { isBlackKey } from "../utils/musicTheory";
import { useAppStore } from "../store/appStore";
import "../styles/practice.css";
import "../styles/sight-reading.css";

type Difficulty = "beginner" | "easy" | "medium" | "hard";

interface StaffNote {
  id: number;
  note: number;
  x: number;
  duration: number;
  hit: boolean;
  missed: boolean;
  y: number;
}

interface HitResult {
  note: number;
  timeDeviation: number;
  pitchCorrect: boolean;
  judgment: string;
}

const SightReading = () => {
  const { activeNotes, savePracticeSession } = useAppStore();
  
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [isPracticing, setIsPracticing] = useState(false);
  const [notes, setNotes] = useState<StaffNote[]>([]);
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
          speed: 50,
          spawnInterval: 1500,
          noteDurations: [4, 2, 1],
          hasChords: false,
        };
      case "easy":
        return {
          noteRange: [55, 77],
          hasSharps: false,
          speed: 70,
          spawnInterval: 1200,
          noteDurations: [2, 1, 0.5],
          hasChords: false,
        };
      case "medium":
        return {
          noteRange: [48, 84],
          hasSharps: true,
          speed: 90,
          spawnInterval: 1000,
          noteDurations: [1, 0.5, 0.25],
          hasChords: false,
        };
      case "hard":
        return {
          noteRange: [40, 88],
          hasSharps: true,
          speed: 120,
          spawnInterval: 800,
          noteDurations: [1, 0.5, 0.25],
          hasChords: true,
        };
    }
  }, [difficulty]);

  const noteToY = useCallback((note: number) => {
    const middleC = 60;
    const halfStepHeight = 8;
    return 50 - (note - middleC) * halfStepHeight;
  }, []);

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

    const newNote: StaffNote = {
      id: noteIdRef.current++,
      note,
      x: 110,
      duration,
      hit: false,
      missed: false,
      y: noteToY(note),
    };

    setNotes(prev => [...prev, newNote]);
  }, [getDifficultySettings, noteToY]);

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
        let hitNote: StaffNote | null = null;
        let minDistance = Infinity;

        for (const n of prev) {
          if (!n.hit && !n.missed) {
            const distance = Math.abs(n.x - judgeLine);
            if (distance < minDistance && distance < 15) {
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

  const difficultyLevels = [
    { value: "beginner" as Difficulty, label: "初级" },
    { value: "easy" as Difficulty, label: "简单" },
    { value: "medium" as Difficulty, label: "中等" },
    { value: "hard" as Difficulty, label: "困难" },
  ];

  return (
    <div className="practice-page">
      <div className="page-header">
        <h1 className="page-title">视奏训练</h1>
        <p className="page-description">音符滚动到判定线时弹出对应的音</p>
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
            <div className="sight-reading-staff">
              <div className="staff-lines">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="staff-line"
                    style={{ top: `${30 + i * 12}%` }}
                  />
                ))}
                <div className="clef treble">𝄞</div>
                <div className="judgment-zone" />
                
                {notes.map(note => (
                  <div
                    key={note.id}
                    className={`staff-note ${note.hit ? "hit" : note.missed ? "missed" : ""}`}
                    style={{
                      left: `${note.x}%`,
                      top: `${note.y}%`,
                    }}
                  >
                    {isBlackKey(note.note) ? "●" : "○"}
                  </div>
                ))}

                {lastResult && (
                  <div className={`judgment-display ${lastResult.judgment.toLowerCase()}`}>
                    {lastResult.judgment}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between text-sm text-secondary mt-2">
              <span>← 音符从右向左滚动</span>
              <span>判定线 ↓</span>
            </div>
          </div>

          <div className="keyboard-preview">
            <VirtualKeyboard
              activeNotes={activeNotes}
              highlightedNotes={notes.filter(n => !n.hit && !n.missed && n.x < 30).map(n => n.note)}
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
            </div>
          )}

          {!isPracticing && !showResults && (
            <div className="card">
              <h3 className="card-title">练习说明</h3>
              <div className="tips-content">
                <div className="tip-item">
                  <span className="tip-number">1</span>
                  <p>音符从右向左滚动，到达判定线时弹出对应的音</p>
                </div>
                <div className="tip-item">
                  <span className="tip-number">2</span>
                  <p>同时需要音高正确和时机准确才能得分</p>
                </div>
                <div className="tip-item">
                  <span className="tip-number">3</span>
                  <p>连击越高，额外加分越多</p>
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
