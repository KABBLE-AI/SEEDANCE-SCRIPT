const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../src/core.js');
const Data = require('../src/menu-data.js');

test('all 20 dishes and all prices match the supplied menu, including the changed kung-pao price', () => {
  const expected = {
    pork: [1000], dongpo: [1200], meatball: [800], ribs: [1500], drumstick: [500],
    'spicy-chicken': [1000, 2000], 'pumpkin-chicken': [1000, 2000], tripe: [1000, 2000], 'kung-pao': [800, 1600],
    cucumber: [600, 1200], 'eggplant-beans': [600, 1200], 'steamed-veg': [600, 1200], 'mixed-veg': [600, 1200], 'other-sides': [600, 1200],
    'veg-portion': [500, 1000], 'veg-piece': [200], pepper: [300], eggplant: [300], carp: [1800], perch: [2600],
  };
  assert.equal(new Set(Data.items.map(item => item.id)).size, 20);
  assert.deepEqual(Object.fromEntries(Data.items.map(item => [item.id, item.variants.map(variant => variant.priceCents)])), expected);
});

test('small and large portions coexist and mixed-unit totals remain accurate', () => {
  let draft = C.blankDraft();
  draft = C.adjustItem(draft, 'pork', 'one', 2);
  draft = C.adjustItem(draft, 'kung-pao', 'small', 1);
  draft = C.adjustItem(draft, 'kung-pao', 'large', 1);
  draft = C.adjustItem(draft, 'veg-piece', 'one', 3);
  draft = C.adjustItem(draft, 'perch', 'one', 1);
  const summary = C.summarize(draft);
  assert.equal(summary.totalCents, 7600);
  assert.equal(summary.quantity, 8);
  assert.equal(summary.lines.length, 5);
  assert.deepEqual(summary.lines.map(line => line.unit), ['块', '份', '份', '个', '条']);
});

test('quantity controls remove zero rows, cap at 99, and ignore invalid dishes or variants', () => {
  const original = C.blankDraft();
  const added = C.adjustItem(original, 'pork', 'one', 1);
  assert.equal(original.items.length, 0);
  assert.equal(C.adjustItem(added, 'pork', 'one', -1).items.length, 0);
  assert.equal(C.adjustItem(added, 'pork', 'one', 500).items[0].quantity, 99);
  assert.deepEqual(C.adjustItem(original, 'missing', 'one', 1), original);
  assert.deepEqual(C.adjustItem(original, 'pork', 'large', 1), original);
  assert.deepEqual(C.adjustItem(original, 'pork', 'one', -1), original);
});

test('dates and meals isolate drafts and reject impossible dates', () => {
  const state = C.blankState();
  state.drafts[C.keyFor('2026-10-10', 'lunch')] = C.adjustItem(C.blankDraft(), 'pork', 'one', 1);
  state.drafts[C.keyFor('2026-10-10', 'dinner')] = C.adjustItem(C.blankDraft(), 'perch', 'one', 1);
  assert.equal(C.summarize(state.drafts['2026-10-10:lunch']).totalCents, 1000);
  assert.equal(C.summarize(state.drafts['2026-10-10:dinner']).totalCents, 2600);
  assert.equal(state.drafts['2026-10-11:lunch'], undefined);
  assert.equal(C.validDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-1', 'no-date']) assert.equal(C.validDate(date), false);
  assert.throws(() => C.keyFor('2026-10-10', 'unknown'));
  assert.equal(C.localDate(new Date(2026, 9, 10, 0, 1)), '2026-10-10');
});

test('saved orders preserve their original prices and reorder uses current menu prices', () => {
  const draft = C.adjustItem(C.blankDraft(), 'kung-pao', 'small', 2);
  const saved = C.snapshotOrder('2026-10-10', 'lunch', draft, Data.items);
  const menu = C.menuWithOverrides({ 'kung-pao': { name: '宫保鸡丁', prices: { small: 950, large: 1800 } } });
  const reordered = C.mergeOrder(C.blankDraft(), saved, menu);
  assert.equal(saved.totalCents, 1600);
  assert.equal(C.summarize(reordered, menu).totalCents, 1900);
  assert.equal(saved.lines[0].priceCents, 800);
  assert.notEqual(C.signature(saved), C.signature(C.snapshotOrder('2026-10-10', 'lunch', draft, menu)));
});

test('decimal prices use integer cents and receipt contains sizes, totals and notes', () => {
  const menu = C.menuWithOverrides({ pork: { name: '把子肉', prices: { one: 1010 } } });
  const draft = { ...C.adjustItem(C.blankDraft(), 'pork', 'one', 3), note: ' 少辣，打包 ' };
  const order = C.snapshotOrder('2026-10-10', 'dinner', draft, menu);
  assert.equal(order.totalCents, 3030);
  assert.equal(C.money(order.totalCents), '30.3');
  assert.match(C.orderText(order), /2026-10-10 晚餐/);
  assert.match(C.orderText(order), /把子肉 × 3块  ¥30.3/);
  assert.match(C.orderText(order), /备注：少辣，打包/);
  const portionOrder = C.snapshotOrder('2026-10-10', 'lunch', C.adjustItem(C.blankDraft(), 'kung-pao', 'large', 1), Data.items);
  assert.match(C.orderText(portionOrder), /宫保鸡丁（大份） × 1份  ¥16/);
  assert.throws(() => C.snapshotOrder('2026-10-10', 'lunch', C.blankDraft(), Data.items));
});

test('one saved order per date and meal updates only that record', () => {
  const state = C.blankState();
  const first = C.snapshotOrder('2026-10-10', 'lunch', C.adjustItem(C.blankDraft(), 'pork', 'one', 1), Data.items);
  state.orders[first.id] = first;
  const updated = C.snapshotOrder('2026-10-10', 'lunch', C.adjustItem(C.blankDraft(), 'perch', 'one', 1), Data.items);
  state.orders[updated.id] = updated;
  assert.equal(Object.keys(state.orders).length, 1);
  assert.equal(state.orders[first.id].totalCents, 2600);
});

test('backup roundtrip keeps menu, draft, snapshots and notes; totals are recomputed from saved unit prices', () => {
  const state = C.blankState();
  const draft = { ...C.adjustItem(C.blankDraft(), 'pork', 'one', 2), note: '不要辣' };
  const order = C.snapshotOrder('2026-10-10', 'lunch', draft, Data.items, '2026-10-10T03:20:00.000Z');
  state.drafts[order.id] = draft;
  state.orders[order.id] = order;
  state.menu.pork = { name: '把子肉', prices: { one: 1200 } };
  assert.deepEqual(C.parseBackup(JSON.stringify(state)), state);
  state.orders[order.id].totalCents = 1;
  state.orders[order.id].lines[0].subtotalCents = 1;
  const restored = C.parseBackup(JSON.stringify(state));
  assert.equal(restored.orders[order.id].totalCents, 2000);
  assert.equal(C.summarize(restored.drafts[order.id], C.menuWithOverrides(restored.menu)).totalCents, 2400);
});

test('corrupt or foreign backups are rejected without mutating valid state', () => {
  const state = C.blankState();
  assert.throws(() => C.parseBackup('not json'));
  assert.throws(() => C.parseBackup('{"version":99}'));
  for (const bad of [
    { ...state, menu: { pork: { name: '肉', prices: { one: -10 } } } },
    { ...state, menu: { pork: { name: '<b>meat</b>', prices: { one: 1.2 } } } },
    { ...state, drafts: { '2026-02-30:lunch': C.blankDraft() } },
    { ...state, drafts: { '2026-10-10:lunch': { note: '', items: [{ dishId: 'pork', variantId: 'one', quantity: 100 }] } } },
    { ...state, drafts: { '2026-10-10:lunch': { note: '', items: [{ dishId: 'missing', variantId: 'one', quantity: 1 }] } } },
    JSON.parse('{"version":1,"menu":{},"drafts":{"__proto__":{}},"orders":{}}'),
  ]) assert.throws(() => C.normalizeState(bad));
  assert.deepEqual(state, C.blankState());
  assert.equal({}.polluted, undefined);
  assert.equal(C.escapeHTML('<img src=x onerror="bad()">&\''), '&lt;img src=x onerror=&quot;bad()&quot;&gt;&amp;&#39;');
});

test('reorder merges quantities and retains the current note', () => {
  const current = { ...C.adjustItem(C.blankDraft(), 'pork', 'one', 98), note: '今天的备注' };
  const old = C.snapshotOrder('2026-10-09', 'dinner', { ...C.adjustItem(C.blankDraft(), 'pork', 'one', 3), note: '旧备注' }, Data.items);
  const next = C.mergeOrder(current, old, Data.items);
  assert.equal(next.items[0].quantity, 99);
  assert.equal(next.note, '今天的备注');
  assert.equal(current.items[0].quantity, 98);
});

test('standalone HTML bundles every script, has unique IDs and resolves the application DOM targets', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  // Only actual markup is checked; the application also contains HTML template literals.
  const markup = html.split('<script>')[0];
  const markupIds = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(markupIds).size, markupIds.length);
  for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), `Missing DOM target: ${match[1]}`);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=["']https?:|\/\* (APP_STYLES|MENU_DATA|MENU_CORE|APP_SCRIPT) \*\//);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.equal(scripts.length, 3);
  for (const script of scripts) new vm.Script(script);
  const browserGlobals = vm.createContext({});
  vm.runInContext(scripts[0], browserGlobals);
  vm.runInContext(scripts[1], browserGlobals);
  assert.equal(browserGlobals.DailyMenuData.items.length, 20);
  assert.equal(browserGlobals.DailyMenuCore.summarize(browserGlobals.DailyMenuCore.adjustItem(browserGlobals.DailyMenuCore.blankDraft(), 'pork', 'one', 2)).totalCents, 2000);
});
