import React, { useState } from 'react';
import { supabase } from '../../../../store/supabaseClient';
import { useApp } from '../../../../store/AppContext';
import { resetPasswordViaPanel } from '../../../../security/authService';
import {
  Search, Shield, User, Mail, Phone, Key, CheckCircle, AlertCircle,
  Eye, EyeOff, Loader2, RefreshCw
} from 'lucide-react';

interface UserRecord {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  username: string | null;
}

function maskEmail(email: string | null): string {
  if (!email) return '—';
  const idx = email.indexOf('@');
  if (idx <= 2) return email;
  return email[0] + '*'.repeat(idx - 2) + email[idx - 1] + email.slice(idx);
}

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 7) return phone || '—';
  return phone.slice(0, 5) + phone.slice(5).replace(/./g, '*');
}

export default function UserPasswordResetPanel() {
  const { currentUser } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setResultMessage(null);
    setSelectedUser(null);
    setNewPassword('');

    try {
      const query = searchQuery.trim().toLowerCase();
      const isEmail = query.includes('@');

      let data: UserRecord[] | null = null;

      if (isEmail) {
        const result = await supabase
          .from('usuarios_clientes')
          .select('id, nombre, email, telefono, username')
          .ilike('email', query)
          .limit(10);
        data = result.data;
      } else if (/^\+?\d{7,15}$/.test(query.replace(/[\s\-()]/g, ''))) {
        const cleaned = query.replace(/[\s\-()]/g, '');
        const result = await supabase
          .from('usuarios_clientes')
          .select('id, nombre, email, telefono, username')
          .eq('telefono', cleaned)
          .limit(10);
        data = result.data;
      } else {
        const result = await supabase
          .from('usuarios_clientes')
          .select('id, nombre, email, telefono, username')
          .ilike('username', query)
          .limit(10);
        data = result.data;
      }

      setSearchResults(data || []);
    } catch (err) {
      console.error('[PasswordReset] Search error:', err);
      setResultMessage({ type: 'error', text: 'Error al buscar usuarios.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword.trim()) return;

    // Obtener admin ID: del contexto o de localStorage (fallback sesión local)
    const adminId = currentUser?.id || (() => {
      try {
        const stored = JSON.parse(localStorage.getItem('trv_admin_user') || '{}');
        return stored.id || '';
      } catch { return ''; }
    })();

    if (!adminId) {
      setResultMessage({ type: 'error', text: 'No se pudo identificar al administrador. Inicie sesión nuevamente.' });
      return;
    }

    if (newPassword.trim().length < 6) {
      setResultMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    setIsResetting(true);
    setResultMessage(null);

    try {
      const result = await resetPasswordViaPanel(
        selectedUser.id,
        newPassword.trim(),
        adminId
      );

      if (result.success) {
        setResultMessage({
          type: 'success',
          text: `Contraseña de ${selectedUser.nombre} actualizada correctamente.`,
        });
        setNewPassword('');
        setSelectedUser(null);
        setSearchResults([]);
        setSearchQuery('');
      } else {
        setResultMessage({
          type: 'error',
          text: result.message || 'Error al restablecer contraseña.',
        });
      }
    } catch (err) {
      console.error('[PasswordReset] Reset error:', err);
      setResultMessage({ type: 'error', text: 'Error inesperado al restablecer contraseña.' });
    } finally {
      setIsResetting(false);
    }
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pass = 'Temp';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
          <Key size={20} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
            Restablecer Contraseña de Cliente
          </h2>
          <p className="text-[11px] text-zinc-500">
            Busca un cliente por email, teléfono o usuario y asigna una nueva contraseña.
          </p>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Buscar Cliente
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Email, teléfono o usuario..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
        </div>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && !selectedUser && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
          </p>
          {searchResults.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUser(user)}
              className="w-full text-left p-3 bg-white border border-zinc-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600">
                {user.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{user.nombre}</p>
                <p className="text-[11px] text-zinc-500 font-mono truncate">
                  {maskEmail(user.email)} · {maskPhone(user.telefono)}
                </p>
              </div>
              <Shield size={14} className="text-zinc-300 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {searchResults.length === 0 && !isSearching && searchQuery && !selectedUser && (
        <div className="text-center py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <User size={24} className="mx-auto text-zinc-300 mb-2" />
          <p className="text-sm text-zinc-500 font-medium">No se encontraron usuarios</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Intenta con otro email, teléfono o nombre de usuario.
          </p>
        </div>
      )}

      {/* Selected User & Reset Form */}
      {selectedUser && (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
              {selectedUser.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-900">{selectedUser.nombre}</p>
              <p className="text-[11px] text-blue-600 font-mono truncate">
                {selectedUser.email || selectedUser.telefono}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedUser(null); setNewPassword(''); }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium cursor-pointer"
            >
              Cambiar
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Nueva Contraseña
              </label>
              <button
                type="button"
                onClick={generateTempPassword}
                className="text-[10px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={10} />
                Generar temporal
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-3 pr-10 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isResetting || newPassword.trim().length < 6}
            className="w-full font-bold py-3 rounded-xl text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isResetting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Restableciendo...
              </>
            ) : (
              <>
                <Key size={14} />
                Restablecer Contraseña
              </>
            )}
          </button>
        </form>
      )}

      {/* Result Message */}
      {resultMessage && (
        <div
          className={`p-3 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed ${
            resultMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {resultMessage.type === 'success' ? (
            <CheckCircle size={14} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
          )}
          <span>{resultMessage.text}</span>
        </div>
      )}

      {/* Security Note */}
      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-[10px] text-amber-700 leading-relaxed">
          <strong>Nota de seguridad:</strong> Todas las acciones de restablecimiento de contraseña
          quedan registradas en el log de auditoría de seguridad. Administradores y operadores
          activos pueden ejecutar esta operación sobre clientes.
        </p>
      </div>
    </div>
  );
}
