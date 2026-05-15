(() => {
  const API = 'https://pokeapi.co/api/v2';
  const DATA_BASE = './data';
  const LS_KEY = 'pokeapi_item_cache_v1.json'; // <- nombre pedido
  const LS_MACHINE_KEY = 'pokeapi_machine_item_moves_v1';

  /** @type {Record<string, any>} */
  let detailCache = {};
  /** caches auxiliares para reducir peticiones */
  /** @type {Record<string, any>} */
  const categoryCache = {};
  /** @type {Record<string, any>} */
  const pocketCache = {};
  /** @type {Record<string, string>} */
  let itemEsIndex = {};
  let moveEsIndex = {};
  let machineByItemId = {};
  let machineIndexReady = false;
  let machineIndexPromise = null;

  /** @type {{ count:number, results: {name:string, url:string}[] } | null} */
  let indexList = null;
  let lang = 'es';
  let indexReady = false;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function fetchJson(url){
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  async function tryLoadData(name, fallback=null){
    try {
      const r = await fetch(`${DATA_BASE}/${name}.json`, { cache: 'no-store' });
      if (!r.ok) throw 0;
      return await r.json();
    } catch { return fallback; }
  }

  async function ensureIndex(){
    if (indexList && Array.isArray(indexList.results) && indexList.results.length) return indexList;

    // 1) primero intenta fichero físico
    const fromFile = await tryLoadData('pokeapi_item_index_v1', null);
    if (fromFile?.results?.length) { indexList = fromFile; return indexList; }

    // 2) fallback PokeAPI
    indexList = await fetchJson(`${API}/item?limit=2000`);
    return indexList;
  }

  async function ensureItemEsIndex(){
    if (Object.keys(itemEsIndex).length) return itemEsIndex;
    const fromFile = await tryLoadData('pokeapi_item_es_v1', null);
    if (fromFile && typeof fromFile === 'object') { itemEsIndex = fromFile; return itemEsIndex; }
    return {};
  }

  async function ensureMoveEsIndex(){
    if (Object.keys(moveEsIndex).length) return moveEsIndex;
    const fromFile = await tryLoadData('pokebox_move_es_v1', null);
    if (fromFile && typeof fromFile === 'object') { moveEsIndex = fromFile; return moveEsIndex; }
    return {};
  }

  function idFromUrl(url){
    const m = url.match(/\/(\d+)\/?$/);
    return m ? m[1] : null;
  }

  function normalize(str){ return (str||'').toLowerCase(); }

  function isMachineItem(item = {}) {
    const name = String(item.name || '').toLowerCase();
    const pocket = String(item.pocket || '').toLowerCase();
    const category = String(item.category || '').toLowerCase();
    return pocket.includes('machine') || category.includes('machine') || /^t[rm]\d+/i.test(name) || /^hm\d+/i.test(name);
  }

  function versionGroupId(entry) {
    const url = entry?.version_group?.url || '';
    return Number((url.match(/\/(\d+)\/?$/) || [])[1] || 0);
  }

  function formatMachineDisplay(item) {
    const base = item.nameEs || item.name || '';
    const move = item.machineMoveEs || item.machineMove || '';
    if (!move) return base;
    if (normalize(base).includes(normalize(move))) return base;
    return `${base} - ${move}`;
  }

  function machineSpriteForType(moveType) {
    const type = String(moveType || '').toLowerCase();
    return type ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-${type}.png` : '';
  }

  function toEsName(names){
    const es = names?.find(n => n.language?.name === lang)?.name;
    const en = names?.find(n => n.language?.name === 'en')?.name;
    return es || en || '';
  }

  function toEffectEs(effects){
    const es = effects?.find(e => e.language?.name === lang)?.short_effect || effects?.find(e => e.language?.name === lang)?.effect;
    const en = effects?.find(e => e.language?.name === 'en')?.short_effect || effects?.find(e => e.language?.name === 'en')?.effect;
    return es || en || '';
  }

  function toFlavorEs(entries) {
  const esEntries = (entries || []).filter(e => e.language?.name === 'es');
  if (!esEntries.length) return '';
  
  // Si hay varias entradas en español, coger la más reciente por versión
  const latest = esEntries.reduce((a, b) => {
    const ida = Number((a.version_group?.url || '').match(/\/(\d+)\/?$/)?.[1] || 0);
    const idb = Number((b.version_group?.url || '').match(/\/(\d+)\/?$/)?.[1] || 0);
    return idb > ida ? b : a;
  });
  
  return latest.text.replace(/\s+/g, ' ').trim();
}

  function loadMachineMapFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_MACHINE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
        machineByItemId = parsed.data;
        machineIndexReady = Object.keys(machineByItemId).length > 0;
        return machineIndexReady;
      }
    } catch {}
    return false;
  }

  async function loadMachineMapFromFile() {
    const fromFile = await tryLoadData('pokeapi_machine_item_moves_v1', null);
    if (!fromFile || typeof fromFile !== 'object') return false;
    const data = fromFile.data && typeof fromFile.data === 'object' ? fromFile.data : fromFile;
    machineByItemId = { ...machineByItemId, ...data };
    machineIndexReady = Object.keys(machineByItemId).length > 0;
    return machineIndexReady;
  }

  function saveMachineMapToLocalStorage() {
    try {
      localStorage.setItem(LS_MACHINE_KEY, JSON.stringify({
        meta: { version: 1, savedAt: new Date().toISOString(), count: Object.keys(machineByItemId).length },
        data: machineByItemId,
      }));
    } catch {}
  }

  async function getMoveNameEs(moveName) {
    if (!moveName) return '';
    await ensureMoveEsIndex();
    return moveEsIndex[moveName] || moveName;
  }

  async function enrichMachineItem(out, rawItemData = null) {
    if (!out || !isMachineItem(out)) return out;

    const mapped = machineByItemId[String(out.id)];
    if (mapped) {
      out.machineMove = mapped.move || '';
      out.machineMoveEs = mapped.moveEs || mapped.move || '';
      out.machineMoveType = mapped.moveType || '';
      out.sprite = machineSpriteForType(out.machineMoveType) || out.sprite;
      out.effectText = mapped.moveDescEs || '';
      out.displayName = formatMachineDisplay(out);
      out.searchText = [out.name, out.nameEs, out.machineMove, out.machineMoveEs, out.machineMoveType, out.effectText].filter(Boolean).join(' ');
      return out;
    }

    try {
      let itemData = rawItemData;
      if (!itemData?.machines?.length) {
        itemData = await fetchJson(`${API}/item/${out.id || out.name}`);
      }
      const machineEntry = (itemData?.machines || [])
        .slice()
        .sort((a, b) => versionGroupId(b) - versionGroupId(a))[0];
      const machineUrl = machineEntry?.machine?.url || machineEntry?.url || '';
      if (!machineUrl) return out;

      const machine = await fetchJson(machineUrl);
      const move = machine?.move?.name || '';
      const moveEs = await getMoveNameEs(move);
      if (!move) return out;

      machineByItemId[String(out.id)] = { move, moveEs, machine: machineUrl, moveDescEs: '' };
      saveMachineMapToLocalStorage();

      out.machineMove = move;
      out.machineMoveEs = moveEs || move;
      out.machineMoveType = '';
      out.effectText = '';
      out.displayName = formatMachineDisplay(out);
      out.searchText = [out.name, out.nameEs, out.machineMove, out.machineMoveEs, out.effectText].filter(Boolean).join(' ');
    } catch {}

    return out;
  }

  async function ensureMachineSearchIndex() {
    if (machineIndexReady && Object.keys(machineByItemId).length) return machineByItemId;
    if (machineIndexPromise) return machineIndexPromise;
    loadMachineMapFromLocalStorage();
    if (await loadMachineMapFromFile()) return machineByItemId;

    machineIndexPromise = (async () => {
      await ensureMoveEsIndex();
      const index = await fetchJson(`${API}/machine?limit=2000`);
      const urls = (index?.results || []).map(r => r.url).filter(Boolean);
      const queue = [...urls];
      const byItem = {};

      async function worker() {
        while (queue.length) {
          const url = queue.shift();
          try {
            const machine = await fetchJson(url);
            const itemId = idFromUrl(machine?.item?.url || '');
            const move = machine?.move?.name || '';
            if (!itemId || !move) continue;
            const moveEs = moveEsIndex[move] || move;
            const prev = byItem[itemId];
            const vg = versionGroupId(machine);
            if (!prev || vg >= Number(prev.versionGroupId || 0)) {
              byItem[itemId] = { move, moveEs, machine: url, versionGroupId: vg, moveDescEs: '' };
            }
          } catch {}
        }
      }

      const workers = Array.from({ length: 8 }, () => worker());
      await Promise.all(workers);
      machineByItemId = { ...machineByItemId, ...byItem };
      machineIndexReady = Object.keys(machineByItemId).length > 0;
      saveMachineMapToLocalStorage();
      return machineByItemId;
    })();

    try {
      return await machineIndexPromise;
    } finally {
      machineIndexPromise = null;
    }
  }


  // === NUEVO: guardar / cargar desde localStorage ===
  function saveDetailCacheToLocalStorage() {
    try {
      const payload = {
        meta: { version: 1, lang, savedAt: new Date().toISOString(), count: Object.keys(detailCache).length },
        data: detailCache, // objeto { [id|name]: item }
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
      return false;
    }
  }

  async function loadDetailCacheIfAny(){
    // 1) intentar localStorage primero
    try {
      const raw = localStorage.getItem(LS_KEY) || localStorage.getItem('pokeapi_item_cache_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
          detailCache = parsed.data;
          return;
        } else if (parsed && typeof parsed === 'object') {
          detailCache = parsed;
          return;
        }
      }
    } catch {}

    // 2) fallback a fichero físico si existiera (compatibilidad)
    const dump = await tryLoadData('pokeapi_item_cache_v1', {});
    if (dump && typeof dump === 'object') detailCache = (dump.data && typeof dump.data === 'object') ? dump.data : dump;
  }

  // --- helpers para pocket ---
  async function getCategory(catRef){
    const key = typeof catRef === 'string' ? catRef : (catRef.name || idFromUrl(catRef.url));
    if (categoryCache[key]) return categoryCache[key];
    const url = typeof catRef === 'string' ? `${API}/item-category/${key}` : catRef.url;
    const json = await fetchJson(url);
    categoryCache[key] = json;
    return json;
  }

  async function getPocket(pocketRef){
    const key = typeof pocketRef === 'string' ? pocketRef : (pocketRef.name || idFromUrl(pocketRef.url));
    if (pocketCache[key]) return pocketCache[key];
    const url = typeof pocketRef === 'string' ? `${API}/item-pocket/${key}` : pocketRef.url;
    const json = await fetchJson(url);
    pocketCache[key] = json;
    return json;
  }

  async function getItemFull(idOrName){
    const key = String(idOrName).toLowerCase();
    if (detailCache[key]) return enrichMachineItem(detailCache[key]);

    const data = await fetchJson(`${API}/item/${key}`);

    // categoría -> pocket
    let pocketSlug = '';
    let pocketEs = '';
    try {
      const category = await getCategory(data.category);
      pocketSlug = category?.pocket?.name || '';
      if (category?.pocket?.url) {
        const pocket = await getPocket(category.pocket);
        pocketEs = toEsName(pocket?.names);
      }
    } catch {}

    const out = {
      id: String(data.id),
      name: data.name,
      nameEs: toEsName(data.names),
      category: data.category?.name || '',
      cost: data.cost ?? null,
      sprite: data.sprites?.default || null,
      // effectText: toEffectEs(data.effect_entries),
  effectText: toFlavorEs(data.flavor_text_entries),
      pocket: pocketSlug || null,
      pocketEs: pocketEs || null,
      machineMove: '',
      machineMoveEs: '',
      displayName: ''
    };

    await enrichMachineItem(out, data);
    if (!out.displayName) out.displayName = out.nameEs || out.name;
    out.searchText = [out.name, out.nameEs, out.displayName, out.machineMove, out.machineMoveEs, out.effectText].filter(Boolean).join(' ');

    detailCache[key] = out;
    detailCache[String(out.id)] = out;
    await sleep(15); // suavizar rate limit
    return out;
  }

  // ==== Autocomplete (igual que antes) ====
  async function setupAutocomplete(input, list, { minLength = 1, maxResults = 10 } = {}) {
    list.classList.add('combo-list');

    // Asegurar índices
    if (!indexList || !Array.isArray(indexList.results)) {
      try { await ensureIndex(); } catch {}
    }
    await ensureItemEsIndex();
    await ensureMoveEsIndex();
    loadMachineMapFromLocalStorage();
    await loadMachineMapFromFile();

    // Construir índice ligero en memoria (sin pedir detalles de cada item)
    const lightIndex = (indexList?.results || []).map(r => {
      const id = idFromUrl(r.url) || r.name || '';
      const nameEn = r.name || '';
      const key = String(id).toLowerCase();
      const cached = detailCache[key] || detailCache[id] || null;
      
      // Priorizar: caché > índice estático > nombre inglés
      let nameEs = (cached && cached.nameEs) || itemEsIndex[nameEn] || '';
      
      return {
        id: String(id),
        nameEs: nameEs,
        name: nameEn,
        sprite: cached?.sprite || null,
        pocketEs: cached?.pocketEs || '',
        effectText: cached?.effectText || '',
        machineMove: cached?.machineMove || '',
        machineMoveEs: cached?.machineMoveEs || '',
        machineMoveType: cached?.machineMoveType || '',
        displayName: cached?.displayName || ''
      };
    });
    const lightById = new Map(lightIndex.map(it => [String(it.id), it]));
    const enrichingVisibleMachines = new Set();

    function isLightMachine(it) {
      return isMachineItem(it) || String(it.pocketEs || '').toLowerCase().includes('mt');
    }

    function mergeFullIntoLight(full) {
      if (!full?.id) return;
      const it = lightById.get(String(full.id));
      if (!it) return;
      it.nameEs = full.nameEs || it.nameEs || full.name || it.name;
      it.name = full.name || it.name;
      it.sprite = full.sprite || it.sprite;
      it.pocketEs = full.pocketEs || it.pocketEs;
      it.effectText = full.effectText ?? it.effectText;
      it.machineMove = full.machineMove || it.machineMove;
      it.machineMoveEs = full.machineMoveEs || it.machineMoveEs;
      it.displayName = full.displayName || formatMachineDisplay(it) || it.displayName;
    }

    function enrichVisibleMachineResults(items, query) {
      const visibleMachines = items.filter(isLightMachine).slice(0, maxResults);
      for (const it of visibleMachines) {
        if (it.machineMoveEs || enrichingVisibleMachines.has(it.id)) continue;
        enrichingVisibleMachines.add(it.id);
        getItemFull(it.id).then(full => {
          mergeFullIntoLight(full);
          if (normalize(input.value) === query) searchAndShow();
        }).catch(() => {}).finally(() => {
          enrichingVisibleMachines.delete(it.id);
        });
      }
    }

    function renderList(items) {
      list.innerHTML = items.map(o => `
        <div class="combo-item" data-id="${o.id}" data-es="${(o.displayName || o.nameEs || o.name).replace(/"/g,'&quot;')}">
          ${o.sprite ? `<img src="${o.sprite}" width="20" height="20" alt="">` : ''}
          <span>${o.displayName || o.nameEs || o.name}</span>
          ${o.pocketEs ? `<em class="pocket">(${o.pocketEs})</em>` : ''}
        </div>
      `).join("");
      list.hidden = items.length === 0;
    }

    async function searchAndShow() {
      const q = normalize(input.value);
      if (q.length < minLength) {
        list.hidden = true;
        list.innerHTML = '';
        return;
      }

      // Priorizar: coincidencias en español (prefijo > contiene) > inglés
      const esPrefix = [];
      const esContains = [];
      const enContains = [];
      const machineContains = [];
      
      for (const it of lightIndex) {
        const mapped = machineByItemId[String(it.id)];
        if (mapped) {
          it.machineMove = mapped.move || '';
          it.machineMoveEs = mapped.moveEs || mapped.move || '';
          it.machineMoveType = mapped.moveType || '';
          it.effectText = mapped.moveDescEs || '';
          it.sprite = machineSpriteForType(it.machineMoveType) || it.sprite;
          it.displayName = formatMachineDisplay({ nameEs: it.nameEs || it.name, machineMoveEs: it.machineMoveEs });
        }
        const es = normalize(it.nameEs || '');
        const en = normalize(it.name || '');
        const display = normalize(it.displayName || '');
        const move = normalize(`${it.machineMove || ''} ${it.machineMoveEs || ''} ${it.machineMoveType || ''} ${it.effectText || ''}`);
        
        if (display && display.startsWith(q)) {
          esPrefix.push(it);
        } else if (es && es.startsWith(q)) {
          esPrefix.push(it);
        } else if ((display && display.includes(q)) || (es && es.includes(q))) {
          esContains.push(it);
        } else if (move && move.includes(q)) {
          machineContains.push(it);
        } else if (en && en.includes(q) && !es) {
          enContains.push(it);
        }
      }

      const results = [
        ...esPrefix.slice(0, maxResults),
        ...esContains.slice(0, Math.max(0, maxResults - esPrefix.length)),
        ...machineContains.slice(0, Math.max(0, maxResults - esPrefix.length - esContains.length)),
        ...enContains.slice(0, Math.max(0, maxResults - esPrefix.length - esContains.length - machineContains.length))
      ];
      renderList(results);
      enrichVisibleMachineResults(results, q);

      if (q.length >= 3 && !machineIndexReady && !machineIndexPromise) {
        ensureMachineSearchIndex().then(() => {
          if (normalize(input.value) === q) searchAndShow();
        }).catch(() => {});
      }
    }

    input.addEventListener('input', searchAndShow);
    document.addEventListener('click', (e) => {
      if (!list.contains(e.target) && e.target !== input) list.hidden = true;
    });
    list.addEventListener('click', async e => {
      const item = e.target.closest('.combo-item');
      if (!item) return;
      input.value = item.dataset.es || (item.textContent || '').trim();
      input.dataset.selectedId = item.dataset.id;
      input.dataset.selectedEs = item.dataset.es;
      list.hidden = true;
      // Calentar caché en background (no bloquear la UI)
      try { getItemFull(item.dataset.id); } catch {}
    });
  }

  // === NUEVO: constructor de cache completo + persistencia en localStorage ===
  async function buildAndPersistCache({ concurrency = 6, saveEvery = 50 } = {}) {
    await ensureIndex();

    const ids = (indexList?.results || [])
      .map(r => idFromUrl(r.url))
      .filter(Boolean);

    let done = 0;

    // pool simple de concurrencia
    const queue = [...ids];
    async function worker() {
      while (queue.length) {
        const id = queue.shift();
        try {
          await getItemFull(id);
        } catch (e) {
          // en caso de error puntual, continuamos
          console.warn('Error item', id, e?.message || e);
        }
        done++;

        // guardado incremental
        if (done % saveEvery === 0) saveDetailCacheToLocalStorage();
      }
    }

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(workers);

    // guardado final
    saveDetailCacheToLocalStorage();

    return {
      totalIndex: ids.length,
      cached: Object.keys(detailCache).length,
      savedToLocalStorage: true,
      localStorageKey: LS_KEY
    };
  }

  async function init(opts={}){
    lang = opts.lang || 'es';
    await loadDetailCacheIfAny();  // ahora también mira localStorage
    await ensureItemEsIndex();     // cargar índice de nombres en español
    await ensureMoveEsIndex();
    loadMachineMapFromLocalStorage();
    await loadMachineMapFromFile();
    try { await ensureIndex(); indexReady = true; } catch { indexReady = false; }
  }

  window.ItemsAPI = {
    init,
    setupAutocomplete,
    getItemFull,
    get searchIndexReady(){ return indexReady; },

    // NUEVO método público
    buildAndPersistCache,
  };
})();
