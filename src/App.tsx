import { BrowserRouter, Route, Routes } from 'react-router'
import { Callback } from './routes/Callback'
import { Home } from './routes/Home'
import { Share } from './routes/Share'

export default function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <h1>Playlist Converter</h1>
        <p className="hint">TIDAL · Spotify · YouTube Music</p>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/share" element={<Share />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
