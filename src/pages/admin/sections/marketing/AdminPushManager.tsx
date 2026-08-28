import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../store/supabaseClient';
import { useApp } from '../../../../store/AppContext';
import { uploadImage } from '../../../../store/storageService';
import { useToast } from '../../../../components/Toast';
import {
  Send, Bell, Users, Smartphone, Target, BarChart3,
  Upload, Check, ChevronDown, Eye, MousePointerClick,
  Clock, Zap, AlertCircle, X, MessageSquare
} from 'lucide-react';

interface Segment {
  segment_key: string;
  segment_label?: string;
}

interface CampaignRecord {
  id: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  tipo: string;
  imagen_url?: string;
  link_url?: string;
}

const LINK_OPTIONS = [
  { value: '/', label: 'Inicio' },
  { value: '/catalog', label: 'Catalogo' },
  { value: '/oferta', label: 'Ofertas' },
  { value: '/carrito', label: 'Carrito' },
  { value: '/perfil', label: 'Perfil' },
  { value: '/puntos', label: 'Puntos' },
  { value: '/cupones', label: 'Cupones' },
];

const AdminPushManager: React.FC = () => {
  const { config } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('/');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [audience, setAudience] = useState<'all' | 'phone' | 'segment'>('all');
  const [targetPhone, setTargetPhone] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');
  const [sending, setSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [clickedCount, setClickedCount] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMetrics();
    loadSegments();
    loadCampaigns();
  }, []);

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [subsRes, sentRes, clickedRes] = await Promise.all([
      supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
      supabase.from('push_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'sent')
        .gte('created_at', sevenDaysAgo),
      supabase.from('push_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'clicked')
        .gte('created_at', sevenDaysAgo),
    ]);

    setActiveSubscriptions(subsRes.count || 0);
    setSentCount(sentRes.count || 0);
    setClickedCount(clickedRes.count || 0);
    setLoadingMetrics(false);
  };

  const loadSegments = async () => {
    try {
      const { data, error } = await supabase.from('customer_segments').select('segment_key, segment_label');
      if (error) {
        console.error('[PushManager] Error loading segments:', error.message);
        setSegments([]);
        return;
      }
      setSegments((data || []) as Segment[]);
    } catch {
      setSegments([]);
    }
  };

  const loadCampaigns = async () => {
    const { data } = await supabase.from('notifications')
      .select('id, titulo, mensaje, fecha, tipo, imagen_url, link_url')
      .in('tipo', ['todos', 'personal'])
      .order('fecha', { ascending: false })
      .limit(10);
    setCampaigns((data || []) as CampaignRecord[]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      const url = await uploadImage(file, 'settings', 'push-notifications', { maxWidth: 800 });
      setImageUrl(url);
      showToast('success', 'Imagen subida correctamente');
    } catch {
      showToast('error', 'Error al subir imagen');
    }
    setIsUploading(false);
    if (e.target) e.target.value = '';
  };

  const handleSend = async () => {
    console.log('[PushManager] handleSend llamado:', { title, audience, priority });
    if (!title.trim() || !message.trim()) {
      showToast('warning', 'Completa titulo y mensaje');
      return;
    }
    if (audience === 'phone' && !targetPhone.trim()) {
      showToast('warning', 'Ingresa un numero de telefono');
      return;
    }
    if (audience === 'segment' && !selectedSegment) {
      showToast('warning', 'Selecciona un segmento');
      return;
    }

    setSending(true);
    try {
      const targetValue = audience === 'phone' ? targetPhone.trim() :
        audience === 'segment' ? selectedSegment : '';

      console.log('[PushManager] Enviando RPC send_broadcast_promotion:', { audience, targetValue, priority });
      const { error } = await supabase.rpc('send_broadcast_promotion', {
        p_title: title.trim(),
        p_message: message.trim(),
        p_audience: audience,
        p_target_value: targetValue,
        p_image_url: imageUrl || null,
        p_link_url: linkUrl || null,
        p_priority: priority,
      });

      if (error) {
        console.error('[PushManager] Error en send_broadcast_promotion:', error.message);
        throw error;
      }

      console.log('[PushManager] Notificación enviada exitosamente');
      showToast('success', 'Notificacion enviada correctamente');
      setTitle('');
      setMessage('');
      setImageUrl('');
      setLinkUrl('/');
      setPriority('normal');
      setAudience('all');
      setTargetPhone('');
      setSelectedSegment('');

      loadMetrics();
      loadCampaigns();
    } catch (err: any) {
      showToast('error', err.message || 'Error al enviar notificacion');
    }
    setSending(false);
  };

  const clickRate = sentCount > 0 ? ((clickedCount / sentCount) * 100).toFixed(1) : '0';

  const previewAudienceLabel = audience === 'all' ? 'Todos los suscritos' :
    audience === 'phone' ? targetPhone || '0412...' :
    selectedSegment || 'Segmento...';

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Bell size={18} style={{ color: themeColor }} />
        <h3 className="text-sm font-bold text-slate-900 uppercase">Centro de Control Push</h3>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
          {activeSubscriptions} suscritos
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Users size={14} />, label: 'Suscritos', value: activeSubscriptions, color: '#3B82F6' },
          { icon: <Send size={14} />, label: 'Enviados (7d)', value: sentCount, color: '#10B981' },
          { icon: <MousePointerClick size={14} />, label: `Clicks (7d) — ${clickRate}%`, value: clickedCount, color: '#8B5CF6' },
        ].map((m, i) => (
          <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1" style={{ color: m.color }}>
              {m.icon}
              <span className="text-[9px] font-bold text-slate-500 uppercase">{m.label}</span>
            </div>
            <p className="text-lg font-black text-slate-900">
              {loadingMetrics ? '...' : m.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Form */}
        <div className="flex flex-col gap-4">
          {/* Compose Form */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} style={{ color: themeColor }} />
              <h4 className="text-[10px] font-bold text-slate-500 uppercase">Redactar Notificacion</h4>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Titulo *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Titulo de la notificacion..."
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Mensaje * <span className="text-slate-400 normal-case">({message.length}/500)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 500))}
                  placeholder="Escribe el contenido de la notificacion..."
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs outline-none min-h-[80px] resize-none focus:border-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Imagen (opcional)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50 text-[10px] font-bold"
                  >
                    <Upload size={11} />
                    {isUploading ? '...' : 'Subir'}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Link</label>
                  <div className="relative">
                    <select
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none appearance-none pr-7"
                    >
                      {LINK_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Prioridad</label>
                  <button
                    type="button"
                    onClick={() => setPriority(p => p === 'normal' ? 'high' : 'normal')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                      priority === 'high'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {priority === 'high' ? <Zap size={12} /> : <Clock size={12} />}
                    {priority === 'high' ? 'Alta' : 'Normal'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audience Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} style={{ color: themeColor }} />
              <h4 className="text-[10px] font-bold text-slate-500 uppercase">Selector de Audiencia</h4>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { key: 'all' as const, icon: '📢', label: 'Masivo', desc: 'Todos los suscritos' },
                { key: 'phone' as const, icon: '👤', label: 'Personalizado', desc: 'Por telefono' },
                { key: 'segment' as const, icon: '🎯', label: 'Segmentacion', desc: 'Por segmento' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAudience(opt.key)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    audience === opt.key
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-slate-800 block">{opt.label}</span>
                    <span className="text-[9px] text-slate-500">{opt.desc}</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    audience === opt.key ? 'border-slate-700' : 'border-slate-200'
                  }`}>
                    {audience === opt.key && <div className="w-2 h-2 rounded-full bg-slate-700" />}
                  </div>
                </button>
              ))}

              {audience === 'phone' && (
                <div className="flex flex-col gap-1 mt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Telefono Destinatario</label>
                  <input
                    type="text"
                    value={targetPhone}
                    onChange={e => setTargetPhone(e.target.value)}
                    placeholder="0412..."
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-slate-400"
                  />
                </div>
              )}

              {audience === 'segment' && (
                <div className="flex flex-col gap-1 mt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Segmento</label>
                  {segments.length > 0 ? (
                    <div className="relative">
                      <select
                        value={selectedSegment}
                        onChange={e => setSelectedSegment(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none appearance-none pr-7"
                      >
                        <option value="">Seleccionar segmento...</option>
                        {segments.map(seg => (
                          <option key={seg.segment_key} value={seg.segment_key}>
                            {seg.segment_label || seg.segment_key}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                      <AlertCircle size={11} />
                      No hay segmentos disponibles
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className="w-full py-3 text-white font-bold text-xs rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: themeColor }}
          >
            {sending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send size={13} /> Enviar Notificacion Push
              </>
            )}
          </button>
        </div>

        {/* Right: Preview + Campaigns */}
        <div className="flex flex-col gap-4">
          {/* Preview */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} style={{ color: themeColor }} />
              <h4 className="text-[10px] font-bold text-slate-500 uppercase">Preview</h4>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: themeColor + '20' }}>
                  <Bell size={14} style={{ color: themeColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-800 truncate">
                      {title || 'Titulo de notificacion'}
                    </span>
                    {priority === 'high' && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full flex items-center gap-0.5 shrink-0">
                        <Zap size={7} /> Alta
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed truncate">
                    {message || 'Mensaje de la notificacion...'}
                  </p>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-full max-h-24 object-cover rounded-lg mt-2 border border-slate-100"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {linkUrl && (
                    <div className="flex items-center gap-1 mt-1.5 text-[9px] font-bold" style={{ color: themeColor }}>
                      <MousePointerClick size={9} />
                      {LINK_OPTIONS.find(l => l.value === linkUrl)?.label || linkUrl}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-200 text-[9px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Target size={9} /> {previewAudienceLabel}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={9} /> Ahora
                </span>
              </div>
            </div>
          </div>

          {/* Campaign History */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} style={{ color: themeColor }} />
              <h4 className="text-[10px] font-bold text-slate-500 uppercase">Historial de Campanas</h4>
            </div>
            {campaigns.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[10px] italic">
                No hay campanas enviadas aun
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
                {campaigns.map(camp => (
                  <div
                    key={camp.id}
                    className="p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                            camp.tipo === 'todos' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {camp.tipo === 'todos' ? '📢 Masivo' : '👤 Personal'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">{camp.fecha}</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-800 truncate mt-1">{camp.titulo}</p>
                        <p className="text-[9px] text-slate-500 truncate">{camp.mensaje}</p>
                      </div>
                      {camp.imagen_url && (
                        <img src={camp.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPushManager;
