// bag.module.js — Mochila con bolsillos custom UI (persistencia + formulario para "Custom")
// Depende de: items.api.js (ItemsAPI)

(() => {
  /** @typedef {{ id:string, nameEs:string, qty:number, sprite?:string|null, effectText?:string|null, desc?:null, pocket?:string }} ItemPack */
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
            desc: null, // desc ya no se usa
            pocket: it.pocket ?? undefined,
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
      desc: null,
      pocket,
    };
    bucket[item.id] = {
      ...prev,
      qty: Math.min(999, prev.qty + (item.qty || 1)),
      sprite: item.sprite ?? prev.sprite ?? null,
      effectText: item.effectText ?? prev.effectText ?? null,
      desc: null,
      pocket,
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
      pocket: pocketReal || full.pocket || '',
    });
  }

  // Custom: descripción va en effectText; desc siempre null
  function addCustom(name, desc = '', qty = 1) {
    const base = slugify(name);
    const slug = base ? `custom-${base}` : `custom-${Date.now()}`;
    addItemPack('custom', {
      id: slug,
      nameEs: name || 'Custom',
      qty,
      sprite: null,
      effectText: (desc || '').trim(),
      pocket: 'custom',
    });
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

  // ===== Reserva para Equipar (API pública) =====
  function equipReserve(id) {
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      if (dict[id]?.qty > 0) {
        const pack = dict[id];
        const out = { id, nameEs: pack.nameEs || id, pocket, effectText: pack.effectText ?? null, sprite: pack.sprite ?? null };
        dict[id].qty -= 1;
        if (dict[id].qty === 0) delete dict[id];
        notify();
        return out;
      }
    }
    return null;
  }
  function equipRelease(item) {
    if (!item) return;
    const pocket = item.pocket || (item.id.startsWith('custom-') ? 'custom' : 'battle');
    const nameEs = item.nameEs || item.id;
    addItemPack(pocket, { id: item.id, nameEs, qty: 1, sprite: item.sprite ?? null, effectText: item.effectText ?? null, pocket });
  }

  // ===== Listados / búsquedas para equipar =====
  function listEquipables() {
    /** @type {ItemPack[]} */
    const all = [];
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      for (const it of Object.values(dict)) {
        if ((it?.qty || 0) > 0) all.push({ ...it, pocket });
      }
    }
    return all.sort((a,b) => a.nameEs.localeCompare(b.nameEs, 'es'));
  }

  function getItemById(id) {
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      if (dict[id]) return { ...dict[id], pocket };
    }
    return null;
  }

  // Autocompletado para elegir objeto equipado (sin depender de ItemsAPI)
  function setupBagAutocomplete(inp, list, { maxResults = 10, minLength = 0, onSelect } = {}) {
    if (!inp || !list) return;
    const closeList = () => { list.hidden = true; list.innerHTML = ''; };
    const render = (query = '') => {
      const q = norm(query);
      const items = listEquipables().filter(it => !q || norm(it.nameEs).includes(q)).slice(0, maxResults);
      if (!items.length) { closeList(); return; }
      const html = items.map(it => `
        <button class="combo-item" data-id="${it.id}" title="${(it.effectText||'').replace(/\\s+/g,' ').trim()}">
          <span class="label">${it.nameEs}</span>
          <span class="muted">(${it.pocket} · x${it.qty})</span>
        </button>
      `).join('');
      list.innerHTML = html;
      list.hidden = false;
      list.querySelectorAll('.combo-item').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          const chosen = getItemById(id);
          inp.value = chosen ? chosen.nameEs : '';
          inp.dataset.selectedId = id || '';
          list.hidden = true;
          list.innerHTML = '';
          onSelect && onSelect(chosen || null);
        };
      });
    };
    inp.addEventListener('input', () => {
      const val = inp.value || '';
      if (val.length < minLength) { closeList(); return; }
      render(val);
    });
    inp.addEventListener('focus', () => {
      if ((inp.value || '').length >= minLength) render(inp.value);
    });
    document.addEventListener('click', (e) => {
      if (!list.contains(e.target) && e.target !== inp) closeList();
    });
  }

  /**
   * Aplica el diff de equipado: quita prev (si lo hay) y reserva next (si existe).
   * @param {{id:string,nameEs:string,pocket?:string,effectText?:string,sprite?:string}|null} prevItem
   * @param {string|undefined|null} nextItemId
   * @returns {{id:string,nameEs:string,pocket?:string,effectText?:string,sprite?:string}|null}
   */
  function equipDiff(prevItem, nextItemId) {
    const prevId = prevItem?.id || null;
    const nextId = nextItemId || null;

    if (prevId && nextId && prevId === nextId) {
      return prevItem;
    }

    if (prevItem) {
      equipRelease(prevItem);
    }

    if (nextId) {
      const reserved = equipReserve(nextId);
      if (reserved) {
        const meta = getItemById(nextId) || reserved;
        return { id: nextId, nameEs: meta.nameEs || reserved.nameEs, pocket: meta.pocket || reserved.pocket, effectText: meta.effectText || reserved.effectText || null, sprite: meta.sprite || reserved.sprite || null };
      }
    }
    return null;
  }

  // ===== UI =====
  const $dialog = () => document.querySelector('#bagDialog');
  const $content = () => document.querySelector('#bagContent');
  const $tabs = () => document.querySelector('#bagTabs');
  const $searchInput = () => document.querySelector('#itemSearchInput');
  const $searchList = () => document.querySelector('#itemSearchList');
  const $qtyInput = () => document.querySelector('#itemQtyInput');
  const $addBtn = () => document.querySelector('#addToBagBtn');
  const $closeBtn = () => document.querySelector('#closeBag');

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

    document.querySelectorAll('#bagTabs .bag-tab').forEach(btn => {
      btn.onclick = () => {
        activePocket = btn.dataset.pocket;
        renderTabs();
        render();
      };
    });
  }

  function itemRow(pocket, pack){
    const qty = Number(pack.qty||0);
    const effect = (pack.effectText || '').replace(/\\s+/g,' ').trim();

    return `
      <div class="bag-item" data-pocket="${pocket}" data-id="${pack.id}">
        <div class="name">
          ${pack.sprite ? `<img loading="lazy" src="${pack.sprite}" alt="${pack.nameEs}" />` : ''}
          <span>${pack.nameEs}</span><br>
          ${effect ? `<small class="effect">${effect}</small>` : ''}
        </div>
        <div class="qty">
          <button class="dec" aria-label="Quitar uno">−</button>
          <span class="cnt">${qty}</span>
          <button class="inc" aria-label="Añadir uno">+</button>
        </div>
      </div>
    `;
  }

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
      return customForm() + listHtml;
    }
    return listHtml;
  }

  function wireCustomFormHandlers() {
    const nameInp = document.querySelector('#customName');
    const descInp = document.querySelector('#customDesc');
    const btn = document.querySelector('#customCreateBtn');
    const err = document.querySelector('#customError');
    if (!nameInp || !descInp || !btn) return;

    btn.onclick = () => {
      const name = (nameInp.value || '').trim();
      const desc = (descInp.value || '').trim();
      if (!name) {
        if (err) err.textContent = 'Ponle un nombre al objeto.';
        return;
      }
      const id = `custom-${slugify(name)}`;
      const existing = bag.pockets.custom[id];
      if (existing) {
        bag.pockets.custom[id].qty = Math.min(999, (existing.qty || 0) + 1);
        if (!existing.effectText && desc) bag.pockets.custom[id].effectText = desc;
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

    document.querySelectorAll('#bagContent .bag-item').forEach(row => {
      const pocket = row.dataset.pocket;
      const id = row.dataset.id;
      const $cnt = row.querySelector('.cnt');
      row.querySelector('.inc').onclick = () => { inc(pocket, id); $cnt.textContent = bag.pockets[pocket]?.[id]?.qty || 0; renderTabs(); };
      row.querySelector('.dec').onclick = () => { dec(pocket, id); render(); };
    });

    if (activePocket === 'custom') {
      wireCustomFormHandlers();
    }
  }

  function open() {
    const hasItems = Object.keys(bag.pockets).find(k => Object.keys(bag.pockets[k] || {}).length);
    if (!Object.keys(bag.pockets[activePocket] || {}).length && hasItems) activePocket = hasItems;
    render();
    document.querySelector('#bagDialog').showModal();
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
    bag = loadBagFromStorage();
    setupSearch();
    const c = $closeBtn(); if (c) c.onclick = () => document.querySelector('#bagDialog').close();
  }

  window.Bag = {
    init, open, render,
    addCustom,
    equipReserve, equipRelease,
    listEquipables, getItemById,
    setupBagAutocomplete,
    equipDiff,
    getState: () => bag,
    setState: (state) => {
      if (state && state.pockets) {
        bag = sanitizeLoadedBag(state);
        saveBagToStorage(bag);
        render();
        notify();
      }
    },
    onChange: (cb) => { _onChange = cb; },
  };
})();
