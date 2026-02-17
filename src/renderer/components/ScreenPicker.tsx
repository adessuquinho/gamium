import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { startScreenShare } from '../network'
import type { DesktopSource } from '../../shared/types'

export default function ScreenPicker() {
  const showScreenPicker = useAppStore((s) => s.showScreenPicker)
  const setShowScreenPicker = useAppStore((s) => s.setShowScreenPicker)
  const setScreenStream = useAppStore((s) => s.setScreenStream)

  const [sources, setSources] = useState<DesktopSource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!showScreenPicker) return

    setLoading(true)
    window.gamiumAPI.getDesktopSources().then((srcs) => {
      setSources(srcs)
      setLoading(false)
    }).catch(() => {
      setSources([])
      setLoading(false)
    })
  }, [showScreenPicker])

  if (!showScreenPicker) return null

  async function handleSelect(sourceId: string) {
    setSelectedId(sourceId)
    const stream = await startScreenShare(sourceId)
    if (stream) {
      setScreenStream(stream)
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null)
      }
    }
    setShowScreenPicker(false)
    setSelectedId(null)
  }

  function handleCancel() {
    setShowScreenPicker(false)
    setSelectedId(null)
  }

  return (
    <div className="screen-picker-overlay" onClick={handleCancel}>
      <div className="screen-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="screen-picker-header">
          <h3>Compartilhar Tela</h3>
          <p>Selecione a tela ou janela que deseja compartilhar</p>
          <button className="screen-picker-close" onClick={handleCancel}>✕</button>
        </div>

        <div className="screen-picker-content">
          {loading && (
            <div className="screen-picker-loading">
              <p>Buscando telas disponíveis...</p>
            </div>
          )}

          {!loading && sources.length === 0 && (
            <div className="screen-picker-empty">
              <p>Nenhuma tela ou janela encontrada.</p>
            </div>
          )}

          {!loading && (
            <div className="screen-picker-grid">
              {sources.map((source) => (
                <button
                  key={source.id}
                  className={`screen-picker-item ${selectedId === source.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(source.id)}
                  disabled={!!selectedId}
                >
                  <div className="screen-picker-thumbnail">
                    <img src={source.thumbnail} alt={source.name} />
                  </div>
                  <span className="screen-picker-name">{source.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="screen-picker-footer">
          <button className="btn-secondary" onClick={handleCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
