/** Manual groups of entries in the current box. */
function linkedPokemon(p) {
    return db.filter(entry => entry.id === p.id ||
        (p.linkGroupId && entry.linkGroupId === p.linkGroupId));
}

function syncLinkedPokemonState(p, hpRatio = null) {
    if (!p.linkGroupId) return;
    ensureExpFields(p);
    const hp = ensureHp(p);
    const ratio = hpRatio ?? (hp.max > 0 ? hp.current / hp.max : 0);
    for (const entry of linkedPokemon(p)) {
        if (entry.id === p.id) continue;
        entry.level = p.level;
        entry.exp = p.exp;
        entry.expMax = p.expMax;
        entry.gender = p.gender || 'unknown';
        entry.shiny = !!p.shiny;
        entry.nickname = p.nickname || null;
        entry.ball = p.ball ? { ...p.ball } : null;
        const max = computeMaxHp(entry);
        entry.hpCurrent = ratio > 0 && max > 0 ? Math.max(1, Math.round(max * ratio)) : 0;
    }
}

function savePokemonLinks(p, selectedIds, stateSource = p) {
    const ids = new Set([p.id, ...selectedIds]);
    const members = db.filter(entry => ids.has(entry.id));
    const previousGroup = p.linkGroupId;
    const group = members.length > 1 ? (previousGroup || uuid()) : null;
    for (const entry of db) {
        if (ids.has(entry.id)) {
            if (group) entry.linkGroupId = group;
            else delete entry.linkGroupId;
        } else if (previousGroup && entry.linkGroupId === previousGroup) {
            delete entry.linkGroupId;
        }
    }
    // A group with only one remaining entry is no longer a link.
    const counts = new Map();
    for (const entry of db) {
        if (entry.linkGroupId) counts.set(entry.linkGroupId, (counts.get(entry.linkGroupId) || 0) + 1);
    }
    for (const entry of db) {
        if (entry.linkGroupId && counts.get(entry.linkGroupId) < 2) delete entry.linkGroupId;
    }
    syncLinkedPokemonState(stateSource);
    setDirty(true);
}

function pokemonLinkLabel(entry) {
    return `${entry.nickname ? entry.nickname + ' · ' : ''}${cap(entry.name)}${entry.shiny ? ' ★' : ''} (#${entry.dexId}${entry.num ? ' · Nº ' + entry.num : ''})`;
}

function setupPokemonLinks(p, container) {
    const linked = linkedPokemon(p);
    const name = container.querySelector('.detail-title-name');
    if (!name || linked.length < 2) return;
    const select = document.createElement('select');
    select.className = 'pkname pokemon-name-select';
    select.setAttribute('aria-label', 'Cambiar de Pokémon enlazado');
    linked.forEach(entry => {
        const gender = entry.gender === 'male' ? ' ♂️' : entry.gender === 'female' ? ' ♀️' : '';
        const label = `${entry.nickname?.trim() ? entry.nickname + ' · ' : ''}${cap(entry.name)}${gender}${entry.shiny ? ' ★' : ''}`;
        select.add(new Option(label, entry.id));
    });
    select.value = p.id;
    name.replaceWith(select);
    select.addEventListener('change', () => {
        const target = linkedPokemon(p).find(entry => entry.id === select.value);
        if (target) {
            select.disabled = true;
            showDetails(target);
        }
    });
}

function setupPokemonLinkEditor(p = null) {
    document.getElementById('pokemonLinkEditor')?.remove();
    const section = document.createElement('section');
    section.id = 'pokemonLinkEditor';
    section.dataset.pid = p?.id || '';
    section.className = 'pokemon-links';
    section.innerHTML = `
        <details>
            <summary>Enlazar forma</summary>
            <p class="muted small">Marca las formas que quieres enlazar. Compartirán nivel, género, mote, Poké Ball, estado shiny, experiencia y porcentaje de vida; cada una conserva sus estadísticas y ataques. Si eliges una de otro grupo, se moverá a este.</p>
            <p class="muted small">${p ? 'Al guardar, se usarán los datos compartidos de este Pokémon para las formas seleccionadas.' : 'El nuevo Pokémon tomará los datos compartidos de la primera forma seleccionada en la lista.'}</p>
            <input type="search" aria-label="Buscar Pokémon para enlazar" placeholder="Buscar por nombre, apodo o número…">
            <div class="pokemon-links-options"></div>
            <p class="muted small pokemon-links-empty" hidden>No hay coincidencias.</p>
            <p class="muted small">Los enlaces se aplicarán al guardar el Pokémon.</p>
        </details>`;
    document.getElementById('extraFields').append(section);
    const options = section.querySelector('.pokemon-links-options');
    function refresh() {
        const linked = p ? linkedPokemon(p) : [];
        const ids = new Set(linked.map(entry => entry.id));
        options.replaceChildren();
        db.filter(entry => entry.id !== p?.id).forEach(entry => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = entry.id;
            checkbox.checked = ids.has(entry.id);
            label.append(checkbox, document.createTextNode(pokemonLinkLabel(entry)));
            options.append(label);
        });
        filter();
    }
    const search = section.querySelector('input[type="search"]');
    function filter() {
        const term = search.value.trim().toLocaleLowerCase('es');
        for (const label of options.children) label.hidden = !label.textContent.toLocaleLowerCase('es').includes(term);
        section.querySelector('.pokemon-links-empty').hidden = Array.from(options.children).some(label => !label.hidden);
    }
    search.addEventListener('input', filter);
    refresh();
}
