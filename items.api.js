(() => {
  const API = 'https://pokeapi.co/api/v2';
  const DATA_BASE = './data';
  const LS_KEY = 'pokeapi_item_cache_v1.json'; // <- nombre pedido

  /** @type {Record<string, any>} */
  let detailCache = {};
  /** caches auxiliares para reducir peticiones */
  /** @type {Record<string, any>} */
  const categoryCache = {};
  /** @type {Record<string, any>} */
  const pocketCache = {};
  /** @type {Record<string, string>} */
  let itemEsIndex = {};

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

  function idFromUrl(url){
    const m = url.match(/\/(\d+)\/?$/);
    return m ? m[1] : null;
  }

  function normalize(str){ return (str||'').toLowerCase(); }

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
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
          detailCache = parsed.data;
          return;
        }
      }
    } catch {}

    // 2) fallback a fichero físico si existiera (compatibilidad)
    const dump = await tryLoadData('pokeapi_item_cache_v1', {});
    if (dump && typeof dump === 'object') detailCache = dump;
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
    if (detailCache[key]) return detailCache[key];

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
      pocketEs: pocketEs || null
    };

    detailCache[key] = out;
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
        pocketEs: cached?.pocketEs || ''
      };
    });

    function renderList(items) {
      list.innerHTML = items.map(o => `
        <div class="combo-item" data-id="${o.id}" data-es="${(o.nameEs || o.name).replace(/"/g,'&quot;')}">
          ${o.sprite ? `<img src="${o.sprite}" width="20" height="20" alt="">` : ''}
          <span>${o.nameEs || o.name}</span>
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
      
      for (const it of lightIndex) {
        const es = normalize(it.nameEs || '');
        const en = normalize(it.name || '');
        
        if (es && es.startsWith(q)) {
          esPrefix.push(it);
        } else if (es && es.includes(q)) {
          esContains.push(it);
        } else if (en && en.includes(q) && !es) {
          enContains.push(it);
        }
      }

      const results = [
        ...esPrefix.slice(0, maxResults),
        ...esContains.slice(0, Math.max(0, maxResults - esPrefix.length)),
        ...enContains.slice(0, Math.max(0, maxResults - esPrefix.length - esContains.length))
      ];
      renderList(results);
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
