import { useState } from "react";
import { useAppStore } from "../store/appStore";
import "../styles/settings.css";

const Settings = () => {
  const { 
    midiDevices, 
    midiDevice, 
    volume, 
    soundPreset, 
    dailyGoal,
    setVolume, 
    setSoundPreset,
    setDailyGoal,
    connectMidiDevice,
    disconnectMidiDevice,
    listMidiDevices,
  } = useAppStore();

  const [adsr, setAdsr] = useState({
    attack: 0.01,
    decay: 0.3,
    sustain: 0.6,
    release: 0.5,
  });

  const presets = [
    { value: "piano", label: "钢琴" },
    { value: "electric_piano", label: "电钢琴" },
    { value: "organ", label: "风琴" },
  ];

  const handleConnectDevice = async (deviceId: number) => {
    await connectMidiDevice(deviceId);
  };

  const handleDisconnectDevice = async () => {
    await disconnectMidiDevice();
  };

  const handleRefreshDevices = () => {
    listMidiDevices();
  };

  const handleAdsrChange = async (key: string, value: number) => {
    const newAdsr = { ...adsr, [key]: value };
    setAdsr(newAdsr);
    
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_adsr", { adsr: newAdsr });
    } catch (e) {
      console.error("Failed to set ADSR:", e);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">设置</h1>
        <p className="page-description">自定义你的练习体验</p>
      </div>

      <div className="settings-grid">
        <div className="card settings-section">
          <h3>🎹 MIDI 设备</h3>
          
          <div className="midi-device-list mb-4">
            {midiDevices.length > 0 ? (
              midiDevices.map((device) => (
                <div
                  key={device.id}
                  className={`midi-device-item ${midiDevice?.id === device.id ? "connected" : ""}`}
                >
                  <div>
                    <div className="midi-device-name">{device.name}</div>
                    <div className="midi-device-status">
                      {midiDevice?.id === device.id ? "已连接" : "可用"}
                    </div>
                  </div>
                  {midiDevice?.id === device.id ? (
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={handleDisconnectDevice}
                    >
                      断开
                    </button>
                  ) : (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConnectDevice(device.id)}
                    >
                      连接
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-secondary text-sm">
                未检测到MIDI设备
              </div>
            )}
          </div>

          <button 
            className="btn btn-secondary w-full"
            onClick={handleRefreshDevices}
          >
            🔄 刷新设备列表
          </button>
        </div>

        <div className="card settings-section">
          <h3>🔊 音频设置</h3>
          
          <div className="setting-row">
            <div>
              <div className="setting-label">音量</div>
              <div className="setting-description">调节内置音色的音量</div>
            </div>
            <div className="setting-control">
              <span className="text-sm">{Math.round(volume * 100)}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="volume-slider"
              />
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">音色</div>
              <div className="setting-description">选择不同的乐器音色</div>
            </div>
            <div className="preset-buttons">
              {presets.map((p) => (
                <button
                  key={p.value}
                  className={`preset-btn ${soundPreset === p.value ? "active" : ""}`}
                  onClick={() => setSoundPreset(p.value as any)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card settings-section">
          <h3>🎯 每日目标</h3>
          
          <div className="setting-row">
            <div>
              <div className="setting-label">每日练习目标</div>
              <div className="setting-description">达成目标会获得成就奖励</div>
            </div>
            <div className="setting-control">
              <input
                type="number"
                min="5"
                max="180"
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="input"
                style={{ width: 80 }}
              />
              <span className="text-sm text-secondary">分钟</span>
            </div>
          </div>
        </div>

        <div className="card settings-section">
          <h3>🔧 ADSR 包络</h3>
          <p className="text-sm text-secondary mb-4">
            调节音色的包络特性
          </p>
          
          <div className="setting-row">
            <div className="setting-label">Attack (起音)</div>
            <div className="setting-control">
              <input
                type="range"
                min="0"
                max="100"
                value={adsr.attack * 1000}
                onChange={(e) => handleAdsrChange("attack", Number(e.target.value) / 1000)}
                className="volume-slider"
              />
              <span className="text-sm">{(adsr.attack * 1000).toFixed(0)}ms</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">Decay (衰减)</div>
            <div className="setting-control">
              <input
                type="range"
                min="50"
                max="2000"
                value={adsr.decay * 1000}
                onChange={(e) => handleAdsrChange("decay", Number(e.target.value) / 1000)}
                className="volume-slider"
              />
              <span className="text-sm">{(adsr.decay * 1000).toFixed(0)}ms</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">Sustain (持续)</div>
            <div className="setting-control">
              <input
                type="range"
                min="0"
                max="100"
                value={adsr.sustain * 100}
                onChange={(e) => handleAdsrChange("sustain", Number(e.target.value) / 100)}
                className="volume-slider"
              />
              <span className="text-sm">{Math.round(adsr.sustain * 100)}%</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">Release (释音)</div>
            <div className="setting-control">
              <input
                type="range"
                min="50"
                max="3000"
                value={adsr.release * 1000}
                onChange={(e) => handleAdsrChange("release", Number(e.target.value) / 1000)}
                className="volume-slider"
              />
              <span className="text-sm">{(adsr.release * 1000).toFixed(0)}ms</span>
            </div>
          </div>
        </div>

        <div className="card settings-section">
          <h3>ℹ️ 关于</h3>
          <div className="about-info">
            <p><strong>MIDI Trainer</strong></p>
            <p className="text-secondary text-sm">版本 0.1.0</p>
            <p className="text-sm mt-2">
              一款功能强大的MIDI键盘练习与乐理教学应用。
              帮助你提升演奏技巧，掌握音乐理论知识。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
