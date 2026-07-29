import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const MyOrders = lazy(() => import('./pages/MyOrders').then((module) => ({ default: module.MyOrders })));
const Tracking = lazy(() => import('./pages/Tracking').then((module) => ({ default: module.Tracking })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Store = lazy(() => import('./pages/Store').then((module) => ({ default: module.Store })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const PartnerPortal = lazy(() => import('./pages/PartnerPortal').then((module) => ({ default: module.PartnerPortal })));
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));

const AppLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-night-dark">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-energy" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Carregando Traz Pra Cá...</p>
    </div>
  </div>
);

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <AppLoader />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<AppLoader />}>
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
            <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
