import { Mascot } from './Mascot'
import './footer.css'

export function Footer() {
  return (
    <footer className="footer">
      <Mascot variant="peek" />
      <div className="page-shell footer-inner">
        <div className="footer-brand">
          <span className="footer-name">Dimidium</span>
          <p className="footer-tagline">“Every decision has another half.”</p>
        </div>
        <div className="footer-meta">
          <span>Built for Robinhood Chain</span>
          <span aria-hidden="true">·</span>
          <span>Prototype — not financial advice</span>
        </div>
        <p className="footer-whisper">
          No eggs were traded during this simulation.
        </p>
      </div>
    </footer>
  )
}
