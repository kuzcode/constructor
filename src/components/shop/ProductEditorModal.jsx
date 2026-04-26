import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Label, Textarea } from '../ui/Input';
import { uploadImage, getImagePreviewUrl, deleteStorageFiles } from '../../services/appsService';
import { newSpec, newColor, newSize, isVariabilityActive } from '../../utils/productModel';
import clsx from 'clsx';

const MAX_PRODUCT_IMAGES = 5;
const MAX_FILE = 4 * 1024 * 1024;
const MAX_SPEC = 10;

export function ProductEditorModal({ open, product, categoryOptions, onClose, onSave }) {
  const [local, setLocal] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && product) {
      setLocal(JSON.parse(JSON.stringify(product)));
      setErr('');
    }
  }, [open, product]);

  if (!open || !local) return null;

  const addFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    setErr('');
    for (const file of files) {
      if (local.imageFileIds.length >= MAX_PRODUCT_IMAGES) {
        setErr(`Не больше ${MAX_PRODUCT_IMAGES} фото`);
        break;
      }
      if (file.size > MAX_FILE) {
        setErr('Каждый файл до 4 МБ');
        continue;
      }
      if (!file.type.startsWith('image/')) continue;
      try {
        const f = await uploadImage(file);
        setLocal((s) => ({ ...s, imageFileIds: [...s.imageFileIds, f.$id] }));
      } catch (ex) {
        setErr(ex.message || 'Ошибка загрузки');
      }
    }
  };

  const removeImg = async (fid) => {
    await deleteStorageFiles([fid]);
    setLocal((s) => ({ ...s, imageFileIds: s.imageFileIds.filter((x) => x !== fid) }));
  };

  const addSpec = () => {
    if (local.specs.length >= MAX_SPEC) return;
    setLocal((s) => ({ ...s, specs: [...s.specs, newSpec()] }));
  };

  const patchSpec = (id, patch) => {
    setLocal((s) => ({
      ...s,
      specs: s.specs.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  };

  const delSpec = (id) => setLocal((s) => ({ ...s, specs: s.specs.filter((x) => x.id !== id) }));

  const addColor = () => {
    if (local.colors.length >= MAX_SPEC) return;
    setLocal((s) => ({ ...s, colors: [...s.colors, newColor()] }));
  };

  const patchColor = (id, hex) => {
    setLocal((s) => ({
      ...s,
      colors: s.colors.map((c) => (c.id === id ? { ...c, hex } : c)),
    }));
  };

  const delColor = (id) => setLocal((s) => ({ ...s, colors: s.colors.filter((c) => c.id !== id) }));

  const addSize = () => {
    if (local.sizes.length >= MAX_SPEC) return;
    setLocal((s) => ({ ...s, sizes: [...s.sizes, newSize()] }));
  };

  const patchSize = (id, name) => {
    setLocal((s) => ({
      ...s,
      sizes: s.sizes.map((z) => (z.id === id ? { ...z, name } : z)),
    }));
  };

  const delSize = (id) => setLocal((s) => ({ ...s, sizes: s.sizes.filter((z) => z.id !== id) }));

  const varActive = isVariabilityActive(local);

  return (
    <Modal open={open} onClose={onClose} title="Товар" wide className="sm:max-w-3xl">
      {err ? <div className="mb-3 text-sm text-red-300">{err}</div> : null}
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <Label>Название</Label>
          <Input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} />
        </div>
        <div>
          <Label>Описание</Label>
          <Textarea value={local.description} onChange={(e) => setLocal({ ...local, description: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Цена, ₽</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={local.price}
              onChange={(e) => setLocal({ ...local, price: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Товары в наличии (шт.)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={local.stock}
              onChange={(e) => setLocal({ ...local, stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </div>
        </div>
        <div>
          <Label>Когда закончатся товары в наличии</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              ['mark', 'Показывать «нет в наличии»'],
              ['remove', 'Удалить товар из каталога'],
            ].map(([v, lab]) => (
              <button
                key={v}
                type="button"
                onClick={() => setLocal({ ...local, outOfStockBehavior: v })}
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm border text-left max-w-full',
                  local.outOfStockBehavior === v
                    ? 'border-[#3390ec] bg-[#3390ec]/15'
                    : 'border-tg-border bg-tg-surface',
                )}
              >
                {lab}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Категория</Label>
          <select
            className="w-full rounded-xl bg-tg-surface border border-tg-border px-3 py-3 text-[15px] text-white mt-1"
            value={local.categoryId || ''}
            onChange={(e) =>
              setLocal({
                ...local,
                categoryId: e.target.value === '' ? null : e.target.value,
              })
            }
          >
            <option value="">Без категории</option>
            {categoryOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="!mb-0">Характеристики (до {MAX_SPEC})</Label>
            <Button type="button" size="sm" variant="secondary" onClick={addSpec}>
              Добавить
            </Button>
          </div>
          <div className="space-y-2">
            {local.specs.map((sp) => (
              <div key={sp.id} className="rounded-xl border border-tg-border p-3 flex gap-2 bg-tg-surface/5">
                <div className="w-full">
                  <Label>Название</Label>
                  <Input value={sp.name} onChange={(e) => patchSpec(sp.id, { name: e.target.value })} />
                </div>
                <div className="w-full">
                  <Label>Значение</Label>
                  <Input value={sp.value} onChange={(e) => patchSpec(sp.id, { value: e.target.value })} />
                </div>
                <Button type="button" variant="ghost" size="sm" className="sm:col-span-1" onClick={() => delSpec(sp.id)}>
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="!mb-0">Цвета (до {MAX_SPEC})</Label>
            <Button type="button" size="sm" variant="secondary" onClick={addColor}>
              Цвет
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {local.colors.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl border border-tg-border px-2 py-1 bg-tg-surface/10">
                <input
                  type="color"
                  value={c.hex}
                  onChange={(e) => patchColor(c.id, e.target.value)}
                  className="w-9 h-9 rounded-lg border-0 cursor-pointer"
                />
                <button type="button" className="text-tg-muted hover:text-white text-lg leading-none px-1" onClick={() => delColor(c.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="!mb-0">Размеры (до {MAX_SPEC})</Label>
            <Button type="button" size="sm" variant="secondary" onClick={addSize}>
              Размер
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {local.sizes.map((z) => (
              <div key={z.id} className="flex items-center gap-1 rounded-xl border border-tg-border px-2 py-1 bg-tg-surface/10">
                <Input
                  className="!py-1.5 !px-2 min-w-[100px]"
                  placeholder="Название"
                  value={z.name}
                  onChange={(e) => patchSize(z.id, e.target.value)}
                />
                <button type="button" className="text-tg-muted hover:text-white px-1" onClick={() => delSize(z.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className={clsx('text-xs mt-2', varActive ? 'text-emerald-300/80' : 'text-amber-200/80')}>
            {varActive
              ? 'Вариативность активна: на витрине будут выбор цвета и/или размера (минимум 2 варианта суммарно).'
              : 'Добавьте минимум 2 варианта (цвета и/или размеры), иначе вариативность не отображается.'}
          </p>
        </div>

        <div>
          <Label>Фото (до {MAX_PRODUCT_IMAGES}, по 4 МБ)</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {local.imageFileIds.map((fid) => (
              <div key={fid} className="relative w-20 h-20 rounded-xl overflow-hidden border border-tg-border">
                <img src={getImagePreviewUrl(fid)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  className="absolute top-1 right-1 bg-black/65 rounded-lg px-1.5 text-xs leading-tight"
                  onClick={() => removeImg(fid)}
                >
                  ×
                </button>
              </div>
            ))}
            {local.imageFileIds.length < MAX_PRODUCT_IMAGES ? (
              <label className="w-20 h-20 rounded-xl border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/5 text-tg-muted text-2xl">
                +
                <input type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />
              </label>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-tg-border">
          <Button variant="ghost" type="button" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            type="button"
            disabled={!local.name.trim()}
            onClick={() => onSave({ ...local, name: local.name.trim() })}
          >
            Готово
          </Button>
        </div>
      </div>
    </Modal>
  );
}
