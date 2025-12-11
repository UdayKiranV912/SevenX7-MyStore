
import React, { useEffect, useState } from 'react';
import { Order, Store, OrderMode } from '../types';
import { MapVisualizer } from './MapVisualizer';
import { getUserOrders, subscribeToUserOrders } from '../services/orderService';

interface MyOrdersProps {
  userLocation: { lat: number; lng: number } | null;
  onPayNow?: (order: Order) => void;
  userId?: string;
}

export const MyOrders: React.FC<MyOrdersProps> = ({ userLocation, onPayNow, userId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch Orders on Mount or userId change
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        if (userId === 'demo-user') {
          // Demo Mode: Load from Local Storage
          const savedOrders = localStorage.getItem('grocesphere_orders');
          if (savedOrders) {
              setOrders(JSON.parse(savedOrders));
          } else {
              setOrders([]);
          }
        } else if (userId) {
          // Registered Mode: Load from Supabase DB
          const dbOrders = await getUserOrders(userId);
          setOrders(dbOrders);
        }
      } catch (error) {
        console.error("Failed to load orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // REAL-TIME SUBSCRIPTION
    let subscription: any = null;
    if (userId && userId !== 'demo-user') {
        subscription = subscribeToUserOrders(userId, (updatedOrderDb) => {
            setOrders(prev => prev.map(o => {
                if (o.id === updatedOrderDb.id) {
                    // Map DB status to App Status
                    let appStatus: Order['status'] = 'Pending';
                    if (updatedOrderDb.status === 'packing') appStatus = 'Preparing';
                    if (updatedOrderDb.status === 'ready') appStatus = 'Ready';
                    if (updatedOrderDb.status === 'on_way') appStatus = 'On the way';
                    if (updatedOrderDb.status === 'delivered') appStatus = 'Delivered';
                    if (updatedOrderDb.status === 'picked_up') appStatus = 'Picked Up';
                    if (updatedOrderDb.status === 'cancelled') appStatus = 'Cancelled';
                    
                    return { ...o, status: appStatus };
                }
                return o;
            }));
        });
    }

    return () => {
        if (subscription) subscription.unsubscribe();
    };

  }, [userId]);

  // Simulator for status updates (ONLY for Demo Mode)
  useEffect(() => {
    if (userId !== 'demo-user') return;

    const interval = setInterval(() => {
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map((o): Order => {
            if (o.deliveryType === 'SCHEDULED' && o.paymentStatus === 'PENDING') return o;
            if (o.status === 'Cancelled' || o.status === 'Delivered' || o.status === 'Picked Up') return o;

            if (o.status === 'Pending') return { ...o, status: 'Preparing' };
            if (o.status === 'Preparing') return { ...o, status: o.mode === 'DELIVERY' ? 'On the way' : 'Ready' };
            if (o.status === 'On the way') return { ...o, status: 'Delivered' };
            if (o.status === 'Ready') return { ...o, status: 'Picked Up' };
            return o;
        });
        localStorage.setItem('grocesphere_orders', JSON.stringify(updatedOrders));
        return updatedOrders;
      });
    }, 15000); 

    return () => clearInterval(interval);
  }, [userId]);

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-DEFAULT rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold text-sm">Loading History...</p>
        </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 animate-fade-in">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-soft text-slate-300 border border-slate-100">
           🧾
        </div>
        <h3 className="text-xl font-black text-slate-800">No Past Orders</h3>
        <p className="text-slate-400 mt-2 font-medium max-w-[200px] mx-auto">Your order history will appear here once you make a purchase.</p>
      </div>
    );
  }

  // Helper to determine status steps and progress
  const getStatusInfo = (status: string, mode: OrderMode) => {
      const deliverySteps = ['Pending', 'Preparing', 'On the way', 'Delivered'];
      const pickupSteps = ['Pending', 'Preparing', 'Ready', 'Picked Up'];
      
      const steps = mode === 'DELIVERY' ? deliverySteps : pickupSteps;
      const currentIndex = steps.indexOf(status);
      const progress = ((currentIndex) / (steps.length - 1)) * 100;

      const getLabel = (step: string) => {
          if (step === 'Pending') return 'Placed';
          if (step === 'Preparing') return 'Packing';
          if (step === 'On the way') return 'On Way';
          if (step === 'Ready') return 'Ready';
          if (step === 'Picked Up') return 'Picked Up';
          return step;
      };

      const getIcon = (step: string) => {
          if (step === 'Pending') return '📝';
          if (step === 'Preparing') return '🥡';
          if (step === 'On the way') return '🛵';
          if (step === 'Ready') return '🛍️';
          if (step === 'Delivered' || step === 'Picked Up') return '🏠';
          return '•';
      };

      return { steps, currentIndex, progress, getLabel, getIcon };
  };

  return (
    <div className="pb-32 px-5 space-y-6 pt-4">
      <div className="flex items-center justify-between">
         <h2 className="font-black text-slate-800 text-2xl">History</h2>
         {userId === 'demo-user' && <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">Demo Mode</span>}
         {userId !== 'demo-user' && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded animate-pulse">● Live Updates</span>}
      </div>
      
      {orders.map((order, idx) => {
        const isExpanded = expandedOrderId === order.id;
        const isCompleted = order.status === 'Delivered' || order.status === 'Picked Up';
        const isCancelled = order.status === 'Cancelled';
        const isPickup = order.mode === 'PICKUP';
        const isPaymentPending = order.paymentStatus === 'PENDING';
        
        const { steps, currentIndex, progress, getLabel, getIcon } = getStatusInfo(order.status, order.mode);

        let statusColor = 'bg-blue-50 text-blue-700';
        if (isCompleted) statusColor = 'bg-green-50 text-green-700';
        if (isCancelled) statusColor = 'bg-red-50 text-red-700';
        if (order.status === 'Pending') statusColor = 'bg-yellow-50 text-yellow-700';
        if (isPaymentPending) statusColor = 'bg-orange-50 text-orange-700';

        // Map store for visualization
        const mapStore: Store = {
            id: `order-store-${order.id}`,
            name: order.storeName || 'Store',
            lat: order.storeLocation?.lat || 0,
            lng: order.storeLocation?.lng || 0,
            address: '',
            rating: 0,
            distance: '',
            isOpen: true,
            type: 'general',
            availableProductIds: []
        };

        return (
          <div 
            key={order.id} 
            className={`bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 transition-all cursor-pointer hover:shadow-md animate-slide-up ${isExpanded ? 'ring-2 ring-slate-100' : ''}`}
            style={{ animationDelay: `${idx * 100}ms` }}
            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="font-black text-slate-900 text-lg leading-tight">{order.storeName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                          {new Date(order.date).toLocaleDateString()}
                      </span>
                      <span className="text-xs font-black text-slate-300">•</span>
                      <span className="text-xs font-bold text-slate-800">₹{order.total}</span>
                  </div>
               </div>
               <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border border-transparent ${statusColor}`}>
                   {isPaymentPending ? 'Payment Pending' : order.status}
               </div>
            </div>

            {/* VISUAL TIMELINE */}
            {!isCancelled && !isPaymentPending && (
                 <div className="mb-6 px-2 pt-2 pb-2">
                    <div className="relative">
                        {/* Background Line */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 rounded-full -translate-y-1/2 z-0"></div>
                        
                        {/* Progress Line */}
                        <div 
                            className="absolute top-1/2 left-0 h-1 bg-brand-DEFAULT rounded-full -translate-y-1/2 z-0 transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>

                        {/* Steps */}
                        <div className="flex justify-between relative z-10 w-full">
                            {steps.map((step, i) => {
                                const isActive = i === currentIndex;
                                const isDone = i < currentIndex;
                                const isFuture = i > currentIndex;

                                return (
                                    <div key={step} className="flex flex-col items-center">
                                        <div 
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 border-4 
                                            ${isDone ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white scale-90' : ''}
                                            ${isActive ? 'bg-white border-brand-DEFAULT text-brand-DEFAULT scale-110 shadow-lg' : ''}
                                            ${isFuture ? 'bg-slate-50 border-slate-100 text-slate-300' : ''}
                                            `}
                                        >
                                            {isDone ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span>{getIcon(step)}</span>
                                            )}
                                        </div>
                                        <div className={`text-[9px] font-bold uppercase mt-2 transition-colors ${isActive ? 'text-brand-dark' : isDone ? 'text-brand-DEFAULT' : 'text-slate-300'}`}>
                                            {getLabel(step)}
                                        </div>
                                        {isActive && (
                                            <div className="absolute top-0 w-8 h-8 bg-brand-DEFAULT rounded-full animate-ping -z-10 opacity-30"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                 </div>
            )}

            {/* Expanded Content: Details, Map, Items... */}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-50 animate-fade-in">
                    
                     {/* MAP SECTION inside Details */}
                    {!isCancelled && !isCompleted && order.storeLocation && !isPaymentPending && (
                        <div className="h-40 rounded-2xl overflow-hidden mb-6 border border-slate-100 shadow-inner relative z-0" onClick={(e) => e.stopPropagation()}>
                            <MapVisualizer
                                stores={[mapStore]}
                                selectedStore={mapStore}
                                userLat={userLocation?.lat || 0}
                                userLng={userLocation?.lng || 0}
                                mode={order.mode}
                                onSelectStore={() => {}}
                                showRoute={true}
                                enableExternalNavigation={isPickup}
                                className="h-full"
                            />
                        </div>
                    )}

                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">Order Items</h4>
                    <div className="space-y-3 mb-5">
                        {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="text-xl bg-white w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border border-slate-50">
                                        {item.emoji}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                            {item.quantity} unit{item.quantity > 1 ? 's' : ''} × ₹{item.price}
                                        </div>
                                    </div>
                                </div>
                                <div className="font-black text-slate-900 text-sm">
                                    ₹{item.price * item.quantity}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
