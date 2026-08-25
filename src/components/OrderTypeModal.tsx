import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UtensilsCrossed, Truck, Store, X, MapPin, ArrowRight } from 'lucide-react';

interface OrderTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'delivery' | 'pickup' | 'mesa') => void;
  themeColor: string;
  cartTotal: number;
  cartItems: number;
  onMesaSelect?: () => void;
}

const ORDER_TYPES = [
  {
    key: 'delivery' as const,
    label: 'Delivery',
    description: 'Te lo llevamos a tu ubicación',
    icon: Truck,
    color: '#3b82f6',
    bgColor: '#3b82f615',
    borderColor: '#3b82f630',
  },
  {
    key: 'pickup' as const,
    label: 'Recoger en Tienda',
    description: 'Pasa a buscar tu pedido',
    icon: Store,
    color: '#8b5cf6',
    bgColor: '#8b5cf615',
    borderColor: '#8b5cf630',
  },
  {
    key: 'mesa' as const,
    label: 'En Mesa',
    description: 'Disfruta aquí en el local',
    icon: UtensilsCrossed,
    color: '#e67e22',
    bgColor: '#e67e2215',
    borderColor: '#e67e2230',
  },
];

export const OrderTypeModal: React.FC<OrderTypeModalProps> = ({
  isOpen, onClose, onSelect, themeColor, cartTotal, cartItems,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1a1c1d]">¿Cómo quieres tu pedido?</h2>
                <p className="text-xs text-[#8f7065] mt-0.5">{cartItems} producto{cartItems !== 1 ? 's' : ''} · ${cartTotal.toFixed(2)}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#eeeef0] transition-colors cursor-pointer">
                <X size={18} className="text-[#8f7065]" />
              </button>
            </div>

            {/* Options */}
            <div className="px-5 pb-5 space-y-3">
              {ORDER_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.key}
                    onClick={() => onSelect(type.key)}
                    className="w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] cursor-pointer flex items-center gap-4 hover:shadow-md group"
                    style={{ borderColor: type.borderColor, backgroundColor: type.bgColor }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: type.color }}
                    >
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1a1c1d]">{type.label}</p>
                      <p className="text-[11px] text-[#8f7065] mt-0.5">{type.description}</p>
                    </div>
                    <ArrowRight size={16} style={{ color: type.color }} className="shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
