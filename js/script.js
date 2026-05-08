/**
 * Main script.js - Ensamblador de módulos
 * Carga todos los módulos de la aplicación en orden
 */

// IIFE para mantener el scope global limpio
(() => {
    // Los módulos se cargan en orden mediante tag script en index.html
    // Este archivo actúa como punto de entrada y documentación

    console.log('PC de Tote - Aplicación cargada');
    console.log('Módulos disponibles:');
    console.log('- constants: Constantes globales');
    console.log('- state: Variables de estado');
    console.log('- utils: Funciones auxiliares');
    console.log('- persistence: Guardado y carga');
    console.log('- indexes: Índices de datos');
    console.log('- pokemon-search: Búsqueda de Pokémon');
    console.log('- autocompletes: Autocompletes específicos');
    console.log('- hp-system: Sistema de vida');
    console.log('- ui-render: Renderizado del grid');
    console.log('- ui-status: Estado y equipo');
    console.log('- moves: Movimientos y habilidades');
    console.log('- pokemon-detail: Vista de detalle');
    console.log('- ui-dialogs: Diálogos');
    console.log('- ui-menu: Menú hamburgesa');
    console.log('- trades: Sistema de intercambios');
    console.log('- auth-cloud: Autenticación y nube');
    console.log('- file-handling: Guardado/carga de archivos');
    console.log('- init: Inicialización principal');
})();
