import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Registers the service worker proactively on every app load — not just
// when a user taps "Enable Notifications" (that push-specific flow in
// utils/push.js still runs separately for actually subscribing to push).
// This unconditional registration is what makes the browser's "Add to
// Home Screen" prompt actually eligible to appear at all — most browsers
// require an active service worker before they'll offer installation,
// regardless of whether the user ever enables notifications.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err.message);
    });
  });
}