import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Download, Star, ShoppingBag, Gift } from 'lucide-react';
import { Order } from '../../types/store';
import { useApp } from '../../store/AppContext';

interface OrderSuccessStepProps {
  order: Order;
  onContinueShopping: () => void;
  onClose: () => void;
}

export const OrderSuccessStep: React.FC<OrderSuccessStepProps> = ({
  order, onContinueShopping, onClose
}) => {
  const { config } = useApp();
  const themeColor = config.theme_color || '#A4D045';
  const mesaColor = '#e67e22';
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] items-center justify-center p-6" style={{ backgroundColor: '#f9f9fb' }}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="w-full max-w-sm"
      >
        {/* Success icon */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 10 }}
            className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#10b98115' }}
          >
            <CheckCircle size={48} className="text-emerald-500" />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl font-bold text-[#1a1c1d] mb-2"
          >
            ¡Gracias por tu compra!
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-[#8f7065]"
          >
            Tu pedido {order.id} ha sido procesado exitosamente.
          </motion.p>
        </div>

        {/* Order details */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl border border-[#e4beb1]/10 p-4 mb-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: mesaColor }}>
              <span className="text-sm font-bold">#{order.numero_mesa}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#1a1c1d]">Mesa #{order.numero_mesa}</p>
              <p className="text-[11px] text-[#8f7065]">{order.nombre_cliente || order.cliente_nombre}</p>
            </div>
          </div>
          <div className="border-t border-[#e4beb1]/10 pt-2 flex justify-between items-center">
            <span className="text-xs font-bold text-[#1a1c1d]">Total:</span>
            <div className="text-right">
              <span className="font-black text-lg" style={{ color: themeColor }}>${order.total_usd?.toFixed(2)}</span>
              <span className="text-[10px] text-[#8f7065] ml-1">{order.total_bs?.toFixed(2)} Bs.</span>
            </div>
          </div>
        </motion.div>

        {/* PWA Install CTA */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-[#fff9f7] to-[#fff3ee] rounded-2xl border border-[#e4beb1]/20 p-5 mb-4"
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${themeColor}20` }}>
              <Download size={20} style={{ color: themeColor }} />
            </div>
            <h3 className="text-sm font-bold text-[#1a1c1d] mb-1">Descarga nuestra App</h3>
            <p className="text-xs text-[#8f7065] leading-relaxed mb-3">
              Te invitamos a descargar nuestra App (PWA) para que disfrutes de <span className="font-bold" style={{ color: themeColor }}>beneficios exclusivos</span>, acumules <span className="font-bold" style={{ color: themeColor }}>puntos de fidelidad</span> y también puedas realizar tus pedidos cómodamente desde casa.
            </p>
            {showInstallButton && (
              <button
                onClick={handleInstall}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: themeColor }}
              >
                <Download size={16} />
                Descargar App
              </button>
            )}
            {!showInstallButton && (
              <div className="flex items-center justify-center gap-4 text-[10px] text-[#8f7065]">
                <div className="flex items-center gap-1"><Gift size={12} style={{ color: themeColor }} /> Beneficios</div>
                <div className="flex items-center gap-1"><Star size={12} style={{ color: themeColor }} /> Puntos</div>
                <div className="flex items-center gap-1"><ShoppingBag size={12} style={{ color: themeColor }} /> Pedidos</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
          className="space-y-2"
        >
          <button
            onClick={onContinueShopping}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] cursor-pointer"
            style={{ backgroundColor: themeColor }}
          >
            Seguir Comprando
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm bg-[#eeeef0] text-[#5b4137] transition-all active:scale-[0.98] cursor-pointer"
          >
            Volver al Inicio
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};
