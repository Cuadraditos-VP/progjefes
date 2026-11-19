// Firebase falso en la página: todo pasa por el "servidor" de Node (bindings __fbWrite / __fbState)
(() => {
  const DEL = { __del: 1 };
  const listeners = [];
  let local = {};
  const ready = window.__fbState().then(st => { local = JSON.parse(st); });
  function deliverColl(l, changes) {
    l.cb({ docChanges: () => changes, forEach: (f) => changes.forEach(c => f(c.doc)), docs: changes.map(c => c.doc), size: changes.length, empty: !changes.length });
  }
  window.__fbPush = (coll, id, data) => {
    local[coll] = local[coll] || {};
    const existed = id in local[coll], antes = local[coll][id];
    if (data == null) delete local[coll][id]; else local[coll][id] = data;
    const type = data == null ? "removed" : existed ? "modified" : "added";
    listeners.forEach(l => {
      if (l.coll !== coll) return;
      if (l.id == null) {
        // Consulta con filtro (where): si el doc no entra (o dejó de entrar), para ese oyente es "removed"
        if (l.f && data == null && !(existed && l.f(antes))) return;
        if (l.f && data != null && !l.f(data)) { if (existed && l.f(antes)) deliverColl(l, [{ type: "removed", doc: { id, data: () => data, exists: true } }]); return; }
        deliverColl(l, [{ type, doc: { id, data: () => data, exists: data != null } }]);
      }
      else if (l.id === id) l.cb({ exists: data != null, id, data: () => data });
    });
  };
  const enc = v => JSON.stringify(v, (k, x) => x === DEL ? { __del: 1 } : x);
  function write(coll, id, op, data, opts) {
    // Sin internet: lo escrito queda esperando (como en Firebase, que no confirma hasta que vuelve la red)
    if (window.__SIN_RED) return new Promise(() => {});
    // Para probar errores al mandar: localStorage "__fallar" = [colecciones] → esas escrituras fallan
    let fallar = []; try { fallar = JSON.parse(localStorage.getItem("__fallar") || "[]"); } catch (e) {}
    if (fallar.includes(coll)) { const e = new Error("unavailable"); e.code = "unavailable"; return Promise.reject(e); }
    return window.__fbWrite(enc({ coll, id, op, data, opts, uid: window.__UID, email: window.__EMAIL || null }))
      .then(r => { if (r && r !== "ok") { const e = new Error(r); e.code = r; throw e; } });
  }
  // Lecturas: el "servidor" decide si este celular puede leer (reglas de Firebase)
  const denegado = () => { const e = new Error("permission-denied"); e.code = "permission-denied"; return e; };
  // Sin internet se lee la copia guardada en el celular (lo que ya tenía)
  const puede = (coll, id) => ready.then(() => window.__SIN_RED ? true : window.__fbCanRead(coll, id == null ? null : id, window.__UID, window.__EMAIL || null));
  function docRef(coll, id) {
    return {
      id,
      set: (d, o) => write(coll, id, "set", d, o),
      update: (d) => write(coll, id, "update", d),
      delete: () => write(coll, id, "delete"),
      get: () => puede(coll, id).then(ok => { if (!ok) throw denegado(); const d = (local[coll] || {})[id]; return { exists: d != null, id, data: () => d }; }),
      onSnapshot: (cb, errCb) => {
        const l = { coll, id, cb }; let vivo = true;
        puede(coll, id).then(ok => {
          if (!vivo) return;
          if (!ok) { if (errCb) errCb(denegado()); return; }
          listeners.push(l); const d = (local[coll] || {})[id]; cb({ exists: d != null, id, data: () => d });
        });
        return () => { vivo = false; const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
      }
    };
  }
  function consulta(coll, f) {
    const docsDe = () => Object.entries(local[coll] || {}).filter(([, d]) => !f || f(d));
    return {
      get: () => puede(coll, null).then(ok => { if (!ok) throw denegado(); const docs = docsDe().map(([id, d]) => ({ id, data: () => d, exists: true })); return { docs, forEach: fn => docs.forEach(fn), size: docs.length, empty: !docs.length }; }),
      onSnapshot: (cb, errCb) => {
        const l = { coll, id: null, cb, f }; let vivo = true;
        // Para probar el orden de carga: localStorage "__demora" = {colección: ms} demora la primera entrega
        let dem = 0; try { dem = (JSON.parse(localStorage.getItem("__demora") || "{}") || {})[coll] || 0; } catch (e) {}
        puede(coll, null).then(ok => new Promise(r => setTimeout(() => r(ok), dem))).then(ok => {
          if (!vivo) return;
          if (!ok) { if (errCb) errCb(denegado()); return; }
          listeners.push(l);
          deliverColl(l, docsDe().map(([id, d]) => ({ type: "added", doc: { id, data: () => d, exists: true } })));
        });
        return () => { vivo = false; const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
      }
    };
  }
  const db = {
    enablePersistence: () => Promise.resolve(),
    collection: (coll) => Object.assign(consulta(coll, null), {
      doc: (id) => docRef(coll, id),
      // Consultas: where("campo", "in", [..]) o where("campo", "==", valor)
      where: (campo, op, val) => consulta(coll, d => !!d && (op === "in" ? val.includes(d[campo]) : d[campo] === val))
    }),
    batch: () => { const ops = []; return {
      set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, d) => ops.push(() => r.update(d)), delete: (r) => ops.push(() => r.delete()),
      commit: () => Promise.all(ops.map(f => f())) }; },
    // Transacción: lee lo último y escribe todo junto (acá, en orden; si algo falla, se corta)
    runTransaction: async (fn) => {
      const ops = [];
      const tx = { get: r => r.get(), set: (r, d, o) => { ops.push(() => r.set(d, o)); return tx; },
        update: (r, d) => { ops.push(() => r.update(d)); return tx; }, delete: (r) => { ops.push(() => r.delete()); return tx; } };
      const res = await fn(tx);
      for (const f of ops) await f();
      return res;
    }
  };
  // Sesión: anónima (o Google para el admin). Con window.__CUENTAS también la clave personal (legajo + clave):
  // linkWithCredential le pega la cuenta a la llave anónima (mismo uid) y signInWithEmailAndPassword entra
  // en otro aparato con el uid de la cuenta. La sesión con clave queda guardada en el celular (como en Firebase).
  const oyentes = [];
  const errAuth = c => { const e = new Error(c); e.code = c; return e; };
  const CU = window.__CUENTAS;
  let anonN = 0;
  function crearUsuario(uid, mail, anon) {
    const u = { uid, isAnonymous: anon, email: mail || null };
    if (CU && anon) u.linkWithCredential = cred => window.__fbAuth(JSON.stringify({ op: "link", mail: cred.mail, pw: cred.pw, uid }))
      .then(r => {
        if (r !== "ok") throw errAuth(r);
        u.isAnonymous = false; u.email = cred.mail; delete u.linkWithCredential; window.__EMAIL = cred.mail;
        try { localStorage.setItem("__fbCuenta", JSON.stringify({ uid, mail: cred.mail })); } catch (e) {}
        return { user: u };
      });
    return u;
  }
  function cambiar(u) {
    auth.currentUser = u; window.__UID = u ? u.uid : null; window.__EMAIL = u && !u.isAnonymous ? u.email : null;
    oyentes.forEach(cb => setTimeout(() => cb(u), 0));
  }
  let guardada = null;
  try { guardada = CU ? JSON.parse(localStorage.getItem("__fbCuenta") || "null") : null; } catch (e) {}
  const uidAnon = window.__UID;
  if (guardada) { window.__UID = guardada.uid; window.__EMAIL = guardada.mail; }
  const user = guardada ? crearUsuario(guardada.uid, guardada.mail, false) : crearUsuario(window.__UID, window.__EMAIL, !window.__EMAIL);
  const auth = { currentUser: user,
    onAuthStateChanged: (cb) => { oyentes.push(cb); setTimeout(() => cb(auth.currentUser), 50); return () => {}; },
    signInAnonymously: () => { if (CU && !auth.currentUser) cambiar(crearUsuario(uidAnon + "-" + (++anonN), null, true)); return Promise.resolve(); },
    signOut: () => { if (CU) { try { localStorage.removeItem("__fbCuenta"); } catch (e) {} cambiar(null); } return Promise.resolve(); },
    signInWithEmailAndPassword: (mail, pw) => !CU ? Promise.reject(errAuth("auth/operation-not-allowed"))
      : window.__fbAuth(JSON.stringify({ op: "entrar", mail, pw })).then(r => {
        if (!/^ok:/.test(r)) throw errAuth(r);
        const u = crearUsuario(r.slice(3), mail, false);
        try { localStorage.setItem("__fbCuenta", JSON.stringify({ uid: u.uid, mail })); } catch (e) {}
        cambiar(u);
        return { user: u };
      }) };
  const firestore = () => db;
  firestore.FieldValue = { delete: () => DEL, serverTimestamp: () => Date.now(), increment: n => ({ __inc: n }) };
  firestore.FieldPath = function () {};
  const authFn = () => auth;
  authFn.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; };
  authFn.EmailAuthProvider = { credential: (mail, pw) => ({ mail, pw }) };
  window.firebase = { initializeApp: () => {}, firestore, auth: authFn };
})();
