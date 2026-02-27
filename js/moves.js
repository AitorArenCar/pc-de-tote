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
    const variablePowerMoves = {
        'seismic-toss': 'seismic',
        'acrobatics': 'acrobatics',
        'coil': 'buff',
        'unwind': 'unwind',
        'dragon-rage': 'fixed',
        'sonic-boom': 'fixed',
        'night-shade': 'level',
        'psywave': 'level-range',
        'beat-up': 'beat-up',
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
            // Movimiento Sísmico: muestra tabla con ejemplos
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

        case 'acrobatics':
            const acrobaticsAttack = stats.atk || 0;
            const acrobaticsNoPower = calcDamageTier(110);  // Sin ítem: potencia 110
            const acrobaticsWithPower = calcDamageTier(55); // Con ítem: potencia 55
            
            return {
                damage: null,
                isVariablePower: true,
                description: `El daño varía según si tiene ítem equipado`,
                table: [
                    { 
                        condicion: `Sin ítem (${DAMAGE_TIER_MAP[acrobaticsNoPower]})`,
                        daño: acrobaticsNoPower + acrobaticsAttack + stabBonus
                    },
                    {
                        condicion: `Con ítem (${DAMAGE_TIER_MAP[acrobaticsWithPower]})`,
                        daño: acrobaticsWithPower + acrobaticsAttack + stabBonus
                    }
                ]
            };

        case 'unwind':
            // Desenrrollar: 18 de daño por cada estack
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

        case 'fixed':
            const fixedDamage = moveName.includes('Sonic') || moveName.includes('sónico') ? 20 : 40;
            return {
                damage: fixedDamage + stabBonus,
                isVariablePower: true,
                description: `Daño fijo: ${fixedDamage}${hasSAB ? ' + 2 (STAB)' : ''} = ${fixedDamage + stabBonus}`,
                note: 'Este movimiento hace daño fijo, independiente de los stats'
            };

        case 'level':
            // Noche Sombra: daño = nivel
            const level = Number(pokemon.level || 50);
            return {
                damage: level + stabBonus,
                isVariablePower: true,
                description: `Daño = Nivel (${level})${hasSAB ? ' + 2 (STAB)' : ''} = ${level + stabBonus}`
            };

        case 'level-range':
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

        case 'beat-up':
            return {
                damage: null,
                isVariablePower: true,
                description: 'Daño = Suma de ataques de aliados',
                note: 'Este movimiento necesita aliados en batalla para calcular el daño exacto'
            };

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
