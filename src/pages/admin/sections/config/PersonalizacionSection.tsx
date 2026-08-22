import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import ImageField from '../../components/ImageField';
import { Image, Type, FileText, Palette, Eye, Share2, Layout } from 'lucide-react';

const PersonalizacionSection: React.FC = () => {
  const { config, updateConfig } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [activeTab, setActiveTab] = useState<'logos' | 'colors' | 'theme' | 'fonts' | 'hero' | 'texts' | 'social' | 'preview'>('logos');

  const tabs = [
    { id: 'logos' as const, label: 'Logos', icon: Image },
    { id: 'colors' as const, label: 'Colores', icon: Palette },
    { id: 'theme' as const, label: 'Tema', icon: Eye },
    { id: 'fonts' as const, label: 'Fuentes', icon: Type },
    { id: 'hero' as const, label: 'Hero', icon: Layout },
    { id: 'texts' as const, label: 'Textos', icon: FileText },
    { id: 'social' as const, label: 'Redes', icon: Share2 },
    { id: 'preview' as const, label: 'Vista Previa', icon: Eye },
  ];

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="admin-label mb-3">{children}</p>
  );

  const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>{children}</label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0"
              style={{
                background: isActive ? themeColor : 'var(--ios-card)',
                color: isActive ? '#FFFFFF' : 'var(--ios-text-secondary)',
                border: `1px solid ${isActive ? themeColor : 'var(--ios-border)'}`,
              }}>
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'logos' && (
        <div className="flex flex-col gap-4">
          <div className="admin-card p-4">
            <SectionTitle>Logo Principal (PWA + Tienda)</SectionTitle>
            <p className="text-xs mb-3" style={{ color: 'var(--ios-text-tertiary)' }}>
              Se usa como icono de la app movil (PWA) y en el header de la tienda.
            </p>
            <ImageField value={config.logo_url || ''} onChange={url => updateConfig({ logo_url: url })} bucket="settings" folder="logos" maxSize={400} previewSize="lg" />
          </div>
          <div className="admin-card p-4">
            <SectionTitle>Logo Secundario</SectionTitle>
            <p className="text-xs mb-3" style={{ color: 'var(--ios-text-tertiary)' }}>
              Logo alternativo para usar en el footer o secciones especiales.
            </p>
            <ImageField value={config.secondary_logo_url || ''} onChange={url => updateConfig({ secondary_logo_url: url })} bucket="settings" folder="logos" maxSize={400} previewSize="md" />
          </div>
          <div className="admin-card p-4">
            <SectionTitle>Favicon (Icono del Navegador)</SectionTitle>
            <p className="text-xs mb-3" style={{ color: 'var(--ios-text-tertiary)' }}>
              Icono que aparece en la pestana del navegador. Recomendado: 32x32 o 64x64 PNG.
            </p>
            <ImageField value={config.favicon_url || ''} onChange={url => updateConfig({ favicon_url: url })} bucket="settings" folder="favicons" maxSize={64} previewSize="sm" accept="image/png, image/jpeg, image/x-icon" />
          </div>
        </div>
      )}

      {activeTab === 'colors' && (
        <div className="flex flex-col gap-4">
          <div className="admin-card p-4">
            <SectionTitle>Identidad Visual (Colores)</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Color Primario', key: 'theme_color', fallback: '#6E472A' },
                { label: 'Color Secundario', key: 'secondary_color', fallback: '#A4D045' },
                { label: 'Color de Acento', key: 'accent_color', fallback: '#A4D045' },
              ].map(c => (
                <div key={c.key} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{c.label}</span>
                  <div className="flex items-center gap-3">
                    <input type="color" value={(config as any)[c.key] || c.fallback}
                      onChange={e => updateConfig({ [c.key]: e.target.value })}
                      className="w-12 h-12 p-0 border-0 rounded-lg cursor-pointer shadow-sm" />
                    <input type="text" value={(config as any)[c.key] || c.fallback}
                      onChange={e => updateConfig({ [c.key]: e.target.value })}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-violet-500 font-mono text-xs flex-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'theme' && (
        <div className="flex flex-col gap-4">
          <div className="admin-card p-4">
            <SectionTitle>Modo del Tema</SectionTitle>
            <p className="text-xs mb-3" style={{ color: 'var(--ios-text-tertiary)' }}>
              Permite a los usuarios alternar entre tema claro y oscuro.
            </p>
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-[11px] font-bold text-slate-900 block">Modo Oscuro</span>
                <span className="text-[10px] text-slate-500">Activa el toggle de tema oscuro en la interfaz</span>
              </div>
              <button
                onClick={() => updateConfig({ theme_mode: config.theme_mode === 'dark' ? 'light' : config.theme_mode === 'light' ? 'system' : 'dark' })}
                className="relative w-14 h-8 rounded-full transition-colors duration-300 cursor-pointer"
                style={{ backgroundColor: config.theme_mode === 'dark' ? '#A4D045' : config.theme_mode === 'system' ? '#64748b' : '#d1d5db' }}>
                <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300"
                  style={{ transform: config.theme_mode === 'dark' ? 'translateX(24px)' : config.theme_mode === 'system' ? 'translateX(12px)' : 'translateX(0)' }} />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              {(['light', 'dark', 'system'] as const).map(mode => (
                <button key={mode} onClick={() => updateConfig({ theme_mode: mode })}
                  className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                  style={{
                    backgroundColor: config.theme_mode === mode ? '#6d28d9' : '#f1f5f9',
                    color: config.theme_mode === mode ? '#ffffff' : '#64748b',
                  }}>
                  {mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Sistema'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fonts' && (
        <div className="flex flex-col gap-4">
          <div className="admin-card p-4">
            <SectionTitle>Fuente del Sitio</SectionTitle>
            <select value={config.font_display || 'Fredoka'} onChange={e => updateConfig({ font_display: e.target.value })}
              className="admin-input">
              <option value="Fredoka">Fredoka</option>
              <option value="Space Grotesk">Space Grotesk</option>
              <option value="Poppins">Poppins</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Inter">Inter</option>
              <option value="Nunito">Nunito</option>
            </select>
            <p className="text-[10px] mt-2" style={{ color: 'var(--ios-text-tertiary)' }}>
              La fuente se aplica a todo el sitio web y la app.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'hero' && (
        <div className="flex flex-col gap-4">
          <div className="admin-card p-4">
            <SectionTitle>Configuracion del Hero</SectionTitle>
            <p className="text-[11px] text-slate-500 mb-3">Personaliza la seccion principal del Home.</p>
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Titulo del Hero</FieldLabel>
                <input type="text" value={config.hero_title || ''} onChange={e => updateConfig({ hero_title: e.target.value })}
                  className="admin-input mt-1" placeholder="Pide Tu Comida Favorita" />
              </div>
              <div>
                <FieldLabel>Subtitulo</FieldLabel>
                <input type="text" value={config.hero_subtitle || ''} onChange={e => updateConfig({ hero_subtitle: e.target.value })}
                  className="admin-input mt-1" placeholder="Delivery express en minutos" />
              </div>
              <div>
                <FieldLabel>Texto del Boton CTA</FieldLabel>
                <input type="text" value={config.hero_cta_text || ''} onChange={e => updateConfig({ hero_cta_text: e.target.value })}
                  className="admin-input mt-1" placeholder="Ver Menu" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Efecto del Hero</FieldLabel>
                  <select value={config.hero_effect || 'fade'} onChange={e => updateConfig({ hero_effect: e.target.value as any })}
                    className="admin-input mt-1">
                    <option value="fade">Fade</option>
                    <option value="slide">Slide</option>
                    <option value="typewriter">Typewriter</option>
                    <option value="none">Ninguno</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Altura del Hero</FieldLabel>
                  <select value={config.hero_height || 'auto'} onChange={e => updateConfig({ hero_height: e.target.value as any })}
                    className="admin-input mt-1">
                    <option value="auto">Automatica</option>
                    <option value="60vh">60% vh</option>
                    <option value="70vh">70% vh</option>
                    <option value="full">100% vh</option>
                  </select>
                </div>
              </div>
              <div>
                <FieldLabel>Opacidad del Overlay (%): {config.hero_overlay_opacity ?? 100}</FieldLabel>
                <input type="range" min="0" max="100" value={config.hero_overlay_opacity ?? 100}
                  onChange={e => updateConfig({ hero_overlay_opacity: parseInt(e.target.value) })}
                  className="w-full mt-1" />
              </div>
            </div>
          </div>

          <div className="admin-card p-4">
            <SectionTitle>Vista Previa del Hero</SectionTitle>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ios-border)' }}>
              <div className="relative p-6 text-center" style={{
                background: `linear-gradient(135deg, ${config.theme_color || '#A4D045'}, ${config.secondary_color || '#6E472A'})`,
                opacity: (config.hero_overlay_opacity ?? 100) / 100,
              }}>
                <p className="text-white font-bold text-lg">{config.hero_title || 'Pide Tu Comida Favorita'}</p>
                <p className="text-white/80 text-sm mt-1">{config.hero_subtitle || 'Delivery express en minutos'}</p>
                {config.hero_cta_text && (
                  <button className="mt-3 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: config.accent_color || '#A4D045', color: '#000' }}>
                    {config.hero_cta_text}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'texts' && (
        <div className="flex flex-col gap-4">
          <div className="admin-card p-4">
            <SectionTitle>Titulos de Secciones</SectionTitle>
            <div className="flex flex-col gap-3">
              {[
                { key: 'section_highlights_title', label: 'Destacados', placeholder: 'Destacados' },
                { key: 'section_categories_title', label: 'Categorias', placeholder: 'LO MAS POPULAR' },
                { key: 'section_bestseller_title', label: 'Mas Vendidos', placeholder: 'LO MAS PEDIDO' },
                { key: 'section_rewards_title', label: 'Recompensas', placeholder: 'RECOMPENSAS' },
                { key: 'section_rewards_description', label: 'Descripcion Recompensas', placeholder: 'Acumula puntos...' },
              ].map(item => (
                <div key={item.key}>
                  <FieldLabel>{item.label}</FieldLabel>
                  <input type="text" value={(config as any)[item.key] || ''} onChange={e => updateConfig({ [item.key]: e.target.value })}
                    className="admin-input mt-1" placeholder={item.placeholder} />
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card p-4">
            <SectionTitle>Pasos de Recompensas</SectionTitle>
            <div className="flex flex-col gap-3">
              {[
                { key1: 'rewards_step1_title', key2: 'rewards_step1_desc', label: 'Paso 1', defaultTitle: 'Registrate gratis', defaultDesc: 'Crea tu cuenta en segundos' },
                { key1: 'rewards_step2_title', key2: 'rewards_step2_desc', label: 'Paso 2', defaultTitle: 'Ordena y acumula', defaultDesc: 'Gana puntos con cada pedido' },
                { key1: 'rewards_step3_title', key2: 'rewards_step3_desc', label: 'Paso 3', defaultTitle: 'Canjea recompensas', defaultDesc: 'Intercambia puntos por comida gratis' },
              ].map((step, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <label className="text-xs font-bold" style={{ color: 'var(--ios-text)' }}>{step.label}</label>
                  <input type="text" value={(config as any)[step.key1] || step.defaultTitle} onChange={e => updateConfig({ [step.key1]: e.target.value })}
                    className="admin-input" placeholder={step.defaultTitle} />
                  <input type="text" value={(config as any)[step.key2] || step.defaultDesc} onChange={e => updateConfig({ [step.key2]: e.target.value })}
                    className="admin-input" placeholder={step.defaultDesc} />
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card p-4">
            <SectionTitle>Footer - Sobre Nosotros</SectionTitle>
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Titulo "Sobre Nosotros"</FieldLabel>
                <input type="text" value={config.footer_about_title || ''} onChange={e => updateConfig({ footer_about_title: e.target.value })}
                  className="admin-input mt-1" placeholder="Sobre Mi Restaurante" />
              </div>
              <div>
                <FieldLabel>Descripcion "Sobre Nosotros"</FieldLabel>
                <textarea value={config.footer_about_text || ''} onChange={e => updateConfig({ footer_about_text: e.target.value })}
                  className="admin-input mt-1" rows={4} placeholder="Somos un restaurante de comida rapida en Valencia..." style={{ resize: 'none' }} />
              </div>
            </div>
          </div>

          <div className="admin-card p-4">
            <SectionTitle>Footer - General</SectionTitle>
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Texto del Footer</FieldLabel>
                <textarea value={config.footer_text || ''} onChange={e => updateConfig({ footer_text: e.target.value })}
                  className="admin-input mt-1" rows={2} placeholder="Tu restaurante favorito..." style={{ resize: 'none' }} />
              </div>
              <div>
                <FieldLabel>Copyright</FieldLabel>
                <input type="text" value={config.footer_copyright || ''} onChange={e => updateConfig({ footer_copyright: e.target.value })}
                  className="admin-input mt-1" placeholder="2025 Mi Restaurante" />
              </div>
              <div>
                <FieldLabel>URL del Sitio (SEO)</FieldLabel>
                <input type="url" value={config.site_url || ''} onChange={e => updateConfig({ site_url: e.target.value })}
                  className="admin-input mt-1" placeholder="https://mirestaurante.com" />
              </div>
            </div>
          </div>

          <div className="admin-card p-4">
            <SectionTitle>Seccion Brand Experience</SectionTitle>
            <p className="text-[11px] text-slate-500 mb-3">Estadisticas y textos de la seccion oscura "Mas que comida".</p>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Stat 1 - Valor</FieldLabel>
                  <input type="text" value={config.brand_stat1_value || ''} onChange={e => updateConfig({ brand_stat1_value: e.target.value })}
                    className="admin-input mt-1" placeholder="15min" />
                </div>
                <div>
                  <FieldLabel>Stat 1 - Etiqueta</FieldLabel>
                  <input type="text" value={config.brand_stat1_label || ''} onChange={e => updateConfig({ brand_stat1_label: e.target.value })}
                    className="admin-input mt-1" placeholder="Entrega Promedio" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Stat 2 - Valor</FieldLabel>
                  <input type="text" value={config.brand_stat2_value || ''} onChange={e => updateConfig({ brand_stat2_value: e.target.value })}
                    className="admin-input mt-1" placeholder="100%" />
                </div>
                <div>
                  <FieldLabel>Stat 2 - Etiqueta</FieldLabel>
                  <input type="text" value={config.brand_stat2_label || ''} onChange={e => updateConfig({ brand_stat2_label: e.target.value })}
                    className="admin-input mt-1" placeholder="Ingredientes Frescos" />
                </div>
              </div>
              <div>
                <FieldLabel>Contador de Usuarios</FieldLabel>
                <input type="text" value={config.brand_users_count || ''} onChange={e => updateConfig({ brand_users_count: e.target.value })}
                  className="admin-input mt-1" placeholder="+50k" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Titulo Seccion</FieldLabel>
                  <input type="text" value={config.brand_section_title || ''} onChange={e => updateConfig({ brand_section_title: e.target.value })}
                    className="admin-input mt-1" placeholder="Mas que comida," />
                </div>
                <div>
                  <FieldLabel>Subtitulo Seccion</FieldLabel>
                  <input type="text" value={config.brand_section_subtitle || ''} onChange={e => updateConfig({ brand_section_subtitle: e.target.value })}
                    className="admin-input mt-1" placeholder="es una experiencia." />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="flex flex-col gap-4">
          {[
            { key: 'instagram_url', label: 'Instagram', placeholder: 'https://instagram.com/tuusuario' },
            { key: 'twitter_url', label: 'Twitter / X', placeholder: 'https://x.com/tuusuario' },
            { key: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/tupagina' },
            { key: 'tiktok_url', label: 'TikTok', placeholder: 'https://tiktok.com/@tuusuario' },
            { key: 'youtube_url', label: 'YouTube', placeholder: 'https://youtube.com/@tucanal' },
          ].map(item => (
            <div key={item.key} className="admin-card p-4">
              <SectionTitle>{item.label}</SectionTitle>
              <input type="url" value={(config as any)[item.key] || ''}
                onChange={e => updateConfig({ [item.key]: e.target.value })}
                className="admin-input mt-2" placeholder={item.placeholder} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="admin-card p-4">
            <SectionTitle>Vista Previa del Header</SectionTitle>
            <div className="rounded-xl overflow-hidden shadow-md border border-slate-200">
              <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: config.theme_color || '#A4D045' }}>
                <div className="flex items-center gap-2">
                  {config.logo_url ? (
                    <img src={config.logo_url} alt="Logo" className="w-8 h-8 object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: config.secondary_color || '#6E472A', color: '#fff' }}>
                      {config.site_nombre?.[0] || 'F'}
                    </div>
                  )}
                  <span className="font-bold text-sm" style={{ color: '#fff' }}>{config.site_nombre || 'Tienda'}</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: config.accent_color || '#A4D045' }}>C</div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: config.secondary_color || '#6E472A', color: '#fff' }}>N</div>
                </div>
              </div>
              <div className="flex gap-2 p-2 bg-white border-t border-slate-100">
                {['Inicio', 'Catalogo', 'Pedidos'].map(tab => (
                  <div key={tab} className="px-3 py-1 rounded-full text-[10px] font-semibold" style={{ backgroundColor: tab === 'Inicio' ? (config.theme_color || '#A4D045') + '20' : 'transparent', color: tab === 'Inicio' ? (config.theme_color || '#A4D045') : '#64748b' }}>{tab}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalizacionSection;
