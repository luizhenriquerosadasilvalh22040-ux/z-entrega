import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { Button, Card, Toast } from '../components/ui';
import { Search, MapPin, Store, Star, ArrowRight, Utensils, Croissant, Pill, Warehouse, Pizza, IceCreamCone, Moon, CookingPot, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HeroCarousel, type HeroBanner } from '../components/HeroCarousel';

interface IMerchant {
  _id: string;
  name: string;
  category: string;
  phone: string;
  operatingHours: { open: string; close: string };
  address: { street: string; number: string; city: string };
  logoImage?: string;
  isForceClosed?: boolean;
  averageRating?: number;
  reviewsCount?: number;
}

const categories = [
  { id: 'Hambúrguer', label: 'Hambúrguer', icon: Utensils },
  { id: 'Marmitas', label: 'Marmitas', icon: CookingPot },
  { id: 'Sorvete', label: 'Sorvete', icon: IceCreamCone },
  { id: 'Pizza', label: 'Pizza', icon: Pizza },
  { id: 'Padarias', label: 'Padarias', icon: Croissant },
  { id: 'Farmácia', label: 'Farmácia', icon: Pill },
  { id: 'Depósitos', label: 'Depósitos', icon: Warehouse },
  { id: 'Madrugada', label: 'Madrugada', icon: Moon }
] as const;

const discoveryMainCards = [
  { id: 'Hambúrguer', title: 'Restaurantes', action: 'Ver opções', image: '/banner-open-now-v1.png', variant: 'restaurant' },
  { id: 'Geral', title: 'Mercado', action: 'Buscar lojas', image: '/banner-near-you-v1.png', variant: 'market' }
];

const LineIcon: React.FC<{ icon: LucideIcon; className?: string }> = ({ icon: Icon, className = '' }) => (
  <span className={`customer-line-icon ${className}`} aria-hidden="true">
    <Icon className="customer-line-icon-glyph" strokeWidth={1.8} />
  </span>
);

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();



export const Home: React.FC = () => {
  const navigate = useNavigate();
  
  const [merchants, setMerchants] = useState<IMerchant[]>([]);
  const [banners, setBanners] = useState<HeroBanner[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega lojistas e banners
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [merchantsRes, bannersRes] = await Promise.all([
          apiClient.get('/merchants'),
          apiClient.get('/banners').catch(() => null)
        ]);
        if (merchantsRes.data?.status === 'success') {
          setMerchants(merchantsRes.data.data.merchants);
        }
        if (bannersRes?.data?.status === 'success') {
          setBanners(bannersRes.data.data.banners);
        }
      } catch {
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
    const closeMinutes = closeH * 60 + closeM;

    // Se passa da meia-noite
    if (closeMinutes < openMinutes) {
      if (currentMinutes >= openMinutes || currentMinutes < closeMinutes) {
        const diff = currentMinutes >= openMinutes
          ? (24 * 60 - currentMinutes) + closeMinutes
          : closeMinutes - currentMinutes;
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
    
    const merchantCategory = normalize(merchant.category);
    const merchantName = normalize(merchant.name);
    const matchesCategory = !selectedCategory
      || (selectedCategory === 'Madrugada'
        && isMadrugadaStore(merchant.operatingHours.open, merchant.operatingHours.close))
      || (['Hambúrguer', 'Marmitas', 'Pizza', 'Padarias'].includes(selectedCategory)
        && merchantCategory === 'comida')
      || (selectedCategory === 'Sorvete'
        && (merchantCategory === 'comida' || merchantCategory === 'geral'))
      || (selectedCategory === 'Farmácia' && merchantCategory === 'farmacia')
      || (selectedCategory === 'Depósitos'
        && (merchantCategory === 'construcao' || /deposit|material de construcao|construcao/.test(merchantName)))
      || (selectedCategory === 'Geral' && merchantCategory === 'geral');

    return matchesSearch && matchesCategory;
  });

  const recommendedMerchants = merchants
    .slice()
    .sort((a, b) => {
      const ratingDifference = (b.averageRating || 0) - (a.averageRating || 0);
      if (ratingDifference !== 0) return ratingDifference;
      return (b.reviewsCount || 0) - (a.reviewsCount || 0);
    })
    .slice(0, 6);

  const selectRecommendedCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    document.getElementById('estabelecimentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="customer-home space-y-8">
      
      <HeroCarousel banners={banners} />

      {/* Search Input */}
      <div className="max-w-md mx-auto flex items-center relative">
        <Search className="absolute left-4 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Buscar estabelecimentos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="customer-home-search w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-energy/20 focus:border-energy rounded-2xl shadow-sm text-sm focus:ring-4 transition-all duration-200 outline-none dark:text-white"
        />
      </div>

      {/* Category carousel */}
      <div className="space-y-4">
        <h3 className="pl-1 text-lg font-extrabold tracking-tight text-slate-800 dark:text-white">Peça por categoria</h3>
        <div className="flex flex-wrap justify-start gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`customer-category-button flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 ${
                selectedCategory === cat.id
                  ? 'customer-category-active -translate-y-0.5 shadow-md'
                  : 'customer-category bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/70 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:border-slate-800 shadow-sm'
              }`}
            >
              <cat.icon size={22} strokeWidth={1.8} className="customer-category-icon animate-float" aria-hidden="true" />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stores Section */}
      <div id="estabelecimentos" className="scroll-mt-24">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-slate-800 dark:text-white">
          <Store size={22} className="customer-accent animate-float" /> Estabelecimentos perto de você
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="customer-store-card flex flex-col justify-between relative overflow-hidden animate-pulse">
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
          <div className="customer-empty-state text-center py-12 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80">
            Nenhum estabelecimento comercial aberto ou disponível no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMerchants.map((merchant) => {
              const status = merchant.isForceClosed
                ? { label: 'Fechado', color: 'red' as const }
                : getMerchantStatus(merchant.operatingHours.open, merchant.operatingHours.close);
              return (
                <Card key={merchant._id} interactive className="customer-store-card flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#b8f51b] to-[#79c91a]"></div>
                  
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
                          <div className="customer-merchant-monogram w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg">
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
                          <span aria-hidden="true">🌙</span>
                          Madrugada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button 
                      fullWidth 
                      className="customer-store-cta"
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

      <section className="customer-discovery" aria-labelledby="customer-discovery-heading">
        <div className="mb-5">
          <p className="customer-section-kicker">Descubra mais</p>
          <h2 id="customer-discovery-heading" className="mt-1 text-xl font-black tracking-tight text-slate-800 dark:text-white">
            O que você quer pedir hoje?
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {discoveryMainCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => selectRecommendedCategory(card.id)}
              className={`customer-discovery-main-card customer-discovery-${card.variant} group relative flex min-h-48 items-center overflow-hidden rounded-3xl p-6 text-left transition duration-200 hover:-translate-y-1`}
            >
              <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              <span className="customer-discovery-main-overlay absolute inset-0" aria-hidden="true" />
              <span className="relative z-10 max-w-[65%]">
                <span className="block text-2xl font-black tracking-tight sm:text-3xl">{card.title}</span>
                <span className="mt-2 block text-sm font-medium opacity-80">
                  {card.variant === 'restaurant'
                    ? 'Descubra sabores e faça seu próximo pedido.'
                    : 'Encontre lojas e itens para o dia a dia.'}
                </span>
                <span className="customer-discovery-action mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold">
                  {card.action} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Parceiros da região</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Em destaque pelas avaliações</span>
          </div>
          {recommendedMerchants.length > 0 ? (
            <div className="customer-partner-list flex gap-4 overflow-x-auto pb-2">
              {recommendedMerchants.map((merchant) => (
                <button
                  key={merchant._id}
                  type="button"
                  onClick={() => navigate(`/store/${merchant._id}`)}
                  className="customer-partner-item flex min-w-[92px] flex-col items-center gap-2 text-center"
                  aria-label={`Ver loja ${merchant.name}`}
                >
                  <span className="customer-partner-logo grid h-[68px] w-[68px] place-items-center overflow-hidden rounded-full bg-white p-1.5">
                    {merchant.logoImage ? (
                      <img src={merchant.logoImage} alt="" className="h-full w-full rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="customer-merchant-monogram grid h-full w-full place-items-center rounded-full text-sm font-black">
                        {merchant.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="max-w-[100px] truncate text-xs font-bold text-slate-700 dark:text-slate-200">{merchant.name}</span>
                  {merchant.averageRating ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <Star size={12} className="fill-amber-400 text-amber-400" /> {merchant.averageRating.toFixed(1)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              As lojas parceiras aparecerão aqui assim que estiverem disponíveis na sua região.
            </p>
          )}
        </div>
      </section>

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
