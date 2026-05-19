/**
 * Estado global de la aplicación
 */

// Base de datos local
let db = [];
let dirty = false;
let currentFileName = null;

// Caches/índices
let pokemonIndex = null; // {names:[]}
let moveIndex = null;    // {names:[]} (ids EN)
let natureIndex = null;  // [{id, nameEs, up, down}]
let ballIndex = null;    // [{id}]
let abilityIndex = null; // array de ids EN
let natureIdList = null; // ['adamant','timid',...]

// Caches de traducciones ES
let moveEsCache = {};    // { idEN: nombreES }
let ballEsCache = {};    // { idEN: nombreES }
let abilityEsCache = {}; // { idEN: nombreES }
let natureEsCache = {};  // { idEN: { nameEs, up, down } }

// Elementos DOM principales
let $grid = null;
let $empty = null;
let $dialog = null;
let $closeDialog = null;
let $detailDialog = null;
let $teamDialog = null;
let $tradeInitDialog = null;
let $tradePendingDialog = null;
let $authDialog = null;
let $sideMenu = null;
let $hamburgerBtn = null;
let $boxSwitchBtn = null;
let $boxSwitchMenu = null;
let $menuOverlay = null;

// UI refs
let $statusBtn = null;
let $statusMenu = null;
let $cloudBtn = null;
let $cloudMenu = null;

// Dialog refs
let $addBtn = null;
let $teamBtn = null;
let $confirm = null;
let $extra = null;
let $query = null;
let $searchBtn = null;
let $feedback = null;
let $matches = null;
let $result = null;

// Edit mode
let editMode = false;
let editingId = null;

// Trade state
let currentTradeState = {
    selectedUserId: null,
    selectedUserEmail: null,
    selectedUserPokemonList: [],
    myPokemonId: null,
    targetPokemonId: null,
    targetUserId: null
};

// Pending base (snapshot del pokémon en búsqueda)
let pendingBase = null;

// Autosave state
let __autosaveTimer = null;
let __autosaveInFlight = false;
let __isLoggedIn = false;
let __cloudEmail = '';
let __syncDebounceTimer = null;
let __syncReady = false;
let __syncInitializing = false;
let __applyingRemoteSync = false;
let __boxSubscription = null;
let __lastCloudRevision = 0;
let __lastCloudUpdatedAt = '';
let __lastLocalChangeAt = '';
let currentBoxId = DEFAULT_BOX_ID;
let currentBoxName = 'Mi caja';
let currentCloudBoxId = null;
let __boxCatalog = [];

function getDeviceId() {
    try {
        let id = localStorage.getItem(LS_DEVICE_ID);
        if (!id) {
            id = (window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);
            localStorage.setItem(LS_DEVICE_ID, id);
        }
        return id;
    } catch {
        return 'device-unknown';
    }
}

const __deviceId = getDeviceId();

function createLocalBoxId() {
    return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBoxName(name) {
    return String(name || '').trim() || 'Mi caja';
}

function normalizeBoxRecord(box) {
    if (!box || typeof box !== 'object') return null;
    const id = String(box.id || '').trim();
    if (!id) return null;
    return {
        id,
        name: normalizeBoxName(box.name),
        cloudId: box.cloudId ? String(box.cloudId) : null
    };
}

function loadBoxCatalog() {
    try {
        const raw = localStorage.getItem(LS_BOX_CATALOG);
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) {
            __boxCatalog = parsed.map(normalizeBoxRecord).filter(Boolean);
        }
    } catch {
        __boxCatalog = [];
    }

    if (!__boxCatalog.some(box => box.id === DEFAULT_BOX_ID)) {
        const legacyName = localStorage.getItem(LS_NAME);
        __boxCatalog.unshift({ id: DEFAULT_BOX_ID, name: normalizeBoxName(legacyName || 'Mi caja'), cloudId: null });
    }

    const seen = new Set();
    __boxCatalog = __boxCatalog.filter(box => {
        if (seen.has(box.id)) return false;
        seen.add(box.id);
        return true;
    });

    const active = localStorage.getItem(LS_ACTIVE_BOX) || DEFAULT_BOX_ID;
    const selected = __boxCatalog.find(box => box.id === active) || __boxCatalog[0];
    currentBoxId = selected.id;
    currentBoxName = selected.name;
    currentCloudBoxId = selected.cloudId || null;
    saveBoxCatalog();
}

function saveBoxCatalog() {
    try {
        localStorage.setItem(LS_BOX_CATALOG, JSON.stringify(__boxCatalog));
        localStorage.setItem(LS_ACTIVE_BOX, currentBoxId);
    } catch { }
}

function getActiveBoxRecord() {
    let box = __boxCatalog.find(item => item.id === currentBoxId);
    if (!box) {
        box = { id: currentBoxId || DEFAULT_BOX_ID, name: currentBoxName || 'Mi caja', cloudId: currentCloudBoxId || null };
        __boxCatalog.push(box);
    }
    box.name = normalizeBoxName(currentBoxName || box.name);
    box.cloudId = currentCloudBoxId || box.cloudId || null;
    return box;
}

function setActiveBoxRecord(box) {
    const normalized = normalizeBoxRecord(box);
    if (!normalized) return;
    currentBoxId = normalized.id;
    currentBoxName = normalized.name;
    currentCloudBoxId = normalized.cloudId || null;

    const index = __boxCatalog.findIndex(item => item.id === normalized.id);
    if (index >= 0) {
        __boxCatalog[index] = { ...__boxCatalog[index], ...normalized };
    } else {
        __boxCatalog.push(normalized);
    }
    saveBoxCatalog();
}

function updateActiveBoxRecord(patch = {}) {
    const box = getActiveBoxRecord();
    Object.assign(box, patch);
    currentBoxName = normalizeBoxName(box.name);
    currentCloudBoxId = box.cloudId || null;
    saveBoxCatalog();
}

function mergeCloudBoxes(rows = []) {
    let changed = false;
    rows.forEach(row => {
        if (!row?.id) return;
        const cloudId = String(row.id);
        const name = normalizeBoxName(row.name || row.data?.boxName || 'Mi caja');
        let box = __boxCatalog.find(item => item.cloudId === cloudId);
        if (!box) {
            box = { id: `cloud-${cloudId}`, name, cloudId };
            __boxCatalog.push(box);
            changed = true;
        } else if (box.name !== name) {
            box.name = name;
            changed = true;
        }
    });
    if (changed) saveBoxCatalog();
}

function getScopedStorageKey(key, boxId = currentBoxId) {
    const scopedBoxId = boxId || DEFAULT_BOX_ID;
    return scopedBoxId === DEFAULT_BOX_ID ? key : `${key}:${scopedBoxId}`;
}

window.getScopedStorageKey = getScopedStorageKey;

// Toast timer
let __toastTimer = null;

// Poke Index map
window.POKE_INDEX = new Map();

// Estado de búsqueda/autocomplete
let moveDetailCache = {}; // { idEN: { nameEs, type, typeEs, pp, power, accuracy, class, classEs, descEs } }
let abilityInfoCache = {}; // { idEN: { text, nameEs } }
