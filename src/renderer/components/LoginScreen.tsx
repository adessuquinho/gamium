import { useEffect, useState } from 'react'
import { register, login, getCurrentUser, restoreWithRecoveryPhrase, getRecoveryPhrase } from '../network'
import { useAppStore } from '../store'
import { useI18n } from '../i18n'

export default function LoginScreen() {
  const { t } = useI18n()
  const setUser = useAppStore((s) => s.setUser)
  const [alias, setAlias] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [isRestore, setIsRestore] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null)
  const [copiedRecovery, setCopiedRecovery] = useState(false)
  const [recoveryInput, setRecoveryInput] = useState('')
  const [pendingLoginAfterRecovery, setPendingLoginAfterRecovery] = useState(false)
  const [appIcon, setAppIcon] = useState<string | null>(null)

  const passwordValid = password.length >= 16

  useEffect(() => {
    let cancelled = false

    async function loadAppIcon() {
      try {
        const icon = await window.gamiumAPI.getAppIcon()
        if (!cancelled && icon) {
          setAppIcon(icon)
        }
      } catch {
        // Keep fallback logo if icon fails.
      }
    }

    loadAppIcon()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!alias.trim()) {
      setError(t('login.usernameRequired'))
      return
    }

    if (isRestore) {
      if (!recoveryInput.trim()) {
        setError(t('login.recoveryRequired'))
        return
      }
      setLoading(true)
      try {
        const result = await restoreWithRecoveryPhrase(alias.trim(), recoveryInput.trim())
        if (result.ok) {
          // Não configura storage key pq não sabemos a senha original
          // Mas salvamos a recovery phrase
          const currentUser = getCurrentUser()
          if (currentUser) {
            setUser({
              alias: currentUser.alias,
              pub: currentUser.pub,
              epub: currentUser.epub,
            })
          }
        } else {
          setError(result.error || t('login.errorUnknown'))
        }
      } catch (err: any) {
        setError(err?.message || t('login.connectionError'))
      } finally {
        setLoading(false)
      }
    } else {
      if (!passwordValid) {
        setError(t('login.passwordRequired'))
        return
      }

      setLoading(true)

      try {
        const result = isRegister
          ? await register(alias.trim(), password)
          : await login(alias.trim(), password)

        if (result.ok) {
          // Configura chave de criptografia local
          await window.gamiumAPI.storage.setKey(password)

          // Se for novo registro, mostra recovery phrase
          if (isRegister && result.recoveryPhrase) {
            setRecoveryPhrase(result.recoveryPhrase)
          } else {
            const currentUser = getCurrentUser()
            if (currentUser) {
              setUser({
                alias: currentUser.alias,
                pub: currentUser.pub,
                epub: currentUser.epub,
              })
            }
          }
        } else {
          if (isRegister && result.created && result.recoveryPhrase) {
            setPendingLoginAfterRecovery(true)
            setRecoveryPhrase(result.recoveryPhrase)
            setError(t('login.accountCreatedLoginNow'))
          } else {
            setError(result.error || t('login.errorUnknown'))
          }
        }
      } catch (err: any) {
        setError(err?.message || t('login.connectionError'))
      } finally {
        setLoading(false)
      }
    }
  }

  async function copyRecoveryPhrase() {
    if (recoveryPhrase) {
      await window.gamiumAPI.copyToClipboard(recoveryPhrase)
      setCopiedRecovery(true)
      setTimeout(() => setCopiedRecovery(false), 2000)
    }
  }

  function handleRecoveryPhraseDone() {
    if (pendingLoginAfterRecovery) {
      setPendingLoginAfterRecovery(false)
      setRecoveryPhrase(null)
      setIsRegister(false)
      setError(t('login.accountCreatedLoginNow'))
      return
    }

    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser({
        alias: currentUser.alias,
        pub: currentUser.pub,
        epub: currentUser.epub,
      })
    }
  }

  function showSavedRecoveryPhrase() {
    const savedPhrase = getRecoveryPhrase()
    if (!savedPhrase) {
      setError(t('login.deviceRecoveryNotFound'))
      return
    }
    setRecoveryPhrase(savedPhrase)
    setError('')
  }

  return (
    <div className="login-container">
      {/* Tela de Recovery Phrase */}
      {recoveryPhrase && (
        <div className="recovery-overlay">
          <div className="recovery-card">
            <div className="recovery-header">
              <h2>🔑 {t('login.recoveryTitle')}</h2>
              <p>{t('login.recoverySafe')}</p>
            </div>

            <div className="recovery-warning">
              <strong>⚠️ {t('login.recoveryImportant')}</strong>
              <ul>
                <li>{t('login.recoveryStep1')}</li>
                <li>{t('login.recoveryStep2')}</li>
                <li>{t('login.recoveryStep3')}</li>
                <li>{t('login.recoveryStep4')}</li>
              </ul>
            </div>

            <div className="recovery-phrase-box">
              <div className="phrase-words">
                {recoveryPhrase.split(' ').map((word, idx) => (
                  <div key={idx} className="phrase-word">
                    <span className="word-index">{idx + 1}</span>
                    <span className="word-text">{word}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="recovery-actions">
              <button 
                onClick={copyRecoveryPhrase}
                className="btn-secondary"
              >
                {copiedRecovery ? `✓ ${t('login.copied')}` : `📋 ${t('login.copyWords')}`}
              </button>
            </div>

            <div className="recovery-confirmation">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  required
                  onChange={(e) => {
                    // Habilitará o botão quando clicado
                    const btn = document.querySelector('.btn-recovery-done') as HTMLButtonElement
                    if (btn) btn.disabled = !e.target.checked
                  }}
                />
                <span>{t('login.confirmSaved')}</span>
              </label>
              <button 
                className="btn-recovery-done btn-primary"
                onClick={handleRecoveryPhraseDone}
                disabled
              >
                {pendingLoginAfterRecovery ? t('login.continueLogin') : t('login.continueApp')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de Login/Registro */}
      {!recoveryPhrase && (
      <div className="login-card">
        <div className="login-logo">
          {appIcon ? (
            <img src={appIcon} alt="Gamium" className="login-app-icon" />
          ) : (
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="16" fill="#7c3aed" />
              <text x="32" y="42" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold" fontFamily="sans-serif">G</text>
            </svg>
          )}
          <h1 className="login-title">Gamium</h1>
          <p className="login-subtitle">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="alias">{t('login.username')}</label>
            <input
              id="alias"
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="seu_nome"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          {isRestore ? (
            <div className="form-group">
              <label htmlFor="recovery">{t('login.recovery')}</label>
              <textarea
                id="recovery"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="palavra1 palavra2 palavra3..."
                disabled={loading}
                className="recovery-textarea"
              />
              <span className="form-hint">{t('login.recoveryHint')}</span>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="password">
                {t('login.password')} <span className="label-hint">({t('login.minChars')})</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                disabled={loading}
              />
              <div className="password-strength">
                <div
                  className={`password-bar ${password.length >= 16 ? 'strong' : password.length >= 8 ? 'medium' : 'weak'}`}
                  style={{ width: `${Math.min(100, (password.length / 16) * 100)}%` }}
                />
              </div>
              <span className="char-count">{password.length}/16+</span>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || (!isRestore && !passwordValid)}
          >
            {loading ? t('login.connecting') : isRestore ? t('login.restoreAccount') : isRegister ? t('login.createAccount') : t('login.signIn')}
          </button>

          <div className="login-links">
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setIsRestore(false)
                setIsRegister(!isRegister)
                setError('')
              }}
            >
              {isRestore ? t('login.back') : isRegister ? t('login.haveAccount') : t('login.noAccount')}
            </button>
            
            {!isRegister && !isRestore && (
              <>
                <button
                  type="button"
                  className="btn-link secondary"
                  onClick={() => {
                    setIsRestore(true)
                    setError('')
                  }}
                >
                  🔑 {t('login.restore')}
                </button>
                <button
                  type="button"
                  className="btn-link secondary"
                  onClick={showSavedRecoveryPhrase}
                >
                  👁️ {t('login.viewLocalRecovery')}
                </button>
              </>
            )}
            
            {isRestore && (
              <button
                type="button"
                className="btn-link secondary"
                onClick={() => {
                  setIsRestore(false)
                  setRecoveryInput('')
                  setError('')
                }}
              >
                ← {t('login.backToLogin')}
              </button>
            )}
          </div>
        </form>

        <div className="login-info">
          <div className="info-item">
            <span className="info-icon">🔐</span>
            <span>{t('login.e2e')}</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🌐</span>
            <span>{t('login.p2p')}</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🔑</span>
            <span>{t('login.identity')}</span>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
