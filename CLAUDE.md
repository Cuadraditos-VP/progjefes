# Programación Jefes — notas para Claude

App web (PWA) de la programación mensual de turnos de los **jefes**. Todo está en
`index.html` (HTML + CSS + JS, sin build). Los turnos de cada mes vienen de
`<mes>-<año>.json` y de lo que publica el admin en Firebase; lo compartido en vivo va por Firebase.

## Regla de oro: hay una app gemela
Esta app tiene una gemela casi idéntica para los **cajeros**: `Cuadraditos-VP/CAJEROS`.
**Casi todo cambio va en las dos.** Si la sesión no tiene el otro repo, agregalo con
`add_repo` y aplicá el mismo cambio. Las diferencias reales están más abajo.

## Cómo trabaja el dueño (Guillermo, admin)
- Habla en español rioplatense y no es programador: respuestas cortas y claras, sin jerga.
- Pide cambios por chat; se implementan, se prueban y se publican.
- **Publicar** = commit en la rama de trabajo → PR → fusionar a `main`. Confirmar con
  Guillermo antes de fusionar (suele alcanzar con que responda "dale"). GitHub Pages sirve
  `main`; los celulares toman la versión nueva al abrir la app o con la recarga automática
  cada 20 minutos.
- **Cambios visuales dudosos**: mostrarle antes una captura (Playwright) y esperar su OK.
- **Cambios que necesitan reglas nuevas de Firebase**: NO fusionar hasta que él las pegue.
  Pedirle sus reglas actuales y devolvérselas completas con el bloque nuevo (prefiere no
  editarlas él). Después se puede verificar desde afuera con la API REST (usuario anónimo).

## Antes de publicar: correr las pruebas
```
node pruebas/correr.js
```
Abre varios "celulares" con un Firebase falso compartido (`pruebas/firebase-falso.js` +
`pruebas/backend.js`, que aplica la misma regla de permisos de `propios_*`) y recorre:
Cambios (pedido con varias opciones, respuestas, acuerdo, avisos), fila propia publicada vs.
filas ajenas privadas, descarte del admin con aviso, que el admin publique turnos, celda del
franco ofrecido y que no haya errores de JavaScript. Si agregás algo importante, sumale una
prueba (y copiala a la gemela). `pruebas/` es igual en las dos apps: mantenelo igual.

## Conceptos de la app
- **¿Quién sos?**: cada celular elige su nombre una vez (`localStorage` `jefYo`) y se reserva
  en `legajos_jefes` (un celular por legajo). Solo el admin lo puede cambiar.
- **Fila propia vs. ajena**: cualquiera puede cambiar cualquier fila en su celular, pero solo
  lo de **su propia fila** se publica para todos (colección `propios_jefes`, doc
  `<mes>_<legajo>`, días como `d0`, `d1`…). Lo de filas ajenas queda solo en ese celular.
  Lo publicado por el usuario manda sobre lo oficial (incluso sobre lo que publique el admin);
  el admin puede descartarlo y al usuario le llega un aviso.
- **Cambios** (pedidos de cambio de turno, `pedidos_jefes`): quien pide da su turno de ese
  día y marca lo que **acepta** (`acepta`: uno o varios turnos, `"*"` = cualquiera, o `F`
  ofreciendo sus francos en `francos`). Otros responden "Me sirve"; quien pidió confirma y
  queda un acuerdo (`estado: "acordado"`). Cada celular carga solo su propia fila del acuerdo.
  En la grilla: arriba lo que da, abajo lo que busca ("Busca" si es una sola cosa, "Acepta"
  si son varias). En el día del franco ofrecido, abajo dice "F el N".
- **Avisos** ("Novedades de tus cambios"): interesados en tu pedido, confirmación, pedido
  cerrado con otro, admin lo pasó a lo oficial, admin descartó tu cambio.
- **CJ** (vista del admin): los cambios que manda cada celular (colección `cj`), incluidos
  los de filas ajenas.
- Colores de celdas: ámbar = cambio solo en este celular; azul = publicado.

## Diferencias con la gemela (cajeros)
- En jefes el admin **sí** publica turnos con ⬆ Publicar (colección `jefes`, un doc por mes
  con `people`, `colores`, `changedAt`…). En cajeros solo publica colores.
- Colección de CJ: `cj` (en cajeros es `cj_cajeros`). No hay `server.js` (las pruebas traen
  su propio servidor).

## Detalles técnicos útiles
- Firebase: Firestore + Auth (anónimo para los celulares, Google para el admin). Admin =
  guillermo.nemaric@gmail.com. Las reglas viven en la consola de Firebase (no en el repo);
  `REGLAS-FIREBASE-*.md` tiene los bloques que se agregaron.
- `sw.js`: primero intenta internet y si no hay, usa la copia guardada (no hace falta cambiar
  la versión de la caché para publicar).
- Al escribir en Firestore, actualizar solo los campos propios (ej. `respuestas.<legajo>`)
  para que dos celulares que escriben a la vez no se pisen.
