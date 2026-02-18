import { useState } from 'react'
import { languageOptions, useI18n, type Language } from '../i18n'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="lang-switcher">
      <button className="lang-btn" onClick={() => setOpen((v) => !v)} title="Idioma / Language">
        <Flag code={language} />
      </button>
      {open && (
        <div className="lang-menu">
          {languageOptions.map((option) => (
            <button
              key={option.code}
              className={`lang-item ${option.code === language ? 'active' : ''}`}
              onClick={() => {
                setLanguage(option.code)
                setOpen(false)
              }}
            >
              <Flag code={option.code} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Flag({ code }: { code: Language }) {
  if (code === 'pt-BR') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
        <rect width="18" height="12" fill="#009c3b" />
        <polygon points="9,1 16,6 9,11 2,6" fill="#ffdf00" />
        <circle cx="9" cy="6" r="2.3" fill="#002776" />
      </svg>
    )
  }
  if (code === 'en') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
        <rect width="18" height="12" fill="#012169" />
        <path d="M0 0 L18 12 M18 0 L0 12" stroke="#fff" strokeWidth="2" />
        <path d="M0 0 L18 12 M18 0 L0 12" stroke="#C8102E" strokeWidth="1" />
        <rect x="7" width="4" height="12" fill="#fff" />
        <rect y="4" width="18" height="4" fill="#fff" />
        <rect x="8" width="2" height="12" fill="#C8102E" />
        <rect y="5" width="18" height="2" fill="#C8102E" />
      </svg>
    )
  }
  if (code === 'es') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
        <rect width="18" height="12" fill="#AA151B" />
        <rect y="3" width="18" height="6" fill="#F1BF00" />
      </svg>
    )
  }
  if (code === 'ar') {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
        <rect width="18" height="4" fill="#239f40" />
        <rect y="4" width="18" height="4" fill="#fff" />
        <rect y="8" width="18" height="4" fill="#da0000" />
      </svg>
    )
  }
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
      <rect width="18" height="12" fill="#fff" />
      <rect y="4" width="18" height="4" fill="#0039A6" />
      <rect y="8" width="18" height="4" fill="#D52B1E" />
    </svg>
  )
}
