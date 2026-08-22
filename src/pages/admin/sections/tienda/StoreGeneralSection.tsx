import React from 'react';
import { useApp } from '../../../../store/AppContext';
import { useToast } from '../../../../components/Toast';
import {
  Store, AlertTriangle, MessageSquare, ExternalLink
} from 'lucide-react';

const StoreGeneralSection: React.FC = () => {
  const { config, updateConfig, currentUser, syncPushSubscription } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card p-4">
        <p className="admin-label mb-3">Nombre del Sitio</p>
        <input type="text" value={config.site_nombre} onChange={e => updateConfig({ site_nombre: e.target.value })}
          className="admin-input" placeholder="Mi Restaurante" />
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Mensaje de Bienvenida</p>
        <textarea value={config.mensaje_bienvenida || ''} onChange={e => updateConfig({ mensaje_bienvenida: e.target.value })}
          className="admin-input" rows={3} placeholder="La mejor hamburgueseria con delivery express." style={{ resize: 'none' }} />
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Direccion Fisica</p>
        <input type="text" value={config.direccion_fisica} onChange={e => updateConfig({ direccion_fisica: e.target.value })}
          className="admin-input" placeholder="Av. Principal, Local #12, Ciudad" />
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Telefono / WhatsApp</p>
        <div className="flex flex-col gap-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-[10px] font-bold" style={{ color: 'var(--ios-text-secondary)' }}>Numero Maestro de Notificaciones</span>
            {currentUser && config.telefono_soporte !== currentUser.telefono && (
              <button onClick={async () => {
                updateConfig({ telefono_soporte: currentUser.telefono });
                const result = await syncPushSubscription();
                if (!result.success) showToast('error', 'Error al sincronizar push: ' + result.error);
              }} className="text-[9px] px-2 py-0.5 rounded font-bold uppercase cursor-pointer" style={{ background: '#FF950020', color: '#FF9500', border: '1px solid #FF950040' }}>
                Usar mi numero
              </button>
            )}
          </div>
          <input type="tel" value={config.telefono_soporte} onChange={e => {
                  const v = e.target.value;
                  updateConfig({ telefono_soporte: v });
                  const principales = (config.sedes || []).filter(s => s.es_principal && s.activa);
                  if (principales.length === 1) {
                    updateConfig({ sedes: (config.sedes || []).map(s => s.id === principales[0].id ? { ...s, telefono: v, whatsapp_numero: s.whatsapp_numero || v } : s) });
                  }
                }}
            className="admin-input" placeholder="+584124058904" style={{
              borderColor: currentUser && config.telefono_soporte !== currentUser.telefono ? '#FF9500' : undefined
            }} />
          {currentUser && config.telefono_soporte !== currentUser.telefono && (
            <p className="text-[9px] font-bold flex items-center gap-1" style={{ color: '#FF9500' }}>
              <AlertTriangle size={10} /> Para recibir notificaciones Push, este numero debe coincidir con tu perfil ({currentUser.telefono}).
            </p>
          )}
        </div>
        {config.telefono_soporte && (
          <a href={`https://wa.me/${config.telefono_soporte.replace(/\D/g, '').replace(/^0/, '58')}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs font-semibold" style={{ color: themeColor }}>
            <MessageSquare size={12} /> Abrir WhatsApp <ExternalLink size={10} />
          </a>
        )}
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Coordenadas de la Tienda</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Latitud</label>
            <input type="number" step="any" value={config.coordenadas_tienda?.lat || 0}
              onChange={e => updateConfig({ coordenadas_tienda: { ...config.coordenadas_tienda, lat: parseFloat(e.target.value) || 0 } })}
              className="admin-input mt-1" placeholder="10.198300" />
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Longitud</label>
            <input type="number" step="any" value={config.coordenadas_tienda?.lng || 0}
              onChange={e => updateConfig({ coordenadas_tienda: { ...config.coordenadas_tienda, lng: parseFloat(e.target.value) || 0 } })}
              className="admin-input mt-1" placeholder="-68.004400" />
          </div>
        </div>
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Estado de la Tienda</p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={config.esta_abierta !== false}
              onChange={e => updateConfig({ esta_abierta: e.target.checked })}
              className="accent-activator rounded h-4 w-4" style={{ accentColor: themeColor }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ios-text)' }}>Tienda Abierta</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={config.tiene_mesas || false}
              onChange={e => updateConfig({ tiene_mesas: e.target.checked })}
              className="accent-activator rounded h-4 w-4" style={{ accentColor: themeColor }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ios-text)' }}>Tiene Mesas</span>
          </label>
          {config.tiene_mesas && (
            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Total de Mesas</label>
              <input type="number" min="0" value={config.total_mesas || 0}
                onChange={e => updateConfig({ total_mesas: parseInt(e.target.value) || 0 })}
                className="admin-input mt-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreGeneralSection;
