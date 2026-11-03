const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(current) {
    const db = [
        { id: 'a', level: 10, exp: 9, expMax: 10, stats: { hp: 20 }, hpCurrent: current, linkGroupId: 'g' },
        { id: 'b', level: 10, exp: 9, expMax: 10, stats: { hp: 40 }, linkGroupId: 'g' }
    ];
    const elements = { '.hp-fill': { style: {} }, '.hp-num': {}, '.hp-input': {} };
    const root = { getAttribute: () => 'a', querySelectorAll: () => [], querySelector: key => elements[key] };
    const ctx = vm.createContext({ db, setDirty() {}, window: {},
        document: { addEventListener() {}, querySelector: key => key === '#detailDialog' ? { open: true } : key === '#detailContent' ? root : null,
            querySelectorAll: () => [] } });
    for (const file of ['js/hp-system.js', 'js/utils.js', 'js/pokemon-links.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx);
    }
    return { ctx, db, elements };
}

test('level up preserves the old HP percentage for different linked maxima and updates the UI', () => {
    const { ctx, db, elements } = setup(50);
    ctx.grantExp(db[0], 1);
    assert.equal(db[0].level, 11);
    assert.equal(db[0].hpCurrent, 51);
    assert.equal(db[1].level, 11);
    assert.equal(db[1].hpCurrent, 91);
    assert.equal(db[1].exp, 0);
    assert.equal(elements['.hp-num'].textContent, '51 / 102');
    assert.equal(elements['.hp-input'].max, '102');
    assert.equal(elements['.hp-fill'].style.width, '50%');
});

test('full HP and fainted state survive multiple level ups', () => {
    for (const current of [0, 100]) {
        const { ctx, db } = setup(current);
        ctx.grantExp(db[0], 21);
        assert.equal(db[0].level, 13);
        assert.equal(db[0].hpCurrent, current === 0 ? 0 : 106);
        assert.equal(db[1].hpCurrent, current === 0 ? 0 : 186);
    }
});

test('experience without a level up leaves current HP unchanged', () => {
    const { ctx, db } = setup(33);
    db[0].exp = 0;
    ctx.grantExp(db[0], 1);
    assert.equal(db[0].level, 10);
    assert.equal(db[0].hpCurrent, 33);
});
