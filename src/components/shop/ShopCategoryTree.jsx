import { ChevronRight, Folder, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import clsx from 'clsx';

export function ShopCategoryTree({
  parentId,
  shop,
  depth = 0,
  onAddSub,
  onAddProduct,
  onEditCat,
  onEditProduct,
  onDeleteCat,
  onDeleteProduct,
}) {
  const cats = shop.categories.filter((c) => c.parentId === parentId);
  const prods = shop.products.filter((p) => p.categoryId === parentId);

  if (!cats.length && !prods.length && depth > 0) return null;

  return (
    <div className={clsx('space-y-2', depth > 0 && 'mt-2 ml-0 sm:ml-3 pl-3 sm:pl-4 border-l border-[#3390ec]/25')}>
      {cats.map((c) => (
        <div key={c.id} className="rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
            <Folder className="w-4 h-4 text-[#3390ec] shrink-0 opacity-90" />
            <span className="font-medium text-[15px] flex-1 min-w-0 truncate">{c.name}</span>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="secondary" className="!px-2.5" onClick={() => onAddSub(c.id)}>
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Подкатегория</span>
              </Button>
              <Button type="button" size="sm" variant="secondary" className="!px-2.5" onClick={() => onAddProduct(c.id)}>
                <Package className="w-3.5 h-3.5" />
                Товар
              </Button>
              <Button type="button" size="sm" variant="ghost" className="!px-2.5" onClick={() => onEditCat(c)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="!px-2.5" onClick={() => onDeleteCat(c.id)}>
                <Trash2 className="w-3.5 h-3.5 text-red-300/90" />
              </Button>
            </div>
          </div>
          <div className="px-2 pb-2">
            <ShopCategoryTree
              parentId={c.id}
              shop={shop}
              depth={depth + 1}
              onAddSub={onAddSub}
              onAddProduct={onAddProduct}
              onEditCat={onEditCat}
              onEditProduct={onEditProduct}
              onDeleteCat={onDeleteCat}
              onDeleteProduct={onDeleteProduct}
            />
          </div>
        </div>
      ))}

      {prods.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2.5 hover:border-white/12 transition"
        >
          <ChevronRight className="w-4 h-4 text-white/25 shrink-0 rotate-90 sm:rotate-0" />
          <Package className="w-4 h-4 text-white/35 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{p.name || 'Без названия'}</p>
            <p className="text-[11px] text-tg-muted">
              {p.price != null ? `${p.price} ₽` : ''}
              {typeof p.stock === 'number' ? ` · остаток ${p.stock}` : ''}
            </p>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" className="!px-2.5" onClick={() => onEditProduct(p)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="!px-2.5" onClick={() => onDeleteProduct(p.id)}>
              <Trash2 className="w-3.5 h-3.5 text-red-300/90" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
