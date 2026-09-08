/**
 * Sistema de vida (HP) y curación
 */

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

function medPocket() {
    return window.Bag?.getState?.()?.pockets?.medicine || {};
}

// Cuenta por nombre en español
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

// Consume 1 unidad buscando por nombre en español
function bagConsumeByEsName(esName) {
    const dict = medPocket();
    for (const [id, pack] of Object.entries(dict)) {
        if ((pack.nameEs || '').toLowerCase() === esName.toLowerCase() && (pack.qty || 0) > 0) {
            return !!window.Bag?.equipReserve?.(id);
        }
    }
    return false;
}

function bagCountNew(id) {
    const state = window.Bag?.getState?.();
    if (!state) return 0;
    const med = state.pockets?.medicine || {};
    return med[id]?.qty || 0;
}

function bagConsumeNew(id) {
    return !!window.Bag?.equipReserve?.(id);
}
