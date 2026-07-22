import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ConnectWallet } from './ConnectWallet'
import { useDecisions } from '../lib/store'
import { liveState } from '../lib/types'
import { useNow } from '../lib/time'
import './nav.css'

const LINKS = [
  { to: '/nursery', label: 'Nursery' },
  { to: '/dna', label: 'Decision DNA' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/agents', label: 'Agents' },
]

type Mood = 'calm' | 'sleepy' | 'alert'

const MOOD_TITLES: Record<Mood, string> = {
  calm: 'Dimidium is calm. Nothing urgent in the nursery.',
  sleepy: 'So many eggs incubating. Dimidium is very sleepy.',
  alert: 'An egg is ready to hatch. Dimidium has the water gun.',
}

/** Dimidium's mood ring: the nav mark reacts to the state of your eggs. */
function useMascotMood(): Mood {
  const decisions = useDecisions()
  const now = useNow(60_000)
  const states = decisions.map((d) => liveState(d, now))
  if (states.includes('ready')) return 'alert'
  if (states.filter((s) => s === 'incubating').length >= 3) return 'sleepy'
  return 'calm'
}

function MoodEggMark({ mood }: { mood: Mood }) {
  return (
    <svg
      viewBox="0 0 44 32"
      width="36"
      height="26"
      aria-hidden="true"
      className={`mood-mark mood-${mood}`}
    >
      {/* shell */}
      <path
        d="M16 3C10.5 3 6 11.5 6 18.5 6 24.8 10.5 29 16 29s10-4.2 10-10.5C26 11.5 21.5 3 16 3z"
        fill="var(--green-deep)"
      />
      {/* crack — droops a little when sleepy */}
      <path
        d={
          mood === 'sleepy'
            ? 'M9 15l3 1.6 2.5-2 2.5 2 3-1.6 2.5 1.6'
            : 'M9 14l3 2.5 2.5-3 2.5 3 3-2.5 2.5 2.5'
        }
        fill="none"
        stroke="var(--eggshell)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {mood === 'sleepy' ? (
        <>
          {/* closed, contented lids */}
          <path
            d="M11.4 21.2q1.6 1.7 3.2 0"
            fill="none"
            stroke="var(--eggshell)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M17.4 21.2q1.6 1.7 3.2 0"
            fill="none"
            stroke="var(--eggshell)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* drifting z z */}
          <path
            className="mood-zz mood-zz-1"
            d="M31 12h4l-4 4h4"
            fill="none"
            stroke="var(--eye)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="mood-zz mood-zz-2"
            d="M37 5h3l-3 3h3"
            fill="none"
            stroke="var(--eye)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : mood === 'alert' ? (
        <>
          {/* wide eyes */}
          <circle cx="13" cy="21" r="2.6" fill="var(--cream)" />
          <circle cx="19" cy="21" r="2.6" fill="var(--cream)" />
          <circle cx="13.4" cy="21.3" r="1.3" fill="var(--eye)" />
          <circle cx="19.4" cy="21.3" r="1.3" fill="var(--eye)" />
          {/* the water gun, at the ready */}
          <g className="mood-gun">
            <rect x="31" y="16" width="9" height="5" rx="2" fill="var(--green-deep)" />
            <rect x="39" y="17.4" width="3.4" height="2.2" rx="1.1" fill="var(--green-deep)" />
            <rect x="33" y="20.5" width="3.4" height="5.5" rx="1.6" fill="var(--green-deep)" />
            <circle className="mood-drop mood-drop-1" cx="41" cy="13.6" r="1.1" fill="var(--eye)" />
            <circle className="mood-drop mood-drop-2" cx="43" cy="10.6" r="0.9" fill="var(--eye)" />
          </g>
        </>
      ) : (
        <>
          <circle cx="13" cy="21" r="1.5" fill="var(--eggshell)" />
          <circle cx="19" cy="21" r="1.5" fill="var(--eggshell)" />
        </>
      )}
    </svg>
  )
}

export function Nav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const mood = useMascotMood()

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
        <Link
          to="/"
          className="nav-brand"
          title={MOOD_TITLES[mood]}
          data-mood={mood}
        >
          <MoodEggMark mood={mood} />
          <span>Dimidium</span>
          <span className="visually-hidden">{MOOD_TITLES[mood]}</span>
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
