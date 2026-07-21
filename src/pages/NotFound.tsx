import { Link } from 'react-router-dom'
import { Mascot } from '../components/Mascot'

export function NotFound() {
  return (
    <section className="page-shell detail-missing">
      <Mascot variant="small" />
      <h1>There is no page here.</h1>
      <p>
        Dimidium checked twice. Whatever you were looking for either hatched,
        got shelled, or never existed. Very mysterious.
      </p>
      <Link className="btn btn-shell" to="/">
        Back to the beginning
      </Link>
    </section>
  )
}
