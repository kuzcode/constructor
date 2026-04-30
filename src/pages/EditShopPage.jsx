import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Settings, FolderPlus, PackagePlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Label, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { DraftActionDock } from '../components/DraftActionDock';
import { ShopCategoryTree } from '../components/shop/ShopCategoryTree';
import { ProductEditorModal } from '../components/shop/ProductEditorModal';
import {
  getAppById,
  updateAppDocument,
  deleteStorageFiles,
} from '../services/appsService';
import { createCategory, createProduct } from '../models/defaults';
import { collectDescendantIds, flattenCategoryOptions } from '../utils/shopTree';
import { SHOP_STYLE_LABELS } from '../themes/shopThemes';
import { normalizeShopPayload } from '../utils/normalizeShop';

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

async function cleanupRemovedAssets(baselineShop, draftShop) {
  const removed = baselineShop.products.filter((bp) => !draftShop.products.some((p) => p.id === bp.id));
  for (const p of removed) {
    await deleteStorageFiles(p.imageFileIds || []);
  }
  for (const bp of baselineShop.products) {
    const dp = draftShop.products.find((p) => p.id === bp.id);
    if (dp) {
      const dead = (bp.imageFileIds || []).filter((id) => !(dp.imageFileIds || []).includes(id));
      await deleteStorageFiles(dead);
    }
  }
}

export function EditShopPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catModal, setCatModal] = useState(null);
  const [productModal, setProductModal] = useState(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const d = await getAppById(id);
        if (c) return;
        if (d.ownerId !== user?.$id || d.appType !== 'shop') {
          navigate('/admin', { replace: true });
          return;
        }
        setDoc(d);
        const s = normalizeShopPayload(d.shopPayload);
        const copy = clone(s);
        setBaseline(copy);
        setDraft(clone(s));
      } catch {
        navigate('/admin', { replace: true });
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [id, user, navigate]);

  const persistDoc = useCallback(
    async (nextShop) => {
      if (!doc || !user) return;
      setSaving(true);
      try {
        const payload = {
          ownerId: user.$id,
          appType: doc.appType,
          title: doc.title,
          slug: doc.slug || '',
          published: !!doc.published,
          shopPayload: nextShop,
          freePayload: doc.appType === 'free' ? doc.freePayload ?? null : null,
          hostingPaidUntil: doc.hostingPaidUntil ?? null,
          hostingPlan: doc.hostingPlan ?? null,
        };
        await updateAppDocument(doc.$id, payload, user.$id, !!doc.published);
        setDoc({ ...doc, shopPayload: nextShop });
      } finally {
        setSaving(false);
      }
    },
    [doc, user],
  );

  const dirty = baseline && draft && JSON.stringify(baseline) !== JSON.stringify(draft);

  const handleSave = async () => {
    if (!draft || !baseline) return;
    await cleanupRemovedAssets(baseline, draft);
    await persistDoc(draft);
    setBaseline(clone(draft));
  };

  const handleCancel = () => {
    if (!baseline) return;
    setDraft(clone(baseline));
  };

  const shop = draft;

  const deleteCategory = (categoryId) => {
    if (!shop) return;
    const cat = shop.categories.find((x) => x.id === categoryId);
    if (!cat) return;
    const drop = new Set(collectDescendantIds(shop.categories, categoryId));
    const parent = cat.parentId;
    setDraft({
      ...shop,
      categories: shop.categories.filter((c) => !drop.has(c.id)),
      products: shop.products.map((p) =>
        p.categoryId && drop.has(p.categoryId) ? { ...p, categoryId: parent } : p,
      ),
    });
  };

  const deleteProduct = async (productId) => {
    if (!shop) return;
    const p = shop.products.find((x) => x.id === productId);
    if (p?.imageFileIds?.length) await deleteStorageFiles(p.imageFileIds);
    setDraft({ ...shop, products: shop.products.filter((x) => x.id !== productId) });
  };

  const categoryOptions = useMemo(() => (shop ? flattenCategoryOptions(shop.categories) : []), [shop]);

  if (loading || !doc || !shop) {
    return (
      <Layout>
        <p className="text-tg-muted text-sm">Загрузка редактора…</p>
      </Layout>
    );
  }

  return (
    <Layout title={doc.title || 'Магазин'}>
      <div className="flex flex-wrap gap-2 mb-6">
        <Link to={`/admin/apps/${doc.$id}`}>
          <Button variant="secondary" size="sm">
            Меню проекта
          </Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-4 h-4" />
          Настройки магазина
        </Button>
        {!doc.published ? (
          <Link to={`/admin/apps/${doc.$id}?publish=1`}>
            <Button size="sm" className="bg-[#3390ec] hover:bg-[#2b7fd4] text-white">
              Опубликовать
            </Button>
          </Link>
        ) : null}
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold">Каталог</h2>
            <p className="text-xs text-tg-muted mt-1">Категории и товары. Изменения фиксируются кнопкой внизу.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCatModal({ parentId: null })}>
              <FolderPlus className="w-4 h-4" />
              Категория
            </Button>
            <Button size="sm" onClick={() => setProductModal({ product: createProduct(null) })}>
              <PackagePlus className="w-4 h-4" />
              Товар
            </Button>
          </div>
        </div>
        <ShopCategoryTree
          parentId={null}
          shop={shop}
          onAddSub={(pid) => setCatModal({ parentId: pid })}
          onAddProduct={(pid) => setProductModal({ product: createProduct(pid) })}
          onEditCat={(c) => setCatModal({ category: c })}
          onEditProduct={(p) => setProductModal({ product: { ...p } })}
          onDeleteCat={deleteCategory}
          onDeleteProduct={(pid) => deleteProduct(pid)}
        />
      </Card>

      <ShopSettingsModal open={settingsOpen} shop={shop} onClose={() => setSettingsOpen(false)} onApply={(s) => setDraft(s)} />
      <CategoryModal
        open={!!catModal}
        initial={catModal}
        onClose={() => setCatModal(null)}
        onSave={(name, parentId, existingId) => {
          if (existingId) {
            setDraft({
              ...shop,
              categories: shop.categories.map((c) => (c.id === existingId ? { ...c, name } : c)),
            });
          } else {
            const nc = createCategory(name, parentId);
            setDraft({ ...shop, categories: [...shop.categories, nc] });
          }
          setCatModal(null);
        }}
      />
      <ProductEditorModal
        open={!!productModal}
        product={productModal?.product}
        categoryOptions={categoryOptions}
        onClose={() => setProductModal(null)}
        onSave={(p) => {
          const exists = shop.products.some((x) => x.id === p.id);
          setDraft({
            ...shop,
            products: exists ? shop.products.map((x) => (x.id === p.id ? p : x)) : [...shop.products, p],
          });
          setProductModal(null);
        }}
      />

      <DraftActionDock show={!!dirty} saving={saving} onSave={handleSave} onCancel={handleCancel} />
    </Layout>
  );
}

function ShopSettingsModal({ open, shop, onClose, onApply }) {
  const [local, setLocal] = useState(shop);
  useEffect(() => {
    if (open) setLocal(shop);
  }, [open, shop]);

  return (
    <Modal open={open} onClose={onClose} title="Настройки магазина" wide>
      <div className="space-y-5">
        <div>
          <Label>Стиль витрины</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {SHOP_STYLE_LABELS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setLocal({ ...local, styleId: s.id })}
                className={`rounded-2xl border p-2 text-left text-sm transition ${
                  local.styleId === s.id
                    ? 'border-[#3390ec] bg-[#3390ec]/15'
                    : 'border-tg-border bg-tg-surface hover:border-white/15'
                }`}
              >
                <div className="rounded-xl border border-white/15 bg-black/20 mb-2 p-2">
                  <div className="flex gap-1.5 mb-1.5">
                    {(s.swatches || []).map((c) => (
                      <span key={c} className="w-4 h-4 rounded-full border border-white/20" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="text-[11px] opacity-80">Font: {s.font || 'Sans'}</div>
                </div>
                <div className="font-medium leading-tight">{s.name}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Оформление заказа — запрашивать у клиента</Label>
          <div className="mt-3 space-y-2 rounded-2xl border border-tg-border bg-tg-surface/5 p-4">
            {[
              ['requireName', 'Имя'],
              ['requireAddress', 'Адрес'],
              ['requirePhone', 'Номер телефона'],
            ].map(([key, lab]) => (
              <label key={key} className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!local.checkout?.[key]}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      checkout: { ...local.checkout, [key]: e.target.checked },
                    })
                  }
                />
                {lab}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label>Название магазина</Label>
          <Input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} />
        </div>
        <div>
          <Label>Описание</Label>
          <Textarea value={local.description} onChange={(e) => setLocal({ ...local, description: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            ['phone', 'Телефон'],
            ['address', 'Адрес'],
            ['email', 'Email'],
            ['tgChannel', 'Telegram канал'],
            ['tgDm', 'Telegram личка'],
            ['instagram', 'Instagram'],
          ].map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                value={local.contacts[key] || ''}
                onChange={(e) =>
                  setLocal({
                    ...local,
                    contacts: { ...local.contacts, [key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(local);
              onClose();
            }}
          >
            Готово
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CategoryModal({ open, initial, onClose, onSave }) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!open) return;
    if (initial?.category) setName(initial.category.name);
    else setName('');
  }, [open, initial]);

  if (!initial) return null;
  const isEdit = !!initial.category;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Категория' : 'Новая категория'}>
      <div className="space-y-4">
        <div>
          <Label>Название</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              isEdit
                ? onSave(name.trim(), initial.category.parentId, initial.category.id)
                : onSave(name.trim(), initial.parentId ?? null, null)
            }
          >
            Готово
          </Button>
        </div>
      </div>
    </Modal>
  );
}
