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
    selectedUserBoxes: [],
    selectedUserBoxId: null,
    selectedUserBoxName: null,
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
let __cloudUserId = '';
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

function createUserLocalBoxId(userId) {
    return `local-user-${String(userId || 'anon')}`;
}

function createCloudBoxId(cloudId) {
    return `cloud-${String(cloudId || '').trim()}`;
}

function normalizeBoxName(name) {
    const cleanName = String(name || '').trim();
    const limitedName = Array.from(cleanName).slice(0, BOX_NAME_MAX_LENGTH).join('').trim();
    return limitedName || 'Mi caja';
}

function isBoxNameOverLimit(name) {
    return Array.from(String(name || '').trim()).length > BOX_NAME_MAX_LENGTH;
}

function normalizeBoxRecord(box) {
    if (!box || typeof box !== 'object') return null;
    const id = String(box.id || '').trim();
    const cloudId = box.cloudId ? String(box.cloudId) : null;
    if (!id && !cloudId) return null;
    return {
        id: cloudId ? createCloudBoxId(cloudId) : id,
        name: normalizeBoxName(box.name),
        cloudId,
        cloudOwnerId: box.cloudOwnerId ? String(box.cloudOwnerId) : null,
        localOwnerId: box.localOwnerId ? String(box.localOwnerId) : null
    };
}

function compactBoxCatalog() {
    const mergedById = new Map();
    (__boxCatalog || []).forEach(rawBox => {
        const box = normalizeBoxRecord(rawBox);
        if (!box) return;
        const existing = mergedById.get(box.id);
        if (!existing) {
            mergedById.set(box.id, box);
            return;
        }
        mergedById.set(box.id, {
            ...existing,
            ...box,
            name: box.name || existing.name,
            cloudId: box.cloudId || existing.cloudId || null,
            cloudOwnerId: box.cloudOwnerId || existing.cloudOwnerId || null,
            localOwnerId: box.localOwnerId || existing.localOwnerId || null
        });
    });
    __boxCatalog = Array.from(mergedById.values());
    if (currentCloudBoxId) currentBoxId = createCloudBoxId(currentCloudBoxId);
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

    compactBoxCatalog();

    const active = localStorage.getItem(LS_ACTIVE_BOX) || DEFAULT_BOX_ID;
    const selected = __boxCatalog.find(box => box.id === active) || __boxCatalog.find(box => box.cloudId && createCloudBoxId(box.cloudId) === active) || __boxCatalog[0];
    currentBoxId = selected.id;
    currentBoxName = selected.name;
    currentCloudBoxId = selected.cloudId || null;
    compactBoxCatalog();
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
        box = {
            id: currentBoxId || DEFAULT_BOX_ID,
            name: currentBoxName || 'Mi caja',
            cloudId: currentCloudBoxId || null,
            cloudOwnerId: currentCloudBoxId && __cloudUserId ? __cloudUserId : null,
            localOwnerId: !currentCloudBoxId && __cloudUserId ? __cloudUserId : null
        };
        __boxCatalog.push(box);
    }
    box.name = normalizeBoxName(currentBoxName || box.name);
    box.cloudId = currentCloudBoxId || box.cloudId || null;
    if (box.cloudId) {
        box.id = createCloudBoxId(box.cloudId);
        currentBoxId = box.id;
    }
    if (box.cloudId && __cloudUserId) box.cloudOwnerId = box.cloudOwnerId || __cloudUserId;
    if (!box.cloudId && __cloudUserId) box.localOwnerId = box.localOwnerId || __cloudUserId;
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
    compactBoxCatalog();
    saveBoxCatalog();
}

function updateActiveBoxRecord(patch = {}) {
    const box = getActiveBoxRecord();
    Object.assign(box, patch);
    currentBoxName = normalizeBoxName(box.name);
    currentCloudBoxId = box.cloudId || null;
    if (currentCloudBoxId) currentBoxId = createCloudBoxId(currentCloudBoxId);
    compactBoxCatalog();
    saveBoxCatalog();
}

function mergeCloudBoxes(rows = [], ownerId = __cloudUserId) {
    let changed = false;
    rows.forEach(row => {
        if (!row?.id) return;
        const cloudId = String(row.id);
        const cloudOwnerId = ownerId ? String(ownerId) : null;
        const name = normalizeBoxName(row.name || row.data?.boxName || 'Mi caja');
        let box = __boxCatalog.find(item => item.cloudId === cloudId);
        if (!box) {
            box = { id: createCloudBoxId(cloudId), name, cloudId, cloudOwnerId, localOwnerId: null };
            __boxCatalog.push(box);
            changed = true;
        } else {
            const canonicalId = createCloudBoxId(cloudId);
            if (box.id !== canonicalId) {
                box.id = canonicalId;
                if (currentCloudBoxId === cloudId) currentBoxId = canonicalId;
                changed = true;
            }
            if (box.name !== name) {
                box.name = name;
                changed = true;
            }
            if (cloudOwnerId && box.cloudOwnerId !== cloudOwnerId) {
                box.cloudOwnerId = cloudOwnerId;
                changed = true;
            }
        }
    });
    compactBoxCatalog();
    if (changed) saveBoxCatalog();
}

function ensureUserLocalBox(userId, name = 'Caja local') {
    const localOwnerId = String(userId || '');
    const id = createUserLocalBoxId(localOwnerId);
    let box = __boxCatalog.find(item => item.id === id);
    if (!box) {
        box = { id, name: normalizeBoxName(name), cloudId: null, cloudOwnerId: null, localOwnerId };
        __boxCatalog.push(box);
        saveBoxCatalog();
    }
    return box;
}

function getVisibleBoxCatalog() {
    compactBoxCatalog();
    const boxes = __boxCatalog || [];
    if (!__isLoggedIn || !__cloudUserId) return boxes;
    return boxes.filter(box => {
        if (box.cloudId) return box.cloudOwnerId === __cloudUserId;
        return box.localOwnerId === __cloudUserId;
    });
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
