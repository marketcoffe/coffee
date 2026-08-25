import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, UtensilsCrossed } from 'lucide-react';
import { Order } from '../../types/store';
import { useApp } from '../../store/AppContext';

interface TicketDigitalModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const TicketDigitalModal: React.FC<TicketDigitalModalProps> = ({ order, isOpen, onClose }) => {
  const { config } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const mesaColor = '#e67e22';
  const [copied, setCopied] = useState(false);

  const ticketCode = order.ticket_code || `#M-${order.numero_mesa || '?'}`;
  const shortId = order.id.slice(-8);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ticketCode);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = ticketCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 text-center border-b border-[#e4beb1]/10">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: `${mesaColor}15` }}>
              <UtensilsCrossed size={24} style={{ color: mesaColor }} />
            </div>
            <h2 className="text-base font-bold text-[#1a1c1d]">Tu Ticket Digital</h2>
            <p className="text-xs text-[#8f7065] mt-1">Muestra este código en caja</p>
          </div>

          {/* Ticket code */}
          <div className="p-5">
            <div className="bg-[#f9f9fb] rounded-2xl border border-[#e4beb1]/10 p-5 text-center">
              <p className="text-[10px] font-bold uppercase text-[#8f7065] mb-2">Código de Ticket</p>
              <p className="text-3xl font-black font-mono tracking-wider" style={{ color: mesaColor }}>
                {ticketCode}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                  style={{ backgroundColor: `${mesaColor}15`, color: mesaColor }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '¡Copiado!' : 'Copiar Código'}
                </button>
              </div>
            </div>

            {/* Order summary */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8f7065]">Pedido:</span>
                <span className="font-bold text-[#1a1c1d] font-mono">{shortId}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8f7065]">Mesa:</span>
                <span className="font-bold text-[#1a1c1d]">#{order.numero_mesa}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8f7065]">Cliente:</span>
                <span className="font-bold text-[#1a1c1d]">{order.nombre_cliente || order.cliente_nombre}</span>
              </div>
              <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-[#1a1c1d]">Total:</span>
                <span className="font-black text-lg" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[10px] text-[#8f7065] text-center mt-4 leading-relaxed">
              Presenta este código al personal de caja para que puedan validar y procesar tu pago rápidamente.
            </p>
          </div>

          {/* Close button */}
          <div className="p-4 border-t border-[#e4beb1]/10">
            <button onClick={onClose} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] cursor-pointer" style={{ backgroundColor: themeColor }}>
              Entendido
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
