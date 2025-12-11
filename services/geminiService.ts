import { GoogleGenAI, Type } from "@google/genai";
import { Store, Product } from "../types";
import { MOCK_STORES } from "../constants";

// Safety check for API key
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

// Helper to assign inventory based on type
const assignInventory = (type: Store['type']): string[] => {
  const range = (start: number, end: number) => Array.from({length: end - start + 1}, (_, i) => String(start + i));
  
  if (type === 'dairy') {
    return range(41, 60); // Dairy IDs
  } else if (type === 'produce') {
    return range(61, 80); // Produce IDs
  } else {
    // General: Staples, Oils, Snacks, Basic Dairy/Veg
    return [
      ...range(1, 40),
      ...range(81, 100),
      '41', '42', '47', '48', // Milk, Curd, Eggs, Bread
      '61', '62', '63', '66', '76' // Basic Veg
    ];
  }
};

/**
 * Returns the comprehensive list of Bengaluru stores sorted by distance to the user.
 * This ensures the map is always populated with high-quality local data.
 */
const getComprehensiveFallbackStores = (lat: number, lng: number): Store[] => {
    // Sort the static huge list by distance to the user
    return MOCK_STORES.map(store => {
        const dist = calculateDistance(lat, lng, store.lat, store.lng);
        return {
            ...store,
            distance: `${dist.toFixed(1)} km`
        };
    }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
    .slice(0, 60); // Return top 60 closest stores for performance (increased from 30)
};

/**
 * Fetches REAL local stores from OpenStreetMap using the Overpass API.
 * Includes backup endpoints and fallbacks for reliability.
 */
export const findNearbyStores = async (lat: number, lng: number): Promise<Store[]> => {
  try {
    // Overpass QL Query: Search 2km radius for specific shop types
    // Reduced radius to 2000m to speed up query
    const query = `
      [out:json][timeout:5];
      (
        node["shop"~"convenience|general|supermarket|provisions"](around:2000, ${lat}, ${lng});
        node["shop"~"greengrocer|farm|vegetable"](around:2000, ${lat}, ${lng});
        node["shop"~"dairy|milk"](around:2000, ${lat}, ${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    let response;
    let data;

    try {
        // 1. Try Primary Endpoint
        response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) throw new Error("Primary API failed");
        data = await response.json();

    } catch (primaryError) {
        console.warn("Primary Overpass failed, trying backup...", primaryError);
        
        try {
            // 2. Try Backup Endpoint (Mail.ru Mirror)
            response = await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter', {
                method: 'POST',
                body: query
            });

            if (!response.ok) throw new Error("Backup API failed");
            data = await response.json();

        } catch (backupError) {
            // 3. Both failed, return comprehensive local stores
            console.log("All Overpass APIs failed. Using comprehensive Bengaluru database.");
            return getComprehensiveFallbackStores(lat, lng);
        }
    }

    const elements = data?.elements || [];

    // Chains to exclude
    const EXCLUDED_CHAINS = ['Reliance', 'More', 'Spencer', 'BigBasket', 'Jio', 'DMart', 'Star Bazaar', 'Metro', 'Decathlon'];

    const mappedStores: Store[] = elements
      .filter((node: any) => {
        const name = node.tags?.name || '';
        // Filter unnamed nodes and big chains
        if (!name) return false;
        return !EXCLUDED_CHAINS.some(chain => name.toLowerCase().includes(chain.toLowerCase()));
      })
      .map((node: any) => {
        const tags = node.tags;
        let type: Store['type'] = 'general';
        
        // Determine type based on OSM tags
        if (tags.shop === 'greengrocer' || tags.shop === 'farm' || tags.shop === 'vegetable') {
          type = 'produce';
        } else if (tags.shop === 'dairy' || tags.shop === 'milk' || (tags.name && tags.name.toLowerCase().includes('nandini'))) {
          type = 'dairy';
        }

        return {
          id: `osm-${node.id}`,
          name: tags.name,
          address: tags['addr:street'] || tags['addr:suburb'] || `${tags.shop || 'Local'} Store`,
          rating: 4.0 + (Math.random() * 1.0), // Simulate rating as OSM doesn't have it
          distance: `${calculateDistance(lat, lng, node.lat, node.lon).toFixed(1)} km`,
          lat: node.lat,
          lng: node.lon,
          isOpen: true,
          type: type,
          availableProductIds: assignInventory(type)
        };
      })
      .slice(0, 15); // Limit to closest 15

    if (mappedStores.length === 0) {
        console.log("No real stores found nearby, using comprehensive Bengaluru database.");
        return getComprehensiveFallbackStores(lat, lng);
    }

    return mappedStores;

  } catch (error) {
    console.error("Store Fetch Error (Fatal):", error);
    return getComprehensiveFallbackStores(lat, lng);
  }
};

// Simple Haversine distance calculator
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

export const generateProductDetails = async (productName: string): Promise<Partial<Product>> => {
  if (!apiKey) {
    return {
      description: `Fresh and high-quality ${productName} sourced from local community partners.`,
      ingredients: "100% Natural",
      nutrition: "Calories: 100 • Protein: 5g • Carbs: 10g"
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a short appetizing description (max 20 words), a simple list of ingredients (if applicable for a raw item just say 'Fresh ${productName}'), and basic nutritional info (e.g. '120 kcal, 5g Protein') for the grocery item: '${productName}'.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            ingredients: { type: Type.STRING },
            nutrition: { type: Type.STRING },
          },
          required: ["description", "ingredients", "nutrition"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error("No text returned");
  } catch (error) {
    console.error("Gemini Product Details Error:", error);
    return {
      description: `Enjoy fresh ${productName} delivered to your door.`,
      ingredients: "Natural ingredients",
      nutrition: "Nutrition data unavailable"
    };
  }
};