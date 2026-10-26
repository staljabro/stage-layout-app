import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './events.jsx'
import { AccountProvider } from './accounts.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccountProvider><App /></AccountProvider>
  </StrictMode>,
)
