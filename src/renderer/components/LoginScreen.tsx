import { useState } from 'react'
import { register, login, getCurrentUser } from '../network'
import { useAppStore } from '../store'

export default function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser)
  const [alias, setAlias] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordValid = password.length >= 16

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!alias.trim()) {
      setError('Nome de usuário é obrigatório.')
      return
    }
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

        const currentUser = getCurrentUser()
        if (currentUser) {
          setUser({
            alias: currentUser.alias,
            pub: currentUser.pub,
            epub: currentUser.epub,
          })
        }
      } else {
        setError(result.error || 'Erro desconhecido.')
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
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

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading || !passwordValid}>
            {loading ? 'Conectando...' : isRegister ? 'Criar Conta' : 'Entrar'}
          </button>

          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
            }}
          >
            {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
          </button>
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
    </div>
  )
}
