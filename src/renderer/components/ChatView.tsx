import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { sendDM, listenDMs, getProfileAvatar } from '../network'
import type { Message } from '../../shared/types'

export default function ChatView() {
  const activeView = useAppStore((s) => s.activeView)
  const messages = useAppStore((s) => s.messages)
  const setMessages = useAppStore((s) => s.setMessages)
  const user = useAppStore((s) => s.user)
  const friends = useAppStore((s) => s.friends)
  const myAvatar = useAppStore((s) => s.myAvatar)
  const avatarCache = useAppStore((s) => s.avatarCache)
  const setCachedAvatar = useAppStore((s) => s.setCachedAvatar)

  const [input, setInput] = useState('')
  const messagesEnd = useRef<HTMLDivElement>(null)

  const targetPub = activeView.dmPub || ''
  const friend = friends.find((f) => f.pub === targetPub)

  useEffect(() => {
    if (!targetPub) return
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
    if (!input.trim() || !targetPub) return

    await sendDM(targetPub, input.trim())
    setInput('')
  }

  function formatTime(ts: number) {
    const d = new Date(ts)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(ts: number) {
    const d = new Date(ts)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
        <span className="chat-header-name">{friend?.alias || 'Mensagem Direta'}</span>
        <span className="chat-header-badge">E2E Criptografado</span>
      </div>

      {/* Mensagens */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h3>Início da conversa com {friend?.alias || 'este usuário'}</h3>
            <p>Todas as mensagens são criptografadas ponta-a-ponta.</p>
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
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <form className="chat-input-container" onSubmit={handleSend}>
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Mensagem para ${friend?.alias || 'usuário'}...`}
          disabled={!targetPub}
        />
        <button type="submit" className="chat-send-btn" disabled={!input.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
