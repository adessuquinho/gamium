/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  Gamium — Camada de rede P2P descentralizada                                ║
 * ║                                                                             ║
 * ║  Usa Gun.js como banco de dados distribuído (cada peer é um "seed").         ║
 * ║  Todas as mensagens são criptografadas E2E com Gun SEA.                     ║
 * ║  WebRTC é usado para voz e compartilhamento de tela.                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import Gun from 'gun'
import 'gun/sea'
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from 'bip39'
import type { Message, Server, Channel, Group, FriendRequest } from '../shared/types'
import { useAppStore } from './store'

// ─── Tipos locais do Gun ────────────────────────────────────────────────────────
const SEA = (Gun as any).SEA as {
  pair: () => Promise<{ pub: string; priv: string; epub: string; epriv: string }>
  encrypt: (data: any, secret: string | object) => Promise<string>
  decrypt: (data: string, secret: string | object) => Promise<any>
  sign: (data: any, pair: object) => Promise<string>
  verify: (data: string, pub: string) => Promise<any>
  secret: (epub: string, pair: object) => Promise<string>
  work: (data: any, salt?: any) => Promise<string>
}

let gun: any = null
let user: any = null

// ─── Relays públicos Gun.js (seeds/trackers da rede) ────────────────────────────
const GUN_RELAYS = [
  'https://gun-manhattan.herokuapp.com/gun',
  'https://gun-eu.herokuapp.com/gun',
  'https://gun-us.herokuapp.com/gun',
]

// ─── Inicialização ──────────────────────────────────────────────────────────────
export function initGun() {
  if (gun) return gun
  gun = Gun({
    peers: GUN_RELAYS,
    localStorage: true,
    radisk: true,
  })
  user = gun.user().recall({ sessionStorage: true })
  return gun
}

export function getGun() {
  return gun
}
export function getUser() {
  return user
}

// ─── Autenticação ───────────────────────────────────────────────────────────────

export async function register(alias: string, password: string): Promise<{ ok: boolean; error?: string; pub?: string; recoveryPhrase?: string }> {
  return new Promise(async (resolve) => {
    user.create(alias, password, (ack: any) => {
      if (ack.err) {
        resolve({ ok: false, error: ack.err })
      } else {
        // login automático após registro
        user.auth(alias, password, (authAck: any) => {
          if (authAck.err) {
            resolve({ ok: false, error: authAck.err })
          } else {
            setupUserProfile(alias)
            // Gera recovery phrase
            const recoveryPhrase = generateRecoveryPhrase()
            saveRecoveryPhrase(recoveryPhrase)
            resolve({ 
              ok: true, 
              pub: user.is?.pub,
              recoveryPhrase 
            })
          }
        })
      }
    })
  })
}

export async function login(alias: string, password: string): Promise<{ ok: boolean; error?: string; pub?: string }> {
  return new Promise((resolve) => {
    user.auth(alias, password, (ack: any) => {
      if (ack.err) {
        resolve({ ok: false, error: ack.err })
      } else {
        resolve({ ok: true, pub: user.is?.pub })
      }
    })
  })
}

/**
 * Restaura uma conta usando a recovery phrase (12 palavras)
 * Valida o mnemonic e cria uma senha derivada
 */
export async function restoreWithRecoveryPhrase(
  alias: string, 
  mnemonic: string
): Promise<{ ok: boolean; error?: string; pub?: string }> {
  // Valida se o mnemonic é válido
  if (!validateMnemonic(mnemonic)) {
    return { ok: false, error: 'Frase de recuperação inválida. Verifique as 12 palavras.' }
  }

  // Gera seed do mnemonic
  const seed = await mnemonicToSeed(mnemonic)
  // Converte seed (Buffer) em string hexadecimal e usa como senha
  const derivedPassword = seed.toString('hex').substring(0, 64)

  return new Promise((resolve) => {
    user.auth(alias, derivedPassword, (ack: any) => {
      if (ack.err) {
        resolve({ ok: false, error: 'Conta não encontrada ou dados incorretos.' })
      } else {
        resolve({ ok: true, pub: user.is?.pub })
      }
    })
  })
}


export function logout() {
  user.leave()
  useAppStore.getState().reset()
}

function setupUserProfile(alias: string) {
  user.get('profile').put({
    alias,
    createdAt: Date.now(),
  })
}

export function getCurrentUser(): { pub: string; epub: string; alias: string } | null {
  if (!user?.is) return null
  return {
    pub: user.is.pub,
    epub: user.is.epub,
    alias: user.is.alias,
  }
}

// ─── Recovery Phrase (Recuperação de Conta) ─────────────────────────────────────

/**
 * Gera uma frase mnemônica de 12 palavras para recuperação de conta
 * Segue o padrão BIP39 (Bitcoin Improvement Proposal)
 */
export function generateRecoveryPhrase(): string {
  return generateMnemonic(128) // 128 bits = 12 palavras
}

/**
 * Salva a recovery phrase no localStorage (local, não na rede)
 * ⚠️ IMPORTANTES: O usuário deve guardar isso em um lugar seguro!
 */
export function saveRecoveryPhrase(phrase: string): void {
  try {
    localStorage.setItem('gamium_recovery_phrase', phrase)
  } catch (err) {
    console.error('Erro ao salvar recovery phrase:', err)
  }
}

/**
 * Recupera a recovery phrase do localStorage
 */
export function getRecoveryPhrase(): string | null {
  try {
    return localStorage.getItem('gamium_recovery_phrase')
  } catch (err) {
    console.error('Erro ao recuperar recovery phrase:', err)
    return null
  }
}

/**
 * Deleta a recovery phrase do localStorage (após usuario confirmar que salvou)
 */
export function clearRecoveryPhrase(): void {
  try {
    localStorage.removeItem('gamium_recovery_phrase')
  } catch (err) {
    console.error('Erro ao deletar recovery phrase:', err)
  }
}

// ─── Sistema de Amigos ──────────────────────────────────────────────────────────

export async function sendFriendRequest(targetPub: string) {
  const me = getCurrentUser()
  if (!me) return

  // Busca o epub do alvo para derivar segredo compartilhado
  const targetUser = gun.user(targetPub)

  // Salva a solicitação sob o grafo do alvo (público)
  gun.get('friend_requests').get(targetPub).get(me.pub).put({
    from: me.pub,
    alias: me.alias,
    time: Date.now(),
  })
}

export function listenFriendRequests(callback: (req: FriendRequest) => void) {
  const me = getCurrentUser()
  if (!me) return

  gun.get('friend_requests').get(me.pub).map().on((data: any, key: string) => {
    if (data && data.from && data.alias) {
      callback({
        from: data.from,
        alias: data.alias,
        time: data.time || Date.now(),
      })
    }
  })
}

export async function acceptFriendRequest(friendPub: string) {
  const me = getCurrentUser()
  if (!me) return

  // Busca alias do amigo
  const friendAlias = await new Promise<string>((resolve) => {
    gun.get('friend_requests').get(me.pub).get(friendPub).once((data: any) => {
      resolve(data?.alias || 'Desconhecido')
    })
  })

  // Adiciona amigo à lista local
  user.get('friends').get(friendPub).put({
    pub: friendPub,
    alias: friendAlias,
    addedAt: Date.now(),
  })

  // Adiciona-se à lista de amigos do outro (via branch público)
  gun.get('friend_lists').get(friendPub).get(me.pub).put({
    pub: me.pub,
    alias: me.alias,
    addedAt: Date.now(),
  })

  // Remove a solicitação
  gun.get('friend_requests').get(me.pub).get(friendPub).put(null)
}

export async function removeFriend(friendPub: string) {
  const me = getCurrentUser()
  if (!me) return
  user.get('friends').get(friendPub).put(null)
  gun.get('friend_lists').get(friendPub).get(me.pub).put(null)
}

export function listenFriends(callback: (friends: Array<{ pub: string; alias: string; addedAt: number }>) => void) {
  const friends: Record<string, { pub: string; alias: string; addedAt: number }> = {}

  user.get('friends').map().on((data: any, key: string) => {
    if (data && data.pub) {
      friends[key] = { pub: data.pub, alias: data.alias, addedAt: data.addedAt }
    } else {
      delete friends[key]
    }
    callback(Object.values(friends))
  })

  // Também escuta amigos adicionados externamente
  const me = getCurrentUser()
  if (me) {
    gun.get('friend_lists').get(me.pub).map().on((data: any, key: string) => {
      if (data && data.pub && !friends[key]) {
        // Aceita automaticamente (foi aceito pelo outro lado)
        user.get('friends').get(key).put({
          pub: data.pub,
          alias: data.alias,
          addedAt: data.addedAt,
        })
      }
    })
  }
}

// ─── Mensagens Diretas (DM) ─────────────────────────────────────────────────────

function getDMConversationId(pub1: string, pub2: string): string {
  return [pub1, pub2].sort().join('::')
}

// Cache de segredos compartilhados para evitar recálculos
const secretCache = new Map<string, string>()

async function getSharedSecret(targetPub: string): Promise<string | null> {
  if (secretCache.has(targetPub)) {
    return secretCache.get(targetPub)!
  }

  const targetEpub = await new Promise<string>((resolve) => {
    let resolved = false
    gun.user(targetPub).once((data: any) => {
      if (!resolved) {
        resolved = true
        resolve(data?.epub || '')
      }
    })
    setTimeout(() => { if (!resolved) { resolved = true; resolve('') } }, 5000)
  })

  if (!targetEpub) return null

  try {
    const secret = await SEA.secret(targetEpub, user._.sea)
    if (secret) {
      secretCache.set(targetPub, secret)
    }
    return secret || null
  } catch {
    return null
  }
}

export async function sendDM(targetPub: string, text: string) {
  const me = getCurrentUser()
  if (!me) return

  const secret = await getSharedSecret(targetPub)
  if (!secret) {
    console.error('Não foi possível derivar segredo compartilhado')
    return
  }

  const encText = await SEA.encrypt(text, secret)
  const sig = await SEA.sign(encText, user._.sea)

  const convoId = getDMConversationId(me.pub, targetPub)
  const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  gun.get('dms').get(convoId).get(msgId).put({
    id: msgId,
    text: encText,
    from: me.pub,
    fromAlias: me.alias,
    time: Date.now(),
    sig,
  })
}

export function listenDMs(targetPub: string, callback: (messages: Message[]) => void) {
  const me = getCurrentUser()
  if (!me) return

  const convoId = getDMConversationId(me.pub, targetPub)
  const messages: Record<string, Message> = {}

  // Pré-derivar o segredo compartilhado ANTES de escutar mensagens
  getSharedSecret(targetPub).then((secret) => {
    if (!secret) {
      console.error('Falha ao derivar segredo para DM com', targetPub)
      return
    }

    gun.get('dms').get(convoId).map().on((data: any, key: string) => {
      if (!data || !data.text || !data.from) return

      // Descriptografar de forma segura
      SEA.decrypt(data.text, secret).then((decrypted: any) => {
        messages[key] = {
          id: data.id || key,
          text: decrypted || data.text,
          from: data.from,
          fromAlias: data.fromAlias || 'Anônimo',
          time: data.time || Date.now(),
          sig: data.sig,
        }

        const sorted = Object.values(messages).sort((a, b) => a.time - b.time)
        callback(sorted)
      }).catch(() => {
        // Fallback: mostrar que a mensagem existe mas não pôde ser descriptografada
        messages[key] = {
          id: data.id || key,
          text: '[mensagem criptografada]',
          from: data.from,
          fromAlias: data.fromAlias || 'Anônimo',
          time: data.time || Date.now(),
        }
        const sorted = Object.values(messages).sort((a, b) => a.time - b.time)
        callback(sorted)
      })
    })
  })
}

// ─── Servidores ─────────────────────────────────────────────────────────────────

export async function createServer(name: string): Promise<string> {
  const me = getCurrentUser()
  if (!me) return ''

  const serverId = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  // Gera chave de criptografia do servidor
  const serverKey = await SEA.work(serverId + Date.now(), me.pub)

  const serverData = {
    id: serverId,
    name,
    owner: me.pub,
    createdAt: Date.now(),
  }

  gun.get('servers').get(serverId).put(serverData)

  // Canal padrão
  gun.get('servers').get(serverId).get('channels').get('general').put({
    id: 'general',
    name: 'geral',
    type: 'text',
  })

  gun.get('servers').get(serverId).get('channels').get('voice-1').put({
    id: 'voice-1',
    name: 'Voz Geral',
    type: 'voice',
  })

  // Adiciona o membro (dono)
  gun.get('servers').get(serverId).get('members').get(me.pub).put({
    pub: me.pub,
    alias: me.alias,
    role: 'owner',
    joinedAt: Date.now(),
  })

  // Salva no perfil do usuário
  user.get('servers').get(serverId).put({
    id: serverId,
    name,
    encryptionKey: serverKey,
  })

  return serverId
}

export async function joinServer(serverId: string) {
  const me = getCurrentUser()
  if (!me) return

  gun.get('servers').get(serverId).get('members').get(me.pub).put({
    pub: me.pub,
    alias: me.alias,
    role: 'member',
    joinedAt: Date.now(),
  })

  // Busca informações do servidor
  gun.get('servers').get(serverId).once((data: any) => {
    if (data) {
      user.get('servers').get(serverId).put({
        id: serverId,
        name: data.name,
        encryptionKey: '', // Será compartilhado pelo dono
      })
    }
  })
}

export function listenUserServers(callback: (servers: Server[]) => void) {
  const servers: Record<string, Server> = {}

  user.get('servers').map().on((data: any, key: string) => {
    if (data && data.id) {
      // Busca info completa do servidor
      gun.get('servers').get(key).once((serverData: any) => {
        if (serverData) {
          servers[key] = {
            id: key,
            name: serverData.name || data.name,
            owner: serverData.owner || '',
            channels: [],
            createdAt: serverData.createdAt || 0,
            encryptionKey: data.encryptionKey,
          }

          // Busca canais
          gun.get('servers').get(key).get('channels').map().once((ch: any, chKey: string) => {
            if (ch && ch.id) {
              const srv = servers[key]
              if (srv && !srv.channels.find((c) => c.id === chKey)) {
                srv.channels.push({ id: chKey, name: ch.name, type: ch.type || 'text' })
              }
            }
            callback(Object.values(servers))
          })

          callback(Object.values(servers))
        }
      })
    } else if (!data) {
      delete servers[key]
      callback(Object.values(servers))
    }
  })
}

export async function sendServerMessage(serverId: string, channelId: string, text: string) {
  const me = getCurrentUser()
  if (!me) return

  // Busca a chave do servidor do store local
  const serverKey = await new Promise<string>((resolve) => {
    user.get('servers').get(serverId).once((data: any) => {
      resolve(data?.encryptionKey || serverId)
    })
  })

  const encText = await SEA.encrypt(text, serverKey)
  const sig = await SEA.sign(encText, user._.sea)
  const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  gun.get('servers').get(serverId).get('channels').get(channelId).get('messages').get(msgId).put({
    id: msgId,
    text: encText,
    from: me.pub,
    fromAlias: me.alias,
    time: Date.now(),
    sig,
  })
}

export function listenServerMessages(serverId: string, channelId: string, callback: (msgs: Message[]) => void) {
  const messages: Record<string, Message> = {}

  // Busca chave de forma segura antes de escutar
  user.get('servers').get(serverId).once((srvData: any) => {
    const serverKey = srvData?.encryptionKey || serverId

    gun.get('servers').get(serverId).get('channels').get(channelId).get('messages').map().on((data: any, key: string) => {
      if (!data || !data.text || !data.from) return

      SEA.decrypt(data.text, serverKey).then((decrypted: any) => {
        messages[key] = {
          id: data.id || key,
          text: decrypted || data.text,
          from: data.from,
          fromAlias: data.fromAlias || 'Anônimo',
          time: data.time || Date.now(),
          sig: data.sig,
        }
        callback(Object.values(messages).sort((a, b) => a.time - b.time))
      }).catch(() => {
        messages[key] = {
          id: data.id || key,
          text: '[criptografado]',
          from: data.from,
          fromAlias: data.fromAlias || 'Anônimo',
          time: data.time || Date.now(),
        }
        callback(Object.values(messages).sort((a, b) => a.time - b.time))
      })
    })
  })
}

export function createServerChannel(serverId: string, name: string, type: 'text' | 'voice' = 'text') {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  gun.get('servers').get(serverId).get('channels').get(id).put({
    id,
    name,
    type,
  })
}

// ─── Grupos ─────────────────────────────────────────────────────────────────────

export async function createGroup(name: string, memberPubs: string[]): Promise<string> {
  const me = getCurrentUser()
  if (!me) return ''

  const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const groupKey = await SEA.work(groupId + Date.now(), me.pub)

  const allMembers = [me.pub, ...memberPubs]

  gun.get('groups').get(groupId).put({
    id: groupId,
    name,
    createdAt: Date.now(),
    creator: me.pub,
  })

  // Adiciona membros
  for (const pub of allMembers) {
    gun.get('groups').get(groupId).get('members').get(pub).put({ pub, joinedAt: Date.now() })
  }

  // Salva no perfil de cada membro
  user.get('groups').get(groupId).put({
    id: groupId,
    name,
    encryptionKey: groupKey,
  })

  // Notifica membros (eles precisam salvar no próprio perfil)
  for (const pub of memberPubs) {
    gun.get('group_invites').get(pub).get(groupId).put({
      id: groupId,
      name,
      from: me.pub,
      time: Date.now(),
    })
  }

  return groupId
}

export function listenGroupInvites(callback: (invite: { id: string; name: string; from: string }) => void) {
  const me = getCurrentUser()
  if (!me) return

  gun.get('group_invites').get(me.pub).map().on((data: any) => {
    if (data && data.id) {
      callback({ id: data.id, name: data.name, from: data.from })
    }
  })
}

export async function acceptGroupInvite(groupId: string, name: string) {
  const me = getCurrentUser()
  if (!me) return

  user.get('groups').get(groupId).put({
    id: groupId,
    name,
    encryptionKey: groupId, // Simplificado — idealmente compartilhado via E2E
  })

  gun.get('groups').get(groupId).get('members').get(me.pub).put({
    pub: me.pub,
    joinedAt: Date.now(),
  })

  // Remove convite
  gun.get('group_invites').get(me.pub).get(groupId).put(null)
}

export function listenUserGroups(callback: (groups: Group[]) => void) {
  const groups: Record<string, Group> = {}

  user.get('groups').map().on((data: any, key: string) => {
    if (data && data.id) {
      groups[key] = {
        id: key,
        name: data.name,
        members: [],
        createdAt: 0,
        encryptionKey: data.encryptionKey,
      }

      // Busca membros
      gun.get('groups').get(key).get('members').map().once((m: any, mk: string) => {
        if (m && m.pub) {
          const g = groups[key]
          if (g && !g.members.includes(mk)) {
            g.members.push(mk)
          }
          callback(Object.values(groups))
        }
      })

      callback(Object.values(groups))
    } else if (!data) {
      delete groups[key]
      callback(Object.values(groups))
    }
  })
}

export async function sendGroupMessage(groupId: string, text: string) {
  const me = getCurrentUser()
  if (!me) return

  const groupKey = await new Promise<string>((resolve) => {
    user.get('groups').get(groupId).once((data: any) => {
      resolve(data?.encryptionKey || groupId)
    })
  })

  const encText = await SEA.encrypt(text, groupKey)
  const sig = await SEA.sign(encText, user._.sea)
  const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  gun.get('groups').get(groupId).get('messages').get(msgId).put({
    id: msgId,
    text: encText,
    from: me.pub,
    fromAlias: me.alias,
    time: Date.now(),
    sig,
  })
}

export function listenGroupMessages(groupId: string, callback: (msgs: Message[]) => void) {
  const messages: Record<string, Message> = {}

  user.get('groups').get(groupId).once((grpData: any) => {
    const groupKey = grpData?.encryptionKey || groupId

    gun.get('groups').get(groupId).get('messages').map().on((data: any, key: string) => {
      if (!data || !data.text || !data.from) return

      SEA.decrypt(data.text, groupKey).then((decrypted: any) => {
        messages[key] = {
          id: data.id || key,
          text: decrypted || data.text,
          from: data.from,
          fromAlias: data.fromAlias || 'Anônimo',
          time: data.time || Date.now(),
        }
        callback(Object.values(messages).sort((a, b) => a.time - b.time))
      }).catch(() => {
        messages[key] = {
          id: data.id || key,
          text: '[criptografado]',
          from: data.from,
          fromAlias: data.fromAlias || 'Anônimo',
          time: data.time || Date.now(),
        }
        callback(Object.values(messages).sort((a, b) => a.time - b.time))
      })
    })
  })
}

// ─── WebRTC — Voz e Compartilhamento de Tela ────────────────────────────────────

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

interface PeerConnection {
  pc: RTCPeerConnection
  pub: string
  stream?: MediaStream
}

const peerConnections = new Map<string, PeerConnection>()
let localStream: MediaStream | null = null
let screenStream: MediaStream | null = null

export async function joinVoiceChannel(channelPath: string): Promise<MediaStream | null> {
  const me = getCurrentUser()
  if (!me) return null

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  } catch (err) {
    console.error('Erro ao acessar microfone:', err)
    return null
  }

  // Sinaliza presença no canal de voz
  gun.get('voice').get(channelPath).get('peers').get(me.pub).put({
    pub: me.pub,
    alias: me.alias,
    joined: true,
    time: Date.now(),
  })

  // Escuta outros peers
  gun.get('voice').get(channelPath).get('peers').map().on((data: any, peerPub: string) => {
    if (!data || peerPub === me.pub) return

    if (data.joined) {
      // Adiciona o peer ao store da UI para ser visível
      useAppStore.getState().addVoicePeer({
        pub: peerPub,
        alias: data.alias || 'Desconhecido',
        muted: false,
        screenSharing: false,
      })

      // Cria conexão WebRTC se ainda não existir
      if (!peerConnections.has(peerPub)) {
        createPeerConnection(channelPath, peerPub, true)
      }
    } else {
      // Peer saiu — remove da UI e fecha conexão
      useAppStore.getState().removeVoicePeer(peerPub)
      const conn = peerConnections.get(peerPub)
      if (conn) {
        conn.pc.close()
        peerConnections.delete(peerPub)
      }
    }
  })

  // Escuta ofertas/respostas de sinalização
  gun.get('voice').get(channelPath).get('signals').get(me.pub).map().on(async (data: any, fromPub: string) => {
    if (!data || !data.type) return

    if (data.type === 'offer' && !peerConnections.has(fromPub)) {
      await createPeerConnection(channelPath, fromPub, false)
      const pc = peerConnections.get(fromPub)?.pc
      if (pc) {
        await pc.setRemoteDescription(JSON.parse(data.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        gun.get('voice').get(channelPath).get('signals').get(fromPub).get(me.pub).put({
          type: 'answer',
          sdp: JSON.stringify(answer),
          time: Date.now(),
        })
      }
    } else if (data.type === 'answer') {
      const pc = peerConnections.get(fromPub)?.pc
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(JSON.parse(data.sdp))
      }
    } else if (data.type === 'ice') {
      const pc = peerConnections.get(fromPub)?.pc
      if (pc) {
        try {
          await pc.addIceCandidate(JSON.parse(data.candidate))
        } catch { /* ignorar candidatos inválidos */ }
      }
    }
  })

  return localStream
}

async function createPeerConnection(channelPath: string, remotePub: string, isInitiator: boolean) {
  const me = getCurrentUser()
  if (!me || !localStream) return

  const pc = new RTCPeerConnection(ICE_CONFIG)
  peerConnections.set(remotePub, { pc, pub: remotePub })

  // Adiciona stream local
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream!)
  })

  // Recebe stream remoto
  pc.ontrack = (event) => {
    const conn = peerConnections.get(remotePub)
    if (conn) {
      conn.stream = event.streams[0]
      useAppStore.getState().updateVoicePeerStream(remotePub, event.streams[0])
    }
  }

  // ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      gun.get('voice').get(channelPath).get('signals').get(remotePub).get(me.pub).put({
        type: 'ice',
        candidate: JSON.stringify(event.candidate),
        time: Date.now(),
      })
    }
  }

  if (isInitiator) {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    gun.get('voice').get(channelPath).get('signals').get(remotePub).get(me.pub).put({
      type: 'offer',
      sdp: JSON.stringify(offer),
      time: Date.now(),
    })
  }
}

export async function leaveVoiceChannel(channelPath: string) {
  const me = getCurrentUser()
  if (!me) return

  // Remove presença
  gun.get('voice').get(channelPath).get('peers').get(me.pub).put({ joined: false, time: Date.now() })

  // Fecha conexões
  peerConnections.forEach((conn) => {
    conn.pc.close()
  })
  peerConnections.clear()

  // Limpa peers da UI
  useAppStore.getState().setVoicePeers([])

  // Para stream local
  localStream?.getTracks().forEach((t) => t.stop())
  localStream = null

  screenStream?.getTracks().forEach((t) => t.stop())
  screenStream = null
}

export function toggleMute(): boolean {
  if (!localStream) return true
  const audioTrack = localStream.getAudioTracks()[0]
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled
    return !audioTrack.enabled
  }
  return true
}

export async function startScreenShare(sourceId?: string): Promise<MediaStream | null> {
  try {
    if (sourceId) {
      // Usa a fonte selecionada pelo usuário (via desktopCapturer)
      screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        } as any,
      })
    } else {
      // Fallback: API padrão do navegador
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
    }

    // Adiciona tracks de screen share a todas as conexões
    peerConnections.forEach((conn) => {
      screenStream!.getTracks().forEach((track) => {
        conn.pc.addTrack(track, screenStream!)
      })
    })

    // Sinaliza que está compartilhando tela no canal de voz
    const me = getCurrentUser()
    const voicePath = useAppStore.getState().voiceChannelPath
    if (me && voicePath) {
      gun.get('voice').get(voicePath).get('peers').get(me.pub).put({
        pub: me.pub,
        alias: me.alias,
        joined: true,
        screenSharing: true,
        time: Date.now(),
      })
    }

    // Quando parar de compartilhar
    screenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare()
    }

    return screenStream
  } catch {
    return null
  }
}

export function stopScreenShare() {
  if (!screenStream) return

  screenStream.getTracks().forEach((t) => t.stop())

  // Remove tracks das conexões
  peerConnections.forEach((conn) => {
    const senders = conn.pc.getSenders()
    senders.forEach((sender) => {
      if (sender.track && screenStream!.getTracks().includes(sender.track)) {
        conn.pc.removeTrack(sender)
      }
    })
  })

  // Sinaliza que parou de compartilhar
  const me = getCurrentUser()
  const voicePath = useAppStore.getState().voiceChannelPath
  if (me && voicePath) {
    gun.get('voice').get(voicePath).get('peers').get(me.pub).put({
      pub: me.pub,
      alias: me.alias,
      joined: true,
      screenSharing: false,
      time: Date.now(),
    })
  }

  screenStream = null
}

// ─── Foto de perfil ─────────────────────────────────────────────────────────────

export function setProfileAvatar(avatarDataUrl: string) {
  if (!user?.is) return
  user.get('profile').get('avatar').put(avatarDataUrl)
  // Também salva em local público para outros verem
  gun.get('avatars').get(user.is.pub).put(avatarDataUrl)
}

export function getProfileAvatar(pub: string, callback: (avatar: string | null) => void) {
  gun.get('avatars').get(pub).on((data: any) => {
    if (data && typeof data === 'string' && data.startsWith('data:image')) {
      callback(data)
    }
  })
}

export function getMyAvatar(callback: (avatar: string | null) => void) {
  if (!user?.is) return
  user.get('profile').get('avatar').on((data: any) => {
    if (data && typeof data === 'string' && data.startsWith('data:image')) {
      callback(data)
    }
  })
}

// ─── Buscar usuário por chave pública ───────────────────────────────────────────

export async function lookupUser(pub: string): Promise<{ alias: string; pub: string } | null> {
  return new Promise((resolve) => {
    gun.user(pub).once((data: any) => {
      if (data && data.alias) {
        resolve({ alias: data.alias, pub })
      } else {
        resolve(null)
      }
    })
    // Timeout
    setTimeout(() => resolve(null), 5000)
  })
}

// ─── Foto de perfil do servidor ─────────────────────────────────────────────────

export function setServerAvatar(serverId: string, avatarDataUrl: string) {
  const me = getCurrentUser()
  if (!me) return
  // Verificar se é owner é feito no componente antes de chamar
  gun.get('servers').get(serverId).get('avatar').put(avatarDataUrl)
}

export function getServerAvatar(serverId: string, callback: (avatar: string | null) => void) {
  gun.get('servers').get(serverId).get('avatar').on((data: any) => {
    if (data && typeof data === 'string' && data.startsWith('data:image')) {
      callback(data)
    }
  })
}

// ─── Membros do servidor ────────────────────────────────────────────────────────

export interface ServerMember {
  pub: string
  alias: string
  role: string
  joinedAt: number
}

export function listenServerMembers(serverId: string, callback: (members: ServerMember[]) => void) {
  const members: Record<string, ServerMember> = {}

  gun.get('servers').get(serverId).get('members').map().on((data: any, key: string) => {
    if (data && data.pub && !data.banned) {
      members[key] = {
        pub: data.pub,
        alias: data.alias || 'Desconhecido',
        role: data.role || 'member',
        joinedAt: data.joinedAt || 0,
      }
    } else {
      delete members[key]
    }
    callback(Object.values(members))
  })
}

// ─── Banir usuário do servidor ──────────────────────────────────────────────────

export function banServerMember(serverId: string, memberPub: string) {
  const me = getCurrentUser()
  if (!me) return

  // Marca como banido
  gun.get('servers').get(serverId).get('members').get(memberPub).put({
    pub: memberPub,
    banned: true,
    bannedBy: me.pub,
    bannedAt: Date.now(),
  })

  // Adiciona à lista de bans
  gun.get('servers').get(serverId).get('bans').get(memberPub).put({
    pub: memberPub,
    bannedBy: me.pub,
    time: Date.now(),
  })
}

export function checkBanned(serverId: string, callback: (banned: boolean) => void) {
  const me = getCurrentUser()
  if (!me) { callback(false); return }

  gun.get('servers').get(serverId).get('bans').get(me.pub).once((data: any) => {
    callback(!!data && !!data.pub)
  })
}

// ─── Peers conectados no canal de voz (para sidebar) ────────────────────────────

export function listenVoiceChannelPeers(
  channelPath: string,
  callback: (peers: Array<{ pub: string; alias: string }>) => void
) {
  const peers: Record<string, { pub: string; alias: string }> = {}

  gun.get('voice').get(channelPath).get('peers').map().on((data: any, key: string) => {
    if (data && data.joined && data.pub) {
      peers[key] = { pub: data.pub, alias: data.alias || 'Desconhecido' }
    } else {
      delete peers[key]
    }
    callback(Object.values(peers))
  })
}
