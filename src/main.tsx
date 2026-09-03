import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './EquipmentDelete.css'
import App from './App'
import { AppErrorBoundary } from './AppErrorBoundary'

const SupabaseTestPanel = lazy(() => import('./SupabaseTestPanel').then((module) => ({ default: module.SupabaseTestPanel })))
const phase3Preview = new URLSearchParams(window.location.search).get('phase3')

const content = phase3Preview === 'supabase-test'
  ? <Suspense fallback={<div className="workspace-loading" role="status">Đang tải Supabase diagnostics…</div>}><SupabaseTestPanel /></Suspense>
  : <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {content}
    </AppErrorBoundary>
  </StrictMode>,
)
