import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { ThemeProvider } from './context/theme'
import FilesPage from './pages/FilesPage'
import HomePage from './pages/HomePage'
import LinkSecretPage from './pages/LinkSecretPage'
import QrSecretPage from './pages/QrSecretPage'
import SteganographyPage from './pages/SteganographyPage'

function LegacyHashRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname === '/' && location.hash.startsWith('#msg=')) {
      navigate({ pathname: '/link-secreto', hash: location.hash }, { replace: true })
    }
  }, [location.hash, location.pathname, navigate])

  return null
}

export default function App() {
  return (
    <ThemeProvider>
      <LegacyHashRedirect />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/arquivos" element={<FilesPage />} />
        <Route path="/qr-secreto" element={<QrSecretPage />} />
        <Route path="/link-secreto" element={<LinkSecretPage />} />
        <Route path="/esteganografia" element={<SteganographyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  )
}

