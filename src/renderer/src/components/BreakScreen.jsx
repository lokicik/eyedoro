import { useState, useEffect, useRef } from 'react'
import './BreakScreen.css'
import SettingsScreen from './SettingsScreen'

function BreakScreen() {
  const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes default
  const [totalBreakTime, setTotalBreakTime] = useState(300) // Track total break duration
  const [currentTip, setCurrentTip] = useState(0)
  const [theme, setTheme] = useState('light') // Changed from isDarkMode to theme
  const [showSettings, setShowSettings] = useState(false)
  const timerRef = useRef(null)
  const tipTimerRef = useRef(null)

  const eyeHealthTips = [
    {
      title: '20-20-20 Rule',
      description: 'Every 20 minutes, look at something 20 feet away for at least 20 seconds.',
      icon: '👁️'
    },
    {
      title: 'Blink Frequently',
      description: 'Blinking helps moisten your eyes and reduce dryness from screen time.',
      icon: '😌'
    },
    {
      title: 'Adjust Your Display',
      description: 'Keep your screen 20-24 inches away and slightly below eye level.',
      icon: '🖥️'
    },
    {
      title: 'Use Proper Lighting',
      description: 'Avoid glare and ensure your room is well-lit to reduce eye strain.',
      icon: '💡'
    },
    {
      title: 'Stay Hydrated',
      description: 'Drink plenty of water to keep your eyes and body hydrated.',
      icon: '💧'
    },
    {
      title: 'Take Regular Breaks',
      description: 'Give your eyes a rest by looking away from screens periodically.',
      icon: '⏰'
    }
  ]

  const handleEndBreakEarly = async () => {
    console.log('=== END BREAK EARLY BUTTON CLICKED ===')

    // Clear our specific timers
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (tipTimerRef.current) {
      clearInterval(tipTimerRef.current)
      tipTimerRef.current = null
    }

    try {
      const result = await window.api.endBreakEarly()
      console.log('End break early result:', result)
      // If normal end break didn't work, try force close
      if (!result) {
        console.log('Normal end break failed, trying force close...')
        try {
          const forceResult = await window.api.forceCloseBreakWindows()
          console.log('Force close result:', forceResult)
        } catch (error) {
          console.error('Error force closing break windows:', error)
        }
      }
    } catch (error) {
      console.error('Error ending break early:', error)
    }
  }

  const handleTipNavigation = (tipIndex) => {
    setCurrentTip(tipIndex)
  }

  const handleToggleSettings = () => {
    setShowSettings(!showSettings)
  }

  // Helper function to determine the actual theme to use
  const getEffectiveTheme = () => {
    if (theme === 'auto') {
      // Auto mode: use system preference or default to light
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme
  }

  // Helper function to get theme classes
  const getThemeClasses = () => {
    const effectiveTheme = getEffectiveTheme()

    // For dark-based themes, always include 'dark-mode' class (BreakScreen uses 'dark-mode' instead of 'dark')
    const darkThemes = ['dark', 'ocean', 'forest', 'sunset', 'midnight']
    const isDarkBased = darkThemes.includes(effectiveTheme)

    let classes = ''
    if (isDarkBased) {
      classes += 'dark-mode '
    }

    // Add specific theme class if it's not the basic light/dark
    if (!['light', 'dark'].includes(effectiveTheme)) {
      classes += `theme-${effectiveTheme}`
    }

    return classes.trim()
  }

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme === 'auto' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleThemeChange = () => {
        // Force a re-render by updating a dummy state
        setTheme((prev) => (prev === 'auto' ? 'auto' : prev))
      }

      mediaQuery.addEventListener('change', handleThemeChange)
      return () => mediaQuery.removeEventListener('change', handleThemeChange)
    }
  }, [theme])

  // Listen for immediate theme changes from settings screen
  useEffect(() => {
    const handleThemeChangeEvent = (event) => {
      console.log('Break screen received theme change:', event.detail.theme)
      setTheme(event.detail.theme)
    }

    // Listen for custom theme change events
    window.addEventListener('themeChange', handleThemeChangeEvent)

    return () => {
      window.removeEventListener('themeChange', handleThemeChangeEvent)
    }
  }, [])

  useEffect(() => {
    // Get initial break duration and theme setting from config
    const initializeBreakTime = async () => {
      try {
        const time = await window.api.getBreakTimeRemaining()
        const config = await window.api.getConfig()

        setTimeRemaining(Math.floor(time / 1000))
        // Set total break time from config (convert from milliseconds to seconds)
        setTotalBreakTime(Math.floor(config.breakDuration / 1000))

        // Get theme setting
        setTheme(config.theme || (config.darkMode ? 'dark' : 'light')) // Handle migration from old darkMode
      } catch (error) {
        console.error('Error getting break time or config:', error)
      }
    }

    initializeBreakTime()

    // Start countdown timer
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Change tip every 30 seconds
    tipTimerRef.current = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % eyeHealthTips.length)
    }, 30000)

    // Handle ESC key to end break early
    const handleKeyDown = (event) => {
      console.log('Key pressed in break screen:', event.key)
      if (event.key === 'Escape') {
        console.log('ESC key detected - attempting to end break')
        handleEndBreakEarly()
      } else if (event.key === 'ArrowRight') {
        // Navigate to next tip
        setCurrentTip((prev) => (prev + 1) % eyeHealthTips.length)
      } else if (event.key === 'ArrowLeft') {
        // Navigate to previous tip
        setCurrentTip((prev) => (prev - 1 + eyeHealthTips.length) % eyeHealthTips.length)
      } else if (event.key.toLowerCase() === 's') {
        // Toggle settings
        handleToggleSettings()
      } else if (event.key.toLowerCase() === 'b' && showSettings) {
        // Go back to break screen from settings
        setShowSettings(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearInterval(timerRef.current)
      clearInterval(tipTimerRef.current)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, []) // Simplified - no more complex dependencies

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const progressPercentage = ((totalBreakTime - timeRemaining) / totalBreakTime) * 100

  return (
    <div className={`break-screen ${getThemeClasses()}`}>
      <div className="break-overlay">
        {showSettings ? (
          <div className="break-settings-container">
            <div className="break-settings-header">
              <button className="back-to-break-button" onClick={() => setShowSettings(false)}>
                ← Back to Break
              </button>
            </div>
            <div className="settings-wrapper">
              <SettingsScreen />
            </div>
          </div>
        ) : (
          <div className="break-content">
            <div className="break-header">
              <h1>👁️ Time for an Eye Break!</h1>
              <p>Give your eyes some rest</p>
            </div>

            <div className="timer-section">
              <div className="timer-circle">
                <svg className="timer-svg" width="200" height="200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="#e0e0e0" strokeWidth="8" />
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="#4CAF50"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 90}`}
                    strokeDashoffset={`${2 * Math.PI * 90 * (1 - progressPercentage / 100)}`}
                    transform="rotate(-90 100 100)"
                    className="timer-progress"
                  />
                </svg>
                <div className="timer-text">
                  <div className="time-remaining">{formatTime(timeRemaining)}</div>
                  <div className="time-label">remaining</div>
                </div>
              </div>
            </div>

            <div className="tip-section">
              <div className="tip-card">
                <div className="tip-icon">{eyeHealthTips[currentTip].icon}</div>
                <h3 className="tip-title">{eyeHealthTips[currentTip].title}</h3>
                <p className="tip-description">{eyeHealthTips[currentTip].description}</p>
              </div>
              <div className="tip-indicator">
                {eyeHealthTips.map((_, index) => (
                  <div
                    key={index}
                    className={`tip-dot ${index === currentTip ? 'active' : ''}`}
                    onClick={() => handleTipNavigation(index)}
                  />
                ))}
              </div>
            </div>

            <div className="break-actions">
              <div className="exercise-suggestions">
                <h4>Quick Eye Exercises:</h4>
                <ul>
                  <li>🔄 Roll your eyes slowly in circles</li>
                  <li>👀 Focus on a distant object outside</li>
                  <li>😌 Close your eyes and relax for 30 seconds</li>
                  <li>👁️ Blink 20 times slowly</li>
                </ul>
              </div>

              {/* End Break Early Button */}
              <div className="break-controls">
                <button className="end-break-button" onClick={handleEndBreakEarly}>
                  🏃 End Break Early
                </button>
                <button className="settings-button" onClick={handleToggleSettings}>
                  ⚙️ Settings
                </button>
              </div>
            </div>

            <div className="break-footer">
              <p className="emergency-text">
                Press <kbd>ESC</kbd> or <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Shift</kbd> +{' '}
                <kbd>E</kbd> to exit • Use <kbd>←</kbd> <kbd>→</kbd> arrows or click dots to
                navigate tips • Press <kbd>S</kbd> for settings
              </p>
              <div className="break-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPercentage}%` }} />
                </div>
                <span className="progress-text">{Math.round(progressPercentage)}% complete</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BreakScreen
