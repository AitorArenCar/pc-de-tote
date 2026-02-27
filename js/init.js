/**
 * Inicialización principal de la aplicación
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar referencias DOM
    $grid = document.getElementById('grid');
    $empty = document.getElementById('empty');
    $dialog = document.getElementById('addDialog');
    $closeDialog = document.getElementById('closeDialog');
    $detailDialog = document.getElementById('detailDialog');
    $teamDialog = document.getElementById('teamDialog');
    $tradeInitDialog = document.getElementById('tradeInitDialog');
    $tradePendingDialog = document.getElementById('tradePendingDialog');
    $authDialog = document.getElementById('authDialog');
    $sideMenu = document.getElementById('sideMenu');
    $hamburgerBtn = document.getElementById('hamburgerBtn');
    $menuOverlay = document.getElementById('menuOverlay');
    $statusBtn = document.getElementById('statusBtn');
    $statusMenu = document.getElementById('statusMenu');
    $cloudBtn = document.getElementById('cloudBtn');
    $cloudMenu = document.getElementById('cloudMenu');

    $addBtn = document.getElementById('addBtn');
    $teamBtn = document.getElementById('teamBtn');
    $confirm = document.getElementById('confirmBtn');
    $extra = document.getElementById('extraFields');
    $query = document.getElementById('query');
    $searchBtn = document.getElementById('searchBtn');
    $feedback = document.getElementById('feedback');
    $matches = document.getElementById('matches');
    $result = document.getElementById('searchResult');

    const $closeDetail = document.getElementById('closeDetail');
    if ($closeDetail) {
        $closeDetail.addEventListener('click', () => {
            const t = document.querySelector('.ability-tooltip');
            if (t) t.remove();
            $detailDialog.close();
        });
    }

    const $closeTeam = document.getElementById('closeTeam');
    if ($closeTeam) {
        $closeTeam.addEventListener('click', () => $teamDialog.close());
    }

    // Inicializar autocompletes
    try { setupMoveAutocompleteES(); } catch (e) { console.error('setupMoveAutocompleteES()', e); }
    try { setupNatureAutocomplete(); } catch (e) { console.error('setupNatureAutocomplete()', e); }
    try { setupBallAutocomplete(); } catch (e) { console.error('setupBallAutocomplete()', e); }
    try { setupAbilityAutocomplete(); setupHeldItemAutocomplete(); } catch (e) { console.error('setupAbilityAutocomplete()', e); }

    // Inicializar mochila
    try {
        window.Bag?.init?.();
        window.Bag?.onChange?.(() => { setDirty(true); });
    } catch (e) { console.error('Bag init/onChange', e); }

    // Inicializar UI
    updateStatus();
    updateCloudStatus();
    updateTeamBtnLabel();

    // Menú hamburguesa
    setupHamburgerMenu();
    setupMenuEvents();
    setupStatusMenu();
    setupCloudMenu();

    // Diálogos y confirmar
    setupConfirmBtn();
    setupDialogClosers();

    // Eventos de búsqueda
    $searchBtn?.addEventListener('click', handleSearch);
    $query?.addEventListener('input', () => {
        clearTimeout($query._t);
        $query._t = setTimeout(handleSearch, 200);
    });
    $query?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleSearch();
    });

    // Eventos de equipo
    if ($teamBtn) {
        $teamBtn.addEventListener('click', showTeamList);
    }

    // Cerrar diálogo
    $closeDialog?.addEventListener('click', () => $dialog.close());

    // Eventos de archivos
    setupFileHandling();
    setupFileMenuEvents();

    // Autenticación
    setupAuthUI();
    setupAuthDialogUI();
    setupAuthStateListener();

    // Cloud
    setupCloudButtons();

    // Intercambios
    setupTradeEvents();
    setupTradesSubscription();

    // Evento de EXP en el detalle
    document.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.exp-add-btn');
        if (addBtn) {
            const box = addBtn.closest('.exp-box');
            const pid = box?.getAttribute('data-pid');
            const input = box?.querySelector('.exp-add');
            const delta = Number(input?.value || 1);
            const p = window.POKE_INDEX.get(pid);
            if (!p) return;

            grantExp(p, delta);
            updateExpUI(pid, p);
            return;
        }

        const lvlBtn = e.target.closest('.exp-lvlup-btn');
        if (lvlBtn) {
            const box = lvlBtn.closest('.exp-box');
            const pid = box?.getAttribute('data-pid');
            const p = window.POKE_INDEX.get(pid);
            if (!p) return;

            grantExp(p, (p.expMax || 10));
            updateExpUI(pid, p);
        }
    });

    // Restaurar datos
    await restore();
    updateStatus();

    // Cambiar fondo
    const $shinyToggle = document.getElementById('shinyToggle');
    if ($shinyToggle) {
        $shinyToggle.addEventListener('change', renderPendingPreview);
    }
});
