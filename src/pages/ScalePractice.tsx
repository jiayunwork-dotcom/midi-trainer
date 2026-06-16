import { useState, useEffect, useCallback, useRef } from "react";
import VirtualKeyboard from "../components/VirtualKeyboard";
import { SCALES, getScaleNotes, midiNoteToName, NOTE_NAMES } from "../utils/musicTheory";
import { useAppStore } from "../store/appStore";
import "../styles/practice.css";

type Direction = "ascending" | "descending" | "both";
type PlaybackSpeed = 0.5 | 1 | 2;

interface NoteRecord {
  targetNote: number;
  playedNote: number;
  correct: boolean;
  reactionTime: number;
  timestamp: number;
}

interface PracticeStats {
  totalNotes: number;
  correctNotes: number;
  wrongNotes: number;
  totalReactionTime: number;
  reactionTimes: { note: number; time: number }[];
  startTime: number;
}

const ScalePractice = () => {
  const { activeNotes, savePracticeSession, noteOn: storeNoteOn, noteOff: storeNoteOff } = useAppStore();
  
  const [selectedScale, setSelectedScale] = useState(SCALES[0]);
  const [rootNote, setRootNote] = useState(60);
  const [octaves, setOctaves] = useState(2);
  const [direction, setDirection] = useState<Direction>("ascending");
  
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [scaleNotes, setScaleNotes] = useState<number[]>([]);
  const [lastNoteResult, setLastNoteResult] = useState<"correct" | "wrong" | null>(null);
  
  const [stats, setStats] = useState<PracticeStats>({
    totalNotes: 0,
    correctNotes: 0,
    wrongNotes: 0,
    totalReactionTime: 0,
    reactionTimes: [],
    startTime: 0,
  });
  
  const [showResults, setShowResults] = useState(false);
  const [noteRecords, setNoteRecords] = useState<NoteRecord[]>([]);
  const noteStartTimeRef = useRef<number>(0);
  const prevActiveNotesRef = useRef<Map<number, any>>(new Map());

  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [replaySpeed, setReplaySpeed] = useState<PlaybackSpeed>(1);
  const replayTimerRef = useRef<number | null>(null);
  const replayKeyboardNotesRef = useRef<Set<number>>(new Set());

  const generateScaleNotes = useCallback(() => {
    let notes = getScaleNotes(rootNote, selectedScale, octaves);
    
    if (direction === "descending") {
      notes = [...notes].reverse();
    } else if (direction === "both") {
      const ascending = notes;
      const descending = [...notes].reverse().slice(1);
      notes = [...ascending, ...descending];
    }
    
    setScaleNotes(notes);
  }, [rootNote, selectedScale, octaves, direction]);

  useEffect(() => {
    generateScaleNotes();
  }, [generateScaleNotes]);

  useEffect(() => {
    if (!isPracticing || scaleNotes.length === 0) return;

    const prevNotes = prevActiveNotesRef.current;
    const currentNotes = activeNotes;

    for (const [note, info] of currentNotes) {
      if (!prevNotes.has(note)) {
        handleNotePlayed(note, info.velocity);
      }
    }

    prevActiveNotesRef.current = new Map(currentNotes);
  }, [activeNotes, isPracticing, currentNoteIndex, scaleNotes]);

  const handleNotePlayed = (note: number, _velocity: number) => {
    if (!isPracticing || currentNoteIndex >= scaleNotes.length) return;

    const targetNote = scaleNotes[currentNoteIndex];
    const reactionTime = Date.now() - noteStartTimeRef.current;
    const timestamp = Date.now();

    const record: NoteRecord = {
      targetNote,
      playedNote: note,
      correct: note === targetNote,
      reactionTime,
      timestamp,
    };

    setNoteRecords(prev => [...prev, record]);

    setStats(prev => ({
      ...prev,
      totalNotes: prev.totalNotes + 1,
    }));

    if (note === targetNote) {
      setLastNoteResult("correct");
      setStats(prev => ({
        ...prev,
        correctNotes: prev.correctNotes + 1,
        totalReactionTime: prev.totalReactionTime + reactionTime,
        reactionTimes: [...prev.reactionTimes, { note, time: reactionTime }],
      }));

      setTimeout(() => {
        if (currentNoteIndex < scaleNotes.length - 1) {
          setCurrentNoteIndex(prev => prev + 1);
          noteStartTimeRef.current = Date.now();
        } else {
          finishPractice();
        }
      }, 200);
    } else {
      setLastNoteResult("wrong");
      setStats(prev => ({
        ...prev,
        wrongNotes: prev.wrongNotes + 1,
      }));
    }

    setTimeout(() => setLastNoteResult(null), 300);
  };

  const startPractice = () => {
    setIsPracticing(true);
    setCurrentNoteIndex(0);
    setShowResults(false);
    setNoteRecords([]);
    setStats({
      totalNotes: 0,
      correctNotes: 0,
      wrongNotes: 0,
      totalReactionTime: 0,
      reactionTimes: [],
      startTime: Date.now(),
    });
    noteStartTimeRef.current = Date.now();
    generateScaleNotes();
  };

  const finishPractice = () => {
    setIsPracticing(false);
    setShowResults(true);
    
    const durationSecs = Math.floor((Date.now() - stats.startTime) / 1000);
    const accuracy = stats.totalNotes > 0 ? stats.correctNotes / stats.totalNotes : 0;
    
    savePracticeSession({
      module_type: "scale",
      duration_secs: durationSecs,
      accuracy,
      date: new Date().toISOString().split("T")[0],
      details: JSON.stringify({
        scale: selectedScale.name,
        rootNote: rootNote,
        octaves,
        direction,
      }),
    });
  };

  const startReplay = () => {
    if (noteRecords.length === 0) return;
    setIsReplaying(true);
    setReplayIndex(-1);
    replayKeyboardNotesRef.current = new Set();
    
    let index = 0;
    const playNext = () => {
      if (index >= noteRecords.length) {
        stopReplay();
        return;
      }

      const record = noteRecords[index];
      setReplayIndex(index);
      
      for (const note of replayKeyboardNotesRef.current) {
        storeNoteOff(note);
      }
      replayKeyboardNotesRef.current.clear();
      
      storeNoteOn(record.playedNote, 100);
      replayKeyboardNotesRef.current.add(record.playedNote);
      
      const holdDuration = Math.max(300, record.reactionTime) / replaySpeed;
      
      setTimeout(() => {
        for (const note of replayKeyboardNotesRef.current) {
          storeNoteOff(note);
        }
        replayKeyboardNotesRef.current.clear();
        
        index++;
        const gapDuration = 200 / replaySpeed;
        replayTimerRef.current = window.setTimeout(playNext, gapDuration);
      }, holdDuration);
    };

    const startDelay = 500;
    replayTimerRef.current = window.setTimeout(playNext, startDelay);
  };

  const stopReplay = () => {
    setIsReplaying(false);
    setReplayIndex(-1);
    
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    
    for (const note of replayKeyboardNotesRef.current) {
      storeNoteOff(note);
    }
    replayKeyboardNotesRef.current.clear();
  };

  const toggleReplay = () => {
    if (isReplaying) {
      stopReplay();
    } else {
      startReplay();
    }
  };

  const highlightedNotes = scaleNotes;
  const targetNote = isPracticing 
    ? scaleNotes[currentNoteIndex] 
    : isReplaying && replayIndex >= 0 
      ? noteRecords[replayIndex]?.targetNote 
      : null;

  const accuracy = stats.totalNotes > 0 
    ? Math.round((stats.correctNotes / stats.totalNotes) * 100) 
    : 0;

  const avgReactionTime = stats.reactionTimes.length > 0
    ? Math.round(stats.totalReactionTime / stats.reactionTimes.length)
    : 0;

  const slowestNote = stats.reactionTimes.length > 0
    ? stats.reactionTimes.reduce((a, b) => a.time > b.time ? a : b)
    : null;

  const rootNoteOptions = [];
  for (let i = 48; i <= 72; i++) {
    if (![49, 51, 54, 56, 58, 61, 63, 66, 68, 70].includes(i)) {
      rootNoteOptions.push(i);
    }
  }

  return (
    <div className="practice-page">
      <div className="page-header">
        <h1 className="page-title">音阶练习</h1>
        <p className="page-description">选择音阶类型，跟随提示逐个弹奏</p>
      </div>

      <div className="practice-layout">
        <div className="practice-sidebar">
          <div className="card mb-4">
            <h3 className="card-title">音阶类型</h3>
            <div className="scale-list">
              {SCALES.map((scale) => (
                <button
                  key={scale.name}
                  className={`scale-item ${selectedScale.name === scale.name ? "active" : ""}`}
                  onClick={() => setSelectedScale(scale)}
                >
                  {scale.nameCn}
                </button>
              ))}
            </div>
          </div>

          <div className="card mb-4">
            <h3 className="card-title">设置</h3>
            
            <div className="setting-item">
              <label>起始音</label>
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
              <label>八度数量</label>
              <select 
                className="select" 
                value={octaves}
                onChange={(e) => setOctaves(Number(e.target.value))}
              >
                <option value={1}>1 个八度</option>
                <option value={2}>2 个八度</option>
                <option value={3}>3 个八度</option>
              </select>
            </div>

            <div className="setting-item">
              <label>方向</label>
              <div className="direction-options">
                <button
                  className={`direction-btn ${direction === "ascending" ? "active" : ""}`}
                  onClick={() => setDirection("ascending")}
                >
                  上行 ↑
                </button>
                <button
                  className={`direction-btn ${direction === "descending" ? "active" : ""}`}
                  onClick={() => setDirection("descending")}
                >
                  下行 ↓
                </button>
                <button
                  className={`direction-btn ${direction === "both" ? "active" : ""}`}
                  onClick={() => setDirection("both")}
                >
                  上下行
                </button>
              </div>
            </div>
          </div>

          <button 
            className="btn btn-primary w-full"
            onClick={isPracticing ? finishPractice : startPractice}
          >
            {isPracticing ? "结束练习" : "开始练习"}
          </button>
        </div>

        <div className="practice-main">
          <div className="card practice-display">
            <div className="practice-info">
              <div className="info-item">
                <span className="info-label">当前音阶</span>
                <span className="info-value">
                  {NOTE_NAMES[rootNote % 12]} {selectedScale.nameCn}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">进度</span>
                <span className="info-value">
                  {isPracticing ? `${currentNoteIndex + 1} / ${scaleNotes.length}` : `共 ${scaleNotes.length} 个音`}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">正确率</span>
                <span className={`info-value ${accuracy >= 80 ? "text-success" : accuracy >= 60 ? "text-warning" : "text-error"}`}>
                  {accuracy}%
                </span>
              </div>
            </div>

            {isPracticing && targetNote !== null && (
              <div className={`target-note-display ${lastNoteResult || ""}`}>
                <span className="target-label">下一个音</span>
                <span className="target-note">
                  {midiNoteToName(targetNote)}
                </span>
                {lastNoteResult === "correct" && <span className="result-indicator correct">✓ 正确！</span>}
                {lastNoteResult === "wrong" && <span className="result-indicator wrong">✗ 再试试</span>}
              </div>
            )}

            {!isPracticing && !showResults && (
              <div className="practice-hint">
                <p>点击"开始练习"按钮开始</p>
                <p className="text-sm text-secondary">弹奏出闪烁提示的音符</p>
              </div>
            )}
          </div>

          <div className="keyboard-preview">
            <VirtualKeyboard
              activeNotes={activeNotes}
              highlightedNotes={highlightedNotes}
              targetNote={targetNote}
              startNote={36}
              endNote={84}
            />
          </div>

          {showResults && (
            <div className="card results-card replay-card">
              <h3 className="card-title">练习结果</h3>
              <div className="results-grid grid grid-3">
                <div className="result-item">
                  <div className="result-value">{accuracy}%</div>
                  <div className="result-label">正确率</div>
                </div>
                <div className="result-item">
                  <div className="result-value">{avgReactionTime}ms</div>
                  <div className="result-label">平均反应时间</div>
                </div>
                <div className="result-item">
                  <div className="result-value">
                    {slowestNote ? midiNoteToName(slowestNote.note) : "-"}
                  </div>
                  <div className="result-label">反应最慢的音</div>
                </div>
              </div>
              <div className="result-details">
                <p>正确: {stats.correctNotes} 个</p>
                <p>错误: {stats.wrongNotes} 个</p>
                <p>总计: {stats.totalNotes} 个</p>
              </div>

              <div className="replay-section">
                <h4 className="replay-title">练习复盘回放</h4>
                
                <div className="replay-controls">
                  <button 
                    className="btn btn-primary replay-play-btn"
                    onClick={toggleReplay}
                  >
                    {isReplaying ? "⏸ 暂停" : "▶ 播放回放"}
                  </button>
                  
                  <div className="replay-speed-control">
                    <span className="speed-label">速度:</span>
                    <div className="speed-buttons">
                      {([0.5, 1, 2] as PlaybackSpeed[]).map(speed => (
                        <button
                          key={speed}
                          className={`speed-btn ${replaySpeed === speed ? "active" : ""}`}
                          onClick={() => setReplaySpeed(speed)}
                          disabled={isReplaying}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="replay-timeline">
                  <div className="timeline-track">
                    {noteRecords.map((record, index) => (
                      <div
                        key={index}
                        className={`timeline-item ${record.correct ? "correct" : "wrong"} ${replayIndex === index ? "active" : ""}`}
                        style={{ 
                          left: `${(index / Math.max(noteRecords.length - 1, 1)) * 100}%`,
                        }}
                        title={`${midiNoteToName(record.playedNote)} - ${record.correct ? "正确" : "错误"} - ${record.reactionTime}ms`}
                      >
                        <div className="timeline-dot" />
                        <div className="timeline-tooltip">
                          <div className="tooltip-note">
                            {midiNoteToName(record.targetNote)}
                          </div>
                          <div className={`tooltip-result ${record.correct ? "text-success" : "text-error"}`}>
                            {record.correct ? "✓ 正确" : "✗ 错误"}
                          </div>
                          {!record.correct && (
                            <div className="tooltip-compare">
                              <span>实际: {midiNoteToName(record.playedNote)}</span>
                            </div>
                          )}
                          <div className="tooltip-time">
                            {record.reactionTime}ms
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="replay-details">
                  <div className="replay-detail-header">
                    <span>序号</span>
                    <span>目标音</span>
                    <span>弹奏音</span>
                    <span>结果</span>
                    <span>反应时间</span>
                  </div>
                  <div className="replay-detail-list">
                    {noteRecords.map((record, index) => (
                      <div 
                        key={index} 
                        className={`replay-detail-item ${record.correct ? "" : "wrong"} ${replayIndex === index ? "active" : ""}`}
                      >
                        <span className="detail-index">{index + 1}</span>
                        <span className="detail-target">{midiNoteToName(record.targetNote)}</span>
                        <span className={`detail-played ${record.correct ? "" : "text-error"}`}>
                          {midiNoteToName(record.playedNote)}
                        </span>
                        <span className={`detail-result ${record.correct ? "text-success" : "text-error"}`}>
                          {record.correct ? "✓" : "✗"}
                        </span>
                        <span className="detail-time">{record.reactionTime}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScalePractice;
