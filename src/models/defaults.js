import { createId } from '../lib/id';
import { normalizeProduct } from '../utils/productModel';

/** @returns {import('./types').ShopPayload} */
export function defaultShopPayload() {
  return {
    styleId: 1,
    name: '',
    description: '',
    contacts: {
      phone: '',
      address: '',
      email: '',
      tgChannel: '',
      tgDm: '',
      instagram: '',
    },
    checkout: {
      requireName: true,
      requireAddress: false,
      requirePhone: true,
    },
    categories: [],
    products: [],
  };
}

/** @returns {import('./types').FreePayload} */
export function defaultFreePayload() {
  return {
    blocks: [],
    variables: [],
    settings: {
      background: { type: 'color', color: '#0a0a0f' },
    },
  };
}

/** @returns {import('./types').MiniAppDoc} */
export function newMiniAppDraft(ownerId, appType, title) {
  const shop = appType === 'shop' ? defaultShopPayload() : null;
  const free = appType === 'free' ? defaultFreePayload() : null;
  return {
    ownerId,
    appType,
    title: title || (appType === 'shop' ? 'Магазин' : 'Страница'),
    slug: '',
    published: false,
    shopPayload: shop,
    freePayload: free,
  };
}

export function createCategory(name, parentId = null) {
  return { id: createId(), parentId, name: (name || '').trim() };
}

export function createProduct(categoryId = null) {
  return normalizeProduct({
    id: createId(),
    categoryId,
    name: '',
    description: '',
    price: 0,
    imageFileIds: [],
    specs: [],
    colors: [],
    sizes: [],
    stock: 0,
    outOfStockBehavior: 'mark',
  });
}

export function newTextBlock() {
  return {
    type: 'text',
    id: createId(),
    align: 'left',
    textVariant: 'body',
    color: '#ffffff',
    content: '',
  };
}

export function newImageBlock() {
  return { type: 'image', id: createId(), fileId: '' };
}

export function newButtonBlock() {
  return {
    type: 'button',
    id: createId(),
    label: 'Кнопка',
    bgColor: '#3390ec',
    textColor: '#ffffff',
    action: { kind: 'link', url: 'https://' },
  };
}

export function newCountdownBlock() {
  return {
    type: 'countdown',
    id: createId(),
    mode: 'until',
    untilIso: new Date(Date.now() + 86400000).toISOString(),
    sessionSeconds: 3600,
    textColor: '#ffffff',
    label: '',
  };
}

export function newStackBlock() {
  return {
    type: 'stack',
    id: createId(),
    layout: 'column',
    bgColor: 'transparent',
    children: [],
  };
}

export function newHScrollBlock() {
  return {
    type: 'hscroll',
    id: createId(),
    gap: 12,
    children: [],
  };
}

export function newInputBlock() {
  return {
    type: 'input',
    id: createId(),
    inputType: 'text',
    variableId: '',
    placeholder: '',
    bgColor: 'rgba(255,255,255,0.08)',
    textColor: '#ffffff',
  };
}

export function newPollBlock() {
  const id1 = createId();
  const id2 = createId();
  return {
    type: 'poll',
    id: createId(),
    question: 'Вопрос',
    mode: 'survey',
    options: [
      { id: id1, label: 'Вариант 1', correct: false },
      { id: id2, label: 'Вариант 2', correct: false },
    ],
    optBg: 'rgba(255,255,255,0.08)',
    optSelectedBg: 'rgba(51,144,236,0.35)',
    notifyAdmin: false,
  };
}

/** @param {string} variableId */
export function newVariableButtonAction(variableId) {
  return {
    kind: 'variable',
    variableId: variableId || '',
    numberOp: 'add',
    numberValue: 1,
    textValue: '',
  };
}

export function newVariable() {
  return { id: createId(), name: 'var', varType: 'text', initialValue: '' };
}
