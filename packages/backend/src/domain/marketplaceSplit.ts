export const assertValidMarketplaceSplit = (transactionAmount: number, applicationFee: number): void => {
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new Error('Valor da transação inválido.');
  }
  if (!Number.isFinite(applicationFee) || applicationFee < 0 || applicationFee >= transactionAmount) {
    throw new Error('Taxa do marketplace inválida para o split.');
  }
};
