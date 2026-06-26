import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { Button, Card, Badge, Toast } from '../components/ui';
import { Search, ShoppingCart, MapPin, Store, Clock, Award, Star, Pizza, Pill, ShoppingBag, Moon, IceCream, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IMerchant {
  _id: string;
  name: string;
  category: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
  phone: string;
  operatingHours: { open: string; close: string };
  address: { street: string; number: string; city: string };
  logoImage?: string;
  isForceClosed?: boolean;
  averageRating?: number;
  reviewsCount?: number;
}



export const Home: React.FC = () => {
  const { isAuthenticated, role } = useAuthStore();
  const navigate = useNavigate();
  
  const [merchants, setMerchants] = useState<IMerchant[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega lojistas e banners
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const merchantsRes = await apiClient.get('/merchants');
        if (merchantsRes.data?.status === 'success') {
          setMerchants(merchantsRes.data.data.merchants);
        }


      } catch (err) {
        setToast({ message: 'Erro ao carregar dados da Home', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);



  // Função para verificar se a loja está na madrugada (fecha após 22h ou antes de 6h, ou vira a noite)
  const isMadrugadaStore = (openTime: string, closeTime: string): boolean => {
    const [openH] = openTime.split(':').map(Number);
    const [closeH] = closeTime.split(':').map(Number);
    return closeH < openH || closeH >= 22 || closeH <= 6;
  };

  // Calcula se o estabelecimento está aberto, fechando em breve ou fechado
  const getMerchantStatus = (openTime: string, closeTime: string): { label: string; color: 'green' | 'amber' | 'red' } => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;

    // Se passa da meia-noite
    if (closeMinutes < openMinutes) {
      if (currentMinutes >= openMinutes || currentMinutes < closeMinutes) {
        let diff = 0;
        if (currentMinutes >= openMinutes) {
          diff = (24 * 60 - currentMinutes) + closeMinutes;
        } else {
          diff = closeMinutes - currentMinutes;
        }
        if (diff <= 30) {
          return { label: 'Fechando em breve', color: 'amber' };
        }
        return { label: 'Aberto Agora', color: 'green' };
      }
    } else {
      if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
        const diff = closeMinutes - currentMinutes;
        if (diff <= 30) {
          return { label: 'Fechando em breve', color: 'amber' };
        }
        return { label: 'Aberto Agora', color: 'green' };
      }
    }

    return { label: 'Fechado', color: 'red' };
  };

  // Filtra lojistas por pesquisa, categoria e madrugada
  const filteredMerchants = merchants.filter((merchant) => {
    const matchesSearch = merchant.name.toLowerCase().includes(search.toLowerCase()) || 
                          merchant.address.city.toLowerCase().includes(search.toLowerCase());
    
    let matchesCategory = false;
    if (!selectedCategory) {
      matchesCategory = true;
    } else if (selectedCategory === 'Madrugada') {
      matchesCategory = isMadrugadaStore(merchant.operatingHours.open, merchant.operatingHours.close);
    } else if (selectedCategory === 'Hambúrguer' || selectedCategory === 'Pizza') {
      matchesCategory = merchant.category === 'Comida';
    } else if (selectedCategory === 'Sorvete') {
      matchesCategory = merchant.category === 'Comida' || merchant.category === 'Geral';
    } else {
      matchesCategory = merchant.category === selectedCategory;
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-10">
      
      {/* Banner Principal — Animado 4K */}
      <div className="banner-home-container relative w-full rounded-3xl overflow-hidden shadow-xl border border-slate-100/60 dark:border-slate-800/60 banner-home-shimmer banner-home-vignette group">
        {/* Container com aspect ratio responsivo */}
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          <img
            src="/banner_home_4k.jpg"
            srcSet="/banner_home.jpg 1024w, /banner_home_4k.jpg 3840w"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
            alt="Traz Pra Cá Delivery - O que você precisa, a gente traz"
            className="banner-home-image absolute inset-0 w-full h-full object-cover object-center"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          {/* Gradiente inferior para transição suave com o conteúdo */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-50 dark:from-night to-transparent z-[3] pointer-events-none" />
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-md mx-auto flex items-center relative">
        <Search className="absolute left-4 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Buscar estabelecimentos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-energy/20 focus:border-energy rounded-2xl shadow-sm text-sm focus:ring-4 transition-all duration-200 outline-none dark:text-white"
        />
      </div>

      {/* Circular 3D Categories Carousel */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-450 pl-2">Categorias</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { id: 'Hambúrguer', label: 'Hambúrguer', icon: <Utensils size={18} /> },
            { id: 'Sorvete', label: 'Sorvete', icon: <IceCream size={18} /> },
            { id: 'Pizza', label: 'Pizza', icon: <Pizza size={18} /> },
            { id: 'Farmácia', label: 'Farmácia', icon: <Pill size={18} /> },
            { id: 'Geral', label: 'Geral', icon: <ShoppingBag size={18} /> },
            { id: 'Madrugada', label: 'Madrugada', icon: <Moon size={18} /> }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 ${
                selectedCategory === cat.id
                  ? 'bg-energy text-white shadow-lg shadow-orange-500/25 translate-y-[-2px]'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:border-slate-800 shadow-sm'
              }`}
            >
              <span className="text-orange-500 dark:text-orange-400 animate-float inline-block filter drop-shadow">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stores Section */}
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
          <Store size={22} className="text-energy animate-float" /> Estabelecimentos
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="flex flex-col justify-between relative overflow-hidden animate-pulse">
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800"></div>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-850 flex-shrink-0"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-200 dark:bg-slate-850 rounded w-2/3"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded w-1/3"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-5 bg-slate-200 dark:bg-slate-850 rounded-full w-20"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-850 rounded-full w-16"></div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="h-9 bg-slate-200 dark:bg-slate-850 rounded-xl w-full"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80">
            Nenhum estabelecimento comercial aberto ou disponível no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMerchants.map((merchant) => {
              const status = merchant.isForceClosed
                ? { label: 'Fechado', color: 'red' as const }
                : getMerchantStatus(merchant.operatingHours.open, merchant.operatingHours.close);
              return (
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
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-energy flex items-center justify-center font-black text-lg border border-orange-500/10">
                            {merchant.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-slate-850 dark:text-white text-base leading-snug line-clamp-1">{merchant.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{merchant.address.city}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold">
                            {merchant.reviewsCount && merchant.reviewsCount > 0 ? (
                              <>
                                <span className="text-amber-500 flex items-center">
                                  <Star size={12} className="fill-amber-500 text-amber-500" />
                                </span>
                                <span className="font-extrabold text-slate-700 dark:text-slate-200">
                                  {merchant.averageRating?.toFixed(1)}
                                </span>
                                <span className="text-slate-400">
                                  ({merchant.reviewsCount})
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400/80 italic text-[11px]">Novo no app</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Open/Closed Status Badges */}
                      <span className={`inline-flex items-center text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                        status.color === 'green' ? 'bg-emerald-500/10 text-emerald-500' :
                        status.color === 'amber' ? 'bg-amber-500/10 text-amber-500 animate-pulse' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="line-clamp-1">{merchant.address.street}, {merchant.address.number}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-850 pt-3">
                      <span>Horário: <span className="font-bold text-slate-700 dark:text-slate-300">{merchant.operatingHours.open} às {merchant.operatingHours.close}</span></span>
                      {isMadrugadaStore(merchant.operatingHours.open, merchant.operatingHours.close) && (
                        <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                          <Moon size={12} className="text-amber-500" />
                          Madrugada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button 
                      fullWidth 
                      onClick={() => navigate(`/store/${merchant._id}`)}
                      variant={status.color === 'red' ? 'secondary' : 'primary'}
                    >
                      {status.color === 'red' ? 'Ver Cardápio (Fechado)' : 'Ver Cardápio'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

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
