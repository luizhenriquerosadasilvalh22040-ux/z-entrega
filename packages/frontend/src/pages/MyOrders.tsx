import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Toast, Modal } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Star } from 'lucide-react';
import io from 'socket.io-client';

interface IOrder {
  _id: string;
  merchantId: { id: string; name: string };
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
    description?: string;
    chosenOptions?: { groupName: string; optionName: string; price: number }[];
    notes?: string;
  }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  createdAt: string;
  review?: {
    id: string;
    rating: number;
    comment?: string;
  };
}

export const MyOrders: React.FC = () => {
  const { isAuthenticated, role } = useAuthStore();
  const { addToCart, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // States for Reviews
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<IOrder | null>(null);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [commentInput, setCommentInput] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

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

  // Socket.io real-time status updates
  useEffect(() => {
    if (orders.length === 0) return;

    const activeOrders = orders.filter(
      (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
    );
    if (activeOrders.length === 0) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const socketUrl = API_URL.replace('/api', '');
    const socket = io(socketUrl);

    activeOrders.forEach((o) => {
      socket.emit('joinOrderRoom', o._id);
    });

    socket.on('orderStatusUpdated', (data: { orderId: string; status: string }) => {
      setOrders((prev) =>
        prev.map((o) => (o._id === data.orderId ? { ...o, status: data.status } : o))
      );
      setToast({
        message: `Status de um pedido foi atualizado!`,
        type: 'info'
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [orders.map(o => `${o._id}-${o.status}`).join(',')]);

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

  const handleReorder = (order: IOrder) => {
    try {
      clearCart();
      order.items.forEach((item) => {
        const productFake = {
          _id: item.productId,
          name: item.name,
          description: item.description || '',
          price: item.price,
          category: '',
          isAvailable: true,
          stockQuantity: 999,
          isPaused: false,
          image: item.image,
          optionGroups: []
        };

        addToCart(
          productFake,
          item.quantity,
          item.chosenOptions || [],
          item.notes || '',
          order.merchantId.id,
          order.merchantId.name
        );
      });

      setToast({ message: 'Itens adicionados ao carrinho! Redirecionando...', type: 'success' });
      setTimeout(() => {
        navigate(`/store/${order.merchantId.id}`);
      }, 1200);
    } catch (err) {
      setToast({ message: 'Erro ao refazer o pedido.', type: 'error' });
    }
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

                {order.review && (
                  <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/10 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-600 w-fit">
                    <span className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          className={star <= order.review!.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-250 dark:text-slate-700'}
                        />
                      ))}
                    </span>
                    {order.review.comment && (
                      <span className="border-l border-amber-500/25 pl-2 italic">
                        "{order.review.comment}"
                      </span>
                    )}
                  </div>
                )}

                <div className="text-xs text-slate-400">
                  Realizado em: {new Date(order.createdAt).toLocaleDateString('pt-BR')} às {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>

                {/* Items preview */}
                <div className="space-y-2 mt-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 max-w-md">
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0 border border-slate-100 dark:border-slate-850"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="text-xs font-black text-energy">
                            R$ {(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-550 truncate mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 flex-wrap">
                <div className="text-left md:text-right">
                  <div className="text-xs text-slate-400">Total do Pedido</div>
                  <div className="text-lg font-black text-energy">
                    R$ {order.total.toFixed(2)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {order.status === 'DELIVERED' && (
                    <Button
                      size="sm"
                      onClick={() => handleReorder(order)}
                    >
                      Pedir novamente
                    </Button>
                  )}

                  {order.status === 'DELIVERED' && !order.review && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedOrderForReview(order);
                        setRatingInput(5);
                        setCommentInput('');
                      }}
                    >
                      Avaliar Pedido
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/tracking?id=${order._id}`)}
                    className="flex items-center gap-1.5"
                  >
                    Rastrear <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Avaliação */}
      <Modal 
        isOpen={!!selectedOrderForReview} 
        onClose={() => setSelectedOrderForReview(null)} 
        title={`Avaliar Pedido de ${selectedOrderForReview?.merchantId?.name}`}
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!selectedOrderForReview) return;
          try {
            setSubmittingReview(true);
            const res = await apiClient.post(`/orders/${selectedOrderForReview._id}/review`, {
              rating: ratingInput,
              comment: commentInput
            });

            if (res.data?.status === 'success') {
              setToast({ message: 'Avaliação enviada com sucesso!', type: 'success' });
              setOrders(prev => prev.map(o => 
                o._id === selectedOrderForReview._id 
                  ? { ...o, review: res.data.data.review } 
                  : o
              ));
              setSelectedOrderForReview(null);
            }
          } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao enviar avaliação';
            setToast({ message: msg, type: 'error' });
          } finally {
            setSubmittingReview(false);
          }
        }} className="space-y-6">
          <div className="flex flex-col items-center justify-center space-y-2.5">
            <label className="text-sm font-extrabold text-slate-800 dark:text-white">
              Sua nota para o pedido/entrega
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingInput(star)}
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95 p-1"
                >
                  <Star
                    size={36}
                    className={star <= ratingInput ? 'text-amber-500 fill-amber-500' : 'text-slate-250 dark:text-slate-700'}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-slate-500">
              {ratingInput === 1 ? 'Péssimo' :
               ratingInput === 2 ? 'Ruim' :
               ratingInput === 3 ? 'Regular' :
               ratingInput === 4 ? 'Muito Bom' : 'Excelente'}
            </span>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Comentário (Opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Conte como foi sua experiência com o pedido ou com a entrega..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-energy/20 focus:border-energy rounded-xl shadow-sm text-sm focus:ring-4 transition-all duration-200 outline-none dark:text-white resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              fullWidth 
              onClick={() => setSelectedOrderForReview(null)}
              disabled={submittingReview}
            >
              Cancelar
            </Button>
            <Button type="submit" fullWidth disabled={submittingReview}>
              {submittingReview ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </form>
      </Modal>

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
