import { useState } from 'react';
import { ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button, Input, Modal } from '../../../components/ui';
import { uploadMerchantImage } from '../services/imageUploadService';
import type { MerchantProduct, ProductFormData, ProductOptionGroup } from '../types';

const emptyForm = (): ProductFormData => ({
  name: '',
  description: '',
  price: '',
  category: '',
  image: '',
  stockQuantity: 99,
  optionGroups: []
});

const fromProduct = (product: MerchantProduct): ProductFormData => ({
  name: product.name,
  description: product.description,
  price: String(product.price),
  category: product.category,
  image: product.image || '',
  stockQuantity: product.stockQuantity,
  optionGroups: product.optionGroups || []
});

interface Props {
  open: boolean;
  product: MerchantProduct | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: ProductFormData) => Promise<void>;
  onError: (message: string) => void;
}

export function ProductEditorModal({ open, product, saving, onClose, onSave, onError }: Props) {
  const [form, setForm] = useState<ProductFormData>(() => product ? fromProduct(product) : emptyForm());
  const [uploading, setUploading] = useState(false);

  const updateGroup = (index: number, update: Partial<ProductOptionGroup>) => {
    setForm((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...update } : group
      )
    }));
  };

  const handleUpload = async (file?: File) => {
    if (!file) return;
    try {
      setUploading(true);
      const image = await uploadMerchantImage(file, 'product');
      setForm((current) => ({ ...current, image }));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.category.trim() || Number(form.price) <= 0) {
      onError('Informe nome, categoria e um preço válido.');
      return;
    }
    const invalidGroup = form.optionGroups.some((group) =>
      !group.name.trim()
      || group.options.length === 0
      || group.options.some((option) => !option.name.trim() || option.price < 0)
      || group.maxSelect < Math.max(group.required ? 1 : 0, group.minSelect)
    );
    if (invalidGroup) {
      onError('Revise os grupos de complementos e mantenha ao menos uma opção em cada grupo.');
      return;
    }
    await onSave(form);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={product ? 'Editar item' : 'Novo item do cardápio'}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex gap-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {form.image ? (
              <>
                <img src={form.image} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, image: '' }))}
                  className="absolute right-1 top-1 rounded-full bg-slate-950/70 p-1 text-white"
                  aria-label="Remover foto"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
                <ImagePlus size={22} />
                <span className="text-[10px] font-bold">Foto 1:1</span>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-sm font-bold text-slate-800 dark:text-white">Foto que abre o apetite</p>
            <p className="mt-1 text-xs text-slate-500">Use uma imagem quadrada, clara e sem textos.</p>
            <label className="mt-3 inline-flex w-fit cursor-pointer items-center gap-2 text-xs font-bold text-energy">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
              {uploading ? 'Enviando...' : 'Escolher foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <Input
          label="Nome do item *"
          placeholder="Ex.: X-Bacon especial"
          maxLength={100}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Descrição
          </label>
          <textarea
            value={form.description}
            maxLength={500}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Ingredientes e diferenciais do item"
            className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-energy focus:ring-4 focus:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">{form.description.length}/500</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Preço *" type="number" min="0.01" step="0.01" value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })} />
          <Input label="Categoria *" maxLength={80} value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <Input label="Estoque" type="number" min="0" max="100000" value={form.stockQuantity}
            onChange={(event) => setForm({ ...form, stockQuantity: Number(event.target.value) })} />
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Complementos</h4>
              <p className="text-xs text-slate-500">Adicionais, tamanhos e escolhas do cliente.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({
                ...form,
                optionGroups: [...form.optionGroups, {
                  name: '', required: false, minSelect: 0, maxSelect: 1, options: [{ name: '', price: 0 }]
                }]
              })}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-energy"
            >
              <Plus size={14} /> Grupo
            </button>
          </div>

          {form.optionGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex gap-2">
                <input
                  value={group.name}
                  maxLength={80}
                  onChange={(event) => updateGroup(groupIndex, { name: event.target.value })}
                  placeholder="Ex.: Escolha o tamanho"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <button type="button" aria-label="Excluir grupo"
                  onClick={() => setForm({ ...form, optionGroups: form.optionGroups.filter((_, i) => i !== groupIndex) })}
                  className="rounded-xl p-2 text-red-500 hover:bg-red-50">
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={group.required}
                    onChange={(event) => updateGroup(groupIndex, {
                      required: event.target.checked,
                      minSelect: event.target.checked ? Math.max(1, group.minSelect) : 0
                    })} />
                  Obrigatório
                </label>
                <label>Máximo
                  <input type="number" min="1" max="20" value={group.maxSelect}
                    onChange={(event) => updateGroup(groupIndex, { maxSelect: Number(event.target.value) })}
                    className="ml-2 w-14 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-900" />
                </label>
              </div>
              {group.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input value={option.name} placeholder="Nome da opção"
                    onChange={(event) => updateGroup(groupIndex, {
                      options: group.options.map((item, i) => i === optionIndex ? { ...item, name: event.target.value } : item)
                    })}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                  <input type="number" min="0" step="0.01" value={option.price} aria-label="Preço adicional"
                    onChange={(event) => updateGroup(groupIndex, {
                      options: group.options.map((item, i) => i === optionIndex ? { ...item, price: Number(event.target.value) } : item)
                    })}
                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                  <button type="button" aria-label="Excluir opção"
                    onClick={() => updateGroup(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) })}
                    className="p-2 text-red-500"><X size={16} /></button>
                </div>
              ))}
              <button type="button"
                onClick={() => updateGroup(groupIndex, { options: [...group.options, { name: '', price: 0 }] })}
                className="text-xs font-bold text-energy">+ Adicionar opção</button>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white pt-4 dark:border-slate-800 dark:bg-slate-900">
          <Button type="button" variant="outline" fullWidth onClick={onClose}>Cancelar</Button>
          <Button type="submit" fullWidth disabled={saving || uploading}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            {product ? 'Salvar alterações' : 'Adicionar ao cardápio'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
