import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface IProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  stockQuantity: number;
  isPaused: boolean;
  image?: string;
  optionGroups?: any[];
}

export interface ICartItem {
  cartId: string;
  product: IProduct;
  quantity: number;
  chosenOptions?: { groupName: string; optionName: string; price: number }[];
  notes?: string;
}

interface ICoupon {
  couponId: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
}

interface ICartState {
  cart: ICartItem[];
  merchantId: string | null;
  merchantName: string | null;
  appliedCoupon: ICoupon | null;
  addToCart: (
    product: IProduct,
    quantity: number,
    chosenOptions: { groupName: string; optionName: string; price: number }[],
    notes: string,
    merchantId: string,
    merchantName: string
  ) => { success: boolean; cleared: boolean };
  updateCartQty: (cartId: string, delta: number) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;
  applyCoupon: (coupon: ICoupon) => void;
  removeCoupon: () => void;
}

export const useCartStore = create<ICartState>()(
  persist(
    (set, get) => ({
      cart: [],
      merchantId: null,
      merchantName: null,
      appliedCoupon: null,

      addToCart: (product, quantity, chosenOptions, notes, merchantId, merchantName) => {
        const state = get();
        let cleared = false;
        let newCart = [...state.cart];

        // Se o merchantId for diferente, limpa o carrinho anterior
        if (state.merchantId && state.merchantId !== merchantId) {
          newCart = [];
          cleared = true;
        }

        const isSameOptions = (
          opt1?: { groupName: string; optionName: string; price: number }[],
          opt2?: { groupName: string; optionName: string; price: number }[]
        ): boolean => {
          const list1 = opt1 || [];
          const list2 = opt2 || [];
          if (list1.length !== list2.length) return false;

          const sorted1 = [...list1].sort((a, b) => a.optionName.localeCompare(b.optionName));
          const sorted2 = [...list2].sort((a, b) => a.optionName.localeCompare(b.optionName));

          for (let i = 0; i < sorted1.length; i++) {
            if (sorted1[i].groupName !== sorted2[i].groupName || sorted1[i].optionName !== sorted2[i].optionName) {
              return false;
            }
          }
          return true;
        };

        const existing = newCart.find(
          (item) =>
            item.product._id === product._id &&
            isSameOptions(item.chosenOptions, chosenOptions) &&
            (item.notes || '') === (notes || '')
        );

        if (existing) {
          const newQty = existing.quantity + quantity;
          if (product.stockQuantity && newQty > product.stockQuantity) {
            return { success: false, cleared };
          }
          newCart = newCart.map((item) =>
            item.cartId === existing.cartId ? { ...item, quantity: newQty } : item
          );
        } else {
          const cartId = `${product._id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          newCart.push({
            cartId,
            product,
            quantity,
            chosenOptions,
            notes
          });
        }

        set({
          cart: newCart,
          merchantId,
          merchantName,
          appliedCoupon: cleared ? null : state.appliedCoupon
        });

        return { success: true, cleared };
      },

      updateCartQty: (cartId, delta) => {
        const { cart } = get();
        const existing = cart.find((item) => item.cartId === cartId);
        if (!existing) return;

        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          const updated = cart.filter((item) => item.cartId !== cartId);
          set({
            cart: updated,
            merchantId: updated.length === 0 ? null : get().merchantId,
            merchantName: updated.length === 0 ? null : get().merchantName,
            appliedCoupon: updated.length === 0 ? null : get().appliedCoupon
          });
        } else {
          if (delta > 0 && existing.product.stockQuantity && newQty > existing.product.stockQuantity) {
            return;
          }
          set({
            cart: cart.map((item) =>
              item.cartId === cartId ? { ...item, quantity: newQty } : item
            )
          });
        }
      },

      removeFromCart: (cartId) => {
        const { cart } = get();
        const updated = cart.filter((item) => item.cartId !== cartId);
        set({
          cart: updated,
          merchantId: updated.length === 0 ? null : get().merchantId,
          merchantName: updated.length === 0 ? null : get().merchantName,
          appliedCoupon: updated.length === 0 ? null : get().appliedCoupon
        });
      },

      clearCart: () => {
        set({
          cart: [],
          merchantId: null,
          merchantName: null,
          appliedCoupon: null
        });
      },

      applyCoupon: (coupon) => {
        set({ appliedCoupon: coupon });
      },

      removeCoupon: () => {
        set({ appliedCoupon: null });
      }
    }),
    {
      name: 'trazpraca-cart-storage'
    }
  )
);
