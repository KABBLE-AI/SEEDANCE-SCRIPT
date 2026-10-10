(function () {
  'use strict';
  const C = window.DailyMenuCore;
  const Data = window.DailyMenuData;
  const $ = id => document.getElementById(id);
  const esc = C.escapeHTML;
  const STORAGE_KEY = 'zhouji-daily-menu:v1';
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  let state = C.blankState();
  let persistenceBlocked = false;
  let lastWriteOK = true;
  let toastTimer;
  let receiptOrder = null;
  let category = 'all';
  let search = '';
  let selectedDate = C.localDate();
  let selectedMeal = new Date().getHours() >= 15 ? 'dinner' : 'lunch';
  const selectedVariants = {};

  function storageWarning(message) {
    $('storage-warning').textContent = message;
    $('storage-warning').hidden = false;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = C.parseBackup(saved);
  } catch {
    persistenceBlocked = true;
    lastWriteOK = false;
    storageWarning('无法读取此浏览器的点单记录，已有数据未被覆盖。本次可继续选菜、复制清单，或在「点单记录」中导出备份；导入有效备份可恢复使用。');
  }
  function persist() {
    if (persistenceBlocked) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      lastWriteOK = true;
      $('storage-warning').hidden = true;
      return true;
    } catch {
      lastWriteOK = false;
      storageWarning('浏览器暂时无法保存数据，本次改动只在当前页面中。请在关闭前复制点单，或从「点单记录」导出备份。');
      return false;
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    document.querySelectorAll('.dialog-notice').forEach(notice => notice.remove());
    $('toast').hidden = true;
    const activeDialog = Array.from(document.querySelectorAll('dialog[open]')).at(-1);
    if (activeDialog) {
      const notice = document.createElement('p');
      notice.className = 'dialog-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = message;
      activeDialog.append(notice);
      toastTimer = setTimeout(() => notice.remove(), 5000);
      return;
    }
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3600);
  }
  const currentKey = () => C.keyFor(selectedDate, selectedMeal);
  const getMenu = () => C.menuWithOverrides(state.menu);
  const getDraft = () => state.drafts[currentKey()] || C.blankDraft();
  function setDraft(draft) { state.drafts[currentKey()] = draft; persist(); }
  function focusRestore(render) {
    const focused = document.activeElement?.dataset.focus;
    render();
    if (focused) {
      const buttons = Array.from(document.querySelectorAll('[data-focus]'));
      const next = buttons.find(el => el.dataset.focus === focused) || buttons.find(el => el.dataset.focus === focused.replace(/-minus$/, '-plus'));
      (next || $('order-panel')).focus({ preventScroll: true });
    }
  }
  function selectedVariant(dish) {
    return dish.variants.find(variant => variant.id === selectedVariants[dish.id]) || dish.variants[0];
  }
  function stepper(dishId, variantId, quantity, prefix, name) {
    return `<div class="stepper"><button data-action="minus" data-dish="${dishId}" data-variant="${variantId}" data-focus="${prefix}-${dishId}-${variantId}-minus" aria-label="减少${esc(name)}">${icon('minus')}</button><span class="item-quantity" aria-label="数量 ${quantity}">${quantity}</span><button data-action="plus" data-dish="${dishId}" data-variant="${variantId}" data-focus="${prefix}-${dishId}-${variantId}-plus" aria-label="增加${esc(name)}" ${quantity >= C.MAX_QUANTITY ? 'disabled' : ''}>${icon('plus')}</button></div>`;
  }
  function renderTabs() {
    const menu = getMenu();
    $('category-tabs').innerHTML = Data.categories.map(cat => `<button class="category-tab" data-category="${cat.id}" aria-pressed="${category === cat.id}">${icon(cat.icon)}<span>${cat.name}</span><span class="tab-count">${cat.id === 'all' ? menu.length : menu.filter(dish => dish.category === cat.id).length}</span></button>`).join('');
  }
  function renderMenu() {
    const menu = getMenu();
    const draft = getDraft();
    const dishes = menu.filter(dish => (category === 'all' || category === dish.category) && dish.name.toLowerCase().includes(search));
    $('menu-count').textContent = `${dishes.length} 道`;
    $('menu-grid').innerHTML = dishes.map(dish => {
      const variant = selectedVariant(dish);
      const qty = draft.items.find(item => item.dishId === dish.id && item.variantId === variant.id)?.quantity || 0;
      const chosen = draft.items.some(item => item.dishId === dish.id);
      const cat = Data.categories.find(item => item.id === dish.category);
      const portions = dish.variants.length > 1 ? `<div class="portion-options" role="group" aria-label="${esc(dish.name)}份量">${dish.variants.map(option => `<button class="portion-option" data-action="variant" data-dish="${dish.id}" data-variant="${option.id}" data-focus="portion-${dish.id}-${option.id}" aria-pressed="${variant.id === option.id}">${option.label} ¥${C.money(option.priceCents)}</button>`).join('')}</div>` : `<p class="unit-label">按${dish.unit}点选 · 想吃多少点多少</p>`;
      return `<article class="dish-card ${chosen ? 'is-selected' : ''}"><div class="dish-card-top"><span class="dish-symbol ${dish.category}">${icon(cat.icon)}</span><div class="dish-name"><h3>${esc(dish.name)}</h3><div class="dish-category">${cat.name}${dish.featured ? '<span class="featured-mark">招牌</span>' : ''}</div></div></div>${portions}<div class="dish-bottom"><div class="dish-price"><span>¥</span>${C.money(variant.priceCents)}<small>/${dish.variants.length > 1 ? variant.label : dish.unit}</small></div>${qty ? stepper(dish.id, variant.id, qty, 'menu', dish.name + (dish.variants.length > 1 ? variant.label : '')) : `<button class="add-button" data-action="plus" data-dish="${dish.id}" data-variant="${variant.id}" data-focus="menu-${dish.id}-${variant.id}-plus" aria-label="添加${esc(dish.name)}${dish.variants.length > 1 ? variant.label : ''}">${icon('plus')}</button>`}</div></article>`;
    }).join('') || `<div class="empty-results">${icon('search')}<h3>还没有找到这道菜</h3><p>试试其他菜名，或看看全部菜品。</p><button class="text-button" data-action="reset-search">查看全部菜品</button></div>`;
  }
  function renderOrder(syncNote = false) {
    const draft = getDraft();
    const menu = getMenu();
    const summary = C.summarize(draft, menu);
    $('basket-count').textContent = summary.quantity;
    $('mobile-count').textContent = summary.quantity;
    $('order-total').textContent = C.money(summary.totalCents);
    $('mobile-total').textContent = C.money(summary.totalCents);
    $('quantity-label').textContent = summary.quantity ? `${summary.lines.length} 种规格 · 共 ${summary.quantity} 件` : '还没有选菜';
    $('clear-button').disabled = !summary.quantity && !draft.note;
    $('save-order').disabled = !summary.quantity;
    $('order-context').textContent = `${selectedDate.replaceAll('-', '.')}  /  ${C.MEALS[selectedMeal]}`;
    $('order-lines').innerHTML = summary.lines.length ? summary.lines.map(line => `<div class="order-line"><div class="order-line-main"><h3>${esc(line.name)}${line.variantLabel ? ` · ${line.variantLabel}` : ''}</h3><span class="line-total">¥${C.money(line.subtotalCents)}</span></div><div class="order-line-sub"><span>¥${C.money(line.priceCents)} / ${line.variantLabel || line.unit}</span>${stepper(line.dishId, line.variantId, line.quantity, 'basket', line.name + line.variantLabel)}</div></div>`).join('') : `<div class="empty-basket">${icon('bowl')}<h3>给这一餐加点喜欢的</h3><p>点菜品旁的 ＋，就能放进这里。</p></div>`;
    if (syncNote) $('order-note').value = draft.note;
    const saved = state.orders[currentKey()];
    const isSaved = saved && summary.quantity && C.signature(saved) === C.signature(C.snapshotOrder(selectedDate, selectedMeal, draft, menu));
    $('save-order').querySelector('span').textContent = isSaved ? '已保存 · 查看点单' : saved ? '更新这餐点单' : '保存本次点单';
    $('save-status').textContent = !lastWriteOK ? '本次改动仅在当前页面，请及时导出。' : isSaved ? '这餐已记好，随时可以复制。' : saved ? '本餐有修改，保存后更新原记录。' : summary.quantity ? '选菜草稿已自动保存在此浏览器。' : '选好后保存，明天还能照着点。';
    $('history-count').textContent = Object.keys(state.orders).length;
  }
  function renderPlanner() {
    $('order-date').value = selectedDate;
    const weekday = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('zh-CN', { weekday: 'long' });
    $('date-label').textContent = `${selectedDate === C.localDate() ? '今天 · ' : ''}${weekday}`;
    document.querySelectorAll('[data-meal]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.meal === selectedMeal)));
  }
  function renderAll(syncNote = false) { renderPlanner(); renderTabs(); renderMenu(); renderOrder(syncNote); }
  function saveAndShow() {
    const order = C.snapshotOrder(selectedDate, selectedMeal, getDraft(), getMenu());
    state.orders[order.id] = order;
    const saved = persist();
    renderOrder();
    showReceipt(order, saved ? '已保存在此浏览器。复制清单后，就可以发给店家啦。' : '点单已生成，但尚未写入浏览器。请复制清单或下载保存。');
  }
  function showReceipt(order, message) {
    receiptOrder = order;
    $('receipt-text').value = C.orderText(order);
    $('receipt-status').textContent = message || '这是当时保存的点单，价格按保存时记录。';
    $('receipt-title').textContent = order.id === currentKey() ? '这顿，安排好了' : '回看这一餐';
    $('receipt-dialog').showModal();
  }
  function renderHistory() {
    const orders = Object.values(state.orders).sort((a, b) => b.date.localeCompare(a.date) || (a.meal === b.meal ? 0 : a.meal === 'dinner' ? -1 : 1));
    $('history-list').innerHTML = orders.length ? orders.map(order => `<article class="history-card"><div class="history-card-top"><h3>${order.date.replaceAll('-', '.')}<span>${C.MEALS[order.meal]}</span></h3><strong>¥${C.money(order.totalCents)}</strong></div><p>${order.lines.map(line => `${esc(line.name)}${line.variantLabel ? '（' + line.variantLabel + '）' : ''} ×${line.quantity}`).join('、')}</p><div class="history-card-actions"><button class="text-button" data-history="view" data-key="${order.id}">查看清单</button><button class="text-button" data-history="reorder" data-key="${order.id}">加入当前餐次 ${icon('arrow')}</button></div></article>`).join('') : `<div class="history-empty">${icon('clock')}第一顿，等你来记录。<br><small>选好菜，点击「保存本次点单」就会出现在这里。</small></div>`;
  }
  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function confirmAction(title, message, actionLabel) {
    return new Promise(resolve => {
      const dialog = $('confirm-dialog');
      $('confirm-title').textContent = title;
      $('confirm-message').textContent = message;
      $('confirm-accept').textContent = actionLabel;
      dialog.returnValue = '';
      $('confirm-accept').onclick = () => dialog.close('yes');
      $('confirm-cancel').onclick = () => dialog.close('no');
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
      dialog.showModal();
      $('confirm-cancel').focus();
    });
  }
  function renderSettings(menu = getMenu()) {
    $('settings-fields').innerHTML = menu.map(dish => `<div class="settings-row"><label class="settings-name"><span>${esc(Data.items.find(item => item.id === dish.id).name)}</span><input type="text" name="name-${dish.id}" value="${esc(dish.name)}" maxlength="24" required aria-label="${esc(dish.name)}菜名"></label><div class="settings-prices">${dish.variants.map(variant => `<label><span>${variant.label} / 元</span><input type="number" name="price-${dish.id}-${variant.id}" value="${C.money(variant.priceCents)}" min="0.01" max="9999" step="0.01" required inputmode="decimal" aria-label="${esc(dish.name)}${variant.label}价格"></label>`).join('')}</div></div>`).join('');
  }

  $('menu-grid').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, dish, variant } = button.dataset;
    if (action === 'reset-search') {
      category = 'all'; search = ''; $('menu-search').value = ''; renderTabs(); renderMenu(); $('menu-search').focus();
    } else if (action === 'variant') {
      selectedVariants[dish] = variant;
      focusRestore(renderMenu);
    } else {
      setDraft(C.adjustItem(getDraft(), dish, variant, action === 'plus' ? 1 : -1, getMenu()));
      focusRestore(() => { renderMenu(); renderOrder(); });
    }
  });
  $('order-lines').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, dish, variant } = button.dataset;
    setDraft(C.adjustItem(getDraft(), dish, variant, action === 'plus' ? 1 : -1, getMenu()));
    focusRestore(() => { renderMenu(); renderOrder(); });
  });
  $('category-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.category === category)));
    renderMenu();
  });
  $('menu-search').addEventListener('input', event => { search = event.target.value.trim().toLowerCase(); renderMenu(); });
  $('order-note').addEventListener('input', event => { setDraft({ ...getDraft(), note: event.target.value }); renderOrder(); });
  $('order-date').addEventListener('change', event => {
    if (!C.validDate(event.target.value)) { event.target.value = selectedDate; toast('请选择 2000 至 2100 年之间的有效日期。'); return; }
    selectedDate = event.target.value;
    renderAll(true);
  });
  document.querySelectorAll('[data-meal]').forEach(button => button.addEventListener('click', () => { selectedMeal = button.dataset.meal; renderAll(true); }));
  $('today-button').addEventListener('click', () => { selectedDate = C.localDate(); renderAll(true); });
  $('clear-button').addEventListener('click', async () => {
    if (await confirmAction('清空这一餐？', '会清空当前餐次的选菜草稿和备注，已保存的历史点单仍然保留。', '清空草稿')) {
      setDraft(C.blankDraft()); renderAll(true); toast('这餐的草稿已清空。');
    }
  });
  $('save-order').addEventListener('click', saveAndShow);
  $('mobile-cart').addEventListener('click', () => { $('order-panel').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); $('order-panel').focus({ preventScroll: true }); });
  $('history-button').addEventListener('click', () => { renderHistory(); $('history-dialog').showModal(); });
  $('history-list').addEventListener('click', event => {
    const button = event.target.closest('[data-history]');
    if (!button) return;
    const order = state.orders[button.dataset.key];
    if (!order) return;
    if (button.dataset.history === 'view') showReceipt(order);
    else {
      setDraft(C.mergeOrder(getDraft(), order, getMenu()));
      $('history-dialog').close();
      renderAll(true);
      toast(`已加入 ${selectedDate} ${C.MEALS[selectedMeal]}，按现菜单价计算（每种规格最多 99 件）。`);
    }
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog || dialog.id === 'confirm-dialog') return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  $('copy-order').addEventListener('click', async () => {
    if (!receiptOrder) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(C.orderText(receiptOrder));
      $('receipt-status').textContent = '已复制！现在可以粘贴到微信或其他聊天窗口。';
    } catch {
      $('receipt-text').focus();
      $('receipt-text').select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Manual selection remains available. */ }
      $('receipt-status').textContent = copied ? '已复制！现在可以粘贴给店家。' : '已选中清单，请按 Ctrl+C / ⌘C，或长按文字复制。';
    }
  });
  $('download-order').addEventListener('click', () => { if (receiptOrder) download(`周记点单-${receiptOrder.date}-${C.MEALS[receiptOrder.meal]}.txt`, C.orderText(receiptOrder), 'text/plain;charset=utf-8'); });
  $('export-backup').addEventListener('click', () => download(`周记点单备份-${C.localDate()}.json`, JSON.stringify(state, null, 2), 'application/json;charset=utf-8'));
  $('import-backup').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('请选择 5 MB 以内的备份文件。');
      const next = C.parseBackup(await file.text());
      if (!await confirmAction('导入这份点单小本？', `备份包含 ${Object.keys(next.orders).length} 餐记录。导入会替换此浏览器的菜单、草稿和历史，建议先导出当前备份。`, '替换并导入')) return;
      state = next; persistenceBlocked = false;
      const saved = persist();
      renderAll(true); renderHistory();
      toast(saved ? '备份已导入，点单小本恢复好了。' : '已读取备份，但浏览器无法持久保存，请保留原备份文件。');
    } catch (error) { toast(error.message); }
  });
  $('settings-button').addEventListener('click', () => { renderSettings(); $('settings-dialog').showModal(); });
  $('settings-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const overrides = {};
    for (const dish of Data.items) {
      const name = String(fields.get(`name-${dish.id}`)).trim();
      if (!name) { toast('菜名不能只填写空格。'); form.elements.namedItem(`name-${dish.id}`).focus(); return; }
      const prices = {};
      for (const variant of dish.variants) prices[variant.id] = Math.round(Number(fields.get(`price-${dish.id}-${variant.id}`)) * 100);
      overrides[dish.id] = { name, prices };
    }
    try { state = C.normalizeState({ ...state, menu: overrides }); } catch { toast('请检查菜名和单价，单价须在 0.01 至 9999 元之间。'); return; }
    const saved = persist();
    $('settings-dialog').close(); renderAll();
    toast(saved ? '菜单已更新，历史点单保留原价。' : '菜单已在本页更新，请导出备份保存。');
  });
  $('reset-menu').addEventListener('click', async () => {
    if (await confirmAction('恢复截图中的菜单？', '菜单编辑框将恢复原始菜名和单价，点击「保存菜单」才会生效。历史点单不受影响。', '恢复原菜单')) renderSettings(Data.items);
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { state = C.parseBackup(event.newValue); persistenceBlocked = false; lastWriteOK = true; $('storage-warning').hidden = true; renderAll(true); if ($('history-dialog').open) renderHistory(); toast('点单小本已同步其他窗口的改动。'); } catch { storageWarning('另一窗口写入的数据无法读取，当前页面内容仍保留。请先导出备份。'); }
  });
  renderAll(true);
})();
