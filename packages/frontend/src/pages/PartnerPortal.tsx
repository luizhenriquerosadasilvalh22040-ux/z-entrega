import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Card, Toast, Badge } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Store, ShieldCheck, DollarSign, Clock, Users, ArrowRight, Lock, UserPlus } from 'lucide-react';

export const PartnerPortal: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'merchant_login' | 'merchant_register' | 'admin_login'>('merchant_login');

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const formatCNPJ = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  };
  
  // Merchant Login Form
  const [mEmail, setMEmail] = useState('');
  const [mPassword, setMPassword] = useState('');

  // Admin Login Form
  const [aEmail, setAEmail] = useState('');
  const [aPassword, setAPassword] = useState('');

  // Merchant Register Form
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    cnpj: '',
    phone: '',
    category: 'Comida' as 'Comida' | 'Farmácia' | 'Construção' | 'Geral',
    operatingHours: { open: '18:00', close: '23:30' },
    paymentMethods: ['PIX', 'Dinheiro', 'Cartão'],
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

  // Lojista Login
  const handleMerchantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mEmail || !mPassword) {
      setToast({ message: 'Preencha todos os campos', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await login(mEmail, mPassword, 'merchant');
      setToast({ message: 'Acesso lojista autorizado!', type: 'success' });
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'E-mail ou senha inválidos';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aEmail || !aPassword) {
      setToast({ message: 'Preencha todos os campos', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await login(aEmail, aPassword, 'admin');
      setToast({ message: 'Acesso administrativo autorizado!', type: 'success' });
      setTimeout(() => navigate('/admin'), 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Credenciais de administrador incorretas';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Lojista Register
  const handleMerchantRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, cnpj, phone, address } = regForm;
    if (!name || !email || !password || !cnpj || !phone || !address.street || !address.number || !address.neighborhood) {
      setToast({ message: 'Preencha todos os dados obrigatórios da sua loja', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { apiClient } = await import('../services/apiClient');
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const payload = {
        ...regForm,
        phone: cleanPhone,
        cnpj: cleanCnpj
      };
      
      const registerRes = await apiClient.post('/auth/merchant/register', payload);
      if (registerRes.data?.status === 'success') {
        // Realiza login automático
        await login(email, password, 'merchant');
        setToast({ message: 'Estabelecimento cadastrado com sucesso!', type: 'success' });
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao cadastrar loja. Verifique os dados.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 py-6">
      
      {/* Landing Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-gradient-to-tr from-slate-950 via-slate-900 to-black text-white rounded-3xl p-8 md:p-12 relative overflow-hidden border border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full filter blur-3xl"></div>
        
        {/* Left Info Column */}
        <div className="lg:col-span-7 space-y-6">
          <Badge variant="orange">🚀 Portal de Parceiros & Administração</Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Impulsione seu negócio com o <span className="text-energy">Traz Pra Cá</span>
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-xl">
            A plataforma local desenvolvida para conectar restaurantes, farmácias e comércios locais a milhares de clientes na região de Rondon-PR. 
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            <div className="space-y-1">
              <div className="text-energy font-bold text-base flex items-center gap-1.5">
                <DollarSign size={18} /> Sem Comissões
              </div>
              <p className="text-xs text-slate-400">Preço mensal fixo por assinatura, sem taxas surpresas sobre suas vendas.</p>
            </div>
            <div className="space-y-1">
              <div className="text-energy font-bold text-base flex items-center gap-1.5">
                <Clock size={18} /> Horário Flexível
              </div>
              <p className="text-xs text-slate-400">Defina seu horário de funcionamento comercial e noturno em tempo real.</p>
            </div>
            <div className="space-y-1">
              <div className="text-energy font-bold text-base flex items-center gap-1.5">
                <Users size={18} /> Mensageria Direta
              </div>
              <p className="text-xs text-slate-400">Notificações automáticas via WhatsApp para clientes e entregadores.</p>
            </div>
          </div>
        </div>

        {/* Right Tab Form Column */}
        <div className="lg:col-span-5">
          <Card className="bg-white text-slate-800 dark:bg-slate-900 border-none shadow-2xl relative overflow-hidden p-6">
            <div className="absolute top-0 left-0 right-0 h-1 bg-energy"></div>

            {/* Selector Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-2xl mb-6 justify-between gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('merchant_login')}
                className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-extrabold transition-all text-center ${
                  activeTab === 'merchant_login'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Entrar Loja
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('merchant_register')}
                className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-extrabold transition-all text-center ${
                  activeTab === 'merchant_register'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Cadastrar Loja
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('admin_login')}
                className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-extrabold transition-all text-center ${
                  activeTab === 'admin_login'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Admin
              </button>
            </div>

            {/* TAB 1: MERCHANT LOGIN */}
            {activeTab === 'merchant_login' && (
              <form onSubmit={handleMerchantLogin} className="space-y-4">
                <div className="text-center pb-2">
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                    <Store size={18} className="text-energy" /> Acessar Meu Estabelecimento
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Gerencie seu cardápio, pedidos e configurações.</p>
                </div>
                <Input
                  label="E-mail Corporativo"
                  type="email"
                  placeholder="lojista@exemplo.com"
                  value={mEmail}
                  onChange={(e) => setMEmail(e.target.value)}
                  required
                />
                <Input
                  label="Senha"
                  type="password"
                  placeholder="••••••••"
                  value={mPassword}
                  onChange={(e) => setMPassword(e.target.value)}
                  required
                />
                <Button type="submit" fullWidth disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar no Painel Lojista'}
                </Button>
              </form>
            )}

            {/* TAB 2: MERCHANT REGISTER */}
            {activeTab === 'merchant_register' && (
              <form onSubmit={handleMerchantRegister} className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                <div className="text-center pb-2">
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                    <UserPlus size={18} className="text-energy" /> Cadastrar Meu Estabelecimento
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Abra sua loja online no Traz Pra Cá hoje mesmo.</p>
                </div>
                
                <Input
                  label="Nome da Loja *"
                  placeholder="Ex: Pizzaria Rondon"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  required
                />

                <Input
                  label="E-mail da Loja *"
                  type="email"
                  placeholder="contato@loja.com"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  required
                />

                <Input
                  label="Senha *"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="CNPJ *"
                    placeholder="XX.XXX.XXX/XXXX-XX"
                    value={regForm.cnpj}
                    onChange={(e) => setRegForm({ ...regForm, cnpj: formatCNPJ(e.target.value) })}
                    required
                    maxLength={18}
                  />
                  <Input
                    label="WhatsApp de Atendimento *"
                    placeholder="Ex: (44) 99999-8888"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: formatPhone(e.target.value) })}
                    required
                    maxLength={15}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                  <select
                    value={regForm.category}
                    onChange={(e) => setRegForm({ ...regForm, category: e.target.value as any })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none text-slate-700 dark:text-white"
                  >
                    <option value="Comida">Comida (Lanches, Pizzas)</option>
                    <option value="Farmácia">Farmácia</option>
                    <option value="Construção">Construção</option>
                    <option value="Geral">Comércio Geral</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Endereço da Loja</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Input
                        label="Rua *"
                        placeholder="Rua"
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
                    {loading ? 'Cadastrando...' : 'Criar Conta Lojista'}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 3: ADMIN LOGIN */}
            {activeTab === 'admin_login' && (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="text-center pb-2">
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                    <Lock size={18} className="text-red-500" /> Acesso Administrativo
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Configuração de taxas, escala de motoboys e lojistas.</p>
                </div>
                <Input
                  label="E-mail Admin"
                  type="email"
                  placeholder="admin@trazpraca.com"
                  value={aEmail}
                  onChange={(e) => setAEmail(e.target.value)}
                  required
                />
                <Input
                  label="Senha Administrativa"
                  type="password"
                  placeholder="••••••••"
                  value={aPassword}
                  onChange={(e) => setAPassword(e.target.value)}
                  required
                />
                <Button type="submit" fullWidth variant="primary" disabled={loading} className="bg-slate-900 dark:bg-slate-800 text-white">
                  {loading ? 'Entrando...' : 'Entrar como Administrador'}
                </Button>
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
