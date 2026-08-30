import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, PartyPopper, Copy, Check } from 'lucide-react';

interface PointsEarnedModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: number;
  newBalance?: number;
  reason?: string;
  themeColor?: string;
  couponCode?: string;
}

export const PointsEarnedModal: React.FC<PointsEarnedModalProps> = ({
  isOpen,
  onClose,
  points,
  newBalance,
  reason,
  themeColor = '#FF6B35',
  couponCode,
}) => {
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  const handleCopyCoupon = async () => {
    if (!couponCode) return;
    try {
      await navigator.clipboard.writeText(couponCode);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = couponCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };
  useEffect(() => {
    if (isOpen) {
      console.log('[PointsModal] Opening', { points, newBalance, reason });
      import('canvas-confetti').then((mod) => {
        const confetti = (mod as any).default || mod;
        const fire = () => {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          confetti({ particleCount: 40, spread: 120, startVelocity: 30, origin: { y: 0.6 }, ticks: 80 });
        };
        fire();
        const t = setTimeout(fire, 400);
        return () => clearTimeout(t);
      }).catch((err) => console.error('[PointsModal] confetti load error:', err));
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 18, stiffness: 300 }}
            className="bg-white rounded-3xl shadow-2xl p-6 mx-4 max-w-xs w-full text-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative background circles */}
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10" style={{ background: themeColor }} />
            <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-10" style={{ background: themeColor }} />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors z-10"
            >
              <X size={14} className="text-gray-400" />
            </button>

            {/* Icon */}
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mb-3 w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: themeColor + '15' }}
            >
              <PartyPopper size={32} style={{ color: themeColor }} />
            </motion.div>

            {/* Title */}
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg font-black text-[#1a1c1d] mb-1"
            >
              ¡Puntos Ganados!
            </motion.h3>

            {/* Points */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.4 }}
              className="flex items-center justify-center gap-2 mb-2"
            >
              <Star size={20} className="text-amber-400 fill-amber-400" />
              <span className="text-3xl font-black" style={{ color: themeColor }}>
                +{points}
              </span>
              <span className="text-sm font-bold text-gray-500">pts</span>
            </motion.div>

            {/* Reason */}
            {reason && (
              <p className="text-xs text-[#8f7065] mb-3">{reason}</p>
            )}

            {/* New balance */}
            {newBalance !== undefined && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-[#f9f9fb] rounded-xl px-4 py-2.5 mb-4"
              >
                <p className="text-[10px] text-[#8f7065] uppercase font-bold mb-0.5">Saldo actual</p>
                <p className="text-lg font-black" style={{ color: themeColor }}>
                  {newBalance} <span className="text-xs font-bold text-gray-400">puntos</span>
                </p>
              </motion.div>
            )}

            {/* Coupon code from redemption */}
            {couponCode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65 }}
                className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4"
              >
                <p className="text-[10px] text-amber-700 uppercase font-bold mb-1.5">Tu cupón de descuento</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-black font-mono tracking-widest text-amber-700">{couponCode}</span>
                  <button
                    onClick={handleCopyCoupon}
                    className="p-1.5 rounded-lg transition-all active:scale-95"
                    style={{ backgroundColor: copiedCoupon ? '#10B981' : themeColor, color: '#fff' }}
                  >
                    {copiedCoupon ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 mt-1.5">Cópialo y úsalo en tu próximo pedido</p>
              </motion.div>
            )}

            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.97]"
              style={{ backgroundColor: themeColor }}
            >
              ¡Genial!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
