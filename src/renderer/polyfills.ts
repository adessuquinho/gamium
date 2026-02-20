import { Buffer } from 'buffer/'

if (!(globalThis as any).Buffer) {
  ;(globalThis as any).Buffer = Buffer
}

if (!(globalThis as any).process) {
  ;(globalThis as any).process = { env: {} }
}

// Suppress Chromium internal "dragEvent is not defined" error
// caused by -webkit-app-region: drag in frameless windows.
// Also prevents accidental file drops from navigating the page.
document.addEventListener('dragover', (e) => e.preventDefault(), { passive: false })
document.addEventListener('drop', (e) => e.preventDefault(), { passive: false })

if (!(globalThis as any).gamiumAPI) {
  ;(globalThis as any).gamiumAPI = {
    storage: {
      setKey: async () => true,
      save: async () => true,
      load: async () => null,
    },
    getDesktopSources: async () => [],
    window: {
      minimize: async () => undefined,
      maximize: async () => undefined,
      close: async () => undefined,
    },
    copyToClipboard: async () => true,
    getAppIcon: async () => null,
    updates: {
      checkForUpdates: async () => ({ available: false }),
      downloadUpdate: async () => ({ success: false, error: 'Updater indisponível no modo atual.' }),
      installUpdate: async () => undefined,
      onUpdateAvailable: () => undefined,
      onUpdateNotAvailable: () => undefined,
      onDownloadProgress: () => undefined,
      onUpdateDownloaded: () => undefined,
      onUpdateError: () => undefined,
    },
  }
}
