// bag.module.js — Mochila con bolsillos custom UI
// Depende de: items.api.js (ItemsAPI)

(() => {

  /** @typedef {{ id:string, nameEs:string, qty:number, sprite?:string|null }} ItemPack */
  /** @typedef {{
   *   pokeballs: Record<string, ItemPack>;
   *   medicine:  Record<string, ItemPack>;
   *   berries:   Record<string, ItemPack>;
   *   battle:    Record<string, ItemPack>;
   *   key:       Record<string, ItemPack>;
   *   custom:    Record<string, ItemPack>;
   * }} Pockets */

  /** @type {{ pockets: Pockets }} */
  let bag = {
    pockets: {
      pokeballs: {},
      medicine: {},
      berries: {},
      battle: {},
      key: {},
      custom: {}
    }
  };

  // ===== Helpers =====
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const norm = s => (s || '').toLowerCase();

  // Notificaciones a quien consuma la mochila
  let _onChange = null;
  const notify = () => { try { _onChange && _onChange(getState()); } catch (_e) { } };

  // Deducción de bolsillo desde la categoría PokeAPI (en inglés)
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
    if (c.includes('berry') || c.includes('berries')) return 'berries'; // ← cubre ambos
    if (c.includes('key')) return 'key';
    if (c.includes('battle')) return 'battle';
    if (c.includes('machine') || c.includes('tm') || c.includes('hm')) return 'machines';
    return ''; // vacío => que decida la heurística vieja
  }


  // ===== Mutaciones =====
  // function addItemPack(pocket, item) {
  //   const bucket = bag.pockets[pocket] || (bag.pockets[pocket] = {});
  //   const prev = bucket[item.id] || { id: item.id, nameEs: item.nameEs, qty: 0, sprite: item.sprite ?? null };
  //   bucket[item.id] = { ...prev, qty: Math.min(999, prev.qty + (item.qty || 1)), sprite: item.sprite ?? prev.sprite ?? null };
  //   notify();
  // }

  function addItemPack(pocket, item){
  const bucket = bag.pockets[pocket] || (bag.pockets[pocket] = {});
const prev = bucket[item.id] || {
  id: item.id,
  nameEs: item.nameEs,
  qty: 0,
  sprite: item.sprite ?? null,
  effectText: item.effectText ?? null
};
bucket[item.id] = {
  ...prev,
  qty: Math.min(999, prev.qty + (item.qty || 1)),
  sprite: item.sprite ?? prev.sprite ?? null,
  effectText: item.effectText ?? prev.effectText ?? null
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



  function addCustom(name, qty = 1) {
    const slug = 'custom-' + norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    addItemPack('custom', { id: slug, nameEs: name, qty, sprite: null });
  }

  function inc(pocket, id) { const it = bag.pockets[pocket]?.[id]; if (!it) return; it.qty = Math.min(999, it.qty + 1); notify(); }
  function dec(pocket, id) { const it = bag.pockets[pocket]?.[id]; if (!it) return; it.qty = Math.max(0, it.qty - 1); if (it.qty === 0) delete bag.pockets[pocket][id]; notify(); }

  // ===== Reserva para Equipar (API pública para futuro) =====
  function equipReserve(id) {
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      if (dict[id]?.qty > 0) {
        dict[id].qty -= 1; if (dict[id].qty === 0) delete dict[id]; notify();
        return { id, nameEs: dict[id]?.nameEs || id, pocket };
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

  // meta para pestañas (iconos en emoji sustituibles por SVG)
  const POCKET_META = {
    pokeballs: { title: 'Poké Balls', icon: '🟠' },
    medicine: { title: 'Medicina', icon: '💊' },
    berries: { title: 'Bayas', icon: '🍓' },
    battle: { title: 'Objetos', icon: '🛡️' },
    key: { title: 'Clave', icon: '🗝️' },
    custom: { title: 'Custom', icon: '🧩' },
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


  function section(title, pocket) {
    const dict = bag.pockets[pocket] || {};
    const items = Object.values(dict).sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'));
    return `<section id="pocket-${pocket}">
      <h3>${title}</h3>
      <div class="list">
        ${items.map(p => itemRow(pocket, p)).join('')}
      </div>
    </section>`;
  }

  function render() {
    renderTabs();

    const meta = POCKET_META[activePocket] || POCKET_META['pokeballs'];
    const html = section(meta.title, activePocket);
    $content().innerHTML = html;

    $$('#bagContent .bag-item').forEach(row => {
      const pocket = row.dataset.pocket;
      const id = row.dataset.id;
      const $cnt = row.querySelector('.cnt');
      row.querySelector('.inc').onclick = () => { inc(pocket, id); $cnt.textContent = bag.pockets[pocket]?.[id]?.qty || 0; renderTabs(); };
      row.querySelector('.dec').onclick = () => { dec(pocket, id); render(); };
    });
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
    await window.ItemsAPI.setupAutocomplete(inp, list, { minLength: 1, maxResults: 8 }); // <- busca desde 1 char y en cada pulsación

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
    setupSearch();
    const c = $closeBtn(); if (c) c.onclick = () => $dialog().close();
  }

  window.Bag = {
    init, open, render,
    addCustom,
    equipReserve, equipRelease,
    getState: () => bag,
    setState: (state) => { if (state && state.pockets) { bag = JSON.parse(JSON.stringify(state)); render(); } },
    onChange: (cb) => { _onChange = cb; },
  };
})();