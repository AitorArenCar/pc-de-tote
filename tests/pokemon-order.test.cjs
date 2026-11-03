const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
    const ctx = vm.createContext({ db: ['a', 'b', 'c'].map(id => ({ id })),
        $grid: { children: [] }, saves: [], renders: 0,
        setDirty() { ctx.saves.push(JSON.stringify(ctx.db)); } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui-render.js'), 'utf8'), ctx);
    vm.runInContext('render = () => { renders++; };', ctx);
    return ctx;
}

test('moving earlier and later saves the displayed order without replacing entries', () => {
    const ctx = setup();
    const original = ctx.db[0];
    assert.equal(ctx.movePokemonToPosition('a', 3), true);
    assert.equal(ctx.db.map(p => p.id).join(), 'b,c,a');
    assert.equal(ctx.db[2], original);
    assert.equal(ctx.movePokemonToPosition('a', 1), true);
    assert.equal(ctx.db.map(p => p.id).join(), 'a,b,c');
    assert.equal(ctx.saves.length, 2);
    assert.equal(JSON.parse(ctx.saves[0]).map(p => p.id).join(), 'b,c,a');
});

test('invalid positions, missing entries and unchanged positions do not save or render', () => {
    const ctx = setup();
    for (const position of [0, -1, 4, 1.5, NaN, Infinity, '2']) {
        assert.equal(ctx.movePokemonToPosition('a', position), false);
    }
    assert.equal(ctx.movePokemonToPosition('missing', 2), false);
    assert.equal(ctx.movePokemonToPosition('a', 1), false);
    assert.equal(ctx.saves.length, 0);
    assert.equal(ctx.renders, 0);
    assert.equal(ctx.db.map(p => p.id).join(), 'a,b,c');
});
