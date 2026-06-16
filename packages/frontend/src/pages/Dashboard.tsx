import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Toast, Input, Modal } from '../components/ui';
import { 
  LayoutDashboard, ShoppingCart, DollarSign, BarChart3, Clock, 
  AlertCircle, Menu as MenuIcon, Settings, Plus, Edit2, Trash2, Save 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IOrder {
  _id: string;
  customerId: { name: string; phone: string };
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  createdAt: string;
  deliveryAddress: { street: string; number: string };
}

interface IStats {
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  averageTicket: number;
}

interface IProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  stockQuantity: number;
  isPaused: boolean;
  image?: string;
}

export const Dashboard: React.FC = () => {
  const { isAuthenticated, role, user, checkAuth } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'settings'>('orders');
  const [stats, setStats] = useState<IStats>({ totalOrders: 0, pendingOrders: 0, revenue: 0, averageTicket: 0 });
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estados dos Formulários de Produtos
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: '',
    stockQuantity: 99,
  });

  // Estados das Configurações do Lojista
  const [settingsForm, setSettingsForm] = useState({
    logoImage: '',
    open: '08:00',
    close: '22:00',
    paymentMethods: [] as string[]
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // 1. Busca estatísticas
      const statsResponse = await apiClient.get('/orders/stats');
      if (statsResponse.data?.status === 'success') {
        setStats(statsResponse.data.data.stats);
      }

      // 2. Busca todos os pedidos da loja
      const ordersResponse = await apiClient.get('/orders');
      if (ordersResponse.data?.status === 'success') {
        setOrders(ordersResponse.data.data.orders);
      }

      // 3. Busca produtos do lojista
      if (user?._id) {
        const productsResponse = await apiClient.get(`/products/merchant/${user._id}`);
        if (productsResponse.data?.status === 'success') {
          setProducts(productsResponse.data.data.products);
        }
      }
    } catch (err) {
      setToast({ message: 'Erro ao buscar dados do painel', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (role !== 'merchant') {
      navigate('/');
      return;
    }

    fetchDashboardData();
  }, [isAuthenticated, role, navigate, user?._id]);

  // Inicializa o form de configurações com os dados atuais do lojista
  useEffect(() => {
    if (user) {
      setSettingsForm({
        logoImage: (user as any).logoImage || '',
        open: user.operatingHours?.open || '08:00',
        close: user.operatingHours?.close || '22:00',
        paymentMethods: user.paymentMethods || ['PIX', 'Dinheiro']
      });
    }
  }, [user]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await apiClient.post(`/orders/${orderId}/status`, { status: newStatus });
      if (response.data?.status === 'success') {
        setToast({ message: `Pedido atualizado para: ${newStatus}`, type: 'success' });
        fetchDashboardData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao atualizar status do pedido', type: 'error' });
    }
  };

  // Cadastro/Edição de Produto
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price || !productForm.category) {
      setToast({ message: 'Preencha todos os campos obrigatórios', type: 'error' });
      return;
    }

    const payload = {
      name: productForm.name,
      description: productForm.description,
      price: Number(productForm.price),
      category: productForm.category,
      image: productForm.image || undefined,
      stockQuantity: Number(productForm.stockQuantity),
    };

    try {
      if (editingProduct) {
        // Atualiza produto
        const res = await apiClient.put(`/products/${editingProduct._id}`, payload);
        if (res.data?.status === 'success') {
          // Atualiza também estoque e pausa
          await apiClient.put(`/products/${editingProduct._id}/stock`, {
            stockQuantity: Number(productForm.stockQuantity),
            isPaused: editingProduct.isPaused
          });

          setToast({ message: 'Produto atualizado com sucesso!', type: 'success' });
        }
      } else {
        // Cria produto
        const res = await apiClient.post('/products', payload);
        if (res.data?.status === 'success') {
          setToast({ message: 'Produto cadastrado com sucesso!', type: 'success' });
        }
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      fetchDashboardData();
    } catch (err) {
      setToast({ message: 'Erro ao salvar o produto', type: 'error' });
    }
  };

  // Pausar/Retomar venda de produto
  const handleToggleProductPause = async (product: IProduct) => {
    try {
      const res = await apiClient.put(`/products/${product._id}/stock`, {
        isPaused: !product.isPaused
      });
      if (res.data?.status === 'success') {
        setProducts(prev => prev.map(p => p._id === product._id ? { ...p, isPaused: !product.isPaused } : p));
        setToast({ 
          message: !product.isPaused ? 'Venda de produto suspensa hoje!' : 'Venda do produto liberada!', 
          type: 'success' 
        });
      }
    } catch (err) {
      setToast({ message: 'Erro ao alterar status de suspensão do produto', type: 'error' });
    }
  };

  // Excluir Produto
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      const res = await apiClient.delete(`/products/${id}`);
      if (res.data?.status === 'success') {
        setToast({ message: 'Produto removido com sucesso!', type: 'success' });
        fetchDashboardData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao excluir o produto', type: 'error' });
    }
  };

  // Salvar Configurações
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user?._id) return;
      
      // 1. Atualizar Horário de Funcionamento
      await apiClient.put(`/merchants/${user._id}/operating-hours`, {
        open: settingsForm.open,
        close: settingsForm.close
      });

      // 2. Atualizar Meios de Pagamento
      await apiClient.put(`/merchants/${user._id}/payment-method`, {
        paymentMethods: settingsForm.paymentMethods
      });

      // 3. Atualizar Logo
      await apiClient.put(`/merchants/${user._id}/logo`, {
        logoImage: settingsForm.logoImage
      });

      setToast({ message: 'Configurações atualizadas com sucesso!', type: 'success' });
      await checkAuth(); // Atualiza dados no authStore
    } catch (err) {
      setToast({ message: 'Erro ao salvar configurações', type: 'error' });
    }
  };

  const handlePaymentMethodChange = (method: string) => {
    setSettingsForm(prev => {
      const methods = prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter(m => m !== method)
        : [...prev.paymentMethods, method];
      return { ...prev, paymentMethods: methods };
    });
  };

  // Separa pedidos pendentes e ativos
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const activeOrders = orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'IN_TRANSIT'].includes(o.status));

  // Helper para obter o próximo status
  const getNextStatusAction = (status: string) => {
    const flows: { [key: string]: { label: string; next: string } } = {
      ACCEPTED: { label: 'Iniciar Preparação', next: 'PREPARING' },
      PREPARING: { label: 'Marcar como Pronto', next: 'READY' },
      READY: { label: 'Despachar Pedido', next: 'DISPATCHED' },
      DISPATCHED: { label: 'Iniciar Trânsito', next: 'IN_TRANSIT' },
      IN_TRANSIT: { label: 'Confirmar Entrega', next: 'DELIVERED' }
    };
    return flows[status];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard size={28} className="text-energy" /> Painel do Lojista
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Gerencie seus pedidos em tempo real, atualize seu estoque e configure sua loja.
          </p>
        </div>

        {/* Tab Selector Links */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/20">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-450'
            }`}
          >
            <ShoppingCart size={14} /> Pedidos
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'menu'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-450'
            }`}
          >
            <MenuIcon size={14} /> Cardápio
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-450'
            }`}
          >
            <Settings size={14} /> Configurações
          </button>
        </div>
      </div>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
            <ShoppingCart size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-450 font-semibold block uppercase tracking-wider">Total de Pedidos</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.totalOrders}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-500">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-450 font-semibold block uppercase tracking-wider">Pedidos Pendentes</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.pendingOrders}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-450 font-semibold block uppercase tracking-wider">Faturamento</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">R$ {stats.revenue.toFixed(2)}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-orange-500/10 rounded-2xl text-energy">
            <BarChart3 size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-450 font-semibold block uppercase tracking-wider">Ticket Médio</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">R$ {stats.averageTicket.toFixed(2)}</span>
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-energy"></div>
        </div>
      ) : (
        <div>
          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Pedidos Pendentes */}
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <AlertCircle size={20} className="text-yellow-500" /> Novos Pedidos ({pendingOrders.length})
                </h3>
                
                {pendingOrders.length === 0 ? (
                  <Card className="py-8 text-center text-slate-400">Nenhum novo pedido na fila.</Card>
                ) : (
                  pendingOrders.map((order) => (
                    <Card key={order._id} className="border-l-4 border-l-yellow-500/60 space-y-4 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-slate-850 dark:text-white text-sm">{order.customerId?.name}</h4>
                          <p className="text-xs text-slate-400">{order.customerId?.phone}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400">Total</span>
                          <p className="text-sm font-black text-energy">R$ {order.total.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" className="flex-1" onClick={() => handleUpdateStatus(order._id, 'CANCELLED')}>
                          Recusar
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => handleUpdateStatus(order._id, 'ACCEPTED')}>
                          Aceitar Pedido
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Pedidos Ativos */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  🛵 Pedidos em Andamento ({activeOrders.length})
                </h3>
                
                {activeOrders.length === 0 ? (
                  <Card className="py-8 text-center text-slate-400">Nenhum pedido em preparação ou entrega.</Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeOrders.map((order) => {
                      const nextAction = getNextStatusAction(order.status);
                      return (
                        <Card key={order._id} className="space-y-4 flex flex-col justify-between shadow-sm">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{order.customerId?.name}</h4>
                                <span className="text-xs text-slate-400 block">{order.deliveryAddress?.street}, {order.deliveryAddress?.number}</span>
                              </div>
                              <Badge variant={order.status === 'READY' ? 'green' : 'orange'}>
                                {order.status}
                              </Badge>
                            </div>

                            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{item.quantity}x {item.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2">
                            {nextAction && (
                              <Button fullWidth size="sm" onClick={() => handleUpdateStatus(order._id, nextAction.next)}>
                                {nextAction.label}
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB: CARDÁPIO (MENU) */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  Gerenciamento de Produtos ({products.length})
                </h3>
                <Button size="sm" onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', description: '', price: '', category: '', image: '', stockQuantity: 99 });
                  setIsProductModalOpen(true);
                }} className="flex items-center gap-1.5">
                  <Plus size={16} /> Novo Produto
                </Button>
              </div>

              {products.length === 0 ? (
                <Card className="py-12 text-center text-slate-400">
                  Nenhum produto cadastrado no seu cardápio ainda. Comece criando um!
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <Card key={product._id} className={`flex flex-col justify-between relative ${product.isPaused || product.stockQuantity <= 0 ? 'border-red-500/20 dark:border-red-500/10' : ''}`}>
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          {product.image && (
                            <img 
                              src={product.image} 
                              alt={product.name} 
                              className="w-16 h-16 rounded-xl object-cover border bg-slate-50"
                            />
                          )}
                          <div className="space-y-1 flex-1">
                            <div className="flex items-start justify-between">
                              <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{product.name}</h4>
                              <Badge variant={product.isPaused || product.stockQuantity <= 0 ? 'danger' : 'gray'}>
                                {product.isPaused ? 'Pausado' : product.stockQuantity <= 0 ? 'Sem Estoque' : 'Ativo'}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2">{product.description}</p>
                            <p className="text-sm font-black text-energy">R$ {product.price.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl text-xs space-y-1 text-slate-500">
                          <div>Categoria: <span className="font-bold text-slate-700 dark:text-slate-350">{product.category}</span></div>
                          <div>Qtd. Estoque: <span className="font-bold text-slate-700 dark:text-slate-350">{product.stockQuantity} unidades</span></div>
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 mt-4">
                        <button
                          onClick={() => handleToggleProductPause(product)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                            product.isPaused
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10'
                              : 'border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10'
                          }`}
                        >
                          {product.isPaused ? 'Liberar Venda' : 'Pausar Venda'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setProductForm({
                              name: product.name,
                              description: product.description,
                              price: product.price.toString(),
                              category: product.category,
                              image: product.image || '',
                              stockQuantity: product.stockQuantity,
                            });
                            setIsProductModalOpen(true);
                          }}
                          className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-350 transition-colors"
                          title="Editar produto"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product._id)}
                          className="p-2 border border-red-500/20 hover:bg-red-500/5 rounded-xl text-red-500 transition-colors"
                          title="Excluir produto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <Card className="max-w-2xl mx-auto space-y-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings size={20} className="text-energy" /> Detalhes do Estabelecimento
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <Input
                  label="URL da Logo / Imagem do Estabelecimento"
                  placeholder="https://exemplo.com/logo.png"
                  value={settingsForm.logoImage}
                  onChange={(e) => setSettingsForm({ ...settingsForm, logoImage: e.target.value })}
                />
                
                {settingsForm.logoImage && (
                  <div className="flex items-center gap-4 p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-850/20">
                    <img 
                      src={settingsForm.logoImage} 
                      alt="Preview logo" 
                      className="w-16 h-16 rounded-xl object-cover bg-white"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span className="text-xs text-slate-400">Pré-visualização do logo carregada</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Horário de Abertura"
                    type="time"
                    value={settingsForm.open}
                    onChange={(e) => setSettingsForm({ ...settingsForm, open: e.target.value })}
                    required
                  />
                  <Input
                    label="Horário de Fechamento"
                    type="time"
                    value={settingsForm.close}
                    onChange={(e) => setSettingsForm({ ...settingsForm, close: e.target.value })}
                    required
                  />
                </div>

                {/* Formas de Pagamento aceitas */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Formas de Pagamento Aceitas
                  </label>
                  <div className="flex flex-wrap gap-4 pt-1">
                    {['PIX', 'Dinheiro', 'Cartão'].map((method) => {
                      const isChecked = settingsForm.paymentMethods.includes(method);
                      return (
                        <label key={method} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handlePaymentMethodChange(method)}
                            className="rounded border-slate-300 text-energy focus:ring-energy/20 h-4.5 w-4.5"
                          />
                          {method}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button type="submit" fullWidth className="flex items-center justify-center gap-2">
                    <Save size={16} /> Salvar Configurações
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}

      {/* Modal: Add/Edit Product */}
      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title={editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}>
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <Input
            label="Nome do Produto *"
            placeholder="Ex: Coca-cola 2L"
            value={productForm.name}
            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            required
          />

          <Input
            label="Descrição *"
            placeholder="Ex: Refrigerante gelado sabor original"
            value={productForm.description}
            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Preço (R$) *"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              required
            />

            <Input
              label="Categoria *"
              placeholder="Ex: Bebidas, Lanches, Sobremesas"
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Qtd. Inicial de Estoque"
              type="number"
              value={productForm.stockQuantity}
              onChange={(e) => setProductForm({ ...productForm, stockQuantity: Number(e.target.value) })}
              required
            />

            <Input
              label="URL da Imagem (opcional)"
              placeholder="https://exemplo.com/coca.png"
              value={productForm.image}
              onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" fullWidth onClick={() => setIsProductModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
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
