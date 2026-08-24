import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress Supabase Auth LockManager errors (race condition across tabs)
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || String(event?.reason || '');
  if (msg.includes('LockManager lock') && msg.includes('auth-token')) {
    event.preventDefault();
  }
});

// ─── Service Worker Registration ───
// Registra sw-push.js para recibir notificaciones push del servidor.
// Solo registra UNA vez; si ya existe, no duplica.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registrado correctamente:', reg.scope);
        // Verificar actualizaciones cada 60 minutos
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => console.error('[SW] Error al registrar:', err));
  });

  // Escuchar mensajes del SW para reproducir sonido en foreground
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
      const url = event.data.soundUrl || '/sounds/notification.mp3';
      try {
        const audio = new Audio(url);
        audio.volume = 0.8;
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
