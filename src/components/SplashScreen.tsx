import React, { useState, useEffect, useCallback } from 'react';
import { StoreConfig } from '../types/store';

interface SplashScreenProps {
  config: StoreConfig;
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ config, onComplete }) => {
  const [phase, setPhase] = useState<'init' | 'logo' | 'text' | 'fade'>('init');

  const themeColor = config.theme_color || '#FF6B35';
  const logoUrl = config.splash_logo_url || config.pwa_icon_url || config.logo_url || '/logo.png';
  const siteName = config.site_nombre || 'Market Coffee Sweet';
  const welcomeMsg = config.mensaje_bienvenida || 'La mejor comida con delivery express.';

  const safeComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('logo'), 100),
      setTimeout(() => setPhase('text'), 400),
      setTimeout(() => setPhase('fade'), 800),
      setTimeout(() => safeComplete(), 1100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [safeComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${themeColor}ee 0%, ${themeColor} 50%, ${themeColor}dd 100%)`,
        opacity: phase === 'fade' ? 0 : 1,
        transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: phase === 'fade' ? 'none' : 'auto',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 35%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              background: 'rgba(255,255,255,0.2)',
              left: `${15 + Math.random() * 70}%`,
              top: `${20 + Math.random() * 60}%`,
              animation: `float-particle ${2 + Math.random() * 2}s ease-in-out ${Math.random() * 1}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes logo-entrance {
          0% { transform: scale(0.3) rotate(-10deg); opacity: 0; filter: blur(12px); }
          60% { transform: scale(1.08) rotate(2deg); opacity: 1; filter: blur(0); }
          80% { transform: scale(0.97) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
        }
        @keyframes text-slide {
          0% { transform: translateY(20px); opacity: 0; filter: blur(6px); }
          100% { transform: translateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(255,255,255,0.15), 0 0 60px rgba(255,255,255,0.05); }
          50% { box-shadow: 0 0 40px rgba(255,255,255,0.25), 0 0 80px rgba(255,255,255,0.1); }
        }
        @keyframes float-particle {
          0% { transform: translateY(0) scale(1); opacity: 0.3; }
          100% { transform: translateY(-20px) scale(1.3); opacity: 0.6; }
        }
        @keyframes shimmer-line {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* Logo */}
      <div
        className="relative flex items-center justify-center"
        style={{
          opacity: phase === 'init' ? 0 : 1,
          animation: phase !== 'init' ? 'logo-entrance 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
        }}
      >
        <img
          src={logoUrl}
          alt={siteName}
          className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 object-contain"
          style={{
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.25))',
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/logo.png';
          }}
        />
      </div>

      {/* Text */}
      <div
        className="relative z-10 flex flex-col items-center gap-2 mt-6 text-center px-8"
        style={{
          opacity: phase === 'init' || phase === 'logo' ? 0 : 1,
          animation: (phase === 'text' || phase === 'fade') ? 'text-slide 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
        }}
      >
        <h1
          className="text-white text-2xl sm:text-3xl font-extrabold tracking-tight"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}
        >
          {siteName}
        </h1>
        <p className="text-white/75 text-xs sm:text-sm leading-relaxed max-w-[260px]">
          {welcomeMsg}
        </p>
      </div>

      {/* Bottom shimmer line */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
        <div
          className="h-[1px] w-32 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <div
            className="h-full w-1/2"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
              animation: 'shimmer-line 1.8s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
};
