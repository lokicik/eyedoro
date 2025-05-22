import { useState, useEffect } from 'react'
import './BreakScreen.css'

function BreakScreen() {
  const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes default
  const [currentTip, setCurrentTip] = useState(0)

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

  useEffect(() => {
    // Get initial break duration from config
    const initializeBreakTime = async () => {
      try {
        const time = await window.api.getBreakTimeRemaining()
        setTimeRemaining(Math.floor(time / 1000))
      } catch (error) {
        console.error('Error getting break time:', error)
      }
    }

    initializeBreakTime()

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Change tip every 30 seconds
    const tipTimer = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % eyeHealthTips.length)
    }, 30000)

    // Handle ESC key to end break early
    const handleKeyDown = (event) => {
      console.log('Key pressed in break screen:', event.key)
      if (event.key === 'Escape') {
        console.log('ESC key detected - attempting to end break')
        handleEndBreakEarly()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearInterval(timer)
      clearInterval(tipTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const progressPercentage = ((300 - timeRemaining) / 300) * 100

  return (
    <div className="break-screen">
      <div className="break-overlay">
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
                <div key={index} className={`tip-dot ${index === currentTip ? 'active' : ''}`} />
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
            </div>
          </div>

          <div className="break-footer">
            <p className="emergency-text">
              Press <kbd>ESC</kbd> or <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Shift</kbd> +{' '}
              <kbd>E</kbd> to exit
            </p>
            <div className="break-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercentage}%` }} />
              </div>
              <span className="progress-text">{Math.round(progressPercentage)}% complete</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BreakScreen
