/**
 * Renderizado del grid y tarjetas de Pokémon
 */

let draggedPokemonId = null;
let cancelPokemonTouchDrag = null;

function movePokemonToPosition(id, position) {
    const from = db.findIndex(p => p.id === id);
    if (from < 0 || !Number.isInteger(position) || position < 1 || position > db.length) return false;
    const to = position - 1;
    if (from === to) return false;
    const [pokemon] = db.splice(from, 1);
    db.splice(to, 0, pokemon);
    setDirty(true);
    render();
    const movedCard = Array.from($grid.children).find(card => card.dataset.pid === id);
    movedCard?.focus({ preventScroll: true });
    return true;
}

function insertPokemonAtCard(id, targetId, after) {
    const from = db.findIndex(entry => entry.id === id);
    const target = db.findIndex(entry => entry.id === targetId);
    if (from < 0 || target < 0) return false;
    const slot = target + (after ? 1 : 0);
    return movePokemonToPosition(id, slot - (from < slot ? 1 : 0) + 1);
}

function setupPokemonOrdering(card, p) {
    card.draggable = true;
    card.tabIndex = 0;
    card.title += ' · Arrastra para ordenar; en móvil, mantén pulsado';
    let suppressClick = false;
    let pressedButton = false;
    card.addEventListener('pointerdown', event => {
        pressedButton = !!event.target.closest('button');
    });
    card.addEventListener('click', event => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
    function clearTargets() {
        $grid.querySelectorAll('.poke-drop-before, .poke-drop-after').forEach(el => el.classList.remove('poke-drop-before', 'poke-drop-after'));
    }
    function markInsertion(target, x) {
        clearTargets();
        const rect = target.getBoundingClientRect();
        const after = x >= rect.left + rect.width / 2;
        target.classList.add(after ? 'poke-drop-after' : 'poke-drop-before');
        return after;
    }
    card.addEventListener('dragstart', event => {
        if (pressedButton || touch) { event.preventDefault(); return; }
        suppressClick = true;
        draggedPokemonId = p.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', p.id);
        card.classList.add('poke-dragging');
    });
    card.addEventListener('dragend', () => {
        draggedPokemonId = null;
        card.classList.remove('poke-dragging');
        clearTargets();
        setTimeout(() => { suppressClick = false; }, 350);
    });
    card.addEventListener('dragover', event => {
        if (!draggedPokemonId || draggedPokemonId === p.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        markInsertion(card, event.clientX);
    });
    card.addEventListener('dragleave', event => {
        if (!card.contains(event.relatedTarget)) clearTargets();
    });
    card.addEventListener('drop', event => {
        if (!draggedPokemonId) return;
        event.preventDefault();
        event.stopPropagation();
        const id = draggedPokemonId;
        const after = markInsertion(card, event.clientX);
        draggedPokemonId = null;
        clearTargets();
        insertPokemonAtCard(id, p.id, after);
    });
    // Touch scrolling stays native unless a stationary long press starts a drag.
    let touch = null;
    let timer = null;
    let ghost = null;
    let frame = null;
    let target = null;
    let insertAfter = false;
    function finishTouch(commit = false) {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        const destination = target?.dataset.pid;
        const wasDragging = !!ghost;
        ghost?.remove();
        ghost = null;
        touch = null;
        target = null;
        card.classList.remove('poke-dragging');
        clearTargets();
        if (cancelPokemonTouchDrag === finishTouch) cancelPokemonTouchDrag = null;
        if (wasDragging) {
            draggedPokemonId = null;
            setTimeout(() => { suppressClick = false; }, 350);
            if (commit && destination) insertPokemonAtCard(p.id, destination, insertAfter);
        }
    }
    function followTouch() {
        if (!ghost || !touch || !card.isConnected) { finishTouch(); return; }
        ghost.style.left = (touch.x - ghost.offsetWidth / 2) + 'px';
        ghost.style.top = (touch.y - ghost.offsetHeight / 2) + 'px';
        const speed = touch.y < 65 ? -10 : touch.y > window.innerHeight - 65 ? 10 : 0;
        if (speed) window.scrollBy(0, speed);
        clearTargets();
        target = document.elementFromPoint(touch.x, touch.y)?.closest('.poke[data-pid]');
        if (target && !$grid.contains(target)) target = null;
        if (target && target !== card) insertAfter = markInsertion(target, touch.x);
        else target = null;
        frame = requestAnimationFrame(followTouch);
    }
    card.addEventListener('touchstart', event => {
        if (event.touches.length !== 1 || event.target.closest('button')) { finishTouch(); return; }
        cancelPokemonTouchDrag?.();
        suppressClick = false;
        const point = event.touches[0];
        touch = { x: point.clientX, y: point.clientY, startX: point.clientX, startY: point.clientY };
        cancelPokemonTouchDrag = finishTouch;
        timer = setTimeout(() => {
            if (!touch || !card.isConnected) return;
            suppressClick = true;
            draggedPokemonId = p.id;
            ghost = card.cloneNode(true);
            ghost.removeAttribute('data-pid');
            ghost.classList.add('poke-drag-ghost');
            ghost.style.width = card.getBoundingClientRect().width + 'px';
            ghost.style.height = card.getBoundingClientRect().height + 'px';
            ghost.setAttribute('aria-hidden', 'true');
            document.body.append(ghost);
            card.classList.add('poke-dragging');
            followTouch();
        }, 450);
    }, { passive: true });
    card.addEventListener('touchmove', event => {
        if (!touch) return;
        if (event.touches.length !== 1) { finishTouch(); return; }
        const point = event.touches[0];
        touch.x = point.clientX;
        touch.y = point.clientY;
        if (ghost) event.preventDefault();
        else if (Math.hypot(touch.x - touch.startX, touch.y - touch.startY) > 10) finishTouch();
    }, { passive: false });
    card.addEventListener('touchend', event => {
        if (ghost) event.preventDefault();
        finishTouch(true);
    }, { passive: false });
    card.addEventListener('touchcancel', () => finishTouch());
    card.addEventListener('contextmenu', event => {
        if (touch || suppressClick) event.preventDefault();
    });
    card.addEventListener('keydown', event => {
        if (event.target !== card) return;
        if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            const position = db.findIndex(entry => entry.id === p.id) + 1;
            movePokemonToPosition(p.id, position + (event.key === 'ArrowLeft' ? -1 : 1));
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showDetails(p);
        }
    });
}
function render() {
    cancelPokemonTouchDrag?.();
    draggedPokemonId = null;
    $grid.innerHTML = '';
    if (!db.length) {
        $empty.hidden = false;
        updateTeamBtnLabel();
        return;
    }
    $empty.hidden = true;

    for (const p of db) {
        ensureExpFields?.(p);
        window.POKE_INDEX?.set(p.id, p);

        const card = document.createElement('div');
        card.className = 'poke';
        card.setAttribute('data-pid', p.id);

        const typesEs = (p.types || []).map(typeEs).join(' / ');
        card.title = `#${p.dexId} · ${cap(p.name)} ( ${typesEs} )`;

        const img = document.createElement('img');
        img.alt = p.name;
        img.loading = 'lazy';
        img.draggable = false;
        const cardSprite = spriteUrlOf(p);
        img.src = cardSprite;

        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = (p.num && String(p.num).length) ? p.num : `#${p.dexId}`;
        tag.title = 'Doble clic para editar número personal';
        tag.addEventListener('dblclick', (ev) => {
            ev.stopPropagation();
            const current = p.num ?? '';
            const next = prompt('Nuevo número personal (deja vacío para quitarlo):', current);
            if (next === null) return;
            const clean = (next || '').trim();
            p.num = clean.length ? clean : null;
            setDirty(true);
            render();
        });

        const name = document.createElement('div');
        name.className = 'name';

        const baseName = p.nickname?.trim() ? p.nickname : cap(p.name);

        const levelHtml = (typeof p.level === 'number' && !isNaN(p.level))
            ? `  Nv.: <span class="poke-level">${p.level}</span>`
            : '';

        const genderSymbol =
            p.gender === 'male' ? ' ♂️' :
                p.gender === 'female' ? ' ♀️' : '';
        const shinySymbol = p.shiny ? ' ★' : '';

        name.innerHTML = `${baseName}${levelHtml}${genderSymbol}${shinySymbol}`;

        const tbtn = document.createElement('button');
        tbtn.className = p.inTeam ? 'team team-si' : 'team team-no';
        tbtn.title = p.inTeam ? 'Quitar del equipo' : 'Añadir al equipo';
        tbtn.setAttribute('aria-label', p.inTeam ? 'Quitar del equipo' : 'Añadir al equipo');

        tbtn.innerHTML = `
<svg class="pokeicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <circle class="poke-fill" cx="12" cy="12" r="9"></circle>
  <circle class="poke-stroke" cx="12" cy="12" r="9"></circle>
  <path class="poke-stroke" d="M3 12h7"></path>
  <path class="poke-stroke" d="M14 12h7"></path>
  <circle class="poke-stroke" cx="12" cy="12" r="3"></circle>
</svg>
`;
        tbtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            toggleTeam(p);
        });

        const del = document.createElement('button');
        del.className = 'del';
        del.setAttribute('aria-label', 'Eliminar');
        del.innerHTML = '✕';
        del.addEventListener('click', (ev) => {
            ev.stopPropagation();

            const displayName =
                (p.nickname?.trim() ? p.nickname : cap(p.name)) +
                (typeof p.level === 'number' ? ` Nv.: ${p.level}` : '') +
                (p.gender === 'male' ? ' ♂️' : p.gender === 'female' ? ' ♀️' : '') +
                (p.shiny ? ' ★' : '');

            if (confirm(`¿Eliminar ${displayName}?`)) {
                if (p.heldItem && window.Bag && typeof window.Bag.equipRelease === 'function') {
                    try { window.Bag.equipRelease(p.heldItem); } catch (e) { /* noop */ }
                }
                db = db.filter(x => x.id !== p.id);

                setDirty(true);
                render();
            }
        });

        card.addEventListener('click', () => showDetails(p));
        card.style.position = 'relative';
        card.append(tag, img, name, tbtn, del);
        setupPokemonOrdering(card, p);
        $grid.appendChild(card);
    }

    appendAddCard();
    updateTeamBtnLabel();
}

function appendAddCard() {
    const add = document.createElement('button');
    add.className = 'poke add-card';
    add.type = 'button';
    add.title = 'Añadir Pokémon';
    add.innerHTML = `<div class="add-plus">＋</div><div class="add-label">Añadir</div>`;
    add.addEventListener('click', () => {
        document.getElementById('addBtn')?.click();
    });
    $grid.appendChild(add);
}
