import React from 'react';
import { Truck, Check } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';
import { useApp } from '../store/AppContext';

interface FreeDeliveryBarProps {
  currentTotal: number;
  threshold: number;
  themeColor: string;
}

export const FreeDeliveryBar: React.FC<FreeDeliveryBarProps> = ({
  currentTotal,
  threshold,
  themeColor,
}) => {
  const { isDarkMode } = useApp();
  if (!threshold || threshold <= 0) return null;

  const isFree = currentTotal >= threshold;
  const remaining = Math.max(0, threshold - currentTotal);
  const progress = Math.min(100, (currentTotal / threshold) * 100);

  const bgColor = isDarkMode ? '#0a0a0a' : '#f9f9fb';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(228,190,177,0.1)';
  const textColor = isDarkMode ? '#8b8ba3' : '#5b4137';
  const subTextColor = isDarkMode ? '#6b6b85' : '#8f7065';
  const barBg = isDarkMode ? '#1a1a1a' : '#e8e8ea';

  return (
    <div className="px-4 py-2.5 transition-all duration-300 border-b"
      style={{
        backgroundColor: isFree ? (isDarkMode ? '#0a2e1a' : '#ecfdf5') : bgColor,
        borderColor: isFree ? (isDarkMode ? 'rgba(16,185,129,0.2)' : '#d1fae5') : borderColor,
      }}>
      <div className="flex items-center gap-2">
        {isFree ? (
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-white" strokeWidth={3} />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${themeColor}15` }}>
            <Truck size={12} style={{ color: themeColor }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {isFree ? (
            <p className="text-[11px] font-bold text-emerald-500">
              ¡Tienes delivery gratis!
            </p>
          ) : (
            <p className="text-[11px] font-semibold" style={{ color: textColor }}>
              Te faltan <span className="font-black" style={{ color: themeColor }}>${remaining.toFixed(2)}</span> para delivery gratis
            </p>
          )}
        </div>
        {!isFree && (
          <span className="text-[10px] font-bold" style={{ color: subTextColor }}>
            <AnimatedCounter target={Math.round(progress)} suffix="%" duration={800} />
          </span>
        )}
      </div>
      {!isFree && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: barBg }}>
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)`,
            }}
          />
        </div>
      )}
    </div>
  );
};
