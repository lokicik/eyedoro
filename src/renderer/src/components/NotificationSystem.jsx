import { useState, useEffect } from 'react'
import NotificationPopup from './NotificationPopup'
import { soundService } from '../utils/soundService'

const NotificationSystem = () => {
  const [notificationState, setNotificationState] = useState({
    showPopup: false,
    countdown: 0
  })

  useEffect(() => {
    // Listen for notifications from the main process
    const handleNotification = (event, data) => {
      console.log('Received notification in main window:', data)

      switch (data.type) {
        case 'pre-break-warning':
          handlePreBreakWarning(data.countdown)
          break
        case 'break-starting':
          handleBreakStarting()
          break
        case 'break-complete':
          handleBreakComplete()
          break
        case 'hide-notifications':
          hideAllNotifications()
          break
        default:
          console.warn('Unknown notification type:', data.type)
          break
      }
    }

    // Use the correct event listener for main window notifications
    window.electronAPI?.onNotification?.(handleNotification)

    return () => {
      window.electronAPI?.removeNotificationListener?.(handleNotification)
    }
  }, [])

  const handlePreBreakWarning = (countdown) => {
    try {
      soundService.playNotificationSound()
      setNotificationState({
        showPopup: true,
        countdown
      })
    } catch (error) {
      console.error('Error playing notification sound:', error)
      // Still show notification even if sound fails
      setNotificationState({
        showPopup: true,
        countdown
      })
    }
  }

  const handleBreakStarting = () => {
    try {
      soundService.playWarningSound()
    } catch (error) {
      console.error('Error playing warning sound:', error)
    }
    hideAllNotifications()
  }

  const handleBreakComplete = () => {
    try {
      soundService.playSuccessSound()
    } catch (error) {
      console.error('Error playing success sound:', error)
    }
    hideAllNotifications()
  }

  const hideAllNotifications = () => {
    setNotificationState({
      showPopup: false,
      countdown: 0
    })
  }

  const handleStartNow = async () => {
    try {
      await window.electronAPI?.startBreakNow?.()
      hideAllNotifications()
    } catch (error) {
      console.error('Error starting break:', error)
    }
  }

  const handleAddTime = async (seconds) => {
    try {
      await window.electronAPI?.addTime?.(seconds)
      hideAllNotifications()
    } catch (error) {
      console.error('Error adding time:', error)
    }
  }

  const handleSkip = async () => {
    try {
      await window.electronAPI?.skipBreak?.()
      hideAllNotifications()
    } catch (error) {
      console.error('Error skipping break:', error)
    }
  }

  return (
    <NotificationPopup
      isVisible={notificationState.showPopup}
      countdown={notificationState.countdown}
      onStartNow={handleStartNow}
      onAddTime={handleAddTime}
      onSkip={handleSkip}
      onClose={hideAllNotifications}
    />
  )
}

export default NotificationSystem
