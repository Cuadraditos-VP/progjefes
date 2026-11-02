// "Servidor" de Firebase compartido entre varias pestañas (cada pestaña = un celular).
// Aplica las mismas reglas de permisos que Firebase: quién escribe en propios_<app> e
// invitados_<app>, y quién puede LEER los datos protegidos (turnos, pedidos, propios, padrón).
const path = require("path");
const ADMIN = "guillermo.nemaric@gmail.com";
// Mes de prueba con gente inventada (nunca datos reales en las pruebas)
const NOMBRES = ["ANA", "BRUNO", "CARLA", "DIEGO", "EMA", "FEDE", "GABI", "HUGO", "IRIS", "JUAN", "KARINA", "LUIS", "MARA", "NICO", "OLGA", "PABLO"];
const ROTA = ["T", "N", "E", "MS", "F", "TE", "T3", "F"];
function mesDePrueba(offset) {
  const now = new Date();
  const f = new Date(now.getFullYear(), now.getMonth() + (offset || 0), 1);
  const y = f.getFullYear(), m = f.getMonth() + 1;
  const dias = new Date(y, m, 0).getDate();
  const mes = y + "-" + String(m).padStart(2, "0");
  const people = NOMBRES.map((n, i) => ({ id: String(90001 + i), name: "PRUEBA, " + n,
    codes: Array.from({ length: dias }, (_, d) => ROTA[(i * 3 + d + (offset || 0)) % ROTA.length]) }));
  return { mes, codigos: ["T", "N", "E", "MS", "TE", "T3", "X", "MD", "M", "F"], feriados: [], people,
    inicial: people.map(p => ({ id: p.id, name: p.name, codes: p.codes.slice() })), version: 1 };
}
module.exports = function crearBackend(app, turnosColl) {
  const st = {};
  const m0 = mesDePrueba(0);
  st[turnosColl] = { [m0.mes]: m0 };
  st["padron_" + app] = {};
  m0.people.forEach(p => { st["padron_" + app][p.id] = { name: p.name }; });
  // ¿Está registrado este celular? (mismo criterio que la regla registrado() de Firebase)
  function registrado(uid) {
    const yo = (st["yo_" + app] || {})[uid];
    if (!yo || !yo.id) return false;
    const leg = (st["legajos_" + app] || {})[yo.id];
    if (leg && leg.uid === uid) return true;
    if (String(yo.id).indexOf("inv-") === 0) {
      const inv = (st["invitados_" + app] || {})[String(yo.id).slice(4)];
      return !!inv && inv.uid === uid;
    }
    return false;
  }
  function puedeLeer(coll, id, uid, email) {
    if (email === ADMIN) return true;
    if (coll === "padron_" + app) return id != null;  // de a un legajo, nunca la lista
    if (coll === turnosColl || coll === "pedidos_" + app || coll === "propios_" + app) return registrado(uid);
    return true;
  }
  const pages = new Set();
  const clone = x => JSON.parse(JSON.stringify(x));
  const stripDel = o => { if (o && typeof o === "object") for (const k of Object.keys(o)) { if (o[k] && o[k].__del) delete o[k]; else stripDel(o[k]); } return o; };
  function permitido(w, next, prev) {
    // invitados_<app>: las crea/borra el admin; un celular solo puede "usarla" una vez (poner su uid)
    if (w.coll === "invitados_" + app) {
      if (w.email === ADMIN) return true;
      return w.op === "update" && !!prev && !prev.uid && !!next && next.uid === w.uid;
    }
    if (w.coll !== "propios_" + app) return true;
    if (w.email === ADMIN) return true;
    if (w.op === "delete" || !next) return false;
    const leg = (st["legajos_" + app] || {})[next.id];
    return next.uid === w.uid && leg && leg.uid === w.uid && w.id === next.mes + "_" + next.id;
  }
  async function write(json) {
    const w = JSON.parse(json);
    st[w.coll] = st[w.coll] || {};
    let cur = st[w.coll][w.id] ? clone(st[w.coll][w.id]) : null;
    const prev = cur ? clone(cur) : null;
    if (w.op === "delete") cur = null;
    else if (w.op === "set") {
      if (w.opts && w.opts.mergeFields) { cur = cur || {}; w.opts.mergeFields.forEach(f => { if (f in w.data) cur[f] = w.data[f]; else delete cur[f]; }); }
      else if (w.opts && w.opts.merge) cur = Object.assign(cur || {}, w.data);
      else cur = w.data;
      stripDel(cur);
    } else if (w.op === "update") {
      if (!cur) return "not-found";
      for (const [p, v] of Object.entries(w.data)) {
        const parts = p.split("."); let o = cur;
        for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== "object") o[parts[i]] = {}; o = o[parts[i]]; }
        if (v && v.__del) delete o[parts[parts.length - 1]]; else o[parts[parts.length - 1]] = v;
      }
    }
    if (!permitido(w, cur, prev)) return "permission-denied";
    if (cur == null) delete st[w.coll][w.id]; else st[w.coll][w.id] = cur;
    for (const p of pages) { try { await p.evaluate(([c, i, d]) => window.__fbPush && window.__fbPush(c, i, d), [w.coll, w.id, cur]); } catch (e) {} }
    return "ok";
  }
  // Abre un "celular": uid propio, email solo para el admin
  // opts.iphone: "safari" (navegador) o "app" (instalada en la pantalla de inicio)
  async function celular(browser, url, uid, email, errores, opts) {
    const o = opts || {};
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 420, height: 900 } }, o.iphone ? {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" } : {}));
    if (o.iphone) await ctx.addInitScript(app => { Object.defineProperty(navigator, "standalone", { get: () => app }); }, o.iphone === "app");
    await ctx.route(/gstatic\.com\/firebasejs|googleapis/, r => r.abort());
    const pg = await ctx.newPage();
    pages.add(pg);
    await pg.exposeBinding("__fbWrite", (_, j) => write(j));
    await pg.exposeBinding("__fbState", () => JSON.stringify(st));
    await pg.exposeBinding("__fbCanRead", (_, coll, id) => puedeLeer(coll, id, uid, email || null));
    await pg.addInitScript(([u, e]) => { window.__UID = u; window.__EMAIL = e; }, [uid, email || null]);
    await pg.addInitScript({ path: path.join(__dirname, "firebase-falso.js") });
    pg.on("pageerror", e => errores.push(uid + ": " + e.message));
    pg.on("dialog", d => d.accept());
    await pg.goto(url);
    await pg.waitForTimeout(1500);
    return pg;
  }
  return { st, celular, mesDePrueba };
};
