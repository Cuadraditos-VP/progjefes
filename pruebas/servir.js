// Servidor estático mínimo de la carpeta de la app (la de arriba de pruebas/)
const http = require("http"), fs = require("fs"), path = require("path");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".xml": "application/xml" };
module.exports = function servir(root, port) {
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
      const f = path.normalize(path.join(root, p));
      if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
      fs.readFile(f, (err, d) => { if (err) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); r.end(d); });
    });
    srv.listen(port, () => res(srv));
  });
};
