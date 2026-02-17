/* ─── Tipos globais para a API exposta pelo preload ─────────────────────────── */

export interface GamiumAPI {
  storage: {
    setKey: (password: string) => Promise<boolean>
    save: (data: Record<string, unknown>) => Promise<boolean>
    load: () => Promise<Record<string, unknown> | null>
  }
  getDesktopSources: () => Promise<DesktopSource[]>
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
  copyToClipboard: (text: string) => Promise<boolean>
  updates: {
    checkForUpdates: () => Promise<{ available: boolean; version?: string; error?: string }>
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>
    installUpdate: () => Promise<void>
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void
    onUpdateNotAvailable: (callback: () => void) => void
    onDownloadProgress: (callback: (progress: UpdateProgress) => void) => void
    onUpdateDownloaded: (callback: (info: UpdateDownloadedInfo) => void) => void
    onUpdateError: (callback: (error: UpdateError) => void) => void
  }
}

export interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes?: string
}

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
}

export interface UpdateDownloadedInfo {
  version: string
}

export interface UpdateError {
  message: string
}

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
}

declare global {
  interface Window {
    gamiumAPI: GamiumAPI
  }
}

/* ─── Modelos de domínio ───────────────────────────────────────────────────── */

export interface UserIdentity {
  alias: string
  pub: string   // chave pública (identifica o usuário na rede)
  epub: string  // chave pública de criptografia (ECDH)
  recoveryPhrase?: string  // frase de recuperação (12 palavras)
}

export interface Friend {
  pub: string
  alias: string
  addedAt: number
  online?: boolean
}

export interface FriendRequest {
  from: string
  alias: string
  time: number
}

export interface Message {
  id: string
  text: string          // texto criptografado na rede, descriptografado na UI
  from: string          // pub do remetente
  fromAlias: string
  time: number
  sig?: string          // assinatura digital
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
}

export interface Server {
  id: string
  name: string
  owner: string
  channels: Channel[]
  createdAt: number
  encryptionKey?: string  // chave AES compartilhada (distribuída via E2E)
}

export interface Group {
  id: string
  name: string
  members: string[]   // pub keys dos membros
  createdAt: number
  encryptionKey?: string
}

export interface VoicePeer {
  pub: string
  alias: string
  stream?: MediaStream
  muted: boolean
  screenSharing: boolean
}

export type ViewSection = 'friends' | 'server' | 'group' | 'dm'

export interface ActiveView {
  section: ViewSection
  serverId?: string
  channelId?: string
  groupId?: string
  dmPub?: string
}
