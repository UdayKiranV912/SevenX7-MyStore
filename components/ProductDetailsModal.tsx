
import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { generateProductDetails } from '../services/geminiService';

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, brand?: string, price?: number) => void;
  onUpdateDetails?: (id: string, details: Partial<Product>) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ product, onClose, onAdd, onUpdateDetails }) => {
  const [details, setDetails] = useState<Partial<Product>>({
    description: product.description,
    ingredients: product.ingredients,
    nutrition: product.nutrition
  });
  
  const [loading, setLoading] = useState(!product.description || !product.ingredients || !product.nutrition);
  const [quantity, setQuantity] = useState(1);
  const [selectedBrandIndex, setSelectedBrandIndex] = useState(0);

  // If products have brands, use the first one, otherwise generic
  const brands = product.brands || [{name: 'Generic', price: product.price}];
  const currentPrice = brands[selectedBrandIndex].price;
  const currentBrandName = brands[selectedBrandIndex].name;
  
  // MRP Logic (If brand overrides price, we assume MRP scales similarly or use product MRP if no brands)
  // For simplicity in this hybrid model: if brands exist, we focus on brand price. 
  // If no brands, we use product.mrp.
  const displayMrp = product.brands && product.brands.length > 0 
      ? currentPrice * 1.2 // Mock MRP for brands logic as data structure for brand-specific MRP is complex for this MVP
      : (product.mrp || product.price);

  const discount = displayMrp > currentPrice 
      ? Math.round(((displayMrp - currentPrice) / displayMrp) * 100) 
      : 0;

  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      if (!product.description || !product.ingredients || !product.nutrition) {
        setLoading(true);
        try {
          const generated = await generateProductDetails(product.name);
          if (isMounted) {
            setDetails(generated);
            setLoading(false);
            if (onUpdateDetails) onUpdateDetails(product.id, generated);
          }
        } catch (error) {
          if (isMounted) setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    fetchDetails();
    return () => { isMounted = false; };
  }, [product, onUpdateDetails]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] overflow-y-auto hide-scrollbar">
        {/* Background Blob */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-brand-light to-white -z-10"></div>
        
        {/* Close */}
        <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/50 backdrop-blur rounded-full text-slate-500 hover:bg-white hover:text-slate-800 transition-all z-20 shadow-sm">✕</button>

        {/* Hero */}
        <div className="flex flex-col items-center pt-4">
          <div className="w-48 h-48 bg-white rounded-[2.5rem] flex items-center justify-center text-[6rem] shadow-soft-xl mb-6 animate-bounce-soft border-4 border-white relative">
            {product.emoji}
            {discount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-black px-3 py-1.5 rounded-full shadow-lg rotate-12">
                    {discount}% OFF
                </div>
            )}
          </div>

          <h2 className="text-4xl font-black text-slate-900 text-center tracking-tight leading-none mb-2">{product.name}</h2>
          
          <div className="flex items-baseline gap-3">
              {discount > 0 && (
                  <span className="text-xl text-slate-400 line-through font-bold">₹{Math.round(displayMrp)}</span>
              )}
              <p className="text-4xl font-black text-brand-DEFAULT">₹{currentPrice}</p>
          </div>
          {discount > 0 && (
             <p className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg mt-2">
                 You save ₹{Math.round(displayMrp - currentPrice)}
             </p>
          )}
        </div>

        {/* Brand Selector */}
        {product.brands && product.brands.length > 0 && (
           <div className="mt-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-3">Select Brand</p>
              <div className="flex flex-wrap gap-2 justify-center">
                 {brands.map((brand, idx) => (
                    <button
                       key={idx}
                       onClick={() => setSelectedBrandIndex(idx)}
                       className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                           selectedBrandIndex === idx 
                             ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-105' 
                             : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                       }`}
                    >
                       {brand.name}
                       <span className={`ml-1 opacity-70 ${selectedBrandIndex === idx ? 'text-slate-300' : 'text-slate-400'}`}>₹{brand.price}</span>
                    </button>
                 ))}
              </div>
           </div>
        )}

        {/* Content */}
        <div className="mt-8 space-y-5 min-h-[5rem]">
           {loading ? (
              <div className="text-center py-8 opacity-50 space-y-3">
                 <div className="animate-spin text-3xl">✨</div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consulting AI Chef...</p>
              </div>
           ) : (
              <div className="animate-fade-in space-y-6">
                  <p className="text-center text-slate-600 font-medium leading-relaxed px-4 text-lg">
                     {details.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Ingredients</span>
                          <span className="text-sm font-bold text-slate-800 leading-snug block">{details.ingredients}</span>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Nutrition</span>
                          <span className="text-sm font-bold text-slate-800 leading-snug block">{details.nutrition}</span>
                      </div>
                  </div>
              </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="mt-10 flex items-center gap-4">
             <div className="flex items-center gap-4 bg-slate-100 rounded-2xl px-4 py-3 shadow-inner">
                 <button onClick={() => setQuantity(q => Math.max(1, q-1))} className="w-8 h-8 bg-white rounded-xl shadow-sm text-lg font-bold text-slate-600 hover:text-red-500 transition-colors flex items-center justify-center">-</button>
                 <span className="text-xl font-black text-slate-800 w-6 text-center">{quantity}</span>
                 <button onClick={() => setQuantity(q => q+1)} className="w-8 h-8 bg-white rounded-xl shadow-sm text-lg font-bold text-slate-600 hover:text-brand-DEFAULT transition-colors flex items-center justify-center">+</button>
             </div>
             
             <button 
               onClick={() => { onAdd(product, quantity, currentBrandName, currentPrice); onClose(); }}
               className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2"
             >
               Add to Cart <span className="opacity-60 text-sm font-medium">• ₹{currentPrice * quantity}</span>
             </button>
        </div>
      </div>
    </div>
  );
};
