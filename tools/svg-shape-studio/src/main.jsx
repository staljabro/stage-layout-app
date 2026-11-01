import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import App from '../../../src/workbench/app.jsx'
import {AccountProvider} from '../../../src/accounts.jsx'
import '../../../src/styles.css'
createRoot(document.getElementById('root')).render(<StrictMode><AccountProvider><App/></AccountProvider></StrictMode>)
