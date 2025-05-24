import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  screen,
  globalShortcut,
  Notification
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import path from 'path'

let mainWindow = null
let breakWindows = [] // Array to store all break windows for multiple displays
let notificationWindow = null // Independent notification popup window
let tray = null
let workTimer = null
let breakTimer = null
let isBreakActive = false
let isPaused = false
let breakStartTime = null
let workStartTime = null
let notificationTimer = null

// Default configuration
const defaultConfig = {
  workDuration: 20 * 60 * 1000, // 20 minutes in milliseconds
  breakDuration: 5 * 60 * 1000, // 5 minutes in milliseconds
  notifyBeforeBreak: true,
  soundEnabled: true,
  theme: 'light', // Replaced darkMode with theme: 'light', 'dark', 'auto'
  autoStart: false
}

let config = { ...defaultConfig }

// Config file path
const configPath = join(app.getPath('userData'), 'config.json')

// Load configuration
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8')
      const loadedConfig = JSON.parse(data)

      // Migration: convert old darkMode to new theme system
      if (loadedConfig.darkMode !== undefined && loadedConfig.theme === undefined) {
        loadedConfig.theme = loadedConfig.darkMode ? 'dark' : 'light'
        delete loadedConfig.darkMode
        console.log('Migrated darkMode to theme system:', loadedConfig.theme)
      }

      config = { ...defaultConfig, ...loadedConfig }

      // Save the migrated config
      if (loadedConfig.darkMode !== undefined) {
        saveConfig()
      }
    }
  } catch (error) {
    console.error('Error loading config:', error)
    config = { ...defaultConfig }
  }
}

// Save configuration
function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Error saving config:', error)
  }
}

// Show notification
function showNotification(title, body, icon = null) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: icon || join(__dirname, '../../resources/icon.png'),
      silent: !config.soundEnabled
    })

    notification.show()
    return notification
  }
}

// Update tray tooltip with current status
function updateTrayTooltip() {
  if (!tray) return

  let tooltip = 'Eye Doro - Protecting your eyes'

  if (isPaused) {
    tooltip += '\n⏸️ Paused'
  } else if (isBreakActive) {
    const remaining = getBreakTimeRemaining()
    const minutes = Math.floor(remaining / (60 * 1000))
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000)
    tooltip += `\n💤 Break: ${minutes}:${seconds.toString().padStart(2, '0')} remaining`
  } else if (workStartTime) {
    const elapsed = Date.now() - workStartTime
    const remaining = Math.max(0, config.workDuration - elapsed)
    const minutes = Math.floor(remaining / (60 * 1000))
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000)
    tooltip += `\n💻 Work: ${minutes}:${seconds.toString().padStart(2, '0')} remaining`
  }

  tray.setToolTip(tooltip)
}

// Helper function to show settings window reliably
async function showSettingsWindow() {
  // Don't allow settings window to open during breaks
  if (isBreakActive) {
    console.log('Settings window blocked - break is active')
    return false
  }

  try {
    console.log('=== SHOW SETTINGS WINDOW CALLED ===')
    console.log('mainWindow exists:', !!mainWindow)
    console.log('mainWindow destroyed:', mainWindow ? mainWindow.isDestroyed() : 'N/A')

    // Ensure main window exists and is not destroyed
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log('Creating new main window...')
      createWindow()

      // Wait for window to be ready
      await new Promise((resolve) => {
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', resolve)
        } else {
          resolve()
        }
      })
      console.log('New window created and loaded')
    }

    // For Windows, use a more reliable method
    if (process.platform === 'win32') {
      // First make sure window is not minimized
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }

      // Show the window
      mainWindow.show()

      // Set focus multiple ways for Windows reliability
      mainWindow.focus()
      mainWindow.moveTop()

      // Brief flash to ensure visibility
      setTimeout(() => {
        mainWindow.flashFrame(true)
        setTimeout(() => mainWindow.flashFrame(false), 100)
      }, 50)
    } else if (process.platform === 'darwin') {
      // macOS specific
      app.focus()
      mainWindow.show()
      mainWindow.focus()
    } else {
      // Linux and others
      mainWindow.show()
      mainWindow.focus()
      mainWindow.setAlwaysOnTop(true)
      mainWindow.setAlwaysOnTop(false)
    }

    console.log('Settings window should now be visible')
    return true
  } catch (error) {
    console.error('Error in showSettingsWindow:', error)

    // Last resort: recreate everything
    try {
      console.log('Attempting emergency window recreation...')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.destroy()
      }
      createWindow()

      // Wait a bit then try to show
      setTimeout(() => {
        mainWindow.show()
        mainWindow.focus()
      }, 500)

      return true
    } catch (retryError) {
      console.error('Emergency window recreation failed:', retryError)
      return false
    }
  }
}

function createWindow() {
  // Get primary display for centering
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const windowWidth = 900
  const windowHeight = 650

  // Create the main settings window
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    closable: true,
    title: 'Eye Doro Settings',
    webSecurity: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    ...(process.platform === 'win32'
      ? {
          skipTaskbar: false,
          alwaysOnTop: false
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  // Ensure window shows in taskbar on Windows
  if (process.platform === 'win32') {
    mainWindow.setSkipTaskbar(false)
  }

  mainWindow.on('ready-to-show', () => {
    console.log('Main window ready to show')
    // Still don't auto-show on startup
  })

  mainWindow.on('close', (event) => {
    console.log('Main window close event')
    event.preventDefault()
    mainWindow.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Add error handling for loading
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Window failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window finished loading')
  })

  // Load the remote URL for development or the local html file for production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createBreakWindow() {
  const displays = screen.getAllDisplays()
  console.log('=== CREATING BREAK WINDOWS ===')
  console.log('Number of displays:', displays.length)

  // Clear any existing break windows
  breakWindows.forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.close()
    }
  })
  breakWindows = []

  // Create break window for each display
  displays.forEach((display, index) => {
    console.log(`Creating break window ${index} for display:`, {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    })

    const breakWin = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      fullscreen: true,
      alwaysOnTop: true,
      closable: false,
      minimizable: false,
      maximizable: false,
      resizable: false,
      skipTaskbar: true,
      frame: false,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // Add event listeners for debugging
    breakWin.webContents.on('did-finish-load', () => {
      console.log(`Break window ${index} finished loading`)
    })

    breakWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`Break window ${index} failed to load:`, errorCode, errorDescription)
    })

    // Load break screen
    const breakUrl =
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? process.env['ELECTRON_RENDERER_URL'] + '#break'
        : join(__dirname, '../renderer/index.html') + '#break'

    console.log(`Loading break URL for window ${index}:`, breakUrl)

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      breakWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#break')
    } else {
      breakWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'break' })
    }

    // Store all break windows
    breakWindows.push(breakWin)
  })

  console.log(`Created ${breakWindows.length} break windows`)
}

function createTray() {
  tray = new Tray(icon)

  // Use the dynamic menu function
  updateTrayMenu()
  updateTrayTooltip()

  tray.on('double-click', async () => {
    console.log('Tray double-clicked')
    await showSettingsWindow()
  })
}

// Create independent notification popup window
function createNotificationWindow() {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    return notificationWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  notificationWindow = new BrowserWindow({
    width: 400,
    height: 300,
    x: screenWidth - 420, // Position on right side with 20px margin
    y: 50, // 50px from top
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true, // Allow moving the notification
    minimizable: false,
    maximizable: false,
    closable: false,
    transparent: true,
    hasShadow: true, // Add shadow for better visibility
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Load notification popup page
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    notificationWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#notification-popup')
  } else {
    notificationWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'notification-popup'
    })
  }

  notificationWindow.on('closed', () => {
    notificationWindow = null
  })

  return notificationWindow
}

// Show notification popup with data
function showNotificationPopup(data) {
  console.log('Showing independent notification popup:', data)

  try {
    const popup = createNotificationWindow()

    const handleLoadComplete = () => {
      try {
        // Send notification data to the popup window
        popup.webContents.send('notification-data', data)
        popup.show()
        popup.focus()
      } catch (error) {
        console.error('Error sending data to notification popup:', error)
      }
    }

    popup.webContents.once('did-finish-load', handleLoadComplete)

    if (!popup.webContents.isLoading()) {
      handleLoadComplete()
    }
  } catch (error) {
    console.error('Error showing notification popup:', error)
    // Fallback to system notification
    showNotification('👁️ Eye Break Time!', 'Time for a break to rest your eyes.')
  }
}

// Hide all notification windows
function hideNotificationWindows() {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.hide()
  }
}

function startWorkTimer() {
  if (isPaused || isBreakActive) return

  // Clear any existing timers
  clearTimeout(workTimer)
  clearTimeout(notificationTimer)

  workStartTime = Date.now()
  console.log(
    '=== WORK TIMER STARTED ===',
    '\nTime:',
    new Date(workStartTime).toLocaleTimeString(),
    '\nDuration (ms):',
    config.workDuration,
    '\nDuration (min):',
    config.workDuration / (60 * 1000),
    '\nTarget end time:',
    new Date(workStartTime + config.workDuration).toLocaleTimeString()
  )

  // Update tooltip every second
  const tooltipUpdateInterval = setInterval(() => {
    if (isPaused || isBreakActive || !workStartTime) {
      clearInterval(tooltipUpdateInterval)
      return
    }
    updateTrayTooltip()
  }, 1000)

  // Set up pre-break notification with enhanced countdown (60 seconds before)
  if (config.notifyBeforeBreak && config.workDuration > 60000) {
    notificationTimer = setTimeout(() => {
      if (!isPaused && !isBreakActive) {
        // Calculate actual remaining time instead of hardcoded 60 seconds
        const actualRemainingTime = getWorkTimeRemaining()
        const countdownSeconds = Math.max(1, Math.ceil(actualRemainingTime / 1000))

        console.log('Showing pre-break warning with actual countdown:', countdownSeconds, 'seconds')

        // Send enhanced notification to renderer
        sendNotificationToRenderer({
          type: 'pre-break-warning',
          countdown: countdownSeconds,
          workDuration: config.workDuration,
          breakDuration: config.breakDuration
        })
      }
    }, config.workDuration - 60000) // 1 minute before
  }

  workTimer = setTimeout(() => {
    clearInterval(tooltipUpdateInterval)
    if (!isPaused) {
      console.log('Work timer completed, starting break')

      // Notify renderer that break is starting
      sendNotificationToRenderer({
        type: 'break-starting'
      })

      startBreak()
    }
  }, config.workDuration)
}

function startBreak() {
  if (isBreakActive || isPaused) return

  isBreakActive = true
  breakStartTime = Date.now()
  workStartTime = null

  // Hide settings window if it's open
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    console.log('Hiding settings window for break')
    mainWindow.hide()
  }

  // Show break notification
  showNotification(
    '👁️ Eye Break Time!',
    `Time for a ${Math.round(config.breakDuration / (60 * 1000))} minute break to rest your eyes.`
  )

  createBreakWindow()

  // Show all break windows
  breakWindows.forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.show()
      window.focus()
      window.setAlwaysOnTop(true, 'screen-saver')
    }
  })

  // Block all global shortcuts during break
  globalShortcut.unregisterAll()

  // Update tray tooltip every second during break
  const breakTooltipInterval = setInterval(() => {
    if (!isBreakActive) {
      clearInterval(breakTooltipInterval)
      return
    }
    updateTrayTooltip()
  }, 1000)

  // Update tray menu to show break options
  updateTrayMenu()

  breakTimer = setTimeout(() => {
    clearInterval(breakTooltipInterval)
    endBreak()
  }, config.breakDuration)
}

function endBreak() {
  console.log(
    'endBreak() called. isBreakActive:',
    isBreakActive,
    'breakWindows.length:',
    breakWindows.length
  )

  isBreakActive = false
  breakStartTime = null

  // Clear break timer
  if (breakTimer) {
    clearTimeout(breakTimer)
    breakTimer = null
    console.log('Break timer cleared')
  }

  // More aggressive window closing
  breakWindows.forEach((window, index) => {
    if (window && !window.isDestroyed()) {
      console.log('Attempting to close break window', index)
      try {
        // Try multiple methods to close the window
        window.setAlwaysOnTop(false, 'normal')
        window.setSkipTaskbar(false)
        window.setClosable(true)
        window.setMinimizable(true)
        window.blur()
        window.hide()
        window.destroy()
        console.log('Break window', index, 'destroyed successfully')
      } catch (error) {
        console.error('Error closing break window', index, ':', error)
        // Force destroy even if there's an error
        try {
          window.destroy()
        } catch (e) {
          console.error('Force destroy also failed:', e)
        }
      }
    } else {
      console.log('Break window', index, 'already destroyed or null')
    }
  })
  breakWindows = []

  // Force focus back to main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.focus()
    } catch (error) {
      console.error('Error focusing main window:', error)
    }
  }

  console.log('All break windows processed')

  // Show break end notification
  showNotification('✅ Break Complete!', 'Great job! Back to work with refreshed eyes.')

  // Send break complete notification to renderer
  sendNotificationToRenderer({
    type: 'break-complete'
  })

  // Re-register global shortcuts
  registerGlobalShortcuts()

  // Update tray tooltip and menu
  updateTrayTooltip()
  updateTrayMenu()

  // Start next work cycle
  console.log(
    'Starting next work cycle with updated config:',
    config.workDuration / (60 * 1000),
    'minutes'
  )

  // Safety check: prevent invalid work durations
  if (config.workDuration < 60000) {
    // Less than 1 minute
    console.error('ERROR: Invalid work duration detected:', config.workDuration, 'ms')
    console.log('Reloading config to fix corrupted settings...')
    loadConfig()
    console.log('Config reloaded. New work duration:', config.workDuration / (60 * 1000), 'minutes')

    // If still invalid after reload, use default
    if (config.workDuration < 60000) {
      console.log('Config still invalid, using default work duration')
      config.workDuration = defaultConfig.workDuration
      saveConfig()
    }
  }

  startWorkTimer()
}

function togglePause() {
  isPaused = !isPaused

  if (isPaused) {
    clearTimeout(workTimer)
    clearTimeout(breakTimer)
    clearTimeout(notificationTimer)
    workStartTime = null
    if (isBreakActive) {
      endBreak()
    }
    showNotification('⏸️ Eye Doro Paused', 'Break reminders are temporarily disabled.')
  } else {
    startWorkTimer()
    showNotification('▶️ Eye Doro Resumed', 'Break reminders are now active.')
  }

  updateTrayMenu()
  updateTrayTooltip()
}

function updateTrayMenu() {
  const menuItems = [
    {
      label: 'Eye Doro',
      type: 'normal',
      enabled: false
    },
    {
      type: 'separator'
    }
  ]

  if (isBreakActive) {
    // During break - show end break option only
    menuItems.push({
      label: '🏃 End Break Early',
      type: 'normal',
      click: () => {
        endBreak()
        showNotification('Break Ended', 'You ended your break early. Back to work!')
      }
    })
  } else {
    // During work - show pause/resume and manual break
    menuItems.push({
      label: isPaused ? 'Resume' : 'Pause',
      type: 'normal',
      click: togglePause
    })
    menuItems.push({
      label: 'Take Break Now',
      type: 'normal',
      click: startBreak
    })

    // Settings only available when not in break
    menuItems.push({
      label: 'Settings',
      type: 'normal',
      click: async () => {
        console.log('Settings menu clicked')
        await showSettingsWindow()
      }
    })
  }

  menuItems.push(
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        console.log('=== QUIT BUTTON CLICKED ===')

        // Set quitting flag
        app.isQuiting = true

        // Clear all timers
        if (workTimer) clearTimeout(workTimer)
        if (breakTimer) clearTimeout(breakTimer)
        if (notificationTimer) clearTimeout(notificationTimer)

        // Close break windows
        breakWindows.forEach((window, index) => {
          if (window && !window.isDestroyed()) {
            try {
              console.log('Closing break window', index, 'on quit')
              window.destroy()
            } catch (error) {
              console.error('Error closing break window on quit:', error)
            }
          }
        })
        breakWindows = []

        // Close main window
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            console.log('Closing main window on quit')
            mainWindow.destroy()
          } catch (error) {
            console.error('Error closing main window on quit:', error)
          }
        }

        // Destroy tray
        if (tray) {
          try {
            tray.destroy()
          } catch (error) {
            console.error('Error destroying tray on quit:', error)
          }
        }

        console.log('Quitting application...')
        app.quit()
      }
    }
  )

  const contextMenu = Menu.buildFromTemplate(menuItems)
  tray.setContextMenu(contextMenu)
}

function registerGlobalShortcuts() {
  // Emergency escape shortcut (Ctrl+Alt+Shift+E)
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Alt+Shift+E', () => {
    console.log('=== EMERGENCY SHORTCUT PRESSED ===')
    console.log('isBreakActive:', isBreakActive)
    console.log('breakWindows count:', breakWindows.length)

    if (isBreakActive || breakWindows.length > 0) {
      console.log('Emergency exit triggered - forcing break end')
      endBreak()
    } else {
      console.log('No active break to end via emergency shortcut')
    }
  })

  if (shortcutRegistered) {
    console.log('Emergency shortcut registered successfully')
  } else {
    console.error('Failed to register emergency shortcut')
  }
}

// Helper function to get break time remaining
function getBreakTimeRemaining() {
  if (!isBreakActive || !breakStartTime) {
    return config.breakDuration
  }

  const elapsed = Date.now() - breakStartTime
  const remaining = Math.max(0, config.breakDuration - elapsed)
  return remaining
}

// Helper function to get work time remaining
function getWorkTimeRemaining() {
  if (isPaused || isBreakActive) {
    return config.workDuration
  }

  if (!workStartTime) {
    return config.workDuration
  }

  const elapsed = Date.now() - workStartTime
  const remaining = Math.max(0, config.workDuration - elapsed)
  return remaining
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  return config
})

ipcMain.handle('save-config', (_, newConfig) => {
  try {
    if (!newConfig || typeof newConfig !== 'object') {
      throw new Error('Invalid config object')
    }

    const oldConfig = { ...config }

    // Validate work and break durations before saving
    if (newConfig.workDuration !== undefined) {
      if (typeof newConfig.workDuration !== 'number' || newConfig.workDuration < 60000) {
        console.error(
          'Invalid work duration received:',
          newConfig.workDuration,
          'ms. Using default.'
        )
        newConfig.workDuration = defaultConfig.workDuration
      }
    }

    if (newConfig.breakDuration !== undefined) {
      if (typeof newConfig.breakDuration !== 'number' || newConfig.breakDuration < 30000) {
        console.error(
          'Invalid break duration received:',
          newConfig.breakDuration,
          'ms. Using default.'
        )
        newConfig.breakDuration = defaultConfig.breakDuration
      }
    }

    // Validate boolean fields
    if (
      newConfig.notifyBeforeBreak !== undefined &&
      typeof newConfig.notifyBeforeBreak !== 'boolean'
    ) {
      newConfig.notifyBeforeBreak = defaultConfig.notifyBeforeBreak
    }

    if (newConfig.soundEnabled !== undefined && typeof newConfig.soundEnabled !== 'boolean') {
      newConfig.soundEnabled = defaultConfig.soundEnabled
    }

    if (newConfig.autoStart !== undefined && typeof newConfig.autoStart !== 'boolean') {
      newConfig.autoStart = defaultConfig.autoStart
    }

    // Validate theme
    if (newConfig.theme !== undefined && !['light', 'dark', 'auto'].includes(newConfig.theme)) {
      newConfig.theme = defaultConfig.theme
    }

    config = { ...config, ...newConfig }
    saveConfig()

    console.log('=== CONFIG SAVED ===')
    console.log('Old work duration:', oldConfig.workDuration / (60 * 1000), 'minutes')
    console.log('New work duration:', config.workDuration / (60 * 1000), 'minutes')
    console.log(
      'Current state - isBreakActive:',
      isBreakActive,
      'isPaused:',
      isPaused,
      'workTimer:',
      !!workTimer
    )

    // If work timer is active and work duration changed, restart with new duration
    if (
      workTimer &&
      !isBreakActive &&
      !isPaused &&
      oldConfig.workDuration !== config.workDuration
    ) {
      console.log('Work duration changed during active work timer, restarting with new duration')
      clearTimeout(workTimer)
      clearTimeout(notificationTimer)
      startWorkTimer()
    }

    // If we're currently in a break and work duration changed, the change will apply to next work cycle
    // No action needed here as startWorkTimer() will be called with new config when break ends
    if (isBreakActive && oldConfig.workDuration !== config.workDuration) {
      console.log('Work duration changed during break - will apply to next work cycle')
    }

    // If break timer is active and break duration changed, restart with new duration
    if (breakTimer && isBreakActive && oldConfig.breakDuration !== config.breakDuration) {
      console.log('Break duration changed during active break, restarting with new duration')
      clearTimeout(breakTimer)

      // Update break tooltip interval
      const breakTooltipInterval = setInterval(() => {
        if (!isBreakActive) {
          clearInterval(breakTooltipInterval)
          return
        }
        updateTrayTooltip()
      }, 1000)

      breakTimer = setTimeout(() => {
        clearInterval(breakTooltipInterval)
        endBreak()
      }, config.breakDuration)
    }

    // Update tray tooltip to reflect new settings
    updateTrayTooltip()

    console.log('Config save completed')
    return { success: true, config }
  } catch (error) {
    console.error('Error saving config:', error)
    return { success: false, error: error.message, config }
  }
})

ipcMain.handle('get-break-time-remaining', () => {
  return getBreakTimeRemaining()
})

ipcMain.handle('get-work-time-remaining', () => {
  return getWorkTimeRemaining()
})

ipcMain.handle('get-app-status', () => {
  const status = {
    isBreakActive,
    isPaused,
    workTimeRemaining: getWorkTimeRemaining(),
    breakTimeRemaining: getBreakTimeRemaining()
  }

  console.log('App status requested:', {
    ...status,
    workStartTime: workStartTime ? new Date(workStartTime).toLocaleTimeString() : 'null',
    configWorkDuration: config.workDuration
  })

  return status
})

ipcMain.handle('end-break-early', () => {
  console.log('=== END BREAK EARLY IPC HANDLER ===')
  console.log('isBreakActive:', isBreakActive)
  console.log('breakWindows count:', breakWindows.length)
  console.log('breakTimer:', breakTimer ? 'active' : 'null')

  // Force break end regardless of state if windows exist
  if (isBreakActive || breakWindows.length > 0) {
    console.log('Forcing break to end...')
    endBreak()
    console.log('Break end process completed')
    return true
  }
  console.log('No active break to end')
  return false
})

ipcMain.handle('force-close-break-windows', () => {
  console.log('=== FORCE CLOSE BREAK WINDOWS ===')
  console.log('breakWindows count:', breakWindows.length)

  // Nuclear option - destroy all windows immediately
  breakWindows.forEach((window, index) => {
    if (window) {
      try {
        console.log('Force destroying window', index)
        window.destroy()
      } catch (error) {
        console.error('Error force destroying window', index, ':', error)
      }
    }
  })

  breakWindows = []
  isBreakActive = false
  breakStartTime = null

  if (breakTimer) {
    clearTimeout(breakTimer)
    breakTimer = null
  }

  console.log('All break windows force destroyed')
  return true
})

// Enhanced notification system handlers
ipcMain.handle('start-break-now', () => {
  console.log('=== START BREAK NOW ===')
  try {
    if (workTimer) {
      clearTimeout(workTimer)
      clearTimeout(notificationTimer)
    }

    // Clear any existing notification popups
    sendNotificationToRenderer({
      type: 'hide-notifications'
    })

    startBreak()
    return { success: true }
  } catch (error) {
    console.error('Error starting break now:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('add-time', (_, seconds) => {
  console.log(`=== ADD TIME: ${seconds} seconds ===`)

  try {
    if (!seconds || typeof seconds !== 'number' || seconds <= 0) {
      throw new Error('Invalid seconds value')
    }

    if (workTimer && !isBreakActive) {
      // Extend the current work timer
      clearTimeout(workTimer)
      clearTimeout(notificationTimer)

      // Add time to the work session
      const currentRemaining = getWorkTimeRemaining()
      const newRemaining = currentRemaining + seconds * 1000

      // Restart timer with extended time
      workStartTime = Date.now() - (config.workDuration - newRemaining)

      // Set up new notification timer if applicable
      if (config.notifyBeforeBreak && newRemaining > 60000) {
        notificationTimer = setTimeout(() => {
          if (!isPaused && !isBreakActive) {
            // Calculate actual remaining time for accurate countdown
            const actualRemainingTime = getWorkTimeRemaining()
            const countdownSeconds = Math.max(1, Math.ceil(actualRemainingTime / 1000))

            sendNotificationToRenderer({
              type: 'pre-break-warning',
              countdown: countdownSeconds,
              workDuration: config.workDuration,
              breakDuration: config.breakDuration
            })
          }
        }, newRemaining - 60000)
      }

      // Set up new work timer
      workTimer = setTimeout(() => {
        if (!isPaused) {
          console.log('Extended work timer completed, starting break')
          startBreak()
        }
      }, newRemaining)

      updateTrayTooltip()

      // Hide notification popup
      sendNotificationToRenderer({
        type: 'hide-notifications'
      })

      showNotification(
        '⏰ Time Extended',
        `Added ${Math.round(seconds / 60)} minute${seconds >= 120 ? 's' : ''} to your work session.`
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Error adding time:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('skip-break', () => {
  console.log('=== SKIP BREAK ===')

  try {
    // Clear any timers
    if (workTimer) {
      clearTimeout(workTimer)
    }
    if (notificationTimer) {
      clearTimeout(notificationTimer)
    }

    // Hide notification popup
    sendNotificationToRenderer({
      type: 'hide-notifications'
    })

    // Show notification about skipped break
    showNotification('⏭️ Break Skipped', 'Break reminder skipped. Starting next work cycle.')

    // Start next work cycle
    startWorkTimer()

    return { success: true }
  } catch (error) {
    console.error('Error skipping break:', error)
    return { success: false, error: error.message }
  }
})

// Close notification windows
ipcMain.handle('close-notifications', () => {
  hideNotificationWindows()
  return true
})

// Close specific notification popup
ipcMain.handle('close-notification-popup', () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.hide()
  }
  return true
})

// Function to send notifications to independent notification windows
function sendNotificationToRenderer(data) {
  console.log('Sending notification to independent windows:', data)

  switch (data.type) {
    case 'pre-break-warning':
      // Show notification popup
      showNotificationPopup({
        type: 'pre-break-warning',
        countdown: data.countdown,
        workDuration: data.workDuration,
        breakDuration: data.breakDuration
      })
      break

    case 'break-starting':
    case 'break-complete':
    case 'hide-notifications':
      hideNotificationWindows()
      break

    default:
      // For any other notifications, try to send to main window if available
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('show-notification', data)
      }
      break
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.eyedoro')

  // Load configuration
  loadConfig()

  // Create tray first
  createTray()

  // Create main window (hidden)
  createWindow()

  // Register global shortcuts
  registerGlobalShortcuts()

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Start the first work timer after a short delay to ensure everything is initialized
  setTimeout(() => {
    console.log('Starting initial work timer with config:', config)
    startWorkTimer()
  }, 1000)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Prevent app from quitting when windows are closed
app.on('window-all-closed', (event) => {
  console.log('=== WINDOW ALL CLOSED EVENT ===')
  console.log('app.isQuiting:', app.isQuiting)
  console.log('Platform:', process.platform)

  // On macOS, apps typically stay open even when all windows are closed
  if (process.platform === 'darwin' && !app.isQuiting) {
    event.preventDefault()
    return
  }

  // On other platforms, only prevent quit if not explicitly quitting
  if (!app.isQuiting) {
    console.log('Preventing quit - app still running in background')
    event.preventDefault()
  } else {
    console.log('Allowing app to quit')
  }
})

app.on('before-quit', (event) => {
  console.log('=== BEFORE QUIT EVENT ===')
  console.log('app.isQuiting:', app.isQuiting)

  // If not already quitting, do cleanup
  if (!app.isQuiting) {
    console.log('Starting quit cleanup process...')
    app.isQuiting = true

    // Clear all timers
    if (workTimer) clearTimeout(workTimer)
    if (breakTimer) clearTimeout(breakTimer)
    if (notificationTimer) clearTimeout(notificationTimer)

    // Close break windows
    breakWindows.forEach((window) => {
      if (window && !window.isDestroyed()) {
        try {
          window.destroy()
        } catch (error) {
          console.error('Error destroying break window on quit:', error)
        }
      }
    })

    // Close notification windows
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      try {
        notificationWindow.destroy()
      } catch (error) {
        console.error('Error destroying notification window on quit:', error)
      }
    }
  }

  globalShortcut.unregisterAll()
  console.log('Quit cleanup completed')
})
