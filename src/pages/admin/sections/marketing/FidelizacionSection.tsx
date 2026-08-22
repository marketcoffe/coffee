import React, { useState } from 'react';
import { useApp } from '../../../../store/AppContext';
import { LoyaltyTier, RewardItem, LoyaltyConfig } from '../../../../types/store';
import {
  Award, Settings, List, UserPlus, Plus, Trash2, X, Check, Search,
  ArrowUp, ArrowDown, Gift, Edit3, Save, Trophy,
} from 'lucide-react';

const FidelizacionSection: React.FC = () => {
  const {
    config, updateConfig, users, adjustUserPoints,
    getLoyaltyTransactions, getUserLoyaltyTier, getUserLoyaltyPoints,
    rewardCatalog, addRewardItem, updateRewardItem, deleteRewardItem,
  } = useApp();

  const loyalty = config.loyalty;
  const themeColor = config.theme_color || '#A4D045';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'rewards' | 'tiers' | 'history' | 'adjust'>('dashboard');
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const [newTier, setNewTier] = useState<Partial<LoyaltyTier>>({});
  const [newReward, setNewReward] = useState<Partial<RewardItem>>({});
  const [editingReward, setEditingReward] = useState<string | null>(null);
  const [editRewardFields, setEditRewardFields] = useState<Partial<RewardItem>>({});

  const safeTiers = loyalty?.tiers || [];
  const safeBonus: Record<string, number> = (loyalty?.bonus_actions || {}) as Record<string, number>;

  const handleToggleLoyalty = () => {
    if (!loyalty) return;
    updateConfig({ loyalty: { ...loyalty, enabled: !loyalty.enabled } });
  };

  const handleUpdateField = (field: string, value: number) => {
    if (!loyalty) return;
    updateConfig({ loyalty: { ...loyalty, [field]: value } });
  };

  const handleUpdateBonus = (field: string, value: number) => {
    if (!loyalty) return;
    updateConfig({
      loyalty: {
        ...loyalty,
        bonus_actions: { ...safeBonus, [field]: value } as LoyaltyConfig['bonus_actions'],
      },
    });
  };

  const handleAddTier = () => {
    if (!loyalty || !newTier.name) return;
    const tier: LoyaltyTier = {
      id: `tier-${crypto.randomUUID()}`,
      name: newTier.name || '',
      min_points: newTier.min_points || 0,
      multiplier: newTier.multiplier || 1,
      benefits: newTier.benefits || [],
      color: newTier.color || themeColor,
    };
    updateConfig({
      loyalty: { ...loyalty, tiers: [...safeTiers, tier] },
    });
    setNewTier({});
  };

  const handleDeleteTier = (tierId: string) => {
    if (!loyalty) return;
    updateConfig({
      loyalty: { ...loyalty, tiers: safeTiers.filter((t) => t.id !== tierId) },
    });
  };

  const handleSaveEditTier = () => {
    if (!loyalty || !editingTier) return;
    updateConfig({
      loyalty: {
        ...loyalty,
        tiers: safeTiers.map((t) => (t.id === editingTier.id ? editingTier : t)),
      },
    });
    setEditingTier(null);
  };

  const handleAdjustPoints = async () => {
    if (!selectedUserId || adjustPoints === 0 || !adjustReason.trim()) return;
    await adjustUserPoints(selectedUserId, adjustPoints, adjustReason.trim());
    setAdjustPoints(0);
    setAdjustReason('');
    setSelectedUserId(null);
    setSearchPhone('');
  };

  const filteredUsers = users
    .filter(
      (u) =>
        searchPhone.trim() &&
        (u.telefono?.includes(searchPhone) || u.nombre?.toLowerCase().includes(searchPhone.toLowerCase()))
    )
    .slice(0, 5);

  const allTransactions = loyalty?.enabled
    ? users
        .flatMap((u) => getLoyaltyTransactions(u.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const totalPointsDistributed = users.reduce((sum, u) => sum + (u.loyalty_points || 0), 0);
  const activeUsersCount = users.filter((u) => (u.loyalty_points || 0) > 0).length;

  const tabs = [
    { id: 'dashboard' as const, label: 'General', icon: Settings },
    { id: 'rewards' as const, label: 'Premios', icon: Gift },
    { id: 'tiers' as const, label: 'Niveles', icon: Trophy },
    { id: 'history' as const, label: 'Historial', icon: List },
    { id: 'adjust' as const, label: 'Ajustar', icon: UserPlus },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle Global */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between border"
        style={{
          background: loyalty?.enabled ? themeColor + '08' : 'white',
          borderColor: loyalty?.enabled ? themeColor + '30' : '#e5e7eb',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: loyalty?.enabled ? themeColor + '15' : '#f4f4f5', color: loyalty?.enabled ? themeColor : '#a1a1aa' }}
          >
            <Award size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900">Sistema de Fidelización</p>
            <p className="text-xs text-zinc-500">
              {loyalty?.enabled ? 'Activo — clientes acumulan puntos' : 'Desactivado'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleLoyalty}
          className="relative w-14 h-8 rounded-full transition-colors cursor-pointer"
          style={{ background: loyalty?.enabled ? themeColor : '#d4d4d8' }}
          aria-label={loyalty?.enabled ? 'Desactivar fidelización' : 'Activar fidelización'}
        >
          <div
            className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform"
            style={{ left: loyalty?.enabled ? 30 : 4 }}
          />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer"
              style={{
                background: isActive ? themeColor : 'white',
                color: isActive ? '#fff' : '#71717a',
                border: `1px solid ${isActive ? themeColor : '#e5e7eb'}`,
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Puntos activos', value: totalPointsDistributed.toLocaleString(), color: themeColor },
              { label: 'Clientes con pts', value: String(activeUsersCount), color: '#8B5CF6' },
              { label: 'Niveles', value: String(safeTiers.length), color: '#F59E0B' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-3 text-center border border-zinc-200 bg-white">
                <p className="text-xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {loyalty?.enabled && (
            <>
              {/* Ganar Puntos */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ganar Puntos</p>
                {[
                  { key: 'points_per_dollar', label: 'Puntos por $1 gastado', step: 0.5 },
                  { key: 'min_order_for_points', label: 'Pedido mínimo para ganar ($)', step: 1 },
                  { key: 'welcome_bonus', label: 'Puntos de bienvenida', step: 10 },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700">{item.label}</span>
                    <input
                      type="number"
                      step={item.step}
                      value={((loyalty as unknown as Record<string, unknown> | undefined)?.[item.key] as number) ?? 0}
                      onChange={(e) => handleUpdateField(item.key, Number(e.target.value))}
                      className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    />
                  </div>
                ))}
              </div>

              {/* Canjear Puntos */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Canjear Puntos</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700">100 puntos = $1 de descuento</span>
                  <input
                    type="number"
                    value={loyalty.redemption_rate ?? 100}
                    onChange={(e) => handleUpdateField('redemption_rate', Number(e.target.value))}
                    className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700">Descuento máximo por canje (%)</span>
                  <input
                    type="number"
                    value={loyalty.max_discount_percent ?? 30}
                    onChange={(e) => handleUpdateField('max_discount_percent', Number(e.target.value))}
                    className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  />
                </div>
              </div>

              {/* Bonos Extra */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Bonos Extra</p>
                {[
                  { key: 'daily_login', label: 'Login diario', emoji: '📅' },
                  { key: 'first_order', label: 'Primera compra', emoji: '🎉' },
                  { key: 'review', label: 'Dejar reseña', emoji: '⭐' },
                  { key: 'referral', label: 'Referir amigo', emoji: '🤝' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700 flex items-center gap-2">
                      <span>{item.emoji}</span> {item.label}
                    </span>
                    <input
                      type="number"
                      value={safeBonus[item.key] ?? 0}
                      onChange={(e) => handleUpdateBonus(item.key, Number(e.target.value))}
                      className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ REWARDS CATALOG ═══ */}
      {activeTab === 'rewards' && (
        <div className="flex flex-col gap-4">
          {/* Add New Reward */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Agregar Premio</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Nombre</label>
                <input
                  type="text"
                  value={newReward.name || ''}
                  onChange={(e) => setNewReward((p) => ({ ...p, name: e.target.value }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  placeholder="Ej: Envío Gratis"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Puntos Requeridos</label>
                <input
                  type="number"
                  value={newReward.points_cost || ''}
                  onChange={(e) => setNewReward((p) => ({ ...p, points_cost: Number(e.target.value) }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  placeholder="500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tipo</label>
                <select
                  value={newReward.reward_type || 'discount'}
                  onChange={(e) => setNewReward((p) => ({ ...p, reward_type: e.target.value as RewardItem['reward_type'] }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                >
                  <option value="discount">Descuento ($)</option>
                  <option value="free_product">Producto Gratis</option>
                  <option value="free_shipping">Envío Gratis</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Valor (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newReward.reward_value || ''}
                  onChange={(e) => setNewReward((p) => ({ ...p, reward_value: Number(e.target.value) }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  placeholder="2.50"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Descripción</label>
                <input
                  type="text"
                  value={newReward.description || ''}
                  onChange={(e) => setNewReward((p) => ({ ...p, description: e.target.value }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  placeholder="Descuento de $2.50 en tu próxima compra"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!newReward.name || !newReward.points_cost) return;
                await addRewardItem({
                  name: newReward.name,
                  description: newReward.description || '',
                  points_cost: newReward.points_cost || 0,
                  reward_type: newReward.reward_type || 'discount',
                  reward_value: newReward.reward_value || 0,
                  active: true,
                });
                setNewReward({});
              }}
              disabled={!newReward.name || !newReward.points_cost}
              className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
              style={{ background: themeColor }}
            >
              <Plus size={16} /> Agregar Premio
            </button>
          </div>

          {/* Rewards grouped by point cost */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Catálogo de Premios</p>
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                {rewardCatalog.length} items
              </span>
            </div>

            {rewardCatalog.length === 0 ? (
              <div className="text-center py-8">
                <Gift size={32} className="text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No hay premios aún</p>
                <p className="text-[11px] text-zinc-400">Agrega premios arriba para que los clientes puedan canjear sus puntos</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rewardCatalog
                  .sort((a, b) => a.points_cost - b.points_cost)
                  .map((reward) => (
                    <div
                      key={reward.id}
                      className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{
                        background: reward.active ? 'white' : '#fafafa',
                        borderColor: reward.active ? '#e5e7eb' : '#f4f4f5',
                        opacity: reward.active ? 1 : 0.6,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                        style={{ background: reward.active ? themeColor : '#a1a1aa' }}
                      >
                        {reward.reward_type === 'discount' ? '$' : reward.reward_type === 'free_shipping' ? '🚚' : '🎁'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-zinc-900 truncate">{reward.name}</p>
                          {!reward.active && (
                            <span className="text-[9px] font-bold bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded">OFF</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {reward.points_cost} pts
                          {reward.reward_value ? ` · $${reward.reward_value}` : ''}
                          {reward.description ? ` · ${reward.description}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {editingReward === reward.id ? (
                          <>
                            <input
                              type="number"
                              value={editRewardFields.points_cost ?? reward.points_cost}
                              onChange={(e) => setEditRewardFields((p) => ({ ...p, points_cost: Number(e.target.value) }))}
                              className="w-16 text-center text-xs font-bold px-1 py-1 rounded-lg border border-zinc-300 outline-none"
                            />
                            <button
                              onClick={() => {
                                updateRewardItem(reward.id, {
                                  points_cost: editRewardFields.points_cost ?? reward.points_cost,
                                  reward_value: editRewardFields.reward_value ?? reward.reward_value,
                                  description: editRewardFields.description ?? reward.description,
                                });
                                setEditingReward(null);
                                setEditRewardFields({});
                              }}
                              className="p-1.5 rounded-lg"
                              style={{ background: '#34C75915', color: '#34C759' }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => { setEditingReward(null); setEditRewardFields({}); }}
                              className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingReward(reward.id);
                                setEditRewardFields({ points_cost: reward.points_cost, reward_value: reward.reward_value, description: reward.description });
                              }}
                              className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
                              title="Editar puntos"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => updateRewardItem(reward.id, { active: !reward.active })}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: reward.active ? '#34C75915' : '#FF3B3015' }}
                              title={reward.active ? 'Desactivar' : 'Activar'}
                            >
                              {reward.active ? <Check size={13} style={{ color: '#34C759' }} /> : <X size={13} style={{ color: '#FF3B30' }} />}
                            </button>
                            <button
                              onClick={() => deleteRewardItem(reward.id)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TIERS ═══ */}
      {activeTab === 'tiers' && (
        <div className="flex flex-col gap-3">
          {safeTiers.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
              <Trophy size={32} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-700">Sin niveles configurados</p>
              <p className="text-[11px] text-zinc-400 mt-1">Agrega niveles para definir multiplicadores de puntos</p>
            </div>
          ) : (
            safeTiers
              .sort((a, b) => a.min_points - b.min_points)
              .map((tier) => (
                <div
                  key={tier.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  {editingTier?.id === tier.id ? (
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        value={editingTier.name}
                        onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                        className="text-sm font-bold px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                        placeholder="Nombre del nivel"
                      />
                      <div className="flex gap-3">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Puntos mínimos</label>
                          <input
                            type="number"
                            value={editingTier.min_points}
                            onChange={(e) => setEditingTier({ ...editingTier, min_points: Number(e.target.value) })}
                            className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Multiplicador</label>
                          <input
                            type="number"
                            step="0.25"
                            value={editingTier.multiplier}
                            onChange={(e) => setEditingTier({ ...editingTier, multiplier: Number(e.target.value) })}
                            className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Color</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={editingTier.color || themeColor}
                            onChange={(e) => setEditingTier({ ...editingTier, color: e.target.value })}
                            className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={editingTier.color || ''}
                            onChange={(e) => setEditingTier({ ...editingTier, color: e.target.value })}
                            className="flex-1 text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50 font-mono"
                            placeholder="#CD7F32"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEditTier}
                          className="flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5"
                          style={{ background: themeColor }}
                        >
                          <Save size={14} /> Guardar
                        </button>
                        <button
                          onClick={() => setEditingTier(null)}
                          className="flex-1 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs flex items-center justify-center gap-1.5"
                        >
                          <X size={14} /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
                        style={{ background: tier.color || themeColor }}
                      >
                        {tier.name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900">{tier.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {tier.min_points}+ pts · ×{tier.multiplier}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingTier(tier)}
                          className="p-2 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTier(tier.id)}
                          className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}

          {/* Add new tier */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Agregar Nivel</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newTier.name || ''}
                onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                placeholder="Nombre (ej: Diamante)"
              />
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Puntos mínimos</label>
                  <input
                    type="number"
                    value={newTier.min_points || ''}
                    onChange={(e) => setNewTier({ ...newTier, min_points: Number(e.target.value) })}
                    className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Multiplicador</label>
                  <input
                    type="number"
                    step="0.25"
                    value={newTier.multiplier || ''}
                    onChange={(e) => setNewTier({ ...newTier, multiplier: Number(e.target.value) })}
                    className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Color</label>
                <input
                  type="color"
                  value={newTier.color || themeColor}
                  onChange={(e) => setNewTier({ ...newTier, color: e.target.value })}
                  className="w-12 h-10 rounded-lg border border-zinc-200 cursor-pointer"
                />
              </div>
              <button
                onClick={handleAddTier}
                disabled={!newTier.name}
                className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                style={{ background: themeColor }}
              >
                <Plus size={16} /> Agregar Nivel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HISTORY ═══ */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3">
          {!loyalty?.enabled ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
              <Award size={32} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-700">Fidelización desactivada</p>
              <p className="text-[11px] text-zinc-400 mt-1">Activa el sistema para ver el historial</p>
            </div>
          ) : allTransactions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
              <List size={32} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-700">Sin transacciones</p>
              <p className="text-[11px] text-zinc-400 mt-1">Aún no hay movimiento de puntos</p>
            </div>
          ) : (
            allTransactions.slice(0, 50).map((tx) => {
              const user = users.find((u) => u.id === tx.user_id);
              return (
                <div key={tx.id} className="rounded-2xl border border-zinc-200 bg-white p-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: tx.points > 0 ? '#34C75915' : '#FF3B3015', color: tx.points > 0 ? '#34C759' : '#FF3B30' }}
                  >
                    {tx.points > 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{user?.nombre || 'Usuario'}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{tx.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: tx.points > 0 ? '#34C759' : '#FF3B30' }}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ ADJUST POINTS ═══ */}
      {activeTab === 'adjust' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Buscar Cliente</p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchPhone}
                onChange={(e) => { setSearchPhone(e.target.value); setSelectedUserId(null); }}
                className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                placeholder="Teléfono o nombre..."
              />
            </div>
            {filteredUsers.length > 0 && !selectedUserId && (
              <div className="flex flex-col gap-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => { setSelectedUserId(user.id); setSearchPhone(user.nombre || user.telefono); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer hover:bg-zinc-50 border border-zinc-100"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: themeColor }}
                    >
                      {user.nombre?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{user.nombre}</p>
                      <p className="text-[11px] text-zinc-500">{user.telefono}</p>
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: themeColor }}>
                      {getUserLoyaltyPoints(user.id)} pts
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ background: themeColor }}
                >
                  {selectedUser.nombre?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-900">{selectedUser.nombre}</p>
                  <p className="text-[11px] text-zinc-500">{selectedUser.telefono}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-xl text-center bg-zinc-50 border border-zinc-200">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase">Puntos</p>
                  <p className="text-xl font-black" style={{ color: themeColor }}>{getUserLoyaltyPoints(selectedUser.id)}</p>
                </div>
                <div className="flex-1 p-3 rounded-xl text-center bg-zinc-50 border border-zinc-200">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase">Nivel</p>
                  <p className="text-sm font-bold text-zinc-900">{getUserLoyaltyTier(selectedUser.id)?.name || 'N/A'}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAdjustPoints(Math.abs(adjustPoints) || 10)}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5"
                  style={{ background: '#34C759' }}
                >
                  <ArrowUp size={14} /> Sumar
                </button>
                <button
                  onClick={() => setAdjustPoints(-Math.abs(adjustPoints) || -10)}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5"
                  style={{ background: '#FF3B30' }}
                >
                  <ArrowDown size={14} /> Restar
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Cantidad de puntos</label>
                  <input
                    type="number"
                    value={adjustPoints || ''}
                    onChange={(e) => setAdjustPoints(Number(e.target.value))}
                    className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    placeholder="Ej: 50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Razón del ajuste</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    placeholder="Ej: Bonificación manual"
                  />
                </div>
                <button
                  onClick={handleAdjustPoints}
                  disabled={adjustPoints === 0 || !adjustReason.trim()}
                  className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                  style={{ background: themeColor }}
                >
                  <Check size={16} /> Aplicar Ajuste
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FidelizacionSection;
