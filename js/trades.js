/**
 * Sistema de intercambios (trades)
 */

function resetTradeState() {
    currentTradeState = {
        selectedUserId: null,
        selectedUserEmail: null,
        selectedUserPokemonList: [],
        myPokemonId: null,
        targetPokemonId: null,
        targetUserId: null
    };
}

async function initiateTrade() {
    resetTradeState();
    const $tradeStep1 = document.getElementById('tradeStep1');
    const $tradeStep2 = document.getElementById('tradeStep2');
    const $tradeSummary = document.getElementById('tradeSummary');
    const $tradeUserSelect = document.getElementById('tradeUserSelect');

    $tradeStep1.hidden = false;
    $tradeStep2.hidden = true;
    $tradeSummary.hidden = true;

    try {
        const users = await window.Supa?.listUsers?.();
        if (!users || users.length === 0) {
            toast('No hay otros jugadores disponibles', 'info');
            return;
        }

        $tradeUserSelect.innerHTML = '<option value="">-- Selecciona un jugador --</option>';

        for (const user of users) {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.email || `Usuario ${user.id.slice(0, 8)}`;
            $tradeUserSelect.appendChild(option);
        }

        $tradeInitDialog.showModal();
    } catch (e) {
        toast('Error cargando usuarios: ' + e.message, 'error');
    }
}

async function loadUserPokemon(userId) {
    try {
        const { data, error } = await window.sb
            .from('poke_boxes')
            .select('data')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) {
            toast('Este usuario no tiene una caja de Pokémon registrada', 'info');
            return [];
        }

        const boxData = data.data || {};
        const pokemonList = boxData.entries || [];
        return pokemonList;
    } catch (e) {
        toast('Error cargando Pokémon del usuario: ' + e.message, 'error');
        return [];
    }
}

function renderUserPokemon(pokemonList) {
    const $tradeUserPokemon = document.getElementById('tradeUserPokemon');
    if (!pokemonList || pokemonList.length === 0) {
        $tradeUserPokemon.innerHTML = '<p class="muted">Este usuario no tiene Pokémon.</p>';
        return;
    }

    const html = `
        <p style="margin:0 0 6px; font-size:12px; color:var(--muted);">Pokémon disponibles (${pokemonList.length}):</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${pokemonList.slice(0, 6).map(p => `
                <span class="chip" style="font-size:11px;">
                    ${cap(p.nickname || p.name)} ${p.shiny ? '★' : ''} Nv.${p.level || '?'}
                </span>
            `).join('')}
            ${pokemonList.length > 6 ? `<span class="chip" style="font-size:11px; opacity:.7;">+${pokemonList.length - 6} más</span>` : ''}
        </div>
    `;
    $tradeUserPokemon.innerHTML = html;
}

function setupTradeEvents() {
    const $tradeUserSelect = document.getElementById('tradeUserSelect');
    const $tradeUserInfo = document.getElementById('tradeUserInfo');
    const $tradeUserName = document.getElementById('tradeUserName');
    const $tradeStep1 = document.getElementById('tradeStep1');
    const $tradeStep1Next = document.getElementById('tradeStep1Next');
    const $tradeStep2 = document.getElementById('tradeStep2');
    const $tradeMyPokemon = document.getElementById('tradeMyPokemon');
    const $tradeTargetPokemon = document.getElementById('tradeTargetPokemon');
    const $tradeMyPokemonInfo = document.getElementById('tradeMyPokemonInfo');
    const $tradeTargetPokemonInfo = document.getElementById('tradeTargetPokemonInfo');
    const $tradeStep2Back = document.getElementById('tradeStep2Back');
    const $tradeStep2Next = document.getElementById('tradeStep2Next');
    const $tradeSummary = document.getElementById('tradeSummary');
    const $summaryMyPokemon = document.getElementById('summaryMyPokemon');
    const $summaryTargetPokemon = document.getElementById('summaryTargetPokemon');
    const $summaryTargetUser = document.getElementById('summaryTargetUser');
    const $tradeConfirmBack = document.getElementById('tradeConfirmBack');
    const $tradeConfirmSend = document.getElementById('tradeConfirmSend');
    const $closeTradeInit = document.getElementById('closeTradeInit');

    $tradeUserSelect?.addEventListener('change', async (e) => {
        const userId = e.target.value;
        if (!userId) {
            $tradeUserInfo.style.display = 'none';
            $tradeStep1Next.disabled = true;
            return;
        }

        const userEmail = e.target.selectedOptions[0].textContent;
        currentTradeState.selectedUserId = userId;
        currentTradeState.selectedUserEmail = userEmail;

        $tradeUserName.textContent = `Usuario: ${userEmail}`;
        const pokemonList = await loadUserPokemon(userId);
        currentTradeState.selectedUserPokemonList = pokemonList;
        renderUserPokemon(pokemonList);
        $tradeUserInfo.style.display = 'block';
        $tradeStep1Next.disabled = pokemonList.length === 0;
    });

    $tradeStep1Next?.addEventListener('click', () => {
        if (!currentTradeState.selectedUserId) return;

        $tradeMyPokemon.innerHTML = '<option value="">-- Selecciona --</option>';
        db.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            const name = p.nickname || cap(p.name);
            option.textContent = `${name} Nv.${p.level || '?'} (${p.dexId})`;
            $tradeMyPokemon.appendChild(option);
        });

        $tradeTargetPokemon.innerHTML = '<option value="">-- Selecciona --</option>';
        currentTradeState.selectedUserPokemonList.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            const name = p.nickname || cap(p.name);
            option.textContent = `${name} Nv.${p.level || '?'} (${p.dexId})`;
            $tradeTargetPokemon.appendChild(option);
        });

        $tradeStep1.hidden = true;
        $tradeStep2.hidden = false;
    });

    $tradeMyPokemon?.addEventListener('change', (e) => {
        const pokemonId = e.target.value;
        if (!pokemonId) {
            $tradeMyPokemonInfo.style.display = 'none';
            return;
        }

        const pokemon = db.find(p => p.id === pokemonId);
        if (pokemon) {
            currentTradeState.myPokemonId = pokemonId;
            const info = `
                <strong>${cap(pokemon.nickname || pokemon.name)}</strong> #${pokemon.dexId}<br>
                Nv. ${pokemon.level || '?'} ${pokemon.gender === 'male' ? '♂️' : pokemon.gender === 'female' ? '♀️' : ''}${pokemon.shiny ? ' ★' : ''}<br>
                ${(pokemon.types || []).map(t => cap(t)).join(' / ')}
            `;
            $tradeMyPokemonInfo.innerHTML = info;
            $tradeMyPokemonInfo.style.display = 'block';
            checkTradeStep2Ready();
        }
    });

    $tradeTargetPokemon?.addEventListener('change', (e) => {
        const pokemonId = e.target.value;
        if (!pokemonId) {
            $tradeTargetPokemonInfo.style.display = 'none';
            return;
        }

        const pokemon = currentTradeState.selectedUserPokemonList.find(p => p.id === pokemonId);
        if (pokemon) {
            currentTradeState.targetPokemonId = pokemonId;
            const info = `
                <strong>${cap(pokemon.nickname || pokemon.name)}</strong> #${pokemon.dexId}<br>
                Nv. ${pokemon.level || '?'} ${pokemon.gender === 'male' ? '♂️' : pokemon.gender === 'female' ? '♀️' : ''}${pokemon.shiny ? ' ★' : ''}<br>
                ${(pokemon.types || []).map(t => cap(t)).join(' / ')}
            `;
            $tradeTargetPokemonInfo.innerHTML = info;
            $tradeTargetPokemonInfo.style.display = 'block';
            checkTradeStep2Ready();
        }
    });

    function checkTradeStep2Ready() {
        $tradeStep2Next.disabled = !currentTradeState.myPokemonId || !currentTradeState.targetPokemonId;
    }

    $tradeStep2Back?.addEventListener('click', () => {
        $tradeStep2.hidden = true;
        $tradeStep1.hidden = false;
    });

    $tradeStep2Next?.addEventListener('click', () => {
        const myPokemon = db.find(p => p.id === currentTradeState.myPokemonId);
        const targetPokemon = currentTradeState.selectedUserPokemonList.find(p => p.id === currentTradeState.targetPokemonId);

        $summaryMyPokemon.textContent = `${cap(myPokemon?.nickname || myPokemon?.name)} Nv.${myPokemon?.level || '?'}`;
        $summaryTargetPokemon.textContent = `${cap(targetPokemon?.nickname || targetPokemon?.name)} Nv.${targetPokemon?.level || '?'}`;
        $summaryTargetUser.textContent = `📬 Enviando a: ${currentTradeState.selectedUserEmail}`;

        $tradeStep2.hidden = true;
        $tradeSummary.hidden = false;
    });

    $tradeConfirmBack?.addEventListener('click', () => {
        $tradeSummary.hidden = true;
        $tradeStep2.hidden = false;
    });

    $tradeConfirmSend?.addEventListener('click', async () => {
        try {
            const myPokemon = db.find(p => p.id === currentTradeState.myPokemonId);
            const targetPokemon = currentTradeState.selectedUserPokemonList.find(p => p.id === currentTradeState.targetPokemonId);

            await window.Supa?.createTrade?.({
                targetUserId: currentTradeState.selectedUserId,
                initiatorPokemonId: currentTradeState.myPokemonId,
                targetPokemonId: currentTradeState.targetPokemonId,
                initiator_pokemon_data: myPokemon || null,
                target_pokemon_data: targetPokemon || null
            });

            toast('Solicitud de intercambio enviada', 'success');
            $tradeInitDialog.close();
            resetTradeState();
        } catch (e) {
            toast('Error enviando solicitud: ' + e.message, 'error');
        }
    });

    $closeTradeInit?.addEventListener('click', () => {
        $tradeInitDialog.close();
        resetTradeState();
    });
}

async function loadPendingTrades() {
    const $tradePendingList = document.getElementById('tradePendingList');
    try {
        const currentUser = await window.Supa?.getUser?.();
        const trades = await window.Supa?.getPendingTrades?.();
        if (!trades || trades.length === 0) {
            $tradePendingList.innerHTML = '<p class="muted">No tienes solicitudes pendientes.</p>';
            return;
        }

        let html = '';
        for (const trade of trades) {
            const isReceiver = trade.target_user_id === currentUser?.id;
            const isInitiator = trade.initiator_id === currentUser?.id;

            const initiatorPokemon = trade.initiator_pokemon_data || null;
            const targetPokemon = trade.target_pokemon_data || null;
            const initiatorEmail = trade.initiator_email || `Usuario ${trade.initiator_id.slice(0, 8)}`;

            let actionsHtml = '';
            let subtitle = '';
            if (isReceiver) {
                subtitle = 'te ha enviado una solicitud';
                actionsHtml = `
                    <button class="btn accept-trade" data-trade-id="${trade.id}" data-role="receiver">✓ Aceptar</button>
                    <button class="btn deny-trade" data-trade-id="${trade.id}">✕ Rechazar</button>
                `;
            } else if (isInitiator) {
                if (trade.receiver_status === 'accepted' && trade.initiator_status === 'pending') {
                    subtitle = 'tu solicitud ha sido aceptada — confirma el intercambio';
                    actionsHtml = `<button class="btn accept-trade" data-trade-id="${trade.id}" data-role="initiator">✓ Aceptar</button>`;
                } else if (trade.receiver_status === 'pending') {
                    subtitle = 'Esperando a que el receptor acepte';
                    actionsHtml = `<button class="btn deny-trade" data-trade-id="${trade.id}">✕ Cancelar</button>`;
                } else {
                    subtitle = 'Estado: ' + (trade.receiver_status || 'pendiente');
                }
            } else {
                subtitle = 'Solicitud entre otros usuarios';
            }

            html += `
                <div class="trade-card">
                    <div class="trade-card-header">
                        <div>
                            <p style="margin:0; font-weight:700;">${initiatorEmail}</p>
                            <p style="margin:4px 0 0; font-size:12px; color:var(--muted);">${subtitle}</p>
                        </div>
                    </div>
                    <div class="trade-card-info">
                        <div class="trade-card-pokemon">
                            <strong>${cap(initiatorPokemon?.nickname || initiatorPokemon?.name || '?')}</strong><br>
                            <span style="font-size:11px; opacity:.8;">Nv.${initiatorPokemon?.level || '?'}</span>
                        </div>
                        <div style="text-align:center; align-self:center;">⇄</div>
                        <div class="trade-card-pokemon" style="border-left-color:#34d399; background:rgba(52,211,153,.1);">
                            <strong>${cap(targetPokemon?.nickname || targetPokemon?.name || '?')}</strong><br>
                            <span style="font-size:11px; opacity:.8;">Nv.${targetPokemon?.level || '?'}</span>
                        </div>
                    </div>
                    <div class="trade-card-actions">
                        ${actionsHtml}
                    </div>
                </div>
            `;
        }
        $tradePendingList.innerHTML = html;

        $tradePendingList.querySelectorAll('.accept-trade').forEach(btn => {
            btn.addEventListener('click', () => acceptPendingTrade(btn.dataset.tradeId, btn.dataset.role || 'receiver'));
        });

        $tradePendingList.querySelectorAll('.deny-trade').forEach(btn => {
            btn.addEventListener('click', () => rejectPendingTrade(btn.dataset.tradeId));
        });
    } catch (e) {
        console.error('Error cargando solicitudes:', e);
        $tradePendingList.innerHTML = '<p class="muted">Error cargando solicitudes.</p>';
    }
}

async function acceptPendingTrade(tradeId, role = 'receiver') {
    try {
        const updated = await window.Supa?.acceptTrade?.(tradeId, role);
        if (!updated) throw new Error('No se pudo aceptar la solicitud');

        const trade = await window.Supa?.getTradeById?.(tradeId);
        if (!trade) throw new Error('Intercambio no encontrado');

        if (trade.receiver_status === 'accepted' && trade.initiator_status === 'accepted') {
            const { data: initiatorBox } = await window.sb
                .from('poke_boxes')
                .select('data')
                .eq('user_id', trade.initiator_id)
                .maybeSingle();

            const { data: targetBox } = await window.sb
                .from('poke_boxes')
                .select('data')
                .eq('user_id', trade.target_user_id)
                .maybeSingle();

            const initiatorData = initiatorBox?.data || { entries: [] };
            const targetData = targetBox?.data || { entries: [] };

            const initiatorPokemon = trade.initiator_pokemon_data || initiatorData.entries?.find(p => p.id === trade.initiator_pokemon_id);
            const targetPokemon = trade.target_pokemon_data || targetData.entries?.find(p => p.id === trade.target_pokemon_id);

            if (!initiatorPokemon || !targetPokemon) {
                throw new Error('Faltan datos de los Pokémon para completar el intercambio');
            }

            initiatorData.entries = (initiatorData.entries || []).filter(p => p.id !== (trade.initiator_pokemon_id || initiatorPokemon.id));
            initiatorData.entries.push(targetPokemon);

            targetData.entries = (targetData.entries || []).filter(p => p.id !== (trade.target_pokemon_id || targetPokemon.id));
            targetData.entries.push(initiatorPokemon);

            await window.Supa?.updateBoxForUser?.(trade.initiator_id, initiatorData);
            await window.Supa?.updateBoxForUser?.(trade.target_user_id, targetData);

            const me = await window.Supa?.getUser?.();
            if (me && me.id === trade.target_user_id) {
                db = db.filter(p => p.id !== trade.target_pokemon_id);
                db.push(initiatorPokemon);
                setDirty(true);
                render();
            }

            await window.Supa?.completeTrade?.(tradeId);
            toast('Intercambio completado', 'success');
        } else {
            toast('Aceptaste la solicitud. Esperando confirmación de la otra parte.', 'info');
        }

        loadPendingTrades();
    } catch (e) {
        toast('Error procesando aceptación: ' + e.message, 'error');
    }
}

async function rejectPendingTrade(tradeId) {
    try {
        await window.Supa?.rejectTrade?.(tradeId);
        toast('Intercambio rechazado', 'info');
        loadPendingTrades();
    } catch (e) {
        toast('Error rechazando intercambio: ' + e.message, 'error');
    }
}
