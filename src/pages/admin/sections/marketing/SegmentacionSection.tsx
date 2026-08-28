import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../store/supabaseClient';
import { CustomerSegment } from '../../../../types/store';
import { useToast } from '../../../../components/Toast';
import { RefreshCw, ChevronDown, ChevronUp, Users } from 'lucide-react';

const SEGMENT_META: Record<string, { label: string; description: string; color: string }> = {
  vip: { label: 'VIP', description: 'Lifetime points >= 500 o 20+ pedidos', color: '#F59E0B' },
  high_value: { label: 'Alto Valor', description: 'Ticket promedio > $15', color: '#10B981' },
  new_user: { label: 'Nuevo', description: 'Registro en ultimos 7 dias', color: '#3B82F6' },
  returning: { label: 'Recurrente', description: '3+ pedidos completados', color: '#8B5CF6' },
  at_risk: { label: 'En Riesgo', description: 'Ultimo pedido hace 14-30 dias', color: '#F97316' },
  inactive_30d: { label: 'Inactivo 30+', description: 'Sin pedidos en 30+ dias', color: '#EF4444' },
  churned: { label: 'Perdido', description: 'Sin pedidos en 90+ dias', color: '#991B1B' },
};

const SegmentacionSection: React.FC = () => {
  const { showToast } = useToast();
  const [segments, setSegments] = useState<Record<string, number>>({});
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [segmentUsers, setSegmentUsers] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => { loadSegments(); }, []);

  const loadSegments = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('customer_segments').select('segment_key');
    if (error) {
      console.error('[Segmentacion] Error loading segments:', error.message);
      showToast('error', 'Error cargando segmentos: ' + error.message);
      setLoading(false);
      return;
    }
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.segment_key] = (counts[row.segment_key] || 0) + 1;
    }
    setSegments(counts);
    setLoading(false);
  };

  const loadUsers = async (segmentKey: string) => {
    if (expandedSegment === segmentKey) {
      setExpandedSegment(null);
      return;
    }
    setExpandedSegment(segmentKey);
    const { data } = await supabase
      .from('customer_segments')
      .select('user_id, metadata, computed_at, segment_label')
      .eq('segment_key', segmentKey)
      .limit(20);
    setSegmentUsers((data || []) as unknown as CustomerSegment[]);
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const { error } = await supabase.rpc('evaluate_all_segments');
      if (error) {
        console.error('[Segmentacion] RPC evaluate_all_segments error:', error.message);
        showToast('error', 'Error recalculando: ' + error.message);
        setRecomputing(false);
        return;
      }
      await loadSegments();
      showToast('success', 'Segmentos recalculados');
    } catch (e: any) {
      console.error('[Segmentacion] Recompute exception:', e);
      showToast('error', e.message || 'Error inesperado al recalcular');
    }
    setRecomputing(false);
  };

  const totalInSegments = Object.values(segments).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-violet-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Segmentacion</h3>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{totalInSegments}</span>
        </div>
        <button onClick={handleRecompute} disabled={recomputing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-violet-600 text-white rounded-lg disabled:opacity-50 cursor-pointer hover:bg-violet-700 transition-colors">
          <RefreshCw size={12} className={recomputing ? 'animate-spin' : ''} />
          {recomputing ? 'Calculando...' : 'Recalcular'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Cargando segmentos...</p>
      ) : Object.keys(segments).length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs">No hay segmentos calculados. Presiona Recalcular.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {Object.entries(segments).sort((a, b) => b[1] - a[1]).map(([key, count]) => {
            const meta = SEGMENT_META[key] || { label: key, description: '', color: '#71717a' };
            const isExpanded = expandedSegment === key;
            return (
              <div key={key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button onClick={() => loadUsers(key)}
                  className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">{meta.label}</p>
                      <p className="text-[10px] text-slate-400">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black" style={{ color: meta.color }}>{count}</span>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    {segmentUsers.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No hay usuarios en este segmento</p>
                    ) : (
                      <div className="flex flex-col gap-1.5 pt-3">
                        {segmentUsers.map((su, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                            <span className="text-xs text-slate-600 font-mono">{su.user_id.slice(0, 12)}...</span>
                            <span className="text-[10px] text-slate-400">{new Date(su.computed_at).toLocaleDateString()}</span>
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
      )}
    </div>
  );
};

export default SegmentacionSection;
