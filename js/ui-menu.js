/**
 * Menú hamburguesa y sidebar
 */

function setupHamburgerMenu() {
    function toggleMenu() {
        const isOpen = !$sideMenu.hidden;
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    function openMenu() {
        $sideMenu.hidden = false;
        $menuOverlay.hidden = false;
        $hamburgerBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        $sideMenu.hidden = true;
        $menuOverlay.hidden = true;
        $hamburgerBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    $hamburgerBtn?.addEventListener('click', toggleMenu);
    $menuOverlay?.addEventListener('click', closeMenu);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$sideMenu.hidden) {
            closeMenu();
        }
    });

    const menuButtons = $sideMenu?.querySelectorAll('.menu-btn') || [];
    menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(closeMenu, 100);
        });
    });
}

function setupMenuEvents() {
    const $sideMenuOpen = document.getElementById('sideMenuOpen');
    const $sideMenuSave = document.getElementById('sideMenuSave');
    const $sideMenuBg = document.getElementById('sideMenuBg');
    const $sideMenuBgClear = document.getElementById('sideMenuBgClear');
    const $sideCloudStatus = document.getElementById('sideCloudStatus');
    const $sideCloudSave = document.getElementById('sideCloudSave');
    const $sideCloudLoad = document.getElementById('sideCloudLoad');
    const $sideCloudSignout = document.getElementById('sideCloudSignout');
    const $sideTradeBtn = document.getElementById('sideTradeBtn');
    const $sidePendingTradesBtn = document.getElementById('sidePendingTradesBtn');

    $sideMenuOpen?.addEventListener('click', () => {
        document.getElementById('openInput')?.click();
    });
    $sideMenuSave?.addEventListener('click', () => {
        if (typeof saveToDownload === 'function') saveToDownload();
    });
    $sideMenuBg?.addEventListener('click', () => {
        document.getElementById('bgInput')?.click();
    });
    $sideMenuBgClear?.addEventListener('click', () => {
        if (typeof window.setBackgroundDataUrl === 'function') window.setBackgroundDataUrl(null);
    });

    $sideTradeBtn?.addEventListener('click', async () => {
        const usr = await window.Supa?.getUser?.();
        if (!usr) {
            toast('Debes iniciar sesión para usar intercambios', 'info');
            $authDialog.showModal();
        } else {
            initiateTrade();
        }
    });

    $sidePendingTradesBtn?.addEventListener('click', async () => {
        const usr = await window.Supa?.getUser?.();
        if (!usr) {
            toast('Debes iniciar sesión para ver solicitudes', 'info');
            $authDialog.showModal();
        } else {
            loadPendingTrades();
            $tradePendingDialog.showModal();
        }
    });

    $sideCloudStatus?.addEventListener('click', async (e) => {
        e.preventDefault();
        const usr = await window.Supa?.getUser?.();
        if (!usr) {
            $authDialog.showModal();
        }
    });

    $sideCloudSave?.addEventListener('click', saveToSupabase);
    $sideCloudLoad?.addEventListener('click', loadFromSupabase);
    $sideCloudSignout?.addEventListener('click', async () => {
        try {
            await window.Supa?.signOut?.();
            __cloudEmail = '';
            stopAutosave?.();
            updateCloudStatus();
        } catch { }
    });
}

function setupStatusMenu() {
    $statusBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !$statusMenu?.hidden;
        $statusMenu.hidden = open;
        $statusBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    document.addEventListener('click', (e) => {
        if ($statusMenu && !$statusMenu.hidden) {
            const within = el => el && (el === e.target || el.contains(e.target));
            if (!within($statusMenu) && !within($statusBtn)) {
                $statusMenu.hidden = true;
                if ($statusBtn) $statusBtn.setAttribute('aria-expanded', 'false');
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && $statusMenu && !$statusMenu.hidden) {
            $statusMenu.hidden = true;
            if ($statusBtn) $statusBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

function setupCloudMenu() {
    $cloudBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const usr = await window.Supa?.getUser?.();
        if (!usr) {
            $authDialog.showModal();
            return;
        }

        const open = !$cloudMenu?.hidden;
        $cloudMenu.hidden = open;
        $cloudBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    document.addEventListener('click', (e) => {
        if ($cloudMenu && !$cloudMenu.hidden) {
            const within = el => el && (el === e.target || el.contains(e.target));
            if (!within($cloudMenu) && !within($cloudBtn)) {
                $cloudMenu.hidden = true;
                $cloudBtn.setAttribute('aria-expanded', 'false');
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && $cloudMenu && !$cloudMenu.hidden) {
            $cloudMenu.hidden = true;
            $cloudBtn.setAttribute('aria-expanded', 'false');
        }
    });
}
