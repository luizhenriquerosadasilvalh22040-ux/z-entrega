import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Toast } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight } from 'lucide-react';

interface IOrder {
  _id: string;
  merchantId: { name: string };
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  createdAt: string;
}

export const MyOrders: React.FC = () => {
  const { isAuthenticated, role } = useAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (role !== 'customer') {
      navigate('/');
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await apiClient.get('/orders');
        if (response.data?.status === 'success') {
          setOrders(response.data.data.orders);
        }
      } catch (err) {
        setToast({ message: 'Erro ao buscar seus pedidos', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, role, navigate]);

  const getStatusBadge = (status: string) => {
    const statuses: { [key: string]: { text: string; variant: 'orange' | 'green' | 'blue' | 'red' | 'gray' } } = {
      PENDING: { text: 'Aguardando Aprovação', variant: 'gray' },
      ACCEPTED: { text: 'Aceito', variant: 'blue' },
      PREPARING: { text: 'Em Preparação', variant: 'orange' },
      READY: { text: 'Pronto para Entrega', variant: 'orange' },
      DISPATCHED: { text: 'Despachado', variant: 'blue' },
      IN_TRANSIT: { text: 'Em Trânsito', variant: 'blue' },
      DELIVERED: { text: 'Entregue', variant: 'green' },
      CANCELLED: { text: 'Cancelado', variant: 'red' },
    };

    const current = statuses[status] || { text: status, variant: 'gray' };
    return <Badge variant={current.variant}>{current.text}</Badge>;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
        <ShoppingBag size={26} className="text-energy" /> Meus Pedidos
      </h2>

      {loading ? (
        <p className="text-center py-12 text-slate-400">Carregando seus pedidos...</p>
      ) : orders.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <p className="text-slate-400">Você ainda não realizou nenhum pedido.</p>
          <Button onClick={() => navigate('/')}>Fazer Meu Primeiro Pedido</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order._id} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-extrabold text-slate-850 dark:text-white text-base">
                    {order.merchantId?.name}
                  </h3>
                  {getStatusBadge(order.status)}
                </div>

                <div className="text-xs text-slate-400">
                  Realizado em: {new Date(order.createdAt).toLocaleDateString('pt-BR')} às {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>

                {/* Items preview */}
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  {order.items.map((item, idx) => (
                    <div key={idx}>
                      {item.quantity}x {item.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                <div className="text-left md:text-right">
                  <div className="text-xs text-slate-400">Total do Pedido</div>
                  <div className="text-lg font-black text-energy">
                    R$ {order.total.toFixed(2)}
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/tracking?id=${order._id}`)}
                  className="flex items-center gap-1.5"
                >
                  Rastrear <ArrowRight size={14} />
                </Button>
              </div>
            </Card>
          ))}
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
