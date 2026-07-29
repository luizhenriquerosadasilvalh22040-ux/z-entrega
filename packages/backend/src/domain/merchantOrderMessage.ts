type OrderMessageOption = {
  groupName?: string | null;
  optionName: string;
  price: number;
};

type OrderMessageItem = {
  name: string;
  quantity: number;
  price: number;
  notes?: string | null;
  options?: OrderMessageOption[];
};

export type MerchantOrderMessageInput = {
  id: string;
  customer: {
    name: string;
    phone?: string | null;
  };
  items: OrderMessageItem[];
  deliveryStreet: string;
  deliveryNumber: string;
  deliveryNeighborhood: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryComplement?: string | null;
  deliveryReference?: string | null;
  paymentMethod: string;
  paymentStatus?: string | null;
  cashChangeFor?: number | null;
  requiresCardMachine?: boolean | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
};

const money = (value: number): string => Number(value).toFixed(2).replace('.', ',');
const shortOrderId = (orderId: string): string => orderId.slice(-8).toUpperCase();

export const buildMerchantOrderMessage = (order: MerchantOrderMessageInput): string => {
  const itemLines = order.items.flatMap((item) => {
    const lines = [`• ${item.quantity}x ${item.name} — R$ ${money(item.price * item.quantity)}`];
    for (const option of item.options || []) {
      const group = option.groupName ? `${option.groupName}: ` : '';
      const addition = Number(option.price) > 0 ? ` (+R$ ${money(option.price)})` : '';
      lines.push(`  ↳ ${group}${option.optionName}${addition}`);
    }
    if (item.notes?.trim()) lines.push(`  Obs.: ${item.notes.trim()}`);
    return lines;
  });

  const address = [
    `${order.deliveryStreet}, ${order.deliveryNumber}`,
    order.deliveryNeighborhood,
    `${order.deliveryCity}-${order.deliveryState}`,
    order.deliveryComplement?.trim() ? `Compl.: ${order.deliveryComplement.trim()}` : '',
    order.deliveryReference?.trim() ? `Ref.: ${order.deliveryReference.trim()}` : ''
  ].filter(Boolean).join(' • ');
  const physicalPaymentNote = order.requiresCardMachine
    ? 'Separar a maquininha para o motoboy.'
    : order.paymentMethod === 'Dinheiro' && order.cashChangeFor
      ? `Separar troco para R$ ${money(order.cashChangeFor)}.`
      : null;

  const messageLines: Array<string | null> = [
    `🛎️ *NOVO PEDIDO #${shortOrderId(order.id)}*`,
    '',
    `*Cliente:* ${order.customer.name}`,
    order.customer.phone ? `*Contato:* ${order.customer.phone}` : null,
    '',
    '*ITENS*',
    ...itemLines,
    '',
    '*ENTREGA*',
    address,
    '',
    '*PAGAMENTO*',
    `${order.paymentMethod}${order.paymentStatus === 'RECEIVED' ? ' • Confirmado' : ' • Na entrega'}`,
    physicalPaymentNote,
    `Subtotal: R$ ${money(order.subtotal)}`,
    `Entrega: R$ ${money(order.deliveryFee)}`,
    `*Total: R$ ${money(order.total)}*`,
    '',
    'Acesse o painel do lojista para aceitar o pedido.'
  ];

  return messageLines.filter((line): line is string => line !== null).join('\n');
};
