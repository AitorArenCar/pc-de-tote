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

// Toast timer
let __toastTimer = null;

// Poke Index map
window.POKE_INDEX = new Map();

// Estado de búsqueda/autocomplete
let moveDetailCache = {}; // { idEN: { nameEs, type, typeEs, pp, power, accuracy, class, classEs, descEs } }
let abilityInfoCache = {}; // { idEN: { text, nameEs } }
