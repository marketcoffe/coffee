import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { supabase } from '../../../../store/supabaseClient';
import { Sede } from '../../../../types/store';
import { Building2, Plus, Trash2, X, Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useToast } from '../../../../components/Toast';

const SucursalesSection: React.FC = () => {
  const { config, updateConfig } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';

  const [sedeForm, setSedeForm] = useState({ nombre: '', telefono: '', whatsapp_numero: '', direccion: '', horario: '', lat: 0, lng: 0 });
  const [editingSedeId, setEditingSedeId] = useState<string | null>(null);

  const [credSedeId, setCredSedeId] = useState<string | null>(null);
  const [credEmail, setCredEmail] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credSaving, setCredSaving] = useState(false);
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [deleteConfirmPrincipal, setDeleteConfirmPrincipal] = useState<string | null>(null);
  const [deleteConfirmSede, setDeleteConfirmSede] = useState<string | null>(null);

  const handleCreateSucursalCredential = async () => {
    if (!credSedeId || !credEmail.trim() || !credPassword.trim()) {
      showToast('error', 'Debes indicar el correo y la contrasena de acceso.');
      return;
    }
    if (credPassword.trim().length < 6) {
      showToast('error', 'La contrasena debe tener al menos 6 caracteres.');
      return;
    }
    setCredSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credEmail.trim().toLowerCase(),
        password: credPassword.trim(),
        options: { data: { nombre: (config.sedes || []).find(s => s.id === credSedeId)?.nombre || '', role: 'operator', sede_id: credSedeId } }
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');
      const { error: dbError } = await supabase
        .from('admin_users')
        .insert({
          id: authData.user.id,
          email: credEmail.trim().toLowerCase(),
          nombre: (config.sedes || []).find(s => s.id === credSedeId)?.nombre || credEmail.trim(),
          role: 'operator',
          active: true,
          sede_id: credSedeId
        });
      if (dbError) throw dbError;
      showToast('success', 'Acceso de sucursal creado. El operador podra entrar con ese correo y clave.');
      setCredSedeId(null);
      setCredEmail('');
      setCredPassword('');
    } catch (err: any) {
      showToast('error', 'Error: ' + (err.message || 'Error desconocido'));
    } finally {
      setCredSaving(false);
    }
  };

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="admin-label mb-3">{children}</p>
  );

  const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="text-xs font-semibold" style={{ color: 'var(--ios-text-secondary)' }}>{children}</label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Modo Multi-Sucursal</SectionTitle>
            <p className="text-[10px] mt-1" style={{ color: 'var(--ios-text-tertiary)' }}>
              {config.multi_sucursal_enabled
                ? 'Activado: cada sucursal manejara sus propios pedidos, y el cliente elige desde cual recibe su pedido.'
                : 'Desactivado: la tienda se comporta como una sola sucursal (la principal).'}
            </p>
          </div>
          <button
            onClick={() => updateConfig({ multi_sucursal_enabled: !config.multi_sucursal_enabled })}
            className="relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0"
            style={{ background: config.multi_sucursal_enabled ? themeColor : 'var(--ios-border)' }}>
            <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: config.multi_sucursal_enabled ? 'translateX(20px)' : 'translateX(0)' }} />
          </button>
        </div>
      </div>

      <div className="admin-card p-4">
        <SectionTitle>Gestion de Sucursales</SectionTitle>
        <p className="text-[10px] mb-3" style={{ color: 'var(--ios-text-tertiary)' }}>
          Administra las ubicaciones fisicas de tu negocio. La sede principal se usa para calcular distancias y zonas de delivery.
        </p>

        <div className="flex flex-col gap-2">
          {(config.sedes || []).map((sede) => (
            <div key={sede.id} className="p-3 rounded-xl" style={{
              background: sede.es_principal ? 'var(--ios-bg)' : 'var(--ios-card)',
              border: `1px solid ${sede.es_principal ? themeColor + '40' : 'var(--ios-border)'}`
            }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--ios-text)' }}>{sede.nombre}</span>
                    {sede.es_principal && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: themeColor + '20', color: themeColor }}>Principal</span>
                    )}
                    {!sede.activa && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: 'var(--ios-bg)', color: 'var(--ios-text-tertiary)' }}>Inactiva</span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--ios-text-secondary)' }}>{sede.direccion}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px]" style={{ color: 'var(--ios-text-tertiary)' }}>
                    <span>Tel: {sede.telefono}</span>
                    {sede.whatsapp_numero && <span>WhatsApp: {sede.whatsapp_numero}</span>}
                    {sede.horario && <span>{sede.horario}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => { setCredSedeId(sede.id); setCredEmail(''); setCredPassword(''); }}
                    className="p-1.5 rounded-lg cursor-pointer" style={{ color: '#5856D6' }} title="Crear acceso de sucursal">
                    <KeyRound size={14} />
                  </button>
                  <button onClick={() => {
                    const updated = (config.sedes || []).map(s => s.id === sede.id ? { ...s, activa: !s.activa } : s);
                    updateConfig({ sedes: updated });
                  }} className="p-1.5 rounded-lg cursor-pointer" style={{ color: sede.activa ? '#FF9500' : '#34C759' }}>
                    {sede.activa ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {!sede.es_principal && (
                    deleteConfirmPrincipal === sede.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => {
                          const updated = (config.sedes || []).map(s => ({ ...s, es_principal: s.id === sede.id }));
                          updateConfig({ sedes: updated });
                          setDeleteConfirmPrincipal(null);
                        }} className="px-2 py-1 bg-emerald-500 text-white text-[10px] rounded cursor-pointer font-bold">Si</button>
                        <button onClick={() => setDeleteConfirmPrincipal(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] rounded cursor-pointer font-bold">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmPrincipal(sede.id)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: themeColor }}>
                        <Check size={14} />
                      </button>
                    )
                  )}
                  <button onClick={() => {
                    setEditingSedeId(sede.id);
                    setSedeForm({ nombre: sede.nombre, telefono: sede.telefono || '', whatsapp_numero: sede.whatsapp_numero || '', direccion: sede.direccion || '', horario: sede.horario || '', lat: sede.coordenadas?.lat || 0, lng: sede.coordenadas?.lng || 0 });
                  }} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--ios-text-secondary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {!sede.es_principal && (
                    deleteConfirmSede === sede.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => {
                          const updated = (config.sedes || []).filter(s => s.id !== sede.id);
                          updateConfig({ sedes: updated });
                          setDeleteConfirmSede(null);
                        }} className="px-2 py-1 bg-red-500 text-white text-[10px] rounded cursor-pointer font-bold">Si</button>
                        <button onClick={() => setDeleteConfirmSede(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] rounded cursor-pointer font-bold">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmSede(sede.id)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: '#FF3B30' }}>
                        <Trash2 size={14} />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!config.sedes || config.sedes.length === 0) && (
            <p className="text-[11px] italic text-center py-4" style={{ color: 'var(--ios-text-tertiary)' }}>
              No hay sucursales configuradas. Agrega una abajo.
            </p>
          )}
        </div>
      </div>

      <div className="admin-card p-4">
        <SectionTitle>{editingSedeId ? 'Editar Sede' : 'Agregar Nueva Sede'}</SectionTitle>
        <div className="flex flex-col gap-3">
          <input type="text" value={sedeForm.nombre} onChange={e => setSedeForm({ ...sedeForm, nombre: e.target.value })}
            className="admin-input" placeholder="Nombre de la sede" />
          <input type="tel" value={sedeForm.telefono} onChange={e => setSedeForm({ ...sedeForm, telefono: e.target.value })}
            className="admin-input" placeholder="Telefono" />
          <input type="tel" value={sedeForm.whatsapp_numero} onChange={e => setSedeForm({ ...sedeForm, whatsapp_numero: e.target.value })}
            className="admin-input" placeholder="WhatsApp (opcional)" />
          <input type="text" value={sedeForm.direccion} onChange={e => setSedeForm({ ...sedeForm, direccion: e.target.value })}
            className="admin-input" placeholder="Direccion" />
          <input type="text" value={sedeForm.horario} onChange={e => setSedeForm({ ...sedeForm, horario: e.target.value })}
            className="admin-input" placeholder="Horario (ej: 8am - 10pm)" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Latitud</FieldLabel>
              <input type="number" step="any" value={sedeForm.lat || ''} onChange={e => setSedeForm({ ...sedeForm, lat: parseFloat(e.target.value) || 0 })}
                className="admin-input mt-1" placeholder="10.198300" />
            </div>
            <div>
              <FieldLabel>Longitud</FieldLabel>
              <input type="number" step="any" value={sedeForm.lng || ''} onChange={e => setSedeForm({ ...sedeForm, lng: parseFloat(e.target.value) || 0 })}
                className="admin-input mt-1" placeholder="-68.004400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              if (!sedeForm.nombre.trim()) return;
              const existingSede = editingSedeId ? (config.sedes || []).find(s => s.id === editingSedeId) : null;
              const nuevaSede: Sede = {
                id: editingSedeId || `sede-${crypto.randomUUID()}`,
                nombre: sedeForm.nombre.trim(),
                telefono: sedeForm.telefono,
                whatsapp_numero: sedeForm.whatsapp_numero || undefined,
                direccion: sedeForm.direccion,
                horario: sedeForm.horario,
                coordenadas: { lat: sedeForm.lat, lng: sedeForm.lng },
                es_principal: existingSede?.es_principal || (config.sedes || []).length === 0,
                activa: existingSede?.activa ?? true,
                delivery_mode: existingSede?.delivery_mode,
                permite_delivery: existingSede?.permite_delivery,
                permite_pickup: existingSede?.permite_pickup,
              };
              const sedes = [...(config.sedes || [])];
              if (editingSedeId) {
                const idx = sedes.findIndex(s => s.id === editingSedeId);
                if (idx >= 0) sedes[idx] = nuevaSede;
              } else {
                sedes.push(nuevaSede);
              }
              updateConfig({ sedes });
              if (nuevaSede.es_principal) {
                const phone = nuevaSede.whatsapp_numero || nuevaSede.telefono;
                if (phone) updateConfig({ telefono_soporte: phone });
              }
              setEditingSedeId(null);
              setSedeForm({ nombre: '', telefono: '', whatsapp_numero: '', direccion: '', horario: '', lat: 0, lng: 0 });
            }} disabled={!sedeForm.nombre.trim()}
              className="admin-btn flex-1 cursor-pointer disabled:opacity-40">
              {editingSedeId ? 'Guardar Cambios' : 'Agregar Sede'}
            </button>
            {editingSedeId && (
              <button onClick={() => { setEditingSedeId(null); setSedeForm({ nombre: '', telefono: '', whatsapp_numero: '', direccion: '', horario: '', lat: 0, lng: 0 }); }}
                className="admin-btn-secondary admin-btn cursor-pointer">Cancelar</button>
            )}
          </div>
        </div>
      </div>

      {credSedeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCredSedeId(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <KeyRound size={16} style={{ color: '#5856D6' }} /> Crear acceso de sucursal
              </h3>
              <button onClick={() => setCredSedeId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Genera credenciales para <b>{(config.sedes || []).find(s => s.id === credSedeId)?.nombre}</b>. Este operador solo verá los pedidos de esa sucursal.
            </p>
            <div className="flex flex-col gap-3">
              <input type="email" value={credEmail} onChange={e => setCredEmail(e.target.value)}
                placeholder="sucursal@correo.com" className="admin-input" />
              <div className="relative">
                <input type={showCredPassword ? 'text' : 'password'} value={credPassword} onChange={e => setCredPassword(e.target.value)}
                  placeholder="Contrasena (min. 6 caracteres)" className="admin-input w-full pr-10" />
                <button type="button" onClick={() => setShowCredPassword(!showCredPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  {showCredPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setCredSedeId(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl text-slate-700 text-xs font-semibold cursor-pointer">Cancelar</button>
                <button onClick={handleCreateSucursalCredential} disabled={credSaving}
                  className="flex-1 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50" style={{ background: '#5856D6' }}>
                  {credSaving ? 'Creando...' : 'Crear acceso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SucursalesSection;
