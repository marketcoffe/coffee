import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { Image, Smartphone, Monitor, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import ImageField from '../../components/ImageField';

const BannersSection: React.FC = () => {
  const { config, updateConfig } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [bannerPreviewMode, setBannerPreviewMode] = useState<'mobile' | 'desktop'>('mobile');

  const handleAddBanner = () => {
    const newBanners = [...(config.banners || []), ''];
    const newBannersMobile = [...(config.banners_mobile || []), ''];
    const newTexts = [...(config.banner_texts || []), ''];
    const newTitles = [...(config.banner_titles || []), ''];
    const newDescs = [...(config.banner_descriptions || []), ''];
    const newCtaTexts = [...(config.banner_cta_texts || []), ''];
    const newCtaUrls = [...(config.banner_cta_urls || []), ''];
    updateConfig({ banners: newBanners, banners_mobile: newBannersMobile, banner_texts: newTexts, banner_titles: newTitles, banner_descriptions: newDescs, banner_cta_texts: newCtaTexts, banner_cta_urls: newCtaUrls });
  };

  const handleRemoveBanner = (index: number) => {
    const newBanners = (config.banners || []).filter((_, i) => i !== index);
    const newBannersMobile = (config.banners_mobile || []).filter((_, i) => i !== index);
    const newTexts = (config.banner_texts || []).filter((_, i) => i !== index);
    const newTitles = (config.banner_titles || []).filter((_, i) => i !== index);
    const newDescs = (config.banner_descriptions || []).filter((_, i) => i !== index);
    const newCtaTexts = (config.banner_cta_texts || []).filter((_, i) => i !== index);
    const newCtaUrls = (config.banner_cta_urls || []).filter((_, i) => i !== index);
    updateConfig({ banners: newBanners, banners_mobile: newBannersMobile, banner_texts: newTexts, banner_titles: newTitles, banner_descriptions: newDescs, banner_cta_texts: newCtaTexts, banner_cta_urls: newCtaUrls });
  };

  const handleMoveBanner = (index: number, direction: 'up' | 'down') => {
    const banners = [...(config.banners || [])];
    const bannersMobile = [...(config.banners_mobile || [])];
    const texts = [...(config.banner_texts || [])];
    const titles = [...(config.banner_titles || [])];
    const descs = [...(config.banner_descriptions || [])];
    const ctaTexts = [...(config.banner_cta_texts || [])];
    const ctaUrls = [...(config.banner_cta_urls || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= banners.length) return;
    [banners[index], banners[newIndex]] = [banners[newIndex], banners[index]];
    [bannersMobile[index], bannersMobile[newIndex]] = [bannersMobile[newIndex], bannersMobile[index]];
    [texts[index], texts[newIndex]] = [texts[newIndex], texts[index]];
    [titles[index], titles[newIndex]] = [titles[newIndex], titles[index]];
    [descs[index], descs[newIndex]] = [descs[newIndex], descs[index]];
    [ctaTexts[index], ctaTexts[newIndex]] = [ctaTexts[newIndex], ctaTexts[index]];
    [ctaUrls[index], ctaUrls[newIndex]] = [ctaUrls[newIndex], ctaUrls[index]];
    updateConfig({ banners, banners_mobile: bannersMobile, banner_texts: texts, banner_titles: titles, banner_descriptions: descs, banner_cta_texts: ctaTexts, banner_cta_urls: ctaUrls });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold" style={{ color: 'var(--ios-text-secondary)' }}>Vista Previa del Banner</span>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--ios-bg)' }}>
            <button onClick={() => setBannerPreviewMode('mobile')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: bannerPreviewMode === 'mobile' ? themeColor : 'transparent',
                color: bannerPreviewMode === 'mobile' ? '#fff' : 'var(--ios-text-secondary)',
              }}>
              <Smartphone size={12} /> Movil
            </button>
            <button onClick={() => setBannerPreviewMode('desktop')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: bannerPreviewMode === 'desktop' ? themeColor : 'transparent',
                color: bannerPreviewMode === 'desktop' ? '#fff' : 'var(--ios-text-secondary)',
              }}>
              <Monitor size={12} /> Escritorio
            </button>
          </div>
        </div>
      </div>

      {(config.banners || []).map((banner, index) => {
        const isHero = index === 0;
        const bannerTitle = isHero ? (config.hero_title || config.site_nombre || '') : (config.banner_titles?.[index] || '');
        const bannerDesc = isHero ? (config.hero_subtitle || config.mensaje_bienvenida || '') : (config.banner_descriptions?.[index] || '');
        const bannerCtaText = isHero ? (config.hero_cta_text || '') : (config.banner_cta_texts?.[index] || '');
        const bannerCtaUrl = isHero ? (config.hero_cta_url || '') : (config.banner_cta_urls?.[index] || '');
        const bannerMobile = config.banners_mobile?.[index] || '';

        return (
          <div key={index} className="admin-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="admin-label">
                {isHero ? 'Banner Principal (Hero)' : `Banner ${index + 1}`}
              </p>
              <div className="flex gap-1">
                <button onClick={() => handleMoveBanner(index, 'up')} disabled={index === 0}
                  className="p-1.5 rounded-lg disabled:opacity-30 cursor-pointer" style={{ background: 'var(--ios-bg)', color: 'var(--ios-text-secondary)' }}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => handleMoveBanner(index, 'down')} disabled={index === (config.banners?.length || 0) - 1}
                  className="p-1.5 rounded-lg disabled:opacity-30 cursor-pointer" style={{ background: 'var(--ios-bg)', color: 'var(--ios-text-secondary)' }}>
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => handleRemoveBanner(index)}
                  className="p-1.5 rounded-lg cursor-pointer" style={{ background: '#FF3B3015', color: '#FF3B30' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Imagen del Banner (Escritorio)</label>
              <div className="mt-1">
                <ImageField
                  value={banner || ''}
                  onChange={url => {
                    const newBanners = [...(config.banners || [])];
                    newBanners[index] = url;
                    updateConfig({ banners: newBanners });
                  }}
                  bucket="settings"
                  folder={`banners/${isHero ? 'hero' : 'secondary'}`}
                  maxSize={1200}
                  previewSize="lg"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Imagen para Móvil (opcional)</label>
              <p className="text-[10px] mb-1" style={{ color: 'var(--ios-text-tertiary)' }}>
                Si se deja vacía, se usará la imagen de escritorio.
              </p>
              <div className="mt-1">
                <ImageField
                  value={bannerMobile}
                  onChange={url => {
                    const newBannersMobile = [...(config.banners_mobile || [])];
                    newBannersMobile[index] = url;
                    updateConfig({ banners_mobile: newBannersMobile });
                  }}
                  bucket="settings"
                  folder={`banners/${isHero ? 'hero-mobile' : 'secondary-mobile'}`}
                  maxSize={800}
                  previewSize="lg"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>{isHero ? 'Titulo (H1)' : 'Titulo'}</label>
                <input type="text" value={bannerTitle}
                  onChange={e => {
                    if (isHero) {
                      updateConfig({ hero_title: e.target.value });
                    } else {
                      const newTitles = [...(config.banner_titles || [])];
                      newTitles[index] = e.target.value;
                      updateConfig({ banner_titles: newTitles });
                    }
                  }}
                  className="admin-input mt-1" placeholder={isHero ? 'Pide Tu Comida Favorita' : 'Titulo del banner...'} />
              </div>

              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Descripcion</label>
                <input type="text" value={bannerDesc}
                  onChange={e => {
                    if (isHero) {
                      updateConfig({ hero_subtitle: e.target.value });
                    } else {
                      const newDescs = [...(config.banner_descriptions || [])];
                      newDescs[index] = e.target.value;
                      updateConfig({ banner_descriptions: newDescs });
                    }
                  }}
                  className="admin-input mt-1" placeholder={isHero ? 'Delivery express en minutos' : 'Descripcion del banner...'} />
              </div>

              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Texto del Boton CTA</label>
                <input type="text" value={bannerCtaText}
                  onChange={e => {
                    if (isHero) {
                      updateConfig({ hero_cta_text: e.target.value });
                    } else {
                      const newCtaTexts = [...(config.banner_cta_texts || [])];
                      newCtaTexts[index] = e.target.value;
                      updateConfig({ banner_cta_texts: newCtaTexts });
                    }
                  }}
                  className="admin-input mt-1" placeholder="Dejar vacio para ocultar boton" />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>URL del Boton (destino)</label>
                <input type="url" value={bannerCtaUrl}
                  onChange={e => {
                    if (isHero) {
                      updateConfig({ hero_cta_url: e.target.value });
                    } else {
                      const newCtaUrls = [...(config.banner_cta_urls || [])];
                      newCtaUrls[index] = e.target.value;
                      updateConfig({ banner_cta_urls: newCtaUrls });
                    }
                  }}
                  className="admin-input mt-1" placeholder="https://... o #id-seccion" />
                <p className="text-[10px] mt-1" style={{ color: 'var(--ios-text-tertiary)' }}>
                  Usa #nombre para scroll a una seccion (ej: #download-app). Dejar vacio para ir al catalogo.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Vista Previa</label>
              <div className="mt-2 rounded-xl overflow-hidden" style={{
                border: '1px solid var(--ios-border)',
                maxWidth: bannerPreviewMode === 'mobile' ? '375px' : '100%',
                margin: bannerPreviewMode === 'mobile' ? '0 auto' : '0',
              }}>
                <div className="relative" style={{ aspectRatio: bannerPreviewMode === 'mobile' ? '9/14' : '2/1' }}>
                  {(bannerPreviewMode === 'mobile' ? (bannerMobile || banner) : banner) ? (
                    <img src={bannerPreviewMode === 'mobile' ? (bannerMobile || banner) : banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--ios-bg)' }}>
                      <Image size={32} style={{ color: 'var(--ios-text-tertiary)' }} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    {bannerTitle && (
                      <p className="text-white font-extrabold leading-tight mb-1" style={{
                        fontSize: bannerPreviewMode === 'mobile' ? '16px' : '24px',
                      }}>
                        {bannerTitle}
                      </p>
                    )}
                    {bannerDesc && (
                      <p className="text-white/75 mb-2" style={{
                        fontSize: bannerPreviewMode === 'mobile' ? '11px' : '14px',
                      }}>
                        {bannerDesc}
                      </p>
                    )}
                    {bannerCtaText && (
                      <span className="inline-block px-4 py-1.5 rounded-lg text-white font-bold" style={{
                        background: themeColor,
                        fontSize: bannerPreviewMode === 'mobile' ? '11px' : '13px',
                      }}>
                        {bannerCtaText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button onClick={handleAddBanner}
        className="admin-card p-4 flex items-center justify-center gap-2 cursor-pointer transition-all"
        style={{ border: '2px dashed var(--ios-border)', color: 'var(--ios-text-secondary)' }}>
        <Plus size={18} /> Agregar Banner
      </button>

      <p className="text-xs text-center" style={{ color: 'var(--ios-text-tertiary)' }}>
        Formatos: JPG, PNG, WebP · Escritorio: 1200x600px · Móvil: 600x800px
      </p>
    </div>
  );
};

export default BannersSection;
