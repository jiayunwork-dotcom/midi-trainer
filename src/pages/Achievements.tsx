import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import "../styles/achievements.css";

const Achievements = () => {
  const { achievements, loadAchievements } = useAppStore();

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progress = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  const achievementIcons: Record<string, string> = {
    streak_7: "🔥",
    scale_perfect: "🎯",
    all_major_scales: "🏆",
    rhythm_perfect: "🥁",
    sight_reading_50: "📖",
    first_practice: "🎵",
    practice_10h: "⏱️",
    chord_master: "🎹",
    all_minor_scales: "🎼",
    blues_master: "🎸",
    pentatonic_master: "🎶",
    modes_explorer: "🌈",
    perfect_chord: "✨",
    daily_goal: "✅",
    streak_30: "👑",
  };

  return (
    <div className="achievements-page">
      <div className="page-header">
        <h1 className="page-title">成就墙</h1>
        <p className="page-description">
          已解锁 {unlockedCount} / {totalCount} 个成就
        </p>
      </div>

      <div className="card overall-progress mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-lg font-semibold">总进度</span>
          <span className="text-xl font-bold text-warning">{Math.round(progress)}%</span>
        </div>
        <div className="goal-progress-bar">
          <div 
            className="goal-progress-fill" 
            style={{ 
              width: `${progress}%`,
              background: "linear-gradient(90deg, #f59e0b, #ef4444)"
            }}
          />
        </div>
      </div>

      <div className="achievement-list">
        {achievements.map((achievement) => (
          <div 
            key={achievement.id}
            className={`achievement-card ${achievement.unlocked ? "unlocked" : ""}`}
          >
            <div className="achievement-icon">
              {achievementIcons[achievement.id] || "🏅"}
            </div>
            <div className="achievement-name">{achievement.name}</div>
            <div className="achievement-description">{achievement.description}</div>
            
            {achievement.unlocked ? (
              <div className="achievement-unlocked">
                ✓ 已解锁
                {achievement.unlocked_at && (
                  <span className="achievement-date">
                    {new Date(achievement.unlocked_at).toLocaleDateString("zh-CN")}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="achievement-progress-bar">
                  <div 
                    className="achievement-progress-fill" 
                    style={{ width: `${achievement.progress * 100}%` }}
                  />
                </div>
                <div className="achievement-progress-text">
                  {Math.round(achievement.progress * 100)}%
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Achievements;
