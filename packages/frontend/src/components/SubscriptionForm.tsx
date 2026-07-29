import { useEffect, useId, useRef, useState } from 'react';
import { CalendarCheck, Check, CreditCard, Loader2, LockKeyhole, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, Card } from './ui';
import { MERCADO_PAGO_PUBLIC_KEY, isMercadoPagoConfigured } from '../config/publicEnv';
import { subscriptionService } from '../features/merchant/services/subscriptionService';

interface MerchantSubscriptionUser {
  email?: string;
  subscriptionStatus?: string;
  subscriptionPrice?: number;
}

interface Props {
  user: MerchantSubscriptionUser | null;
}

interface MercadoPagoCardFormData {
  token?: string;
  cardholderEmail?: string;
}

interface MercadoPagoCardForm {
  getCardFormData: () => MercadoPagoCardFormData;
}

interface MercadoPagoInstance {
  cardForm: (config: object) => MercadoPagoCardForm;
}

type MercadoPagoConstructor = new (publicKey: string) => MercadoPagoInstance;

const getMercadoPago = () =>
  (window as Window & { MercadoPago?: MercadoPagoConstructor }).MercadoPago;

export const SubscriptionForm = ({ user }: Props) => {
  const formId = `subscription-${useId().replace(/:/g, '')}`;
  const mounted = useRef(true);
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const subscribed = (user?.subscriptionStatus === 'ACTIVE' || success) && !cancelled;
  const price = user?.subscriptionPrice || 125;

  useEffect(() => {
    mounted.current = true;
    if (subscribed || !isMercadoPagoConfigured()) return;

    const initialize = () => {
      const MercadoPago = getMercadoPago();
      if (!mounted.current || !MercadoPago) return;
      const mp = new MercadoPago(MERCADO_PAGO_PUBLIC_KEY);
      const cardForm = mp.cardForm({
        amount: price.toFixed(2),
        iframe: true,
        form: {
          id: formId,
          cardNumber: { id: `${formId}-number`, placeholder: 'Número do cartão' },
          expirationDate: { id: `${formId}-expiration`, placeholder: 'MM/AA' },
          securityCode: { id: `${formId}-security`, placeholder: 'CVV' },
          cardholderName: { id: `${formId}-name`, placeholder: 'Nome no cartão' },
          issuer: { id: `${formId}-issuer` },
          installments: { id: `${formId}-installments` },
          identificationType: { id: `${formId}-document-type` },
          identificationNumber: { id: `${formId}-document`, placeholder: 'Documento' },
          cardholderEmail: { id: `${formId}-email`, placeholder: 'E-mail' }
        },
        callbacks: {
          onFormMounted: (sdkError: unknown) => {
            if (!mounted.current) return;
            if (sdkError) setError('Não foi possível carregar o formulário seguro.');
            else setSdkReady(true);
          },
          onSubmit: async (event: Event) => {
            event.preventDefault();
            setLoading(true);
            setError('');
            try {
              const data = cardForm.getCardFormData();
              if (!data.token || !data.cardholderEmail) throw new Error('Dados incompletos');
              await subscriptionService.subscribe(data.token, data.cardholderEmail);
              if (mounted.current) setSuccess(true);
            } catch {
              if (mounted.current) setError('Pagamento não aprovado. Revise os dados ou tente outro cartão.');
            } finally {
              if (mounted.current) setLoading(false);
            }
          }
        }
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-mercado-pago-sdk]');
    if (existing) {
      if (getMercadoPago()) initialize();
      else existing.addEventListener('load', initialize, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.dataset.mercadoPagoSdk = 'true';
      script.addEventListener('load', initialize, { once: true });
      script.addEventListener('error', () => setError('Falha ao carregar o meio de pagamento.'), { once: true });
      document.body.appendChild(script);
    }

    return () => { mounted.current = false; };
  }, [formId, price, subscribed]);

  const cancelSubscription = async () => {
    if (!window.confirm('Cancelar a renovação da assinatura? Sua loja poderá deixar de receber pedidos.')) return;
    try {
      setLoading(true);
      setError('');
      await subscriptionService.cancel();
      setCancelled(true);
    } catch {
      setError('Não foi possível cancelar a assinatura. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Plano da plataforma</p>
          <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Assinatura ativa</h3>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-7 text-white">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <Badge className="mb-4 !bg-white/20 !text-white">ATIVA</Badge>
                <p className="text-3xl font-black">Traz Pra Cá Pro</p>
                <p className="mt-2 text-sm text-emerald-50">Sua loja está liberada para receber pedidos.</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 text-right backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-emerald-100">Mensalidade</p>
                <p className="text-3xl font-black">R$ {price.toFixed(2).replace('.', ',')}</p>
                <p className="text-xs text-emerald-100">por mês</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {[
              [CalendarCheck, 'Renovação automática', 'Sem interrupção nas vendas'],
              [ShieldCheck, 'Pagamento protegido', 'Processado pelo Mercado Pago'],
              [Check, 'Todos os recursos', 'Pedidos, cardápio e atendimento']
            ].map(([Icon, title, detail]) => (
              <div key={String(title)} className="flex gap-3">
                <Icon className="shrink-0 text-emerald-600" size={20} />
                <div><p className="text-sm font-bold dark:text-white">{String(title)}</p><p className="text-xs text-slate-500">{String(detail)}</p></div>
              </div>
            ))}
          </div>
        </Card>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
        <button onClick={cancelSubscription} disabled={loading}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-red-500 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Cancelar renovação
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <Card className="bg-slate-950 text-white">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Plano mensal</p>
        <h3 className="mt-3 text-3xl font-black">Sua operação completa</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">Ative sua loja e mantenha todos os recursos de venda disponíveis.</p>
        <p className="mt-8 text-4xl font-black">R$ {price.toFixed(2).replace('.', ',')}<span className="text-sm font-medium text-slate-400">/mês</span></p>
        <ul className="mt-8 space-y-3 text-sm">
          {['Pedidos em tempo real', 'Cardápio e estoque ilimitados', 'Atendimento via WhatsApp', 'Painel financeiro'].map((item) => (
            <li key={item} className="flex items-center gap-2"><Check size={16} className="text-emerald-400" /> {item}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">Pagamento seguro</h4>
            <p className="text-sm text-slate-500">Dados processados pelo Mercado Pago.</p>
          </div>
          <CreditCard className="text-energy" />
        </div>

        {!isMercadoPagoConfigured() ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
            O pagamento online ainda não foi configurado pela plataforma.
          </div>
        ) : (
          <form id={formId} className="space-y-4">
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500">Número do cartão</label>
              <div id={`${formId}-number`} className="h-12 rounded-xl border border-slate-200 px-3 dark:border-slate-700" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1.5 block text-xs font-bold text-slate-500">Validade</label><div id={`${formId}-expiration`} className="h-12 rounded-xl border border-slate-200 px-3 dark:border-slate-700" /></div>
              <div><label className="mb-1.5 block text-xs font-bold text-slate-500">CVV</label><div id={`${formId}-security`} className="h-12 rounded-xl border border-slate-200 px-3 dark:border-slate-700" /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input id={`${formId}-name`} placeholder="Nome no cartão" className="h-12 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
              <input id={`${formId}-email`} type="email" defaultValue={user?.email || ''} placeholder="E-mail" className="h-12 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-3">
              <select id={`${formId}-document-type`} className="h-12 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
              <input id={`${formId}-document`} placeholder="CPF/CNPJ do titular" className="h-12 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
            </div>
            <div className="hidden"><select id={`${formId}-issuer`} /><select id={`${formId}-installments`} /></div>
            <Button type="submit" fullWidth disabled={loading || !sdkReady} className="gap-2">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <LockKeyhole size={17} />}
              {loading ? 'Processando...' : `Assinar por R$ ${price.toFixed(2).replace('.', ',')}`}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
