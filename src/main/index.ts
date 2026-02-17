import { app, BrowserWindow, ipcMain, desktopCapturer, session, Tray, Menu, nativeImage, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

// ─── Caminhos ───────────────────────────────────────────────────────────────────
const userDataPath = app.getPath('userData')
const storagePath = path.join(userDataPath, 'gamium-store.enc')

// ─── Armazenamento local criptografado ──────────────────────────────────────────
function deriveStorageKey(password: string): Buffer {
  return crypto.scryptSync(password, 'gamium-local-salt-v1', 32)
}

let storageKey: Buffer | null = null

function saveLocalData(data: Record<string, unknown>): void {
  if (!storageKey) return
  const json = JSON.stringify(data)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', storageKey, iv)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, encrypted])
  fs.writeFileSync(storagePath, payload)
}

function loadLocalData(): Record<string, unknown> | null {
  if (!storageKey) return null
  if (!fs.existsSync(storagePath)) return null
  try {
    const payload = fs.readFileSync(storagePath)
    const iv = payload.subarray(0, 16)
    const authTag = payload.subarray(16, 32)
    const encrypted = payload.subarray(32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', storageKey, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return JSON.parse(decrypted.toString('utf8'))
  } catch {
    return null
  }
}

// ─── Janela principal ───────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function getIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.png')
  } else {
    return path.join(__dirname, '../../resources/icon.png')
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    title: 'Gamium',
    icon: getIconPath(),
    backgroundColor: '#0a0a0f',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#e0e0e0',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Permissões de mídia (microfone, câmera, tela)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'display-capture', 'screen']
    callback(allowed.includes(permission))
  })

  // Handler de compartilhamento de tela (fallback caso getDisplayMedia seja chamado)
  mainWindow.webContents.session.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
      })
      if (sources.length > 0) {
        // Envia a lista para o renderer escolher — mas como fallback, seleciona a primeira
        callback({ video: sources[0] as any })
      } else {
        callback({})
      }
    } catch {
      callback({})
    }
  })

  // Carregar app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Minimizar para bandeja ao fechar (ao invés de encerrar)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────────
ipcMain.handle('storage:setKey', (_event, password: string) => {
  storageKey = deriveStorageKey(password)
  return true
})

ipcMain.handle('storage:save', (_event, data: Record<string, unknown>) => {
  saveLocalData(data)
  return true
})

ipcMain.handle('storage:load', () => {
  return loadLocalData()
})

ipcMain.handle('app:getDesktopSources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }))
  } catch {
    return []
  }
})

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.handle('window:close', () => mainWindow?.hide())

ipcMain.handle('clipboard:write', (_event, text: string) => {
  clipboard.writeText(text)
  return true
})

// ─── Bandeja do sistema (Tray) ──────────────────────────────────────────────────
function createTray() {
  const iconPath = getIconPath()

  // Cria ícone do tray (16x16 para Windows)
  let trayIcon = nativeImage.createFromPath(iconPath)
  if (trayIcon.isEmpty()) {
    console.error('Tray icon not found:', iconPath)
    // Fallback: cria ícone vazio para não quebrar
    trayIcon = nativeImage.createEmpty()
  }
  trayIcon = trayIcon.resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('Gamium')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Gamium',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// ─── Ciclo de vida ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // Não encerra — fica na bandeja
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
