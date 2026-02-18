import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { createGroup, sendGroupMessage, listenGroupMessages } from '../network'
import type { Message } from '../../shared/types'
import { useI18n } from '../i18n'

export default function GroupsPanel() {
  const { t } = useI18n()
  const activeView = useAppStore((s) => s.activeView)
  const groups = useAppStore((s) => s.groups)
  const friends = useAppStore((s) => s.friends)
  const user = useAppStore((s) => s.user)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const messagesEnd = useRef<HTMLDivElement>(null)

  const currentGroup = groups.find((g) => g.id === activeView.groupId)

  useEffect(() => {
    if (!currentGroup) return
    setMessages([])
    listenGroupMessages(currentGroup.id, (msgs) => {
      setMessages(msgs)
    })
  }, [currentGroup?.id])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !currentGroup) return

    await sendGroupMessage(currentGroup.id, input.trim())
    setInput('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim() || selectedMembers.length === 0) return

    await createGroup(groupName.trim(), selectedMembers)
    setGroupName('')
    setSelectedMembers([])
    setShowCreate(false)
  }

  function toggleMember(pub: string) {
    setSelectedMembers((prev) =>
      prev.includes(pub) ? prev.filter((p) => p !== pub) : [...prev, pub]
    )
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  // Sem grupo selecionado → lista de grupos + criar
  if (!currentGroup) {
    return (
      <div className="groups-panel">
        <div className="panel-sidebar">
          <div className="panel-sidebar-header">
            <h2>{t('groups.title')}</h2>
            <button className="icon-btn" onClick={() => setShowCreate(!showCreate)}>+</button>
          </div>

          {groups.length === 0 && !showCreate && (
            <div className="empty-state small">
              <p>{t('groups.none')}</p>
            </div>
          )}

          {groups.map((g) => (
            <button
              key={g.id}
              className="channel-item"
              onClick={() => useAppStore.getState().setActiveView({ section: 'group', groupId: g.id })}
            >
              <span className="channel-hash">👥</span>
              {g.name}
              <span className="member-count">{g.members.length}</span>
            </button>
          ))}
        </div>

        <div className="panel-content centered">
          {showCreate ? (
            <div className="create-section">
              <h3>{t('groups.createTitle')}</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>{t('groups.groupName')}</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder={t('groups.groupPlaceholder')}
                  />
                </div>

                <div className="form-group">
                  <label>{t('groups.selectMembers')}</label>
                  <div className="member-select-list">
                    {friends.length === 0 && (
                      <p className="hint">{t('groups.addFriendsFirst')}</p>
                    )}
                    {friends.map((f) => (
                      <label key={f.pub} className="member-option">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(f.pub)}
                          onChange={() => toggleMember(f.pub)}
                        />
                        <span className="friend-avatar small">{f.alias?.charAt(0).toUpperCase()}</span>
                        <span>{f.alias}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={!groupName.trim() || selectedMembers.length === 0}>
                    {t('groups.create')}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                    {t('groups.cancel')}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="chat-empty">
              <div className="chat-empty-icon">👥</div>
              <h3>{t('groups.title')}</h3>
              <p>{t('groups.selectOrCreate')}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Grupo selecionado → chat
  return (
    <div className="groups-panel">
      <div className="panel-sidebar">
        <div className="panel-sidebar-header">
          <h2>{t('groups.title')}</h2>
          <button className="icon-btn" onClick={() => setShowCreate(!showCreate)}>+</button>
        </div>

        {groups.map((g) => (
          <button
            key={g.id}
            className={`channel-item ${g.id === currentGroup.id ? 'active' : ''}`}
            onClick={() => useAppStore.getState().setActiveView({ section: 'group', groupId: g.id })}
          >
            <span className="channel-hash">👥</span>
            {g.name}
            <span className="member-count">{g.members.length}</span>
          </button>
        ))}
      </div>

      <div className="chat-panel">
        <div className="chat-header">
          <span className="chat-header-icon">👥</span>
          <span className="chat-header-name">{currentGroup.name}</span>
          <span className="chat-header-badge">{t('groups.encrypted', { count: currentGroup.members.length })}</span>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon">💬</div>
              <h3>{t('groups.start', { name: currentGroup.name })}</h3>
              <p>{t('groups.encryptedMessages')}</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.from === user?.pub ? 'own' : ''}`}>
              <div className="message-avatar">{msg.fromAlias?.charAt(0).toUpperCase() || '?'}</div>
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

        <form className="chat-input-container" onSubmit={handleSend}>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('groups.messageIn', { name: currentGroup.name })}
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
