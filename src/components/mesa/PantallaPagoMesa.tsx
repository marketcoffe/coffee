import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../store/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle, Clock, CreditCard, Banknote, Smartphone, ArrowRight, Copy, Check, X
} from 'lucide-react';
import { Order } from '../../types/store';

interface PantallaPagoMesaProps {
  order: Order;
  onPaymentSent: () => void;
  onPayAtRegister: () => void;
  onBack: () => void;
}

interface BankConfig {
  id: string;
  banco_nombre: string;
  titular_cuenta: string;
  numero_cuenta: string;
  cedula_rif: string;
  telefono: string;
  tipo_cuenta: string;
  activo: boolean;
  es_principal: boolean;
  notas: string;
}

export const PantallaPagoMesa: React.FC<PantallaPagoMesaProps> = ({
  order, onPaymentSent, onPayAtRegister, onBack
}) => {
  const { config, currentUser } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const mesaColor = '#e67e22';

  const [paymentMethod, setPaymentMethod] = useState<'Pago Móvil' | 'Efectivo' | 'Punto' | 'Zelle' | 'Transferencia'>('Pago Móvil');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentPhone, setPaymentPhone] = useState(currentUser?.telefono || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bankConfigs, setBankConfigs] = useState<BankConfig[]>([]);

  useEffect(() => {
    const fetchBankData = async () => {
      const { data } = await supabase.from('configuracion_pagos')
        .select('*')
        .eq('activo', true)
        .order('es_principal', { ascending: false });
      if (data) setBankConfigs(data);
    };
    fetchBankData();
  }, []);

  const handleCopy = async (text: string, fieldId: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyBtn: React.FC<{ text: string; id: string }> = ({ text, id }) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); handleCopy(text, id); }}
      className="shrink-0 p-1 rounded hover:bg-[#e2e2e4] transition-colors cursor-pointer">
      {copiedField === id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-[#8f7065]" />}
    </button>
  );

  const handleSendPayment = async () => {
    if (paymentMethod === 'Pago Móvil' && (!paymentBank || !paymentReference.trim())) {
      setValidationError('Completa el banco emisor y la referencia de pago.');
      return;
    }
    if ((paymentMethod === 'Zelle' || paymentMethod === 'Transferencia') && !paymentReference.trim()) {
      setValidationError('Ingresa la referencia de pago.');
      return;
    }
    setValidationError('');
    setIsProcessing(true);

    try {
      const { error } = await supabase.rpc('reportar_pago_movil', {
        p_order_id: order.id,
        p_banco_origen: paymentBank,
        p_referencia: paymentReference,
        p_telefono_emisor: paymentPhone || order.cliente_telefono,
        p_monto: order.total_usd
      });

      if (error) {
        setValidationError('Error al enviar los datos de pago.');
        setIsProcessing(false);
        return;
      }

      onPaymentSent();
    } catch {
      setValidationError('Error al enviar los datos de pago.');
    }
    setIsProcessing(false);
  };

  const handlePayAtRegister = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('registrar_pago_en_caja', { p_order_id: order.id });
      if (!error) onPayAtRegister();
    } catch {}
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ backgroundColor: '#f9f9fb' }}>
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20" style={{ backgroundColor: 'rgba(249,249,251,0.8)', backdropFilter: 'blur(20px)', borderColor: '#e4beb1/10' }}>
        <button onClick={onBack} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#eeeef0] transition-colors cursor-pointer" style={{ backgroundColor: '#eeeef0' }}>
          <X size={18} className="text-[#1a1c1d]" />
        </button>
        <div className="flex-1">
          <h1 className="text-[16px] font-bold text-[#1a1c1d]">Método de Pago</h1>
          <p className="text-[11px] text-[#8f7065]">Selecciona cómo vas a cancelar</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-28">
        {/* Confirmación de envío */}
        <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-5 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10b98115' }}>
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-base font-bold text-[#1a1c1d] mb-1">¡Pedido Enviado a Cocina!</h2>
          <p className="text-xs text-[#8f7065] mb-3">Tu pedido se está preparando. Ahora selecciona cómo vas a pagar.</p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: `${mesaColor}15` }}>
            <span className="text-xs font-bold" style={{ color: mesaColor }}>Mesa #{order.numero_mesa || '?'}</span>
          </div>
        </div>

        {/* Resumen del pedido */}
        <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8f7065] mb-3">Detalle del Pedido</h3>
          <div className="space-y-2 mb-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-[#5b4137]">
                  <span className="font-bold">{item.cantidad}x</span> {item.nombre}
                  {item.selected_options && item.selected_options.length > 0 && (
                    <span className="text-[#8f7065] ml-1">({item.selected_options.map(o => o.option_name).join(', ')})</span>
                  )}
                </span>
                <span className="font-bold text-[#1a1c1d]">${((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
            <span className="text-xs font-bold text-[#1a1c1d]">Total a Pagar:</span>
            <div className="text-right">
              <span className="font-black text-lg" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
              <span className="text-[10px] text-[#8f7065] ml-1">{order.total_bs?.toFixed(2)} Bs.</span>
            </div>
          </div>
        </div>

        {/* Método de pago */}
        <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1d] mb-3">Método de Pago</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'Pago Móvil', label: 'Pago Móvil Bs', icon: 'Bs', enabled: config.pagomovil_enabled },
              { key: 'Efectivo', label: 'Efectivo', icon: '$', enabled: config.efectivo_enabled },
              { key: 'Punto', label: 'Punto de Venta', icon: 'Pt', enabled: true },
              { key: 'Zelle', label: 'Zelle USD', icon: 'USD', enabled: config.zelle_enabled },
              { key: 'Transferencia', label: 'Transferencia', icon: 'Bco', enabled: config.transferencia_enabled },
            ].filter(pm => pm.enabled).map(pm => (
              <button key={pm.key} onClick={() => setPaymentMethod(pm.key as typeof paymentMethod)}
                className={`p-3 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer border-2 text-xs ${
                  paymentMethod === pm.key ? 'text-white shadow-md' : 'bg-[#f9f9fb] border-[#e4beb1]/10 text-[#5b4137] hover:bg-[#eeeef0]'
                }`}
                style={paymentMethod === pm.key ? { backgroundColor: mesaColor, borderColor: mesaColor } : {}}>
                <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-white/20 shrink-0">{pm.icon}</span>
                <span className="font-bold">{pm.label}</span>
              </button>
            ))}
          </div>

          {/* Formulario de pago según método */}
          <div className="mt-3 p-3 bg-[#f9f9fb] border border-[#e4beb1]/10 rounded-xl">
            {paymentMethod === 'Pago Móvil' && (
              <div className="flex flex-col gap-2">
                {bankConfigs.length > 0 && bankConfigs.map((bank) => (
                  <div key={bank.id} className={`p-2 rounded-lg border ${bank.es_principal ? 'border-[#e67e22]/30 bg-[#e67e22]/5' : 'border-[#e4beb1]/10 bg-white'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold uppercase" style={{ color: bank.es_principal ? mesaColor : '#8f7065' }}>{bank.banco_nombre}</span>
                      {bank.es_principal && <span className="text-[8px] px-1 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: mesaColor }}>Principal</span>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Titular</span>
                        <span className="text-[#1a1c1d] font-bold text-[11px]">{bank.titular_cuenta}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Cuenta</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#1a1c1d] font-bold text-[11px] font-mono">{bank.numero_cuenta}</span>
                          <CopyBtn text={bank.numero_cuenta} id={`pm-account-${bank.id}`} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Teléfono</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#1a1c1d] font-bold text-[11px]">{bank.telefono}</span>
                          <CopyBtn text={bank.telefono} id={`pm-phone-${bank.id}`} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Cédula/RIF</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#1a1c1d] font-bold text-[11px]">{bank.cedula_rif}</span>
                          <CopyBtn text={bank.cedula_rif} id={`pm-ci-${bank.id}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {bankConfigs.length === 0 && (
                  <p className="text-xs text-[#8f7065] text-center py-2">No hay datos bancarios configurados</p>
                )}
                <p className="text-center font-black py-1 rounded text-sm" style={{ color: themeColor }}>Monto: {order.total_bs?.toFixed(2)} Bs.</p>
                <div className="space-y-2 mt-2 pt-2 border border-[#e4beb1]/10 rounded-xl p-3">
                  <div>
                    <label className="text-[9px] text-[#8f7065] uppercase block mb-1">Banco Emisor *</label>
                    <select value={paymentBank} onChange={(e) => setPaymentBank(e.target.value)} className="w-full bg-white border border-[#e4beb1]/10 rounded-lg px-3 py-2 text-xs outline-none font-bold text-[#1a1c1d] appearance-none cursor-pointer">
                      <option value="">Seleccionar banco</option>
                      {bankConfigs.map((bank) => (
                        <option key={bank.id} value={bank.banco_nombre}>{bank.banco_nombre}</option>
                      ))}
                      <option value="Banesco">Banesco (0134)</option>
                      <option value="Mercantil">Mercantil (0102)</option>
                      <option value="Venezuela">Banco de Venezuela (0102)</option>
                      <option value="Provincial">Provincial (0108)</option>
                      <option value="Bancaribe">Bancaribe (0114)</option>
                      <option value="Exterior">Banco Exterior (0115)</option>
                      <option value="Nacional">Nacional de Crédito (0191)</option>
                      <option value="BOD">BOD (0128)</option>
                      <option value="Plaza">Banco Plaza (0138)</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#8f7065] uppercase block mb-1">Referencia de Pago *</label>
                    <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Ej: 1234567890" className="w-full bg-white border border-[#e4beb1]/10 rounded-lg px-3 py-2 text-xs outline-none font-bold text-[#1a1c1d]" />
                  </div>
                </div>
              </div>
            )}
            {paymentMethod === 'Efectivo' && (
              <div className="text-center py-2">
                <p className="text-xs text-[#5b4137] mb-2">{config.efectivo_data || 'Paga en caja al recibir tu pedido'}</p>
                <p className="font-black text-sm" style={{ color: themeColor }}>Total: ${order.total_usd?.toFixed(2)}</p>
              </div>
            )}
            {paymentMethod === 'Punto' && (
              <div className="text-center py-2">
                <p className="text-xs text-[#5b4137] mb-2">Paga con tu punto de venta en caja</p>
                <p className="font-black text-sm" style={{ color: themeColor }}>Total: ${order.total_usd?.toFixed(2)}</p>
              </div>
            )}
            {paymentMethod === 'Zelle' && (
              <div className="flex flex-col gap-2">
                {bankConfigs.filter(b => b.banco_nombre.toLowerCase().includes('zelle') || b.notas?.toLowerCase().includes('zelle')).length > 0 ? (
                  bankConfigs.filter(b => b.banco_nombre.toLowerCase().includes('zelle') || b.notas?.toLowerCase().includes('zelle')).map((bank) => (
                    <div key={bank.id} className="p-2 rounded-lg border border-[#e4beb1]/10 bg-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold uppercase text-[#8f7065]">{bank.banco_nombre}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Correo / Cuenta</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#1a1c1d] font-bold text-[11px]">{bank.numero_cuenta}</span>
                          <CopyBtn text={bank.numero_cuenta} id={`zelle-${bank.id}`} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#e4beb1]/10">
                    <div>
                      <span className="text-[9px] text-[#8f7065] uppercase block">Correo Zelle</span>
                      <span className="text-[#1a1c1d] font-bold text-xs">{config.zelle_data || 'pagos@email.com'}</span>
                    </div>
                    <CopyBtn text={config.zelle_data || 'pagos@email.com'} id="zelle-email" />
                  </div>
                )}
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#e4beb1]/10">
                  <div>
                    <span className="text-[9px] text-[#8f7065] uppercase block">Monto a enviar</span>
                    <span className="font-black text-sm" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)} USD</span>
                  </div>
                  <CopyBtn text={`$${order.total_usd?.toFixed(2)}`} id="zelle-amount" />
                </div>
                <div className="mt-2 pt-2 border-t border-[#e4beb1]/10">
                  <label className="text-[9px] text-[#8f7065] uppercase block mb-1">Referencia / Nota Zelle</label>
                  <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Ej: Confirmación Zelle" className="w-full bg-white border border-[#e4beb1]/10 rounded-lg px-3 py-2 text-xs outline-none font-bold text-[#1a1c1d]" />
                </div>
              </div>
            )}
            {paymentMethod === 'Transferencia' && (
              <div className="flex flex-col gap-2">
                {bankConfigs.length > 0 && bankConfigs.map((bank) => (
                  <div key={bank.id} className={`p-2 rounded-lg border ${bank.es_principal ? 'border-[#e67e22]/30 bg-[#e67e22]/5' : 'border-[#e4beb1]/10 bg-white'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold uppercase" style={{ color: bank.es_principal ? mesaColor : '#8f7065' }}>{bank.banco_nombre}</span>
                      {bank.es_principal && <span className="text-[8px] px-1 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: mesaColor }}>Principal</span>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Titular</span>
                        <span className="text-[#1a1c1d] font-bold text-[11px]">{bank.titular_cuenta}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Cuenta</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#1a1c1d] font-bold text-[11px] font-mono">{bank.numero_cuenta}</span>
                          <CopyBtn text={bank.numero_cuenta} id={`transfer-${bank.id}`} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#8f7065]">Cédula/RIF</span>
                        <span className="text-[#1a1c1d] font-bold text-[11px]">{bank.cedula_rif}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {bankConfigs.length === 0 && (
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#e4beb1]/10">
                    <div>
                      <span className="text-[9px] text-[#8f7065] uppercase block">Datos Bancarios</span>
                      <span className="text-[#1a1c1d] font-bold text-xs">{config.transferencia_data || `Banesco - ${config.site_nombre}`}</span>
                    </div>
                    <CopyBtn text={config.transferencia_data || `Banesco - ${config.site_nombre}`} id="transfer-data" />
                  </div>
                )}
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#e4beb1]/10">
                  <div>
                    <span className="text-[9px] text-[#8f7065] uppercase block">Monto</span>
                    <span className="font-black text-sm" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)} USD</span>
                  </div>
                  <CopyBtn text={`$${order.total_usd?.toFixed(2)}`} id="transfer-amount" />
                </div>
                <div className="mt-2 pt-2 border-t border-[#e4beb1]/10">
                  <label className="text-[9px] text-[#8f7065] uppercase block mb-1">Referencia</label>
                  <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Ej: 1234567890" className="w-full bg-white border border-[#e4beb1]/10 rounded-lg px-3 py-2 text-xs outline-none font-bold text-[#1a1c1d]" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Número de pedido */}
        <div className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 text-center">
          <p className="text-[10px] font-bold uppercase text-[#8f7065] mb-1">Tu número de pedido</p>
          <p className="text-lg font-black text-[#1a1c1d] font-mono">{order.id}</p>
          {order.ticket_code && (
            <p className="text-xs font-bold mt-1" style={{ color: mesaColor }}>{order.ticket_code}</p>
          )}
        </div>
      </div>

      {/* Bottom button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4beb1]/10 p-4 z-20">
        {validationError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 text-center">{validationError}</div>
        )}
        {(paymentMethod === 'Efectivo' || paymentMethod === 'Punto') ? (
          <button onClick={handlePayAtRegister} disabled={isProcessing}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer ${isProcessing ? 'opacity-50' : ''}`}
            style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981' }}>
            {isProcessing ? 'Procesando...' : 'Pagar en Caja'}
          </button>
        ) : (
          <button onClick={handleSendPayment} disabled={isProcessing || (paymentMethod === 'Pago Móvil' && (!paymentBank || !paymentReference.trim()))}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer ${isProcessing ? 'opacity-50' : ''}`}
            style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981' }}>
            {isProcessing ? 'Procesando...' : 'Enviar Pago'}
          </button>
        )}
      </div>
    </div>
  );
};
