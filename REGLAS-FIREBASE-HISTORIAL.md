# Reglas de Firebase: usuarios de la PC de la División e historial (jefes)

En la PC de la División pueden entrar varios empleados, cada uno con su clave. El admin los carga
en Celulares (👥 en la fila de la División). Quedan dentro del mismo doc `division_jefes/{id}`
(campo `ops`, con una huella de la clave, no la clave), así que eso **no necesita reglas nuevas**:
`division_jefes` ya lo escribe solo el admin.

Lo que hace cada uno se anota en `historial_jefes`. La División solo puede **agregar** (con su
propio uid); nadie más que el admin lo puede leer ni borrar.

Agregar a las reglas (dentro de `match /databases/{database}/documents`, donde ya está la
función `esDivision()`):

```
    // Historial de la División: la PC de la División agrega; solo el admin lo lee
    match /historial_jefes/{id} {
      allow create: if esDivision() && request.resource.data.uid == request.auth.uid;
      allow read, delete: if esAdmin();
    }
```

## Cómo verificar desde afuera
Un anónimo (registrado o no) no puede leer `historial_jefes` (PERMISSION_DENIED) ni escribir en él.
