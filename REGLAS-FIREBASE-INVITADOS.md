# Reglas de Firebase para las invitaciones (Jefes)

Las invitaciones a externos se guardan en `invitados_jefes` (proyecto **programacionjefes**).
Este bloque va **adentro** de `match /databases/{database}/documents { ... }`, junto a las demás.
Usa la función `esAdmin()` que ya está en las reglas.

```
    // Invitaciones para externos: las crea y borra el admin.
    // Cada una sirve para un solo celular (el primero que la usa pone su uid).
    match /invitados_jefes/{code} {
      allow get: if request.auth != null;
      allow list, create, delete: if esAdmin();
      allow update: if request.auth != null
        && !('uid' in resource.data)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['uid', 'usadoEn'])
        && request.resource.data.uid == request.auth.uid;
    }
```
