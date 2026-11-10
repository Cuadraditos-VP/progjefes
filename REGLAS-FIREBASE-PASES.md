# Reglas: pasar el registro de Safari a la app instalada (iPhone)

En Safari (registrado) se toca Cambios → "📲 Pasar a la app": saca un código de 4 cifras que vale
10 minutos (`pases_jefes/{código}` = `{id, uid, hasta}`). En la app instalada se escribe con
"Tengo un código de invitación": la app toma la reserva del legajo (`legajos_jefes`, con `pase`),
borra el registro de Safari (`yo_jefes`) y el código.

Bloques que se agregan a las reglas:

```
    function pasePath(code) {
      return /databases/$(database)/documents/pases_jefes/$(code);
    }

    // dentro de match /yo_jefes/{uid}: reemplaza "allow delete: if esAdmin();"
      allow delete: if esAdmin()
                   || (request.auth != null && request.auth.uid != uid
                       && exists(legPath(string(resource.data.get('id', '-'))))
                       && get(legPath(string(resource.data.get('id', '-')))).data.uid == request.auth.uid);

    // dentro de match /legajos_jefes/{legajo}: se suma
      allow update: if request.auth != null
                   && request.resource.data.uid == request.auth.uid
                   && request.resource.data.id == legajo
                   && request.resource.data.pase is string
                   && exists(pasePath(request.resource.data.pase))
                   && get(pasePath(request.resource.data.pase)).data.id == legajo
                   && get(pasePath(request.resource.data.pase)).data.uid == resource.data.uid
                   && request.time.toMillis() < get(pasePath(request.resource.data.pase)).data.hasta;

    match /pases_jefes/{code} {
      allow get: if request.auth != null;
      allow list: if esAdmin();
      allow create: if request.auth != null
        && code.matches('[0-9]{4,6}')
        && request.resource.data.keys().hasOnly(['id', 'uid', 'hasta'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.id is string
        && exists(legPath(request.resource.data.id))
        && get(legPath(request.resource.data.id)).data.uid == request.auth.uid
        && request.resource.data.hasta is number
        && request.resource.data.hasta < request.time.toMillis() + 20 * 60 * 1000;
      allow delete: if esAdmin()
        || (request.auth != null && (resource.data.uid == request.auth.uid
            || get(legPath(resource.data.id)).data.uid == request.auth.uid));
    }
```
