import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useAppStore } from "../store/appStore";
import "../styles/dashboard.css";

const Dashboard = () => {
  const { weeklyStats, streak, todayPracticeTime, dailyGoal, loadStats } = useAppStore();
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const goalSecs = dailyGoal * 60;
    const percent = goalSecs > 0 ? Math.min(100, (todayPracticeTime / goalSecs) * 100) : 0;
    setProgressPercent(percent);
  }, [todayPracticeTime, dailyGoal]);

  const formatMinutes = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const secsLeft = secs % 60;
    return `${mins}分${secsLeft}秒`;
  };

  const accuracyData = weeklyStats?.module_accuracy.map(([name, acc]) => ({
    name: getModuleName(name),
    accuracy: Math.round(acc * 100),
  })) || [];

  const dailyData = weeklyStats?.daily_minutes.map(([day, mins]) => ({
    name: day.split(" ")[1] || day,
    minutes: mins,
  })) || [];

  const quickStartItems = [
    { path: "/scales", label: "音阶练习", icon: "🎼", color: "#6366f1" },
    { path: "/chords", label: "和弦练习", icon: "🎹", color: "#8b5cf6" },
    { path: "/rhythm", label: "节奏练习", icon: "🥁", color: "#10b981" },
    { path: "/sight-reading", label: "视奏训练", icon: "📖", color: "#f59e0b" },
  ];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">欢迎回来 👋</h1>
        <p className="page-description">今天也要加油练习哦！</p>
      </div>

      <div className="stats-grid grid grid-4 mb-6">
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.2)" }}>
            ⏱️
          </div>
          <div className="stat-info">
            <div className="stat-label">今日练习</div>
            <div className="stat-value">{formatMinutes(todayPracticeTime)}</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.2)" }}>
            🔥
          </div>
          <div className="stat-info">
            <div className="stat-label">连续练习</div>
            <div className="stat-value">{streak} 天</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.2)" }}>
            📊
          </div>
          <div className="stat-info">
            <div className="stat-label">本周总时长</div>
            <div className="stat-value">{weeklyStats?.total_minutes || 0} 分钟</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.2)" }}>
            🎯
          </div>
          <div className="stat-info">
            <div className="stat-label">每日目标</div>
            <div className="stat-value">{dailyGoal} 分钟</div>
          </div>
        </div>
      </div>

      <div className="card goal-card mb-6">
        <div className="goal-header">
          <span className="goal-title">今日目标进度</span>
          <span className="goal-percent">{Math.round(progressPercent)}%</span>
        </div>
        <div className="goal-progress-bar">
          <div 
            className="goal-progress-fill" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressPercent >= 100 && (
          <div className="goal-completed">
            🎉 恭喜你完成今日目标！
          </div>
        )}
      </div>

      <div className="section-title mb-4">快速开始</div>
      <div className="quick-start-grid grid grid-4 mb-6">
        {quickStartItems.map((item) => (
          <Link to={item.path} key={item.path} className="quick-start-card">
            <div className="quick-start-icon" style={{ background: `${item.color}20`, color: item.color }}>
              {item.icon}
            </div>
            <span className="quick-start-label">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="charts-grid grid grid-2 mb-6">
        <div className="card chart-card">
          <h3 className="card-title">本周练习时长</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="name" stroke="#a0a0b8" fontSize={12} />
                <YAxis stroke="#a0a0b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    background: "#1a1a2e", 
                    border: "1px solid #2a2a4a",
                    borderRadius: "8px",
                    color: "#e8e8f0"
                  }}
                  formatter={(value: number) => [`${value} 分钟`, "时长"]}
                />
                <Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <h3 className="card-title">各模块正确率</h3>
          <div className="chart-container">
            {accuracyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                  <XAxis dataKey="name" stroke="#a0a0b8" fontSize={12} />
                  <YAxis stroke="#a0a0b8" fontSize={12} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      background: "#1a1a2e", 
                      border: "1px solid #2a2a4a",
                      borderRadius: "8px",
                      color: "#e8e8f0"
                    }}
                    formatter={(value: number) => [`${value}%`, "正确率"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: "#10b981", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <p>暂无数据</p>
                <p className="text-sm text-secondary">开始练习后这里会显示统计数据</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card tips-card">
        <h3 className="card-title">💡 练习小贴士</h3>
        <div className="tips-content">
          <div className="tip-item">
            <span className="tip-number">1</span>
            <p>每天坚持练习比集中突击效果更好，哪怕只有15分钟</p>
          </div>
          <div className="tip-item">
            <span className="tip-number">2</span>
            <p>从慢速开始，确保每个音都准确，再逐渐提高速度</p>
          </div>
          <div className="tip-item">
            <span className="tip-number">3</span>
            <p>使用节拍器练习可以有效提升节奏感和稳定性</p>
          </div>
        </div>
      </div>
    </div>
  );
};

function getModuleName(type: string): string {
  const names: Record<string, string> = {
    scale: "音阶",
    chord: "和弦",
    rhythm: "节奏",
    sight_reading: "视奏",
  };
  return names[type] || type;
}

export default Dashboard;
