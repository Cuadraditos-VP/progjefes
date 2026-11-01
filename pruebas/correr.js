// Pruebas de la app con varios "celulares" y un Firebase falso compartido.
// Uso (desde la carpeta de la app):  node pruebas/correr.js
// Necesita Playwright con Chromium (en Claude Code en la web ya viene instalado).
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const servir = require("./servir");
const crearBackend = require("./backend");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const APP = (html.match(/PED_COLLECTION = "pedidos_(\w+)"/) || [])[1];
const YOKEY = (html.match(/localStorage\.getItem\("(\w+Yo)"\)/) || [])[1];
if (!APP || !YOKEY) { console.error("No pude detectar la app (pedidos_X / XYo)"); process.exit(2); }
const PORT = 8700 + Math.floor(Math.random() * 200);
const URL = "http://localhost:" + PORT + "/";
const wait = ms => new Promise(r => setTimeout(r, ms));

let ok = 0, mal = 0;
function chequear(nombre, cond, detalle) {
  if (cond) { ok++; console.log("  ✓ " + nombre); }
  else { mal++; console.log("  ✗ " + nombre + (detalle !== undefined ? "  →  " + JSON.stringify(detalle) : "")); }
}

(async () => {
  console.log("Pruebas de " + APP + "\n");
  const srv = await servir(ROOT, PORT);
  const browser = await chromium.launch();
  const be = crearBackend(APP);
  const errores = [];
  const cel = async (uid, legajo, email) => {
    const pg = await be.celular(browser, URL, uid, email, errores);
    if (legajo) { await pg.evaluate(([k, v]) => localStorage.setItem(k, v), [YOKEY, legajo]); await pg.reload(); await wait(2500); }
    return pg;
  };
  try {
    // Busca tres personas y un día donde A y B trabajan con turnos distintos
    const P = await cel("u0");
    console.log("¿Quién sos?");
    chequear("un celular sin nombre ve \"¿Quién sos?\" al abrir", await P.evaluate(() => document.getElementById("yoOverlay").classList.contains("open")));
    const sinNombre = await P.evaluate(() => {
      window.alert = () => {};
      document.getElementById("yoOverlay").classList.remove("open");
      const antes = people[0].codes[0];
      openShiftPicker(0, 0);
      return { abanico: document.getElementById("shiftOverlay").classList.contains("open"),
        pregunta: document.getElementById("yoOverlay").classList.contains("open"), igual: people[0].codes[0] === antes };
    });
    chequear("sin nombre no puede cambiar turnos y le pregunta \"¿Quién sos?\"", !sinNombre.abanico && sinNombre.pregunta && sinNombre.igual, sinNombre);
    const s = await P.evaluate(() => {
      for (let d = 0; d < DAYS; d++) for (let a = 0; a < people.length; a++) {
        const x = actualDe(a, d); if (!trabaja(x)) continue;
        const otros = people.map((_, o) => o).filter(o => o !== a && trabaja(actualDe(o, d)) && actualDe(o, d) !== x);
        if (otros.length >= 2) return { d, a, b: otros[0], c: otros[1], x, y: actualDe(otros[0], d), z: actualDe(otros[1], d),
          ida: String(people[a].id), idb: String(people[otros[0]].id), idc: String(people[otros[1]].id), mes: currentMes };
      }
    });
    await P.close();
    console.log("Mes " + s.mes + ", día " + (s.d + 1) + ": A=" + s.ida + " (" + s.x + "), B=" + s.idb + " (" + s.y + "), C=" + s.idc + " (" + s.z + ")\n");

    console.log("\nCambios (pedidos)");
    const A = await cel("uA", s.ida), B = await cel("uB", s.idb), C = await cel("uC", s.idc);
    chequear("con nombre elegido ya no pregunta", !(await A.evaluate(() => document.getElementById("yoOverlay").classList.contains("open"))));
    await A.evaluate(s => { pedTengoSel = actualDe(s.a, s.d); guardarPedido(s.a, s.d, [s.y, s.z]); closePedido(); }, s);
    await wait(800);
    const ped = be.st["pedidos_" + APP] && be.st["pedidos_" + APP][s.mes + "_" + s.ida + "_" + (s.d + 1)];
    chequear("el pedido guarda varias opciones", ped && JSON.stringify(ped.acepta) === JSON.stringify([s.y, s.z]), ped && ped.acepta);
    chequear("a B le sirve (tiene una de las opciones)", await B.evaluate(s => aceptaTurno(pedidoDe(people[s.a].id, s.d), actualDe(s.b, s.d)), s));
    await B.evaluate(s => { responderPedido(s.a, s.d, true); closePedido(); }, s);
    await C.evaluate(s => { responderPedido(s.a, s.d, true); closePedido(); }, s);
    await wait(800);
    const avA = await A.evaluate(() => { revisarAvisos(); return document.getElementById("avisosOverlay").classList.contains("open") ? document.getElementById("avisosList").innerText : ""; });
    chequear("A recibe aviso de interesados", /interesad/.test(avA), avA);
    await A.evaluate(() => cerrarAvisos());
    await A.evaluate(s => { const r = pedidoDe(people[s.a].id, s.d).respuestas[s.idb]; confirmarAcuerdo(s.a, s.d, r); }, s);
    await wait(2500);
    const ver = pg => pg.evaluate(s => people[s.a].codes[s.d] + "/" + people[s.b].codes[s.d], s);
    const esperado = s.y + "/" + s.x;
    chequear("el cambio confirmado lo ve A", (await ver(A)) === esperado, await ver(A));
    chequear("el cambio confirmado lo ve B", (await ver(B)) === esperado, await ver(B));
    chequear("el cambio confirmado lo ve un tercero", (await ver(C)) === esperado, await ver(C));
    const avB = await B.evaluate(() => { revisarAvisos(); return document.getElementById("avisosList").innerText; });
    chequear("B recibe aviso de confirmación", /confirmó/.test(avB), avB);
    const avC = await C.evaluate(() => { revisarAvisos(); return document.getElementById("avisosList").innerText; });
    chequear("C recibe aviso de que se cerró con otro", /otra persona/.test(avC), avC);
    await B.evaluate(() => cerrarAvisos()); await C.evaluate(() => cerrarAvisos());

    console.log("\nFila propia (publicada) y filas ajenas (solo en tu celular)");
    const d2 = (s.d + 3) % 28;
    await A.evaluate(([s, d2]) => { openShiftPicker(s.a, d2); applyShift("X"); document.getElementById("closeShift").click(); }, [s, d2]);
    await A.evaluate(([s, d2]) => { openShiftPicker(s.c, d2); applyShift("MD"); document.getElementById("closeShift").click(); }, [s, d2]);
    await wait(2500);
    chequear("B ve el cambio de A en la fila de A", (await B.evaluate(([s, d2]) => people[s.a].codes[d2], [s, d2])) === "X");
    chequear("B NO ve lo que A cambió en la fila de C", (await B.evaluate(([s, d2]) => people[s.c].codes[d2], [s, d2])) !== "MD" ||
      (await B.evaluate(([s, d2]) => ORIGINAL_CODES[s.c][d2], [s, d2])) === "MD");
    chequear("A sí ve lo que cambió en la fila de C", (await A.evaluate(([s, d2]) => people[s.c].codes[d2], [s, d2])) === "MD");

    console.log("\nExterna (Valeria): cambia en su celular, no publica nada");
    const V = await cel("uV", "ext-valeria");
    chequear("a Valeria no le pregunta \"¿Quién sos?\"", !(await V.evaluate(() => document.getElementById("yoOverlay").classList.contains("open"))));
    const d4 = (s.d + 7) % 28;
    const antesV = Object.keys(be.st["propios_" + APP] || {}).length;
    await V.evaluate(([s, d4]) => { openShiftPicker(s.b, d4); applyShift("MD"); document.getElementById("closeShift").click(); }, [s, d4]);
    await wait(2500);
    chequear("Valeria ve su cambio", (await V.evaluate(([s, d4]) => people[s.b].codes[d4], [s, d4])) === "MD");
    chequear("B no ve el cambio de Valeria", (await B.evaluate(([s, d4]) => people[s.b].codes[d4], [s, d4])) !== "MD" ||
      (await B.evaluate(([s, d4]) => ORIGINAL_CODES[s.b][d4], [s, d4])) === "MD");
    chequear("Valeria no publica nada", Object.keys(be.st["propios_" + APP] || {}).length === antesV);
    await V.close();

    console.log("\nAdmin descarta un cambio publicado");
    const AD = await cel("uAd", null, "guillermo.nemaric@gmail.com");
    chequear("al admin no le pregunta \"¿Quién sos?\"", !(await AD.evaluate(() => document.getElementById("yoOverlay").classList.contains("open"))));
    const celTxt = () => AD.evaluate(() => document.getElementById("btnCelulares").textContent);
    chequear("el admin ve registrados nuevos en Celulares", /\d+ nuevos?/.test(await celTxt()), await celTxt());
    await AD.evaluate(() => { document.getElementById("btnCelulares").click(); document.getElementById("closeCelulares").click(); });
    chequear("al abrir Celulares dejan de contarse", !/nuevo/.test(await celTxt()), await celTxt());
    chequear("el admin ve el cambio de A", (await AD.evaluate(([s, d2]) => people[s.a].codes[d2], [s, d2])) === "X");
    await AD.evaluate(([s, d2]) => openShiftPicker(s.a, d2), [s, d2]);
    await wait(2500);
    const ofi = await AD.evaluate(([s, d2]) => ORIGINAL_CODES[s.a][d2], [s, d2]);
    chequear("vuelve a lo oficial para todos", (await B.evaluate(([s, d2]) => people[s.a].codes[d2], [s, d2])) === ofi);
    const avX = await A.evaluate(() => { revisarAvisos(); return document.getElementById("avisosList").innerText; });
    chequear("A recibe aviso del descarte", /descartó/.test(avX), avX);

    if (html.includes("function turnosAPublicar")) {
      console.log("\nAdmin publica turnos (jefes)");
      const d3 = (s.d + 5) % 28;
      await AD.evaluate(() => { window.confirm = () => true; });
      const nuevo = (await AD.evaluate(([s, d3]) => ORIGINAL_CODES[s.b][d3], [s, d3])) === "N" ? "M" : "N";
      await AD.evaluate(([s, d3, n]) => { openShiftPicker(s.b, d3); applyShift(n); document.getElementById("closeShift").click();
        document.getElementById("btnPublish").click(); }, [s, d3, nuevo]);
      await wait(3000);
      const pub = be.st.jefes && be.st.jefes[s.mes];
      chequear("queda publicado en Firebase", pub && pub.people[s.b].codes[d3] === nuevo, pub && pub.people[s.b].codes[d3]);
      chequear("C lo ve", (await C.evaluate(([s, d3]) => people[s.b].codes[d3], [s, d3])) === nuevo);
    }

    console.log("\nCelda del franco ofrecido");
    const fr = await A.evaluate(s => {
      const f = [...Array(DAYS).keys()].find(x => x !== s.d && actualDe(s.a, x) === "F");
      const dd = [...Array(DAYS).keys()].find(x => x !== s.d && x !== f && trabaja(actualDe(s.a, x)));
      if (f == null || dd == null) return null;
      pedTengoSel = actualDe(s.a, dd); guardarPedido(s.a, dd, ["F"], [f + 1]); closePedido();
      setPedidosMode(true);
      const td = document.querySelector('td[data-pi="' + s.a + '"][data-di="' + f + '"] .ped-da');
      return { f, dd, txt: td && td.textContent };
    }, s);
    if (fr) chequear('abajo dice "F el ' + (fr.dd + 1) + '"', fr.txt === "F el " + (fr.dd + 1), fr.txt);
    else console.log("  (sin días para probar)");

    console.log("");
    chequear("sin errores de JavaScript en las páginas", !errores.length, errores);
  } catch (e) {
    mal++; console.log("\n✗ La prueba se cortó: " + (e && e.message));
  }
  await browser.close(); srv.close();
  console.log("\n" + (mal ? "✗ " + mal + " fallaron, " : "✓ ") + ok + " pasaron");
  process.exit(mal ? 1 : 0);
})();
