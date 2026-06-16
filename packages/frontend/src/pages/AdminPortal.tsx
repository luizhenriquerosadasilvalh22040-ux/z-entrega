import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Card, Toast } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, KeyRound } from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setToast({ message: 'Preencha as credenciais', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await login(email, password, 'admin');
      setToast({ message: 'Acesso Administrativo Concedido!', type: 'success' });
      setTimeout(() => navigate('/admin'), 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Credenciais administrativas incorretas';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-16">
      <Card className="relative overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800">
        {/* Banner Strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-650 via-energy to-orange-500"></div>

        <div className="text-center space-y-3 mb-8 pt-4">
          <div className="inline-flex p-3.5 bg-red-500/10 rounded-2xl text-red-500">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Central Administrativa</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Área restrita de controle e logística global do sistema.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="E-mail Administrativo"
            type="email"
            placeholder="admin@trazpraca.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Senha Administrativa"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" fullWidth size="lg" className="flex items-center justify-center gap-1.5">
            <KeyRound size={16} /> Autenticar Administrador
          </Button>
        </form>
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
