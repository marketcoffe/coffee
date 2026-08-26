import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Info, ArrowRight } from 'lucide-react';
import { DeliveryZone } from '../types/store';

interface LeafletLatLng {
  lat: number;
  lng: number;
}

interface LeafletMarker {
  addTo(map: LeafletMap): LeafletMarker;
  bindPopup(html: string): LeafletMarker;
  on(event: string, handler: (e: { target: LeafletMarker }) => void): LeafletMarker;
  getLatLng(): LeafletLatLng;
  setLatLng(latlng: [number, number]): LeafletMarker;
}

interface LeafletMap {
  on(event: string, handler: (e: { latlng: LeafletLatLng }) => void): void;
  remove(): void;
  invalidateSize(): void;
}

interface LeafletPolyline {
  addTo(map: LeafletMap): LeafletPolyline;
  setLatLngs(latlngs: [number, number][]): void;
}

interface LeafletNamespace {
  map(container: HTMLDivElement, options?: object): LeafletMap;
  tileLayer(url: string, options?: object): { addTo(map: LeafletMap): void };
  divIcon(options?: object): unknown;
  marker(latlng: [number, number], options?: object): LeafletMarker;
  polyline(latlngs: [number, number][], options?: object): LeafletPolyline;
}

interface LeafletMapProps {
  onLocationSelected: (lat: number, lng: number, distance: number, cost: number, zoneName: string) => void;
  shopCoords: { lat: number; lng: number };
  config?: { delivery_gratis?: boolean; costo_delivery_km?: number; site_nombre?: string; delivery_zonas?: DeliveryZone[] };
  initialUserCoords?: { lat: number; lng: number } | null;
}

// Zonas de Valencia predefinidas (fallback si no hay zonas configuradas)
const VALENCIA_ZONES = [
  { name: 'Trigal / Prebo / Chimeneas', minKm: 0, maxKm: 3, cost: 1.00 },
  { name: 'Mañongo / Trigaleña / Naguanagua / Av Bolívar', minKm: 3, maxKm: 7, cost: 2.00 },
  { name: 'San Diego / Otras zonas', minKm: 7, maxKm: 18, cost: 3.00 },
  { name: 'Fuera de Valencia (Envíos por encomienda)', minKm: 18, maxKm: 100, cost: 0.00 }
];

// Haversine formula
export const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of local Earth in Km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(2));
};

export const calculateShippingCostSymbolic = (distanceKm: number, config?: LeafletMapProps['config']): { cost: number; zone: string } => {
  if (config?.delivery_gratis) {
    return { cost: 0, zone: 'Zona Exclusiva - Delivery Gratis' };
  }

  // Use configured zones if available
  const zones = (config?.delivery_zonas && config.delivery_zonas.length > 0) 
    ? config.delivery_zonas 
    : VALENCIA_ZONES;

  // Check if distance falls within a configured zone
  const matchedZone = zones.find(z => distanceKm >= z.minKm && distanceKm <= z.maxKm);
  if (matchedZone) {
    return { cost: matchedZone.cost, zone: matchedZone.name };
  }

  // National shipping for distances beyond configured zones
  if (distanceKm > 18) {
    return { cost: 0, zone: 'Fuera de Valencia (Cobro a Destino)' };
  }
  
  // Custom or Base shipping rate
  const ratePerKm = config?.costo_delivery_km ?? 0.45;
  const cost = parseFloat(Math.max(1.5, 1.5 + (distanceKm * ratePerKm)).toFixed(2));
  
  return { cost, zone: 'Zona General Valencia' };
};

export const LeafletMap: React.FC<LeafletMapProps> = ({ onLocationSelected, shopCoords, config, initialUserCoords }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const polylineRef = useRef<LeafletPolyline | null>(null);
  
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: shopCoords.lat + 0.015, lng: shopCoords.lng + 0.015 });
  const [distance, setDistance] = useState<number>(0);
  const [shipCost, setShipCost] = useState<number>(0);
  const [zone, setZone] = useState<string>('');
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Dynamic Leaflet detection and robust initialization
    const verifyLeaflet = () => {
      if ((window as unknown as { L?: LeafletNamespace }).L) {
        setMapLoaded(true);
        return true;
      }
      return false;
    };

    if (verifyLeaflet()) return;

    const interval = setInterval(() => {
      if (verifyLeaflet()) {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current) return;

    const L = (window as unknown as { L?: LeafletNamespace }).L;
    if (!L) return;

    // Reset map instance if already active
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn("Error releasing Leaflet instance", e);
      }
      mapInstanceRef.current = null;
    }

    // Initialize Map on Central Valencia
    const map = L.map(mapContainerRef.current, {
      center: [shopCoords.lat, shopCoords.lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true
    });

    mapInstanceRef.current = map;

    // Load OpenStreetMap tiles elegantly
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create customized Shop Pin Icon (Sleek High Contrast Emerald/Charcoal)
    const shopIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute inline-flex h-8 w-8 rounded-full bg-emerald-600 opacity-25 animate-ping"></span>
          <div class="relative bg-zinc-950 border border-emerald-500 text-emerald-500 p-2 rounded-full flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 22H2"/><path d="M10 22v-5a2 2 0 0 1 4 0v5"/><path d="M21 11v11"/><path d="M3 11v11"/><path d="M12 2 2 11h20L12 2Z"/></svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Create customized User Pin Icon (Samsung Emerald)
    const userIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute inline-flex h-8 w-8 rounded-full bg-emerald-600 opacity-20 animate-pulse"></span>
          <div class="relative bg-[#10b981] border-2 border-white text-white p-2 rounded-full flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Add Shop Marker
    L.marker([shopCoords.lat, shopCoords.lng], { icon: shopIcon })
      .addTo(map)
      .bindPopup(`
        <div class="text-xs p-1 font-sans text-zinc-900">
          <h4 class="font-bold text-emerald-600 mb-0.5">Sede Central ${config?.site_nombre || 'de la tienda'}</h4>
          <p class="text-zinc-650">¡Retiro en tienda gratuito aquí!</p>
        </div>
      `);

    // Add User delivery marker at custom location
    const initialUserLat = initialUserCoords?.lat ?? shopCoords.lat + 0.012;
    const initialUserLng = initialUserCoords?.lng ?? shopCoords.lng + 0.012;
    
    const userMarker = L.marker([initialUserLat, initialUserLng], { 
      icon: userIcon,
      draggable: true 
    }).addTo(map);
    
    userMarkerRef.current = userMarker;

    // Draw connecting geometry path line
    const polyline = L.polyline([
      [shopCoords.lat, shopCoords.lng],
      [initialUserLat, initialUserLng]
    ], {
      color: '#10b981',
      weight: 2,
      dashArray: '6, 8',
      opacity: 0.8
    }).addTo(map);

    polylineRef.current = polyline;

    // Recalculations function
    const updateLocation = (lat: number, lng: number) => {
      const dist = getHaversineDistance(shopCoords.lat, shopCoords.lng, lat, lng);
      const { cost, zone: selectedZone } = calculateShippingCostSymbolic(dist, config);

      setCoords({ lat, lng });
      setDistance(dist);
      setShipCost(cost);
      setZone(selectedZone);

      polyline.setLatLngs([
        [shopCoords.lat, shopCoords.lng],
        [lat, lng]
      ]);

      onLocationSelected(lat, lng, dist, cost, selectedZone);
    };

    // Initial Trigger
    updateLocation(initialUserLat, initialUserLng);

    // Event on drag marker
    userMarker.on('drag', (e: { target: LeafletMarker }) => {
      const position = e.target.getLatLng();
      updateLocation(position.lat, position.lng);
    });

    // Event on click map to move pointer
    map.on('click', (e: { latlng: LeafletLatLng }) => {
      const { lat, lng } = e.latlng;
      userMarker.setLatLng([lat, lng]);
      updateLocation(lat, lng);
    });

    // CRITICAL: Force map to recalculate container bounds and size after brief DOM delay
    // This perfectly solves the famous invisible/blank grey map tiles in React steps or tabs
    const resizeTimeout = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(resizeTimeout);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn("Clean up Leaflet map instance warning", e);
        }
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, shopCoords, initialUserCoords?.lat, initialUserCoords?.lng]);

  return (
    <div className="flex flex-col gap-4 font-sans text-zinc-900">
      {/* Location summary widget */}
      <div id="distance-viewer" className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-sm flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 flex items-center gap-1.5">
            <MapPin size={11} className="text-zinc-500" /> Coordenadas Destino
          </span>
          <p className="text-[13px] font-mono text-zinc-900 mt-1 font-bold">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        </div>
        
        <div className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-sm flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 flex items-center gap-1.5">
            <ArrowRight size={11} className="text-zinc-500" /> Distancia de Envío
          </span>
          <p className="text-[13px] text-zinc-650 mt-1 font-sans">
            <span className="text-lg font-bold text-zinc-950 font-display">{distance}</span> KM desde Sede
          </p>
        </div>

        <div className="p-3.5 rounded-xl border-2 border-zinc-900 bg-zinc-950 text-white shadow-sm flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 flex items-center gap-1">
            ✨ Costo de Delivery
          </span>
          <p className="text-[14px] mt-1 font-display font-bold">
            <span className="text-lg font-bold text-white">
              {shipCost === 0 ? 'Gratis / Encomienda' : `$${shipCost.toFixed(2)}`}
            </span>
          </p>
        </div>
      </div>

      {/* Actual map frame */}
      <div className="relative rounded-xl border border-zinc-200 overflow-hidden shadow-sm bg-zinc-50">
        {!mapLoaded && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-900 border-t-transparent"></div>
            <p className="text-xs text-zinc-600 mt-2 font-display">Estableciendo señal de mapas...</p>
          </div>
        )}
        <div ref={mapContainerRef} id="leaflet-map" className="w-full h-[280px] z-10" />
      </div>

      {/* Help message with high-contrast text */}
      <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/55 flex gap-2.5 items-start text-xs text-zinc-600 leading-relaxed shadow-sm">
        <Info size={14} className="mt-0.5 shrink-0 text-zinc-800" />
        <p>
          <strong>Instrucciones:</strong> Arrastra el marcador azul de entrega o haz clic directamente sobre tu calle/taller en Valencia para fijar tu ubicación. Calcularemos el costo estimado según la distancia.
        </p>
      </div>

      {/* Selected Zone status with high contrast */}
      <div className="flex items-center justify-between py-2.5 px-3.5 border border-zinc-200 rounded-lg bg-zinc-50 text-xs text-zinc-850 font-mono shadow-sm">
        <span className="font-semibold text-zinc-500">Zona Identificada:</span>
        <span className="text-emerald-700 font-extrabold uppercase tracking-wide">{zone || "Estableciendo dirección..."}</span>
      </div>
    </div>
  );
};
