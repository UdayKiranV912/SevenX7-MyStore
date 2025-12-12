
import React, { useState, useEffect, useRef } from 'react';
import { CartItem, DeliveryType, Store, Product } from '../types';
import { MapVisualizer } from './MapVisualizer';
import { INITIAL_PRODUCTS, MOCK_STORES } from '../constants';
import { reverseGeocode } from '../services/locationService';

// --- Helper Component for Row Animation ---
interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, delta: number) => void;
  index: number;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item, onUpdateQuantity, index }) => {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const prevQty = useRef(item.quantity);

  // Determine Savings for display
  const mrp = item.mrp || item.price;
  const savings = (mrp - item.price) * item.quantity;

  useEffect(() => {
    // Trigger animation when quantity changes
    if (prevQty.current !== item.quantity) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 300);
      prevQty.current = item.quantity;
      return () => clearTimeout(timer);
    }
  }, [item.quantity]);

  return (
    <div 
       className={`p-3 pr-4 rounded-2xl shadow-sm flex items-center gap-4 animate-slide-up border transition-all duration-300 ${
           isHighlighted 
             ? 'bg-brand-light border-brand-DEFAULT/30 scale-[1.02] shadow-md' 
             : 'bg-white border-slate-100/50 hover:shadow-md'
       }`}
       style={{ animationDelay: `${index * 50}ms` }}
     >
        {/* Emoji */}
        <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center text-3xl shrink-0 transition-transform duration-300 group-hover:scale-110">
            {item.emoji}
        </div>
        
        {/* Details */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
           <h3 className="font-bold text-slate-800 text-sm truncate leading-tight">{item.name}</h3>
           {item.selectedBrand && item.selectedBrand !== 'Generic' && (
               <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit">{item.selectedBrand}</span>
           )}
           <div className="flex items-center gap-2 mt-0.5">
               <span className="text-xs font-bold text-slate-800">₹{item.price}</span>
               {mrp > item.price && (
                   <span className="text-[10px] text-slate-400 line-through">₹{mrp}</span>
               )}
           </div>
           {savings > 0 && (
               <span className="text-[9px] font-bold text-green-600">Saved ₹{savings}</span>
           )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl">
            <button 
              onClick={() => onUpdateQuantity(item.id, -1)}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-red-500 font-bold transition-all active:scale-90 touch-manipulation"
            >
              −
            </button>
            <span className={`w-6 text-center text-sm font-black text-slate-800 transition-all duration-300 ${isHighlighted ? 'scale-125 text-brand-DEFAULT' : ''}`}>
                {item.quantity}
            </span>
            <button 
              onClick={() => onUpdateQuantity(item.id, 1)}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-brand-DEFAULT font-bold transition-all active:scale-90 touch-manipulation"
            >
              +
            </button>
        </div>
     </div>
  );
};

// --- Helper for Suggestions ---
interface SuggestionsProps {
    suggestions: Product[];
    onAddProduct: (p: Product) => void;
}

const SuggestionsList: React.FC<SuggestionsProps> = ({ suggestions, onAddProduct }) => {
    if (suggestions.length === 0) return null;
    return (
        <div className="mt-4 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3 px-1">You might have missed</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar -mx-2 px-2 snap-x">
                {suggestions.map((product) => (
                    <div key={product.id} className="min-w-[130px] bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col snap-start flex-shrink-0">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl self-center mb-2 shadow-sm">
                            {product.emoji}
                        </div>
                        <div className="font-bold text-slate-800 text-xs truncate mb-1">{product.name}</div>
                        <div className="flex justify-between items-center mt-auto pt-2">
                            <span className="text-xs font-bold text-slate-500">₹{product.price}</span>
                            <button 
                                onClick={() => onAddProduct(product)}
                                className="w-6 h-6 bg-white text-brand-DEFAULT rounded-lg flex items-center justify-center font-bold hover:bg-brand-DEFAULT hover:text-white transition-all shadow-sm active:scale-90 touch-manipulation"
                            >
                                +
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Shared Cart Details Component ---
export interface CartDetailsProps {
  cart: CartItem[];
  onProceedToPay: (details: { deliveryType: DeliveryType; scheduledTime?: string; isPayLater?: boolean; splits: any }) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onAddProduct: (product: Product) => void;
  mode: 'DELIVERY' | 'PICKUP';
  onModeChange: (mode: 'DELIVERY' | 'PICKUP') => void;
  deliveryAddress: string;
  onAddressChange: (address: string) => void;
  activeStore: Store | null;
  stores: Store[]; 
  userLocation: { lat: number; lng: number } | null;
  isPage?: boolean;
  onClose?: () => void;
}

export const CartDetails: React.FC<CartDetailsProps> = ({
  cart,
  onProceedToPay,
  onUpdateQuantity,
  onAddProduct,
  mode,
  onModeChange,
  deliveryAddress,
  onAddressChange,
  activeStore,
  stores,
  userLocation,
  isPage = false,
  onClose
}) => {
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('INSTANT');
  const [scheduledTime, setScheduledTime] = useState('');
  const [minScheduledTime, setMinScheduledTime] = useState('');
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  
  // CONSTANTS
  const MINIMUM_ORDER_VALUE = 1000; 
  const BASE_DELIVERY_FEE = 30;

  const getLocalISO = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000; 
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1); // Minimum 1 hour ahead
    const isoString = getLocalISO(now);
    setMinScheduledTime(isoString);
    if (!scheduledTime) setScheduledTime(isoString);
  }, []);

  // Group Cart Items by Store
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
        if (!groups[item.storeId]) groups[item.storeId] = [];
        groups[item.storeId].push(item);
    });
    return groups;
  }, [cart]);

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const itemsTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const itemsTotalMrp = cart.reduce((acc, item) => acc + ((item.mrp || item.price) * item.quantity), 0);
  const totalSavings = itemsTotalMrp - itemsTotal;
  
  // Calculate Fees
  const numStores = Object.keys(groupedItems).length;
  // If MOV Met (>1000), Delivery is Free (Store Pays). Else Customer pays.
  const isMovMet = itemsTotal >= MINIMUM_ORDER_VALUE;
  
  // Logic: 
  // Delivery Fee is now part of the TOTAL payable to Store.
  // Store will settle with driver later.
  const deliveryFee = mode === 'DELIVERY' ? (isMovMet ? 0 : BASE_DELIVERY_FEE * numStores) : 0;
  
  // Total to Pay ONLINE (To Store) includes delivery fee now
  const onlinePayableTotal = itemsTotal + deliveryFee;

  const isPayLaterAllowed = () => {
      if (deliveryType !== 'SCHEDULED' || !scheduledTime) return false;
      const slotTime = new Date(scheduledTime).getTime();
      const now = new Date().getTime();
      const diffMinutes = (slotTime - now) / 60000;
      return diffMinutes > 45; 
  };

  const handleUseCurrentLocation = async () => {
    setIsLocatingAddress(true);
    let lat = userLocation?.lat;
    let lng = userLocation?.lng;

    if (!lat || !lng) {
        try {
             const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
        } catch (e) {
            alert("Could not access location. Please enter address manually.");
            setIsLocatingAddress(false);
            return;
        }
    }

    if (lat && lng) {
        try {
            const address = await reverseGeocode(lat, lng);
            if (address) {
                onAddressChange(address);
            } else {
                alert("Could not determine address from coordinates.");
            }
        } catch (error) {
            console.error("Geocoding failed", error);
            alert("Network error fetching address.");
        } finally {
            setIsLocatingAddress(false);
        }
    } else {
        setIsLocatingAddress(false);
    }
  };

  const preparePaymentData = (isPayLater: boolean) => {
      // Create the split object for the Payment Gateway / Order Service
      // NOTE: Customer pays full 'onlinePayableTotal' to Store.
      // 'deliveryFee' is passed just for internal record keeping so Store knows they owe Driver.
      const splits = {
          storeAmount: onlinePayableTotal, // Customer pays Items + Delivery to Store
          storeUpi: activeStore?.upiId || 'store@upi',
          handlingFee: 0, 
          adminUpi: 'uday@admin',
          deliveryFee: deliveryFee, // Internal Record
          driverUpi: 'driver@upi'
      };

      onProceedToPay({ 
          deliveryType, 
          scheduledTime, 
          isPayLater,
          splits
      });
  };

  if (cart.length === 0 && isPage) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 animate-fade-in">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-soft text-slate-300 border border-slate-100">
           🛒
        </div>
        <h3 className="text-2xl font-black text-slate-800">Your Cart is Empty</h3>
        <p className="text-slate-400 font-medium mt-2 mb-8 max-w-xs mx-auto">Looks like you haven't added anything yet. Start exploring fresh items!</p>
        <button 
           onClick={onClose}
           className="bg-slate-900 text-white font-bold py-4 px-10 rounded-2xl shadow-lg hover:scale-105 transition-all active:scale-95 touch-manipulation"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  // Determine which stores to show on the map (all stores present in the cart)
  const cartStoreIds = Object.keys(groupedItems);
  const cartStoresForMap = stores.filter(s => cartStoreIds.includes(s.id));
  const mapStores = cartStoresForMap.length > 0 ? cartStoresForMap : (activeStore ? [activeStore] : []);

  return (
    <div className={`flex flex-col h-full ${isPage ? 'bg-[#F8FAFC]' : 'bg-[#F8FAFC]'}`}>
      
      {/* Header (Modal) */}
      {!isPage && (
        <div 
          className="w-full flex justify-center pt-5 pb-3 cursor-pointer bg-white rounded-t-[2.5rem] shadow-soft relative z-20"
          onClick={onClose}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>
      )}

      {/* Header (Title) */}
      <div className={`px-6 pb-6 bg-white/90 backdrop-blur-md flex justify-between items-end sticky top-0 z-10 border-b border-slate-100 ${isPage ? 'pt-8' : ''}`}>
         <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Checkout</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-brand-DEFAULT animate-pulse"></span>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    {mode === 'DELIVERY' ? 'Fast Delivery' : 'Store Pickup'}
                </p>
            </div>
         </div>
         <div className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-xs font-black shadow-inner">
            {totalItems} items
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 hide-scrollbar space-y-6 pb-48">
         
         {/* Map Section */}
         <div className="rounded-[2rem] overflow-hidden shadow-card border border-white h-48 relative">
            <MapVisualizer 
                stores={mapStores}
                userLat={userLocation?.lat || 0}
                userLng={userLocation?.lng || 0}
                selectedStore={activeStore} // Just highlights the last active one
                onSelectStore={() => {}}
                mode={mode}
                showRoute={true} 
                enableExternalNavigation={mode === 'PICKUP'} 
                className="h-full"
            />
         </div>

         {/* GROUPED Order List */}
         <div className="space-y-6">
           {Object.entries(groupedItems).map(([storeId, items]: [string, CartItem[]]) => {
              const storeInfo = items[0]; // Use first item to get store name/type
              // Robust Lookup: Check availableStores first, then fallback to MOCK_STORES static list
              const storeObj = stores.find(s => s.id === storeId) || MOCK_STORES.find(s => s.id === storeId);
              
              // Filter suggestions strictly for THIS store group
              const availableIds = storeObj?.availableProductIds || [];
              const cartIdsInThisStore = new Set(items.map(i => i.originalProductId));
              
              const storeSuggestions = INITIAL_PRODUCTS
                  .filter(p => availableIds.includes(p.id) && !cartIdsInThisStore.has(p.id))
                  .slice(0, 5); // Limit to 5 per store

              const borderColorClass = storeInfo.storeType === 'produce' ? 'border-l-emerald-500' : 
                                       storeInfo.storeType === 'dairy' ? 'border-l-blue-500' : 'border-l-orange-500';

              return (
                  <div key={storeId} className={`bg-white p-5 rounded-[2rem] shadow-sm border-t border-r border-b border-slate-100 border-l-[6px] ${borderColorClass} animate-fade-in-up`}>
                      {/* Store Header */}
                      <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm text-white ${
                               storeInfo.storeType === 'produce' ? 'bg-emerald-500' : 
                               storeInfo.storeType === 'dairy' ? 'bg-blue-500' : 'bg-orange-500'
                           }`}>
                               {storeInfo.storeType === 'produce' ? '🥦' : storeInfo.storeType === 'dairy' ? '🥛' : '🏪'}
                           </div>
                           <div className="flex-1">
                               <h3 className="font-black text-slate-800 text-sm">{storeInfo.storeName}</h3>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">
                                   {items.length} item{items.length !== 1 ? 's' : ''} • {storeObj ? storeObj.distance : 'Nearby'}
                               </p>
                           </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-3">
                          {items.map((item, idx) => (
                            <CartItemRow 
                                key={item.id} 
                                item={item} 
                                index={idx}
                                onUpdateQuantity={onUpdateQuantity}
                            />
                          ))}
                      </div>

                      {/* Store Specific Suggestions */}
                      {storeSuggestions.length > 0 && (
                          <SuggestionsList suggestions={storeSuggestions} onAddProduct={onAddProduct} />
                      )}
                  </div>
              );
           })}
         </div>

         {/* Options Section */}
         <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6 animate-fade-in">
             {/* Delivery Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl">
                <button 
                    onClick={() => onModeChange('DELIVERY')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all touch-manipulation ${mode === 'DELIVERY' ? 'bg-white text-brand-DEFAULT shadow-sm' : 'text-slate-400'}`}
                >
                    Delivery
                </button>
                <button 
                    onClick={() => onModeChange('PICKUP')}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all touch-manipulation ${mode === 'PICKUP' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
                >
                    Pickup
                </button>
            </div>

            {mode === 'DELIVERY' && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-2 pl-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Delivery Address</label>
                        <button 
                            onClick={handleUseCurrentLocation}
                            disabled={isLocatingAddress}
                            className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors touch-manipulation"
                        >
                            {isLocatingAddress ? 'Locating...' : '📍 Use Current Location'}
                        </button>
                    </div>
                    <textarea
                        value={deliveryAddress}
                        onChange={(e) => onAddressChange(e.target.value)}
                        placeholder="Enter full address for delivery..."
                        className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-sm font-bold text-slate-700 placeholder-slate-300 focus:ring-2 focus:ring-brand-DEFAULT focus:bg-white resize-none shadow-inner transition-all"
                        rows={3}
                    />
                </div>
            )}

            {/* Time Slots */}
            <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block pl-1">Timing Preference</label>
                 <div className="grid grid-cols-2 gap-3">
                     <button
                        onClick={() => setDeliveryType('INSTANT')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden touch-manipulation ${deliveryType === 'INSTANT' ? 'border-brand-DEFAULT bg-brand-light' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                     >
                         <div className="text-xl mb-2">⚡</div>
                         <div className="font-bold text-slate-800 text-sm">Instant</div>
                         <div className="text-[10px] font-bold text-slate-500">~{mode === 'DELIVERY' ? '35' : '15'} mins</div>
                     </button>
                     <button
                        onClick={() => setDeliveryType('SCHEDULED')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all touch-manipulation ${deliveryType === 'SCHEDULED' ? 'border-brand-DEFAULT bg-brand-light' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                     >
                         <div className="text-xl mb-2">📅</div>
                         <div className="font-bold text-slate-800 text-sm">Schedule</div>
                         <div className="text-[10px] font-bold text-slate-500">Select Slot</div>
                     </button>
                 </div>
            </div>

            {deliveryType === 'SCHEDULED' && (
                 <div className="animate-fade-in space-y-2">
                    <input 
                      type="datetime-local" 
                      value={scheduledTime}
                      min={minScheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-DEFAULT"
                    />
                    <p className="text-[10px] text-slate-400 px-1">
                        *Payment due 30 mins before scheduled time.
                    </p>
                 </div>
            )}
         </div>

      </div>

      {/* Footer Summary */}
      <div className={`bg-white border-t border-slate-100 p-6 pb-8 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] ${isPage ? 'fixed bottom-24 left-0 right-0 max-w-md mx-auto rounded-t-[2.5rem]' : ''}`}>
         {/* Savings Banner */}
         {totalSavings > 0 && (
             <div className="mb-4 bg-green-50 text-green-700 text-center py-2 rounded-xl text-xs font-black border border-green-100 animate-pulse-glow">
                 You are saving ₹{totalSavings} on this order! 🎉
             </div>
         )}

         {/* Price Breakdown Mini */}
         <div className="mb-4 space-y-1">
             <div className="flex justify-between text-xs text-slate-500">
                 <span className="font-bold text-slate-600">Item Total (MRP)</span>
                 <span className="font-bold text-slate-500 line-through">₹{itemsTotalMrp}</span>
             </div>
             <div className="flex justify-between text-xs text-slate-500">
                 <span className="font-bold text-slate-600">Offer Price</span>
                 <span className="font-black text-slate-800">₹{itemsTotal}</span>
             </div>
             {mode === 'DELIVERY' && (
                 <div className="flex justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-bold text-slate-600">
                        Delivery Fee
                        {isMovMet ? (
                            <span className="bg-brand-light text-brand-dark px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Paid by Store</span>
                        ) : (
                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold">Standard</span>
                        )}
                    </span>
                    <span className={`font-bold ${isMovMet ? 'text-brand-DEFAULT' : 'text-slate-800'}`}>
                        {isMovMet ? 'Free' : `₹${deliveryFee}`}
                    </span>
                 </div>
             )}
         </div>

         <div className="flex justify-between items-end mb-6 pt-3 border-t border-slate-100">
            <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Payable</p>
               <div className="text-3xl font-black text-slate-900 tracking-tight">₹{onlinePayableTotal}</div>
            </div>
            
            {!isMovMet && mode === 'DELIVERY' && (
                <div className="text-right max-w-[120px]">
                    <p className="text-[9px] text-orange-600 font-bold leading-tight bg-orange-50 px-2 py-1 rounded-lg">
                        Add ₹{MINIMUM_ORDER_VALUE - itemsTotal} more for FREE Delivery!
                    </p>
                </div>
            )}
         </div>

         <div className="flex flex-col gap-3">
             {deliveryType === 'SCHEDULED' && isPayLaterAllowed() && (
                 <div className="flex gap-3">
                    <button 
                        onClick={() => preparePaymentData(true)}
                        className="flex-1 py-4 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-black text-sm shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all touch-manipulation"
                    >
                        Pay Later
                        <span className="block text-[9px] font-normal opacity-70">Before 30 mins</span>
                    </button>
                    <button 
                        onClick={() => preparePaymentData(false)}
                        className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-black active:scale-[0.98] transition-all touch-manipulation"
                    >
                        Pay Now
                    </button>
                 </div>
             )}

             {/* Standard Pay Button - High Contrast */}
             {!(deliveryType === 'SCHEDULED' && isPayLaterAllowed()) && (
                <button 
                onClick={() => preparePaymentData(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-black active:scale-[0.98] transition-all flex items-center justify-between px-6 group touch-manipulation ring-1 ring-white/20"
                >
                <span>{deliveryType === 'SCHEDULED' ? 'Pay & Schedule' : `Pay ₹${onlinePayableTotal}`}</span>
                <span className="bg-white/10 p-2 rounded-full group-hover:bg-white group-hover:text-slate-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                </span>
                </button>
             )}
         </div>
      </div>
    </div>
  );
};
