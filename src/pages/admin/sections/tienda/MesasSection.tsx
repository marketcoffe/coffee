import React, { useState, useMemo } from 'react';
import { useApp } from '../../../../store/AppContext';
import { Mesa, Order } from '../../../../types/store';
import { Edit3, Save, X, Armchair, Plus, Trash2 } from 'lucide-react';

const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Disponible': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  'Ocupada': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  'Reservada': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-300' },
  'Inactiva': { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-300' },
};

const ESTADOS = ['Disponible', 'Ocupada', 'Reservada', 'Inactiva'] as const;

export default function MesasSection() {
  const { mesas, updateMesa, addMesa, deleteMesa, orders, config } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEstado, setEditEstado] = useState<Mesa['estado']>('Disponible');
  const [selectedMesa, setSelectedMesa] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMesaNumber, setNewMesaNumber] = useState('');
  const [newMesaName, setNewMesaName] = useState('');
  const [mesaError, setMesaError] = useState('');

  const sortedMesas = useMemo(() =>
    [...mesas].sort((a, b) => a.numero_mesa - b.numero_mesa),
    [mesas]
  );

  const mesaOrders = useMemo(() => {
    if (!selectedMesa) return [];
    const mesa = mesas.find(m => m.id === selectedMesa);
    if (!mesa) return [];
    return orders
      .filter(o => o.numero_mesa === mesa.numero_mesa && (o.tipo_pedido === 'mesa' || o.tipo_entrega === 'mesa'))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 20);
  }, [selectedMesa, mesas, orders]);

  const stats = useMemo(() => ({
    total: mesas.length,
    disponibles: mesas.filter(m => m.estado === 'Disponible').length,
    ocupadas: mesas.filter(m => m.estado === 'Ocupada').length,
    reservadas: mesas.filter(m => m.estado === 'Reservada').length,
    inactivas: mesas.filter(m => m.estado === 'Inactiva').length,
  }), [mesas]);

  const startEdit = (mesa: Mesa) => {
    setEditingId(mesa.id);
    setEditNombre(mesa.nombre_personalizado);
    setEditEstado(mesa.estado);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNombre('');
    setEditEstado('Disponible');
  };

  const saveEdit = async (id: string) => {
    await updateMesa(id, { nombre_personalizado: editNombre, estado: editEstado });
    cancelEdit();
  };

  const handleAddMesa = async () => {
    setMesaError('');
    const num = parseInt(newMesaNumber);
    if (isNaN(num) || num < 1) {
      setMesaError('Ingresa un número válido.');
      return;
    }
    if (mesas.some(m => m.numero_mesa === num)) {
      setMesaError(`Ya existe la Mesa #${num}.`);
      return;
    }
    const ok = await addMesa(num, newMesaName || undefined);
    if (ok) {
      setShowAddForm(false);
      setNewMesaNumber('');
      setNewMesaName('');
      setMesaError('');
    } else {
      setMesaError('Error al crear la mesa. Verifica que la tabla "mesas" exista en la base de datos.');
    }
  };

  const handleDeleteMesa = async (id: string, numero: number) => {
    if (!confirm(`¿Eliminar la Mesa #${numero}? Esta acción no se puede deshacer.`)) return;
    await deleteMesa(id);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: themeColor },
          { label: 'Disponibles', value: stats.disponibles, color: '#10b981' },
          { label: 'Ocupadas', value: stats.ocupadas, color: '#f59e0b' },
          { label: 'Reservadas', value: stats.reservadas, color: '#8b5cf6' },
          { label: 'Inactivas', value: stats.inactivas, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#e4beb1]/10 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8f7065]">{s.label}</p>
            <p className="text-xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add Mesa Button + Form */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white transition-all cursor-pointer active:scale-95"
          style={{ backgroundColor: themeColor }}
        >
          <Plus size={14} />
          Agregar Mesa
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase text-[#8f7065] mb-1 block">Número de Mesa *</label>
            <input
              type="number"
              min="1"
              value={newMesaNumber}
              onChange={(e) => setNewMesaNumber(e.target.value)}
              placeholder="Ej: 11"
              className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-lg px-3 py-2 text-xs outline-none font-bold text-[#1a1c1d]"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase text-[#8f7065] mb-1 block">Nombre (opcional)</label>
            <input
              type="text"
              value={newMesaName}
              onChange={(e) => setNewMesaName(e.target.value)}
              placeholder="Ej: Terraza A"
              className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-lg px-3 py-2 text-xs outline-none font-bold text-[#1a1c1d]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddMesa}
              disabled={!newMesaNumber || parseInt(newMesaNumber) < 1}
              className="px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#10b981' }}
            >
              Crear
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewMesaNumber(''); setNewMesaName(''); setMesaError(''); }}
              className="px-4 py-2 rounded-xl text-[11px] font-bold bg-[#eeeef0] text-[#5b4137] transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
          {mesaError && (
            <p className="text-[11px] font-semibold text-red-500 mt-2">{mesaError}</p>
          )}
        </div>
      )}

      {/* Grid de Mesas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {sortedMesas.map(mesa => {
          const colors = ESTADO_COLORS[mesa.estado] || ESTADO_COLORS['Disponible'];
          const isEditing = editingId === mesa.id;
          const isSelected = selectedMesa === mesa.id;
          const activeOrders = orders.filter(o =>
            o.numero_mesa === mesa.numero_mesa &&
            (o.tipo_pedido === 'mesa' || o.tipo_entrega === 'mesa') &&
            !['Entregado', 'Cancelado', 'completado', 'cancelado'].includes(o.status)
          );

          return (
            <div
              key={mesa.id}
              onClick={() => !isEditing && setSelectedMesa(isSelected ? null : mesa.id)}
              className={`bg-white rounded-2xl border-2 p-4 transition-all cursor-pointer hover:shadow-md ${
                isSelected ? 'ring-2 ring-offset-2' : ''
              } ${colors.border}`}
              style={isSelected ? { outlineColor: themeColor } : {}}
            >
              {isEditing ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1a1c1d]">Mesa #{mesa.numero_mesa}</span>
                    <div className="flex gap-1">
                      <button onClick={() => saveEdit(mesa.id)} className="p-1 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 cursor-pointer">
                        <Save size={14} />
                      </button>
                      <button onClick={cancelEdit} className="p-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    placeholder="Nombre personalizado"
                    className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                  />
                  <select
                    value={editEstado}
                    onChange={(e) => setEditEstado(e.target.value as Mesa['estado'])}
                    className="w-full bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-lg px-2 py-1.5 text-xs outline-none appearance-none cursor-pointer"
                  >
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Armchair size={14} style={{ color: themeColor }} />
                      <span className="text-sm font-bold text-[#1a1c1d]">Mesa #{mesa.numero_mesa}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(mesa); }}
                      className="p-1 rounded-lg hover:bg-[#eeeef0] text-[#8f7065] hover:text-[#5b4137] cursor-pointer"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteMesa(mesa.id, mesa.numero_mesa); }}
                      className="p-1 rounded-lg hover:bg-red-50 text-[#8f7065] hover:text-red-500 cursor-pointer"
                      title="Eliminar mesa"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-[#8f7065] mb-2 truncate">{mesa.nombre_personalizado || `Mesa ${mesa.numero_mesa}`}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {mesa.estado}
                    </span>
                    {activeOrders.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-300">
                        {activeOrders.length} pedido{activeOrders.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel de historial de pedidos de la mesa seleccionada */}
      {selectedMesa && (
        <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#1a1c1d]">
              Historial de Pedidos — Mesa #{mesas.find(m => m.id === selectedMesa)?.numero_mesa}
            </h3>
            <button onClick={() => setSelectedMesa(null)} className="p-1 rounded-lg hover:bg-[#eeeef0] cursor-pointer">
              <X size={16} className="text-[#8f7065]" />
            </button>
          </div>
          {mesaOrders.length === 0 ? (
            <p className="text-xs text-[#8f7065] text-center py-6">No hay pedidos recientes para esta mesa.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {mesaOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-[#f9f9fb] rounded-xl border border-[#e4beb1]/10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#1a1c1d]">{order.id}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        order.status === 'Pendiente' || order.status === 'pendiente_verificacion' ? 'bg-amber-100 text-amber-700' :
                        order.status === 'En preparación' || order.status === 'En preparacion' || order.status === 'en_preparacion' ? 'bg-violet-100 text-violet-700' :
                        order.status === 'Entregado' || order.status === 'completado' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'Cancelado' || order.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8f7065] mt-0.5">{order.cliente_nombre} — {new Date(order.fecha).toLocaleString('es-VE')}</p>
                    <p className="text-[10px] text-[#8f7065]">{order.items?.length || 0} items</p>
                  </div>
                  <span className="text-sm font-black" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
