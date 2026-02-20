import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import {
  createServer,
  joinServer,
  leaveServer,
  serverExists,
  sendServerMessage,
  listenServerMessages,
  createServerChannel,
  renameServerChannel,
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
  const [selectedMedia, setSelectedMedia] = useState<{ type: 'image' | 'video'; dataUrl: string; fileName?: string } | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [newServerName, setNewServerName] = useState('')
  const [joinServerId, setJoinServerId] = useState('')
  const [showMemberList, setShowMemberList] = useState(false)
  const [showServerMenu, setShowServerMenu] = useState(false)
  const [members, setMembers] = useState<ServerMember[]>([])
  const [serverAvatar, setServerAvatarState] = useState<string | null>(null)
  const [voiceChannelPeers, setVoiceChannelPeers] = useState<Record<string, Array<{ pub: string; alias: string }>>>({})
  const [copiedServerId, setCopiedServerId] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const serverAvatarInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const serverMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!serverMenuRef.current) return
      if (!serverMenuRef.current.contains(event.target as Node)) {
        setShowServerMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

    const targetId = joinServerId.trim()
    const exists = await serverExists(targetId)
    if (!exists) {
      alert(t('servers.notFound'))
      return
    }

    await joinServer(targetId)
    setJoinServerId('')
    setActiveView({ section: 'server', serverId: targetId, channelId: 'general' })
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && !selectedMedia) || !currentServer || !currentChannel) return

    await sendServerMessage(currentServer.id, currentChannel, input.trim(), selectedMedia || undefined)
    setInput('')
    setSelectedMedia(null)
  }

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Selecione apenas imagem ou vídeo.')
      e.target.value = ''
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('Arquivo muito grande. Limite de 15MB.')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setSelectedMedia({
        type: file.type.startsWith('video/') ? 'video' : 'image',
        dataUrl,
        fileName: file.name,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
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

  function handleCreateChannel(type: 'text' | 'voice') {
    if (!isOwner || !currentServer) return
    const nextName = window.prompt(type === 'text' ? 'Nome do canal de texto:' : 'Nome do canal de voz:')
    if (!nextName || !nextName.trim()) return
    createServerChannel(currentServer.id, nextName.trim(), type)
    setShowServerMenu(false)
  }

  function handleRenameChannel(channel: Channel) {
    if (!isOwner || !currentServer) return
    const nextName = window.prompt('Novo nome do canal:', channel.name)
    if (!nextName || !nextName.trim() || nextName.trim() === channel.name) return
    renameServerChannel(currentServer.id, channel.id, nextName.trim(), channel.type)
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
    setShowServerMenu(false)
    setTimeout(() => setCopiedServerId(false), 2000)
  }

  async function handleLeaveServer() {
    if (!currentServer) return
    if (!confirm(t('servers.confirmLeave', { name: currentServer.name }))) return

    await leaveServer(currentServer.id)
    setShowServerMenu(false)
    setActiveView({ section: 'friends' })
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
          <div className="server-header-actions" ref={serverMenuRef}>
            <button
              className={`icon-btn small ${showServerMenu ? 'active' : ''}`}
              title="Menu do servidor"
              onClick={() => setShowServerMenu((prev) => !prev)}
            >
              ⋯
            </button>

            {showServerMenu && (
              <div className="server-dropdown-menu">
                <button className="server-dropdown-item" onClick={copyServerId}>
                  {copiedServerId ? `✓ ${t('login.copied')}` : `📋 ${t('servers.copyServerId')}`}
                </button>
                <button
                  className={`server-dropdown-item ${showMemberList ? 'active' : ''}`}
                  onClick={() => {
                    setShowMemberList(!showMemberList)
                    setShowServerMenu(false)
                  }}
                >
                  👥 {t('servers.memberList')}
                </button>

                {isOwner && (
                  <>
                    <div className="server-dropdown-divider" />
                    <button className="server-dropdown-item" onClick={() => handleCreateChannel('text')}>
                      + {t('servers.createChannel')} ({t('servers.text')})
                    </button>
                    <button className="server-dropdown-item" onClick={() => handleCreateChannel('voice')}>
                      + {t('servers.createChannel')} ({t('servers.voice')})
                    </button>
                  </>
                )}

                <div className="server-dropdown-divider" />
                <button className="server-dropdown-item danger" onClick={handleLeaveServer}>
                  🚪 {t('servers.leave')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="channel-category">
          <span className="category-label">{t('servers.textChannels')}</span>
          {textChannels.map((ch) => (
            <div key={ch.id} className="channel-row">
              <button
                className={`channel-item ${currentChannel === ch.id ? 'active' : ''}`}
                onClick={() => selectChannel(ch)}
              >
                <span className="channel-hash">#</span>
                {ch.name}
              </button>
              {isOwner && (
                <button
                  className="icon-btn small channel-edit-btn"
                  title="Editar nome do canal"
                  onClick={() => handleRenameChannel(ch)}
                >
                  ✎
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="channel-category">
          <span className="category-label">{t('servers.voiceChannels')}</span>
          {voiceChannels.map((ch) => (
            <div key={ch.id} className="voice-channel-group">
              <div className="channel-row">
                <button
                  className="channel-item voice"
                  onClick={() => handleJoinVoice(ch.id)}
                >
                  <span className="channel-hash">🔊</span>
                  {ch.name}
                </button>
                {isOwner && (
                  <button
                    className="icon-btn small channel-edit-btn"
                    title="Editar nome do canal"
                    onClick={() => handleRenameChannel(ch)}
                  >
                    ✎
                  </button>
                )}
              </div>
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

      </div>

      {/* Área de chat */}
      <div className="chat-panel">
        <div className="chat-header">
          <span className="chat-header-icon">#</span>
          <span className="chat-header-name">
            {currentServer.channels.find((c) => c.id === currentChannel)?.name || 'canal'}
          </span>
          <span className="chat-header-badge">{t('servers.encryptedServer')}</span>
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
                  {msg.mediaType === 'image' && msg.mediaUrl && (
                    <img
                      className="message-media message-media-image clickable"
                      src={msg.mediaUrl}
                      alt={msg.fileName || 'imagem'}
                      onClick={() => setLightboxImage(msg.mediaUrl || null)}
                    />
                  )}
                  {msg.mediaType === 'video' && msg.mediaUrl && (
                    <video className="message-media message-media-video" src={msg.mediaUrl} controls preload="metadata" />
                  )}
                  {msg.text && <div className="message-text">{msg.text}</div>}
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

        {selectedMedia && (
          <div className="chat-media-preview">
            {selectedMedia.type === 'image' ? (
              <img src={selectedMedia.dataUrl} alt={selectedMedia.fileName || 'preview'} className="chat-media-preview-content" />
            ) : (
              <video src={selectedMedia.dataUrl} className="chat-media-preview-content" controls preload="metadata" />
            )}
            <button
              type="button"
              className="chat-media-remove-btn"
              onClick={() => setSelectedMedia(null)}
              title="Remover anexo"
            >
              ✕
            </button>
          </div>
        )}

        <form className="chat-input-container" onSubmit={handleSend}>
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleMediaSelect}
          />
          <button
            type="button"
            className="chat-attach-btn"
            onClick={() => mediaInputRef.current?.click()}
            title="Anexar imagem/vídeo"
          >
            📎
          </button>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('servers.sendMessage', { channel: currentServer.channels.find((c) => c.id === currentChannel)?.name || 'canal' })}
          />
          <button type="submit" className="chat-send-btn" disabled={!input.trim() && !selectedMedia}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>

        {lightboxImage && (
          <div className="media-lightbox" onClick={() => setLightboxImage(null)}>
            <img
              src={lightboxImage}
              alt="Imagem ampliada"
              className="media-lightbox-image"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  )
}
