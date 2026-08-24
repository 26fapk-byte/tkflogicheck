import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {LocalDb} from './lib/db';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Auto-sync pending records as soon as the device regains connectivity.
window.addEventListener('online', () => {
  LocalDb.processSyncQueue();
});

// Register service worker for PWA support (best-effort, silent failure ok)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Keep registration best-effort and silent in production.
    });
  });
}
