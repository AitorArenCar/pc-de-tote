/**
 * Sistemas de movimientos y detalles de ataques
 */

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

    let descEs = '';
    const esFlavors = (d.flavor_text_entries || []).filter(x => x.language?.name === 'es');
    if (esFlavors.length) {
        descEs = esFlavors[0].flavor_text.replace(/\f|\n/g, ' ').replace(/\s+/g, ' ').trim();
    }

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
        effectInfo
    };
    moveDetailCache[id] = pack;
    return pack;
}

async function getAbilityInfoEs(id) {
    if (!id) return { text: '—', nameEs: '' };
    if (abilityInfoCache[id]) return abilityInfoCache[id];

    const r = await fetch(`${API}/ability/${id}`);
    if (!r.ok) return { text: 'Sin descripción disponible.', nameEs: id };
    const d = await r.json();

    const nameEs = (d.names || []).find(x => x.language?.name === 'es')?.name || d.name;

    const entryEs = (d.effect_entries || []).find(e => e.language?.name === 'es');
    const entryEn = (d.effect_entries || []).find(e => e.language?.name === 'en');
    const short = entryEs?.short_effect || entryEn?.short_effect || '';
    const long = entryEs?.effect || entryEn?.effect || '';
    const text = (short || long || 'Sin descripción disponible.').replace(/\n|\r/g, ' ');

    const pack = { text, nameEs };
    abilityInfoCache[id] = pack;
    return pack;
}

/**
 * Calcula el daño de un movimiento basado en las estadísticas del Pokémon
 * Fórmula simplificada: Daño = Potencia + Stat + (STAB ? 2 : 0)
 * @param {Object} pokemon - Objeto del Pokémon con level, types, stats, etc.
 * @param {Object} move - Objeto del movimiento con power, type, class, etc.
 * @returns {Object} - {damage: número o null, isVariablePower: bool, description: string}
 */
function calculateMoveDamage(pokemon, move) {
    if (!pokemon || !move) return { damage: null, isVariablePower: false, description: 'Sin datos' };

    const moveId = move.id || '';
    const moveName = move.nameEs || '';
    const power = move.power;
    const moveType = move.type || 'normal';
    const damageClass = move.class || 'status';
    const stats = pokemon.stats || {};
    const pokemonTypes = pokemon.types || [];

    // Movimientos de estado no hacen daño
    if (damageClass === 'status') {
        return { damage: null, isVariablePower: false, description: 'Movimiento de estado' };
    }

    // Identificar movimientos con potencia variable
    // algunos movimientos tienen una "potencia" especial o condiciones que
    // no caben en la fórmula genérica. Para ellos redirigimos a getVariablePowerDamage
    // usando un pequeño identificador que el switch maneja.
const variablePowerMoves = {
  // ===== DAÑO FIJO / POR NIVEL =====
  "seismic-toss": "seismic",        // daño = nivel (tipo Lucha)
  "night-shade": "level",           // daño = nivel
  "psywave": "level-range",         // daño aleatorio basado en nivel
  "dragon-rage": "fixed",           // 40 PS
  "sonic-boom": "fixed",            // 20 PS

  // ===== “CORTA” PS (MITAD DE PS ACTUALES) =====
  "super-fang": "half-current-hp",
  "nature-s-madness": "half-current-hp",
  "ruination": "half-current-hp",

  // ===== IGUALA PS / SACRIFICA PS =====
  "endeavor": "hp-equalize",        // baja al rival hasta tus PS actuales
  "final-gambit": "user-current-hp",// daño = PS actuales del usuario (y el usuario cae)

  // ===== DEVUELVEN DAÑO RECIBIDO (COUNTER-TYPE) =====
  "counter": "reflect-damage",
  "mirror-coat": "reflect-damage",
  "metal-burst": "reflect-damage",
  "bide": "reflect-damage",
  "comeuppance": "reflect-damage",

  // ===== DEPENDE DEL EQUIPO =====
  "beat-up": "beat-up",

  // ===== DEPENDE DEL PESO =====
  "low-kick": "low-kick",           // potencia por peso del objetivo
  "grass-knot": "low-kick",         // potencia por peso del objetivo
  "heavy-slam": "weight-ratio",     // potencia por ratio de pesos (usuario vs objetivo)
  "heat-crash": "weight-ratio",     // potencia por ratio de pesos (usuario vs objetivo)

  // ===== DEPENDE DEL OBJETO =====
  "acrobatics": "acrobatics",       // potencia se duplica sin objeto

  // ===== DEPENDE DE LOS PS DEL USUARIO =====
  "eruption": "user-hp",            // potencia baja con PS restantes
  "water-spout": "user-hp",         // potencia baja con PS restantes
  "flail": "low-user-hp",           // potencia sube cuanto menos PS tengas
  "reversal": "low-user-hp",        // potencia sube cuanto menos PS tengas

  // ===== DEPENDE DE LOS PS DEL OBJETIVO =====
  "crush-grip": "target-hp",
  "wring-out": "target-hp",

  // ===== DEPENDE DE VELOCIDADES (RATIO) =====
  "gyro-ball": "speed-ratio",
  "electro-ball": "speed-ratio",

  // ===== DEPENDE DE PP RESTANTES =====
  "trump-card": "pp",

  // ===== DEPENDE DE BOOSTS (ESTADÍSTICAS EN ETAPAS) =====
  "stored-power": "user-boosts",
  "power-trip": "user-boosts",
  "punishment": "target-boosts",

  // ===== DEPENDE DE BAYA (TIPO+POTENCIA) =====
  "natural-gift": "berry",

  // ===== DEPENDE DE STOCKPILE =====
  "spit-up": "stockpile",

  // ===== ALEATORIOS =====
  "magnitude": "random-power",
  "present": "random-power"
};

    if (variablePowerMoves[moveId]) {
        return getVariablePowerDamage(pokemon, move, variablePowerMoves[moveId]);
    }

    // Para movimientos normales
    if (power === '—' || power == null) {
        return { damage: null, isVariablePower: false, description: 'Sin potencia definida' };
    }

    // Usar calcDamageTier para convertir la potencia real al rango (1-7)
    const powerTier = calcDamageTier(power);
    if (powerTier === '—' || powerTier == null) {
        return { damage: null, isVariablePower: false, description: 'Potencia indefinida' };
    }

    // Determinar si es ataque físico o especial y obtener stat
    const isPhysical = damageClass === 'physical';
    const attackStat = isPhysical ? (stats.atk || 0) : (stats.spa || 0);

    // Calcular STAB
    const hasSAB = pokemonTypes.includes(moveType);
    const stabBonus = hasSAB ? 2 : 0;

    // Fórmula simplificada: TierPotencia + Stat + (STAB ? 2 : 0)
    const finalDamage = powerTier + attackStat + stabBonus;

    const tierText = DAMAGE_TIER_MAP[powerTier] || 'Desconocido';
    const stabText = hasSAB ? ' + STAB (+2)' : '';
    const description = `${powerTier} + ${attackStat} (stat)${stabText} = ${finalDamage}`;

    return {
        damage: finalDamage,
        isVariablePower: false,
        description,
        stabApplied: hasSAB
    };
}

/**
 * Calcula daño para movimientos especiales con potencia variable
 */
function getVariablePowerDamage(pokemon, move, type) {
    const moveName = move.nameEs || '';
    const stats = pokemon.stats || {};
    const pokemonTypes = pokemon.types || [];
    const moveType = move.type || 'normal';
    const hasSAB = pokemonTypes.includes(moveType);
    const stabBonus = hasSAB ? 2 : 0;

switch (type) {
  case 'seismic':
    return {
      damage: null,
      isVariablePower: true,
      description: `Daño = Nivel + ${stats.atk || 0} (stat)${hasSAB ? ' + 2 (STAB)' : ''}`,
      table: [
        { nivel: 5, 'stat+stab': 5 + (stats.atk || 0) + stabBonus },
        { nivel: 25, 'stat+stab': 25 + (stats.atk || 0) + stabBonus },
        { nivel: 50, 'stat+stab': 50 + (stats.atk || 0) + stabBonus },
        { nivel: 100, 'stat+stab': 100 + (stats.atk || 0) + stabBonus }
      ]
    };

  case 'acrobatics': {
    const acrobaticsAttack = stats.atk || 0;
    const noItemTier = calcDamageTier(110);  // sin ítem
    const withItemTier = calcDamageTier(55); // con ítem

    return {
      damage: null,
      isVariablePower: true,
      description: `El daño varía según si tiene ítem equipado`,
      table: [
        {
          condicion: `Sin ítem (${DAMAGE_TIER_MAP[noItemTier]})`,
          daño: noItemTier + acrobaticsAttack + stabBonus
        },
        {
          condicion: `Con ítem (${DAMAGE_TIER_MAP[withItemTier]})`,
          daño: withItemTier + acrobaticsAttack + stabBonus
        }
      ]
    };
  }

  case 'unwind':
    return {
      damage: null,
      isVariablePower: true,
      description: `Daño = 18 × estacks + ${stats.atk || 0}${hasSAB ? ' + 2 (STAB)' : ''}`,
      table: [
        { stacks: 0, daño: 0 + (stats.atk || 0) + stabBonus },
        { stacks: 1, daño: 18 + (stats.atk || 0) + stabBonus },
        { stacks: 2, daño: 36 + (stats.atk || 0) + stabBonus },
        { stacks: 3, daño: 54 + (stats.atk || 0) + stabBonus },
        { stacks: 4, daño: 72 + (stats.atk || 0) + stabBonus },
        { stacks: 5, daño: 90 + (stats.atk || 0) + stabBonus }
      ]
    };

  case 'fixed': {
    // Sonic Boom (20) / Dragon Rage (40)
    const fixedDamage = moveName.includes('Sonic') || moveName.includes('sónico') ? 20 : 40;
    return {
      damage: fixedDamage + stabBonus,
      isVariablePower: true,
      description: `Daño fijo: ${fixedDamage}${hasSAB ? ' + 2 (STAB)' : ''} = ${fixedDamage + stabBonus}`,
      note: 'Este movimiento hace daño fijo, independiente de los stats'
    };
  }

  case 'half-current-hp':
    // Super Fang / Nature's Madness / Ruination
    return {
      damage: null,
      isVariablePower: true,
      description: `Daño = 50% de los PS actuales del objetivo${hasSAB ? ' + 2 (STAB)' : ''}`,
      note: 'Necesita los PS actuales del objetivo para calcular el daño exacto'
    };

  case 'hp-equalize':
    // Endeavor
    return {
      damage: null,
      isVariablePower: true,
      description: `Reduce los PS del objetivo hasta igualarlos a tus PS actuales${hasSAB ? ' + 2 (STAB)' : ''}`,
      note: 'Necesita PS actuales del usuario y del objetivo para calcular el resultado'
    };

  case 'user-current-hp':
    // Final Gambit
    return {
      damage: null,
      isVariablePower: true,
      description: `Daño = PS actuales del usuario${hasSAB ? ' + 2 (STAB)' : ''}`,
      note: 'El usuario cae; requiere PS actuales del usuario para el daño exacto'
    };

  case 'reflect-damage':
    // Counter / Mirror Coat / Metal Burst / Bide / Comeuppance
    return {
      damage: null,
      isVariablePower: true,
      description: `Devuelve un multiplicador del daño recibido${hasSAB ? ' + 2 (STAB)' : ''}`,
      note: 'Necesita el daño recibido previamente para calcular el daño exacto'
    };

  case 'level': {
    const level = Number(pokemon.level || 50);
    return {
      damage: level + stabBonus,
      isVariablePower: true,
      description: `Daño = Nivel (${level})${hasSAB ? ' + 2 (STAB)' : ''} = ${level + stabBonus}`
    };
  }

  case 'level-range': {
    const levelRange = Number(pokemon.level || 50);
    return {
      damage: null,
      isVariablePower: true,
      description: `Daño = 50-150% del nivel`,
      table: [
        { rango: '50%', daño: Math.round(levelRange * 0.5) + stabBonus },
        { rango: '100%', daño: levelRange + stabBonus },
        { rango: '150%', daño: Math.round(levelRange * 1.5) + stabBonus }
      ]
    };
  }

  case 'beat-up':
    return {
      damage: null,
      isVariablePower: true,
      description: 'Daño = Suma de ataques de aliados',
      note: 'Este movimiento necesita aliados en batalla para calcular el daño exacto'
    };

  case 'low-kick': {
    // Low Kick / Grass Knot (por peso del objetivo)
    const tiers = [
      { max: 10, power: 20 },
      { max: 25, power: 40 },
      { max: 50, power: 60 },
      { max: 100, power: 80 },
      { max: 200, power: 100 },
      { max: Infinity, power: 120 }
    ];
    const attackStat = (stats.atk || 0);
    const rows = tiers.map(t => ({
      condicion: t.max === Infinity ? '>200 kg' : `≤ ${t.max} kg`,
      daño: calcDamageTier(t.power) + attackStat + stabBonus
    }));
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia variable según peso del objetivo',
      table: rows,
      note: 'La potencia real depende del peso del objetivo en batalla'
    };
  }

  case 'weight-ratio': {
    // Heat Crash / Heavy Slam (ratio peso usuario / objetivo)
    const tiers = [
      { ratioMin: 5, power: 120, label: '≥ 5×' },
      { ratioMin: 4, power: 100, label: '≥ 4×' },
      { ratioMin: 3, power: 80, label: '≥ 3×' },
      { ratioMin: 2, power: 60, label: '≥ 2×' },
      { ratioMin: 1, power: 40, label: '< 2×' }
    ];
    const attackStat = (stats.atk || 0);
    const rows = tiers.map(t => ({
      condicion: `${t.label} (peso usuario / peso objetivo)`,
      daño: calcDamageTier(t.power) + attackStat + stabBonus
    }));
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia variable según ratio de pesos (usuario vs objetivo)',
      table: rows,
      note: 'Requiere peso del usuario y del objetivo para elegir el tier real'
    };
  }

  case 'user-hp': {
    // Eruption / Water Spout: potencia escala con PS actuales
    const attackStat = (stats.atk || 0);
    const examplePowers = [
      { pct: 100, power: 150 },
      { pct: 75, power: 113 },
      { pct: 50, power: 75 },
      { pct: 25, power: 38 },
      { pct: 10, power: 15 }
    ];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia escala con PS actuales del usuario (más PS = más daño)',
      table: examplePowers.map(e => ({
        condicion: `${e.pct}% PS`,
        daño: calcDamageTier(e.power) + attackStat + stabBonus
      })),
      note: 'La potencia real depende del % de PS actuales del usuario'
    };
  }

  case 'low-user-hp': {
    // Flail / Reversal: potencia sube cuanto menos PS tengas (tiers clásicos)
    const attackStat = (stats.atk || 0);
    const tiers = [
      { pctMax: 4, power: 200 },
      { pctMax: 9, power: 150 },
      { pctMax: 17, power: 100 },
      { pctMax: 33, power: 80 },
      { pctMax: 67, power: 40 },
      { pctMax: 100, power: 20 }
    ];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia variable según % de PS restantes del usuario (menos PS = más potencia)',
      table: tiers.map(t => ({
        condicion: `≤ ${t.pctMax}% PS`,
        daño: calcDamageTier(t.power) + attackStat + stabBonus
      })),
      note: 'El tier real depende del % de PS actuales del usuario'
    };
  }

  case 'target-hp': {
    // Crush Grip / Wring Out: potencia depende de PS del objetivo
    const attackStat = (stats.atk || 0);
    const example = [
      { pct: 100, power: 120 },
      { pct: 75, power: 90 },
      { pct: 50, power: 60 },
      { pct: 25, power: 30 },
      { pct: 10, power: 15 }
    ];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia escala con PS actuales del objetivo (más PS = más potencia)',
      table: example.map(e => ({
        condicion: `${e.pct}% PS objetivo`,
        daño: calcDamageTier(e.power) + attackStat + stabBonus
      })),
      note: 'La potencia real depende del % de PS actuales del objetivo'
    };
  }

  case 'speed-ratio': {
    // Gyro Ball / Electro Ball: potencia por ratio de velocidades (ejemplos)
    const attackStat = (stats.atk || 0);
    const examplePowers = [
      { condicion: 'Muy desfavorable', power: 150 },
      { condicion: 'Desfavorable', power: 120 },
      { condicion: 'Parejo', power: 80 },
      { condicion: 'Favorable', power: 60 },
      { condicion: 'Muy favorable', power: 40 }
    ];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia variable según ratio de Velocidad (usuario vs objetivo)',
      table: examplePowers.map(e => ({
        condicion: e.condicion,
        daño: calcDamageTier(e.power) + attackStat + stabBonus
      })),
      note: 'Requiere Velocidad del usuario y del objetivo para el cálculo exacto'
    };
  }

  case 'pp': {
    // Trump Card: potencia depende de PP restantes (ejemplos por PP)
    const attackStat = (stats.atk || 0);
    const tiers = [
      { pp: 1, power: 200 },
      { pp: 2, power: 80 },
      { pp: 3, power: 60 },
      { pp: 4, power: 50 },
      { pp: 5, power: 40 }
    ];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia variable según PP restantes',
      table: tiers.map(t => ({
        condicion: `${t.pp} PP`,
        daño: calcDamageTier(t.power) + attackStat + stabBonus
      })),
      note: 'Necesita los PP actuales del movimiento para la potencia real'
    };
  }

  case 'user-boosts': {
    // Stored Power / Power Trip: potencia sube por boosts del usuario
    const attackStat = (stats.atk || 0);
    const examples = [0, 2, 4, 6, 8, 10, 12]; // total de etapas
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia aumenta con el total de boosts (etapas) del usuario',
      table: examples.map(stages => ({
        boosts: stages,
        daño: calcDamageTier(20 + stages * 20) + attackStat + stabBonus
      })),
      note: 'La potencia real depende de las etapas positivas acumuladas'
    };
  }

  case 'target-boosts': {
    // Punishment: potencia sube por boosts del objetivo
    const attackStat = (stats.atk || 0);
    const examples = [0, 2, 4, 6, 8, 10, 12];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia aumenta con el total de boosts (etapas) del objetivo',
      table: examples.map(stages => ({
        boostsObjetivo: stages,
        daño: calcDamageTier(60 + stages * 20) + attackStat + stabBonus
      })),
      note: 'La potencia real depende de las etapas positivas del objetivo'
    };
  }

  case 'berry':
    // Natural Gift: tipo+potencia según baya
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia y tipo dependen de la baya equipada',
      note: 'Requiere conocer la baya del usuario para determinar la potencia real'
    };

  case 'stockpile': {
    // Spit Up: potencia según Stockpile (0-3)
    const attackStat = (stats.atk || 0);
    const tiers = [
      { stacks: 0, power: 0 },
      { stacks: 1, power: 100 },
      { stacks: 2, power: 200 },
      { stacks: 3, power: 300 }
    ];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia depende de Stockpile acumulado',
      table: tiers.map(t => ({
        stacks: t.stacks,
        daño: calcDamageTier(t.power) + attackStat + stabBonus
      })),
      note: 'La potencia real depende de cuántos Stockpile tenga el usuario'
    };
  }

  case 'random-power': {
    // Magnitude / Present (cuando hace daño): potencia aleatoria
    const attackStat = (stats.atk || 0);
    const examplePowers = [20, 40, 60, 80, 100, 120, 150];
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia aleatoria (depende del resultado del movimiento)',
      table: examplePowers.map(p => ({
        potencia: p,
        daño: calcDamageTier(p) + attackStat + stabBonus
      })),
      note: 'El valor real se determina al usarse en combate'
    };
  }

  case 'buff':
    return {
      damage: null,
      isVariablePower: true,
      description: 'Este es un movimiento de mejora (buff), no hace daño',
      note: 'Mejora tus estadísticas en batalla'
    };

  default:
    return {
      damage: null,
      isVariablePower: true,
      description: 'Potencia variable'
    };
}
}
