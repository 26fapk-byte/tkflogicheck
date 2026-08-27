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
  LocalDb.processSyncQueue().catch(() => {});
});
// Sync on visibility change (user returns to tab) - catches pending after sleep
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    LocalDb.processSyncQueue().catch(() => {});
  }
});
// Initial background sync after load (handles queue from previous session)
window.addEventListener('load', () => {
  setTimeout(() => { if (navigator.onLine) LocalDb.processSyncQueue().catch(() => {}); }, 2000);
});

// Register service worker for PWA support (best-effort, silent failure ok)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Keep registration best-effort and silent in production.
    });
  });
}
