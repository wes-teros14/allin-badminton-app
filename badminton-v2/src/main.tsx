import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { APP_BUILD_STAMP } from '@/lib/appBuild'

// Free, and it saves walking someone to the bottom of their profile when the
// browser console is already open.
console.info(`Badminton Tayo — build ${APP_BUILD_STAMP}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
