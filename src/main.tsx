import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { LiveEquipmentPanel } from './LiveEquipmentPanel'

const phase3Preview = new URLSearchParams(window.location.search).get('phase3')
const content = phase3Preview === 'equipment'
  ? <div className="app-body"><main id="main-content" className="main-content"><LiveEquipmentPanel /></main></div>
  : <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {content}
    </AppErrorBoundary>
  </StrictMode>,
)
