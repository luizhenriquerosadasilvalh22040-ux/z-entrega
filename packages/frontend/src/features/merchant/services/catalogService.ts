import { apiClient } from '../../../services/apiClient';
import type { MerchantProduct, ProductFormData } from '../types';

const toPayload = (form: ProductFormData) => ({
  name: form.name.trim(),
  description: form.description.trim(),
  price: Number(form.price),
  category: form.category.trim(),
  image: form.image || '',
  stockQuantity: Number(form.stockQuantity),
  optionGroups: form.optionGroups
});

export const catalogService = {
  async list(merchantId: string): Promise<MerchantProduct[]> {
    const response = await apiClient.get(`/products/merchant/${merchantId}`);
    return response.data.data.products;
  },

  async create(form: ProductFormData): Promise<MerchantProduct> {
    const response = await apiClient.post('/products', toPayload(form));
    return response.data.data.product;
  },

  async update(productId: string, form: ProductFormData): Promise<MerchantProduct> {
    const response = await apiClient.put(`/products/${productId}`, toPayload(form));
    return response.data.data.product;
  },

  async setPaused(product: MerchantProduct, isPaused: boolean): Promise<MerchantProduct> {
    const response = await apiClient.put(`/products/${product._id}/stock`, { isPaused });
    return response.data.data.product;
  },

  async remove(productId: string): Promise<void> {
    await apiClient.delete(`/products/${productId}`);
  }
};

