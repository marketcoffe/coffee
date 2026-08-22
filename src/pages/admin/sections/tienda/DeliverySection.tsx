import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { DeliveryZone } from '../../../../types/store';
import { Plus, Trash2 } from 'lucide-react';

const DeliverySection: React.FC = () => {
  const { config, updateConfig } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCost, setNewZoneCost] = useState(0);
  const [newZoneMinKm, setNewZoneMinKm] = useState(0);
  const [newZoneMaxKm, setNewZoneMaxKm] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card p-4">
        <p className="admin-label mb-3">Opciones de Delivery</p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={config.delivery_gratis || false}
              onChange={e => updateConfig({ delivery_gratis: e.target.checked })}
              className="rounded h-4 w-4" style={{ accentColor: themeColor }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ios-text)' }}>Delivery Gratis</span>
          </label>
          {!config.delivery_gratis && (
            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Costo base por Km ($)</label>
              <input type="number" min="0" step="0.1" value={config.costo_delivery_km || 0}
                onChange={e => updateConfig({ costo_delivery_km: parseFloat(e.target.value) || 0 })}
                className="admin-input mt-1" />
            </div>
          )}
          {config.delivery_gratis && (
            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Minimo para delivery gratis ($)</label>
              <input type="number" min="0" step="0.5" value={config.delivery_gratis_threshold || 0}
                onChange={e => updateConfig({ delivery_gratis_threshold: parseFloat(e.target.value) || 0 })}
                className="admin-input mt-1" />
            </div>
          )}
        </div>
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Recogida en el Local</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={config.recogida_en_local !== false}
            onChange={e => updateConfig({ recogida_en_local: e.target.checked })}
            className="rounded h-4 w-4" style={{ accentColor: themeColor }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ios-text)' }}>Ofrecer Recogida en Tienda</span>
        </label>
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Entrega por Zonas</p>
        <label className="flex items-center gap-3 cursor-pointer mb-3">
          <input type="checkbox" checked={config.entrega_por_zonas || false}
            onChange={e => updateConfig({ entrega_por_zonas: e.target.checked })}
            className="rounded h-4 w-4" style={{ accentColor: themeColor }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ios-text)' }}>Ofrecer Entrega por Zonas</span>
        </label>

        {config.entrega_por_zonas && (
          <div className="flex flex-col gap-2">
            {(config.delivery_zonas || []).map((z, idx) => (
              <div key={z.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--ios-bg)', border: '1px solid var(--ios-border)' }}>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold block truncate" style={{ color: 'var(--ios-text)' }}>{z.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--ios-text-secondary)' }}>{z.minKm} - {z.maxKm} km | ${z.cost.toFixed(2)}</span>
                </div>
                <button onClick={() => { setEditingZone(z); setNewZoneName(z.name); setNewZoneCost(z.cost); setNewZoneMinKm(z.minKm); setNewZoneMaxKm(z.maxKm); }}
                  className="p-1.5 rounded-md cursor-pointer" style={{ color: themeColor }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => { const updated = (config.delivery_zonas || []).filter((_, i) => i !== idx); updateConfig({ delivery_zonas: updated }); }}
                  className="p-1.5 rounded-md cursor-pointer" style={{ color: '#FF3B30' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <div className="p-3 rounded-lg" style={{ background: 'var(--ios-bg)', border: '1px solid var(--ios-border)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--ios-text)' }}>{editingZone ? 'Editar Zona' : 'Nueva Zona'}</p>
              <div className="flex flex-col gap-2">
                <input type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                  placeholder="Nombre de la zona" className="admin-input text-xs" />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Costo ($)</label>
                    <input type="number" min="0" step="0.5" value={newZoneCost}
                      onChange={e => setNewZoneCost(parseFloat(e.target.value) || 0)}
                      className="admin-input mt-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Km Min</label>
                    <input type="number" min="0" value={newZoneMinKm}
                      onChange={e => setNewZoneMinKm(parseFloat(e.target.value) || 0)}
                      className="admin-input mt-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Km Max</label>
                    <input type="number" min="0" value={newZoneMaxKm}
                      onChange={e => setNewZoneMaxKm(parseFloat(e.target.value) || 0)}
                      className="admin-input mt-1 text-xs" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (!newZoneName.trim()) return;
                    const zone: DeliveryZone = { id: editingZone ? editingZone.id : `z-${crypto.randomUUID()}`, name: newZoneName.trim(), cost: newZoneCost, minKm: newZoneMinKm, maxKm: newZoneMaxKm };
                    const zones = [...(config.delivery_zonas || [])];
                    if (editingZone) { const idx = zones.findIndex(z => z.id === editingZone.id); if (idx >= 0) zones[idx] = zone; }
                    else { zones.push(zone); }
                    updateConfig({ delivery_zonas: zones });
                    setEditingZone(null); setNewZoneName(''); setNewZoneCost(0); setNewZoneMinKm(0); setNewZoneMaxKm(0);
                  }} disabled={!newZoneName.trim()}
                    className="admin-btn text-xs flex-1 cursor-pointer disabled:opacity-40">
                    {editingZone ? 'Guardar' : 'Agregar Zona'}
                  </button>
                  {editingZone && (
                    <button onClick={() => { setEditingZone(null); setNewZoneName(''); setNewZoneCost(0); setNewZoneMinKm(0); setNewZoneMaxKm(0); }}
                      className="admin-btn-secondary admin-btn text-xs cursor-pointer">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Envio Nacional</p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={config.envio_nacional || false}
              onChange={e => updateConfig({ envio_nacional: e.target.checked })}
              className="rounded h-4 w-4" style={{ accentColor: themeColor }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ios-text)' }}>Habilitar Envio Nacional</span>
          </label>
          {config.envio_nacional && (
            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Costo Envio Nacional ($)</label>
              <input type="number" min="0" step="0.5" value={config.costo_envio_nacional || 0}
                onChange={e => updateConfig({ costo_envio_nacional: parseFloat(e.target.value) || 0 })}
                className="admin-input mt-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliverySection;
