
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, BrandInventoryInfo } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

// 1. Fetch Store Details for the logged-in Owner
export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', ownerId)
      .single();

    if (error) {
       console.warn("getMyStore DB Error (ignoring if no store):", error.message);
       return null;
    }
    if (!data) return null;

    // Fetch available product IDs
    const { data: invData } = await supabase
        .from('inventory')
        .select('product_id')
        .eq('store_id', data.id)
        .eq('in_stock', true);

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      rating: data.rating,
      distance: '', // N/A for owner
      lat: data.lat,
      lng: data.lng,
      isOpen: data.is_open,
      type: data.type,
      availableProductIds: invData ? invData.map((i: any) => i.product_id) : [],
      upiId: data.upi_id,
      ownerId: data.owner_id
    };
  } catch (e) {
    console.error("getMyStore Exception:", e);
    return null;
  }
};

// 1.5 Update Store Profile
export const updateStoreProfile = async (storeId: string, updates: Partial<Store>) => {
  // Map App types to DB types
  const dbUpdates: any = {};
  if (updates.name) dbUpdates.name = updates.name;
  if (updates.address) dbUpdates.address = updates.address;
  if (updates.upiId) dbUpdates.upi_id = updates.upiId;
  if (updates.lat) dbUpdates.lat = updates.lat;
  if (updates.lng) dbUpdates.lng = updates.lng;

  const { error } = await supabase
    .from('stores')
    .update(dbUpdates)
    .eq('id', storeId);

  if (error) throw error;
};

// 2. Fetch Full Inventory (Active + Inactive)
export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  try {
    // Get all existing inventory records
    const { data: dbInv, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('store_id', storeId);

    if (error) {
        console.error("getStoreInventory DB Error:", error.message);
        // Fallback: return catalog
        return INITIAL_PRODUCTS.map(catalogItem => ({
            ...catalogItem,
            inStock: false,
            stock: 0,
            storePrice: catalogItem.price,
            isActive: false,
            brandDetails: {}
        }));
    }

    // Identify which items are custom (not in INITIAL_PRODUCTS)
    const staticIds = new Set(INITIAL_PRODUCTS.map(p => p.id));
    const customIds = dbInv.map((i: any) => i.product_id).filter((id: string) => !staticIds.has(id));

    // Fetch Custom Product Details
    let customProducts: any[] = [];
    if (customIds.length > 0) {
        const { data: dbProds } = await supabase
            .from('products')
            .select('*')
            .in('id', customIds);
        if (dbProds) customProducts = dbProds;
    }

    // 1. Map Global Catalog to Inventory Items
    const catalogInventory = INITIAL_PRODUCTS.map(catalogItem => {
      const dbItem = dbInv?.find((i: any) => i.product_id === catalogItem.id);
      return {
        ...catalogItem,
        inStock: dbItem ? dbItem.in_stock : false,
        stock: dbItem ? (dbItem.stock || 0) : 0,
        storePrice: dbItem ? dbItem.price : catalogItem.price, 
        isActive: !!dbItem, 
        brandDetails: dbItem?.brand_data || {} 
      };
    });

    // 2. Map Custom Items
    const customInventory = customProducts.map(prod => {
        const dbItem = dbInv?.find((i: any) => i.product_id === prod.id);
        return {
            id: prod.id,
            name: prod.name,
            price: prod.base_price,
            mrp: prod.base_price, // Assuming same for custom unless extended
            emoji: prod.image_url || '📦',
            category: prod.category,
            description: prod.description,
            // Inventory fields
            inStock: dbItem ? dbItem.in_stock : true,
            stock: dbItem ? (dbItem.stock || 0) : 0,
            storePrice: dbItem ? dbItem.price : prod.base_price,
            isActive: true, // Custom items are active by default if fetched
            brandDetails: dbItem?.brand_data || {}
        } as InventoryItem;
    });

    return [...customInventory, ...catalogInventory];

  } catch (e) {
      console.error("getStoreInventory Exception:", e);
      return INITIAL_PRODUCTS.map(c => ({
          ...c, 
          inStock: false, 
          stock: 0, 
          storePrice: c.price, 
          isActive: false, 
          brandDetails: {}
      }));
  }
};

// 3. Update Inventory (Price, Stock, InStock, BrandDetails)
export const updateInventoryItem = async (
    storeId: string, 
    productId: string, 
    price: number, 
    inStock: boolean, 
    stock: number,
    brandDetails?: Record<string, BrandInventoryInfo>
) => {
  const { error } = await supabase
    .from('inventory')
    .upsert({
      store_id: storeId,
      product_id: productId,
      price: price,
      in_stock: inStock,
      stock: stock,
      brand_data: brandDetails // Save granular brand info to JSONB column
    }, { onConflict: 'store_id, product_id' });

  if (error) throw error;
};

// 3.5 Create NEW Custom Product & Add to Inventory
export const createCustomProduct = async (storeId: string, product: InventoryItem) => {
    // 1. Insert into Products Table
    const { error: prodError } = await supabase
        .from('products')
        .insert({
            id: product.id,
            name: product.name,
            category: product.category,
            image_url: product.emoji, 
            description: product.description,
            base_price: product.price,
            brands: product.brands // Save brands array to DB
        })
        .select()
        .single();

    if (prodError) {
        console.warn("Could not insert into products table:", prodError.message);
    }

    // 2. Add to Inventory
    await updateInventoryItem(
        storeId, 
        product.id, 
        product.price, 
        product.inStock, 
        product.stock, 
        product.brandDetails
    );
};

// 3.5 Delete Inventory Item (Remove from management list)
export const deleteInventoryItem = async (storeId: string, productId: string) => {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .match({ store_id: storeId, product_id: productId });

  if (error) throw error;
};

// 4. Fetch Incoming Orders for Store
export const getIncomingOrders = async (storeId: string): Promise<Order[]> => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!orders || orders.length === 0) return [];

    // Step 2: Fetch Profiles Manually using IDs from orders
    const customerIds = [...new Set(orders.map((o: any) => o.customer_id).filter(Boolean))];
    const profilesMap: Record<string, any> = {};

    if (customerIds.length > 0) {
        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('id, full_name, phone_number')
            .in('id', customerIds);
        
        if (!profError && profiles) {
            profiles.forEach((p: any) => { profilesMap[p.id] = p; });
        }
    }

    return orders.map((row: any) => ({
      id: row.id,
      date: row.created_at,
      items: row.items,
      total: row.total_amount,
      status: mapDbStatusToAppStatus(row.status),
      paymentStatus: 'PAID', // Assuming paid for MVP
      mode: row.type || 'DELIVERY',
      deliveryType: 'INSTANT',
      storeName: 'My Store',
      userLocation: { lat: row.delivery_lat, lng: row.delivery_lng },
      deliveryAddress: row.delivery_address,
      customerName: profilesMap[row.customer_id]?.full_name || 'Guest',
      customerPhone: profilesMap[row.customer_id]?.phone_number || ''
    }));
  } catch (error: any) {
    console.error("getIncomingOrders Error:", error.message || error);
    return []; // Return empty list instead of crashing
  }
};

// 5. Update Order Status
export const updateStoreOrderStatus = async (orderId: string, status: string) => {
    // Map App Status to DB Enum
    let dbStatus = status.toLowerCase();
    if (status === 'Preparing') dbStatus = 'packing';
    if (status === 'Ready') dbStatus = 'ready';
    if (status === 'Picked Up') dbStatus = 'picked_up';
    if (status === 'On the way') dbStatus = 'on_way';
    if (status === 'Rejected') dbStatus = 'rejected';
    if (status === 'Accepted') dbStatus = 'accepted';

    const { error } = await supabase
        .from('orders')
        .update({ status: dbStatus })
        .eq('id', orderId);
    
    if (error) throw error;
};

// Helper
const mapDbStatusToAppStatus = (dbStatus: string): Order['status'] => {
    switch (dbStatus) {
        case 'placed': return 'Placed'; // Distinct for Store Owner
        case 'accepted': return 'Accepted';
        case 'packing': return 'Preparing';
        case 'ready': return 'Ready';
        case 'on_way': return 'On the way';
        case 'delivered': return 'Delivered';
        case 'picked_up': return 'Picked Up';
        case 'cancelled': return 'Cancelled';
        case 'rejected': return 'Rejected';
        default: return 'Pending';
    }
};
