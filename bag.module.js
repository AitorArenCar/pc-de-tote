// bag.module.js - Mochila con bolsillos por iconos, detalle de objeto y customs editables.
// Depende de: items.api.js (ItemsAPI)

(() => {
  /** @typedef {{ id:string, nameEs:string, qty:number, sprite?:string|null, effectText?:string|null, desc?:null, pocket?:string, custom?:boolean, displayName?:string, machineMove?:string, machineMoveEs?:string, searchText?:string }} ItemPack */

  const BAG_STORAGE_KEY = 'pcdetote_bag_v1';
  const BAG_ACTIVE_POCKET_KEY = 'pcdetote_bag_active_pocket_v1';
  const ITEM_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';

  const POCKET_META = {
    pokeballs: { title: 'Poké Balls', icon: `${ITEM_SPRITE_BASE}poke-ball.png` },
    medicine:  { title: 'Medicina',   icon: `${ITEM_SPRITE_BASE}potion.png` },
    berries:   { title: 'Bayas',      icon: `${ITEM_SPRITE_BASE}nanab-berry.png` },
    battle:    { title: 'Objetos',    icon: `${ITEM_SPRITE_BASE}x-attack.png` },
    machines:  { title: 'MT/MO',      icon: `${ITEM_SPRITE_BASE}tm-normal.png` },
    key:       { title: 'Clave',      icon: `${ITEM_SPRITE_BASE}town-map.png` },
  };
  const POCKET_KEYS = Object.keys(POCKET_META);
  const CUSTOM_ICON = `${ITEM_SPRITE_BASE}odd-keystone.png`;

  function createEmptyBag() {
    return {
      pockets: {
        pokeballs: {},
        medicine: {},
        berries: {},
        battle: {},
        machines: {},
        key: {},
      }
    };
  }

  const $ = sel => document.querySelector(sel);
  const norm = s => (s || '').toLowerCase();
  const slugify = s => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const clampQty = qty => Math.max(0, Math.min(999, Number(qty || 0)));
  const isKnownPocket = pocket => POCKET_KEYS.includes(pocket);
  const isCustomItem = item => !!item?.custom || String(item?.id || '').startsWith('custom-');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function attr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function normalizePocket(pocket, item = null) {
    const p = String(pocket || '').toLowerCase();
    if (isKnownPocket(p)) return p;
    if (p === 'custom') return 'key';
    if (p === 'machine' || p === 'machines' || p.includes('tm') || p.includes('hm')) return 'machines';
    if (p === 'misc' || p === 'items') return 'battle';
    if (isCustomItem(item)) return 'key';
    return 'battle';
  }

  function createCleanPack(id, it, pocket) {
    const cleanId = String(it?.id ?? id);
    const custom = isCustomItem({ ...it, id: cleanId });
    const nameEs = String(it?.nameEs ?? it?.displayName ?? cleanId);
    const machineMoveEs = it?.machineMoveEs ? String(it.machineMoveEs) : '';
    const machineMove = it?.machineMove ? String(it.machineMove) : '';
    const displayName = it?.displayName ? String(it.displayName) : formatMachineLabel({ nameEs, machineMoveEs });

    return {
      id: cleanId,
      nameEs,
      qty: clampQty(it?.qty),
      sprite: it?.sprite ?? null,
      effectText: it?.effectText ?? null,
      desc: null,
      pocket,
      custom,
      displayName,
      machineMove,
      machineMoveEs,
      searchText: it?.searchText ? String(it.searchText) : '',
    };
  }

  function sanitizeLoadedBag(raw) {
    const fresh = createEmptyBag();
    try {
      const b = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!b || typeof b !== 'object' || !b.pockets) return fresh;

      for (const [sourcePocket, dict] of Object.entries(b.pockets || {})) {
        if (!dict || typeof dict !== 'object') continue;
        for (const [id, it] of Object.entries(dict)) {
          if (!it || typeof it !== 'object') continue;
          const pocket = normalizePocket(sourcePocket === 'custom' ? it.pocket : sourcePocket, it);
          const pack = createCleanPack(id, it, pocket);
          if (pack.qty <= 0) continue;
          fresh.pockets[pocket][pack.id] = pack;
        }
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

  /** @type {{ pockets: Record<string, Record<string, ItemPack>> }} */
  let bag = loadBagFromStorage();
  let activePocket = (() => {
    try {
      const saved = localStorage.getItem(BAG_ACTIVE_POCKET_KEY);
      return isKnownPocket(saved) ? saved : 'pokeballs';
    } catch {
      return 'pokeballs';
    }
  })();
  let viewMode = 'list';
  let detailRef = null;
  let _onChange = null;

  function getState() { return bag; }

  const notify = () => {
    try {
      saveBagToStorage(getState());
      _onChange && _onChange(getState());
    } catch (_e) {}
  };

  function rememberPocket() {
    try { localStorage.setItem(BAG_ACTIVE_POCKET_KEY, activePocket); } catch {}
  }

  function formatMachineLabel(item) {
    const base = item?.nameEs || item?.displayName || item?.id || '';
    const move = item?.machineMoveEs || item?.machineMove || '';
    if (!move) return base;
    if (norm(base).includes(norm(move))) return base;
    return `${base} - ${move}`;
  }

  function displayName(pack) {
    if (!pack) return '';
    return pack.displayName || formatMachineLabel(pack) || pack.nameEs || pack.id;
  }

  function searchText(pack) {
    return [
      pack.id,
      pack.nameEs,
      pack.displayName,
      pack.machineMove,
      pack.machineMoveEs,
      pack.effectText,
      pack.searchText,
      pack.pocket,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function iconForPack(pack) {
    if (pack?.sprite) return pack.sprite;
    if (isCustomItem(pack)) return CUSTOM_ICON;
    return POCKET_META[pack?.pocket]?.icon || POCKET_META.battle.icon;
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

  function pocketFromCategory(cat = '') {
    const c = norm(cat);
    if (c.includes('machine') || c.includes('tm') || c.includes('hm')) return 'machines';
    if (c.includes('ball')) return 'pokeballs';
    if (c.includes('medicine') || c.includes('healing')) return 'medicine';
    if (c.includes('berry')) return 'berries';
    if (c.includes('key')) return 'key';
    if (c.includes('vitamin') || c.includes('held') || c.includes('battle')) return 'battle';
    return 'battle';
  }

  function findItemLocation(id) {
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      if (dict?.[id]) return { pocket, pack: dict[id] };
    }
    return null;
  }

  function addItemPack(pocket, item){
    const targetPocket = normalizePocket(pocket, item);
    const bucket = bag.pockets[targetPocket] || (bag.pockets[targetPocket] = {});
    const prev = bucket[item.id] || {
      id: item.id,
      nameEs: item.nameEs,
      qty: 0,
      sprite: item.sprite ?? null,
      effectText: item.effectText ?? null,
      desc: null,
      pocket: targetPocket,
      custom: !!item.custom,
    };

    bucket[item.id] = {
      ...prev,
      nameEs: item.nameEs || prev.nameEs || item.id,
      qty: Math.min(999, Number(prev.qty || 0) + Number(item.qty || 1)),
      sprite: item.sprite ?? prev.sprite ?? null,
      effectText: item.effectText ?? prev.effectText ?? null,
      desc: null,
      pocket: targetPocket,
      custom: !!item.custom || !!prev.custom || String(item.id || '').startsWith('custom-'),
      machineMove: item.machineMove ?? prev.machineMove ?? '',
      machineMoveEs: item.machineMoveEs ?? prev.machineMoveEs ?? '',
      displayName: item.displayName || formatMachineLabel(item) || prev.displayName || prev.nameEs,
      searchText: item.searchText ?? prev.searchText ?? '',
    };
    notify();
  }

  async function addByIdPokeApi(id, qty){
    const full = await window.ItemsAPI.getItemFull(id);
    const pocketReal = mapPocketFromApi(full.pocket);
    const pocket = pocketReal || pocketFromCategory(full.category);
    const nameEs = full.nameEs || full.name;
    const display = full.displayName || formatMachineLabel({ nameEs, machineMoveEs: full.machineMoveEs, machineMove: full.machineMove });

    addItemPack(pocket, {
      id: String(full.id),
      nameEs,
      qty,
      sprite: full.sprite,
      effectText: full.effectText || null,
      pocket,
      custom: false,
      machineMove: full.machineMove || '',
      machineMoveEs: full.machineMoveEs || '',
      displayName: display,
      searchText: full.searchText || '',
    });
  }

  function uniqueCustomId(name) {
    const base = slugify(name) || String(Date.now());
    let id = `custom-${base}`;
    let i = 2;
    while (findItemLocation(id)) {
      id = `custom-${base}-${i}`;
      i += 1;
    }
    return id;
  }

  function addCustom(name, desc = '', qty = 1, pocket = 'key') {
    const cleanName = (name || 'Custom').trim();
    addItemPack(normalizePocket(pocket), {
      id: uniqueCustomId(cleanName),
      nameEs: cleanName,
      qty,
      sprite: null,
      effectText: (desc || '').trim(),
      pocket: normalizePocket(pocket),
      custom: true,
      displayName: cleanName,
    });
  }

  function updateCustom(id, { name, desc, pocket }) {
    const loc = findItemLocation(id);
    if (!loc || !isCustomItem(loc.pack)) return false;

    const targetPocket = normalizePocket(pocket || loc.pocket, loc.pack);
    const updated = {
      ...loc.pack,
      nameEs: (name || loc.pack.nameEs || id).trim(),
      displayName: (name || loc.pack.nameEs || id).trim(),
      effectText: (desc || '').trim(),
      pocket: targetPocket,
      custom: true,
    };

    delete bag.pockets[loc.pocket][id];
    bag.pockets[targetPocket][id] = updated;
    activePocket = targetPocket;
    detailRef = { pocket: targetPocket, id };
    rememberPocket();
    notify();
    return true;
  }

  function inc(pocket, id) {
    const loc = findItemLocation(id);
    if (!loc) return;
    loc.pack.qty = Math.min(999, Number(loc.pack.qty || 0) + 1);
    notify();
  }

  function dec(pocket, id) {
    const loc = findItemLocation(id);
    if (!loc) return;
    loc.pack.qty = Math.max(0, Number(loc.pack.qty || 0) - 1);
    if (loc.pack.qty === 0) delete bag.pockets[loc.pocket][id];
    notify();
  }

  function equipReserve(id) {
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      if (dict[id]?.qty > 0) {
        const pack = dict[id];
        const out = {
          id,
          nameEs: displayName(pack) || pack.nameEs || id,
          pocket,
          effectText: pack.effectText ?? null,
          sprite: pack.sprite ?? null,
          custom: !!pack.custom,
          machineMove: pack.machineMove || '',
          machineMoveEs: pack.machineMoveEs || '',
        };
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
    const pocket = normalizePocket(item.pocket || (String(item.id || '').startsWith('custom-') ? 'key' : 'battle'), item);
    const nameEs = item.nameEs || item.displayName || item.id;
    addItemPack(pocket, {
      id: item.id,
      nameEs,
      qty: 1,
      sprite: item.sprite ?? null,
      effectText: item.effectText ?? null,
      pocket,
      custom: !!item.custom || String(item.id || '').startsWith('custom-'),
      machineMove: item.machineMove || '',
      machineMoveEs: item.machineMoveEs || '',
      displayName: item.displayName || formatMachineLabel(item) || nameEs,
    });
  }

  function listEquipables() {
    /** @type {ItemPack[]} */
    const all = [];
    for (const [pocket, dict] of Object.entries(bag.pockets)) {
      for (const it of Object.values(dict || {})) {
        if ((it?.qty || 0) > 0) all.push({ ...it, pocket });
      }
    }
    return all.sort((a,b) => displayName(a).localeCompare(displayName(b), 'es'));
  }

  function getItemById(id) {
    const loc = findItemLocation(id);
    return loc ? { ...loc.pack, pocket: loc.pocket } : null;
  }

  function setupBagAutocomplete(inp, list, { maxResults = 10, minLength = 0, onSelect } = {}) {
    if (!inp || !list) return;
    const closeList = () => { list.hidden = true; list.innerHTML = ''; };
    const render = (query = '') => {
      const q = norm(query);
      const items = listEquipables().filter(it => !q || searchText(it).includes(q)).slice(0, maxResults);
      if (!items.length) { closeList(); return; }
      list.innerHTML = items.map(it => `
        <button class="combo-item" data-id="${attr(it.id)}" title="${attr((it.effectText||'').replace(/\s+/g,' ').trim())}">
          <span class="label">${escapeHtml(displayName(it))}</span>
          <span class="muted">(${escapeHtml(POCKET_META[it.pocket]?.title || it.pocket)} · x${Number(it.qty || 0)})</span>
        </button>
      `).join('');
      list.hidden = false;
      list.querySelectorAll('.combo-item').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          const chosen = getItemById(id);
          inp.value = chosen ? displayName(chosen) : '';
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

  function equipDiff(prevItem, nextItemId) {
    const prevId = prevItem?.id || null;
    const nextId = nextItemId || null;

    if (prevId && nextId && prevId === nextId) {
      return prevItem;
    }

    if (prevItem) equipRelease(prevItem);

    if (nextId) {
      const reserved = equipReserve(nextId);
      if (reserved) {
        const meta = getItemById(nextId) || reserved;
        return {
          id: nextId,
          nameEs: displayName(meta) || reserved.nameEs,
          pocket: meta.pocket || reserved.pocket,
          effectText: meta.effectText || reserved.effectText || null,
          sprite: meta.sprite || reserved.sprite || null,
          custom: !!meta.custom || !!reserved.custom,
          machineMove: meta.machineMove || reserved.machineMove || '',
          machineMoveEs: meta.machineMoveEs || reserved.machineMoveEs || '',
        };
      }
    }
    return null;
  }

  const $title = () => document.querySelector('#bagTitle');
  const $content = () => document.querySelector('#bagContent');
  const $tabs = () => document.querySelector('#bagTabs');
  const $closeBtn = () => document.querySelector('#closeBag');
  const $openBagAddBtn = () => document.querySelector('#openBagAddBtn');
  const $openCustomItemBtn = () => document.querySelector('#openCustomItemBtn');

  function count(dict) {
    return Object.values(dict || {}).reduce((n, it) => n + Number(it?.qty || 0), 0);
  }

  function currentTitle() {
    if (viewMode === 'add') return 'Mochila -> Añadir objeto';
    if (viewMode === 'custom-create') return 'Mochila -> Crear custom';
    return `Mochila -> ${POCKET_META[activePocket]?.title || 'Objetos'}`;
  }

  function renderTitle() {
    const title = $title();
    if (title) title.textContent = currentTitle();
  }

  function renderTabs() {
    const tabs = $tabs();
    if (!tabs) return;
    tabs.innerHTML = POCKET_KEYS.map(key => {
      const meta = POCKET_META[key];
      const n = count(bag.pockets[key] || {});
      const isActive = key === activePocket && viewMode !== 'add' && viewMode !== 'custom-create';
      return `<button class="bag-tab ${isActive ? 'active' : ''}" data-pocket="${key}" aria-selected="${isActive ? 'true' : 'false'}" title="${attr(meta.title)}" aria-label="${attr(meta.title)}">
        <img src="${attr(meta.icon)}" alt="" />
        <span class="count">${n}</span>
      </button>`;
    }).join('');

    tabs.querySelectorAll('.bag-tab').forEach(btn => {
      btn.onclick = () => {
        activePocket = btn.dataset.pocket;
        viewMode = 'list';
        detailRef = null;
        rememberPocket();
        render();
      };
    });
  }

  function pocketOptions(selectedPocket = 'key') {
    return POCKET_KEYS.map(key => `<option value="${key}" ${key === selectedPocket ? 'selected' : ''}>${escapeHtml(POCKET_META[key].title)}</option>`).join('');
  }

  function itemRow(pocket, pack) {
    return `
      <button class="bag-item" data-pocket="${attr(pocket)}" data-id="${attr(pack.id)}" type="button">
        <span class="bag-item-icon"><img loading="lazy" src="${attr(iconForPack(pack))}" alt="" /></span>
        <span class="bag-item-name">${escapeHtml(displayName(pack))}</span>
        <span class="bag-item-qty">x${Number(pack.qty || 0)}</span>
      </button>
    `;
  }

  function renderListView() {
    const dict = bag.pockets[activePocket] || {};
    const items = Object.values(dict).sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));
    if (!items.length) {
      return `<div class="bag-empty">No hay objetos en ${escapeHtml(POCKET_META[activePocket]?.title || 'este bolsillo')}.</div>`;
    }
    return `<section id="pocket-${attr(activePocket)}" class="bag-list">
      ${items.map(p => itemRow(activePocket, p)).join('')}
    </section>`;
  }

  function renderStepper(pack) {
    return `
      <div class="bag-detail-stepper" data-id="${attr(pack.id)}">
        <button class="bag-detail-dec" type="button" aria-label="Quitar uno">-</button>
        <strong>${Number(pack.qty || 0)}</strong>
        <button class="bag-detail-inc" type="button" aria-label="Añadir uno">+</button>
      </div>
    `;
  }

  function renderDetailView() {
    const loc = detailRef ? findItemLocation(detailRef.id) : null;
    if (!loc) {
      viewMode = 'list';
      detailRef = null;
      return renderListView();
    }
    const pack = loc.pack;
    const pocketTitle = POCKET_META[loc.pocket]?.title || loc.pocket;
    const effect = (pack.effectText || '').replace(/\s+/g, ' ').trim();
    const isCustom = isCustomItem(pack);

    if (isCustom) {
      return `
        <section class="bag-detail">
          <button class="bag-back btn" type="button">&larr; Volver</button>
          <div class="bag-detail-head">
            <img src="${attr(iconForPack(pack))}" alt="" />
            <div>
              <h3>${escapeHtml(displayName(pack))}</h3>
              <p>${escapeHtml(pocketTitle)}</p>
            </div>
          </div>
          ${renderStepper(pack)}
          <div class="bag-custom-editor">
            <label for="customEditName">Nombre</label>
            <input id="customEditName" type="text" value="${attr(pack.nameEs)}" />
            <label for="customEditDesc">Descripción</label>
            <textarea id="customEditDesc" rows="4">${escapeHtml(effect)}</textarea>
            <label for="customEditPocket">Bolsillo</label>
            <select id="customEditPocket">${pocketOptions(loc.pocket)}</select>
            <button id="customSaveBtn" class="btn btn-primary" type="button">Guardar cambios</button>
          </div>
        </section>
      `;
    }

    return `
      <section class="bag-detail">
        <button class="bag-back btn" type="button">&larr; Volver</button>
        <div class="bag-detail-head">
          <img src="${attr(iconForPack(pack))}" alt="" />
          <div>
            <h3>${escapeHtml(displayName(pack))}</h3>
            <p>${escapeHtml(pocketTitle)}</p>
          </div>
        </div>
        ${renderStepper(pack)}
        ${effect ? `<p class="bag-detail-text">${escapeHtml(effect)}</p>` : `<p class="bag-detail-text muted">Sin descripción disponible.</p>`}
      </section>
    `;
  }

  function renderAddView() {
    return `
      <section class="bag-add-view">
        <button class="bag-back btn" type="button">&larr; Volver</button>
        <div class="field">
          <label for="itemSearchInput">Buscar objeto</label>
          <div class="combo bag-add-combo">
            <input id="itemSearchInput" type="text" placeholder="Poké Ball, MT24, Ronquido..." autocomplete="off" />
            <div id="itemSearchList" class="combo-list" hidden></div>
          </div>
        </div>
        <div class="bag-add-row">
          <label for="itemQtyInput">Cantidad</label>
          <input id="itemQtyInput" type="number" min="1" max="999" value="1" />
          <button id="addToBagBtn" class="btn btn-primary" type="button">Añadir</button>
        </div>
      </section>
    `;
  }

  function renderCreateCustomView() {
    return `
      <section class="bag-add-view bag-custom-editor">
        <button class="bag-back btn" type="button">&larr; Volver</button>
        <label for="customCreateName">Nombre</label>
        <input id="customCreateName" type="text" placeholder="Piedra misteriosa" />
        <label for="customCreateDesc">Descripción</label>
        <textarea id="customCreateDesc" rows="4" placeholder="¿Para qué sirve?"></textarea>
        <label for="customCreatePocket">Bolsillo</label>
        <select id="customCreatePocket">${pocketOptions('key')}</select>
        <label for="customCreateQty">Cantidad</label>
        <input id="customCreateQty" type="number" min="1" max="999" value="1" />
        <button id="customCreateBtn" class="btn btn-primary" type="button">Crear objeto</button>
        <div id="customError" class="muted"></div>
      </section>
    `;
  }

  function wireListHandlers() {
    document.querySelectorAll('#bagContent .bag-item').forEach(row => {
      row.onclick = () => {
        activePocket = row.dataset.pocket || activePocket;
        detailRef = { pocket: activePocket, id: row.dataset.id };
        viewMode = 'detail';
        rememberPocket();
        render();
      };
    });
  }

  function wireDetailHandlers() {
    const back = document.querySelector('#bagContent .bag-back');
    if (back) back.onclick = () => { viewMode = 'list'; detailRef = null; render(); };

    const stepper = document.querySelector('#bagContent .bag-detail-stepper');
    if (stepper) {
      const id = stepper.dataset.id;
      stepper.querySelector('.bag-detail-inc')?.addEventListener('click', () => {
        inc(activePocket, id);
        render();
      });
      stepper.querySelector('.bag-detail-dec')?.addEventListener('click', () => {
        dec(activePocket, id);
        if (!findItemLocation(id)) {
          viewMode = 'list';
          detailRef = null;
        }
        render();
      });
    }

    const save = document.querySelector('#customSaveBtn');
    if (save && detailRef) {
      save.onclick = () => {
        const name = (document.querySelector('#customEditName')?.value || '').trim();
        const desc = (document.querySelector('#customEditDesc')?.value || '').trim();
        const pocket = document.querySelector('#customEditPocket')?.value || 'key';
        if (!name) return;
        updateCustom(detailRef.id, { name, desc, pocket });
        render();
      };
    }
  }

  function wireAddViewHandlers() {
    const back = document.querySelector('#bagContent .bag-back');
    if (back) back.onclick = () => { viewMode = 'list'; render(); };

    const inp = document.querySelector('#itemSearchInput');
    const list = document.querySelector('#itemSearchList');
    const qty = document.querySelector('#itemQtyInput');
    const btn = document.querySelector('#addToBagBtn');
    if (!inp || !list || !qty || !btn || !window.ItemsAPI) return;

    window.ItemsAPI.init({ lang: 'es' }).then(() => {
      window.ItemsAPI.setupAutocomplete(inp, list, { minLength: 1, maxResults: 10 });
    }).catch(() => {});

    btn.onclick = async () => {
      const id = inp.dataset.selectedId;
      const n = Math.max(1, Math.min(999, Number(qty.value || 1)));
      if (!id) return;
      await addByIdPokeApi(id, n);
      const loc = findItemLocation(String(id));
      if (loc) activePocket = loc.pocket;
      viewMode = 'list';
      detailRef = null;
      rememberPocket();
      render();
    };
  }

  function wireCreateCustomHandlers() {
    const back = document.querySelector('#bagContent .bag-back');
    if (back) back.onclick = () => { viewMode = 'list'; render(); };

    const btn = document.querySelector('#customCreateBtn');
    if (!btn) return;
    btn.onclick = () => {
      const name = (document.querySelector('#customCreateName')?.value || '').trim();
      const desc = (document.querySelector('#customCreateDesc')?.value || '').trim();
      const pocket = document.querySelector('#customCreatePocket')?.value || 'key';
      const qty = Math.max(1, Math.min(999, Number(document.querySelector('#customCreateQty')?.value || 1)));
      const err = document.querySelector('#customError');
      if (!name) {
        if (err) err.textContent = 'Ponle un nombre al objeto.';
        return;
      }
      addCustom(name, desc, qty, pocket);
      activePocket = normalizePocket(pocket);
      viewMode = 'list';
      rememberPocket();
      render();
    };
  }

  function wireHeaderActions() {
    const addBtn = $openBagAddBtn();
    if (addBtn) addBtn.onclick = () => { viewMode = 'add'; detailRef = null; render(); };
    const customBtn = $openCustomItemBtn();
    if (customBtn) customBtn.onclick = () => { viewMode = 'custom-create'; detailRef = null; render(); };
  }

  function render() {
    if (!$content()) return;
    renderTitle();
    renderTabs();
    wireHeaderActions();

    if (viewMode === 'detail') {
      $content().innerHTML = renderDetailView();
      wireDetailHandlers();
      return;
    }

    if (viewMode === 'add') {
      $content().innerHTML = renderAddView();
      wireAddViewHandlers();
      return;
    }

    if (viewMode === 'custom-create') {
      $content().innerHTML = renderCreateCustomView();
      wireCreateCustomHandlers();
      return;
    }

    $content().innerHTML = renderListView();
    wireListHandlers();
  }

  function open() {
    const hasItems = POCKET_KEYS.find(k => Object.keys(bag.pockets[k] || {}).length);
    if (!Object.keys(bag.pockets[activePocket] || {}).length && hasItems) activePocket = hasItems;
    viewMode = 'list';
    detailRef = null;
    render();
    document.querySelector('#bagDialog')?.showModal();
  }

  function init() {
    bag = loadBagFromStorage();
    const c = $closeBtn();
    if (c) c.onclick = () => document.querySelector('#bagDialog')?.close();
    wireHeaderActions();
  }

  window.Bag = {
    init, open, render,
    addCustom, updateCustom,
    equipReserve, equipRelease,
    listEquipables, getItemById,
    setupBagAutocomplete,
    equipDiff,
    getState: () => bag,
    setState: (state, opts = {}) => {
      if (state && state.pockets) {
        bag = sanitizeLoadedBag(state);
        saveBagToStorage(bag);
        render();
        if (!opts.silent) notify();
      }
    },
    onChange: (cb) => { _onChange = cb; },
  };
})();
