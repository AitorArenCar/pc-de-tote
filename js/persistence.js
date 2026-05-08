/**
 * Persistencia: backup y restore desde localStorage
 */

function backup() {
    try {
        localStorage.setItem(LS_DB, JSON.stringify(db));
        if (currentFileName) localStorage.setItem(LS_NAME, currentFileName);
        if (__lastLocalChangeAt || __lastCloudUpdatedAt || __lastCloudRevision) {
            localStorage.setItem(LS_SYNC_META, JSON.stringify({
                localUpdatedAt: __lastLocalChangeAt || '',
                cloudUpdatedAt: __lastCloudUpdatedAt || '',
                cloudRevision: __lastCloudRevision || 0,
                deviceId: __deviceId
            }));
        }
    } catch { }
}

async function restore() {
    try {
        const raw = localStorage.getItem(LS_DB);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                db = arr.map(x => ({
                    id: x.id || uuid(),
                    inTeam: !!x.inTeam,
                    ...x,
                    shiny: !!x.shiny,
                    spriteShiny: x.spriteShiny || x.sprite_shiny || ''
                }));
            }
        }

        currentFileName = localStorage.getItem(LS_NAME) || null;
        try {
            const meta = JSON.parse(localStorage.getItem(LS_SYNC_META) || '{}');
            __lastLocalChangeAt = meta.localUpdatedAt || '';
            __lastCloudUpdatedAt = meta.cloudUpdatedAt || '';
            __lastCloudRevision = Number(meta.cloudRevision || 0);
        } catch { }

        // Carga mapas ES desde /data
        moveEsCache = await loadDataJson('pokebox_move_es_v1', {}) || {};
        ballEsCache = await loadDataJson('pokebox_ball_es_v1', {}) || {};
        abilityEsCache = await loadDataJson('pokebox_ability_es_v1', {}) || {};
        natureEsCache = await loadDataJson('pokebox_nature_es_v1', {}) || {};

        // Índices completos (priorizar ficheros locales)
        const mi = await loadDataJson('moveIndex_v1', null);
        if (mi && mi.names && mi.names.length) {
            moveIndex = mi;
            localStorage.setItem('moveIndex_v1', JSON.stringify(mi));
        }

        const bi = await loadDataJson('ballIndex_v1', null);
        if (Array.isArray(bi) && bi.length) {
            ballIndex = bi;
            localStorage.setItem('ballIndex_v1', JSON.stringify(bi));
        }

        const ni = await loadDataJson('natureIndex_v1', null);
        if (Array.isArray(ni) && ni.length) {
            natureIndex = ni;
            localStorage.setItem('natureIndex_v1', JSON.stringify(ni));
        }

        const ai = await loadDataJson('abilityIndex_v2', null);
        if (Array.isArray(ai) && ai.length) {
            abilityIndex = ai;
            localStorage.setItem('abilityIndex_v2', JSON.stringify(ai));
        }

        const pi = await loadDataJson('pokeIndex_v1', null);
        if (pi && pi.names && pi.names.length) {
            pokemonIndex = pi;
            localStorage.setItem('pokeIndex_v1', JSON.stringify(pi));
        }

        const itemCache = await loadDataJson('pokeapi_item_cache_v1', null);
        if (itemCache) localStorage.setItem('pokeapi_item_cache_v1', JSON.stringify(itemCache));

        const itemIndex = await loadDataJson('pokeapi_item_index_v1', null);
        if (itemIndex) localStorage.setItem('pokeapi_item_index_v1', JSON.stringify(itemIndex));

        localStorage.setItem(LS_MOVE_ES, JSON.stringify(moveEsCache));
        localStorage.setItem(LS_BALL_ES, JSON.stringify(ballEsCache));
        localStorage.setItem(LS_ABILITY_ES, JSON.stringify(abilityEsCache));
        localStorage.setItem(LS_NATURE_ES, JSON.stringify(natureEsCache));

        if (window.Bag?.render) window.Bag.render();

        render();
        updateStatus();
        updateTeamBtnLabel();
    } catch { }
}
