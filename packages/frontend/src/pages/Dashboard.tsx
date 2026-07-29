import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Toast, Input } from '../components/ui';
import { 
  LayoutDashboard, ShoppingCart, DollarSign, BarChart3, Clock, 
  AlertCircle, Menu as MenuIcon, Settings, Save,
  Volume2, VolumeX, Printer, Percent, CreditCard, TrendingUp, FileText, Bike, Sparkles,
  CheckCircle2, ChefHat, Search, Truck, XCircle, MessageSquare, Copy
} from 'lucide-react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { SubscriptionForm } from '../components/SubscriptionForm';
import { getPaymentStatusUi } from '../utils/orderStatusUi';
import { API_URL, SOCKET_URL } from '../config/publicEnv';
import { ProductsPanel } from '../features/merchant/components/ProductsPanel';
import { WhatsAppWorkspace } from '../features/merchant/components/WhatsAppWorkspace';
import { uploadMerchantImage } from '../features/merchant/services/imageUploadService';
import { MerchantWallet } from '../features/merchant/components/MerchantWallet';

interface IOrder {
  _id: string;
  customerId: { name: string; phone: string };
  items: {
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
  deliveryAddress: { street: string; number: string };
  paymentMethod: string;
  paymentStatus?: string;
  commission?: number;
}

interface IStats {
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  averageTicket: number;
  pixRevenue?: number;
  cashRevenue?: number;
  cardRevenue?: number;
  totalCommission?: number;
}

export const Dashboard: React.FC = () => {
  const { isAuthenticated, role, user, checkAuth } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'whatsapp' | 'settings' | 'finance' | 'subscription'>('orders');
  const [stats, setStats] = useState<IStats>({ 
    totalOrders: 0, 
    pendingOrders: 0, 
    revenue: 0, 
    averageTicket: 0,
    pixRevenue: 0,
    cashRevenue: 0,
    cardRevenue: 0,
    totalCommission: 0
  });
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estados das Configurações do Lojista
  const [settingsForm, setSettingsForm] = useState({
    logoImage: '',
    coverImage: '',
    open: '08:00',
    close: '22:00',
    paymentMethods: [] as string[],
    cnpj: '',
    address: {
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: 'PR',
      zipCode: ''
    }
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('alarmMuted') === 'true');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Conexão socket.io em tempo real
  useEffect(() => {
    if (!user?._id) return;

    const socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('accessToken') || undefined },
      withCredentials: true
    });

    socket.emit('joinMerchantRoom', user._id);

    socket.on('newOrder', (newOrder: IOrder) => {
      setOrders((prev) => {
        if (prev.some(o => o._id === newOrder._id)) return prev;
        return [newOrder, ...prev];
      });
      setStats((prev) => ({
        ...prev,
        pendingOrders: prev.pendingOrders + 1,
        totalOrders: prev.totalOrders + 1
      }));
      setToast({ message: 'Novo pedido recebido!', type: 'success' });
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id]);

  // Polling como backup em caso de queda de websocket
  useEffect(() => {
    if (!isAuthenticated || role !== 'merchant') return;
    
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 20000);

    return () => clearInterval(interval);
  }, [isAuthenticated, role]);

  const pendingOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'PAID');
  const waitingPaymentOrders = pendingOrders.filter((order) => order.status === 'PENDING' && ['PIX', 'Cartão'].includes(order.paymentMethod));
  const actionableNewOrders = pendingOrders.filter((order) => order.status === 'PAID' || !['PIX', 'Cartão'].includes(order.paymentMethod));
  const publicStoreLink = user?._id ? `${window.location.origin}/store/${user._id}` : '';

  // Controle de áudio do alarme
  useEffect(() => {
    const playAlarm = async () => {
      if (pendingOrders.length > 0 && !isMuted) {
        if (!audioRef.current) {
          audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav');
          audioRef.current.loop = true;
        }
        try {
          await audioRef.current.play();
        } catch (err) {
          console.warn("Autoplay block: interação necessária do usuário para som de alarme");
        }
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    };

    playAlarm();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [pendingOrders.length, isMuted]);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const nextVal = !prev;
      localStorage.setItem('alarmMuted', String(nextVal));
      return nextVal;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const fileUrl = await uploadMerchantImage(file, 'logo');
      setSettingsForm(prev => ({ ...prev, logoImage: fileUrl }));
      setToast({ message: 'Logo carregada com sucesso!', type: 'success' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao fazer upload da logo';
      setToast({ message: msg, type: 'error' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCover(true);
      const fileUrl = await uploadMerchantImage(file, 'cover');
      setSettingsForm(prev => ({ ...prev, coverImage: fileUrl }));
      setToast({ message: 'Imagem de capa carregada com sucesso!', type: 'success' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao fazer upload da capa';
      setToast({ message: msg, type: 'error' });
    } finally {
      setUploadingCover(false);
    }
  };

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
        coverImage: (user as any).coverImage || '',
        open: user.operatingHours?.open || '08:00',
        close: user.operatingHours?.close || '22:00',
        paymentMethods: user.paymentMethods || ['PIX', 'Dinheiro'],
        cnpj: '',
        address: {
          street: user.address?.street || '',
          number: user.address?.number || '',
          neighborhood: user.address?.neighborhood || '',
          city: user.address?.city || '',
          state: user.address?.state || 'PR',
          zipCode: user.address?.zipCode || ''
        }
      });
    }
  }, [user]);

  const getStatusUpdateErrorMessage = (err: any, newStatus: string): string => {
    const message = err.response?.data?.message || '';
    if (/Transição de status inválida|unpaid|pagamento|payment/i.test(message)) {
      return 'Este pedido ainda não pode avançar. Confira se o pagamento foi aprovado ou se o status atual permite essa ação.';
    }
    if (/refund|estorno/i.test(message)) {
      return 'O pedido foi cancelado, mas o estorno precisa de acompanhamento operacional.';
    }
    return message || `Erro ao atualizar o pedido para ${getMerchantStatusUi(newStatus).label}.`;
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await apiClient.post(`/orders/${orderId}/status`, { status: newStatus });
      if (response.data?.status === 'success') {
        setToast({ message: `Pedido atualizado: ${getMerchantStatusUi(newStatus).label}`, type: 'success' });
        fetchDashboardData();
      }
    } catch (err: any) {
      setToast({ message: getStatusUpdateErrorMessage(err, newStatus), type: 'error' });
    }
  };

  // Salvar Configurações
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user?._id) return;

      if (!user.hasCnpj) {
        await apiClient.put(`/merchants/${user._id}/business-profile`, {
          cnpj: settingsForm.cnpj.replace(/\D/g, ''),
          address: settingsForm.address
        });
      }
      
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

      // 4. Atualizar Capa
      await apiClient.put(`/merchants/${user._id}/cover`, {
        coverImage: settingsForm.coverImage
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

  const handleToggleForceClose = async () => {
    if (!user) return;
    try {
      const newStatus = !user.isForceClosed;
      const res = await apiClient.put(`/merchants/${user._id}/profile`, { isForceClosed: newStatus });
      if (res.data?.status === 'success') {
        setToast({ 
          message: newStatus 
            ? 'Estabelecimento FECHADO manualmente!' 
            : 'Estabelecimento ABERTO para vendas!', 
          type: 'success' 
        });
        await checkAuth();
      }
    } catch (err) {
      setToast({ message: 'Erro ao alterar o status de funcionamento', type: 'error' });
    }
  };

  const handleCopyPublicStoreLink = async () => {
    if (!publicStoreLink) return;

    try {
      await navigator.clipboard.writeText(publicStoreLink);
      setToast({ message: 'Link copiado com sucesso.', type: 'success' });
    } catch (err) {
      setToast({ message: 'Erro ao copiar link da loja', type: 'error' });
    }
  };

  const handlePrintOrder = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
      setToast({ message: 'Erro ao abrir janela de impressão. Verifique se o bloqueador de popups está ativado.', type: 'error' });
      return;
    }

    const itemsHtml = order.items.map((item: any) => {
      const optionsStr = item.chosenOptions && item.chosenOptions.length > 0
        ? `<div style="font-size: 11px; margin-left: 10px; font-style: italic;">
             ${item.chosenOptions.map((opt: any) => `- ${opt.groupName}: ${opt.optionName} (+R$ ${opt.price.toFixed(2)})`).join('<br/>')}
           </div>`
        : '';
      const notesStr = item.notes
        ? `<div style="font-size: 11px; margin-left: 10px; font-weight: bold; background-color: #eee; padding: 2px;">
             Obs: ${item.notes}
           </div>`
        : '';

      return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span><b>${item.quantity}x</b> ${item.name}</span>
            <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
          </div>
          ${optionsStr}
          ${notesStr}
        </div>
      `;
    }).join('');

    const formattedDate = new Date(order.createdAt).toLocaleString('pt-BR');

    const address = order.deliveryAddress;
    const addressStr = address
      ? `${address.street}, ${address.number}<br/>
         Bairro: ${address.neighborhood}<br/>
         Cidade: ${address.city}<br/>
         ${address.complement ? `<b>Complemento:</b> ${address.complement}<br/>` : ''}
         ${address.referencePoint ? `<b>Referência:</b> ${address.referencePoint}<br/>` : ''}`
      : 'Retirada no Balcão';

    printWindow.document.write(`
      <html>
      <head>
        <title>Comanda - Pedido #${order._id.substring(order._id.length - 6)}</title>
        <style>
          @media print {
            body { margin: 0; padding: 10px; }
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            background: #fff;
            line-height: 1.4;
            max-width: 300px;
            margin: 0 auto;
            padding: 15px;
          }
          .text-center { text-align: center; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          .totals-table { width: 100%; font-size: 12px; }
          .totals-table td { padding: 2px 0; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="text-center">
          <h2 style="margin: 0; font-size: 16px;">${user?.name}</h2>
          <p style="margin: 3px 0; font-size: 11px;">Delivery Rápido</p>
          <p style="margin: 3px 0; font-size: 12px;"><b>PEDIDO: #${order._id.substring(order._id.length - 6).toUpperCase()}</b></p>
          <span style="font-size: 10px;">${formattedDate}</span>
        </div>
        
        <div class="divider"></div>
        
        <div>
          <b>CLIENTE:</b> ${order.customerId?.name || 'Cliente'}<br/>
          <b>CONTATO:</b> ${order.customerId?.phone || ''}<br/>
          <b>PAGAMENTO:</b> ${order.paymentMethod}
        </div>
        
        <div class="divider"></div>
        
        <div>
          <b>ENDEREÇO DE ENTREGA:</b><br/>
          ${addressStr}
        </div>
        
        <div class="divider"></div>
        
        <div style="margin-top: 10px;">
          <b style="display: block; margin-bottom: 5px;">ITENS:</b>
          ${itemsHtml}
        </div>
        
        <div class="divider"></div>
        
        <table class="totals-table">
          <tr>
            <td>Subtotal:</td>
            <td align="right">R$ ${order.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Taxa de Entrega:</td>
            <td align="right">R$ ${order.deliveryFee.toFixed(2)}</td>
          </tr>
          <tr class="bold">
            <td>TOTAL GERAL:</td>
            <td align="right" style="font-size: 14px;">R$ ${order.total.toFixed(2)}</td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <div class="text-center" style="font-size: 10px; margin-top: 15px;">
          Obrigado pela preferência!
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Separa pedidos ativos
  const activeOrders = orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'IN_TRANSIT'].includes(o.status));

  // Helper para obter o próximo status
  const getMerchantStatusUi = (status: string) => {
    const statuses: Record<string, { label: string; description: string; variant: 'orange' | 'green' | 'blue' | 'red' | 'gray'; icon: any }> = {
      PENDING: {
        label: 'Aguardando pagamento',
        description: 'Não prepare ainda. O pagamento online ainda não foi confirmado.',
        variant: 'gray',
        icon: Clock
      },
      PAID: {
        label: 'Pago, precisa de aceite',
        description: 'Pagamento aprovado. Aceite para começar o preparo ou recuse para iniciar estorno.',
        variant: 'orange',
        icon: CreditCard
      },
      ACCEPTED: {
        label: 'Aceito',
        description: 'Pedido aceito. Próximo passo obrigatório: preparar.',
        variant: 'blue',
        icon: CheckCircle2
      },
      PREPARING: {
        label: 'Em preparo',
        description: 'Pedido em produção. Marque como pronto para acionar o motoboy.',
        variant: 'orange',
        icon: ChefHat
      },
      READY: {
        label: 'Pronto / Buscando motoboy',
        description: 'A retirada foi enviada diretamente ao canal dos motoboys.',
        variant: 'orange',
        icon: Search
      },
      DISPATCHED: {
        label: 'Motoboy acionado',
        description: 'A entrega foi acionada. Aguarde avanço do motoboy.',
        variant: 'blue',
        icon: Truck
      },
      IN_TRANSIT: {
        label: 'Em entrega',
        description: 'Pedido saiu para entrega.',
        variant: 'blue',
        icon: Bike
      },
      DELIVERED: {
        label: 'Entregue',
        description: 'Pedido concluído.',
        variant: 'green',
        icon: CheckCircle2
      },
      CANCELLED: {
        label: 'Cancelado',
        description: 'Pedido recusado/cancelado. Verifique estorno quando houver pagamento online.',
        variant: 'red',
        icon: XCircle
      }
    };
    return statuses[status] || { label: status, description: 'Status recebido do sistema.', variant: 'gray' as const, icon: Clock };
  };

  const canAcceptNewOrder = (order: IOrder) => {
    return order.status === 'PAID' || !['PIX', 'Cartão'].includes(order.paymentMethod);
  };

  const getNextStatusAction = (status: string) => {
    const flows: { [key: string]: { label: string; next: string } } = {
      ACCEPTED: { label: 'Preparar pedido', next: 'PREPARING' },
      PREPARING: { label: 'Pronto / Enviar para entrega', next: 'READY' }
    };
    return flows[status];
  };

  return (
    <div className="space-y-8">
      {user?.subscriptionStatus !== 'ACTIVE' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
            <div>
              <h4 className="font-bold text-red-800 dark:text-red-200">Sua assinatura está inativa!</h4>
              <p className="text-sm text-red-600 dark:text-red-400">Você não poderá receber novos pedidos até regularizar sua assinatura.</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('subscription')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            Regularizar Agora
          </button>
        </div>
      )}

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

        <div className="flex flex-wrap items-center gap-3">
          {/* Manual Open/Closed Toggle */}
          <button
            type="button"
            onClick={handleToggleForceClose}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm ${
              user?.isForceClosed
                ? 'border-red-200 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100/50'
                : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/50'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                user?.isForceClosed ? 'bg-red-400' : 'bg-emerald-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                user?.isForceClosed ? 'bg-red-500' : 'bg-emerald-500'
              }`}></span>
            </span>
            {user?.isForceClosed ? 'Loja Fechada (Clique para Abrir)' : 'Loja Aberta (Clique para Fechar)'}
          </button>

          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/20 bg-slate-100 p-1 dark:bg-slate-800/80">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-455'
              }`}
            >
              <ShoppingCart size={14} /> Pedidos
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'menu'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-455'
              }`}
            >
              <MenuIcon size={14} /> Cardápio
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'whatsapp'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-455'
              }`}
            >
              <MessageSquare size={14} /> WhatsApp
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'finance'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-455'
              }`}
            >
              <DollarSign size={14} /> Financeiro
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-455'
              }`}
            >
              <Settings size={14} /> Configurações
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'subscription'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-455'
              }`}
            >
              <CreditCard size={14} /> Assinatura
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
            <ShoppingCart size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Total de Pedidos</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.totalOrders}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-500">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Pedidos Pendentes</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.pendingOrders}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-orange-500/10 rounded-2xl text-energy">
            <CreditCard size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Aguardando Pagamento</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{waitingPaymentOrders.length}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Faturamento</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">R$ {stats.revenue.toFixed(2)}</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500">
            <BarChart3 size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Ticket Médio</span>
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
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <AlertCircle size={20} className="text-yellow-500" /> Precisa de Ação ({actionableNewOrders.length})
                  </h3>
                  {actionableNewOrders.length > 0 && (
                    <button
                      onClick={toggleMute}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-energy transition-colors flex items-center gap-1 text-xs font-semibold"
                      title={isMuted ? "Desmutar Alerta" : "Mutar Alerta"}
                      aria-label={isMuted ? "Desmutar Alerta de Novos Pedidos" : "Mutar Alerta de Novos Pedidos"}
                    >
                      {isMuted ? (
                        <>
                          <VolumeX size={16} /> Mutado
                        </>
                      ) : (
                        <>
                          <Volume2 size={16} className="animate-pulse text-energy" /> Tocando
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {waitingPaymentOrders.length > 0 && (
                  <Card className="border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-850/40">
                    <div className="flex items-start gap-3">
                      <CreditCard size={18} className="mt-0.5 text-energy" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-white">
                          {waitingPaymentOrders.length} pedido(s) aguardando pagamento
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          Não aceite nem prepare pedidos online até o pagamento virar aprovado. O sistema move para a fila de ação quando estiver seguro.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {actionableNewOrders.length === 0 ? (
                  <Card className="py-8 text-center text-slate-400">Nenhum pedido aguardando aceite.</Card>
                ) : (
                  actionableNewOrders.map((order) => {
                    const statusUi = getMerchantStatusUi(order.status);
                    const StatusIcon = statusUi.icon;
                    const paymentUi = getPaymentStatusUi(order.paymentStatus);
                    const PaymentIcon = paymentUi?.icon;
                    return (
                    <Card key={order._id} className="border-l-4 border-l-yellow-500/60 space-y-4 shadow-sm">
                       <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-slate-850 dark:text-white text-sm">{order.customerId?.name}</h4>
                            <button
                              type="button"
                              onClick={() => handlePrintOrder(order)}
                              className="p-1 text-slate-400 hover:text-energy hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              title="Imprimir Comanda"
                              aria-label="Imprimir comanda térmica do pedido"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                          <p className="text-xs text-slate-400">{order.customerId?.phone}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant={statusUi.variant}>{statusUi.label}</Badge>
                            {paymentUi && <Badge variant={paymentUi.variant}>{paymentUi.label}</Badge>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400">Total</span>
                          <p className="text-sm font-black text-energy">R$ {order.total.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850/40">
                        <div className="flex items-start gap-2">
                          <StatusIcon size={16} className="mt-0.5 text-energy" />
                          <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                            {statusUi.description}
                          </p>
                        </div>
                        {paymentUi && PaymentIcon && (
                          <div className="mt-2 flex items-start gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                            <PaymentIcon size={15} className="mt-0.5 text-slate-400" />
                            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                              {paymentUi.description}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-650 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-2.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex gap-2.5 items-center bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-105/80 dark:border-slate-800/60">
                            {item.image && (
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="w-10 h-10 rounded object-cover flex-shrink-0 bg-slate-50 border border-slate-100"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-2">
                                <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{item.quantity}x {item.name}</span>
                                <span className="font-black text-energy text-[11px]">R$ {(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                              {item.description && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            const needsRefund = ['PIX', 'Cartão'].includes(order.paymentMethod) && order.paymentStatus === 'RECEIVED';
                            const confirmed = window.confirm(
                              needsRefund
                                ? 'Recusar este pedido vai cancelar o preparo e iniciar fluxo de estorno. Confirma?'
                                : 'Recusar este pedido? O cliente será avisado.'
                            );
                            if (confirmed) handleUpdateStatus(order._id, 'CANCELLED');
                          }}
                        >
                          Recusar pedido
                        </Button>
                        <Button size="sm" className="flex-1" disabled={!canAcceptNewOrder(order)} onClick={() => handleUpdateStatus(order._id, 'ACCEPTED')}>
                          Aceitar Pedido
                        </Button>
                      </div>
                    </Card>
                    );
                  })
                )}
              </div>

              {/* Pedidos Ativos */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Bike size={20} className="text-energy animate-pulse" /> Pedidos em Andamento ({activeOrders.length})
                </h3>
                
                {activeOrders.length === 0 ? (
                  <Card className="py-8 text-center text-slate-400">Nenhum pedido em preparação ou entrega.</Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeOrders.map((order) => {
                      const nextAction = getNextStatusAction(order.status);
                      const statusUi = getMerchantStatusUi(order.status);
                      const StatusIcon = statusUi.icon;
                      const paymentUi = getPaymentStatusUi(order.paymentStatus);
                      return (
                        <Card key={order._id} className="space-y-4 flex flex-col justify-between shadow-sm">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{order.customerId?.name}</h4>
                                  <button
                                    type="button"
                                    onClick={() => handlePrintOrder(order)}
                                    className="p-1 text-slate-400 hover:text-energy hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                    title="Imprimir Comanda"
                                    aria-label="Imprimir comanda térmica do pedido"
                                  >
                                    <Printer size={13} />
                                  </button>
                                </div>
                                <span className="text-xs text-slate-400 block">{order.deliveryAddress?.street}, {order.deliveryAddress?.number}</span>
                              </div>
                              <Badge variant={statusUi.variant}>{statusUi.label}</Badge>
                            </div>

                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850/40">
                              <div className="flex items-start gap-2">
                                <StatusIcon size={16} className="mt-0.5 text-energy" />
                                <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                                  {statusUi.description}
                                </p>
                              </div>
                              {paymentUi && (
                                <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                  <CreditCard size={13} className="text-slate-400" />
                                  {paymentUi.label} · {order.paymentMethod}
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 space-y-2 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex gap-2.5 items-center bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-105/80 dark:border-slate-800/60">
                                  {item.image && (
                                    <img 
                                      src={item.image} 
                                      alt={item.name} 
                                      className="w-10 h-10 rounded object-cover flex-shrink-0 bg-slate-50 border border-slate-100"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline gap-2">
                                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{item.quantity}x {item.name}</span>
                                      <span className="font-black text-energy text-[11px]">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                    {item.description && (
                                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
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
                            {!nextAction && order.status === 'READY' && (
                              <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3 text-xs font-semibold leading-relaxed text-slate-600 dark:border-orange-900/40 dark:bg-orange-950/10 dark:text-slate-300">
                                <div className="flex items-start gap-2">
                                  <Search size={15} className="mt-0.5 text-energy" />
                                  <span>Pedido pronto. A busca por motoboy já foi iniciada. Se ficar parado por muito tempo, o admin operacional deve intervir.</span>
                                </div>
                              </div>
                            )}
                            {!nextAction && ['DISPATCHED', 'IN_TRANSIT'].includes(order.status) && (
                              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs font-semibold leading-relaxed text-slate-600 dark:border-blue-900/40 dark:bg-blue-950/10 dark:text-slate-300">
                                <div className="flex items-start gap-2">
                                  <MessageSquare size={15} className="mt-0.5 text-blue-500" />
                                  <span>Entrega em andamento. O acompanhamento permanece disponível no aplicativo.</span>
                                </div>
                              </div>
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

          {activeTab === 'menu' && user?._id && (
            <ProductsPanel merchantId={user._id} onToast={setToast} />
          )}

          {activeTab === 'whatsapp' && (
            <WhatsAppWorkspace orders={orders} />
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <>
              <Card className="max-w-2xl mx-auto mb-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <MessageSquare size={20} className="text-energy" /> Divulgar minha loja
                  </h3>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <span className="block truncate">{publicStoreLink}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyPublicStoreLink}
                    className="flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copiar link
                  </Button>
                </div>
              </Card>

              <Card className="max-w-2xl mx-auto space-y-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings size={20} className="text-energy" /> Detalhes do Estabelecimento
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                {!user?.hasCnpj && (
                  <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                    <div>
                      <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">Complete os dados para publicar sua loja</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">Esses dados são solicitados uma única vez.</p>
                    </div>
                    <Input label="CNPJ" inputMode="numeric" value={settingsForm.cnpj}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cnpj: e.target.value })} required />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <Input label="Rua" value={settingsForm.address.street}
                          onChange={(e) => setSettingsForm({ ...settingsForm, address: { ...settingsForm.address, street: e.target.value } })} required />
                      </div>
                      <Input label="Número" value={settingsForm.address.number}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: { ...settingsForm.address, number: e.target.value } })} required />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input label="Bairro" value={settingsForm.address.neighborhood}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: { ...settingsForm.address, neighborhood: e.target.value } })} required />
                      <Input label="Cidade" value={settingsForm.address.city}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: { ...settingsForm.address, city: e.target.value } })} required />
                      <Input label="Estado" maxLength={2} value={settingsForm.address.state}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: { ...settingsForm.address, state: e.target.value.toUpperCase() } })} required />
                      <Input label="CEP" value={settingsForm.address.zipCode}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: { ...settingsForm.address, zipCode: e.target.value } })} required />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  {/* Imagem da Logo */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Imagem da Logo / Estabelecimento
                    </label>
                    <div className="flex gap-4 items-center">
                      {settingsForm.logoImage ? (
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                          <img src={settingsForm.logoImage} alt="Logo Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSettingsForm({ ...settingsForm, logoImage: '' })}
                            className="absolute inset-0 bg-black/55 text-white flex items-center justify-center text-xs opacity-0 hover:opacity-100 transition-opacity"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-xs">
                          Sem Logo
                        </div>
                      )}
                      
                      <label className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        uploadingLogo
                          ? 'opacity-50 pointer-events-none'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        {uploadingLogo ? 'Carregando...' : 'Enviar Logo'}
                      </label>
                    </div>
                  </div>

                  {/* Imagem da Capa */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Imagem de Capa (Banner)
                    </label>
                    <div className="flex gap-4 items-center">
                      {settingsForm.coverImage ? (
                        <div className="relative w-28 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                          <img src={settingsForm.coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSettingsForm({ ...settingsForm, coverImage: '' })}
                            className="absolute inset-0 bg-black/55 text-white flex items-center justify-center text-xs opacity-0 hover:opacity-100 transition-opacity"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <div className="w-28 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-xs">
                          Sem Capa
                        </div>
                      )}
                      
                      <label className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        uploadingCover
                          ? 'opacity-50 pointer-events-none'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          className="hidden"
                          disabled={uploadingCover}
                        />
                        {uploadingCover ? 'Carregando...' : 'Enviar Capa'}
                      </label>
                    </div>
                  </div>
                </div>

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
                    {['PIX', 'Dinheiro', 'Cartão', 'Cartão na entrega'].map((method) => {
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

            <Card className="max-w-2xl mx-auto mt-6 space-y-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles size={20} className="text-energy" /> Conexão Mercado Pago (Repasse)
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Para receber os repasses automáticos dos pedidos pagos via PIX ou Cartão de Crédito Online, você precisa conectar sua conta do Mercado Pago.
              </p>

              {(user as any)?.mpUserId ? (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Conta Conectada</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      ID do Usuário Mercado Pago: {(user as any).mpUserId}
                    </p>
                  </div>
                  <a
                    href={`${API_URL}/payments/oauth/connect?merchantId=${user?._id}`}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                  >
                    Reconectar Conta
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Conta Não Conectada</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Conecte sua conta para habilitar o split de pagamento automático e receber pelas vendas online.
                    </p>
                  </div>
                  <a
                    href={`${API_URL}/payments/oauth/connect?merchantId=${user?._id}`}
                    className="px-4 py-2.5 bg-energy hover:bg-energy-dark text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Sparkles size={14} /> Conectar Mercado Pago
                  </a>
                </div>
              )}
            </Card>
          </>
        )}

          {/* TAB: FINANCE */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <MerchantWallet merchantId={user?._id} />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                    Extrato de Comissões e Repasses
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Monitore seu faturamento por método de pagamento e as comissões da plataforma.
                  </p>
                </div>
              </div>

              {/* Grid de Faturamento por Método de Pagamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="flex items-center gap-4 p-5 border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                  <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Faturamento Total</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
                      R$ {(stats.revenue || 0).toFixed(2)}
                    </span>
                  </div>
                </Card>

                <Card className="flex items-center gap-4 p-5 border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                  <div className="p-3 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-2xl text-cyan-600 dark:text-cyan-400">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Faturamento PIX</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
                      R$ {(stats.pixRevenue || 0).toFixed(2)}
                    </span>
                  </div>
                </Card>

                <Card className="flex items-center gap-4 p-5 border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                  <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Faturamento Dinheiro</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
                      R$ {(stats.cashRevenue || 0).toFixed(2)}
                    </span>
                  </div>
                </Card>

                <Card className="flex items-center gap-4 p-5 border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                  <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Faturamento Cartão</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">
                      R$ {(stats.cardRevenue || 0).toFixed(2)}
                    </span>
                  </div>
                </Card>
              </div>

              {/* Destaque de Comissões e Repasses */}
              <Card className="p-6 border border-energy/20 bg-gradient-to-br from-energy/5 to-energy/10 dark:from-energy/10 dark:to-energy/5 shadow-md rounded-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-energy/20 rounded-2xl text-energy mt-1">
                      <Percent size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                        Taxa e Repasse (Traz Pra Cá)
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl leading-relaxed">
                        A taxa da plataforma Traz Pra Cá é fixa: <strong className="text-energy">R$ 5,00 por pedido válido</strong>. Em pagamentos online, esse valor fica retido automaticamente no split do Mercado Pago.
                      </p>
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-550 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                          PIX/Cartão online: taxa retida automaticamente no split.
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Dinheiro: taxa registrada para acerto operacional com o admin.
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-energy/10 shadow-sm flex flex-col items-center md:items-end min-w-[200px] justify-center">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Taxa da Plataforma</span>
                    <span className="text-3xl font-black text-energy mt-1">
                      R$ {(stats.totalCommission || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Tabela Detalhada de Histórico de Pedidos */}
              <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText size={18} className="text-energy" /> Detalhes dos Pedidos Faturados
                  </h4>
                  <Badge variant="orange">
                    {orders.filter(o => o.status !== 'PENDING' && o.status !== 'PAID' && o.status !== 'CANCELLED').length} Pedidos Válidos
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  {orders.filter(o => o.status !== 'PENDING' && o.status !== 'PAID' && o.status !== 'CANCELLED').length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                      Nenhum pedido faturado neste período.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
                          <th className="py-3 px-5">Cód. Pedido</th>
                          <th className="py-3 px-5">Cliente</th>
                          <th className="py-3 px-5">Data / Hora</th>
                          <th className="py-3 px-5">Forma de Pagamento</th>
                          <th className="py-3 px-5 text-right">Faturamento</th>
                          <th className="py-3 px-5 text-right">Taxa Plataforma</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-sm">
                        {orders
                          .filter(order => order.status !== 'PENDING' && order.status !== 'PAID' && order.status !== 'CANCELLED')
                          .map((order) => {
                            const date = new Date(order.createdAt).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                            
                            const individualCommission = (order.commission || 0) + (order.deliveryFee || 0);

                            return (
                              <tr key={order._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300 font-semibold transition-colors">
                                <td className="py-4.5 px-5 font-mono text-xs text-slate-400 dark:text-slate-500">
                                  #{order._id.substring(order._id.length - 6).toUpperCase()}
                                </td>
                                <td className="py-4.5 px-5 text-slate-800 dark:text-white">
                                  {order.customerId?.name || 'Cliente Anonimizado'}
                                </td>
                                <td className="py-4.5 px-5 text-xs text-slate-400 dark:text-slate-500">
                                  {date}
                                </td>
                                <td className="py-4.5 px-5">
                                  <Badge 
                                    variant={
                                      order.paymentMethod === 'PIX' 
                                        ? 'green' 
                                        : order.paymentMethod === 'Dinheiro' 
                                          ? 'orange' 
                                          : 'blue'
                                    }
                                  >
                                    {order.paymentMethod}
                                  </Badge>
                                </td>
                                <td className="py-4.5 px-5 text-right text-slate-800 dark:text-white font-bold">
                                  R$ {order.subtotal.toFixed(2)}
                                </td>
                                <td className="py-4.5 px-5 text-right text-energy font-bold">
                                  R$ {individualCommission.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* TAB: ASSINATURA */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <SubscriptionForm user={user} />
            </div>
          )}
        </div>
      )}

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
