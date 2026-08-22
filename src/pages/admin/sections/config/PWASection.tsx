import React from 'react';
import { useApp } from '../../../../store/AppContext';
import ImageField from '../../components/ImageField';
import { Smartphone } from 'lucide-react';

const PWASection: React.FC = () => {
  const { config, updateConfig } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="admin-label mb-3">{children}</p>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card p-4">
        <SectionTitle>Icono PWA (Pantalla de Inicio)</SectionTitle>
        <p className="text-xs mb-1" style={{ color: 'var(--ios-text-tertiary)' }}>
          Icono que se muestra en la pantalla de inicio del celular.
        </p>
        <div className="rounded-lg px-3 py-2 mb-3" style={{ background: '#FFF3E0', border: '1px solid #FFE0B2' }}>
          <p className="text-[11px] font-semibold" style={{ color: '#E65100' }}>Importante: Usa PNG con fondo transparente</p>
          <p className="text-[10px]" style={{ color: '#BF360C' }}>El icono se mostrara sobre el color del tema. Si tiene fondo opaco se vera inconsistente.</p>
        </div>
        <ImageField value={config.pwa_icon_url || ''} onChange={url => updateConfig({ pwa_icon_url: url })} bucket="settings" folder="pwa-icons" maxSize={512} previewSize="lg" />
      </div>

      <div className="admin-card p-4">
        <SectionTitle>Logo de Bienvenida (Splash Screen)</SectionTitle>
        <p className="text-xs mb-1" style={{ color: 'var(--ios-text-tertiary)' }}>
          Logo que aparece al abrir la app con efecto animado.
        </p>
        <div className="rounded-lg px-3 py-2 mb-3" style={{ background: '#E8F5E9', border: '1px solid #C8E6C9' }}>
          <p className="text-[11px] font-semibold" style={{ color: '#2E7D32' }}>Recomendado: PNG o SVG con fondo transparente</p>
          <p className="text-[10px]" style={{ color: '#1B5E20' }}>Se mostrara sobre el color del tema elegido.</p>
        </div>
        <ImageField value={config.splash_logo_url || ''} onChange={url => updateConfig({ splash_logo_url: url })} bucket="settings" folder="splash-logos" maxSize={512} previewSize="lg" />
      </div>

      <div className="admin-card p-4">
        <SectionTitle>Nombre de la App (PWA)</SectionTitle>
        <input type="text" value={config.site_nombre} onChange={e => updateConfig({ site_nombre: e.target.value })}
          className="admin-input" placeholder="Mi Restaurante" />
        <p className="text-[10px] mt-1" style={{ color: 'var(--ios-text-tertiary)' }}>
          Aparece en la pantalla de inicio y en la barra de notificaciones.
        </p>
      </div>

      <div className="admin-card p-4">
        <SectionTitle>Color del Tema (PWA)</SectionTitle>
        <p className="text-xs mb-3" style={{ color: 'var(--ios-text-tertiary)' }}>
          Color de fondo del splash screen, barra de navegacion y pantalla de inicio.
        </p>
        <div className="flex items-center gap-3">
          <input type="color" value={config.theme_color || '#A4D045'}
            onChange={e => updateConfig({ theme_color: e.target.value })}
            className="w-12 h-12 rounded-xl cursor-pointer" style={{ border: 'none', padding: 0 }} />
          <input type="text" value={config.theme_color || '#A4D045'}
            onChange={e => updateConfig({ theme_color: e.target.value })}
            className="admin-input flex-1 font-mono" />
        </div>
      </div>

      <div className="admin-card p-4">
        <SectionTitle>Vista Previa: Splash Screen</SectionTitle>
        <div className="rounded-2xl overflow-hidden mx-auto shadow-lg" style={{ width: 220, background: config.theme_color || '#A4D045' }}>
          <div className="flex flex-col items-center justify-center py-8 px-4">
            {config.splash_logo_url || config.pwa_icon_url || config.logo_url ? (
              <img src={config.splash_logo_url || config.pwa_icon_url || config.logo_url} alt="Splash Logo"
                className="w-20 h-20 object-contain" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }} />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold"
                style={{ background: 'rgba(255,255,255,0.15)' }}>{config.site_nombre?.[0] || 'F'}</div>
            )}
            <p className="text-white text-sm font-extrabold mt-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {config.site_nombre || 'Mi App'}
            </p>
            <p className="text-white/70 text-[10px] mt-1">{config.mensaje_bienvenida || 'Tu delivery favorito'}</p>
          </div>
        </div>
        <p className="text-[10px] text-center mt-2" style={{ color: 'var(--ios-text-tertiary)' }}>
          Asi se vera al abrir la app en el celular
        </p>
      </div>

      <div className="admin-card p-4">
        <SectionTitle>Vista Previa: Icono en Inicio</SectionTitle>
        <div className="flex flex-col items-center">
          <div className="rounded-2xl overflow-hidden" style={{ width: 220, background: '#f0f0f0', border: '3px solid #333' }}>
            <div className="h-5 flex items-center justify-end px-3" style={{ background: '#333' }}>
              <span className="text-[7px] text-white/70 font-semibold">9:41</span>
            </div>
            <div className="grid grid-cols-4 gap-3 p-4" style={{ background: `linear-gradient(180deg, ${config.theme_color || '#A4D045'}30 0%, #f0f0f0 40%)` }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex flex-col items-center gap-1">
                  {i === 0 ? (
                    <>
                      <div className="w-11 h-11 rounded-[10px] flex items-center justify-center overflow-hidden shadow-md"
                        style={{ background: config.theme_color || '#A4D045' }}>
                        {(config.pwa_icon_url || config.logo_url) ? (
                          <img src={config.pwa_icon_url || config.logo_url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-white text-lg font-bold">{config.site_nombre?.[0] || 'F'}</span>
                        )}
                      </div>
                      <span className="text-[7px] text-center leading-tight" style={{ color: '#333' }}>{config.site_nombre || 'App'}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-11 h-11 rounded-[10px] bg-gray-200" />
                      <span className="text-[7px] text-gray-300">-</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: 'var(--ios-text-tertiary)' }}>
            Icono en la pantalla de inicio del celular
          </p>
        </div>
      </div>
    </div>
  );
};

export default PWASection;
