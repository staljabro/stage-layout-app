import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AccountProvider } from '../../../src/accounts.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(<StrictMode><AccountProvider studio><App /></AccountProvider></StrictMode>)
