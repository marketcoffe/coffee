import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../store/supabaseClient';
import { useToast } from '../../../../components/Toast';
import { BarChart3, Users } from 'lucide-react';

const AnalyticsPushSection: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState({ sent: 0, clicked: 0 });
  const [dailyStats, setDailyStats] = useState<{ date: string; sent: number; clicked: number }[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const [eventsRes, subsRes] = await Promise.all([
        supabase.from('push_events')
          .select('event_type, created_at')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.from('push_subscriptions')
          .select('id', { count: 'exact', head: true }),
      ]);

      if (eventsRes.error) {
        console.error('[AnalyticsPush] Error loading events:', eventsRes.error.message);
        showToast('error', 'Error cargando eventos push: ' + eventsRes.error.message);
        setError(eventsRes.error.message);
      }

      if (subsRes.error) {
        console.error('[AnalyticsPush] Error loading subscribers:', subsRes.error.message);
        setError(subsRes.error.message);
      }

      setSubscriberCount(subsRes.count || 0);

      const allEvents = eventsRes.data || [];
      const sent = allEvents.filter(e => e.event_type === 'sent').length;
      const clicked = allEvents.filter(e => e.event_type === 'clicked').length;
      setFunnel({ sent, clicked });

      const byDay: Record<string, { sent: number; clicked: number }> = {};
      for (const e of allEvents) {
        const day = e.created_at?.slice(0, 10) || 'unknown';
        if (!byDay[day]) byDay[day] = { sent: 0, clicked: 0 };
        if (e.event_type === 'sent') byDay[day].sent++;
        if (e.event_type === 'clicked') byDay[day].clicked++;
      }

      const daily = Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([date, stats]) => ({ date, ...stats }));
      setDailyStats(daily);
    } catch (err: any) {
      const msg = err?.message || 'Error desconocido';
      console.error('[AnalyticsPush] Load failed:', msg);
      showToast('error', 'Error cargando analytics: ' + msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Cargando analytics...</p>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="text-2xl mb-2">⚠️</span>
        <p className="text-xs text-red-500 mb-2">{error}</p>
        <button
          onClick={loadAnalytics}
          className="px-3 py-1.5 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const maxVal = Math.max(...dailyStats.map(d => d.sent), 1);
  const clickRate = funnel.sent > 0 ? ((funnel.clicked / funnel.sent) * 100).toFixed(1) : '0';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-violet-600" />
        <h3 className="text-sm font-bold text-slate-900 uppercase">Push Analytics</h3>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Resumen Push</h4>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <p className="text-[10px] text-slate-400 flex items-center gap-1"><Users size={10} /> Suscritos</p>
            <p className="text-2xl font-black text-blue-600">{subscriberCount}</p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-slate-400">Enviados</p>
            <p className="text-2xl font-black text-blue-600">{funnel.sent}</p>
          </div>
          <div className="text-2xl text-slate-300">→</div>
          <div className="flex-1">
            <p className="text-[10px] text-slate-400">Clicks</p>
            <p className="text-2xl font-black text-emerald-600">{funnel.clicked}</p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-[10px] text-slate-400">Click Rate</p>
            <p className="text-2xl font-black text-violet-600">{clickRate}%</p>
          </div>
        </div>
      </div>

      {dailyStats.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Actividad Ultimos 14 Dias</h4>
          <div className="flex items-end gap-1 h-32">
            {dailyStats.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '100px' }}>
                  <div className="w-full rounded-t" style={{
                    height: `${(d.clicked / maxVal) * 80}px`,
                    backgroundColor: '#8B5CF6',
                    minHeight: d.clicked > 0 ? '4px' : '0'
                  }} />
                  <div className="w-full rounded-t" style={{
                    height: `${((d.sent - d.clicked) / maxVal) * 80}px`,
                    backgroundColor: '#C4B5FD',
                    minHeight: (d.sent - d.clicked) > 0 ? '4px' : '0'
                  }} />
                </div>
                <span className="text-[8px] text-slate-400">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-2 h-2 rounded" style={{ backgroundColor: '#C4B5FD' }} /> Enviados
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-2 h-2 rounded" style={{ backgroundColor: '#8B5CF6' }} /> Clicks
            </span>
          </div>
        </div>
      )}

      {dailyStats.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-xs">No hay datos de eventos push aun</div>
      )}
    </div>
  );
};

export default AnalyticsPushSection;
