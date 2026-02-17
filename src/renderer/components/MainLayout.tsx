import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../store'
import { listenFriends, listenFriendRequests, listenUserServers, listenUserGroups, listenGroupInvites, acceptGroupInvite, logout, setProfileAvatar, getMyAvatar, getServerAvatar } from '../network'
import ChatView from './ChatView'
import FriendsPanel from './FriendsPanel'
import ServersPanel from './ServersPanel'
import GroupsPanel from './GroupsPanel'
import VoicePanel from './VoicePanel'
import ScreenPicker from './ScreenPicker'

export default function MainLayout() {
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

  const myAvatar = useAppStore((s) => s.myAvatar)
  const setMyAvatar = useAppStore((s) => s.setMyAvatar)
  const showScreenPicker = useAppStore((s) => s.showScreenPicker)

  const [showUserMenu, setShowUserMenu] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [serverAvatars, setServerAvatars] = useState<Record<string, string>>({})
  const avatarInputRef = useRef<HTMLInputElement>(null)
  
  // Auto-update states
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [updateError, setUpdateError] = useState('')

  // Listeners P2P
  useEffect(() => {
    listenFriends((f) => setFriends(f))
    listenFriendRequests((req) => addFriendRequest(req))
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

  // Auto-update listeners
  useEffect(() => {
    window.gamiumAPI.updates.onUpdateAvailable((info) => {
      setUpdateAvailable(true)
      setUpdateVersion(info.version)
    })

    window.gamiumAPI.updates.onDownloadProgress((progress) => {
      setDownloadProgress(Math.floor(progress.percent))
    })

    window.gamiumAPI.updates.onUpdateDownloaded(() => {
      setUpdateDownloaded(true)
      setDownloadProgress(100)
    })

    window.gamiumAPI.updates.onUpdateError((error) => {
      setUpdateError(error.message)
      setTimeout(() => setUpdateError(''), 5000)
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

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      alert('Imagem muito grande. Máximo 512KB.')
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

  async function downloadUpdate() {
    await window.gamiumAPI.updates.downloadUpdate()
  }

  async function installUpdate() {
    await window.gamiumAPI.updates.installUpdate()
  }

  function dismissUpdate() {
    setUpdateAvailable(false)
    setUpdateDownloaded(false)
  }

  return (
    <div className="main-layout">
      {/* ─── Barra lateral: servidores ─────────────────────────────────── */}
      <div className="server-bar">
        {/* Home / DMs / Amigos */}
        <button
          className={`server-icon home-icon ${activeView.section === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveView({ section: 'friends' })}
          title="Início"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.15 2.86a2.89 2.89 0 00-4.07 0l-1.77 1.77a.5.5 0 000 .71l4.24 4.24a.5.5 0 00.71 0l1.77-1.77a2.89 2.89 0 000-4.07zM12.94 7l-9.47 9.47a1 1 0 00-.27.5l-.85 3.39a.5.5 0 00.6.6l3.39-.85a1 1 0 00.5-.27L16.32 10.36z"/>
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
          title="Criar/Entrar no Servidor"
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
            <span className="user-status">Online • P2P</span>
          </div>
        </div>

        {showUserMenu && (
          <div className="user-menu">
            <button onClick={() => avatarInputRef.current?.click()} className="menu-item">
              📷 Alterar Foto de Perfil
            </button>
            <button onClick={copyUserId} className="menu-item">
              {copiedId ? '✓ Copiado!' : '📋 Copiar Gamium ID'}
            </button>
            <button onClick={() => { logout(); setShowUserMenu(false) }} className="menu-item danger">
              🚪 Sair
            </button>
          </div>
        )}
      </div>

      {/* ─── Notificação de atualização ───────────────────────────────── */}
      {updateAvailable && !updateDownloaded && (
        <div className="update-notification">
          <div className="update-content">
            <strong>🎉 Nova versão disponível: v{updateVersion}</strong>
            {downloadProgress > 0 && (
              <div className="update-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${downloadProgress}%` }}></div>
                </div>
                <span>{downloadProgress}%</span>
              </div>
            )}
            <div className="update-actions">
              {downloadProgress === 0 && (
                <>
                  <button onClick={downloadUpdate} className="btn-primary">Baixar</button>
                  <button onClick={dismissUpdate} className="btn-secondary">Depois</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {updateDownloaded && (
        <div className="update-notification update-ready">
          <div className="update-content">
            <strong>✅ Atualização baixada!</strong>
            <p>Reinicie o Gamium para instalar a versão {updateVersion}</p>
            <div className="update-actions">
              <button onClick={installUpdate} className="btn-primary">Reiniciar Agora</button>
              <button onClick={dismissUpdate} className="btn-secondary">Depois</button>
            </div>
          </div>
        </div>
      )}

      {updateError && (
        <div className="update-notification update-error">
          <div className="update-content">
            <strong>⚠️ Erro ao atualizar</strong>
            <p>{updateError}</p>
          </div>
        </div>
      )}
    </div>
  )
}
