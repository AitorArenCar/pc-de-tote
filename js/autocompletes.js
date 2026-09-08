/**
 * Autocompletes específicos: movimientos, items, naturaleza, habilidad
 */

// Autocomplete de movimientos (solo ES)
function setupMoveAutocompleteES() {
    const moveInputs = Array.from(document.querySelectorAll('.move-input'));
    moveInputs.forEach(inp => inp.placeholder = "Buscar movimiento en español…");

    moveInputs.forEach(inp => {
        const listEl = inp.parentElement.querySelector('.move-list');
        inp.oninput = async () => {
            const q = (inp.value || '').trim().toLowerCase();
            if (!q || q.length < 2) {
                listEl.hidden = true;
                listEl.innerHTML = '';
                return;
            }

            await ensureMoveIndex();

            const matches = [];
            const seen = new Set();

            // Cache ES conocida
            for (const [id, es] of Object.entries(moveEsCache)) {
                if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                    seen.add(id);
                    matches.push({ id, es });
                }
            }

            // Ampliar cache dinámicamente
            const ids = (moveIndex?.names || []).filter(id => !seen.has(id));
            const batch = ids.slice(0, 500);
            const promises = batch.map(id => {
                if (moveEsCache[id]) return Promise.resolve({ id, es: moveEsCache[id] });
                return moveEs(id).then(es => ({ id, es })).catch(() => ({ id, es: null }));
            });
            const results = await Promise.all(promises);
            for (const r of results) {
                if (matches.length >= 20) break;
                if (!r.es) continue;
                const esLower = r.es.toLowerCase();
                if (esLower.includes(q)) {
                    seen.add(r.id);
                    matches.push({ id: r.id, es: r.es });
                }
            }

            const list = matches.slice(0, 20);
            if (!list.length) {
                listEl.hidden = true;
                listEl.innerHTML = '';
                return;
            }
            listEl.innerHTML = list.map(m => `<button data-id="${m.id}">${m.es}</button>`).join('');
            listEl.hidden = false;

            listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
                const id = btn.dataset.id;
                const es = btn.textContent;
                inp.value = es;
                inp.dataset.selectedId = id;
                inp.dataset.selectedEs = es;
                listEl.hidden = true;
                listEl.innerHTML = '';
                inp.blur();
            });
        };
    });
}

// Autocomplete de Poké Ball
function setupBallAutocomplete() {
    const inputEl = document.getElementById('ballInput');
    const listEl = document.getElementById('ballMatches');
    if (!inputEl || !listEl) return;

    inputEl.placeholder = "Escribe Poké Ball";

    inputEl.oninput = async () => {
        const q = (inputEl.value || '').trim().toLowerCase();
        if (!q || q.length < 2) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            return;
        }

        await ensureBallIndex();

        const matches = [];
        const seen = new Set();

        for (const [id, es] of Object.entries(ballEsCache)) {
            if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                seen.add(id);
                matches.push({ id, es });
            }
        }

        const ids = (ballIndex || []).map(it => it.id).filter(id => !seen.has(id));
        const batch = ids.slice(0, 500);
        const promises = batch.map(id => {
            if (ballEsCache[id]) return Promise.resolve({ id, es: ballEsCache[id] });
            return ballEs(id).then(es => ({ id, es })).catch(() => ({ id, es: null }));
        });
        const results = await Promise.all(promises);
        for (const r of results) {
            if (matches.length >= 20) break;
            if (!r.es) continue;
            if (r.es.toLowerCase().includes(q)) {
                seen.add(r.id);
                matches.push({ id: r.id, es: r.es });
            }
        }

        if (!matches.length) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            return;
        }
        listEl.innerHTML = matches.slice(0, 20).map(b => `<button data-id="${b.id}">${b.es}</button>`).join('');
        listEl.hidden = false;

        listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
            const id = btn.dataset.id;
            const es = btn.textContent;
            inputEl.value = es;
            inputEl.dataset.selectedId = id;
            inputEl.dataset.selectedEs = es;
            listEl.hidden = true;
            listEl.innerHTML = '';
            inputEl.blur();
        });
    };
}

// Autocomplete de Naturaleza
function setupNatureAutocomplete() {
    const inputEl = document.getElementById('natureInput');
    const listEl = document.getElementById('natureMatches');
    if (!inputEl || !listEl) return;

    inputEl.placeholder = "Escribe naturaleza";

    inputEl.oninput = async () => {
        const q = (inputEl.value || '').trim().toLowerCase();
        if (!q || q.length < 1) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            return;
        }

        await ensureNatureIdList();

        const matches = [];
        const seen = new Set();

        for (const [id, pack] of Object.entries(natureEsCache)) {
            const es = pack?.nameEs;
            if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                seen.add(id);
                matches.push({ id, es, up: pack.up, down: pack.down });
            }
        }

        const ids = (natureIdList || []).filter(id => !seen.has(id));
        const batch = ids.slice(0, 500);
        const promises = batch.map(id => {
            if (natureEsCache[id]) return Promise.resolve({ id, pack: natureEsCache[id] });
            return natureEs(id).then(pack => ({ id, pack })).catch(() => ({ id, pack: null }));
        });
        const results = await Promise.all(promises);
        for (const r of results) {
            if (matches.length >= 20) break;
            if (!r.pack) continue;
            const es = r.pack.nameEs;
            if (es && es.toLowerCase().includes(q)) {
                seen.add(r.id);
                matches.push({ id: r.id, es, up: r.pack.up, down: r.pack.down });
            }
        }

        if (!matches.length) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            return;
        }
        listEl.innerHTML = matches.slice(0, 20)
            .map(n => `<button data-id="${n.id}" data-up="${n.up || ''}" data-down="${n.down || ''}">${n.es}</button>`)
            .join('');
        listEl.hidden = false;

        listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
            const id = btn.dataset.id;
            const es = btn.textContent;
            inputEl.value = es;
            inputEl.dataset.selectedId = id;
            inputEl.dataset.selectedEs = es;
            inputEl.dataset.up = btn.dataset.up || '';
            inputEl.dataset.down = btn.dataset.down || '';
            listEl.hidden = true;
            listEl.innerHTML = '';
            inputEl.blur();
        });
    };
}

// Autocomplete de Habilidad
function setupAbilityAutocomplete() {
    const inputEl = document.getElementById('abilityInput');
    const listEl = document.getElementById('abilityMatches');
    if (!inputEl || !listEl) return;

    inputEl.placeholder = "Escribe habilidad";

    inputEl.oninput = async () => {
        const q = (inputEl.value || '').trim().toLowerCase();
        if (!q || q.length < 1) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            return;
        }

        await ensureAbilityIndex();

        const matches = [];
        const seen = new Set();

        for (const [id, es] of Object.entries(abilityEsCache)) {
            if (es && es.toLowerCase().includes(q) && !seen.has(id)) {
                seen.add(id);
                matches.push({ id, es });
            }
        }

        const ids = (abilityIndex || []).filter(id => !seen.has(id));
        const batch = ids.slice(0, 500);
        const promises = batch.map(id => {
            if (abilityEsCache[id]) return Promise.resolve({ id, es: abilityEsCache[id] });
            return abilityEs(id).then(es => ({ id, es })).catch(() => ({ id, es: null }));
        });
        const results = await Promise.all(promises);
        for (const r of results) {
            if (matches.length >= 20) break;
            if (!r.es) continue;
            if (r.es.toLowerCase().includes(q)) {
                seen.add(r.id);
                matches.push({ id: r.id, es: r.es });
            }
        }

        if (!matches.length) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            return;
        }
        listEl.innerHTML = matches.slice(0, 20).map(m => `<button data-id="${m.id}">${m.es}</button>`).join('');
        listEl.hidden = false;

        listEl.querySelectorAll('button').forEach(btn => btn.onclick = () => {
            const id = btn.dataset.id;
            const es = btn.textContent;
            inputEl.value = es;
            inputEl.dataset.selectedId = id;
            inputEl.dataset.selectedEs = es;
            listEl.hidden = true;
            listEl.innerHTML = '';
            inputEl.blur();
        });
    };
}

// Autocomplete de Objeto Equipado (desde Mochila)
function setupHeldItemAutocomplete() {
    const inputEl = document.getElementById('heldItemInput');
    const listEl = document.getElementById('heldItemMatches');
    if (!inputEl || !listEl || !window.Bag || !window.Bag.setupBagAutocomplete) return;
    window.Bag.setupBagAutocomplete(inputEl, listEl, { minLength: 0, maxResults: 12 });
}
