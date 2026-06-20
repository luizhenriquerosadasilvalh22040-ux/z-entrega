import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Card, Toast, Badge } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Store, ShieldCheck, DollarSign, Clock, Users, ArrowRight, MapPin } from 'lucide-react';

export const MerchantPortal: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    cnpj: '',
    phone: '',
    category: 'Comida' as 'Comida' | 'Farmácia' | 'Construção' | 'Geral',
    operatingHours: { open: '08:00', close: '22:00' },
    paymentMethods: ['PIX', 'Dinheiro'],
    address: {
      street: '',
      number: '',
      neighborhood: '',
      city: 'Rondon',
      state: 'PR',
      zipCode: '87800-000'
    }
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setToast({ message: 'Preencha todos os campos', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await login(loginEmail, loginPassword, 'merchant');
      setToast({ message: 'Login de estabelecimento realizado!', type: 'success' });
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'E-mail ou senha de lojista inválidos';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, cnpj, phone, address } = regForm;
    if (!name || !email || !password || !cnpj || !phone || !address.street || !address.number || !address.neighborhood) {
      setToast({ message: 'Preencha todos os dados obrigatórios da sua loja', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      // Registra
      // In authStore we don't have a direct register action, so we can do it via apiClient directly!
      const registerRes = await apiClientPostRegister();
      if (registerRes.data?.status === 'success') {
        // Realiza login automático
        await login(email, password, 'merchant');
        setToast({ message: 'Loja cadastrada e autenticada com sucesso!', type: 'success' });
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao cadastrar sua loja. Verifique o CNPJ ou e-mail.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Helper para chamar registro via API
  const apiClientPostRegister = async () => {
    const { apiClient } = await import('../services/apiClient');
    return await apiClient.post('/auth/merchant/register', regForm);
  };

  return (
    <div className="space-y-12 py-6">
      
      {/* Intro Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-8 md:p-12 relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full filter blur-3xl"></div>
        
        <div className="lg:col-span-7 space-y-6">
          <Badge variant="orange" className="flex items-center gap-1 w-fit">
            <MapPin size={13} /> Central do Lojista Parceiro
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Venda mais na sua região com o <span className="text-energy">Traz Pra Cá</span>
          </h1>
          <p className="text-slate-350 text-sm md:text-base max-w-xl">
            Crie sua loja digital em minutos, gerencie seus produtos, estoque e receba pedidos diretamente na web com integração de mensagens automáticas via WhatsApp.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            <div className="space-y-1">
              <div className="text-energy font-bold text-lg flex items-center gap-1">
                <DollarSign size={18} /> Assinatura
              </div>
              <p className="text-xs text-slate-400">Preço fixo acessível sem comissões ocultas.</p>
            </div>
            <div className="space-y-1">
              <div className="text-energy font-bold text-lg flex items-center gap-1">
                <Clock size={18} /> Faturamento
              </div>
              <p className="text-xs text-slate-400">Receba direto do cliente na hora da entrega.</p>
            </div>
            <div className="space-y-1">
              <div className="text-energy font-bold text-lg flex items-center gap-1">
                <Users size={18} /> Logística
              </div>
              <p className="text-xs text-slate-400">Motoboys do dia acionados de forma inteligente.</p>
            </div>
          </div>
        </div>

        {/* Portal Form Card */}
        <div className="lg:col-span-5">
          <Card className="bg-white text-slate-850 dark:bg-slate-900 border-none shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-energy"></div>

            {/* Mode Selectors */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-450'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-450'
                }`}
              >
                Cadastrar Loja
              </button>
            </div>

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <Input
                  label="E-mail da Loja"
                  type="email"
                  placeholder="exemplo@loja.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
                <Input
                  label="Senha"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <Button type="submit" fullWidth disabled={loading}>
                  {loading ? 'Acessando...' : 'Acessar Painel do Lojista'}
                </Button>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                <Input
                  label="Nome do Estabelecimento *"
                  placeholder="Ex: Pizzaria Rondon"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="E-mail da Loja *"
                    type="email"
                    placeholder="lojista@exemplo.com"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    required
                  />
                  <Input
                    label="Senha de Acesso *"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="CNPJ (14 dígitos) *"
                    placeholder="Somente números"
                    value={regForm.cnpj}
                    onChange={(e) => setRegForm({ ...regForm, cnpj: e.target.value })}
                    required
                  />
                  <Input
                    label="WhatsApp de Contato *"
                    placeholder="DDD + Número"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Categoria Comercial</label>
                  <select
                    value={regForm.category}
                    onChange={(e) => setRegForm({ ...regForm, category: e.target.value as any })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none text-slate-700 dark:text-white"
                  >
                    <option value="Comida">Comida / Lanchonete</option>
                    <option value="Farmácia">Farmácia</option>
                    <option value="Construção">Materiais de Construção</option>
                    <option value="Geral">Comércio Geral / Utilidades</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Endereço do Estabelecimento *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Input
                        label="Rua *"
                        placeholder="Rua / Avenida"
                        value={regForm.address.street}
                        onChange={(e) => setRegForm({
                          ...regForm,
                          address: { ...regForm.address, street: e.target.value }
                        })}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Nº *"
                        placeholder="Nº"
                        value={regForm.address.number}
                        onChange={(e) => setRegForm({
                          ...regForm,
                          address: { ...regForm.address, number: e.target.value }
                        })}
                        required
                      />
                    </div>
                  </div>
                  <Input
                    label="Bairro *"
                    placeholder="Bairro"
                    value={regForm.address.neighborhood}
                    onChange={(e) => setRegForm({
                      ...regForm,
                      address: { ...regForm.address, neighborhood: e.target.value }
                    })}
                    required
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" fullWidth disabled={loading}>
                    {loading ? 'Cadastrando...' : 'Cadastrar e Abrir Loja'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>

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
