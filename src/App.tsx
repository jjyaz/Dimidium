import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { Nursery } from './pages/Nursery'
import { DecisionDetail } from './pages/DecisionDetail'
import { DecisionDNA } from './pages/DecisionDNA'
import { HowItWorks } from './pages/HowItWorks'
import { NotFound } from './pages/NotFound'

export default function App() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash)
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname, location.hash])

  return (
    <>
      <div className="grain-overlay" aria-hidden="true" />
      <Nav />
      <main id="main">
        <div key={location.pathname} className="page-enter">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/nursery" element={<Nursery />} />
            <Route path="/egg/:id" element={<DecisionDetail />} />
            <Route path="/dna" element={<DecisionDNA />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </>
  )
}
