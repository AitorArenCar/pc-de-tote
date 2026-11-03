const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({ calcDamageTier: () => 4, DAMAGE_TIER_MAP: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/moves.js'), 'utf8'), ctx);
const pokemon = { types: ['water', 'dark'], stats: { atk: 9, spa: 12 }, teraType: 'water', teraActive: true };
const move = { id: 'waterfall', type: 'water', class: 'physical', power: 80 };

test('matching original and Tera add the whole stat, including odd stats', () => {
    const result = ctx.calculateMoveDamage(pokemon, move);
    assert.equal(result.stabBonus, 9);
    assert.equal(result.damage, 22);
    assert.match(result.description, /STAB \+9 \(potenciado por Tera\)/);
    assert.doesNotMatch(result.description, /original|\+5|\+4/);
});
test('new offensive type adds half the appropriate stat and preserves original STAB', () => {
    const p = { ...pokemon, teraType: 'fire' };
    assert.equal(ctx.calculateStab(p, { ...move, type: 'fire' }).bonus, 5);
    assert.equal(ctx.calculateStab(p, { ...move, type: 'fire', class: 'special' }).bonus, 6);
    assert.equal(ctx.calculateStab(p, move).bonus, 5);
    assert.equal(ctx.calculateStab(p, { ...move, type: 'grass' }).bonus, 0);
});
test('disabled or unconfigured Tera provides no extra bonus, status moves do no damage', () => {
    assert.equal(ctx.calculateStab({ ...pokemon, teraActive: false }, move).bonus, 5);
    assert.equal(ctx.calculateStab({ ...pokemon, teraActive: false }, move).text, 'STAB +5 (sin potenciar por Tera)');
    assert.equal(ctx.calculateStab({ ...pokemon, teraType: null }, move).bonus, 5);
    assert.equal(ctx.calculateMoveDamage(pokemon, { ...move, class: 'status' }).damage, null);
});
test('variable damage uses the same Tera bonus', () => {
    const p = { ...pokemon, types: ['flying'], teraType: 'flying' };
    const result = ctx.calculateMoveDamage(p, { ...move, id: 'acrobatics', type: 'flying' });
    assert.equal(result.table[0]['daño'], 22);
});
