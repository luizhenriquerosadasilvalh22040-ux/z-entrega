import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Input, Toast, Modal } from '../components/ui';
import { 
  DollarSign, Users, Store, Bike, Plus, Trash2, Check, X, 
  Settings, UserPlus, ShieldCheck, TrendingUp, AlertCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IStats {
  totalOrders: number;
  completedOrders: number;
  totalMerchants: number;
  verifiedMerchants: number;
  totalDeliverers: number;
  activeDeliverersToday: number;
  totalSales: number;
  defaultSubscriptionPrice: number;
}

interface IDeliverer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: 'Moto' | 'Bicicleta' | 'Carro';
  plate?: string;
  isActive: boolean;
  isAvailable: boolean;
  isActiveToday: boolean;
}

interface IMerchant {
  _id: string;
  name: string;
  email: string;
  cnpj: string;
  phone: string;
  category: string;
  isVerified: boolean;
  isActive: boolean;
  subscriptionPrice?: number;
}

interface IBanner {
  _id: string;
  imageUrl: string;
  title?: string;
  linkUrl?: string;
}

export const AdminDashboard: React.FC = () => {
  const { user, role, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<IStats | null>(null);
  const [deliverers, setDeliverers] = useState<IDeliverer[]>([]);
  const [merchants, setMerchants] = useState<IMerchant[]>([]);
  const [defaultPrice, setDefaultPrice] = useState<number>(150);
  
  // Modals / Formulários
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [driverForm, setDriverForm] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle: 'Moto' as 'Moto' | 'Bicicleta' | 'Carro',
    plate: '',
    isActiveToday: false
  });

  const [editingMerchant, setEditingMerchant] = useState<IMerchant | null>(null);
  const [customSubPrice, setCustomSubPrice] = useState<string>('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const [banners, setBanners] = useState<IBanner[]>([]);
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [bannerForm, setBannerForm] = useState({
    imageUrl: '',
    title: '',
    linkUrl: ''
  });

  useEffect(() => {
    // Redireciona se não for admin
    if (!isAuthenticated || role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, role]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const statsRes = await apiClient.get('/admin/stats');
      if (statsRes.data?.status === 'success') {
        const data = statsRes.data.data.stats;
        setStats(data);
        setDefaultPrice(data.defaultSubscriptionPrice);
      }

      const deliverersRes = await apiClient.get('/admin/deliverers');
      if (deliverersRes.data?.status === 'success') {
        setDeliverers(deliverersRes.data.data.deliverers);
      }

      const merchantsRes = await apiClient.get('/admin/merchants');
      if (merchantsRes.data?.status === 'success') {
        setMerchants(merchantsRes.data.data.merchants);
      }

      const bannersRes = await apiClient.get('/banners');
      if (bannersRes.data?.status === 'success') {
        setBanners(bannersRes.data.data.banners);
      }

    } catch (err) {
      setToast({ message: 'Erro ao carregar dados do administrador', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Atualizar Preço Padrão da Assinatura
  const handleUpdateDefaultPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.put('/admin/settings', { defaultSubscriptionPrice: Number(defaultPrice) });
      if (res.data?.status === 'success') {
        setToast({ message: 'Mensalidade padrão atualizada com sucesso!', type: 'success' });
        fetchData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao atualizar mensalidade padrão', type: 'error' });
    }
  };

  // Escalar ou remover motorista do dia
  const handleToggleDriverToday = async (id: string, currentStatus: boolean) => {
    try {
      const res = await apiClient.put(`/admin/deliverers/${id}/active-today`, { isActiveToday: !currentStatus });
      if (res.data?.status === 'success') {
        setDeliverers(prev => prev.map(d => d._id === id ? { ...d, isActiveToday: !currentStatus } : d));
        // Atualiza estatísticas locais
        setStats(prev => prev ? {
          ...prev,
          activeDeliverersToday: currentStatus ? prev.activeDeliverersToday - 1 : prev.activeDeliverersToday + 1
        } : null);
        setToast({ 
          message: !currentStatus ? 'Entregador escalado para hoje!' : 'Entregador retirado da escala.', 
          type: 'success' 
        });
      }
    } catch (err) {
      setToast({ message: 'Erro ao alterar escala do entregador', type: 'error' });
    }
  };

  // Criar Entregador
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/admin/deliverers', driverForm);
      if (res.data?.status === 'success') {
        setToast({ message: 'Entregador cadastrado com sucesso!', type: 'success' });
        setIsAddDriverOpen(false);
        setDriverForm({
          name: '',
          email: '',
          phone: '',
          vehicle: 'Moto',
          plate: '',
          isActiveToday: false
        });
        fetchData();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao cadastrar entregador';
      setToast({ message: msg, type: 'error' });
    }
  };

  // Deletar Entregador
  const handleDeleteDriver = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este entregador?')) return;
    try {
      const res = await apiClient.delete(`/admin/deliverers/${id}`);
      if (res.data?.status === 'success') {
        setToast({ message: 'Entregador removido com sucesso!', type: 'success' });
        fetchData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao remover entregador', type: 'error' });
    }
  };

  // Verificar Lojista
  const handleToggleVerifyMerchant = async (id: string, currentStatus: boolean) => {
    try {
      const res = await apiClient.put(`/admin/merchants/${id}/verify`, { isVerified: !currentStatus });
      if (res.data?.status === 'success') {
        setMerchants(prev => prev.map(m => m._id === id ? { ...m, isVerified: !currentStatus } : m));
        setToast({ 
          message: !currentStatus ? 'Lojista verificado e aprovado!' : 'Verificação do lojista removida.', 
          type: 'success' 
        });
        fetchData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao atualizar verificação do lojista', type: 'error' });
    }
  };

  // Preço customizado do Lojista
  const handleSaveCustomPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMerchant) return;
    try {
      const value = customSubPrice === '' ? null : Number(customSubPrice);
      const res = await apiClient.put(`/admin/merchants/${editingMerchant._id}/subscription-price`, { subscriptionPrice: value });
      if (res.data?.status === 'success') {
        setToast({ message: 'Preço de mensalidade do lojista atualizado!', type: 'success' });
        setEditingMerchant(null);
        fetchData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao salvar mensalidade do lojista', type: 'error' });
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/banners', bannerForm);
      if (res.data?.status === 'success') {
        setToast({ message: 'Banner cadastrado com sucesso!', type: 'success' });
        setIsAddBannerOpen(false);
        setBannerForm({
          imageUrl: '',
          title: '',
          linkUrl: ''
        });
        // Recarrega os banners
        const bannersRes = await apiClient.get('/banners');
        if (bannersRes.data?.status === 'success') {
          setBanners(bannersRes.data.data.banners);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao cadastrar banner';
      setToast({ message: msg, type: 'error' });
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este banner?')) return;
    try {
      const res = await apiClient.delete(`/banners/${id}`);
      if (res.data?.status === 'success') {
        setToast({ message: 'Banner removido com sucesso!', type: 'success' });
        setBanners(prev => prev.filter(b => b._id !== id));
      }
    } catch (err) {
      setToast({ message: 'Erro ao remover banner', type: 'error' });
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-energy"></div>
          <p className="text-sm text-slate-500">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
          Painel de <span className="text-energy">Administração Geral</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Acompanhe o volume de entregas, configure mensalidades e escale a equipe de entrega do Traz Pra Cá.
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-orange-500/10 text-energy rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-450 dark:text-slate-500 font-semibold uppercase">Volume de Vendas</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              R$ {stats?.totalSales.toFixed(2)}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
            <Bike size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-455 dark:text-slate-500 font-semibold uppercase">Entregadores Escalados</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              {stats?.activeDeliverersToday} <span className="text-xs font-normal text-slate-400">/ {stats?.totalDeliverers}</span>
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
            <Store size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-455 dark:text-slate-500 font-semibold uppercase">Lojistas Ativos</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              {stats?.verifiedMerchants} <span className="text-xs font-normal text-slate-400">/ {stats?.totalMerchants}</span>
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-amber-500/10 text-amber-550 rounded-2xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-455 dark:text-slate-500 font-semibold uppercase">Mensalidade Padrão</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              R$ {stats?.defaultSubscriptionPrice.toFixed(2)}
            </p>
          </div>
        </Card>
      </div>

      {/* Row 1: Global Subscription Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Settings size={20} className="text-energy" /> Assinaturas Globais
          </h2>
          <p className="text-xs text-slate-400">
            Defina o preço padrão mensal cobrado de todos os lojistas ativos no sistema. Preços personalizados podem ser definidos por loja.
          </p>

          <form onSubmit={handleUpdateDefaultPrice} className="space-y-4 pt-2">
            <Input
              label="Preço Mensalidade Padrão (R$)"
              type="number"
              step="0.01"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(Number(e.target.value))}
              required
            />
            <Button type="submit" fullWidth>Salvar Configuração</Button>
          </form>
        </Card>

        {/* Deliverers Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Bike size={22} className="text-energy" /> Escala de Motoboys do Dia
            </h2>
            <Button size="sm" onClick={() => setIsAddDriverOpen(true)} className="flex items-center gap-1.5">
              <UserPlus size={16} /> Novo Motoboy
            </Button>
          </div>

          <Card className="p-0 overflow-hidden border border-slate-100 dark:border-slate-800/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Nome</th>
                    <th className="p-4">Veículo / Placa</th>
                    <th className="p-4">Telefone</th>
                    <th className="p-4 text-center">Escala (Hoje)</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deliverers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Nenhum entregador cadastrado.
                      </td>
                    </tr>
                  ) : (
                    deliverers.map((driver) => (
                      <tr key={driver._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                        <td className="p-4">
                          <p className="font-bold text-slate-800 dark:text-white">{driver.name}</p>
                          <p className="text-xs text-slate-400">{driver.email}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-700 dark:text-slate-350">{driver.vehicle}</p>
                          <p className="text-xs text-slate-400">{driver.plate || 'Sem placa'}</p>
                        </td>
                        <td className="p-4 text-slate-500">{driver.phone}</td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleToggleDriverToday(driver._id, driver.isActiveToday)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                driver.isActiveToday
                                  ? 'bg-energy text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {driver.isActiveToday ? 'Escalado' : 'Fora da Escala'}
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleDeleteDriver(driver._id)}
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Remover entregador"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* Row 2: Merchants List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Store size={22} className="text-energy" /> Controle de Lojistas & Assinaturas
        </h2>

        <Card className="p-0 overflow-hidden border border-slate-100 dark:border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-4">Lojista</th>
                  <th className="p-4">Categoria / CNPJ</th>
                  <th className="p-4">Telefone</th>
                  <th className="p-4">Aprovação / Status</th>
                  <th className="p-4">Mensalidade</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {merchants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Nenhum lojista cadastrado.
                    </td>
                  </tr>
                ) : (
                  merchants.map((merchant) => (
                    <tr key={merchant._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                      <td className="p-4">
                        <p className="font-bold text-slate-800 dark:text-white">{merchant.name}</p>
                        <p className="text-xs text-slate-450">{merchant.email}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-700 dark:text-slate-350">{merchant.category}</p>
                        <p className="text-xs text-slate-400">CNPJ Encriptado</p>
                      </td>
                      <td className="p-4 text-slate-500">{merchant.phone}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          merchant.isVerified
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {merchant.isVerified ? 'Aprovado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-800 dark:text-white">
                          R$ {(merchant.subscriptionPrice ?? defaultPrice).toFixed(2)}
                        </p>
                        {merchant.subscriptionPrice !== undefined && (
                          <span className="text-[10px] text-energy font-bold">Preço Customizado</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleToggleVerifyMerchant(merchant._id, merchant.isVerified)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              merchant.isVerified
                                ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/5'
                                : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/5'
                            }`}
                            title={merchant.isVerified ? 'Remover aprovação' : 'Aprovar lojista'}
                          >
                            {merchant.isVerified ? <X size={15} /> : <Check size={15} />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingMerchant(merchant);
                              setCustomSubPrice(merchant.subscriptionPrice?.toString() ?? '');
                            }}
                            className="text-xs font-semibold px-2 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                          >
                            Preço
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Row 3: Banner Management */}
      <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="text-xl">🖼️</span> Controle de Banners
          </h2>
          <Button size="sm" onClick={() => setIsAddBannerOpen(true)} className="flex items-center gap-1.5">
            <Plus size={16} /> Novo Banner
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.length === 0 ? (
            <div className="col-span-full text-center py-8 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80">
              Nenhum banner promocional cadastrado no momento.
            </div>
          ) : (
            banners.map((banner) => (
              <Card key={banner._id} className="overflow-hidden relative flex flex-col justify-between p-0">
                <div className="h-32 w-full overflow-hidden bg-slate-150 dark:bg-slate-800">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || 'Banner'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">
                      {banner.title || 'Sem título'}
                    </h4>
                    {banner.linkUrl && (
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        Link: {banner.linkUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end border-t border-slate-50 dark:border-slate-850 pt-2">
                    <button
                      onClick={() => handleDeleteBanner(banner._id)}
                      className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Modal: Add Driver */}
      <Modal isOpen={isAddDriverOpen} onClose={() => setIsAddDriverOpen(false)} title="Cadastrar Novo Entregador">
        <form onSubmit={handleAddDriver} className="space-y-4">
          <Input
            label="Nome Completo"
            placeholder="Nome do entregador"
            value={driverForm.name}
            onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
            required
          />

          <Input
            label="E-mail"
            type="email"
            placeholder="entregador@exemplo.com"
            value={driverForm.email}
            onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
            required
          />

          <Input
            label="Telefone (WhatsApp)"
            placeholder="(44) 99999-9999"
            value={driverForm.phone}
            onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Veículo</label>
              <select
                value={driverForm.vehicle}
                onChange={(e) => setDriverForm({ ...driverForm, vehicle: e.target.value as any })}
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none text-slate-700 dark:text-white"
              >
                <option value="Moto">Moto</option>
                <option value="Bicicleta">Bicicleta</option>
                <option value="Carro">Carro</option>
              </select>
            </div>

            <Input
              label="Placa (opcional)"
              placeholder="AAA-1234"
              value={driverForm.plate}
              onChange={(e) => setDriverForm({ ...driverForm, plate: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="activeToday"
              checked={driverForm.isActiveToday}
              onChange={(e) => setDriverForm({ ...driverForm, isActiveToday: e.target.checked })}
              className="rounded border-slate-300 text-energy focus:ring-energy/20"
            />
            <label htmlFor="activeToday" className="text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer">
              Escalar para entregas hoje
            </label>
          </div>

          <div className="pt-4">
            <Button type="submit" fullWidth>Cadastrar Entregador</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Custom Subscription Price */}
      <Modal isOpen={!!editingMerchant} onClose={() => setEditingMerchant(null)} title={`Mensalidade de ${editingMerchant?.name}`}>
        <form onSubmit={handleSaveCustomPrice} className="space-y-4">
          <p className="text-xs text-slate-400">
            Defina uma cobrança personalizada para este estabelecimento. Deixe em branco para utilizar a mensalidade padrão do sistema (R$ {defaultPrice.toFixed(2)}).
          </p>

          <Input
            label="Mensalidade Personalizada (R$)"
            type="number"
            step="0.01"
            placeholder="Ex: 120.00"
            value={customSubPrice}
            onChange={(e) => setCustomSubPrice(e.target.value)}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" fullWidth onClick={() => setEditingMerchant(null)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Salvar Alteração
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Banner */}
      <Modal isOpen={isAddBannerOpen} onClose={() => setIsAddBannerOpen(false)} title="Adicionar Novo Banner">
        <form onSubmit={handleAddBanner} className="space-y-4">
          <Input
            label="URL da Imagem"
            placeholder="https://exemplo.com/imagem.png"
            value={bannerForm.imageUrl}
            onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
            required
          />

          <Input
            label="Título (Opcional)"
            placeholder="Título do banner"
            value={bannerForm.title}
            onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
          />

          <Input
            label="URL de Destino / Link (Opcional)"
            placeholder="https://exemplo.com/promocao"
            value={bannerForm.linkUrl}
            onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" fullWidth onClick={() => setIsAddBannerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Salvar Banner
            </Button>
          </div>
        </form>
      </Modal>

      {/* Toast Alert */}
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
