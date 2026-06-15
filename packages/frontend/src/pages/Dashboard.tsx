import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Toast } from '../components/ui';
import { LayoutDashboard, ShoppingCart, DollarSign, BarChart3, Clock, AlertCircle } from 'lucide-react';
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

export const Dashboard: React.FC = () => {
  const { isAuthenticated, role } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<IStats>({ totalOrders: 0, pendingOrders: 0, revenue: 0, averageTicket: 0 });
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchDashboardData = async () => {
    try {
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
  }, [isAuthenticated, role, navigate]);

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
    <div className="space-y-8 animate-float-in">
      <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
        <LayoutDashboard size={26} className="text-energy" /> Painel do Lojista
      </h2>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-500/10 rounded-2xl text-blue-500">
            <ShoppingCart size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total de Pedidos</span>
            <span className="text-xl font-bold">{stats.totalOrders}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3.5 bg-yellow-500/10 rounded-2xl text-yellow-500">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Pedidos Pendentes</span>
            <span className="text-xl font-bold">{stats.pendingOrders}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3.5 bg-green-500/10 rounded-2xl text-green-500">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Faturamento Estimado</span>
            <span className="text-xl font-bold">R$ {stats.revenue.toFixed(2)}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-energy">
            <BarChart3 size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Ticket Médio</span>
            <span className="text-xl font-bold">R$ {stats.averageTicket.toFixed(2)}</span>
          </div>
        </Card>
      </div>

      {loading ? (
        <p className="text-center py-12 text-slate-400">Carregando painel...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna 1 e 2: Listagem de Pedidos Pendentes e Ativos */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Pedidos Pendentes */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <AlertCircle size={20} className="text-yellow-500" /> Novos Pedidos ({pendingOrders.length})
              </h3>
              
              {pendingOrders.length === 0 ? (
                <Card className="py-8 text-center text-slate-400">Nenhum novo pedido na fila.</Card>
              ) : (
                pendingOrders.map((order) => (
                  <Card key={order._id} className="border-l-4 border-l-yellow-500/60 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-white text-sm">{order.customerId?.name}</h4>
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
                          <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
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
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                🛵 Pedidos em Andamento ({activeOrders.length})
              </h3>
              
              {activeOrders.length === 0 ? (
                <Card className="py-8 text-center text-slate-400">Nenhum pedido em preparação ou entrega.</Card>
              ) : (
                activeOrders.map((order) => {
                  const nextAction = getNextStatusAction(order.status);
                  return (
                    <Card key={order._id} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{order.customerId?.name}</h4>
                          <span className="text-xs text-slate-400">{order.deliveryAddress?.street}</span>
                        </div>
                        <Badge variant="orange">{order.status}</Badge>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg">
                        {order.items.map((item, idx) => (
                          <div key={idx}>{item.quantity}x {item.name}</div>
                        ))}
                      </div>

                      {nextAction && (
                        <Button fullWidth size="sm" onClick={() => handleUpdateStatus(order._id, nextAction.next)}>
                          {nextAction.label}
                        </Button>
                      )}
                    </Card>
                  );
                })
              )}
            </div>

          </div>

          {/* Coluna 3: Ações de Configuração e Links rápidos */}
          <div className="space-y-6">
            <Card className="space-y-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">Ações Rápidas</h3>
              <div className="space-y-2">
                <Button variant="secondary" fullWidth className="justify-start gap-2" onClick={() => navigate('/')}>
                  🏬 Ir para a Loja
                </Button>
              </div>
            </Card>
          </div>

        </div>
      )}

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
