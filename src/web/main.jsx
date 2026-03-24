import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import './shared/styles/index.css'
import './shared/i18n'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
