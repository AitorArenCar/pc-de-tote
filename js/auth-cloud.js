/**
 * Autenticación, sincronización inmediata y backups con Supabase.
 */

function setupAuthUI() {
    const $email = document.getElementById('emailInput');
    const $pass = document.getElementById('passInput');
    const $signup = document.getElementById('signupBtn');
    const $signin = document.getElementById('signinBtn');
    const $signout = document.getElementById('signoutBtn');
    const $authStatus = document.getElementById('authStatus');

    function setAuthUi(logged, email) {
        if ($signup) $signup.hidden = logged;
        if ($signin) $signin.hidden = logged;
        if ($signout) $signout.hidden = !logged;
        if ($email) $email.hidden = logged;
        if ($pass) $pass.hidden = logged;
        if ($authStatus) $authStatus.textContent = logged ? `Conectado: ${email || ''}` : 'Sin sesión';
    }

    (async () => {
        try {
            const usr = await window.Supa?.getUser?.();
            setAuthUi(!!usr, usr?.email);
        } catch {
            setAuthUi(false, '');
        }
    })();

    $signup?.addEventListener('click', async () => {
        try {
            const email = $email?.value;
            const pass = $pass?.value;
            await window.Supa.signUp(email, pass);
            alert('Registro iniciado. Verifica el email si tu proyecto lo requiere.');
        } catch (e) {
            alert(e.message);
        }
    });

    $signin?.addEventListener('click', async () => {
        try {
            const email = $email?.value;
            await window.Supa.signIn(email, $pass?.value);
            setAuthUi(true, email);
            await initializeCloudSyncAfterRestore();
            toast('Sesión iniciada', 'info');
        } catch (e) {
            alert(e.message);
        }
    });

    $signout?.addEventListener('click', async () => {
        try {
            await window.Supa.signOut();
            await stopAutosave();
            setAuthUi(false, '');
        } catch (e) {
            alert(e.message);
        }
    });
}

function setupAuthDialogUI() {
    const $authDialog = document.getElementById('authDialog');
    const $authEmail = document.getElementById('authEmail');
    const $authPass = document.getElementById('authPass');
    const $authIn = document.getElementById('authSignin');
    const $authUp = document.getElementById('authSignup');
    const $authClose = document.getElementById('closeAuth');

    $authClose?.addEventListener('click', () => $authDialog.close());

    $authIn?.addEventListener('click', async () => {
        try {
            await window.Supa.signIn($authEmail.value, $authPass.value);
            __cloudEmail = $authEmail.value || '';
            await initializeCloudSyncAfterRestore();
            updateCloudStatus();
            $authDialog.close();
            toast('Sesión iniciada', 'info');
        } catch (e) {
            alert(e.message);
        }
    });

    $authUp?.addEventListener('click', async () => {
        try {
            await window.Supa.signUp($authEmail.value, $authPass.value);
            alert('Registro iniciado. Verifica el email si tu proyecto lo requiere.');
        } catch (e) {
            alert(e.message);
        }
    });
}

function setupAuthStateListener() {
    try {
        window.sb?.auth?.onAuthStateChange(async (_event, session) => {
            __isLoggedIn = !!session?.user;
            __cloudEmail = session?.user?.email || '';
            if (!__isLoggedIn) await stopAutosave();
            updateCloudStatus();
        });
    } catch { }

    (async () => {
        try {
            const usr = await window.Supa?.getUser?.();
            __isLoggedIn = !!usr;
            __cloudEmail = usr?.email || '';
            updateCloudStatus();
        } catch { }
    })();
}

function hasBagData(bagState) {
    const pockets = bagState?.pockets || {};
    return Object.values(pockets).some(dict => Object.keys(dict || {}).length > 0);
}

function hasLocalSyncData() {
    const bg = window.getBackgroundDataUrl?.() || null;
    const bagState = window.Bag?.getState?.() || null;
    return !!(db.length || bg || hasBagData(bagState));
}

function getCloudRowTime(row) {
    return row?.data?.updatedAt || row?.updated_at || '';
}

function rememberCloudRow(row) {
    if (!row) return;
    __lastCloudUpdatedAt = getCloudRowTime(row);
    __lastCloudRevision = Number(row.data?.revision || __lastCloudRevision || 0);
    backup();
}

async function serializeAppState() {
    let bg = (window.getBackgroundDataUrl && window.getBackgroundDataUrl()) || null;
    if (bg && bg.startsWith('data:')) {
        const res = await fetch(bg);
        const blob = await res.blob();
        const file = new File([blob], 'background.png', { type: blob.type || 'image/png' });
        try {
            const url = await window.Supa.uploadBg(file);
            bg = url;
            window.setBackgroundDataUrl?.(url, { silent: true });
        } catch (e) {
            console.warn('No se pudo subir base64 a Storage. Se guarda base64 en la DB:', e);
        }
    }

    const now = new Date().toISOString();
    return {
        version: 3,
        revision: Number(__lastCloudRevision || 0) + 1,
        deviceId: __deviceId,
        updatedAt: now,
        entries: db,
        bg,
        bag: window.Bag?.getState?.() || null
    };
}

function applyAppState(data, { silent = false } = {}) {
    if (!data || typeof data !== 'object') return;

    __applyingRemoteSync = true;
    try {
        if (Array.isArray(data.entries)) {
            db = data.entries.map(p => ({
                id: p.id || uuid(),
                inTeam: !!p.inTeam,
                ...p,
                shiny: !!p.shiny,
                spriteShiny: p.spriteShiny || p.sprite_shiny || ''
            }));
        }

        if ('bg' in data && typeof window.setBackgroundDataUrl === 'function') {
            window.setBackgroundDataUrl(data.bg || null, { silent: true });
        }

        if (data.bag && typeof data.bag === 'object') {
            try {
                window.Bag?.setState?.(data.bag, { silent: true });
            } catch { }
        }

        __lastCloudRevision = Number(data.revision || __lastCloudRevision || 0);
        __lastCloudUpdatedAt = data.updatedAt || __lastCloudUpdatedAt || '';
        __lastLocalChangeAt = '';

        render();
        updateStatus();
        updateTeamBtnLabel();
        updateCloudStatus();
        setDirty(false);
        backup();
        if (!silent) toast('Datos actualizados desde otro dispositivo', 'info');
    } finally {
        __applyingRemoteSync = false;
    }
}

function queueCloudSync() {
    if (!__isLoggedIn || !__syncReady || __applyingRemoteSync) return;
    clearTimeout(__syncDebounceTimer);
    __syncDebounceTimer = setTimeout(() => {
        saveToSupabase({ reason: 'auto' }).catch(() => {});
    }, CLOUD_SYNC_DEBOUNCE_MS);
}

async function saveToSupabase({ manual = false, reason = 'manual' } = {}) {
    if (!__isLoggedIn && !(await window.Supa?.getUser?.())) {
        if (manual) $authDialog?.showModal?.();
        return;
    }
    if (__autosaveInFlight) return;
    clearTimeout(__syncDebounceTimer);
    __syncDebounceTimer = null;

    const savingLocalChangeAt = __lastLocalChangeAt;
    __autosaveInFlight = true;
    try {
        const payload = await serializeAppState();
        const row = await window.Supa.saveBox(payload, 'Mi caja');
        rememberCloudRow(row);

        if (!__lastLocalChangeAt || __lastLocalChangeAt === savingLocalChangeAt) {
            __lastLocalChangeAt = '';
            setDirty(false);
        } else {
            queueCloudSync();
        }

        updateCloudStatus();
        if (manual) toast(reason === 'backup' ? 'Copia guardada' : 'Datos sincronizados', 'success');
        return row;
    } catch (e) {
        console.warn('[cloud-sync] fallo guardando:', e);
        toast('Error al sincronizar: ' + (e?.message || e), 'error', 4000);
        throw e;
    } finally {
        __autosaveInFlight = false;
    }
}

async function loadFromSupabase({ silent = false } = {}) {
    try {
        const row = await window.Supa.loadBox();
        if (!row) {
            if (!silent) alert('Aún no tienes datos guardados.');
            return null;
        }
        rememberCloudRow(row);
        applyAppState(row.data || {}, { silent });
        if (!silent) alert('Datos cargados de la nube.');
        return row;
    } catch (e) {
        alert('Error al cargar de la nube: ' + e.message);
        return null;
    }
}

async function syncOnLogin() {
    const row = await window.Supa.loadBox();
    if (row) rememberCloudRow(row);

    await maybeCreateDailyBackup(row?.data || null);

    if (!row) {
        if (hasLocalSyncData()) await saveToSupabase({ reason: 'login' });
        return;
    }

    const cloudTime = getCloudRowTime(row);
    const localIsNewer = __lastLocalChangeAt && (!cloudTime || new Date(__lastLocalChangeAt) > new Date(cloudTime));

    if (dirty || localIsNewer) {
        await saveToSupabase({ reason: 'login' });
        return;
    }

    applyAppState(row.data || {}, { silent: true });
}

async function subscribeOwnBox() {
    if (__boxSubscription) return;
    try {
        __boxSubscription = await window.Supa.subscribeBoxChanges((payload) => {
            const row = payload.new || payload.old;
            const data = row?.data;
            if (!data || data.deviceId === __deviceId) return;

            const remoteRevision = Number(data.revision || 0);
            const remoteTime = data.updatedAt || row?.updated_at || '';
            const isNewerRevision = remoteRevision && remoteRevision > Number(__lastCloudRevision || 0);
            const isNewerTime = remoteTime && (!__lastCloudUpdatedAt || new Date(remoteTime) > new Date(__lastCloudUpdatedAt));

            if (isNewerRevision || isNewerTime) {
                applyAppState(data);
            }
        });
    } catch (e) {
        console.warn('[cloud-sync] no se pudo abrir Realtime:', e);
    }
}

async function initializeCloudSyncAfterRestore() {
    if (__syncInitializing) return;
    __syncInitializing = true;
    try {
        const usr = await window.Supa?.getUser?.();
        __isLoggedIn = !!usr;
        __cloudEmail = usr?.email || '';
        if (!usr) {
            updateCloudStatus();
            return;
        }

        __syncReady = true;
        await syncOnLogin();
        await subscribeOwnBox();
        await setupTradesSubscription?.();
        await updatePendingTradesBadge?.();
        updateCloudStatus();
    } catch (e) {
        console.warn('[cloud-sync] init falló:', e);
        toast('No se pudo iniciar la sincronización: ' + (e?.message || e), 'error', 4000);
    } finally {
        __syncInitializing = false;
    }
}

function startAutosave() {
    __syncReady = true;
    queueCloudSync();
}

async function stopAutosave() {
    clearTimeout(__syncDebounceTimer);
    __syncDebounceTimer = null;
    __syncReady = false;
    if (__boxSubscription?.unsubscribe) {
        await __boxSubscription.unsubscribe();
    }
    __boxSubscription = null;
}

async function maybeCreateDailyBackup(fallbackData = null) {
    try {
        const user = await window.Supa?.getUser?.();
        if (!user) return;

        const today = new Date().toISOString().slice(0, 10);
        const key = `${user.id}:${today}`;
        if (localStorage.getItem(LS_DAILY_BACKUP) === key) return;

        const payload = fallbackData || await serializeAppState();
        await window.Supa.createBoxBackup(payload, 'daily-login');
        localStorage.setItem(LS_DAILY_BACKUP, key);
    } catch (e) {
        console.warn('[backup] no se pudo crear backup diario:', e);
    }
}

async function createManualBackup() {
    try {
        if (!__isLoggedIn && !(await window.Supa?.getUser?.())) {
            $authDialog?.showModal?.();
            return;
        }
        const payload = await serializeAppState();
        await window.Supa.createBoxBackup(payload, 'manual');
        toast('Copia de seguridad creada', 'success');
    } catch (e) {
        toast('No se pudo crear la copia: ' + (e?.message || e), 'error', 5000);
    }
}

async function restoreBackupFromCloud() {
    try {
        if (!__isLoggedIn && !(await window.Supa?.getUser?.())) {
            $authDialog?.showModal?.();
            return;
        }

        const backups = await window.Supa.listBoxBackups(20);
        if (!backups.length) {
            alert('No hay copias de seguridad guardadas.');
            return;
        }

        const lines = backups.map((b, i) => {
            const date = new Date(b.created_at).toLocaleString('es-ES');
            return `${i + 1}. ${date} (${b.reason || 'backup'})`;
        });
        const picked = prompt(`Elige la copia a restaurar:\n\n${lines.join('\n')}`);
        if (picked === null) return;

        const index = Number(picked) - 1;
        const backupRow = backups[index];
        if (!backupRow?.data) {
            alert('Selección no válida.');
            return;
        }

        const currentRevision = Number(__lastCloudRevision || 0);
        applyAppState(backupRow.data, { silent: true });
        __lastCloudRevision = Math.max(currentRevision, Number(__lastCloudRevision || 0));
        __lastLocalChangeAt = new Date().toISOString();
        setDirty(true);
        await saveToSupabase({ manual: true, reason: 'restore-backup' });
        toast('Copia restaurada y sincronizada', 'success');
    } catch (e) {
        toast('No se pudo restaurar la copia: ' + (e?.message || e), 'error', 5000);
    }
}

window.addEventListener('beforeunload', (e) => {
    if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty && __isLoggedIn) {
        clearTimeout(__syncDebounceTimer);
        saveToSupabase({ reason: 'hidden' }).catch(() => {});
    }
});

function setupCloudButtons() {
    const $cloudSave = document.getElementById('cloudMenuSave');
    const $cloudLoad = document.getElementById('cloudMenuLoad');
    const $cloudBackup = document.getElementById('cloudMenuBackup');
    const $cloudRestoreBackup = document.getElementById('cloudMenuRestoreBackup');
    const $cloudOut = document.getElementById('cloudMenuSignout');

    $cloudSave?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        await saveToSupabase({ manual: true });
        updateCloudStatus();
    });

    $cloudLoad?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        await loadFromSupabase();
        updateCloudStatus();
    });

    $cloudBackup?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        await createManualBackup();
    });

    $cloudRestoreBackup?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        await restoreBackupFromCloud();
    });

    $cloudOut?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        try {
            await window.Supa?.signOut?.();
        } catch { }
        __cloudEmail = '';
        await stopAutosave();
        updateCloudStatus();
    });
}
