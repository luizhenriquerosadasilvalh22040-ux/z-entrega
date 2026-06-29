import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Card, LegalConsent, Toast } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, MapPin, MessageSquare, ShieldCheck, ShoppingBag, User } from 'lucide-react';

export const Login: React.FC = () => {
  const { requestOtp, verifyOtp, login, error, isAuthenticated, role } = useAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      if (role === 'admin') navigate('/admin');
      else if (role === 'merchant') navigate('/dashboard');
      else navigate('/');
    }
  }, [isAuthenticated, role, navigate]);


  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'register' | 'otp'>('phone');
  const [code, setCode] = useState('');
  const [rememberPhone, setRememberPhone] = useState(false);
  const [isMockOtp, setIsMockOtp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);


  React.useEffect(() => {
    const savedPhone = localStorage.getItem('rememberedPhone');
    if (savedPhone) {
      setPhone(savedPhone);
      setRememberPhone(true);
    }
  }, []);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };
  
  // Detalhes do Cadastro (usado apenas se for novo usuário)
  const [name, setName] = useState('');
  const [address, setAddress] = useState({
    street: '',
    number: '',
    neighborhood: '',
    city: 'Rondon', // cidade padrão da região
    state: 'PR',
    zipCode: '87800-000'
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Solicita o envio do código OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setToast({ message: 'Digite o número do seu WhatsApp', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      // Tenta enviar OTP. Se for novo usuário e não enviarmos nome/endereço, o backend pode falhar, 
      // então primeiro tentamos um request simples para ver se já existe.
      const data = await requestOtp(phone);
      if (data?.isMock) {
        setIsMockOtp(true);
      } else {
        setIsMockOtp(false);
      }
      setToast({ message: 'Código de verificação enviado!', type: 'success' });
      setStep('otp');
    } catch (err: any) {
      // Se o backend retornar que o cliente não existe, expandimos o formulário para cadastro
      const message = err.response?.data?.message || '';
      if (message.includes('missing') || message.includes('exist')) {
        setToast({ message: 'Número novo! Complete seu cadastro rápido.', type: 'success' });
        setStep('register');
      } else {
        setToast({ message: message || 'Erro ao enviar código de verificação', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Envia OTP contendo os dados do cadastro completo
  const handleRegisterAndRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address.street || !address.number || !address.neighborhood) {
      setToast({ message: 'Preencha seu nome e endereço para entrega', type: 'error' });
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      setToast({ message: 'Aceite os termos e a política de privacidade para continuar', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const data = await requestOtp(phone, name, address, {
        termsAccepted,
        privacyAccepted,
        marketingConsent
      });
      if (data?.isMock) {
        setIsMockOtp(true);
      } else {
        setIsMockOtp(false);
      }
      setToast({ message: 'Cadastro pré-salvo! Código enviado.', type: 'success' });
      setStep('otp');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erro ao realizar cadastro';
      setToast({ message: message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Verifica o código OTP digitado
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setToast({ message: 'Digite o código de verificação', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(phone, code);
      if (rememberPhone) localStorage.setItem('rememberedPhone', phone);
      else localStorage.removeItem('rememberedPhone');
      setToast({ message: 'Login realizado com sucesso!', type: 'success' });
      setTimeout(() => navigate('/'), 1000);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Código de verificação incorreto';
      setToast({ message: message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Realiza o login usando telefone e senha
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setToast({ message: 'Preencha o telefone e a senha', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await login(phone, password, 'customer');
      if (rememberPhone) localStorage.setItem('rememberedPhone', phone);
      else localStorage.removeItem('rememberedPhone');
      setToast({ message: 'Login realizado com sucesso!', type: 'success' });
      setTimeout(() => navigate('/'), 1000);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Telefone ou senha inválidos';
      setToast({ message: message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-8 lg:grid-cols-[1fr_440px] lg:items-center">
      <section className="hidden lg:block">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-extrabold text-energy ring-1 ring-orange-100">
            <ShoppingBag size={16} />
            Delivery local, rápido e direto no WhatsApp
          </div>
          <div className="space-y-3">
            <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight text-slate-950 dark:text-white">
              Entre, escolha a loja e acompanhe seu pedido sem complicação.
            </h1>
            <p className="max-w-lg text-base font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Login por WhatsApp, endereço salvo e atualizações essenciais do pedido. O fluxo foi pensado para pedir rápido e sair do app.
            </p>
          </div>
          <div className="grid max-w-xl grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <MessageSquare className="mb-3 text-energy" size={22} />
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">WhatsApp</p>
              <p className="mt-1 text-xs text-slate-500">Código e avisos do pedido.</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <MapPin className="mb-3 text-energy" size={22} />
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">Endereço</p>
              <p className="mt-1 text-xs text-slate-500">Salvo para próximos pedidos.</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Clock className="mb-3 text-energy" size={22} />
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">Prático</p>
              <p className="mt-1 text-xs text-slate-500">Poucas etapas até pedir.</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="relative overflow-hidden border-slate-100 p-0 shadow-xl">
        <div className="bg-energy px-6 py-6 text-white">
          <div className="mb-4 inline-flex rounded-2xl bg-white/15 p-3">
            {step === 'otp' ? <ShieldCheck size={28} /> : <MessageSquare size={28} />}
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {step === 'phone' && 'Entrar no Traz Pra Cá'}
            {step === 'register' && 'Só falta seu endereço'}
            {step === 'otp' && 'Confirme seu WhatsApp'}
          </h2>
          <p className="mt-1 text-sm font-medium text-white/85">
            {step === 'phone' && 'Use seu WhatsApp para entrar ou criar conta.'}
            {step === 'register' && 'Cadastro rápido para entregar no lugar certo.'}
            {step === 'otp' && `Código enviado para ${phone}`}
          </p>
        </div>

        <div className="p-6">

        {/* Toggle Switch para método de login (apenas no passo inicial) */}
        {step === 'phone' && (
          <div className="mb-6 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setLoginMethod('otp')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                loginMethod === 'otp'
                  ? 'bg-white dark:bg-slate-700 text-energy shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Código WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('password')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                loginMethod === 'password'
                  ? 'bg-white dark:bg-slate-700 text-energy shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Entrar com Senha
            </button>
          </div>
        )}

        {/* STEP 1: Phone input (OTP) */}
        {step === 'phone' && loginMethod === 'otp' && (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div className="space-y-2">
              <Input
                label="WhatsApp (com DDD)"
                type="tel"
                placeholder="Ex: (44) 99999-8888"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
                maxLength={15}
              />
              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox" 
                  id="rememberPhoneOtp" 
                  checked={rememberPhone} 
                  onChange={(e) => setRememberPhone(e.target.checked)}
                  className="w-4 h-4 text-energy bg-white border-slate-300 rounded focus:ring-energy dark:bg-slate-800 dark:border-slate-600 cursor-pointer"
                />
                <label htmlFor="rememberPhoneOtp" className="text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  Lembrar telefone
                </label>
              </div>
            </div>
            <Button type="submit" fullWidth size="lg" disabled={loading} className="flex items-center justify-center gap-1.5">
              {loading ? 'Enviando...' : 'Receber código'} <ArrowRight size={16} />
            </Button>
          </form>
        )}

        {/* STEP 1: Phone & Password Input */}
        {step === 'phone' && loginMethod === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div className="space-y-2">
              <Input
                label="WhatsApp (com DDD)"
                type="tel"
                placeholder="Ex: (44) 99999-8888"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
                maxLength={15}
              />
              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox" 
                  id="rememberPhonePwd" 
                  checked={rememberPhone} 
                  onChange={(e) => setRememberPhone(e.target.checked)}
                  className="w-4 h-4 text-energy bg-white border-slate-300 rounded focus:ring-energy dark:bg-slate-800 dark:border-slate-600 cursor-pointer"
                />
                <label htmlFor="rememberPhonePwd" className="text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  Lembrar telefone
                </label>
              </div>
            </div>
            <Input
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" fullWidth size="lg" disabled={loading} className="flex items-center justify-center gap-1.5">
              {loading ? 'Entrando...' : 'Entrar'} <ArrowRight size={16} />
            </Button>
          </form>
        )}

        {/* STEP 2: Quick Register */}
        {step === 'register' && (
          <form onSubmit={handleRegisterAndRequestOtp} className="space-y-4">
            <div className="space-y-1">
              <h4 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                <User size={13} /> Seus Dados
              </h4>
              <Input
                label="Nome Completo"
                placeholder="Como quer ser chamado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                <MapPin size={13} /> Endereço de Entrega
              </h4>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    label="Rua"
                    placeholder="Ex: Av. Paraná"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Número"
                    placeholder="Ex: 150"
                    value={address.number}
                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Input
                label="Bairro"
                placeholder="Ex: Centro"
                value={address.neighborhood}
                onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
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

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" fullWidth onClick={() => setStep('phone')}>
                Voltar
              </Button>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Processando...' : 'Enviar código'}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: OTP Code verification */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="space-y-2">
              <Input
                label="Código de Verificação"
                placeholder="Digite o código (Ex: 1234)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
              />
              {isMockOtp && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
                  ⚠️ <strong>Modo de testes ativado:</strong> Utilize o código de verificação <strong>1234</strong> para prosseguir.
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" fullWidth onClick={() => setStep('phone')}>
                Mudar Número
              </Button>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Verificando...' : 'Confirmar Código'}
              </Button>
            </div>
          </form>
        )}

        {/* Link para o Portal de Parceiros / Lojistas no fim do login */}
        <div className="mt-6 pt-4 border-t border-slate-150/40 dark:border-slate-800/60 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            É um parceiro comercial ou lojista?{' '}
            <button
              type="button"
              onClick={() => navigate('/parceiros')}
              className="text-energy font-extrabold hover:underline"
            >
              Acesse o Portal de Parceiros
            </button>
          </p>
        </div>
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
