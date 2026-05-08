/**
 * Utilidades y funciones auxiliares comunes
 */

// Capitaliza la primera letra
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// Genera UUID
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

// Normaliza string a minúsculas para búsqueda
const norm = s => (s || '').toLowerCase();

// Carga datos JSON desde /data con fallback
async function loadDataJson(baseName, fallback = null) {
    try {
        const r = await fetch(`${DATA_BASE}/${baseName}.json`, { cache: 'no-store' });
        if (!r.ok) throw 0;
        return await r.json();
    } catch {
        return fallback;
    }
}

// Obtiene URL del sprite (shiny o normal)
const spriteUrlOf = (p) => {
    if (!p) return '';
    const shinyUrl = p.spriteShiny || p.sprite_shiny || '';
    if (p.shiny && shinyUrl) return shinyUrl;
    return p.sprite || '';
};

// Aliases para compatibilidad
const spriteUrl = (p) => spriteUrlOf(p);
const shinyUrl = (p) => p ? (p.spriteShiny || p.sprite_shiny || '') : '';

// Obtiene color del tipo
const typeColor = (id) => {
    const m = TYPE_META[id] || {};
    return m.bg || 'rgba(255,255,255,.06)';
};

// Devuelve URL del sprite de poké ball
function ballSpriteUrl(ballId) {
    return `${BALL_SPRITE_BASE}${ballId}.png`;
}

// SVG del icono de equipo
function teamIconSVG(inTeam) {
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

// Muestra toast notificación
function toast(message, variant = 'success', ms = 2200) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.className = 'toast';
    el.classList.add(variant);
    el.textContent = message;
    el.classList.add('show');

    if (__toastTimer) clearTimeout(__toastTimer);
    __toastTimer = setTimeout(() => {
        el.classList.remove('show');
    }, ms);
}

// Cierra toast con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const el = document.getElementById('toast');
        if (el) el.classList.remove('show');
        if (__toastTimer) clearTimeout(__toastTimer);
    }
});

// Calcula el tier de daño de un movimiento
function calcDamageTier(power) {
    if (power == null || power === '—') return '—';
    if (power <= 50) return 1;
    if (power <= 79) return 2;
    if (power <= 99) return 3;
    if (power <= 119) return 4;
    if (power <= 140) return 5;
    if (power <= 200) return 6;
    return 7;
}

// Obtiene nombre ES de un tipo
const typeEs = id => TYPE_META[id]?.es || id;

// Obtiene chip HTML de tipo
const typeChip = id => {
    const m = TYPE_META[id] || {};
    const es = m.es || id;
    const bg = m.bg || 'rgba(255,255,255,.06)';
    const fg = m.fg || '#0b1020';
    return `<span class="chip type-chip" style="background:${bg};color:${fg};border-color:${bg}">${es}</span>`;
};

// Inicializa campos de experiencia
function ensureExpFields(p) {
    if (typeof p.exp !== 'number' || isNaN(p.exp)) p.exp = 0;
    if (typeof p.expMax !== 'number' || isNaN(p.expMax)) p.expMax = 10;
    if (typeof p.level !== 'number' || isNaN(p.level)) p.level = 1;
    return p;
}

// Concede EXP con carry-over de nivel
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

    updateExpUI(p.id, p);

    if (levelsUp > 0) {
        refreshDetailInline(p);
        refreshGridInline();
    }

    return p;
}

// Establece EXP exacta
function setExp(p, value) {
    ensureExpFields(p);
    p.exp = Math.max(0, Math.min(p.expMax, Number(value) || 0));
    return p;
}

// Refresca UI de EXP
function updateExpUI(pid, pObj) {
    const box = document.querySelector(`.exp-box[data-pid="${pid}"]`);
    const p = pObj || window.POKE_INDEX?.get(pid);
    if (!box || !p) return;
    ensureExpFields(p);
    const fill = box.querySelector('.exp-fill');
    const num = box.querySelector('.exp-num');
    const pct = Math.max(0, Math.min(100, (p.exp / p.expMax) * 100));
    if (fill) fill.style.width = pct + '%';
    if (num) num.textContent = `${p.exp} / ${p.expMax}`;
}

// Refresca detalle inline
function refreshDetailInline(p) {
    const dialog = document.querySelector('#detailDialog');
    if (!dialog || !dialog.open) return;

    const root = document.querySelector('#detailContent');
    if (!root) return;
    if (root.getAttribute('data-pid') !== p.id) return;

    root.querySelectorAll('.detail-level').forEach(el => { el.textContent = p.level; });

    const titleLvl = document.querySelector('.detail-level-title');
    if (titleLvl) titleLvl.textContent = p.level;

    updateExpUI(p.id, p);
}

// Refresca grid inline
function refreshGridInline() {
    document.querySelectorAll('.poke[data-pid]').forEach(card => {
        const pid = card.getAttribute('data-pid');
        const poke = window.POKE_INDEX.get(pid);
        if (!poke) return;
        const lvlEl = card.querySelector('.poke-level');
        if (lvlEl) lvlEl.textContent = poke.level;
    });
}

// Dispara evento de subida de nivel
function emitLevelUpEvent(p, levelsUp) {
    document.dispatchEvent(new CustomEvent('pokemon:levelup', {
        detail: { pokemon: p, levelsUp }
    }));
}

// Etiqueta de estadística
function statLabel(id) {
    return ({
        hp: 'PS',
        atk: 'Ataque',
        def: 'Defensa',
        spa: 'At. Esp.',
        spd: 'Def. Esp.',
        spe: 'Velocidad'
    })[id] || id;
}

// Orden de estadísticas
function statOrder() {
    return ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
}
