import { apiClient } from '../../../services/apiClient';

export const subscriptionService = {
  async subscribe(cardToken: string, email: string): Promise<void> {
    await apiClient.post('/payments/subscription', { cardToken, email });
  },

  async cancel(): Promise<void> {
    await apiClient.post('/payments/subscription/cancel');
  }
};

