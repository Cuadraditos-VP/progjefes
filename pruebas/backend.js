// "Servidor" de Firebase compartido entre varias pestañas (cada pestaña = un celular).
// Aplica la misma regla de permisos que Firebase para propios_<app>.
const path = require("path");
const ADMIN = "guillermo.nemaric@gmail.com";
module.exports = function crearBackend(app) {
  const st = {};
  const pages = new Set();
  const clone = x => JSON.parse(JSON.stringify(x));
  const stripDel = o => { if (o && typeof o === "object") for (const k of Object.keys(o)) { if (o[k] && o[k].__del) delete o[k]; else stripDel(o[k]); } return o; };
  function permitido(w, next) {
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
    if (!permitido(w, cur)) return "permission-denied";
    if (cur == null) delete st[w.coll][w.id]; else st[w.coll][w.id] = cur;
    for (const p of pages) { try { await p.evaluate(([c, i, d]) => window.__fbPush && window.__fbPush(c, i, d), [w.coll, w.id, cur]); } catch (e) {} }
    return "ok";
  }
  // Abre un "celular": uid propio, email solo para el admin
  async function celular(browser, url, uid, email, errores) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    await ctx.route(/gstatic\.com\/firebasejs|googleapis/, r => r.abort());
    const pg = await ctx.newPage();
    pages.add(pg);
    await pg.exposeBinding("__fbWrite", (_, j) => write(j));
    await pg.exposeBinding("__fbState", () => JSON.stringify(st));
    await pg.addInitScript(([u, e]) => { window.__UID = u; window.__EMAIL = e; }, [uid, email || null]);
    await pg.addInitScript({ path: path.join(__dirname, "firebase-falso.js") });
    pg.on("pageerror", e => errores.push(uid + ": " + e.message));
    pg.on("dialog", d => d.accept());
    await pg.goto(url);
    await pg.waitForTimeout(1500);
    return pg;
  }
  return { st, celular };
};
