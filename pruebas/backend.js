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
  // ¿Es de la División? (registrado y su legajo o invitación está en division_<app>)
  function esDivision(uid) {
    const yo = (st["yo_" + app] || {})[uid];
    return registrado(uid) && !!(st["division_" + app] || {})[yo.id];
  }
  function puedeLeer(coll, id, uid, email) {
    if (email === ADMIN) return true;
    if (coll === "padron_" + app) return id != null;  // de a un legajo, nunca la lista
    if (coll === turnosColl || coll === "pedidos_" + app || coll === "propios_" + app || coll === "division_" + app) return registrado(uid);
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
    const legs = () => st["legajos_" + app] || {};
    // pases_<app>: código de Safari para pasar el registro a la app instalada (iPhone)
    if (w.coll === "pases_" + app) {
      if (w.email === ADMIN) return true;
      if (w.op === "delete") { const l = prev && legs()[prev.id]; return !!prev && (prev.uid === w.uid || (!!l && l.uid === w.uid)); }
      if (prev || !next) return false; // un código existente no se pisa
      const l = legs()[next.id];
      return /^\d{4}$/.test(w.id) && next.uid === w.uid && !!l && l.uid === w.uid &&
        Object.keys(next).every(k => ["id", "uid", "hasta"].includes(k)) && next.hasta < Date.now() + 20 * 60 * 1000;
    }
    // legajos_<app>: cada uno reserva el suyo; para tomar uno ajeno hace falta un pase vigente de su dueño
    if (w.coll === "legajos_" + app) {
      if (w.email === ADMIN) return true;
      if (w.op === "delete") return !!prev && prev.uid === w.uid;
      if (!next || next.uid !== w.uid || next.id !== w.id) return false;
      if (!prev || prev.uid === w.uid) return true;
      const pase = (st["pases_" + app] || {})[next.pase];
      return !!pase && pase.id === w.id && pase.uid === prev.uid && Date.now() < pase.hasta;
    }
    // yo_<app>: borrar, el admin o quien tiene ahora el legajo de ese registro viejo
    if (w.coll === "yo_" + app && w.op === "delete") {
      if (w.email === ADMIN) return true;
      const l = prev && legs()[prev.id];
      return !!l && l.uid === w.uid && w.id !== w.uid;
    }
    // division_<app>: la arma solo el admin
    if (w.coll === "division_" + app) return w.email === ADMIN;
    // Turnos oficiales: el admin todo; la División solo cambia turnos (misma gente), sin tocar lo demás
    if (w.coll === turnosColl) {
      if (w.email === ADMIN) return true;
      if (!esDivision(w.uid) || w.op !== "update" || !prev || !next) return false;
      const keys = new Set(Object.keys(prev).concat(Object.keys(next)));
      const toca = [...keys].filter(k => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
      return toca.every(k => ["people", "changedAt", "publicadoPor", "version"].includes(k)) &&
        Array.isArray(next.people) && next.people.length === (prev.people || []).length;
    }
    if (w.coll !== "propios_" + app) return true;
    if (w.email === ADMIN) return true;
    if (esDivision(w.uid) && w.op === "update") return true;
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
        const last = parts[parts.length - 1];
        if (v && v.__del) delete o[last];
        else if (v && typeof v === "object" && "__inc" in v) o[last] = (Number(o[last]) || 0) + v.__inc;
        else o[last] = v;
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
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 420, height: 900 } },
      o.tactil ? { hasTouch: true, isMobile: true } : {}, o.iphone ? {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" } : {}));
    if (o.iphone) await ctx.addInitScript(app => { Object.defineProperty(navigator, "standalone", { get: () => app }); }, o.iphone === "app");
    await ctx.route(/gstatic\.com\/firebasejs|googleapis/, r => r.abort());
    const pg = await ctx.newPage();
    pages.add(pg);
    await pg.exposeBinding("__fbWrite", (_, j) => write(j));
    await pg.exposeBinding("__fbState", () => JSON.stringify(st));
    await pg.exposeBinding("__fbCanRead", (_, coll, id) => puedeLeer(coll, id, uid, email || null));
    await pg.addInitScript(([u, e]) => { window.__UID = u; window.__EMAIL = e; }, [uid, email || null]);
    // "Hoy" fijo antes del mes de prueba, así los pedidos no quedan vencidos según la fecha real
    const h = new Date(); await pg.addInitScript(t => { window.__HOY = t; }, new Date(h.getFullYear(), h.getMonth(), 0, 12).getTime()); // "hoy" = el día antes del mes de prueba (todo el mes se puede cambiar)
    await pg.addInitScript({ path: path.join(__dirname, "firebase-falso.js") });
    pg.on("pageerror", e => errores.push(uid + ": " + e.message));
    pg.on("dialog", d => d.accept());
    await pg.goto(url);
    await pg.waitForTimeout(1500);
    return pg;
  }
  return { st, celular, mesDePrueba };
};
