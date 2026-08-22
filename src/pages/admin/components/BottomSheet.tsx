import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function BottomSheet({ open, onClose, title, children, className = '' }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end lg:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`relative w-full bg-white bottom-sheet lg:max-w-lg lg:mx-auto lg:my-auto lg:rounded-xl lg:shadow-2xl ${className}`}
        style={{
          maxHeight: '85vh',
          animation: 'slideUpPop 0.3s ease-out',
          borderRadius: '16px 16px 0 0',
        }}
      >
        <div className="bottom-sheet-handle" />
        {title && (
          <div className="flex items-center justify-between px-4 pt-3 pb-2 sticky top-0 bg-white z-10" style={{ borderBottom: '1px solid var(--erp-card-border)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--ios-text)' }}>{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--ios-text-secondary)' }}>
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
