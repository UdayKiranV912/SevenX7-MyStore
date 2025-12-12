
import { supabase } from './supabaseClient';
import { Store, Product } from '../types';
import { INITIAL_PRODUCTS, MOCK_STORES } from '../constants';

// --- Database Types (matching SQL) ---
interface DBStore {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'general' | 'produce' | 'dairy';
  is_open: boolean;
  rating: number;
}

interface DBInventory {
  product_id: string;
  price: number;
  in_stock: boolean;
}

/**
 * Fetch nearby stores from Supabase.
 * Falls back to MOCK_STORES if DB is empty or error occurs (for MVP robustness).
 */
export const fetchLiveStores = async (lat: number, lng: number): Promise<Store[]> => {
  try {
    // Call the SQL function we created
    const { data: dbStores, error } = await supabase.rpc('get_nearby_stores', {
      lat,
      long: lng,
      radius_km: 10 // 10km radius
    });

    if (error) throw error;

    if (!dbStores || dbStores.length === 0) {
      console.log("No DB stores found, using mock data.");
      return []; // Return empty, let the app fallback or combine
    }

    // Map DB Store to App Store Type
    // We need to fetch inventory IDs for each store to populate 'availableProductIds'
    const storesWithInventory = await Promise.all(dbStores.map(async (store: DBStore) => {
      const { data: invData } = await supabase
        .from('inventory')
        .select('product_id')
        .eq('store_id', store.id)
        .eq('in_stock', true);

      const productIds = invData ? invData.map((i: any) => i.product_id) : [];

      return {
        id: store.id,
        name: store.name,
        address: store.address || '',
        rating: store.rating || 4.5,
        distance: `${calculateDistance(lat, lng, store.lat, store.lng).toFixed(1)} km`,
        lat: store.lat,
        lng: store.lng,
        isOpen: store.is_open,
        type: store.type,
        availableProductIds: productIds.length > 0 ? productIds : [] // If empty, UI handles it or we can fallback
      };
    }));

    return storesWithInventory;

  } catch (error) {
    console.error("Error fetching live stores:", error);
    return [];
  }
};

/**
 * Fetch products for a specific store.
 * Returns a list of Products with STORE-SPECIFIC pricing.
 * Now supports Hybrid: Static Constants + Dynamic DB Products.
 */
export const fetchStoreProducts = async (storeId: string): Promise<Product[]> => {
  try {
    // 1. Get inventory for this store (Price & Stock)
    const { data: inventoryData, error: invError } = await supabase
      .from('inventory')
      .select('product_id, price, in_stock, brand_data')
      .eq('store_id', storeId)
      .eq('in_stock', true);

    if (invError) throw invError;
    
    // Explicitly cast to any[] to avoid 'unknown' type errors
    const inventory = inventoryData as any[] | null;

    if (!inventory || inventory.length === 0) return [];

    // 2. Separate IDs into "Known Static" and "Unknown/Custom"
    const inventoryMap = new Map(inventory.map(i => [i.product_id, i]));
    const allIds = inventory.map(i => i.product_id);
    
    // IDs that exist in our constants
    const staticProductIds = new Set(INITIAL_PRODUCTS.map(p => p.id));
    const customIds = allIds.filter((id: string) => !staticProductIds.has(id));

    // 3. Fetch details for Custom IDs from 'products' table
    let customProducts: Product[] = [];
    if (customIds.length > 0) {
        const { data: dbProducts, error: prodError } = await supabase
            .from('products')
            .select('*')
            .in('id', customIds);
        
        if (!prodError && dbProducts) {
            customProducts = dbProducts.map((p: any) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                emoji: p.image_url || '📦', // Map image_url back to emoji
                price: p.base_price || 0,
                description: p.description,
                brands: [] // Custom products usually generic unless extended
            }));
        }
    }

    // 4. Merge and Map final list
    const finalProducts: Product[] = allIds.map((id: string) => {
        const invItem = inventoryMap.get(id);
        if (!invItem) return null;

        // Try finding in Static
        let baseProduct = INITIAL_PRODUCTS.find(p => p.id === id);
        
        // If not static, try found Custom
        if (!baseProduct) {
            baseProduct = customProducts.find(p => p.id === id);
        }

        if (baseProduct) {
            return {
                ...baseProduct,
                price: invItem.price, // Store Override
                // If inventory has brand_data, we could theoretically merge it here, 
                // but for listing we mainly need the base price.
                // brandDetails are usually used in the details modal or cart.
            };
        }
        return null;
    }).filter(Boolean) as Product[];

    return finalProducts;

  } catch (error) {
    console.error("Error fetching store inventory:", error);
    return [];
  }
};

/**
 * Real-time Subscription to Inventory Changes
 */
export const subscribeToStoreInventory = (storeId: string, onUpdate: () => void) => {
    return supabase
        .channel(`inventory-updates-${storeId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'inventory', filter: `store_id=eq.${storeId}` },
            (payload) => {
                console.log('Real-time inventory update:', payload);
                onUpdate();
            }
        )
        .subscribe();
};

// Helper
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}
