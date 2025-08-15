// === background.js ===
const LS_BG = 'pokebox_bg_v1';

const $bgInput    = document.getElementById('bgInput');
const $bgBtn      = document.getElementById('bgBtn');
const $bgClearBtn = document.getElementById('bgClearBtn');

function applyBackground(dataUrlOrNone) {
  const v = dataUrlOrNone && dataUrlOrNone !== 'none' ? `url('${dataUrlOrNone}')` : 'none';
  document.documentElement.style.setProperty('--app-bg-image', v);
}

function loadBackgroundFromStorage() {
  try {
    const dataUrl = localStorage.getItem(LS_BG) || 'none';
    applyBackground(dataUrl);
  } catch {}
}

function setBackgroundFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    try { localStorage.setItem(LS_BG, dataUrl); } catch {}
    applyBackground(dataUrl);
  };
  reader.readAsDataURL(file);
}

function clearBackground() {
  try { localStorage.removeItem(LS_BG); } catch {}
  applyBackground('none');
}

// Exponer helpers para script.js
window.getBackgroundDataUrl = () => {
  try { return localStorage.getItem(LS_BG) || null; } catch { return null; }
};
window.setBackgroundDataUrl = (dataUrl) => {
  try {
    if (dataUrl) localStorage.setItem(LS_BG, dataUrl);
    else localStorage.removeItem(LS_BG);
  } catch {}
  applyBackground(dataUrl || 'none');
};
window.applyBackground = applyBackground;

// Eventos UI
if ($bgInput) {
  $bgInput.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) setBackgroundFromFile(f);
    e.target.value = '';
  });
}

if ($bgBtn)  { $bgBtn.addEventListener('click', () => $bgInput && $bgInput.click()); }
if ($bgClearBtn) { $bgClearBtn.addEventListener('click', () => setBackgroundDataUrl(null)); }

// Cargar al inicio
loadBackgroundFromStorage();
