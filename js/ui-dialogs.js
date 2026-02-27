/**
 * Diálogos y confirmar adición/edición de Pokémon
 */

function resetDialog() {
    const nameInput = document.getElementById('nameInput');
    if (nameInput) nameInput.value = '';

    const natureInput = document.getElementById('natureInput');
    if (natureInput) {
        natureInput.value = '';
        natureInput.dataset.selectedId = '';
        natureInput.dataset.selectedEs = '';
        natureInput.dataset.up = '';
        natureInput.dataset.down = '';
    }
    const natureMatches = document.getElementById('natureMatches');
    if (natureMatches) natureMatches.innerHTML = '';

    const ballInput = document.getElementById('ballInput');
    if (ballInput) {
        ballInput.value = '';
        ballInput.dataset.selectedId = '';
        ballInput.dataset.selectedEs = '';
    }
    const ballMatches = document.getElementById('ballMatches');
    if (ballMatches) ballMatches.innerHTML = '';

    const abilityInput = document.getElementById('abilityInput');
    if (abilityInput) {
        abilityInput.value = '';
        abilityInput.dataset.selectedId = '';
        abilityInput.dataset.selectedEs = '';
    }
    const abilityMatches = document.getElementById('abilityMatches');
    if (abilityMatches) abilityMatches.innerHTML = '';

    const moveInputs = document.querySelectorAll('.move-input');
    moveInputs.forEach(inp => {
        inp.value = '';
        inp.dataset.selectedId = '';
        inp.dataset.selectedEs = '';
        const listEl = inp.parentElement.querySelector('.move-list');
        if (listEl) listEl.innerHTML = '';
    });

    pendingBase = null;
    if ($result) $result.innerHTML = '';
    const shinyToggle = document.getElementById('shinyToggle');
    if (shinyToggle) shinyToggle.checked = false;
}

// Evento: confirmar añadir/editar Pokémon
function setupConfirmBtn() {
    if (!$confirm) return;
    $confirm.addEventListener('click', () => {
        if (!pendingBase) return;

        const moveInputs = Array.from(document.querySelectorAll('.move-input'));
        const moves = moveInputs
            .map(inp => inp.dataset.selectedId
                ? { id: inp.dataset.selectedId, nameEs: inp.dataset.selectedEs || inp.value }
                : null)
            .filter(Boolean);

        const ballInput = document.getElementById('ballInput');
        const ball = ballInput?.dataset.selectedId
            ? { id: ballInput.dataset.selectedId, nameEs: ballInput.dataset.selectedEs || ballInput.value }
            : null;

        const natureInput = document.getElementById('natureInput');
        let nature = null;
        if (natureInput?.dataset.selectedId) {
            nature = {
                id: natureInput.dataset.selectedId,
                nameEs: natureInput.dataset.selectedEs || natureInput.value,
                up: natureInput.dataset.up || null,
                down: natureInput.dataset.down || null
            };
        }

        const genderSelect = document.getElementById('genderSelect');
        const gender = genderSelect?.value || 'unknown';

        const abilityInput = document.getElementById('abilityInput');
        const abId = abilityInput?.dataset.selectedId || null;
        const ability = abId ? { id: abId, nameEs: abilityInput?.dataset.selectedEs || abilityInput?.value || abId } : null;

        const heldInp = document.getElementById('heldItemInput');
        let nextHeldId = heldInp?.dataset?.selectedId || null;
        if (heldInp && !((heldInp.value || '').trim())) {
            nextHeldId = null;
            if (heldInp.dataset) heldInp.dataset.selectedId = '';
        }

        const stats = {
            hp: Number(document.getElementById('stat_hp').value || 0),
            atk: Number(document.getElementById('stat_atk').value || 0),
            def: Number(document.getElementById('stat_def').value || 0),
            spa: Number(document.getElementById('stat_spa').value || 0),
            spd: Number(document.getElementById('stat_spd').value || 0),
            spe: Number(document.getElementById('stat_spe').value || 0)
        };

        const num = (document.getElementById('numInput')?.value || '').trim() || null;
        const nickname = (document.getElementById('nicknameInput')?.value || '').trim() || null;
        const level = Number(document.getElementById('levelInput')?.value || 0) || null;
        const shinyToggle = document.getElementById('shinyToggle');
        const shiny = !!shinyToggle?.checked;

        // EDITAR
        if (editMode && editingId) {
            const idx = db.findIndex(x => x.id === editingId);
            if (idx !== -1) {
                const old = db[idx];
                const heldItemNew = window.Bag && window.Bag.equipDiff ? window.Bag.equipDiff(old.heldItem || null, nextHeldId) : (old.heldItem || null);

                db[idx] = {
                    ...old,
                    dexId: pendingBase.dexId,
                    name: pendingBase.name,
                    types: pendingBase.types,
                    sprite: pendingBase.sprite || old.sprite || '',
                    spriteShiny: pendingBase.spriteShiny || old.spriteShiny || '',
                    height: pendingBase.height,
                    weight: pendingBase.weight,
                    moves, ball, nature, gender, ability, heldItem: heldItemNew, stats, num,
                    nickname, level, shiny
                };

                const maxHpEdit = computeMaxHp(db[idx]);
                if (typeof db[idx].hpCurrent !== 'number' || isNaN(db[idx].hpCurrent)) {
                    db[idx].hpCurrent = maxHpEdit;
                } else if (db[idx].hpCurrent > maxHpEdit) {
                    db[idx].hpCurrent = maxHpEdit;
                }

                setDirty(true);
                render();
            }

            editMode = false;
            editingId = null;
            const addTitle = document.querySelector('#addDialog header h2');
            if (addTitle) addTitle.textContent = 'Añadir Pokémon';
            if ($confirm) $confirm.textContent = 'Añadir a mi base';
            $query.disabled = false;
            $searchBtn.disabled = false;
            $dialog.close();
            return;
        }

        // AÑADIR
        const heldItemNewAdd = window.Bag && window.Bag.equipDiff ? window.Bag.equipDiff(null, nextHeldId) : null;
        const entry = {
            id: uuid(),
            dexId: pendingBase.dexId,
            name: pendingBase.name,
            types: pendingBase.types,
            sprite: pendingBase.sprite,
            spriteShiny: pendingBase.spriteShiny || '',
            height: pendingBase.height,
            weight: pendingBase.weight,
            moves, ball, nature, gender, ability, heldItem: heldItemNewAdd, stats, num,
            nickname, level,
            inTeam: false,
            shiny
        };

        const maxHpNew = computeMaxHp(entry);
        entry.hpCurrent = maxHpNew;

        db.push(entry);
        db.sort((a, b) => a.dexId - b.dexId);
        setDirty(true);
        render();
        $dialog.close();
    });
}

// Cierra listas al click fuera
function setupDialogClosers() {
    document.addEventListener('click', (ev) => {
        const within = el => el && (el === ev.target || el.contains(ev.target));

        document.querySelectorAll('.move-list').forEach(el => {
            if (!within(el) && !within(el.parentElement)) {
                el.hidden = true;
                el.innerHTML = '';
            }
        });

        const ballMatches = document.getElementById('ballMatches');
        const ballInput = document.getElementById('ballInput');
        if (!within(ballMatches) && !within(ballInput)) {
            ballMatches.hidden = true;
            ballMatches.innerHTML = '';
        }

        const natureMatches = document.getElementById('natureMatches');
        const natureInput = document.getElementById('natureInput');
        if (!within(natureMatches) && !within(natureInput)) {
            natureMatches.hidden = true;
            natureMatches.innerHTML = '';
        }

        const aI = document.getElementById('abilityInput');
        const aL = document.getElementById('abilityMatches');
        if (!within(aL) && !within(aI)) {
            aL.hidden = true;
            aL.innerHTML = '';
        }
    });
}
