import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Braces,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Settings2,
  Type,
  Image as ImageIcon,
  MousePointer2,
  Timer,
  Layers,
  GalleryHorizontal,
  TextCursorInput,
  ListChecks,
  ChevronLeft,
} from 'lucide-react';
import clsx from 'clsx';
import { createId } from '../lib/id';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Label, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { DraftActionDock } from '../components/DraftActionDock';
import {
  getAppById,
  updateAppDocument,
  uploadImage,
  getImagePreviewUrl,
  deleteStorageFiles,
} from '../services/appsService';
import {
  newTextBlock,
  newImageBlock,
  newButtonBlock,
  newVariable,
  defaultShopPayload,
  newCountdownBlock,
  newStackBlock,
  newHScrollBlock,
  newInputBlock,
  newPollBlock,
} from '../models/defaults';
import { normalizeFreePayload } from '../utils/normalizeFree';
import {
  removeBlockDeep,
  updateBlockDeep,
  addChildBlock,
  findBlockDeep,
  collectImageFileIdsFromBlocks,
  moveBlockToRootOrParent,
  reorderSiblingsInTree,
  flattenBlocksMeta,
  isParentUnderMovingBlock,
} from '../utils/freeBlockTree';

const MAX_IMAGE = 4 * 1024 * 1024;

function freeCanvasCollision(args) {
  const hit = pointerWithin(args);
  if (hit.length) return hit;
  return closestCenter(args);
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

async function cleanupFreeAssets(baselineFree, draftFree) {
  const bBg = baselineFree.settings?.background;
  const nBg = draftFree.settings?.background;
  if (bBg?.type === 'image' && bBg.fileId && (nBg?.type !== 'image' || nBg.fileId !== bBg.fileId)) {
    await deleteStorageFiles([bBg.fileId]);
  }
  const prevImg = collectImageFileIdsFromBlocks(baselineFree.blocks || []);
  const nextImg = collectImageFileIdsFromBlocks(draftFree.blocks || []);
  for (const fid of prevImg) {
    if (!nextImg.has(fid)) await deleteStorageFiles([fid]);
  }
}

const textVariantClass = {
  heading: 'text-3xl font-bold tracking-tight',
  subheading: 'text-xl font-semibold',
  medium: 'text-lg font-medium',
  body: 'text-base leading-relaxed',
  small: 'text-sm opacity-90',
};

export function EditFreePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editTrail, setEditTrail] = useState([]);
  const [addChildParentId, setAddChildParentId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const d = await getAppById(id);
        if (c) return;
        if (d.ownerId !== user?.$id || d.appType !== 'free') {
          navigate('/admin', { replace: true });
          return;
        }
        setDoc(d);
        const f = normalizeFreePayload(d.freePayload);
        const copy = clone(f);
        setBaseline(copy);
        setDraft(clone(f));
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

  const persist = useCallback(
    async (next) => {
      if (!doc || !user) return;
      setSaving(true);
      try {
        const payload = {
          ownerId: user.$id,
          appType: doc.appType,
          title: doc.title,
          slug: doc.slug || '',
          published: !!doc.published,
          shopPayload: doc.appType === 'shop' ? doc.shopPayload ?? defaultShopPayload() : null,
          freePayload: next,
          hostingPaidUntil: doc.hostingPaidUntil ?? null,
          hostingPlan: doc.hostingPlan ?? null,
        };
        await updateAppDocument(doc.$id, payload, user.$id, !!doc.published);
        setDoc({ ...doc, freePayload: next });
      } finally {
        setSaving(false);
      }
    },
    [doc, user],
  );

  const dirty = baseline && draft && JSON.stringify(baseline) !== JSON.stringify(draft);

  const handleSave = async () => {
    if (!draft || !baseline) return;
    await cleanupFreeAssets(baseline, draft);
    await persist(draft);
    setBaseline(clone(draft));
  };

  const handleCancel = () => {
    if (!baseline) return;
    setDraft(clone(baseline));
  };

  const free = draft;
  const draftRef = useRef(null);
  draftRef.current = free;

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || !free) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (overId.startsWith('nest-')) {
      const parentId = overId.slice(5);
      if (activeId === parentId) return;
      setDraft((d) => ({
        ...d,
        blocks: moveBlockToRootOrParent(d.blocks, activeId, parentId),
      }));
      return;
    }

    const reordered = reorderSiblingsInTree(free.blocks, activeId, overId);
    if (reordered) {
      setDraft({ ...free, blocks: reordered });
    }
  };

  const openEdit = (block) => {
    setEditing(block);
    setEditTrail([]);
    setEditOpen(true);
  };

  const drillEditChild = (parentSnap, child) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, blocks: updateBlockDeep(prev.blocks, parentSnap.id, parentSnap) };
    });
    setEditTrail((t) => [...t, parentSnap.id]);
    setEditing(child);
  };

  const goBackEdit = () => {
    setEditTrail((t) => {
      if (!t.length) return t;
      const n = [...t];
      const showId = n.pop();
      queueMicrotask(() => {
        const b = findBlockDeep(draftRef.current?.blocks || [], showId);
        if (b) setEditing(b);
      });
      return n;
    });
  };

  const removeBlock = async (bid) => {
    if (!free) return;
    const b = findBlockDeep(free.blocks, bid);
    if (b?.type === 'image' && b.fileId) await deleteStorageFiles([b.fileId]);
    setDraft({ ...free, blocks: removeBlockDeep(free.blocks, bid) });
  };

  const blockSummaries = useMemo(() => {
    const walk = (blocks, depth = 0) => {
      const out = [];
      for (const b of blocks || []) {
        let label = 'Блок';
        if (b.type === 'text') label = (b.content || 'Текст').slice(0, 40);
        else if (b.type === 'image') label = 'Изображение';
        else if (b.type === 'button') label = b.label || 'Кнопка';
        else if (b.type === 'countdown') label = 'Таймер';
        else if (b.type === 'stack') label = `Контейнер (${(b.children || []).length})`;
        else if (b.type === 'hscroll') label = `Скролл (${(b.children || []).length})`;
        else if (b.type === 'input') label = 'Ввод';
        else if (b.type === 'poll') label = (b.question || 'Опрос').slice(0, 36);
        out.push({ id: b.id, label, type: b.type, depth });
        if (b.children?.length) out.push(...walk(b.children, depth + 1));
      }
      return out;
    };
    return walk(free?.blocks || []);
  }, [free?.blocks]);

  if (loading || !doc || !free) {
    return (
      <Layout>
        <p className="text-tg-muted text-sm">Загрузка…</p>
      </Layout>
    );
  }

  return (
    <Layout title={doc.title || 'Страница'}>
      <div className="flex flex-wrap gap-2 mb-4">
        <Link to={`/admin/apps/${doc.$id}`}>
          <Button variant="secondary" size="sm">
            Меню проекта
          </Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="w-4 h-4" />
          Общие настройки
        </Button>
        {!doc.published ? (
          <Link to={`/admin/apps/${doc.$id}?publish=1`}>
            <Button size="sm" className="bg-[#3390ec] hover:bg-[#2b7fd4] text-white">
              Опубликовать
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <Card className="min-h-[420px] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-gradient-to-b from-white/[0.03] to-transparent" />
          <div className="relative z-10">
            <p className="text-sm text-tg-muted mb-4">Холст страницы</p>
            {free.blocks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-tg-muted text-sm">
                Пусто — добавьте блок
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={freeCanvasCollision} onDragEnd={onDragEnd}>
                <SortableContext items={free.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {free.blocks.map((b) => (
                      <CanvasBlockRow key={b.id} block={b} depth={0} openEditor={openEdit} onRemove={removeBlock} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </Card>

        <div className="space-y-3 lg:sticky lg:top-24">
          <Button className="w-full" onClick={() => setPickerOpen(true)}>
            <Plus className="w-4 h-4" />
            Добавить блок
          </Button>
          <Card className="!p-4">
            <p className="text-xs font-medium text-tg-muted mb-2">Порядок</p>
            <ul className="space-y-1 text-sm text-white/80">
              {blockSummaries.map((s, i) => (
                <li key={s.id} className="flex gap-2" style={{ paddingLeft: s.depth ? s.depth * 10 : 0 }}>
                  <span className="text-tg-muted w-5 shrink-0">{i + 1}.</span>
                  <span className="truncate">{s.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <BlockPickerModal
        open={pickerOpen}
        onClose={() => {
          setAddChildParentId(null);
          setPickerOpen(false);
        }}
        onPick={(kind) => {
          let b;
          if (kind === 'text') b = newTextBlock();
          else if (kind === 'image') b = newImageBlock();
          else if (kind === 'button') b = newButtonBlock();
          else if (kind === 'countdown') b = newCountdownBlock();
          else if (kind === 'stack') b = newStackBlock();
          else if (kind === 'hscroll') b = newHScrollBlock();
          else if (kind === 'input') b = newInputBlock();
          else b = newPollBlock();
          if (addChildParentId) {
            setDraft({ ...free, blocks: addChildBlock(free.blocks, addChildParentId, b) });
            setAddChildParentId(null);
          } else {
            setDraft({ ...free, blocks: [...free.blocks, b] });
          }
          setPickerOpen(false);
          setEditing(b);
          setEditOpen(true);
        }}
      />

      <FreeSettingsModal
        open={settingsOpen}
        free={free}
        onClose={() => setSettingsOpen(false)}
        onApply={(next) => {
          setDraft(next);
          setSettingsOpen(false);
        }}
      />

      <BlockEditModal
        open={editOpen}
        block={editing}
        rootBlocks={free.blocks}
        variables={free.variables}
        canGoBack={editTrail.length > 0}
        onBack={goBackEdit}
        onDrillChild={(parentSnap, child) => drillEditChild(parentSnap, child)}
        onAddChild={(parentId) => {
          setAddChildParentId(parentId);
          setPickerOpen(true);
        }}
        onMoveIntoContainer={(movingId, containerLocal) => {
          setDraft((prev) => {
            if (!prev) return prev;
            let blocks = updateBlockDeep(prev.blocks, containerLocal.id, containerLocal);
            blocks = moveBlockToRootOrParent(blocks, movingId, containerLocal.id);
            const fresh = findBlockDeep(blocks, containerLocal.id);
            if (fresh) {
              queueMicrotask(() => setEditing(JSON.parse(JSON.stringify(fresh))));
            }
            return { ...prev, blocks };
          });
        }}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
          setEditTrail([]);
        }}
        onSave={(b) => {
          setDraft({ ...free, blocks: updateBlockDeep(free.blocks, b.id, b) });
          setEditOpen(false);
          setEditing(null);
          setEditTrail([]);
        }}
        onDelete={async (bid) => {
          await removeBlock(bid);
          setEditOpen(false);
          setEditing(null);
          setEditTrail([]);
        }}
      />

      <DraftActionDock show={!!dirty} saving={saving} onSave={handleSave} onCancel={handleCancel} />
    </Layout>
  );
}

function CanvasBlockRow({ block, depth, openEditor, onRemove }) {
  const isContainer = block.type === 'stack' || block.type === 'hscroll';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `nest-${block.id}`,
    disabled: !isContainer,
  });
  const mergedRef = (el) => {
    setNodeRef(el);
    if (isContainer) setDropRef(el);
  };
  const style = { transform: CSS.Transform.toString(transform), transition };
  const children = block.children || [];

  return (
    <div className={clsx('space-y-2', depth > 0 && 'ml-3 pl-3 border-l border-white/10')}>
      <div
        ref={mergedRef}
        style={style}
        className={clsx(
          'flex gap-2 items-stretch',
          isDragging && 'opacity-60',
          isContainer && isOver && 'ring-2 ring-[#3390ec]/40 rounded-2xl',
        )}
      >
        <button
          type="button"
          className="shrink-0 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center tap-highlight-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-tg-muted" />
        </button>
        <div className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {block.type === 'text' ? (
              <p
                className={clsx(
                  'whitespace-pre-wrap break-words',
                  textVariantClass[block.textVariant] || textVariantClass.body,
                  block.align === 'center' && 'text-center',
                  block.align === 'right' && 'text-right',
                )}
                style={{ color: block.color }}
              >
                {block.content || '…'}
              </p>
            ) : null}
            {block.type === 'image' ? (
              <div className="rounded-xl overflow-hidden bg-black/20 aspect-[21/9] max-h-28">
                {block.fileId ? (
                  <img src={getImagePreviewUrl(block.fileId)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-tg-muted">Нет фото</div>
                )}
              </div>
            ) : null}
            {block.type === 'button' ? (
              <span
                className="inline-flex px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: block.bgColor, color: block.textColor }}
              >
                {block.label}
              </span>
            ) : null}
            {block.type === 'countdown' ? (
              <p className="text-sm text-tg-muted">
                Таймер · {block.mode === 'session' ? `с сессии ${block.sessionSeconds}s` : 'до даты'}
              </p>
            ) : null}
            {block.type === 'stack' ? (
              <p className="text-sm text-tg-muted">Контейнер · {(block.children || []).length} вложений</p>
            ) : null}
            {block.type === 'hscroll' ? (
              <p className="text-sm text-tg-muted">Гориз. скролл · {(block.children || []).length} вложений</p>
            ) : null}
            {block.type === 'input' ? <p className="text-sm text-tg-muted">Поле ввода</p> : null}
            {block.type === 'poll' ? (
              <p className="text-sm text-tg-muted line-clamp-2">Опрос: {block.question}</p>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" type="button" onClick={() => openEditor(block)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => onRemove(block.id)}>
            <Trash2 className="w-4 h-4 text-red-300/90" />
          </Button>
        </div>
      </div>
      {isContainer ? (
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div
            className={clsx(
              'space-y-2',
              children.length === 0 && 'min-h-[52px] rounded-2xl border border-dashed border-white/15 flex items-center px-3',
            )}
          >
            {children.length === 0 ? (
              <p className="text-xs text-tg-muted">Перетащите сюда блок с холста</p>
            ) : (
              children.map((c) => (
                <CanvasBlockRow key={c.id} block={c} depth={depth + 1} openEditor={openEditor} onRemove={onRemove} />
              ))
            )}
          </div>
        </SortableContext>
      ) : null}
    </div>
  );
}

function BlockPickerModal({ open, onClose, onPick }) {
  const items = [
    { id: 'text', title: 'Текст', icon: Type, desc: 'Заголовки и абзацы' },
    { id: 'image', title: 'Картинка', icon: ImageIcon, desc: 'На всю ширину' },
    { id: 'button', title: 'Кнопка', icon: MousePointer2, desc: 'Ссылка, переменная, админу' },
    { id: 'countdown', title: 'Таймер', icon: Timer, desc: 'Обратный отсчёт' },
    { id: 'stack', title: 'Блок', icon: Layers, desc: 'Колонка или ряд' },
    { id: 'hscroll', title: 'Скролл', icon: GalleryHorizontal, desc: 'Горизонтально' },
    { id: 'input', title: 'Ввод', icon: TextCursorInput, desc: 'Текст или число' },
    { id: 'poll', title: 'Опрос', icon: ListChecks, desc: 'Опрос или викторина' },
  ];
  return (
    <Modal open={open} onClose={onClose} title="Добавить блок" wide stackOrder={160}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
        <AnimatePresence>
          {items.map((it, i) => (
            <motion.button
              key={it.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 400, damping: 28 }}
              onClick={() => onPick(it.id)}
              className="text-left rounded-2xl border border-tg-border bg-tg-surface p-4 hover:border-[#3390ec]/45 hover:bg-[#3390ec]/10 transition group"
            >
              <it.icon className="w-6 h-6 text-[#3390ec] mb-2 group-hover:scale-105 transition-transform" />
              <p className="font-medium">{it.title}</p>
              <p className="text-xs text-tg-muted mt-1">{it.desc}</p>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

function FreeSettingsModal({ open, free, onClose, onApply }) {
  const [local, setLocal] = useState(free);
  const [imgErr, setImgErr] = useState('');

  useEffect(() => {
    if (open) {
      setLocal(free);
      setImgErr('');
    }
  }, [open, free]);

  const bg = local.settings?.background || { type: 'color', color: '#0a0a0f' };

  const setBg = (patch) => {
    setLocal({
      ...local,
      settings: { ...local.settings, background: { ...bg, ...patch } },
    });
  };

  const uploadBg = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE) {
      setImgErr('До 4 МБ');
      return;
    }
    try {
      const prev = bg.type === 'image' ? bg.fileId : null;
      const f = await uploadImage(file);
      if (prev) await deleteStorageFiles([prev]);
      setBg({ type: 'image', fileId: f.$id, mode: bg.mode || 'fixed' });
      setImgErr('');
    } catch (ex) {
      setImgErr(ex.message);
    }
  };

  const addVar = () => setLocal({ ...local, variables: [...local.variables, newVariable()] });
  const patchVar = (id, patch) => {
    setLocal({
      ...local,
      variables: local.variables.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });
  };
  const delVar = (id) => setLocal({ ...local, variables: local.variables.filter((v) => v.id !== id) });

  return (
    <Modal open={open} onClose={onClose} title="Общие настройки" wide>
      <div className="space-y-6">
        <div>
          <Label>Фон страницы</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              ['color', 'Цвет'],
              ['gradient', 'Градиент'],
              ['image', 'Картинка'],
            ].map(([t, lab]) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (t === 'color') setBg({ type: 'color', color: bg.color || '#0a0a0f' });
                  if (t === 'gradient')
                    setBg({ type: 'gradient', from: '#1a1a2e', to: '#0a0a0f', angle: 160 });
                  if (t === 'image') setBg({ type: 'image', fileId: bg.fileId || '', mode: bg.mode || 'fixed' });
                }}
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm border',
                  bg.type === t ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                )}
              >
                {lab}
              </button>
            ))}
          </div>
        </div>
        {bg.type === 'color' ? (
          <div className="flex items-center gap-3">
            <input type="color" value={bg.color || '#0a0a0f'} onChange={(e) => setBg({ color: e.target.value })} />
            <Input value={bg.color} onChange={(e) => setBg({ color: e.target.value })} />
          </div>
        ) : null}
        {bg.type === 'gradient' ? (
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>От</Label>
              <Input value={bg.from} onChange={(e) => setBg({ from: e.target.value })} />
            </div>
            <div>
              <Label>До</Label>
              <Input value={bg.to} onChange={(e) => setBg({ to: e.target.value })} />
            </div>
            <div>
              <Label>Угол °</Label>
              <Input type="number" value={bg.angle} onChange={(e) => setBg({ angle: Number(e.target.value) })} />
            </div>
          </div>
        ) : null}
        {bg.type === 'image' ? (
          <div className="space-y-3">
            {imgErr ? <p className="text-xs text-red-300">{imgErr}</p> : null}
            <Label>Файл (до 4 МБ)</Label>
            <input type="file" accept="image/*" onChange={uploadBg} />
            {bg.fileId ? (
              <img src={getImagePreviewUrl(bg.fileId)} alt="" className="rounded-xl max-h-36 object-cover w-full" />
            ) : null}
            <div className="flex gap-2">
              {['fixed', 'parallax'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBg({ mode: m })}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-sm border capitalize',
                    bg.mode === m ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                  )}
                >
                  {m === 'fixed' ? 'Фиксированный' : 'Параллакс'}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-tg-border bg-tg-surface/5 p-4 space-y-3">
          <Label className="mb-0">Доп. возможности страницы</Label>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!local.settings?.showProgressBar}
              onChange={(e) =>
                setLocal({
                  ...local,
                  settings: { ...local.settings, showProgressBar: e.target.checked },
                })
              }
            />
            Показывать индикатор прокрутки сверху
          </label>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!local.settings?.floatingButton?.enabled}
              onChange={(e) =>
                setLocal({
                  ...local,
                  settings: {
                    ...local.settings,
                    floatingButton: { ...(local.settings?.floatingButton || {}), enabled: e.target.checked },
                  },
                })
              }
            />
            Плавающая кнопка действия
          </label>
          {local.settings?.floatingButton?.enabled ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Текст кнопки</Label>
                <Input
                  value={local.settings?.floatingButton?.label || ''}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      settings: {
                        ...local.settings,
                        floatingButton: { ...(local.settings?.floatingButton || {}), label: e.target.value },
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label>Ссылка</Label>
                <Input
                  value={local.settings?.floatingButton?.url || ''}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      settings: {
                        ...local.settings,
                        floatingButton: { ...(local.settings?.floatingButton || {}), url: e.target.value },
                      },
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-[#3390ec]/20 bg-gradient-to-br from-[#3390ec]/[0.08] to-violet-500/[0.05] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Переменные страницы</h3>
              <p className="text-xs text-tg-muted mt-1">Используйте в тексте как {'{имя}'}, кнопки могут менять значения.</p>
            </div>
            <Button type="button" size="sm" onClick={addVar}>
              <Plus className="w-4 h-4" />
              Новая переменная
            </Button>
          </div>
          <div className="space-y-3">
            {local.variables.length === 0 ? (
              <p className="text-sm text-tg-muted text-center py-6 border border-dashed border-white/10 rounded-2xl">
                Пока нет переменных
              </p>
            ) : null}
            {local.variables.map((v) => (
              <div
                key={v.id}
                className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm p-4 grid sm:grid-cols-12 gap-3 items-start"
              >
                <div className="sm:col-span-5">
                  <Label>Имя (в тексте: {'{' + (v.name || 'имя') + '}'})</Label>
                  <Input
                    className="mt-1"
                    value={v.name}
                    onChange={(e) => patchVar(v.id, { name: e.target.value })}
                    placeholder="например, discount"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label>Тип</Label>
                  <select
                    className="mt-1 w-full rounded-xl bg-tg-bg border border-tg-border px-3 py-3 text-[15px] text-white"
                    value={v.varType}
                    onChange={(e) => patchVar(v.id, { varType: e.target.value })}
                  >
                    <option value="text">Текст</option>
                    <option value="number">Число</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <Label>Начальное значение</Label>
                  <Input
                    className="mt-1"
                    value={v.initialValue}
                    onChange={(e) => patchVar(v.id, { initialValue: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-12 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => delVar(v.id)}>
                    Удалить переменную
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Закрыть
          </Button>
          <Button type="button" onClick={() => onApply(local)}>
            Готово
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function insertVarBrace(content, varName) {
  const n = (varName || '').trim();
  if (!n) return content;
  const token = `{${n}}`;
  return `${content || ''}${content ? ' ' : ''}${token}`;
}

function blockTypeTitle(t) {
  const m = {
    text: 'Текст',
    image: 'Картинка',
    button: 'Кнопка',
    countdown: 'Таймер',
    stack: 'Блок-контейнер',
    hscroll: 'Горизонтальный скролл',
    input: 'Поле ввода',
    poll: 'Опрос',
  };
  return m[t] || 'Блок';
}

function BlockEditModal({
  open,
  block,
  rootBlocks,
  variables,
  onClose,
  onSave,
  onDelete,
  canGoBack,
  onBack,
  onDrillChild,
  onAddChild,
  onMoveIntoContainer,
}) {
  const [local, setLocal] = useState(null);
  const [err, setErr] = useState('');
  const [varMenu, setVarMenu] = useState(false);

  useEffect(() => {
    if (open && block) {
      setLocal(JSON.parse(JSON.stringify(block)));
      setErr('');
      setVarMenu(false);
    }
  }, [open, block]);

  const moveIntoOptions = useMemo(() => {
    if (!local || !rootBlocks || !onMoveIntoContainer || (local.type !== 'stack' && local.type !== 'hscroll')) return [];
    const childIds = new Set((local.children || []).map((c) => c.id));
    return flattenBlocksMeta(rootBlocks).filter((x) => {
      if (x.id === local.id) return false;
      if (childIds.has(x.id)) return false;
      if (isParentUnderMovingBlock(rootBlocks, x.id, local.id)) return false;
      return true;
    });
  }, [local, rootBlocks, onMoveIntoContainer]);

  if (!open || !local) return null;

  const selectedVar = variables.find((v) => v.id === local.action?.variableId);

  const varActionBase = () =>
    local.action?.kind === 'variable'
      ? {
          kind: 'variable',
          variableId: local.action.variableId || variables[0]?.id || '',
          numberOp: local.action.numberOp || 'add',
          numberValue: Number(local.action.numberValue) || 1,
          textValue: local.action.textValue ?? '',
        }
      : {
          kind: 'variable',
          variableId: variables[0]?.id || '',
          numberOp: 'add',
          numberValue: 1,
          textValue: '',
        };

  const notifyActionBase = () => ({
    kind: 'notifyAdmin',
    messageTemplate: local.action?.kind === 'notifyAdmin' ? local.action.messageTemplate ?? '' : '',
  });

  const uploadImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE) {
      setErr('До 4 МБ');
      return;
    }
    try {
      const prev = local.fileId;
      const f = await uploadImage(file);
      if (prev) await deleteStorageFiles([prev]);
      setLocal({ ...local, fileId: f.$id });
      setErr('');
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={blockTypeTitle(local.type)} wide stackOrder={120}>
      {err ? <p className="text-sm text-red-300 mb-2">{err}</p> : null}
      {canGoBack ? (
        <Button type="button" variant="ghost" size="sm" className="mb-3 -mt-1" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" />
          Назад к контейнеру
        </Button>
      ) : null}
      {local.type === 'text' ? (
        <div className="space-y-4">
          <div>
            <Label>Выравнивание</Label>
            <div className="flex gap-2 mt-2">
              {['left', 'center', 'right'].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setLocal({ ...local, align: a })}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-sm capitalize border',
                    local.align === a ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                  )}
                >
                  {a === 'left' ? 'Лево' : a === 'center' ? 'Центр' : 'Право'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Тип текста</Label>
            <select
              className="mt-2 w-full rounded-xl bg-tg-surface border border-tg-border px-3 py-3 text-[15px]"
              value={local.textVariant}
              onChange={(e) => setLocal({ ...local, textVariant: e.target.value })}
            >
              {[
                ['heading', 'Заголовок'],
                ['subheading', 'Подзаголовок'],
                ['medium', 'Средний'],
                ['body', 'Текст'],
                ['small', 'Мелкий'],
              ].map(([v, lab]) => (
                <option key={v} value={v}>
                  {lab}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Цвет</Label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="color"
                value={local.color?.startsWith('#') ? local.color : '#ffffff'}
                onChange={(e) => setLocal({ ...local, color: e.target.value })}
              />
              <Input value={local.color} onChange={(e) => setLocal({ ...local, color: e.target.value })} />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <Label className="!mb-0">Текст</Label>
              <div className="relative">
                <Button type="button" size="sm" variant="secondary" onClick={() => setVarMenu(!varMenu)}>
                  <Braces className="w-4 h-4" />
                  Вставить переменную
                </Button>
                {varMenu ? (
                  <div className="absolute right-0 top-full mt-1 z-20 min-w-[200px] rounded-xl border border-tg-border bg-tg-bg shadow-xl py-1 max-h-48 overflow-y-auto">
                    {variables.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-tg-muted">Сначала создайте переменные в настройках</p>
                    ) : (
                      variables.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                          onClick={() => {
                            setLocal({ ...local, content: insertVarBrace(local.content, v.name) });
                            setVarMenu(false);
                          }}
                        >
                          {'{' + v.name + '}'}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <Textarea
              value={local.content}
              onChange={(e) => setLocal({ ...local, content: e.target.value })}
              className={clsx(
                textVariantClass[local.textVariant],
                local.align === 'center' && 'text-center',
                local.align === 'right' && 'text-right',
              )}
              style={{ color: local.color }}
            />
            <p className="text-[11px] text-tg-muted mt-1">На странице подставится значение переменной с таким именем.</p>
          </div>
        </div>
      ) : null}

      {local.type === 'image' ? (
        <div className="space-y-4">
          <Label>Файл до 4 МБ</Label>
          <input type="file" accept="image/*" onChange={uploadImageFile} />
          {local.fileId ? (
            <img src={getImagePreviewUrl(local.fileId)} alt="" className="rounded-2xl w-full max-h-56 object-cover" />
          ) : null}
        </div>
      ) : null}

      {local.type === 'button' ? (
        <div className="space-y-4">
          <div>
            <Label>Текст кнопки</Label>
            <Input value={local.label} onChange={(e) => setLocal({ ...local, label: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Фон</Label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  value={local.bgColor?.startsWith('#') ? local.bgColor : '#3390ec'}
                  onChange={(e) => setLocal({ ...local, bgColor: e.target.value })}
                />
                <Input value={local.bgColor} onChange={(e) => setLocal({ ...local, bgColor: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Цвет текста</Label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  value={local.textColor?.startsWith('#') ? local.textColor : '#ffffff'}
                  onChange={(e) => setLocal({ ...local, textColor: e.target.value })}
                />
                <Input value={local.textColor} onChange={(e) => setLocal({ ...local, textColor: e.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <Label>Действие</Label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setLocal({ ...local, action: { kind: 'link', url: local.action?.url || 'https://' } })}
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm border',
                  local.action?.kind === 'link' ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                )}
              >
                Ссылка
              </button>
              <button
                type="button"
                onClick={() =>
                  setLocal({
                    ...local,
                    action: varActionBase(),
                  })
                }
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm border',
                  local.action?.kind === 'variable' ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                )}
              >
                Переменная
              </button>
              <button
                type="button"
                onClick={() =>
                  setLocal({
                    ...local,
                    action: notifyActionBase(),
                  })
                }
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm border',
                  local.action?.kind === 'notifyAdmin'
                    ? 'border-[#3390ec] bg-[#3390ec]/15'
                    : 'border-tg-border bg-tg-surface',
                )}
              >
                Админу
              </button>
            </div>
            {local.action?.kind === 'link' ? (
              <Input
                className="mt-2"
                value={local.action.url}
                onChange={(e) => setLocal({ ...local, action: { kind: 'link', url: e.target.value } })}
              />
            ) : null}
            {local.action?.kind === 'variable' ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-tg-border bg-tg-surface/50 p-4">
                {variables.length === 0 ? (
                  <p className="text-sm text-amber-200/90">Добавьте переменные в «Общие настройки».</p>
                ) : null}
                <div>
                  <Label>Переменная</Label>
                  <select
                    className="mt-1 w-full rounded-xl bg-tg-bg border border-tg-border px-3 py-3 text-[15px]"
                    value={local.action.variableId}
                    onChange={(e) =>
                      setLocal({
                        ...local,
                        action: { ...varActionBase(), variableId: e.target.value },
                      })
                    }
                  >
                    {variables.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.varType})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedVar?.varType === 'number' ? (
                  <div className="space-y-2">
                    <Label>Операция с числом</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['add', 'Прибавить'],
                        ['sub', 'Отнять'],
                        ['set', 'Задать'],
                      ].map(([op, lab]) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() =>
                            setLocal({
                              ...local,
                              action: { ...varActionBase(), numberOp: op },
                            })
                          }
                          className={clsx(
                            'px-3 py-2 rounded-xl text-sm border',
                            local.action.numberOp === op
                              ? 'border-[#3390ec] bg-[#3390ec]/15'
                              : 'border-tg-border bg-tg-surface',
                          )}
                        >
                          {lab}
                        </button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      step="any"
                      value={local.action.numberValue ?? 1}
                      onChange={(e) =>
                        setLocal({
                          ...local,
                          action: {
                            ...varActionBase(),
                            numberValue: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                ) : null}
                {selectedVar?.varType === 'text' ? (
                  <div>
                    <Label>Задать значение</Label>
                    <Input
                      className="mt-1"
                      value={local.action.textValue ?? ''}
                      onChange={(e) =>
                        setLocal({
                          ...local,
                          action: { ...varActionBase(), textValue: e.target.value },
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            {local.action?.kind === 'notifyAdmin' ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-tg-border bg-tg-surface/50 p-4">
                <Label>Текст уведомления</Label>
                <Textarea
                  rows={10}
                  className="font-mono text-sm min-h-[200px]"
                  placeholder="Например: Заявка от {name}, телефон {phone}"
                  value={local.action.messageTemplate ?? ''}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      action: { ...notifyActionBase(), messageTemplate: e.target.value },
                    })
                  }
                />
                <p className="text-[11px] text-tg-muted">
                  Подставьте переменные как {'{имя}'} из общих настроек страницы.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {local.type === 'countdown' ? (
        <div className="space-y-4">
          <div>
            <Label>Режим</Label>
            <div className="flex gap-2 mt-2">
              {[
                ['until', 'До даты и времени'],
                ['session', 'С открытия страницы'],
              ].map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLocal({ ...local, mode: k })}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-sm border',
                    local.mode === k ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                  )}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
          {local.mode === 'until' ? (
            <div>
              <Label>Дата и время (локально)</Label>
              <Input
                type="datetime-local"
                className="mt-1"
                value={local.untilIso ? local.untilIso.slice(0, 16) : ''}
                onChange={(e) => setLocal({ ...local, untilIso: new Date(e.target.value).toISOString() })}
              />
            </div>
          ) : (
            <div>
              <Label>Секунд с момента открытия</Label>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={local.sessionSeconds ?? 3600}
                onChange={(e) => setLocal({ ...local, sessionSeconds: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          )}
          <div>
            <Label>Подпись (необязательно)</Label>
            <Input value={local.label || ''} onChange={(e) => setLocal({ ...local, label: e.target.value })} />
          </div>
          <div>
            <Label>Цвет текста</Label>
            <div className="flex gap-2 items-center mt-1">
              <input
                type="color"
                value={local.textColor?.startsWith('#') ? local.textColor : '#ffffff'}
                onChange={(e) => setLocal({ ...local, textColor: e.target.value })}
              />
              <Input value={local.textColor} onChange={(e) => setLocal({ ...local, textColor: e.target.value })} />
            </div>
          </div>
        </div>
      ) : null}

      {local.type === 'stack' ? (
        <div className="space-y-4">
          <div>
            <Label>Расположение вложений</Label>
            <div className="flex gap-2 mt-2">
              {[
                ['column', 'Колонка'],
                ['row', 'В ряд'],
              ].map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLocal({ ...local, layout: k })}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-sm border',
                    local.layout === k ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                  )}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Фон</Label>
            <div className="flex flex-wrap gap-2 items-center mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={local.bgColor === 'transparent'}
                  onChange={(e) =>
                    setLocal({ ...local, bgColor: e.target.checked ? 'transparent' : 'rgba(255,255,255,0.06)' })
                  }
                />
                Прозрачный
              </label>
              {local.bgColor !== 'transparent' ? (
                <>
                  <input
                    type="color"
                    value={local.bgColor?.startsWith('#') ? local.bgColor : '#1a1a24'}
                    onChange={(e) => setLocal({ ...local, bgColor: e.target.value })}
                  />
                  <Input value={local.bgColor} onChange={(e) => setLocal({ ...local, bgColor: e.target.value })} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {local.type === 'hscroll' ? (
        <div>
          <Label>Отступ между элементами (px)</Label>
          <Input
            type="number"
            min={0}
            className="mt-1"
            value={local.gap ?? 12}
            onChange={(e) => setLocal({ ...local, gap: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      ) : null}

      {local.type === 'input' ? (
        <div className="space-y-4">
          <div>
            <Label>Тип поля</Label>
            <select
              className="mt-2 w-full rounded-xl bg-tg-surface border border-tg-border px-3 py-3 text-[15px]"
              value={local.inputType || 'text'}
              onChange={(e) => setLocal({ ...local, inputType: e.target.value })}
            >
              <option value="text">Текст</option>
              <option value="number">Число</option>
            </select>
          </div>
          <div>
            <Label>Переменная</Label>
            <select
              className="mt-1 w-full rounded-xl bg-tg-bg border border-tg-border px-3 py-3 text-[15px]"
              value={local.variableId || ''}
              onChange={(e) => setLocal({ ...local, variableId: e.target.value })}
            >
              <option value="">— выберите —</option>
              {variables.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.varType})
                </option>
              ))}
            </select>
            {(() => {
              const v = variables.find((x) => x.id === local.variableId);
              if (!v || !local.inputType) return null;
              if (local.inputType === 'number' && v.varType === 'text') {
                return <p className="text-xs text-amber-200 mt-1">Числовое поле с текстовой переменной — значение сохранится как текст.</p>;
              }
              if (local.inputType === 'text' && v.varType === 'number') {
                return <p className="text-xs text-amber-200 mt-1">Текстовое поле с числовой переменной — вводите только числа для согласованности.</p>;
              }
              return null;
            })()}
          </div>
          <div>
            <Label>Подсказка</Label>
            <Input value={local.placeholder || ''} onChange={(e) => setLocal({ ...local, placeholder: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Фон</Label>
              <div className="flex flex-wrap gap-2 items-center mt-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={local.bgColor === 'transparent'}
                    onChange={(e) =>
                      setLocal({ ...local, bgColor: e.target.checked ? 'transparent' : 'rgba(255,255,255,0.08)' })
                    }
                  />
                  Прозрачный
                </label>
              </div>
              {local.bgColor !== 'transparent' ? (
                <div className="flex gap-2 items-center mt-1">
                  <input
                    type="color"
                    value={local.bgColor?.startsWith('#') ? local.bgColor : '#ffffff'}
                    onChange={(e) => setLocal({ ...local, bgColor: e.target.value })}
                  />
                  <Input value={local.bgColor} onChange={(e) => setLocal({ ...local, bgColor: e.target.value })} />
                </div>
              ) : null}
            </div>
            <div>
              <Label>Цвет текста</Label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  value={local.textColor?.startsWith('#') ? local.textColor : '#ffffff'}
                  onChange={(e) => setLocal({ ...local, textColor: e.target.value })}
                />
                <Input value={local.textColor} onChange={(e) => setLocal({ ...local, textColor: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {local.type === 'poll' ? (
        <div className="space-y-4">
          <div>
            <Label>Вопрос</Label>
            <Input value={local.question || ''} onChange={(e) => setLocal({ ...local, question: e.target.value })} />
          </div>
          <div>
            <Label>Режим</Label>
            <div className="flex gap-2 mt-2">
              {[
                ['survey', 'Опрос'],
                ['quiz', '1 верный ответ'],
              ].map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLocal({ ...local, mode: k })}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-sm border',
                    local.mode === k ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-tg-border bg-tg-surface',
                  )}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!local.notifyAdmin}
              onChange={(e) => setLocal({ ...local, notifyAdmin: e.target.checked })}
            />
            Отправить результат админу (Telegram при настройке + всегда в БД)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Фон варианта</Label>
              <Input value={local.optBg || ''} onChange={(e) => setLocal({ ...local, optBg: e.target.value })} />
            </div>
            <div>
              <Label>Фон выбранного</Label>
              <Input value={local.optSelectedBg || ''} onChange={(e) => setLocal({ ...local, optSelectedBg: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Варианты</Label>
            <div className="space-y-2 mt-2">
              {(local.options || []).map((o, idx) => (
                <div key={o.id} className="flex flex-wrap gap-2 items-center rounded-xl border border-white/10 p-2">
                  <Input
                    className="flex-1 min-w-[120px]"
                    value={o.label}
                    onChange={(e) => {
                      const opts = [...(local.options || [])];
                      opts[idx] = { ...o, label: e.target.value };
                      setLocal({ ...local, options: opts });
                    }}
                  />
                  {local.mode === 'quiz' ? (
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input
                        type="radio"
                        name={`correct-${local.id}`}
                        checked={!!o.correct}
                        onChange={() => {
                          const opts = (local.options || []).map((x) => ({ ...x, correct: x.id === o.id }));
                          setLocal({ ...local, options: opts });
                        }}
                      />
                      верный
                    </label>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setLocal({
                        ...local,
                        options: (local.options || []).filter((x) => x.id !== o.id),
                      })
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setLocal({
                    ...local,
                    options: [...(local.options || []), { id: createId(), label: 'Вариант', correct: false }],
                  })
                }
              >
                Добавить вариант
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {(local.type === 'stack' || local.type === 'hscroll') && onDrillChild && onAddChild ? (
        <div className="space-y-3 mt-4 rounded-2xl border border-tg-border bg-tg-surface/30 p-4">
          {moveIntoOptions.length > 0 && onMoveIntoContainer ? (
            <div>
              <Label>Переместить сюда существующий блок</Label>
              <select
                className="mt-1 w-full rounded-xl bg-tg-bg border border-tg-border px-3 py-3 text-[15px]"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) onMoveIntoContainer(id, local);
                  e.target.value = '';
                }}
              >
                <option value="">— выберите блок —</option>
                {moveIntoOptions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {'— '.repeat(x.depth)}
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Label>Вложенные блоки</Label>
          {(local.children || []).map((c, idx) => (
            <div key={c.id} className="flex flex-wrap gap-2 items-center rounded-xl border border-white/10 p-2">
              <span className="text-xs flex-1 capitalize text-tg-muted">{c.type}</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => onDrillChild(local, c)}>
                Изменить
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={idx === 0}
                onClick={() => {
                  const ch = [...(local.children || [])];
                  [ch[idx - 1], ch[idx]] = [ch[idx], ch[idx - 1]];
                  setLocal({ ...local, children: ch });
                }}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={idx === (local.children || []).length - 1}
                onClick={() => {
                  const ch = [...(local.children || [])];
                  [ch[idx + 1], ch[idx]] = [ch[idx], ch[idx + 1]];
                  setLocal({ ...local, children: ch });
                }}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setLocal({
                    ...local,
                    children: (local.children || []).filter((x) => x.id !== c.id),
                  })
                }
              >
                Удалить
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" onClick={() => onAddChild(local.id)}>
            Добавить в блок
          </Button>
        </div>
      ) : null}

      <div className="flex justify-between gap-2 mt-6">
        <Button type="button" variant="danger" onClick={() => onDelete(local.id)}>
          Удалить блок
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={() => onSave(local)}>
            Готово
          </Button>
        </div>
      </div>
    </Modal>
  );
}
