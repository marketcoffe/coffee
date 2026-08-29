import React, { useState } from 'react';
import { supabase } from '../../../../store/supabaseClient';
import { useToast } from '../../../../components/Toast';
import { Trash2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface CleanupTarget {
  id: string;
  label: string;
  description: string;
  table: string;
  icon: string;
}

const CLEANUP_TARGETS: CleanupTarget[] = [
  { id: 'orders', label: 'Pedidos', description: 'Todos los pedidos y comandas', table: 'orders', icon: '📦' },
  { id: 'clients', label: 'Clientes', description: 'Usuarios clientes registrados', table: 'usuarios_clientes', icon: '👥' },
  { id: 'notifications', label: 'Notificaciones', description: 'Notificaciones in-app y push', table: 'notifications', icon: '🔔' },
  { id: 'push_subs', label: 'Suscripciones Push', description: 'Tokens de notificaciones push', table: 'push_subscriptions', icon: '📱' },
  { id: 'loyalty', label: 'Fidelización', description: 'Historial y transacciones de puntos', table: 'loyalty_history', icon: '⭐' },
  { id: 'reviews', label: 'Reseñas', description: 'Calificaciones y comentarios de productos', table: 'product_reviews', icon: '💬' },
  { id: 'promos', label: 'Promociones', description: 'Promociones y ofertas activas', table: 'promotions', icon: '🏷️' },
  { id: 'coupons', label: 'Cupones', description: 'Cupones de descuento', table: 'coupons', icon: '🎫' },
  { id: 'flash_sales', label: 'Ofertas Flash', description: 'Ventas flash programadas', table: 'flash_sales', icon: '⚡' },
  { id: 'segments', label: 'Segmentos', description: 'Segmentación de clientes', table: 'customer_segments', icon: '📊' },
  { id: 'automations', label: 'Automatizaciones', description: 'Reglas y logs de automatización', table: 'automation_rules', icon: '🤖' },
  { id: 'campaigns', label: 'Campañas', description: 'Campañas de marketing', table: 'campaigns', icon: '📣' },
  { id: 'security_logs', label: 'Logs de Seguridad', description: 'Registro de intentos de login', table: 'security_audit_logs', icon: '🔐' },
];

const CONFIRMATION_TEXT = 'LIMPIAR';

const DatabaseCleanup: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'select' | 'confirm' | 'type' | 'cleaning' | 'done'>('select');
  const [confirmChecks, setConfirmChecks] = useState({ understand: false, noUndo: false, backup: false });
  const [typeInput, setTypeInput] = useState('');
  const [results, setResults] = useState<{ table: string; deleted: number; error?: string }[]>([]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === CLEANUP_TARGETS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(CLEANUP_TARGETS.map(t => t.id)));
    }
  };

  const allChecked = confirmChecks.understand && confirmChecks.noUndo && confirmChecks.backup;
  const typeCorrect = typeInput.trim().toUpperCase() === CONFIRMATION_TEXT;

  const handleClean = async () => {
    if (!allChecked || !typeCorrect) return;
    setStep('cleaning');
    const res: { table: string; deleted: number; error?: string }[] = [];

    for (const targetId of selected) {
      const target = CLEANUP_TARGETS.find(t => t.id === targetId);
      if (!target) continue;

      try {
        const { count, error } = await supabase
          .from(target.table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          res.push({ table: target.label, deleted: 0, error: error.message });
        } else {
          res.push({ table: target.label, deleted: count || 0 });
        }
      } catch (err: unknown) {
        res.push({ table: target.label, deleted: 0, error: err instanceof Error ? err.message : 'Error desconocido' });
      }
    }

    setResults(res);
    setStep('done');
    const totalDeleted = res.reduce((sum, r) => sum + r.deleted, 0);
    const errors = res.filter(r => r.error);
    if (errors.length === 0) {
      showToast('success', `Base de datos limpiada: ${totalDeleted} registros eliminados`);
    } else {
      showToast('error', `Limpieza completada con ${errors.length} errores`);
    }
  };

  const reset = () => {
    setIsOpen(false);
    setStep('select');
    setSelected(new Set());
    setConfirmChecks({ understand: false, noUndo: false, backup: false });
    setTypeInput('');
    setResults([]);
  };

  if (!isOpen) {
    return (
      <div className="admin-card p-4 border-2 border-dashed border-red-200 bg-red-50/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-xl"><Trash2 size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-red-900">Limpiar Base de Datos</h4>
            <p className="text-[11px] text-red-700">Eliminar pedidos, clientes y datos para comenzar desde cero.</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-[0.98]"
        >
          Abrir Panel de Limpieza
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={reset} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-red-100 bg-red-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-600" />
              <h3 className="text-sm font-bold text-red-900">
                {step === 'select' && 'Seleccionar datos a eliminar'}
                {step === 'confirm' && 'Confirmar eliminación'}
                {step === 'type' && 'Escriba LIMPIAR para confirmar'}
                {step === 'cleaning' && 'Limpiando base de datos...'}
                {step === 'done' && 'Limpieza completada'}
              </h3>
            </div>
            <button onClick={reset} className="p-1 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 cursor-pointer">
              <XCircle size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* STEP 1: Select tables */}
          {step === 'select' && (
            <div className="flex flex-col gap-3">
              <button onClick={selectAll} className="text-left text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer">
                {selected.size === CLEANUP_TARGETS.length ? '☆ Deseleccionar todo' : '★ Seleccionar todo'}
              </button>

              {CLEANUP_TARGETS.map(target => (
                <label
                  key={target.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selected.has(target.id)
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(target.id)}
                    onChange={() => toggleSelect(target.id)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-lg">{target.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">{target.label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{target.description}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{target.table}</span>
                </label>
              ))}

              {selected.size > 0 && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] font-bold text-amber-800">
                    {selected.size} tabla{selected.size > 1 ? 's' : ''} seleccionada{selected.size > 1 ? 's' : ''} para eliminar
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Confirm checkboxes */}
          {step === 'confirm' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-600">
                Se eliminarán <span className="font-bold text-red-600">{selected.size}</span> tablas. Esta acción es irreversible.
              </p>

              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={confirmChecks.understand}
                    onChange={e => setConfirmChecks(p => ({ ...p, understand: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700">Entiendo que se eliminarán <span className="font-bold">todos los datos</span> de las tablas seleccionadas</span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={confirmChecks.noUndo}
                    onChange={e => setConfirmChecks(p => ({ ...p, noUndo: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700">Entiendo que <span className="font-bold">no hay forma de deshacer</span> esta operación</span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={confirmChecks.backup}
                    onChange={e => setConfirmChecks(p => ({ ...p, backup: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700">He creado un <span className="font-bold">respaldo de seguridad</span> antes de continuar</span>
                </label>
              </div>

              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider">Tablas que se eliminarán:</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from(selected).map(id => {
                    const t = CLEANUP_TARGETS.find(x => x.id === id);
                    return t ? (
                      <span key={id} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold">
                        {t.icon} {t.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Type confirmation */}
          {step === 'type' && (
            <div className="flex flex-col gap-4 items-center">
              <div className="p-4 rounded-full bg-red-100">
                <AlertTriangle size={40} className="text-red-600" />
              </div>
              <p className="text-xs text-slate-600 text-center">
                Para confirmar, escriba <span className="font-bold text-red-600 font-mono">{CONFIRMATION_TEXT}</span> en el campo de abajo:
              </p>
              <input
                type="text"
                value={typeInput}
                onChange={e => setTypeInput(e.target.value)}
                placeholder={CONFIRMATION_TEXT}
                className="w-full max-w-xs px-4 py-3 rounded-xl border-2 border-red-300 text-center text-sm font-mono font-bold text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none"
                autoFocus
              />
              {!typeCorrect && typeInput.length > 0 && (
                <p className="text-[10px] text-red-500">Debe escribir exactamente "{CONFIRMATION_TEXT}"</p>
              )}
            </div>
          )}

          {/* STEP 4: Cleaning */}
          {step === 'cleaning' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-10 h-10 border-3 border-red-200 border-t-red-600 rounded-full animate-spin" />
              <p className="text-xs text-slate-600 font-bold">Eliminando datos...</p>
            </div>
          )}

          {/* STEP 5: Done */}
          {step === 'done' && (
            <div className="flex flex-col gap-3">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${r.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                  {r.error ? (
                    <XCircle size={16} className="text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">{r.table}</p>
                    {r.error ? (
                      <p className="text-[10px] text-red-600 truncate">{r.error}</p>
                    ) : (
                      <p className="text-[10px] text-green-700">{r.deleted} registros eliminados</p>
                    )}
                  </div>
                </div>
              ))}

              <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-700">
                  Total: {results.reduce((s, r) => s + r.deleted, 0)} registros eliminados
                  {results.filter(r => r.error).length > 0 && (
                    <span className="text-red-600"> · {results.filter(r => r.error).length} errores</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          {step === 'select' && (
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={selected.size === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                Continuar ({selected.size})
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="flex gap-2">
              <button onClick={() => setStep('select')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Atrás
              </button>
              <button
                onClick={() => setStep('type')}
                disabled={!allChecked}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          )}

          {step === 'type' && (
            <div className="flex gap-2">
              <button onClick={() => setStep('confirm')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Atrás
              </button>
              <button
                onClick={handleClean}
                disabled={!typeCorrect}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Limpiar Ahora
              </button>
            </div>
          )}

          {step === 'done' && (
            <button onClick={reset} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseCleanup;
