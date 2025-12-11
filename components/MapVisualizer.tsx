
import React, { useEffect, useRef, useState } from 'react';
import { Store, OrderMode } from '../types';

interface MapVisualizerProps {
  stores: Store[];
  userLat: number | null;
  userLng: number | null;
  selectedStore: Store | null;
  onSelectStore: (store: Store) => void;
  className?: string;
  mode: OrderMode; 
  showRoute?: boolean;
  enableExternalNavigation?: boolean;
  onRequestLocation?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ 
  stores, 
  userLat, 
  userLng, 
  selectedStore, 
  onSelectStore, 
  className = "h-48",
  mode,
  showRoute = false,
  enableExternalNavigation = false,
  onRequestLocation,
  onMapClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const clickHandlerRef = useRef<any>(null);
  
  // Track previous props to determine what changed
  const prevStoreLat = useRef<number | undefined>(selectedStore?.lat);
  const prevStoreLng = useRef<number | undefined>(selectedStore?.lng);
  const prevUserLat = useRef<number | null>(userLat);
  const prevUserLng = useRef<number | null>(userLng);

  // Center fallback: Bangalore or Store
  const mapCenterLat = selectedStore ? selectedStore.lat : (userLat || 12.9716);
  const mapCenterLng = selectedStore ? selectedStore.lng : (userLng || 77.5946);
  
  const [dynamicDistance, setDynamicDistance] = useState<string>('');
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Sync state with props
  useEffect(() => {
    if (userLat && userLng) {
        setHasUserLocation(true);
        setIsLocating(false);
    } else {
        setHasUserLocation(false);
    }
  }, [userLat, userLng]);

  // FIX: Force map resize to prevent grey tiles
  useEffect(() => {
    if (mapInstanceRef.current) {
        setTimeout(() => {
            mapInstanceRef.current.invalidateSize();
        }, 200);
    }
  });

  // View Update Logic - Intelligent FlyTo
  useEffect(() => {
      if (!mapInstanceRef.current) return;
      
      const storeChanged = selectedStore?.lat !== prevStoreLat.current || selectedStore?.lng !== prevStoreLng.current;
      const userChanged = userLat !== prevUserLat.current || userLng !== prevUserLng.current;
      
      // Update refs for next render
      prevStoreLat.current = selectedStore?.lat;
      prevStoreLng.current = selectedStore?.lng;
      prevUserLat.current = userLat;
      prevUserLng.current = userLng;

      // Logic:
      // 1. If we are manually pinning (onMapClick), don't auto-move unless it's the very first load or store changed (which happens when pin moves).
      // 2. If Store Changed, fly to Store.
      // 3. If User Changed, fly to User.
      
      if (storeChanged && selectedStore) {
          mapInstanceRef.current.flyTo([selectedStore.lat, selectedStore.lng], 16, { duration: 1 });
      } else if (userChanged && userLat && userLng) {
          mapInstanceRef.current.flyTo([userLat, userLng], 16, { duration: 1 });
      } else if (!selectedStore && userLat && userLng && !prevUserLat.current) {
          // Initial user load with no store
          mapInstanceRef.current.setView([userLat, userLng], 16);
      }

  }, [selectedStore?.lat, selectedStore?.lng, userLat, userLng]);

  const calculateDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1) + ' km';
  };

  useEffect(() => {
      const lat = userLat;
      const lng = userLng;

      if (selectedStore && lat && lng) {
          const dist = calculateDist(lat, lng, selectedStore.lat, selectedStore.lng);
          setDynamicDistance(dist);
      } else {
        setDynamicDistance('');
      }
  }, [userLat, userLng, selectedStore]);

  const handleLocateMe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();

    setIsLocating(true);

    if (mapInstanceRef.current && userLat && userLng) {
        mapInstanceRef.current.flyTo([userLat, userLng], 16, { duration: 1.5 });
        setTimeout(() => setIsLocating(false), 500);
    } else if (onRequestLocation) {
        onRequestLocation();
        // Fallback timeout
        setTimeout(() => setIsLocating(false), 8000);
    } else {
        setIsLocating(false);
    }
  };

  const openGoogleMaps = (e?: React.MouseEvent) => {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    if (selectedStore) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedStore.lat},${selectedStore.lng}`;
        window.open(url, '_blank');
    }
  };

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        center: [mapCenterLat, mapCenterLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: ''
      }).addTo(mapInstanceRef.current);
    } 

    if (onMapClick) {
        if (clickHandlerRef.current) {
            mapInstanceRef.current.off('click', clickHandlerRef.current);
        }
        
        clickHandlerRef.current = (e: any) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        };
        
        mapInstanceRef.current.on('click', clickHandlerRef.current);
        if (mapContainerRef.current) mapContainerRef.current.style.cursor = 'crosshair';
    } else {
         if (mapContainerRef.current) mapContainerRef.current.style.cursor = 'grab';
    }

    // User Marker
    if (userLat && userLng) {
        if (!userMarkerRef.current) {
             userMarkerRef.current = L.marker([userLat, userLng], {
                icon: L.divIcon({
                    className: 'user-pin-live',
                    html: `<div class="relative">
                                <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md z-20 relative"></div>
                                <div class="absolute -top-4 -left-4 w-12 h-12 bg-blue-500/30 rounded-full animate-ping z-10"></div>
                            </div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
             }).addTo(mapInstanceRef.current);
        } else {
            userMarkerRef.current.setLatLng([userLat, userLng]);
            userMarkerRef.current.setOpacity(1);
        }
    } else {
        if (userMarkerRef.current) {
            // Instead of removing, just hide, to avoid flicker
            userMarkerRef.current.setOpacity(0);
        }
    }

    // Store Markers
    markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    markersRef.current = [];

    const createIcon = (type: Store['type'], isSelected: boolean) => {
       let color = '#ef4444'; 
       let emoji = '🏪';
       let borderColor = isSelected ? '#000' : '#fff';
       
       if (type === 'produce') {
         color = '#22c55e';
         emoji = '🥦';
       } else if (type === 'dairy') {
         color = '#3b82f6';
         emoji = '🥛';
       }

       return L.divIcon({
          className: 'custom-pin',
          html: `<div style="
            background-color: ${color};
            width: ${isSelected ? 40 : 30}px;
            height: ${isSelected ? 40 : 30}px;
            border-radius: 50%;
            border: ${isSelected ? '3px' : '2px'} solid ${borderColor};
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-size: ${isSelected ? 22 : 16}px;
            z-index: ${isSelected ? 100 : 1};
            transition: all 0.2s;
            cursor: pointer;
            position: relative;
          ">
            ${emoji}
            ${isSelected && onMapClick ? '<div style="position:absolute; bottom:-8px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid #000;"></div>' : ''}
          </div>`,
          iconSize: [isSelected ? 40 : 30, isSelected ? 40 : 30],
          iconAnchor: [isSelected ? 20 : 15, isSelected ? 20 : 15] 
       });
    };

    stores.forEach(store => {
      const isSelected = selectedStore?.id === store.id;
      const marker = L.marker([store.lat, store.lng], {
        icon: createIcon(store.type, isSelected),
        zIndexOffset: isSelected ? 1000 : 0
      }).addTo(mapInstanceRef.current);

      marker.on('click', () => {
          onSelectStore(store);
          if (mode === 'PICKUP' && isSelected && enableExternalNavigation) {
              openGoogleMaps();
          }
      });
      markersRef.current.push(marker);
    });

    if (routeLineRef.current) {
        mapInstanceRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
    }

    if (selectedStore && showRoute && userLat && userLng) {
        const latlngs = [
            [userLat, userLng],
            [selectedStore.lat, selectedStore.lng]
        ];
        
        routeLineRef.current = L.polyline(latlngs, {
            color: '#059669', 
            weight: 6,
            opacity: 0.8,
            dashArray: '10, 10', 
            lineCap: 'round',
            className: mode === 'PICKUP' ? 'cursor-pointer hover:stroke-emerald-700 transition-colors' : ''
        }).addTo(mapInstanceRef.current);

        if (mode === 'PICKUP' && enableExternalNavigation) {
            routeLineRef.current.on('click', (e: any) => openGoogleMaps(e.originalEvent));
            routeLineRef.current.bindTooltip("Tap to Navigate", {
                permanent: true, 
                direction: 'center', 
                className: 'bg-white text-brand-dark text-xs font-bold px-2 py-1 rounded-md shadow-md border border-brand-light'
            });
        }
        
        const bounds = L.latLngBounds(latlngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

  }, [stores, userLat, userLng, selectedStore, onSelectStore, mode, showRoute, enableExternalNavigation, mapCenterLat, mapCenterLng, onMapClick]);

  return (
    <div className={`w-full bg-slate-100 rounded-[2.5rem] overflow-hidden relative shadow-inner border border-white ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0 mix-blend-multiply opacity-90" style={{ minHeight: '100%' }}></div>

      <button 
        onClick={handleLocateMe}
        className={`absolute top-4 left-4 z-[1000] w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isLocating ? 'text-brand-DEFAULT ring-2 ring-brand-light' : 
            !hasUserLocation ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:bg-blue-50 active:scale-95'
        }`}
        title="Live Location"
        type="button"
      >
        {isLocating ? (
             <div className="w-5 h-5 border-2 border-slate-200 border-t-brand-DEFAULT rounded-full animate-spin"></div>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 pointer-events-none">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
        )}
      </button>

      {enableExternalNavigation && selectedStore && mode === 'PICKUP' && (
          <button 
            onClick={openGoogleMaps}
            className="absolute top-4 right-4 z-[1000] bg-brand-DEFAULT text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 hover:bg-brand-dark active:scale-95 transition-all font-bold text-xs animate-scale-in group cursor-pointer"
          >
             <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <span>Get Directions</span>
          </button>
      )}

      {selectedStore && (
        <div 
            onClick={mode === 'PICKUP' ? openGoogleMaps : undefined}
            className={`absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-soft-xl flex items-center justify-between border border-white/50 z-[1000] animate-fade-in-up ${mode === 'PICKUP' ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
        >
             <div className="flex items-center gap-3 overflow-hidden">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm text-white flex-shrink-0 ${
                    selectedStore.type === 'produce' ? 'bg-emerald-500' : selectedStore.type === 'dairy' ? 'bg-sky-500' : 'bg-orange-500'
                 }`}>
                    {selectedStore.type === 'produce' ? '🥦' : selectedStore.type === 'dairy' ? '🥛' : '🏪'}
                 </div>
                 <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        {mode === 'DELIVERY' ? 'Delivering From' : 'Pickup At'}
                    </div>
                    <div className="text-sm font-black text-slate-800 truncate">{selectedStore.name}</div>
                 </div>
             </div>
             
             {showRoute && hasUserLocation && (
               <div className="text-right whitespace-nowrap pl-2 border-l border-slate-100 ml-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Dist.</div>
                  <div className="text-sm font-black text-brand-DEFAULT">{dynamicDistance || selectedStore.distance}</div>
               </div>
             )}
        </div>
      )}
    </div>
  );
};
