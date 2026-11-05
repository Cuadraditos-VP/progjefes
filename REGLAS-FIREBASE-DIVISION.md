# Reglas de Firebase: la División (jefes)

La **División** es un rol intermedio entre el admin y los usuarios. El admin la marca en
Celulares ("Hacer División"), que guarda `division_jefes/{legajo o inv-código}`.
La División puede autorizar pedidos sin contraparte, pasar acordados a lo oficial y publicar
cambios de turnos. Solo cambia **turnos** del mes (`people`, `changedAt`, `publicadoPor`,
`version`): no puede tocar la gente, la inicial, colores ni nada más.

Agregar a las reglas (dentro de `match /databases/{database}/documents`):

```
    // División: un registrado cuyo legajo (o invitación) está en division_jefes
    function esDivision() {
      return registrado() && exists(/databases/$(database)/documents/division_jefes/$(string(get(yoPath()).data.get('id', '-'))));
    }

    // Quién es la División: la arma solo el admin; los registrados la pueden leer
    match /division_jefes/{id} {
      allow read: if puedeVer();
      allow write: if esAdmin();
    }
```

Y cambiar estos dos bloques que ya existen:

```
    match /jefes/{mes} {
      allow read: if puedeVer();
      allow write: if esAdmin();
      // La División solo cambia turnos (la misma gente)
      allow update: if esDivision()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['people', 'changedAt', 'publicadoPor', 'version'])
        && request.resource.data.people.size() == resource.data.people.size();
    }

    // en propios_jefes: la División también puede sacar lo que el dueño publicó en una celda que ella oficializa
    match /propios_jefes/{docId} {
      allow read: if puedeVer();
      allow create, update: if request.auth != null && (
        (request.resource.data.uid == request.auth.uid
         && docId == request.resource.data.mes + "_" + request.resource.data.id
         && get(/databases/$(database)/documents/legajos_jefes/$(request.resource.data.id)).data.uid == request.auth.uid)
        || esAdmin()
      );
      allow update: if esDivision();
      allow delete: if esAdmin();
    }
```

(`pedidos_jefes` no cambia: ya lo pueden escribir los registrados.)

## Cómo verificar desde afuera
Un anónimo sin registrar no puede leer `division_jefes`. Un registrado que no es División no
puede escribir en `jefes` (PERMISSION_DENIED).
