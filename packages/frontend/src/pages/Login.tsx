import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button, Input, Card, Toast } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ShieldCheck, ArrowRight, MapPin, User } from 'lucide-react';

export const Login: React.FC = () => {
  const { requestOtp, verifyOtp, error } = useAuthStore();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'register' | 'otp'>('phone');
  const [code, setCode] = useState('');

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
      await requestOtp(phone);
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

    setLoading(true);
    try {
      await requestOtp(phone, name, address);
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
      setToast({ message: 'Login realizado com sucesso!', type: 'success' });
      setTimeout(() => navigate('/'), 1000);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Código de verificação incorreto';
      setToast({ message: message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <Card className="relative overflow-hidden">
        {/* Banner Strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 to-amber-500"></div>

        <div className="text-center space-y-2 mb-8 pt-4">
          <div className="inline-flex p-3.5 bg-orange-500/10 rounded-2xl text-energy animate-pulse">
            {step === 'otp' ? <ShieldCheck size={28} /> : <MessageSquare size={28} />}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {step === 'phone' && 'Entrar no Traz Pra Cá'}
            {step === 'register' && 'Criar Conta Rápido'}
            {step === 'otp' && 'Verificar Telefone'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {step === 'phone' && 'Digite seu WhatsApp para iniciar.'}
            {step === 'register' && 'Complete os dados para entrega.'}
            {step === 'otp' && `Digite o código enviado para ${phone}`}
          </p>
        </div>

        {/* STEP 1: Phone input */}
        {step === 'phone' && (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <Input
              label="WhatsApp (com DDD)"
              type="tel"
              placeholder="Ex: (44) 99999-8888"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              required
              maxLength={15}
            />
            <Button type="submit" fullWidth size="lg" disabled={loading} className="flex items-center justify-center gap-1.5">
              {loading ? 'Enviando...' : 'Receber Código no WhatsApp'} <ArrowRight size={16} />
            </Button>
          </form>
        )}

        {/* STEP 2: Quick Register */}
        {step === 'register' && (
          <form onSubmit={handleRegisterAndRequestOtp} className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
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

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" fullWidth onClick={() => setStep('phone')}>
                Voltar
              </Button>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Processando...' : 'Enviar Código OTP'}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: OTP Code verification */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <Input
              label="Código de Verificação"
              placeholder="Digite o código (Ex: 1234)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={6}
            />
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
