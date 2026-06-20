import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Sun, Moon, LogOut, User, LayoutDashboard, ShoppingBag, Menu, X, Building, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, role, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Inicializa tema
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      document.body.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.body.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-night transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              Traz Pra Cá <span className="text-energy">Delivery</span>
            </span>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-600 hover:text-energy dark:text-slate-300 dark:hover:text-energy">
              Home
            </Link>
            
            {isAuthenticated && role === 'customer' && (
              <Link to="/orders" className="text-sm font-medium text-slate-600 hover:text-energy dark:text-slate-300 dark:hover:text-energy flex items-center gap-1.5">
                <ShoppingBag size={16} /> Meus Pedidos
              </Link>
            )}

            {isAuthenticated && role === 'merchant' && (
              <Link to="/dashboard" className="text-sm font-medium text-slate-600 hover:text-energy dark:text-slate-300 dark:hover:text-energy flex items-center gap-1.5">
                <LayoutDashboard size={16} /> Painel Lojista
              </Link>
            )}

            {isAuthenticated && role === 'admin' && (
              <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-energy dark:text-slate-300 dark:hover:text-energy flex items-center gap-1.5">
                <LayoutDashboard size={16} /> Painel Admin
              </Link>
            )}
          </nav>

          {/* Action buttons */}
          <div className="hidden md:flex items-center gap-4">
            {/* Dark mode button */}
            <button 
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} />}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <User size={16} className="text-energy" />
                  <span className="font-semibold max-w-[120px] truncate">{user?.name}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
                >
                  <LogOut size={14} /> Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white px-3 py-2">
                  Entrar
                </Link>
                <Link to="/login" className="text-sm font-semibold bg-energy hover:bg-energy-dark text-white px-4 py-2.5 rounded-xl transition-all shadow-sm">
                  Criar Conta
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400"
            >
              {isDarkMode ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-4 py-4 space-y-3">
          <Link 
            to="/" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Home
          </Link>
          
          {isAuthenticated && role === 'customer' && (
            <Link 
              to="/orders" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Meus Pedidos
            </Link>
          )}

          {isAuthenticated && role === 'merchant' && (
            <Link 
              to="/dashboard" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Painel Lojista
            </Link>
          )}

          {isAuthenticated && role === 'admin' && (
            <Link 
              to="/admin" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Painel Admin
            </Link>
          )}

          <hr className="border-slate-100 dark:border-slate-800" />

          {isAuthenticated ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Logado como: <span className="font-bold text-slate-800 dark:text-white">{user?.name}</span>
              </div>
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left text-sm font-semibold text-red-500"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link 
                to="/login" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 text-center text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl"
              >
                Entrar
              </Link>
              <Link 
                to="/login" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 text-center text-sm font-semibold bg-energy text-white py-2.5 rounded-xl"
              >
                Criar Conta
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center md:flex md:justify-between md:items-center gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; 2026 Traz Pra Cá Delivery. Todos os direitos reservados.
          </p>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 md:mt-0 flex flex-wrap items-center justify-center gap-3">
            <Link to="/parceiros" className="hover:text-energy transition-colors font-semibold flex items-center gap-1">
              Portal de Parceiros & Administração <Building size={14} className="text-slate-400 dark:text-slate-500" />
            </Link>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-450">
              Valorizando o comércio local <Heart size={13} className="fill-emerald-500 stroke-emerald-500" />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
