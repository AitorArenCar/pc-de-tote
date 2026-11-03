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

function touchSetup() {
    const ctx = setup();
    const handlers = {}, timers = new Map();
    let nextTimer = 0;
    const classes = { add() {}, remove() {} };
    const card = { title: '', isConnected: true, classList: classes,
        addEventListener(name, callback) { handlers[name] = callback; },
        getBoundingClientRect: () => ({ width: 150, height: 150 }),
        cloneNode: () => ({ style: {}, classList: classes, offsetWidth: 150, offsetHeight: 150,
            removeAttribute() {}, setAttribute() {}, remove() {} }) };
    const target = { dataset: { pid: 'c' }, classList: classes,
        getBoundingClientRect: () => ({ left: 0, width: 150 }) };
    Object.assign(ctx, {
        setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
        clearTimeout(id) { timers.delete(id); },
        requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
        window: { innerHeight: 800, scrollBy() {} },
        document: { body: { append() {} }, elementFromPoint: () => ({ closest: () => target }) }
    });
    ctx.$grid.querySelectorAll = () => [];
    ctx.$grid.contains = () => true;
    ctx.setupPokemonOrdering(card, ctx.db[0]);
    const event = (x = 100, y = 200) => ({ touches: [{ clientX: x, clientY: y }],
        target: { closest: () => null }, prevented: false,
        preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } });
    return { ctx, card, handlers, timers, event };
}

test('swiping before long press scrolls normally and does not reorder', () => {
    const { ctx, handlers, timers, event } = touchSetup();
    handlers.touchstart(event());
    const swipe = event(100, 240);
    handlers.touchmove(swipe);
    assert.equal(swipe.prevented, false);
    assert.equal(timers.size, 0);
    handlers.touchend(event());
    assert.equal(ctx.saves.length, 0);
});

test('long press drops on the target and suppresses the follow-up click', () => {
    const { ctx, card, handlers, timers, event } = touchSetup();
    assert.equal(card.draggable, true);
    handlers.touchstart(event());
    [...timers.values()][0]();
    const move = event(120, 220);
    handlers.touchmove(move);
    assert.equal(move.prevented, true);
    const end = event();
    handlers.touchend(end);
    assert.equal(end.prevented, true);
    assert.equal(ctx.db.map(p => p.id).join(), 'b,c,a');
    const click = event();
    handlers.click(click);
    assert.equal(click.stopped, true);
});

test('cancelled touch drag leaves order and persistence unchanged', () => {
    const { ctx, handlers, timers, event } = touchSetup();
    handlers.touchstart(event());
    [...timers.values()][0]();
    handlers.touchcancel();
    assert.equal(ctx.db.map(p => p.id).join(), 'a,b,c');
    assert.equal(ctx.saves.length, 0);
});

test('insertion line represents before or after, accounting for the removed card', () => {
    const ctx = setup();
    ctx.insertPokemonAtCard('a', 'c', false);
    assert.equal(ctx.db.map(p => p.id).join(), 'b,a,c');
    ctx.insertPokemonAtCard('a', 'c', true);
    assert.equal(ctx.db.map(p => p.id).join(), 'b,c,a');
    ctx.insertPokemonAtCard('a', 'b', false);
    assert.equal(ctx.db.map(p => p.id).join(), 'a,b,c');
    ctx.insertPokemonAtCard('c', 'a', true);
    assert.equal(ctx.db.map(p => p.id).join(), 'a,c,b');
});
