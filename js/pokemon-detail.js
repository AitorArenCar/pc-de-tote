/**
 * Vista de detalle de Pokémon
 */

function renderExpBlock(p) {
    window.POKE_INDEX.set(p.id, p);
    ensureExpFields(p);
    const pct = Math.max(0, Math.min(100, (p.exp / p.expMax) * 100));
    return `
    <div class="exp-box" data-pid="${p.id}">
      <div class="exp-row">
        <div class="exp-bar">
          <div class="exp-fill" style="width:${pct}%"></div>
        </div>
        <div class="exp-num">${p.exp} / ${p.expMax}</div>
        <div class="exp-ctrl">
          <input type="number" class="exp-add" value="1" min="1" max="${p.expMax}" />
          <button class="btn btn-primary exp-add-btn">+EXP</button>
          <button class="btn exp-lvlup-btn">Subir nivel (+10)</button>
        </div>
      </div>
    </div>
  `;
}

async function showDetails(p) {
    ensureExpFields(p);
    window.POKE_INDEX?.set(p.id, p);

    let displayName = p.nickname?.trim() ? p.nickname : cap(p.name);
    if (p.gender === 'male') displayName += ' ♂️';
    else if (p.gender === 'female') displayName += ' ♀️';
    if (p.shiny) displayName += ' ★';

    const $detailTitle = document.getElementById('detailTitle');
    $detailTitle.innerHTML = `${displayName} <span class="chip">Nv. <span class="detail-level detail-level-title">${p.level}</span></span>`;

    const natUp = p.nature?.up || null, natDown = p.nature?.down || null;
    const natName = p.nature?.nameEs || '—';
    const abilityName = p.ability?.nameEs || '—';
    const abilityId = p.ability?.id || '';

    if ((p.height == null || p.weight == null) && (p.dexId || p.name)) {
        try {
            const fresh = await fetchPokemonCore(p.dexId || p.name);
            p.height = fresh.height;
            p.weight = fresh.weight;
            setDirty(true);
        } catch (e) { console.warn('No se pudo completar height/weight', e); }
    }
    ensureHp(p);

    const healButtonsHtml = Object.entries(ITEM_CATALOG).map(([key, def]) => {
        const cnt = bagCountByEsName(def.name);
        return cnt > 0 ? `<button class="btn heal-btn" data-key="${key}">${def.name} (${cnt})</button>` : '';
    }).join('');

    const hpSection = `
    <div class="hp-box">
      <div class="hp-row">
        <div class="hp-bar"><div class="hp-fill"></div></div>
        <div class="hp-num"></div>
        <div class="hp-ctrl">
          <button class="btn hp-minus">−</button>
          <input type="number" class="hp-input" min="0" value="0">
          <button class="btn hp-plus">＋</button>
          <button class="btn hp-full" title="Curar este">Curar</button>
        </div>
      </div>
      <div class="heal-row">${healButtonsHtml}</div>
    </div>
  `;

    const height = p.height && !isNaN(p.height) ? (p.height / 10).toFixed(1) : '—';
    const weight = p.weight && !isNaN(p.weight) ? (p.weight / 10).toFixed(1) : '—';
    const ballHtml = p.ball?.id
        ? `<img class="ball-icon" alt="${p.ball?.nameEs || p.ball?.id}" src="${ballSpriteUrl(p.ball.id)}" onerror="this.style.display='none'">`
        : '';

    const teamHtml = teamIconSVG(!!p.inTeam);

    const rows = statOrder().map(id => {
        const v = p.stats?.[id] ?? 0;
        const plus = (id === 'atk' && natUp === 'attack') || (id === 'def' && natUp === 'defense') ||
            (id === 'spa' && natUp === 'special-attack') || (id === 'spd' && natUp === 'special-defense') ||
            (id === 'spe' && natUp === 'speed');
        const minus = (id === 'atk' && natDown === 'attack') || (id === 'def' && natDown === 'defense') ||
            (id === 'spa' && natDown === 'special-attack') || (id === 'spd' && natDown === 'special-defense') ||
            (id === 'spe' && natDown === 'speed');
        return `<span class="stat-badge">${statLabel(id)}: <strong>${v}</strong> ${plus ? '<span class="plus">+</span>' : ''}${minus ? '<span class="minus">–</span>' : ''}</span>`;
    }).join('');

    const movePacks = [];
    const moves = (p.moves || []).slice(0, 4);
    for (const m of moves) {
        if (!m?.id) { movePacks.push(null); continue; }
        try { movePacks.push(await getMoveFullEs(m.id)); } catch { movePacks.push(null); }
    }

    const moveCards = movePacks.map(mp => {
        if (!mp) {
            return `
        <div class="move-card">
          <header style="background:rgba(255,255,255,.06);color:#e6eefb;">
            <span>—</span><span class="move-type-tag">—</span>
          </header>
          <div class="move-body">
            <div class="move-desc">Sin datos.</div>
            <div class="move-meta">
              <div><b>PP:</b> —</div><div><b>Daño:</b> —</div>
              <div><b>Tipo de daño:</b> —</div><div><b>Precisión:</b> —</div>
            </div>
          </div>
        </div>`;
        }
        const mmeta = TYPE_META[mp.type] || {};
        const bg = mmeta.bg || 'rgba(255,255,255,.06)';
        const fg = mmeta.fg || '#e6eefb';
        const pp = mp.pp > 5 ? 'inf' : mp.pp;
        const damage = calcDamageTier(mp.power);
        return `
      <div class="move-card">
        <header style="background:${bg};color:${fg}">
          <span>${mp.nameEs}</span>
          <span class="move-type-tag" style="background:rgba(0,0,0,.08);color:${fg};border-color:rgba(0,0,0,.15)">${mp.typeEs}</span>
        </header>
        <div class="move-body">
          <div class="move-desc">${mp.descEs}${mp.effectInfo ? ` - <span><b>${mp.effectInfo}</b></span>` : ''}</div>
          <div class="move-meta">
            <div><b>PP:</b> ${pp}</div>
            <div><b>Daño:</b> ${damage}</div>
            <div><b>Tipo de daño:</b> ${mp.classEs}</div>
            <div><b>Precisión:</b> ${mp.accuracy === null ? '—' : mp.accuracy}</div>
          </div>
        </div>
      </div>`;
    }).join('');

    const $detailContent = document.getElementById('detailContent');
    $detailContent.innerHTML = `
    <div class="detail-top">
      <div class="detail-main-info">
        <div class="detail-head">
          <img width="120" height="120" alt="${p.name}" src="${spriteUrlOf(p)}" />
          <div>
            <div class="name-row-header">
              <span class="pkname">${cap(p.name)}${p.shiny ? ' ★' : ''}</span>
              <span class="muted">#${p.dexId}</span>
              ${ballHtml}
              ${teamHtml}
            </div>${renderExpBlock(p)}
            <div class="chips" style="margin-top:6px">${(p.types || []).map(typeChip).join('')}</div>
            ${hpSection}
            <div class="name-row-info">
              <div class="name-row-info-left">
                <div class="small" style="margin-top:6px">Nº personal: <strong>${(p.num && String(p.num).length) ? p.num : '—'}</strong></div>
                <div class="small" style="margin-top:6px">Naturaleza: <strong>${natName}</strong></div>
                <div class="small" style="margin-top:6px">Habilidad:
                  ${abilityId ? `<button class="ability-link linklike" data-id="${abilityId}" type="button">${abilityName}</button>` : `<span>${abilityName}</span>`}
                </div>
              </div>
              <div class="name-row-info-right">
                <div class="small" style="margin-top:6px">Altura: <strong>${height} m</strong></div>
                <div class="small" style="margin-top:6px">Peso: <strong>${weight} kg</strong></div>
                <div class="small" style="margin-top:6px">Objeto:
                  ${p.heldItem?.id
                    ? `<button class="helditem-link linklike" data-id="${p.heldItem.id}" type="button">${p.heldItem.nameEs || "—"}</button>`
                    : `<span>${p.heldItem?.nameEs || "—"}</span>`}
                </div>
              </div>
            </div>
          </div>
          <div style="margin-left: 50px;">
            <h3 style="margin:0 0 6px;font-size:14px">Estadísticas</h3>
            <div class="detail-stats">${rows}</div>
          </div>
        </div>
      </div>
    </div>

    <h3 style="margin:14px 0 6px;font-size:14px">Ataques</h3>
    <div class="moves-grid">
      ${moveCards || ''}
    </div>

    <h3 style="margin:14px 0 6px;font-size:14px">Notas</h3>
    <textarea id="notesBox" placeholder="Escribe tus notas..." style="width:95%;min-height:140px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;resize:vertical;"></textarea>
  `;

    const $notes = document.getElementById('notesBox');
    if ($notes) {
        $notes.value = p.notes || '';
        $notes.addEventListener('input', (e) => {
            const val = e.target.value;
            p.notes = val;
            const idx = db.findIndex(x => x.id === p.id);
            if (idx !== -1) db[idx].notes = val;
            setDirty(true);
            try {
                const bg = (window.getBackgroundDataUrl && window.getBackgroundDataUrl()) || null;
                const bagState = window.Bag?.getState?.() || null;
                const payload = { version: 2, entries: db, bg, bag: bagState };
                localStorage.setItem('pokebox_autosave_v2', JSON.stringify(payload));
            } catch { }
        });
    }

    $detailContent.setAttribute('data-pid', p.id);

    // HP UI setup
    const box = $detailContent.querySelector('.hp-box');
    const $fill = box.querySelector('.hp-fill');
    const $num = box.querySelector('.hp-num');
    const $input = box.querySelector('.hp-input');
    const $minus = box.querySelector('.hp-minus');
    const $plus = box.querySelector('.hp-plus');
    const $full = box.querySelector('.hp-full');

    function redrawHpUI() {
        const maxHp = computeMaxHp(p);
        const cur = Math.min(Math.max(0, p.hpCurrent ?? 0), maxHp);
        $input.max = String(maxHp);
        $input.value = String(cur);
        $fill.style.width = maxHp ? Math.round(cur / maxHp * 100) + '%' : '0%';
        $num.textContent = `${cur} / ${maxHp}`;
    }

    $input.addEventListener('input', () => {
        const v = Number($input.value || 0);
        p.hpCurrent = Math.min(Math.max(0, v), computeMaxHp(p));
        setDirty(true);
        redrawHpUI();
    });
    $minus.addEventListener('click', () => {
        p.hpCurrent = Math.max(0, (p.hpCurrent || 0) - 1);
        setDirty(true);
        redrawHpUI();
    });
    $plus.addEventListener('click', () => {
        p.hpCurrent = Math.min(computeMaxHp(p), (p.hpCurrent || 0) + 1);
        setDirty(true);
        redrawHpUI();
    });
    $full.addEventListener('click', () => {
        p.hpCurrent = computeMaxHp(p);
        setDirty(true);
        redrawHpUI();
    });

    function applyHealByItemKey(key) {
        const def = ITEM_CATALOG[key];
        if (!def) return;

        const stock = bagCountByEsName(def.name);
        if (stock <= 0) return;

        const maxHp = computeMaxHp(p);
        const cur = Math.max(0, p.hpCurrent || 0);
        const next = def.heal === 'full' ? maxHp : Math.min(maxHp, cur + def.heal);
        if (next === cur) return;

        if (!bagConsumeByEsName(def.name)) return;

        p.hpCurrent = next;
        setDirty(true);
        redrawHpUI();

        $detailContent.querySelectorAll('.heal-btn').forEach(btn => {
            const k = btn.dataset.key;
            const c = bagCountByEsName(ITEM_CATALOG[k].name);
            btn.textContent = `${ITEM_CATALOG[k].name} (${c})`;
            btn.disabled = c <= 0;
        });
    }

    $detailContent.querySelectorAll('.heal-btn').forEach(btn => {
        btn.addEventListener('click', () => applyHealByItemKey(btn.dataset.key));
    });

    setupAbilityTooltip();
    setupHeldItemTooltip();

    function setupAbilityTooltip() {
        const btn = $detailContent.querySelector('.ability-link');
        if (!btn) return;
        const old = $detailDialog.querySelector('.ability-tooltip');
        if (old) old.remove();
        const tip = document.createElement('div');
        tip.className = 'ability-tooltip muted';
        tip.style.position = 'absolute';
        tip.style.display = 'none';
        tip.style.maxWidth = '320px';
        tip.style.padding = '10px 12px';
        tip.style.borderRadius = '10px';
        tip.style.background = 'rgba(12, 18, 45, .98)';
        tip.style.border = '1px solid rgba(255,255,255,.12)';
        tip.style.fontSize = '12px';
        tip.style.lineHeight = '1.4';
        tip.style.zIndex = '9999';
        $detailDialog.appendChild(tip);

        let pinned = false;
        async function show() {
            const id = btn.dataset.id;
            const { text } = await getAbilityInfoEs(id);
            tip.textContent = text || 'Sin descripción disponible.';
            const br = btn.getBoundingClientRect();
            const dr = $detailDialog.getBoundingClientRect();
            const left = Math.min(br.left - dr.left, $detailDialog.clientWidth - 340);
            const top = br.bottom - dr.top + 8;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
            tip.style.display = 'block';
        }

        function hide() { if (!pinned) tip.style.display = 'none'; }
        btn.addEventListener('mouseenter', show);
        btn.addEventListener('mouseleave', hide);
        btn.addEventListener('focus', show);
        btn.addEventListener('blur', hide);
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (pinned) { pinned = false; tip.style.display = 'none'; return; }
            await show();
            pinned = true;
        });
        $detailDialog.addEventListener('click', (e) => {
            if (!pinned) return;
            if (e.target !== btn && !tip.contains(e.target)) {
                pinned = false;
                tip.style.display = 'none';
            }
        });
    }

    function setupHeldItemTooltip() {
        const btn = $detailContent.querySelector('.helditem-link');
        if (!btn || !p.heldItem) return;
        const old = $detailDialog.querySelector('.helditem-tooltip');
        if (old) old.remove();
        const tip = document.createElement('div');
        tip.className = 'helditem-tooltip muted';
        tip.style.position = 'absolute';
        tip.style.display = 'none';
        tip.style.maxWidth = '320px';
        tip.style.padding = '10px 12px';
        tip.style.borderRadius = '10px';
        tip.style.background = 'rgba(12, 18, 45, .98)';
        tip.style.border = '1px solid rgba(255,255,255,.12)';
        tip.style.fontSize = '12px';
        tip.style.lineHeight = '1.4';
        tip.style.zIndex = '9999';
        $detailDialog.appendChild(tip);

        let pinned = false;
        function show() {
            const text = (p.heldItem?.effectText || '').replace(/\s+/g, ' ').trim() || 'Sin descripción disponible.';
            tip.textContent = text;
            const br = btn.getBoundingClientRect();
            const dr = $detailDialog.getBoundingClientRect();
            const left = Math.min(br.left - dr.left, $detailDialog.clientWidth - 340);
            const top = br.bottom - dr.top + 8;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
            tip.style.display = 'block';
        }
        function hide() { if (!pinned) tip.style.display = 'none'; }
        btn.addEventListener('mouseenter', show);
        btn.addEventListener('mouseleave', hide);
        btn.addEventListener('focus', show);
        btn.addEventListener('blur', hide);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pinned) { pinned = false; tip.style.display = 'none'; return; }
            show();
            pinned = true;
        });
        $detailDialog.addEventListener('click', (e) => {
            if (!pinned) return;
            if (e.target !== btn && !tip.contains(e.target)) {
                pinned = false;
                tip.style.display = 'none';
            }
        });
    }

    setupMovesDamageTooltips(p);

    $detailDialog.showModal();

    const $editDetail = document.getElementById('editDetail');
    if ($editDetail) $editDetail.onclick = () => startEdit(p);

    redrawHpUI();
}

function startEdit(p) {
    editMode = true;
    editingId = p.id;

    $detailDialog.close();

    const addTitle = document.querySelector('#addDialog header h2');
    if (addTitle) addTitle.textContent = 'Editar Pokémon';
    if ($confirm) $confirm.textContent = 'Guardar cambios';

    $feedback.textContent = '';
    $matches.hidden = true;
    $matches.innerHTML = '';
    $query.value = `${cap(p.name)} (#${p.dexId})`;
    $query.disabled = true;
    $searchBtn.disabled = true;

    pendingBase = {
        dexId: p.dexId,
        name: p.name,
        types: p.types || [],
        sprite: p.sprite || '',
        spriteShiny: p.spriteShiny || p.sprite_shiny || '',
        height: p.height,
        weight: p.weight
    };

    const shinyToggle = document.getElementById('shinyToggle');
    if (shinyToggle) shinyToggle.checked = !!p.shiny;

    renderPendingPreview();

    if (!pendingBase.spriteShiny) {
        try {
            const currentEdit = p.id;
            fetchPokemonCore(p.dexId || p.name).then(fresh => {
                if (!editMode || editingId !== currentEdit) return;
                pendingBase = {
                    ...pendingBase,
                    sprite: pendingBase.sprite || fresh.sprite || '',
                    spriteShiny: pendingBase.spriteShiny || fresh.spriteShiny || '',
                    types: (pendingBase.types && pendingBase.types.length) ? pendingBase.types : (fresh.types || pendingBase.types),
                    height: pendingBase.height ?? fresh.height ?? pendingBase.height,
                    weight: pendingBase.weight ?? fresh.weight ?? pendingBase.weight
                };
                renderPendingPreview();
            }).catch(() => { });
        } catch { }
    }

    $extra.hidden = false;
    $confirm.disabled = false;

    const moveInputs = Array.from(document.querySelectorAll('.move-input'));
    moveInputs.forEach((inp, i) => {
        const mv = (p.moves || [])[i] || null;
        inp.value = mv?.nameEs || '';
        inp.dataset.selectedId = mv?.id || '';
        inp.dataset.selectedEs = mv?.nameEs || '';
    });

    const ballInput = document.getElementById('ballInput');
    if (ballInput) {
        ballInput.value = p.ball?.nameEs || '';
        ballInput.dataset.selectedId = p.ball?.id || '';
        ballInput.dataset.selectedEs = p.ball?.nameEs || '';
    }

    const natureInput = document.getElementById('natureInput');
    if (natureInput) {
        natureInput.value = p.nature?.nameEs || '';
        natureInput.dataset.selectedId = p.nature?.id || '';
        natureInput.dataset.selectedEs = p.nature?.nameEs || '';
        natureInput.dataset.up = p.nature?.up || '';
        natureInput.dataset.down = p.nature?.down || '';
    }

    const abilityInput = document.getElementById('abilityInput');
    if (abilityInput) {
        abilityInput.value = p.ability?.nameEs || '';
        abilityInput.dataset.selectedId = p.ability?.id || '';
        abilityInput.dataset.selectedEs = p.ability?.nameEs || '';
    }

    const heldInp = document.getElementById('heldItemInput');
    if (heldInp) {
        if (p.heldItem) {
            heldInp.value = p.heldItem.nameEs || '';
            heldInp.dataset.selectedId = p.heldItem.id || '';
        } else {
            heldInp.value = '';
            heldInp.dataset.selectedId = '';
        }
    }

    const stats = p.stats || {};
    ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(k => {
        const el = document.getElementById('stat_' + k);
        if (el) el.value = stats[k] ?? 0;
    });

    const genderSelect = document.getElementById('genderSelect');
    if (genderSelect) genderSelect.value = p.gender || 'unknown';
    const numInput = document.getElementById('numInput');
    if (numInput) numInput.value = p.num || '';

    const nick = document.getElementById('nicknameInput');
    if (nick) nick.value = p.nickname || '';
    const lvl = document.getElementById('levelInput');
    if (lvl) lvl.value = p.level || '';

    $dialog.showModal();
}

/**
 * Configura los tooltips de daño de movimientos
 */
function setupMovesDamageTooltips(p) {
    const moveCards = document.querySelectorAll('.move-card');
    const moves = (p.moves || []).slice(0, 4);

    // Variable global para cerrar tooltips anteriores
    let lastOpenTooltip = null;
    let lastPinned = false;

    moveCards.forEach((card, index) => {
        const move = moves[index];
        if (!move || !move.id) return;

        card.style.cursor = 'pointer';
        card.title = 'Clic para ver daño';

        let damageTooltip = null;
        let pinned = false;

        async function show() {
            // Cerrar tooltip anterior si no está pinned
            if (lastOpenTooltip && !lastPinned && lastOpenTooltip !== damageTooltip) {
                lastOpenTooltip.style.display = 'none';
            }

            if (!damageTooltip) {
                damageTooltip = document.createElement('div');
                damageTooltip.className = 'move-damage-tooltip';
                damageTooltip.style.position = 'absolute';
                damageTooltip.style.display = 'none';
                damageTooltip.style.maxWidth = '420px';
                damageTooltip.style.maxHeight = '400px';
                damageTooltip.style.overflowY = 'auto';
                damageTooltip.style.padding = '12px 14px';
                damageTooltip.style.borderRadius = '10px';
                damageTooltip.style.background = 'rgba(12, 18, 45, .98)';
                damageTooltip.style.border = '1px solid rgba(255,255,255,.12)';
                damageTooltip.style.fontSize = '12px';
                damageTooltip.style.lineHeight = '1.5';
                damageTooltip.style.zIndex = '9999';
                damageTooltip.style.color = '#e6eefb';
                $detailDialog.appendChild(damageTooltip);
            }

            try {
                const moveData = await getMoveFullEs(move.id);
                const damageInfo = calculateMoveDamage(p, moveData);

                let contentHtml = `<strong>${moveData.nameEs}</strong><br/>`;

                if (damageInfo.damage === null && !damageInfo.table) {
                    contentHtml += damageInfo.description;
                } else if (damageInfo.isVariablePower && damageInfo.table) {
                    contentHtml += damageInfo.description;
                    contentHtml += '<br/><br/><table style="width:100%; border-collapse:collapse;">';
                    
                    damageInfo.table.forEach((row, i) => {
                        const keys = Object.keys(row);
                        if (i === 0) {
                            contentHtml += '<tr style="border-bottom:1px solid rgba(255,255,255,.15)">';
                            keys.forEach(k => {
                                const label = k === 'daño' ? 'Daño' :
                                              k === 'nivel' ? 'Nivel' :
                                              k === 'stacks' ? 'Estacks' :
                                              k === 'rango' ? 'Rango' :
                                              k === 'min' ? 'Mín' :
                                              k === 'max' ? 'Máx' :
                                              k === 'promedio' ? 'Promedio' :
                                              k === 'condicion' ? 'Condición' :
                                              k === 'estimado' ? 'Estimado' :
                                              k === 'stat+stab' ? 'Daño Total' :
                                              k;
                                contentHtml += `<th style="text-align:left; padding:6px; font-weight:bold;">${label}</th>`;
                            });
                            contentHtml += '</tr>';
                        }
                        contentHtml += '<tr style="border-bottom:1px solid rgba(255,255,255,.08)">';
                        keys.forEach(k => {
                            contentHtml += `<td style="padding:6px;">${row[k]}</td>`;
                        });
                        contentHtml += '</tr>';
                    });
                    
                    contentHtml += '</table>';
                    
                    if (damageInfo.note) {
                        contentHtml += `<br/><em style="color:rgba(255,255,255,.6); font-size:11px;">${damageInfo.note}</em>`;
                    }
                } else {
                    contentHtml += `<strong style="color:#7AC74C; font-size:14px;">${damageInfo.damage} de daño</strong>`;
                    contentHtml += `<br/><small style="color:rgba(255,255,255,.7);">${damageInfo.description}</small>`;
                    if (damageInfo.stabApplied) {
                        contentHtml += '<br/><span style="color:#7AC74C; font-size:11px;">✓ STAB +2</span>';
                    }
                }

                damageTooltip.innerHTML = contentHtml;

                const br = card.getBoundingClientRect();
                const dr = $detailDialog.getBoundingClientRect();
                const left = Math.max(0, Math.min(br.left - dr.left, $detailDialog.clientWidth - 420));
                
                // Posicionamiento inteligente: arriba o abajo según espacio
                const spaceBelow = dr.bottom - br.bottom;
                const tooltipHeight = 400; // maxHeight del tooltip
                const gap = 8;
                
                let top;
                if (spaceBelow < tooltipHeight + gap) {
                    // No hay espacio abajo, posicionar arriba
                    top = Math.max(0, br.top - dr.top - tooltipHeight - gap);
                } else {
                    // Hay espacio abajo, posicionar abajo
                    top = Math.max(0, br.bottom - dr.top + gap);
                }
                
                damageTooltip.style.left = left + 'px';
                damageTooltip.style.top = top + 'px';
                damageTooltip.style.display = 'block';

                // Actualizar referencia global
                lastOpenTooltip = damageTooltip;
                lastPinned = pinned;
            } catch (e) {
                console.warn('Error calculando daño:', e);
                damageTooltip.innerHTML = '<strong>Error</strong><br/>No se pudo calcular el daño.';
                const br = card.getBoundingClientRect();
                const dr = $detailDialog.getBoundingClientRect();
                
                // Mismo posicionamiento inteligente para errores
                const spaceBelow = dr.bottom - br.bottom;
                const tooltipHeight = 400;
                const gap = 8;
                
                let top;
                if (spaceBelow < tooltipHeight + gap) {
                    top = Math.max(0, br.top - dr.top - tooltipHeight - gap);
                } else {
                    top = Math.max(0, br.bottom - dr.top + gap);
                }

                // Actualizar referencia global
                lastOpenTooltip = damageTooltip;
                lastPinned = pinned;
                
                damageTooltip.style.left = (br.left - dr.left) + 'px';
                damageTooltip.style.top = top + 'px';
                damageTooltip.style.display = 'block';
            }
        }

        function hide() { if (!pinned && damageTooltip) damageTooltip.style.display = 'none'; }

        card.addEventListener('mouseenter', show);
        card.addEventListener('mouseleave', hide);
        card.addEventListener('click', async (e) => {
            e.stopPropagation();
            await show();
            pinned = !pinned;
            lastPinned = pinned;
            if (!pinned) hide();
        });

        $detailDialog.addEventListener('click', (e) => {
            if (!pinned) return;
            if (!e.target.closest('.move-card') && damageTooltip && !damageTooltip.contains(e.target)) {
                pinned = false;
                hide();
            }
        });
    });
}
