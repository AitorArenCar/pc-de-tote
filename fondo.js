// === background.js ===
const LS_BG = 'pokebox_bg_v1';

const $bgInput    = document.getElementById('bgInput');
const $bgBtn      = document.getElementById('bgBtn');
const $bgClearBtn = document.getElementById('bgClearBtn');
const DEFAULT_BG = 'images/fondo-default.png';


function applyBackground(dataUrlOrNone) {
  // Si no llega nada o es 'none', usa el fondo por defecto del proyecto
  const url = (dataUrlOrNone && dataUrlOrNone !== 'none') ? dataUrlOrNone : DEFAULT_BG;
  document.documentElement.style.setProperty('--app-bg-image', `url('${url}')`);
}

function loadBackgroundFromStorage() {
  try {
    const dataUrl = localStorage.getItem(LS_BG); // puede ser null
    applyBackground(dataUrl); // si es null, apply usará DEFAULT_BG
  } catch {
    applyBackground(null); // asegúrate de pintar el default
  }
}


// function setBackgroundFromFile(file) {
//   if (!file) return;
//   const reader = new FileReader();
//   reader.onload = () => {
//     const dataUrl = reader.result;
//     try { localStorage.setItem(LS_BG, dataUrl); } catch {}
//     applyBackground(dataUrl);
//   };
//   reader.readAsDataURL(file);
// }

function setBackgroundFromFile(file) {
  if (!file) return;

  // Si hay Supabase y usuario, sube al bucket y guarda la URL
  (async () => {
    try {
      const user = await window.Supa?.getUser?.();
      if (user) {
        const url = await window.Supa.uploadBg(file);
        try { localStorage.setItem(LS_BG, url); } catch {}
        applyBackground(url);
        return;
      }
    } catch (e) {
      console.warn('No se pudo subir a Supabase (se usará base64 local):', e);
    }

    // Fallback: dataURL en localStorage (como antes)
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      try { localStorage.setItem(LS_BG, dataUrl); } catch {}
      applyBackground(dataUrl);
    };
    reader.readAsDataURL(file);
  })();
}


function clearBackground() {
  try { localStorage.removeItem(LS_BG); } catch {}
  applyBackground(null); // vuelve al default
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

window.applyBackgroundFromJson = (maybeUrl) => {
  // Si el JSON trae fondo, lo guardamos y aplicamos; si no, caemos al default/LS
  if (maybeUrl && maybeUrl.trim() !== '') {
    try { localStorage.setItem(LS_BG, maybeUrl); } catch {}
    applyBackground(maybeUrl);
  } else {
    loadBackgroundFromStorage(); // usará lo guardado o el default
  }
};

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
