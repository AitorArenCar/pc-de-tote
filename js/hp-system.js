/**
 * Sistema de vida (HP) y curación
 */

function computeMaxHp(p) {
    const lvl = Number(p.level || 0);
    const basePs = Number(p.stats?.hp || 0);
    return Math.max(0, (basePs * 2 + lvl) * 2);
}

function ensureHp(p) {
    const max = computeMaxHp(p);
    if (typeof p.hpCurrent !== 'number' || isNaN(p.hpCurrent)) p.hpCurrent = max;
    p.hpCurrent = Math.min(Math.max(0, p.hpCurrent), max);
    return { max, current: p.hpCurrent };
}

function hpRatioOf(p) {
    const { max, current } = ensureHp(p);
    return max > 0 ? current / max : 0;
}

function applyHpRatio(p, ratio) {
    const max = computeMaxHp(p);
    p.hpCurrent = ratio > 0 && max > 0
        ? Math.min(max, Math.max(1, Math.round(max * ratio))) : 0;
}

function refreshHpUI(p, root) {
    const { max, current } = ensureHp(p);
    const fill = root.querySelector('.hp-fill');
    const num = root.querySelector('.hp-num');
    const input = root.querySelector('.hp-input');
    const ratio = max > 0 ? current / max : 0;
    if (fill) {
        fill.style.width = (ratio * 100) + '%';
        fill.style.background = ratio <= 0.125 ? '#ef4444'
            : ratio < 0.25 ? '#f97316'
            : ratio <= 0.5 ? '#facc15' : '#22c55e';
    }
    if (num) num.textContent = `${current} / ${max}`;
    if (input) {
        input.max = String(max);
        input.value = String(current);
    }
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
