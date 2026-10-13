# Íconos — traje y corbata

## Cómo usarlos
1. Copiá `favicon.ico`, `manifest.webmanifest`, `browserconfig.xml` y la carpeta `icons/`
   a la raíz de tu repo (al lado de tu `index.html`).
2. Pegá esto dentro del `<head>` de tu HTML:

```html
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="icons/icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#464646">
<meta name="apple-mobile-web-app-title" content="Jefes">
<meta name="msapplication-config" content="browserconfig.xml">
```

3. Hacé commit y push. Si no ves el ícono nuevo, recargá forzando (Ctrl+F5)
   o borrá el acceso directo del celular y volvé a agregarlo a la pantalla de inicio.

## Qué es cada archivo
- `favicon.ico` — pestaña del navegador (incluye 16 a 256 px).
- `icons/icon.svg` — versión vectorial, se ve nítida en cualquier tamaño.
- `icons/apple-touch-icon.png` — iPhone/iPad al "Agregar a inicio".
- `icons/icon-192/512.png` y `icon-maskable-*.png` — Android / app instalable (PWA).
- `icons/mstile-150x150.png` — Windows.
- `icons/icon-1024.png` — versión grande para lo que necesites.
- `icons/social-preview.png` (1280×640) — imagen para la vista previa del repo en GitHub:
  Settings → General → Social preview → Edit → Upload an image.

Si tu app no se llama "Programación Jefes", cambiá `name` y `short_name`
en `manifest.webmanifest` y el `apple-mobile-web-app-title`.
