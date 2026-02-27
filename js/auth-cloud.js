/**
 * Autenticación y sincronización con Supabase
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
            const pass = $pass?.value;
            await window.Supa.signIn(email, pass);
            setAuthUi(true, email);
            toast('Sesión iniciada', 'info');
        } catch (e) {
            alert(e.message);
        }
    });

    $signout?.addEventListener('click', async () => {
        try {
            await window.Supa.signOut();
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
            startAutosave?.();
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
            if (__isLoggedIn) startAutosave?.();
            else stopAutosave?.();
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

// Autosave
function startAutosave() {
    if (__autosaveTimer) return;
    __autosaveTimer = setInterval(autosaveTick, AUTOSAVE_EVERY_MS);
    setTimeout(autosaveTick, 5_000);
}

function stopAutosave() {
    if (!__autosaveTimer) return;
    clearInterval(__autosaveTimer);
    __autosaveTimer = null;
}

function canAutosave() {
    return __isLoggedIn && typeof dirty !== 'undefined' && !!dirty;
}

async function autosaveTick() {
    if (!canAutosave()) return;
    if (__autosaveInFlight) return;

    __autosaveInFlight = true;
    try {
        await saveToSupabase();
    } catch (e) {
        console.warn('[autosave] fallo guardando:', e);
    } finally {
        __autosaveInFlight = false;
    }
}

window.addEventListener('beforeunload', (e) => {
    if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') autosaveTick();
});

startAutosave();

async function saveToSupabase() {
    try {
        let bg = (window.getBackgroundDataUrl && window.getBackgroundDataUrl()) || null;
        if (bg && bg.startsWith('data:')) {
            const res = await fetch(bg);
            const blob = await res.blob();
            const file = new File([blob], 'background.png', { type: blob.type || 'image/png' });
            try {
                const url = await window.Supa.uploadBg(file);
                bg = url;
                window.setBackgroundDataUrl?.(url);
            } catch (e) {
                console.warn('No se pudo subir base64 a Storage. Se guarda base64 en la DB:', e);
            }
        }

        const bagState = window.Bag?.getState?.() || null;
        const payload = { version: 2, entries: db, bg, bag: bagState };

        const id = await window.Supa.saveBox(payload, 'Mi caja');
        setDirty(false);
        updateCloudStatus();
        toast('Se ha guardado correctamente', 'success');
    } catch (e) {
        toast('Error al guardar: ' + (e?.message || e), 'error', 4000);
    }
}

async function loadFromSupabase() {
    try {
        const row = await window.Supa.loadBox();
        if (!row) {
            alert('Aún no tienes datos guardados.');
            return;
        }
        const data = row.data || {};

        if (Array.isArray(data.entries)) {
            db = data.entries.map(p => ({
                id: p.id || uuid(),
                inTeam: !!p.inTeam,
                ...p,
                shiny: !!p.shiny,
                spriteShiny: p.spriteShiny || p.sprite_shiny || ''
            }));
        } else {
            db = [];
        }

        if (data.bg && typeof window.applyBackground === 'function' && typeof window.setBackgroundDataUrl === 'function') {
            window.setBackgroundDataUrl(data.bg);
        }

        if (data.bag && typeof data.bag === 'object') {
            try {
                window.Bag?.setState?.(data.bag);
            } catch { }
        }

        render();
        updateStatus();
        updateCloudStatus();
        setDirty(false);
        alert('Datos cargados de la nube.');
    } catch (e) {
        alert('Error al cargar de la nube: ' + e.message);
    }
}

function setupCloudButtons() {
    const $cloudSave = document.getElementById('cloudMenuSave');
    const $cloudLoad = document.getElementById('cloudMenuLoad');
    const $cloudOut = document.getElementById('cloudMenuSignout');

    $cloudSave?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        await saveToSupabase();
        updateCloudStatus();
    });

    $cloudLoad?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        await loadFromSupabase();
        updateCloudStatus();
    });

    $cloudOut?.addEventListener('click', async () => {
        if ($cloudMenu) $cloudMenu.hidden = true;
        if ($cloudBtn) $cloudBtn.setAttribute('aria-expanded', 'false');
        try {
            await window.Supa?.signOut?.();
        } catch { }
        __cloudEmail = '';
        stopAutosave?.();
        updateCloudStatus();
    });
}

// Suscripción realtime a intercambios
async function setupTradesSubscription() {
    try {
        const me = await window.Supa?.getUser?.();
        if (me && window.Supa?.subscribeTrades) {
            const sub = window.Supa.subscribeTrades((payload) => {
                const row = payload.new || payload.record || null;
                if (!row) return;
                if (row.target_user_id === me.id || row.initiator_id === me.id) {
                    loadPendingTrades();
                }
            });

            window.addEventListener('beforeunload', () => sub?.unsubscribe?.());
        }
    } catch (e) {
        console.warn('Realtime trades subscription failed', e);
    }
}
