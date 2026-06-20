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
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFound } from './pages/NotFound';

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
          <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
          <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/orders" element={<ErrorBoundary><MyOrders /></ErrorBoundary>} />
          <Route path="/tracking" element={<ErrorBoundary><Tracking /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/store/:id" element={<ErrorBoundary><Store /></ErrorBoundary>} />
          <Route path="/admin" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
          <Route path="/lojista" element={<ErrorBoundary><PartnerPortal /></ErrorBoundary>} />
          <Route path="/central-admin" element={<ErrorBoundary><PartnerPortal /></ErrorBoundary>} />
          <Route path="/parceiros" element={<ErrorBoundary><PartnerPortal /></ErrorBoundary>} />
          {/* Fallback */}
          <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
