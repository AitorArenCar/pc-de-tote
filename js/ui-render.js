/**
 * Renderizado del grid y tarjetas de Pokémon
 */

function render() {
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
