import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../store/supabaseClient';
import { useApp } from '../store/AppContext';
import type { LoyaltyUserLevel, LoyaltyReward, LoyaltyHistory } from '../types/store';
import { Award, Star, Gift, Share2, Copy, Check, ChevronRight, Trophy, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';

interface LoyaltyWidgetProps {
  themeColor: string;
}

export const LoyaltyWidget: React.FC<LoyaltyWidgetProps> = ({ themeColor }) => {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [userLevel, setUserLevel] = useState<LoyaltyUserLevel | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [history, setHistory] = useState<LoyaltyHistory[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<'balance' | 'catalog' | 'history' | 'referral'>('balance');
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const [levelRes, rewardsRes, historyRes] = await Promise.all([
        supabase.rpc('get_user_loyalty_level', { p_user_id: currentUser.id }),
        supabase.from('loyalty_rewards').select('*').eq('active', true).order('points_cost', { ascending: true }),
        supabase.from('loyalty_history').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20),
      ]);

      if (levelRes.data) setUserLevel(levelRes.data as LoyaltyUserLevel);
      if (rewardsRes.data) setRewards(rewardsRes.data as LoyaltyReward[]);
      if (historyRes.data) setHistory(historyRes.data as LoyaltyHistory[]);
    } catch (err) {
      console.error('[LoyaltyWidget] error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCopyCode = async () => {
    if (!currentUser?.codigo_referido) return;
    const code = currentUser.codigo_referido;
    const link = `${window.location.origin}?ref=${code}`;
    try {
      await navigator.clipboard.writeText(`Usa mi código ${code} para registrarte: ${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = `Usa mi código ${code} para registrarte: ${link}`;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRedeem = async (reward: LoyaltyReward) => {
    if (!currentUser?.id) return;
    setRedeemingId(reward.id);
    try {
      const { data, error } = await supabase.rpc('redeem_loyalty_reward', {
        p_user_id: currentUser.id,
        p_reward_id: reward.id,
      });
      if (error || !data?.success) {
        console.error('[redeem] error:', error || data?.error);
        return;
      }
      loadData();
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw size={18} className="animate-spin" style={{ color: themeColor }} />
      </div>
    );
  }

  const currentPoints = userLevel?.current_points || 0;
  const lifetimePoints = userLevel?.lifetime_points || 0;
  const currentLevel = userLevel?.current_level;
  const nextLevel = userLevel?.next_level;
  const progress = userLevel?.progress_percent || 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Points Balance Card */}
      <div className="rounded-2xl p-5 text-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}CC)` }}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Award size={18} />
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">Mis Puntos</p>
        </div>
        <p className="text-5xl font-black mb-1">{currentPoints}</p>
        <p className="text-[11px] opacity-80">
          {currentLevel ? `${currentLevel.icon} ${currentLevel.name}` : 'Sin nivel'}
          {currentLevel && currentLevel.multiplier > 1 && ` (×${currentLevel.multiplier})`}
        </p>
        {!currentUser?.is_pwa_installed && (
          <p className="text-[10px] mt-2 opacity-70 bg-white/20 rounded-lg px-2 py-1 inline-block">
            Descarga la app para ganar ×{currentLevel?.multiplier || 1} puntos extra
          </p>
        )}
      </div>

      {/* Level Progress */}
      {currentLevel && nextLevel && (
        <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#8f7065] uppercase">Progreso al siguiente nivel</span>
            <span className="text-[11px] font-bold" style={{ color: themeColor }}>{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-[#f4f4f5] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%`, background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel.color})` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[#8f7065]">{currentLevel.icon} {currentLevel.name}</span>
            <span className="text-[10px] text-[#8f7065]">{nextLevel.icon} {nextLevel.name} ({nextLevel.min_points - lifetimePoints} pts restantes)</span>
          </div>
        </div>
      )}

      {/* Quick Nav */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {[
          { id: 'balance' as const, label: 'Puntos', icon: Award },
          { id: 'catalog' as const, label: 'Catálogo', icon: Gift },
          { id: 'history' as const, label: 'Historial', icon: Star },
          { id: 'referral' as const, label: 'Referir', icon: Share2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer"
              style={{
                background: isActive ? themeColor : 'white',
                color: isActive ? '#fff' : '#8f7065',
                border: `1px solid ${isActive ? themeColor : '#e4beb120'}`,
              }}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ BALANCE VIEW ═══ */}
      {activeView === 'balance' && (
        <>
          {/* Current Level */}
          {currentLevel && (
            <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: currentLevel.color + '15' }}>
                {currentLevel.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: currentLevel.color }}>{currentLevel.name}</p>
                <p className="text-[11px] text-[#8f7065]">×{currentLevel.multiplier} multiplicador de puntos</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-white" style={{ backgroundColor: currentLevel.color }}>ACTIVO</span>
            </div>
          )}

          {/* Benefits */}
          {currentLevel?.benefits && currentLevel.benefits.length > 0 && (
            <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4">
              <p className="text-[11px] text-[#8f7065] font-bold uppercase tracking-wider mb-2">Tus Beneficios</p>
              <div className="flex flex-col gap-1.5">
                {currentLevel.benefits.map((benefit: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-[#1a1c1d]">
                    <Check size={14} style={{ color: themeColor }} />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lifetime Points */}
          <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4 text-center">
            <p className="text-[11px] text-[#8f7065] font-bold uppercase tracking-wider">Puntos Históricos</p>
            <p className="text-2xl font-black mt-1" style={{ color: themeColor }}>{lifetimePoints}</p>
            <p className="text-[10px] text-[#8f7065]">Total acumulado desde tu registro</p>
          </div>
        </>
      )}

      {/* ═══ CATALOG VIEW ═══ */}
      {activeView === 'catalog' && (
        <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-[11px] text-[#8f7065] font-bold uppercase tracking-wider">Catálogo de Premios</p>
          {rewards.length === 0 ? (
            <div className="text-center py-6">
              <Gift size={32} className="mx-auto mb-2" style={{ color: themeColor + '40' }} />
              <p className="text-[13px] text-[#8f7065]">No hay premios disponibles</p>
            </div>
          ) : (
            rewards.map((reward) => {
              const canRedeem = currentPoints >= reward.points_cost;
              const isRedeeming = redeemingId === reward.id;
              return (
                <div key={reward.id} className="p-3 border border-[#e4beb1]/10 rounded-xl flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                    {reward.reward_type === 'discount_percent' || reward.reward_type === 'discount_fixed' ? '$' : reward.reward_type === 'free_shipping' ? '🚚' : '🎁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1a1c1d] text-sm truncate">{reward.name}</p>
                    <p className="text-[11px] text-[#8f7065]">{reward.points_cost} puntos</p>
                  </div>
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={!canRedeem || isRedeeming}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${canRedeem ? 'active:scale-95' : 'bg-[#eeeef0] text-[#8f7065]'}`}
                    style={canRedeem ? { backgroundColor: themeColor, color: '#fff' } : {}}
                  >
                    {isRedeeming ? '...' : canRedeem ? 'Canjear' : `Faltan ${reward.points_cost - currentPoints}`}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ HISTORY VIEW ═══ */}
      {activeView === 'history' && (
        <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-[11px] text-[#8f7065] font-bold uppercase tracking-wider">Últimos Movimientos</p>
          {history.length === 0 ? (
            <p className="text-[13px] text-[#8f7065] text-center py-6">Aún no tienes movimientos de puntos</p>
          ) : (
            history.map((tx) => (
              <div key={tx.id} className="p-3 border border-[#e4beb1]/10 rounded-xl flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: tx.operation === 'suma' ? themeColor + '15' : '#FEE2E2', color: tx.operation === 'suma' ? themeColor : '#DC2626' }}
                >
                  {tx.operation === 'suma' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1a1c1d] text-[13px] truncate">{tx.description}</p>
                  <p className="text-[10px] text-[#8f7065]">{tx.reason}</p>
                </div>
                <span className="font-bold text-sm shrink-0" style={{ color: tx.operation === 'suma' ? themeColor : '#DC2626' }}>
                  {tx.operation === 'suma' ? '+' : '-'}{tx.points}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ REFERRAL VIEW ═══ */}
      {activeView === 'referral' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5 text-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, #8B5CF6, #6D28D9)` }}>
            <Share2 size={24} className="mx-auto mb-2 opacity-90" />
            <p className="text-sm font-bold mb-1">Invita amigos y gana puntos</p>
            <p className="text-[11px] opacity-80 mb-3">Comparte tu código. Ambos reciben puntos cuando haga su primer pedido.</p>
            {currentUser?.codigo_referido && (
              <div className="bg-white/20 rounded-xl p-3 inline-block">
                <p className="text-[10px] opacity-70 mb-1">Tu código</p>
                <p className="text-2xl font-black tracking-wider">{currentUser.codigo_referido}</p>
              </div>
            )}
          </div>

          {/* Copy Button */}
          {currentUser?.codigo_referido && (
            <button
              onClick={handleCopyCode}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm active:scale-95 transition-all"
              style={{ background: copied ? '#34C759' : themeColor }}
            >
              {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar código y enlace</>}
            </button>
          )}

          {/* How it works */}
          <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-[11px] text-[#8f7065] font-bold uppercase tracking-wider">Cómo funciona</p>
            <div className="flex flex-col gap-2 text-sm text-[#1a1c1d]">
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">1️⃣</span>
                <p>Comparte tu código con amigos</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">2️⃣</span>
                <p>Ellos se registran usando tu código</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">3️⃣</span>
                <p>Ambos reciben puntos al completar el primer pedido</p>
              </div>
            </div>
          </div>

          {/* Referral Stats */}
          {currentUser?.referral_count !== undefined && currentUser.referral_count > 0 && (
            <div className="bg-white border border-[#e4beb1]/10 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-[#8f7065] font-bold uppercase tracking-wider">Amigos referidos</p>
              <p className="text-3xl font-black mt-1" style={{ color: '#8B5CF6' }}>{currentUser.referral_count}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
