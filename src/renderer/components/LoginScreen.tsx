import { useState } from 'react'
import { register, login, getCurrentUser, restoreWithRecoveryPhrase, getRecoveryPhrase } from '../network'
import { useAppStore } from '../store'

export default function LoginScreen() {
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

  const passwordValid = password.length >= 16

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!alias.trim()) {
      setError('Nome de usuário é obrigatório.')
      return
    }

    if (isRestore) {
      if (!recoveryInput.trim()) {
        setError('Frase de recuperação é obrigatória.')
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
          setError(result.error || 'Erro ao restaurar conta.')
        }
      } catch (err: any) {
        setError(err?.message || 'Erro de conexão.')
      } finally {
        setLoading(false)
      }
    } else {
      if (!passwordValid) {
        setError('A senha deve ter pelo menos 16 caracteres.')
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
            setError('Conta criada, mas houve falha ao entrar. Guarde a frase e faça login em seguida.')
          } else {
            setError(result.error || 'Erro desconhecido.')
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Erro de conexão.')
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
      setError('Conta criada. Agora faça login para continuar.')
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
      setError('Nenhuma recovery phrase foi encontrada neste dispositivo.')
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
              <h2>🔑 Sua Frase de Recuperação</h2>
              <p>Guarde em um lugar seguro!</p>
            </div>

            <div className="recovery-warning">
              <strong>⚠️ IMPORTANTE:</strong>
              <ul>
                <li>Escreva ou copie estas 12 palavras</li>
                <li>Guarde em um lugar SEGURO (papel, cofre, etc)</li>
                <li>Nunca compartilhe com ninguém</li>
                <li>Use para recuperar sua conta em outro dispositivo</li>
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
                {copiedRecovery ? '✓ Copiado!' : '📋 Copiar Palavras'}
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
                <span>Confirmo que guardei minha frase de recuperação em um lugar seguro</span>
              </label>
              <button 
                className="btn-recovery-done btn-primary"
                onClick={handleRecoveryPhraseDone}
                disabled
              >
                {pendingLoginAfterRecovery ? 'Continuar para Login' : 'Continuar para Gamium'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de Login/Registro */}
      {!recoveryPhrase && (
      <div className="login-card">
        <div className="login-logo">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="16" fill="#7c3aed" />
            <text x="32" y="42" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold" fontFamily="sans-serif">G</text>
          </svg>
          <h1 className="login-title">Gamium</h1>
          <p className="login-subtitle">Comunicação descentralizada e criptografada</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="alias">Nome de Usuário</label>
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
              <label htmlFor="recovery">Frase de Recuperação (12 palavras)</label>
              <textarea
                id="recovery"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="palavra1 palavra2 palavra3... (separadas por espaço)"
                disabled={loading}
                className="recovery-textarea"
              />
              <span className="form-hint">Cole suas 12 palavras de recuperação separadas por espaço</span>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="password">
                Senha <span className="label-hint">(mínimo 16 caracteres)</span>
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
            {loading ? 'Conectando...' : isRestore ? 'Restaurar Conta' : isRegister ? 'Criar Conta' : 'Entrar'}
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
              {isRestore ? 'Voltar' : isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
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
                  🔑 Restaurar com Recovery Phrase
                </button>
                <button
                  type="button"
                  className="btn-link secondary"
                  onClick={showSavedRecoveryPhrase}
                >
                  👁️ Ver recovery phrase deste dispositivo
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
                ← Voltar para Login
              </button>
            )}
          </div>
        </form>

        <div className="login-info">
          <div className="info-item">
            <span className="info-icon">🔐</span>
            <span>Criptografia ponta-a-ponta</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🌐</span>
            <span>Rede descentralizada P2P</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🔑</span>
            <span>Sua chave = sua identidade</span>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
