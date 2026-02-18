/**
 * Store global — Zustand
 * Gerencia todo o estado da aplicação Gamium.
 */

import { create } from 'zustand'
import type { UserIdentity, Friend, FriendRequest, Server, Group, Message, ActiveView, VoicePeer, DesktopSource } from '../shared/types'

export interface DMInboxItem {
  peerPub: string
  fromPub: string
  fromAlias: string
  text: string
  time: number
  unread: number
}

interface AppState {
  // Autenticação
  user: UserIdentity | null
  setUser: (u: UserIdentity | null) => void

  // Avatar
  myAvatar: string | null
  setMyAvatar: (url: string | null) => void
  avatarCache: Record<string, string>
  setCachedAvatar: (pub: string, url: string) => void

  // Amigos
  friends: Friend[]
  setFriends: (f: Friend[]) => void
  friendRequests: FriendRequest[]
  addFriendRequest: (r: FriendRequest) => void
  removeFriendRequest: (fromPub: string) => void

  // Servidores
  servers: Server[]
  setServers: (s: Server[]) => void

  // Grupos
  groups: Group[]
  setGroups: (g: Group[]) => void

  // Mensagens (do chat ativo)
  messages: Message[]
  setMessages: (m: Message[]) => void

  // Inbox de DMs
  dmInbox: Record<string, DMInboxItem>
  upsertDMInbox: (item: Omit<DMInboxItem, 'unread'>) => void
  markDMRead: (peerPub: string) => void

  // Navegação
  activeView: ActiveView
  setActiveView: (v: ActiveView) => void

  // Voz
  inVoice: boolean
  voiceChannelPath: string | null
  voiceMuted: boolean
  voicePeers: VoicePeer[]
  localStream: MediaStream | null
  screenStream: MediaStream | null
  setInVoice: (v: boolean, path?: string | null) => void
  setVoiceMuted: (m: boolean) => void
  setVoicePeers: (p: VoicePeer[]) => void
  addVoicePeer: (p: VoicePeer) => void
  removeVoicePeer: (pub: string) => void
  updateVoicePeerStream: (pub: string, stream: MediaStream) => void
  setLocalStream: (s: MediaStream | null) => void
  setScreenStream: (s: MediaStream | null) => void

  // Seletor de tela
  showScreenPicker: boolean
  setShowScreenPicker: (v: boolean) => void

  // Reset
  reset: () => void
}

const initialState = {
  user: null,
  myAvatar: null,
  avatarCache: {} as Record<string, string>,
  friends: [],
  friendRequests: [],
  servers: [],
  groups: [],
  messages: [],
  dmInbox: {} as Record<string, DMInboxItem>,
  activeView: { section: 'friends' as const },
  inVoice: false,
  voiceChannelPath: null,
  voiceMuted: false,
  voicePeers: [],
  localStream: null,
  screenStream: null,
  showScreenPicker: false,
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setMyAvatar: (myAvatar) => set({ myAvatar }),
  setCachedAvatar: (pub, url) => set((s) => ({ avatarCache: { ...s.avatarCache, [pub]: url } })),

  setFriends: (friends) => set({ friends }),
  addFriendRequest: (req) =>
    set((s) => {
      if (s.friendRequests.find((r) => r.from === req.from)) return s
      return { friendRequests: [...s.friendRequests, req] }
    }),
  removeFriendRequest: (fromPub) =>
    set((s) => ({ friendRequests: s.friendRequests.filter((r) => r.from !== fromPub) })),

  setServers: (servers) => set({ servers }),
  setGroups: (groups) => set({ groups }),
  setMessages: (messages) => set({ messages }),
  upsertDMInbox: (item) =>
    set((s) => {
      const prev = s.dmInbox[item.peerPub]
      const unreadIncrement = item.fromPub === s.user?.pub ? 0 : 1

      return {
        dmInbox: {
          ...s.dmInbox,
          [item.peerPub]: {
            peerPub: item.peerPub,
            fromPub: item.fromPub,
            fromAlias: item.fromAlias,
            text: item.text,
            time: item.time,
            unread: (prev?.unread || 0) + unreadIncrement,
          },
        },
      }
    }),
  markDMRead: (peerPub) =>
    set((s) => {
      const current = s.dmInbox[peerPub]
      if (!current) return s
      return {
        dmInbox: {
          ...s.dmInbox,
          [peerPub]: {
            ...current,
            unread: 0,
          },
        },
      }
    }),
  setActiveView: (activeView) => set({ activeView, messages: [] }),

  setInVoice: (inVoice, voiceChannelPath = null) => set({ inVoice, voiceChannelPath }),
  setVoiceMuted: (voiceMuted) => set({ voiceMuted }),
  setVoicePeers: (voicePeers) => set({ voicePeers }),
  addVoicePeer: (peer) =>
    set((s) => {
      if (s.voicePeers.find((p) => p.pub === peer.pub)) return s
      return { voicePeers: [...s.voicePeers, peer] }
    }),
  removeVoicePeer: (pub) =>
    set((s) => ({ voicePeers: s.voicePeers.filter((p) => p.pub !== pub) })),
  updateVoicePeerStream: (pub, stream) =>
    set((s) => ({
      voicePeers: s.voicePeers.map((p) => (p.pub === pub ? { ...p, stream } : p)),
    })),
  setLocalStream: (localStream) => set({ localStream }),
  setScreenStream: (screenStream) => set({ screenStream }),

  setShowScreenPicker: (showScreenPicker) => set({ showScreenPicker }),

  reset: () => set(initialState),
}))
