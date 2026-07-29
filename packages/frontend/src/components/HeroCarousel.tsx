import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, MapPin, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface HeroBanner {
  _id: string;
  imageUrl: string;
  title?: string;
  linkUrl?: string;
}

interface HeroCarouselProps {
  banners: HeroBanner[];
}

interface Slide extends HeroBanner {
  eyebrow?: string;
  description?: string;
  ctaLabel?: string;
  tone?: 'energy' | 'night' | 'fresh';
}

const fallbackSlides: Slide[] = [
  {
    _id: 'discover-local',
    imageUrl: '/banner_home_4k.jpg',
    title: 'O que você precisa, mais perto de você',
    description: 'Descubra lojas locais e peça em poucos toques.',
    eyebrow: 'Entrega local, do seu jeito',
    ctaLabel: 'Explorar lojas',
    linkUrl: '#estabelecimentos',
    tone: 'energy'
  },
  {
    _id: 'open-now',
    imageUrl: '/banner-open-now-v1.png',
    title: 'Bateu a fome? Tem loja aberta agora',
    description: 'Encontre opções disponíveis sem perder tempo.',
    eyebrow: 'Escolha rápida',
    ctaLabel: 'Ver quem está aberto',
    linkUrl: '#estabelecimentos',
    tone: 'night'
  },
  {
    _id: 'local-economy',
    imageUrl: '',
    title: 'Seu pedido fortalece o comércio local',
    description: 'Compre de quem faz parte da sua cidade.',
    eyebrow: 'Compre perto',
    ctaLabel: 'Conhecer estabelecimentos',
    linkUrl: '#estabelecimentos',
    tone: 'fresh'
  }
];

const toneClasses = {
  energy: 'from-[#ea1d2c] via-[#f04435] to-[#ff7a33]',
  night: 'from-[#17131f] via-[#30203e] to-[#ea1d2c]',
  fresh: 'from-[#0d7c66] via-[#159675] to-[#54b979]'
};

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ banners }) => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    if (!banners.length) return fallbackSlides;

    return banners.map((banner, index) => ({
      ...banner,
      title: banner.title || 'Uma oferta escolhida para você',
      eyebrow: 'Destaque da semana',
      description: 'Aproveite enquanto estiver disponível.',
      ctaLabel: banner.linkUrl ? 'Quero aproveitar' : undefined,
      tone: (['energy', 'night', 'fresh'] as const)[index % 3]
    }));
  }, [banners]);

  useEffect(() => {
    if (isPaused || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [isPaused, slides.length]);

  const displayedIndex = activeIndex % slides.length;

  const goTo = (index: number) => {
    setActiveIndex((index + slides.length) % slides.length);
  };

  const followLink = (linkUrl?: string) => {
    if (!linkUrl) return;
    if (linkUrl.startsWith('#')) {
      document.querySelector(linkUrl)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (linkUrl.startsWith('/')) {
      navigate(linkUrl);
      return;
    }
    window.location.assign(linkUrl);
  };

  return (
    <section
      className="relative isolate overflow-hidden rounded-[1.75rem] bg-slate-950 shadow-[0_20px_55px_-25px_rgba(15,23,42,0.65)]"
      aria-roledescription="carrossel"
      aria-label="Destaques"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="relative min-h-[360px] sm:min-h-[390px] lg:min-h-[420px]">
        {slides.map((slide, index) => {
          const isActive = index === displayedIndex;
          return (
            <article
              key={slide._id}
              className={`absolute inset-0 overflow-hidden transition-all duration-700 ease-out ${
                isActive ? 'z-10 translate-x-0 opacity-100' : 'pointer-events-none z-0 translate-x-3 opacity-0'
              }`}
              aria-hidden={!isActive}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${toneClasses[slide.tone || 'energy']}`} />
              {slide.imageUrl && (
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-center opacity-65 mix-blend-luminosity sm:opacity-75"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/42 to-black/5" />
              <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />

              <div className="relative z-10 flex min-h-[360px] max-w-2xl flex-col justify-end px-6 pb-16 pt-8 text-white sm:min-h-[390px] sm:justify-center sm:px-10 sm:pb-20 lg:min-h-[420px] lg:px-14">
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] backdrop-blur-md">
                  <Sparkles size={13} aria-hidden="true" />
                  {slide.eyebrow}
                </div>
                <h1 className="max-w-xl text-[2rem] font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                  {slide.title}
                </h1>
                {slide.description && (
                  <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-white/85 sm:text-base">
                    {slide.description}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {slide.ctaLabel && (
                    <button
                      type="button"
                      onClick={() => followLink(slide.linkUrl)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-slate-900 shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-white/30"
                    >
                      {slide.ctaLabel}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80">
                    {index === 1 ? <Clock3 size={15} /> : <MapPin size={15} />}
                    Feito para sua região
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          <div className="absolute bottom-5 left-6 z-20 flex items-center gap-2 sm:left-10 lg:left-14">
            {slides.map((slide, index) => (
              <button
                key={slide._id}
                type="button"
                onClick={() => goTo(index)}
                className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white ${
                  index === displayedIndex ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/70'
                }`}
                aria-label={`Ir para destaque ${index + 1}`}
                aria-current={index === displayedIndex ? 'true' : undefined}
              />
            ))}
          </div>
          <div className="absolute bottom-4 right-5 z-20 hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => goTo(displayedIndex - 1)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-md transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Destaque anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => goTo(displayedIndex + 1)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-md transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Próximo destaque"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
    </section>
  );
};
