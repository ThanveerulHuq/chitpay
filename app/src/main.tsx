import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { I18nProvider } from '@/i18n'
import App from './App.tsx'
import { updateAppOnColdStart } from './pwaUpdate.ts'
import { BrandingProvider } from '@/lib/branding'

async function bootstrap() {
  await updateAppOnColdStart()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <BrandingProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </BrandingProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

void bootstrap()
