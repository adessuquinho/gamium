import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import {
  createServer,
  joinServer,
  sendServerMessage,
  listenServerMessages,
  createServerChannel,
  joinVoiceChannel,
  leaveVoiceChannel,
  getProfileAvatar,
  setServerAvatar,
  getServerAvatar,
  listenServerMembers,
  banServerMember,
  listenVoiceChannelPeers,
} from '../network'
import type { Message, Channel } from '../../shared/types'
import type { ServerMember } from '../network'
import { useI18n } from '../i18n'

export default function ServersPanel() {
  const { t, language } = useI18n()
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const servers = useAppStore((s) => s.servers)
  const user = useAppStore((s) => s.user)
  const inVoice = useAppStore((s) => s.inVoice)
  const setInVoice = useAppStore((s) => s.setInVoice)
  const setLocalStream = useAppStore((s) => s.setLocalStream)
  const myAvatar = useAppStore((s) => s.myAvatar)
  const avatarCache = useAppStore((s) => s.avatarCache)
  const setCachedAvatar = useAppStore((s) => s.setCachedAvatar)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [newServerName, setNewServerName] = useState('')
  const [joinServerId, setJoinServerId] = useState('')
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showMemberList, setShowMemberList] = useState(false)
  const [members, setMembers] = useState<ServerMember[]>([])
  const [serverAvatar, setServerAvatarState] = useState<string | null>(null)
  const [voiceChannelPeers, setVoiceChannelPeers] = useState<Record<string, Array<{ pub: string; alias: string }>>>({})
  const [copiedServerId, setCopiedServerId] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const serverAvatarInputRef = useRef<HTMLInputElement>(null)

  const isNew = activeView.serverId === '__new__'
  const currentServer = servers.find((s) => s.id === activeView.serverId)
  const currentChannel = activeView.channelId
  const isOwner = currentServer?.owner === user?.pub
  const textChannels = currentServer?.channels.filter((c) => c.type === 'text') || []
  const voiceChannels = currentServer?.channels.filter((c) => c.type === 'voice') || []

  // Escutar mensagens do canal atual
  useEffect(() => {
    if (!currentServer || !currentChannel) return
    const channel = currentServer.channels.find((c) => c.id === currentChannel)
    if (!channel || channel.type !== 'text') return

    setMessages([])
    listenServerMessages(currentServer.id, currentChannel, (msgs) => {
      setMessages(msgs)
    })
  }, [currentServer?.id, currentChannel])

  // Buscar avatar do servidor
  useEffect(() => {
    if (!currentServer) return
    setServerAvatarState(null)
    getServerAvatar(currentServer.id, (av) => {
      if (av) setServerAvatarState(av)
    })
  }, [currentServer?.id])

  // Escutar membros do servidor
  useEffect(() => {
    if (!currentServer) return
    listenServerMembers(currentServer.id, (m) => setMembers(m))
  }, [currentServer?.id])

  // Escutar peers de voz em cada canal de voz
  useEffect(() => {
    if (!currentServer) return
    voiceChannels.forEach((ch) => {
      const path = `${currentServer.id}/${ch.id}`
      listenVoiceChannelPeers(path, (peers) => {
        setVoiceChannelPeers((prev) => ({ ...prev, [ch.id]: peers }))
      })
    })
  }, [currentServer?.id, voiceChannels.length])

  // Buscar avatares dos autores das mensagens
  useEffect(() => {
    const uniquePubs = [...new Set(messages.map((m) => m.from))]
    uniquePubs.forEach((pub) => {
      if (!avatarCache[pub]) {
        getProfileAvatar(pub, (av) => {
          if (av) setCachedAvatar(pub, av)
        })
      }
    })
  }, [messages])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleCreateServer(e: React.FormEvent) {
    e.preventDefault()
    if (!newServerName.trim()) return

    const serverId = await createServer(newServerName.trim())
    if (serverId) {
      setNewServerName('')
      setActiveView({ section: 'server', serverId, channelId: 'general' })
    }
  }

  async function handleJoinServer(e: React.FormEvent) {
    e.preventDefault()
    if (!joinServerId.trim()) return

    await joinServer(joinServerId.trim())
    setJoinServerId('')
    setActiveView({ section: 'server', serverId: joinServerId.trim(), channelId: 'general' })
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !currentServer || !currentChannel) return

    await sendServerMessage(currentServer.id, currentChannel, input.trim())
    setInput('')
  }

  function selectChannel(ch: Channel) {
    if (ch.type === 'text') {
      setActiveView({ section: 'server', serverId: currentServer!.id, channelId: ch.id })
    }
  }

  async function handleJoinVoice(channelId: string) {
    if (!currentServer) return
    const voicePath = `${currentServer.id}/${channelId}`

    if (inVoice) {
      await leaveVoiceChannel(voicePath)
      setInVoice(false)
      setLocalStream(null)
    }

    const stream = await joinVoiceChannel(voicePath)
    if (stream) {
      setInVoice(true, voicePath)
      setLocalStream(stream)
    }
  }

  function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newChannelName.trim() || !currentServer) return
    createServerChannel(currentServer.id, newChannelName.trim(), newChannelType)
    setNewChannelName('')
    setShowNewChannel(false)
  }

  function handleServerAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentServer) return
    if (file.size > 512 * 1024) {
      alert(t('user.imageTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setServerAvatar(currentServer.id, dataUrl)
      setServerAvatarState(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleBan(memberPub: string, memberAlias: string) {
    if (!currentServer) return
    if (!confirm(t('servers.confirmBan', { alias: memberAlias }))) return
    banServerMember(currentServer.id, memberPub)
  }

  function copyServerId() {
    if (!currentServer) return
    window.gamiumAPI.copyToClipboard(currentServer.id)
    setCopiedServerId(true)
    setTimeout(() => setCopiedServerId(false), 2000)
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
  }

  function getAvatar(pub: string, alias: string) {
    if (pub === user?.pub && myAvatar) {
      return <img src={myAvatar} alt="" className="avatar-img" />
    }
    if (avatarCache[pub]) {
      return <img src={avatarCache[pub]} alt="" className="avatar-img" />
    }
    return alias?.charAt(0).toUpperCase() || '?'
  }

  // ─── Tela de criar/entrar no servidor ─────────────────────────────
  if (isNew) {
    return (
      <div className="server-create-panel">
        <div className="panel-content centered">
          <h2>{t('servers.title')}</h2>

          <div className="create-section">
            <h3>{t('servers.createNew')}</h3>
            <form onSubmit={handleCreateServer} className="inline-form">
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder={t('servers.serverName')}
              />
              <button type="submit" className="btn-primary" disabled={!newServerName.trim()}>
                {t('servers.create')}
              </button>
            </form>
          </div>

          <div className="divider-text"><span>{t('servers.or')}</span></div>

          <div className="create-section">
            <h3>{t('servers.joinServer')}</h3>
            <p className="hint">{t('servers.pasteServerId')}</p>
            <form onSubmit={handleJoinServer} className="inline-form">
              <input
                type="text"
                value={joinServerId}
                onChange={(e) => setJoinServerId(e.target.value)}
                placeholder={t('servers.serverId')}
              />
              <button type="submit" className="btn-primary" disabled={!joinServerId.trim()}>
                {t('servers.join')}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ─── Servidor sem seleção ─────────────────────────────────────────
  if (!currentServer) {
    return (
      <div className="panel-content centered">
        <p>{t('servers.selectServer')}</p>
      </div>
    )
  }

  // ─── Visualização do servidor ─────────────────────────────────────
  return (
    <div className="server-view">
      {/* Sidebar do servidor (canais) */}
      <div className="channel-sidebar">
        <div className="channel-header">
          <div className="server-header-info">
            <div
              className={`server-header-avatar ${isOwner ? 'clickable' : ''}`}
              onClick={() => isOwner && serverAvatarInputRef.current?.click()}
              title={isOwner ? t('servers.changeServerAvatar') : currentServer.name}
            >
              {serverAvatar ? (
                <img src={serverAvatar} alt="" className="avatar-img" />
              ) : (
                currentServer.name.charAt(0).toUpperCase()
              )}
            </div>
            {isOwner && (
              <input
                ref={serverAvatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={handleServerAvatarUpload}
              />
            )}
            <h3>{currentServer.name}</h3>
          </div>
          <div className="server-header-actions">
            <button
              className="icon-btn small"
              title={copiedServerId ? t('login.copied') : t('servers.copyServerId')}
              onClick={copyServerId}
            >
              {copiedServerId ? '✓' : '📋'}
            </button>
            {isOwner && (
              <button
                className={`icon-btn small ${showMemberList ? 'active' : ''}`}
                title={t('servers.memberList')}
                onClick={() => setShowMemberList(!showMemberList)}
              >
                👥
              </button>
            )}
          </div>
        </div>

        <div className="channel-category">
          <span className="category-label">{t('servers.textChannels')}</span>
          {textChannels.map((ch) => (
            <button
              key={ch.id}
              className={`channel-item ${currentChannel === ch.id ? 'active' : ''}`}
              onClick={() => selectChannel(ch)}
            >
              <span className="channel-hash">#</span>
              {ch.name}
            </button>
          ))}
        </div>

        <div className="channel-category">
          <span className="category-label">{t('servers.voiceChannels')}</span>
          {voiceChannels.map((ch) => (
            <div key={ch.id} className="voice-channel-group">
              <button
                className="channel-item voice"
                onClick={() => handleJoinVoice(ch.id)}
              >
                <span className="channel-hash">🔊</span>
                {ch.name}
              </button>
              {/* Mostrar usuários conectados no canal de voz */}
              {voiceChannelPeers[ch.id] && voiceChannelPeers[ch.id].length > 0 && (
                <div className="voice-channel-users">
                  {voiceChannelPeers[ch.id].map((peer) => (
                    <div key={peer.pub} className="voice-channel-user">
                      <div className="voice-user-avatar-small">
                        {getAvatar(peer.pub, peer.alias)}
                      </div>
                      <span className="voice-user-name">
                        {peer.alias}{peer.pub === user?.pub ? ` ${t('servers.you')}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Adicionar canal (apenas dono) */}
        {isOwner && (
          <div className="add-channel">
            {showNewChannel ? (
              <form onSubmit={handleCreateChannel} className="add-channel-form">
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder={t('servers.channelName')}
                  autoFocus
                />
                <div className="channel-type-select">
                  <label>
                    <input
                      type="radio"
                      checked={newChannelType === 'text'}
                      onChange={() => setNewChannelType('text')}
                    />
                    {t('servers.text')}
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={newChannelType === 'voice'}
                      onChange={() => setNewChannelType('voice')}
                    />
                    {t('servers.voice')}
                  </label>
                </div>
                <div className="channel-form-actions">
                  <button type="submit" className="btn-small accept">✓</button>
                  <button type="button" className="btn-small reject" onClick={() => setShowNewChannel(false)}>✕</button>
                </div>
              </form>
            ) : (
              <button className="btn-link" onClick={() => setShowNewChannel(true)}>
                + {t('servers.createChannel')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Área de chat */}
      <div className="chat-panel">
        <div className="chat-header">
          <span className="chat-header-icon">#</span>
          <span className="chat-header-name">
            {currentServer.channels.find((c) => c.id === currentChannel)?.name || 'canal'}
          </span>
          <span className="chat-header-badge">{t('servers.encryptedServer')}</span>
          {!isOwner && (
            <button
              className={`icon-btn small member-list-toggle ${showMemberList ? 'active' : ''}`}
              title={t('servers.memberList')}
              onClick={() => setShowMemberList(!showMemberList)}
            >
              👥
            </button>
          )}
        </div>

        <div className="chat-body-wrapper">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <div className="chat-empty-icon">💬</div>
                <h3>{t('servers.welcomeChannel', { channel: currentServer.channels.find((c) => c.id === currentChannel)?.name || 'canal' })}</h3>
                <p>{t('servers.channelStart')}</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.from === user?.pub ? 'own' : ''}`}>
                <div className="message-avatar">
                  {getAvatar(msg.from, msg.fromAlias)}
                </div>
                <div className="message-body">
                  <div className="message-header">
                    <span className="message-author">{msg.fromAlias}</span>
                    <span className="message-time">{formatTime(msg.time)}</span>
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEnd} />
          </div>

          {/* Painel de membros */}
          {showMemberList && (
            <div className="member-list-panel">
              <div className="member-list-header">
                <h4>{t('servers.members', { count: members.length })}</h4>
              </div>
              <div className="member-list-content">
                {members.map((m) => (
                  <div key={m.pub} className="member-item">
                    <div className="member-avatar">
                      {getAvatar(m.pub, m.alias)}
                    </div>
                    <div className="member-info">
                      <span className="member-name">
                        {m.alias}
                        {m.role === 'owner' && <span className="member-badge owner">👑</span>}
                      </span>
                    </div>
                    {isOwner && m.pub !== user?.pub && (
                      <button
                        className="icon-btn small danger"
                        title={t('servers.ban', { alias: m.alias })}
                        onClick={() => handleBan(m.pub, m.alias)}
                      >
                        🚫
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form className="chat-input-container" onSubmit={handleSend}>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('servers.sendMessage', { channel: currentServer.channels.find((c) => c.id === currentChannel)?.name || 'canal' })}
          />
          <button type="submit" className="chat-send-btn" disabled={!input.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
