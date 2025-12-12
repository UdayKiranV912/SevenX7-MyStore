
import React, { useState } from 'react';
import { UserState } from '../types';
import { updateUserProfile } from '../services/userService';
import { reverseGeocode, getBrowserLocation } from '../services/locationService';
import { MapVisualizer } from './MapVisualizer';

interface UserProfileProps {
  user: UserState;
  onUpdateUser: (updatedData: Partial<UserState>) => void;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser, onLogout }) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  
  // Address & Map State
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || ''
  });
  
  // Map State for Editing
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(user.location);
  const [isGeocoding, setIsGeocoding] = useState(false);

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
      // Also update coordinates if we have them in mapCenter
      if (mapCenter) {
           onUpdateUser({ address: formData.address, location: mapCenter });
      } else {
           onUpdateUser({ address: formData.address });
      }
      setIsEditingAddress(false);
    } catch (e) {
      alert('Failed to update address');
    }
  };

  // Called when dragging the map pin finishes
  const handleMapSelection = async (lat: number, lng: number) => {
      setMapCenter({ lat, lng });
      setIsGeocoding(true);
      try {
          const address = await reverseGeocode(lat, lng);
          if (address) {
              setFormData(prev => ({ ...prev, address }));
          }
      } catch (error) {
          console.warn("Geocode failed", error);
      } finally {
          setIsGeocoding(false);
      }
  };

  const initAddressEdit = async () => {
      setIsEditingAddress(true);
      // If no location, try to fetch it once
      if (!mapCenter) {
          try {
              const loc = await getBrowserLocation();
              setMapCenter({ lat: loc.lat, lng: loc.lng });
              // Optional: Auto-fill address if empty
              if (!formData.address) {
                  const addr = await reverseGeocode(loc.lat, loc.lng);
                  if(addr) setFormData(prev => ({...prev, address: addr}));
              }
          } catch (e) {
              // Default to Bangalore if nothing
              setMapCenter({ lat: 12.9716, lng: 77.5946 });
          }
      }
  };

  return (
    <div className="pb-32 px-5 pt-4 space-y-6">
      <h2 className="font-black text-slate-800 text-2xl">Your Profile</h2>
      
      {/* IDENTITY CARD */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-card flex flex-col items-center text-center relative overflow-hidden group border border-slate-100">
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
          
          <div className="bg-white rounded-[2rem] p-1 shadow-card overflow-hidden border border-slate-100">
              {isEditingAddress ? (
                  <div className="bg-white animate-fade-in">
                      {/* Map for Pin Refinement */}
                      <div className="h-56 relative rounded-t-[2rem] overflow-hidden border-b border-slate-100">
                          <MapVisualizer
                              stores={[]}
                              userLat={mapCenter?.lat || null}
                              userLng={mapCenter?.lng || null}
                              selectedStore={null}
                              onSelectStore={() => {}}
                              mode="DELIVERY"
                              isSelectionMode={true}
                              onMapClick={handleMapSelection}
                              className="h-full rounded-none"
                          />
                          {isGeocoding && (
                              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 px-3 py-1 rounded-full text-[10px] font-bold shadow-md z-[1000] flex items-center gap-2">
                                  <span className="animate-spin w-3 h-3 border-2 border-brand-DEFAULT border-t-transparent rounded-full"></span>
                                  Fetching address...
                              </div>
                          )}
                      </div>

                      <div className="p-5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">Confirm Address</label>
                          <textarea 
                              value={formData.address}
                              onChange={(e) => setFormData({...formData, address: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-DEFAULT/20 focus:border-brand-DEFAULT resize-none mb-4 shadow-inner"
                              rows={3}
                              placeholder="House No, Street, Landmark, Area..."
                          />

                          <div className="flex gap-3">
                              <button 
                                onClick={() => setIsEditingAddress(false)} 
                                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleSaveAddress} 
                                className="flex-1 py-3.5 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                              >
                                Save Location
                              </button>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="p-2 space-y-2">
                    {/* Home Address (Primary) */}
                    <div className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-[1.5rem] transition-colors group relative cursor-pointer" onClick={initAddressEdit}>
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 text-emerald-600 border border-emerald-100 shadow-sm">
                            📍
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                            <div className="flex justify-between items-center mb-1">
                                <h5 className="font-black text-slate-800 text-sm">Home Address</h5>
                                <span className="text-slate-300 text-xs bg-white px-2 py-0.5 rounded-full border border-slate-100 shadow-sm group-hover:text-brand-DEFAULT">Edit</span>
                            </div>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed line-clamp-2">
                                {user.address ? user.address : <span className="text-slate-400 italic">No address set. Tap to add.</span>}
                            </p>
                            {user.location && (
                                <p className="text-[10px] text-slate-300 font-mono mt-1">
                                    {user.location.lat.toFixed(4)}, {user.location.lng.toFixed(4)}
                                </p>
                            )}
                        </div>
                    </div>
                  </div>
              )}
          </div>
      </div>

      {/* LOGOUT */}
      <div className="pt-4 border-t border-slate-200/50">
           <button onClick={onLogout} className="w-full py-4 text-red-500 font-bold text-sm bg-red-50 rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100 shadow-sm">
               Log Out
           </button>
      </div>
    </div>
  );
};
