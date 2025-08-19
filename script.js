(() => {
    const API = 'https://pokeapi.co/api/v2';
    // LocalStorage keys
    const LS_DB = 'pokebox_last_backup_v1';
    const LS_NAME = 'pokebox_last_name_v1';
    const LS_MOVE_ES = 'pokebox_move_es_v1';
    const LS_BALL_ES = 'pokebox_ball_es_v1';
    const LS_ABILITY_ES = 'pokebox_ability_es_v1';
    const LS_NATURE_ES = 'pokebox_nature_es_v1';
    const DATA_BASE = './data';
    async function loadDataJson(baseName, fallback = null) {
        try {
            const r = await fetch(`${DATA_BASE}/${baseName}.json`, { cache: 'no-store' });
            if (!r.ok) throw 0;
            return await r.json();
        } catch {
            return fallback;
        }
    }

    // ===== Tipos (ES + color) =====
    const TYPE_META = {
        normal: { es: 'Normal', bg: '#A8A77A', fg: '#0b1020' },
        fire: { es: 'Fuego', bg: '#EE8130', fg: '#0b1020' },
        water: { es: 'Agua', bg: '#6390F0', fg: '#ffffff' },
        electric: { es: 'Eléctrico', bg: '#F7D02C', fg: '#0b1020' },
        grass: { es: 'Planta', bg: '#7AC74C', fg: '#0b1020' },
        ice: { es: 'Hielo', bg: '#96D9D6', fg: '#0b1020' },
        fighting: { es: 'Lucha', bg: '#C22E28', fg: '#ffffff' },
        poison: { es: 'Veneno', bg: '#A33EA1', fg: '#ffffff' },
        ground: { es: 'Tierra', bg: '#E2BF65', fg: '#0b1020' },
        flying: { es: 'Volador', bg: '#A98FF3', fg: '#0b1020' },
        psychic: { es: 'Psíquico', bg: '#F95587', fg: '#ffffff' },
        bug: { es: 'Bicho', bg: '#A6B91A', fg: '#0b1020' },
        rock: { es: 'Roca', bg: '#B6A136', fg: '#0b1020' },
        ghost: { es: 'Fantasma', bg: '#735797', fg: '#ffffff' },
        dragon: { es: 'Dragón', bg: '#6F35FC', fg: '#ffffff' },
        dark: { es: 'Siniestro', bg: '#705746', fg: '#ffffff' },
        steel: { es: 'Acero', bg: '#B7B7CE', fg: '#0b1020' },
        fairy: { es: 'Hada', bg: '#D685AD', fg: '#0b1020' },
    };
    const typeEs = id => TYPE_META[id]?.es || id;
    const typeChip = id => {
        const m = TYPE_META[id] || {};
        const es = m.es || id;
        const bg = m.bg || 'rgba(255,255,255,.06)';
        const fg = m.fg || '#0b1020';
        return `<span class="chip type-chip" style="background:${bg};color:${fg};border-color:${bg}">${es}</span>`;
    };

    // ===== Items para la mochila =====
    // Catálogo de objetos curativos
    const ITEM_CATALOG = {
        potion: { name: 'Poción', heal: 20 },
        super_potion: { name: 'Superpoción', heal: 50 },
        hyper_potion: { name: 'Hiperpoción', heal: 200 },
        max_potion: { name: 'Maxipoción', heal: 'full' } // cura total
    };


    /** @type {Array<{id:string,dexId:number,name:string,types:string[],sprite:string,
     * moves?:Array<{id:string,nameEs:string}>, ball?:{id:string,nameEs:string}, nature?:{id:string,nameEs:string, up?:string, down?:string},
     * gender?:'male'|'female'|'unknown', ability?:{id:string,nameEs:string}, num?:string|null,
     * stats?:{hp?:number,atk?:number,def?:number,spa?:number,spd?:number,spe?:number},
     * inTeam?: boolean
     *}>} */
    let db = [];
    let dirty = false;
    let currentFileName = null;

    // Caches/índices
    let pokemonIndex = null; // {names:[]}
    let moveIndex = null;    // {names:[]} (ids EN)
    let natureIndex = null;  // [{id, nameEs, up, down}] (compat)
    let ballIndex = null;    // [{id}]
    let abilityIndex = null; // array de ids EN

    let moveEsCache = {};    // { idEN: nombreES }
    let ballEsCache = {};    // { idEN: nombreES }
    let abilityEsCache = {}; // { idEN: nombreES }
    let natureEsCache = {};  // { idEN: { nameEs, up, down } }

    // Índice ligero solo con IDs de naturalezas
    let natureIdList = null; // ['adamant','timid',...]

    window.Bag?.init?.();
    window.POKE_INDEX = new Map();

    // ===== UI REFS =====
    const $grid = document.getElementById('grid');
    const $empty = document.getElementById('empty');
    let $statusBtn, $statusMenu;
    const $openInput = document.getElementById('openInput');
    const $openBtn = document.getElementById('openBtn');
    const $saveBtn = document.getElementById('saveBtn');
    const $addBtn = document.getElementById('addBtn');
    const $teamBtn = document.getElementById('teamBtn');

    // Dialog Añadir
    const $dialog = document.getElementById('addDialog');
    const $closeDialog = document.getElementById('closeDialog');
    const $query = document.getElementById('query');
    const $searchBtn = document.getElementById('searchBtn');
    const $feedback = document.getElementById('feedback');
    const $matches = document.getElementById('matches');
    const $result = document.getElementById('searchResult');
    const $extra = document.getElementById('extraFields');
    const $gender = document.getElementById('genderSelect');

    const $ballInput = document.getElementById('ballInput');
    const $ballMatches = document.getElementById('ballMatches');
    const $natureInput = document.getElementById('natureInput');
    const $natureMatches = document.getElementById('natureMatches');
    const $confirm = document.getElementById('confirmBtn');

    // Dialog Detalle
    const $detailDialog = document.getElementById('detailDialog');
    const $detailTitle = document.getElementById('detailTitle');
    const $detailContent = document.getElementById('detailContent');
    const $closeDetail = document.getElementById('closeDetail');
    if ($closeDetail) {
        $closeDetail.addEventListener('click', () => {
            const t = document.querySelector('.ability-tooltip');
            if (t) t.remove();
            $detailDialog.close();
        });
    }

    const $editDetail = document.getElementById('editDetail');
    let editMode = false;
    let editingId = null;


    // Dialog Equipo
    const $teamDialog = document.getElementById('teamDialog');
    const $teamContent = document.getElementById('teamContent');
    const $closeTeam = document.getElementById('closeTeam');





    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    const norm = s => (s || '').toLowerCase();

    // ==== Sprites de Poké Ball (PokeAPI) ====
    const BALL_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';
    function ballSpriteUrl(ballId) {
        // p.ej. 'ultra-ball' -> .../ultra-ball.png
        return `${BALL_SPRITE_BASE}${ballId}.png`;
    }

    // ==== Icono SVG de equipo (misma pokéball lineal que en las tarjetas) ====
    function teamIconSVG(inTeam) {
        // usamos clases para colorear igual que fuera: .team-si llena en rojo
        const cls = inTeam ? 'team-icon team-si' : 'team-icon team-no';
        return `
  <span class="${cls}" aria-hidden="true" title="${inTeam ? 'En el equipo' : 'Fuera del equipo'}">
    <svg class="pokeicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <circle class="poke-fill" cx="12" cy="12" r="9"/>
      <circle class="poke-stroke" cx="12" cy="12" r="9"/>
      <path class="poke-stroke" d="M3 12h7"/>
      <path class="poke-stroke" d="M14 12h7"/>
      <circle class="poke-stroke" cx="12" cy="12" r="3"/>
    </svg>
  </span>`;
    }

    // ===== Persistencia =====
    // function backup() {
    //     try {
    //         localStorage.setItem(LS_DB, JSON.stringify(db));
    //         if (currentFileName) localStorage.setItem(LS_NAME, currentFileName);
    //         localStorage.setItem(LS_MOVE_ES, JSON.stringify(moveEsCache));
    //         localStorage.setItem(LS_BALL_ES, JSON.stringify(ballEsCache));
    //         localStorage.setItem(LS_ABILITY_ES, JSON.stringify(abilityEsCache));
    //         localStorage.setItem(LS_NATURE_ES, JSON.stringify(natureEsCache));
    //         const bagState = window.Bag?.getState?.() || null;
    //         localStorage.setItem('pokebox_bag_v2', JSON.stringify(bagState));
    //         // tras guardar, si ya estaba inicializado, fuerza un render
    //         if (window.Bag?.render) window.Bag.render();
    //     } catch { }
    // }



    // function restore() {
    //     try {
    //         const raw = localStorage.getItem(LS_DB);
    //         if (raw) {
    //             const arr = JSON.parse(raw);
    //             if (Array.isArray(arr)) {
    //                 // Asegurar id y flag inTeam
    //                 db = arr.map(x => ({
    //                     id: x.id || uuid(),
    //                     inTeam: !!x.inTeam,
    //                     ...x
    //                 }));
    //             }
    //         }
    //         currentFileName = localStorage.getItem(LS_NAME) || null;
    //         moveEsCache = JSON.parse(localStorage.getItem(LS_MOVE_ES) || '{}');
    //         ballEsCache = JSON.parse(localStorage.getItem(LS_BALL_ES) || '{}');
    //         abilityEsCache = JSON.parse(localStorage.getItem(LS_ABILITY_ES) || '{}');
    //         natureEsCache = JSON.parse(localStorage.getItem(LS_NATURE_ES) || '{}');

    //         if (window.Bag?.render) window.Bag.render();

    //         render(); updateStatus(); updateTeamBtnLabel();
    //     } catch { }
    // }

    // ===== Persistencia =====
    function backup() {
        try {
            // solo lo personal: tu base y el nombre del archivo
            localStorage.setItem(LS_DB, JSON.stringify(db));
            if (currentFileName) localStorage.setItem(LS_NAME, currentFileName);        } catch { }
    }

    async function restore() {
        try {
            // Tu base (DB) desde localStorage para mantener compatibilidad
            const raw = localStorage.getItem(LS_DB);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    db = arr.map(x => ({
                        id: x.id || (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)),
                        inTeam: !!x.inTeam,
                        ...x
                    }));
                }
            }

            currentFileName = localStorage.getItem(LS_NAME) || null;

            // === CARGA ESTÁTICOS DESDE /data ===
            // Mapas ES
            moveEsCache = await loadDataJson('pokebox_move_es_v1', {}) || {};
            ballEsCache = await loadDataJson('pokebox_ball_es_v1', {}) || {};
            abilityEsCache = await loadDataJson('pokebox_ability_es_v1', {}) || {};
            natureEsCache = await loadDataJson('pokebox_nature_es_v1', {}) || {};

            // Índices (si existen en /data) — se usan como primer intento
            // (los ensure* tendrán fallback online si no hay fichero)
            // Nota: no asignamos aquí; los ensure* sabrán mirar primero en /data

            // re-render mochila si procede
            if (window.Bag?.render) window.Bag.render();

            render();
            updateStatus();
            updateTeamBtnLabel();
        } catch { }
    }



    function setDirty(v) { dirty = v; updateStatus(); backup(); }
    function updateStatus() {
        const text = currentFileName
            ? `${currentFileName}${dirty ? ' • cambios sin guardar' : ''}`
            : `Sin archivo abierto${dirty ? ' • cambios sin guardar' : ''}`;
        if ($statusBtn) {
            $statusBtn.textContent = text;
            // añade la flechita del ::after con un span si quieres, pero el CSS current ya la pone
            $statusBtn.title = text;
        }
    }


    // ===== Helpers Equipo =====
    function teamCount() {
        return db.reduce((n, p) => n + (p.inTeam ? 1 : 0), 0);
    }
    function updateTeamBtnLabel() {
        if ($teamBtn) $teamBtn.textContent = `Equipo (${teamCount()})`;
    }
    function toggleTeam(p) {
        if (p.inTeam) {
            p.inTeam = false;
            setDirty(true);
            render();
            return;
        }
        // añadir
        if (teamCount() >= 6) {
            alert('Tu equipo ya tiene 6 Pokémon. Quita uno para añadir otro.');
            return;
        }
        p.inTeam = true;
        setDirty(true);
        render();
    }
    function showTeamList() {
        const team = db.filter(x => x.inTeam).sort((a, b) => a.dexId - b.dexId);

        if (!team.length) {
            $teamContent.innerHTML = `<div class="muted" style="padding:12px">No tienes Pokémon en el equipo todavía.</div>`;
        } else {
            $teamContent.innerHTML = team.map(p => `
      <button class="team-item" data-id="${p.id}" title="#${p.dexId}">
        <img src="${p.sprite}" alt="${p.name}" width="64" height="64" />
        <div class="team-name">${cap(p.name)} <span class="muted">#${p.dexId}</span></div>
      </button>
    `).join('');
        }

        // Abrir
        $teamDialog.showModal();

        // Click en cada item -> abrir detalle y cerrar el diálogo
        $teamContent.querySelectorAll('.team-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const pk = db.find(x => x.id === id);
                if (pk) {
                    $teamDialog.close();
                    showDetails(pk);
                }
            });
        });
    }

    function appendAddCard() {
        const add = document.createElement('button');
        add.className = 'poke add-card';
        add.type = 'button';
        add.title = 'Añadir Pokémon';
        add.innerHTML = `<div class="add-plus">＋</div><div class="add-label">Añadir</div>`;
        // Reutilizamos el click del botón de la cabecera:
        add.addEventListener('click', () => {
            // esto dispara exactamente la misma lógica que ya tienes en $addBtn
            document.getElementById('addBtn')?.click();
        });
        $grid.appendChild(add);
    }


// ===== Render caja =====
function render() {
  $grid.innerHTML = '';
  if (!db.length) {
    $empty.hidden = false;
    updateTeamBtnLabel();
    return;
  }
  $empty.hidden = true;

  for (const p of db) {
    // Asegura EXP/Nv y indexa para refrescos inline
    ensureExpFields?.(p);
    window.POKE_INDEX?.set(p.id, p);

    const card = document.createElement('div');
    card.className = 'poke';
    card.setAttribute('data-pid', p.id);   // <-- para refrescar nivel en vivo

    const typesEs = (p.types || []).map(typeEs).join(' / ');
    card.title = `#${p.dexId} · ${cap(p.name)} ( ${typesEs} )`;

    const img = document.createElement('img');
    img.alt = p.name;
    img.loading = 'lazy';
    img.src = p.sprite || '';

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = (p.num && String(p.num).length) ? p.num : `#${p.dexId}`;
    tag.title = 'Doble clic para editar número personal';
    tag.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      const current = p.num ?? '';
      const next = prompt('Nuevo número personal (deja vacío para quitarlo):', current);
      if (next === null) return;
      const clean = (next || '').trim();
      p.num = clean.length ? clean : null;
      setDirty(true);
      render();
    });

    const name = document.createElement('div');
    name.className = 'name';

    // Mote o nombre oficial
    const baseName = p.nickname?.trim() ? p.nickname : cap(p.name);

    // Nivel (envuelto para refresco inline)
    const levelHtml = (typeof p.level === 'number' && !isNaN(p.level))
      ? `  Nv.: <span class="poke-level">${p.level}</span>`
      : '';

    // Género
    const genderSymbol =
      p.gender === 'male'   ? ' ♂️' :
      p.gender === 'female' ? ' ♀️' : '';

    // Importante: usar innerHTML para que el span de nivel exista en el DOM
    name.innerHTML = `${baseName}${levelHtml}${genderSymbol}`;

    // Botón equipo (solo clases; sin estilos inline)
    const tbtn = document.createElement('button');
    tbtn.className = p.inTeam ? 'team team-si' : 'team team-no';
    tbtn.title = p.inTeam ? 'Quitar del equipo' : 'Añadir al equipo';
    tbtn.setAttribute('aria-label', p.inTeam ? 'Quitar del equipo' : 'Añadir al equipo');

    // Icono pokéball (el relleno se controla por CSS)
    tbtn.innerHTML = `
<svg class="pokeicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <circle class="poke-fill" cx="12" cy="12" r="9"></circle>
  <circle class="poke-stroke" cx="12" cy="12" r="9"></circle>
  <path class="poke-stroke" d="M3 12h7"></path>
  <path class="poke-stroke" d="M14 12h7"></path>
  <circle class="poke-stroke" cx="12" cy="12" r="3"></circle>
</svg>
`;
    tbtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleTeam(p);
    });

    const del = document.createElement('button');
    del.className = 'del';
    del.setAttribute('aria-label', 'Eliminar');
    del.innerHTML = '✕';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();

      // Confirm con nombre+nivel+género actualizados
      const displayName =
        (p.nickname?.trim() ? p.nickname : cap(p.name)) +
        (typeof p.level === 'number' ? ` Nv.: ${p.level}` : '') +
        (p.gender === 'male' ? ' ♂️' : p.gender === 'female' ? ' ♀️' : '');

      if (confirm(`¿Eliminar ${displayName}?`)) {
                // Devolver objeto equipado (si lo hay) a la mochila antes de borrar
        if (p.heldItem && window.Bag && typeof window.Bag.equipRelease === 'function') {
          try { window.Bag.equipRelease(p.heldItem); } catch (e) { /* noop */ }
        }
x => x.id !== p.id;
        setDirty(true);
        render();
      }
    });

    card.addEventListener('click', () => showDetails(p));
    card.style.position = 'relative';
    card.append(tag, img, name, tbtn, del);
    $grid.appendChild(card);
  }

  appendAddCard();
  updateTeamBtnLabel();
}


    const $bagBtn = document.getElementById('bagBtn');
    if ($bagBtn) $bagBtn.addEventListener('click', () => {
        if (window.Bag?.open) window.Bag.open();
    });


    // ===== Índices =====
    async function ensurePokemonIndex() {
        if (pokemonIndex) return pokemonIndex;
        const cached = JSON.parse(localStorage.getItem('pokeIndex_v1') || 'null');
        if (cached?.names?.length) { pokemonIndex = cached; return cached; }
        const r = await fetch(`${API}/pokemon?limit=20000&offset=0`); if (!r.ok) throw new Error('No se pudo cargar índice de Pokémon');
        const j = await r.json(); pokemonIndex = { names: j.results.map(x => x.name) };
        localStorage.setItem('pokeIndex_v1', JSON.stringify(pokemonIndex)); return pokemonIndex;
    }
    // async function ensureMoveIndex() {
    //     if (moveIndex) return moveIndex;
    //     const cached = JSON.parse(localStorage.getItem('moveIndex_v1') || 'null');
    //     if (cached?.names?.length) { moveIndex = cached; return moveIndex; }
    //     const r = await fetch(`${API}/move?limit=2000&offset=0`); if (!r.ok) throw new Error('No se pudo cargar índice de movimientos');
    //     const j = await r.json(); moveIndex = { names: j.results.map(x => x.name) };
    //     localStorage.setItem('moveIndex_v1', JSON.stringify(moveIndex)); return moveIndex;
    // }
    async function ensureMoveIndex() {
  if (moveIndex) return moveIndex;
  // 1) intenta fichero físico
  const fromFile = await loadDataJson('moveIndex_v1', null);
  if (fromFile?.names?.length) { moveIndex = fromFile; return moveIndex; }

  // 2) fallback a PokeAPI
  const r = await fetch(`${API}/move?limit=2000&offset=0`);
  if (!r.ok) throw new Error('No se pudo cargar índice de movimientos');
  const j = await r.json();
  moveIndex = { names: j.results.map(x => x.name) };
  return moveIndex;
}

    // async function ensureBallIndex() {
    //     if (ballIndex) return ballIndex;
    //     const cached = JSON.parse(localStorage.getItem('ballIndex_v1') || 'null');
    //     if (cached?.length) { ballIndex = cached; return ballIndex; }
    //     const res = await fetch(`${API}/item-pocket/pokeballs`);
    //     if (!res.ok) throw new Error('No se pudo cargar el pocket de Poké Balls');
    //     const pocket = await res.json();
    //     const items = [];
    //     for (const cat of pocket.categories) {
    //         const rc = await fetch(cat.url);
    //         if (!rc.ok) continue;
    //         const cj = await rc.json();
    //         items.push(...(cj.items || []).map(it => ({ id: it.name })));
    //     }
    //     const uniqMap = new Map(items.map(i => [i.id, i]));
    //     ballIndex = Array.from(uniqMap.values());
    //     localStorage.setItem('ballIndex_v1', JSON.stringify(ballIndex));
    //     return ballIndex;
    // }
async function ensureBallIndex() {
  if (ballIndex) return ballIndex;
  const fromFile = await loadDataJson('ballIndex_v1', null);
  if (Array.isArray(fromFile) && fromFile.length) { ballIndex = fromFile; return ballIndex; }

  // Fallback PokeAPI
  const res = await fetch(`${API}/item-pocket/pokeballs`);
  if (!res.ok) throw new Error('No se pudo cargar el pocket de Poké Balls');
  const pocket = await res.json();
  const items = [];
  for (const cat of pocket.categories) {
    const rc = await fetch(cat.url);
    if (!rc.ok) continue;
    const cj = await rc.json();
    items.push(...(cj.items || []).map(it => ({ id: it.name })));
  }
  const uniqMap = new Map(items.map(i => [i.id, i]));
  ballIndex = Array.from(uniqMap.values());
  return ballIndex;
}


    // async function ensureNatureIndex() {
    //     if (natureIndex) return natureIndex;
    //     const cached = JSON.parse(localStorage.getItem('natureIndex_v1') || 'null');
    //     if (cached?.length) { natureIndex = cached; return natureIndex; }
    //     const r = await fetch(`${API}/nature?limit=100&offset=0`);
    //     if (!r.ok) throw new Error('No se pudo cargar naturalezas');
    //     const j = await r.json();
    //     const out = await Promise.all((j.results || []).map(async n => {
    //         const d = await (await fetch(n.url)).json();
    //         const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;
    //         return { id: d.name, nameEs, up: d.increased_stat?.name || null, down: d.decreased_stat?.name || null };
    //     }));
    //     natureIndex = out;
    //     localStorage.setItem('natureIndex_v1', JSON.stringify(natureIndex));
    //     return natureIndex;
    // }
async function ensureNatureIndex() {
  if (natureIndex) return natureIndex;
  const fromFile = await loadDataJson('natureIndex_v1', null);
  if (Array.isArray(fromFile) && fromFile.length) { natureIndex = fromFile; return natureIndex; }

  // Fallback PokeAPI (con nombre ES)
  const r = await fetch(`${API}/nature?limit=100&offset=0`);
  if (!r.ok) throw new Error('No se pudo cargar naturalezas');
  const j = await r.json();
  const out = await Promise.all((j.results || []).map(async n => {
    const d = await (await fetch(n.url)).json();
    const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;
    return { id: d.name, nameEs, up: d.increased_stat?.name || null, down: d.decreased_stat?.name || null };
  }));
  natureIndex = out;
  return natureIndex;
}


    // async function ensureAbilityIndex() {
    //     if (abilityIndex) return abilityIndex;
    //     const cached = JSON.parse(localStorage.getItem('abilityIndex_v2') || 'null');
    //     if (cached?.length) { abilityIndex = cached; return abilityIndex; }
    //     const r = await fetch(`${API}/ability?limit=2000&offset=0`);
    //     if (!r.ok) throw new Error('No se pudo cargar habilidades');
    //     const j = await r.json();
    //     abilityIndex = (j.results || []).map(a => a.name);
    //     localStorage.setItem('abilityIndex_v2', JSON.stringify(abilityIndex));
    //     return abilityIndex;
    // }

    async function ensureAbilityIndex() {
  if (abilityIndex) return abilityIndex;
  const fromFile = await loadDataJson('abilityIndex_v2', null);
  if (Array.isArray(fromFile) && fromFile.length) { abilityIndex = fromFile; return abilityIndex; }

  // Fallback PokeAPI
  const r = await fetch(`${API}/ability?limit=2000&offset=0`);
  if (!r.ok) throw new Error('No se pudo cargar habilidades');
  const j = await r.json();
  abilityIndex = (j.results || []).map(a => a.name);
  return abilityIndex;
}


    // ===== Helpers ES =====
    async function moveEs(id) {
        if (moveEsCache[id]) return moveEsCache[id];
        const d = await (await fetch(`${API}/move/${id}`)).json();
        const es = (d.names || []).find(x => x.language?.name === 'es')?.name || id;
        moveEsCache[id] = es; backup(); return es;
    }
    async function ballEs(id) {
        if (ballEsCache[id]) return ballEsCache[id];
        const d = await (await fetch(`${API}/item/${id}`)).json();
        const es = (d.names || []).find(x => x.language?.name === 'es')?.name || id;
        ballEsCache[id] = es; backup(); return es;
    }
    async function abilityEs(name) {
        if (abilityEsCache[name]) return abilityEsCache[name];
        const d = await (await fetch(`${API}/ability/${name}`)).json();
        const es = (d.names || []).find(x => x.language?.name === 'es')?.name || name;
        abilityEsCache[name] = es; backup(); return es;
    }
    async function natureEs(id) {
        if (natureEsCache[id]) return natureEsCache[id];
        const d = await (await fetch(`${API}/nature/${id}`)).json();
        const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;
        const up = d.increased_stat?.name || null;
        const down = d.decreased_stat?.name || null;
        const pack = { nameEs, up, down };
        natureEsCache[id] = pack; backup(); return pack;
    }
    // async function ensureNatureIdList() {
    //     if (Array.isArray(natureIdList) && natureIdList.length) return natureIdList;
    //     const r = await fetch(`${API}/nature?limit=100&offset=0`);
    //     if (!r.ok) throw new Error('No se pudo cargar IDs de naturalezas');
    //     const j = await r.json();
    //     natureIdList = (j.results || []).map(n => n.name);
    //     return natureIdList;
    // }
    async function ensureNatureIdList() {
  if (Array.isArray(natureIdList) && natureIdList.length) return natureIdList;
  const idx = await ensureNatureIndex();          // ya prioriza /data
  if (Array.isArray(idx) && idx.length) {
    natureIdList = idx.map(n => n.id);
    return natureIdList;
  }
  // (si ensureNatureIndex hizo fallback PokeAPI, ya hemos devuelto arriba)
  return [];
}


    // ===== Vidas ======

    function computeMaxHp(p) {
        const lvl = Number(p.level || 0);
        const basePs = Number(p.stats?.hp || 0);
        return Math.max(0, lvl * 2 + basePs);
    }
    function ensureHp(p) {
        const max = computeMaxHp(p);
        if (typeof p.hpCurrent !== 'number' || isNaN(p.hpCurrent)) p.hpCurrent = max;
        p.hpCurrent = Math.min(Math.max(0, p.hpCurrent), max);
        return { max, current: p.hpCurrent };
    }


    // ===== Fetch Pokémon =====
    async function fetchPokemonCore(idOrName) {
        const r = await fetch(`${API}/pokemon/${encodeURIComponent(idOrName)}`);
        if (!r.ok) {
            if (r.status === 404) throw new Error('No encontrado en PokeAPI');
            throw new Error(`Error ${r.status}`);
        }
        const d = await r.json();
        const sprite = d.sprites.front_default
            || d.sprites.other?.['official-artwork']?.front_default
            || d.sprites.other?.dream_world?.front_default
            || '';

        return {
            dexId: d.id,
            name: d.name,
            types: d.types.map(t => t.type.name),
            sprite,
            abilities: d.abilities.map(a => a.ability.name),
            height: d.height,  // en decímetros
            weight: d.weight   // en hectogramos
        };
    }


    // ====== BÚSQUEDA POKÉMON ======
    async function handleSearch() {
        const q = $query.value.trim(); $result.innerHTML = ''; $confirm.disabled = true; $extra.hidden = true; $matches.hidden = true; $matches.innerHTML = '';
        if (/^\d+$/.test(q)) {
            $feedback.textContent = 'Buscando por número…';
            try { const p = await fetchPokemonCore(q); showPreview(p); $feedback.textContent = ''; } catch (e) { $feedback.textContent = e.message; }
            return;
        }
        if (q.length < 2) { $feedback.textContent = 'Escribe al menos 2 letras.'; return; }
        const { names } = await ensurePokemonIndex();
        const s = norm(q);
        const begins = names.filter(n => n.startsWith(s));
        const includes = names.filter(n => !n.startsWith(s) && n.includes(s));
        const list = [...begins, ...includes].slice(0, 30);
        $feedback.textContent = list.length ? 'Elige una coincidencia:' : 'Sin resultados.';
        if (!list.length) return;
        $matches.hidden = false; $matches.innerHTML = list.map(n => `<button data-name="${n}">${n}</button>`).join('');
        $matches.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async () => {
            const name = btn.dataset.name; $feedback.textContent = `Cargando ${name}…`;
            try { const p = await fetchPokemonCore(name); showPreview(p); $feedback.textContent = ''; } catch (e) { $feedback.textContent = e.message; }
        }));
    }

    function clearMoveLists() {
        document.querySelectorAll('.move-list').forEach(el => { el.hidden = true; el.innerHTML = ''; });
        document.querySelectorAll('.move-input').forEach(inp => { inp.dataset.selectedId = ''; inp.dataset.selectedEs = ''; });
    }

    let pendingBase = null; // snapshot del pokémon elegido

    function showPreview(p) {
        pendingBase = p;
        const moveInputs = Array.from(document.querySelectorAll('.move-input'));
        moveInputs.forEach(i => { i.value = ''; i.dataset.selectedId = ''; i.dataset.selectedEs = ''; });

        $result.innerHTML = `<div class="result">
      <img width="96" height="96" alt="${p.name}" src="${p.sprite}" />
      <div>
        <div style="font-weight:700;font-size:16px">${cap(p.name)} <span class="muted">#${p.dexId}</span></div>
        <div class="chips" style="margin-top:6px">${p.types.map(typeChip).join('')}</div>
      </div>
    </div>`;

        document.getElementById('numInput').value = '';
        $gender.value = 'unknown';
        $extra.hidden = false;
        $confirm.disabled = false;

        setupMoveAutocompleteES();
        setupBallAutocomplete();
        setupNatureAutocomplete();
        setupAbilityAutocomplete();
        setupHeldItemAutocomplete();
    }

    function startEdit(p) {
        editMode = true;
        editingId = p.id;

        // Cierra detalles y prepara el de añadir
        $detailDialog.close();

        // Cambia título y botón
        const addTitle = document.querySelector('#addDialog header h2');
        if (addTitle) addTitle.textContent = 'Editar Pokémon';
        if ($confirm) $confirm.textContent = 'Guardar cambios';

        // Desactiva búsqueda (ya sabemos el base)
        $feedback.textContent = '';
        $matches.hidden = true; $matches.innerHTML = '';
        $query.value = `${cap(p.name)} (#${p.dexId})`;
        $query.disabled = true;
        $searchBtn.disabled = true;

        // Fija "base" del pokémon para confirmar
        pendingBase = {
            dexId: p.dexId,
            name: p.name,
            types: p.types || [],
            sprite: p.sprite || ''
        };

        // Previsualización
        $result.innerHTML = `
    <div class="result">
      <img width="96" height="96" alt="${p.name}" src="${p.sprite}" />
      <div>
        <div style="font-weight:700;font-size:16px">${cap(p.name)} <span class="muted">#${p.dexId}</span></div>
        <div class="chips" style="margin-top:6px">${(p.types || []).map(typeChip).join('')}</div>
      </div>
    </div>`;

        // Muestra extras y habilita confirmar
        $extra.hidden = false;
        $confirm.disabled = false;

        // Prefills
        // movimientos
        const moveInputs = Array.from(document.querySelectorAll('.move-input'));
        moveInputs.forEach((inp, i) => {
            const mv = (p.moves || [])[i] || null;
            inp.value = mv?.nameEs || '';
            inp.dataset.selectedId = mv?.id || '';
            inp.dataset.selectedEs = mv?.nameEs || '';
        });

        // ball
        if ($ballInput) {
            $ballInput.value = p.ball?.nameEs || '';
            $ballInput.dataset.selectedId = p.ball?.id || '';
            $ballInput.dataset.selectedEs = p.ball?.nameEs || '';
        }

        // naturaleza
        if ($natureInput) {
            $natureInput.value = p.nature?.nameEs || '';
            $natureInput.dataset.selectedId = p.nature?.id || '';
            $natureInput.dataset.selectedEs = p.nature?.nameEs || '';
            $natureInput.dataset.up = p.nature?.up || '';
            $natureInput.dataset.down = p.nature?.down || '';
        }

        // habilidad
        const abilityInput = document.getElementById('abilityInput');
        if (abilityInput) {
            abilityInput.value = p.ability?.nameEs || '';
            abilityInput.dataset.selectedId = p.ability?.id || '';
            abilityInput.dataset.selectedEs = p.ability?.nameEs || '';
        }

        

        // objeto equipado
        const heldInp = document.getElementById('heldItemInput');
        if (heldInp) {
            if (p.heldItem) {
                heldInp.value = p.heldItem.nameEs || '';
                heldInp.dataset.selectedId = p.heldItem.id || '';
            } else {
                heldInp.value = '';
                heldInp.dataset.selectedId = '';
            }
        }
// stats
        const stats = p.stats || {};
        ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(k => {
            const el = document.getElementById('stat_' + k);
            if (el) el.value = stats[k] ?? 0;
        });

        // otros campos
        if ($gender) $gender.value = p.gender || 'unknown';
        const numInput = document.getElementById('numInput');
        if (numInput) numInput.value = p.num || '';

        const nick = document.getElementById('nicknameInput');
        if (nick) nick.value = p.nickname || '';
        const lvl = document.getElementById('levelInput');
        if (lvl) lvl.value = p.level || '';

        // Abre el modal de añadir en modo edición
        $dialog.showModal();
    }


    // ---------- Utilidad común (queda por si la quieres reutilizar) ----------
    function setupComboAutocomplete({
        inputEl,
        listEl,
        ensureIndex = async () => { },
        getList = () => [],
        minChars = 1,
        placeholder = "Escribe para buscar…"
    }) {
        if (!inputEl || !listEl) return;

        inputEl.placeholder = placeholder;

        const render = (items) => {
            if (!items.length) { listEl.hidden = true; listEl.innerHTML = ""; return; }
            listEl.innerHTML = items.map(it => `<button data-id="${it.id}">${it.nameEs}</button>`).join("");
            listEl.hidden = false;
            listEl.querySelectorAll("button").forEach(btn => btn.onclick = () => {
                const id = btn.dataset.id;
                const item = items.find(x => String(x.id) === String(id));
                if (!item) return;
                inputEl.value = item.nameEs;
                inputEl.dataset.selectedId = item.id;
                inputEl.dataset.selectedEs = item.nameEs;
                listEl.hidden = true;
                listEl.innerHTML = "";
                inputEl.blur();
            });
        };

        const scoreOf = (name, q) => {
            const idx = name.indexOf(q);
            if (idx === 0) return 1000 - name.length;
            if (idx >= 0) return 500 - idx - name.length * 0.01;
            return -Infinity;
        };

        inputEl.onfocus = () => {
            const raw = (inputEl.value || "").trim();
            if (norm(raw).length >= minChars) inputEl.dispatchEvent(new Event("input"));
        };

        inputEl.oninput = async () => {
            const raw = (inputEl.value || "").trim();

            if (inputEl.dataset.selectedId && raw === (inputEl.dataset.selectedEs || "")) {
                listEl.hidden = true; listEl.innerHTML = ""; return;
            }
            if (inputEl.dataset.selectedId && raw !== inputEl.dataset.selectedEs) {
                inputEl.dataset.selectedId = ""; inputEl.dataset.selectedEs = "";
            }

            const q = norm(raw);
            if (q.length < minChars) { listEl.hidden = true; listEl.innerHTML = ""; return; }

            await ensureIndex();
            const items = (getList() || []).filter(Boolean);
            const matches = items.filter(it => norm(it.nameEs).includes(q))
                .map(it => ({ ...it, _s: scoreOf(norm(it.nameEs), q) }))
                .sort((a, b) => b._s - a._s)
                .slice(0, 20);
            render(matches);
        };
    }

    // ---------- Movimientos (solo ES) ----------
    function setupMoveAutocompleteES() {
        const moveInputs = Array.from(document.querySelectorAll('.move-input'));
        moveInputs.forEach(inp => inp.placeholder = "Buscar movimiento en español…");

        moveInputs.forEach(inp => {
            const listEl = inp.parentElement.querySelector('.move-list');
            inp.oninput = async () => {
                const q = (inp.value || '').trim().toLowerCase();
                if (!q || q.length < 2) { listEl.hidden = true; listEl.innerHTML = ''; return; }

                await ensureMoveIndex();

                const matches = [];
                const seen = new Set();

                // 1) cache ES ya conocida
                for (const [id, es] of Object.entries(moveEsCache)) {
                    if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                        seen.add(id); matches.push({ id, es });
                    }
                }

                // 2) ampliar cache dinámicamente
                for (const id of (moveIndex?.names || [])) {
                    if (matches.length >= 20) break;
                    if (seen.has(id)) continue;
                    const es = moveEsCache[id] || await moveEs(id);
                    if (es && es.toLowerCase().includes(q)) {
                        seen.add(id); matches.push({ id, es });
                    }
                }

                const list = matches.slice(0, 20);
                if (!list.length) { listEl.hidden = true; listEl.innerHTML = ''; return; }
                listEl.innerHTML = list.map(m => `<button data-id="${m.id}">${m.es}</button>`).join('');
                listEl.hidden = false;

                listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
                    const id = btn.dataset.id; const es = btn.textContent;
                    inp.value = es; inp.dataset.selectedId = id; inp.dataset.selectedEs = es;
                    listEl.hidden = true; listEl.innerHTML = ''; inp.blur();
                });
            };
        });
    }

    // ---------- Poké Ball (misma lógica que movimientos) ----------
    function setupBallAutocomplete() {
        const inputEl = document.getElementById('ballInput');
        const listEl = document.getElementById('ballMatches');
        if (!inputEl || !listEl) return;

        inputEl.placeholder = "Escribe Poké Ball";

        inputEl.oninput = async () => {
            const q = (inputEl.value || '').trim().toLowerCase();
            if (!q || q.length < 2) { listEl.hidden = true; listEl.innerHTML = ''; return; }

            await ensureBallIndex();

            const matches = [];
            const seen = new Set();

            // 1) cache ES ya conocida
            for (const [id, es] of Object.entries(ballEsCache)) {
                if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                    seen.add(id); matches.push({ id, es });
                }
            }

            // 2) ampliar cache dinámicamente sin límite artificial
            for (const it of (ballIndex || [])) {
                if (matches.length >= 20) break;
                if (seen.has(it.id)) continue;
                const es = ballEsCache[it.id] || await ballEs(it.id);
                if (es && es.toLowerCase().includes(q)) {
                    seen.add(it.id); matches.push({ id: it.id, es });
                }
            }

            if (!matches.length) { listEl.hidden = true; listEl.innerHTML = ''; return; }
            listEl.innerHTML = matches.slice(0, 20).map(b => `<button data-id="${b.id}">${b.es}</button>`).join('');
            listEl.hidden = false;

            listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
                const id = btn.dataset.id; const es = btn.textContent;
                inputEl.value = es; inputEl.dataset.selectedId = id; inputEl.dataset.selectedEs = es;
                listEl.hidden = true; listEl.innerHTML = ''; inputEl.blur();
            });
        };
    }

    // ---------- Naturaleza (misma lógica que movimientos, con up/down) ----------
    function setupNatureAutocomplete() {
        const inputEl = document.getElementById('natureInput');
        const listEl = document.getElementById('natureMatches');
        if (!inputEl || !listEl) return;

        inputEl.placeholder = "Escribe naturaleza";

        inputEl.oninput = async () => {
            const q = (inputEl.value || '').trim().toLowerCase();
            if (!q || q.length < 1) { listEl.hidden = true; listEl.innerHTML = ''; return; }

            await ensureNatureIdList(); // ['adamant','timid',...]

            const matches = [];
            const seen = new Set();

            // 1) cache ES primero (natureEsCache guarda {nameEs, up, down})
            for (const [id, pack] of Object.entries(natureEsCache)) {
                const es = pack?.nameEs;
                if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                    seen.add(id); matches.push({ id, es, up: pack.up, down: pack.down });
                }
            }

            // 2) ampliar cache dinámicamente
            for (const id of (natureIdList || [])) {
                if (matches.length >= 20) break;
                if (seen.has(id)) continue;
                const pack = natureEsCache[id] || await natureEs(id);
                const es = pack?.nameEs;
                if (es && es.toLowerCase().includes(q)) {
                    seen.add(id); matches.push({ id, es, up: pack.up, down: pack.down });
                }
            }

            if (!matches.length) { listEl.hidden = true; listEl.innerHTML = ''; return; }
            listEl.innerHTML = matches.slice(0, 20)
                .map(n => `<button data-id="${n.id}" data-up="${n.up || ''}" data-down="${n.down || ''}">${n.es}</button>`)
                .join('');
            listEl.hidden = false;

            listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
                const id = btn.dataset.id; const es = btn.textContent;
                inputEl.value = es;
                inputEl.dataset.selectedId = id;
                inputEl.dataset.selectedEs = es;
                inputEl.dataset.up = btn.dataset.up || '';
                inputEl.dataset.down = btn.dataset.down || '';
                listEl.hidden = true; listEl.innerHTML = ''; inputEl.blur();
            });
        };
    }

    // ---------- Habilidad (misma lógica que movimientos) ----------
    function setupAbilityAutocomplete() {
        const inputEl = document.getElementById('abilityInput');
        const listEl = document.getElementById('abilityMatches');
        if (!inputEl || !listEl) return;

        inputEl.placeholder = "Escribe habilidad";

        inputEl.oninput = async () => {
            const q = (inputEl.value || '').trim().toLowerCase();
            if (!q || q.length < 1) { listEl.hidden = true; listEl.innerHTML = ''; return; }

            await ensureAbilityIndex();

            const matches = [];
            const seen = new Set();

            // 1) cache ES ya conocida
            for (const [id, es] of Object.entries(abilityEsCache)) {
                if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                    seen.add(id); matches.push({ id, es });
                }
            }

            // 2) ampliar cache dinámicamente (sin límite extra)
            for (const id of (abilityIndex || [])) {
                if (matches.length >= 20) break;
                if (seen.has(id)) continue;
                const es = abilityEsCache[id] || await abilityEs(id);
                if (es && es.toLowerCase().includes(q)) {
                    seen.add(id); matches.push({ id, es });
                }
            }

            if (!matches.length) { listEl.hidden = true; listEl.innerHTML = ''; return; }
            listEl.innerHTML = matches.slice(0, 20).map(m => `<button data-id="${m.id}">${m.es}</button>`).join('');
            listEl.hidden = false;

            listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
                const id = btn.dataset.id; const es = btn.textContent;
                inputEl.value = es; inputEl.dataset.selectedId = id; inputEl.dataset.selectedEs = es;
                listEl.hidden = true; listEl.innerHTML = ''; inputEl.blur();
            });
        };
    }

    // ---------- Objeto equipado (autocompletado desde Mochila) ----------
    function setupHeldItemAutocomplete() {
        const inputEl = document.getElementById('heldItemInput');
        const listEl = document.getElementById('heldItemMatches');
        if (!inputEl || !listEl || !window.Bag || !window.Bag.setupBagAutocomplete) return;
        window.Bag.setupBagAutocomplete(inputEl, listEl, { minLength: 0, maxResults: 12 });
    }


    // ---------- Inicialización segura ----------
    document.addEventListener('DOMContentLoaded', () => {
        try { setupMoveAutocompleteES(); } catch (e) { console.error('setupMoveAutocompleteES()', e); }
        try { setupNatureAutocomplete(); } catch (e) { console.error('setupNatureAutocomplete()', e); }
        try { setupBallAutocomplete(); } catch (e) { console.error('setupBallAutocomplete()', e); }
        try { setupAbilityAutocomplete();
        setupHeldItemAutocomplete(); } catch (e) { console.error('setupAbilityAutocomplete()', e); }

        // refs del dropdown (hazlas con let arriba si no existen)
        $statusBtn = document.getElementById('statusBtn');
        $statusMenu = document.getElementById('statusMenu');
        updateStatus();
        try { window.Bag?.init?.(); window.Bag?.onChange?.(() => { setDirty(true); }); } catch (e) { console.error('Bag init/onChange', e); }


        // abrir/cerrar
        $statusBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !$statusMenu?.hidden;
            $statusMenu.hidden = open;
            $statusBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
        });

        // cerrar al clicar fuera
        document.addEventListener('click', (e) => {
            if ($statusMenu && !$statusMenu.hidden) {
                const within = el => el && (el === e.target || el.contains(e.target));
                if (!within($statusMenu) && !within($statusBtn)) {
                    $statusMenu.hidden = true;
                    $statusBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // cerrar con Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && $statusMenu && !$statusMenu.hidden) {
                $statusMenu.hidden = true;
                $statusBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // acciones del menú
        document.getElementById('menuOpen')?.addEventListener('click', () => {
            $statusMenu.hidden = true; $statusBtn.setAttribute('aria-expanded', 'false');
            document.getElementById('openInput')?.click();
        });
        document.getElementById('menuSave')?.addEventListener('click', () => {
            $statusMenu.hidden = true; $statusBtn.setAttribute('aria-expanded', 'false');
            if (typeof saveToDownload === 'function') saveToDownload();
        });
        document.getElementById('menuBg')?.addEventListener('click', () => {
            $statusMenu.hidden = true; $statusBtn.setAttribute('aria-expanded', 'false');
            document.getElementById('bgInput')?.click();
        });
        document.getElementById('menuBgClear')?.addEventListener('click', () => {
            $statusMenu.hidden = true; $statusBtn.setAttribute('aria-expanded', 'false');
            if (typeof window.setBackgroundDataUrl === 'function') window.setBackgroundDataUrl(null);
        });

    });


    // ===== Confirmar (crear entrada) =====
    $confirm.addEventListener('click', () => {
        if (!pendingBase) return;

        // Recolecta datos
        const moveInputs = Array.from(document.querySelectorAll('.move-input'));
        const moves = moveInputs
            .map(inp => inp.dataset.selectedId
                ? { id: inp.dataset.selectedId, nameEs: inp.dataset.selectedEs || inp.value }
                : null)
            .filter(Boolean);

        const ball = $ballInput.dataset.selectedId
            ? { id: $ballInput.dataset.selectedId, nameEs: $ballInput.dataset.selectedEs || $ballInput.value }
            : null;

        let nature = null;
        if ($natureInput.dataset.selectedId) {
            nature = {
                id: $natureInput.dataset.selectedId,
                nameEs: $natureInput.dataset.selectedEs || $natureInput.value,
                up: $natureInput.dataset.up || null,
                down: $natureInput.dataset.down || null
            };
        }

        const gender = /** @type {any} */ ($gender.value || 'unknown');

        const $abilityInput = document.getElementById('abilityInput');
        const abId = $abilityInput?.dataset.selectedId || null;
        const ability = abId ? { id: abId, nameEs: $abilityInput?.dataset.selectedEs || $abilityInput?.value || abId } : null;

        const heldInp = document.getElementById('heldItemInput');
        let nextHeldId = heldInp?.dataset?.selectedId || null;
        // Si el usuario borró el texto, interpretamos que quiere desequipar
        if (heldInp && !((heldInp.value || '').trim())) {
          nextHeldId = null;
          if (heldInp.dataset) heldInp.dataset.selectedId = '';
        }

        const stats = {
            hp: Number(document.getElementById('stat_hp').value || 0),
            atk: Number(document.getElementById('stat_atk').value || 0),
            def: Number(document.getElementById('stat_def').value || 0),
            spa: Number(document.getElementById('stat_spa').value || 0),
            spd: Number(document.getElementById('stat_spd').value || 0),
            spe: Number(document.getElementById('stat_spe').value || 0)
        };

        const num = (document.getElementById('numInput')?.value || '').trim() || null;
        const nickname = (document.getElementById('nicknameInput')?.value || '').trim() || null;
        const level = Number(document.getElementById('levelInput')?.value || 0) || null;

        // --- EDITAR ---
        if (editMode && editingId) {
            const idx = db.findIndex(x => x.id === editingId);
            if (idx !== -1) {
                const old = db[idx];
                const heldItemNew = window.Bag && window.Bag.equipDiff ? window.Bag.equipDiff(old.heldItem || null, nextHeldId) : (old.heldItem || null);

                db[idx] = {
                    ...old,
                    dexId: pendingBase.dexId,
                    name: pendingBase.name,
                    types: pendingBase.types,
                    sprite: pendingBase.sprite,
                    height: pendingBase.height,
                    weight: pendingBase.weight,
                    moves, ball, nature, gender, ability, heldItem: heldItemNew, stats, num,
                    nickname, level
                };

                // Ajuste de vida para no superar el nuevo máximo
                const maxHpEdit = computeMaxHp(db[idx]);
                if (typeof db[idx].hpCurrent !== 'number' || isNaN(db[idx].hpCurrent)) {
                    db[idx].hpCurrent = maxHpEdit;
                } else if (db[idx].hpCurrent > maxHpEdit) {
                    db[idx].hpCurrent = maxHpEdit;
                }

                setDirty(true);
                render();
            }

            // Reset modo edición + UI
            editMode = false; editingId = null;
            const addTitle = document.querySelector('#addDialog header h2');
            if (addTitle) addTitle.textContent = 'Añadir Pokémon';
            if ($confirm) $confirm.textContent = 'Añadir a mi base';
            $query.disabled = false; $searchBtn.disabled = false;
            $dialog.close();
            return;
        }

        // --- AÑADIR ---
                const heldItemNewAdd = window.Bag && window.Bag.equipDiff ? window.Bag.equipDiff(null, nextHeldId) : null;
        const entry = {
            id: uuid(),
            dexId: pendingBase.dexId,
            name: pendingBase.name,
            types: pendingBase.types,
            sprite: pendingBase.sprite,
            height: pendingBase.height,
            weight: pendingBase.weight,
            moves, ball, nature, gender, ability, heldItem: heldItemNewAdd, stats, num,
            nickname, level,
            inTeam: false
        };

        // Inicializa vida actual = vida máxima
        const maxHpNew = computeMaxHp(entry);
        entry.hpCurrent = maxHpNew;

        db.push(entry);
        db.sort((a, b) => a.dexId - b.dexId);
        setDirty(true);
        render();
        $dialog.close();
    });

    // ===== Detalles =====
    function statLabel(id) { return ({ hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad' })[id] || id; }
    function statOrder() { return ['hp', 'atk', 'def', 'spa', 'spd', 'spe']; }


    // Traduce las claves de tus botones a IDs de PokeAPI
    const HEAL_MAP = {
        potion: 'potion',
        super_potion: 'super-potion',
        hyper_potion: 'hyper-potion',
        max_potion: 'max-potion'
    };

    function medPocket() {
        return window.Bag?.getState?.()?.pockets?.medicine || {};
    }

    // Cuenta por NOMBRE EN ESPAÑOL (p.ej. "Poción", "Superpoción"…)
    function bagCountByEsName(esName) {
        const dict = medPocket();
        let total = 0;
        for (const pack of Object.values(dict)) {
            if ((pack.nameEs || '').toLowerCase() === esName.toLowerCase()) {
                total += pack.qty || 0;
            }
        }
        return total;
    }

    // Consume 1 unidad buscando por NOMBRE EN ESPAÑOL
    function bagConsumeByEsName(esName) {
        const dict = medPocket();
        for (const [id, pack] of Object.entries(dict)) {
            if ((pack.nameEs || '').toLowerCase() === esName.toLowerCase() && (pack.qty || 0) > 0) {
                return !!window.Bag?.equipReserve?.(id); // descuenta 1 del ítem con ese id (numérico)
            }
        }
        return false;
    }


    // Devuelve cuántas unidades hay en el bolsillo "Medicina"
    function bagCountNew(id) {
        const state = window.Bag?.getState?.();
        if (!state) return 0;
        const med = state.pockets?.medicine || {};
        return med[id]?.qty || 0;
    }

    // Intenta gastar 1 unidad de la mochila real (devuelve true si pudo)
    function bagConsumeNew(id) {
        return !!window.Bag?.equipReserve?.(id);
    }

    async function showDetails(p) {

  // asegura campos EXP/Nivel y lo indexa
  ensureExpFields(p);
  window.POKE_INDEX?.set(p.id, p);

        // Nombre mostrado (mote/nombre + nivel/género)
  let displayName = p.nickname?.trim() ? p.nickname : cap(p.name);
  if (p.gender === 'male')   displayName += ' ♂️';
  else if (p.gender === 'female') displayName += ' ♀️';
  $detailTitle.innerHTML = `${displayName} <span class="chip">Nv. <span class="detail-level detail-level-title">${p.level}</span></span>`;


        const natUp = p.nature?.up || null, natDown = p.nature?.down || null;
        const natName = p.nature?.nameEs || '—';
        const abilityName = p.ability?.nameEs || '—';
        const abilityId = p.ability?.id || '';

        // Completar altura/peso si faltan
        if ((p.height == null || p.weight == null) && (p.dexId || p.name)) {
            try {
                const fresh = await fetchPokemonCore(p.dexId || p.name);
                p.height = fresh.height;
                p.weight = fresh.weight;
                setDirty(true);
            } catch (e) { console.warn('No se pudo completar height/weight', e); }
        }
        ensureHp(p);

        // --- Botones de curación: construir con stock real de la mochila ---
        const healButtonsHtml = Object.entries(ITEM_CATALOG).map(([key, def]) => {
            const cnt = bagCountByEsName(def.name);
            return cnt > 0 ? `<button class="btn heal-btn" data-key="${key}">${def.name} (${cnt})</button>` : '';
        }).join('');


        const hpSection = `
    <div class="hp-box">
      <div class="hp-row">
        <div class="hp-bar"><div class="hp-fill"></div></div>
        <div class="hp-num"></div>
        <div class="hp-ctrl">
          <button class="btn hp-minus">−</button>
          <input type="number" class="hp-input" min="0" value="0">
          <button class="btn hp-plus">＋</button>
          <button class="btn hp-full" title="Curar este">Curar</button>
        </div>
      </div>
      <div class="heal-row">${healButtonsHtml}</div>
    </div>
  `;

        // (resto de datos)
        const height = p.height && !isNaN(p.height) ? (p.height / 10).toFixed(1) : '—';
        const weight = p.weight && !isNaN(p.weight) ? (p.weight / 10).toFixed(1) : '—';
        const ballHtml = p.ball?.id
            ? `<img class="ball-icon" alt="${p.ball?.nameEs || p.ball?.id}" src="${ballSpriteUrl(p.ball.id)}" onerror="this.style.display='none'">`
            : '';

        const teamHtml = teamIconSVG(!!p.inTeam);

        const rows = statOrder().map(id => {
            const v = p.stats?.[id] ?? 0;
            const plus = (id === 'atk' && natUp === 'attack') || (id === 'def' && natUp === 'defense') ||
                (id === 'spa' && natUp === 'special-attack') || (id === 'spd' && natUp === 'special-defense') ||
                (id === 'spe' && natUp === 'speed');
            const minus = (id === 'atk' && natDown === 'attack') || (id === 'def' && natDown === 'defense') ||
                (id === 'spa' && natDown === 'special-attack') || (id === 'spd' && natDown === 'special-defense') ||
                (id === 'spe' && natDown === 'speed');
            return `<span class="stat-badge">${statLabel(id)}: <strong>${v}</strong> ${plus ? '<span class="plus">+</span>' : ''}${minus ? '<span class="minus">–</span>' : ''}</span>`;
        }).join('');

        // Detalles de movimientos
        // función auxiliar (puedes ponerla arriba de showDetails o dentro)
function calcDamageTier(power) {
  if (power == null || power === '—') return '—'; // movimientos de daño fijo
  if (power <= 50) return 1;
  if (power <= 79) return 2;
  if (power <= 99) return 3;
  if (power <= 119) return 4;
  if (power <= 140) return 5;
  if (power <= 200) return 6;
  return 7; // 201+
}

        const movePacks = [];
        const moves = (p.moves || []).slice(0, 4);
        for (const m of moves) {
            if (!m?.id) { movePacks.push(null); continue; }
            try { movePacks.push(await getMoveFullEs(m.id)); } catch { movePacks.push(null); }
        }
        const moveCards = movePacks.map(mp => {
            if (!mp) {
                return `
        <div class="move-card">
          <header style="background:rgba(255,255,255,.06);color:#e6eefb;">
            <span>—</span><span class="move-type-tag">—</span>
          </header>
          <div class="move-body">
            <div class="move-desc">Sin datos.</div>
            <div class="move-meta">
              <div><b>PP:</b> —</div><div><b>Daño:</b> —</div>
              <div><b>Tipo de daño:</b> —</div><div><b>Precisión:</b> —</div>
            </div>
          </div>
        </div>`;
            }
            const mmeta = TYPE_META[mp.type] || {};
            const bg = mmeta.bg || 'rgba(255,255,255,.06)';
            const fg = mmeta.fg || '#e6eefb';
const pp = mp.pp > 5 ? 'inf' : mp.pp;
const damage = calcDamageTier(mp.power);
            return `
      <div class="move-card">
        <header style="background:${bg};color:${fg}">
          <span>${mp.nameEs}</span>
          <span class="move-type-tag" style="background:rgba(0,0,0,.08);color:${fg};border-color:rgba(0,0,0,.15)">${mp.typeEs}</span>
        </header>
        <div class="move-body">
          <div class="move-desc">${mp.descEs}${mp.effectInfo ? ` - <span><b>${mp.effectInfo}</b></span>` : ''}</div>
          <div class="move-meta">
            <div><b>PP:</b> ${pp}</div>
            <div><b>Daño:</b> ${damage}</div>
            <div><b>Tipo de daño:</b> ${mp.classEs}</div>
            <div><b>Precisión:</b> ${mp.accuracy === null ? '—' : mp.accuracy}</div>
          </div>
        </div>
      </div>`;
        }).join('');

        // Pintar detalle (incluye hpSection)
        $detailContent.innerHTML = `
    <div class="detail-top">
      <div class="detail-main-info">
        <div class="detail-head">
          <img width="120" height="120" alt="${p.name}" src="${p.sprite}" />
          <div>
            <div class="name-row-header">
              <span class="pkname">${cap(p.name)}</span>
              <span class="muted">#${p.dexId}</span>
              ${ballHtml}
              ${teamHtml}
            </div>${renderExpBlock(p)}
            <div class="chips" style="margin-top:6px">${(p.types || []).map(typeChip).join('')}</div>
            ${hpSection}
            <div class="name-row-info">
              <div class="name-row-info-left">
                <div class="small" style="margin-top:6px">Nº personal: <strong>${(p.num && String(p.num).length) ? p.num : '—'}</strong></div>
                <div class="small" style="margin-top:6px">Naturaleza: <strong>${natName}</strong></div>
                <div class="small" style="margin-top:6px">Habilidad:
                  ${abilityId ? `<button class="ability-link linklike" data-id="${abilityId}" type="button">${abilityName}</button>` : `<span>${abilityName}</span>`}
                </div>
              </div>
              <div class="name-row-info-right">
                <div class="small" style="margin-top:6px">Altura: <strong>${height} m</strong></div>
                <div class="small" style="margin-top:6px">Peso: <strong>${weight} kg</strong></div>
                              <div class="small" style="margin-top:6px">Objeto:
                  ${p.heldItem?.id
                    ? `<button class="helditem-link linklike" data-id="${p.heldItem.id}" type="button">${p.heldItem.nameEs || "—"}</button>`
                    : `<span>${p.heldItem?.nameEs || "—"}</span>`}
                </div>
</div>
            </div>
          </div>
          <div style="margin-left: 50px;">
            <h3 style="margin:0 0 6px;font-size:14px">Estadísticas</h3>
            <div class="detail-stats">${rows}</div>
          </div>
        </div>
      </div>
    </div>

    <h3 style="margin:14px 0 6px;font-size:14px">Ataques</h3>
    <div class="moves-grid">
      ${moveCards || ''}
    </div>

    <h3 style="margin:14px 0 6px;font-size:14px">Notas</h3>
    <textarea id="notesBox" placeholder="Escribe tus notas..." style="width:95%;min-height:140px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;resize:vertical;"></textarea>

  `;
      // Inicializar y auto-guardado de notas
      const $notes = document.getElementById('notesBox');
      if ($notes) {
        $notes.value = p.notes || '';
        $notes.addEventListener('input', (e) => {
          const val = e.target.value;
          p.notes = val;
          // Persistir en el array db también (por si p es una copia)
          const idx = db.findIndex(x => x.id === p.id);
          if (idx !== -1) db[idx].notes = val;
          setDirty(true);
          // Guardado suave en localStorage (sin molestar al usuario)
          try {
            const bg = (window.getBackgroundDataUrl && window.getBackgroundDataUrl()) || null;
            const bagState = window.Bag?.getState?.() || null;
            const payload = { version: 2, entries: db, bg, bag: bagState };
            localStorage.setItem('pokebox_autosave_v2', JSON.stringify(payload));
          } catch {}
        });
      }


  // marca el detalle con el id para refrescos
  $detailContent.setAttribute('data-pid', p.id);


        // --- Lógica de la barra de vida y curación ---
        const box = $detailContent.querySelector('.hp-box');
        const $fill = box.querySelector('.hp-fill');
        const $num = box.querySelector('.hp-num');
        const $input = box.querySelector('.hp-input');
        const $minus = box.querySelector('.hp-minus');
        const $plus = box.querySelector('.hp-plus');
        const $full = box.querySelector('.hp-full');

        function redrawHpUI() {
            const maxHp = computeMaxHp(p);
            const cur = Math.min(Math.max(0, p.hpCurrent ?? 0), maxHp);
            $input.max = String(maxHp);
            $input.value = String(cur);
            $fill.style.width = maxHp ? Math.round(cur / maxHp * 100) + '%' : '0%';
            $num.textContent = `${cur} / ${maxHp}`;
        }

        $input.addEventListener('input', () => {
            const v = Number($input.value || 0);
            p.hpCurrent = Math.min(Math.max(0, v), computeMaxHp(p));
            setDirty(true);
            redrawHpUI();
        });
        $minus.addEventListener('click', () => {
            p.hpCurrent = Math.max(0, (p.hpCurrent || 0) - 1);
            setDirty(true);
            redrawHpUI();
        });
        $plus.addEventListener('click', () => {
            p.hpCurrent = Math.min(computeMaxHp(p), (p.hpCurrent || 0) + 1);
            setDirty(true);
            redrawHpUI();
        });
        $full.addEventListener('click', () => {
            p.hpCurrent = computeMaxHp(p);
            setDirty(true);
            redrawHpUI();
        });
        function applyHealByItemKey(key) {
            const def = ITEM_CATALOG[key];
            if (!def) return;

            const stock = bagCountByEsName(def.name);
            if (stock <= 0) return;

            const maxHp = computeMaxHp(p);
            const cur = Math.max(0, p.hpCurrent || 0);
            const next = def.heal === 'full' ? maxHp : Math.min(maxHp, cur + def.heal);
            if (next === cur) return;

            if (!bagConsumeByEsName(def.name)) return;

            p.hpCurrent = next;
            setDirty(true);
            redrawHpUI();

            // refresca contadores/disabled de los botones
            $detailContent.querySelectorAll('.heal-btn').forEach(btn => {
                const k = btn.dataset.key;
                const c = bagCountByEsName(ITEM_CATALOG[k].name);
                btn.textContent = `${ITEM_CATALOG[k].name} (${c})`;
                btn.disabled = c <= 0;
            });
        }

        $detailContent.querySelectorAll('.heal-btn').forEach(btn => {
            btn.addEventListener('click', () => applyHealByItemKey(btn.dataset.key));
        });

        // Tooltip de habilidad
        function setupItemTooltip() {
            const btn = $detailContent.querySelector('.item-link');
            if (!btn) return;
            const old = $detailDialog.querySelector('.item-tooltip'); if (old) old.remove();
            const tip = document.createElement('div');
            tip.className = 'item-tooltip muted';
            tip.style.position = 'absolute';
            tip.style.display = 'none';
            tip.style.maxWidth = '320px';
            tip.style.padding = '10px 12px';
            tip.style.borderRadius = '10px';
            tip.style.background = 'rgba(12, 18, 45, .98)';
            tip.style.border = '1px solid rgba(255,255,255,.12)';
            tip.style.fontSize = '12px';
            tip.style.lineHeight = '1.4';
            tip.style.zIndex = '9999';
            $detailDialog.appendChild(tip);

            let pinned = false;
            function effectText() {
                return (p.heldItem && p.heldItem.effectText) ? p.heldItem.effectText : 'Sin efecto';
            }
            function show() {
                tip.textContent = effectText();
                const br = btn.getBoundingClientRect();
                const dr = $detailDialog.getBoundingClientRect();
                const left = Math.min(br.left - dr.left, $detailDialog.clientWidth - 340);
                const top = br.bottom - dr.top + 8;
                tip.style.left = left + 'px';
                tip.style.top = top + 'px';
                tip.style.display = 'block';
            }
            function hide() { if (!pinned) tip.style.display = 'none'; }

            btn.addEventListener('mouseenter', show);
            btn.addEventListener('mouseleave', hide);
            btn.addEventListener('focus', show);
            btn.addEventListener('blur', hide);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pinned) { pinned = false; tip.style.display = 'none'; return; }
                show(); pinned = true;
            });
            $detailDialog.addEventListener('click', (e) => {
                if (!pinned) return;
                if (e.target !== btn && !tip.contains(e.target)) {
                    pinned = false; tip.style.display = 'none';
                }
            });
        }
        setupAbilityTooltip();
        // Tooltip de objeto equipado
        setupHeldItemTooltip();
        function setupHeldItemTooltip() {
            const btn = $detailContent.querySelector('.helditem-link');
            if (!btn || !p.heldItem) return;
            const old = $detailDialog.querySelector('.helditem-tooltip'); if (old) old.remove();
            const tip = document.createElement('div');
            tip.className = 'helditem-tooltip muted';
            tip.style.position = 'absolute';
            tip.style.display = 'none';
            tip.style.maxWidth = '320px';
            tip.style.padding = '10px 12px';
            tip.style.borderRadius = '10px';
            tip.style.background = 'rgba(12, 18, 45, .98)';
            tip.style.border = '1px solid rgba(255,255,255,.12)';
            tip.style.fontSize = '12px';
            tip.style.lineHeight = '1.4';
            tip.style.zIndex = '9999';
            $detailDialog.appendChild(tip);

            let pinned = false;
            function show() {
                const text = (p.heldItem && p.heldItem.effectText || '').replace(/\s+/g,' ').trim() || 'Sin descripción disponible.';
                tip.textContent = text;
                const br = btn.getBoundingClientRect();
                const dr = $detailDialog.getBoundingClientRect();
                const left = Math.min(br.left - dr.left, $detailDialog.clientWidth - 340);
                const top = br.bottom - dr.top + 8;
                tip.style.left = left + 'px';
                tip.style.top = top + 'px';
                tip.style.display = 'block';
            }
            function hide() { if (!pinned) tip.style.display = 'none'; }
            btn.addEventListener('mouseenter', show);
            btn.addEventListener('mouseleave', hide);
            btn.addEventListener('focus', show);
            btn.addEventListener('blur', hide);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pinned) { pinned = false; tip.style.display = 'none'; return; }
                show(); pinned = true;
            });
            $detailDialog.addEventListener('click', (e) => {
                if (!pinned) return;
                if (e.target !== btn && !tip.contains(e.target)) {
                    pinned = false; tip.style.display = 'none';
                }
            });
        }
        // Tooltip de objeto equipado
        setupHeldItemTooltip();
        function setupHeldItemTooltip() {
            const btn = $detailContent.querySelector('.helditem-link');
            if (!btn || !p.heldItem) return;
            const old = $detailDialog.querySelector('.helditem-tooltip'); if (old) old.remove();
            const tip = document.createElement('div');
            tip.className = 'helditem-tooltip muted';
            tip.style.position = 'absolute';
            tip.style.display = 'none';
            tip.style.maxWidth = '320px';
            tip.style.padding = '10px 12px';
            tip.style.borderRadius = '10px';
            tip.style.background = 'rgba(12, 18, 45, .98)';
            tip.style.border = '1px solid rgba(255,255,255,.12)';
            tip.style.fontSize = '12px';
            tip.style.lineHeight = '1.4';
            tip.style.zIndex = '9999';
            $detailDialog.appendChild(tip);

            let pinned = false;
            function show() {
                const text = (p.heldItem.effectText || '').replace(/\s+/g,' ').trim() || 'Sin descripción disponible.';
                tip.textContent = text;
                const br = btn.getBoundingClientRect();
                const dr = $detailDialog.getBoundingClientRect();
                const left = Math.min(br.left - dr.left, $detailDialog.clientWidth - 340);
                const top = br.bottom - dr.top + 8;
                tip.style.left = left + 'px';
                tip.style.top = top + 'px';
                tip.style.display = 'block';
            }
            function hide() { if (!pinned) tip.style.display = 'none'; }
            btn.addEventListener('mouseenter', show);
            btn.addEventListener('mouseleave', hide);
            btn.addEventListener('focus', show);
            btn.addEventListener('blur', hide);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pinned) { pinned = false; tip.style.display = 'none'; return; }
                show(); pinned = true;
            });
            $detailDialog.addEventListener('click', (e) => {
                if (!pinned) return;
                if (e.target !== btn && !tip.contains(e.target)) {
                    pinned = false; tip.style.display = 'none';
                }
            });
        }
        function setupAbilityTooltip() {
            const btn = $detailContent.querySelector('.ability-link');
            if (!btn) return;
            const old = $detailDialog.querySelector('.ability-tooltip'); if (old) old.remove();
            const tip = document.createElement('div');
            tip.className = 'ability-tooltip muted';
            tip.style.position = 'absolute';
            tip.style.display = 'none';
            tip.style.maxWidth = '320px';
            tip.style.padding = '10px 12px';
            tip.style.borderRadius = '10px';
            tip.style.background = 'rgba(12, 18, 45, .98)';
            tip.style.border = '1px solid rgba(255,255,255,.12)';
            tip.style.fontSize = '12px';
            tip.style.lineHeight = '1.4';
            tip.style.zIndex = '9999';
            $detailDialog.appendChild(tip);

            let pinned = false;
            async function show() {
                const id = btn.dataset.id;
                const { text } = await getAbilityInfoEs(id);
                tip.textContent = text || 'Sin descripción disponible.';
                const br = btn.getBoundingClientRect();
                const dr = $detailDialog.getBoundingClientRect();
                const left = Math.min(br.left - dr.left, $detailDialog.clientWidth - 340);
                const top = br.bottom - dr.top + 8;
                tip.style.left = left + 'px';
                tip.style.top = top + 'px';
                tip.style.display = 'block';
            }

                function hide() { if (!pinned) tip.style.display = 'none'; }
            btn.addEventListener('mouseenter', show);
            btn.addEventListener('mouseleave', hide);
            btn.addEventListener('focus', show);
            btn.addEventListener('blur', hide);
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (pinned) { pinned = false; tip.style.display = 'none'; return; }
                await show(); pinned = true;
            });
            $detailDialog.addEventListener('click', (e) => {
                if (!pinned) return;
                if (e.target !== btn && !tip.contains(e.target)) {
                    pinned = false; tip.style.display = 'none';
                }
            });
        }

                setupAbilityTooltip();
        setupHeldItemTooltip();
$detailDialog.showModal();
        if ($editDetail) $editDetail.onclick = () => startEdit(p);

        // Inicializa la UI de vida al final (cuando todo está enganchado)
        redrawHpUI();
    }

// === EXP helpers ===
// Asegura que el Pokémon tenga campos de EXP consistentes al cargar/crear
function ensureExpFields(p) {
  if (typeof p.exp !== 'number' || isNaN(p.exp)) p.exp = 0;
  // expMax fijo en 10 por tu regla; se puede omitir si no lo quieres persistir
  if (typeof p.expMax !== 'number' || isNaN(p.expMax)) p.expMax = 10;
  if (typeof p.level !== 'number' || isNaN(p.level)) p.level = 1;
  return p;
}

// Concede EXP con “carry-over” y subida de nivel cuando exp >= 10
function grantExp(p, amount) {
  ensureExpFields(p);
  p.exp = Math.max(0, p.exp + amount);

  // Subidas múltiples si hay exceso
  while (p.exp >= p.expMax) {
    p.exp -= p.expMax;    // arrastre
    p.level += 1;
  }
  return p;
}

// --- REFRESH HELPERS ---

function refreshDetailIfOpen(p) {
  const dialog = document.querySelector('#detailDialog');
  const isOpen = dialog && dialog.open;
  if (!isOpen) return;

  // Si tienes una función oficial de render del detalle, úsala
  if (typeof window.renderDetail === 'function') {
    window.renderDetail(p);
    return;
  }

  // Fallback: actualizar solo el nivel y la barra de EXP en el detalle actual
  const root = document.querySelector('#detailContent[data-pid]');
  if (!root) return;
  if (root.getAttribute('data-pid') !== p.id) return;

  const lvlEl = root.querySelector('.detail-level');
  if (lvlEl) lvlEl.textContent = p.level;

  // también refrescamos la barra de exp para reflejar el “carry-over”
  updateExpUI(p.id, p);
}

function refreshGrid() {
  // Si tienes renderizado global del grid, úsalo
  if (typeof window.renderGrid === 'function') {
    window.renderGrid();
    return;
  }

  // Fallback: actualizar SOLO el número de nivel en cada card del grid
  // usando el índice actual (POKE_INDEX)
  document.querySelectorAll('.poke[data-pid]').forEach(card => {
    const pid = card.getAttribute('data-pid');
    const poke = window.POKE_INDEX.get(pid);
    if (!poke) return;
    const lvlEl = card.querySelector('.poke-level');
    if (lvlEl) lvlEl.textContent = poke.level;
  });
}

function refreshGridInline() {
  document.querySelectorAll('.poke[data-pid]').forEach(card => {
    const pid = card.getAttribute('data-pid');
    const poke = window.POKE_INDEX.get(pid);
    if (!poke) return;
    const lvlEl = card.querySelector('.poke-level');
    if (lvlEl) lvlEl.textContent = poke.level;
  });
}


// Opcional: evento por si quieres enganchar otras partes de la app
function emitLevelUpEvent(p, levelsUp) {
  document.dispatchEvent(new CustomEvent('pokemon:levelup', {
    detail: { pokemon: p, levelsUp }
  }));
}

// --- Parchea grantExp para disparar los refrescos ---

// Guarda la versión anterior por si ya existía
const __grantExp_original = typeof grantExp === 'function' ? grantExp : null;

// Reemplaza/define grantExp con detección de level-ups y refrescos
function grantExp(p, amount) {
  ensureExpFields(p);
  const expMax = p.expMax || 10;
  let levelsUp = 0;

  p.exp = Math.max(0, (p.exp ?? 0) + amount);

  while (p.exp >= expMax) {
    p.exp -= expMax;
    p.level += 1;
    levelsUp += 1;
  }

  // Siempre actualiza barra/contador de EXP al instante
  updateExpUI(p.id, p);

  // Si subió de nivel, refresco "in place" detalle + grid
  if (levelsUp > 0) {
    refreshDetailInline(p);  // <- aquí ves subir el nivel sin salir del detalle
    refreshGridInline();     // <- actualiza niveles en todas las tarjetas
    // save?.(); // si quieres persistir al momento
  }

  return p;
}


function refreshDetailInline(p) {
  const dialog = document.querySelector('#detailDialog');
  if (!dialog || !dialog.open) return;

  const root = document.querySelector('#detailContent');
  if (!root) return;
  if (root.getAttribute('data-pid') !== p.id) return; // no es el que está abierto

  // Actualiza todos los sitios donde muestras el nivel en el detalle
  root.querySelectorAll('.detail-level').forEach(el => { el.textContent = p.level; });

  // Actualiza el título si pusiste el span en el título
  const titleLvl = document.querySelector('.detail-level-title');
  if (titleLvl) titleLvl.textContent = p.level;

  // Refresca la barra de EXP (para que se vea el “carry-over”)
  updateExpUI(p.id, p);
}

function refreshGridInline() {
  document.querySelectorAll('.poke[data-pid]').forEach(card => {
    const pid = card.getAttribute('data-pid');
    const poke = window.POKE_INDEX.get(pid);
    if (!poke) return;
    const lvlEl = card.querySelector('.poke-level');
    if (lvlEl) lvlEl.textContent = poke.level;
  });
}


// Setea EXP exacta (por si quieres sincronizar desde inputs)
function setExp(p, value) {
  ensureExpFields(p);
  p.exp = Math.max(0, Math.min(p.expMax, Number(value) || 0));
  return p;
}

// === Render de la barra de EXP ===
// Llama a esta función dentro del render de tu “detail view” del Pokémon.
function renderExpBlock(p) {
  // ← añade esta línea para que el índice siempre esté sincronizado
  window.POKE_INDEX.set(p.id, p);

  ensureExpFields(p);
  const pct = Math.max(0, Math.min(100, (p.exp / p.expMax) * 100));
  return `
    <div class="exp-box" data-pid="${p.id}">
      <div class="exp-row">
        <div class="exp-bar">
          <div class="exp-fill" style="width:${pct}%"></div>
        </div>
        <div class="exp-num">${p.exp} / ${p.expMax}</div>
        <div class="exp-ctrl">
          <input type="number" class="exp-add" value="1" min="1" max="${p.expMax}" />
          <button class="btn btn-primary exp-add-btn">+EXP</button>
          <button class="btn exp-lvlup-btn">Subir nivel (+10)</button>
        </div>
      </div>
    </div>
  `;
}


// Si ya tienes una función que compone el HTML del detalle, inserta `renderExpBlock(p)`
// justo debajo de tu bloque de vida. Por ejemplo:
// detailContent.innerHTML = `... ${renderHpBlock(p)} ${renderExpBlock(p)} ...`

// === Event delegation para los botones de EXP en el detalle ===
document.addEventListener('click', (e) => {
  // +EXP
  const addBtn = e.target.closest('.exp-add-btn');
  if (addBtn) {
    const box = addBtn.closest('.exp-box');
    const pid = box?.getAttribute('data-pid');
    const input = box?.querySelector('.exp-add');
    const delta = Number(input?.value || 1);
    const p = window.POKE_INDEX.get(pid);
    if (!p) return;

    grantExp(p, delta);
    updateExpUI(pid, p);
    // si tienes algo que refresque el nivel en la UI:
    // updateLevelUI?.(pid, p);
    // y si guardas en disco:
    // save();
    return;
  }

  // Subir nivel (equivale a +10 exp)
  const lvlBtn = e.target.closest('.exp-lvlup-btn');
  if (lvlBtn) {
    const box = lvlBtn.closest('.exp-box');
    const pid = box?.getAttribute('data-pid');
    const p = window.POKE_INDEX.get(pid);
    if (!p) return;

    grantExp(p, (p.expMax || 10));
    updateExpUI(pid, p);
    // updateLevelUI?.(pid, p);
    // save();
  }
});


// Pequeña utilidad para refrescar solo la barra/contador sin redibujar todo
function updateExpUI(pid, pObj) {
  const box = document.querySelector(`.exp-box[data-pid="${pid}"]`);
  const p = pObj || state.list?.find(x => x.id === pid);
  if (!box || !p) return;
  ensureExpFields(p);
  const fill = box.querySelector('.exp-fill');
  const num = box.querySelector('.exp-num');
  const pct = Math.max(0, Math.min(100, (p.exp / p.expMax) * 100));
  if (fill) fill.style.width = pct + '%';
  if (num) num.textContent = `${p.exp} / ${p.expMax}`;
}


    $closeDetail.addEventListener('click', () => $detailDialog.close());

    // ===== Abrir / Guardar =====
    function openFile() {
        $openInput.click();
    }

    $openInput.addEventListener('change', (ev) => {
        const file = ev.target.files[0];
        if (!file) return;

        // Guardar nombre del archivo para updateStatus()
        currentFileName = file.name;
        try { localStorage.setItem(LS_NAME, currentFileName); } catch { }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);

                if (Array.isArray(data)) {
                    // Formato antiguo: solo entries
                    db = data.map(p => ({ id: p.id || uuid(), ...p }));
                } else if (data && Array.isArray(data.entries)) {
                    // Formato nuevo: {version, entries, bg, bag?}
                    db = data.entries.map(p => ({ id: p.id || uuid(), ...p }));

                    // Aplicar fondo si viene incluido
                    if (data.bg && typeof window.applyBackground === 'function' && typeof window.setBackgroundDataUrl === 'function') {
                        window.setBackgroundDataUrl(data.bg);
                    }

                    // Aplicar mochila si viene incluida
                    if (data.bag && typeof data.bag === 'object') {
                        try {
                            window.Bag?.setState?.(data.bag);
                        } catch { }
                    }
                } else {
                    throw new Error('Formato inválido: se esperaba un array o un objeto {entries, bg, bag}.');
                }

                setDirty(false);
                render();
                updateStatus(); // Ahora mostrará el nombre del archivo
                backup();
            } catch (err) {
                alert('Error al abrir: ' + err.message);
            }
        };
        reader.readAsText(file);

        // Reset del input para permitir reimportar el mismo archivo
        ev.target.value = '';
    });



    // Cache simple de detalles de movimientos en ES
    const moveDetailCache = {}; // { idEN: { nameEs, type, typeEs, pp, power, accuracy, class, classEs, descEs } }

    async function getMoveFullEs(id) {
        if (moveDetailCache[id]) return moveDetailCache[id];
        const r = await fetch(`${API}/move/${id}`);
        if (!r.ok) throw new Error('No se pudo cargar el movimiento: ' + id);
        const d = await r.json();

        const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;
        const type = d.type?.name || 'normal';
        const typeEsName = TYPE_META[type]?.es || type;

        const cls = d.damage_class?.name || 'status';
        const classEs = cls === 'physical' ? 'Físico' : cls === 'special' ? 'Especial' : 'Estado';

        // Coger el flavor text más "reciente" en español
        let descEs = '';
        const esFlavors = (d.flavor_text_entries || []).filter(x => x.language?.name === 'es');
        if (esFlavors.length) {
            // Elimina saltos raros
            descEs = esFlavors[0].flavor_text.replace(/\f|\n/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Obtener "effect_chance" (probabilidad de efecto), solo mostrar si no es 100
        const effectChance = d.effect_chance || null;
        const effectInfo = (effectChance && effectChance !== 100) ? `${effectChance}%` : null;

        const pack = {
            id,
            nameEs,
            type,
            typeEs: typeEsName,
            pp: d.pp ?? '—',
            power: d.power ?? '—',
            accuracy: d.accuracy ?? '—',
            class: cls,
            classEs,
            descEs: descEs || '—',
            effectInfo // Solo el porcentaje de probabilidad de efecto si no es 100
        };
        moveDetailCache[id] = pack;
        return pack;
    }

    // Cache de descripciones de habilidades
    const abilityInfoCache = {}; // { idEN: { text, nameEs } }

    async function getAbilityInfoEs(id) {
        if (!id) return { text: '—', nameEs: '' };
        if (abilityInfoCache[id]) return abilityInfoCache[id];

        const r = await fetch(`${API}/ability/${id}`);
        if (!r.ok) return { text: 'Sin descripción disponible.', nameEs: id };
        const d = await r.json();

        const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;

        // Intenta español y si no hay, cae a inglés
        const entryEs = (d.effect_entries || []).find(e => e.language?.name === 'es');
        const entryEn = (d.effect_entries || []).find(e => e.language?.name === 'en');
        const short = entryEs?.short_effect || entryEn?.short_effect || '';
        const long = entryEs?.effect || entryEn?.effect || '';
        const text = (short || long || 'Sin descripción disponible.').replace(/\n|\r/g, ' ');

        const pack = { text, nameEs };
        abilityInfoCache[id] = pack;
        return pack;
    }

    function saveToDownload() {
        const suggested = currentFileName || 'pokebox.json';
        let name = prompt('Nombre del archivo a guardar:', suggested);
        if (name === null) return;
        name = (name || '').trim();
        if (!name) return;
        if (!name.toLowerCase().endsWith('.json')) name += '.json';

        // 🟢 Toma el fondo actual y la mochila real desde el módulo
        const bg = (window.getBackgroundDataUrl && window.getBackgroundDataUrl()) || null;
        const bagState = window.Bag?.getState?.() || null;

        const payload = { version: 2, entries: db, bg, bag: bagState };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);

        currentFileName = name;
        setDirty(false);
        updateStatus();
    }

    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    // ===== Eventos =====
    const $healAllBtn = document.getElementById('healAllBtn');
    if ($healAllBtn) {
        $healAllBtn.addEventListener('click', () => {
            db.forEach(p => { p.hpCurrent = computeMaxHp(p); });
            setDirty(true);
            render();
            // si el diálogo de detalle está abierto, refrescamos su bloque HP
            if ($detailDialog.open && editingId == null) {
                // si quieres, puedes re-renderizar showDetails del último visto
            }
        });
    }

    // $openBtn.addEventListener('click', openFile);
    // $saveBtn.addEventListener('click', saveToDownload);
    $addBtn.addEventListener('click', () => {
        editMode = false; editingId = null;
        const addTitle = document.querySelector('#addDialog header h2');
        if (addTitle) addTitle.textContent = 'Añadir Pokémon';
        if ($confirm) $confirm.textContent = 'Añadir a mi base';
        resetDialog(); $dialog.showModal(); setTimeout(() => $query.focus(), 50);
    });
    $closeDialog.addEventListener('click', () => $dialog.close());
    $searchBtn.addEventListener('click', handleSearch);
    $query.addEventListener('input', () => { clearTimeout($query._t); $query._t = setTimeout(handleSearch, 200); });
    $query.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
    if ($teamBtn) {
        $teamBtn.addEventListener('click', showTeamList);
        updateTeamBtnLabel();
    }
    if ($closeTeam) {
        $closeTeam.addEventListener('click', () => $teamDialog.close());
    }



    function resetDialog() {
        // Nombre del Pokémon
        const nameInput = document.getElementById('nameInput');
        if (nameInput) nameInput.value = '';

        // Naturaleza
        const natureInput = document.getElementById('natureInput');
        if (natureInput) {
            natureInput.value = '';
            natureInput.dataset.selectedId = '';
            natureInput.dataset.selectedEs = '';
            natureInput.dataset.up = '';
            natureInput.dataset.down = '';
        }
        const natureMatches = document.getElementById('natureMatches');
        if (natureMatches) natureMatches.innerHTML = '';

        // Poké Ball
        const ballInput = document.getElementById('ballInput');
        if (ballInput) {
            ballInput.value = '';
            ballInput.dataset.selectedId = '';
            ballInput.dataset.selectedEs = '';
        }
        const ballMatches = document.getElementById('ballMatches');
        if (ballMatches) ballMatches.innerHTML = '';

        // Habilidad
        const abilityInput = document.getElementById('abilityInput');
        if (abilityInput) {
            abilityInput.value = '';
            abilityInput.dataset.selectedId = '';
            abilityInput.dataset.selectedEs = '';
        }
        const abilityMatches = document.getElementById('abilityMatches');
        if (abilityMatches) abilityMatches.innerHTML = '';

        // Movimientos
        const moveInputs = document.querySelectorAll('.move-input');
        moveInputs.forEach(inp => {
            inp.value = '';
            inp.dataset.selectedId = '';
            inp.dataset.selectedEs = '';
            const listEl = inp.parentElement.querySelector('.move-list');
            if (listEl) listEl.innerHTML = '';
        });
    }

// === Auth UI ===
const $email = document.getElementById('emailInput');
const $pass = document.getElementById('passInput');
const $signup = document.getElementById('signupBtn');
const $signin = document.getElementById('signinBtn');
const $signout = document.getElementById('signoutBtn');
const $authStatus = document.getElementById('authStatus');

function setAuthUi(logged, email) {
  if ($signup) $signup.hidden = logged;
  if ($signin) $signin.hidden = logged;
  if ($signout) $signout.hidden = !logged;
  if ($email) $email.hidden = logged;
  if ($pass) $pass.hidden = logged;
  if ($authStatus) $authStatus.textContent = logged ? `Conectado: ${email || ''}` : 'Sin sesión';
}

(async () => {
  try {
    const usr = await window.Supa?.getUser?.();
    setAuthUi(!!usr, usr?.email);
  } catch { setAuthUi(false, ''); }
})();

$signup?.addEventListener('click', async () => {
  try {
    const { value: email } = $email, { value: pass } = $pass;
    await window.Supa.signUp(email, pass);
    alert('Registro iniciado. Verifica el email si tu proyecto lo requiere.');
  } catch (e) { alert(e.message); }
});

$signin?.addEventListener('click', async () => {
  try {
    const { value: email } = $email, { value: pass } = $pass;
    await window.Supa.signIn(email, pass);
    setAuthUi(true, email);
    alert('Sesión iniciada.');
  } catch (e) { alert(e.message); }
});

$signout?.addEventListener('click', async () => {
  try {
    await window.Supa.signOut();
    setAuthUi(false, '');
  } catch (e) { alert(e.message); }
});

// === Botones nube ===
document.getElementById('cloudSaveBtn')?.addEventListener('click', saveToSupabase);
document.getElementById('cloudLoadBtn')?.addEventListener('click', loadFromSupabase);



    // abrir/cerrar
    $statusBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = $statusMenu.hasAttribute('hidden') ? false : true;
        if (open) {
            $statusMenu.hidden = true;
            $statusBtn.setAttribute('aria-expanded', 'false');
        } else {
            $statusMenu.hidden = false;
            $statusBtn.setAttribute('aria-expanded', 'true');
        }
    });

    // cerrar al clicar fuera o con Esc
    document.addEventListener('click', (e) => {
        if ($statusMenu && !$statusMenu.hidden) {
            const within = el => el && (el === e.target || el.contains(e.target));
            if (!within($statusMenu) && !within($statusBtn)) {
                $statusMenu.hidden = true;
                $statusBtn.setAttribute('aria-expanded', 'false');
            }
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && $statusMenu && !$statusMenu.hidden) {
            $statusMenu.hidden = true;
            $statusBtn.setAttribute('aria-expanded', 'false');
        }
    });


    // Cerrar listas al click fuera 
    document.addEventListener('click', (ev) => {
        const within = el => el && (el === ev.target || el.contains(ev.target));

        document.querySelectorAll('.move-list').forEach(el => {
            if (!within(el) && !within(el.parentElement)) {
                el.hidden = true;
                el.innerHTML = '';
            }
        });

        if (!within($ballMatches) && !within($ballInput)) {
            $ballMatches.hidden = true;
            $ballMatches.innerHTML = '';
        }
        if (!within($natureMatches) && !within($natureInput)) {
            $natureMatches.hidden = true;
            $natureMatches.innerHTML = '';
        }

        // Habilidad
        const aI = document.getElementById('abilityInput');
        const aL = document.getElementById('abilityMatches');
        if (!within(aL) && !within(aI)) {
            aL.hidden = true;
            aL.innerHTML = '';
        }
    });

    // === Guardar en Supabase (DB JSON) ===
async function saveToSupabase() {
  try {
    // Asegura que si el fondo en LS es dataURL, lo subimos primero y guardamos su URL
    let bg = (window.getBackgroundDataUrl && window.getBackgroundDataUrl()) || null;
    if (bg && bg.startsWith('data:')) {
      // convierte dataURL -> Blob y súbelo
      const res = await fetch(bg);
      const blob = await res.blob();
      const file = new File([blob], 'background.png', { type: blob.type || 'image/png' });
      try {
        const url = await window.Supa.uploadBg(file);
        bg = url;
        // reflecta también en LS para siguientes sesiones
        window.setBackgroundDataUrl?.(url);
      } catch (e) {
        console.warn('No se pudo subir base64 a Storage. Se guarda base64 en la DB:', e);
      }
    }

    const bagState = window.Bag?.getState?.() || null;
    const payload = { version: 2, entries: db, bg, bag: bagState };

    const id = await window.Supa.saveBox(payload, 'Mi caja');
    alert('Guardado en la nube: ' + id);
    // marca como no sucio
    setDirty(false);
  } catch (e) {
    alert('Error al guardar en la nube: ' + e.message);
  }
}

// === Cargar desde Supabase (DB JSON) ===
async function loadFromSupabase() {
  try {
    const row = await window.Supa.loadBox();
    if (!row) { alert('Aún no tienes datos guardados.'); return; }
    const data = row.data || {};

    if (Array.isArray(data.entries)) {
      db = data.entries.map(p => ({ id: p.id || (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)), ...p }));
    } else {
      db = [];
    }

    // Fondo (puede venir como URL pública)
    if (data.bg && typeof window.applyBackground === 'function' && typeof window.setBackgroundDataUrl === 'function') {
      window.setBackgroundDataUrl(data.bg);
    }

    // Mochila
    if (data.bag && typeof data.bag === 'object') {
      try { window.Bag?.setState?.(data.bag); } catch {}
    }

    render();
    updateStatus();
    setDirty(false);
    alert('Datos cargados de la nube.');
  } catch (e) {
    alert('Error al cargar de la nube: ' + e.message);
  }
}


    // ===== Inicio =====
    (async () => {
        await restore();
        updateStatus();
    })();

})();