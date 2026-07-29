export interface ProductOption {
  name: string;
  price: number;
}

export interface ProductOptionGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ProductOption[];
}

export interface MerchantProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  stockQuantity: number;
  isPaused: boolean;
  image?: string;
  optionGroups: ProductOptionGroup[];
}

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  image: string;
  stockQuantity: number;
  optionGroups: ProductOptionGroup[];
}

export type MerchantToast = {
  message: string;
  type: 'success' | 'error';
};

