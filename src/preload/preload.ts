import { contextBridge, ipcRenderer } from 'electron'

/**
 * API segura exposta ao renderer via contextBridge.
 * Nenhum módulo Node.js é acessível diretamente — apenas canais IPC definidos.
 */
contextBridge.exposeInMainWorld('gamiumAPI', {
  // ─── Armazenamento local criptografado ──────────────────────────────────────
  storage: {
    setKey: (password: string) => ipcRenderer.invoke('storage:setKey', password),
    save: (data: Record<string, unknown>) => ipcRenderer.invoke('storage:save', data),
    load: () => ipcRenderer.invoke('storage:load'),
  },

  // ─── Tela / Desktop Capturer ────────────────────────────────────────────────
  getDesktopSources: () => ipcRenderer.invoke('app:getDesktopSources'),

  // ─── Controle da janela (frameless) ─────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // ─── Clipboard ────────────────────────────────────────────────────────────
  copyToClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  // ─── Auto-Update ─────────────────────────────────────────────────────────────
  updates: {
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update:available', (_event, info) => callback(info))
    },
    onUpdateNotAvailable: (callback: () => void) => {
      ipcRenderer.on('update:not-available', () => callback())
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('update:progress', (_event, progress) => callback(progress))
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('update:downloaded', (_event, info) => callback(info))
    },
    onUpdateError: (callback: (error: any) => void) => {
      ipcRenderer.on('update:error', (_event, error) => callback(error))
    },
  },
})
