import React from 'react';
import { Home, Search } from 'lucide-react';

interface NotFoundProps {
  onGoHome: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onGoHome }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#F8F6F0' }}>
      <div className="text-center max-w-md">
        {/* Ilustración 404 */}
        <div className="relative mb-8">
          <div className="text-[120px] md:text-[160px] font-black leading-none" style={{ color: '#6E472A', opacity: 0.15 }}>
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6E472A' }}>
              <Search size={32} className="text-white" />
            </div>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: '#2B1E16' }}>
          Página no encontrada
        </h1>

        {/* Descripción */}
        <p className="text-sm md:text-base mb-8 leading-relaxed" style={{ color: '#6E472A' }}>
          Lo sentimos, la página que buscas no existe o fue movida. Puedes volver al inicio para seguir explorando nuestros productos.
        </p>

        {/* Botón volver al inicio */}
        <button
          onClick={onGoHome}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#6E472A' }}
        >
          <Home size={18} />
          Volver al Inicio
        </button>

        {/* Info de contacto */}
        <div className="mt-10 pt-6 border-t" style={{ borderColor: '#d4c4b0' }}>
          <p className="text-xs" style={{ color: '#6E472A' }}>
            Si crees que es un error, contáctanos por WhatsApp o visita nuestro local en C. Apolo, Valencia.
          </p>
        </div>
      </div>
    </div>
  );
};
