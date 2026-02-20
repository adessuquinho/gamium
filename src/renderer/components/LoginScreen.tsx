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
  const [appIcon, setAppIcon] = useState<string | null>(null)
  const [registeredIdentity, setRegisteredIdentity] = useState<{ alias: string; pub: string; epub: string } | null>(null)
  const [confirmSaved, setConfirmSaved] = useState(false)

  const passwordValid = password.length >= 16

  async function waitForCurrentUser(timeoutMs = 5000) {
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      const current = getCurrentUser()
      if (current?.pub) return current
      await new Promise((resolve) => setTimeout(resolve, 120))
    }

    return null
  }

  async function applyAuthenticatedUser(preferredAlias?: string) {
    let currentUser = await waitForCurrentUser(3500)

    if (!currentUser && alias.trim() && password) {
      const retry = await login(alias.trim(), password)
      if (retry.ok) {
        currentUser = await waitForCurrentUser(3500)
      }
    }

    if (!currentUser) return false

    setUser({
      alias: currentUser.alias || preferredAlias || alias.trim() || 'Usuário',
      pub: currentUser.pub,
      epub: currentUser.epub,
    })

    return true
  }

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
            // Capture identity from register result (captured immediately in auth callback)
            if (result.identity?.pub && result.identity?.epub) {
              setRegisteredIdentity({
                alias: result.identity.alias || alias.trim() || 'Usuário',
                pub: result.identity.pub,
                epub: result.identity.epub,
              })
            } else {
              // Fallback: poll Gun user.is (unlikely needed now)
              const currentUser = await waitForCurrentUser(3000)
              if (currentUser?.pub && currentUser?.epub) {
                setRegisteredIdentity({
                  alias: currentUser.alias || alias.trim() || 'Usuário',
                  pub: currentUser.pub,
                  epub: currentUser.epub,
                })
              }
            }
            console.log('[Gamium] Identity captured for post-registration:', !!result.identity?.pub)
            setRecoveryPhrase(result.recoveryPhrase)
          } else {
            const applied = await applyAuthenticatedUser(alias.trim())
            if (!applied) {
              setError(t('login.connectionError'))
            }
          }
        } else {
          if (isRegister && result.created && result.recoveryPhrase) {
            // Account was created but auth failed — still show recovery phrase
            // handleRecoveryPhraseDone will re-login automatically
            setRecoveryPhrase(result.recoveryPhrase)
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

  async function handleRecoveryPhraseDone() {
    setLoading(true)
    setError('')
    try {
      // Strategy 1: Use identity captured during registration
      if (registeredIdentity?.pub && registeredIdentity?.epub) {
        console.log('[Gamium] Entering app with registeredIdentity:', registeredIdentity.pub.slice(0, 12))
        setUser(registeredIdentity)
        return
      }

      // Strategy 2: Check if Gun user.is is already populated
      const currentUser = getCurrentUser()
      if (currentUser?.pub && currentUser?.epub) {
        console.log('[Gamium] Entering app with getCurrentUser:', currentUser.pub.slice(0, 12))
        setUser({
          alias: currentUser.alias || alias.trim() || 'Usuário',
          pub: currentUser.pub,
          epub: currentUser.epub,
        })
        return
      }

      // Strategy 3: Fresh login with credentials still in state
      if (alias.trim() && password) {
        console.log('[Gamium] Re-authenticating with stored credentials...')
        const loginResult = await login(alias.trim(), password)
        if (loginResult.ok) {
          await window.gamiumAPI.storage.setKey(password)
          const freshUser = await waitForCurrentUser(6000)
          if (freshUser?.pub && freshUser?.epub) {
            console.log('[Gamium] Entering app after re-login:', freshUser.pub.slice(0, 12))
            setUser({
              alias: freshUser.alias || alias.trim() || 'Usuário',
              pub: freshUser.pub,
              epub: freshUser.epub,
            })
            return
          }
        }
      }

      console.warn('[Gamium] All auth strategies failed in handleRecoveryPhraseDone')
      setError(t('login.connectionError'))
    } finally {
      setLoading(false)
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
                  checked={confirmSaved}
                  onChange={(e) => setConfirmSaved(e.target.checked)}
                />
                <span>{t('login.confirmSaved')}</span>
              </label>
              <button 
                className="btn-recovery-done btn-primary"
                onClick={handleRecoveryPhraseDone}
                disabled={!confirmSaved || loading}
              >
                {loading ? t('login.connecting') : t('login.continueApp')}
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
