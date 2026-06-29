import {
  Ban,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  MapPin,
  RotateCcw,
  Search,
  Store,
  Truck,
  type LucideIcon
} from 'lucide-react';

export type OrderStatusUi = {
  label: string;
  description: string;
  customerHint: string;
  variant: 'orange' | 'green' | 'blue' | 'red' | 'gray';
  icon: LucideIcon;
  progress: number;
  isFinal?: boolean;
  isProblem?: boolean;
};

export const ORDER_STATUS_UI: Record<string, OrderStatusUi> = {
  PENDING: {
    label: 'Aguardando pagamento',
    description: 'O pedido foi criado e ainda depende da confirmação do pagamento.',
    customerHint: 'Se escolheu PIX, pague pelo QR Code ou copia e cola. Se escolheu dinheiro, aguarde a loja aceitar.',
    variant: 'gray',
    icon: Clock,
    progress: 12
  },
  PAID: {
    label: 'Pago, aguardando loja',
    description: 'Pagamento confirmado. A loja precisa aceitar ou rejeitar o pedido.',
    customerHint: 'Você será avisado quando a loja aceitar. Se rejeitar, o estorno entra no fluxo automaticamente.',
    variant: 'orange',
    icon: CreditCard,
    progress: 28
  },
  ACCEPTED: {
    label: 'Aceito pela loja',
    description: 'A loja aceitou seu pedido.',
    customerHint: 'Seu pedido entrou na fila da cozinha.',
    variant: 'blue',
    icon: Store,
    progress: 42
  },
  PREPARING: {
    label: 'Em preparo',
    description: 'A loja está preparando seu pedido.',
    customerHint: 'Agora é só acompanhar. Avisaremos quando estiver pronto para entrega.',
    variant: 'orange',
    icon: ChefHat,
    progress: 56
  },
  READY: {
    label: 'Pronto para entrega',
    description: 'O pedido está pronto e o sistema está acionando um motoboy.',
    customerHint: 'Estamos buscando um entregador disponível. Essa etapa pode levar alguns minutos.',
    variant: 'orange',
    icon: Search,
    progress: 70
  },
  DISPATCHED: {
    label: 'Motoboy acionado',
    description: 'A entrega foi atribuída e está avançando.',
    customerHint: 'O motoboy recebeu a solicitação. Em breve o pedido sai para entrega.',
    variant: 'blue',
    icon: Truck,
    progress: 78
  },
  IN_TRANSIT: {
    label: 'Saiu para entrega',
    description: 'O pedido está a caminho do endereço informado.',
    customerHint: 'Fique atento ao WhatsApp e ao endereço de entrega.',
    variant: 'blue',
    icon: MapPin,
    progress: 90
  },
  DELIVERED: {
    label: 'Entregue',
    description: 'Pedido entregue com sucesso.',
    customerHint: 'Você pode avaliar o pedido ou pedir novamente.',
    variant: 'green',
    icon: CheckCircle2,
    progress: 100,
    isFinal: true
  },
  CANCELLED: {
    label: 'Cancelado',
    description: 'O pedido foi cancelado ou rejeitado.',
    customerHint: 'Se já houve pagamento online, acompanhe o status do estorno.',
    variant: 'red',
    icon: Ban,
    progress: 100,
    isFinal: true,
    isProblem: true
  }
};

export const PAYMENT_STATUS_UI: Record<string, { label: string; description: string; variant: OrderStatusUi['variant']; icon: LucideIcon }> = {
  PENDING: {
    label: 'Pagamento pendente',
    description: 'Ainda não recebemos confirmação do pagamento.',
    variant: 'gray',
    icon: Clock
  },
  RECEIVED: {
    label: 'Pagamento aprovado',
    description: 'Pagamento confirmado com segurança.',
    variant: 'green',
    icon: Check
  },
  REJECTED: {
    label: 'Pagamento recusado',
    description: 'O pagamento foi recusado. O pedido não deve avançar.',
    variant: 'red',
    icon: Ban
  },
  CANCELLED: {
    label: 'Pagamento cancelado',
    description: 'O pagamento foi cancelado.',
    variant: 'red',
    icon: Ban
  },
  REFUND_PENDING: {
    label: 'Estorno em andamento',
    description: 'O estorno foi solicitado e está sendo processado.',
    variant: 'orange',
    icon: RotateCcw
  },
  REFUNDED: {
    label: 'Estornado',
    description: 'Pagamento estornado.',
    variant: 'green',
    icon: RotateCcw
  },
  REFUND_FAILED: {
    label: 'Falha no estorno',
    description: 'O estorno precisa de revisão operacional.',
    variant: 'red',
    icon: Ban
  }
};

export const getOrderStatusUi = (status?: string): OrderStatusUi => {
  return ORDER_STATUS_UI[status || ''] || {
    label: status || 'Status desconhecido',
    description: 'Não foi possível interpretar o status atual do pedido.',
    customerHint: 'Atualize a página ou fale com o suporte se o pedido não mudar.',
    variant: 'gray',
    icon: Clock,
    progress: 0
  };
};

export const getPaymentStatusUi = (status?: string | null) => {
  if (!status) return null;
  return PAYMENT_STATUS_UI[status] || {
    label: status,
    description: 'Status de pagamento recebido do provedor.',
    variant: 'gray' as const,
    icon: Clock
  };
};
