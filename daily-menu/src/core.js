(function (root, factory) {
  const data = typeof module === 'object' && module.exports ? require('./menu-data.js') : root.DailyMenuData;
  const core = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.DailyMenuCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Data) {
  'use strict';
  const MAX_QUANTITY = 99;
  const MEALS = { lunch: '午餐', dinner: '晚餐' };
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const money = cents => (cents / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12);
    return year >= 2000 && year <= 2100 && parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  }
  function localDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  function keyFor(date, meal) {
    if (!validDate(date) || !Object.hasOwn(MEALS, meal)) throw new Error('请选择有效的日期和餐次。');
    return `${date}:${meal}`;
  }
  function validKey(key) {
    const [date, meal, extra] = String(key).split(':');
    return extra === undefined && validDate(date) && Object.hasOwn(MEALS, meal);
  }
  const blankDraft = () => ({ items: [], note: '' });
  const blankState = () => ({ version: 1, menu: {}, drafts: {}, orders: {} });
  function menuWithOverrides(overrides = {}) {
    return Data.items.map(item => {
      const override = Object.hasOwn(overrides, item.id) ? overrides[item.id] : {};
      return {
        ...item,
        name: override.name || item.name,
        variants: item.variants.map(variant => ({ ...variant, priceCents: override.prices?.[variant.id] ?? variant.priceCents })),
      };
    });
  }
  function findVariant(menu, dishId, variantId) {
    const dish = menu.find(item => item.id === dishId);
    const variant = dish?.variants.find(item => item.id === variantId);
    return dish && variant ? { dish, variant } : null;
  }
  function adjustItem(draft, dishId, variantId, delta, menu = Data.items) {
    if (!findVariant(menu, dishId, variantId) || !Number.isInteger(delta)) return draft;
    const items = draft.items.map(item => ({ ...item }));
    const index = items.findIndex(item => item.dishId === dishId && item.variantId === variantId);
    const quantity = Math.max(0, Math.min(MAX_QUANTITY, (items[index]?.quantity || 0) + delta));
    if (index >= 0) {
      if (quantity === 0) items.splice(index, 1);
      else items[index].quantity = quantity;
    } else if (quantity > 0) items.push({ dishId, variantId, quantity });
    return { ...draft, items };
  }
  function summarize(draft, menu = Data.items) {
    const lines = draft.items.flatMap(item => {
      const match = findVariant(menu, item.dishId, item.variantId);
      if (!match || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) return [];
      return [{ ...item, name: match.dish.name, unit: match.dish.unit, variantLabel: match.dish.variants.length > 1 ? match.variant.label : '', priceCents: match.variant.priceCents, subtotalCents: match.variant.priceCents * item.quantity }];
    });
    return { lines, quantity: lines.reduce((sum, line) => sum + line.quantity, 0), totalCents: lines.reduce((sum, line) => sum + line.subtotalCents, 0) };
  }
  function snapshotOrder(date, meal, draft, menu, now = new Date().toISOString()) {
    const id = keyFor(date, meal);
    const summary = summarize(draft, menu);
    if (!summary.lines.length) throw new Error('先选一道菜，再保存点单吧。');
    return { id, date, meal, ...summary, note: draft.note.trim().slice(0, 300), updatedAt: now };
  }
  function signature(order) {
    if (!order) return '';
    return JSON.stringify({ lines: order.lines, note: order.note.trim() });
  }
  function orderText(order) {
    const rows = order.lines.map((line, index) => `${index + 1}. ${line.name}${line.variantLabel ? `（${line.variantLabel}）` : ''} × ${line.quantity}${line.unit}  ¥${money(line.subtotalCents)}`);
    return [Data.restaurant + ' · ' + Data.location, `${order.date} ${MEALS[order.meal]}`, '', ...rows, '', `合计：¥${money(order.totalCents)}`, ...(order.note ? [`备注：${order.note}`] : [])].join('\n');
  }
  function mergeOrder(draft, order, menu) {
    let next = { ...draft, items: draft.items.map(item => ({ ...item })) };
    for (const line of order.lines) next = adjustItem(next, line.dishId, line.variantId, line.quantity, menu);
    if (!next.note && order.note) next.note = order.note;
    return next;
  }
  function normalizeState(value) {
    const fail = () => { throw new Error('备份格式不正确，原有数据未被替换。'); };
    if (!isObject(value) || value.version !== 1 || !isObject(value.menu) || !isObject(value.drafts) || !isObject(value.orders)) fail();
    const state = blankState();
    for (const [id, override] of Object.entries(value.menu)) {
      const base = Data.items.find(item => item.id === id);
      if (!base || !isObject(override) || typeof override.name !== 'string' || !override.name.trim() || override.name.length > 24 || !isObject(override.prices)) fail();
      const prices = {};
      for (const variant of base.variants) {
        const price = override.prices[variant.id];
        if (!Number.isInteger(price) || price < 1 || price > 999900) fail();
        prices[variant.id] = price;
      }
      state.menu[id] = { name: override.name.trim(), prices };
    }
    function validateItems(items) {
      if (!Array.isArray(items) || items.length > 40) fail();
      const seen = new Set();
      return items.map(item => {
        if (!isObject(item) || !findVariant(Data.items, item.dishId, item.variantId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) fail();
        const key = `${item.dishId}:${item.variantId}`;
        if (seen.has(key)) fail();
        seen.add(key);
        return { dishId: item.dishId, variantId: item.variantId, quantity: item.quantity };
      });
    }
    function note(value) {
      if (typeof value !== 'string' || value.length > 300) fail();
      return value;
    }
    for (const [key, draft] of Object.entries(value.drafts)) {
      if (!validKey(key) || !isObject(draft)) fail();
      state.drafts[key] = { items: validateItems(draft.items), note: note(draft.note) };
    }
    for (const [key, order] of Object.entries(value.orders)) {
      if (!validKey(key) || !isObject(order) || order.id !== key || `${order.date}:${order.meal}` !== key || typeof order.updatedAt !== 'string' || !Number.isFinite(Date.parse(order.updatedAt))) fail();
      validateItems(order.lines);
      if (!order.lines.length) fail();
      const lines = order.lines.map(line => {
        const match = findVariant(Data.items, line.dishId, line.variantId);
        if (typeof line.name !== 'string' || !line.name.trim() || line.name.length > 24 || !Number.isInteger(line.priceCents) || line.priceCents < 1 || line.priceCents > 999900) fail();
        return { dishId: line.dishId, variantId: line.variantId, quantity: line.quantity, name: line.name, unit: match.dish.unit, variantLabel: match.dish.variants.length > 1 ? match.variant.label : '', priceCents: line.priceCents, subtotalCents: line.priceCents * line.quantity };
      });
      state.orders[key] = { id: key, date: order.date, meal: order.meal, lines, quantity: lines.reduce((sum, line) => sum + line.quantity, 0), totalCents: lines.reduce((sum, line) => sum + line.subtotalCents, 0), note: note(order.note), updatedAt: order.updatedAt };
    }
    return state;
  }
  function parseBackup(text) {
    if (typeof text !== 'string' || text.length > 5 * 1024 * 1024) throw new Error('备份文件过大，请选择 5 MB 以内的 JSON 文件。');
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('无法读取 JSON 文件，原有数据未被替换。'); }
    return normalizeState(parsed);
  }
  return { MAX_QUANTITY, MEALS, money, escapeHTML, validDate, localDate, keyFor, blankState, blankDraft, menuWithOverrides, adjustItem, summarize, snapshotOrder, signature, orderText, mergeOrder, normalizeState, parseBackup };
});
