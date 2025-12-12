
import React, { useEffect, useRef, useState } from 'react';
import { Store, OrderMode } from '../types';
import { getRoute, watchLocation, clearWatch } from '../services/locationService';

interface MapVisualizerProps {
  stores: Store[];
  userLat: number | null;
  userLng: number | null;
  userAccuracy?: number | null;
  selectedStore: Store | null;
  onSelectStore: (store: Store) => void;
  className?: string;
  mode: OrderMode; 
  showRoute?: boolean;
  enableExternalNavigation?: boolean;
  onRequestLocation?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
  isSelectionMode?: boolean; 
  enableLiveTracking?: boolean;
  driverLocation?: { lat: number; lng: number };
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ 
  stores, 
  userLat, 
  userLng, 
  userAccuracy,
  selectedStore, 
  onSelectStore, 
  className = "h-48",
  mode,
  showRoute = false,
  enableExternalNavigation = false,
  onRequestLocation,
  onMapClick,
  isSelectionMode = false,
  enableLiveTracking = true,
  driverLocation
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  
  // Layer Refs
  const markersLayerRef = useRef<any>(null); // Stores
  const userLayerRef = useRef<any>(null);    // User Dot + Accuracy
  const routeLayerRef = useRef<any>(null);   // Route Polyline
  const driverLayerRef = useRef<any>(null);  // Driver Marker

  // State
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(!isSelectionMode);
  const [internalUserLoc, setInternalUserLoc] = useState<{lat: number, lng: number, acc: number} | null>(null);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Computed Locations
  const finalUserLat = internalUserLoc?.lat ?? userLat;
  const finalUserLng = internalUserLoc?.lng ?? userLng;
  const finalAccuracy = internalUserLoc?.acc ?? userAccuracy ?? 50;

  // 1. Initialize Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Initial Center
    const startLat = selectedStore ? selectedStore.lat : (finalUserLat || 12.9716);
    const startLng = selectedStore ? selectedStore.lng : (finalUserLng || 77.5946);

    const map = L.map(mapContainerRef.current, {
      center: [startLat, startLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      tap: true
    });

    // Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Initialize Layers
    markersLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    driverLayerRef.current = L.layerGroup().addTo(map);

    // Event Listeners
    map.on('dragstart', () => {
      setIsFollowingUser(false);
    });

    if (isSelectionMode && onMapClick) {
      map.on('moveend', () => {
        const center = map.getCenter();
        onMapClick(center.lat, center.lng);
      });
    }

    mapInstanceRef.current = map;
    setIsMapReady(true);
    
    // Resize fix
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run once on mount

  // 2. Watch Location (Internal High Accuracy)
  useEffect(() => {
    if (!enableLiveTracking || isSelectionMode) return;

    const watchId = watchLocation(
      (loc) => {
        setInternalUserLoc({ lat: loc.lat, lng: loc.lng, acc: loc.accuracy });
        setGpsError(null);
      },
      (err) => {
        console.warn("Map GPS Error:", err);
        setGpsError("GPS Signal Weak");
      }
    );

    return () => clearWatch(watchId);
  }, [enableLiveTracking, isSelectionMode]);

  // 3. Update User Marker & Camera
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || !mapInstanceRef.current) return;
    if (!finalUserLat || !finalUserLng) return;

    // Clear previous user marker
    userLayerRef.current.clearLayers();

    if (!isSelectionMode) {
        // Accuracy Circle
        L.circle([finalUserLat, finalUserLng], {
          radius: finalAccuracy,
          color: 'transparent',
          fillColor: '#3b82f6',
          fillOpacity: 0.15
        }).addTo(userLayerRef.current);

        // Pulsing Blue Dot
        const icon = L.divIcon({
          className: 'bg-transparent border-none',
          html: `
            <div class="relative w-6 h-6">
                <div class="absolute inset-0 bg-blue-500/40 rounded-full animate-ping"></div>
                <div class="absolute inset-0 m-auto w-4 h-4 bg-blue-600 rounded-full border-[2px] border-white shadow-md"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([finalUserLat, finalUserLng], { icon, zIndexOffset: 1000 })
          .addTo(userLayerRef.current);

        // Follow Logic
        if (isFollowingUser) {
           mapInstanceRef.current.flyTo([finalUserLat, finalUserLng], 17, {
             animate: true,
             duration: 1.5,
             easeLinearity: 0.25
           });
        }
    }
  }, [finalUserLat, finalUserLng, finalAccuracy, isMapReady, isSelectionMode, isFollowingUser]);

  // 4. Update Store Markers
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L) return;

    markersLayerRef.current.clearLayers();

    if (isSelectionMode) return;

    stores.forEach(store => {
       const isSelected = selectedStore?.id === store.id;
       let color = '#f97316'; // Orange
       let emoji = '🏪';
       if (store.type === 'produce') { color = '#10b981'; emoji = '🥦'; } 
       else if (store.type === 'dairy') { color = '#3b82f6'; emoji = '🥛'; }

       const icon = L.divIcon({
          className: 'bg-transparent border-none',
          html: `<div style="
            background-color: ${color};
            width: ${isSelected ? 48 : 36}px;
            height: ${isSelected ? 48 : 36}px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg) ${isSelected ? 'scale(1.1)' : 'scale(1)'};
            border: 3px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            display: flex; 
            align-items: center; 
            justify-content: center;
            transition: all 0.3s;
            cursor: pointer;
          ">
            <div style="transform: rotate(45deg); font-size: ${isSelected ? 24 : 18}px;">${emoji}</div>
          </div>`,
          iconSize: [isSelected ? 48 : 36, isSelected ? 48 : 36],
          iconAnchor: [isSelected ? 24 : 18, isSelected ? 44 : 34] 
       });

       const m = L.marker([store.lat, store.lng], { icon, zIndexOffset: isSelected ? 900 : 800 })
         .on('click', () => {
             onSelectStore(store);
             setIsFollowingUser(false);
             mapInstanceRef.current.flyTo([store.lat, store.lng], 16.5, { animate: true });
         });
       
       m.addTo(markersLayerRef.current);
    });

  }, [stores, selectedStore, isMapReady, isSelectionMode]);

  // 5. Driver Marker
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L) return;

    driverLayerRef.current.clearLayers();

    if (driverLocation) {
        const icon = L.divIcon({
            className: 'bg-transparent border-none',
            html: `<div style="font-size: 32px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.2)); transition: transform 0.5s linear;">🛵</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        L.marker([driverLocation.lat, driverLocation.lng], { icon, zIndexOffset: 2000 })
          .addTo(driverLayerRef.current);
    }
  }, [driverLocation, isMapReady]);

  // 6. Route Line
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L) return;

    routeLayerRef.current.clearLayers();
    setRouteDistance('');

    if (showRoute && selectedStore && finalUserLat && finalUserLng && !isSelectionMode) {
       getRoute(finalUserLat, finalUserLng, selectedStore.lat, selectedStore.lng)
         .then(route => {
             if (route && mapInstanceRef.current) {
                L.polyline(route.coordinates, {
                   color: '#10b981',
                   weight: 5,
                   opacity: 0.8,
                   lineCap: 'round',
                   dashArray: '10, 10',
                   className: 'animate-pulse'
                }).addTo(routeLayerRef.current);

                setRouteDistance((route.distance / 1000).toFixed(1) + ' km');
                
                // If this is the first route render, fit bounds
                if (!isFollowingUser) {
                   const bounds = L.latLngBounds(route.coordinates);
                   mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
                }
             }
         });
    }
  }, [selectedStore, showRoute, finalUserLat, finalUserLng, isMapReady, isSelectionMode]);

  // Handlers
  const handleRecenter = () => {
      setIsFollowingUser(true);
      if (onRequestLocation) onRequestLocation();
      
      if (finalUserLat && finalUserLng && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([finalUserLat, finalUserLng], 17, { animate: true });
      }
  };

  const openExternalMaps = () => {
      if (selectedStore) {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedStore.lat},${selectedStore.lng}`, '_blank');
      }
  };

  return (
    <div className={`w-full bg-slate-50 rounded-[2.5rem] overflow-hidden relative shadow-inner border border-white ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-100" />

      {/* GPS Error Toast */}
      {gpsError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold shadow-md z-[1000] border border-red-100 flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
             {gpsError}
          </div>
      )}

      {/* Center Pin for Selection Mode */}
      {isSelectionMode && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] pointer-events-none flex flex-col items-center -mt-[38px]">
              <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-2xl border-4 border-white z-20">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              <div className="w-0.5 h-6 bg-slate-900 mx-auto -mt-1 rounded-b-full"></div>
              <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg text-[10px] font-black uppercase text-slate-800 tracking-wide mt-2 border border-slate-100">
                  Set Location
              </div>
          </div>
      )}

      {/* Recenter Button */}
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRecenter(); }}
        className={`absolute bottom-6 right-4 z-[400] w-12 h-12 bg-white rounded-2xl shadow-float flex items-center justify-center transition-all cursor-pointer border border-white active:scale-95 hover:bg-slate-50 ${isFollowingUser ? 'text-blue-500 ring-2 ring-blue-100' : 'text-slate-600'}`}
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Store Card Overlay */}
      {selectedStore && !isSelectionMode && (
         <div 
            onClick={() => { setIsFollowingUser(false); if(mapInstanceRef.current) mapInstanceRef.current.flyTo([selectedStore.lat, selectedStore.lng], 17); }}
            className="absolute bottom-6 left-4 right-16 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-float flex items-center justify-between border border-white z-[400] animate-slide-up cursor-pointer"
         >
             <div className="flex items-center gap-3 overflow-hidden flex-1">
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm text-white flex-shrink-0 ${
                    selectedStore.type === 'produce' ? 'bg-emerald-500' : selectedStore.type === 'dairy' ? 'bg-blue-500' : 'bg-orange-500'
                 }`}>
                    {selectedStore.type === 'produce' ? '🥦' : selectedStore.type === 'dairy' ? '🥛' : '🏪'}
                 </div>
                 <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        {mode === 'DELIVERY' ? 'Deliver From' : 'Visit'}
                    </div>
                    <div className="text-sm font-black text-slate-800 truncate">{selectedStore.name}</div>
                 </div>
             </div>
             
             {showRoute && routeDistance && (
               <div className="text-right whitespace-nowrap pl-2 border-l border-slate-100 ml-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Dist.</div>
                  <div className="text-sm font-black text-brand-DEFAULT">{routeDistance}</div>
               </div>
             )}
         </div>
      )}
    </div>
  );
};
