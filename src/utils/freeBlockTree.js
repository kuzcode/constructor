export function mapBlocksDeep(blocks, fn) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => {
    const next = fn(b) || b;
    if (next.children?.length) {
      return { ...next, children: mapBlocksDeep(next.children, fn) };
    }
    return next;
  });
}

export function removeBlockDeep(blocks, id) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => {
      if (b.children?.length) {
        return { ...b, children: removeBlockDeep(b.children, id) };
      }
      return b;
    });
}

export function updateBlockDeep(blocks, id, patchOrFn) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => {
    if (b.id === id) {
      return typeof patchOrFn === 'function' ? patchOrFn(b) : { ...b, ...patchOrFn };
    }
    if (b.children?.length) {
      return { ...b, children: updateBlockDeep(b.children, id, patchOrFn) };
    }
    return b;
  });
}

export function addChildBlock(blocks, parentId, child) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => {
    if (b.id === parentId && (b.type === 'stack' || b.type === 'hscroll')) {
      return { ...b, children: [...(b.children || []), child] };
    }
    if (b.children?.length) {
      return { ...b, children: addChildBlock(b.children, parentId, child) };
    }
    return b;
  });
}

export function findBlockDeep(blocks, id) {
  for (const b of blocks || []) {
    if (b.id === id) return b;
    if (b.children?.length) {
      const f = findBlockDeep(b.children, id);
      if (f) return f;
    }
  }
  return null;
}

/** Все id в поддереве корня (включая корень). */
export function collectSubtreeIds(block) {
  const ids = new Set([block.id]);
  for (const c of block.children || []) {
    for (const id of collectSubtreeIds(c)) ids.add(id);
  }
  return ids;
}

/** targetParentId внутри поддерева movingBlockId? */
export function isParentUnderMovingBlock(blocks, movingBlockId, targetParentId) {
  if (!targetParentId) return false;
  const root = findBlockDeep(blocks, movingBlockId);
  if (!root) return false;
  return collectSubtreeIds(root).has(targetParentId);
}

/** Плоский список блоков с краткой подписью. */
export function flattenBlocksMeta(blocks, depth = 0, out = []) {
  for (const b of blocks || []) {
    let lab = b.type;
    if (b.type === 'text') lab = `Текст: ${(b.content || '').slice(0, 28)}`;
    else if (b.type === 'button') lab = `Кнопка: ${(b.label || '').slice(0, 24)}`;
    else if (b.type === 'image') lab = 'Изображение';
    else if (b.type === 'stack') lab = `Контейнер (${(b.children || []).length})`;
    else if (b.type === 'hscroll') lab = `Скролл (${(b.children || []).length})`;
    else if (b.type === 'poll') lab = `Опрос: ${(b.question || '').slice(0, 20)}`;
    out.push({ id: b.id, type: b.type, depth, label: lab });
    if (b.children?.length) flattenBlocksMeta(b.children, depth + 1, out);
  }
  return out;
}

/**
 * Вырезает блок и вставляет в корень или в stack/hscroll.
 * @param {string|null|undefined} targetParentId — null = корень холста
 */
/** null = корень холста; undefined = блок не найден */
export function findParentIdOfBlock(blocks, childId) {
  for (const b of blocks || []) {
    if (b.id === childId) return null;
  }
  for (const b of blocks || []) {
    const r = findParentIdInSubtree(b.children, childId, b.id);
    if (r !== undefined) return r;
  }
  return undefined;
}

function findParentIdInSubtree(children, childId, parentId) {
  for (const b of children || []) {
    if (b.id === childId) return parentId;
    const r = findParentIdInSubtree(b.children, childId, b.id);
    if (r !== undefined) return r;
  }
  return undefined;
}

function arrayMoveSibling(arr, oldIndex, newIndex) {
  const n = [...arr];
  const [x] = n.splice(oldIndex, 1);
  n.splice(newIndex, 0, x);
  return n;
}

/** Перестановка среди соседей (тот же родитель). Иначе null. */
export function reorderSiblingsInTree(blocks, activeId, overId) {
  const pA = findParentIdOfBlock(blocks, activeId);
  const pO = findParentIdOfBlock(blocks, overId);
  if (pA === undefined || pO === undefined) return null;
  if (pA !== pO) return null;
  if (pA === null) {
    const oldI = blocks.findIndex((b) => b.id === activeId);
    const newI = blocks.findIndex((b) => b.id === overId);
    if (oldI < 0 || newI < 0) return null;
    return arrayMoveSibling(blocks, oldI, newI);
  }
  return updateBlockDeep(blocks, pA, (parent) => {
    const ch = parent.children || [];
    const oldI = ch.findIndex((b) => b.id === activeId);
    const newI = ch.findIndex((b) => b.id === overId);
    if (oldI < 0 || newI < 0) return parent;
    return { ...parent, children: arrayMoveSibling(ch, oldI, newI) };
  });
}

export function moveBlockToRootOrParent(blocks, blockId, targetParentId) {
  const moving = findBlockDeep(blocks, blockId);
  if (!moving) return blocks;
  if (targetParentId && isParentUnderMovingBlock(blocks, blockId, targetParentId)) return blocks;
  if (blockId === targetParentId) return blocks;
  if (targetParentId) {
    const parent = findBlockDeep(blocks, targetParentId);
    if (!parent || (parent.type !== 'stack' && parent.type !== 'hscroll')) return blocks;
  }
  const removed = removeBlockDeep(blocks, blockId);
  if (targetParentId == null || targetParentId === '') {
    return [...removed, moving];
  }
  return addChildBlock(removed, targetParentId, moving);
}

export function collectImageFileIdsFromBlocks(blocks, acc = new Set()) {
  if (!Array.isArray(blocks)) return acc;
  for (const b of blocks) {
    if (b.type === 'image' && b.fileId) acc.add(b.fileId);
    if (b.children?.length) collectImageFileIdsFromBlocks(b.children, acc);
  }
  return acc;
}
