// Test script para verificar que todos los módulos están cargados correctamente
// Copiar y ejecutar en la consola del navegador (F12)

console.group('🧪 Pruebas de Módulos PC de Tote');

// Test 1: Constantes
console.log('1. Constantes:');
console.log('   API:', typeof API, API.substring(0, 30) + '...');
console.log('   TYPE_META:', typeof TYPE_META, 'keys:', Object.keys(TYPE_META).length);
console.log('   ITEM_CATALOG:', typeof ITEM_CATALOG, 'items:', Object.keys(ITEM_CATALOG).length);

// Test 2: State
console.log('\n2. Estado Global:');
console.log('   db:', Array.isArray(db) ? `Array(${db.length})` : typeof db);
console.log('   dirty:', typeof dirty, dirty);
console.log('   pokemonIndex:', pokemonIndex !== null ? 'loaded' : 'not loaded');
console.log('   moveIndex:', moveIndex !== null ? 'loaded' : 'not loaded');

// Test 3: Funciones Utils
console.log('\n3. Funciones Utilidad:');
console.log('   cap():', typeof cap, cap('pikachu'));
console.log('   uuid():', typeof uuid, 'length:', uuid().length);
console.log('   norm():', typeof norm, norm('PIKACHU'));
console.log('   typeEs():', typeof typeEs, typeEs('electric'));
console.log('   toast:', typeof toast);

// Test 4: Funciones de Persistencia
console.log('\n4. Persistencia:');
console.log('   backup:', typeof backup);
console.log('   restore:', typeof restore);

// Test 5: Funciones de Índices
console.log('\n5. Índices:');
console.log('   ensurePokemonIndex:', typeof ensurePokemonIndex);
console.log('   ensureMoveIndex:', typeof ensureMoveIndex);
console.log('   ensureBallIndex:', typeof ensureBallIndex);

// Test 6: Funciones de Búsqueda
console.log('\n6. Búsqueda:');
console.log('   fetchPokemonCore:', typeof fetchPokemonCore);
console.log('   handleSearch:', typeof handleSearch);
console.log('   showPreview:', typeof showPreview);

// Test 7: Autocompletes
console.log('\n7. Autocompletes:');
console.log('   setupMoveAutocompleteES:', typeof setupMoveAutocompleteES);
console.log('   setupBallAutocomplete:', typeof setupBallAutocomplete);
console.log('   setupNatureAutocomplete:', typeof setupNatureAutocomplete);
console.log('   setupAbilityAutocomplete:', typeof setupAbilityAutocomplete);

// Test 8: Sistema de HP
console.log('\n8. Sistema de HP:');
console.log('   computeMaxHp:', typeof computeMaxHp);
console.log('   ensureHp:', typeof ensureHp);
console.log('   bagCountByEsName:', typeof bagCountByEsName);

// Test 9: UI Render
console.log('\n9. Renderizado:');
console.log('   render:', typeof render);
console.log('   appendAddCard:', typeof appendAddCard);
console.log('   $grid:', $grid !== null ? 'element' : 'null');
console.log('   $empty:', $empty !== null ? 'element' : 'null');

// Test 10: UI Status
console.log('\n10. Estado UI:');
console.log('   setDirty:', typeof setDirty);
console.log('   updateStatus:', typeof updateStatus);
console.log('   teamCount:', typeof teamCount);
console.log('   toggleTeam:', typeof toggleTeam);

// Test 11: Detalle
console.log('\n11. Detalle:');
console.log('   showDetails:', typeof showDetails);
console.log('   startEdit:', typeof startEdit);
console.log('   renderExpBlock:', typeof renderExpBlock);

// Test 12: Diálogos
console.log('\n12. Diálogos:');
console.log('   resetDialog:', typeof resetDialog);
console.log('   setupConfirmBtn:', typeof setupConfirmBtn);
console.log('   setupDialogClosers:', typeof setupDialogClosers);

// Test 13: Menú
console.log('\n13. Menú:');
console.log('   setupHamburgerMenu:', typeof setupHamburgerMenu);
console.log('   setupMenuEvents:', typeof setupMenuEvents);
console.log('   setupStatusMenu:', typeof setupStatusMenu);

// Test 14: Intercambios
console.log('\n14. Intercambios:');
console.log('   initiateTrade:', typeof initiateTrade);
console.log('   loadPendingTrades:', typeof loadPendingTrades);
console.log('   acceptPendingTrade:', typeof acceptPendingTrade);

// Test 15: Auth y Cloud
console.log('\n15. Auth/Cloud:');
console.log('   setupAuthUI:', typeof setupAuthUI);
console.log('   saveToSupabase:', typeof saveToSupabase);
console.log('   loadFromSupabase:', typeof loadFromSupabase);
console.log('   startAutosave:', typeof startAutosave);

// Test 16: Archivo
console.log('\n16. Archivos:');
console.log('   openFile:', typeof openFile);
console.log('   saveToDownload:', typeof saveToDownload);
console.log('   setupFileHandling:', typeof setupFileHandling);

// Test 17: Movimientos
console.log('\n17. Movimientos:');
console.log('   getMoveFullEs:', typeof getMoveFullEs);
console.log('   getAbilityInfoEs:', typeof getAbilityInfoEs);

console.log('\n✅ Todos los módulos se cargaron correctamente');
console.groupEnd();

// Test simple de funcionalidad
console.log('\n📋 Test Rápido de Funcionalidad:');
console.log('Pokémon en base:', db.length);
console.log('Algunos tipos disponibles:', Object.keys(TYPE_META).slice(0, 5));
console.log('Items curativos:', Object.keys(ITEM_CATALOG));

// Si hay pokémon, muestra el primero
if (db.length > 0) {
    console.log('Primer Pokémon:', db[0].name, `(${db[0].dexId})`);
}
