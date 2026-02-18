import { useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { sendFriendRequest, acceptFriendRequest, removeFriend, lookupUser, getProfileAvatar } from '../network'
import { useI18n } from '../i18n'

export default function FriendsPanel() {
  const { t } = useI18n()
  const friends = useAppStore((s) => s.friends)
  const friendRequests = useAppStore((s) => s.friendRequests)
  const removeFriendRequest = useAppStore((s) => s.removeFriendRequest)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const user = useAppStore((s) => s.user)
  const avatarCache = useAppStore((s) => s.avatarCache)
  const setCachedAvatar = useAppStore((s) => s.setCachedAvatar)

  const [tab, setTab] = useState<'online' | 'all' | 'requests' | 'add'>('all')
  const [friendId, setFriendId] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Buscar avatares de todos os amigos
  useEffect(() => {
    friends.forEach((f) => {
      if (!avatarCache[f.pub]) {
        getProfileAvatar(f.pub, (av) => {
          if (av) setCachedAvatar(f.pub, av)
        })
      }
    })
  }, [friends])

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddSuccess('')

    if (!friendId.trim()) {
      setAddError(t('friends.errorPasteId'))
      return
    }

    if (friendId.trim() === user?.pub) {
      setAddError(t('friends.errorSelf'))
      return
    }

    setLoading(true)
    try {
      const found = await lookupUser(friendId.trim())
      if (!found) {
        setAddError(t('friends.errorNotFound'))
        setLoading(false)
        return
      }

      await sendFriendRequest(friendId.trim())
      setAddSuccess(t('friends.requestSent', { alias: found.alias }))
      setFriendId('')
    } catch {
      setAddError(t('friends.errorSend'))
    }
    setLoading(false)
  }

  async function handleAccept(pub: string) {
    await acceptFriendRequest(pub)
    removeFriendRequest(pub)
  }

  function openDM(pub: string) {
    setActiveView({ section: 'dm', dmPub: pub })
  }

  return (
    <div className="friends-panel">
      {/* Sidebar de navegação */}
      <div className="panel-sidebar">
        <div className="panel-sidebar-header">
          <h2>{t('friends.title')}</h2>
        </div>

        <div className="panel-tabs">
          <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            {t('friends.all')}
          </button>
          <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
            {t('friends.pending')}
            {friendRequests.length > 0 && <span className="badge">{friendRequests.length}</span>}
          </button>
          <button className={`tab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>
            {t('friends.add')}
          </button>
        </div>

        {/* Seu ID */}
        <div className="my-id-section">
          <span className="my-id-label">{t('friends.yourId')}</span>
          <code className="my-id-value" onClick={() => window.gamiumAPI.copyToClipboard(user?.pub || '')}>
            {user?.pub?.slice(0, 20)}...
          </code>
          <span className="copy-hint">{t('friends.clickCopy')}</span>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="panel-content">
        {/* Todos os amigos */}
        {tab === 'all' && (
          <div className="friends-list">
            <h3 className="list-header">{t('friends.total', { count: friends.length })}</h3>
            {friends.length === 0 && (
              <div className="empty-state">
                <p>{t('friends.empty')}</p>
              </div>
            )}
            {friends.map((f) => (
              <div key={f.pub} className="friend-item">
                <div className="friend-avatar">
                  {avatarCache[f.pub] ? (
                    <img src={avatarCache[f.pub]} alt="" className="avatar-img" />
                  ) : (
                    f.alias?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="friend-info">
                  <span className="friend-name">{f.alias}</span>
                  <span className="friend-id">{f.pub.slice(0, 16)}...</span>
                </div>
                <div className="friend-actions">
                  <button className="icon-btn" title={t('friends.msg')} onClick={() => openDM(f.pub)}>
                    💬
                  </button>
                  <button
                    className="icon-btn danger"
                    title={t('friends.remove')}
                    onClick={() => removeFriend(f.pub)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Solicitações pendentes */}
        {tab === 'requests' && (
          <div className="friends-list">
            <h3 className="list-header">{t('friends.pendingTitle', { count: friendRequests.length })}</h3>
            {friendRequests.length === 0 && (
              <div className="empty-state">
                <p>{t('friends.pendingEmpty')}</p>
              </div>
            )}
            {friendRequests.map((req) => (
              <div key={req.from} className="friend-item request">
                <div className="friend-avatar">{req.alias?.charAt(0).toUpperCase()}</div>
                <div className="friend-info">
                  <span className="friend-name">{req.alias}</span>
                  <span className="friend-id">{req.from.slice(0, 16)}...</span>
                </div>
                <div className="friend-actions">
                  <button className="btn-small accept" onClick={() => handleAccept(req.from)}>
                    ✓ {t('friends.accept')}
                  </button>
                  <button
                    className="btn-small reject"
                    onClick={() => removeFriendRequest(req.from)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar amigo */}
        {tab === 'add' && (
          <div className="add-friend-section">
            <h3 className="list-header">{t('friends.addTitle')}</h3>
            <p className="add-friend-desc">
              {t('friends.addDesc')}
            </p>

            <form onSubmit={handleAddFriend} className="add-friend-form">
              <input
                type="text"
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                placeholder={t('friends.addPlaceholder')}
                disabled={loading}
              />
              <button type="submit" className="btn-primary" disabled={loading || !friendId.trim()}>
                {loading ? t('friends.searching') : t('friends.sendRequest')}
              </button>
            </form>

            {addError && <div className="form-error">{addError}</div>}
            {addSuccess && <div className="form-success">{addSuccess}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
