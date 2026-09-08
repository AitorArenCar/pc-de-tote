/**
 * Módulo de índices y búsqueda de datos
 */

async function ensurePokemonIndex() {
    if (pokemonIndex) return pokemonIndex;
    const cached = JSON.parse(localStorage.getItem('pokeIndex_v1') || 'null');
    if (cached?.names?.length) {
        pokemonIndex = cached;
        return cached;
    }
    const r = await fetch(`${API}/pokemon?limit=20000&offset=0`);
    if (!r.ok) throw new Error('No se pudo cargar índice de Pokémon');
    const j = await r.json();
    pokemonIndex = { names: j.results.map(x => x.name) };
    localStorage.setItem('pokeIndex_v1', JSON.stringify(pokemonIndex));
    return pokemonIndex;
}

async function ensureMoveIndex() {
    if (moveIndex) return moveIndex;
    const fromFile = await loadDataJson('moveIndex_v1', null);
    if (fromFile?.names?.length) {
        moveIndex = fromFile;
        return moveIndex;
    }

    const r = await fetch(`${API}/move?limit=2000&offset=0`);
    if (!r.ok) throw new Error('No se pudo cargar índice de movimientos');
    const j = await r.json();
    moveIndex = { names: j.results.map(x => x.name) };
    return moveIndex;
}

async function ensureBallIndex() {
    if (ballIndex) return ballIndex;
    const fromFile = await loadDataJson('ballIndex_v1', null);
    if (Array.isArray(fromFile) && fromFile.length) {
        ballIndex = fromFile;
        return ballIndex;
    }

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

async function ensureNatureIndex() {
    if (natureIndex) return natureIndex;
    const fromFile = await loadDataJson('natureIndex_v1', null);
    if (Array.isArray(fromFile) && fromFile.length) {
        natureIndex = fromFile;
        return natureIndex;
    }

    const r = await fetch(`${API}/nature?limit=100&offset=0`);
    if (!r.ok) throw new Error('No se pudo cargar naturalezas');
    const j = await r.json();
    const out = await Promise.all((j.results || []).map(async n => {
        const d = await (await fetch(n.url)).json();
        const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;
        return {
            id: d.name,
            nameEs,
            up: d.increased_stat?.name || null,
            down: d.decreased_stat?.name || null
        };
    }));
    natureIndex = out;
    return natureIndex;
}

async function ensureAbilityIndex() {
    if (abilityIndex) return abilityIndex;
    const fromFile = await loadDataJson('abilityIndex_v2', null);
    if (Array.isArray(fromFile) && fromFile.length) {
        abilityIndex = fromFile;
        return abilityIndex;
    }

    const r = await fetch(`${API}/ability?limit=2000&offset=0`);
    if (!r.ok) throw new Error('No se pudo cargar habilidades');
    const j = await r.json();
    abilityIndex = (j.results || []).map(a => a.name);
    return abilityIndex;
}

async function ensureNatureIdList() {
    if (Array.isArray(natureIdList) && natureIdList.length) return natureIdList;
    const idx = await ensureNatureIndex();
    if (Array.isArray(idx) && idx.length) {
        natureIdList = idx.map(n => n.id);
        return natureIdList;
    }
    return [];
}

// Helpers ES

async function moveEs(id) {
    if (moveEsCache[id]) return moveEsCache[id];
    const d = await (await fetch(`${API}/move/${id}`)).json();
    const es = (d.names || []).find(x => x.language?.name === 'es')?.name || id;
    moveEsCache[id] = es;
    backup();
    return es;
}

async function ballEs(id) {
    if (ballEsCache[id]) return ballEsCache[id];
    const d = await (await fetch(`${API}/item/${id}`)).json();
    const es = (d.names || []).find(x => x.language?.name === 'es')?.name || id;
    ballEsCache[id] = es;
    backup();
    return es;
}

async function abilityEs(name) {
    if (abilityEsCache[name]) return abilityEsCache[name];
    const d = await (await fetch(`${API}/ability/${name}`)).json();
    const es = (d.names || []).find(x => x.language?.name === 'es')?.name || name;
    abilityEsCache[name] = es;
    backup();
    return es;
}

async function natureEs(id) {
    if (natureEsCache[id]) return natureEsCache[id];
    const d = await (await fetch(`${API}/nature/${id}`)).json();
    const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;
    const up = d.increased_stat?.name || null;
    const down = d.decreased_stat?.name || null;
    const pack = { nameEs, up, down };
    natureEsCache[id] = pack;
    backup();
    return pack;
}
