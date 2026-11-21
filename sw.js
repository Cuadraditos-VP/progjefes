// Service Worker de "Programación Jefes": permite abrir la app sin internet.
//
// - Archivos de la app (HTML, JSON de cada mes, íconos): siempre intenta traer la
//   versión más nueva de internet. Si no hay red, usa la última copia guardada.
//   Se guarda UNA sola copia por archivo (se ignora el "?t=..." / "?v=..." de la
//   dirección), así no se acumulan copias viejas.
// - Firebase y la tipografía (vienen de Google): se guardan una vez y se reusan.
// - Los datos en vivo de Firebase no pasan por acá (Firebase tiene su propia copia).
//
// Para forzar que todos los celulares borren la copia vieja, cambiar CACHE (ej. "jefes-v4").
const CACHE = "jefes-v3";
const CORE = ["./index.html"];
// La página se guarda con UNA sola llave ("…/index.html"), entre por "/" o por "/index.html".
// Antes eran dos copias y, sin internet, a veces se abría la más vieja (caso "no tiene permiso").
function llave(url) {
  const u = new URL(url);
  return u.origin + (u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname);
}
const EXTERNOS = ["https://www.gstatic.com/firebasejs/", "https://fonts.googleapis.com/", "https://fonts.gstatic.com/"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => {
        const url = new URL(u, self.location).href;
        return fetch(url, { cache: "no-cache" }).then((res) => { if (res && res.ok) return c.put(llave(url), res); }).catch(() => {});
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const key = llave(req.url); // sin "?t=..."
    const esPagina = req.mode === "navigate" || key.endsWith(".html");
    // La página siempre se pide fresca (no la copia del navegador), así no corre una versión vieja
    e.respondWith(
      (esPagina
        ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((r) => (r.redirected ? fetch(req) : r))
        : fetch(req))
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(key).then((hit) => {
            if (hit) return hit;
            if (req.mode === "navigate") {
              return caches.match(llave(new URL("./index.html", self.location).href));
            }
            return Response.error();
          })
        )
    );
    return;
  }

  if (EXTERNOS.some((p) => req.url.startsWith(p))) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
