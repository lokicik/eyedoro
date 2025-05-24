import { useState, useEffect } from 'react'
import SettingsScreen from './components/SettingsScreen'
import BreakScreen from './components/BreakScreen'
import NotificationSystem from './components/NotificationSystem'
import NotificationPopup from './components/NotificationPopup'
import { soundService } from './utils/soundService'
import './App.css'

function App() {
  const [currentRoute, setCurrentRoute] = useState('')
  const [notificationData, setNotificationData] = useState(null)

  useEffect(() => {
    // Check if we're on the break screen route
    const hash = window.location.hash
    console.log('App initial hash:', hash)
    setCurrentRoute(hash)

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash
      console.log('App hash changed to:', newHash)
      setCurrentRoute(newHash)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    // Listen for notification data from main process
    const handleNotificationData = (event, data) => {
      console.log('Received notification data:', data)
      setNotificationData(data)

      // Play sound for notifications
      if (data.type === 'pre-break-warning') {
        soundService.playNotificationSound()
      }
    }

    // Set up IPC listeners
    window.electronAPI?.onNotificationData?.(handleNotificationData)

    return () => {
      window.electronAPI?.removeNotificationDataListener?.(handleNotificationData)
    }
  }, [])

  console.log('App rendering with route:', currentRoute)

  // Handle different routes
  if (currentRoute === '#break') {
    console.log('Rendering BreakScreen')
    return <BreakScreen />
  }

  if (currentRoute === '#notification-popup') {
    console.log('Rendering independent NotificationPopup')
    return (
      <div className="notification-popup-container">
        <NotificationPopup
          isVisible={!!notificationData}
          countdown={notificationData?.countdown || 0}
          position={{ x: 0, y: 0 }} // Position handled by window itself
          onStartNow={() => {
            window.electronAPI?.startBreakNow?.()
            window.electronAPI?.closeNotifications?.()
          }}
          onAddTime={(seconds) => {
            window.electronAPI?.addTime?.(seconds)
            window.electronAPI?.closeNotifications?.()
          }}
          onSkip={() => {
            window.electronAPI?.skipBreak?.()
            window.electronAPI?.closeNotifications?.()
          }}
          onClose={() => {
            window.electronAPI?.closeNotificationPopup?.()
          }}
        />
      </div>
    )
  }

  // Default route - settings screen with notification system
  console.log('Rendering SettingsScreen with NotificationSystem')
  return (
    <>
      {/* Only render notification system in main window */}
      <NotificationSystem />
      <SettingsScreen />
    </>
  )
}

export default App
