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
    return window.__fbWrite(enc({ coll, id, op, data, opts, uid: window.__UID, email: window.__EMAIL || null }))
      .then(r => { if (r && r !== "ok") { const e = new Error(r); e.code = r; throw e; } });
  }
  function docRef(coll, id) {
    return {
      id,
      set: (d, o) => write(coll, id, "set", d, o),
      update: (d) => write(coll, id, "update", d),
      delete: () => write(coll, id, "delete"),
      get: () => ready.then(() => { const d = (local[coll] || {})[id]; return { exists: d != null, id, data: () => d }; }),
      onSnapshot: (cb) => { const l = { coll, id, cb }; listeners.push(l); ready.then(() => { const d = (local[coll] || {})[id]; cb({ exists: d != null, id, data: () => d }); }); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; }
    };
  }
  const db = {
    enablePersistence: () => Promise.resolve(),
    collection: (coll) => ({
      doc: (id) => docRef(coll, id),
      get: () => ready.then(() => { const docs = Object.entries(local[coll] || {}).map(([id, d]) => ({ id, data: () => d, exists: true })); return { docs, forEach: f => docs.forEach(f), size: docs.length, empty: !docs.length }; }),
      onSnapshot: (cb) => { const l = { coll, id: null, cb }; listeners.push(l); ready.then(() => deliverColl(l, Object.entries(local[coll] || {}).map(([id, d]) => ({ type: "added", doc: { id, data: () => d, exists: true } })))); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; }
    }),
    batch: () => { const ops = []; return {
      set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, d) => ops.push(() => r.update(d)), delete: (r) => ops.push(() => r.delete()),
      commit: () => Promise.all(ops.map(f => f())) }; }
  };
  const user = { uid: window.__UID, isAnonymous: !window.__EMAIL, email: window.__EMAIL || null };
  const auth = { currentUser: user, onAuthStateChanged: (cb) => { setTimeout(() => cb(user), 50); return () => {}; },
    signInAnonymously: () => Promise.resolve(), signOut: () => Promise.resolve() };
  const firestore = () => db;
  firestore.FieldValue = { delete: () => DEL, serverTimestamp: () => Date.now() };
  firestore.FieldPath = function () {};
  const authFn = () => auth;
  authFn.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; };
  window.firebase = { initializeApp: () => {}, firestore, auth: authFn };
})();
