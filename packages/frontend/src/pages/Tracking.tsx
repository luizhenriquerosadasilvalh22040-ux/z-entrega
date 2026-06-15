import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Toast } from '../components/ui';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { MapPin, ShieldAlert, CheckCircle2, Clock, Truck, ChefHat, Check } from 'lucide-react';

interface IOrder {
  _id: string;
  merchantId: { name: string; phone: string; address: { street: string } };
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  createdAt: string;
  deliveryAddress: { street: string; number: string; neighborhood: string };
  statusHistory: { status: string; changedAt: string }[];
}

export const Tracking: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extrai ?id=xxx
  const query = new URLSearchParams(location.search);
  const orderId = query.get('id');

  const [searchId, setSearchId] = useState('');
  const [order, setOrder] = useState<IOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Carrega dados do pedido
  const fetchOrder = async (id: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/orders/${id}`);
      if (response.data?.status === 'success') {
        setOrder(response.data.data.order);
      }
    } catch (err: any) {
      setToast({ message: 'Pedido não encontrado ou sem autorização', type: 'error' });
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);

      // Configuração do Socket.io para atualização em tempo real
      const socket = io('http://localhost:3000');
      
      socket.emit('joinOrderRoom', orderId);
      
      socket.on('orderStatusUpdated', (data: { orderId: string; status: string }) => {
        if (data.orderId === orderId) {
          setToast({ message: `Status do pedido atualizado: ${data.status}`, type: 'success' });
          // Atualiza dados locais do pedido
          fetchOrder(orderId);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [orderId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId) {
      navigate(`/tracking?id=${searchId}`);
    }
  };

  // Helper para desenhar a timeline de status
  const statuses = [
    { key: 'PENDING', label: 'Confirmado', desc: 'Aguardando aprovação do estabelecimento', icon: Clock },
    { key: 'ACCEPTED', label: 'Aceito', desc: 'Estabelecimento aceitou seu pedido', icon: CheckCircle2 },
    { key: 'PREPARING', label: 'Em Preparação', desc: 'Seu pedido está sendo preparado', icon: ChefHat },
    { key: 'READY', label: 'Pronto', desc: 'Seu pedido já está pronto para despacho', icon: Check },
    { key: 'DISPATCHED', label: 'Despachado', desc: 'Saiu para entrega compartilhada', icon: Truck },
    { key: 'IN_TRANSIT', label: 'Em Trânsito', desc: 'Motoboy a caminho da sua casa', icon: MapPin },
    { key: 'DELIVERED', label: 'Entregue', desc: 'Pedido entregue com sucesso! Bom apetite!', icon: CheckCircle2 }
  ];

  const getStatusIndex = (currentStatus: string) => {
    return statuses.findIndex(s => s.key === currentStatus);
  };

  const currentIdx = order ? getStatusIndex(order.status) : -1;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Busca rápida se não houver ID */}
      {!orderId && (
        <Card className="text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Rastrear Pedido</h2>
            <p className="text-sm text-slate-400">Insira o código do seu pedido para acompanhar em tempo real</p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Ex: 60ba42c8d20..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="flex-grow px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-energy/20 text-sm"
              required
            />
            <Button type="submit">Buscar</Button>
          </form>
        </Card>
      )}

      {orderId && loading && !order && (
        <p className="text-center py-12 text-slate-400">Buscando detalhes do rastreamento...</p>
      )}

      {orderId && order && (
        <div className="space-y-6 animate-float-in">
          {/* Header de Status */}
          <Card className="bg-gradient-to-r from-energy/10 to-transparent border-l-4 border-l-energy">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acompanhando Pedido</span>
                <h3 className="text-lg font-bold text-slate-850 dark:text-white mt-0.5">
                  De: {order.merchantId?.name}
                </h3>
              </div>
              <div className="text-left md:text-right">
                <span className="text-xs text-slate-400">Código do Pedido</span>
                <p className="text-sm font-semibold truncate max-w-xs">{order._id}</p>
              </div>
            </div>
          </Card>

          {/* Timeline Visual */}
          <Card className="space-y-8">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400">Linha do Tempo</h3>
            
            <div className="relative pl-6 border-l border-slate-200 dark:border-slate-800 ml-4 space-y-8">
              {statuses.map((step, idx) => {
                const isCompleted = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="relative">
                    {/* Node Dot Icon */}
                    <span className={`absolute -left-[35px] top-0.5 p-1 rounded-full border-2 transition-all ${
                      isCurrent 
                        ? 'bg-energy border-energy text-white ring-4 ring-orange-500/20' 
                        : isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-300'
                    }`}>
                      <Icon size={14} />
                    </span>

                    <div className="space-y-1">
                      <h4 className={`text-sm font-bold transition-colors ${
                        isCurrent ? 'text-energy' : isCompleted ? 'text-green-500' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Detalhes do Endereço e Itens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="space-y-4">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                Endereço de Entrega
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-350">
                {order.deliveryAddress?.street}, {order.deliveryAddress?.number}<br />
                {order.deliveryAddress?.neighborhood}
              </p>
            </Card>

            <Card className="space-y-4">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                Resumo dos Itens
              </h3>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-350">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <hr className="border-slate-100 dark:border-slate-800" />
                <div className="flex justify-between text-sm font-extrabold text-slate-800 dark:text-white">
                  <span>Total Pago:</span>
                  <span className="text-energy">R$ {order.total.toFixed(2)}</span>
                </div>
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
