import React, { useState, useRef } from 'react';
import { useApp } from '../../../../store/AppContext';
import { uploadFileToStorage, compressImage } from '../../../../store/supabaseClient';
import { Send, MessageSquare, MessageCircle, Trash2, User, Bell, Upload, Package, Search, ExternalLink } from 'lucide-react';

const MensajesSection: React.FC = () => {
  const { notifications, addNotification, deleteNotification, foodItems, config } = useApp();
  const themeColor = config.theme_color || '#A4D045';

  const [activeChatPhone, setActiveChatPhone] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'clientes' | 'envios' | 'sistema'>('clientes');

  // Broadcast form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastImage, setBroadcastImage] = useState('');
  const [broadcastLink, setBroadcastLink] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [notifType, setNotifType] = useState<'todos' | 'personal'>('todos');
  const [personalPhone, setPersonalPhone] = useState('');
  const bImageInputRef = useRef<HTMLInputElement>(null);

  const getClientMessages = (phone: string) =>
    notifications.filter(n => n.destinatario_telefono === phone).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const getLastMessage = (phone: string) => {
    const msgs = getClientMessages(phone);
    return msgs[msgs.length - 1];
  };

  const phoneSet = new Set<string>();
  notifications.filter(n => n.destinatario_telefono && n.tipo === 'personal').forEach(n => phoneSet.add(n.destinatario_telefono!));
  const clientPhones = Array.from(phoneSet);

  const groupNotifs = notifications.filter(n => n.tipo === 'todos');
  const systemNotifs = notifications.filter(n => n.tipo === 'admin');

  const filteredList = activeTab === 'clientes' ? clientPhones : activeTab === 'envios' ? [] : [];

  const handleSendReply = async () => {
    if (!activeChatPhone || !replyMessage.trim()) return;
    await addNotification('Re: Tu mensaje', replyMessage.trim(), 'personal', activeChatPhone, '', '');
    setReplyMessage('');
  };

  const handleDeleteConversation = () => {
    if (!activeChatPhone) return;
    notifications.filter(n => n.destinatario_telefono === activeChatPhone).forEach(n => deleteNotification(n.id));
    setActiveChatPhone(null);
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    if (notifType === 'personal' && !personalPhone.trim()) return;
    const target = notifType === 'personal' ? personalPhone.trim() : undefined;
    const ok = await addNotification(broadcastTitle.trim(), broadcastMessage.trim(), notifType, target, broadcastImage, broadcastLink);
    if (ok) {
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastImage('');
      setBroadcastLink('');
      setPersonalPhone('');
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBroadcastImage(URL.createObjectURL(file));
    setIsUploadingImage(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 800, quality: 0.8 });
      const url = await uploadFileToStorage(compressed, 'settings', `promos/${crypto.randomUUID()}.webp`);
      setBroadcastImage(url);
    } catch { /* ignore */ }
    setIsUploadingImage(false);
    if (e.target) e.target.value = '';
  };

  const pickerProducts = foodItems.filter(p => !pickerSearch.trim() || p.nombre.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <MessageSquare size={18} style={{ color: themeColor }} />
        <h3 className="text-sm font-bold text-slate-900 uppercase">Mensajes</h3>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl ml-auto">
          {(['clientes', 'envios', 'sistema'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setActiveChatPhone(null); }}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab === 'clientes' ? 'Clientes' : tab === 'envios' ? 'Envios' : 'Sistema'}
            </button>
          ))}
        </div>
      </div>

      {/* Broadcast Form */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} style={{ color: themeColor }} />
          <h4 className="text-[10px] font-bold text-slate-500 uppercase">Enviar Notificacion</h4>
        </div>
        <form onSubmit={handleBroadcast} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
            <select value={notifType} onChange={e => setNotifType(e.target.value as 'todos' | 'personal')}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none">
              <option value="todos">Todos los clientes</option>
              <option value="personal">Cliente especifico</option>
            </select>
          </div>
          {notifType === 'personal' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Telefono Destinatario</label>
              <input type="text" value={personalPhone} onChange={e => setPersonalPhone(e.target.value)} placeholder="0412..."
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Titulo</label>
            <input type="text" value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="Titulo de la notificacion"
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Mensaje</label>
            <textarea value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} placeholder="Contenido..."
              className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs outline-none min-h-[70px] resize-none" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Imagen</label>
              <div className="flex gap-1">
                <input type="text" value={broadcastImage} onChange={e => setBroadcastImage(e.target.value)} placeholder="URL..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] outline-none" />
                <button type="button" onClick={() => bImageInputRef.current?.click()} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"><Upload size={12} /></button>
                <input type="file" ref={bImageInputRef} hidden accept="image/*" onChange={handleUploadImage} />
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Link</label>
              <input type="text" value={broadcastLink} onChange={e => setBroadcastLink(e.target.value)} placeholder="/?id=..."
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Producto</label>
              <button type="button" onClick={() => setShowProductPicker(true)} className="flex items-center gap-1 bg-slate-100 text-slate-600 rounded-lg px-2 py-1.5 text-[10px] font-bold hover:bg-slate-200">
                <Package size={11} /> Vincular
              </button>
            </div>
          </div>
          <button type="submit" className="w-full py-2.5 text-white font-bold text-xs rounded-xl transition-all" style={{ background: themeColor }}>
            <Send size={12} className="inline mr-1" /> Enviar
          </button>
        </form>
      </div>

      {/* Chat Interface */}
      <div className="flex gap-4 h-[500px]">
        <div className="w-1/3 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-800 uppercase">
              {activeTab === 'clientes' ? `Clientes (${clientPhones.length})` : activeTab === 'envios' ? `Broadcasts (${groupNotifs.length})` : `Sistema (${systemNotifs.length})`}
            </h4>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'clientes' ? (
              clientPhones.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-[10px] italic">Sin conversaciones</div>
              ) : clientPhones.map(phone => {
                const last = getLastMessage(phone);
                const unread = getClientMessages(phone).filter(m => !m.leida).length;
                return (
                  <button key={phone} onClick={() => setActiveChatPhone(phone)}
                    className={`w-full text-left p-3 border-b border-slate-50 hover:bg-slate-50 transition-all ${activeChatPhone === phone ? 'bg-slate-50 border-l-4 border-l-current' : ''}`}
                    style={activeChatPhone === phone ? { borderLeftColor: themeColor } : {}}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{phone}</span>
                      {unread > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unread}</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{last?.mensaje || 'Sin mensajes'}</p>
                  </button>
                );
              })
            ) : activeTab === 'envios' ? (
              groupNotifs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-[10px] italic">Sin broadcasts</div>
              ) : groupNotifs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map(n => (
                <button key={n.id} onClick={() => setActiveChatPhone('broadcast')}
                  className="w-full text-left p-3 border-b border-slate-50 hover:bg-slate-50">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-800">Broadcast</span>
                    <span className="text-[9px] text-slate-400">{n.fecha}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{n.titulo}</p>
                </button>
              ))
            ) : (
              systemNotifs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-[10px] italic">Sin mensajes del sistema</div>
              ) : systemNotifs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map(n => (
                <button key={n.id} className="w-full text-left p-3 border-b border-slate-50 hover:bg-slate-50">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-800">Sistema</span>
                    <span className="text-[9px] text-slate-400">{n.fecha}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{n.titulo}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="w-2/3 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {activeChatPhone ? (
            <>
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: themeColor + '20' }}>
                    <User size={14} style={{ color: themeColor }} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{activeChatPhone === 'broadcast' ? 'Broadcasts' : activeChatPhone}</h4>
                    <p className="text-[9px] text-slate-500">
                      {(activeChatPhone === 'broadcast' ? groupNotifs : getClientMessages(activeChatPhone)).length} mensajes
                    </p>
                  </div>
                </div>
                {activeChatPhone !== 'broadcast' && (
                  <div className="flex gap-1.5">
                    <a href={`https://wa.me/${activeChatPhone.replace(/\D/g, '')}`} target="_blank" className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="WhatsApp"><MessageCircle size={14} /></a>
                    <button onClick={handleDeleteConversation} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-2">
                {(activeChatPhone === 'broadcast' ? groupNotifs : getClientMessages(activeChatPhone))
                  .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                  .map(msg => (
                    <div key={msg.id} className={`flex ${msg.tipo === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${msg.tipo === 'admin' ? 'order-2' : ''}`}>
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${msg.tipo === 'admin' ? 'text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}`}
                          style={msg.tipo === 'admin' ? { background: themeColor } : {}}>
                          {msg.imagen_url && <div className="mb-2"><img src={msg.imagen_url} className="w-full max-h-32 object-cover rounded-xl" alt="" /></div>}
                          {msg.titulo && <p className="font-bold mb-1">{msg.titulo}</p>}
                          <p>{msg.mensaje}</p>
                          {msg.link_url && <a href={msg.link_url} target="_blank" className="flex items-center gap-1 mt-1 text-[10px] font-bold opacity-80"><ExternalLink size={9} /> Ver oferta</a>}
                        </div>
                        <p className={`text-[9px] mt-0.5 ${msg.tipo === 'admin' ? 'text-right text-slate-400' : 'text-left text-slate-400'}`}>{msg.fecha}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
              {activeChatPhone !== 'broadcast' && (
                <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                  <input type="text" value={replyMessage} onChange={e => setReplyMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendReply()} placeholder="Escribir..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-xs outline-none focus:border-slate-400" />
                  <button onClick={handleSendReply} disabled={!replyMessage.trim()}
                    className="p-2.5 text-white rounded-full disabled:opacity-50 transition-colors" style={{ background: themeColor }}>
                    <Send size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Selecciona una conversacion</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showProductPicker && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-2xl flex flex-col gap-3 max-h-[70vh]">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase">Vincular Producto</h4>
              <button onClick={() => setShowProductPicker(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input type="text" placeholder="Buscar..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
              {pickerProducts.map(p => (
                <button key={p.id} onClick={() => {
                  setBroadcastTitle(`Oferta: ${p.nombre}`);
                  setBroadcastMessage(`¡No te lo pierdas! Solo $${p.precio_usd.toFixed(2)}`);
                  setBroadcastImage(p.imagen_urls[0] || '');
                  setBroadcastLink(`/?id=${p.id}`);
                  setShowProductPicker(false);
                }} className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-all">
                  <img src={p.imagen_urls[0]} className="w-9 h-9 rounded-lg object-cover border" alt="" />
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block">{p.nombre}</span>
                    <span className="text-[9px] text-slate-500 font-mono">${p.precio_usd}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MensajesSection;
