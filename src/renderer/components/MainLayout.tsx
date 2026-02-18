import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../store'
import { listenFriends, listenFriendRequests, listenUserServers, listenUserGroups, listenGroupInvites, acceptGroupInvite, logout, setProfileAvatar, getMyAvatar, getServerAvatar, getRecoveryPhrase, listenDMInbox } from '../network'
import ChatView from './ChatView'
import FriendsPanel from './FriendsPanel'
import ServersPanel from './ServersPanel'
import GroupsPanel from './GroupsPanel'
import VoicePanel from './VoicePanel'
import ScreenPicker from './ScreenPicker'
import { useI18n } from '../i18n'

export default function MainLayout() {
  const { t } = useI18n()
  const user = useAppStore((s) => s.user)
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const servers = useAppStore((s) => s.servers)
  const groups = useAppStore((s) => s.groups)
  const friends = useAppStore((s) => s.friends)
  const inVoice = useAppStore((s) => s.inVoice)
  const setFriends = useAppStore((s) => s.setFriends)
  const setServers = useAppStore((s) => s.setServers)
  const setGroups = useAppStore((s) => s.setGroups)
  const addFriendRequest = useAppStore((s) => s.addFriendRequest)
  const upsertDMInbox = useAppStore((s) => s.upsertDMInbox)

  const myAvatar = useAppStore((s) => s.myAvatar)
  const setMyAvatar = useAppStore((s) => s.setMyAvatar)
  const showScreenPicker = useAppStore((s) => s.showScreenPicker)

  const [showUserMenu, setShowUserMenu] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [serverAvatars, setServerAvatars] = useState<Record<string, string>>({})
  const avatarInputRef = useRef<HTMLInputElement>(null)
  

  // Listeners P2P
  useEffect(() => {
    listenFriends((f) => setFriends(f))
    listenFriendRequests((req) => addFriendRequest(req))
    listenDMInbox((item) => upsertDMInbox(item))
    listenUserServers((s) => setServers(s))
    listenUserGroups((g) => setGroups(g))
    listenGroupInvites((invite) => {
      // Auto-aceita convites de grupo (simplificado)
      acceptGroupInvite(invite.id, invite.name)
    })
    // Carregar avatar do usuário
    getMyAvatar((avatar) => {
      if (avatar) setMyAvatar(avatar)
    })
  }, [])


  // Carregar avatares dos servidores
  useEffect(() => {
    servers.forEach((srv) => {
      if (!serverAvatars[srv.id]) {
        getServerAvatar(srv.id, (av) => {
          if (av) setServerAvatars((prev) => ({ ...prev, [srv.id]: av }))
        })
      }
    })
  }, [servers])

  function copyUserId() {
    if (user) {
      window.gamiumAPI.copyToClipboard(user.pub)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  async function showRecoveryPhraseFromMenu() {
    const phrase = getRecoveryPhrase()
    if (!phrase) {
      alert(t('login.deviceRecoveryNotFound'))
      return
    }

    await window.gamiumAPI.copyToClipboard(phrase)
    alert(t('user.recoveryCopied'))
    setShowUserMenu(false)
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      alert(t('user.imageTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setProfileAvatar(dataUrl)
      setMyAvatar(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }


  return (
    <div className="main-layout">
      {/* ─── Barra lateral: servidores ─────────────────────────────────── */}
      <div className="server-bar">
        {/* Home / DMs / Amigos */}
        <button
          className={`server-icon home-icon ${activeView.section === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveView({ section: 'friends' })}
          title={t('nav.home')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3l9 7h-2v10h-5v-6H10v6H5V10H3l9-7z"/>
          </svg>
        </button>

        <div className="server-separator" />

        {/* Lista de servidores */}
        {servers.map((srv) => (
          <button
            key={srv.id}
            className={`server-icon ${activeView.section === 'server' && activeView.serverId === srv.id ? 'active' : ''}`}
            onClick={() => setActiveView({ section: 'server', serverId: srv.id, channelId: srv.channels[0]?.id })}
            title={srv.name}
          >
            {serverAvatars[srv.id] ? (
              <img src={serverAvatars[srv.id]} alt="" className="avatar-img" />
            ) : (
              srv.name.charAt(0).toUpperCase()
            )}
          </button>
        ))}

        {/* Grupos */}
        {groups.map((grp) => (
          <button
            key={grp.id}
            className={`server-icon group-icon ${activeView.section === 'group' && activeView.groupId === grp.id ? 'active' : ''}`}
            onClick={() => setActiveView({ section: 'group', groupId: grp.id })}
            title={grp.name}
          >
            {grp.name.charAt(0).toUpperCase()}
          </button>
        ))}

        <div className="server-separator" />

        {/* Botão criar servidor */}
        <button
          className="server-icon add-server"
          onClick={() => setActiveView({ section: 'server', serverId: '__new__' })}
          title={t('nav.createJoinServer')}
        >
          +
        </button>
      </div>

      {/* ─── Área de conteúdo ─────────────────────────────────────────── */}
      <div className="content-area">
        {activeView.section === 'friends' && <FriendsPanel />}
        {activeView.section === 'server' && <ServersPanel />}
        {activeView.section === 'group' && <GroupsPanel />}
        {activeView.section === 'dm' && <ChatView />}
      </div>

      {/* ─── Painel de voz (overlay inferior) ─────────────────────────── */}
      {inVoice && <VoicePanel />}

      {/* ─── Seletor de tela ──────────────────────────────────────────── */}
      {showScreenPicker && <ScreenPicker />}

      {/* ─── Barra inferior: perfil do usuário ────────────────────────── */}
      <div className="user-bar">
        <div className="user-info" onClick={() => setShowUserMenu(!showUserMenu)}>
          <div className="user-avatar">
            {myAvatar ? (
              <img src={myAvatar} alt="avatar" className="avatar-img" />
            ) : (
              user?.alias?.charAt(0).toUpperCase()
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
          <div className="user-details">
            <span className="user-name">{user?.alias}</span>
            <span className="user-status">{t('user.onlineP2p')}</span>
          </div>
        </div>

        {showUserMenu && (
          <div className="user-menu">
            <button onClick={() => avatarInputRef.current?.click()} className="menu-item">
              📷 {t('user.changeAvatar')}
            </button>
            <button onClick={copyUserId} className="menu-item">
              {copiedId ? `✓ ${t('login.copied')}` : `📋 ${t('user.copyId')}`}
            </button>
            <button onClick={showRecoveryPhraseFromMenu} className="menu-item">
              🔑 {t('user.recoverKeys')}
            </button>
            <button onClick={() => { logout(); setShowUserMenu(false) }} className="menu-item danger">
              🚪 {t('user.logout')}
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
