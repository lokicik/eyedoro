import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import './SettingsScreen.css'

function SettingsScreen({ onThemeChange = null }) {
  const [config, setConfig] = useState({
    workDuration: 20,
    breakDuration: 5,
    notifyBeforeBreak: true,
    notificationTiming: 30, // seconds before break to show notification
    soundEnabled: true,
    theme: 'light',
    autoStart: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [appStatus, setAppStatus] = useState({
    isBreakActive: false,
    isPaused: false,
    workTimeRemaining: 0,
    breakTimeRemaining: 0
  })

  const saveTimeoutRef = useRef(null)
  const hasUnsavedChangesRef = useRef(false)
  const isReceivingIPCThemeRef = useRef(false) // Flag to track IPC theme changes
  const pendingThemeRef = useRef(null) // Track which theme is pending save

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
      const processedConfig = {
        workDuration: Math.round(savedConfig.workDuration / (60 * 1000)),
        breakDuration: Math.round(savedConfig.breakDuration / (60 * 1000)),
        notifyBeforeBreak: savedConfig.notifyBeforeBreak,
        notificationTiming: savedConfig.notificationTiming || 30, // default to 30 seconds if not set
        soundEnabled: savedConfig.soundEnabled,
        theme: savedConfig.theme || (savedConfig.darkMode ? 'dark' : 'light'),
        autoStart: savedConfig.autoStart
      }
      setConfig(processedConfig)
      setLastSaved(new Date())
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

  const saveConfig = async (configToSave) => {
    setIsSaving(true)
    try {
      const finalConfig = {
        ...configToSave,
        workDuration: configToSave.workDuration * 60 * 1000,
        breakDuration: configToSave.breakDuration * 60 * 1000
      }
      await window.api.saveConfig(finalConfig)
      setLastSaved(new Date())
      hasUnsavedChangesRef.current = false
      console.log('Settings auto-saved successfully')
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const debouncedSave = (newConfig) => {
    hasUnsavedChangesRef.current = true

    // Track if this is a theme change
    if (newConfig.theme !== config.theme) {
      pendingThemeRef.current = newConfig.theme
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveConfig(newConfig)
      pendingThemeRef.current = null // Clear pending theme after save
    }, 2000) // Auto-save after 2 seconds of no changes
  }

  const handleInputChange = (key, value) => {
    const newConfig = { ...config, [key]: value }

    console.log(
      'Settings handleInputChange:',
      key,
      value,
      'isReceivingIPC:',
      isReceivingIPCThemeRef.current
    )

    setConfig(newConfig)

    // Immediately notify parent component about theme change (for embedded settings)
    if (key === 'theme' && onThemeChange && !isReceivingIPCThemeRef.current) {
      console.log('Immediately notifying parent about theme change:', value)
      onThemeChange(value)
    }

    // Only dispatch theme change event if this is NOT coming from IPC
    if (key === 'theme' && !isReceivingIPCThemeRef.current) {
      console.log('Settings screen dispatching theme change:', value)
      const themeChangeEvent = new CustomEvent('themeChange', {
        detail: { theme: value }
      })
      window.dispatchEvent(themeChangeEvent)
    } else if (key === 'theme' && isReceivingIPCThemeRef.current) {
      console.log('Skipping theme dispatch - change came from IPC')
    }

    // For duration changes and theme changes, save immediately to prevent race conditions
    if (
      key === 'workDuration' ||
      key === 'breakDuration' ||
      key === 'theme' ||
      key === 'notificationTiming'
    ) {
      console.log('Saving immediately for:', key, value)
      if (!isReceivingIPCThemeRef.current) {
        saveConfig(newConfig)
      }
    } else {
      // For other settings, use debounced save (but not if this is from IPC)
      if (!isReceivingIPCThemeRef.current) {
        console.log('Using debounced save for:', key, value)
        debouncedSave(newConfig)
      } else {
        console.log('Skipping debounced save - change came from IPC')
      }
    }
  }

  // Auto-save on component unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (hasUnsavedChangesRef.current && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        // Force immediate save on unmount
        const configToSave = {
          ...config,
          workDuration: config.workDuration * 60 * 1000,
          breakDuration: config.breakDuration * 60 * 1000
        }
        window.api.saveConfig(configToSave)
      }
    }
  }, [config])

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

  // Helper function to determine the actual theme to use
  const getEffectiveTheme = () => {
    if (config.theme === 'auto') {
      // Auto mode: use system preference or default to light
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return config.theme
  }

  // Helper function to get theme classes
  const getThemeClasses = () => {
    const effectiveTheme = getEffectiveTheme()

    // For dark-based themes, always include 'dark' class
    const darkThemes = ['dark', 'ocean', 'forest', 'sunset', 'midnight']
    const isDarkBased = darkThemes.includes(effectiveTheme)

    let classes = ''
    if (isDarkBased) {
      classes += 'dark '
    }

    // Add specific theme class if it's not the basic light/dark
    if (!['light', 'dark'].includes(effectiveTheme)) {
      classes += `theme-${effectiveTheme}`
    }

    return classes.trim()
  }

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (config.theme === 'auto' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleThemeChange = () => {
        // Force a re-render by updating a dummy state
        setConfig((prev) => ({ ...prev }))
      }

      mediaQuery.addEventListener('change', handleThemeChange)
      return () => mediaQuery.removeEventListener('change', handleThemeChange)
    }
  }, [config.theme])

  // Listen for theme changes from main process (IPC)
  useEffect(() => {
    const handleThemeChangedIPC = (event, data) => {
      console.log('Settings screen received theme change from IPC:', data.theme)
      console.log('Current pending theme:', pendingThemeRef.current)

      // Set the flag to indicate that this is coming from IPC
      isReceivingIPCThemeRef.current = true

      // Update config state WITHOUT triggering any saves or debounced operations
      // This is just to keep the UI in sync - the config was already saved by the originating window
      setConfig((prev) => ({ ...prev, theme: data.theme }))

      // Only clear pending debounced saves if they match the incoming theme
      // This prevents newer theme selections from being cancelled by older IPC messages
      if (saveTimeoutRef.current && pendingThemeRef.current === data.theme) {
        console.log('Clearing matching pending save for theme:', data.theme)
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
        pendingThemeRef.current = null
      } else if (pendingThemeRef.current && pendingThemeRef.current !== data.theme) {
        console.log(
          'Keeping pending save for newer theme:',
          pendingThemeRef.current,
          'vs IPC:',
          data.theme
        )
      }

      // Reset the unsaved changes flag since this change came from another window that already saved
      hasUnsavedChangesRef.current = false

      // Reset the IPC flag after a short delay to allow state update to complete
      setTimeout(() => {
        isReceivingIPCThemeRef.current = false
      }, 100)
    }

    // Listen for IPC theme changes
    if (window.api?.onThemeChanged) {
      window.api.onThemeChanged(handleThemeChangedIPC)
    }

    return () => {
      // Remove IPC listener
      if (window.api?.removeThemeChangedListener) {
        window.api.removeThemeChangedListener(handleThemeChangedIPC)
      }
    }
  }, [])

  // Get save status text
  const getSaveStatusText = () => {
    if (isSaving) {
      return '💾 Saving...'
    } else if (hasUnsavedChangesRef.current) {
      return '⏱️ Auto-save in 2s...'
    } else if (lastSaved) {
      const now = new Date()
      const diff = Math.floor((now - lastSaved) / 1000)
      if (diff < 5) {
        return `✅ Saved`
      } else if (diff < 60) {
        return `✅ Saved ${diff}s ago`
      } else {
        return `✅ Saved ${Math.floor(diff / 60)}m ago`
      }
    }
    return ''
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
    <div className={`settings-container ${getThemeClasses()}`}>
      <div className="settings-header">
        <h1>👁️ Eye Doro Settings</h1>
        <p>Protect your eyes with regular breaks</p>
        {getSaveStatusText() && <div className="save-status">{getSaveStatusText()}</div>}
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
              Notify before break starts ({config.notificationTiming}s warning)
            </label>
          </div>

          {config.notifyBeforeBreak && (
            <div className="setting-item">
              <label htmlFor="notification-timing">
                Notification Timing: {config.notificationTiming} seconds before break
              </label>
              <input
                id="notification-timing"
                type="range"
                min="5"
                max="60"
                value={config.notificationTiming}
                onChange={(e) => handleInputChange('notificationTiming', parseInt(e.target.value))}
                className="slider"
              />
              <div className="range-labels">
                <span>5 sec</span>
                <span>60 sec</span>
              </div>
            </div>
          )}

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

          <div className="setting-item">
            <label htmlFor="theme-select">Theme</label>
            <div className="theme-selector-wrapper">
              <select
                id="theme-select"
                value={config.theme}
                onChange={(e) => handleInputChange('theme', e.target.value)}
                className="theme-selector"
              >
                <option value="light">🌅 Light</option>
                <option value="dark">🌙 Dark</option>
                <option value="auto">🔄 Auto (System)</option>
                <option value="ocean">🌊 Ocean Blue</option>
                <option value="forest">🌲 Forest Green</option>
                <option value="sunset">🌇 Sunset Orange</option>
                <option value="midnight">🌃 Midnight Purple</option>
              </select>
            </div>
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

SettingsScreen.propTypes = {
  onThemeChange: PropTypes.func
}

export default SettingsScreen
