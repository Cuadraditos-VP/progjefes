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
const TURNOS = (html.match(/const TURNOS_COLLECTION = "(\w+)"/) || [])[1];
if (!APP || !YOKEY || !TURNOS) { console.error("No pude detectar la app (pedidos_X / XYo / TURNOS_COLLECTION)"); process.exit(2); }
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
  const be = crearBackend(APP, TURNOS);
  const M0 = be.mesDePrueba(0);
  const DE_PRUEBA = M0.people.map(p => p.id);
  // ¿Este celular ve la programación protegida? (gente del mes de prueba en pantalla)
  const veDatos = pg => pg.evaluate(ids => people.some(p => ids.includes(String(p.id))), DE_PRUEBA);
  const errores = [];
  const cel = async (uid, legajo, email) => {
    const pg = await be.celular(browser, URL, uid, email, errores);
    if (legajo) { await pg.evaluate(([k, v]) => localStorage.setItem(k, v), [YOKEY, legajo]); await pg.reload(); await wait(2500); }
    return pg;
  };
  try {
    const P = await cel("u0");
    console.log("¿Quién sos? y datos protegidos");
    chequear("un celular sin nombre ve \"¿Quién sos?\" al abrir", await P.evaluate(() => document.getElementById("yoOverlay").classList.contains("open")));
    chequear("le pide el legajo (no ve la lista de nombres)", await P.evaluate(() => document.getElementById("yoOverlay").classList.contains("por-legajo") &&
      getComputedStyle(document.getElementById("yoList")).display === "none"));
    chequear("sin nombre no ve la programación protegida", !(await veDatos(P)));
    chequear("sin nombre Firebase no le deja leer los turnos", (await P.evaluate(() => Object.keys(FB_MESES).length)) === 0);
    const sinNombre = await P.evaluate(() => {
      window.alert = () => {};
      document.getElementById("yoOverlay").classList.remove("open");
      if (!people.length) return { vacio: true, cartel: document.getElementById("sinDatos").classList.contains("show") };
      const antes = people[0].codes[0];
      openShiftPicker(0, 0);
      return { abanico: document.getElementById("shiftOverlay").classList.contains("open"),
        pregunta: document.getElementById("yoOverlay").classList.contains("open"), igual: people[0].codes[0] === antes };
    });
    chequear("sin nombre no puede cambiar turnos", sinNombre.vacio ? sinNombre.cartel : (!sinNombre.abanico && sinNombre.pregunta && sinNombre.igual), sinNombre);
    // Como una persona: escribe el legajo y toca los botones (sin ventanitas del sistema)
    await P.evaluate(() => openYo());
    await P.fill("#yoLegajo", "12345"); await P.click("#yoLegajoBtn"); await wait(800);
    const malo = await P.evaluate(() => ({ msg: document.getElementById("yoLegajoMsg").textContent, leg: miLegajo,
      conf: document.getElementById("yoLegajoConf").classList.contains("show") }));
    chequear("un legajo que no existe no lo registra", /No encontramos/.test(malo.msg) && !malo.leg && !malo.conf, malo);
    const idP = DE_PRUEBA[DE_PRUEBA.length - 1];
    let dialogos = 0; const contar = () => dialogos++; P.on("dialog", contar);
    await P.fill("#yoLegajo", idP); await P.click("#yoLegajoBtn"); await wait(800);
    const preg = await P.evaluate(() => document.getElementById("yoLegajoConf").classList.contains("show") ? document.getElementById("yoLegajoPregunta").textContent : "");
    chequear("con el botón Buscar le pregunta si es él (dentro del cuadro)", /¿Sos PRUEBA/.test(preg), preg);
    await P.click("#yoLegajoSi"); await wait(2500);
    P.off("dialog", contar);
    chequear("con \"Sí, soy yo\" queda registrado", (await P.evaluate(() => miLegajo)) === idP);
    chequear("sin ventanitas del sistema (no andan bien en iPhone)", dialogos === 0, dialogos);
    chequear("registrado ve la programación protegida", await veDatos(P));
    // Busca tres personas y un día donde A y B trabajan con turnos distintos
    const s = await P.evaluate(ids => {
      const ok = i => ids.includes(String(people[i].id)) && String(people[i].id) !== String(miLegajo);
      for (let d = 0; d < DAYS; d++) for (let a = 0; a < people.length; a++) {
        if (!ok(a)) continue;
        const x = actualDe(a, d); if (!trabaja(x)) continue;
        const otros = people.map((_, o) => o).filter(o => o !== a && ok(o) && trabaja(actualDe(o, d)) && actualDe(o, d) !== x);
        if (otros.length >= 2) return { d, a, b: otros[0], c: otros[1], x, y: actualDe(otros[0], d), z: actualDe(otros[1], d),
          ida: String(people[a].id), idb: String(people[otros[0]].id), idc: String(people[otros[1]].id), mes: currentMes };
      }
    }, DE_PRUEBA);
    const libre = DE_PRUEBA.find(id => ![s.ida, s.idb, s.idc, idP].includes(id));
    const libre2 = DE_PRUEBA.find(id => ![s.ida, s.idb, s.idc, idP, libre].includes(id));
    await P.close();
    console.log("Mes " + s.mes + ", día " + (s.d + 1) + ": A=" + s.ida + " (" + s.x + "), B=" + s.idb + " (" + s.y + "), C=" + s.idc + " (" + s.z + ")\n");

    console.log("\nCambios (pedidos)");
    const A = await cel("uA", s.ida), B = await cel("uB", s.idb), C = await cel("uC", s.idc);
    chequear("con nombre elegido ya no pregunta", !(await A.evaluate(() => document.getElementById("yoOverlay").classList.contains("open"))));
    const alm = await A.evaluate(() => ({ abierto: document.getElementById("personOverlay").classList.contains("open"), pi: currentCalPi }));
    if (/const ABRIR_ALMANAQUE_AL_INICIO = true/.test(html)) chequear("al abrir la app se abre su almanaque", alm.abierto && alm.pi === s.a, alm);
    else chequear("al abrir la app se ve la grilla (sin almanaque)", !alm.abierto, alm);
    for (const pg of [A, B, C]) await pg.evaluate(() => closePersonCalendar());
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
    const N = await cel("uN");
    chequear("sin nombre NO ve la fila de A (ni lo que publicó)", !(await veDatos(N)));
    await N.evaluate(([k, v]) => localStorage.setItem(k, v), [YOKEY, libre]); await N.reload(); await wait(3000);
    chequear("al elegir su nombre ya lo ve", (await N.evaluate(([s, d2]) => people[s.a].codes[d2], [s, d2])) === "X");
    await N.close();

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
    if (/const SEED_[A-Z]+ = \[/.test(html)) {
      const legado = await AD.evaluate(() => AVAILABLE_MESES.filter(k => !FB_MESES[k] && (MES_DATA[k] || SEED_BY_MES[k])));
      const enFb = Object.keys(be.st[TURNOS] || {});
      chequear("el admin pasa a Firebase los meses que estaban en la página", legado.length === 0 && enFb.length > 1, { legado, enFb });
    }

    if (html.includes("function aceptarInvitacion")) {
      console.log("\nInvitación del admin para un externo");
      const code = await AD.evaluate(() => crearInvitacion("Invitada"));
      const I1 = await be.celular(browser, URL + "?inv=" + code, "uI1", null, errores);
      await wait(2500);
      const inv = await I1.evaluate(() => ({ leg: miLegajo, ext: soyExterno(), ve: veCambiosAjenos(),
        pregunta: document.getElementById("yoOverlay").classList.contains("open"), url: location.search }));
      chequear("con el link queda habilitado sin elegir nombre", inv.leg === "inv-" + code && inv.ext && inv.ve && !inv.pregunta, inv);
      chequear("el link se saca de la dirección", !/inv=/.test(inv.url), inv.url);
      await wait(1500);
      chequear("el invitado ve la programación protegida", await veDatos(I1));
      const d4 = (s.d + 7) % 28;
      const antesI = Object.keys(be.st["propios_" + APP] || {}).length;
      await I1.evaluate(([s, d4]) => { openShiftPicker(s.b, d4); applyShift("MD"); document.getElementById("closeShift").click(); }, [s, d4]);
      await wait(2500);
      chequear("el invitado ve su cambio", (await I1.evaluate(([s, d4]) => people[s.b].codes[d4], [s, d4])) === "MD");
      chequear("el invitado no publica nada", Object.keys(be.st["propios_" + APP] || {}).length === antesI);
      const yo = (be.st["yo_" + APP] || {}).uI1;
      chequear("el admin lo ve en Celulares", !!yo && yo.name === "Invitada", yo);
      chequear("no aparece en la lista de \"¿Quién sos?\"", !(await I1.evaluate(() => { renderYoList(); return /Invitada/.test(document.getElementById("yoList").innerText); })));
      const I2 = await be.celular(browser, URL + "?inv=" + code, "uI2", null, errores);
      await wait(2500);
      chequear("el mismo link no sirve en otro celular", !(await I2.evaluate(() => miLegajo)));
      await I1.close(); await I2.close();

      console.log("\niPhone: Safari y la app instalada no comparten el registro");
      const SF = await be.celular(browser, URL, "uSF", null, errores, { iphone: "safari" });
      await wait(1000);
      const sf = await SF.evaluate(() => ({ ios: document.getElementById("yoOverlay").classList.contains("ios-safari"),
        caja: getComputedStyle(document.getElementById("yoLegajoBox")).display }));
      chequear("en Safari de iPhone le explica que primero instale la app", sf.ios && sf.caja === "none", sf);
      await SF.click("#yoIosSafari");
      chequear("puede elegir usarla solo en Safari", (await SF.evaluate(() => getComputedStyle(document.getElementById("yoLegajoBox")).display)) !== "none");
      await SF.close();
      const code2 = await AD.evaluate(() => crearInvitacion("Invitada iPhone"));
      const SI = await be.celular(browser, URL + "?inv=" + code2, "uSI", null, errores, { iphone: "safari" });
      await wait(2500);
      const si = await SI.evaluate(() => ({ leg: miLegajo, cod: (document.querySelector("#yoIos .ios-codigo") || {}).textContent || "" }));
      chequear("el link en Safari de iPhone no se gasta y muestra el código", !si.leg && si.cod === code2, si);
      chequear("la invitación sigue sin usar", !((be.st["invitados_" + APP] || {})[code2] || {}).uid);
      await SI.close();
      // Caso real: ese iPhone ya había entrado antes por Safari (y eligió "solo Safari") y abre un link nuevo
      const code3 = await AD.evaluate(() => crearInvitacion("Invitada repetida"));
      const SR = await be.celular(browser, URL, "uSR", null, errores, { iphone: "safari" });
      await SR.evaluate(([k, s]) => { localStorage.setItem(k, "inv-viejo"); localStorage.setItem(s, "1"); }, [YOKEY, YOKEY.replace("Yo", "SoloSafari")]);
      await SR.goto(URL + "?inv=" + code3); await wait(6000);
      const sr = await SR.evaluate(() => ({ open: document.getElementById("yoOverlay").classList.contains("open"),
        cod: (document.querySelector("#yoIos .ios-codigo") || {}).textContent || "" }));
      chequear("aunque ya hubiera entrado por Safari, el código queda fijo en pantalla", sr.open && sr.cod === code3, sr);
      chequear("y la invitación nueva no se gasta en Safari", !((be.st["invitados_" + APP] || {})[code3] || {}).uid);
      await SR.close();
      const AP = await be.celular(browser, URL, "uAP", null, errores, { iphone: "app" });
      await wait(1000);
      chequear("en la app instalada pide el legajo normal", await AP.evaluate(() => !document.getElementById("yoOverlay").classList.contains("ios-safari") &&
        document.getElementById("yoOverlay").classList.contains("open")));
      await AP.click("#yoCodigoLink"); await AP.fill("#yoLegajo", code2.toUpperCase()); await AP.click("#yoLegajoBtn");
      await wait(2500);
      chequear("en la app entra escribiendo el código", (await AP.evaluate(() => miLegajo)) === "inv-" + code2 && (await veDatos(AP)));
      const yoAP = (be.st["yo_" + APP] || {}).uAP;
      chequear("en Celulares figura como (app)", !!yoAP && /\(app\)/.test(yoAP.disp), yoAP && yoAP.disp);
      await AP.close();
    }

    console.log("\nAdmin publica un mes nuevo (archivo del mes)");
    const M1 = be.mesDePrueba(1);
    await AD.evaluate(m => subirMesAdmin(m), { mes: M1.mes, codigos: M1.codigos, people: M1.people });
    await wait(2500);
    const sub = (be.st[TURNOS] || {})[M1.mes];
    chequear("queda guardado en Firebase", !!sub && sub.people.length === M1.people.length, sub && sub.people.length);
    chequear("el padrón tiene los legajos", !!(be.st["padron_" + APP] || {})[M1.people[0].id]);
    chequear("un registrado tiene el mes nuevo", (await C.evaluate(m => AVAILABLE_MESES.includes(m), M1.mes)));
    await AD.evaluate(m => { switchMonth(m); fillMonthSelect(); }, s.mes);

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

    console.log("\nAl abrir: su grupo a la vista");
    const GR = await cel("uGr", DE_PRUEBA[14]);
    const gr = await GR.evaluate(() => { const me = miPersona(); const td = me && document.querySelector('td[data-pi="' + me.pi + '"]');
      const card = td && td.closest(".grp-card"); const r = card ? card.getBoundingClientRect() : null;
      return { top: r && Math.round(r.top), abajo: r && Math.round(r.bottom), alto: innerHeight, alm: document.getElementById("personOverlay").classList.contains("open") }; });
    chequear("se ve la grilla con su grupo a la vista", gr.top != null && gr.top >= 0 && (gr.top < gr.alto / 2 || gr.abajo <= gr.alto) && !gr.alm, gr);
    await GR.setViewportSize({ width: 420, height: 420 });
    const antes = await GR.evaluate(() => { const w = document.getElementById("scheduleWrap"); w.scrollTop = 0; w.scrollLeft = 120;
      return { top: w.scrollTop, left: w.scrollLeft }; });
    await Promise.all([GR.waitForNavigation(), GR.evaluate(() => recargaAutomatica())]);
    await wait(3500);
    const desp = await GR.evaluate(() => { const w = document.getElementById("scheduleWrap"); return { top: w.scrollTop, left: w.scrollLeft }; });
    chequear("después de la recarga automática queda donde estaba", desp.top === antes.top && Math.abs(desp.left - antes.left) < 3, { antes, desp });
    await GR.close();

    console.log("\nCopia de los turnos en el celular (para abrir al instante)");
    const copia = pg => pg.evaluate(() => Object.keys(localStorage).some(k => k.indexOf("cajTurnos:") === 0 || k.indexOf("ctFb:") === 0));
    chequear("el registrado guarda una copia de los meses", await copia(A));
    const NC = await cel("uNC");
    chequear("sin registrarse no guarda nada", !(await copia(NC)));
    await NC.close();

    console.log("\nSin internet");
    const OF = await cel("uOff", libre2);
    chequear("registrado con internet ve la programación", await veDatos(OF));
    await OF.addInitScript(() => { window.__SIN_RED = true; });
    await OF.reload(); await wait(3000);
    const of = await OF.evaluate(() => ({ leg: miLegajo, reg: registroOk, vacio: document.getElementById("sinDatos").classList.contains("show") }));
    chequear("sin internet sigue viendo lo guardado", (await veDatos(OF)) && of.reg && !of.vacio, of);
    await OF.close();

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
    if (fr) {
      await wait(1500);
      const N2 = await cel("uN2");
      const vista = await N2.evaluate(() => {
        document.getElementById("yoOverlay").classList.remove("open");
        setPedidosMode(true);
        document.getElementById("yoOverlay").classList.remove("open");
        return { celdas: document.querySelectorAll("td .ped-da").length, label: document.getElementById("pedidosLabel").textContent };
      });
      chequear("sin nombre no ve los pedidos de cambio de los demás", vista.celdas === 0 && /quién sos/i.test(vista.label), vista);
      await N2.close();
    }

    console.log("");
    chequear("sin errores de JavaScript en las páginas", !errores.length, errores);
  } catch (e) {
    mal++; console.log("\n✗ La prueba se cortó: " + (e && e.message));
  }
  await browser.close(); srv.close();
  console.log("\n" + (mal ? "✗ " + mal + " fallaron, " : "✓ ") + ok + " pasaron");
  process.exit(mal ? 1 : 0);
})();
