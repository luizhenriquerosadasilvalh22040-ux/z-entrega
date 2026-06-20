import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Modal, Toast, Input } from '../components/ui';
import { Search, ShoppingCart, Plus, Minus, ArrowLeft, Clock, MapPin, Phone, CreditCard, Shield, Ban, Star, Copy, Check, Loader2 } from 'lucide-react';

interface IMerchant {
  _id: string;
  name: string;
  category: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
  phone: string;
  operatingHours: { open: string; close: string };
  address: { street: string; number: string; neighborhood: string; city: string };
  logoImage?: string;
  coverImage?: string;
  isForceClosed?: boolean;
  averageRating?: number;
  reviewsCount?: number;
}

interface IOption {
  name: string;
  price: number;
  isAvailable?: boolean;
}

interface IOptionGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: IOption[];
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
  optionGroups?: IOptionGroup[];
}

interface ICartItem {
  cartId: string;
  product: IProduct;
  quantity: number;
  chosenOptions?: { groupName: string; optionName: string; price: number }[];
  notes?: string;
}

export const Store: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role, user, checkAuth } = useAuthStore();
  
  const {
    cart,
    addToCart,
    updateCartQty,
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon
  } = useCartStore();

  const isStoreOpen = (): boolean => {
    if (!merchant) return false;
    if (merchant.isForceClosed) return false;
    const hours = merchant.operatingHours;
    if (!hours) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (closeMinutes < openMinutes) {
      return (currentMinutes >= openMinutes || currentMinutes < closeMinutes);
    } else {
      return (currentMinutes >= openMinutes && currentMinutes < closeMinutes);
    }
  };

  const [merchant, setMerchant] = useState<IMerchant | null>(null);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  // States for Coupon Code
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponError, setCouponError] = useState('');

  // States for Merchant Reviews Modal
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [merchantReviews, setMerchantReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // States for PIX Modal
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; copyAndPaste: string; orderId: string } | null>(null);
  const [pixTimeLeft, setPixTimeLeft] = useState(600); // 10 min
  const [isPixCopied, setIsPixCopied] = useState(false);

  // CEP Search State
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Timer PIX Effect
  useEffect(() => {
    if (!isPixModalOpen || pixTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setPixTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPixModalOpen, pixTimeLeft]);

  const formatPixTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCepChange = async (val: string) => {
    let formatted = val.replace(/\D/g, '');
    if (formatted.length > 8) {
      formatted = formatted.substring(0, 8);
    }
    if (formatted.length > 5) {
      formatted = `${formatted.substring(0, 5)}-${formatted.substring(5)}`;
    }
    setZipCode(formatted);

    const cleanCep = formatted.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        setIsSearchingCep(true);
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data && !data.erro) {
          setStreet(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setStateCode(data.uf || 'PR');
          setToast({ message: 'Endereço autocompletado via CEP!', type: 'success' });
        } else {
          setToast({ message: 'CEP não encontrado.', type: 'error' });
        }
      } catch (err) {
        setToast({ message: 'Erro ao buscar CEP.', type: 'error' });
      } finally {
        setIsSearchingCep(false);
      }
    }
  };

  useEffect(() => {
    if (isReviewsModalOpen && merchant?._id) {
      const fetchReviews = async () => {
        try {
          setLoadingReviews(true);
          const res = await apiClient.get(`/merchants/${merchant._id}/reviews`);
          if (res.data?.status === 'success') {
            setMerchantReviews(res.data.data.reviews);
          }
        } catch (err) {
          setToast({ message: 'Erro ao carregar as avaliações da loja', type: 'error' });
        } finally {
          setLoadingReviews(false);
        }
      };
      fetchReviews();
    }
  }, [isReviewsModalOpen, merchant?._id]);

  // States for Custom Product Details Modal
  const [selectedProduct, setSelectedProduct] = useState<IProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<{ groupName: string; optionName: string; price: number }[]>([]);
  const [itemNotes, setItemNotes] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // States for Checkout Delivery Details
  const [complement, setComplement] = useState('');
  const [referencePoint, setReferencePoint] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('principal');
  const [addressNickname, setAddressNickname] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('PR');
  const [zipCode, setZipCode] = useState('');
  const [saveThisAddress, setSaveThisAddress] = useState(false);

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

  useEffect(() => {
    if (selectedAddressId === 'principal') {
      if (user?.address) {
        setStreet(user.address.street || '');
        setNumber(user.address.number || '');
        setNeighborhood(user.address.neighborhood || '');
        setCity(user.address.city || '');
        setStateCode(user.address.state || 'PR');
        setZipCode(user.address.zipCode || '');
        setComplement(user.address.complement || '');
        setReferencePoint(user.address.referencePoint || '');
      }
    } else if (selectedAddressId !== 'custom') {
      const idx = parseInt(selectedAddressId, 10);
      const addr = user?.savedAddresses?.[idx];
      if (addr) {
        setStreet(addr.street || '');
        setNumber(addr.number || '');
        setNeighborhood(addr.neighborhood || '');
        setCity(addr.city || '');
        setStateCode(addr.state || 'PR');
        setZipCode(addr.zipCode || '');
        setComplement(addr.complement || '');
        setReferencePoint(addr.referencePoint || '');
      }
    } else {
      setStreet('');
      setNumber('');
      setNeighborhood('');
      setCity('');
      setStateCode('PR');
      setZipCode('');
      setComplement('');
      setReferencePoint('');
      setAddressNickname('');
    }
  }, [selectedAddressId, user]);

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

  const handleSelectOption = (group: IOptionGroup, option: IOption) => {
    setSelectedOptions((prev) => {
      const otherGroupsOptions = prev.filter(o => o.groupName !== group.name);
      const thisGroupOptions = prev.filter(o => o.groupName === group.name);
      const alreadySelected = thisGroupOptions.find(o => o.optionName === option.name);

      if (group.maxSelect === 1) {
        if (alreadySelected) {
          if (!group.required) {
            return otherGroupsOptions;
          }
          return prev;
        } else {
          return [...otherGroupsOptions, { groupName: group.name, optionName: option.name, price: option.price }];
        }
      } else {
        if (alreadySelected) {
          return prev.filter(o => !(o.groupName === group.name && o.optionName === option.name));
        } else {
          if (thisGroupOptions.length >= group.maxSelect) {
            setToast({ message: `Você pode escolher no máximo ${group.maxSelect} opções para ${group.name}`, type: 'error' });
            return prev;
          }
          return [...prev, { groupName: group.name, optionName: option.name, price: option.price }];
        }
      }
    });
  };

  const handleAddCustomToCart = () => {
    if (!selectedProduct || !merchant) return;

    if (selectedProduct.optionGroups) {
      for (const group of selectedProduct.optionGroups) {
        if (group.required) {
          const selectedInGroup = selectedOptions.filter(o => o.groupName === group.name);
          if (selectedInGroup.length === 0) {
            setToast({ message: `Por favor, selecione uma opção para "${group.name}"`, type: 'error' });
            return;
          }
        }
      }
    }

    const { success, cleared } = addToCart(
      selectedProduct,
      itemQuantity,
      selectedOptions,
      itemNotes,
      merchant._id,
      merchant.name
    );

    if (success) {
      if (cleared) {
        setToast({ message: 'Carrinho da loja anterior limpo e produto adicionado!', type: 'success' });
      } else {
        setToast({ message: 'Produto adicionado ao carrinho!', type: 'success' });
      }
      setIsDetailsModalOpen(false);
    } else {
      setToast({ message: `Limite de estoque atingido ou indisponível.`, type: 'error' });
    }
  };

  const handleUpdateCartQty = (cartId: string, delta: number) => {
    const existing = cart.find(item => item.cartId === cartId);
    if (existing && existing.quantity + delta <= 0 && cart.length === 1) {
      setIsCheckingOut(false);
    }
    updateCartQty(cartId, delta);
  };

  const getItemTotalPrice = (item: ICartItem): number => {
    const optionsPrice = item.chosenOptions 
      ? item.chosenOptions.reduce((sum, opt) => sum + opt.price, 0)
      : 0;
    return item.product.price + optionsPrice;
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

  const cartTotal = cart.reduce((total, item) => total + (getItemTotalPrice(item) * item.quantity), 0);
  const deliveryFee = 5.00;
  
  const discountAmount = appliedCoupon
    ? appliedCoupon.discountType === 'PERCENTAGE'
      ? cartTotal * (appliedCoupon.discountValue / 100)
      : appliedCoupon.discountValue
    : 0;

  const finalDiscount = Math.min(cartTotal, discountAmount);
  const grandTotal = Math.max(0, cartTotal - finalDiscount + deliveryFee);

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

    if (!street || !number || !neighborhood || !city || !zipCode) {
      setToast({ message: 'Preencha todos os campos obrigatórios do endereço', type: 'error' });
      return;
    }

    try {
      const targetAddress = {
        street,
        number,
        neighborhood,
        city,
        state: stateCode,
        zipCode,
        complement,
        referencePoint
      };

      if (selectedAddressId === 'custom' && saveThisAddress) {
        if (!addressNickname) {
          setToast({ message: 'Digite um apelido para o novo endereço (Ex: Trabalho)', type: 'error' });
          return;
        }

        const newSavedAddresses = [
          ...(user?.savedAddresses || []),
          { nickname: addressNickname, ...targetAddress }
        ];

        await apiClient.put(`/customers/${user?._id}/profile`, {
          savedAddresses: newSavedAddresses
        });
        await checkAuth();
      }

      const orderItems = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity,
        chosenOptions: item.chosenOptions || [],
        notes: item.notes || ''
      }));

      const res = await apiClient.post('/orders', {
        merchantId: merchant?._id,
        items: orderItems,
        paymentMethod,
        deliveryAddress: targetAddress,
        couponCode: appliedCoupon?.code || undefined
      });

      if (res.data?.status === 'success') {
        const order = res.data.data.order;
        setToast({ message: 'Pedido realizado com sucesso!', type: 'success' });
        setIsCheckingOut(false);
        clearCart();
        setCouponCodeInput('');
        removeCoupon();

        if (paymentMethod === 'PIX' && order && order.pixQrCode && order.pixCopyAndPaste) {
          setPixData({
            qrCode: order.pixQrCode,
            copyAndPaste: order.pixCopyAndPaste,
            orderId: order.id
          });
          setPixTimeLeft(600); // 10 minutos
          setIsPixCopied(false);
          setIsPixModalOpen(true);
        } else {
          setTimeout(() => navigate('/orders'), 1500);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao finalizar pedido';
      setToast({ message: msg, type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Store Header Skeleton */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row gap-6 items-center">
          <div className="w-24 h-24 rounded-2xl bg-slate-200 dark:bg-slate-850 flex-shrink-0"></div>
          <div className="flex-1 space-y-3 w-full">
            <div className="h-6 bg-slate-200 dark:bg-slate-850 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-850 rounded w-1/4"></div>
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="h-5 bg-slate-200 dark:bg-slate-850 rounded-full w-24"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-850 rounded-full w-20"></div>
            </div>
          </div>
        </div>

        {/* Product Grid Skeleton */}
        <div className="space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-850 rounded w-1/6 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <Card key={n} className="flex gap-4 p-4 border border-slate-100 dark:border-slate-800/80 items-center">
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-850 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded w-full"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-850 rounded w-1/4 pt-1"></div>
                </div>
                <div className="w-20 h-20 rounded-xl bg-slate-200 dark:bg-slate-850 flex-shrink-0"></div>
              </Card>
            ))}
          </div>
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col">
        {/* Cover Banner */}
        {merchant.coverImage ? (
          <img 
            src={merchant.coverImage} 
            alt="Estabelecimento Capa" 
            className="w-full h-40 md:h-48 object-cover"
          />
        ) : (
          <div className="w-full h-40 md:h-48 bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white/30 font-black tracking-widest text-lg">
            TRAZ PRA CÁ DELIVERY
          </div>
        )}

        <div className="p-6 md:p-8 pt-0 relative flex flex-col md:flex-row gap-6 items-center md:items-start justify-between">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
            {/* Store Logo Overlapping */}
            {merchant.logoImage ? (
              <img 
                src={merchant.logoImage} 
                alt={merchant.name} 
                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-md bg-slate-50 -mt-12 z-10 flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-orange-500/10 text-energy flex items-center justify-center font-black text-3xl shadow-md border-4 border-white dark:border-slate-900 -mt-12 z-10 flex-shrink-0">
                {merchant.name.substring(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-2 pt-2 md:pt-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">{merchant.name}</h1>
                <Badge variant={merchant.category === 'Comida' ? 'orange' : merchant.category === 'Farmácia' ? 'blue' : merchant.category === 'Construção' ? 'green' : 'gray'}>
                  {merchant.category}
                </Badge>
                <Badge variant={isStoreOpen() ? 'green' : 'red'}>
                  {isStoreOpen() ? 'Aberto Agora' : 'Fechado no Momento'}
                </Badge>
              </div>
              
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 justify-center md:justify-start">
                <MapPin size={15} className="text-slate-400" />
                {merchant.address.street}, {merchant.address.number} - {merchant.address.neighborhood}, {merchant.address.city}
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300 items-center">
                {merchant.reviewsCount && merchant.reviewsCount > 0 ? (
                  <button 
                    onClick={() => setIsReviewsModalOpen(true)}
                    className="flex items-center gap-1 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 px-2.5 py-1 rounded-xl text-amber-600 transition-colors font-bold"
                  >
                    <Star size={13} className="fill-amber-500 text-amber-500" />
                    <span>{merchant.averageRating?.toFixed(1)}</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">({merchant.reviewsCount} avaliações)</span>
                  </button>
                ) : (
                  <span className="text-slate-400/80 italic text-xs py-1">Novo no app (Sem avaliações)</span>
                )}
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
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl text-center min-w-[150px] border border-slate-100 dark:border-slate-800/60 mt-4 md:mt-0 flex-shrink-0">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Pedido Mínimo</p>
            <p className="text-xl font-black text-energy mt-1">Não possui</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Tempo estimado: 30-50 min</p>
          </div>
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
                const productCartCount = cart
                  .filter(item => item.product._id === product._id)
                  .reduce((sum, item) => sum + item.quantity, 0);
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
                      <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        {isDisabled ? 'Esgotado' : `Estoque: ${product.stockQuantity} un.`}
                        {productCartCount > 0 && (
                          <Badge variant="orange">{productCartCount} no carrinho</Badge>
                        )}
                      </span>
                      <div>
                        <Button 
                          size="sm" 
                          disabled={isDisabled}
                          onClick={() => {
                            setSelectedProduct(product);
                            setSelectedOptions([]);
                            setItemNotes('');
                            setItemQuantity(1);
                            setIsDetailsModalOpen(true);
                          }}
                        >
                          {productCartCount > 0 ? 'Adicionar mais' : 'Adicionar'}
                        </Button>
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
                Sem pedido mínimo
              </span>
              <Button 
                size="lg" 
                disabled={!isStoreOpen()}
                onClick={() => setIsCheckingOut(true)}
              >
                {isStoreOpen() ? 'Revisar e Finalizar' : (
                  <span className="flex items-center gap-1.5 justify-center">
                    Estabelecimento Fechado <Ban size={15} />
                  </span>
                )}
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
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cart.map((item) => {
                const itemPrice = getItemTotalPrice(item);
                return (
                  <div key={item.cartId} className="flex flex-col gap-1 pb-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-0.5 flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{item.product.name}</p>
                        {item.chosenOptions && item.chosenOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.chosenOptions.map((opt, idx) => (
                              <Badge key={`${opt.optionName}-${idx}`} variant="gray">
                                {opt.optionName} {opt.price > 0 && `(+R$ ${opt.price.toFixed(2)})`}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-1">
                            Obs: "{item.notes}"
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-black text-energy">
                        R$ {(itemPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-slate-400">
                        Valor unitário: R$ {itemPrice.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.cartId, -1)}
                          className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-xs font-black px-1.5">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(item.cartId, 1)}
                          className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Address Details */}
          <div className="space-y-4 border-t border-b border-slate-100 dark:border-slate-800/80 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Endereço de Entrega
            </h4>
            
            {/* Address Nicknames Selector */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSelectedAddressId('principal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  selectedAddressId === 'principal'
                    ? 'border-energy bg-energy/5 text-energy shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                Principal (Casa)
              </button>

              {user?.savedAddresses?.map((addr, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedAddressId(String(idx))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    selectedAddressId === String(idx)
                      ? 'border-energy bg-energy/5 text-energy shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {addr.nickname}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSelectedAddressId('custom')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  selectedAddressId === 'custom'
                    ? 'border-energy bg-energy/5 text-energy shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                + Outro Endereço
              </button>
            </div>

            {selectedAddressId === 'custom' ? (
              <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Apelido do Endereço *"
                    placeholder="Ex: Trabalho, Minha Casa"
                    value={addressNickname}
                    onChange={(e) => setAddressNickname(e.target.value)}
                    required
                  />
                  <div className="relative">
                    <Input
                      label="CEP *"
                      placeholder="Ex: 87103-000"
                      value={zipCode}
                      onChange={(e) => handleCepChange(e.target.value)}
                      disabled={isSearchingCep}
                      required
                    />
                    {isSearchingCep && (
                      <Loader2 className="absolute right-3 bottom-8 h-4 w-4 animate-spin text-energy" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <Input
                      label="Rua *"
                      placeholder="Ex: Av. Brasil"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      disabled={isSearchingCep}
                      required
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label="Número *"
                      placeholder="Ex: 123"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      disabled={isSearchingCep}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Bairro *"
                    placeholder="Ex: Centro"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    disabled={isSearchingCep}
                    required
                  />
                  <Input
                    label="Cidade *"
                    placeholder="Ex: Maringá"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isSearchingCep}
                    required
                  />
                  <Input
                    label="Estado *"
                    placeholder="Ex: PR"
                    maxLength={2}
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                    disabled={isSearchingCep}
                    required
                  />
                </div>
                <div className="flex items-center gap-2 pt-1.5">
                  <input
                    type="checkbox"
                    id="saveAddressCheckbox"
                    checked={saveThisAddress}
                    onChange={(e) => setSaveThisAddress(e.target.checked)}
                    className="rounded text-energy focus:ring-energy border-slate-300 dark:border-slate-800"
                  />
                  <label htmlFor="saveAddressCheckbox" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                    Salvar este endereço no meu perfil
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-white block mb-1">
                  Endereço selecionado:
                </span>
                {street}, {number} - {neighborhood}, {city} - {stateCode} (CEP: {zipCode})
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Complemento"
                placeholder="Ex: Apto 302, Bloco B"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
              />
              <Input
                label="Ponto de Referência"
                placeholder="Ex: Próximo à padaria"
                value={referencePoint}
                onChange={(e) => setReferencePoint(e.target.value)}
              />
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

          {/* Cupom de Desconto */}
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cupom de Desconto
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: BEMVINDO10"
                value={couponCodeInput}
                onChange={(e) => {
                  setCouponCodeInput(e.target.value.toUpperCase());
                  setCouponError('');
                }}
                disabled={!!appliedCoupon}
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-energy/20 focus:border-energy rounded-xl shadow-sm text-sm focus:ring-4 transition-all duration-200 outline-none dark:text-white"
              />
              {appliedCoupon ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    removeCoupon();
                    setCouponCodeInput('');
                  }}
                >
                  Remover
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    if (!couponCodeInput.trim()) return;
                    try {
                      const res = await apiClient.post('/payments/validate-coupon', {
                        code: couponCodeInput,
                        merchantId: merchant?._id,
                        subtotal: cartTotal
                      });
                      if (res.data?.status === 'success') {
                        applyCoupon(res.data.data);
                        setCouponError('');
                        setToast({ message: 'Cupom aplicado com sucesso!', type: 'success' });
                      }
                    } catch (err: any) {
                      const msg = err.response?.data?.message || 'Erro ao validar cupom';
                      setCouponError(msg);
                    }
                  }}
                >
                  Aplicar
                </Button>
              )}
            </div>
            {couponError && (
              <p className="text-xs text-red-500 font-semibold">{couponError}</p>
            )}
            {appliedCoupon && (
              <p className="text-xs text-green-500 font-semibold flex items-center gap-1">
                Cupom {appliedCoupon.code} aplicado: {appliedCoupon.discountType === 'PERCENTAGE' ? `${appliedCoupon.discountValue}%` : `R$ ${appliedCoupon.discountValue.toFixed(2)}`} de desconto.
              </p>
            )}
          </div>

          {/* Totals Summary */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal:</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-xs text-green-600 dark:text-green-400 font-semibold">
                <span>Desconto Cupom ({appliedCoupon.code}):</span>
                <span>- R$ {finalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-500">
              <span>Taxa de Entrega:</span>
              <span>R$ 5.00</span>
            </div>
            <div className="flex justify-between text-slate-800 dark:text-white font-extrabold pt-2 border-t border-slate-50 dark:border-slate-800/60 mt-1">
              <span>Total Geral:</span>
              <span className="text-energy text-base font-black">R$ {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <Button 
            fullWidth 
            size="lg" 
            disabled={!isStoreOpen()}
            onClick={handleCheckout}
          >
            {isStoreOpen() ? 'Confirmar e Enviar Pedido' : 'Estabelecimento Fechado'}
          </Button>
        </div>
      </Modal>

      {/* Product Details Customization Modal */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Personalizar Produto">
        {selectedProduct && (
          <div className="space-y-6">
            {/* Product Image Full-Width */}
            {selectedProduct.image && (
              <div className="w-full h-48 md:h-56 overflow-hidden rounded-2xl mb-4 border border-slate-100 dark:border-slate-800">
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Product Header */}
            <div className="border-b border-slate-150 dark:border-slate-800/80 pb-4">
              <h4 className="font-bold text-base text-slate-800 dark:text-white">{selectedProduct.name}</h4>
              <p className="text-xs text-slate-400 mt-1">{selectedProduct.description}</p>
              <p className="text-sm font-extrabold text-energy mt-2">Base: R$ {selectedProduct.price.toFixed(2)}</p>
            </div>

            {/* Option Groups */}
            {selectedProduct.optionGroups && selectedProduct.optionGroups.length > 0 && (
              <div className="space-y-6">
                {selectedProduct.optionGroups.map((group) => {
                  return (
                    <div key={group.name} className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <div>
                          <h5 className="text-sm font-extrabold text-slate-800 dark:text-white">{group.name}</h5>
                          <span className="text-[10px] text-slate-400">
                            {group.maxSelect === 1 ? 'Selecione 1 opção' : `Selecione até ${group.maxSelect} opções`}
                          </span>
                        </div>
                        {group.required ? (
                          <Badge variant="orange">Obrigatório</Badge>
                        ) : (
                          <Badge variant="gray">Opcional</Badge>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {group.options.map((option) => {
                          const isSelected = selectedOptions.some(
                            o => o.groupName === group.name && o.optionName === option.name
                          );

                          return (
                            <button
                              key={option.name}
                              type="button"
                              onClick={() => handleSelectOption(group, option)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                                isSelected
                                  ? 'border-energy bg-energy/5 text-slate-850 dark:text-white'
                                  : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850/50 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 border flex items-center justify-center transition-all ${
                                  group.maxSelect === 1 ? 'rounded-full' : 'rounded-md'
                                } ${
                                  isSelected
                                    ? 'border-energy bg-energy text-white scale-110'
                                    : 'border-slate-350 dark:border-slate-700 bg-transparent'
                                }`}>
                                  {isSelected && (
                                    <div className={`w-1.5 h-1.5 bg-white ${
                                      group.maxSelect === 1 ? 'rounded-full' : 'rounded-sm'
                                    }`} />
                                  )}
                                </div>
                                <span>{option.name}</span>
                              </div>
                              {option.price > 0 && (
                                <span className="text-xs font-black text-energy">+ R$ {option.price.toFixed(2)}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Observações do Item
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Tirar cebola, sem maionese, ponto bem passado, etc."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-energy/20 focus:border-energy rounded-xl shadow-sm text-xs focus:ring-4 transition-all duration-200 outline-none dark:text-white resize-none"
              />
            </div>

            {/* Quantity Stepper & Add Button */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setItemQuantity(prev => Math.max(1, prev - 1))}
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="text-sm font-black px-2">{itemQuantity}</span>
                <button
                  type="button"
                  onClick={() => setItemQuantity(prev => {
                    if (selectedProduct.stockQuantity && prev >= selectedProduct.stockQuantity) {
                      setToast({ message: `Limite de estoque atingido (${selectedProduct.stockQuantity} un.)`, type: 'error' });
                      return prev;
                    }
                    return prev + 1;
                  })}
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              <Button
                size="lg"
                onClick={handleAddCustomToCart}
              >
                Adicionar • R$ {((selectedProduct.price + selectedOptions.reduce((sum, o) => sum + o.price, 0)) * itemQuantity).toFixed(2)}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Avaliações / Feedbacks da Loja */}
      <Modal isOpen={isReviewsModalOpen} onClose={() => setIsReviewsModalOpen(false)} title={`Avaliações de ${merchant.name}`}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {loadingReviews ? (
            <p className="text-center py-6 text-slate-400 text-sm">Carregando avaliações...</p>
          ) : merchantReviews.length === 0 ? (
            <p className="text-center py-6 text-slate-400 text-sm italic">Esta loja ainda não possui comentários.</p>
          ) : (
            <div className="space-y-3">
              {merchantReviews.map((rev) => (
                <div key={rev.id} className="p-3 bg-slate-50 dark:bg-slate-850/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-750 dark:text-slate-200">
                      {rev.customer?.name || 'Cliente'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={12}
                        className={star <= rev.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-750'}
                      />
                    ))}
                  </div>
                  {rev.comment && (
                    <p className="text-xs text-slate-600 dark:text-slate-350 italic">
                      "{rev.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* PIX Modal */}
      <Modal isOpen={isPixModalOpen} onClose={() => {
        setIsPixModalOpen(false);
        navigate('/orders');
      }} title="Pagamento via PIX">
        {pixData && (
          <div className="flex flex-col items-center justify-center p-4 space-y-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Escaneie o QR Code abaixo ou copie a chave PIX para realizar o pagamento. O seu pedido será confirmado automaticamente após o pagamento.
            </p>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-center relative">
              {pixTimeLeft > 0 ? (
                <img
                  src={`data:image/png;base64,${pixData.qrCode}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 md:w-56 md:h-56 object-contain"
                />
              ) : (
                <div className="w-48 h-48 md:w-56 md:h-56 flex flex-col items-center justify-center text-red-500 font-bold bg-slate-50 rounded-2xl">
                  <Ban size={40} className="mb-2" />
                  <span>Tempo Expirado</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Tempo restante</span>
              <span className={`text-2xl font-black ${pixTimeLeft > 60 ? 'text-energy' : 'text-red-500 animate-pulse'}`}>
                {formatPixTime(pixTimeLeft)}
              </span>
            </div>

            <div className="w-full space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 text-left">
                Código Copia e Cola
              </label>
              <div className="w-full bg-slate-50 dark:bg-slate-850/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-650 dark:text-slate-350 truncate max-w-[220px] sm:max-w-sm text-left">
                  {pixData.copyAndPaste}
                </span>
                <Button 
                  size="sm"
                  disabled={pixTimeLeft <= 0}
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.copyAndPaste);
                    setIsPixCopied(true);
                    setToast({ message: 'Código PIX copiado para a área de transferência!', type: 'success' });
                    setTimeout(() => setIsPixCopied(false), 2000);
                  }}
                  className="flex-shrink-0"
                >
                  {isPixCopied ? (
                    <span className="flex items-center gap-1">
                      <Check size={14} /> Copiado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy size={14} /> Copiar
                    </span>
                  )}
                </Button>
              </div>
            </div>

            <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col gap-2">
              <Button fullWidth onClick={() => {
                setIsPixModalOpen(false);
                navigate('/orders');
              }}>
                Acompanhar Pedido
              </Button>
              <button 
                type="button" 
                onClick={() => {
                  setIsPixModalOpen(false);
                  navigate('/orders');
                }} 
                className="text-xs text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors font-bold py-1"
              >
                Voltar mais tarde
              </button>
            </div>
          </div>
        )}
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
