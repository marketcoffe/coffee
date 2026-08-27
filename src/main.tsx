import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {log} from './utils/logger';
import './index.css';

// ═══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLERS
// Capturan errores no atrapados en cualquier módulo/componente
// ═══════════════════════════════════════════════════════════════

// Errores de JavaScript no capturados
window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  const isCorrupted = 
    msg.includes('NS_ERROR_CORRUPTED_CONTENT') || 
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed');
  
  if (isCorrupted) {
    log.warn('Main', 'Modulo dinamico corrupto detectado, limpiando cache y recargando...', { message: msg });
    if ('caches' in window) {
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).catch(() => {});
    }
    setTimeout(() => window.location.reload(), 500);
    return;
  }

  log.error('Global', 'Uncaught error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

// Promesas rechazadas no capturadas (incluye Supabase, fetch, etc.)
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || String(event?.reason || '');

  // Suprimir errores conocidos de Supabase LockManager (race condition entre tabs)
  if (msg.includes('LockManager lock') && msg.includes('auth-token')) {
    event.preventDefault();
    return;
  }

  log.error('Global', 'Unhandled promise rejection', {
    reason: event.reason,
    message: msg,
  });
});

// Errores de React (via console.error override para capturar errores de render)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  originalConsoleError.apply(console, args);

  // Detectar errores de React (empiezan con "%s" o contienen "Error" + "component")
  const firstArg = String(args[0] || '');
  if (firstArg.includes('Error') || firstArg.includes('error') || firstArg.includes('Uncaught')) {
    log.error('React', firstArg.slice(0, 200), args.length > 1 ? args.slice(1) : undefined);
  }
};

// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════════════════

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
      .then((reg) => {
        log.info('SW', `Registrado correctamente: ${reg.scope}`);
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => log.error('SW', 'Error al registrar', err));
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
      const url = event.data.soundUrl || '/sounds/notification.wav';
      try {
        const audio = new Audio(url);
        audio.volume = 0.8;
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// MOUNT APP
// ═══════════════════════════════════════════════════════════════

log.info('App', 'Inicializando Market Coffee Sweet');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
