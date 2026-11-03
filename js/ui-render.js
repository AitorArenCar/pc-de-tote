/**
 * Renderizado del grid y tarjetas de Pokémon
 */

let draggedPokemonId = null;

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
    movedCard?.querySelector('.poke-move')?.focus();
    return true;
}

function setupPokemonOrdering(card, p) {
    const move = document.createElement('button');
    move.type = 'button';
    move.className = 'poke-move';
    move.textContent = '↕ Mover';
    move.title = 'Arrastra para ordenar o pulsa para elegir una posición';
    move.setAttribute('aria-label', `Mover ${p.nickname || p.name} a otra posición`);
    move.draggable = true;
    move.addEventListener('click', event => {
        event.stopPropagation();
        const current = db.findIndex(entry => entry.id === p.id) + 1;
        const answer = prompt(`Posición para ${p.nickname || cap(p.name)} (1–${db.length}):`, String(current));
        if (answer === null) return;
        const position = Number(answer.trim());
        if (!Number.isInteger(position) || position < 1 || position > db.length) {
            alert(`Introduce una posición entre 1 y ${db.length}.`);
            return;
        }
        movePokemonToPosition(p.id, position);
    });
    move.addEventListener('dragstart', event => {
        draggedPokemonId = p.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', p.id);
        event.dataTransfer.setDragImage(card, card.offsetWidth / 2, 20);
        card.classList.add('poke-dragging');
    });
    move.addEventListener('dragend', () => {
        draggedPokemonId = null;
        card.classList.remove('poke-dragging');
        $grid.querySelectorAll('.poke-drop-target').forEach(el => el.classList.remove('poke-drop-target'));
    });
    card.addEventListener('dragover', event => {
        if (!draggedPokemonId || draggedPokemonId === p.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        card.classList.add('poke-drop-target');
    });
    card.addEventListener('dragleave', event => {
        if (!card.contains(event.relatedTarget)) card.classList.remove('poke-drop-target');
    });
    card.addEventListener('drop', event => {
        if (!draggedPokemonId) return;
        event.preventDefault();
        event.stopPropagation();
        const id = draggedPokemonId;
        draggedPokemonId = null;
        card.classList.remove('poke-drop-target');
        movePokemonToPosition(id, db.findIndex(entry => entry.id === p.id) + 1);
    });
    card.append(move);
}

function render() {
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
