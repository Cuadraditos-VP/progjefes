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
    const existed = id in local[coll];
    if (data == null) delete local[coll][id]; else local[coll][id] = data;
    const type = data == null ? "removed" : existed ? "modified" : "added";
    listeners.forEach(l => {
      if (l.coll !== coll) return;
      if (l.id == null) deliverColl(l, [{ type, doc: { id, data: () => data, exists: data != null } }]);
      else if (l.id === id) l.cb({ exists: data != null, id, data: () => data });
    });
  };
  const enc = v => JSON.stringify(v, (k, x) => x === DEL ? { __del: 1 } : x);
  function write(coll, id, op, data, opts) {
    // Sin internet: lo escrito queda esperando (como en Firebase, que no confirma hasta que vuelve la red)
    if (window.__SIN_RED) return new Promise(() => {});
    return window.__fbWrite(enc({ coll, id, op, data, opts, uid: window.__UID, email: window.__EMAIL || null }))
      .then(r => { if (r && r !== "ok") { const e = new Error(r); e.code = r; throw e; } });
  }
  // Lecturas: el "servidor" decide si este celular puede leer (reglas de Firebase)
  const denegado = () => { const e = new Error("permission-denied"); e.code = "permission-denied"; return e; };
  // Sin internet se lee la copia guardada en el celular (lo que ya tenía)
  const puede = (coll, id) => ready.then(() => window.__SIN_RED ? true : window.__fbCanRead(coll, id == null ? null : id));
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
  const db = {
    enablePersistence: () => Promise.resolve(),
    collection: (coll) => ({
      doc: (id) => docRef(coll, id),
      get: () => puede(coll, null).then(ok => { if (!ok) throw denegado(); const docs = Object.entries(local[coll] || {}).map(([id, d]) => ({ id, data: () => d, exists: true })); return { docs, forEach: f => docs.forEach(f), size: docs.length, empty: !docs.length }; }),
      onSnapshot: (cb, errCb) => {
        const l = { coll, id: null, cb }; let vivo = true;
        puede(coll, null).then(ok => {
          if (!vivo) return;
          if (!ok) { if (errCb) errCb(denegado()); return; }
          listeners.push(l);
          deliverColl(l, Object.entries(local[coll] || {}).map(([id, d]) => ({ type: "added", doc: { id, data: () => d, exists: true } })));
        });
        return () => { vivo = false; const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
      }
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
  const user = { uid: window.__UID, isAnonymous: !window.__EMAIL, email: window.__EMAIL || null };
  const auth = { currentUser: user, onAuthStateChanged: (cb) => { setTimeout(() => cb(user), 50); return () => {}; },
    signInAnonymously: () => Promise.resolve(), signOut: () => Promise.resolve() };
  const firestore = () => db;
  firestore.FieldValue = { delete: () => DEL, serverTimestamp: () => Date.now(), increment: n => ({ __inc: n }) };
  firestore.FieldPath = function () {};
  const authFn = () => auth;
  authFn.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; };
  window.firebase = { initializeApp: () => {}, firestore, auth: authFn };
})();
