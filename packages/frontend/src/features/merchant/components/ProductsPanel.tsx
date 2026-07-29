import { useEffect, useMemo, useState } from 'react';
import { Edit2, ImageOff, Loader2, PackageOpen, Pause, Play, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';
import { catalogService } from '../services/catalogService';
import type { MerchantProduct, MerchantToast, ProductFormData } from '../types';
import { ProductEditorModal } from './ProductEditorModal';

interface Props {
  merchantId: string;
  onToast: (toast: MerchantToast) => void;
}

export function ProductsPanel({ merchantId, onToast }: Props) {
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantProduct | null>(null);

  useEffect(() => {
    let active = true;
    catalogService.list(merchantId)
      .then((data) => active && setProducts(data))
      .catch(() => onToast({ message: 'Não foi possível carregar o cardápio.', type: 'error' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [merchantId, onToast]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return products.filter((product) => {
      const matchesQuery = !normalized || `${product.name} ${product.category}`.toLocaleLowerCase('pt-BR').includes(normalized);
      const unavailable = product.isPaused || product.stockQuantity <= 0;
      const matchesStatus = status === 'all' || (status === 'paused' ? unavailable : !unavailable);
      return matchesQuery && matchesStatus;
    });
  }, [products, query, status]);

  const save = async (form: ProductFormData) => {
    try {
      setSaving(true);
      if (editing) {
        const updated = await catalogService.update(editing._id, form);
        setProducts((current) => current.map((item) => item._id === updated._id ? updated : item));
        onToast({ message: 'Item atualizado.', type: 'success' });
      } else {
        const created = await catalogService.create(form);
        setProducts((current) => [created, ...current]);
        onToast({ message: 'Item adicionado ao cardápio.', type: 'success' });
      }
      setEditorOpen(false);
    } catch {
      onToast({ message: 'Não foi possível salvar o item. Revise os dados.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const togglePaused = async (product: MerchantProduct) => {
    try {
      const updated = await catalogService.setPaused(product, !product.isPaused);
      setProducts((current) => current.map((item) => item._id === updated._id ? updated : item));
      onToast({ message: updated.isPaused ? 'Item pausado.' : 'Item disponível para venda.', type: 'success' });
    } catch {
      onToast({ message: 'Não foi possível alterar a disponibilidade.', type: 'error' });
    }
  };

  const remove = async (product: MerchantProduct) => {
    if (!window.confirm(`Excluir "${product.name}" do cardápio?`)) return;
    try {
      await catalogService.remove(product._id);
      setProducts((current) => current.filter((item) => item._id !== product._id));
      onToast({ message: 'Item removido.', type: 'success' });
    } catch {
      onToast({ message: 'Não foi possível excluir o item.', type: 'error' });
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-energy">Cardápio</p>
          <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Seus produtos</h3>
          <p className="text-sm text-slate-500">{products.length} itens cadastrados</p>
        </div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }} className="gap-2">
          <Plus size={17} /> Novo produto
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 dark:bg-slate-950/60">
            <Search size={17} className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto ou categoria"
              className="w-full bg-transparent py-3 text-sm outline-none dark:text-white" />
          </label>
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {([['all', 'Todos'], ['active', 'Ativos'], ['paused', 'Pausados']] as const).map(([value, label]) => (
              <button key={value} onClick={() => setStatus(value)}
                className={`flex-1 rounded-lg px-4 py-2 text-xs font-bold transition ${status === value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex min-h-60 items-center justify-center text-energy"><Loader2 className="animate-spin" /></div>
      ) : visibleProducts.length === 0 ? (
        <Card className="flex min-h-64 flex-col items-center justify-center text-center">
          <PackageOpen size={42} className="mb-3 text-slate-300" />
          <h4 className="font-bold text-slate-800 dark:text-white">Nenhum item encontrado</h4>
          <p className="mt-1 text-sm text-slate-500">Crie um produto ou altere os filtros.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleProducts.map((product) => {
            const unavailable = product.isPaused || product.stockQuantity <= 0;
            return (
              <article key={product._id} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="flex gap-4 p-4">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                    {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      : <div className="flex h-full items-center justify-center text-slate-300"><ImageOff /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{product.category}</p>
                        <h4 className="truncate text-base font-black text-slate-900 dark:text-white">{product.name}</h4>
                      </div>
                      <Badge variant={unavailable ? 'red' : 'green'}>{unavailable ? 'Indisponível' : 'Ativo'}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{product.description || 'Sem descrição'}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-lg font-black text-energy">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                      <span className="text-xs font-semibold text-slate-400">{product.stockQuantity} em estoque</span>
                    </div>
                  </div>
                </div>
                <div className="flex border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => togglePaused(product)} className="flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                    {product.isPaused ? <Play size={15} /> : <Pause size={15} />}
                    {product.isPaused ? 'Ativar' : 'Pausar'}
                  </button>
                  <button onClick={() => { setEditing(product); setEditorOpen(true); }} aria-label={`Editar ${product.name}`}
                    className="border-l border-slate-100 px-5 text-slate-500 hover:bg-slate-50 hover:text-energy dark:border-slate-800 dark:hover:bg-slate-800"><Edit2 size={16} /></button>
                  <button onClick={() => remove(product)} aria-label={`Excluir ${product.name}`}
                    className="border-l border-slate-100 px-5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:border-slate-800 dark:hover:bg-red-950/20"><Trash2 size={16} /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ProductEditorModal key={`${editing?._id || 'new'}-${editorOpen}`} open={editorOpen} product={editing} saving={saving}
        onClose={() => !saving && setEditorOpen(false)} onSave={save}
        onError={(message) => onToast({ message, type: 'error' })} />
    </section>
  );
}
