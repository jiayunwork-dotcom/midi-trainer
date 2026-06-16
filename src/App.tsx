import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import ScalePractice from "./pages/ScalePractice";
import ChordPractice from "./pages/ChordPractice";
import RhythmPractice from "./pages/RhythmPractice";
import SightReading from "./pages/SightReading";
import Achievements from "./pages/Achievements";
import History from "./pages/History";
import Settings from "./pages/Settings";
import VirtualKeyboard from "./components/VirtualKeyboard";
import { useAppStore } from "./store/appStore";
import "./styles/app.css";

function Navigation() {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "主页", icon: "🏠" },
    { path: "/scales", label: "音阶", icon: "🎼" },
    { path: "/chords", label: "和弦", icon: "🎹" },
    { path: "/rhythm", label: "节奏", icon: "🥁" },
    { path: "/sight-reading", label: "视奏", icon: "📖" },
    { path: "/history", label: "历史", icon: "📊" },
    { path: "/achievements", label: "成就", icon: "🏆" },
    { path: "/settings", label: "设置", icon: "⚙️" },
  ];

  return (
    <nav className="sidebar">
      <div className="logo">
        <span className="logo-icon">🎹</span>
        <span className="logo-text">MIDI Trainer</span>
      </div>
      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function App() {
  const { initMidiListener, activeNotes, midiDevice } = useAppStore();
  const [showKeyboard, setShowKeyboard] = useState(true);

  useEffect(() => {
    initMidiListener();
  }, [initMidiListener]);

  return (
    <Router>
      <div className="app-container">
        <Navigation />
        <main className="main-content">
          <div className="content-area">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scales" element={<ScalePractice />} />
              <Route path="/chords" element={<ChordPractice />} />
              <Route path="/rhythm" element={<RhythmPractice />} />
              <Route path="/sight-reading" element={<SightReading />} />
              <Route path="/history" element={<History />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
          {showKeyboard && (
            <div className="keyboard-container">
              <div className="keyboard-header">
                <span className="device-status">
                  {midiDevice ? `🎵 ${midiDevice.name}` : "未连接MIDI设备"}
                </span>
                <button 
                  className="toggle-keyboard-btn"
                  onClick={() => setShowKeyboard(false)}
                >
                  隐藏键盘
                </button>
              </div>
              <VirtualKeyboard activeNotes={activeNotes} />
            </div>
          )}
        </main>
      </div>
    </Router>
  );
}

export default App;
