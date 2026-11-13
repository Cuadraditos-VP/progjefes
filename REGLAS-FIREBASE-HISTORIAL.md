# Reglas de Firebase: usuarios de la PC de la División, sus claves e historial (jefes)

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

## Claves secretas
El admin le da a cada uno una clave **provisoria** (va en `ops`, de `division_jefes`). La primera vez que entra,
elige su clave secreta y la PC la guarda en `claves_jefes/{id de la PC}_{k}` (solo la huella). Si el admin le da
una provisoria nueva (cambia `ops.k.v`), la elegida deja de valer.

```
    // Claves que elige cada usuario de la PC de la División: las guarda la PC; el admin las puede borrar
    match /claves_jefes/{id} {
      allow read: if esAdmin() || esDivision();
      allow create, update: if esDivision()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(['h', 'k', 'v', 'uid', 't'])
        && id == string(get(yoPath()).data.get('id', '-')) + '_' + request.resource.data.k;
      allow delete: if esAdmin();
    }
```

## Cómo verificar desde afuera
Un anónimo (registrado o no) no puede leer `historial_jefes` ni `claves_jefes` (PERMISSION_DENIED) ni escribir en él.
