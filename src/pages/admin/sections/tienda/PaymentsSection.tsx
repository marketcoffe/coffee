import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';

const PaymentsSection: React.FC = () => {
  const { config, updateConfig } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  const paymentMethods = [
    { key: 'pagomovil_enabled', label: 'Pago Movil Bs', dataKey: 'pagomovil_data', discKey: 'pagomovil_discount_percent', placeholder: 'Banco, telefono, cedula...' },
    { key: 'zelle_enabled', label: 'Zelle USD', dataKey: 'zelle_data', discKey: 'zelle_discount_percent', placeholder: 'Email de Zelle...' },
    { key: 'efectivo_enabled', label: 'Efectivo', dataKey: 'efectivo_data', discKey: 'efectivo_discount_percent', placeholder: 'Descripcion del metodo...' },
    { key: 'transferencia_enabled', label: 'Transferencia Bancaria', dataKey: 'transferencia_data', discKey: 'transferencia_discount_percent', placeholder: 'Datos de cuenta...' },
  ];

  const handleConfigChange = (key: string, value: any) => {
    setSaveStatus('saving');
    updateConfig({ [key]: value });
    // Show success after a brief delay (updateConfig saves to localStorage immediately)
    setTimeout(() => setSaveStatus('idle'), 800);
  };

  return (
    <div className="flex flex-col gap-4">
      {saveStatus === 'saving' && (
        <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-600">
          Guardando...
        </div>
      )}

      {paymentMethods.map(p => (
        <div key={p.key} className="admin-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="admin-label">{p.label}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(config as any)[p.key] || false}
                onChange={e => handleConfigChange(p.key, e.target.checked)}
                className="rounded h-4 w-4" style={{ accentColor: themeColor }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--ios-text)' }}>
                {(config as any)[p.key] ? 'Activo' : 'Inactivo'}
              </span>
            </label>
          </div>
          {(config as any)[p.key] && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Datos del Metodo de Pago</label>
                <input type="text" value={(config as any)[p.dataKey] || ''}
                  onChange={e => handleConfigChange(p.dataKey, e.target.value)}
                  className="admin-input mt-1" placeholder={p.placeholder} />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>Descuento por usar este metodo (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={(config as any)[p.discKey] || 0}
                  onChange={e => handleConfigChange(p.discKey, parseFloat(e.target.value) || 0)}
                  className="admin-input mt-1" />
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="admin-card p-4">
        <p className="admin-label mb-3">Tasa de Cambio (Bs/USD)</p>
        <input type="number" min="0" step="0.01" value={config.tasa_cambio || 0}
          onChange={e => handleConfigChange('tasa_cambio', parseFloat(e.target.value) || 0)}
          className="admin-input" placeholder="612.43" />
      </div>
    </div>
  );
};

export default PaymentsSection;
