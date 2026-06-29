import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Card, LegalConsent, Toast, Badge } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { Store, ShieldCheck, DollarSign, Clock, Users, ArrowRight, Lock, UserPlus, Sparkles, Pizza, ShoppingBag, Package, Rocket } from 'lucide-react';

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estados para Recuperação de Senha
  const [forgotMode, setForgotMode] = useState<'none' | 'request' | 'reset'>('none');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotRole, setForgotRole] = useState<'merchant' | 'admin'>('merchant');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setToast({ message: 'Digite o seu e-mail cadastrado', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { apiClient } = await import('../services/apiClient');
      await apiClient.post('/auth/forgot-password', { email: forgotEmail, role: forgotRole });
      setToast({ message: 'Código enviado! Verifique seu WhatsApp ou o console do servidor.', type: 'success' });
      setForgotMode('reset');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'E-mail não encontrado ou erro no processamento';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      setToast({ message: 'Preencha o código e a nova senha', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { apiClient } = await import('../services/apiClient');
      await apiClient.post('/auth/reset-password', { token: resetToken, newPassword, role: forgotRole });
      setToast({ message: 'Senha redefinida com sucesso!', type: 'success' });
      setForgotMode('none');
      setResetToken('');
      setNewPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Código inválido, expirado ou erro ao salvar senha';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

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
    if (!termsAccepted || !privacyAccepted) {
      setToast({ message: 'Aceite os termos e a política de privacidade para cadastrar sua loja', type: 'error' });
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
        cnpj: cleanCnpj,
        termsAccepted,
        privacyAccepted,
        marketingConsent
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
        {/* Floating 3D Icons */}
        <div className="absolute top-4 left-1/2 animate-float opacity-30 select-none hidden md:block" style={{ animationDelay: '0.4s', animationDuration: '4s' }}>
          <Pizza size={24} className="text-orange-500" />
        </div>
        <div className="absolute bottom-8 left-1/3 animate-float opacity-25 select-none hidden md:block" style={{ animationDelay: '1.0s', animationDuration: '4.8s' }}>
          <svg className="w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 11a9 9 0 0 1 18 0v2H3v-2Z" />
            <path d="M3 18h18M3 15h18" />
          </svg>
        </div>
        <div className="absolute top-10 right-1/3 animate-float opacity-30 select-none hidden md:block" style={{ animationDelay: '0.7s', animationDuration: '3.6s' }}>
          <Package size={24} className="text-orange-400" />
        </div>
        <div className="absolute bottom-4 right-1/2 animate-float opacity-20 select-none hidden md:block" style={{ animationDelay: '1.5s', animationDuration: '5.2s' }}>
          <ShoppingBag size={28} className="text-orange-500" />
        </div>
        
        {/* Elemento de Destaque no Background do Hero */}
        <div className="absolute -bottom-6 -right-6 text-orange-500/20 lg:text-orange-500/30 animate-float select-none hidden sm:block" style={{ animationDuration: '4s' }}>
          <svg className="w-24 h-24 lg:w-36 lg:h-36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="M3 18h3M9 18h6M21 18h-3" />
            <path d="M18 15V9a2 2 0 0 0-2-2h-5l-2-3H4" />
            <path d="M12 7v5a2 2 0 0 1-2 2H6" />
            <path d="M12 10h4" />
          </svg>
        </div>
        
        {/* Left Info Column */}
        <div className="lg:col-span-7 space-y-6 relative z-10">
          <Badge variant="orange">
            <span className="flex items-center gap-1.5 font-bold text-[10px]">
              <Sparkles size={11} className="animate-spin text-orange-400" style={{ animationDuration: '4s' }} /> Portal de Parceiros & Administração
            </span>
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Pediu? <span className="text-energy bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">O Traz Pra Cá entrega.</span>
            <br />
            Vendeu? <span className="text-slate-200">O Traz Pra Cá leva!</span>
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-xl font-medium leading-relaxed">
            Vendeu? Nós levamos! A plataforma local desenvolvida para conectar restaurantes, farmácias e comércios locais a milhares de clientes na região de Rondon-PR. Comece a vender online hoje mesmo e deixe a entrega com a gente! <Rocket size={15} className="inline ml-1 text-energy animate-pulse" />
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

            {forgotMode === 'request' && (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="text-center pb-2">
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                    Recuperar Senha
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Digite seu e-mail para receber um código de redefinição por {forgotRole === 'merchant' ? 'WhatsApp' : 'Console do Servidor'}.
                  </p>
                </div>
                <Input
                  label="E-mail Cadastrado"
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
                <Button type="submit" fullWidth disabled={loading}>
                  {loading ? 'Enviando...' : 'Solicitar Código'}
                </Button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotMode('none')}
                    className="text-xs font-semibold text-energy hover:underline"
                  >
                    Voltar para o login
                  </button>
                </div>
              </form>
            )}

            {forgotMode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="text-center pb-2">
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                    Confirmar Nova Senha
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Insira o código enviado e sua nova senha de acesso.</p>
                </div>
                <Input
                  label="Código de Confirmação (Token)"
                  placeholder="Código de 6 dígitos"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  required
                />
                <Input
                  label="Nova Senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Button type="submit" fullWidth disabled={loading}>
                  {loading ? 'Redefinindo...' : 'Atualizar Senha'}
                </Button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotMode('none')}
                    className="text-xs font-semibold text-energy hover:underline"
                  >
                    Cancelar e voltar
                  </button>
                </div>
              </form>
            )}

            {forgotMode === 'none' && activeTab === 'merchant_login' && (
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
                <div className="text-right -mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotRole('merchant');
                      setForgotEmail(mEmail);
                      setForgotMode('request');
                    }}
                    className="text-xs font-semibold text-energy hover:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
                <Button type="submit" fullWidth disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar no Painel Lojista'}
                </Button>
              </form>
            )}

            {forgotMode === 'none' && activeTab === 'merchant_register' && (
              <form onSubmit={handleMerchantRegister} className="max-h-[min(560px,calc(100dvh-190px))] space-y-4 overflow-y-auto pr-2">
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

                <LegalConsent
                  termsAccepted={termsAccepted}
                  privacyAccepted={privacyAccepted}
                  marketingConsent={marketingConsent}
                  onTermsChange={setTermsAccepted}
                  onPrivacyChange={setPrivacyAccepted}
                  onMarketingChange={setMarketingConsent}
                  compact
                />

                <div className="pt-2">
                  <Button type="submit" fullWidth disabled={loading}>
                    {loading ? 'Cadastrando...' : 'Criar Conta Lojista'}
                  </Button>
                </div>
              </form>
            )}

            {forgotMode === 'none' && activeTab === 'admin_login' && (
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
                <div className="text-right -mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotRole('admin');
                      setForgotEmail(aEmail);
                      setForgotMode('request');
                    }}
                    className="text-xs font-semibold text-energy hover:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
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
