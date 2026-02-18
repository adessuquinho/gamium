import { useEffect, useState } from 'react'
import { useAppStore } from './store'
import { initGun } from './network'
import LoginScreen from './components/LoginScreen'
import MainLayout from './components/MainLayout'
import LanguageSwitcher from './components/LanguageSwitcher'
import { useI18n } from './i18n'

export default function App() {
  const user = useAppStore((s) => s.user)
  const { t, language, rtl } = useI18n()
  const BTC_WALLET = 'bc1q3qqgrcrtnsz9ch7weyj4nhks6kp9cdsn2dm5h4'
  const ETH_WALLET = '0x1BD4591757311e6b0aF06c1fDbCc6b0730BdC64F'
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [installPending, setInstallPending] = useState(false)
  const [copiedWallet, setCopiedWallet] = useState<'btc' | 'eth' | null>(null)

  useEffect(() => {
    initGun()
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
  }, [language, rtl])

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
    let cancelled = false

    async function checkUpdatesOnStart() {
      const result = await window.gamiumAPI.updates.checkForUpdates()
      if (cancelled) return

      if (result?.available) {
        setUpdateAvailable(true)
        if (result?.version) {
          setUpdateVersion(result.version)
        }
      } else if (result?.error) {
        setUpdateError(result.error)
        setTimeout(() => setUpdateError(''), 5000)
      }
    }

    const timer = setTimeout(checkUpdatesOnStart, 2000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!updateDownloaded || !installPending) return
    const timer = setTimeout(() => {
      window.gamiumAPI.updates.installUpdate()
    }, 900)
    return () => clearTimeout(timer)
  }, [updateDownloaded, installPending])

  async function startUpdateDownload() {
    const check = await window.gamiumAPI.updates.checkForUpdates()
    if (!check?.available) {
      setUpdateAvailable(false)
      setUpdateError(t('title.latestVersion'))
      setTimeout(() => setUpdateError(''), 5000)
      return
    }

    setShowUpdateModal(true)
    setInstallPending(true)
    setIsDownloading(true)
    const result = await window.gamiumAPI.updates.downloadUpdate()
    if (!result?.success) {
      setIsDownloading(false)
      setInstallPending(false)
      setUpdateError(result?.error || t('title.downloadUpdate'))
    }
  }

  async function copyWallet(type: 'btc' | 'eth') {
    const value = type === 'btc' ? BTC_WALLET : ETH_WALLET
    await window.gamiumAPI.copyToClipboard(value)
    setCopiedWallet(type)
    setTimeout(() => setCopiedWallet(null), 2000)
  }

  return (
    <div className="app-root">
      {/* Barra de título customizada */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-title">Gamium</span>
        </div>
        <div className="titlebar-actions">
          <LanguageSwitcher />
          <button className="titlebar-support-btn" onClick={() => setShowSupportModal(true)} title={t('support.title')}>
            {t('support.button')}
          </button>
          {(updateAvailable || updateDownloaded) && (
            <button
              className="titlebar-update-btn"
              onClick={() => setShowUpdateModal(true)}
              title={updateDownloaded ? t('title.updateReady') : t('title.downloadUpdate')}
            >
              {updateDownloaded ? t('title.updateReady') : t('title.downloadUpdate')}
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
              <strong>{updateDownloaded ? t('title.updateReady') : t('title.updateAvailable')}</strong>
              {!isDownloading && !updateDownloaded && (
                <button className="update-modal-close" onClick={() => setShowUpdateModal(false)}>✕</button>
              )}
            </div>

            <div className="update-modal-body">
              <p>{t('title.version', { version: updateVersion })}</p>
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
                  <button className="update-modal-download" onClick={startUpdateDownload}>{t('title.downloadNow')}</button>
                </div>
              )}
              {isDownloading && <p>{t('title.downloading')}</p>}
              {updateDownloaded && <p>{t('title.downloadedRestarting')}</p>}
            </div>
          </div>
        </div>
      )}

      {showSupportModal && (
        <div className="update-modal">
          <div className="update-modal-card support-modal-card">
            <div className="update-modal-header">
              <strong>{t('support.title')}</strong>
              <button className="update-modal-close" onClick={() => setShowSupportModal(false)}>✕</button>
            </div>

            <div className="update-modal-body">
              <p>{t('support.subtitle')}</p>

              <div className="wallet-card">
                <span className="wallet-label">BTC</span>
                <code className="wallet-value">{BTC_WALLET}</code>
                <button className="update-modal-download" onClick={() => copyWallet('btc')}>
                  {copiedWallet === 'btc' ? t('login.copied') : t('support.copyBtc')}
                </button>
              </div>

              <div className="wallet-card">
                <span className="wallet-label">ETH</span>
                <code className="wallet-value">{ETH_WALLET}</code>
                <button className="update-modal-download" onClick={() => copyWallet('eth')}>
                  {copiedWallet === 'eth' ? t('login.copied') : t('support.copyEth')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
