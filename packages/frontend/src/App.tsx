import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { MyOrders } from './pages/MyOrders';
import { Tracking } from './pages/Tracking';
import { Dashboard } from './pages/Dashboard';
import { Store } from './pages/Store';
import { AdminDashboard } from './pages/AdminDashboard';
import { PartnerPortal } from './pages/PartnerPortal';

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-night">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-energy"></div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Carregando Traz Pra Cá...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/store/:id" element={<Store />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/lojista" element={<PartnerPortal />} />
          <Route path="/central-admin" element={<PartnerPortal />} />
          <Route path="/parceiros" element={<PartnerPortal />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
