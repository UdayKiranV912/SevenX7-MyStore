
import React from 'react';
import { Product } from '../types';

interface StickerProductProps {
  product: Product;
  onAdd: (product: Product) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onClick: (product: Product) => void;
  count: number;
}

export const StickerProduct: React.FC<StickerProductProps> = ({ product, onAdd, onUpdateQuantity, onClick, count }) => {
  const hasMultipleBrands = product.brands && product.brands.length > 0;

  // Calculate Discount
  const mrp = product.mrp || product.price;
  const discount = mrp > product.price 
    ? Math.round(((mrp - product.price) / mrp) * 100) 
    : 0;

  return (
    <div 
      className={`group relative bg-white rounded-[20px] p-3 flex flex-col shadow-card transition-all duration-300 hover:shadow-card-hover cursor-pointer overflow-hidden border border-transparent ${count > 0 ? 'ring-2 ring-brand-DEFAULT ring-offset-2' : 'hover:border-brand-light'}`}
      onClick={() => onClick(product)}
    >
      {/* Discount Badge */}
      {discount > 0 && (
        <div className="absolute top-0 left-0 bg-brand-DEFAULT text-white text-[10px] font-black px-2 py-1 rounded-br-xl z-20 shadow-sm">
          {discount}% OFF
        </div>
      )}

      {/* Image Area */}
      <div className="relative aspect-square mb-3 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-brand-light/40 transition-colors">
        <div className={`text-6xl transform transition-all duration-500 emoji-3d group-hover:scale-110 ${count > 0 ? 'scale-105' : ''}`}>
          {product.emoji}
        </div>
        
        {count > 0 && (
          <div className="absolute top-2 right-2 bg-brand-DEFAULT text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-scale-in z-20">
            {count}
          </div>
        )}

        {hasMultipleBrands && count === 0 && (
           <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-500 shadow-sm border border-slate-100 whitespace-nowrap">
               {product.brands?.length} Brands
           </div>
        )}
      </div>
      
      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 mb-1 group-hover:text-brand-dark transition-colors">{product.name}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{product.category}</p>
        </div>

        <div className="flex items-end justify-between mt-3 pt-2">
          {/* Price Section */}
          <div className="flex flex-col leading-none">
             {discount > 0 && (
                 <span className="text-[10px] text-slate-400 line-through font-bold mb-0.5">₹{mrp}</span>
             )}
             <span className="font-black text-slate-900 text-sm">₹{product.price}</span>
          </div>
          
          <div className="h-9 flex items-center">
            {count === 0 ? (
              <button 
                onClick={(e) => { e.stopPropagation(); hasMultipleBrands ? onClick(product) : onAdd(product); }}
                className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-brand-DEFAULT hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 touch-manipulation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center bg-slate-900 rounded-xl px-1 h-9 shadow-md animate-scale-in">
                <button 
                  onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, -1); }}
                  className="w-8 h-full flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors font-bold touch-manipulation"
                >
                  −
                </button>
                <span className="text-xs font-black text-white px-1 min-w-[16px] text-center">{count}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onClick(product); }} // Open modal to add more brands
                  className="w-8 h-full flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors font-bold touch-manipulation"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
