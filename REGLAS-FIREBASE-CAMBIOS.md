# Reglas de Firebase para "Cambios"

La función **Cambios** guarda datos en tres colecciones nuevas del proyecto
`programacionjefes`. Firebase no las deja usar hasta que se agreguen estas reglas.

## Cómo agregarlas
1. Entrá a https://console.firebase.google.com → proyecto **programacionjefes**.
2. **Firestore Database → Reglas**.
3. Pegá estos tres bloques **adentro** de `match /databases/{database}/documents { ... }`,
   al lado de las reglas que ya tenés (las de `jefes` y `cj` no se tocan).
4. Tocá **Publicar**.

```
    // Pedidos de cambio de turno: todos los leen y escriben
    match /pedidos_jefes/{doc} {
      allow read, write: if request.auth != null;
    }

    // Qué nombre eligió cada celular (id = uid del celular)
    match /yo_jefes/{uid} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == uid;
      allow delete: if request.auth != null &&
        (request.auth.uid == uid || request.auth.token.email == "guillermo.nemaric@gmail.com");
    }

    // Un solo celular por nombre (id = legajo)
    match /legajos_jefes/{legajo} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update: if request.auth != null && resource.data.uid == request.auth.uid
                    && request.resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null &&
        (resource.data.uid == request.auth.uid || request.auth.token.email == "guillermo.nemaric@gmail.com");
    }
```

Si ya tenés reglas iguales en el proyecto de Cajeros, son las mismas cambiando
`_cajeros` por `_jefes`.
