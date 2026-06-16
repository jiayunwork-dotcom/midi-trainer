import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../store/appStore";
import { TIME_SIGNATURES } from "../utils/musicTheory";
import "../styles/practice.css";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Judgment = "perfect" | "good" | "ok" | "miss";

interface HitRecord {
  beat: number;
  deviation: number;
  judgment: Judgment;
}

const RhythmPractice = () => {
  const { activeNotes, savePracticeSession } = useAppStore();
  
  const [bpm, setBpm] = useState(100);
  const [timeSignature, setTimeSignature] = useState(TIME_SIGNATURES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  
  const [hits, setHits] = useState<HitRecord[]>([]);
  const [lastJudgment, setLastJudgment] = useState<Judgment | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [beatPosition, setBeatPosition] = useState(0);
  
  const intervalRef = useRef<number | null>(null);
  const beatStartTimeRef = useRef<number>(0);
  const prevActiveCountRef = useRef(0);
  const practiceStartRef = useRef<number>(0);
  const totalBeatsRef = useRef(0);
  const hitIndexRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [accentBeats, setAccentBeats] = useState<number[]>([0]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new Ctx();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const getBeatDuration = useCallback(() => {
    return 60000 / bpm;
  }, [bpm]);

  const playClick = useCallback((isAccent: boolean) => {
    try {
      const audioContext = getAudioContext();
      const freq = isAccent ? 600 : 800;
      const volume = isAccent ? 0.5 : 0.3;
      const duration = isAccent ? 0.08 : 0.05;
      const now = audioContext.currentTime;
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = isAccent ? "triangle" : "sine";
      
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      oscillator.start(now);
      oscillator.stop(now + duration);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    } catch (e) {
      console.error("playClick error:", e);
    }
  }, [getAudioContext]);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const beatDuration = getBeatDuration();
    let beat = 0;
    
    const tick = () => {
      const beatInMeasure = beat % timeSignature.beats;
      const isAccent = accentBeats.includes(beatInMeasure);
      playClick(isAccent);
      setCurrentBeat(beatInMeasure);
      beatStartTimeRef.current = Date.now();
      beat++;
      totalBeatsRef.current = beat;
      
      if (isPracticing) {
        setBeatPosition(0);
      }
    };

    tick();
    intervalRef.current = window.setInterval(tick, beatDuration);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, bpm, timeSignature, playClick, isPracticing, accentBeats]);

  const toggleAccentBeat = (beatIndex: number) => {
    if (isPracticing || isPlaying) return;
    
    setAccentBeats(prev => {
      if (prev.includes(beatIndex)) {
        if (prev.length === 1) return prev;
        return prev.filter(b => b !== beatIndex);
      } else {
        return [...prev, beatIndex].sort((a, b) => a - b);
      }
    });
  };

  useEffect(() => {
    setAccentBeats([0]);
  }, [timeSignature]);

  useEffect(() => {
    if (!isPracticing || !isPlaying) return;

    const updatePosition = () => {
      const elapsed = Date.now() - beatStartTimeRef.current;
      const beatDur = getBeatDuration();
      const progress = Math.min(1, elapsed / beatDur);
      setBeatPosition(progress);
    };

    const animationId = setInterval(updatePosition, 16);
    return () => clearInterval(animationId);
  }, [isPracticing, isPlaying, getBeatDuration, currentBeat]);

  useEffect(() => {
    if (!isPracticing) return;

    const currentCount = activeNotes.size;
    const prevCount = prevActiveCountRef.current;

    if (currentCount > prevCount) {
      handleHit();
    }

    prevActiveCountRef.current = currentCount;
  }, [activeNotes, isPracticing, currentBeat]);

  const handleHit = () => {
    if (!isPracticing) return;

    const beatDuration = getBeatDuration();
    const elapsed = Date.now() - beatStartTimeRef.current;
    const deviation = Math.min(elapsed, beatDuration - elapsed);
    
    let judgment: Judgment;
    if (deviation < 30) {
      judgment = "perfect";
    } else if (deviation < 80) {
      judgment = "good";
    } else if (deviation < 150) {
      judgment = "ok";
    } else {
      judgment = "miss";
    }

    const hit: HitRecord = {
      beat: totalBeatsRef.current,
      deviation,
      judgment,
    };

    setHits(prev => [...prev, hit]);
    setLastJudgment(judgment);
    hitIndexRef.current++;

    setTimeout(() => setLastJudgment(null), 500);

    if (totalBeatsRef.current >= 32) {
      finishPractice();
    }
  };

  const startPractice = () => {
    setIsPlaying(true);
    setIsPracticing(true);
    setHits([]);
    setShowResults(false);
    practiceStartRef.current = Date.now();
    totalBeatsRef.current = 0;
    hitIndexRef.current = 0;
    prevActiveCountRef.current = 0;
  };

  const finishPractice = () => {
    setIsPlaying(false);
    setIsPracticing(false);
    setShowResults(true);

    const durationSecs = Math.floor((Date.now() - practiceStartRef.current) / 1000);
    const perfectCount = hits.filter(h => h.judgment === "perfect").length;
    const accuracy = hits.length > 0 ? perfectCount / hits.length : 0;

    savePracticeSession({
      module_type: "rhythm",
      duration_secs: durationSecs,
      accuracy,
      date: new Date().toISOString().split("T")[0],
      details: JSON.stringify({
        bpm,
        timeSignature: timeSignature.name,
      }),
    });
  };

  const toggleMetronome = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setIsPracticing(false);
    } else {
      setIsPlaying(true);
    }
  };

  const stats = {
    total: hits.length,
    perfect: hits.filter(h => h.judgment === "perfect").length,
    good: hits.filter(h => h.judgment === "good").length,
    ok: hits.filter(h => h.judgment === "ok").length,
    miss: hits.filter(h => h.judgment === "miss").length,
  };

  const accuracy = hits.length > 0 
    ? Math.round(((stats.perfect + stats.good * 0.8 + stats.ok * 0.5) / hits.length) * 100) 
    : 0;

  const scatterData = hits.map((h, i) => ({
    index: i,
    deviation: h.deviation,
    judgment: h.judgment,
  }));

  return (
    <div className="practice-page">
      <div className="page-header">
        <h1 className="page-title">节奏练习</h1>
        <p className="page-description">跟随节拍器练习节奏准确度</p>
      </div>

      <div className="practice-layout">
        <div className="practice-sidebar">
          <div className="card mb-4">
            <h3 className="card-title">速度 (BPM)</h3>
            <div className="text-center mb-2">
              <span className="bpm-display">{bpm}</span>
            </div>
            <input
              type="range"
              min="40"
              max="240"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="bpm-slider"
              disabled={isPracticing}
            />
            <div className="flex justify-between text-sm text-secondary">
              <span>40</span>
              <span>240</span>
            </div>
          </div>

          <div className="card mb-4">
            <h3 className="card-title">拍号</h3>
            <div className="time-signature-selector">
              {TIME_SIGNATURES.map((ts) => (
                <button
                  key={ts.name}
                  className={`time-sig-btn ${timeSignature.name === ts.name ? "active" : ""}`}
                  onClick={() => setTimeSignature(ts)}
                  disabled={isPracticing}
                >
                  {ts.name}
                </button>
              ))}
            </div>
          </div>

          <div className="card mb-4">
            <h3 className="card-title">重音设置</h3>
            <p className="text-sm text-secondary mb-3">点击选择重音拍（至少保留一个）</p>
            <div className="accent-beat-selector">
              {Array.from({ length: timeSignature.beats }).map((_, i) => (
                <button
                  key={i}
                  className={`accent-beat-btn ${accentBeats.includes(i) ? "accent" : ""}`}
                  onClick={() => toggleAccentBeat(i)}
                  disabled={isPracticing || isPlaying}
                >
                  <div className={`beat-dot-preview ${accentBeats.includes(i) ? "accent" : ""}`} />
                  <span className="beat-number">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              className={`btn flex-1 ${isPlaying ? "btn-warning" : "btn-primary"}`}
              onClick={toggleMetronome}
            >
              {isPlaying ? "停止" : "节拍器"}
            </button>
          </div>

          <button 
            className="btn btn-success w-full mt-4"
            onClick={isPracticing ? finishPractice : startPractice}
          >
            {isPracticing ? "结束练习" : "开始练习"}
          </button>
        </div>

        <div className="practice-main">
          <div className="card metronome-display">
            <div className="beat-indicator">
              {Array.from({ length: timeSignature.beats }).map((_, i) => {
                const isAccent = accentBeats.includes(i);
                const isActive = currentBeat === i && isPlaying;
                return (
                  <div
                    key={i}
                    className={`beat-dot ${isAccent ? "accent" : ""} ${isActive ? "active" : ""}`}
                  />
                );
              })}
            </div>
            
            {isPracticing && (
              <div className="rhythm-track mt-6">
                <div className="judgment-line" />
                <div 
                  className="rhythm-beat"
                  style={{ 
                    left: `${10 + beatPosition * 80}%`,
                  }}
                />
                {lastJudgment && (
                  <div className={`hit-effect ${lastJudgment}`}>
                    {lastJudgment === "perfect" && "Perfect!"}
                    {lastJudgment === "good" && "Good"}
                    {lastJudgment === "ok" && "OK"}
                    {lastJudgment === "miss" && "Miss"}
                  </div>
                )}
              </div>
            )}

            {isPracticing && (
              <div className="practice-info mt-6">
                <div className="info-item">
                  <span className="info-label">进度</span>
                  <span className="info-value">{totalBeatsRef.current} / 32</span>
                </div>
                <div className="info-item">
                  <span className="info-label">评分</span>
                  <span className={`info-value ${accuracy >= 80 ? "text-success" : accuracy >= 60 ? "text-warning" : "text-error"}`}>
                    {accuracy}分
                  </span>
                </div>
              </div>
            )}
          </div>

          {showResults && (
            <div className="card results-card">
              <h3 className="card-title">练习结果</h3>
              <div className="results-grid grid grid-4 mb-4">
                <div className="result-item">
                  <div className="result-value text-success">{stats.perfect}</div>
                  <div className="result-label">Perfect</div>
                </div>
                <div className="result-item">
                  <div className="result-value" style={{ color: "#3b82f6" }}>{stats.good}</div>
                  <div className="result-label">Good</div>
                </div>
                <div className="result-item">
                  <div className="result-value text-warning">{stats.ok}</div>
                  <div className="result-label">OK</div>
                </div>
                <div className="result-item">
                  <div className="result-value text-error">{stats.miss}</div>
                  <div className="result-label">Miss</div>
                </div>
              </div>

              <div className="chart-container" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart data={scatterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis dataKey="index" stroke="#a0a0b8" fontSize={12} label="拍数" />
                    <YAxis stroke="#a0a0b8" fontSize={12} label="偏差(ms)" />
                    <Tooltip 
                      contentStyle={{ 
                        background: "#1a1a2e", 
                        border: "1px solid #2a2a4a",
                        borderRadius: "8px",
                        color: "#e8e8f0"
                      }}
                      formatter={(value: any) => [value + " ms", "偏差"]}
                    />
                    <Scatter 
                      dataKey="deviation" 
                      fill="#6366f1"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="text-center mt-4">
                <div className="text-xl font-bold">综合评分: {accuracy}分</div>
              </div>
            </div>
          )}

          {!isPracticing && !showResults && (
            <div className="card">
              <h3 className="card-title">练习说明</h3>
              <div className="tips-content">
                <div className="tip-item">
                  <span className="tip-number">1</span>
                  <p>点击"开始练习"后，跟随节拍器的节奏弹奏任意键</p>
                </div>
                <div className="tip-item">
                  <span className="tip-number">2</span>
                  <p>系统会根据你击键的时机给出 Perfect / Good / OK / Miss 评价</p>
                </div>
                <div className="tip-item">
                  <span className="tip-number">3</span>
                  <p>练习结束后会显示精度散点图，帮助你分析问题</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RhythmPractice;
