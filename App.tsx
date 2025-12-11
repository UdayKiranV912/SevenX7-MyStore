
import React, { useState } from 'react';
import { UserState } from './types';
import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';

const App: React.FC = () => {
  const [user, setUser] = useState<UserState>({ isAuthenticated: false, phone: '', location: null });

  const handleLoginSuccess = (userData: UserState) => {
    setUser(userData);
  };

  const handleDemoLogin = () => {
    setUser({
      isAuthenticated: true,
      id: 'demo-user',
      name: 'Demo Store Owner',
      phone: '9999999999',
      location: null,
      address: 'Indiranagar, Bangalore',
      role: 'store_owner'
    });
  };

  const handleLogout = () => {
    setUser({ isAuthenticated: false, phone: '', location: null });
  };

  if (!user.isAuthenticated) {
    return <Auth onLoginSuccess={handleLoginSuccess} onDemoLogin={handleDemoLogin} />;
  }

  // Directly render StoreApp
  return <StoreApp user={user} onLogout={handleLogout} />;
};

export default App;
