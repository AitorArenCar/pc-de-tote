#!/usr/bin/env node
/**
 * Genera pokeapi_item_es_v1.json con nombres en español de items
 * Ejecutar: node generate-item-es-index.js
 */

const fs = require('fs');
const path = require('path');

const API = 'https://pokeapi.co/api/v2';
const INDEX_FILE = path.join(__dirname, 'data/pokeapi_item_index_v1.json');
const OUTPUT_FILE = path.join(__dirname, 'data/pokeapi_item_es_v1.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function idFromUrl(url) {
  const m = url.match(/\/(\d+)\/?$/);
  return m ? m[1] : null;
}

function toEsName(names) {
  const es = names?.find(n => n.language?.name === 'es')?.name;
  const en = names?.find(n => n.language?.name === 'en')?.name;
  return es || en || '';
}

async function generateIndex() {
  console.log('📦 Leyendo índice de items...');
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const results = index.results || [];
  
  console.log(`Found ${results.length} items. Fetching Spanish names...`);

  const esIndex = {};
  let done = 0;

  for (const r of results) {
    const id = idFromUrl(r.url) || r.name;
    if (!id) continue;

    try {
      const item = await fetchJson(`${API}/item/${id}`);
      const nameEs = toEsName(item.names);
      const name = item.name;
      
      esIndex[name] = nameEs || name;
      
      done++;
      if (done % 50 === 0) {
        console.log(`  ${done}/${results.length}`);
      }

      // Rate limit: 15ms entre requests
      await sleep(15);
    } catch (e) {
      console.warn(`  ⚠️  Error en item ${id}:`, e.message);
    }
  }

  console.log(`\n✅ Guardando ${Object.keys(esIndex).length} items en ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(esIndex, null, 2));
  console.log('✅ Listo!');
}

generateIndex().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
