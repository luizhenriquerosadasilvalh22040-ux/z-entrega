export const PHYSICAL_CARD_PAYMENT_METHOD = 'Cartão na entrega';

export const buildCourierPaymentInstruction = (order: {
  paymentMethod: string;
  cashChangeFor?: number | null;
  requiresCardMachine?: boolean | null;
}): string => {
  if (order.paymentMethod === PHYSICAL_CARD_PAYMENT_METHOD || order.requiresCardMachine) {
    return '⚠️ Levar a maquininha de cartão para receber no endereço.';
  }

  if (order.paymentMethod === 'Dinheiro') {
    if (order.cashChangeFor && Number(order.cashChangeFor) > 0) {
      return `⚠️ Retirar na loja o troco separado para R$ ${Number(order.cashChangeFor).toFixed(2).replace('.', ',')}.`;
    }
    return 'Pagamento em dinheiro na entrega. Confirmar o recebimento com o cliente.';
  }

  return 'Pagamento online já processado. Não cobrar o cliente na entrega.';
};

