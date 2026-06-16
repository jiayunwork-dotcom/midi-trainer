import { useState, useEffect, useRef, useMemo } from "react";
import VirtualKeyboard from "../components/VirtualKeyboard";
import { SCALES, midiNoteToName, NOTE_NAMES } from "../utils/musicTheory";
import { useAppStore, BattleRound } from "../store/appStore";
import { useBattleStore } from "../store/battleStore";
import "../styles/battle.css";

const Battle = () => {
  const { activeNotes, saveBattleRecord, loadBattleHistory } = useAppStore();
  const {
    phase,
    countdown,
    breakCountdown,
    currentRound,
    totalRounds,
    currentPlayer,
    player1,
    player2,
    selectedScale,
    octaves,
    rootNote,
    scaleNotes,
    rounds,
    currentRoundData,
    finalRecord,
    setPlayerName,
    setPlayerReady,
    setSelectedScale,
    setOctaves,
    handleNotePlayed,
    resetBattle,
  } = useBattleStore();

  const [lastNoteResult, setLastNoteResult] = useState<"correct" | "wrong" | null>(null);
  const [battleHistory, setBattleHistory] = useState<any[]>([]);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const prevActiveNotesRef = useRef<Map<number, any>>(new Map());
  const hasSavedRecordRef = useRef(false);

  useEffect(() => {
    loadBattleHistory(10).then(setBattleHistory);
  }, [loadBattleHistory]);

  useEffect(() => {
    if (phase !== "playing") return;

    const prevNotes = prevActiveNotesRef.current;
    const currentNotes = activeNotes;

    for (const [note, _info] of currentNotes) {
      if (!prevNotes.has(note)) {
        const result = handleNotePlayed(note);
        if (result) {
          setLastNoteResult(result);
          setTimeout(() => setLastNoteResult(null), 300);
        }
      }
    }

    prevActiveNotesRef.current = new Map(currentNotes);
  }, [activeNotes, phase, handleNotePlayed]);

  useEffect(() => {
    if (phase === "finished" && finalRecord && !hasSavedRecordRef.current) {
      hasSavedRecordRef.current = true;
      setCelebrationVisible(true);
      saveBattleRecord(finalRecord).then(() => {
        loadBattleHistory(10).then(setBattleHistory);
      });
    }
    if (phase === "lobby") {
      hasSavedRecordRef.current = false;
    }
  }, [phase, finalRecord, saveBattleRecord, loadBattleHistory]);

  const finalStats = useMemo(() => {
    if (!finalRecord) return null;
    
    let totalP1Duration = 0;
    let totalP2Duration = 0;
    let totalP1Errors = 0;
    let totalP2Errors = 0;
    
    for (const round of rounds) {
      totalP1Duration += round.p1DurationMs;
      totalP2Duration += round.p2DurationMs;
      totalP1Errors += round.p1Errors;
      totalP2Errors += round.p2Errors;
    }

    return {
      totalP1Duration,
      totalP2Duration,
      totalP1Errors,
      totalP2Errors,
      p1Wins: finalRecord.p1Wins,
      p2Wins: finalRecord.p2Wins,
      winner: finalRecord.winner,
      isP1Winner: finalRecord.winner === player1.name,
      isDraw: finalRecord.p1Wins === finalRecord.p2Wins,
    };
  }, [finalRecord, rounds, player1.name, player2.name]);

  const confettiItems = useMemo(() => (
    [...Array(50)].map(() => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 3}s`,
      background: ['#ff0', '#f0f', '#0ff', '#0f0', '#f00'][Math.floor(Math.random() * 5)]
    }))
  ), []);

  const getPlayerStats = (player: typeof player1) => {
    const totalNotes = player.correctNotes + player.wrongNotes;
    const accuracy = totalNotes > 0 ? Math.round((player.correctNotes / totalNotes) * 100) : 0;
    const elapsed = player.startTime > 0 && player.durationMs === 0 
      ? Date.now() - player.startTime 
      : player.durationMs;
    return { accuracy, elapsed, totalNotes };
  };

  const PlayerArea = ({ player, playerNum, isTop }: { player: typeof player1; playerNum: 1 | 2; isTop: boolean }) => {
    const stats = getPlayerStats(player);
    const isActive = phase === "playing" && currentPlayer === playerNum;
    const targetNote = isActive && player.currentNoteIndex < scaleNotes.length 
      ? scaleNotes[player.currentNoteIndex] 
      : null;
    
    const startNote = Math.min(...scaleNotes) - 1;
    const endNote = Math.max(...scaleNotes) + 1;

    return (
      <div className={`player-area ${isTop ? "player-1" : "player-2"} ${isActive ? "active" : ""} ${!isActive && phase === "playing" ? "waiting" : ""}`}>
        <div className="player-header">
          <div className="player-info">
            <span className={`player-indicator ${playerNum === 1 ? "p1" : "p2"}`}>P{playerNum}</span>
            <span className="player-name">{player.name}</span>
            {isActive && <span className="turn-indicator">🎯 你的回合</span>}
            {!isActive && phase === "playing" && <span className="turn-indicator waiting">⏳ 等待中...</span>}
          </div>
          <div className="player-stats">
            <div className="stat-item">
              <span className="stat-label">进度</span>
              <span className="stat-value">{player.currentNoteIndex} / {scaleNotes.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">正确率</span>
              <span className={`stat-value ${stats.accuracy >= 80 ? "text-success" : stats.accuracy >= 60 ? "text-warning" : "text-error"}`}>
                {stats.accuracy}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">用时</span>
              <span className="stat-value">{(stats.elapsed / 1000).toFixed(1)}s</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">错误</span>
              <span className="stat-value text-error">{player.wrongNotes}</span>
            </div>
          </div>
        </div>

        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${(player.currentNoteIndex / Math.max(scaleNotes.length, 1)) * 100}%` }}
          />
        </div>

        {isActive && targetNote !== null && (
          <div className={`target-note-display ${lastNoteResult || ""} ${playerNum === 1 ? "p1" : "p2"}`}>
            <span className="target-label">下一个音</span>
            <span className="target-note">{midiNoteToName(targetNote)}</span>
            {lastNoteResult === "correct" && <span className="result-indicator correct">✓ 正确！</span>}
            {lastNoteResult === "wrong" && <span className="result-indicator wrong">✗ 再试试</span>}
          </div>
        )}

        <div className="battle-keyboard">
          <VirtualKeyboard
            activeNotes={isActive ? activeNotes : new Map()}
            highlightedNotes={scaleNotes}
            targetNote={isActive ? targetNote : null}
            startNote={startNote}
            endNote={endNote}
            showNoteNames={true}
          />
        </div>
      </div>
    );
  };

  const LobbyScreen = () => (
    <div className="lobby-screen">
      <div className="lobby-header">
        <h1 className="lobby-title">🎮 练习对战</h1>
        <p className="lobby-subtitle">双人对战，比比谁的音阶更快更准！</p>
      </div>

      <div className="lobby-content">
        <div className="player-setup-container">
          <div className="player-setup p1">
            <div className="player-setup-header">
              <span className="player-icon p1">🔵</span>
              <h3>玩家 1</h3>
            </div>
            <input
              type="text"
              className="name-input"
              placeholder="输入昵称"
              value={player1.name}
              onChange={(e) => setPlayerName(1, e.target.value)}
              maxLength={20}
            />
            <button
              className={`ready-btn ${player1.ready ? "ready" : ""}`}
              onClick={() => setPlayerReady(1, !player1.ready)}
            >
              {player1.ready ? "✓ 已准备" : "准备"}
            </button>
          </div>

          <div className="vs-divider">
            <span className="vs-text">VS</span>
          </div>

          <div className="player-setup p2">
            <div className="player-setup-header">
              <span className="player-icon p2">🔴</span>
              <h3>玩家 2</h3>
            </div>
            <input
              type="text"
              className="name-input"
              placeholder="输入昵称"
              value={player2.name}
              onChange={(e) => setPlayerName(2, e.target.value)}
              maxLength={20}
            />
            <button
              className={`ready-btn ${player2.ready ? "ready" : ""}`}
              onClick={() => setPlayerReady(2, !player2.ready)}
            >
              {player2.ready ? "✓ 已准备" : "准备"}
            </button>
          </div>
        </div>

        <div className="battle-settings">
          <h3 className="settings-title">对战设置</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>音阶类型</label>
              <div className="scale-grid">
                {SCALES.map((scale) => (
                  <button
                    key={scale.name}
                    className={`scale-btn ${selectedScale.name === scale.name ? "active" : ""}`}
                    onClick={() => setSelectedScale(scale)}
                  >
                    {scale.nameCn}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-item">
              <label>八度数量</label>
              <div className="octave-options">
                {[1, 2, 3].map((o) => (
                  <button
                    key={o}
                    className={`octave-btn ${octaves === o ? "active" : ""}`}
                    onClick={() => setOctaves(o)}
                  >
                    {o} 个八度
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="battle-rules">
          <h4>📜 对战规则</h4>
          <ul>
            <li>共 3 个回合，每回合随机选择起始音</li>
            <li>两人弹奏相同的音阶序列</li>
            <li>弹错不扣分但不前进，必须弹对才能继续</li>
            <li>评分：用时 + 错误数 × 1秒，得分低者获胜</li>
            <li>三回合两胜制，平局比总用时</li>
          </ul>
        </div>
      </div>

      <div className="battle-history-section">
        <h3 className="history-title">📊 最近对战记录</h3>
        {battleHistory.length > 0 ? (
          <div className="history-list">
            {battleHistory.map((record) => (
              <div key={record.id} className="history-item">
                <div className="history-players">
                  <span className={`history-player ${record.winner === record.player1Name ? "winner" : ""}`}>
                    {record.player1Name}
                  </span>
                  <span className="history-score">
                    {record.p1Wins} : {record.p2Wins}
                  </span>
                  <span className={`history-player ${record.winner === record.player2Name ? "winner" : ""}`}>
                    {record.player2Name}
                  </span>
                </div>
                <span className="history-date">{record.date}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-history">暂无对战记录，开始你的第一场对战吧！</p>
        )}
      </div>
    </div>
  );

  const CountdownScreen = () => (
    <div className="countdown-screen">
      <div className="countdown-number" key={countdown}>
        {countdown}
      </div>
      <p className="countdown-text">准备开始...</p>
    </div>
  );

  const PlayingScreen = () => (
    <div className="playing-screen">
      <div className="battle-status-bar">
        <div className="round-info">
          <span className="round-label">第 {currentRound} 回合</span>
          <span className="round-scale">{NOTE_NAMES[rootNote % 12]} {selectedScale.nameCn}</span>
        </div>
        <div className="score-info">
          <span className="score p1">{player1.name}: {rounds.filter(r => r.winner === player1.name).length} 胜</span>
          <span className="score-divider">|</span>
          <span className="score p2">{player2.name}: {rounds.filter(r => r.winner === player2.name).length} 胜</span>
        </div>
      </div>

      <div className="players-container">
        <PlayerArea player={player1} playerNum={1} isTop={true} />
        <div className="round-divider">
          <span>第 {currentRound} / {totalRounds} 回合</span>
        </div>
        <PlayerArea player={player2} playerNum={2} isTop={false} />
      </div>
    </div>
  );

  const RoundBreakScreen = () => {
    if (!currentRoundData) return null;
    
    const p1Score = currentRoundData.p1DurationMs + currentRoundData.p1Errors * 1000;
    const p2Score = currentRoundData.p2DurationMs + currentRoundData.p2Errors * 1000;

    return (
      <div className="round-break-screen">
        <div className="round-result-card">
          <h2>第 {currentRound} 回合结束</h2>
          
          <div className="break-countdown">
            <span>{currentRound < totalRounds ? "下一回合将在" : "最终结果将在"}</span>
            <span className="countdown-big">{breakCountdown}</span>
            <span>秒后{currentRound < totalRounds ? "开始" : "揭晓"}</span>
          </div>

          <div className="round-score-table">
            <div className="score-header">
              <span>玩家</span>
              <span>用时</span>
              <span>错误</span>
              <span>综合得分</span>
              <span>结果</span>
            </div>
            <div className={`score-row ${currentRoundData.winner === player1.name ? "winner" : ""}`}>
              <span className="player-name p1">{player1.name}</span>
              <span>{(currentRoundData.p1DurationMs / 1000).toFixed(2)}s</span>
              <span className={currentRoundData.p1Errors > 0 ? "text-error" : ""}>{currentRoundData.p1Errors}</span>
              <span className="score-value">{(p1Score / 1000).toFixed(2)}</span>
              <span className="result-badge">
                {currentRoundData.winner === player1.name ? "🏆 胜" : currentRoundData.winner === player2.name ? "负" : "平"}
              </span>
            </div>
            <div className={`score-row ${currentRoundData.winner === player2.name ? "winner" : ""}`}>
              <span className="player-name p2">{player2.name}</span>
              <span>{(currentRoundData.p2DurationMs / 1000).toFixed(2)}s</span>
              <span className={currentRoundData.p2Errors > 0 ? "text-error" : ""}>{currentRoundData.p2Errors}</span>
              <span className="score-value">{(p2Score / 1000).toFixed(2)}</span>
              <span className="result-badge">
                {currentRoundData.winner === player2.name ? "🏆 胜" : currentRoundData.winner === player1.name ? "负" : "平"}
              </span>
            </div>
          </div>

          <div className="current-standing">
            <h4>当前比分</h4>
            <div className="standing-score">
              <span className="p1-score">{player1.name}</span>
              <span className="standing-text">
                {rounds.filter(r => r.winner === player1.name).length} : {rounds.filter(r => r.winner === player2.name).length}
              </span>
              <span className="p2-score">{player2.name}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const FinishedScreen = () => {
    if (!finalStats || !finalRecord) return null;
    const { totalP1Duration, totalP2Duration, totalP1Errors, totalP2Errors, p1Wins, p2Wins, winner, isP1Winner, isDraw } = finalStats;

    return (
      <div className="finished-screen">
        {celebrationVisible && (
          <div className="celebration-overlay">
            <div className="confetti-container">
              {confettiItems.map((item, i) => (
                <div key={i} className="confetti" style={item} />
              ))}
            </div>
          </div>
        )}

        <div className="final-result-card">
          <div className="result-header">
            <h1 className="result-title">
              {isP1Winner ? "🎉 " : "💪 "}
              {winner} 获胜！
              {!isP1Winner ? " 🎉" : " 💪"}
            </h1>
            <p className="result-subtitle">
              {isDraw ? "平局！总用时少者获胜" : "恭喜获胜者！"}
            </p>
          </div>

          <div className="final-score">
            <div className={`final-player ${isP1Winner ? "winner" : "loser"}`}>
              <span className="final-player-name">{player1.name}</span>
              <span className="final-player-score">{p1Wins} 胜</span>
              {isP1Winner ? (
                <span className="final-badge winner-badge">🏆 冠军</span>
              ) : (
                <span className="final-badge encouragement-badge">💪 继续加油！</span>
              )}
            </div>
            <div className="final-vs">VS</div>
            <div className={`final-player ${!isP1Winner ? "winner" : "loser"}`}>
              <span className="final-player-name">{player2.name}</span>
              <span className="final-player-score">{p2Wins} 胜</span>
              {!isP1Winner ? (
                <span className="final-badge winner-badge">🏆 冠军</span>
              ) : (
                <span className="final-badge encouragement-badge">💪 继续加油！</span>
              )}
            </div>
          </div>

          <div className="detailed-results">
            <h3>📊 详细数据</h3>
            <table className="results-table">
              <thead>
                <tr>
                  <th>回合</th>
                  <th>起始音</th>
                  <th>{player1.name} 用时</th>
                  <th>{player1.name} 错误</th>
                  <th>{player2.name} 用时</th>
                  <th>{player2.name} 错误</th>
                  <th>胜者</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round: BattleRound, index: number) => (
                  <tr key={index}>
                    <td>第 {round.roundNumber} 回合</td>
                    <td>{NOTE_NAMES[round.rootNote % 12]}</td>
                    <td>{(round.p1DurationMs / 1000).toFixed(2)}s</td>
                    <td className={round.p1Errors > 0 ? "text-error" : ""}>{round.p1Errors}</td>
                    <td>{(round.p2DurationMs / 1000).toFixed(2)}s</td>
                    <td className={round.p2Errors > 0 ? "text-error" : ""}>{round.p2Errors}</td>
                    <td className={round.winner === player1.name ? "p1" : round.winner === player2.name ? "p2" : ""}>
                      {round.winner || "平局"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>总计</strong></td>
                  <td><strong>{(totalP1Duration / 1000).toFixed(2)}s</strong></td>
                  <td className={totalP1Errors > 0 ? "text-error" : ""}><strong>{totalP1Errors}</strong></td>
                  <td><strong>{(totalP2Duration / 1000).toFixed(2)}s</strong></td>
                  <td className={totalP2Errors > 0 ? "text-error" : ""}><strong>{totalP2Errors}</strong></td>
                  <td><strong>{winner}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button className="btn btn-primary btn-large" onClick={() => {
            resetBattle();
            setCelebrationVisible(false);
            loadBattleHistory(10).then(setBattleHistory);
          }}>
            🔄 再来一局
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="battle-page">
      {phase === "lobby" && <LobbyScreen />}
      {phase === "countdown" && <CountdownScreen />}
      {phase === "playing" && <PlayingScreen />}
      {phase === "roundBreak" && <RoundBreakScreen />}
      {phase === "finished" && <FinishedScreen />}
    </div>
  );
};

export default Battle;
