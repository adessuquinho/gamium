import { useEffect, useState } from 'react'
import { useAppStore } from './store'
import { initGun } from './network'
import LoginScreen from './components/LoginScreen'
import MainLayout from './components/MainLayout'

export default function App() {
  const user = useAppStore((s) => s.user)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [installPending, setInstallPending] = useState(false)

  useEffect(() => {
    initGun()
  }, [])

  useEffect(() => {
    window.gamiumAPI.updates.onUpdateAvailable((info) => {
      setUpdateAvailable(true)
      setUpdateVersion(info.version)
      setUpdateDownloaded(false)
      setDownloadProgress(0)
    })

    window.gamiumAPI.updates.onUpdateNotAvailable(() => {
      setUpdateAvailable(false)
    })

    window.gamiumAPI.updates.onDownloadProgress((progress) => {
      setDownloadProgress(Math.floor(progress.percent))
    })

    window.gamiumAPI.updates.onUpdateDownloaded(() => {
      setUpdateDownloaded(true)
      setDownloadProgress(100)
      setIsDownloading(false)
    })

    window.gamiumAPI.updates.onUpdateError((error) => {
      setUpdateError(error.message)
      setIsDownloading(false)
      setTimeout(() => setUpdateError(''), 5000)
    })
  }, [])

  useEffect(() => {
    if (!updateDownloaded || !installPending) return
    const timer = setTimeout(() => {
      window.gamiumAPI.updates.installUpdate()
    }, 900)
    return () => clearTimeout(timer)
  }, [updateDownloaded, installPending])

  async function startUpdateDownload() {
    setShowUpdateModal(true)
    setInstallPending(true)
    setIsDownloading(true)
    const result = await window.gamiumAPI.updates.downloadUpdate()
    if (!result?.success) {
      setIsDownloading(false)
      setInstallPending(false)
      setUpdateError(result?.error || 'Falha ao baixar atualização.')
    }
  }

  return (
    <div className="app-root">
      {/* Barra de título customizada */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-title">Gamium</span>
        </div>
        <div className="titlebar-actions">
          {(updateAvailable || updateDownloaded) && (
            <button
              className="titlebar-update-btn"
              onClick={() => setShowUpdateModal(true)}
              title={updateDownloaded ? 'Atualização pronta para instalar' : 'Baixar atualização'}
            >
              {updateDownloaded ? 'Atualizar' : 'Baixar Update'}
            </button>
          )}
        </div>
        <div className="titlebar-controls">
          <button onClick={() => window.gamiumAPI.window.minimize()} className="titlebar-btn">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="2" fill="currentColor"/></svg>
          </button>
          <button onClick={() => window.gamiumAPI.window.maximize()} className="titlebar-btn">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button onClick={() => window.gamiumAPI.window.close()} className="titlebar-btn titlebar-close">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="app-content">
        {user ? <MainLayout /> : <LoginScreen />}
      </div>

      {showUpdateModal && (
        <div className="update-modal">
          <div className="update-modal-card">
            <div className="update-modal-header">
              <strong>Atualizacao {updateDownloaded ? 'pronta' : 'disponivel'}</strong>
              {!isDownloading && !updateDownloaded && (
                <button className="update-modal-close" onClick={() => setShowUpdateModal(false)}>✕</button>
              )}
            </div>

            <div className="update-modal-body">
              <p>Versao: v{updateVersion}</p>
              {(isDownloading || updateDownloaded) && (
                <div className="update-modal-progress">
                  <div className="update-modal-bar">
                    <div className="update-modal-fill" style={{ width: `${downloadProgress}%` }}></div>
                  </div>
                  <span>{downloadProgress}%</span>
                </div>
              )}
              {updateError && <div className="update-modal-error">{updateError}</div>}
              {!isDownloading && !updateDownloaded && (
                <div className="update-modal-actions">
                  <button className="update-modal-download" onClick={startUpdateDownload}>Baixar agora</button>
                </div>
              )}
              {isDownloading && <p>Baixando atualizacao...</p>}
              {updateDownloaded && <p>Atualizacao baixada. Reiniciando...</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
