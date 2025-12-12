
import React, { useState, useEffect, useRef } from 'react';
import { UserState, Store, Product, CartItem, Order } from '../../types';
import { MapVisualizer } from '../MapVisualizer';
import { StickerProduct } from '../StickerProduct';
import { CartDetails, CartDetailsProps } from '../CartSheet';
import { ProductDetailsModal } from '../ProductDetailsModal';
import { MyOrders } from '../MyOrders';
import { UserProfile } from '../UserProfile';
import { PaymentGateway } from '../PaymentGateway';
import { fetchLiveStores, fetchStoreProducts, subscribeToStoreInventory } from '../../services/storeService';
import { saveOrder } from '../../services/orderService';
import SevenX7Logo from '../SevenX7Logo';
import { MOCK_STORES } from '../../constants';
import { watchLocation, clearWatch } from '../../services/locationService';

interface CustomerAppProps {
  user: UserState;
  onLogout: () => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({ user, onLogout }) => {
  // Views: 'HOME' (Map+Stores), 'STORE' (Inside a store), 'ORDERS', 'PROFILE', 'CART'
  const [activeView, setActiveView] = useState<'HOME' | 'STORE' | 'ORDERS' | 'PROFILE' | 'CART'>('HOME');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingOrderDetails, setPendingOrderDetails] = useState<any>(null);

  // User Location State - Initialize with user prop, but update live
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(user.location || { lat: 12.9716, lng: 77.5946 });

  // 1. Live Location Tracking (App Level)
  useEffect(() => {
    // If user provided a static location, start there.
    // Then watch for movement.
    const watchId = watchLocation(
        (loc) => {
            setCurrentLocation({ lat: loc.lat, lng: loc.lng });
        },
        (err) => console.log("Location watch silent fail", err)
    );

    return () => {
        if (watchId !== -1) clearWatch(watchId);
    };
  }, []);

  // 2. Load Stores based on Location
  useEffect(() => {
    const lat = currentLocation?.lat || 12.9716;
    const lng = currentLocation?.lng || 77.5946;
    
    const loadStores = async () => {
        setIsLoading(true);
        try {
            let liveStores = await fetchLiveStores(lat, lng);
            if (liveStores.length === 0) {
                 liveStores = MOCK_STORES;
            }
            setStores(liveStores);
        } catch (e) {
            console.error("Store Fetch Failed", e);
            setStores(MOCK_STORES);
        } finally {
            setIsLoading(false);
        }
    };
    
    loadStores();
  }, [currentLocation]); // Re-fetch if location changes significantly? Maybe throttle this in real app.

  // 3. Load Store Products when a Store is Selected
  useEffect(() => {
      if (!selectedStore) return;

      const loadProducts = async () => {
          setIsLoading(true);
          try {
              const products = await fetchStoreProducts(selectedStore.id);
              setStoreProducts(products);
              
              subscribeToStoreInventory(selectedStore.id, () => {
                  fetchStoreProducts(selectedStore.id).then(setStoreProducts);
              });
          } catch (e) {
              console.error(e);
          } finally {
              setIsLoading(false);
          }
      };

      loadProducts();
  }, [selectedStore]);

  // Cart Helpers
  const addToCart = (product: Product, quantity: number = 1, brandName: string = 'Generic', price?: number) => {
    if (!selectedStore) return;
    
    const finalPrice = price || product.price;

    setCart(prev => {
        const existingIdx = prev.findIndex(item => item.originalProductId === product.id && item.selectedBrand === brandName);
        
        if (existingIdx > -1) {
            const newCart = [...prev];
            newCart[existingIdx].quantity += quantity;
            return newCart;
        }

        return [...prev, {
            ...product,
            id: `${product.id}-${brandName}-${Date.now()}`,
            originalProductId: product.id,
            price: finalPrice, 
            quantity,
            selectedBrand: brandName,
            storeId: selectedStore.id,
            storeName: selectedStore.name,
            storeType: selectedStore.type
        }];
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.id === cartItemId) {
              return { ...item, quantity: Math.max(0, item.quantity + delta) };
          }
          return item;
      }).filter(item => item.quantity > 0));
  };

  const handlePlaceOrder = (details: any) => {
      setPendingOrderDetails(details);
      setShowPayment(true);
  };

  const handlePaymentSuccess = async () => {
      if (!pendingOrderDetails) return;
      
      const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const newOrder: Order = {
          id: `ord-${Date.now()}`,
          date: new Date().toISOString(),
          items: cart,
          total: totalAmount,
          status: 'Pending',
          paymentStatus: 'PAID',
          mode: 'DELIVERY',
          deliveryType: pendingOrderDetails.deliveryType,
          scheduledTime: pendingOrderDetails.scheduledTime,
          deliveryAddress: user.address || 'Current Location',
          storeName: cart[0].storeName,
          storeLocation: selectedStore ? { lat: selectedStore.lat, lng: selectedStore.lng } : undefined,
          userLocation: currentLocation || undefined,
          splits: pendingOrderDetails.splits,
          customerName: user.name,
          customerPhone: user.phone
      };

      if (user.id) {
          await saveOrder(user.id, newOrder);
      }

      setCart([]);
      setShowPayment(false);
      setActiveView('ORDERS');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
        
        {/* HEADER */}
        <div className="bg-white px-5 py-4 sticky top-0 z-30 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-2" onClick={() => setActiveView('HOME')}>
                 <SevenX7Logo size="xs" />
             </div>
             <div className="flex items-center gap-3">
                 {/* Location Pill */}
                 <div className="bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5 flex items-center gap-2 max-w-[150px]">
                     <span className="text-emerald-500 text-xs">📍</span>
                     <span className="text-[10px] font-bold text-slate-700 truncate">{user.address || 'Bangalore, India'}</span>
                 </div>
                 {/* Cart Icon */}
                 <button onClick={() => setActiveView('CART')} className="relative p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                     <span className="text-lg">🛒</span>
                     {cart.length > 0 && (
                         <span className="absolute -top-1 -right-1 bg-brand-DEFAULT text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                             {cart.length}
                         </span>
                     )}
                 </button>
             </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="max-w-lg mx-auto">
            
            {/* HOME VIEW: Map & Nearby Stores */}
            {activeView === 'HOME' && (
                <div className="animate-fade-in p-4 space-y-4">
                     {/* Map */}
                     <div className="h-64 rounded-[2.5rem] overflow-hidden shadow-soft-xl relative border-4 border-white">
                         <MapVisualizer 
                             stores={stores}
                             userLat={currentLocation?.lat || null}
                             userLng={currentLocation?.lng || null}
                             selectedStore={null}
                             onSelectStore={(s) => { setSelectedStore(s); setActiveView('STORE'); }}
                             mode="DELIVERY"
                             enableLiveTracking={true}
                         />
                         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-xs font-bold text-slate-800 pointer-events-none">
                             {stores.length} Stores Nearby
                         </div>
                     </div>

                     {/* Stores List */}
                     <div className="space-y-3">
                         <h2 className="font-black text-slate-800 text-lg px-2">Local Marts</h2>
                         {stores.map(store => (
                             <div 
                                key={store.id} 
                                onClick={() => { setSelectedStore(store); setActiveView('STORE'); }}
                                className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                             >
                                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-sm ${
                                     store.type === 'produce' ? 'bg-emerald-500' : 
                                     store.type === 'dairy' ? 'bg-blue-500' : 'bg-orange-500'
                                 }`}>
                                     {store.type === 'produce' ? '🥦' : store.type === 'dairy' ? '🥛' : '🏪'}
                                 </div>
                                 <div className="flex-1">
                                     <h3 className="font-black text-slate-800 text-base">{store.name}</h3>
                                     <p className="text-xs font-bold text-slate-400">{store.distance} • ⭐ {store.rating}</p>
                                     <div className="flex gap-1 mt-2">
                                         {store.type === 'dairy' && <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">Milk & Curd</span>}
                                         {store.type === 'produce' && <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">Fresh Veg</span>}
                                         <span className="text-[9px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded font-bold">Groceries</span>
                                     </div>
                                 </div>
                                 <div className="text-slate-300">➔</div>
                             </div>
                         ))}
                     </div>
                </div>
            )}

            {/* STORE VIEW: Products */}
            {activeView === 'STORE' && selectedStore && (
                <div className="animate-slide-up bg-slate-50 min-h-screen">
                    {/* Store Header */}
                    <div className="bg-white p-6 pb-4 rounded-b-[2.5rem] shadow-sm mb-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 leading-none">{selectedStore.name}</h1>
                                <p className="text-sm text-slate-500 mt-1 font-medium">{selectedStore.address}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`w-2 h-2 rounded-full ${selectedStore.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                    <span className="text-xs font-bold uppercase text-slate-400">{selectedStore.isOpen ? 'Live Inventory' : 'Closed'}</span>
                                </div>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg ${
                                selectedStore.type === 'produce' ? 'bg-emerald-500' : 
                                selectedStore.type === 'dairy' ? 'bg-blue-500' : 'bg-orange-500'
                            }`}>
                                {selectedStore.type === 'produce' ? '🥦' : selectedStore.type === 'dairy' ? '🥛' : '🏪'}
                            </div>
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="p-4 pt-0">
                         {isLoading ? (
                             <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                 <div className="animate-spin text-3xl mb-2">⏳</div>
                                 <p className="text-xs font-bold uppercase">Fetching Fresh Stock...</p>
                             </div>
                         ) : storeProducts.length === 0 ? (
                             <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                                 <div className="text-4xl mb-2">📦</div>
                                 <p className="font-bold">No products available right now.</p>
                             </div>
                         ) : (
                             <div className="grid grid-cols-2 gap-3 pb-24">
                                 {storeProducts.map(product => {
                                     // Calculate count in cart for this product
                                     const count = cart
                                         .filter(c => c.originalProductId === product.id)
                                         .reduce((sum, c) => sum + c.quantity, 0);

                                     return (
                                         <StickerProduct 
                                             key={product.id}
                                             product={product}
                                             count={count}
                                             onAdd={(p) => addToCart(p, 1, 'Generic', p.price)}
                                             onUpdateQuantity={(pid, delta) => {
                                                  // Find specific cart item to update
                                                  const cartItem = cart.find(c => c.originalProductId === pid);
                                                  if(cartItem) updateQuantity(cartItem.id, delta);
                                             }}
                                             onClick={(p) => setSelectedProduct(p)}
                                         />
                                     );
                                 })}
                             </div>
                         )}
                    </div>
                </div>
            )}

            {/* ORDERS VIEW */}
            {activeView === 'ORDERS' && (
                <div className="animate-fade-in min-h-screen bg-slate-50">
                    <MyOrders userLocation={currentLocation} userId={user.id} />
                </div>
            )}

            {/* PROFILE VIEW */}
            {activeView === 'PROFILE' && (
                <UserProfile 
                    user={{...user, location: currentLocation}} 
                    onUpdateUser={(updates) => { /* State lifted or handled by SWR/Context in real app */ }} 
                    onLogout={onLogout} 
                />
            )}

            {/* CART VIEW */}
            {activeView === 'CART' && (
                <div className="absolute inset-0 z-50 bg-white overflow-y-auto">
                    <CartDetails 
                        cart={cart}
                        onProceedToPay={handlePlaceOrder}
                        onUpdateQuantity={updateQuantity}
                        onAddProduct={(p) => addToCart(p, 1, 'Generic', p.price)}
                        mode="DELIVERY"
                        onModeChange={() => {}}
                        deliveryAddress={user.address || ''}
                        onAddressChange={() => {}}
                        activeStore={selectedStore}
                        stores={stores}
                        userLocation={currentLocation}
                        isPage={true}
                        onClose={() => setActiveView('HOME')}
                    />
                </div>
            )}

        </main>

        {/* BOTTOM NAVIGATION */}
        {activeView !== 'CART' && (
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
               {[
                 { id: 'HOME', icon: '🏠', label: 'Shop' },
                 { id: 'ORDERS', icon: '🧾', label: 'Orders' },
                 { id: 'PROFILE', icon: '👤', label: 'You' },
               ].map(item => (
                 <button 
                    key={item.id}
                    onClick={() => setActiveView(item.id as any)}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeView === item.id ? 'text-slate-900' : 'text-slate-400'}`}
                 >
                     <span className={`text-xl transition-transform ${activeView === item.id ? 'scale-110' : ''}`}>{item.icon}</span>
                     <span className="text-[9px] font-bold uppercase tracking-wide">{item.label}</span>
                 </button>
               ))}
            </nav>
        )}

        {/* MODALS */}
        {selectedProduct && (
            <ProductDetailsModal 
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAdd={(p, qty, brand, price) => addToCart(p, qty, brand, price)}
            />
        )}

        {showPayment && pendingOrderDetails && (
            <PaymentGateway 
                amount={pendingOrderDetails.splits.storeAmount}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
                isDemo={user.id === 'demo-user'}
                splits={pendingOrderDetails.splits}
            />
        )}
    </div>
  );
};
