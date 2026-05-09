/**
 * Estado de la aplicación y actualización de UI
 */

function setDirty(v) {
    dirty = v;
    if (v && !__applyingRemoteSync) {
        __lastLocalChangeAt = new Date().toISOString();
    }
    updateStatus();
    backup();
    updateCloudStatus();
    if (v && !__applyingRemoteSync && typeof queueCloudSync === 'function') {
        queueCloudSync();
    }
}

function updateStatus() {
    const text = currentFileName
        ? `${currentFileName}${dirty ? ' • cambios sin guardar' : ''}`
        : `Sin archivo abierto${dirty ? ' • cambios sin guardar' : ''}`;
    if ($statusBtn) {
        $statusBtn.textContent = text;
        $statusBtn.title = text;
    }
}

function updateCloudStatus() {
    const base = __cloudEmail ? `Nube: ${__cloudEmail}` : 'Nube: desconectado';
    const text = dirty ? `${base} • sincronizando cambios` : base;

    if ($cloudBtn) {
        const label = __isLoggedIn ? text : 'Iniciar sesión';
        $cloudBtn.textContent = label;
        $cloudBtn.title = label;
        $cloudBtn.classList.remove('disabled');
    }

    const $sideCloudSection = document.getElementById('sideCloudSection');
    const $sideCloudStatus = document.getElementById('sideCloudStatus');
    if ($sideCloudSection) {
        $sideCloudSection.hidden = !__isLoggedIn;
    }
    if ($sideCloudStatus) {
        const prefix = '☁️ ';
        $sideCloudStatus.textContent = `${prefix}${__cloudEmail ? base : 'Nube'}`;
        $sideCloudStatus.title = base;
        $sideCloudStatus.classList.toggle('disabled', !__isLoggedIn);
    }

    const $sideCloudSave = document.getElementById('sideCloudSave');
    const $sideCloudLoad = document.getElementById('sideCloudLoad');
    const $sideCloudBackup = document.getElementById('sideCloudBackup');
    const $sideCloudRestoreBackup = document.getElementById('sideCloudRestoreBackup');
    const $sideCloudSignout = document.getElementById('sideCloudSignout');
    if ($sideCloudSave) $sideCloudSave.hidden = !__isLoggedIn;
    if ($sideCloudLoad) $sideCloudLoad.hidden = !__isLoggedIn;
    if ($sideCloudBackup) $sideCloudBackup.hidden = !__isLoggedIn;
    if ($sideCloudRestoreBackup) $sideCloudRestoreBackup.hidden = !__isLoggedIn;
    if ($sideCloudSignout) $sideCloudSignout.hidden = !__isLoggedIn;
}

// Equipo

function teamCount() {
    return db.reduce((n, p) => n + (p.inTeam ? 1 : 0), 0);
}

function updateTeamBtnLabel() {
    if (!$teamBtn) return;

    const count = teamCount();
    const label = `Ver equipo (${count})`;
    $teamBtn.title = label;
    $teamBtn.setAttribute('aria-label', label);

    if ($teamBtn.classList.contains('header-icon-btn')) {
        $teamBtn.dataset.count = String(count);
        if (typeof teamIconSVG === 'function') {
            $teamBtn.innerHTML = teamIconSVG(count > 0);
        }
        return;
    }

    $teamBtn.textContent = `Equipo (${count})`;
}

function toggleTeam(p) {
    if (p.inTeam) {
        p.inTeam = false;
        setDirty(true);
        render();
        return;
    }
    if (teamCount() >= 6) {
        alert('Tu equipo ya tiene 6 Pokémon. Quita uno para añadir otro.');
        return;
    }
    p.inTeam = true;
    setDirty(true);
    render();
}

function showTeamList() {
    const $teamContent = document.getElementById('teamContent');
    const team = db.filter(x => x.inTeam).sort((a, b) => a.dexId - b.dexId);

    if (!team.length) {
        $teamContent.innerHTML = `<div class="muted" style="padding:12px">No tienes Pokémon en el equipo todavía.</div>`;
    } else {
        $teamContent.innerHTML = team.map(p => {
            const shinySymbol = p.shiny ? ' ★' : '';
            const sprite = spriteUrlOf(p);
            return `
      <button class="team-item" data-id="${p.id}" title="#${p.dexId}">
        <img src="${sprite}" alt="${p.name}" width="64" height="64" />
        <div class="team-name">${cap(p.name)}${shinySymbol} <span class="muted">#${p.dexId}</span></div>
      </button>
    `;
        }).join('');
    }

    $teamDialog.showModal();

    $teamContent.querySelectorAll('.team-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const pk = db.find(x => x.id === id);
            if (pk) {
                $teamDialog.close();
                showDetails(pk);
            }
        });
    });
}
