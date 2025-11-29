import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { AuthResponse, User } from './types';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from local storage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('sales_token');
    const storedUser = localStorage.getItem('sales_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (data: AuthResponse) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('sales_token', data.token);
    localStorage.setItem('sales_user', JSON.stringify(data.user));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sales_token');
    localStorage.removeItem('sales_user');
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {token && user ? (
        user.admin ? (
          <AdminDashboard token={token} user={user} onLogout={handleLogout} />
        ) : (
          <Dashboard token={token} user={user} onLogout={handleLogout} />
        )
      ) : (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}


export default App;
