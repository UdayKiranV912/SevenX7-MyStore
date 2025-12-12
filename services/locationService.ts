

/**
 * Service for Location Utilities using Free APIs
 * - OSRM for Routing (Driving Directions)
 * - Nominatim for Geocoding (Address Lookup)
 */

export interface RouteResult {
  coordinates: [number, number][]; // Array of [lat, lng]
  distance: number; // meters
  duration: number; // seconds
}

// 1. Robust Browser Location Fetcher (Single Shot)
export const getBrowserLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }

    const options = {
      enableHighAccuracy: true, // Critical for street-level accuracy
      timeout: 15000,           // 15s timeout
      maximumAge: 0,            // Force fresh reading
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        // Fallback or specific error handling
        let msg = "Location error.";
        switch(err.code) {
            case 1: msg = "Permission denied. Please enable location services."; break;
            case 2: msg = "Position unavailable. GPS signal weak."; break;
            case 3: msg = "Location request timed out."; break;
        }
        reject(new Error(msg));
      },
      options
    );
  });
};

// 2. Real-time Location Watcher
export const watchLocation = (
  onLocation: (loc: { lat: number; lng: number; accuracy: number }) => void,
  onError: (err: any) => void
): number => {
  if (!navigator.geolocation) return -1;
  
  return navigator.geolocation.watchPosition(
    (pos) => {
      onLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
    (err) => {
      // Don't log timeout errors aggressively as they happen often in high-accuracy mode
      if (err.code !== 3) console.warn("Watch Position Error:", err);
      onError(err);
    },
    { 
      enableHighAccuracy: true, 
      timeout: 10000, // Check every 10s or sooner if moved
      maximumAge: 0   // Force fresh GPS data every time
    }
  );
};

export const clearWatch = (watchId: number) => {
    if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
    }
};

export const getRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<RouteResult | null> => {
  try {
    // OSRM expects coordinates as {lon},{lat}
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        // OSRM returns [lon, lat], map to [lat, lng] for Leaflet
        coordinates: route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
        distance: route.distance, 
        duration: route.duration 
      };
    }
    return null;
  } catch (error) {
    // Use fallback straight line distance if OSRM fails
    console.warn("OSRM Route Fetch Error:", error);
    return {
        coordinates: [[startLat, startLng], [endLat, endLng]],
        distance: 0,
        duration: 0
    };
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: {
                'User-Agent': 'Grocesphere-App/1.0'
            }
        });
        
        if (!response.ok) throw new Error('Geocoding failed');
        
        const data = await response.json();
        const addr = data.address;

        if (!addr) return data.display_name || null;

        // Construct a cleaner, "Indian-style" short address
        const parts = [];

        // 1. Specific Building/House
        if (addr.house_number) parts.push(addr.house_number);
        if (addr.building) parts.push(addr.building);
        else if (addr.flat) parts.push(addr.flat);
        
        // 2. Street/Road
        if (addr.road) parts.push(addr.road);
        else if (addr.pedestrian) parts.push(addr.pedestrian);
        else if (addr.street) parts.push(addr.street);
        
        // 3. Area/Suburb (Vital for context)
        if (addr.suburb) parts.push(addr.suburb);
        else if (addr.neighbourhood) parts.push(addr.neighbourhood);
        else if (addr.residential) parts.push(addr.residential);
        else if (addr.village) parts.push(addr.village);

        // 4. City (Only if not in suburb to save space, or append at end)
        if (addr.city && !parts.includes(addr.city)) parts.push(addr.city);
        else if (addr.town) parts.push(addr.town);

        if (parts.length > 0) return parts.join(', ');
        
        return data.display_name || null;
    } catch (error) {
        console.error("Nominatim Reverse Geocode Error:", error);
        return null;
    }
};

export const searchAddress = async (query: string) => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`, {
             headers: {
                'User-Agent': 'Grocesphere-App/1.0'
            }
        });
        const data = await response.json();
        return data;
    } catch (error) {
         console.error("Nominatim Search Error:", error);
         return [];
    }
};
