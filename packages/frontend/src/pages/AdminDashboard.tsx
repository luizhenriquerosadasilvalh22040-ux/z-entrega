import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Input, Toast, Modal } from '../components/ui';
import { 
  DollarSign, Users, Store, Bike, Plus, Trash2, Check, X, 
  Settings, UserPlus, ShieldCheck, TrendingUp, AlertCircle, ClipboardList,
  RefreshCw, Eye, MessageSquare
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
  dailyOrdersVolume: number;
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
  const [activeTab, setActiveTab] = useState<'merchants' | 'deliverers' | 'orders_monitor' | 'deliverers_closing' | 'banners'>('merchants');
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [dailyReport, setDailyReport] = useState<any[]>([]);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<any | null>(null);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  
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

  const [uploadingBanner, setUploadingBanner] = useState(false);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingBanner(true);
      const { compressImage } = await import('../utils/imageCompressor');
      const compressedBase64 = await compressImage(file, 1200, 400, 0.7);

      const response = await apiClient.post('/upload', { image: compressedBase64 });
      if (response.data?.status === 'success') {
        const fileUrl = response.data.data.url;
        setBannerForm(prev => ({ ...prev, imageUrl: fileUrl }));
        setToast({ message: 'Imagem do banner carregada com sucesso!', type: 'success' });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao fazer upload do banner';
      setToast({ message: msg, type: 'error' });
    } finally {
      setUploadingBanner(false);
    }
  };

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

      const activeOrdersRes = await apiClient.get('/admin/orders/active');
      if (activeOrdersRes.data?.status === 'success') {
        setActiveOrders(activeOrdersRes.data.data.orders);
      }

      const dailyReportRes = await apiClient.get('/admin/deliverers/daily-report');
      if (dailyReportRes.data?.status === 'success') {
        setDailyReport(dailyReportRes.data.data.report);
      }

    } catch (err) {
      setToast({ message: 'Erro ao carregar dados do administrador', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshOrders = async () => {
    try {
      setRefreshingOrders(true);
      const activeOrdersRes = await apiClient.get('/admin/orders/active');
      if (activeOrdersRes.data?.status === 'success') {
        setActiveOrders(activeOrdersRes.data.data.orders);
      }
      const dailyReportRes = await apiClient.get('/admin/deliverers/daily-report');
      if (dailyReportRes.data?.status === 'success') {
        setDailyReport(dailyReportRes.data.data.report);
      }
      setToast({ message: 'Monitor atualizado com sucesso!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Erro ao atualizar dados', type: 'error' });
    } finally {
      setRefreshingOrders(false);
    }
  };

  const formatAddress = (addr: any) => {
    if (!addr) return 'Endereço não disponível';
    if (typeof addr === 'string') return addr;
    let text = `${addr.street || ''}, ${addr.number || ''}`;
    if (addr.neighborhood) text += ` - ${addr.neighborhood}`;
    if (addr.complement) text += `, ${addr.complement}`;
    if (addr.referencePoint) text += ` (Ref: ${addr.referencePoint})`;
    return text;
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-455 dark:text-slate-500 font-semibold uppercase">Pedidos de Hoje</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
              {stats?.dailyOrdersVolume} <span className="text-xs font-normal text-slate-400">pedidos</span>
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 pb-px scrollbar-none">
        <button
          onClick={() => setActiveTab('merchants')}
          className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm border-b-2 transition-all duration-200 whitespace-nowrap ${
            activeTab === 'merchants'
              ? 'border-energy text-energy font-black'
              : 'border-transparent text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Store size={16} />
          Lojistas & Assinaturas
        </button>
        <button
          onClick={() => setActiveTab('deliverers')}
          className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm border-b-2 transition-all duration-200 whitespace-nowrap ${
            activeTab === 'deliverers'
              ? 'border-energy text-energy font-black'
              : 'border-transparent text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Bike size={16} />
          Escala de Motoboys
        </button>
        <button
          onClick={() => setActiveTab('orders_monitor')}
          className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm border-b-2 transition-all duration-200 whitespace-nowrap ${
            activeTab === 'orders_monitor'
              ? 'border-energy text-energy font-black'
              : 'border-transparent text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ClipboardList size={16} />
          Monitor de Pedidos
        </button>
        <button
          onClick={() => setActiveTab('deliverers_closing')}
          className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm border-b-2 transition-all duration-200 whitespace-nowrap ${
            activeTab === 'deliverers_closing'
              ? 'border-energy text-energy font-black'
              : 'border-transparent text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <DollarSign size={16} />
          Fechamento de Motoboys
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm border-b-2 transition-all duration-200 whitespace-nowrap ${
            activeTab === 'banners'
              ? 'border-energy text-energy font-black'
              : 'border-transparent text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span className="text-sm">🖼️</span>
          Banners Promocionais
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* Tab: Merchants & Subscriptions */}
        {activeTab === 'merchants' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings size={20} className="text-energy" /> Assinaturas Globais
              </h2>
              <p className="text-xs text-slate-450 dark:text-slate-400">
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

            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Store size={22} className="text-energy" /> Controle de Lojistas & Assinaturas
              </h2>

              <Card className="p-0 overflow-hidden border border-slate-100 dark:border-slate-800/80">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-550 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
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
                              <p className="font-bold text-slate-850 dark:text-white">{merchant.name}</p>
                              <p className="text-xs text-slate-400">{merchant.email}</p>
                            </td>
                            <td className="p-4">
                              <p className="font-semibold text-slate-700 dark:text-slate-300">{merchant.category}</p>
                              <p className="text-xs text-slate-400">CNPJ Encriptado</p>
                            </td>
                            <td className="p-4 text-slate-500">{merchant.phone}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                                merchant.isVerified
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-amber-500/10 text-amber-600'
                              }`}>
                                {merchant.isVerified ? 'Aprovado' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-4">
                              <p className="font-semibold text-slate-850 dark:text-white">
                                R$ {(merchant.subscriptionPrice ?? defaultPrice).toFixed(2)}
                              </p>
                              {merchant.subscriptionPrice !== undefined && (
                                <span className="text-[10px] text-energy font-bold block mt-0.5">Preço Customizado</span>
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
                                  aria-label={merchant.isVerified ? "Remover aprovação do lojista" : "Aprovar lojista"}
                                >
                                  {merchant.isVerified ? <X size={15} /> : <Check size={15} />}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMerchant(merchant);
                                    setCustomSubPrice(merchant.subscriptionPrice?.toString() ?? '');
                                  }}
                                  className="text-xs font-semibold px-2 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-605 dark:text-slate-300"
                                  aria-label={`Definir preço de mensalidade customizado para ${merchant.name}`}
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
          </div>
        )}

        {/* Tab: Deliverers (Escala) */}
        {activeTab === 'deliverers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-850 dark:text-white flex items-center gap-2">
                <Bike size={22} className="text-energy" /> Escala de Motoboys do Dia
              </h2>
              <Button size="sm" onClick={() => setIsAddDriverOpen(true)} className="flex items-center gap-1.5">
                <UserPlus size={16} /> Novo Motoboy
              </Button>
            </div>

            <Card className="p-0 overflow-hidden border border-slate-100 dark:border-slate-800/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-550 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
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
                            <p className="font-bold text-slate-850 dark:text-white">{driver.name}</p>
                            <p className="text-xs text-slate-400">{driver.email}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">{driver.vehicle}</p>
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
                                aria-label="Excluir entregador"
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
        )}

        {/* Tab: Real-time Active Orders Monitor */}
        {activeTab === 'orders_monitor' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-850 dark:text-white flex items-center gap-2">
                <ClipboardList size={22} className="text-energy" /> Monitor de Pedidos do Dia
              </h2>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRefreshOrders} 
                className="flex items-center gap-1.5"
                disabled={refreshingOrders}
              >
                <RefreshCw size={14} className={refreshingOrders ? 'animate-spin' : ''} />
                {refreshingOrders ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>

            <Card className="p-0 overflow-hidden border border-slate-100 dark:border-slate-800/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-550 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Pedido / Hora</th>
                      <th className="p-4">Lojista</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Endereço de Entrega</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Entregador</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          Nenhum pedido ativo no momento.
                        </td>
                      </tr>
                    ) : (
                      activeOrders.map((order) => {
                        const getStatusBadge = (status: string) => {
                          const statuses: { [key: string]: { text: string; variant: 'orange' | 'green' | 'blue' | 'red' | 'gray' } } = {
                            PENDING: { text: 'Aguardando Lojista', variant: 'gray' },
                            ACCEPTED: { text: 'Aceito', variant: 'blue' },
                            PREPARING: { text: 'Preparando', variant: 'orange' },
                            READY: { text: 'Pronto para Entrega', variant: 'orange' },
                            DISPATCHED: { text: 'Despachado', variant: 'blue' },
                            IN_TRANSIT: { text: 'Em Rota', variant: 'blue' },
                            DELIVERED: { text: 'Entregue', variant: 'green' },
                            CANCELLED: { text: 'Cancelado', variant: 'red' },
                          };
                          const current = statuses[status] || { text: status, variant: 'gray' };
                          return <Badge variant={current.variant}>{current.text}</Badge>;
                        };

                        return (
                          <tr key={order._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                            <td className="p-4">
                              <span className="font-bold text-slate-800 dark:text-white block">
                                #{order._id.substring(order._id.length - 6).toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-400 block">
                                {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-slate-850 dark:text-white">
                              {order.merchantId?.name || 'Lojista Excluído'}
                            </td>
                            <td className="p-4">
                              <span className="font-semibold text-slate-850 dark:text-white block">
                                {order.customerId?.name || 'Cliente'}
                              </span>
                              <span className="text-xs text-slate-400 block">
                                {order.customerId?.phone}
                              </span>
                            </td>
                            <td className="p-4 max-w-xs truncate text-xs text-slate-650 dark:text-slate-350">
                              {formatAddress(order.deliveryAddress)}
                            </td>
                            <td className="p-4 font-black text-energy">
                              R$ {order.total.toFixed(2)}
                            </td>
                            <td className="p-4">
                              {getStatusBadge(order.status)}
                            </td>
                            <td className="p-4">
                              {order.delivererId ? (
                                <div>
                                  <span className="font-bold text-slate-800 dark:text-white block text-xs">
                                    {order.delivererId.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {order.delivererId.phone}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Aguardando Lojista/Admin chamar</span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => setSelectedOrderForModal(order)}
                                  className="p-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-350 transition-colors"
                                  title="Ver itens do pedido"
                                  aria-label="Ver detalhes e itens do pedido"
                                >
                                  <Eye size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab: Deliverers daily closing report */}
        {activeTab === 'deliverers_closing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-850 dark:text-white flex items-center gap-2">
                <DollarSign size={22} className="text-energy" /> Fechamento de Motoboys do Dia
              </h2>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRefreshOrders} 
                className="flex items-center gap-1.5"
                disabled={refreshingOrders}
              >
                <RefreshCw size={14} className={refreshingOrders ? 'animate-spin' : ''} />
                {refreshingOrders ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>

            <Card className="p-0 overflow-hidden border border-slate-100 dark:border-slate-800/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-550 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Entregador</th>
                      <th className="p-4">Veículo / Placa</th>
                      <th className="p-4 text-center">Entregas Concluídas (Hoje)</th>
                      <th className="p-4">Total a Pagar</th>
                      <th className="p-4 text-center">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dailyReport.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Nenhum motoboy na escala de hoje possui relatórios ou está ativo.
                        </td>
                      </tr>
                    ) : (
                      dailyReport.map((driver) => {
                        const cleanPhone = driver.phone.replace(/\D/g, '');
                        const msgText = `Olá *${driver.name}*, segue o fechamento das suas entregas de hoje no *Traz Pra Cá*:\n\n🏍️ *Entregas concluídas:* ${driver.completedDeliveries}\n💰 *Total a receber:* R$ ${driver.totalPay.toFixed(2)} (R$ 5,00 por entrega)\n\nObrigado pelo seu trabalho hoje!`;
                        const waLink = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(msgText)}`;

                        return (
                          <tr key={driver.delivererId} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                            <td className="p-4">
                              <p className="font-bold text-slate-850 dark:text-white">{driver.name}</p>
                              <p className="text-xs text-slate-400">{driver.phone}</p>
                            </td>
                            <td className="p-4">
                              <p className="font-semibold text-slate-700 dark:text-slate-300">{driver.vehicle}</p>
                              <p className="text-xs text-slate-400">{driver.plate || 'Sem placa'}</p>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                              {driver.completedDeliveries}
                            </td>
                            <td className="p-4 font-black text-emerald-500">
                              R$ {driver.totalPay.toFixed(2)}
                            </td>
                            <td className="p-4">
                              <div className="flex justify-center">
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:scale-[1.02]"
                                >
                                  <MessageSquare size={14} /> Enviar Fechamento
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab: Banners */}
        {activeTab === 'banners' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-850 dark:text-white flex items-center gap-2">
                <span className="text-xl">🖼️</span> Controle de Banners Promocionais
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
                  <Card key={banner._id} className="overflow-hidden relative flex flex-col justify-between p-0 border border-slate-100 dark:border-slate-800">
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
                          <p className="text-xs text-slate-450 mt-1 truncate">
                            Link: {banner.linkUrl}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-end border-t border-slate-50 dark:border-slate-850 pt-2">
                        <button
                          onClick={() => handleDeleteBanner(banner._id)}
                          className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                          aria-label="Excluir banner promocional"
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
        )}
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
          <div className="flex flex-col mb-4 w-full">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Imagem do Banner
            </label>
            <div className="flex gap-4 items-center">
              {bannerForm.imageUrl ? (
                <div className="relative w-24 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-850 flex-shrink-0">
                  <img src={bannerForm.imageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBannerForm({ ...bannerForm, imageUrl: '' })}
                    className="absolute inset-0 bg-black/55 text-white flex items-center justify-center text-xs opacity-0 hover:opacity-100 transition-opacity"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <div className="w-24 h-12 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-[10px] text-center flex-shrink-0">
                  Sem Banner
                </div>
              )}
              
              <label className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all whitespace-nowrap ${
                uploadingBanner
                  ? 'opacity-50 pointer-events-none'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                  disabled={uploadingBanner}
                />
                {uploadingBanner ? 'Carregando...' : 'Enviar Imagem'}
              </label>
            </div>
          </div>

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

      {/* Modal: Ver Itens do Pedido (Admin Monitor) */}
      <Modal 
        isOpen={!!selectedOrderForModal} 
        onClose={() => setSelectedOrderForModal(null)} 
        title={`Detalhes do Pedido #${selectedOrderForModal?._id?.substring(selectedOrderForModal._id.length - 6).toUpperCase()}`}
      >
        {selectedOrderForModal && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs text-slate-450 font-bold uppercase">Estabelecimento</p>
              <p className="font-bold text-slate-800 dark:text-white">{selectedOrderForModal.merchantId?.name}</p>
            </div>
            
            <div>
              <p className="text-xs text-slate-450 font-bold uppercase">Cliente</p>
              <p className="font-bold text-slate-800 dark:text-white">
                {selectedOrderForModal.customerId?.name} ({selectedOrderForModal.customerId?.phone})
              </p>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <p className="text-xs text-slate-455 font-bold uppercase mb-2">Itens do Pedido</p>
              <div className="space-y-2">
                {selectedOrderForModal.items.map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl flex gap-3">
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0 border border-slate-200"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between font-bold text-slate-705 dark:text-slate-300">
                        <span className="truncate text-xs">{item.quantity}x {item.name}</span>
                        <span className="text-xs">R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      {item.description && (
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 truncate">
                          {item.description}
                        </p>
                      )}
                      {item.chosenOptions && item.chosenOptions.length > 0 && (
                        <div className="text-[10px] text-slate-455">
                          {item.chosenOptions.map((opt: any, oIdx: number) => (
                            <div key={oIdx}>
                              + {opt.groupName}: {opt.optionName} {opt.price > 0 ? `(+R$ ${opt.price.toFixed(2)})` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-[10px] italic text-amber-600 dark:text-amber-450 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 mt-1">
                          Obs: {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1.5 text-slate-605 dark:text-slate-350">
              <div className="flex justify-between text-xs">
                <span>Subtotal</span>
                <span>R$ {selectedOrderForModal.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Taxa de Entrega</span>
                <span>R$ {selectedOrderForModal.deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-base text-energy pt-1 border-t border-slate-50 dark:border-slate-850">
                <span>Total</span>
                <span>R$ {selectedOrderForModal.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <p className="text-xs text-slate-450 font-bold uppercase">Forma de Pagamento</p>
              <p className="font-semibold text-slate-750 dark:text-slate-300 mt-0.5">
                {selectedOrderForModal.paymentMethod === 'PIX' ? 'Pix' :
                 selectedOrderForModal.paymentMethod === 'CARD' ? 'Cartão de Crédito/Débito' : 'Dinheiro'}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={() => setSelectedOrderForModal(null)} fullWidth>
                Fechar Detalhes
              </Button>
            </div>
          </div>
        )}
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
