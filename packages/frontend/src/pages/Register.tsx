import React, { useState } from 'react';
import { Button, Input, Card, Toast } from '../components/ui';
import { apiClient } from '../services/apiClient';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');

  // Campos Comuns
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Endereço
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('PR');
  const [zipCode, setZipCode] = useState('');

  // Campos de Cliente
  const [cpf, setCpf] = useState('');

  // Campos de Lojista
  const [cnpj, setCnpj] = useState('');
  const [category, setCategory] = useState<'Comida' | 'Farmácia' | 'Construção' | 'Geral'>('Comida');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('22:00');

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const address = { street, number, neighborhood, city, state, zipCode };

      if (role === 'customer') {
        const payload = { name, email, password, cpf, phone, address };
        await apiClient.post('/auth/customer/register', payload);
      } else {
        const payload = {
          name,
          email,
          password,
          cnpj,
          phone,
          category,
          operatingHours: { open: openTime, close: closeTime },
          paymentMethods: ['PIX', 'Dinheiro', 'Cartão'], // Default
          address
        };
        await apiClient.post('/auth/merchant/register', payload);
      }

      setToast({ message: 'Conta criada com sucesso! Redirecionando para login...', type: 'success' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao criar conta. Verifique os dados.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-12">
      <Card>
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex p-3 bg-orange-500/10 rounded-2xl text-energy">
            <UserPlus size={26} />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">Criar Nova Conta</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Leve o delivery local para outro patamar</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-8">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              role === 'customer'
                ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Quero Comprar (Cliente)
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
            Quero Vender (Lojista)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Informações Básicas */}
            <Input
              label="Nome Completo"
              placeholder="Ex: João da Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="joao@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label="Telefone (WhatsApp)"
              placeholder="Ex: 44997158781"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            
            {role === 'customer' ? (
              <Input
                label="CPF (Apenas números)"
                placeholder="Ex: 12345678909"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                required
              />
            ) : (
              <>
                <Input
                  label="CNPJ (Apenas números)"
                  placeholder="Ex: 12345678000100"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  required
                />
                <div className="mb-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Categoria</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:border-energy focus:ring-4 focus:ring-orange-500/20 outline-none text-slate-700 dark:text-white"
                  >
                    <option value="Comida">Comida (Lanchonete, Pizzaria)</option>
                    <option value="Farmácia">Farmácia</option>
                    <option value="Construção">Depósito de Construção</option>
                    <option value="Geral">Comércio Geral</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {role === 'merchant' && (
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <Input
                label="Horário de Abertura"
                type="text"
                placeholder="Ex: 08:00"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                required
              />
              <Input
                label="Horário de Fechamento"
                type="text"
                placeholder="Ex: 22:00"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                required
              />
            </div>
          )}

          {/* Endereço */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white tracking-wide uppercase">Endereço de Entrega/Funcionamento</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Rua / Avenida"
                  placeholder="Rua principal"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                />
              </div>
              <Input
                label="Número"
                placeholder="Nº ou S/N"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
              />
              <Input
                label="Bairro"
                placeholder="Ex: Centro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                required
              />
              <Input
                label="Cidade"
                placeholder="Ex: Rondon"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
              <Input
                label="Estado"
                placeholder="Ex: PR"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
              <Input
                label="CEP"
                placeholder="Ex: 87800000"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" fullWidth size="lg" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Criar Minha Conta'}
          </Button>
        </form>

        <div className="text-center mt-6 text-sm text-slate-500">
          Já possui conta?{' '}
          <Link to="/login" className="font-semibold text-energy hover:underline">
            Faça login
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
