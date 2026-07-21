import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mascotFull from '../assets/dimidium.webp'
import mascotSmall from '../assets/dimidium-small.webp'
import { MASCOT_LINES, randomLine } from '../lib/microcopy'
import { incrementWashi } from '../lib/washi'
import { usePrefersReducedMotion } from '../lib/time'
import './mascot.css'

interface MascotProps {
  variant?: 'hero' | 'small' | 'peek'
  className?: string
}

/**
 * The actual Dimidium mascot image, blended into the page with a feathered
 * egg-shaped mask. Hero variant breathes, tilts with the pointer, wobbles
 * when booped, twitches occasionally and sheds a little shell dust.
 */
export function Mascot({ variant = 'hero', className = '' }: MascotProps) {
  const reducedMotion = usePrefersReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const [wobbling, setWobbling] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [twitch, setTwitch] = useState(false)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isHero = variant === 'hero'

  // Occasional decorative twitch, gentle and infrequent.
  useEffect(() => {
    if (!isHero || reducedMotion) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return
        setTwitch(true)
        setTimeout(() => !cancelled && setTwitch(false), 700)
        schedule()
      }, 7000 + Math.random() * 9000)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isHero, reducedMotion])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isHero || reducedMotion) return
      const el = stageRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      el.style.setProperty('--tilt-x', `${(-y * 1.6).toFixed(2)}deg`)
      el.style.setProperty('--tilt-y', `${(x * 1.8).toFixed(2)}deg`)
    },
    [isHero, reducedMotion],
  )

  const handlePointerLeave = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    el.style.setProperty('--tilt-x', '0deg')
    el.style.setProperty('--tilt-y', '0deg')
  }, [])

  const boop = useCallback(() => {
    incrementWashi()
    if (!reducedMotion) {
      setWobbling(true)
      setTimeout(() => setWobbling(false), 650)
    }
    setBubble(randomLine(MASCOT_LINES))
    clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setBubble(null), 2400)
  }, [reducedMotion])

  useEffect(() => () => clearTimeout(bubbleTimer.current), [])

  const dust = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        left: 8 + ((i * 37 + 13) % 84),
        delay: (i * 1.7) % 9,
        duration: 7 + ((i * 2.3) % 5),
        size: 3 + (i % 3) * 2,
      })),
    [],
  )

  if (variant === 'peek') {
    return (
      <div className={`mascot-peek ${className}`} aria-hidden="true">
        <img src={mascotSmall} alt="" loading="lazy" draggable={false} />
      </div>
    )
  }

  if (variant === 'small') {
    return (
      <div className={`mascot-small ${className}`}>
        <img
          src={mascotSmall}
          alt="Dimidium, a soft clay egg character looking hopeful"
          loading="lazy"
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div
      ref={stageRef}
      className={`mascot-stage ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="mascot-frame">
        <div className="mascot-halo" aria-hidden="true" />
        <button
          type="button"
          className={`mascot-button ${wobbling ? 'is-wobbling' : ''}`}
          onClick={boop}
          aria-label="Boop Dimidium, your other half"
        >
          <img
            className="mascot-img"
            src={mascotFull}
            alt="Dimidium — a cream clay egg character with big green eyes, a cracked shell lid, and detached shell pieces at its feet"
            fetchPriority="high"
            draggable={false}
          />
        </button>
        {bubble && (
          <div className="mascot-bubble" role="status">
            {bubble}
          </div>
        )}
        <span className={`mascot-twitch ${twitch ? 'is-twitching' : ''}`} aria-hidden="true" />
        <span className="mascot-shard mascot-shard-a" aria-hidden="true" />
        <span className="mascot-shard mascot-shard-b" aria-hidden="true" />
        {!reducedMotion &&
          dust.map((p, i) => (
            <span
              key={i}
              className="mascot-dust"
              aria-hidden="true"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
      </div>
    </div>
  )
}
