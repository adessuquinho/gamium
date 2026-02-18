import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { leaveVoiceChannel, toggleMute, stopScreenShare } from '../network'
import { useI18n } from '../i18n'

export default function VoicePanel() {
  const { t } = useI18n()
  const inVoice = useAppStore((s) => s.inVoice)
  const voiceChannelPath = useAppStore((s) => s.voiceChannelPath)
  const voiceMuted = useAppStore((s) => s.voiceMuted)
  const voicePeers = useAppStore((s) => s.voicePeers)
  const localStream = useAppStore((s) => s.localStream)
  const screenStream = useAppStore((s) => s.screenStream)
  const setVoiceMuted = useAppStore((s) => s.setVoiceMuted)
  const setInVoice = useAppStore((s) => s.setInVoice)
  const setLocalStream = useAppStore((s) => s.setLocalStream)
  const setScreenStream = useAppStore((s) => s.setScreenStream)
  const user = useAppStore((s) => s.user)

  const [isSharing, setIsSharing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const screenVideoRef = useRef<HTMLVideoElement>(null)

  // Renderizar stream de tela
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream
    }
  }, [screenStream])

  // Audio dos peers
  useEffect(() => {
    voicePeers.forEach((peer) => {
      if (peer.stream) {
        // Criar elemento de áudio para cada peer
        let audio = document.getElementById(`audio-${peer.pub}`) as HTMLAudioElement
        if (!audio) {
          audio = document.createElement('audio')
          audio.id = `audio-${peer.pub}`
          audio.autoplay = true
          document.body.appendChild(audio)
        }
        audio.srcObject = peer.stream
      }
    })

    return () => {
      // Cleanup
      voicePeers.forEach((peer) => {
        const audio = document.getElementById(`audio-${peer.pub}`)
        if (audio) audio.remove()
      })
    }
  }, [voicePeers])

  async function handleLeave() {
    if (voiceChannelPath) {
      await leaveVoiceChannel(voiceChannelPath)
    }
    setInVoice(false)
    setLocalStream(null)
    setScreenStream(null)
    setIsSharing(false)
  }

  function handleToggleMute() {
    const muted = toggleMute()
    setVoiceMuted(muted)
  }

  function handleScreenShare() {
    if (isSharing) {
      stopScreenShare()
      setScreenStream(null)
      setIsSharing(false)
    } else {
      // Abre o seletor de tela
      useAppStore.getState().setShowScreenPicker(true)
    }
  }

  // Detecta quando screen stream muda (definido pelo ScreenPicker)
  useEffect(() => {
    if (screenStream) {
      setIsSharing(true)
      screenStream.getVideoTracks()[0].onended = () => {
        setScreenStream(null)
        setIsSharing(false)
      }
    } else {
      setIsSharing(false)
    }
  }, [screenStream])

  if (!inVoice) return null

  return (
    <div className={`voice-panel ${expanded ? 'expanded' : ''}`}>
      {/* Header */}
      <div className="voice-header" onClick={() => setExpanded(!expanded)}>
        <div className="voice-status">
          <span className="voice-indicator" />
          <span className="voice-label">
            {voiceMuted ? `🔇 ${t('voice.muted')}` : `🔊 ${t('voice.connected')}`}
          </span>
          <span className="voice-channel">{voiceChannelPath?.split('/').pop()}</span>
        </div>
        <span className="voice-expand">{expanded ? '▼' : '▲'}</span>
      </div>

      {expanded && (
        <div className="voice-body">
          {/* Participantes */}
          <div className="voice-participants">
            {/* EU */}
            <div className="voice-participant self">
              <div className="participant-avatar">{user?.alias?.charAt(0).toUpperCase()}</div>
              <span className="participant-name">{user?.alias} {t('voice.me')}</span>
              <span className={`participant-mic ${voiceMuted ? 'muted' : ''}`}>
                {voiceMuted ? '🔇' : '🎤'}
              </span>
            </div>

            {/* Outros peers */}
            {voicePeers.map((peer) => (
              <div key={peer.pub} className="voice-participant">
                <div className="participant-avatar">{peer.alias?.charAt(0).toUpperCase()}</div>
                <span className="participant-name">{peer.alias}</span>
                <span className={`participant-mic ${peer.muted ? 'muted' : ''}`}>
                  {peer.muted ? '🔇' : '🎤'}
                </span>
                {peer.screenSharing && <span className="participant-screen">🖥️</span>}
              </div>
            ))}

            {voicePeers.length === 0 && (
              <p className="voice-hint">{t('voice.waiting')}</p>
            )}
          </div>

          {/* Screen share preview */}
          {screenStream && (
            <div className="screen-preview">
              <video
                ref={screenVideoRef}
                autoPlay
                muted
                playsInline
                className="screen-video"
              />
              <span className="screen-label">{t('voice.sharingYourScreen')}</span>
            </div>
          )}

          {/* Streams remotas de tela */}
          {voicePeers
            .filter((p) => p.screenSharing && p.stream)
            .map((peer) => (
              <RemoteScreen key={`screen-${peer.pub}`} peer={peer} />
            ))}
        </div>
      )}

      {/* Controles */}
      <div className="voice-controls">
        <button
          className={`voice-btn ${voiceMuted ? 'active' : ''}`}
          onClick={handleToggleMute}
          title={voiceMuted ? t('voice.unmute') : t('voice.mute')}
        >
          {voiceMuted ? '🔇' : '🎤'}
        </button>

        <button
          className={`voice-btn ${isSharing ? 'active sharing' : ''}`}
          onClick={handleScreenShare}
          title={isSharing ? t('voice.stopShare') : t('voice.share')}
        >
          🖥️
        </button>

        <button className="voice-btn leave" onClick={handleLeave} title={t('voice.leave')}>
          📞
        </button>
      </div>
    </div>
  )
}

// Componente auxiliar para stream remota
function RemoteScreen({ peer }: { peer: { pub: string; alias: string; stream?: MediaStream } }) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream
    }
  }, [peer.stream])

  return (
    <div className="screen-preview remote">
      <video ref={videoRef} autoPlay playsInline className="screen-video" />
      <span className="screen-label">{t('voice.remoteScreen', { name: peer.alias })}</span>
    </div>
  )
}
