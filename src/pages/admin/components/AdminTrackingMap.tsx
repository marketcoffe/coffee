import React, { useEffect, useRef, useState } from 'react';
import { Order } from '../../../types/store';

interface LeafletLatLng {
  lat: number;
  lng: number;
}

interface LeafletMarker {
  addTo(map: LeafletMap): LeafletMarker;
  bindPopup(html: string): LeafletMarker;
  on(event: string, handler: () => void): LeafletMarker;
  setIcon(icon: unknown): LeafletMarker;
  setPopupContent(content: string): LeafletMarker;
  setZIndexOffset(offset: number): LeafletMarker;
  getLatLng(): LeafletLatLng;
  openPopup(): void;
}

interface LeafletMap {
  remove(): void;
  removeLayer(layer: LeafletMarker): void;
  setView(center: [number, number] | LeafletLatLng, zoom?: number, options?: object): void;
}

interface LeafletNamespace {
  map(container: HTMLDivElement, options?: object): LeafletMap;
  tileLayer(url: string, options?: object): { addTo(map: LeafletMap): void };
  divIcon(options?: object): unknown;
  marker(latlng: [number, number], options?: object): LeafletMarker;
}

interface AdminTrackingMapProps {
  orders: Order[];
  shopCoords: { lat: number; lng: number };
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  themeColor: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Pendiente': '#F59E0B',
  'Procesando': '#3B82F6',
  'En preparación': '#8B5CF6',
  'Listo': '#22C55E',
  'En camino': '#06B6D4',
  'Entregado': '#6B7280',
  'Cancelado': '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  'Pendiente': 'Pendiente',
  'Procesando': 'Procesando',
  'En preparación': 'En preparación',
  'Listo': 'Listo',
  'En camino': 'En camino',
  'Entregado': 'Entregado',
  'Cancelado': 'Cancelado',
};

export const AdminTrackingMap: React.FC<AdminTrackingMapProps> = ({
  orders,
  shopCoords,
  selectedOrderId,
  onSelectOrder,
  themeColor,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const shopMarkerRef = useRef<LeafletMarker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Wait for Leaflet to load
  useEffect(() => {
    const verifyLeaflet = () => {
      if ((window as unknown as { L?: LeafletNamespace }).L) {
        setMapLoaded(true);
        return true;
      }
      return false;
    };

    if (verifyLeaflet()) return;

    const interval = setInterval(() => {
      if (verifyLeaflet()) clearInterval(interval);
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current) return;

    const L = (window as unknown as { L?: LeafletNamespace }).L;
    if (!L) return;

    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch {}
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [shopCoords.lat, shopCoords.lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Shop marker
    const shopIcon = L.divIcon({
      html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
        <span style="position:absolute;width:32px;height:32px;border-radius:50%;background:${themeColor};opacity:0.25;animation:pulse 2s infinite"></span>
        <div style="width:28px;height:28px;border-radius:50%;background:${themeColor};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </div>
      </div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    shopMarkerRef.current = L.marker([shopCoords.lat, shopCoords.lng], { icon: shopIcon })
      .addTo(map)
      .bindPopup('<b style="font-size:12px">Tu Tienda</b>');

    return () => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, [mapLoaded, shopCoords, themeColor]);

  // Update order markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = (window as unknown as { L?: LeafletNamespace }).L;
    if (!L) return;

    const map = mapInstanceRef.current;
    const currentMarkers = markersRef.current;

    // Remove markers for orders no longer in the list
    const orderIds = new Set(orders.map(o => o.id));
    currentMarkers.forEach((marker, id) => {
      if (!orderIds.has(id)) {
        map.removeLayer(marker);
        currentMarkers.delete(id);
      }
    });

    // Add/update markers for each order
    orders.forEach(order => {
      if (!order.lat || !order.lng) return;

      const color = STATUS_COLORS[order.status] || '#6B7280';
      const isSelected = order.id === selectedOrderId;
      const size = isSelected ? 36 : 28;
      const pulseAnimation = order.status === 'En camino' ? 'animation:pulse 2s infinite;' : '';

      const icon = L.divIcon({
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer">
          ${isSelected ? `<span style="position:absolute;width:${size + 12}px;height:${size + 12}px;border-radius:50%;background:${color};opacity:0.2;${pulseAnimation}"></span>` : ''}
          <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;transition:all 0.2s">
            <span style="color:white;font-size:9px;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,0.3);line-height:1">#${order.id}</span>
          </div>
        </div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const popupContent = `
        <div style="min-width:160px;font-family:system-ui,sans-serif">
          <div style="font-weight:900;font-size:13px;color:#1e293b;margin-bottom:4px">#${order.id}</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:6px">${order.cliente_nombre}</div>
          <div style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:700;background:${color}20;color:${color};margin-bottom:6px">${STATUS_LABELS[order.status] || order.status}</div>
          <div style="font-size:11px;color:#475569;margin-bottom:2px">📍 ${order.direccion_envio || 'Sin dirección'}</div>
          <div style="font-size:11px;color:#475569">💲 $${order.total_usd?.toFixed(2) || '0.00'} · ${order.metodo_pago}</div>
        </div>
      `;

      if (currentMarkers.has(order.id)) {
        // Update existing marker
        const marker = currentMarkers.get(order.id);
        if (!marker) return;
        marker.setIcon(icon);
        marker.setPopupContent(popupContent);
        if (isSelected) {
          marker.setZIndexOffset(1000);
        }
      } else {
        // Create new marker
        const marker = L.marker([order.lat, order.lng], { icon })
          .addTo(map)
          .bindPopup(popupContent)
          .on('click', () => onSelectOrder(order.id));
        
        currentMarkers.set(order.id, marker);
      }
    });
  }, [orders, selectedOrderId, onSelectOrder]);

  // Pan to selected order
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedOrderId) return;
    const marker = markersRef.current.get(selectedOrderId);
    if (marker) {
      mapInstanceRef.current.setView(marker.getLatLng(), 15, { animate: true });
      marker.openPopup();
    }
  }, [selectedOrderId]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500">Cargando mapa...</span>
          </div>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl p-2.5 shadow-lg border border-slate-200">
        <div className="flex flex-col gap-1">
          {['Pendiente', 'Procesando', 'En preparación', 'Listo', 'En camino'].map(status => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
              <span className="text-[9px] text-slate-600 font-medium">{STATUS_LABELS[status]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
