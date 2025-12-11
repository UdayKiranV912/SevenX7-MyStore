
import React, { useState } from 'react';
import { UserState } from '../types';
import { updateUserProfile } from '../services/userService';

interface UserProfileProps {
  user: UserState;
  onUpdateUser: (updatedData: Partial<UserState>) => void;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser, onLogout }) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || ''
  });

  const handleSaveProfile = async () => {
    if (!user.id) return;
    try {
      await updateUserProfile(user.id, { 
          full_name: formData.name,
          email: formData.email,
          phone_number: formData.phone
      });
      onUpdateUser({ 
          name: formData.name,
          email: formData.email,
          phone: formData.phone
      });
      setIsEditingProfile(false);
    } catch (e) {
      alert('Failed to update profile details');
    }
  };

  const handleSaveAddress = async () => {
    if (!user.id) return;
    try {
      await updateUserProfile(user.id, { address: formData.address });
      onUpdateUser({ address: formData.address });
      setIsEditingAddress(false);
    } catch (e) {
      alert('Failed to update address');
    }
  };

  const handleAutofillLocation = async () => {
      setIsLoadingAddress(true);
      
      let lat = user.location?.lat;
      let lng = user.location?.lng;

      // If location is not in state, try to fetch it now
      if (!lat || !lng) {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
                navigator.geolocation.getCurrentPosition(resolve, reject, { 
                    timeout: 10000, 
                    enableHighAccuracy: true 
                });
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
            // Update global user state with this new location
            onUpdateUser({ location: { lat, lng } });
        } catch (error: any) {
            console.error("Location access failed", error);
            
            // Robust Error Extraction
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                // GeolocationPositionError has a message property
                if ('message' in error) {
                     errorMessage = String((error as any).message);
                } else {
                     errorMessage = 'Location signal weak or unavailable';
                }
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            if ((error as any)?.code === 1) {
                 alert("Location permission denied. Please enable GPS in your browser settings.");
            } else {
                 alert(`Could not access location: ${errorMessage}`);
            }
            
            setIsLoadingAddress(false);
            return;
        }
      }

      try {
          // Use OpenStreetMap Nominatim for free reverse geocoding
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          if (!response.ok) throw new Error("Failed to fetch address info");
          
          const data = await response.json();
          if (data && data.display_name) {
              setFormData(prev => ({ ...prev, address: data.display_name }));
          } else {
              alert("Address not found for these coordinates. Please enter manually.");
          }
      } catch (error) {
          console.error("Geocoding error", error);
          alert("Failed to fetch address details. Please type manually.");
      } finally {
          setIsLoadingAddress(false);
      }
  };

  return (
    <div className="pb-32 px-5 pt-4 space-y-6">
      <h2 className="font-black text-slate-800 text-2xl">Your Profile</h2>
      
      {/* IDENTITY CARD */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-card flex flex-col items-center text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-light to-white -z-0"></div>
        
        <div className="w-28 h-28 bg-slate-900 rounded-full flex items-center justify-center text-4xl mb-4 border-[6px] border-white shadow-xl relative z-10 text-white transition-transform group-hover:scale-105">
          {user.name ? user.name.charAt(0).toUpperCase() : '👤'}
        </div>
        
        {isEditingProfile ? (
            <div className="flex flex-col items-center gap-3 z-10 w-full max-w-[240px] animate-fade-in">
             <div className="w-full space-y-2">
                 <input 
                    type="text" 
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="text-center text-lg font-black text-slate-800 border-b-2 border-brand-DEFAULT focus:border-brand-dark outline-none pb-1 bg-transparent w-full"
                />
                <input 
                    type="email" 
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="text-center text-sm font-bold text-slate-600 border-b border-slate-200 focus:border-brand-DEFAULT outline-none pb-1 bg-transparent w-full"
                />
                <input 
                    type="tel" 
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="text-center text-sm font-bold text-slate-600 border-b border-slate-200 focus:border-brand-DEFAULT outline-none pb-1 bg-transparent w-full"
                />
             </div>
            <div className="flex gap-2 mt-2">
                <button onClick={() => setIsEditingProfile(false)} className="text-xs bg-slate-100 px-3 py-1.5 rounded-full font-bold text-slate-500 hover:bg-slate-200">Cancel</button>
                <button onClick={handleSaveProfile} className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-full font-bold shadow-sm hover:bg-slate-800 transition-colors">Save Changes</button>
            </div>
            </div>
        ) : (
             <div className="z-10 flex flex-col items-center gap-1">
                 <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{user.name || 'Guest User'}</h3>
                    <button onClick={() => setIsEditingProfile(true)} className="text-slate-400 hover:text-brand-DEFAULT transition-colors bg-white p-1 rounded-full shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                    </button>
                 </div>
                 <div className="flex flex-col items-center">
                    <p className="text-sm font-bold text-slate-500">{user.email}</p>
                    <p className="text-sm font-medium text-slate-400">{user.phone}</p>
                 </div>
             </div>
        )}
      </div>

      {/* SAVED ADDRESSES SECTION */}
      <div className="space-y-4">
          <div className="flex justify-between items-end px-2">
              <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wide">Addresses</h4>
          </div>
          
          <div className="bg-white rounded-[2rem] p-1 shadow-card overflow-hidden">
              {isEditingAddress ? (
                  <div className="p-6 bg-slate-50/50">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-bold text-brand-DEFAULT uppercase tracking-wide">Edit Address</label>
                        <button 
                            onClick={handleAutofillLocation}
                            disabled={isLoadingAddress}
                            className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            {isLoadingAddress ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                            )}
                            Use Current Location
                        </button>
                      </div>
                      <textarea 
                          value={formData.address}
                          onChange={(e) => setFormData({...formData, address: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-DEFAULT/20 focus:border-brand-DEFAULT resize-none mb-4 shadow-inner"
                          rows={3}
                          placeholder="House No, Street, Landmark, Area..."
                          autoFocus
                      />
                      <div className="flex gap-3">
                          <button 
                            onClick={() => setIsEditingAddress(false)} 
                            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleSaveAddress} 
                            className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            Save Location
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="p-2 space-y-2">
                    {/* Home Address (Primary) */}
                    <div className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-[1.5rem] transition-colors group relative">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 text-emerald-600 border border-emerald-100 shadow-sm">
                            📍
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                            <div className="flex justify-between items-center mb-1">
                                <h5 className="font-black text-slate-800 text-sm">Home Address</h5>
                                <button 
                                    onClick={() => setIsEditingAddress(true)} 
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-100 text-slate-400 hover:text-brand-DEFAULT hover:border-brand-DEFAULT shadow-sm transition-all active:scale-95"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                {user.address ? user.address : <span className="text-slate-400 italic">No address set. Click edit to add.</span>}
                            </p>
                        </div>
                    </div>

                    {/* Current Location Quick Action */}
                    <button 
                        onClick={() => {
                            setIsEditingAddress(true);
                            setTimeout(handleAutofillLocation, 100);
                        }}
                        className="w-full flex items-center gap-4 p-4 hover:bg-blue-50/50 rounded-[1.5rem] transition-colors group border border-dashed border-slate-200"
                    >
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 text-blue-500 border border-blue-100 shadow-sm">
                            💠
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <h5 className="font-black text-slate-800 text-sm">Use Current Location</h5>
                            <p className="text-xs font-bold text-slate-400">Tap to auto-detect and save as address</p>
                        </div>
                        <div className="text-slate-300 group-hover:text-blue-500 transition-colors">
                            ➔
                        </div>
                    </button>
                  </div>
              )}
          </div>
      </div>

      {/* SUPPORT SECTION */}
      <div className="space-y-4">
          <div className="flex justify-between items-end px-2">
              <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wide">Support & Help</h4>
          </div>
          
          <div className="bg-white rounded-[2rem] p-1 shadow-card overflow-hidden">
              <div className="p-2 space-y-2">
                 {/* WhatsApp */}
                 <a 
                    href="https://wa.me/919483496940"
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="flex items-center gap-4 p-4 hover:bg-emerald-50 rounded-[1.5rem] transition-colors group cursor-pointer border border-transparent hover:border-emerald-100"
                 >
                     <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 text-emerald-600 border border-emerald-200 shadow-sm">
                         💬
                     </div>
                     <div className="flex-1 min-w-0">
                         <h5 className="font-black text-slate-800 text-sm">WhatsApp Support</h5>
                         <p className="text-sm font-medium text-slate-500">9483496940</p>
                     </div>
                     <div className="text-slate-300 group-hover:text-emerald-500 transition-colors">
                         ➔
                     </div>
                 </a>

                 {/* Email */}
                 <a 
                    href="mailto:sevenx7@sevenx7.com"
                    className="flex items-center gap-4 p-4 hover:bg-blue-50 rounded-[1.5rem] transition-colors group cursor-pointer border border-transparent hover:border-blue-100"
                 >
                     <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 text-blue-600 border border-blue-200 shadow-sm">
                         ✉️
                     </div>
                     <div className="flex-1 min-w-0">
                         <h5 className="font-black text-slate-800 text-sm">Email Support</h5>
                         <p className="text-sm font-medium text-slate-500 truncate">sevenx7@sevenx7.com</p>
                     </div>
                     <div className="text-slate-300 group-hover:text-blue-500 transition-colors">
                         ➔
                     </div>
                 </a>
              </div>
          </div>
      </div>

      {/* LOGOUT */}
      <div className="pt-4 border-t border-slate-200/50">
           <button onClick={onLogout} className="w-full py-4 text-red-500 font-bold text-sm bg-red-50 rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
               </svg>
               Log Out
           </button>
      </div>
    </div>
  );
};
