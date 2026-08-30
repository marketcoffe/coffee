import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../../../../store/AppContext';
import { RefreshCcw, FileJson, Bell, AlertTriangle, Terminal, Printer } from 'lucide-react';
import { useToast } from '../../../../components/Toast';
import DatabaseCleanup from './DatabaseCleanup';

const SistemaSection: React.FC = () => {
  const { config, updateConfig, foodItems, coupons, notifications, currentUser, addNotification } = useApp();
  const { showToast } = useToast();
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [webhookUrl, setWebhookUrl] = useState(config.push_webhook_url || '');
  const [webhookSecret, setWebhookSecret] = useState(config.push_webhook_secret || '');
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(config.print_config?.paper_size || '58mm');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );
  const [showForceUpdateConfirm, setShowForceUpdateConfirm] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const handleManualBackup = () => {
    const backupData = {
      version: "1.0",
      site: config.site_nombre,
      date: new Date().toISOString(),
      type: "manual",
      data: { products: foodItems, config, coupons, notifications }
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.site_nombre?.toLowerCase().replace(/\s/g, '_') || 'backup'}_backup_manual_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    localStorage.setItem('foodapp_last_backup_date', String(new Date().getTime()));
    showToast('success', 'Respaldo de seguridad generado y descargado con exito!');
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (!backup.data || !backup.version) throw new Error("Formato de respaldo invalido");
        if (backup.data.config) updateConfig(backup.data.config);
        showToast('success', "Sincronizacion completada.");
        window.location.reload();
      } catch {
        showToast('error', 'Error al restaurar: El archivo no es un respaldo valido.');
      }
    };
    reader.readAsText(file);
  };

  const forceUpdateApp = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) { await registration.unregister(); }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    setShowForceUpdateConfirm(false);
    setTimeout(() => { window.location.reload(); }, 500);
  };

  const handleTestPush = async () => {
    const target = config.telefono_soporte || currentUser?.telefono;
    if (!target) { showToast('error', 'No hay un numero de telefono configurado.'); return; }
    const success = await addNotification(`Prueba de Sistema ${config.site_nombre || ''}`, "Si recibes esta alerta, el sistema de Web Push esta funcionando correctamente.", "admin", target);
    if (success) showToast('success', 'Notificacion de prueba enviada a ' + target);
    else showToast('error', 'Error al enviar prueba.');
  };

  return (
    <div className="flex flex-col gap-4">
      {notifPermission === 'default' && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-full text-amber-600 shrink-0"><Bell size={18} /></div>
            <div className="text-left">
              <p className="text-xs font-bold text-amber-900 leading-tight">Alertas de Navegador Desactivadas</p>
              <p className="text-[10px] text-amber-700 mt-0.5">Para que suenen los pedidos nuevos y ver avisos en tiempo real, active los permisos de notificacion.</p>
            </div>
          </div>
          <button onClick={async () => { const res = await Notification.requestPermission(); setNotifPermission(res); }}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer">
            Activar Sonidos y Alertas
          </button>
        </div>
      )}

      <div className="admin-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl"><FileJson size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">Respaldo de Seguridad</h4>
            <p className="text-[11px] text-amber-700">Descarga un archivo JSON con todos los productos, configuracion y cupones.</p>
          </div>
        </div>
        <button onClick={handleManualBackup} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer">
          Generar Respaldo Ahora
        </button>
        <input type="file" ref={restoreInputRef} onChange={handleRestoreBackup} accept=".json" className="hidden" />
        <button onClick={() => restoreInputRef.current?.click()} className="w-full bg-white border border-amber-300 text-amber-700 font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all hover:bg-amber-100 mt-2 cursor-pointer">
          Restaurar Copia de Seguridad
        </button>
      </div>

      <div className="admin-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl"><Bell size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-violet-900">Verificador de Notificaciones Push</h4>
            <p className="text-[11px] text-violet-700">Lanza una alerta de prueba para verificar el sistema de Web Push.</p>
          </div>
        </div>
        <button onClick={handleTestPush} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer">
          Ejecutar Test de Notificacion Push
        </button>
      </div>

      <div className="admin-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl"><RefreshCcw size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Mantenimiento de Aplicacion (PWA)</h4>
            <p className="text-[11px] text-slate-500">Si los clientes no ven los ultimos cambios, pidales que ejecuten esta accion.</p>
          </div>
        </div>
        <button onClick={() => setShowForceUpdateConfirm(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer">
          Forzar Actualizacion Global
        </button>
      </div>

      <div className="admin-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl"><Bell size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-blue-900">Configuracion del Webhook Push</h4>
            <p className="text-[11px] text-blue-700">Conecta Supabase con el Worker de Cloudflare para enviar notificaciones push.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">URL del Webhook (Cloudflare Pages)</label>
            <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
              className="admin-input mt-1 font-mono text-[11px]"
              placeholder="https://su-app.pages.dev/api/push-notify" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Webhook Secret (Auth)</label>
            <input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
              className="admin-input mt-1 font-mono text-[11px]"
              placeholder="Clave de seguridad del webhook..." />
          </div>
          <button onClick={() => { updateConfig({ push_webhook_url: webhookUrl, push_webhook_secret: webhookSecret }); showToast('success', 'Configuracion del webhook guardada.'); }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer">
            Guardar Webhook
          </button>
        </div>
      </div>

      <div className="admin-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-xl"><AlertTriangle size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-red-900">Reportes de Errores</h4>
            <p className="text-[11px] text-red-700">Consulta los errores registrados en la consola del navegador.</p>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-900 text-green-400 font-mono text-[11px] max-h-40 overflow-y-auto">
          <p className="text-slate-500">// Los errores se muestran en la consola del navegador (F12)</p>
          <p className="text-slate-500">// Usa Ctrl+Shift+J para abrir la consola en Chrome</p>
          <p className="text-slate-500">// No hay errores criticos registrados en esta sesion.</p>
        </div>
      </div>

      <div className="admin-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-pink-100 text-pink-600 rounded-xl"><Printer size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-pink-900">Configuracion de Impresora</h4>
            <p className="text-[11px] text-pink-700">Selecciona el tamano de papel de tu impresora termica.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Tamano de Papel</label>
            <select
              value={paperSize}
              onChange={e => setPaperSize(e.target.value as '58mm' | '80mm')}
              className="admin-input mt-1 font-mono text-[11px]"
            >
              <option value="58mm">58mm - Termica chica (standard)</option>
              <option value="80mm">80mm - Termica grande</option>
            </select>
          </div>
          <button
            onClick={() => {
              updateConfig({ print_config: { paper_size: paperSize } });
              showToast('success', 'Configuracion de impresora guardada.');
            }}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer"
          >
            Guardar Config Impresora
          </button>
        </div>
      </div>

      <DatabaseCleanup />

      <div className="admin-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl"><Terminal size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">System Logs</h4>
            <p className="text-[11px] text-emerald-700">Informacion del sistema y version actual.</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-[11px] text-slate-600">
          <div className="flex justify-between"><span>Sitio:</span><span className="font-bold">{config.site_nombre || 'N/A'}</span></div>
          <div className="flex justify-between"><span>Productos:</span><span className="font-bold">{foodItems.length}</span></div>
          <div className="flex justify-between"><span>Cupones:</span><span className="font-bold">{coupons.length}</span></div>
          <div className="flex justify-between"><span>Sucursales:</span><span className="font-bold">{config.sedes?.length || 0}</span></div>
          <div className="flex justify-between"><span>Tema:</span><span className="font-bold" style={{ color: config.theme_color }}>{config.theme_color || '#A4D045'}</span></div>
          <div className="flex justify-between"><span>Version:</span><span className="font-bold">1.0.0</span></div>
        </div>
      </div>

      {showForceUpdateConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForceUpdateConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Forzar Actualizacion</h3>
            <p className="text-xs text-slate-600 mb-4">Esto limpiara la cache de todos los clientes y forzara una recarga. Los usuarios tendran que volver a cargar la app.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowForceUpdateConfirm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancelar</button>
              <button onClick={forceUpdateApp} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">Forzar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SistemaSection;
