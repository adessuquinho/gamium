import { useEffect } from 'react'
import { useAppStore } from './store'
import { initGun } from './network'
import LoginScreen from './components/LoginScreen'
import MainLayout from './components/MainLayout'

export default function App() {
  const user = useAppStore((s) => s.user)

  useEffect(() => {
    initGun()
  }, [])

  return (
    <div className="app-root">
      {/* Barra de título customizada */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-title">Gamium</span>
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
    </div>
  )
}
