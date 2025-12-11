
import React from 'react';

interface SevenX7LogoProps {
  size?: 'xs' | 'small' | 'medium' | 'large';
  isWelcome?: boolean;
}

const SevenX7Logo: React.FC<SevenX7LogoProps> = ({ size = 'small', isWelcome = false }) => {
  
  const getTextSize = () => {
      switch(size) {
          case 'xs': return 'text-[10px]';
          case 'small': return 'text-xs';
          case 'medium': return 'text-lg';
          case 'large': return 'text-4xl'; // Reduced from 6xl to prevent overflow
          default: return 'text-xs';
      }
  };

  const isLarge = size === 'large';
  const textSizeClass = getTextSize();
  const gapClass = isLarge ? 'gap-3' : size === 'medium' ? 'gap-2.5' : 'gap-1.5';
  
  // Large size gets special treatment
  const xSize = isLarge ? 'text-5xl' : size === 'medium' ? 'text-2xl' : size === 'xs' ? 'text-xs' : 'text-sm';
  const trackingClass = size === 'xs' ? 'tracking-[0.15em]' : isLarge ? 'tracking-[0.2em]' : 'tracking-[0.3em]';

  return (
    <div className={`group flex items-center justify-center font-display font-black ${gapClass} select-none w-full`}>
      
      {/* SEVEN */}
      <span 
        className={`${textSizeClass} text-slate-400 font-bold uppercase ${trackingClass} transition-colors duration-300 group-hover:text-slate-600`}
      >
        Seven
      </span>

      {/* X */}
      <div className={`relative flex items-center justify-center ${xSize} transition-transform duration-700 ${isLarge ? '' : 'group-hover:scale-110 group-hover:rotate-12'}`}>
         {/* Static Glow Effect for Large, Pulse for Small */}
         <div className={`absolute inset-0 bg-emerald-400/30 blur-lg rounded-full ${isLarge ? 'scale-[1.5] opacity-50' : 'scale-125 animate-pulse'} transition-colors duration-500 group-hover:bg-lime-400/40`}></div>
         
         {/* The X - Vibrant 3-Stop Gradient */}
         <span 
            className={`relative z-10 bg-clip-text text-transparent bg-gradient-to-tr from-emerald-600 via-green-500 to-lime-400 inline-block origin-center font-black drop-shadow-sm filter ${isLarge ? '' : 'animate-logo-x'}`} 
            style={{ fontFamily: 'sans-serif' }}
         >
            X
         </span>
      </div>

      {/* 7 */}
      <div className="relative">
        <span className={`${textSizeClass} text-slate-900 font-black group-hover:text-black transition-colors`}>7</span>
      </div>

    </div>
  );
};

export default SevenX7Logo;
