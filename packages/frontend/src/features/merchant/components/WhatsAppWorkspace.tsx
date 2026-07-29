import { useMemo, useState } from 'react';
import { ExternalLink, MessageCircle, Search, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from '../utils/whatsapp';

interface ContactOrder {
  _id: string;
  customerId: { name: string; phone: string };
  status: string;
  total: number;
  createdAt: string;
}

interface Props {
  orders: ContactOrder[];
}

const defaultMessage = (name: string, orderId: string) =>
  `Olá, ${name}! Aqui é da loja. Estou entrando em contato sobre o pedido #${orderId.slice(-6).toUpperCase()}.`;

export function WhatsAppWorkspace({ orders }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(orders[0]?._id || '');
  const [message, setMessage] = useState('');

  const contacts = useMemo(() => {
    const unique = new Map<string, ContactOrder>();
    for (const order of orders) {
      const phone = normalizeWhatsAppPhone(order.customerId?.phone || '');
      if (phone && !unique.has(phone)) unique.set(phone, order);
    }
    return [...unique.values()];
  }, [orders]);

  const visible = contacts.filter((order) =>
    `${order.customerId.name} ${order.customerId.phone}`.toLocaleLowerCase('pt-BR')
      .includes(query.trim().toLocaleLowerCase('pt-BR'))
  );
  const selected = contacts.find((order) => order._id === selectedId) || visible[0] || null;

  const openWhatsApp = () => {
    const url = selected
      ? buildWhatsAppUrl(selected.customerId.phone, message || defaultMessage(selected.customerId.name, selected._id))
      : 'https://web.whatsapp.com/';
    window.open(url, 'merchant-whatsapp', 'popup=yes,width=720,height=900,resizable=yes,scrollbars=yes');
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Atendimento</p>
        <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">WhatsApp ao lado da loja</h3>
        <p className="text-sm text-slate-500">Escolha um cliente, prepare a mensagem e abra a conversa no WhatsApp Web.</p>
      </div>

      <div className="grid min-h-[590px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[320px_1fr] dark:border-slate-800 dark:bg-slate-900">
        <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r dark:border-slate-800 dark:bg-slate-950/40">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 shadow-sm dark:bg-slate-900">
              <Search size={16} className="text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente"
                className="w-full bg-transparent py-3 text-sm outline-none dark:text-white" />
            </label>
          </div>
          <div className="max-h-64 overflow-y-auto p-2 lg:max-h-[520px]">
            {visible.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Os clientes dos pedidos aparecerão aqui.</div>
            ) : visible.map((order) => (
              <button key={order._id} onClick={() => {
                setSelectedId(order._id);
                setMessage(defaultMessage(order.customerId.name, order._id));
              }}
                className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${selected?._id === order._id ? 'bg-white shadow-sm dark:bg-slate-800' : 'hover:bg-white/70 dark:hover:bg-slate-800/50'}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">
                  {order.customerId.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{order.customerId.name}</p>
                  <p className="text-[11px] text-slate-400">Pedido #{order._id.slice(-6).toUpperCase()}</p>
                </div>
                <Badge variant="green">WhatsApp</Badge>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex flex-col bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.10),_transparent_42%)]">
          <header className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500 p-2 text-white"><MessageCircle size={20} /></div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white">{selected?.customerId.name || 'WhatsApp Web'}</p>
                <p className="text-xs text-slate-400">{selected?.customerId.phone || 'Conecte seu aparelho para começar'}</p>
              </div>
            </div>
            <Badge variant="green">Canal seguro</Badge>
          </header>

          <div className="flex flex-1 flex-col justify-center p-5 sm:p-8">
            <Card className="mx-auto w-full max-w-xl space-y-5 border-emerald-100 dark:border-emerald-900/40">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-1 shrink-0 text-emerald-600" />
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white">Atendimento em tela dividida</h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    A conversa abre em uma janela dedicada ao lado do painel. Sua sessão e o QR Code permanecem diretamente no domínio oficial do WhatsApp.
                  </p>
                </div>
              </div>

              {selected && (
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Mensagem inicial</label>
                  <textarea value={message || defaultMessage(selected.customerId.name, selected._id)}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-32 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </div>
              )}

              <Button onClick={openWhatsApp} fullWidth className="gap-2 !bg-emerald-600 hover:!bg-emerald-700">
                <ExternalLink size={17} /> {selected ? 'Abrir conversa no WhatsApp Web' : 'Abrir WhatsApp Web'}
              </Button>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck size={15} className="text-emerald-600" />
                Nenhuma senha, cookie ou sessão do WhatsApp passa pelo sistema.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

