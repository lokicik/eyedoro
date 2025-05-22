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
  darkMode: false,
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
      config = { ...defaultConfig, ...JSON.parse(data) }
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

  let tooltip = 'Eye Guard - Protecting your eyes'

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

function createWindow() {
  // Create the main settings window
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    title: 'Eye Guard Settings',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Don't show main window on startup, only when accessed from tray
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
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

  // Clear any existing break windows
  breakWindows.forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.close()
    }
  })
  breakWindows = []

  // Create break window for each display
  displays.forEach((display) => {
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

    // Load break screen
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      breakWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/break')
    } else {
      breakWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'break' })
    }

    // Store all break windows
    breakWindows.push(breakWin)
  })
}

function createTray() {
  tray = new Tray(icon)

  // Use the dynamic menu function
  updateTrayMenu()
  updateTrayTooltip()

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

function startWorkTimer() {
  if (isPaused || isBreakActive) return

  // Clear any existing timers
  clearTimeout(workTimer)
  clearTimeout(notificationTimer)

  workStartTime = Date.now()
  console.log(
    'Work timer started at:',
    new Date(workStartTime).toLocaleTimeString(),
    'Duration:',
    config.workDuration / 1000,
    'seconds'
  )

  // Update tooltip every second
  const tooltipUpdateInterval = setInterval(() => {
    if (isPaused || isBreakActive || !workStartTime) {
      clearInterval(tooltipUpdateInterval)
      return
    }
    updateTrayTooltip()
  }, 1000)

  // Show notification 30 seconds before break if enabled
  if (config.notifyBeforeBreak && config.workDuration > 30000) {
    notificationTimer = setTimeout(() => {
      if (!isPaused && !isBreakActive) {
        showNotification(
          '👁️ Eye Break Coming Soon!',
          "Your break will start in 30 seconds. Finish up what you're doing."
        )
      }
    }, config.workDuration - 30000)
  }

  workTimer = setTimeout(() => {
    clearInterval(tooltipUpdateInterval)
    if (!isPaused) {
      startBreak()
    }
  }, config.workDuration)
}

function startBreak() {
  if (isBreakActive || isPaused) return

  isBreakActive = true
  breakStartTime = Date.now()
  workStartTime = null

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

  // Re-register global shortcuts
  registerGlobalShortcuts()

  // Update tray tooltip and menu
  updateTrayTooltip()
  updateTrayMenu()

  // Start next work cycle
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
    showNotification('⏸️ Eye Guard Paused', 'Break reminders are temporarily disabled.')
  } else {
    startWorkTimer()
    showNotification('▶️ Eye Guard Resumed', 'Break reminders are now active.')
  }

  updateTrayMenu()
  updateTrayTooltip()
}

function updateTrayMenu() {
  const menuItems = [
    {
      label: 'Eye Guard',
      type: 'normal',
      enabled: false
    },
    {
      type: 'separator'
    }
  ]

  if (isBreakActive) {
    // During break - show end break option
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
  }

  menuItems.push(
    {
      label: 'Settings',
      type: 'normal',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        app.isQuiting = true
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
  config = { ...config, ...newConfig }
  saveConfig()
  return config
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

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.eyeguard')

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
  if (!app.isQuiting) {
    event.preventDefault()
  }
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
})
