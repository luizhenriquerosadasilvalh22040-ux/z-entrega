import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Input, Card, Badge, Modal, Toast } from '../components/ui';
import { Search, ShoppingCart, Plus, Minus, Check, MapPin, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IMerchant {
  _id: string;
  name: string;
  category: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
  phone: string;
  operatingHours: { open: string; close: string };
  address: { street: string; number: string; city: string };
  logoImage?: string;
}

interface IProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

interface ICartItem {
  product: IProduct;
  quantity: number;
}

export const Home: React.FC = () => {
  const { isAuthenticated, role } = useAuthStore();
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<IMerchant[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Detalhes da Loja selecionada (Menu)
  const [activeMerchant, setActiveMerchant] = useState<IMerchant | null>(null);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [cart, setCart] = useState<ICartItem[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('PIX');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Carrega lojistas
  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const response = await apiClient.get('/merchants');
        if (response.data?.status === 'success') {
          setMerchants(response.data.data.merchants);
        }
      } catch (err) {
        setToast({ message: 'Erro ao buscar estabelecimentos', type: 'error' });
      }
    };
    fetchMerchants();
  }, []);

  // Filtra lojistas por pesquisa e categoria
  const filteredMerchants = merchants.filter((merchant) => {
    const matchesSearch = merchant.name.toLowerCase().includes(search.toLowerCase()) || 
                          merchant.address.city.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || merchant.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Abre menu do lojista
  const handleOpenMenu = async (merchant: IMerchant) => {
    try {
      const response = await apiClient.get(`/products/merchant/${merchant._id}`);
      if (response.data?.status === 'success') {
        setProducts(response.data.data.products);
        setActiveMerchant(merchant);
        setCart([]); // Reseta carrinho
        setIsMenuOpen(true);
      }
    } catch (err) {
      setToast({ message: 'Erro ao carregar o cardápio da loja', type: 'error' });
    }
  };

  const handleAddToCart = (product: IProduct) => {
    setCart((prev) => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
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

  const cartTotal = cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);

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
        merchantId: activeMerchant?._id,
        items: orderItems,
        paymentMethod
      });

      if (res.data?.status === 'success') {
        setToast({ message: 'Pedido realizado com sucesso!', type: 'success' });
        setIsCheckingOut(false);
        setIsMenuOpen(false);
        setCart([]);
        // Redireciona para listagem de pedidos
        setTimeout(() => navigate('/orders'), 1500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao finalizar pedido';
      setToast({ message: msg, type: 'error' });
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="bg-gradient-to-tr from-orange-500/10 via-orange-500/5 to-transparent rounded-3xl p-8 md:p-12 text-center md:text-left md:flex md:items-center md:justify-between gap-8">
        <div className="max-w-xl space-y-6">
          <Badge variant="orange">📍 Rondon, Paraná e Região</Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-800 dark:text-white leading-tight">
            Compre do comércio local, <span className="text-energy">receba em casa.</span>
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Peça em mercados, farmácias, depósitos de construção e lanchonetes sem complicação e sem taxas abusivas de entrega.
          </p>
        </div>
        <div className="hidden lg:block">
          <span className="text-9xl animate-float block filter drop-shadow-lg">🛵</span>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="space-y-6">
        <div className="max-w-md mx-auto flex items-center relative">
          <Search className="absolute left-4 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar lojas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-energy/20 focus:border-energy rounded-2xl shadow-sm text-sm focus:ring-4 transition-all duration-200 outline-none dark:text-white"
          />
        </div>

        {/* Categorias */}
        <div className="flex flex-wrap justify-center gap-3">
          {['Comida', 'Farmácia', 'Construção', 'Geral'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-energy text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Lojas */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
          <Store size={22} className="text-energy" /> Lojas Disponíveis
        </h2>

        {filteredMerchants.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            Nenhuma loja encontrada para a busca selecionada.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMerchants.map((merchant) => (
              <Card key={merchant._id} interactive className="flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500"></div>
                <div className="space-y-4 pt-2">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-center gap-3">
                      {merchant.logoImage ? (
                        <img 
                          src={merchant.logoImage} 
                          alt={merchant.name} 
                          className="w-12 h-12 rounded-xl object-cover border bg-slate-50"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-energy flex items-center justify-center font-black text-lg border border-orange-500/10">
                          {merchant.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-base leading-snug line-clamp-1">{merchant.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{merchant.address.city}</p>
                      </div>
                    </div>
                    <Badge variant={merchant.category === 'Comida' ? 'orange' : merchant.category === 'Farmácia' ? 'blue' : merchant.category === 'Construção' ? 'green' : 'gray'}>
                      {merchant.category}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <MapPin size={14} className="text-slate-400" />
                    <span>{merchant.address.street}, {merchant.address.number}</span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Horário: <span className="font-semibold">{merchant.operatingHours.open} às {merchant.operatingHours.close}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Button fullWidth onClick={() => navigate(`/store/${merchant._id}`)}>
                    Ver Cardápio
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal do Menu */}
      <Modal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title={`Menu - ${activeMerchant?.name}`}>
        <div className="space-y-6">
          <div className="space-y-4">
            {products.length === 0 ? (
              <p className="text-center py-6 text-slate-400 dark:text-slate-500">Sem produtos disponíveis no momento.</p>
            ) : (
              products.map((product) => {
                const cartItem = cart.find(item => item.product._id === product._id);
                return (
                  <div key={product._id} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-850 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="space-y-1 pr-4">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">{product.name}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2">{product.description}</p>
                      <p className="text-sm font-extrabold text-energy">R$ {product.price.toFixed(2)}</p>
                    </div>
                    <div>
                      {cartItem ? (
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => handleRemoveFromCart(product._id)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                            <Minus size={16} />
                          </button>
                          <span className="text-sm font-bold">{cartItem.quantity}</span>
                          <button onClick={() => handleAddToCart(product)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => handleAddToCart(product)}>
                          Adicionar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Checkout section */}
          {cart.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
              <div className="flex justify-between items-center text-slate-800 dark:text-white">
                <span className="font-semibold text-sm">Total do Carrinho:</span>
                <span className="text-lg font-black text-energy">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <Button fullWidth onClick={() => setIsCheckingOut(true)}>
                Finalizar Compra
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Finalização do Pedido (Checkout) */}
      <Modal isOpen={isCheckingOut} onClose={() => setIsCheckingOut(false)} title="Finalizar Pedido">
        <div className="space-y-6">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Estabelecimento</h4>
            <p className="text-sm font-bold text-slate-800 dark:text-white">{activeMerchant?.name}</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resumo dos Itens</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.product._id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{item.quantity}x {item.product.name}</span>
                  <span className="font-semibold">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-3">
              {['PIX', 'Dinheiro', 'Cartão'].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 rounded-xl border text-center text-xs font-bold transition-all ${
                    paymentMethod === method
                      ? 'border-energy bg-energy/5 text-energy'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal:</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Taxa de Entrega:</span>
              <span>R$ 5.00</span>
            </div>
            <div className="flex justify-between text-sm text-slate-800 dark:text-white font-extrabold pt-1">
              <span>Total Geral:</span>
              <span className="text-energy text-base font-black">R$ {(cartTotal + 5.00).toFixed(2)}</span>
            </div>
          </div>

          <Button fullWidth size="lg" onClick={handleCheckout}>
            Confirmar Pedido
          </Button>
        </div>
      </Modal>

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
