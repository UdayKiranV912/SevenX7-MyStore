
import React, { useEffect, useState, useRef } from 'react';
import { UserState, Store, Order, InventoryItem, Product, BrandInventoryInfo } from '../../types';
import { getMyStore, getStoreInventory, updateInventoryItem, deleteInventoryItem, getIncomingOrders, updateStoreOrderStatus, updateStoreProfile } from '../../services/storeAdminService';
import { supabase } from '../../services/supabaseClient';
import SevenX7Logo from '../SevenX7Logo';
import { MapVisualizer } from '../MapVisualizer';
import { INITIAL_PRODUCTS } from '../../constants';

interface StoreAppProps {
  user: UserState;
  onLogout: () => void;
}

// Helper to infer unit based on product type
const getProductUnit = (item: Product | InventoryItem): string => {
    const n = item.name.toLowerCase();
    const c = item.category.toLowerCase();
    
    // Liquids
    if (n.includes('milk') || n.includes('curd') || n.includes('yogurt') || n.includes('buttermilk')) return '500 ml';
    if (n.includes('oil') || n.includes('ghee') || n.includes('juice') || n.includes('drink') || n.includes('water') || n.includes('coke') || n.includes('pepsi')) return '1 L';
    
    // Dairy Solids
    if (n.includes('butter')) return '100 g';
    if (n.includes('cheese') || n.includes('paneer')) return '200 g';
    if (n.includes('egg')) return '6 pcs';
    
    // Bakery/Snacks
    if (n.includes('bread') || n.includes('bun')) return '1 pkt';
    if (c.includes('snack') || c.includes('packaged') || n.includes('biscuit') || n.includes('chip') || n.includes('noodle') || n.includes('chocolate') || n.includes('pasta') || n.includes('maggi')) return '1 pkt';
    
    // Spices (usually small packs)
    if (c.includes('spice') || n.includes('powder') || n.includes('masala') || n.includes('cumin') || n.includes('mustard') || n.includes('pepper')) return '100 g';
    
    if (n.includes('ice cream')) return '500 ml';
    
    return '1 kg'; // Default for Veg, Fruits, Staples (Rice, Dal, Sugar, Atta)
};

export const StoreApp: React.FC<StoreAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'ORDERS' | 'PROFILE'>('DASHBOARD');
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<Store>>({});
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  
  // Ref to hold latest location for instant access without re-renders
  const latestLocationRef = useRef<{lat: number; lng: number} | null>(null);

  // Inventory UI State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All'); // New Category Filter
  const [draftPrices, setDraftPrices] = useState<Record<string, number>>({});
  const [draftMrps, setDraftMrps] = useState<Record<string, number>>({});
  const [draftStocks, setDraftStocks] = useState<Record<string, number>>({});

  // Stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'Placed' || o.status === 'Accepted' || o.status === 'Preparing').length;
  
  // Get Categories for Dropdown
  const allCategories = ['All', ...Array.from(new Set(INITIAL_PRODUCTS.map(p => p.category)))];

  // 0. LIVE GPS Tracking (watchPosition) - The Core Logic
  useEffect(() => {
      let watchId: number;
      let demoInterval: any;

      const updateLocation = (lat: number, lng: number) => {
          const newLoc = { lat, lng };
          setUserLocation(newLoc);
          latestLocationRef.current = newLoc;
      };

      const startWatching = () => {
          // DEMO MODE - Simulate movement
          if (user.id === 'demo-user') {
              let baseLat = 12.9716;
              let baseLng = 77.5946;
              updateLocation(baseLat, baseLng); // Set immediately
              
              // Move slightly every 3 seconds to show "Live" effect
              demoInterval = setInterval(() => {
                  baseLat += (Math.random() - 0.5) * 0.0002;
                  baseLng += (Math.random() - 0.5) * 0.0002;
                  updateLocation(baseLat, baseLng);
              }, 3000);
              return;
          }

          // REAL USER - Live GPS
          if (!navigator.geolocation) {
              console.warn("Geolocation not supported");
              return;
          }

          watchId = navigator.geolocation.watchPosition(
              (pos) => {
                  updateLocation(pos.coords.latitude, pos.coords.longitude);
              },
              (err) => {
                  console.warn("GPS Watch Error:", err);
              },
              { 
                  enableHighAccuracy: true, 
                  timeout: 20000, 
                  maximumAge: 0 // Accept fresh positions
              }
          );
      };

      startWatching();

      return () => {
          if (watchId) navigator.geolocation.clearWatch(watchId);
          if (demoInterval) clearInterval(demoInterval);
      };
  }, [user.id]);

  // Helper: Reliable GPS Fetch (for buttons)
  const fetchGpsLocation = async (): Promise<{lat: number, lng: number}> => {
      // 1. Check if we already have a recent location from watcher
      if (latestLocationRef.current) {
          return latestLocationRef.current;
      }

      // 2. If not, force a fetch
      return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
              if (user.id === 'demo-user') return resolve({ lat: 12.9716, lng: 77.5946 });
              return reject(new Error("Geolocation not supported"));
          }
          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  setUserLocation(loc); // Sync state
                  latestLocationRef.current = loc; // Sync ref
                  resolve(loc);
              },
              (err) => {
                  if (user.id === 'demo-user') return resolve({ lat: 12.9716, lng: 77.5946 });
                  reject(err);
              },
              { 
                  enableHighAccuracy: true, 
                  timeout: 10000,
                  maximumAge: 0 
              }
          );
      });
  };

  // 1. Fetch Store Profile
  useEffect(() => {
    const loadStore = async () => {
      if (!user.id) return;
      try {
        setLoading(true);
        let store = await getMyStore(user.id);
        
        // Demo fallback if no store in DB
        if (!store && user.id === 'demo-user') {
            const savedProfile = localStorage.getItem('demo_store_profile');
            if (savedProfile) {
                store = JSON.parse(savedProfile);
            } else {
                store = {
                    id: 'demo-store-1',
                    name: 'My Demo Store',
                    address: 'Indiranagar, Bangalore',
                    rating: 4.8,
                    distance: '0 km',
                    lat: 12.9716,
                    lng: 77.5946,
                    isOpen: true,
                    type: 'general',
                    availableProductIds: [],
                    upiId: 'demo@upi',
                    ownerId: 'demo-user'
                };
            }
        }
        setMyStore(store);
      } catch (e) {
        console.error("Store Init Failed:", e);
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, [user.id]);

  // 2. Data Sync & Realtime Subscriptions (Dependent on myStore)
  useEffect(() => {
    if (!myStore) return;

    // --- DEMO MODE HANDLER ---
    if (user.id === 'demo-user') {
        // Load Inventory from LocalStorage or Default
        const savedInv = localStorage.getItem('demo_store_inventory');
        
        if (savedInv) {
            setInventory(JSON.parse(savedInv));
        } else {
            // Initialize with some random items for demo if empty
            const demoInv = INITIAL_PRODUCTS.map(p => ({
                 ...p,
                 inStock: ['1', '41', '81', '42'].includes(p.id), // Pre-select Rice, Milk, Chips, Curd
                 stock: ['1', '41', '81', '42'].includes(p.id) ? 20 : 0,
                 storePrice: p.price,
                 mrp: p.mrp || p.price,
                 isActive: ['1', '41', '81', '42'].includes(p.id),
                 brandDetails: {} // Init empty
            }));
            setInventory(demoInv);
            localStorage.setItem('demo_store_inventory', JSON.stringify(demoInv));
        }
        
        // Mock Orders
        setOrders([
            {
                id: 'demo-ord-1',
                date: new Date().toISOString(),
                items: [{ ...INITIAL_PRODUCTS[0], quantity: 2, selectedBrand: 'Generic', originalProductId: '1', storeId: 'demo', storeName: 'My Demo Store', storeType: 'general' }],
                total: 120,
                status: 'Placed',
                paymentStatus: 'PAID',
                mode: 'DELIVERY',
                deliveryType: 'INSTANT',
                storeName: 'My Demo Store',
                customerName: 'Rahul Dravid',
                customerPhone: '9876543210',
                deliveryAddress: '12th Main, Indiranagar',
                userLocation: { lat: 12.97, lng: 77.64 }
            }
        ]);
        return; // Skip Supabase logic for Demo
    }

    // --- REAL MODE HANDLER ---
    const fetchData = async () => {
        try {
            const [inv, ords] = await Promise.all([
                getStoreInventory(myStore.id),
                getIncomingOrders(myStore.id)
            ]);
            setInventory(inv);
            setOrders(ords);
        } catch (e) {
            console.error("Error fetching store data:", JSON.stringify(e));
        }
    };
    fetchData();

    // Realtime: Inventory Updates
    const invSub = supabase
        .channel('store-inventory-sync')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'inventory', filter: `store_id=eq.${myStore.id}` }, 
            (payload) => {
                getStoreInventory(myStore.id).then(setInventory);
            }
        )
        .subscribe();

    // Realtime: Order Updates
    const orderSub = supabase
        .channel('store-orders-sync')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${myStore.id}` }, 
            (payload) => {
                 getIncomingOrders(myStore.id).then(setOrders);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(invSub);
        supabase.removeChannel(orderSub);
    };
  }, [myStore, user.id]);

  const handleInventoryUpdate = async (
      product: InventoryItem, 
      newPrice: number, 
      newStockStatus: boolean, 
      newStockQty: number, 
      newMrp?: number,
      newBrandDetails?: Record<string, BrandInventoryInfo>
  ) => {
      if (!myStore) return;
      
      const finalMrp = newMrp !== undefined ? newMrp : (product.mrp || product.price);
      const finalPrice = newPrice !== undefined ? newPrice : product.storePrice;
      const finalBrandDetails = newBrandDetails || product.brandDetails || {};

      // 1. Optimistic Update (Immediate UI feedback)
      const updatedInventory = inventory.map(item => 
          item.id === product.id 
            ? { 
                ...item, 
                storePrice: finalPrice, 
                mrp: finalMrp, 
                inStock: newStockStatus, 
                stock: newStockQty, 
                isActive: true,
                brandDetails: finalBrandDetails
              } 
            : item
      );
      setInventory(updatedInventory);
      
      // Clear drafts if adding
      if (newStockStatus) {
         setDraftPrices(prev => { const next = {...prev}; delete next[product.id]; return next; });
         setDraftMrps(prev => { const next = {...prev}; delete next[product.id]; return next; });
         setDraftStocks(prev => { const next = {...prev}; delete next[product.id]; return next; });
      }

      // 2. Persist
      if (user.id === 'demo-user') {
          // Save to LocalStorage for Demo persistence
          localStorage.setItem('demo_store_inventory', JSON.stringify(updatedInventory));
          return;
      }

      // 3. Persist to DB (Triggers Realtime event for Customers)
      try {
          await updateInventoryItem(myStore.id, product.id, finalPrice, newStockStatus, newStockQty, finalBrandDetails);
      } catch (e) {
          console.error("Failed to update inventory:", e);
      }
  };

  const handleBrandInventoryUpdate = (
      product: InventoryItem,
      brandName: string,
      field: keyof BrandInventoryInfo,
      value: any
  ) => {
      const currentDetails = product.brandDetails || {};
      const brandInfo = currentDetails[brandName] || {
          price: product.storePrice,
          mrp: product.brands?.find(b => b.name === brandName)?.price || product.mrp || product.price,
          stock: 0,
          inStock: true
      };

      const updatedBrandInfo = { ...brandInfo, [field]: value };
      const newBrandDetails = { ...currentDetails, [brandName]: updatedBrandInfo };
      
      // Auto-calculate total stock if updating brand stock
      let newTotalStock = product.stock;
      if (field === 'stock' || field === 'inStock') {
          // Sum up all stocks from brandDetails, ensuring we include the one being updated
          newTotalStock = Object.values(newBrandDetails).reduce((sum, b) => sum + (b.inStock ? b.stock : 0), 0);
      }

      handleInventoryUpdate(product, product.storePrice, product.inStock, newTotalStock, product.mrp, newBrandDetails);
  };

  const handleDeleteItem = async (product: InventoryItem) => {
      if (!myStore) return;

      // Optimistic Remove from "My Inventory" list
      const updatedInventory = inventory.map(item => 
          item.id === product.id 
            ? { ...item, isActive: false, inStock: false, stock: 0 } 
            : item
      );
      setInventory(updatedInventory);

      if (user.id === 'demo-user') {
          localStorage.setItem('demo_store_inventory', JSON.stringify(updatedInventory));
          return;
      }

      try {
          await deleteInventoryItem(myStore.id, product.id);
      } catch (e) {
          console.error("Failed to delete item:", e);
          // Revert on failure
          setInventory(prev => prev.map(item => item.id === product.id ? { ...item, isActive: true } : item));
      }
  };

  const handleOrderStatus = async (orderId: string, status: string) => {
      try {
          if (user.id === 'demo-user') {
              setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as any } : o));
              return;
          }

          await updateStoreOrderStatus(orderId, status);
          if (myStore) getIncomingOrders(myStore.id).then(setOrders);
      } catch (e) {
          alert("Failed to update status");
      }
  };

  const startEditingProfile = () => {
      if (!myStore) return;
      setProfileForm({
          name: myStore.name,
          address: myStore.address,
          upiId: myStore.upiId,
          lat: myStore.lat,
          lng: myStore.lng
      });
      setIsEditingProfile(true);
  };

  // Handler for Map Visualizer's "Locate Me" button (passed to visualizer)
  const handleMapLocationRequest = async () => {
      setIsLocating(true);
      try {
          const loc = await fetchGpsLocation();
          setUserLocation(loc); // Update map
      } catch (e) {
          alert("Could not detect live location. Please enable GPS.");
      } finally {
          setIsLocating(false);
      }
  };

  // Handler for Manual Pin Drop on Map
  const handleMapClick = async (lat: number, lng: number) => {
      setProfileForm(prev => ({ ...prev, lat, lng }));
      // Optional: Auto-reverse geocode on pin drop
      try {
         const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
         const data = await res.json();
         if (data && data.display_name) {
             setProfileForm(prev => ({ ...prev, address: data.display_name }));
         }
      } catch(e) {
          console.warn("Reverse geocode failed", e);
      }
  };

  // Handler for "Use Current Location" in Profile Form
  const handleGPSLocation = async () => {
      setIsLocating(true);
      try {
          const loc = await fetchGpsLocation();
          
          // Update Map Dot
          setUserLocation(loc);
          
          // Update Form Coords
          setProfileForm(prev => ({ ...prev, lat: loc.lat, lng: loc.lng }));

          // Reverse Geocode
          let address = profileForm.address;
          try {
             const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}`);
             const data = await res.json();
             if (data && data.display_name) address = data.display_name;
          } catch(e) {
              console.warn("Reverse geocode failed", e);
          }

          setProfileForm(prev => ({
              ...prev,
              address: address || prev.address
          }));

      } catch (e: any) {
          console.error("Location Error:", e);
          let msg = "Could not access location.";
          if (e.code === 1) msg = "Location permission denied. Please enable in settings.";
          alert(msg);
      } finally {
          setIsLocating(false);
      }
  };

  const saveProfile = async () => {
      if (!myStore || !profileForm.name || !profileForm.address) return;
      
      const updatedStore = { ...myStore, ...profileForm } as Store;
      
      // Update UI immediately
      setMyStore(updatedStore);

      if (user.id === 'demo-user') {
          localStorage.setItem('demo_store_profile', JSON.stringify(updatedStore));
          setIsEditingProfile(false);
          return;
      }

      try {
          await updateStoreProfile(myStore.id, profileForm);
          setIsEditingProfile(false);
      } catch (e) {
          alert("Failed to update profile");
      }
  };

  // Filter lists for Inventory Tab
  const managedInventory = inventory.filter(i => i.isActive);
  
  const catalogItems = inventory.filter(i => 
    !i.isActive && 
    (selectedCategory === 'All' || i.category === selectedCategory) &&
    (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     i.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Compute the store object to show on the map (Preview mode during edit)
  const mapStore = isEditingProfile && myStore 
      ? { ...myStore, ...profileForm } as Store 
      : myStore;

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin text-4xl">⏳</div></div>;
  }

  if (!myStore) {
    return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
            <h2 className="text-2xl font-black text-slate-800">No Store Found</h2>
            <p className="text-slate-500 mb-6">Your account is registered as a partner, but no store is linked. Please contact Admin.</p>
            <button onClick={onLogout} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold">Logout</button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* HEADER */}
      <header className="bg-white px-6 py-4 shadow-sm sticky top-0 z-30">
         <div className="flex justify-between items-center">
             <div>
                 <h1 className="text-xl font-black text-slate-900">MyStore</h1>
                 <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${user.id === 'demo-user' ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                    <p className="text-xs font-bold text-slate-500 uppercase">
                        {myStore.name} {user.id === 'demo-user' && '(Demo)'}
                    </p>
                 </div>
             </div>
             <div className="text-right">
                 <SevenX7Logo size="xs" />
             </div>
         </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'DASHBOARD' && (
            <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Today's Revenue</p>
                        <p className="text-2xl font-black text-emerald-600">₹{totalRevenue}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Active Orders</p>
                        <p className="text-2xl font-black text-blue-600">{pendingOrders}</p>
                    </div>
                </div>

                <div className="bg-emerald-900 text-white p-6 rounded-[2rem] relative overflow-hidden shadow-lg">
                    <div className="relative z-10">
                        <h3 className="font-bold text-lg mb-1">Store Status</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-black">{myStore.isOpen ? 'ONLINE' : 'OFFLINE'}</span>
                            <div className={`w-4 h-4 rounded-full ${myStore.isOpen ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'bg-red-400'}`}></div>
                        </div>
                        <p className="text-emerald-200 text-xs mt-2 opacity-80">Visible to customers in Grocesphere App</p>
                    </div>
                    <div className="absolute -right-5 -bottom-5 text-8xl opacity-10">🏪</div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mt-4">
                     <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setActiveTab('INVENTORY')} className="p-4 bg-slate-50 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-sm">Update Stock</button>
                        <button onClick={() => setActiveTab('ORDERS')} className="p-4 bg-slate-50 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-sm">View Orders</button>
                     </div>
                </div>
            </div>
        )}

        {/* INVENTORY TAB - RESTRUCTURED FOR MOBILE UI */}
        {activeTab === 'INVENTORY' && (
            <div className="animate-fade-in pb-16">
                {!showAddProduct ? (
                    <div className="space-y-4">
                        {/* Improved Header */}
                        <div className="sticky top-[72px] z-20 bg-slate-50 pt-2 pb-2 -mx-4 px-4">
                             <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-soft border border-slate-100">
                                <div>
                                    <h2 className="font-black text-slate-900 text-lg">Inventory</h2>
                                    <p className="text-xs text-slate-400 font-bold">{managedInventory.length} Active Items</p>
                                </div>
                                <button 
                                  onClick={() => { setSearchTerm(''); setShowAddProduct(true); }}
                                  className="bg-slate-900 text-white pl-4 pr-5 py-3 rounded-2xl flex items-center justify-center shadow-lg hover:bg-black transition-all active:scale-95 gap-2"
                                  title="Add Item"
                                >
                                  <span className="text-xl font-light leading-none">+</span>
                                  <span className="text-xs font-bold">ADD NEW</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            {managedInventory.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 mx-2">
                                    <div className="text-4xl mb-3 opacity-30">📦</div>
                                    <p className="text-slate-400 font-bold mb-4 text-sm">Your shelf is empty!</p>
                                    <button onClick={() => setShowAddProduct(true)} className="text-brand-DEFAULT font-black text-xs uppercase px-4 py-2 bg-brand-light rounded-xl hover:bg-brand-light/70 transition-colors">Start Adding Products</button>
                                </div>
                            ) : (
                                managedInventory.map((item) => (
                                    <div key={item.id} className={`bg-white rounded-[1.8rem] shadow-sm border overflow-hidden transition-all ${item.inStock ? 'border-slate-100 shadow-card' : 'border-slate-100 opacity-80 grayscale-[0.5]'}`}>
                                        
                                        {/* Card Header Section */}
                                        <div className="p-4 flex items-start gap-4">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-100 shrink-0">
                                                {item.emoji}
                                            </div>
                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-black text-slate-800 text-base truncate pr-2">{item.name}</h3>
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md uppercase tracking-wide inline-block mt-1">{item.category}</span>
                                                        
                                                        {/* Brand Dropdown - Detailed & Editable */}
                                                        {item.brands && item.brands.length > 0 && (
                                                            <details className="mt-3 w-full group">
                                                                <summary className="list-none cursor-pointer">
                                                                     <div className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl px-3 py-2 flex items-center justify-between transition-colors">
                                                                          <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                                                              <span>🏷️</span>
                                                                              {item.brands.length} Brands Available
                                                                          </span>
                                                                          <span className="text-[10px] text-slate-400 transition-transform group-open:rotate-180">▼</span>
                                                                     </div>
                                                                </summary>
                                                                <div className="mt-2 space-y-3 pl-1 animate-fade-in">
                                                                     {item.brands.map((brand, bIdx) => {
                                                                         const bDetail = item.brandDetails?.[brand.name] || {
                                                                             price: item.storePrice, 
                                                                             mrp: brand.price,
                                                                             stock: 0,
                                                                             inStock: true
                                                                         };

                                                                         return (
                                                                             <div key={bIdx} className="bg-white px-3 py-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                                                                  <div className="flex justify-between items-center border-b border-slate-50 pb-2 mb-1">
                                                                                      <div>
                                                                                          <p className="text-xs font-black text-slate-800">{brand.name}</p>
                                                                                          <p className="text-[9px] font-bold text-slate-400 bg-slate-50 inline-block px-1.5 rounded mt-0.5">Unit: {getProductUnit(item)}</p>
                                                                                      </div>
                                                                                      {/* Brand Active Toggle */}
                                                                                      <button 
                                                                                           onClick={() => handleBrandInventoryUpdate(item, brand.name, 'inStock', !bDetail.inStock)}
                                                                                           className={`relative h-5 w-9 rounded-full transition-all duration-300 ${bDetail.inStock ? 'bg-green-500' : 'bg-slate-200'}`}
                                                                                      >
                                                                                           <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ml-0.5 ${bDetail.inStock ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                                                      </button>
                                                                                  </div>
                                                                                  
                                                                                  {/* Brand Inputs */}
                                                                                  <div className={`grid grid-cols-3 gap-2 ${!bDetail.inStock ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                                      <div>
                                                                                          <label className="text-[8px] font-bold text-slate-400 uppercase">Offer Price</label>
                                                                                          <input 
                                                                                              type="number" 
                                                                                              value={bDetail.price}
                                                                                              onChange={(e) => handleBrandInventoryUpdate(item, brand.name, 'price', parseFloat(e.target.value))}
                                                                                              className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-DEFAULT"
                                                                                          />
                                                                                      </div>
                                                                                      <div>
                                                                                          <label className="text-[8px] font-bold text-slate-400 uppercase">MRP</label>
                                                                                          <input 
                                                                                              type="number" 
                                                                                              value={bDetail.mrp}
                                                                                              onChange={(e) => handleBrandInventoryUpdate(item, brand.name, 'mrp', parseFloat(e.target.value))}
                                                                                              className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 outline-none focus:ring-1 focus:ring-brand-DEFAULT"
                                                                                          />
                                                                                      </div>
                                                                                      <div>
                                                                                          <label className="text-[8px] font-bold text-slate-400 uppercase">Stock Qty</label>
                                                                                          <input 
                                                                                              type="number" 
                                                                                              value={bDetail.stock}
                                                                                              onChange={(e) => handleBrandInventoryUpdate(item, brand.name, 'stock', parseInt(e.target.value))}
                                                                                              className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 text-xs font-black text-center text-slate-800 outline-none focus:ring-1 focus:ring-brand-DEFAULT"
                                                                                          />
                                                                                      </div>
                                                                                  </div>
                                                                             </div>
                                                                         );
                                                                     })}
                                                                </div>
                                                            </details>
                                                        )}
                                                        {(!item.brands || item.brands.length === 0) && (
                                                             <div className="mt-2">
                                                                 <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                                                     Qty: {getProductUnit(item)}
                                                                 </span>
                                                             </div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Status Toggle - Large for Touch */}
                                                    <button 
                                                        onClick={() => handleInventoryUpdate(item, item.storePrice, !item.inStock, item.stock, item.mrp)}
                                                        className={`relative h-8 w-14 rounded-full transition-all duration-300 flex items-center shadow-inner shrink-0 ${item.inStock ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                                    >
                                                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ml-1 ${item.inStock ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Edit Inputs Section - Grouped with background (Only show if NO brands, otherwise brand controls override) */}
                                        {(!item.brands || item.brands.length === 0) && (
                                            <div className="px-4 pb-4">
                                                <div className="bg-slate-50 rounded-2xl p-3 grid grid-cols-3 gap-3 border border-slate-100/50">
                                                    {/* Price Input */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase pl-1">Your Price</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                                            <input 
                                                                type="number" 
                                                                value={item.storePrice} 
                                                                onChange={(e) => handleInventoryUpdate(item, parseFloat(e.target.value) || 0, item.inStock, item.stock, item.mrp)}
                                                                className="w-full pl-5 pr-2 py-2.5 bg-white rounded-xl text-sm font-bold text-slate-800 outline-none border border-slate-200 focus:border-brand-DEFAULT focus:ring-2 focus:ring-brand-light transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* MRP Input */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase pl-1">MRP</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                                            <input 
                                                                type="number" 
                                                                value={item.mrp || item.price} 
                                                                onChange={(e) => handleInventoryUpdate(item, item.storePrice, item.inStock, item.stock, parseFloat(e.target.value) || 0)}
                                                                className="w-full pl-5 pr-2 py-2.5 bg-white rounded-xl text-sm font-bold text-slate-500 outline-none border border-slate-200 focus:border-brand-DEFAULT focus:ring-2 focus:ring-brand-light transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Qty Input */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase pl-1">Stock Qty</label>
                                                        <input 
                                                            type="number" 
                                                            value={item.stock} 
                                                            onChange={(e) => handleInventoryUpdate(item, item.storePrice, item.inStock, parseInt(e.target.value) || 0, item.mrp)}
                                                            className="w-full py-2.5 bg-white rounded-xl text-sm font-bold text-center text-slate-800 outline-none border border-slate-200 focus:border-brand-DEFAULT focus:ring-2 focus:ring-brand-light transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer Actions */}
                                        <div className="flex justify-between items-center mt-3 pl-6 pr-4 pb-4">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${item.inStock ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {item.inStock ? '● Live Online' : '○ Currently Offline'}
                                            </span>
                                            <button 
                                                onClick={() => handleDeleteItem(item)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Remove Item"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    // CATALOG ADD VIEW
                    <div className="space-y-4 animate-slide-up bg-white min-h-[80vh] rounded-t-[2.5rem] shadow-soft-xl p-5 -mx-4 -mt-4 relative z-50">
                        <div className="flex items-center gap-3 mb-6">
                            <button onClick={() => { setShowAddProduct(false); setSearchTerm(''); setSelectedCategory('All'); }} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h2 className="text-xl font-black text-slate-900">Add Products</h2>
                        </div>

                        <div className="sticky top-0 bg-white z-10 pb-2">
                            {/* Search */}
                            <div className="relative mb-3">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                <input 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search global catalog..."
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-DEFAULT outline-none transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Category Dropdown Filter */}
                            <div className="relative">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border-none rounded-2xl py-3 pl-4 pr-10 font-bold text-slate-600 text-sm focus:ring-2 focus:ring-brand-DEFAULT outline-none cursor-pointer"
                                >
                                    {allCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat} ({cat === 'All' ? INITIAL_PRODUCTS.length : INITIAL_PRODUCTS.filter(p => p.category === cat).length})</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                                    ▼
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pb-24 pt-2">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 mb-2">
                                {selectedCategory === 'All' ? 'All Items' : selectedCategory}
                            </h3>
                            {catalogItems.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    {searchTerm ? 'No matching items found' : 'Start typing to search...'}
                                </div>
                            ) : (
                                catalogItems.map(item => {
                                    const displayPrice = draftPrices[item.id] !== undefined ? draftPrices[item.id] : item.storePrice;
                                    const displayMrp = draftMrps[item.id] !== undefined ? draftMrps[item.id] : (item.mrp || item.price);
                                    const displayStock = draftStocks[item.id] !== undefined ? draftStocks[item.id] : 10;
                                    
                                    return (
                                        <div key={item.id} className="bg-white p-4 rounded-[1.5rem] shadow-card border border-slate-50 flex flex-col gap-3 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="text-3xl w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner border border-slate-100">{item.emoji}</div>
                                                <div>
                                                    <div className="font-black text-slate-800 text-base">{item.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{item.category}</div>
                                                    
                                                    {/* Brands Info (Detailed for Catalog) */}
                                                    {item.brands && item.brands.length > 0 ? (
                                                         <div className="mt-2 text-xs text-slate-500">
                                                             <div className="flex flex-wrap gap-1">
                                                                 {item.brands.map((b,i) => (
                                                                     <span key={i} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600">{b.name}</span>
                                                                 ))}
                                                             </div>
                                                             <p className="mt-1 text-[10px] text-brand-DEFAULT font-bold bg-brand-light inline-block px-1.5 rounded">Configure brands after adding</p>
                                                         </div>
                                                    ) : (
                                                        <div className="mt-1">
                                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">Qty: {getProductUnit(item)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Quick Config Row (Only for non-branded, branded needs detailed config in inventory tab) */}
                                            {(!item.brands || item.brands.length === 0) && (
                                                <div className="bg-slate-50 rounded-xl p-2 flex gap-2 overflow-x-auto hide-scrollbar">
                                                    <div className="flex-1 min-w-[70px]">
                                                        <label className="text-[8px] font-bold text-slate-400 uppercase block pl-1">Price</label>
                                                        <input 
                                                            type="number"
                                                            value={displayPrice}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                setDraftPrices(prev => ({...prev, [item.id]: isNaN(val) ? 0 : val}));
                                                            }}
                                                            className="w-full bg-white rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 border border-slate-200 outline-none focus:border-brand-DEFAULT"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-[70px]">
                                                        <label className="text-[8px] font-bold text-slate-400 uppercase block pl-1">MRP</label>
                                                        <input 
                                                            type="number"
                                                            value={displayMrp}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                setDraftMrps(prev => ({...prev, [item.id]: isNaN(val) ? 0 : val}));
                                                            }}
                                                            className="w-full bg-white rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 border border-slate-200 outline-none focus:border-brand-DEFAULT"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-[60px]">
                                                        <label className="text-[8px] font-bold text-slate-400 uppercase block pl-1">Qty</label>
                                                        <input 
                                                            type="number"
                                                            value={displayStock}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                setDraftStocks(prev => ({...prev, [item.id]: isNaN(val) ? 0 : val}));
                                                            }}
                                                            className="w-full bg-white rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 border border-slate-200 outline-none focus:border-brand-DEFAULT text-center"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <button 
                                                onClick={() => handleInventoryUpdate(item, displayPrice, true, displayStock, displayMrp)}
                                                className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-black shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex justify-center items-center gap-2"
                                            >
                                                <span>ADD TO STORE</span>
                                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">+</span>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'ORDERS' && (
            <div className="space-y-4 animate-fade-in pb-24">
                <h2 className="font-black text-slate-800 text-lg">Live Orders</h2>
                {orders.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        No active orders right now
                    </div>
                ) : (
                    orders.map(order => (
                        <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                             <div className="flex justify-between items-start mb-3">
                                 <div>
                                     <h3 className="font-black text-slate-800">Order #{order.id.slice(0,4)}</h3>
                                     <p className="text-xs font-bold text-slate-500">{order.customerName} • {order.customerPhone}</p>
                                     <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{order.deliveryType} Delivery</p>
                                 </div>
                                 <span className={`px-2 py-1 rounded-lg text-xs font-black uppercase ${
                                     order.status === 'Placed' ? 'bg-yellow-100 text-yellow-800' : 
                                     order.status === 'Ready' ? 'bg-green-100 text-green-800' :
                                     'bg-blue-50 text-blue-700'
                                 }`}>{order.status}</span>
                             </div>
                             
                             <div className="bg-slate-50 p-3 rounded-xl mb-4 space-y-1">
                                 {order.items.map((item, i) => (
                                     <div key={i} className="flex justify-between text-sm">
                                         <span className="text-slate-600 font-medium">{item.quantity} x {item.name} {item.selectedBrand && item.selectedBrand !== 'Generic' ? `(${item.selectedBrand})` : ''}</span>
                                         <span className="font-bold text-slate-800">₹{item.price * item.quantity}</span>
                                     </div>
                                 ))}
                                 <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between font-black text-slate-900">
                                     <span>Total</span>
                                     <span>₹{order.total}</span>
                                 </div>
                             </div>
                             
                             {order.deliveryAddress && (
                                 <div className="mb-4 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                                     <span className="font-bold text-slate-700">Deliver to: </span>
                                     {order.deliveryAddress}
                                 </div>
                             )}

                             <div className="flex gap-2">
                                 {order.status === 'Placed' && (
                                     <>
                                        <button onClick={() => handleOrderStatus(order.id, 'Rejected')} className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100">Reject</button>
                                        <button onClick={() => handleOrderStatus(order.id, 'Accepted')} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-black">Accept</button>
                                     </>
                                 )}
                                 {order.status === 'Accepted' && (
                                     <button onClick={() => handleOrderStatus(order.id, 'Preparing')} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700">Start Packing</button>
                                 )}
                                 {order.status === 'Preparing' && (
                                     <button onClick={() => handleOrderStatus(order.id, 'Ready')} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700">Mark Ready</button>
                                 )}
                                 {order.status === 'Ready' && (
                                     <button onClick={() => handleOrderStatus(order.id, 'Picked Up')} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900">Handover / Pickup</button>
                                 )}
                             </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'PROFILE' && (
            <div className="space-y-6 animate-fade-in">
                 {!isEditingProfile ? (
                     <>
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-card text-center">
                            <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl border-4 border-white shadow-sm">🏪</div>
                            <h2 className="text-xl font-black text-slate-900">{myStore.name}</h2>
                            <p className="text-slate-500 text-sm mb-4">{myStore.address}</p>
                            
                            <div className="flex justify-center gap-2 mb-6">
                                <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">UPI: {myStore.upiId}</span>
                                <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">ID: {myStore.id.slice(0,6)}...</span>
                            </div>

                            <button onClick={startEditingProfile} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-black transition-colors">
                                Edit Profile
                            </button>
                        </div>

                        {/* Map Section */}
                        <div className="h-48 rounded-[2rem] overflow-hidden shadow-md border border-white">
                            <MapVisualizer 
                                stores={[myStore]} 
                                userLat={userLocation?.lat || null} 
                                userLng={userLocation?.lng || null}
                                selectedStore={myStore}
                                onSelectStore={() => {}}
                                mode="PICKUP" 
                                showRoute={false}
                                onRequestLocation={handleMapLocationRequest}
                            />
                        </div>
                     </>
                 ) : (
                     <div className="bg-white p-6 rounded-[2.5rem] shadow-card space-y-4 animate-scale-in">
                        <h3 className="text-lg font-black text-slate-800 text-center mb-2">Edit Store Profile</h3>
                        
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Store Name</label>
                            <input 
                                value={profileForm.name || ''}
                                onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                                className="w-full bg-slate-50 p-3 rounded-xl font-bold text-slate-800 outline-none border border-transparent focus:border-brand-DEFAULT"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Store Address</label>
                                <button 
                                    onClick={handleGPSLocation}
                                    disabled={isLocating}
                                    className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors"
                                >
                                    {isLocating ? (
                                        <>
                                            <span className="animate-spin w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full block"></span>
                                            <span>Locating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>📍</span>
                                            <span>Use Current Location</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <textarea 
                                value={profileForm.address || ''}
                                onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                                className="w-full bg-slate-50 p-3 rounded-xl font-bold text-slate-800 outline-none border border-transparent focus:border-brand-DEFAULT h-24 resize-none"
                            />
                        </div>

                        {/* Map Preview of Edited Location */}
                        {(profileForm.lat && profileForm.lng) && (
                            <div className="h-48 rounded-xl overflow-hidden shadow-inner border border-slate-100 mb-2 relative">
                                <MapVisualizer 
                                    stores={[mapStore as Store]} 
                                    userLat={userLocation?.lat || null} 
                                    userLng={userLocation?.lng || null}
                                    selectedStore={mapStore as Store}
                                    onSelectStore={() => {}}
                                    mode="PICKUP" 
                                    showRoute={false}
                                    onRequestLocation={handleMapLocationRequest}
                                    onMapClick={handleMapClick}
                                />
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 shadow-sm z-[1000] pointer-events-none">
                                    Tap map to refine location
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">UPI ID</label>
                            <input 
                                value={profileForm.upiId || ''}
                                onChange={e => setProfileForm({...profileForm, upiId: e.target.value})}
                                className="w-full bg-slate-50 p-3 rounded-xl font-bold text-slate-800 outline-none border border-transparent focus:border-brand-DEFAULT"
                            />
                        </div>
                        
                        {profileForm.lat && (
                            <div className="text-[10px] text-slate-400 font-mono text-center bg-slate-50 py-1 rounded-lg">
                                Coords: {profileForm.lat.toFixed(4)}, {profileForm.lng?.toFixed(4)}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-3 bg-slate-100 font-bold text-slate-500 rounded-xl">Cancel</button>
                            <button onClick={saveProfile} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg">Save Changes</button>
                        </div>
                     </div>
                 )}

                 <button onClick={onLogout} className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl border border-red-100">Log Out</button>
            </div>
        )}

      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
           {[
             { id: 'DASHBOARD', icon: '📊', label: 'Stats' },
             { id: 'ORDERS', icon: '🔔', label: 'Orders' },
             { id: 'INVENTORY', icon: '📦', label: 'Items' },
             { id: 'PROFILE', icon: '🏪', label: 'Profile' },
           ].map(item => (
             <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === item.id ? 'text-slate-900' : 'text-slate-400'}`}
             >
                 <span className={`text-xl transition-transform ${activeTab === item.id ? 'scale-110' : ''}`}>{item.icon}</span>
                 <span className="text-[9px] font-bold uppercase tracking-wide">{item.label}</span>
             </button>
           ))}
      </nav>
    </div>
  );
};
