
import React, { useState } from 'react';
import { UserState } from './types';
import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';
import { CustomerApp } from './components/customer/CustomerApp';

const App: React.FC = () => {
  const [user, setUser] = useState<UserState>({ isAuthenticated: false, phone: '', location: null });

  const handleLoginSuccess = (userData: UserState) => {
    setUser(userData);
  };

  const handleStoreDemoLogin = () => {
    setUser({
      isAuthenticated: true,
      id: 'demo-user',
      name: 'Demo Store Owner',
      phone: '9999999999',
      location: null, // Force live GPS
      address: '',    // Force reverse geocode
      role: 'store_owner'
    });
  };

  const handleCustomerDemoLogin = () => {
    setUser({
      isAuthenticated: true,
      id: 'demo-customer',
      name: 'Rahul Customer',
      phone: '9876543210',
      location: null, // Force live GPS
      address: '',    // Force reverse geocode
      role: 'customer'
    });
  };

  const handleLogout = () => {
    setUser({ isAuthenticated: false, phone: '', location: null });
  };

  if (!user.isAuthenticated) {
    return (
        <Auth 
            onLoginSuccess={handleLoginSuccess} 
            onDemoLogin={handleStoreDemoLogin} 
            onCustomerDemoLogin={handleCustomerDemoLogin}
        />
    );
  }

  // Routing based on Role
  if (user.role === 'store_owner') {
      return <StoreApp user={user} onLogout={handleLogout} />;
  }

  // Default to Customer App
  return <CustomerApp user={user} onLogout={handleLogout} />;
};

export default App;
