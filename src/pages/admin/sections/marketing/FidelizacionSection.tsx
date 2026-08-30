import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../store/supabaseClient';
import { useApp } from '../../../../store/AppContext';
import type { LoyaltyConfig, LoyaltyLevel, LoyaltyReward, LoyaltyHistory } from '../../../../types/store';
import {
  Award, Settings, List, UserPlus, Plus, Trash2, X, Check, Search,
  ArrowUp, ArrowDown, Gift, Edit3, Save, Trophy, Users, Share2, Copy, ExternalLink, RefreshCw,
} from 'lucide-react';

const FidelizacionSection: React.FC = () => {
  const { config, users, updateConfig } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'levels' | 'rewards' | 'history' | 'adjust' | 'referrals'>('dashboard');
  const [loading, setLoading] = useState(true);

  // Data
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [levels, setLevels] = useState<LoyaltyLevel[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [history, setHistory] = useState<LoyaltyHistory[]>([]);

  // Form states
  const [editingLevel, setEditingLevel] = useState<LoyaltyLevel | null>(null);
  const [newLevel, setNewLevel] = useState<Partial<LoyaltyLevel>>({});
  const [editingReward, setEditingReward] = useState<string | null>(null);
  const [editRewardFields, setEditRewardFields] = useState<Partial<LoyaltyReward>>({});
  const [newReward, setNewReward] = useState<Partial<LoyaltyReward>>({});

  // Adjust points
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Referrals
  const [referralStats, setReferralStats] = useState<{ total: number; completed: number; users_with_code: number } | null>(null);

  // ── Load Data ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, lvlRes, rwRes, histRes] = await Promise.all([
        supabase.from('loyalty_config').select('*').eq('id', 1).single(),
        supabase.from('loyalty_levels').select('*').order('sort_order', { ascending: true }),
        supabase.from('loyalty_rewards').select('*').order('points_cost', { ascending: true }),
        supabase.from('loyalty_history').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      if (cfgRes.data) setLoyaltyConfig(cfgRes.data as LoyaltyConfig);
      if (lvlRes.data) setLevels(lvlRes.data as LoyaltyLevel[]);
      if (rwRes.data) setRewards(rwRes.data as LoyaltyReward[]);
      if (histRes.data) setHistory(histRes.data as LoyaltyHistory[]);

      // Referral stats (con fallback individual si falla RLS o tabla no existe)
      let totalRef = 0;
      let completedRef = 0;
      let usersWithCode = 0;

      try {
        const refRes = await supabase.from('referral_tracking').select('*', { count: 'exact', head: true });
        totalRef = refRes.count || 0;
      } catch { /* referral_tracking puede no estar disponible para anon */ }

      try {
        const compRes = await supabase.from('referral_tracking').select('*', { count: 'exact', head: true }).eq('status', 'bonus_paid');
        completedRef = compRes.count || 0;
      } catch { /* ignore */ }

      try {
        const codeRes = await supabase.from('usuarios_clientes').select('*', { count: 'exact', head: true }).not('codigo_referido', 'is', null);
        usersWithCode = codeRes.count || 0;
      } catch { /* ignore */ }

      setReferralStats({ total: totalRef, completed: completedRef, users_with_code: usersWithCode });
    } catch (err) {
      console.error('[Fidelizacion] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Config Update ──────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!loyaltyConfig) return;
    const newVal = !loyaltyConfig.enabled;
    const { error } = await supabase.from('loyalty_config').update({ enabled: newVal, updated_at: new Date().toISOString() }).eq('id', 1);
    if (!error) {
      setLoyaltyConfig({ ...loyaltyConfig, enabled: newVal });
      // Sincronizar con store_config.loyalty para que el frontend y los SQL triggers estén alineados
      const currentLoyalty = (config.loyalty || {}) as Record<string, unknown>;
      updateConfig({ loyalty: { ...currentLoyalty, enabled: newVal } as LoyaltyConfig });
    }
  };

  const handleConfigField = async (field: string, value: number) => {
    if (!loyaltyConfig) return;
    const { error } = await supabase.from('loyalty_config').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', 1);
    if (!error) setLoyaltyConfig({ ...loyaltyConfig, [field]: value } as LoyaltyConfig);
  };

  // ── Levels CRUD ────────────────────────────────────────────────────────
  const handleAddLevel = async () => {
    if (!newLevel.name) return;
    const { data, error } = await supabase.from('loyalty_levels').insert({
      name: newLevel.name,
      min_points: newLevel.min_points || 0,
      multiplier: newLevel.multiplier || 1.0,
      benefits: newLevel.benefits || [],
      color: newLevel.color || themeColor,
      icon: newLevel.icon || '🏅',
      sort_order: levels.length + 1,
      active: true,
    }).select().single();
    if (!error && data) {
      setLevels([...levels, data as LoyaltyLevel]);
      setNewLevel({});
    }
  };

  const handleSaveLevel = async () => {
    if (!editingLevel) return;
    const { error } = await supabase.from('loyalty_levels').update({
      name: editingLevel.name,
      min_points: editingLevel.min_points,
      multiplier: editingLevel.multiplier,
      benefits: editingLevel.benefits,
      color: editingLevel.color,
      icon: editingLevel.icon,
    }).eq('id', editingLevel.id);
    if (!error) {
      setLevels(levels.map((l) => (l.id === editingLevel.id ? editingLevel : l)));
      setEditingLevel(null);
    }
  };

  const handleDeleteLevel = async (id: string) => {
    const { error } = await supabase.from('loyalty_levels').delete().eq('id', id);
    if (!error) setLevels(levels.filter((l) => l.id !== id));
  };

  // ── Rewards CRUD ───────────────────────────────────────────────────────
  const handleAddReward = async () => {
    if (!newReward.name || !newReward.points_cost) return;
    const { data, error } = await supabase.from('loyalty_rewards').insert({
      name: newReward.name,
      description: newReward.description || '',
      points_cost: newReward.points_cost,
      reward_type: newReward.reward_type || 'discount_fixed',
      reward_value: newReward.reward_value || 0,
      stock: newReward.stock ?? -1,
      active: true,
    }).select().single();
    if (!error && data) {
      setRewards([...rewards, data as LoyaltyReward]);
      setNewReward({});
    }
  };

  const handleSaveReward = async () => {
    if (!editingReward) return;
    const fields = editRewardFields;
    const { error } = await supabase.from('loyalty_rewards').update({
      ...fields,
      updated_at: new Date().toISOString(),
    }).eq('id', editingReward);
    if (!error) {
      setRewards(rewards.map((r) => (r.id === editingReward ? { ...r, ...fields } : r)));
      setEditingReward(null);
      setEditRewardFields({});
    }
  };

  const handleToggleReward = async (id: string, active: boolean) => {
    const { error } = await supabase.from('loyalty_rewards').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) setRewards(rewards.map((r) => (r.id === id ? { ...r, active } : r)));
  };

  const handleDeleteReward = async (id: string) => {
    const { error } = await supabase.from('loyalty_rewards').delete().eq('id', id);
    if (!error) setRewards(rewards.filter((r) => r.id !== id));
  };

  // ── Adjust Points ──────────────────────────────────────────────────────
  const filteredUsers = users
    .filter((u) => searchPhone.trim() && (u.telefono?.includes(searchPhone) || u.nombre?.toLowerCase().includes(searchPhone.toLowerCase())))
    .slice(0, 5);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleAdjustPoints = async () => {
    if (!selectedUserId || adjustPoints === 0 || !adjustReason.trim()) return;
    setAdjustLoading(true);
    try {
      const { data, error } = await supabase.rpc('adjust_loyalty_points', {
        p_user_id: selectedUserId,
        p_points: Math.abs(adjustPoints),
        p_operation: adjustPoints >= 0 ? 'suma' : 'resta',
        p_reason: 'ajuste_admin',
        p_description: adjustReason.trim(),
        p_admin_id: 'admin',
      });
      if (error) {
        console.error('[adjust] error:', error);
        return;
      }
      setAdjustPoints(0);
      setAdjustReason('');
      setSelectedUserId(null);
      setSearchPhone('');
      loadData();
    } finally {
      setAdjustLoading(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalPoints = users.reduce((sum, u) => sum + ((u as unknown as Record<string, number>).puntos_fidelidad || 0), 0);
  const activeUsersCount = users.filter((u) => ((u as unknown as Record<string, number>).puntos_fidelidad || 0) > 0).length;

  const tabs = [
    { id: 'dashboard' as const, label: 'General', icon: Settings },
    { id: 'levels' as const, label: 'Niveles', icon: Trophy },
    { id: 'rewards' as const, label: 'Premios', icon: Gift },
    { id: 'history' as const, label: 'Historial', icon: List },
    { id: 'adjust' as const, label: 'Ajustar', icon: UserPlus },
    { id: 'referrals' as const, label: 'Referidos', icon: Share2 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={20} className="animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-500">Cargando sistema de fidelización...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle Global */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between border"
        style={{
          background: loyaltyConfig?.enabled ? themeColor + '08' : 'white',
          borderColor: loyaltyConfig?.enabled ? themeColor + '30' : '#e5e7eb',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: loyaltyConfig?.enabled ? themeColor + '15' : '#f4f4f5', color: loyaltyConfig?.enabled ? themeColor : '#a1a1aa' }}
          >
            <Award size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900">Sistema de Fidelización</p>
            <p className="text-xs text-zinc-500">
              {loyaltyConfig?.enabled ? 'Activo — clientes acumulan puntos' : 'Desactivado'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className="relative w-14 h-8 rounded-full transition-colors cursor-pointer"
          style={{ background: loyaltyConfig?.enabled ? themeColor : '#d4d4d8' }}
        >
          <div
            className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform"
            style={{ left: loyaltyConfig?.enabled ? 30 : 4 }}
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
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Puntos activos', value: totalPoints.toLocaleString(), color: themeColor },
              { label: 'Clientes con pts', value: String(activeUsersCount), color: '#8B5CF6' },
              { label: 'Niveles', value: String(levels.length), color: '#F59E0B' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-3 text-center border border-zinc-200 bg-white">
                <p className="text-xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {loyaltyConfig?.enabled && (
            <>
              {/* Ganar Puntos */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ganar Puntos</p>
                {[
                  { key: 'points_per_dollar', label: 'Puntos por $1 gastado', step: 0.5 },
                  { key: 'min_order_for_points', label: 'Pedido mínimo para ganar ($)', step: 1 },
                  { key: 'welcome_bonus', label: 'Puntos de bienvenida', step: 10 },
                  { key: 'first_order_bonus', label: 'Bono primera compra', step: 5 },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700">{item.label}</span>
                    <input
                      type="number"
                      step={item.step}
                      value={(loyaltyConfig as unknown as Record<string, number>)[item.key] ?? 0}
                      onChange={(e) => handleConfigField(item.key, Number(e.target.value))}
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
                    value={loyaltyConfig.redemption_rate ?? 100}
                    onChange={(e) => handleConfigField('redemption_rate', Number(e.target.value))}
                    className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700">Descuento máximo por canje (%)</span>
                  <input
                    type="number"
                    value={loyaltyConfig.max_discount_percent ?? 30}
                    onChange={(e) => handleConfigField('max_discount_percent', Number(e.target.value))}
                    className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  />
                </div>
              </div>

              {/* Bonos Extra */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Bonos Extra</p>
                {[
                  { key: 'daily_login_bonus', label: 'Login diario', emoji: '📅' },
                  { key: 'review_bonus', label: 'Dejar reseña', emoji: '⭐' },
                  { key: 'referral_bonus_referrer', label: 'Referir amigo (referidor)', emoji: '🤝' },
                  { key: 'referral_bonus_referred', label: 'Referido (nuevo registro)', emoji: '🎉' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700 flex items-center gap-2">
                      <span>{item.emoji}</span> {item.label}
                    </span>
                    <input
                      type="number"
                      value={(loyaltyConfig as unknown as Record<string, number>)[item.key] ?? 0}
                      onChange={(e) => handleConfigField(item.key, Number(e.target.value))}
                      className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ LEVELS ═══ */}
      {activeTab === 'levels' && (
        <div className="flex flex-col gap-3">
          {levels.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
              <Trophy size={32} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-700">Sin niveles configurados</p>
              <p className="text-[11px] text-zinc-400 mt-1">Agrega niveles para definir multiplicadores de puntos</p>
            </div>
          ) : (
            levels.map((level) => (
              <div key={level.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                {editingLevel?.id === level.id ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editingLevel.name}
                        onChange={(e) => setEditingLevel({ ...editingLevel, name: e.target.value })}
                        className="flex-1 text-sm font-bold px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                        placeholder="Nombre del nivel"
                      />
                      <input
                        type="text"
                        value={editingLevel.icon}
                        onChange={(e) => setEditingLevel({ ...editingLevel, icon: e.target.value })}
                        className="w-12 text-center text-lg px-2 py-2 rounded-xl border border-zinc-200 outline-none bg-zinc-50"
                        placeholder="🏅"
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Puntos mínimos</label>
                        <input
                          type="number"
                          value={editingLevel.min_points}
                          onChange={(e) => setEditingLevel({ ...editingLevel, min_points: Number(e.target.value) })}
                          className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Multiplicador</label>
                        <input
                          type="number"
                          step="0.25"
                          value={editingLevel.multiplier}
                          onChange={(e) => setEditingLevel({ ...editingLevel, multiplier: Number(e.target.value) })}
                          className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={editingLevel.color || themeColor}
                          onChange={(e) => setEditingLevel({ ...editingLevel, color: e.target.value })}
                          className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editingLevel.color || ''}
                          onChange={(e) => setEditingLevel({ ...editingLevel, color: e.target.value })}
                          className="flex-1 text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Beneficios (separados por coma)</label>
                      <input
                        type="text"
                        value={editingLevel.benefits?.join(', ') || ''}
                        onChange={(e) => setEditingLevel({ ...editingLevel, benefits: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                        className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                        placeholder="Envío gratis, Puntos extra..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveLevel} className="flex-1 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5" style={{ background: themeColor }}>
                        <Save size={14} /> Guardar
                      </button>
                      <button onClick={() => setEditingLevel(null)} className="flex-1 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs flex items-center justify-center gap-1.5">
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: level.color + '15' }}>
                      {level.icon || '🏅'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold" style={{ color: level.color }}>{level.name}</p>
                        <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">×{level.multiplier}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {level.min_points}+ pts · {level.benefits?.length || 0} beneficios
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingLevel(level)} className="p-2 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors">
                        <Settings size={14} />
                      </button>
                      <button onClick={() => handleDeleteLevel(level.id)} className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add new level */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Agregar Nivel</p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLevel.name || ''}
                  onChange={(e) => setNewLevel({ ...newLevel, name: e.target.value })}
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  placeholder="Nombre (ej: Diamante)"
                />
                <input
                  type="text"
                  value={newLevel.icon || ''}
                  onChange={(e) => setNewLevel({ ...newLevel, icon: e.target.value })}
                  className="w-12 text-center text-lg px-2 py-2 rounded-xl border border-zinc-200 outline-none bg-zinc-50"
                  placeholder="💎"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Puntos mínimos</label>
                  <input
                    type="number"
                    value={newLevel.min_points || ''}
                    onChange={(e) => setNewLevel({ ...newLevel, min_points: Number(e.target.value) })}
                    className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Multiplicador</label>
                  <input
                    type="number"
                    step="0.25"
                    value={newLevel.multiplier || ''}
                    onChange={(e) => setNewLevel({ ...newLevel, multiplier: Number(e.target.value) })}
                    className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Color</label>
                <input
                  type="color"
                  value={newLevel.color || themeColor}
                  onChange={(e) => setNewLevel({ ...newLevel, color: e.target.value })}
                  className="w-12 h-10 rounded-lg border border-zinc-200 cursor-pointer"
                />
              </div>
              <button
                onClick={handleAddLevel}
                disabled={!newLevel.name}
                className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                style={{ background: themeColor }}
              >
                <Plus size={16} /> Agregar Nivel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REWARDS ═══ */}
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
                  value={newReward.reward_type || 'discount_fixed'}
                  onChange={(e) => setNewReward((p) => ({ ...p, reward_type: e.target.value as LoyaltyReward['reward_type'] }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                >
                  <option value="discount_percent">Descuento (%)</option>
                  <option value="discount_fixed">Descuento ($)</option>
                  <option value="free_product">Producto Gratis</option>
                  <option value="free_shipping">Envío Gratis</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  value={newReward.reward_value || ''}
                  onChange={(e) => setNewReward((p) => ({ ...p, reward_value: Number(e.target.value) }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  placeholder="2.50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Stock (-1 = ilimitado)</label>
                <input
                  type="number"
                  value={newReward.stock ?? -1}
                  onChange={(e) => setNewReward((p) => ({ ...p, stock: Number(e.target.value) }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Descripción</label>
                <input
                  type="text"
                  value={newReward.description || ''}
                  onChange={(e) => setNewReward((p) => ({ ...p, description: e.target.value }))}
                  className="text-sm px-3 py-2 rounded-xl border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
                  placeholder="Descuento de $2.50"
                />
              </div>
            </div>
            <button
              onClick={handleAddReward}
              disabled={!newReward.name || !newReward.points_cost}
              className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
              style={{ background: themeColor }}
            >
              <Plus size={16} /> Agregar Premio
            </button>
          </div>

          {/* Rewards List */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Catálogo de Premios</p>
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{rewards.length} items</span>
            </div>

            {rewards.length === 0 ? (
              <div className="text-center py-8">
                <Gift size={32} className="text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No hay premios aún</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rewards.map((reward) => (
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
                      {reward.reward_type === 'discount_percent' || reward.reward_type === 'discount_fixed' ? '$' : reward.reward_type === 'free_shipping' ? '🚚' : '🎁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900 truncate">{reward.name}</p>
                        {!reward.active && <span className="text-[9px] font-bold bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded">OFF</span>}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {reward.points_cost} pts
                        {reward.reward_value ? ` · $${reward.reward_value}` : ''}
                        {reward.stock >= 0 ? ` · Stock: ${reward.stock - reward.stock_used}` : ' · Sin límite'}
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
                          <button onClick={handleSaveReward} className="p-1.5 rounded-lg" style={{ background: '#34C75915', color: '#34C759' }}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => { setEditingReward(null); setEditRewardFields({}); }} className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500">
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
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleReward(reward.id, !reward.active)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ background: reward.active ? '#34C75915' : '#FF3B3015' }}
                          >
                            {reward.active ? <Check size={13} style={{ color: '#34C759' }} /> : <X size={13} style={{ color: '#FF3B30' }} />}
                          </button>
                          <button onClick={() => handleDeleteReward(reward.id)} className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
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

      {/* ═══ HISTORY ═══ */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
              <List size={32} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-700">Sin transacciones</p>
              <p className="text-[11px] text-zinc-400 mt-1">Aún no hay movimiento de puntos</p>
            </div>
          ) : (
            history.map((tx) => {
              const user = users.find((u) => u.id === tx.user_id);
              return (
                <div key={tx.id} className="rounded-2xl border border-zinc-200 bg-white p-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: tx.operation === 'suma' ? '#34C75915' : '#FF3B3015', color: tx.operation === 'suma' ? '#34C759' : '#FF3B30' }}
                  >
                    {tx.operation === 'suma' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{user?.nombre || 'Usuario'}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{tx.description}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{tx.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: tx.operation === 'suma' ? '#34C759' : '#FF3B30' }}>
                      {tx.operation === 'suma' ? '+' : '-'}{tx.points}
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
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: themeColor }}>
                      {user.nombre?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{user.nombre}</p>
                      <p className="text-[11px] text-zinc-500">{user.telefono}</p>
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: themeColor }}>
                      {(user as unknown as Record<string, number>).puntos_fidelidad || 0} pts
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: themeColor }}>
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
                  <p className="text-xl font-black" style={{ color: themeColor }}>{(selectedUser as unknown as Record<string, number>).puntos_fidelidad || 0}</p>
                </div>
                <div className="flex-1 p-3 rounded-xl text-center bg-zinc-50 border border-zinc-200">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase">Histórico</p>
                  <p className="text-sm font-bold text-zinc-900">{(selectedUser as unknown as Record<string, number>).puntos_historicos || 0}</p>
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
                  disabled={adjustPoints === 0 || !adjustReason.trim() || adjustLoading}
                  className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                  style={{ background: themeColor }}
                >
                  {adjustLoading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                  {adjustLoading ? 'Aplicando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ REFERRALS ═══ */}
      {activeTab === 'referrals' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total referidos', value: String(referralStats?.total || 0), color: '#8B5CF6' },
              { label: 'Completados', value: String(referralStats?.completed || 0), color: '#34C759' },
              { label: 'Con código', value: String(referralStats?.users_with_code || 0), color: themeColor },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-3 text-center border border-zinc-200 bg-white">
                <p className="text-xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cómo funciona</p>
            <div className="flex flex-col gap-2 text-sm text-zinc-600">
              <div className="flex items-start gap-2">
                <span className="text-lg">1️⃣</span>
                <p>Cada usuario recibe un <strong>código único</strong> de referido al registrarse</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">2️⃣</span>
                <p>Comparte el código o enlace. El nuevo usuario lo ingresa al registrarse</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">3️⃣</span>
                <p>Al completar el <strong>primer pedido</strong>, ambos reciben puntos automáticos</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Configuración de Referidos</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-700">Puntos para referidor</span>
              <input
                type="number"
                value={loyaltyConfig?.referral_bonus_referrer || 0}
                onChange={(e) => handleConfigField('referral_bonus_referrer', Number(e.target.value))}
                className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-700">Puntos para referido</span>
              <input
                type="number"
                value={loyaltyConfig?.referral_bonus_referred || 0}
                onChange={(e) => handleConfigField('referral_bonus_referred', Number(e.target.value))}
                className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border border-zinc-200 outline-none focus:border-zinc-500 bg-zinc-50"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FidelizacionSection;
