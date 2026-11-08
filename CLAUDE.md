# Programación Jefes — notas para Claude

App web (PWA) de la programación mensual de turnos de los **jefes**. Todo está en
`index.html` (HTML + CSS + JS, sin build). Los turnos de cada mes están en Firebase (colección
`jefes`, un doc por mes) y solo los ven los registrados; lo compartido en vivo va por Firebase.
Ya no hay `<mes>-<año>.json` ni semillas con datos en el HTML: **nunca subir datos de empleados
al repo** (es público; el historial viejo todavía los tiene hasta pasarlo a privado).

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
`pruebas/backend.js`, que aplica las mismas reglas de escritura y de **lectura** que Firebase,
con un mes de gente inventada — nunca datos reales en las pruebas) y recorre: registro por legajo y
datos protegidos, Cambios (pedido con varias opciones, respuestas, acuerdo, avisos), fila propia publicada vs.
filas ajenas privadas, descarte del admin con aviso, que el admin publique turnos, celda del
franco ofrecido y que no haya errores de JavaScript. Si agregás algo importante, sumale una
prueba (y copiala a la gemela). `pruebas/` es igual en las dos apps: mantenelo igual.

## Conceptos de la app
- **Datos protegidos**: los turnos (nombres, legajos, licencias) están en Firebase y solo los leen
  los celulares registrados y el admin (lo mismo `pedidos_*` y `propios_*`). Quien no se registró
  ve un cartel y "¿Quién sos?". Registrado = su doc en `yo_jefes` apunta a un legajo reservado a su
  uid en `legajos_jefes`, o a una invitación usada por su uid (`inv-<código>`).
- **¿Quién sos?**: cada celular escribe su **legajo** una vez (`localStorage` `jefYo`); la app busca
  el nombre en `padron_jefes/{legajo}` (Firebase deja leer de a un legajo, no la lista) y lo
  reserva en `legajos_jefes` (un celular por legajo). Solo el admin lo puede cambiar (él ve la lista).
- **iPhone**: Safari y la app instalada en el inicio no comparten nada (para Firebase son dos
  celulares). En Safari de iPhone "¿Quién sos?" explica que primero instalen la app (o "Prefiero
  usarla solo en Safari"); un link de invitación abierto en Safari no se gasta y muestra el código,
  que se escribe en la app con "Tengo un código de invitación". En Celulares, "(app)" = instalada.
  No usar `alert`/`confirm` después de esperar a Firebase (en iPhone a veces no aparecen).
- **Externos**: entran con un link de invitación del admin (Celulares → Invitar, colección
  `invitados_jefes`). No reservan legajo, no tienen fila propia (no publican ni piden cambios).
  `EXTERNOS` en `index.html` quedó vacío (Valeria pasó a invitación).
- **Fila propia vs. ajena**: cualquiera puede cambiar cualquier fila en su celular, pero solo
  lo de **su propia fila** se publica para todos (colección `propios_jefes`, doc
  `<mes>_<legajo>`, días como `d0`, `d1`…). Lo de filas ajenas queda solo en ese celular.
  Lo publicado por el usuario manda sobre lo oficial (incluso sobre lo que publique el admin);
  el admin puede descartarlo y al usuario le llega un aviso.
- **Cambios** (pedidos de cambio de turno, `pedidos_jefes`): quien pide da su turno de ese
  día y marca lo que **acepta** (`acepta`: uno o varios turnos, `"*"` = cualquiera, o `F`
  ofreciendo sus francos en `francos`). Otros responden "Me sirve"; quien pidió confirma y
  queda un acuerdo (`estado: "acordado"`). Cada celular carga solo su propia fila del acuerdo.
  Se ven en el **banco de cambios**: el botón Cambios abre un cuadro (fondo oscuro) con el
  almanaque del mes; cada día muestra cuántas propuestas hay, tu turno, borde verde si alguna te
  sirve y ★ si tenés pedido. Al tocar el día se listan sus propuestas ("Da N · busca/acepta …";
  el día del franco ofrecido dice "busca F el N"); cada una abre el cuadro del pedido
  (`openPedido`), y "＋ Pedir cambio el N" carga uno propio. La grilla ya no muestra pedidos.
  Los cambios vencen el mismo día: hoy y los días pasados quedan grises en el banco (`diaPasado`),
  y los pedidos sin acordar de hoy desaparecen (`pedidoVencido`). El banco arranca en mañana.
  "Acordados" y "Celulares" (admin) y "¿Quién sos?" están arriba de ese cuadro.
- **Avisos** ("Novedades de tus cambios"): interesados en tu pedido, confirmación, pedido
  cerrado con otro, admin lo pasó a lo oficial, admin descartó tu cambio.
- **CJ** (vista del admin): los cambios que manda cada celular (colección `cj`), incluidos
  los de filas ajenas. También suma lo publicado en `propios_*` (aunque ese celular no haya
  mandado nada). Un celular no manda a CJ hasta tener los turnos del mes (si no, lo borraría).
  Al tocar una celda marcada en CJ se abre un cuadro con **de dónde vino** cada dato (qué celular lo
  mandó, según `yo_*`, o si lo publicó el dueño en su fila) y cuándo (`abrirInfoCj`).
  Desde ese cuadro, **Pasar a lo oficial** publica solo esa celda (`pasarCjAOficial`).
  En CJ se distinguen (`CJ_MARKS` = "propio"/"ajeno"): esquinita azul = lo cambió el dueño en su fila (ya lo ven
  todos); borde violeta + esquinita violeta = lo cambió otro celular en una fila ajena (solo en ese celular).
- Al abrir, la app muestra el inicio de la grilla principal (ni el grupo propio ni el almanaque:
  `ABRIR_ALMANAQUE_AL_INICIO = false`).
  Tras la recarga automática de 20 min vuelve a donde estaba (`recargaAutomatica` / `volverAPosicion`).
- Arriba: solo el selector de mes (el título solo si hay un único mes) y un botón con el
  apellido del usuario (`btnMiAlmanaque`) que abre su almanaque; el admin no lo ve.
- Copia de los meses en el celular (cajeros `cajTurnos:<mes>`, jefes `ctFb:<mes>`) para abrir al
  instante y sin internet; solo en registrados/admin y se borra si el admin libera el celular.
- Colores de celdas: ámbar = cambio solo en este celular; azul = publicado.
- **El admin publica cambios de turnos** (ej. acordados de palabra) con ⬆ Publicar: pasan a lo oficial
  (`turnosAPublicar`), con `changedAt["legajo:día"]` = cuándo. Si en esa celda el dueño había publicado otra
  cosa en su fila, avisa y la descarta (`choquesConPropios` → `descartarPropio`, al dueño le llega aviso): manda
  lo del admin. Si después el dueño la vuelve a cambiar, al admin le llega un aviso (`avisosAdmin`, avisos con
  clave "admin"). Siguen en azul para todos porque se comparan con la inicial.
  En cada celular, lo que tenía cargado en esa celda **antes** de la publicación del admin se borra y pasa a ver
  lo del admin (`soltarEditsPisados`, compara la hora del cambio con `changedAt`); si lo cambia después, se respeta.
- **Botón de admin (muñequito)**: solo aparece en dispositivos donde ya se entró como admin
  (`localStorage` `vpFueAdmin`). En cualquier otro se entra manteniendo apretado **Cambios** 3 segundos y soltando.
- Vistas del admin (botón arriba a la izquierda): **A** (lo que ven todos, editable) → **I** (la programación
  inicial del mes, solo lectura) → **CJ**. La vista "O" (oficial) se sacó a pedido de Guillermo.
- **Menú del admin (☰)**: Bajar, los JSON, Colores y ⬆ Publicar están en la ventana del botón ☰, en el celular y
  en la PC (`menuAdmin`; muestra el número de cosas por publicar). El botón "Copiar" se sacó a pedido de Guillermo.
- **División** (rol intermedio entre el admin y los usuarios): el admin la marca en Celulares con la coronita 👑 al lado de Liberar (violeta = es División;
  colección `division_jefes/{legajo o inv-código}`; `soyDivision()`, clase `is-division`). Puede: **autorizar pedidos sin
  contraparte** (en el cuadro del pedido, "Autorizar …": pasa a lo oficial y el pedido queda `estado: "autorizado"` con `por`;
  al que pidió le llega "Autorizado por la División — Nombre"), **pasar acordados a lo oficial** (Acordados → "Pasar a lo
  oficial", queda `pasado` + `pasadoPor`). **No publica cambios por su cuenta** (a pedido de Guillermo: solo avala lo que
  acuerdan los empleados o autoriza pedidos); lo que cambie en filas ajenas queda en su celular, como a todos.
  **Cambio de palabra** (botón violeta "＋ Cambio de palabra el N" en el día del banco, `abrirPalabra`): elige empleado y
  con quién cambia (intercambian el turno de ese día; queda `estado: "acordado"`, `palabra: true`, `pasado`) o "Nadie"
  (sin contraparte: elige el turno; queda `estado: "autorizado"`, `palabra: true`). Va a lo oficial y les llega aviso.
  Todo eso usa `publicarCeldas` (transacción: solo cambia esas celdas sobre lo último de Firebase y anota
  `publicadoPor["legajo:día"] = {n, t, a}`, a: 1 autorizó / 2 acuerdo / 3 de palabra); al admin le llega aviso de lo que hizo. No toca Celulares, invitaciones,
  colores ni meses. Reglas: `REGLAS-FIREBASE-DIVISION.md`. El admin también puede autorizar ("Autorizado por el administrador").
- **Licencia (LIC)**: no lleva texto (solo el color; el selector de turnos sí dice LIC). Los días de
  licencia no se pueden cambiar ni pedir (`esLicencia` en `puedeEditar`): solo el admin los puede corregir.

## Diferencias con la gemela (cajeros)
- En jefes el admin **sí** publica turnos con ⬆ Publicar (colección `jefes`, un doc por mes
  con `people`, `colores`, `changedAt`…). Un mes nuevo lo sube con ↑ JSON (va directo a Firebase).
  En cajeros los colores van aparte (colección `cajeros`) y el mes en `turnos_cajeros`.
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
