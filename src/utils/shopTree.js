/** @param {{ id: string, parentId: string|null }[]} categories */
export function collectDescendantIds(categories, rootId) {
  const ids = new Set([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return [...ids];
}

/** @param {{ id: string, parentId: string|null, name: string }[]} categories */
export function flattenCategoryOptions(categories, parentId = null, depth = 0) {
  const rows = [];
  const kids = categories.filter((c) => c.parentId === parentId);
  for (const k of kids) {
    rows.push({
      id: k.id,
      label: `${'— '.repeat(depth)}${k.name}`,
    });
    rows.push(...flattenCategoryOptions(categories, k.id, depth + 1));
  }
  return rows;
}
