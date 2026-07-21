import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ConnectWallet } from './ConnectWallet'
import './nav.css'

const LINKS = [
  { to: '/nursery', label: 'Nursery' },
  { to: '/dna', label: 'Decision DNA' },
  { to: '/how-it-works', label: 'How It Works' },
]

function CrackedEggMark() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <path
        d="M16 3C10.5 3 6 11.5 6 18.5 6 24.8 10.5 29 16 29s10-4.2 10-10.5C26 11.5 21.5 3 16 3z"
        fill="var(--eggshell)"
      />
      <path
        d="M9 14l3 2.5 2.5-3 2.5 3 3-2.5 2.5 2.5"
        fill="none"
        stroke="var(--green-deep)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="21" r="1.5" fill="var(--eye)" />
      <circle cx="19" cy="21" r="1.5" fill="var(--eye)" />
    </svg>
  )
}

export function Nav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="nav-wrap">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="nav-pill" aria-label="Main">
        <Link to="/" className="nav-brand">
          <CrackedEggMark />
          <span>Dimidium</span>
        </Link>

        <div className="nav-links" role="list">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'is-active' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="nav-right">
          <ConnectWallet />
        </div>

        <button
          type="button"
          className="nav-shell-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="visually-hidden">
            {open ? 'Close menu' : 'Open menu'}
          </span>
          <span className={`shell-toggle-crack ${open ? 'is-open' : ''}`} aria-hidden="true" />
        </button>
      </nav>

      <div id="mobile-menu" className={`nav-mobile ${open ? 'is-open' : ''}`}>
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `nav-mobile-link ${isActive ? 'is-active' : ''}`
            }
            tabIndex={open ? 0 : -1}
          >
            {l.label}
          </NavLink>
        ))}
        <div className="nav-mobile-wallet">
          <ConnectWallet />
        </div>
      </div>
    </header>
  )
}
