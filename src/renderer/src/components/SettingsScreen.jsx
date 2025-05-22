import { useState, useEffect } from 'react'
import './SettingsScreen.css'

function SettingsScreen() {
  const [config, setConfig] = useState({
    workDuration: 20,
    breakDuration: 5,
    notifyBeforeBreak: true,
    soundEnabled: true,
    darkMode: false,
    autoStart: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [appStatus, setAppStatus] = useState({
    isBreakActive: false,
    isPaused: false,
    workTimeRemaining: 0,
    breakTimeRemaining: 0
  })

  useEffect(() => {
    loadConfig()
    loadStatus()

    // Update status every second
    const statusInterval = setInterval(loadStatus, 1000)
    return () => clearInterval(statusInterval)
  }, [])

  const loadConfig = async () => {
    try {
      const savedConfig = await window.api.getConfig()
      setConfig({
        workDuration: Math.round(savedConfig.workDuration / (60 * 1000)),
        breakDuration: Math.round(savedConfig.breakDuration / (60 * 1000)),
        notifyBeforeBreak: savedConfig.notifyBeforeBreak,
        soundEnabled: savedConfig.soundEnabled,
        darkMode: savedConfig.darkMode,
        autoStart: savedConfig.autoStart
      })
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStatus = async () => {
    try {
      const status = await window.api.getAppStatus()
      setAppStatus(status)
    } catch (error) {
      console.error('Error loading status:', error)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const configToSave = {
        ...config,
        workDuration: config.workDuration * 60 * 1000,
        breakDuration: config.breakDuration * 60 * 1000
      }
      await window.api.saveConfig(configToSave)
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getStatusDisplay = () => {
    if (appStatus.isPaused) {
      return {
        icon: '⏸️',
        text: 'Paused',
        color: '#f39c12',
        subtext: 'Break reminders are disabled'
      }
    } else if (appStatus.isBreakActive) {
      return {
        icon: '💤',
        text: 'Break Time',
        color: '#e74c3c',
        subtext: `${formatTime(appStatus.breakTimeRemaining)} remaining`
      }
    } else {
      return {
        icon: '💻',
        text: 'Working',
        color: '#27ae60',
        subtext: `${formatTime(appStatus.workTimeRemaining)} until break`
      }
    }
  }

  const getProgressPercentage = () => {
    if (appStatus.isBreakActive) {
      const totalDuration = config.breakDuration * 60 * 1000
      const elapsed = totalDuration - appStatus.breakTimeRemaining
      return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
    } else {
      const totalDuration = config.workDuration * 60 * 1000
      const elapsed = totalDuration - appStatus.workTimeRemaining
      return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
    }
  }

  if (isLoading) {
    return (
      <div className="settings-container">
        <div className="loading">Loading settings...</div>
      </div>
    )
  }

  const status = getStatusDisplay()

  return (
    <div className={`settings-container ${config.darkMode ? 'dark' : ''}`}>
      <div className="settings-header">
        <h1>👁️ Eye Guard Settings</h1>
        <p>Protect your eyes with regular breaks</p>
      </div>

      <div className="settings-content">
        {/* Status Display */}
        <div className="setting-group status-group">
          <h3>📊 Current Status</h3>
          <div className="status-display">
            <div className="status-icon" style={{ color: status.color }}>
              {status.icon}
            </div>
            <div className="status-info">
              <div className="status-text" style={{ color: status.color }}>
                {status.text}
              </div>
              <div className="status-subtext">{status.subtext}</div>
            </div>
          </div>
          {!appStatus.isPaused && (
            <div className="status-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${getProgressPercentage()}%`,
                    backgroundColor: status.color
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="setting-group">
          <h3>⏰ Timer Settings</h3>

          <div className="setting-item">
            <label htmlFor="work-duration">Work Duration: {config.workDuration} minutes</label>
            <input
              id="work-duration"
              type="range"
              min="1"
              max="120"
              value={config.workDuration}
              onChange={(e) => handleInputChange('workDuration', parseInt(e.target.value))}
              className="slider"
            />
            <div className="range-labels">
              <span>1 min</span>
              <span>120 min</span>
            </div>
          </div>

          <div className="setting-item">
            <label htmlFor="break-duration">Break Duration: {config.breakDuration} minutes</label>
            <input
              id="break-duration"
              type="range"
              min="1"
              max="30"
              value={config.breakDuration}
              onChange={(e) => handleInputChange('breakDuration', parseInt(e.target.value))}
              className="slider"
            />
            <div className="range-labels">
              <span>1 min</span>
              <span>30 min</span>
            </div>
          </div>
        </div>

        <div className="setting-group">
          <h3>🔔 Notifications</h3>

          <div className="setting-item checkbox-item">
            <label>
              <input
                type="checkbox"
                checked={config.notifyBeforeBreak}
                onChange={(e) => handleInputChange('notifyBeforeBreak', e.target.checked)}
              />
              <span className="checkmark"></span>
              Notify before break starts (30s warning)
            </label>
          </div>

          <div className="setting-item checkbox-item">
            <label>
              <input
                type="checkbox"
                checked={config.soundEnabled}
                onChange={(e) => handleInputChange('soundEnabled', e.target.checked)}
              />
              <span className="checkmark"></span>
              Enable sound notifications
            </label>
          </div>
        </div>

        <div className="setting-group">
          <h3>🎨 Appearance</h3>

          <div className="setting-item checkbox-item">
            <label>
              <input
                type="checkbox"
                checked={config.darkMode}
                onChange={(e) => handleInputChange('darkMode', e.target.checked)}
              />
              <span className="checkmark"></span>
              Dark mode
            </label>
          </div>
        </div>

        <div className="setting-group">
          <h3>🚀 Startup</h3>

          <div className="setting-item checkbox-item">
            <label>
              <input
                type="checkbox"
                checked={config.autoStart}
                onChange={(e) => handleInputChange('autoStart', e.target.checked)}
              />
              <span className="checkmark"></span>
              Start with system
            </label>
          </div>
        </div>

        <div className="settings-footer">
          <button className="save-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>

          <div className="help-text">
            <p>
              💡 <strong>Tip:</strong> Use Ctrl+Alt+Shift+E to emergency exit during a break
            </p>
            <p>🎯 Recommended: 20 minutes work, 5 minutes break (20-20-20 rule)</p>
            <p>🔔 Notifications will appear in your system tray area</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsScreen
