
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
  forcedCenter?: { lat: number; lng: number } | null;
}

// Helper: Calculate bearing (heading) between two coordinates
const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;
  
  const startLatRad = toRad(startLat);
  const startLngRad = toRad(startLng);
  const destLatRad = toRad(destLat);
  const destLngRad = toRad(destLng);

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
            Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  const brng = Math.atan2(y, x);
  return (toDeg(brng) + 360) % 360;
};

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
  driverLocation,
  forcedCenter
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  
  // Persistent Refs for Markers (Enables smooth .setLatLng updates)
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const prevDriverLocRef = useRef<{lat: number, lng: number} | null>(null);

  // Layer Groups for static/bulk items
  const markersLayerRef = useRef<any>(null); // Stores
  const routeLayerRef = useRef<any>(null);   // Route

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

    let startLat = 12.9716;
    let startLng = 77.5946;

    if (forcedCenter) {
        startLat = forcedCenter.lat;
        startLng = forcedCenter.lng;
    } else if (selectedStore) {
        startLat = selectedStore.lat;
        startLng = selectedStore.lng;
    } else if (finalUserLat && finalUserLng) {
        startLat = finalUserLat;
        startLng = finalUserLng;
    }

    const map = L.map(mapContainerRef.current, {
      center: [startLat, startLng],
      zoom: 17, // High zoom for street level detail
      zoomControl: false, // We will add custom controls
      attributionControl: false,
      dragging: true,
      tap: true,
      scrollWheelZoom: 'center' 
    });

    // High quality tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Initialize Layer Groups
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

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
    
    // Fix resize issues
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); 

  // 2. Custom Zoom Controls
  const handleZoomIn = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  // 3. Handle Forced Center Updates
  useEffect(() => {
      if (!isMapReady || !mapInstanceRef.current || !forcedCenter) return;
      
      setIsFollowingUser(false); 
      mapInstanceRef.current.flyTo([forcedCenter.lat, forcedCenter.lng], 18, {
          animate: true,
          duration: 1.2,
          easeLinearity: 0.25
      });
  }, [forcedCenter, isMapReady]);

  // 4. Watch Location (High Accuracy)
  useEffect(() => {
    if (!enableLiveTracking || isSelectionMode) return;

    const watchId = watchLocation(
      (loc) => {
        setInternalUserLoc({ lat: loc.lat, lng: loc.lng, acc: loc.accuracy });
        setGpsError(null);
      },
      (err) => {
        setGpsError("Weak Signal");
      }
    );

    return () => clearWatch(watchId);
  }, [enableLiveTracking, isSelectionMode]);

  // 5. Update User Marker (Smooth Animation)
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || !mapInstanceRef.current) return;
    if (!finalUserLat || !finalUserLng) return;

    const latLng = [finalUserLat, finalUserLng];

    // Update Accuracy Circle
    if (!isSelectionMode) {
        if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setLatLng(latLng);
            accuracyCircleRef.current.setRadius(finalAccuracy);
        } else {
            accuracyCircleRef.current = L.circle(latLng, {
                radius: finalAccuracy,
                color: 'transparent',
                fillColor: '#3b82f6',
                fillOpacity: 0.1
            }).addTo(mapInstanceRef.current);
        }
    }

    // Update User Dot
    if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(latLng);
    } else {
        const icon = L.divIcon({
          className: 'bg-transparent border-none',
          html: `
            <div class="relative w-full h-full flex flex-col items-center justify-center overflow-visible">
                <div class="absolute inset-0 bg-blue-500/40 rounded-full animate-ping"></div>
                <div class="absolute inset-0 m-auto w-4 h-4 bg-blue-600 rounded-full border-[3px] border-white shadow-md relative z-10"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        userMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 1000 }).addTo(mapInstanceRef.current);
    }

    // Smooth Pan to User
    if (!isSelectionMode && isFollowingUser) {
       mapInstanceRef.current.panTo(latLng, { animate: true, duration: 1.0 });
    }
  }, [finalUserLat, finalUserLng, finalAccuracy, isMapReady, isSelectionMode, isFollowingUser]);

  // 6. Update Store Markers (Static Layers)
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L) return;

    markersLayerRef.current.clearLayers();

    if (isSelectionMode) return;

    stores.forEach(store => {
       const isSelected = selectedStore?.id === store.id;
       
       let color = '#f97316'; // Orange - General
       let emoji = '🏪';
       
       if (store.type === 'produce') { 
           color = '#10b981'; // Emerald - Produce
           emoji = '🥦'; 
       } else if (store.type === 'dairy') { 
           color = '#3b82f6'; // Blue - Dairy
           emoji = '🥛'; 
       }

       const size = isSelected ? 60 : 44; 
       const anchor = isSelected ? [30, 60] : [22, 44];

       const iconHtml = `
          <div style="
            background-color: ${color};
            width: ${size}px;
            height: ${size}px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            display: flex; 
            align-items: center; 
            justify-content: center;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
            ${isSelected ? 'animation: bounce-marker 1.5s infinite;' : ''}
          ">
            <div style="transform: rotate(45deg); font-size: ${isSelected ? 28 : 20}px;">${emoji}</div>
          </div>
          <style>
            @keyframes bounce-marker {
              0%, 100% { transform: rotate(-45deg) translateY(0); }
              50% { transform: rotate(-45deg) translateY(-10px); }
            }
          </style>
       `;

       const icon = L.divIcon({
          className: 'bg-transparent border-none',
          html: iconHtml,
          iconSize: [size, size],
          iconAnchor: anchor
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

  // 7. Driver Marker (Smooth + Rotation)
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || !mapInstanceRef.current) return;

    if (!driverLocation) {
        if (driverMarkerRef.current) {
            driverMarkerRef.current.remove();
            driverMarkerRef.current = null;
        }
        return;
    }

    const latLng = [driverLocation.lat, driverLocation.lng];
    let rotation = 0;

    // Calculate Bearing if previous location exists
    if (prevDriverLocRef.current) {
        const prev = prevDriverLocRef.current;
        // Only update rotation if moved significantly to avoid jitter
        if (Math.abs(prev.lat - driverLocation.lat) > 0.00001 || Math.abs(prev.lng - driverLocation.lng) > 0.00001) {
            rotation = calculateBearing(prev.lat, prev.lng, driverLocation.lat, driverLocation.lng);
        }
    }
    prevDriverLocRef.current = driverLocation;

    if (driverMarkerRef.current) {
        // Smoothly move existing marker
        driverMarkerRef.current.setLatLng(latLng);
        
        // Update rotation transform directly on DOM element for performance
        const el = driverMarkerRef.current.getElement();
        if (el) {
            const iconDiv = el.querySelector('.driver-icon-inner');
            if (iconDiv) {
                // Determine rotation direction for shortest path (optional advanced math, kept simple here)
                iconDiv.style.transform = `rotate(${rotation}deg)`;
            }
        }
    } else {
        // Create new marker
        const icon = L.divIcon({
            className: 'bg-transparent border-none',
            html: `
              <div class="driver-icon-inner transition-transform duration-500 ease-linear" style="transform: rotate(${rotation}deg); font-size: 36px; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.2));">
                  🛵
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        driverMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 2000 }).addTo(mapInstanceRef.current);
    }
  }, [driverLocation, isMapReady]);

  // 8. Route Line
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L) return;

    routeLayerRef.current.clearLayers();
    setRouteDistance('');

    if (showRoute && selectedStore && finalUserLat && finalUserLng && !isSelectionMode) {
       getRoute(finalUserLat, finalUserLng, selectedStore.lat, selectedStore.lng)
         .then(route => {
             if (route && mapInstanceRef.current) {
                // Dashed animated line
                L.polyline(route.coordinates, {
                   color: '#10b981',
                   weight: 6,
                   opacity: 0.9,
                   lineCap: 'round',
                   dashArray: '10, 15',
                   className: 'animate-pulse' 
                }).addTo(routeLayerRef.current);

                // Shadow line
                L.polyline(route.coordinates, {
                   color: '#065f46',
                   weight: 8,
                   opacity: 0.2,
                   lineCap: 'round',
                }).addTo(routeLayerRef.current);

                setRouteDistance((route.distance / 1000).toFixed(1) + ' km');
                
                if (!isFollowingUser) {
                   const bounds = L.latLngBounds(route.coordinates);
                   mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
                }
             }
         });
    }
  }, [selectedStore, showRoute, finalUserLat, finalUserLng, isMapReady, isSelectionMode]);

  const handleRecenter = () => {
      setIsFollowingUser(true);
      if (onRequestLocation) onRequestLocation();
      if (finalUserLat && finalUserLng && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([finalUserLat, finalUserLng], 17, { animate: true });
      }
  };

  return (
    <div className={`w-full bg-slate-50 rounded-[2.5rem] overflow-hidden relative shadow-inner border border-white isolate ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-100" />

      {/* GPS Error Toast */}
      {gpsError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-50/90 backdrop-blur text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-md z-[1000] border border-red-100 flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
             {gpsError}
          </div>
      )}

      {/* Center Pin for Selection Mode (Uber Style) */}
      {isSelectionMode && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] pointer-events-none flex flex-col items-center -mt-[42px]">
              <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-2xl border-[4px] border-white z-20">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              <div className="w-1 h-6 bg-slate-900 mx-auto -mt-2 rounded-b-full shadow-sm"></div>
              <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-[10px] font-black uppercase text-slate-800 tracking-wide mt-3 border border-slate-100 flex items-center gap-2">
                  <span>📍</span> Set Location
              </div>
          </div>
      )}

      {/* Custom Zoom Controls */}
      <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-[400]">
          <button 
            onClick={handleZoomIn}
            className="w-10 h-10 bg-white/90 backdrop-blur shadow-float rounded-xl text-slate-700 font-bold flex items-center justify-center border border-white active:scale-95 transition-all hover:bg-white"
            title="Zoom In"
          >
            +
          </button>
          <button 
            onClick={handleZoomOut}
            className="w-10 h-10 bg-white/90 backdrop-blur shadow-float rounded-xl text-slate-700 font-bold flex items-center justify-center border border-white active:scale-95 transition-all hover:bg-white"
            title="Zoom Out"
          >
            -
          </button>
      </div>

      {/* Recenter Button */}
      {!isSelectionMode && (
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRecenter(); }}
            className={`absolute bottom-6 right-4 z-[400] w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl shadow-float flex items-center justify-center transition-all cursor-pointer border border-white active:scale-95 hover:bg-white ${isFollowingUser ? 'text-blue-500 ring-2 ring-blue-100' : 'text-slate-600'}`}
            type="button"
            title="Locate Me"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
      )}

      {/* Store Card Overlay */}
      {selectedStore && !isSelectionMode && (
         <div 
            onClick={() => { setIsFollowingUser(false); if(mapInstanceRef.current) mapInstanceRef.current.flyTo([selectedStore.lat, selectedStore.lng], 17); }}
            className="absolute bottom-6 left-4 right-16 bg-white/95 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-float flex items-center justify-between border border-white z-[400] animate-slide-up cursor-pointer ring-1 ring-slate-100"
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
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-black text-slate-800 truncate">{selectedStore.name}</div>
                        <div className={`text-[8px] px-1.5 py-0.5 rounded flex-shrink-0 font-black uppercase tracking-wide border ${
                            selectedStore.type === 'produce' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                            selectedStore.type === 'dairy' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                            'bg-orange-50 text-orange-600 border-orange-100'
                        }`}>
                            {selectedStore.type === 'general' ? 'Mart' : selectedStore.type}
                        </div>
                    </div>
                 </div>
             </div>
             
             {showRoute && routeDistance && (
               <div className="text-right whitespace-nowrap pl-3 border-l border-slate-100 ml-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Dist.</div>
                  <div className="text-sm font-black text-emerald-600">{routeDistance}</div>
               </div>
             )}
         </div>
      )}
    </div>
  );
};
