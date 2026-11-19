# Reglas de Firebase: clave personal (jefes)

Cada usuario elige una clave de 4 números y con **legajo + clave** entra desde todos los aparatos
que quiera. Por dentro es una cuenta de Firebase Auth con correo inventado (`l<legajo>@jefes.example.com`,
nunca se manda nada) que se le pega a la llave anónima del celular: el uid no cambia, así que las
demás reglas siguen iguales.

## 1. Activar en la consola de Firebase (una sola vez)
Authentication → Sign-in method → Agregar proveedor → **Correo electrónico/contraseña** → Habilitar
(solo el primer interruptor, no "vínculo de correo") → Guardar.

Mientras no esté activado, la app no pide la clave (sigue como antes).

## 2. Agregar a las reglas de Firestore
(dentro de `match /databases/{database}/documents`)

```
    // NUEVO: clave personal. Dice qué cuenta (legajo + clave) tiene cada legajo.
    // La escribe quien tiene reservado ese legajo; el admin todo.
    match /cuentas_jefes/{legajo} {
      allow get: if request.auth != null;
      allow list, delete: if esAdmin();
      allow create, update: if esAdmin() || (request.auth != null
        && request.resource.data.uid == request.auth.uid
        && exists(legPath(legajo))
        && get(legPath(legajo)).data.uid == request.auth.uid);
    }
```
