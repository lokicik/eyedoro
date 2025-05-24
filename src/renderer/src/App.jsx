import { useState, useEffect } from 'react'
import SettingsScreen from './components/SettingsScreen'
import BreakScreen from './components/BreakScreen'
import './App.css'

function App() {
  const [currentRoute, setCurrentRoute] = useState('')

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

  console.log('App rendering with route:', currentRoute)

  // Render break screen if hash is #break
  if (currentRoute === '#break') {
    console.log('Rendering BreakScreen')
    return <BreakScreen />
  }

  // Default to settings screen
  console.log('Rendering SettingsScreen')
  return <SettingsScreen />
}

export default App
