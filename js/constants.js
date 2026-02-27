/**
 * Constantes globales de la aplicación
 */

const API = 'https://pokeapi.co/api/v2';

// LocalStorage keys
const LS_DB = 'pokebox_last_backup_v1';
const LS_NAME = 'pokebox_last_name_v1';
const LS_MOVE_ES = 'pokebox_move_es_v1';
const LS_BALL_ES = 'pokebox_ball_es_v1';
const LS_ABILITY_ES = 'pokebox_ability_es_v1';
const LS_NATURE_ES = 'pokebox_nature_es_v1';
const DATA_BASE = './data';

// Tipos de Pokémon (ES + color)
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

// Catálogo de objetos curativos
const ITEM_CATALOG = {
    potion: { name: 'Poción', heal: 20 },
    super_potion: { name: 'Superpoción', heal: 50 },
    hyper_potion: { name: 'Hiperpoción', heal: 200 },
    max_potion: { name: 'Maxipoción', heal: 'full' }
};

// Traduce las claves de tus botones a IDs de PokeAPI
const HEAL_MAP = {
    potion: 'potion',
    super_potion: 'super-potion',
    hyper_potion: 'hyper-potion',
    max_potion: 'max-potion'
};

// Sprites de Poké Ball (PokeAPI)
const BALL_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';

// Autosave interval (ms)
const AUTOSAVE_EVERY_MS = 300000;

// Traducciones de daño en movimientos
const DAMAGE_TIER_MAP = {
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
    7: ''
};
