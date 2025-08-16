// bag.module.js — Mochila con bolsillos custom UI (persistencia + formulario para "Custom")
// Depende de: items.api.js (ItemsAPI)

(() => {
  /** @typedef {{ id:string, nameEs:string, qty:number, sprite?:string|null, effectText?:string|null, desc?:string|null }} ItemPack */
  /** @typedef {{
   *   pokeballs: Record<string, ItemPack>;
   *   medicine:  Record<string, ItemPack>;
   *   berries:   Record<string, ItemPack>;
   *   battle:    Record<string, ItemPack>;
   *   key:       Record<string, ItemPack>;
   *   custom:    Record<string, ItemPack>;
   * }} Pockets */

  // ===== Persistencia =====
  const BAG_STORAGE_KEY = 'pcdetote_bag_v1';

  function createEmptyBag() {
    return {
      pockets: {
        pokeballs: {},
        medicine: {},
        berries: {},
        battle: {},
        key: {},
        custom: {}
      }
    };
  }

  function sanitizeLoadedBag(raw) {
    const fresh = createEmptyBag();
    try {
      const b = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!b || typeof b !== 'object' || !b.pockets) return fresh;

      for (const k of Object.keys(fresh.pockets)) {
        const dict = (b.pockets && b.pockets[k]) || {};
        const clean = {};
        for (const [id, it] of Object.entries(dict)) {
          if (!it || typeof it !== 'object') continue;
          const qty = Math.max(0, Math.min(999, Number(it.qty || 0)));
          if (qty <= 0) continue;
          clean[id] = {
            id: String(it.id ?? id),
            nameEs: String(it.nameEs ?? id),
            qty,
            sprite: it.sprite ?? null,
            effectText: it.effectText ?? null,
            desc: it.desc ?? null, // <- NUEVO: descripción para custom
          };
        }
        fresh.pockets[k] = clean;
      }
      return fresh;
    } catch (_e) {
      return fresh;
    }
  }

  function loadBagFromStorage() {
    try {
      const raw = localStorage.getItem(BAG_STORAGE_KEY);
      if (!raw) return createEmptyBag();
      return sanitizeLoadedBag(raw);
    } catch (_e) {
      return createEmptyBag();
    }
  }

  function saveBagToStorage(state) {
    try {
      localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('bag:saved'));
    } catch (_e) {}
  }

  /** @type {{ pockets: Pockets }} */
  let bag = loadBagFromStorage();

  // ===== Helpers =====
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const norm = s => (s || '').toLowerCase();
  const slugify = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function getState() { return bag; }

  // Notificaciones (guarda y emite)
  let _onChange = null;
  const notify = () => {
    try {
      saveBagToStorage(getState());
      _onChange && _onChange(getState());
    } catch (_e) {}
  };

  // Deducción de bolsillo desde PokeAPI
  function pocketFromCategory(cat = '') {
    const c = norm(cat);
    if (c.includes('ball')) return 'pokeballs';
    if (c.includes('medicine') || c.includes('healing')) return 'medicine';
    if (c.includes('berry')) return 'berries';
    if (c.includes('vitamin') || c.includes('held') || c.includes('battle')) return 'battle';
    if (c.includes('key')) return 'key';
    return 'battle';
  }
  function mapPocketFromApi(p = '') {
    const c = (p || '').toLowerCase();
    if (c.includes('pokeball')) return 'pokeballs';
    if (c.includes('medicine')) return 'medicine';
    if (c.includes('berry') || c.includes('berries')) return 'berries';
    if (c.includes('key')) return 'key';
    if (c.includes('battle')) return 'battle';
    if (c.includes('machine') || c.includes('tm') || c.includes('hm')) return 'machines';
    return '';
  }

  // ===== Mutaciones =====
  function addItemPack(pocket, item){
    const bucket = bag.pockets[pocket] || (bag.pockets[pocket] = {});
    const prev = bucket[item.id] || {
      id: item.id,
      nameEs: item.nameEs,
      qty: 0,
      sprite: item.sprite ?? null,
      effectText: item.effectText ?? null,
      desc: item.desc ?? null,
    };
    bucket[item.id] = {
      ...prev,
      qty: Math.min(999, prev.qty + (item.qty || 1)),
      sprite: item.sprite ?? prev.sprite ?? null,
      effectText: item.effectText ?? prev.effectText ?? null,
      desc: item.desc ?? prev.desc ?? null,
    };
    notify();
  }

  async function addByIdPokeApi(id, qty){
    const full = await window.ItemsAPI.getItemFull(id);
    const pocketReal = mapPocketFromApi(full.pocket);
    const pocket = pocketReal || pocketFromCategory(full.category);

    addItemPack(pocket, {
      id: full.id,
      nameEs: full.nameEs || full.name,
      qty,
      sprite: full.sprite,
      effectText: full.effectText || null,
      pocket: full.pocket || '',
    });
  }

  // NUEVO: admite descripción para objetos custom
  function addCustom(name, desc = '', qty = 1) {
    const base = slugify(name);
    const slug = base ? `custom-${base}` : `custom-${Date.now()}`;
    addItemPack('custom', { id: slug, nameEs: name || 'Custom', qty, sprite: null, desc: (desc || '').trim() });
  }

  function inc(pocket, id) {
    const it = bag.pockets[pocket]?.[id];
    if (!it) return;
    it.qty = Math.min(999, it.qty + 1);
    notify();
  }
  function dec(pocket, id) {
    const it = bag.pockets[pocket]?.[id];
    if (!it) return;
    it.qty = Math.max(0, it.qty - 1);
    if (it.qty === 0) delete bag.pockets[pocket][id];
    notify();
  }

  // ===== Reserva para Equipar (API pública para futuro) =====
  function equipReserve(id) {
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      if (dict[id]?.qty > 0) {
        const nameEs = dict[id]?.nameEs || id; // leer antes de tocar qty
        dict[id].qty -= 1;
        if (dict[id].qty === 0) delete dict[id];
        notify();
        return { id, nameEs, pocket };
      }
    }
    return null;
  }
  function equipRelease(item) {
    if (!item) return;
    const pocket = item.pocket || (item.id.startsWith('custom-') ? 'custom' : 'battle');
    const nameEs = item.nameEs || item.id;
    addItemPack(pocket, { id: item.id, nameEs, qty: 1, sprite: null });
  }

  // ===== UI =====
  const $dialog = () => $('#bagDialog');
  const $content = () => $('#bagContent');
  const $scroll = () => $('#bagScroll');
  const $tabs = () => $('#bagTabs');
  const $searchInput = () => $('#itemSearchInput');
  const $searchList = () => $('#itemSearchList');
  const $qtyInput = () => $('#itemQtyInput');
  const $addBtn = () => $('#addToBagBtn');
  const $closeBtn = () => $('#closeBag');

  // meta para pestañas
  const POCKET_META = {
    pokeballs: { title: 'Poké Balls', icon: '🟠' },
    medicine:  { title: 'Medicina',   icon: '💊' },
    berries:   { title: 'Bayas',      icon: '🍓' },
    battle:    { title: 'Objetos',    icon: '🛡️' },
    key:       { title: 'Clave',      icon: '🗝️' },
    custom:    { title: 'Custom',     icon: '🧩' },
  };

  let activePocket = 'pokeballs';

  function count(dict) { return Object.values(dict || {}).reduce((n, it) => n + Number(it?.qty || 0), 0); }

  function renderTabs() {
    const html = Object.entries(POCKET_META).map(([key, meta]) => {
      const n = count(bag.pockets[key] || {});
      const isActive = key === activePocket;
      return `<button class="bag-tab ${isActive ? 'active' : ''}" data-pocket="${key}" aria-selected="${isActive ? 'true' : 'false'}" aria-controls="pocket-${key}">
        <span class="icon">${meta.icon}</span>
        <span class="label">${meta.title}</span>
        <span class="count">${n}</span>
      </button>`;
    }).join('');
    $tabs().innerHTML = html;

    $$('#bagTabs .bag-tab').forEach(btn => {
      btn.onclick = () => {
        activePocket = btn.dataset.pocket;
        renderTabs();
        render();
      };
    });
  }

  function itemRow(pocket, pack){
    const qty = Number(pack.qty||0);
    const effect = (pack.effectText || '').replace(/\s+/g,' ').trim();
    const desc = (pack.desc || '').replace(/\s+/g,' ').trim();

    return `
      <div class="bag-item" data-pocket="${pocket}" data-id="${pack.id}">
        <div class="name">
          ${pack.sprite ? `<img loading="lazy" src="${pack.sprite}" alt="${pack.nameEs}" />` : ''}
          <span>${pack.nameEs}</span><br>
          ${effect ? `<small class="effect">${effect}</small>` : ''}
          ${desc && pocket === 'custom' ? `<small class="effect">${desc}</small>` : ''}
        </div>
        <div class="qty">
          <button class="dec" aria-label="Quitar uno">−</button>
          <span class="cnt">${qty}</span>
          <button class="inc" aria-label="Añadir uno">+</button>
        </div>
      </div>
    `;
  }

  // NUEVO: formulario para crear un objeto custom (solo para pestaña 'custom')
  function customForm() {
    return `
      <section class="custom-form">
        <h3>Crear objeto personalizado</h3>
        <div class="field">
          <label for="customName">Nombre</label>
          <input id="customName" type="text" placeholder="Piedra misteriosa" />
        </div>
        <div class="field">
          <label for="customDesc">Descripción</label>
          <textarea id="customDesc" rows="2" placeholder="¿Para qué sirve?"></textarea>
        </div>
        <div class="row" style="justify-content:flex-end;gap:8px">
          <button id="customCreateBtn" class="btn btn-primary">Añadir</button>
        </div>
        <div id="customError" class="muted" style="margin-top:6px;"></div>
      </section>
    `;
  }

  function section(title, pocket) {
    const dict = bag.pockets[pocket] || {};
    const items = Object.values(dict).sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'));
    const listHtml = `<section id="pocket-${pocket}">
      <h3>${title}</h3>
      <div class="list">
        ${items.map(p => itemRow(pocket, p)).join('')}
      </div>
    </section>`;

    if (pocket === 'custom') {
      // Inserta el formulario arriba de la lista
      return customForm() + listHtml;
    }
    return listHtml;
  }

  function wireCustomFormHandlers() {
    const nameInp = $('#customName');
    const descInp = $('#customDesc');
    const btn = $('#customCreateBtn');
    const err = $('#customError');
    if (!nameInp || !descInp || !btn) return;

    btn.onclick = () => {
      const name = (nameInp.value || '').trim();
      const desc = (descInp.value || '').trim();
      if (!name) {
        if (err) err.textContent = 'Ponle un nombre al objeto.';
        return;
      }
      // Si ya existe un id con ese nombre, solo suma 1 a qty y actualiza desc si está vacío
      const id = `custom-${slugify(name)}`;
      const existing = bag.pockets.custom[id];
      if (existing) {
        bag.pockets.custom[id].qty = Math.min(999, (existing.qty || 0) + 1);
        if (!existing.desc && desc) bag.pockets.custom[id].desc = desc;
        notify();
      } else {
        addCustom(name, desc, 1);
      }
      nameInp.value = '';
      descInp.value = '';
      if (err) err.textContent = '';
      render();
    };
  }

  function render() {
    renderTabs();

    const meta = POCKET_META[activePocket] || POCKET_META['pokeballs'];
    const html = section(meta.title, activePocket);
    $content().innerHTML = html;

    // Listeners de items
    $$('#bagContent .bag-item').forEach(row => {
      const pocket = row.dataset.pocket;
      const id = row.dataset.id;
      const $cnt = row.querySelector('.cnt');
      row.querySelector('.inc').onclick = () => { inc(pocket, id); $cnt.textContent = bag.pockets[pocket]?.[id]?.qty || 0; renderTabs(); };
      row.querySelector('.dec').onclick = () => { dec(pocket, id); render(); };
    });

    // Listeners del formulario custom (si procede)
    if (activePocket === 'custom') {
      wireCustomFormHandlers();
    }
  }

  function open() {
    const hasItems = Object.keys(bag.pockets).find(k => Object.keys(bag.pockets[k] || {}).length);
    if (!Object.keys(bag.pockets[activePocket] || {}).length && hasItems) activePocket = hasItems;
    render();
    $dialog().showModal();
  }

  async function setupSearch() {
    const inp = $searchInput(), list = $searchList(), qty = $qtyInput(), btn = $addBtn();
    if (!inp || !list || !qty || !btn) return;
    await window.ItemsAPI.init({ lang: 'es' });
    await window.ItemsAPI.setupAutocomplete(inp, list, { minLength: 1, maxResults: 8 });

    btn.onclick = async () => {
      const id = inp.dataset.selectedId;
      const n = Math.max(1, Number(qty.value || 1));
      if (!id) return;
      await addByIdPokeApi(id, n);
      inp.value = ''; inp.dataset.selectedId = ''; list.hidden = true; list.innerHTML = ''; qty.value = 1;
      render();
    };
  }

  function init() {
    bag = loadBagFromStorage(); // rehidrata por si acaso
    setupSearch();
    const c = $closeBtn(); if (c) c.onclick = () => $dialog().close();
  }

  // API pública
  window.Bag = {
    init, open, render,
    addCustom,                // ahora acepta (name, desc, qty)
    equipReserve, equipRelease,
    getState: () => bag,      // -> incluirá desc de objetos custom
    setState: (state) => {
      if (state && state.pockets) {
        bag = sanitizeLoadedBag(state);  // normaliza (incluye desc)
        saveBagToStorage(bag);           // persistimos lo importado
        render();
        notify();
      }
    },
    onChange: (cb) => { _onChange = cb; },
  };
})();
