import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { I18nProvider } from '@/i18n'
import App from './App.tsx'
import { updateAppOnColdStart } from './pwaUpdate.ts'

async function bootstrap() {
  await updateAppOnColdStart()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <I18nProvider>
          <App />
        </I18nProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

void bootstrap()
