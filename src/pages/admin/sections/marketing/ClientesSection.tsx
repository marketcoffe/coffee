import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../store/AppContext';
import { supabase } from '../../../../store/supabaseClient';
import { Users, Search, Mail, Download, ShoppingCart, MessageCircle, Phone } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';

const ClientesSection: React.FC = () => {
  const { users, orders, config, addNotification } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [searchTerm, setSearchTerm] = useState('');
  const [showMsgModal, setShowMsgModal] = useState<string | null>(null);
  const [msgText, setMsgText] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<string | null>(null);

  const guestEmails = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, { email: string; nombre: string; telefono: string; totalSpent: number; count: number; lastOrder: string }>();
    for (const o of orders) {
      const email = o.guest_email || o.cliente_email;
      if (!email) continue;
      const key = email.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.totalSpent += Number(o.total_usd) || 0;
        if (o.fecha && o.fecha > existing.lastOrder) existing.lastOrder = o.fecha;
        if (!existing.telefono && o.cliente_telefono) existing.telefono = o.cliente_telefono;
      } else {
        map.set(key, {
          email,
          nombre: o.cliente_nombre,
          telefono: o.cliente_telefono || o.guest_phone || '',
          totalSpent: Number(o.total_usd) || 0,
          count: 1,
          lastOrder: o.fecha || '',
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter(u =>
      !term ||
      u.nombre?.toLowerCase().includes(term) ||
      u.telefono?.includes(term) ||
      u.email?.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const activeCount = users.filter(u => {
    const userOrders = orders?.filter(o => o.cliente_uid === u.id || o.usuario_id === u.id) || [];
    return userOrders.some(o => o.fecha && new Date(o.fecha) > thirtyDaysAgo);
  }).length;

  const avgSpent = useMemo(() => {
    if (!orders || orders.length === 0) return 0;
    const total = orders.reduce((sum, o) => sum + (Number(o.total_usd) || 0), 0);
    return total / orders.length;
  }, [orders]);

  const exportCSV = () => {
    const headers = 'Nombre,Telefono,Email,Pedidos,Total Gastado\n';
    const rows = filtered.map(u => {
      const uOrders = orders?.filter(o => o.cliente_uid === u.id || o.usuario_id === u.id || o.cliente_telefono === u.telefono) || [];
      const total = uOrders.reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
      return `"${u.nombre || ''}","${u.telefono || ''}","${u.email || ''}",${uOrders.length},${total.toFixed(2)}`;
    }).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getUserOrders = (userId: string, phone: string) =>
    orders?.filter(o => o.cliente_uid === userId || o.usuario_id === userId || o.cliente_telefono === phone) || [];

  const handleSendMsg = async (phone: string) => {
    if (!msgText.trim()) return;
    await addNotification('Mensaje del Admin', msgText.trim(), 'personal', phone, '', '');
    setMsgText('');
    setShowMsgModal(null);
  };

  const sendWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: themeColor }} />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Clientes</h3>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
          <Download size={12} /> <span className="hidden sm:inline">Exportar</span>CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Total Clientes', value: String(users.length), color: themeColor },
          { label: 'Activos (30d)', value: String(activeCount), color: '#10B981' },
          { label: 'Ticket Promedio', value: `$${avgSpent.toFixed(2)}`, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center border border-slate-200 bg-white">
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nombre, teléfono o email..."
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-slate-400" />
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map(user => {
          const uOrders = getUserOrders(user.id, user.telefono || '');
          const isExpanded = expandedOrders === user.id;
          return (
            <div key={user.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: themeColor }}>
                    {user.nombre?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{user.nombre || 'Sin nombre'}</p>
                    <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Phone size={9} /> {user.telefono || '—'}</p>
                    {user.email && <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1"><Mail size={9} /> {user.email}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold" style={{ color: themeColor }}>{uOrders.length} pedido{uOrders.length !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-slate-500">${uOrders.reduce((s, o) => s + (Number(o.total_usd) || 0), 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex gap-1 pt-1 border-t border-slate-100">
                <Tooltip content="Enviar mensaje personal" position="top">
                  <button onClick={() => setShowMsgModal(user.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
                    <Mail size={11} /> <span className="hidden sm:inline">Mensaje</span>
                  </button>
                </Tooltip>
                <Tooltip content="Abrir chat de WhatsApp" position="top">
                  <button onClick={() => sendWhatsApp(user.telefono || '')} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
                    <MessageCircle size={11} /> <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                </Tooltip>
                <Tooltip content="Ver historial de pedidos" position="top">
                  <button onClick={() => setExpandedOrders(isExpanded ? null : user.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                    <ShoppingCart size={11} /> <span className="hidden sm:inline">Historial</span>
                  </button>
                </Tooltip>
              </div>
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  {uOrders.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-2">Sin pedidos</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {uOrders.slice(0, 10).map(o => (
                        <div key={o.id} className="flex justify-between text-[10px] font-mono py-1 border-b border-slate-50 last:border-0">
                          <span className="text-slate-600">{o.fecha}</span>
                          <span className="text-slate-500">{o.status}</span>
                          <span className="font-bold text-slate-700">${(Number(o.total_usd) || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {guestEmails.length > 0 && (
        <div className="mt-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Clientes Invitados (con email)</h4>
          <div className="flex flex-col gap-2">
            {guestEmails.map(g => (
              <div key={g.email} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{g.nombre || 'Sin nombre'}</p>
                  <p className="text-[10px] text-slate-500 font-mono"><Mail size={9} className="inline" /> {g.email}</p>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-500">
                  <p>{g.count} pedido{g.count > 1 ? 's' : ''}</p>
                  <p className="font-bold text-slate-700">${g.totalSpent.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showMsgModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-800 text-xs uppercase">Enviar Mensaje</h4>
              <button onClick={() => { setShowMsgModal(null); setMsgText(''); }} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Escribe tu mensaje..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-slate-400 min-h-[80px]" />
            <div className="flex gap-2">
              <button onClick={() => { setShowMsgModal(null); setMsgText(''); }} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Cancelar</button>
              <button onClick={() => handleSendMsg(showMsgModal)} disabled={!msgText.trim()} className="flex-1 py-2 text-white rounded-xl text-xs font-bold disabled:opacity-50" style={{ background: themeColor }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientesSection;
