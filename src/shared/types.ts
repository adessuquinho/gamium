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
