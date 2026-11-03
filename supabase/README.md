# Intercambios atómicos

El cliente actualizado requiere `migrations/20261103_atomic_trades.sql`. Hasta
aplicarla, las solicitudes y los guardados fallarán sin usar las rutas antiguas.
No se ha aplicado a la base de datos alojada desde este repositorio.

## Aplicación

1. Guarda una copia de las tablas `poke_boxes` y `trades`. Los intercambios ya
   dañados requieren revisión individual; esta migración no intenta reconstruirlos.
2. En el SQL Editor del proyecto Supabase, ejecuta el archivo completo como
   propietario de la base de datos. Todo el archivo se aplica en una transacción.
3. Publica juntos `supabase.js`, `js/auth-cloud.js` y `js/trades.js`, y recarga las
   pestañas abiertas. Los clientes antiguos ya no pueden actualizar cajas ni
   ejecutar las funciones antiguas de intercambio.
4. Comprueba con dos cuentas de prueba: enviar, aceptar, cancelar, repetir una
   aceptación, perder conexión y guardar desde una pestaña con datos antiguos.
   Verifica ambas cajas tras recargar, no solo la notificación de éxito.

La migración usa las columnas que consume el cliente actual y añade los IDs de
caja si faltan. Se ha probado con IDs UUID y datos JSONB en PostgreSQL mediante
PGlite; no se ha inspeccionado el esquema ni las políticas del proyecto alojado.
Conserva las políticas de lectura existentes y comprueba que cada cuenta sigue
pudiendo leer las cajas necesarias para la selección y las suyas tras aceptar.

Si existen triggers activos en `trades`, la migración se detiene deliberadamente
para no ejecutar un intercambio antiguo además del nuevo. Inspecciónalos antes
de adaptar la migración; no los elimines sin comprobar qué hacen:

```sql
select t.tgname, pg_get_triggerdef(t.oid), pg_get_functiondef(t.tgfoid)
from pg_trigger t
where t.tgrelid = 'public.trades'::regclass and not t.tgisinternal;
```

Los guardados usan una revisión esperada bajo bloqueo de fila. Un conflicto
conserva los cambios locales e impide sobrescribir la nube: exporta la caja local
antes de recargar y reconcilia los cambios que quieras conservar. No reimportes
automáticamente una caja anterior al intercambio.

La aceptación bloquea solicitud y cajas, valida usuario, estado, propietarios y
Pokémon, y actualiza las dos cajas y la solicitud en una transacción. Repetir una
solicitud completada devuelve su estado sin mover Pokémon otra vez. Las solicitudes
solapadas se rechazan si sus Pokémon ya no están en las cajas originales.

## Pruebas

Con Node.js:

```sh
node --test tests/trade-safety.test.cjs
```

Para la prueba SQL, instala o extrae `@electric-sql/pglite@0.5.15` fuera del
repositorio y define `PGLITE_PATH` con la carpeta del paquete:

```powershell
$env:PGLITE_PATH = 'C:/ruta/al/paquete/pglite'
node --test tests/trade-database.test.cjs
```

La prueba SQL crea una base de datos efímera, sin conectarse al proyecto Supabase.
Incluye un fallo forzado en la segunda escritura y verifica la reversión de la
primera, reintentos, solicitudes solapadas, permisos y guardados obsoletos. PGlite
no sustituye una prueba de concurrencia con conexiones independientes en staging.

Referencia: [funciones de base de datos y permisos en Supabase](https://supabase.com/docs/guides/database/functions).
