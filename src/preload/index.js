import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Config management
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Timer functionality
  getBreakTimeRemaining: () => ipcRenderer.invoke('get-break-time-remaining'),
  getWorkTimeRemaining: () => ipcRenderer.invoke('get-work-time-remaining'),
  getAppStatus: () => ipcRenderer.invoke('get-app-status'),
  endBreakEarly: () => ipcRenderer.invoke('end-break-early'),
  forceCloseBreakWindows: () => ipcRenderer.invoke('force-close-break-windows'),

  // Window controls
  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),

  // Notification system (legacy - for main window)
  onNotification: (callback) => {
    ipcRenderer.on('show-notification', callback)
  },
  removeNotificationListener: (callback) => {
    ipcRenderer.removeListener('show-notification', callback)
  },

  // Independent notification windows
  onNotificationData: (callback) => {
    ipcRenderer.on('notification-data', callback)
  },
  removeNotificationDataListener: (callback) => {
    ipcRenderer.removeListener('notification-data', callback)
  },

  // Theme change listeners
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', callback)
  },
  removeThemeChangedListener: (callback) => {
    ipcRenderer.removeListener('theme-changed', callback)
  },

  // Notification actions
  startBreakNow: () => ipcRenderer.invoke('start-break-now'),
  addTime: (seconds) => ipcRenderer.invoke('add-time', seconds),
  skipBreak: () => ipcRenderer.invoke('skip-break'),
  closeNotifications: () => ipcRenderer.invoke('close-notifications'),
  closeNotificationPopup: () => ipcRenderer.invoke('close-notification-popup'),

  // Route detection for break screen
  getRoute: () => {
    return window.location.hash
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electronAPI', api) // Also expose as electronAPI for compatibility
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
  window.electronAPI = api
}
