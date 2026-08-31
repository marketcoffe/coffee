import React, { useState, useCallback } from 'react';
import { useApp } from '../../../../store/AppContext';
import { useToast } from '../../../../components/Toast';
import { supabase } from '../../../../store/supabaseClient';
import { FoodItem } from '../../../../types/store';
import { uploadImage } from '../../../../store/storageService';
import {
  Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, Database
} from 'lucide-react';

interface AdminProductManagerProps {
  onEdit: (product: FoodItem) => void;
  onCreate: () => void;
}

/**
 * Estado de conexión del sistema con Supabase.
 * Muestra indicador visual en el panel admin.
 */
const ConnectionBadge: React.FC<{ status: 'checking' | 'connected' | 'mock' | 'error'; onRetry: () => void }> = ({ status, onRetry }) => {
  const configs = {
    checking: { icon: <RefreshCw size={12} className="animate-spin" />, label: 'Verificando...', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    connected: { icon: <CheckCircle size={12} />, label: 'Supabase Conectado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    mock: { icon: <AlertTriangle size={12} />, label: 'Modo Local (Mock)', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    error: { icon: <WifiOff size={12} />, label: 'Error de Conexión', color: 'bg-red-100 text-red-700 border-red-200' },
  };
  const config = configs[status];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${config.color}`}>
      {config.icon}
      {config.label}
      {(status === 'mock' || status === 'error') && (
        <button onClick={onRetry} className="ml-1 underline cursor-pointer hover:no-underline">Reintentar</button>
      )}
    </div>
  );
};

/**
 * AdminProductManager: Componente wrapper que gestiona la conectividad
 * del módulo de productos con Supabase.
 *
 * Proporciona:
 * - Indicador de estado de conexión en tiempo real
 * - Verificación de buckets de Storage
 * - Upload de imágenes centralizado via storageService
 * - Wrapping seguro de addFoodItem/updateFoodItem con manejo de errores
 */
const AdminProductManager = ({ onEdit, onCreate }: AdminProductManagerProps) => {
  const { addFoodItem, updateFoodItem, config } = useApp();
  const { showToast } = useToast();
  const themeColor = config.theme_color || '#A4D045';
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'mock' | 'error'>('checking');

  const checkConnection = useCallback(async () => {
    setConnectionStatus('checking');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setConnectionStatus('mock');
        return;
      }

      const { error } = await supabase.from('store_config').select('id').limit(1);
      if (error) {
        console.error('[AdminProductManager] Connection test failed:', error.message);
        setConnectionStatus('error');
      } else {
        setConnectionStatus('connected');
      }
    } catch (err) {
      console.error('[AdminProductManager] Connection check error:', err);
      setConnectionStatus('mock');
    }
  }, []);

  React.useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleSaveProduct = useCallback(async (productData: Partial<FoodItem>) => {
    try {
      if (productData.id) {
        await updateFoodItem(productData.id, productData);
      } else {
        await addFoodItem(productData as Omit<FoodItem, 'id'>);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || 'Error desconocido al guardar';
      if (msg.includes('new row') && msg.includes('violates row-level security')) {
        showToast('error', 'Error de permisos: Ejecuta el script SQL 00_fix_system_connectivity_and_rls.sql en tu panel de Supabase');
      } else {
        showToast('error', `Error al guardar: ${msg}`);
      }
      throw err;
    }
  }, [addFoodItem, updateFoodItem, showToast]);

  return {
    connectionBadge: <ConnectionBadge status={connectionStatus} onRetry={checkConnection} />,
    handleSaveProduct,
    checkConnection,
    connectionStatus,
    uploadImage,
  };
};

export default AdminProductManager;
export { ConnectionBadge };
