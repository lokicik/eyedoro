import { useState, useEffect } from 'react'
import SettingsScreen from './components/SettingsScreen'
import BreakScreen from './components/BreakScreen'
import './App.css'

function App() {
  const [currentRoute, setCurrentRoute] = useState('')

  useEffect(() => {
    // Check if we're on the break screen route
    const hash = window.location.hash
    setCurrentRoute(hash)

    // Listen for hash changes
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Render break screen if hash is #break
  if (currentRoute === '#break') {
    return <BreakScreen />
  }

  // Default to settings screen
  return <SettingsScreen />
}

export default App
