import { useState, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import "../styles/history.css";

const History = () => {
  const { loadStats } = useAppStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadHistory();
    generateCalendar();
  }, [loadStats]);

  const loadHistory = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const history = await invoke("get_practice_history", { limit: 50 });
      setSessions(history as any[]);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  };

  const generateCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: any[] = [];
    const startPadding = firstDay.getDay();
    
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, hasPractice: false });
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split("T")[0];
      const isToday = dateStr === now.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        day: i,
        hasPractice: false,
        isToday,
        minutes: 0,
      });
    }
    
    setCalendarDays(days);
  };

  const getModuleIcon = (type: string) => {
    const icons: Record<string, string> = {
      scale: "🎼",
      chord: "🎹",
      rhythm: "🥁",
      sight_reading: "📖",
    };
    return icons[type] || "🎵";
  };

  const getModuleName = (type: string) => {
    const names: Record<string, string> = {
      scale: "音阶练习",
      chord: "和弦练习",
      rhythm: "节奏练习",
      sight_reading: "视奏训练",
    };
    return names[type] || type;
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}分${s}秒`;
  };

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  const filteredSessions = selectedDate
    ? sessions.filter(s => s.date === selectedDate)
    : sessions;

  const selectedDayMinutes = selectedDate
    ? filteredSessions.reduce((sum, s) => sum + s.duration_secs, 0) / 60
    : 0;

  return (
    <div className="history-page">
      <div className="page-header">
        <h1 className="page-title">练习历史</h1>
        <p className="page-description">查看你的练习记录和统计</p>
      </div>

      <div className="history-layout">
        <div className="history-sidebar">
          <div className="card mb-4">
            <h3 className="card-title">
              {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}
            </h3>
            <div className="calendar-header">
              {weekDays.map(day => (
                <div key={day} className="calendar-day-label">{day}</div>
              ))}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`calendar-day ${day.hasPractice ? "has-practice" : ""} ${day.isToday ? "today" : ""} ${day.date ? "" : "empty"}`}
                  onClick={() => day.date && setSelectedDate(selectedDate === day.date ? null : day.date)}
                >
                  {day.day}
                </div>
              ))}
            </div>
          </div>

          {selectedDate && (
            <div className="card">
              <h3 className="card-title">
                {new Date(selectedDate).toLocaleDateString("zh-CN", { 
                  year: "numeric", 
                  month: "long", 
                  day: "numeric" 
                })}
              </h3>
              <div className="day-summary">
                <div className="day-stat">
                  <span className="day-stat-value">{Math.round(selectedDayMinutes)}</span>
                  <span className="day-stat-label">分钟</span>
                </div>
                <div className="day-stat">
                  <span className="day-stat-value">{filteredSessions.length}</span>
                  <span className="day-stat-label">次练习</span>
                </div>
              </div>
              <button 
                className="btn btn-secondary w-full mt-4"
                onClick={() => setSelectedDate(null)}
              >
                查看全部
              </button>
            </div>
          )}
        </div>

        <div className="history-main">
          <div className="card">
            <h3 className="card-title">
              {selectedDate ? "当日记录" : "最近记录"}
            </h3>
            
            {filteredSessions.length > 0 ? (
              <div className="history-list">
                {filteredSessions.map((session: any) => (
                  <div key={session.id} className="history-item">
                    <div className="history-module-icon">
                      {getModuleIcon(session.module_type)}
                    </div>
                    <div className="history-info">
                      <div className="history-module">
                        {getModuleName(session.module_type)}
                      </div>
                      <div className="history-date">
                        {session.date}
                      </div>
                    </div>
                    <div className="history-stats">
                      <div className="history-stat">
                        <div className="history-stat-value">
                          {formatDuration(session.duration_secs)}
                        </div>
                        <div className="history-stat-label">时长</div>
                      </div>
                      <div className="history-stat">
                        <div className={`history-stat-value ${
                          session.accuracy >= 0.8 ? "text-success" : 
                          session.accuracy >= 0.6 ? "text-warning" : "text-error"
                        }`}>
                          {Math.round(session.accuracy * 100)}%
                        </div>
                        <div className="history-stat-label">正确率</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-history">
                <p>暂无练习记录</p>
                <p className="text-sm text-secondary">开始练习后这里会显示你的记录</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
