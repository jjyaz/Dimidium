import './clayegg.css'

interface ClayEggProps {
  mode?: 'closed' | 'trembling' | 'cracked'
  size?: number
  className?: string
}

/**
 * A soft CSS-only clay egg that matches the mascot's material:
 * warm eggshell body, diffuse top-left light, warm under-shadow.
 */
export function ClayEgg({ mode = 'closed', size = 96, className = '' }: ClayEggProps) {
  return (
    <div
      className={`clay-egg-holder mode-${mode} ${className}`}
      style={{ '--egg-size': `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="clay-egg">
        <span className="clay-crack" />
        {mode === 'cracked' && (
          <>
            <span className="clay-lid" />
            <span className="clay-yolk-peek" />
          </>
        )}
      </div>
      {mode === 'cracked' && (
        <>
          <span className="clay-chip clay-chip-a" />
          <span className="clay-chip clay-chip-b" />
        </>
      )}
    </div>
  )
}
