import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import './NotificationPopup.css'

const NotificationPopup = ({
  isVisible,
  countdown,
  onStartNow,
  onAddTime,
  onSkip,
  onClose,
  position = { x: 0, y: 0 }
}) => {
  const [timeLeft, setTimeLeft] = useState(countdown)

  useEffect(() => {
    setTimeLeft(countdown)
  }, [countdown])

  useEffect(() => {
    if (!isVisible) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1
        if (newTime <= 0) {
          onStartNow?.()
          return 0
        }
        return newTime
      })
    }, 1000)

    // Sync with actual remaining time every 5 seconds to prevent drift
    const syncTimer = setInterval(async () => {
      if (window.electronAPI?.getWorkTimeRemaining) {
        try {
          const actualRemaining = await window.electronAPI.getWorkTimeRemaining()
          const actualSeconds = Math.max(0, Math.ceil(actualRemaining / 1000))

          // Only update if there's a significant difference (more than 2 seconds)
          setTimeLeft((currentTime) => {
            if (Math.abs(currentTime - actualSeconds) > 2) {
              console.log('Syncing notification countdown:', currentTime, '->', actualSeconds)
              return actualSeconds
            }
            return currentTime
          })
        } catch (error) {
          console.warn('Failed to sync with actual time:', error)
        }
      }
    }, 5000) // Sync every 5 seconds

    return () => {
      clearInterval(timer)
      clearInterval(syncTimer)
    }
  }, [isVisible, onStartNow])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isVisible) return null

  return (
    <div className="notification-popup">
      <div className="notification-content">
        <div className="notification-header">
          <div className="notification-icon">👁️</div>
          <div className="notification-text">
            <h3>Almost time - {formatTime(timeLeft)}</h3>
            <p>Take a break and rest your eyes</p>
          </div>
          <button className="close-button" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="notification-actions">
          <button className="btn btn-primary" onClick={onStartNow}>
            Start this break now
          </button>
          <button className="btn btn-secondary" onClick={() => onAddTime(60)}>
            + 1 min
          </button>
          <button className="btn btn-secondary" onClick={() => onAddTime(300)}>
            + 5 min
          </button>
          <button className="btn btn-outline" onClick={onSkip}>
            Skip break
          </button>
        </div>
      </div>
    </div>
  )
}

NotificationPopup.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  countdown: PropTypes.number.isRequired,
  onStartNow: PropTypes.func.isRequired,
  onAddTime: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number
  })
}

export default NotificationPopup
