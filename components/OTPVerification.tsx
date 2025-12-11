
import React, { useState } from 'react';
import { registerUser, loginUser } from '../services/userService';
import { UserState } from '../types';
import SevenX7Logo from './SevenX7Logo';

interface AuthProps {
  onLoginSuccess: (user: UserState) => void;
  onDemoLogin: () => void;
  onCustomerDemoLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess, onDemoLogin, onCustomerDemoLogin }) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY'>('LOGIN');
  
  // Form State
  const [formData, setFormData] = useState({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      otp: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);
      setStatusMsg('Registering...');

      try {
          await registerUser(formData.email, formData.password, formData.fullName, formData.phone);
          setLoading(false);
          setAuthMode('VERIFY'); 
      } catch (err: any) {
          console.error(err);
          setErrorMsg(err.message || 'Registration failed');
          setLoading(false);
      }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg('');

      setTimeout(() => {
          if (formData.otp === '1234' || formData.otp === '0000') {
             loginUser(formData.email, formData.password)
                .then(user => onLoginSuccess(user))
                .catch(err => setErrorMsg(err.message));
          } else {
             setLoading(false);
             setErrorMsg("Invalid OTP.");
          }
      }, 1500);
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);
      setStatusMsg('Verifying...');

      try {
          const user = await loginUser(formData.email, formData.password);
          onLoginSuccess(user);
      } catch (err: any) {
          setErrorMsg(err.message || 'Invalid credentials');
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <div className="z-10 w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative border border-slate-100">
        
        {/* Header Section */}
        <div className="bg-white p-8 pb-4 text-center">
            <div className="mb-4 flex justify-center">
                <SevenX7Logo size="medium" />
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Grocesphere</h1>
            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wide">Hyper-local Grocery Delivery</p>
        </div>

        {/* Auth Content */}
        <div className="p-8 pt-2">
            {authMode !== 'VERIFY' && (
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                    <button 
                        onClick={() => setAuthMode('LOGIN')}
                        className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${authMode === 'LOGIN' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                    >
                        Log In
                    </button>
                    <button 
                        onClick={() => setAuthMode('REGISTER')}
                        className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${authMode === 'REGISTER' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                    >
                        Sign Up
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center py-8">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-800 rounded-full animate-spin mb-4"></div>
                    <p className="font-bold text-slate-600 animate-pulse text-sm">{statusMsg || 'Processing...'}</p>
                </div>
            ) : (
                <div className="animate-fade-in-up space-y-5">
                    {/* LOGIN VIEW */}
                    {authMode === 'LOGIN' && (
                        <form onSubmit={handleStandardLogin} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Email</label>
                                <input 
                                    type="email" 
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Password</label>
                                <input 
                                    type="password" 
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                                    required
                                />
                            </div>
                            {errorMsg && <p className="text-xs text-red-500 font-bold text-center bg-red-50 p-2 rounded-lg">{errorMsg}</p>}
                            <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-black transition-all">
                                Enter App
                            </button>
                        </form>
                    )}

                    {/* REGISTER VIEW */}
                    {authMode === 'REGISTER' && (
                        <form onSubmit={handleRegister} className="space-y-3">
                            <input 
                                type="text" 
                                placeholder="Full Name" 
                                value={formData.fullName}
                                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-200 outline-none"
                                required
                            />
                            <input 
                                type="tel" 
                                placeholder="Phone Number" 
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-200 outline-none"
                                required
                            />
                            <input 
                                type="email" 
                                placeholder="Email Address" 
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-200 outline-none"
                                required
                            />
                            <input 
                                type="password" 
                                placeholder="Password" 
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-slate-200 outline-none"
                                required
                            />
                            <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-black transition-all">
                                Create Account
                            </button>
                        </form>
                    )}

                    {/* VERIFY VIEW */}
                    {authMode === 'VERIFY' && (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-2xl mx-auto">
                                🔒
                            </div>
                            <h3 className="text-lg font-black text-slate-800">Verify OTP</h3>
                            <form onSubmit={handleVerifyOTP} className="space-y-3 pt-2">
                                <input 
                                    type="text" 
                                    placeholder="0000" 
                                    value={formData.otp}
                                    onChange={(e) => setFormData({...formData, otp: e.target.value})}
                                    className="w-full text-center tracking-[0.5em] text-xl font-black bg-slate-50 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-slate-800 outline-none"
                                    required
                                />
                                {errorMsg && <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-lg">{errorMsg}</p>}
                                <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-all">
                                    Verify
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
        
        {/* Footer Demo Links */}
        {authMode !== 'VERIFY' && (
            <div className="bg-slate-50 p-4 text-center border-t border-slate-200 w-full flex justify-center">
                <button 
                    type="button" 
                    onClick={onDemoLogin}
                    className="text-[10px] font-bold text-slate-500 hover:text-brand-DEFAULT transition-colors flex flex-col items-center gap-1 group"
                >
                    <span className="text-xl group-hover:scale-110 transition-transform">🏪</span>
                    <span>Demo Store Owner</span>
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
