/**
 * Búsqueda de Pokémon y autocomplete
 */

// Fetch core data de Pokémon desde PokeAPI
async function fetchPokemonCore(idOrName) {
    const r = await fetch(`${API}/pokemon/${encodeURIComponent(idOrName)}`);
    if (!r.ok) {
        if (r.status === 404) throw new Error('No encontrado en PokeAPI');
        throw new Error(`Error ${r.status}`);
    }
    const d = await r.json();
    const sprite = d.sprites.front_default
        || d.sprites.other?.['official-artwork']?.front_default
        || d.sprites.other?.dream_world?.front_default
        || '';
    const spriteShiny = d.sprites.front_shiny
        || d.sprites.other?.['official-artwork']?.front_shiny
        || '';

    return {
        dexId: d.id,
        name: d.name,
        types: d.types.map(t => t.type.name),
        sprite,
        spriteShiny,
        abilities: d.abilities.map(a => a.ability.name),
        height: d.height,
        weight: d.weight
    };
}

// Maneja búsqueda de Pokémon
async function handleSearch() {
    const q = $query.value.trim();
    $result.innerHTML = '';
    $confirm.disabled = true;
    $extra.hidden = true;
    $matches.hidden = true;
    $matches.innerHTML = '';

    if (/^\d+$/.test(q)) {
        $feedback.textContent = 'Buscando por número…';
        try {
            const p = await fetchPokemonCore(q);
            showPreview(p);
            $feedback.textContent = '';
        } catch (e) {
            $feedback.textContent = e.message;
        }
        return;
    }

    if (q.length < 2) {
        $feedback.textContent = 'Escribe al menos 2 letras.';
        return;
    }

    const { names } = await ensurePokemonIndex();
    const s = norm(q);
    const begins = names.filter(n => n.startsWith(s));
    const includes = names.filter(n => !n.startsWith(s) && n.includes(s));
    const list = [...begins, ...includes].slice(0, 30);

    $feedback.textContent = list.length ? 'Elige una coincidencia:' : 'Sin resultados.';
    if (!list.length) return;

    $matches.hidden = false;
    $matches.innerHTML = list.map(n => `<button data-name="${n}">${n}</button>`).join('');
    $matches.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        $feedback.textContent = `Cargando ${name}…`;
        try {
            const p = await fetchPokemonCore(name);
            showPreview(p);
            $feedback.textContent = '';
        } catch (e) {
            $feedback.textContent = e.message;
        }
    }));
}

// Limpia listas de movimientos
function clearMoveLists() {
    document.querySelectorAll('.move-list').forEach(el => {
        el.hidden = true;
        el.innerHTML = '';
    });
    document.querySelectorAll('.move-input').forEach(inp => {
        inp.dataset.selectedId = '';
        inp.dataset.selectedEs = '';
    });
}

// Obtiene sprite actual del preview (shiny o normal)
const currentPendingSprite = () => {
    if (!pendingBase) return '';
    const wantsShiny = !!document.getElementById('shinyToggle')?.checked;
    if (wantsShiny) {
        const shinyUrl = pendingBase.spriteShiny || pendingBase.sprite_shiny || '';
        if (shinyUrl) return shinyUrl;
    }
    return pendingBase.sprite || '';
};

// Renderiza el preview de Pokémon seleccionado
const renderPendingPreview = () => {
    if (!$result) return;
    if (!pendingBase) {
        $result.innerHTML = '';
        return;
    }
    const sprite = currentPendingSprite();
    $result.innerHTML = `
    <div class="result">
      <img class="result-img" width="96" height="96" alt="${pendingBase.name}" src="${sprite}" />
      <div>
        <div style="font-weight:700;font-size:16px">${cap(pendingBase.name)} <span class="muted">#${pendingBase.dexId}</span></div>
        <div class="chips" style="margin-top:6px">${(pendingBase.types || []).map(typeChip).join('')}</div>
      </div>
    </div>`;
};

// Muestra preview de Pokémon
function showPreview(p) {
    pendingBase = {
        ...p,
        spriteShiny: p.spriteShiny || p.sprite_shiny || ''
    };
    const moveInputs = Array.from(document.querySelectorAll('.move-input'));
    moveInputs.forEach(i => {
        i.value = '';
        i.dataset.selectedId = '';
        i.dataset.selectedEs = '';
    });

    const shinyToggle = document.getElementById('shinyToggle');
    if (shinyToggle) shinyToggle.checked = false;

    renderPendingPreview();

    const numInput = document.getElementById('numInput');
    if (numInput) numInput.value = '';

    const genderSelect = document.getElementById('genderSelect');
    if (genderSelect) genderSelect.value = 'unknown';

    $extra.hidden = false;
    $confirm.disabled = false;

    setupMoveAutocompleteES();
    setupBallAutocomplete();
    setupNatureAutocomplete();
    setupAbilityAutocomplete();
    setupHeldItemAutocomplete();
}

// Autocomplete genérico
function setupComboAutocomplete({
    inputEl,
    listEl,
    ensureIndex = async () => { },
    getList = () => [],
    minChars = 1,
    placeholder = "Escribe para buscar…"
}) {
    if (!inputEl || !listEl) return;

    inputEl.placeholder = placeholder;

    const render = (items) => {
        if (!items.length) {
            listEl.hidden = true;
            listEl.innerHTML = "";
            return;
        }
        listEl.innerHTML = items.map(it => `<button data-id="${it.id}">${it.nameEs}</button>`).join("");
        listEl.hidden = false;
        listEl.querySelectorAll("button").forEach(btn => btn.onclick = () => {
            const id = btn.dataset.id;
            const item = items.find(x => String(x.id) === String(id));
            if (!item) return;
            inputEl.value = item.nameEs;
            inputEl.dataset.selectedId = item.id;
            inputEl.dataset.selectedEs = item.nameEs;
            listEl.hidden = true;
            listEl.innerHTML = "";
            inputEl.blur();
        });
    };

    const scoreOf = (name, q) => {
        const idx = name.indexOf(q);
        if (idx === 0) return 1000 - name.length;
        if (idx >= 0) return 500 - idx - name.length * 0.01;
        return -Infinity;
    };

    inputEl.onfocus = () => {
        const raw = (inputEl.value || "").trim();
        if (norm(raw).length >= minChars) inputEl.dispatchEvent(new Event("input"));
    };

    inputEl.oninput = async () => {
        const raw = (inputEl.value || "").trim();

        if (inputEl.dataset.selectedId && raw === (inputEl.dataset.selectedEs || "")) {
            listEl.hidden = true;
            listEl.innerHTML = "";
            return;
        }
        if (inputEl.dataset.selectedId && raw !== inputEl.dataset.selectedEs) {
            inputEl.dataset.selectedId = "";
            inputEl.dataset.selectedEs = "";
        }

        const q = norm(raw);
        if (q.length < minChars) {
            listEl.hidden = true;
            listEl.innerHTML = "";
            return;
        }

        await ensureIndex();
        const items = (getList() || []).filter(Boolean);
        const matches = items.filter(it => norm(it.nameEs).includes(q))
            .map(it => ({ ...it, _s: scoreOf(norm(it.nameEs), q) }))
            .sort((a, b) => b._s - a._s)
            .slice(0, 20);
        render(matches);
    };
}
