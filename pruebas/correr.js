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
    // Buscador de nombres (solo cajeros, en pantallas anchas)
    if (await P.evaluate(() => !!document.getElementById("buscaNombre"))) {
      console.log("Buscador de nombres");
      chequear("en el celular no aparece el buscador", !(await P.isVisible("#buscaNombre")));
      await P.setViewportSize({ width: 1280, height: 800 }); await wait(300);
      chequear("en la PC aparece el buscador", await P.isVisible("#buscaNombre"));
      const ult = await P.evaluate(() => people.length - 1);
      const quien = await P.evaluate(i => people[i].name, ult);
      await P.fill("#buscaNombre", quien.split(/[ ,]+/).pop().toLowerCase()); await wait(200);
      chequear("lista a quien coincide con lo escrito", await P.evaluate(n => Array.from(document.querySelectorAll("#buscaLista button span")).some(s => s.textContent === n), quien));
      await P.press("#buscaNombre", "Enter"); await wait(900);
      const fue = await P.evaluate(i => { const tr = document.querySelector('td.person-name[data-pi="' + i + '"]').closest("tr");
        const r = tr.getBoundingClientRect(); return { marcada: tr.classList.contains("busca-hit"), visible: r.top >= 0 && r.bottom <= innerHeight }; }, ult);
      chequear("con Enter lleva a esa fila y la resalta", fue.marcada && fue.visible, fue);
      await P.setViewportSize({ width: 420, height: 900 }); await wait(200);
    }
    await P.close();
    console.log("Mes " + s.mes + ", día " + (s.d + 1) + ": A=" + s.ida + " (" + s.x + "), B=" + s.idb + " (" + s.y + "), C=" + s.idc + " (" + s.z + ")\n");

    console.log("\nCambios (pedidos)");
    const A = await cel("uA", s.ida), B = await cel("uB", s.idb), C = await cel("uC", s.idc);
    chequear("con nombre elegido ya no pregunta", !(await A.evaluate(() => document.getElementById("yoOverlay").classList.contains("open"))));
    if (html.includes("function esLicencia")) {
      // Días de licencia: no se pueden cambiar (ni el propio ni uno ajeno); el admin sí
      const probarLic = pg => pg.evaluate(() => {
        const me = miPersona();
        const pi = people.findIndex((p, i) => !me || i !== me.pi), di = 2;
        const filas = [[pi, di]].concat(me ? [[me.pi, 3]] : []);
        const antes = filas.map(([p, d]) => [people[p].codes[d], ORIGINAL_CODES[p][d]]);
        filas.forEach(([p, d]) => { people[p].codes[d] = "LIC"; ORIGINAL_CODES[p][d] = "LIC"; });
        const ov = document.getElementById("shiftOverlay");
        const abre = filas.map(([p, d]) => { openShiftPicker(p, d); const o = ov.classList.contains("open"); ov.classList.remove("open"); return o; });
        filas.forEach(([p, d], i) => { people[p].codes[d] = antes[i][0]; ORIGINAL_CODES[p][d] = antes[i][1]; });
        return abre;
      });
      const licA = await probarLic(A);
      chequear("un día de licencia no se puede cambiar (ni propio ni ajeno)", licA.length === 2 && licA.every(x => !x), licA);
      var probarLicAdmin = probarLic;
    }
    // Al tocar un turno en la ventana, el cambio se hace y la ventana se cierra sola
    const toque = await A.evaluate(() => {
      const me = miPersona(); if (!me) return { sin: true };
      const di = 5, antes = people[me.pi].codes[di];
      openShiftPicker(me.pi, di);
      const ov = document.getElementById("shiftOverlay"), abrio = ov.classList.contains("open");
      const opt = [...document.querySelectorAll("#shiftGrid .shift-option")].find(o => o.dataset.code !== antes);
      opt.click();
      const r = { abrio, cerro: !ov.classList.contains("open"), quedo: people[me.pi].codes[di] === opt.dataset.code };
      openShiftPicker(me.pi, di); document.getElementById("restoreShift").click();
      r.restaurado = people[me.pi].codes[di] === antes && !ov.classList.contains("open");
      return r;
    });
    chequear("al tocar un turno se aplica y la ventana se cierra", toque.sin || (toque.abrio && toque.cerro && toque.quedo && toque.restaurado), toque);
    const alm = await A.evaluate(() => ({ abierto: document.getElementById("personOverlay").classList.contains("open"), pi: currentCalPi }));
    if (/const ABRIR_ALMANAQUE_AL_INICIO = true/.test(html)) chequear("al abrir la app se abre su almanaque", alm.abierto && alm.pi === s.a, alm);
    else chequear("al abrir la app se ve la grilla (sin almanaque)", !alm.abierto, alm);
    for (const pg of [A, B, C]) await pg.evaluate(() => closePersonCalendar());
    const mi = await A.evaluate(() => { const b = document.getElementById("btnMiAlmanaque"); const vis = getComputedStyle(b).display !== "none";
      b.click(); const r = { vis, txt: b.textContent, abierto: document.getElementById("personOverlay").classList.contains("open"), pi: currentCalPi }; closePersonCalendar(); return r; });
    chequear("arriba aparece su nombre y abre su almanaque", mi.vis && /PRUEBA/.test(mi.txt) && mi.abierto && mi.pi === s.a, mi);
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
    const vistas = await AD.evaluate(() => { const b = document.getElementById("btnOriginalView"); const r = [b.textContent];
      for (let i = 0; i < 4; i++) { b.click(); r.push(b.textContent); } return r.join(" → "); });
    chequear("las vistas del admin son A → I → CJ → D (sin O)", vistas === "A → I → CJ → D → A", vistas);
    if (html.includes("vpFueAdmin")) {
      const visible = pg => pg.evaluate(() => getComputedStyle(document.getElementById("btnUser")).display !== "none");
      chequear("en el celular de un empleado no aparece el botón de admin", !(await visible(B)));
      chequear("en el del admin sí", await visible(AD));
      await B.evaluate(() => {
        window.__login = false;
        document.getElementById("btnUser").addEventListener("click", e => { window.__login = true; e.stopImmediatePropagation(); }, true);
        document.getElementById("btnPedidos").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      });
      await wait(3300);
      const lp = await B.evaluate(() => {
        const bp = document.getElementById("btnPedidos");
        bp.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        bp.click();
        const r = { login: window.__login, cambios: pedidosMode };
        if (pedidosMode) setPedidosMode(false);
        return r;
      });
      chequear("manteniendo apretado Cambios 3 segundos se abre el inicio de sesión (sin abrir Cambios)", lp.login && !lp.cambios, lp);
      const corto = await B.evaluate(() => { window.__login = false; const bp = document.getElementById("btnPedidos");
        bp.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); bp.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); bp.click();
        const r = { login: window.__login, cambios: pedidosMode }; if (pedidosMode) setPedidosMode(false); return r; });
      chequear("un toque normal sigue abriendo Cambios", !corto.login && corto.cambios, corto);
    }
    chequear("al admin no le aparece el botón de nombre", await AD.evaluate(() => getComputedStyle(document.getElementById("btnMiAlmanaque")).display === "none"));
    chequear("al admin no le pregunta \"¿Quién sos?\"", !(await AD.evaluate(() => document.getElementById("yoOverlay").classList.contains("open"))));
    if (typeof probarLicAdmin === "function") {
      const licAd = await probarLicAdmin(AD);
      chequear("el admin sí puede corregir un día de licencia", licAd.length === 1 && licAd[0], licAd);
    }
    if (html.includes('id="bancoOverlay"')) {
      const adC = await AD.evaluate(() => { setPedidosMode(true); const r = { banco: document.getElementById("bancoOverlay").classList.contains("open"),
        yo: document.getElementById("yoOverlay").classList.contains("open") }; setPedidosMode(false); return r; });
      chequear("al abrir Cambios al admin tampoco le pregunta \"¿Quién sos?\"", adC.banco && !adC.yo, adC);
    }
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
      chequear("el código de invitación es de 3 cifras", /^[1-9]\d\d$/.test(code), code);
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
      chequear("no repite un código que ya existe", new Set([code, code2, code3]).size === 3, [code, code2, code3]);
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
      console.log("\nAdmin publica turnos");
      const d3 = (s.d + 5) % 28;
      await AD.evaluate(() => { window.confirm = () => true; });
      const nuevo = (await AD.evaluate(([s, d3]) => ORIGINAL_CODES[s.b][d3], [s, d3])) === "N" ? "M" : "N";
      await AD.evaluate(([s, d3, n]) => { openShiftPicker(s.b, d3); applyShift(n); document.getElementById("closeShift").click();
        document.getElementById("btnPublish").click(); }, [s, d3, nuevo]);
      await wait(3000);
      const pub = be.st[TURNOS] && be.st[TURNOS][s.mes];
      chequear("queda publicado en Firebase", pub && pub.people[s.b].codes[d3] === nuevo, pub && pub.people[s.b].codes[d3]);
      chequear("C lo ve", (await C.evaluate(([s, d3]) => people[s.b].codes[d3], [s, d3])) === nuevo);
    }

    if (html.includes("function choquesConPropios")) {
      console.log("\nEl admin publica un cambio de palabra (manda sobre lo que publicó el dueño de la fila)");
      const d5 = (s.d + 12) % 28;
      const ofi5 = await AD.evaluate(([s, d5]) => ORIGINAL_CODES[s.a][d5], [s, d5]);
      const [c1, c2, c3] = ["MD", "N", "E", "M", "T"].filter(c => c !== ofi5);
      // A publica algo en su fila
      await A.evaluate(([s, d5, c]) => { openShiftPicker(s.a, d5); applyShift(c); }, [s, d5, c1]);
      await wait(2500);
      chequear("el admin ve lo que publicó A", (await AD.evaluate(([s, d5]) => people[s.a].codes[d5], [s, d5])) === c1);
      // El admin lo cambia (sin descartar al tocarlo) y publica
      await AD.evaluate(([s, d5, c]) => { window.confirm = () => false; openShiftPicker(s.a, d5); applyShift(c); }, [s, d5, c2]);
      const pend = await AD.evaluate(() => document.getElementById("btnPublish").textContent);
      chequear("⬆ Publicar muestra que hay turnos para publicar", /\(\d+\)/.test(pend), pend);
      let pregunta = "";
      await AD.evaluate(() => { window.__preg = ""; window.confirm = m => { window.__preg = m; return true; }; document.getElementById("btnPublish").click(); });
      await wait(3000);
      pregunta = await AD.evaluate(() => window.__preg);
      chequear("antes de publicar avisa que reemplaza lo que publicó A", /reemplazar lo que publicó/.test(pregunta) && pregunta.indexOf(await A.evaluate(s => people[s.a].name, s)) >= 0, pregunta);
      const docMes = (be.st[TURNOS] || {})[s.mes];
      const filaA = docMes && docMes.people.find(p => String(p.id) === s.ida);
      const codA = filaA && (Array.isArray(filaA.codes) ? filaA.codes : String(filaA.codes).split(/\s+/))[d5];
      chequear("queda en lo oficial (Firebase)", codA === c2, codA);
      chequear("lo del admin manda: C lo ve", (await C.evaluate(([s, d5]) => people[s.a].codes[d5], [s, d5])) === c2, await C.evaluate(([s, d5]) => people[s.a].codes[d5], [s, d5]));
      chequear("y A también", (await A.evaluate(([s, d5]) => people[s.a].codes[d5], [s, d5])) === c2, await A.evaluate(([s, d5]) => people[s.a].codes[d5], [s, d5]));
      chequear("sigue marcado como cambiado (azul) para los demás", await C.evaluate(([s, d5]) => markClass(s.a, d5) === "changed", [s, d5]));
      await A.evaluate(() => cerrarAvisos());
      // A lo vuelve a cambiar: al admin le llega un aviso
      await AD.evaluate(() => cerrarAvisos());
      await A.evaluate(([s, d5, c]) => { openShiftPicker(s.a, d5); applyShift(c); }, [s, d5, c3]);
      await wait(2500);
      const avAd = await AD.evaluate(() => { revisarAvisos(); return document.getElementById("avisosOverlay").classList.contains("open") ? document.getElementById("avisosList").innerText : ""; });
      chequear("si A lo vuelve a cambiar, al admin le llega un aviso", /cambió en su fila/.test(avAd) && avAd.indexOf(c3) >= 0, avAd);
      await AD.evaluate(() => { cerrarAvisos(); window.confirm = () => true; });
    }

    console.log("\nAl abrir: el inicio de la grilla");
    const GR = await cel("uGr", DE_PRUEBA[14]);
    await GR.setViewportSize({ width: 420, height: 420 }); await wait(300);
    const gr = await GR.evaluate(() => ({ top: document.getElementById("scheduleWrap").scrollTop, alm: document.getElementById("personOverlay").classList.contains("open") }));
    chequear("al abrir se ve el inicio de la grilla (sin almanaque)", gr.top === 0 && !gr.alm, gr);
    const antes = await GR.evaluate(() => { const w = document.getElementById("scheduleWrap"); w.scrollTop = 150; w.scrollLeft = 120;
      return { top: w.scrollTop, left: w.scrollLeft }; });
    await Promise.all([GR.waitForNavigation(), GR.evaluate(() => recargaAutomatica())]);
    await wait(3500);
    const desp = await GR.evaluate(() => { const w = document.getElementById("scheduleWrap"); return { top: w.scrollTop, left: w.scrollLeft }; });
    chequear("después de la recarga automática queda donde estaba", desp.top === antes.top && Math.abs(desp.left - antes.left) < 3, { antes, desp });
    await GR.close();

    console.log("\nCJ: lo que manda cada celular al admin");
    const CJC = (html.match(/const CJ_COLLECTION = "(\w+)"/) || [])[1] || "cj";
    const cjDe = uid => Object.entries(be.st[CJC] || {}).filter(([k]) => k.endsWith("_" + uid)).map(([, d]) => d);
    const cjA = () => cjDe("uA").reduce((n, d) => n + Object.keys(d.edits || {}).length, 0);
    chequear("A mandó sus cambios a CJ", cjA() > 0, cjDe("uA"));
    // Reabrir sin la copia de los meses: antes mandaba una lista vacía y borraba lo de CJ
    await A.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf("cajTurnos:") === 0 || k.indexOf("ctFb:") === 0).forEach(k => localStorage.removeItem(k)));
    await A.reload(); await wait(3500);
    chequear("al reabrir sin copia no se borra lo de CJ", cjA() > 0, cjDe("uA"));
    // Un celular al que ya se le había borrado: lo vuelve a mandar solo
    Object.values(be.st[CJC] || {}).forEach(d => { if (d.uid === "uA") d.edits = {}; });
    await A.evaluate(() => Object.keys(localStorage).filter(k => /CjSent:/.test(k)).forEach(k => localStorage.setItem(k, "{}")));
    await A.reload(); await wait(4000);
    chequear("si se había borrado, lo vuelve a mandar", cjA() > 0, cjDe("uA"));
    // Aunque su celular no haya mandado nada a CJ, el admin ve lo que publicó en su propia fila
    Object.values(be.st[CJC] || {}).forEach(d => { if (d.uid === "uA") d.edits = {}; });
    // El celular de B cambió la fila de C (eso va a CJ pero no se publica)
    const dC = (s.d + 10) % 28;
    const ofiC = (M0.people.find(p => String(p.id) === s.idc) || {}).codes[dC];
    const codC = ofiC === "X" ? "N" : "X";
    be.st[CJC] = be.st[CJC] || {};
    be.st[CJC][s.mes + "_uB"] = { mes: s.mes, uid: "uB", edits: { [s.idc + ":" + dC]: { c: codC, t: Date.now() - 3 * 86400000 } }, updated: Date.now() };
    const AD2 = await cel("uAd2", null, "guillermo.nemaric@gmail.com");
    const marcas = await AD2.evaluate(m => { switchMonth(m); rebuildCj(); return CJ_MARKS; }, s.mes);
    chequear("en CJ el admin ve lo publicado en su fila aunque no lo haya mandado", !!marcas[s.a + ":" + s.d], marcas);
    // Se distinguen: lo de su propia fila (azul) y lo que otro cambió en una fila ajena (violeta)
    await wait(500);
    const tipos = await AD2.evaluate(([s, dC]) => { const vm = viewMode; viewMode = "cj"; rebuildCj();
      const r = { propio: CJ_MARKS[s.a + ":" + s.d], ajeno: CJ_MARKS[s.c + ":" + dC], clsP: markClass(s.a, s.d), clsA: markClass(s.c, dC) };
      viewMode = vm; return r; }, [s, dC]);
    chequear("en CJ se distingue lo de su propia fila y lo de filas ajenas",
      tipos.propio === "propio" && tipos.ajeno === "ajeno" && tipos.clsP === "cjpropio" && tipos.clsA === "cjchanged", tipos);
    if (html.includes("function abrirInfoCj")) {
      await wait(500);
      const info = await AD2.evaluate(([s, dC]) => {
        rebuildCj();
        abrirInfoCj(s.c, dC);
        const deB = document.getElementById("cjInfoBody").innerText;
        const abierto = document.getElementById("cjInfoOverlay").classList.contains("open");
        // El celular de A mandó a CJ lo mismo que publicó en su fila: no se tiene que repetir
        const uidA = Object.keys(celularesDocs).find(u => String(celularesDocs[u].id) === s.ida) || "uA";
        cjDocs[s.mes + "_" + uidA] = { mes: s.mes, uid: uidA, edits: { [s.ida + ":" + s.d]: { c: s.y, t: Date.now() } } };
        abrirInfoCj(s.a, s.d);
        const deA = document.getElementById("cjInfoBody").innerText;
        cerrarInfoCj();
        return { abierto, deB, deA, nomB: people[s.b].name, nomA: people[s.a].name };
      }, [s, dC]);
      chequear("al tocar una celda en CJ dice de qué celular vino", info.abierto && info.deB.indexOf("celular de " + info.nomB) >= 0 && /hace 3 días/.test(info.deB), info);
      chequear("y si lo publicó el dueño de la fila, lo dice", info.deA.indexOf(info.nomA + " lo publicó en su fila") >= 0, info.deA);
      chequear("y no lo repite si su celular mandó lo mismo", info.deA.indexOf("celular de") < 0, info.deA);
    }
    if (html.includes("function pasarCjAOficial")) {
      // Desde el cuadro de CJ el admin pasa a lo oficial el cambio que mandó B en la fila de C
      const COLT = (html.match(/const TURNOS_COLLECTION = "(\w+)"/) || [])[1] || "jefes";
      // Antes, el celular de B tenía cargada otra cosa en ese casillero (solo en su celular)
      const otro = codC === "T" ? "N" : "T";
      await B.evaluate(([s, dC, otro]) => { people[s.c].codes[dC] = otro; saveEdit(s.c, dC, otro); refreshAfterEdit(); }, [s, dC, otro]);
      await wait(300);
      const vio = await AD2.evaluate(([s, dC]) => {
        window.confirm = () => true;
        rebuildCj(); abrirInfoCj(s.c, dC);
        const btn = document.getElementById("cjInfoOficial");
        const vis = getComputedStyle(btn).display !== "none";
        btn.click();
        return vis;
      }, [s, dC]);
      await wait(1000);
      const ofDoc = (be.st[COLT] || {})[s.mes] || {};
      const filaC = (ofDoc.people || []).find(p => String(p.id) === s.idc) || {};
      const despues = await AD2.evaluate(([s, dC]) => { rebuildCj(); return { ofi: ORIGINAL_CODES[s.c][dC], marca: !!CJ_MARKS[s.c + ":" + dC] }; }, [s, dC]);
      chequear("desde CJ el admin lo pasa a lo oficial", vio && (filaC.codes || [])[dC] === codC && despues.ofi === codC && !despues.marca,
        { vio, enFb: (filaC.codes || [])[dC], codC, despues });
      await wait(500);
      const enB = await B.evaluate(([s, dC]) => ({ ve: people[s.c].codes[dC], local: (s.c + ":" + dC) in editsMap }), [s, dC]);
      chequear("lo publicado por el admin pisa lo que ese celular tenía cargado de antes", enB.ve === codC && !enB.local, { enB, codC });
      const enB2 = await B.evaluate(([s, dC, otro]) => { people[s.c].codes[dC] = otro; saveEdit(s.c, dC, otro); refreshAfterEdit();
        resetPeopleFromOfficial(); return people[s.c].codes[dC]; }, [s, dC, otro]);
      chequear("si lo vuelve a cambiar después, en su celular se respeta", enB2 === otro, enB2);
      await B.evaluate(([s, dC]) => { removeEdit(s.c, dC); resetPeopleFromOfficial(); refreshAfterEdit(); }, [s, dC]);
    }
    await AD2.close();

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
      document.querySelector('#bancoCal .bc-day[data-di="' + f + '"]').click();
      const t = [...document.querySelectorAll("#bancoDia .bd-card[data-i]")].find(x => /busca F el/.test(x.textContent) || /buscás F el/.test(x.textContent));
      setPedidosMode(false);
      return { f, dd, txt: t && t.querySelector(".bd-que").textContent };
    }, s);
    if (fr) chequear('el día del franco dice "busca F el ' + (fr.dd + 1) + '"', !!fr.txt && new RegExp("F el " + (fr.dd + 1) + "\\b").test(fr.txt), fr.txt);
    else console.log("  (sin días para probar)");

    if (fr && html.includes("function renderBanco")) {
      console.log("\nBanco de cambios (almanaque)");
      await wait(1500);
      const bc = await B.evaluate(([s, fr]) => {
        setPedidosMode(true);
        const abierto = () => document.getElementById("bancoOverlay").classList.contains("open");
        const dia = document.querySelector('#bancoCal .bc-day[data-di="' + fr.dd + '"]');
        const cant = dia ? Number(dia.querySelector(".bc-cant").textContent) || 0 : 0;
        dia.click();
        const tarjetas = [...document.querySelectorAll("#bancoDia .bd-card[data-i]")];
        const deA = tarjetas.find(t => t.textContent.indexOf(people[s.a].name) >= 0);
        if (deA) deA.click();
        const r = { banco: abierto(), grilla: !document.querySelector("td .ped-da"), cant, n: tarjetas.length, deA: !!deA,
          cuadro: document.getElementById("pedidoOverlay").classList.contains("open"), titulo: document.getElementById("pedidoTitle").textContent };
        closePedido();
        const diaF = document.querySelector('#bancoCal .bc-day[data-di="' + fr.f + '"]');
        diaF.click();
        r.franco = [...document.querySelectorAll("#bancoDia .bd-card[data-i]")].some(t => t.textContent.indexOf(people[s.a].name) >= 0 && /busca F el/.test(t.textContent));
        setPedidosMode(false);
        r.vuelve = !abierto();
        return r;
      }, [s, fr]);
      chequear("Cambios se abre como cuadro (la grilla de atrás queda normal)", bc.banco && bc.grilla, bc);
      chequear("el día del pedido muestra cuántas propuestas hay", bc.cant >= 1, bc);
      chequear("al tocar el día aparece la propuesta y abre su cuadro", bc.deA && bc.cuadro && bc.titulo.indexOf(String(fr.dd + 1)) >= 0, bc);
      chequear("el día del franco ofrecido también la muestra", bc.franco, bc);
      chequear("con × se cierra y queda la grilla", bc.vuelve, bc);
    }

    console.log("\nPedidos vencidos");
    const ven = await A.evaluate(s => {
      const d = [...Array(DAYS).keys()].find(x => x !== s.d && !pedidoDe(people[s.a].id, x) && trabaja(actualDe(s.a, x)));
      if (d == null) return null;
      pedTengoSel = actualDe(s.a, d); guardarPedido(s.a, d, ["*"]); closePedido();
      setPedidosMode(true);
      const antes = !!pedidoDe(people[s.a].id, d);
      const h = hoyFecha(); window.__HOY = new Date(MES.y, MES.m, 1, 12).getTime(); // ya pasó todo el mes
      renderGroups(); updatePedidosBar();
      const celda = propuestasDelDia(d).some(x => x.pi === s.a);
      const r = { antes, despues: !!pedidoDe(people[s.a].id, d), celda: !!celda, label: document.getElementById("pedidosLabel").textContent,
        acordado: people[s.a].codes[s.d], acordados: document.getElementById("btnAcuerdos").textContent };
      window.__HOY = h.getTime(); renderGroups(); updatePedidosBar();
      return r;
    }, s);
    if (ven) {
      chequear("pasado su día, el pedido desaparece de la grilla", ven.antes && !ven.despues && !ven.celda && /^0 pedidos/.test(ven.label), ven);
      chequear("el cambio acordado sigue estando", ven.acordado === s.y && /Acordados \(\d+\)/.test(ven.acordados), ven);
    } else console.log("  (sin días para probar)");
    // El mismo día ya no se puede cambiar: el pedido de hoy vence y el día queda gris
    const hoyV = await A.evaluate(s => {
      const d = [...Array(DAYS).keys()].find(x => x > 0 && x !== s.d && !pedidoDe(people[s.a].id, x) && trabaja(actualDe(s.a, x)));
      if (d == null) return null;
      pedTengoSel = actualDe(s.a, d); guardarPedido(s.a, d, ["*"]); closePedido();
      const antes = !!pedidoDe(people[s.a].id, d);
      const h = hoyFecha(); window.__HOY = new Date(MES.y, MES.m - 1, d + 1, 12).getTime();
      bancoMesSel = null; bancoDiaSel = d; setPedidosMode(true); renderBanco();
      const el = document.querySelector('#bancoCal .bc-day[data-di="' + d + '"]');
      const sig = document.querySelector('#bancoCal .bc-day[data-di="' + (d + 1) + '"]');
      const r = { antes, hoy: !!pedidoDe(people[s.a].id, d), gris: !!el && el.classList.contains("pasado"),
        sigAbierto: !sig || !sig.classList.contains("pasado"), arranca: bancoDiaSel };
      bancoDiaSel = d; renderBancoDia();
      r.pedir = !!document.getElementById("bancoPedir");
      window.__HOY = h.getTime(); setPedidosMode(false); renderGroups(); updatePedidosBar();
      r.vuelve = !!pedidoDe(people[s.a].id, d); quitarPedidoDoc(s.a, d, true);
      r.d = d; return r;
    }, s);
    if (hoyV) {
      chequear("el día de hoy ya no se puede cambiar (queda gris, sin \"Pedir cambio\")", hoyV.antes && !hoyV.hoy && hoyV.gris && !hoyV.pedir, hoyV);
      chequear("el banco arranca en mañana", hoyV.sigAbierto && hoyV.arranca > hoyV.d, hoyV);
    }
    // La División y el admin sí pueden cargar un cambio de palabra para hoy
    const hoyAd = await AD.evaluate(() => {
      const h = hoyFecha(); const d = 3; window.__HOY = new Date(MES.y, MES.m - 1, d + 1, 12).getTime();
      bancoMesSel = null; setPedidosMode(true); renderBanco();
      const el = document.querySelector('#bancoCal .bc-day[data-di="' + d + '"]');
      const ayer = document.querySelector('#bancoCal .bc-day[data-di="' + (d - 1) + '"]');
      const r = { hoyAbierto: !!el && !el.classList.contains("pasado"), ayerGris: !!ayer && ayer.classList.contains("pasado") };
      if (el) el.click();
      r.palabra = !!document.getElementById("bancoPalabra"); r.pedir = !!document.getElementById("bancoPedir");
      window.__HOY = h.getTime(); setPedidosMode(false);
      return r;
    });
    chequear("el admin sí puede cargar un cambio de palabra para hoy (los días pasados no)", hoyAd.hoyAbierto && hoyAd.ayerGris && hoyAd.palabra, hoyAd);
    if (fr) {
      await wait(1500);
      const N2 = await cel("uN2");
      const vista = await N2.evaluate(() => {
        document.getElementById("yoOverlay").classList.remove("open");
        setPedidosMode(true);
        document.getElementById("yoOverlay").classList.remove("open");
        return { celdas: document.querySelectorAll("#bancoDia .bd-card, #bancoCal .bc-cant:not(.cero)").length, label: document.getElementById("pedidosLabel").textContent };
      });
      chequear("sin nombre no ve los pedidos de cambio de los demás", vista.celdas === 0 && /quién sos/i.test(vista.label), vista);
      await N2.close();
    }

    if (html.includes("function menuAdmin()")) {
      console.log("\nHerramientas del admin en la ventana ☰ (celular y PC)");
      const enBarra = pg => pg.evaluate(() => !!document.querySelector("header .topbar #btnPublish"));
      chequear("no queda el botón Copiar", !html.includes('id="btnCopyJson"'));
      for (const [nom, tactil] of [["PC", false], ["celular", true]]) {
        const ADM = await be.celular(browser, URL, "uAdM" + nom, "guillermo.nemaric@gmail.com", errores, { tactil });
        await wait(2500);
        chequear("en " + nom + " Publicar no está en la barra de arriba", !(await enBarra(ADM)));
        await ADM.evaluate(() => document.querySelectorAll(".palette-overlay.open").forEach(o => o.classList.remove("open")));
        await ADM.click("#btnAdminMenu");
        const m = await ADM.evaluate(() => ({ abierto: document.getElementById("adminMenuOverlay").classList.contains("open"),
          botones: [...document.querySelectorAll("#adminMenuList button")].filter(b => b.offsetParent).map(b => b.id) }));
        chequear("en " + nom + " el ☰ abre la ventana con las herramientas", m.abierto && m.botones.length >= 5 && m.botones.includes("btnPublish"), m);
        const col = await ADM.evaluate(() => document.querySelector("#adminMenuList #btnColores, #adminMenuList #btnColors").id);
        await ADM.click("#adminMenuList #" + col);
        const tras = await ADM.evaluate(() => ({ menu: document.getElementById("adminMenuOverlay").classList.contains("open"),
          abiertas: document.querySelectorAll(".palette-overlay.open").length }));
        chequear("en " + nom + " al tocar una herramienta se cierra el menú y abre lo suyo", !tras.menu && tras.abiertas === 1, tras);
        await ADM.close();
      }
    }

    if (html.includes('data-lineas="oscuro"')) {
      console.log("\nColores: líneas de la grilla");
      const lineas = pg => pg.evaluate(() => {
        const td = [...document.querySelectorAll(".grp-card tbody td[data-code]")].find(t => !t.classList.contains("week-sep") && !t.classList.contains("blk"));
        return { v: getComputedStyle(document.documentElement).getPropertyValue("--grid-v").trim().toUpperCase(), borde: td ? getComputedStyle(td).borderLeftColor : "",
          abajo: td ? getComputedStyle(td).borderBottomColor : "" };
      });
      const antes = await lineas(C);
      await AD.evaluate(() => { document.querySelectorAll(".palette-overlay.open").forEach(o => o.classList.remove("open"));
        (document.getElementById("btnColores") || document.getElementById("btnColors")).click();
        document.querySelector('[data-lineas="oscuro"]').click(); });
      const enAd = await AD.evaluate(() => ({ v: getComputedStyle(document.documentElement).getPropertyValue("--grid-v").trim().toUpperCase(),
        sel: document.querySelector('[data-lineas="oscuro"]').classList.contains("selected") }));
      chequear("el admin elige gris oscuro y lo ve en su celular", enAd.v === "#6B7280" && enAd.sel, enAd);
      chequear("los demás siguen en gris claro hasta que publique", antes.v === "#E5E7EB" && (await lineas(C)).v === "#E5E7EB", antes);
      await AD.evaluate(() => { window.confirm = () => true; window.alert = () => {};
        document.querySelectorAll(".palette-overlay.open").forEach(o => o.classList.remove("open"));
        document.getElementById("btnPublish").click(); });
      await wait(3500);
      const desp = await lineas(C);
      chequear("al publicar, los demás ven las líneas en gris oscuro", desp.v === "#6B7280" && desp.borde === "rgb(107, 114, 128)" && desp.abajo === "rgb(107, 114, 128)", desp);
      await AD.evaluate(() => { document.getElementById("btnColores") ? document.getElementById("btnColores").click() : document.getElementById("btnColors").click();
        document.querySelector('[data-lineas="claro"]').click();
        document.querySelectorAll(".palette-overlay.open").forEach(o => o.classList.remove("open"));
        document.getElementById("btnPublish").click(); });
      await wait(3500);
      chequear("y vuelven a gris claro si el admin lo cambia", (await lineas(C)).v === "#E5E7EB", await lineas(C));
    }

    if (html.includes("function autorizarPedido")) {
      console.log("\nDivisión: autoriza pedidos, pasa acordados a lo oficial y carga cambios de palabra");
      const DIVC = "division_" + APP;
      const idD = DE_PRUEBA.find(id => ![s.ida, s.idb, s.idc, idP, libre, libre2, DE_PRUEBA[14]].includes(id));
      const D = await cel("uDv", idD);
      const codDe = (id, di) => { const f = ((be.st[TURNOS] || {})[s.mes] || { people: [] }).people.find(p => String(p.id) === String(id));
        return f ? (Array.isArray(f.codes) ? f.codes : String(f.codes).split(/\s+/))[di] : undefined; };
      const esDiv = pg => pg.evaluate(() => ({ div: document.body.classList.contains("is-division"),
        pub: getComputedStyle(document.getElementById("btnPublicarDiv")).display !== "none",
        acu: getComputedStyle(document.getElementById("btnAcuerdos")).display !== "none" }));
      chequear("un registrado común no es División (sin ⬆ Publicar ni Acordados)", JSON.stringify(await esDiv(D)) === JSON.stringify({ div: false, pub: false, acu: false }), await esDiv(D));
      const dDen = (s.d + 9) % 28;
      const rechazo = await D.evaluate(([id, di]) => publicarCeldas([{ id, di, code: "MD" }], false).then(() => "ok", e => e.code), [s.idc, dDen]);
      chequear("Firebase no deja a un común publicar turnos", rechazo === "permission-denied", rechazo);
      // El admin lo hace División desde Celulares
      await AD.evaluate(id => { window.confirm = () => true; document.getElementById("btnCelulares").click();
        const row = [...document.querySelectorAll("#celularesList .acu-row")].find(r => r.textContent.includes(id));
        row.querySelector(".btn-div").click(); document.getElementById("closeCelulares").click(); }, idD);
      await wait(2500);
      chequear("queda guardado en " + DIVC, !!(be.st[DIVC] || {})[idD], be.st[DIVC]);
      chequear("ese celular pasa a ser División (⬆ Publicar y Acordados)", JSON.stringify(await esDiv(D)) === JSON.stringify({ div: true, pub: true, acu: true }), await esDiv(D));
      const nomD = await D.evaluate(() => miPersona().p.name);
      // Vista D: la División arranca en D y su botón pasa a I y vuelve (no ve la A)
      const vD = pg => pg.evaluate(() => { const b = document.getElementById("btnOriginalView");
        return { txt: b.textContent, vis: getComputedStyle(b).display !== "none", d: vistaD, modo: viewMode }; });
      const vd0 = await vD(D);
      chequear("la División arranca en la vista D", vd0.vis && vd0.txt === "D" && vd0.d && vd0.modo === "division", vd0);
      const ciclo = await D.evaluate(() => { const b = document.getElementById("btnOriginalView"); const r = [];
        for (let i = 0; i < 2; i++) { b.click(); r.push(b.textContent); } return r.join(""); });
      chequear("la División ve solo D → I (sin la A)", ciclo === "ID", ciclo);
      chequear("un común no tiene el botón de vistas", !(await vD(B)).vis);
      chequear("en D, el acuerdo de A y B (sin avalar) se marca como acordado",
        (await D.evaluate(([s]) => [cellMark(s.a, s.d), cellMark(s.b, s.d), document.querySelectorAll("td.dacordado").length > 0], [s])).join() === "dacu,dacu,true",
        await D.evaluate(([s]) => [cellMark(s.a, s.d), cellMark(s.b, s.d)], [s]));
      chequear("en D se ve el acuerdo de A y B cargado", JSON.stringify(await D.evaluate(([s]) => [codesFor(s.a)[s.d], codesFor(s.b)[s.d]], [s])) === JSON.stringify([s.y, s.x]),
        await D.evaluate(([s]) => [codesFor(s.a)[s.d], codesFor(s.b)[s.d]], [s]));
      // Fuera de los acuerdos, D es la inicial: no se ve lo que cada uno cambió por su cuenta
      const soloIni = await D.evaluate(() => { let distintas = 0, propiasFuera = 0;
        people.forEach((p, pi) => (INITIAL_CODES[pi] || []).forEach((c, di) => { if (D_KEYS[pi + ":" + di]) return;
          if ((codesFor(pi)[di] || "") !== (c || "")) distintas++;
          if ((p.codes[di] || "") !== (c || "")) propiasFuera++; }));
        return { distintas, propiasFuera }; });
      chequear("en D no se ven los cambios a mano de los usuarios (solo la inicial)", soloIni.distintas === 0 && soloIni.propiasFuera > 0, soloIni);
      const toqueD = await D.evaluate(([s]) => { const ov = document.getElementById("shiftOverlay");
        const td = document.querySelector('td[data-pi="' + s.a + '"][data-di="' + s.d + '"]'); td.click();
        const r = { picker: ov.classList.contains("open"), lista: document.getElementById("acuerdosOverlay").classList.contains("open"),
          filas: document.querySelectorAll("#acuerdosList .acu-row").length,
          botones: [...document.querySelectorAll("#acuerdosList button")].map(b => b.textContent) };
        document.getElementById("closeAcuerdos").click(); return r; }, [s]);
      chequear("en D, tocar la celda acordada abre solo ese cambio para avalarlo",
        !toqueD.picker && toqueD.lista && toqueD.filas === 1 && toqueD.botones.includes("Pasar a lo oficial") && toqueD.botones.includes("Ver todos"), toqueD);
      const mano = await D.evaluate(([s]) => { const ov = document.getElementById("shiftOverlay");
        document.querySelector('td[data-pi="' + s.a + '"][data-di="' + s.d + '"]').click();
        const b = [...document.querySelectorAll("#acuerdosList button")].find(x => /Cambiar a mano/.test(x.textContent)); if (b) b.click();
        const r = { boton: !!b, picker: ov.classList.contains("open"), lista: document.getElementById("acuerdosOverlay").classList.contains("open") };
        ov.classList.remove("open"); document.body.classList.remove("shift-open"); return r; }, [s]);
      chequear("y desde ahí se puede cambiar a mano", mano.boton && mano.picker && !mano.lista, mano);
      // A pide un cambio; la División lo autoriza sin contraparte
      const d6 = (s.d + 7) % 28;
      const quiere = await A.evaluate(([s, d6]) => { const t = actualDe(s.a, d6); const q = ["MD", "M", "N"].find(c => c !== t);
        pedTengoSel = t; guardarPedido(s.a, d6, [q]); closePedido(); return q; }, [s, d6]);
      await wait(1500);
      const pedId = s.mes + "_" + s.ida + "_" + (d6 + 1);
      // En D, el pedido sin acordar se marca en celeste (sin cambiar el turno) y al tocarlo se abre el pedido
      const enDPed = await D.evaluate(([s, d6]) => { const r = { m: cellMark(s.a, d6), igual: codesFor(s.a)[d6] === (INITIAL_CODES[s.a] || [])[d6],
          td: !!document.querySelector('td.dpedido[data-pi="' + s.a + '"][data-di="' + d6 + '"]') };
        document.querySelector('td[data-pi="' + s.a + '"][data-di="' + d6 + '"]').click();
        r.cuadro = document.getElementById("pedidoOverlay").classList.contains("open");
        r.picker = document.getElementById("shiftOverlay").classList.contains("open");
        r.mano = !!document.querySelector("#pedidoBody .ped-mano"); closePedido(); return r; }, [s, d6]);
      chequear("en D, el pedido sin acordar se ve en celeste y abre el pedido (con \"Cambiar a mano\")",
        enDPed.m === "dped" && enDPed.td && enDPed.igual && enDPed.cuadro && !enDPed.picker && enDPed.mano, enDPed);
      const caja = await D.evaluate(([s, d6]) => { openPedido(s.a, d6); const b = document.querySelector("#pedidoBody .ped-div button");
        return b ? b.textContent : ""; }, [s, d6]);
      chequear("en el pedido de A la División ve \"Autorizar\"", /Autorizar/.test(caja) && caja.indexOf(quiere) >= 0, caja);
      const cajaB = await B.evaluate(([s, d6]) => { openPedido(s.a, d6); const r = !!document.querySelector("#pedidoBody .ped-div"); closePedido(); return r; }, [s, d6]);
      chequear("un común no ve \"Autorizar\"", !cajaB);
      const opF = await D.evaluate(([s, d6]) => opcionesAutorizar({ ofrece: "T", acepta: ["F"], francos: [d6 + 3] }, s.a, d6), [s, d6]);
      chequear("si ofrece un franco, autorizar da F ese día y su turno el día del franco",
        opF.length === 1 && opF[0].code === "F" && JSON.stringify(opF[0].cambios) === JSON.stringify([{ di: d6, code: "F" }, { di: d6 + 2, code: "T" }]), opF);
      await D.evaluate(() => document.querySelector("#pedidoBody .ped-div button").click());
      await wait(3000);
      chequear("lo autorizado pasa a lo oficial (Firebase)", codDe(s.ida, d6) === quiere, codDe(s.ida, d6));
      const pp = (((be.st[TURNOS] || {})[s.mes] || {}).publicadoPor || {})[s.ida + ":" + d6];
      chequear("queda anotado quién lo autorizó", !!pp && pp.n === nomD && pp.a === 1, pp);
      const peds = be.st["pedidos_" + APP] || {};
      chequear("el pedido se cierra como autorizado", !peds[pedId] && Object.values(peds).some(x => x.estado === "autorizado" && x.id === s.ida && x.dia === d6 + 1), Object.keys(peds));
      chequear("C lo ve", (await C.evaluate(([s, d6]) => people[s.a].codes[d6], [s, d6])) === quiere);
      chequear("en D, lo autorizado se marca como avalado", (await D.evaluate(([s, d6]) => cellMark(s.a, d6), [s, d6])) === "daval");
      // Lo avalado NO queda trabado: el dueño lo puede cambiar, pedir cambio ese día y responder "Me sirve" (sin mencionar a la División)
      const traba = await A.evaluate(([s, d6]) => { const ov = document.getElementById("shiftOverlay"); const antes = people[s.a].codes[d6];
        openShiftPicker(s.a, d6); const abre = ov.classList.contains("open"); ov.classList.remove("open");
        setPedidosMode(true); bancoDiaSel = d6; renderBancoDia(); const pedir = !!document.getElementById("bancoPedir"); setPedidosMode(false);
        openPedido(s.a, d6); const cuadro = document.getElementById("pedidoOverlay").classList.contains("open"); closePedido();
        return { abre, pedir, cuadro, igual: people[s.a].codes[d6] === antes }; }, [s, d6]);
      chequear("el dueño puede cambiar y pedir cambio en un turno avalado", traba.abre && traba.pedir && traba.cuadro && traba.igual, traba);
      const pidC = await C.evaluate(d6 => { const me = miPersona(); pedTengoSel = actualDe(me.pi, d6);
        guardarPedido(me.pi, d6, ["*"]); closePedido(); return me.pi; }, d6);
      await wait(1500);
      const resp = await A.evaluate(([pi, d6]) => { openPedido(pi, d6); const t = document.getElementById("pedidoBody").innerText;
        const b = [...document.querySelectorAll("#pedidoBody button")].some(x => x.textContent === "Me sirve"); closePedido(); return { t, b }; }, [pidC, d6]);
      chequear("y puede responder \"Me sirve\" con un turno avalado", resp.b && !/avalado|Divisi/.test(resp.t), resp);
      await C.evaluate(d6 => quitarPedidoDoc(miPersona().pi, d6), d6);
      await wait(1000);
      const admEd = await AD.evaluate(([s, d6]) => { const ov = document.getElementById("shiftOverlay"); openShiftPicker(s.a, d6);
        const r = ov.classList.contains("open"); ov.classList.remove("open"); return r; }, [s, d6]);
      chequear("el admin sí lo puede cambiar", admEd);
      const avZ = await A.evaluate(() => { revisarAvisos(); return document.getElementById("avisosList").innerText; });
      chequear("a A le llega \"Autorizado por la División\" con el nombre", /Autorizado por la División/.test(avZ) && avZ.indexOf(nomD) >= 0, avZ);
      await A.evaluate(() => cerrarAvisos());
      const enBanco = await A.evaluate(d6 => { setPedidosMode(true); bancoDiaSel = d6; renderBancoDia(); const t = document.getElementById("bancoDia").innerText; setPedidosMode(false); return t; }, d6);
      chequear("en el banco, ese día A ve que se lo autorizaron", /Autorizado por la División/.test(enBanco), enBanco);
      // La División pasa a lo oficial el acuerdo de A y B, tocando la celda en la vista D
      await D.evaluate(([s]) => document.querySelector('td[data-pi="' + s.a + '"][data-di="' + s.d + '"]').click(), [s]);
      const bo = await D.evaluate(() => [...document.querySelectorAll("#acuerdosList button")].map(b => b.textContent));
      chequear("en Acordados la División tiene \"Pasar a lo oficial\"", bo.includes("Pasar a lo oficial"), bo);
      await D.evaluate(() => { [...document.querySelectorAll("#acuerdosList button")].find(b => b.textContent === "Pasar a lo oficial").click(); });
      await wait(3000);
      chequear("el acuerdo queda en lo oficial (las dos filas)", codDe(s.ida, s.d) === s.y && codDe(s.idb, s.d) === s.x, [codDe(s.ida, s.d), codDe(s.idb, s.d)]);
      const acu = Object.values(be.st["pedidos_" + APP] || {}).find(x => x.estado === "acordado" && x.id === s.ida && x.dia === s.d + 1);
      chequear("el acuerdo queda como pasado por la División", !!acu && acu.pasado === true && acu.pasadoPor === nomD, acu);
      chequear("en D, el acuerdo pasado a lo oficial pasa a avalado (en otro color)",
        (await D.evaluate(([s]) => [cellMark(s.a, s.d), cellMark(s.b, s.d), document.querySelectorAll("td.davalado").length > 0], [s])).join() === "daval,daval,true",
        await D.evaluate(([s]) => [cellMark(s.a, s.d), cellMark(s.b, s.d)], [s]));
      const avP = await B.evaluate(() => { revisarAvisos(); return document.getElementById("avisosList").innerText; });
      chequear("a B le llega que la División lo pasó a lo oficial", /La División/.test(avP) && /pasó a la programación oficial/.test(avP), avP);
      await B.evaluate(() => cerrarAvisos());
      // Se cierra el cambio de esa celda y se abre la lista completa de Acordados
      await D.evaluate(() => { document.getElementById("closeAcuerdos").click(); document.getElementById("btnAcuerdos").click(); });
      // La División imprime el ticket del acuerdo: uno solo, que firman los dos y se lo presentan
      const tk = await D.evaluate(([s]) => {
        let impreso = 0; const orig = window.print; window.print = () => { impreso++; };
        renderAcuerdos();
        const b = [...document.querySelectorAll("#acuerdosList button")].find(x => /Ticket/.test(x.textContent));
        if (b) b.click();
        return new Promise(r => setTimeout(() => {
          const box = document.getElementById("ticketPrint");
          const copias = box ? [...box.querySelectorAll(".tk")].map(x => x.innerText) : [];
          window.print = orig; window.dispatchEvent(new Event("afterprint"));
          r({ boton: !!b, impreso, copias, a: people[s.a].name, b: people[s.b].name });
        }, 200));
      }, [s]);
      chequear("en Acordados la División tiene \"🖨 Ticket\" y manda a imprimir", tk.boton && tk.impreso === 1, tk);
      chequear("el ticket sale en una sola copia, con la firma de los dos (no de la División)", tk.copias.length === 1 &&
        tk.copias[0].indexOf("Firma " + tk.a) >= 0 && tk.copias[0].indexOf("Firma " + tk.b) >= 0 && !/Firma División/.test(tk.copias[0]) &&
        /FIRMADO POR LOS DOS/.test(tk.copias[0]), tk.copias);
      // La División rechaza un acuerdo (con motivo): los dos vuelven a lo oficial y les llega el aviso
      const dR = await A.evaluate(([s]) => { for (let o = 22; o < 28; o++) { const d = (s.d + o) % 28;
        const x = actualDe(s.a, d), y = actualDe(s.b, d);
        if (trabaja(x) && trabaja(y) && x !== y && !esLicencia(s.a, d) && !esLicencia(s.b, d) && !diaPasado(d)) return d; } return -1; }, [s]);
      if (dR < 0) chequear("hay un día para probar el rechazo", false);
      else {
        const [xR, yR] = await A.evaluate(([s, d]) => [actualDe(s.a, d), actualDe(s.b, d)], [s, dR]);
        await A.evaluate(([s, d, y]) => { pedTengoSel = actualDe(s.a, d); guardarPedido(s.a, d, [y]); closePedido(); }, [s, dR, yR]);
        await wait(1000);
        await B.evaluate(([s, d]) => { responderPedido(s.a, d, true); closePedido(); }, [s, dR]);
        await wait(1000);
        await A.evaluate(([s, d]) => { const r = pedidoDe(people[s.a].id, d).respuestas[s.idb]; confirmarAcuerdo(s.a, d, r); }, [s, dR]);
        await wait(3000);
        chequear("(rechazo) el acuerdo nuevo lo ve un tercero", (await C.evaluate(([s, d]) => people[s.a].codes[d] + "/" + people[s.b].codes[d], [s, dR])) === yR + "/" + xR);
        const btR = await D.evaluate(() => { renderAcuerdos(); return [...document.querySelectorAll("#acuerdosList button")].map(b => b.textContent); });
        chequear("en Acordados la División tiene \"Rechazar\"", btR.includes("Rechazar"), btR);
        await D.evaluate(([s, d]) => { const k = Object.keys(pedidosDocs).find(k => { const a = pedidosDocs[k];
          return a && a.estado === "acordado" && String(a.id) === s.ida && a.dia === d + 1; });
          const orig = window.prompt; window.prompt = () => "Falta personal ese turno"; rechazarAcuerdo(k, pedidosDocs[k]); window.prompt = orig; }, [s, dR]);
        await wait(3500);
        const docR = Object.values(be.st["pedidos_" + APP] || {}).find(x => x.id === s.ida && x.dia === dR + 1 && x.con);
        chequear("el acuerdo queda rechazado con el motivo y quién", !!docR && docR.estado === "rechazado" && docR.rechazo && docR.rechazo.motivo === "Falta personal ese turno" && docR.rechazo.por === nomD, docR);
        const verR = pg => pg.evaluate(([s, d]) => people[s.a].codes[d] + "/" + people[s.b].codes[d], [s, dR]);
        chequear("A y B vuelven a su turno oficial (en sus celulares y para un tercero)",
          (await verR(A)) === xR + "/" + yR && (await verR(B)) === xR + "/" + yR && (await verR(C)) === xR + "/" + yR, [await verR(A), await verR(B), await verR(C)]);
        const avR = await B.evaluate(() => { revisarAvisos(); return document.getElementById("avisosList").innerText; });
        chequear("a B le llega que la División lo rechazó, con el motivo", /rechazó tu cambio/.test(avR) && /Falta personal/.test(avR), avR);
        await B.evaluate(() => cerrarAvisos());
        const avRA = await AD.evaluate(() => avisosAdmin().map(a => a.txt).join(" | "));
        chequear("al admin le llega que la División rechazó un cambio", /rechazó el cambio/.test(avRA), avRA);
        chequear("A puede volver a pedir cambio ese día", await A.evaluate(([s, d]) => !pedidoDe(people[s.a].id, d) && marcasCerrados()[s.a + ":" + d] !== "daval" && acordadosDelDia(d).length === 0, [s, dR]));
      }
      await D.evaluate(() => document.getElementById("closeAcuerdos").click());
      // La División cambia a mano un turno de otro en la D y lo publica con su ⬆ Publicar
      const d7 = (s.d + 15) % 28;
      const ofi7 = codDe(s.idc, d7);
      const nuevo7 = await D.evaluate(([s, d7]) => { const t = ORIGINAL_CODES[s.c][d7]; const n = ["MD", "M", "N"].find(c => c !== t);
        const td = document.querySelector('td[data-pi="' + s.c + '"][data-di="' + d7 + '"]'); td.click();
        if (!document.getElementById("shiftOverlay").classList.contains("open")) return "no abrió en D";
        applyShift(n); document.getElementById("closeShift").click(); return n; }, [s, d7]);
      await wait(1500);
      chequear("antes de publicar, lo ve solo ella (en ámbar en la D)", codDe(s.idc, d7) === ofi7 && (await D.evaluate(([s, d7]) => cellMark(s.c, d7), [s, d7])) === "own" &&
        (await B.evaluate(([s, d7]) => people[s.c].codes[d7], [s, d7])) !== nuevo7, codDe(s.idc, d7));
      const btxt = await D.evaluate(() => document.getElementById("btnPublicarDiv").textContent);
      chequear("⬆ Publicar de la División cuenta lo que cambió", /⬆ 1$/.test(btxt), btxt);
      await D.evaluate(() => { window.confirm = () => true; document.getElementById("btnPublicarDiv").click(); });
      await wait(3000);
      chequear("lo que publica la División queda en lo oficial", codDe(s.idc, d7) === nuevo7, codDe(s.idc, d7));
      chequear("B lo ve", (await B.evaluate(([s, d7]) => people[s.c].codes[d7], [s, d7])) === nuevo7);
      // Cambio de palabra: con contraparte (A y C intercambian) y sin contraparte (C pasa a otro turno)
      const d8 = (s.d + 17) % 28, d9 = (s.d + 19) % 28;
      const antes8 = [codDe(s.ida, d8), codDe(s.idc, d8)];
      const pal1 = await D.evaluate(([s, d8]) => { setPedidosMode(true); bancoDiaSel = d8; renderBancoDia();
        const b = document.getElementById("bancoPalabra"); if (!b) return "sin botón"; b.click();
        const sa = document.getElementById("palabraA"), sb = document.getElementById("palabraB");
        sa.value = String(s.a); sa.dispatchEvent(new Event("change")); sb.value = String(s.c); sb.dispatchEvent(new Event("change"));
        const r = document.getElementById("palabraRes").innerText; document.getElementById("okPalabra").click(); return r; }, [s, d8]);
      await wait(3000);
      chequear("la División carga un cambio de palabra entre dos (intercambian el turno)", antes8[0] !== antes8[1] ?
        codDe(s.ida, d8) === antes8[1] && codDe(s.idc, d8) === antes8[0] : true, { pal1, antes8, despues: [codDe(s.ida, d8), codDe(s.idc, d8)] });
      const antes9 = codDe(s.idc, d9);
      const quiere9 = ["MD", "M", "N"].find(c => c !== antes9);
      await D.evaluate(([s, d9, q]) => { bancoDiaSel = d9; renderBancoDia(); document.getElementById("bancoPalabra").click();
        const sa = document.getElementById("palabraA"); sa.value = String(s.c); sa.dispatchEvent(new Event("change"));
        [...document.querySelectorAll("#palabraTurno .shift-option")].find(o => o.textContent === q).click();
        document.getElementById("okPalabra").click(); setPedidosMode(false); }, [s, d9, quiere9]);
      await wait(3000);
      chequear("y uno sin contraparte (pasa al turno elegido)", codDe(s.idc, d9) === quiere9, codDe(s.idc, d9));
      const enD = await D.evaluate(([s, d7, d9]) => { ponerVista("division"); refreshAfterEdit();
        return { pal: codesFor(s.c)[d9], mk: cellMark(s.c, d9), ajena: codesFor(s.c)[d7], mkA: cellMark(s.c, d7) }; }, [s, d7, d9]);
      chequear("en D se ve el cambio de palabra como avalado (verde)", enD.pal === quiere9 && enD.mk === "daval", enD);
      chequear("en D se ve lo que la División publicó a mano (en verde)", enD.ajena === nuevo7 && enD.mkA === "daval", enD);
      const avPal = await C.evaluate(() => { revisarAvisos(); return document.getElementById("avisosList").innerText; });
      chequear("a C le llegan los dos avisos de palabra", /cargó tu cambio de palabra/.test(avPal) && /tu cambio de palabra/.test(avPal.replace(/cargó tu cambio de palabra/, "")), avPal);
      await C.evaluate(() => cerrarAvisos());
      const cB = await B.evaluate(() => { const ov = document.getElementById("bancoPalabra"); return !!ov; });
      chequear("un común no tiene \"Cambio de palabra\"", !cB && !(await B.evaluate(d => { setPedidosMode(true); bancoDiaSel = d; renderBancoDia(); const r = !!document.getElementById("bancoPalabra"); setPedidosMode(false); return r; }, d8)));
      const docM = (be.st[TURNOS] || {})[s.mes];
      chequear("la División no toca nada más del mes (gente, inicial)", docM.people.length === M0.people.length && Array.isArray(docM.inicial) && docM.inicial.length === M0.people.length);
      const avAdD = await AD.evaluate(() => { revisarAvisos(); return document.getElementById("avisosOverlay").classList.contains("open") ? document.getElementById("avisosList").innerText : ""; });
      chequear("al admin le llega lo que hizo la División", /\(División\) autorizó/.test(avAdD) && /\(División\) pasó a lo oficial un cambio acordado/.test(avAdD) && /\(División\) cargó un cambio de palabra/.test(avAdD) && /\(División\) publicó/.test(avAdD), avAdD);
      await AD.evaluate(() => cerrarAvisos());
      // Varios usuarios en la PC de la División, cada uno con su clave, e historial solo para el admin
      if (html.includes("function revisarOperador")) {
        const HIST = "historial_" + APP;
        const agregarOp = (leg, nom, clave) => AD.evaluate(([id, leg, nom, clave]) => { document.getElementById("btnCelulares").click();
          const row = [...document.querySelectorAll("#celularesList .acu-row")].find(r => r.textContent.includes(id));
          row.querySelector(".btn-ops").click();
          document.getElementById("opsLegajo").value = leg; document.getElementById("opsNombre").value = nom; document.getElementById("opsClave").value = clave;
          document.getElementById("opsAgregar").click(); }, [idD, leg, nom, clave]);
        await agregarOp("", "OPERADOR, UNO", "1234");
        await wait(1500);
        await agregarOp("", "OPERADOR, DOS", "5678");
        await wait(1500);
        await AD.evaluate(() => { document.getElementById("closeOps").click(); document.getElementById("closeCelulares").click(); });
        const opsG = ((be.st[DIVC] || {})[idD] || {}).ops || {};
        chequear("el admin carga dos usuarios con clave en la PC de la División (sin guardar la clave)", Object.keys(opsG).length === 2 &&
          !JSON.stringify(opsG).includes("1234") && Object.values(opsG).every(o => o.h), opsG);
        const lock = () => D.evaluate(() => ({ open: document.getElementById("opOverlay").classList.contains("open"),
          nombres: [...document.querySelectorAll("#opLista .op-nombre")].map(b => b.textContent),
          btn: getComputedStyle(document.getElementById("btnOperador")).display !== "none" ? document.getElementById("btnOperador").textContent : "" }));
        const l0 = await lock();
        chequear("la PC de la División pregunta quién la está usando", l0.open && l0.nombres.length === 2 && !l0.btn, l0);
        const mal = await D.evaluate(async () => { [...document.querySelectorAll("#opLista .op-nombre")].find(b => /UNO/.test(b.textContent)).click();
          document.getElementById("opClave").value = "9999"; await entrarOp();
          return { msg: document.getElementById("opClaveMsg").textContent, open: document.getElementById("opOverlay").classList.contains("open") }; });
        chequear("con la clave equivocada no entra", /incorrecta/.test(mal.msg) && mal.open, mal);
        const CLV = "claves_" + APP;
        // Elegir la clave secreta (la primera vez, con la provisoria)
        const elegir = (n1, n2) => D.evaluate(async ([n1, n2]) => { document.getElementById("opNueva1").value = n1; document.getElementById("opNueva2").value = n2;
          await guardarNuevaClave(); return { msg: document.getElementById("opNuevaMsg").textContent, open: document.getElementById("opNuevaOverlay").classList.contains("open") }; }, [n1, n2]);
        const prov = await D.evaluate(async () => { document.getElementById("opClave").value = "1234"; await entrarOp();
          return { nueva: document.getElementById("opNuevaOverlay").classList.contains("open"), dentro: !!opActual }; });
        chequear("con la clave provisoria le pide elegir su clave secreta (todavía no entró)", prov.nueva && !prov.dentro, prov);
        const e1 = await elegir("4321", "4322");
        chequear("si las dos claves nuevas no coinciden, avisa", e1.open && /no son iguales/.test(e1.msg), e1);
        const e2 = await elegir("1234", "1234");
        chequear("no deja quedarse con la provisoria", e2.open && /distinta/.test(e2.msg), e2);
        await elegir("4321", "4321");
        await wait(1000);
        const l1 = await lock();
        chequear("con su clave elegida entra y arriba dice quién es", !l1.open && /OPERADOR/.test(l1.btn), l1);
        chequear("su clave queda guardada en " + CLV + " (sin la clave a la vista)", Object.keys(be.st[CLV] || {}).length === 1 && !JSON.stringify(be.st[CLV]).includes("4321"), be.st[CLV]);
        chequear("lo que hace queda a su nombre", (await D.evaluate(() => nombreAutorizante())) === "OPERADOR, UNO");
        const d10 = (s.d + 23) % 28;
        await D.evaluate(([s, d10]) => { const t = ORIGINAL_CODES[s.c][d10]; const n = ["MD", "M", "N"].find(c => c !== t && c !== people[s.c].codes[d10]);
          document.querySelector('td[data-pi="' + s.c + '"][data-di="' + d10 + '"]').click(); applyShift(n); document.getElementById("closeShift").click();
          window.confirm = () => true; document.getElementById("btnPublicarDiv").click(); }, [s, d10]);
        await wait(3000);
        const pp = (((be.st[TURNOS] || {})[s.mes] || {}).publicadoPor || {})[s.idc + ":" + d10] || {};
        chequear("lo publicado a mano queda firmado por ese usuario", pp.n === "OPERADOR, UNO", pp);
        const hist = () => Object.values(be.st[HIST] || {});
        chequear("en el historial queda que entró y lo que publicó", hist().some(h => h.tipo === "entra" && h.op === "OPERADOR, UNO") &&
          hist().some(h => h.tipo === "publica" && h.op === "OPERADOR, UNO"), hist());
        const leeD = await D.evaluate(() => fbDb.collection(HIST_COLLECTION).get().then(() => "ok", e => e.code));
        chequear("la División no puede leer el historial (solo el admin)", leeD === "permission-denied", leeD);
        const tramposo = await B.evaluate(() => fbDb.collection(HIST_COLLECTION).doc("x").set({ t: 1, op: "X", uid: fbAuth.currentUser.uid }).then(() => "ok", e => e.code));
        chequear("un común no puede escribir en el historial", tramposo === "permission-denied", tramposo);
        // 15 minutos sin usar la PC: se cierra sola
        await D.evaluate(() => { opActual.ult = Date.now() - 16 * 60 * 1000; revisarOperador(); });
        await wait(800);
        const l2 = await lock();
        chequear("a los 15 minutos sin usarla se cierra sola", l2.open && !l2.btn && !(await D.evaluate(() => localStorage.getItem(OP_KEY))), l2);
        chequear("y queda en el historial", hist().some(h => h.tipo === "auto" && h.op === "OPERADOR, UNO"));
        // Entra el otro y cierra la sesión a mano
        await D.evaluate(async () => { [...document.querySelectorAll("#opLista .op-nombre")].find(b => /DOS/.test(b.textContent)).click();
          document.getElementById("opClave").value = "5678"; await entrarOp(); });
        await elegir("8765", "8765");
        await wait(800);
        chequear("entra el otro usuario con su clave", /OPERADOR/.test((await lock()).btn) && (await D.evaluate(() => nombreAutorizante())) === "OPERADOR, DOS");
        await D.evaluate(() => { document.getElementById("btnOperador").click(); document.getElementById("opMenuSalir").click(); });
        await wait(800);
        chequear("al cerrar la sesión vuelve a preguntar", (await lock()).open && hist().some(h => h.tipo === "sale" && h.op === "OPERADOR, DOS"));
        // Con la provisoria ya no entra; con la suya entra directo
        const entra = clave => D.evaluate(async c => { [...document.querySelectorAll("#opLista .op-nombre")].find(b => /UNO/.test(b.textContent)).click();
          document.getElementById("opClave").value = c; await entrarOp();
          return { msg: document.getElementById("opClaveMsg").textContent, dentro: !!opActual, nueva: document.getElementById("opNuevaOverlay").classList.contains("open") }; }, clave);
        const r1 = await entra("1234");
        chequear("la provisoria deja de valer cuando eligió la suya", !r1.dentro && /incorrecta/.test(r1.msg) && !r1.nueva, r1);
        await D.evaluate(() => { document.getElementById("opVolver").click(); });
        const r2 = await entra("4321");
        chequear("con su clave secreta entra directo", r2.dentro && !r2.nueva, r2);
        // Cambia su clave desde el botón 👤
        const cam = await D.evaluate(async () => { document.getElementById("btnOperador").click(); document.getElementById("opMenuClave").click();
          document.getElementById("opNuevaActual").value = "0000"; document.getElementById("opNueva1").value = "1357"; document.getElementById("opNueva2").value = "1357";
          await guardarNuevaClave(); const mal = document.getElementById("opNuevaMsg").textContent;
          document.getElementById("opNuevaActual").value = "4321"; await guardarNuevaClave();
          return { mal, open: document.getElementById("opNuevaOverlay").classList.contains("open") }; });
        await wait(800);
        chequear("puede cambiar su clave (pide la de ahora)", /no es esa/.test(cam.mal) && !cam.open && hist().some(h => h.tipo === "clave" && h.op === "OPERADOR, UNO"), cam);
        // Se olvidó la clave: el admin le da una provisoria nueva y lo saca de la PC
        await AD.evaluate(async id => { window.prompt = () => "2468"; document.getElementById("btnCelulares").click();
          const row = [...document.querySelectorAll("#celularesList .acu-row")].find(r => r.textContent.includes(id)); row.querySelector(".btn-ops").click();
          await new Promise(r => setTimeout(r, 800));
          const fila = [...document.querySelectorAll("#opsList .acu-row")].find(r => /UNO/.test(r.textContent));
          fila.querySelector("button").click(); }, idD);
        await wait(2000);
        const est = await AD.evaluate(() => { const t = document.getElementById("opsList").innerText; document.getElementById("closeOps").click(); document.getElementById("closeCelulares").click(); return t; });
        const l3 = await lock();
        chequear("con una provisoria nueva del admin, la sesión se cierra y la clave vieja deja de valer", l3.open && Object.keys(be.st[CLV] || {}).length === 1 && /provisoria/.test(est), { l3, est });
        const r3 = await entra("2468");
        chequear("y con la provisoria nueva vuelve a elegir la suya", !r3.dentro && r3.nueva, r3);
        await D.evaluate(() => document.getElementById("opNuevaCancelar").click());
        const roba = await B.evaluate(() => fbDb.collection(CLAVES_COLLECTION).doc("x_u1").set({ h: "x", k: "u1", v: "", uid: fbAuth.currentUser.uid, t: 1 }).then(() => "ok", e => e.code));
        chequear("un común no puede guardar claves", roba === "permission-denied", roba);
        const hv = await AD.evaluate(async () => { document.getElementById("btnCelulares").click(); await abrirHistorial();
          const r = { txt: document.getElementById("histList").innerText, ops: [...document.querySelectorAll("#histPersona option")].map(o => o.value) };
          document.getElementById("histPersona").value = "OPERADOR, DOS"; renderHistorial();
          r.filtrado = document.getElementById("histList").innerText;
          document.getElementById("closeHist").click(); document.getElementById("closeCelulares").click(); return r; });
        chequear("el admin ve el historial y lo puede filtrar por persona", /OPERADOR, UNO/.test(hv.txt) && /Publicó a mano/.test(hv.txt) && /Se cerró sola/.test(hv.txt) &&
          hv.ops.includes("OPERADOR, DOS") && !/OPERADOR, UNO/.test(hv.filtrado) && /Cerró la sesión/.test(hv.filtrado), hv);
      }
      // El admin le saca la División
      await AD.evaluate(id => { document.getElementById("btnCelulares").click();
        const row = [...document.querySelectorAll("#celularesList .acu-row")].find(r => r.textContent.includes(id));
        row.querySelector(".btn-div").click(); document.getElementById("closeCelulares").click(); }, idD);
      await wait(2000);
      chequear("al sacarle la División deja de serlo", !(await esDiv(D)).div && !(be.st[DIVC] || {})[idD]);
      if (html.includes("function revisarOperador"))
        chequear("y ya no pregunta quién usa la PC", !(await D.evaluate(() => document.getElementById("opOverlay").classList.contains("open"))));
      const vd1 = await vD(D);
      chequear("y vuelve a la vista normal (sin botón de vistas)", !vd1.vis && !vd1.d && vd1.modo === "actual", vd1);
      await D.close();
    }

    if (html.includes("function codigosIniciales")) {
      console.log("\nHoras extras programadas: salen de la inicial (no de lo publicado)");
      const docT = (be.st[TURNOS] || {})[s.mes];
      const filaIni = docT.inicial.find(p => String(p.id) === s.idb), filaOfi = docT.people.find(p => String(p.id) === s.idb);
      const dIni = filaIni.codes.findIndex((c, i) => c !== filaOfi.codes[i]);
      const r = await C.evaluate(([id, di]) => ({ ini: codesInMonth(currentMes, id, "inicial")[di], ofi: codesInMonth(currentMes, id, "oficial")[di] }), [s.idb, dIni]);
      chequear("lo publicado cambia lo oficial pero no lo programado (inicial)", dIni >= 0 && r.ini === filaIni.codes[dIni] && r.ofi === filaOfi.codes[dIni] && r.ini !== r.ofi, { dIni, r });
      chequear("el resumen del almanaque usa la inicial", /overtimePeriod\(id, "inicial"\)/.test(html));
    }

    console.log("\nCuántas veces se abre la app (Celulares)");
    const YOC = "yo_" + APP;
    const abC = () => Number(((be.st[YOC] || {})["uC"] || {}).ab) || 0;
    const ab0 = abC();
    await C.reload(); await wait(2500);
    const ab1 = abC();
    await C.evaluate(() => sessionStorage.setItem("recargaAuto", "1")); await C.reload(); await wait(2500);
    const ab2 = abC();
    chequear("al abrir la app anota el aparato al día (para ver si está instalada)", typeof ((be.st[YOC] || {})["uC"] || {}).disp === "string" && / · /.test(be.st[YOC]["uC"].disp), ((be.st[YOC] || {})["uC"] || {}).disp);
    chequear("al abrir la app suma 1 (y guarda cuándo)", ab0 >= 1 && ab1 === ab0 + 1 && ((be.st[YOC] || {})["uC"] || {}).ult > 0, { ab0, ab1 });
    chequear("la recarga automática no cuenta", ab2 === ab1, { ab1, ab2 });
    // Caso Tevez: la deja abierta, se recarga sola mientras está guardada y vuelve horas después: tiene que contar
    const ocKey = await C.evaluate(() => PROP_PREF + "EnUsoHasta");
    await C.evaluate(k => { localStorage.setItem(k, String(Date.now() - 2 * 3600000)); sessionStorage.setItem("recargaAuto", "1"); }, ocKey);
    await C.reload(); await wait(2500);
    const ab3 = abC();
    chequear("si se recargó sola estando guardada, al volver horas después cuenta", ab3 === ab2 + 1, { ab2, ab3 });
    const ab4 = await C.evaluate(async k => {
      const ocultar = h => { Object.defineProperty(document, "hidden", { configurable: true, get: () => h }); document.dispatchEvent(new Event("visibilitychange")); };
      ocultar(true); ocultar(false); // la guarda y vuelve enseguida: no cuenta
      await new Promise(r => setTimeout(r, 800));
      ocultar(true); localStorage.setItem(k, String(Date.now() - 31 * 60000)); ocultar(false); // volvió a los 31 min: cuenta
      await new Promise(r => setTimeout(r, 800));
      delete document.hidden;
      return 0;
    }, ocKey).then(() => wait(1000)).then(() => abC());
    chequear("volver enseguida no cuenta; volver a los 30 min sí", ab4 === ab3 + 1, { ab3, ab4 });
    // iPhone: la congela sin avisar que se guardó; al despertar, el reloj (o el foco) ve que pasaron 30 min
    const ab5 = await C.evaluate(async k => {
      localStorage.setItem(k, String(Date.now() - 45 * 60000)); window.dispatchEvent(new Event("focus"));
      await new Promise(r => setTimeout(r, 800));
      window.dispatchEvent(new Event("focus")); // otra vez enseguida: no cuenta de nuevo
      return 0;
    }, ocKey).then(() => wait(1000)).then(() => abC());
    chequear("si el celular la congeló sin avisar, al volver a los 30 min cuenta (una sola vez)", ab5 === ab4 + 1, { ab4, ab5 });
    await C.evaluate(() => sessionStorage.setItem("recargaAuto", "1")); await C.reload(); await wait(2500);
    chequear("la recarga automática con la app en uso sigue sin contar", abC() === ab5, { ab5, ab6: abC() });
    const usoAd = await AD.evaluate(id => {
      renderCelulares();
      const fila = [...document.querySelectorAll("#celularesList .acu-row")].find(r => r.textContent.includes(id));
      const visible = () => getComputedStyle(document.getElementById("celularesUso")).display !== "none" &&
        [...document.querySelectorAll("#celularesList .cel-uso")].every(e => getComputedStyle(e).display !== "none");
      const r = { resumen: document.getElementById("celularesUso").textContent, fila: fila ? fila.querySelector(".cel-uso").textContent : "" };
      if (document.getElementById("btnVerUso")) {
        r.oculto = !visible(); document.getElementById("btnVerUso").click(); r.alPedir = visible();
        document.getElementById("btnVerUso").click(); r.otraVez = !visible();
      }
      document.getElementById("celularesOverlay").classList.remove("open");
      return r;
    }, s.idc);
    chequear("el admin ve en Celulares cuántas veces la abrió cada uno", /^Abrió \d+ veces · última: hoy/.test(usoAd.fila) && /hoy \d+ .*Aperturas en total: \d+/.test(usoAd.resumen), usoAd);
    if ("oculto" in usoAd) chequear("el uso se ve solo cuando el admin toca 📊 (todos juntos) y se vuelve a ocultar", usoAd.oculto && usoAd.alPedir && usoAd.otraVez, usoAd);
    chequear("el admin no suma aperturas", !((be.st[YOC] || {})["uAd"] || {}).ab);
    // Usos nuevos desde la última vez que el admin miró: arriba y en verde; después vuelven a su lugar
    const abrirCel = () => AD.evaluate(() => {
      const ov = document.getElementById("celularesOverlay");
      document.getElementById("btnCelulares").click();
      const oculto = !ov.classList.contains("ver-uso");
      document.getElementById("btnVerUso").click();
      const filas = [...document.querySelectorAll("#celularesList .acu-row")]
        .filter(r => !/nuevo<|⚠/.test(r.innerHTML.replace(/uso-nuevo/g, "")));
      const r = filas.map(f => ({ t: f.textContent, v: f.classList.contains("uso-nuevo") }));
      if (!oculto) r.push({ t: "el uso no arrancó oculto", v: "mal" });
      document.getElementById("closeCelulares").click();
      return r;
    });
    await abrirCel();
    await C.reload(); await wait(2500);
    const conNuevo = await abrirCel(), despues = await abrirCel();
    const filaC = conNuevo.find(f => f.t.includes(s.idc));
    const primeroArriba = conNuevo.findIndex(f => !f.v) === -1 || conNuevo.findIndex(f => !f.v) > conNuevo.map(f => f.v).lastIndexOf(true);
    chequear("los usos nuevos aparecen arriba y en verde (+1 uso)", !!filaC && filaC.v && /\+1 uso/.test(filaC.t) && primeroArriba, conNuevo);
    chequear("una vez vistos vuelven a su lugar (orden alfabético)", despues.every(f => !f.v), despues);
    chequear("al abrir Celulares el uso siempre arranca oculto", ![...conNuevo, ...despues].some(f => f.v === "mal"));

    console.log("\nCelular que perdió su registro: pide entrar y el admin se lo pasa");
    const LEGC = "legajos_" + APP;
    const NV = await be.celular(browser, URL, "uNuevo", null, errores);
    await wait(1000);
    await NV.fill("#yoLegajo", s.idc); await NV.click("#yoLegajoBtn"); await wait(800);
    await NV.click("#yoLegajoSi"); await wait(2500);
    const nv = await NV.evaluate(() => ({ leg: miLegajo, msg: document.getElementById("yoLegajoMsg").textContent }));
    const yoNV = (be.st[YOC] || {}).uNuevo || {};
    chequear("si su legajo está en otro celular, no lo registra y le dice que ya avisó", !nv.leg && /avisamos al administrador/.test(nv.msg), nv);
    chequear("le queda el pedido al admin (sin quedar registrado)", yoNV.pide === s.idc && !yoNV.id && !(await veDatos(NV)), yoNV);
    const vePaso = await AD.evaluate(id => {
      renderCelulares(); updateCelularesBtn();
      const box = document.getElementById("pasosList");
      return { pide: box.textContent.includes(id) && /Pide entrar/.test(box.textContent),
        boton: /pide entrar/.test(document.getElementById("btnCelulares").textContent),
        sinFilaRara: !/undefined/.test(document.getElementById("celularesList").textContent) };
    }, s.idc);
    chequear("el admin ve el pedido en Celulares (y en el botón)", vePaso.pide && vePaso.boton && vePaso.sinFilaRara, vePaso);
    // Como Faisal: tiene la app cerrada cuando el admin le pasa el legajo
    await NV.goto("about:blank");
    await AD.evaluate(() => {
      window.confirm = () => true;
      [...document.querySelectorAll("#pasosList button")].find(b => /Pasar a este celular/.test(b.textContent)).click();
    });
    await wait(2500);
    const pend = await AD.evaluate(() => { renderCelulares(); updateCelularesBtn(); const box = document.getElementById("pasosList");
      return { gris: !!box.querySelector(".paso-pend") && /Ya se lo pasaste/.test(box.textContent), pide: /Pide entrar/.test(box.textContent),
        boton: /pide entrar/.test(document.getElementById("btnCelulares").textContent) }; });
    chequear("al pasarlo, el pedido no vuelve y queda en gris \"Ya se lo pasaste\" hasta que abra la app",
      pend.gris && !pend.pide && !pend.boton && !((be.st[YOC] || {}).uNuevo) && !((be.st[YOC] || {}).uC), pend);
    await NV.goto(URL); await wait(3500);
    const yoNV2 = (be.st[YOC] || {}).uNuevo || {};
    chequear("al abrir la app, el celular nuevo entra solo", (await NV.evaluate(() => miLegajo)) === s.idc && (await veDatos(NV)));
    chequear("el legajo queda reservado al celular nuevo y el viejo se libera",
      ((be.st[LEGC] || {})[s.idc] || {}).uid === "uNuevo" && yoNV2.id === s.idc && !yoNV2.pide, { yoNV2 });
    chequear("y desaparece el aviso gris (ya figura en Celulares)", await AD.evaluate(id => { renderCelulares();
      return !document.getElementById("pasosList").children.length &&
        [...document.querySelectorAll("#celularesList .acu-row")].some(r => r.textContent.includes(id)); }, s.idc));
    // Usa la app en dos lugares: el celular viejo (C) vuelve a pedir el legajo
    await C.reload(); await wait(3000);
    await C.evaluate(() => openYo());
    await C.fill("#yoLegajo", s.idc); await C.click("#yoLegajoBtn"); await wait(800);
    await C.click("#yoLegajoSi"); await wait(2500);
    chequear("el celular viejo que vuelve a pedir lo marca como \"ya lo tenía\"", ((be.st[YOC] || {}).uC || {}).antes === true, (be.st[YOC] || {}).uC);
    const dos = await AD.evaluate(() => { renderCelulares(); const r = document.querySelector("#pasosList .paso-dos"); return r ? r.textContent : ""; });
    chequear("y el admin ve el aviso de que usa la app en dos lugares", /dos lugares/.test(dos), dos);
    const nuevoSinAviso = (be.st[YOC] || {}).uNuevo || {};
    chequear("el celular que entró bien no queda marcado", !nuevoSinAviso.antes && !nuevoSinAviso.pide, nuevoSinAviso);
    await AD.evaluate(() => { window.confirm = () => true;
      [...document.querySelectorAll("#pasosList button")].find(b => b.textContent === "No").click(); });
    await wait(1500);
    chequear("con \"No\" el pedido se va y el legajo sigue en el celular bueno", !((be.st[YOC] || {}).uC) &&
      ((be.st[LEGC] || {})[s.idc] || {}).uid === "uNuevo");
    await NV.close();

    if (html.includes("function usarPase")) {
      console.log("\niPhone: pasar el registro de Safari a la app instalada");
      const idSF = M0.people[9].id;
      const SF = await be.celular(browser, URL, "uPaseSF", null, errores, { iphone: "safari" });
      await SF.evaluate(([k, v, s2]) => { localStorage.setItem(k, v); localStorage.setItem(s2, "1"); }, [YOKEY, idSF, YOKEY.replace("Yo", "SoloSafari")]);
      await SF.reload(); await wait(3000);
      chequear("en Safari registrado aparece \"📲 Pasar a la app\"", await SF.evaluate(() => { updatePedidosBar(); return document.getElementById("btnPasarApp").style.display !== "none"; }));
      await SF.evaluate(() => document.getElementById("btnPasarApp").click()); await wait(1500);
      const codPase = await SF.evaluate(() => (document.getElementById("paseCodigo") || {}).textContent || "");
      chequear("le muestra un código de 6 cifras", /^\d{6}$/.test(codPase) && !!(be.st["pases_" + APP] || {})[codPase], codPase);
      const APP2 = await be.celular(browser, URL, "uPaseAP", null, errores, { iphone: "app" });
      await wait(1000);
      chequear("en la app instalada no aparece el botón", await APP2.evaluate(() => document.getElementById("btnPasarApp").style.display === "none"));
      // Primero intenta con su legajo: le dice que está en uso y le explica lo del código
      await APP2.fill("#yoLegajo", idSF); await APP2.click("#yoLegajoBtn"); await wait(800);
      await APP2.click("#yoLegajoSi"); await wait(2000);
      chequear("si escribe el legajo, le explica que use el código de Safari", /Pasar a la app/.test(await APP2.evaluate(() => document.getElementById("yoLegajoMsg").textContent)));
      await APP2.click("#yoCodigoLink"); await APP2.fill("#yoLegajo", "000000"); await APP2.click("#yoLegajoBtn"); await wait(1500);
      chequear("un código equivocado no sirve", !(await APP2.evaluate(() => miLegajo)) && /no existe o ya venció/.test(await APP2.evaluate(() => document.getElementById("yoLegajoMsg").textContent)));
      await APP2.fill("#yoLegajo", codPase); await APP2.click("#yoLegajoBtn"); await wait(3000);
      const yoS = be.st["yo_" + APP] || {};
      chequear("con el código la app queda registrada con ese legajo", (await APP2.evaluate(() => miLegajo)) === idSF && (await veDatos(APP2)));
      chequear("la reserva pasa a la app, sin pedido al admin, y se borra el registro de Safari",
        ((be.st[LEGC] || {})[idSF] || {}).uid === "uPaseAP" && !!yoS.uPaseAP && yoS.uPaseAP.id === idSF && !yoS.uPaseAP.pide && !yoS.uPaseSF, { ap: yoS.uPaseAP, sf: yoS.uPaseSF });
      chequear("el código se borra (no sirve dos veces)", !(be.st["pases_" + APP] || {})[codPase]);
      const sf2 = await SF.evaluate(k => ({ leg: miLegajo, ls: localStorage.getItem(k), msg: document.getElementById("paseCuerpo").textContent }), YOKEY);
      chequear("Safari se libera solo y avisa que pasó a la app", !sf2.leg && !sf2.ls && /pasó a la app/.test(sf2.msg), sf2);
      await SF.reload(); await wait(3000);
      chequear("al volver a abrir Safari no le pide nada al admin", !((be.st["yo_" + APP] || {}).uPaseSF || {}).pide && !(await SF.evaluate(() => miLegajo)));
      // Otro celular no puede quedarse con un legajo ajeno sin código
      const AJ = await be.celular(browser, URL, "uAjeno", null, errores);
      const robo = await AJ.evaluate(id => fbDb.collection(LEG_COLLECTION).doc(id).set({ uid: "uAjeno", id, pase: "123456" }).then(() => "ok", e => e.code), idSF);
      chequear("sin un código vigente nadie se queda con un legajo ajeno", robo === "permission-denied", robo);
      await SF.close(); await APP2.close(); await AJ.close();
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
