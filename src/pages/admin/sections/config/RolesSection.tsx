import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../store/AppContext';
import { supabase } from '../../../../store/supabaseClient';
import { Shield, Plus, Trash2, Edit2, Key, User, Mail, X, Eye, EyeOff, MapPin } from 'lucide-react';
import { useToast } from '../../../../components/Toast';

interface OperatorRecord {
  id: string;
  email: string;
  username?: string;
  nombre: string;
  role: 'admin' | 'operator' | 'customer';
  created_at: string;
  active: boolean;
  sede_id?: string;
}

const RolesSection: React.FC = () => {
  const { config } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';
  const activeSedes = config.sedes?.filter(s => s.activa) || [];

  const [operators, setOperators] = useState<OperatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', username: '', nombre: '', password: '', sede_id: '', role: 'operator' as 'admin' | 'operator' | 'customer' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassInput, setNewPassInput] = useState('');

  useEffect(() => { loadOperators(); }, []);

  const loadOperators = async () => {
    setLoading(true);
    const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });
    if (data) setOperators(data as OperatorRecord[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.email || !formData.username || !formData.nombre || (!editingId && !formData.password)) {
      showToast('error', 'Todos los campos son obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('admin_users').update({ email: formData.email, username: formData.username, nombre: formData.nombre, sede_id: formData.sede_id, role: formData.role }).eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Usuario actualizado exitosamente');
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim().toLowerCase(),
          password: formData.password.trim(),
          options: { data: { nombre: formData.nombre.trim(), username: formData.username.trim(), role: formData.role, sede_id: formData.sede_id } }
        });
        if (authError) throw authError;
        if (authData.user) {
          const { error: dbError } = await supabase.from('admin_users').insert({
            id: authData.user.id, email: formData.email.trim().toLowerCase(),
            username: formData.username.trim(),
            nombre: formData.nombre.trim(), role: formData.role, active: true, sede_id: formData.sede_id
          });
          if (dbError) throw dbError;
        }
        showToast('success', 'Usuario creado exitosamente');
      }
      setShowForm(false); setEditingId(null);
      setFormData({ email: '', username: '', nombre: '', password: '', sede_id: '', role: 'operator' });
      await loadOperators();
    } catch (err: unknown) {
      showToast('error', 'Error: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally { setSaving(false); }
  };

  const handleEdit = (op: OperatorRecord) => {
    setEditingId(op.id);
    setFormData({ email: op.email, username: op.username || '', nombre: op.nombre, password: '', sede_id: op.sede_id || '', role: op.role });
    setShowForm(true);
  };

  const handleToggleActive = async (op: OperatorRecord) => {
    const newActive = !op.active;
    const { error } = await supabase.from('admin_users').update({ active: newActive }).eq('id', op.id);
    if (!error) await loadOperators();
    setDeleteConfirm(null);
  };

  const handleResetPassword = async (op: OperatorRecord) => {
    if (!newPassInput) return;
    if (newPassInput.length < 6) { showToast('error', 'La contrasena debe tener al menos 6 caracteres'); return; }
    try {
      const { error } = await supabase.auth.admin.updateUserById(op.id, { password: newPassInput });
      if (error) throw error;
      showToast('success', 'Contrasena actualizada exitosamente');
      setResetPasswordId(null);
      setNewPassInput('');
    } catch (err: unknown) {
      showToast('error', 'Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Shield size={18} /> Administrador de Roles
        </h4>
        <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ email: '', username: '', nombre: '', password: '', sede_id: '', role: 'operator' }); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ background: themeColor }}>
          <Plus size={14} /> Nuevo Usuario
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Gestiona los usuarios que tienen acceso al panel de administracion. Los operadores gestionan pedidos, productos y clientes. Los customers tienen acceso limitado.
      </p>

      {showForm && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-bold text-slate-800">{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h5>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-400" /></button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><User size={12} /> Usuario (para login) *</label>
              <input type="text" required value={formData.username} onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Nombre de usuario unico" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Mail size={12} /> Correo Electronico *</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="operador@ejemplo.com" disabled={!!editingId} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><User size={12} /> Nombre *</label>
              <input type="text" required value={formData.nombre} onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del usuario" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Shield size={12} /> Rol *</label>
              <select value={formData.role} onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'operator' | 'customer' }))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                <option value="operator">Operador</option>
                <option value="customer">Customer (Panel limitado)</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {!editingId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Key size={12} /> Contrasena *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimo 6 caracteres" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 w-full" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1"><MapPin size={12} /> Panel de Sucursal</label>
              <select value={formData.sede_id} onChange={(e) => setFormData(prev => ({ ...prev, sede_id: e.target.value }))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                <option value="">Todas las sedes (operador global)</option>
                {activeSedes.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
              </select>
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg text-slate-700 text-xs font-semibold">Cancelar</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 text-white py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50" style={{ background: themeColor }}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: themeColor, borderTopColor: 'transparent' }} />
        </div>
      ) : operators.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {operators.map(op => (
            <div key={op.id} className={`p-4 bg-white border rounded-xl shadow-sm flex flex-col gap-2 transition-colors ${op.active ? 'border-slate-200 hover:border-indigo-200' : 'border-red-200 bg-red-50/30 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: op.role === 'admin' ? '#7c3aed' : op.role === 'customer' ? '#059669' : themeColor }}>
                    {op.role === 'admin' ? 'A' : op.role === 'customer' ? 'C' : 'O'}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">{op.nombre}</h5>
                    <p className="text-xs text-slate-500 font-mono">@{op.username || op.email.split('@')[0]}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{op.email}</p>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${op.role === 'admin' ? 'bg-purple-100 text-purple-700' : op.role === 'customer' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {op.role === 'admin' ? 'Administrador' : op.role === 'customer' ? 'Customer' : 'Operador'}
                    </span>
                    {!op.active && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 ml-1">Inactivo</span>}
                    {op.sede_id && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 ml-1 flex items-center gap-1">
                        <MapPin size={10} /> {activeSedes.find(s => s.id === op.sede_id)?.nombre || 'Sucursal'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <button onClick={() => handleEdit(op)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" title="Editar"><Edit2 size={14} /></button>
                  {resetPasswordId === op.id ? (
                    <div className="flex items-center gap-1">
                      <input type="password" value={newPassInput} onChange={(e) => setNewPassInput(e.target.value)}
                        placeholder="Nueva contrasena" className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] w-24" autoFocus />
                      <button onClick={() => handleResetPassword(op)} className="p-1 bg-amber-500 text-white rounded cursor-pointer"><Key size={10} /></button>
                      <button onClick={() => { setResetPasswordId(null); setNewPassInput(''); }} className="p-1 bg-slate-200 text-slate-700 rounded cursor-pointer"><X size={10} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setResetPasswordId(op.id); setNewPassInput(''); }} className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors" title="Resetear contrasena"><Key size={14} /></button>
                  )}
                  {deleteConfirm === op.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleActive(op)} className="px-2 py-1 bg-red-500 text-white text-[10px] rounded cursor-pointer font-bold">Si</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] rounded cursor-pointer font-bold">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(op.id)}
                      className={`p-2 rounded-lg transition-colors ${op.active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}
                      title={op.active ? 'Desactivar' : 'Activar'}>
                      {op.active ? <Trash2 size={14} /> : <Shield size={14} />}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono border-t border-slate-100 pt-2">
                Creado: {op.created_at ? new Date(op.created_at).toLocaleDateString('es-VE') : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RolesSection;
