import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { sendDM, listenDMs, getProfileAvatar } from '../network'
import type { Message } from '../../shared/types'
import { useI18n } from '../i18n'

export default function ChatView() {
  const { t, language } = useI18n()
  const activeView = useAppStore((s) => s.activeView)
  const messages = useAppStore((s) => s.messages)
  const setMessages = useAppStore((s) => s.setMessages)
  const markDMRead = useAppStore((s) => s.markDMRead)
  const user = useAppStore((s) => s.user)
  const friends = useAppStore((s) => s.friends)
  const myAvatar = useAppStore((s) => s.myAvatar)
  const avatarCache = useAppStore((s) => s.avatarCache)
  const setCachedAvatar = useAppStore((s) => s.setCachedAvatar)

  const [input, setInput] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<{ type: 'image' | 'video'; dataUrl: string; fileName?: string } | null>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  const targetPub = activeView.dmPub || ''
  const friend = friends.find((f) => f.pub === targetPub)

  useEffect(() => {
    if (!targetPub) return
    markDMRead(targetPub)
    setMessages([])
    listenDMs(targetPub, (msgs) => {
      setMessages(msgs)
    })
    // Buscar avatar do amigo
    if (!avatarCache[targetPub]) {
      getProfileAvatar(targetPub, (av) => {
        if (av) setCachedAvatar(targetPub, av)
      })
    }
  }, [targetPub])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && !selectedMedia) || !targetPub) return

    await sendDM(targetPub, input.trim(), selectedMedia || undefined)
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

  function formatTime(ts: number) {
    const d = new Date(ts)
    return d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(ts: number) {
    const d = new Date(ts)
    return d.toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Agrupar mensagens por dia
  function groupByDay(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ''

    for (const msg of msgs) {
      const date = formatDate(msg.time)
      if (date !== currentDate) {
        currentDate = date
        groups.push({ date, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    }
    return groups
  }

  const grouped = groupByDay(messages)

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <span className="chat-header-icon">@</span>
        <span className="chat-header-name">{friend?.alias || t('chat.directMessage')}</span>
        <span className="chat-header-badge">{t('chat.encrypted')}</span>
      </div>

      {/* Mensagens */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h3>{t('chat.startConversation', { name: friend?.alias || t('chat.user') })}</h3>
            <p>{t('chat.allEncrypted')}</p>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.date}>
            <div className="chat-date-divider">
              <span>{group.date}</span>
            </div>
            {group.messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.from === user?.pub ? 'own' : ''}`}
              >
                <div className="message-avatar">
                  {msg.from === user?.pub && myAvatar ? (
                    <img src={myAvatar} alt="" className="avatar-img" />
                  ) : msg.from !== user?.pub && avatarCache[msg.from] ? (
                    <img src={avatarCache[msg.from]} alt="" className="avatar-img" />
                  ) : (
                    msg.fromAlias?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="message-body">
                  <div className="message-header">
                    <span className="message-author">{msg.fromAlias}</span>
                    <span className="message-time">{formatTime(msg.time)}</span>
                  </div>
                  {msg.mediaType === 'image' && msg.mediaUrl && (
                    <img className="message-media message-media-image" src={msg.mediaUrl} alt={msg.fileName || 'imagem'} />
                  )}
                  {msg.mediaType === 'video' && msg.mediaUrl && (
                    <video className="message-media message-media-video" src={msg.mediaUrl} controls preload="metadata" />
                  )}
                  {msg.text && <div className="message-text">{msg.text}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEnd} />
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

      {/* Input */}
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
          disabled={!targetPub}
        >
          📎
        </button>
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.messageTo', { name: friend?.alias || t('chat.user') })}
          disabled={!targetPub}
        />
        <button type="submit" className="chat-send-btn" disabled={!input.trim() && !selectedMedia}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
