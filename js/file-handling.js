/**
 * Guardado y carga de archivos
 */

function openFile() {
    const $openInput = document.getElementById('openInput');
    $openInput?.click();
}

function setupFileHandling() {
    const $openInput = document.getElementById('openInput');
    const $bgInput = document.getElementById('bgInput');

    $openInput?.addEventListener('change', (ev) => {
        const file = ev.target.files[0];
        if (!file) return;

        currentFileName = file.name;
        try {
            localStorage.setItem(LS_NAME, currentFileName);
        } catch { }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);

                if (Array.isArray(data)) {
                    db = data.map(p => ({ id: p.id || uuid(), ...p }));
                } else if (data && Array.isArray(data.entries)) {
                    db = data.entries.map(p => ({ id: p.id || uuid(), ...p }));

                    if (data.bg && typeof window.applyBackground === 'function' && typeof window.setBackgroundDataUrl === 'function') {
                        window.setBackgroundDataUrl(data.bg);
                    }

                    if (data.bag && typeof data.bag === 'object') {
                        try {
                            window.Bag?.setState?.(data.bag);
                        } catch { }
                    }
                } else {
                    throw new Error('Formato inválido: se esperaba un array o un objeto {entries, bg, bag}.');
                }

                setDirty(false);
                render();
                updateStatus();
                backup();
            } catch (err) {
                alert('Error al abrir: ' + err.message);
            }
        };
        reader.readAsText(file);

        ev.target.value = '';
    });

    $bgInput?.addEventListener('change', (ev) => {
        const file = ev.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                if (typeof window.setBackgroundDataUrl === 'function') {
                    window.setBackgroundDataUrl(reader.result);
                    setDirty(true);
                }
            } catch (err) {
                alert('Error al cargar fondo: ' + err.message);
            }
        };
        reader.readAsDataURL(file);

        ev.target.value = '';
    });
}

function saveToDownload() {
    const suggested = currentFileName || 'pokebox.json';
    let name = prompt('Nombre del archivo a guardar:', suggested);
    if (name === null) return;
    name = (name || '').trim();
    if (!name) return;
    if (!name.toLowerCase().endsWith('.json')) name += '.json';

    const bg = (window.getBackgroundDataUrl && window.getBackgroundDataUrl()) || null;
    const bagState = window.Bag?.getState?.() || null;

    const payload = { version: 2, entries: db, bg, bag: bagState };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    currentFileName = name;
    setDirty(false);
    updateStatus();
}

// Eventos
function setupFileMenuEvents() {
    const $addBtn = document.getElementById('addBtn');
    const $bagBtn = document.getElementById('bagBtn');
    const $healAllBtn = document.getElementById('healAllBtn');

    if ($bagBtn) {
        $bagBtn.addEventListener('click', () => {
            if (window.Bag?.open) window.Bag.open();
        });
    }

    if ($healAllBtn) {
        $healAllBtn.addEventListener('click', () => {
            db.forEach(p => {
                p.hpCurrent = computeMaxHp(p);
            });
            setDirty(true);
            render();
        });
    }

    if ($addBtn) {
        $addBtn.addEventListener('click', () => {
            editMode = false;
            editingId = null;
            const addTitle = document.querySelector('#addDialog header h2');
            if (addTitle) addTitle.textContent = 'Añadir Pokémon';
            if ($confirm) $confirm.textContent = 'Añadir a mi base';
            resetDialog();
            $dialog.showModal();
            setTimeout(() => $query.focus(), 50);
        });
    }
}
