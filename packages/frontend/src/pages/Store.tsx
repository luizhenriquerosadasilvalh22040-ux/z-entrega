import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Modal, Toast } from '../components/ui';
import { Search, ShoppingCart, Plus, Minus, ArrowLeft, Clock, MapPin, Phone, CreditCard, Shield } from 'lucide-react';

interface IMerchant {
  _id: string;
  name: string;
  category: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
  phone: string;
  operatingHours: { open: string; close: string };
  address: { street: string; number: string; neighborhood: string; city: string };
  logoImage?: string;
}

interface IProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  stockQuantity: number;
  isPaused: boolean;
  image?: string;
}

interface ICartItem {
  product: IProduct;
  quantity: number;
}

export const Store: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();

  const [merchant, setMerchant] = useState<IMerchant | null>(null);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [cart, setCart] = useState<ICartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        setLoading(true);
        // Busca dados do lojista
        const merchantRes = await apiClient.get(`/merchants/${id}`);
        if (merchantRes.data?.status === 'success') {
          setMerchant(merchantRes.data.data.merchant);
        }

        // Busca produtos daquele lojista
        const productsRes = await apiClient.get(`/products/merchant/${id}`);
        if (productsRes.data?.status === 'success') {
          setProducts(productsRes.data.data.products);
        }
      } catch (err) {
        setToast({ message: 'Erro ao carregar os dados da loja', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchStoreData();
    }
  }, [id]);

  const handleAddToCart = (product: IProduct) => {
    if (product.isPaused || product.stockQuantity <= 0) {
      setToast({ message: 'Este produto está temporariamente indisponível ou esgotado', type: 'error' });
      return;
    }

    setCart((prev) => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          setToast({ message: `Limite de estoque atingido (${product.stockQuantity} un.)`, type: 'error' });
          return prev;
        }
        return prev.map(item => item.product._id === product._id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find(item => item.product._id === productId);
      if (existing?.quantity === 1) {
        return prev.filter(item => item.product._id !== productId);
      }
      return prev.map(item => item.product._id === productId ? { ...item, quantity: item.quantity - 1 } : item);
    });
  };

  // Obtém lista única de categorias presentes nos produtos cadastrados
  const categories = Array.from(new Set(products.map(p => p.category)));

  // Filtra produtos conforme pesquisa e categoria selecionada
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    const isVisible = product.isAvailable; // Apenas produtos marcados como visíveis
    return matchesSearch && matchesCategory && isVisible;
  });

  const cartTotal = cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  const deliveryFee = 5.00;
  const grandTotal = cartTotal + deliveryFee;

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setToast({ message: 'Faça login antes de finalizar o pedido', type: 'error' });
      setTimeout(() => navigate('/login'), 1500);
      return;
    }

    if (role !== 'customer') {
      setToast({ message: 'Apenas clientes podem fazer pedidos', type: 'error' });
      return;
    }

    try {
      const orderItems = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity
      }));

      const res = await apiClient.post('/orders', {
        merchantId: merchant?._id,
        items: orderItems,
        paymentMethod
      });

      if (res.data?.status === 'success') {
        setToast({ message: 'Pedido realizado com sucesso!', type: 'success' });
        setIsCheckingOut(false);
        setCart([]);
        setTimeout(() => navigate('/orders'), 1500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao finalizar pedido';
      setToast({ message: msg, type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-energy"></div>
          <p className="text-sm text-slate-500">Buscando cardápio do estabelecimento...</p>
        </div>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Estabelecimento não encontrado</h3>
        <Button className="mt-4" onClick={() => navigate('/')}>Voltar para a Home</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Botão Voltar */}
      <button 
        onClick={() => navigate('/')} 
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-energy transition-colors"
      >
        <ArrowLeft size={16} /> Voltar para lojas
      </button>

      {/* Store Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row gap-6 items-center md:items-start justify-between relative overflow-hidden">
        {/* Banner Deco */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-amber-500"></div>
        
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
          {/* Store Logo */}
          {merchant.logoImage ? (
            <img 
              src={merchant.logoImage} 
              alt={merchant.name} 
              className="w-24 h-24 rounded-2xl object-cover border-2 border-orange-500/20 shadow-md bg-slate-50"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-orange-500/10 text-energy flex items-center justify-center font-black text-3xl shadow-sm border border-orange-500/10">
              {merchant.name.substring(0, 2).toUpperCase()}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">{merchant.name}</h1>
              <Badge variant={merchant.category === 'Comida' ? 'orange' : merchant.category === 'Farmácia' ? 'blue' : merchant.category === 'Construção' ? 'green' : 'gray'}>
                {merchant.category}
              </Badge>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 justify-center md:justify-start">
              <MapPin size={15} className="text-slate-400" />
              {merchant.address.street}, {merchant.address.number} - {merchant.address.neighborhood}, {merchant.address.city}
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <Clock size={14} className="text-orange-500" />
                Aberto das {merchant.operatingHours.open} às {merchant.operatingHours.close}
              </span>
              <span className="flex items-center gap-1">
                <Phone size={14} className="text-orange-500" />
                {merchant.phone}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Block */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl text-center min-w-[150px] border border-slate-100 dark:border-slate-800/60">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Taxa de Entrega</p>
          <p className="text-xl font-black text-energy mt-1">R$ 5,00</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Tempo estimado: 30-50 min</p>
        </div>
      </div>

      {/* Menu Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Categories Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider pl-2 text-slate-400">Categorias</h3>
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-3 rounded-2xl text-sm font-semibold transition-all text-left whitespace-nowrap lg:w-full ${
                selectedCategory === null
                  ? 'bg-energy text-white shadow-md'
                  : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
              }`}
            >
              Todos os Produtos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-3 rounded-2xl text-sm font-semibold transition-all text-left whitespace-nowrap lg:w-full ${
                  selectedCategory === cat
                    ? 'bg-energy text-white shadow-md'
                    : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Main List */}
        <div className="lg:col-span-3 space-y-6">
          {/* Menu Search Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar no cardápio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-energy/20 focus:border-energy rounded-2xl shadow-sm text-sm focus:ring-4 transition-all duration-200 outline-none dark:text-white"
            />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-500">
              Nenhum produto disponível para os filtros aplicados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.map((product) => {
                const cartItem = cart.find(item => item.product._id === product._id);
                const isOutOfStock = product.stockQuantity <= 0;
                const isItemPaused = product.isPaused;
                const isDisabled = isOutOfStock || isItemPaused;

                return (
                  <Card key={product._id} className={`flex flex-col justify-between relative ${isDisabled ? 'opacity-65' : ''}`}>
                    {isItemPaused && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full z-10">
                        Indisponível hoje
                      </div>
                    )}
                    {isOutOfStock && !isItemPaused && (
                      <div className="absolute top-3 right-3 bg-slate-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full z-10">
                        Esgotado
                      </div>
                    )}
                    <div className="flex gap-4">
                      {product.image && (
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-20 h-20 rounded-xl object-cover bg-slate-50 border border-slate-100"
                        />
                      )}
                      <div className="space-y-1 flex-1 pr-2">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">{product.name}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2">{product.description}</p>
                        <p className="text-sm font-extrabold text-energy mt-1">R$ {product.price.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-3 mt-4">
                      <span className="text-[10px] text-slate-400">
                        {isDisabled ? 'Esgotado' : `Estoque: ${product.stockQuantity} un.`}
                      </span>
                      <div>
                        {cartItem ? (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleRemoveFromCart(product._id)} 
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                            >
                              <Minus size={15} />
                            </button>
                            <span className="text-xs font-black px-1.5">{cartItem.quantity}</span>
                            <button 
                              onClick={() => handleAddToCart(product)} 
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            disabled={isDisabled}
                            onClick={() => handleAddToCart(product)}
                          >
                            Adicionar
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Cart Panel */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80 shadow-2xl py-4 px-6 transition-all duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-energy/10 text-energy p-2.5 rounded-xl relative">
                <ShoppingCart size={20} />
                <span className="absolute -top-1 -right-1 bg-energy text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-sm">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-slate-400">Seu Pedido</p>
                <p className="text-sm font-black text-slate-800 dark:text-white">R$ {cartTotal.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden md:block">
                Taxa de entrega R$ 5,00 inclusa no checkout
              </span>
              <Button size="lg" onClick={() => setIsCheckingOut(true)}>
                Revisar e Finalizar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <Modal isOpen={isCheckingOut} onClose={() => setIsCheckingOut(false)} title="Finalizar Pedido">
        <div className="space-y-6">
          <div className="space-y-2 border-b border-slate-50 dark:border-slate-800 pb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield size={14} className="text-energy" /> Estabelecimento
            </h4>
            <p className="text-sm font-bold text-slate-800 dark:text-white">{merchant.name}</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resumo do Carrinho</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.product._id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{item.quantity}x {item.product.name}</span>
                  <span className="font-semibold">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <CreditCard size={14} className="text-energy" /> Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['PIX', 'Dinheiro', 'Cartão'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 rounded-xl border text-center text-xs font-bold transition-all ${
                    paymentMethod === method
                      ? 'border-energy bg-energy/5 text-energy shadow-sm'
                      : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850/50 text-slate-500'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal:</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Taxa de Entrega:</span>
              <span>R$ 5.00</span>
            </div>
            <div className="flex justify-between text-slate-800 dark:text-white font-extrabold pt-2 border-t border-slate-50 dark:border-slate-800/60 mt-1">
              <span>Total Geral:</span>
              <span className="text-energy text-base font-black">R$ {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <Button fullWidth size="lg" onClick={handleCheckout}>
            Confirmar e Enviar Pedido
          </Button>
        </div>
      </Modal>

      {/* Toast notifications */}
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
