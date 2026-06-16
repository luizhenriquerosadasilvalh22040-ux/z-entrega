import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Card, Toast } from '../components/ui';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const [role, setRole] = useState<'customer' | 'merchant' | 'admin'>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setToast({ message: 'Preencha todos os campos', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await login(email, password, role);
      setToast({ message: 'Login realizado com sucesso!', type: 'success' });
      setTimeout(() => {
        if (role === 'merchant') {
          navigate('/dashboard');
        } else if (role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }, 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Email ou senha incorretos';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <Card>
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex p-3 bg-orange-500/10 rounded-2xl text-energy">
            <LogIn size={26} />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">Acesse sua Conta</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Entre na plataforma Traz Pra Cá Delivery</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              role === 'customer'
                ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Cliente
          </button>
          <button
            type="button"
            onClick={() => setRole('merchant')}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              role === 'merchant'
                ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Lojista
          </button>
          <button
            type="button"
            onClick={() => setRole('admin')}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              role === 'admin'
                ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" fullWidth size="lg" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="text-center mt-6 text-sm text-slate-500">
          Não tem uma conta?{' '}
          <Link to="/register" className="font-semibold text-energy hover:underline">
            Cadastre-se grátis
          </Link>
        </div>
      </Card>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
