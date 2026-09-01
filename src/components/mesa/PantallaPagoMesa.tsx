import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../store/supabaseClient';
import { CheckCircle, Copy, Check, X, Building2 } from 'lucide-react';
import { Order } from '../../types/store';

interface BankAccount {
  id: string;
  banco_nombre: string;
  titular_cuenta: string;
  numero_cuenta: string;
  cedula_rif: string;
  telefono: string;
  tipo_cuenta: string;
  es_principal: boolean;
  notas: string;
}

interface PantallaPagoMesaProps {
  order: Order;
  onPaymentSent: () => void;
  onPayAtRegister: () => void;
  onBack: () => void;
}

const FALLBACK_BANK: BankAccount = {
  id: 'fallback',
  banco_nombre: 'Banesco',
  titular_cuenta: 'Market Coffee Sweet',
  numero_cuenta: '0134-0000-00-0000000000',
  cedula_rif: 'V-33112679',
  telefono: '04123758879',
  tipo_cuenta: 'Corriente',
  es_principal: true,
  notas: ''
};

export const PantallaPagoMesa: React.FC<PantallaPagoMesaProps> = ({
  order, onPaymentSent, onPayAtRegister, onBack
}) => {
  const { config, currentUser } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const mesaColor = '#e67e22';

  const [paymentMethod, setPaymentMethod] = useState<'Pago Móvil' | 'Efectivo' | 'Punto'>('Pago Móvil');
  const [paymentPhone, setPaymentPhone] = useState(currentUser?.telefono || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);

  // Fetch bank accounts from BD
  useEffect(() => {
    const fetchBankAccounts = async () => {
      console.log('[PantallaPago] Fetching bank accounts from BD...');
      try {
        const { data, error } = await supabase.rpc('get_configuracion_pagos_activos');
        if (error) {
          console.error('[PantallaPago] Error RPC get_configuracion_pagos_activos:', error.message);
        }
        if (!error && data && data.length > 0) {
          console.log('[PantallaPago] Bank accounts from BD:', data.length, 'cuentas');
          setBankAccounts(data);
        } else {
          console.warn('[PantallaPago] No bank accounts in BD — using fallback');
          setBankAccounts([FALLBACK_BANK]);
        }
      } catch (err) {
        console.error('[PantallaPago] Exception fetching bank accounts:', err);
        setBankAccounts([FALLBACK_BANK]);
      }
      setLoadingBanks(false);
    };
    fetchBankAccounts();
  }, []);

  const selectedBank = bankAccounts[0] || FALLBACK_BANK;

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
    setValidationError('');
    setIsProcessing(true);

    try {
      const { error } = await supabase.rpc('reportar_pago_movil', {
        p_order_id: order.id,
        p_banco_origen: selectedBank.banco_nombre,
        p_referencia: '',
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
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'Pago Móvil', label: 'Pago Móvil', icon: 'Bs' },
              { key: 'Efectivo', label: 'Efectivo', icon: '$' },
              { key: 'Punto', label: 'Punto de Venta', icon: 'Pt' },
            ].map(pm => (
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
                {/* Datos de la cuenta bancaria seleccionada */}
                {loadingBanks ? (
                  <div className="p-3 text-center text-[10px] text-[#8f7065]">Cargando datos bancarios...</div>
                ) : (
                  <>
                    <div className="p-2 rounded-lg border border-[#e67e22]/30 bg-[#e67e22]/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold uppercase flex items-center gap-1" style={{ color: mesaColor }}>
                          <Building2 size={10} />
                          {selectedBank.banco_nombre}
                        </span>
                        {selectedBank.es_principal && (
                          <span className="text-[8px] px-1 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: mesaColor }}>Principal</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#8f7065]">Titular</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[#1a1c1d] font-bold text-[10px]">{selectedBank.titular_cuenta}</span>
                            <CopyBtn text={selectedBank.titular_cuenta} id="pm-titular" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#8f7065]">Teléfono</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[#1a1c1d] font-bold text-[11px]">{selectedBank.telefono}</span>
                            <CopyBtn text={selectedBank.telefono} id="pm-phone" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#8f7065]">Cédula/RIF</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[#1a1c1d] font-bold text-[11px]">{selectedBank.cedula_rif}</span>
                            <CopyBtn text={selectedBank.cedula_rif} id="pm-ci" />
                          </div>
                        </div>
                        {selectedBank.numero_cuenta && (
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-[#8f7065]">Cuenta</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[#1a1c1d] font-bold text-[10px]">{selectedBank.numero_cuenta}</span>
                              <CopyBtn text={selectedBank.numero_cuenta} id="pm-cuenta" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-center font-black py-1 rounded text-sm" style={{ color: themeColor }}>Monto: {order.total_bs?.toFixed(2)} Bs.</p>
                    <div className="mt-2 pt-2 border-t border-[#e4beb1]/10 p-2 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
                      <p className="text-[10px] text-center font-bold" style={{ color: themeColor }}>Muestre el comprobante de pago en caja para validar su pago</p>
                    </div>
                  </>
                )}
              </div>
            )}
            {paymentMethod === 'Efectivo' && (
              <div className="text-center py-2">
                <p className="text-xs text-[#5b4137] mb-2">Paga en caja al recibir tu pedido</p>
                <p className="font-black text-sm" style={{ color: themeColor }}>Total: ${order.total_usd?.toFixed(2)}</p>
              </div>
            )}
            {paymentMethod === 'Punto' && (
              <div className="text-center py-2">
                <p className="text-xs text-[#5b4137] mb-2">Paga con tu punto de venta en caja</p>
                <p className="font-black text-sm" style={{ color: themeColor }}>Total: ${order.total_usd?.toFixed(2)}</p>
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
          <button onClick={handleSendPayment} disabled={isProcessing}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] cursor-pointer ${isProcessing ? 'opacity-50' : ''}`}
            style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981' }}>
            {isProcessing ? 'Procesando...' : 'Enviar Pago'}
          </button>
        )}
      </div>
    </div>
  );
};
