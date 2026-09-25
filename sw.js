// Service Worker de "Programación Jefes"
// Estrategia: para el HTML y el JSON de datos, siempre intenta traer la versión
// más nueva de internet primero. Solo si no hay conexión, usa la última copia
// guardada. Así se evita quedar pegado en una versión vieja (el problema que
// tenía la app antes de tener service worker), pero se puede seguir usando
// sin internet con los últimos datos que se hayan visto.
//
// Si en el futuro cambian mucho los archivos estáticos (íconos, etc.) y quieren
// forzar que todos los dispositivos limpien la caché vieja, alcanza con cambiar
// el número de CACHE_NAME de más abajo (por ejemplo "jefes-v2").
const CACHE_NAME = "jefes-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE_ASSETS).catch(() => {
        // Si algún ícono todavía no existe en el repo, no rompe la instalación.
      })
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isNavigation = req.mode === "navigate";
  const isDataJson = url.pathname.endsWith("septiembre-2026.json");

  if (isNavigation || isDataJson) {
    // Red primero (siempre la versión más nueva); si no hay internet, cae a la copia guardada.
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Todo lo demás (íconos, etc.): copia guardada primero, y si no está, la busca.
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
