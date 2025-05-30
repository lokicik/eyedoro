import { useState, useEffect, useRef } from 'react'
import './MinimalBreakScreen.css'

function MinimalBreakScreen() {
  const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes default
  const [currentTime, setCurrentTime] = useState('')
  const [theme, setTheme] = useState('light')
  const timerRef = useRef(null)
  const clockRef = useRef(null)
  const [escapeCount, setEscapeCount] = useState(0)
  const escapeTimeoutRef = useRef(null)

  // Format time for display (MM:SS)
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Format current time for display (HH:MM)
  const formatCurrentTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Update current time
  const updateCurrentTime = () => {
    setCurrentTime(formatCurrentTime(new Date()))
  }

  // Handle skip button click
  const handleSkip = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (clockRef.current) {
        clearInterval(clockRef.current)
        clockRef.current = null
      }

      const result = await window.api.endBreakEarly()
      console.log('End break early result:', result)
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

  // Handle lock screen button click
  const handleLockScreen = async () => {
    try {
      if (window.api.lockScreen) {
        await window.api.lockScreen()
      }
    } catch (error) {
      console.error('Error locking screen:', error)
    }
  }

  // Handle keyboard events (double ESC to skip)
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setEscapeCount((prev) => prev + 1)

      if (escapeTimeoutRef.current) {
        clearTimeout(escapeTimeoutRef.current)
      }

      if (escapeCount === 0) {
        // First ESC press - start timeout
        escapeTimeoutRef.current = setTimeout(() => {
          setEscapeCount(0)
        }, 1000) // Reset after 1 second
      } else if (escapeCount === 1) {
        // Second ESC press within 1 second - skip break
        setEscapeCount(0)
        if (escapeTimeoutRef.current) {
          clearTimeout(escapeTimeoutRef.current)
        }
        handleSkip()
      }
    }
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

  useEffect(() => {
    // Get initial break duration and theme
    const initializeBreakTime = async () => {
      try {
        const time = await window.api.getBreakTimeRemaining()
        const config = await window.api.getConfig()

        setTimeRemaining(Math.floor(time / 1000))

        // Get theme setting
        const initialTheme = config.theme || (config.darkMode ? 'dark' : 'light')
        setTheme(initialTheme)
      } catch (error) {
        console.error('Error getting break time or config:', error)
      }
    }

    initializeBreakTime()
    updateCurrentTime()

    // Listen for theme changes from IPC
    const handleThemeChangedIPC = (event, data) => {
      console.log('Minimal break screen received theme change from IPC:', data.theme)
      setTheme(data.theme)
    }

    // Listen for IPC theme changes
    if (window.api?.onThemeChanged) {
      window.api.onThemeChanged(handleThemeChangedIPC)
    }

    // Start countdown timer
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          // Auto-close when time is up
          handleSkip()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Start clock timer
    clockRef.current = setInterval(updateCurrentTime, 1000)

    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (clockRef.current) {
        clearInterval(clockRef.current)
      }
      if (escapeTimeoutRef.current) {
        clearTimeout(escapeTimeoutRef.current)
      }
      window.removeEventListener('keydown', handleKeyDown)

      // Remove IPC listener
      if (window.api?.removeThemeChangedListener) {
        window.api.removeThemeChangedListener(handleThemeChangedIPC)
      }
    }
  }, [escapeCount])

  return (
    <div className={`minimal-break-screen ${getThemeClasses()}`}>
      <div className="minimal-break-content">
        <div className="current-time">Current time is {currentTime}</div>

        <h1 className="break-title">Relax those eyes</h1>

        <p className="break-subtitle">
          Set your eyes on something distant until the countdown is over
        </p>

        <div className="countdown-timer">{formatTime(timeRemaining)}</div>

        <div className="break-actions">
          <button className="action-button skip-button" onClick={handleSkip}>
            <span className="button-icon">⏭</span>
            Skip
          </button>
          <button className="action-button lock-button" onClick={handleLockScreen}>
            <span className="button-icon">🔒</span>
            Lock Screen
          </button>
        </div>

        <div className="esc-hint">Press Esc twice to skip</div>
      </div>
    </div>
  )
}

export default MinimalBreakScreen
