# Reglas de Firebase: datos protegidos (Jefes)

Los turnos, pedidos y cambios publicados solo los leen los celulares registrados
(legajo reservado o invitación usada) y el admin. Proyecto **programacionjefes**.
Estas son las reglas completas (reemplazan todo el texto de Firestore → Reglas).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function esAdmin() {
      return request.auth != null
        && request.auth.token.email == "guillermo.nemaric@gmail.com"
        && request.auth.token.email_verified == true;
    }
    // Registrado: su celular (yo_jefes/{uid}) apunta a un legajo reservado a su nombre
    // o a una invitación que usó él.
    function yoPath() {
      return /databases/$(database)/documents/yo_jefes/$(request.auth.uid);
    }
    function legPath(id) {
      return /databases/$(database)/documents/legajos_jefes/$(id);
    }
    function invPath(id) {
      return /databases/$(database)/documents/invitados_jefes/$(id.split('-')[1]);
    }
    function registradoCon(id) {
      return (exists(legPath(id)) && get(legPath(id)).data.uid == request.auth.uid)
        || (id.matches('inv-[a-z0-9]+') && exists(invPath(id))
            && get(invPath(id)).data.get('uid', '') == request.auth.uid);
    }
    function registrado() {
      return request.auth != null && exists(yoPath())
        && registradoCon(string(get(yoPath()).data.get('id', '-')));
    }
    function puedeVer() {
      return esAdmin() || registrado();
    }

    // Turnos de cada mes: solo registrados y admin. Publica el admin.
    match /jefes/{mes} {
      allow read: if puedeVer();
      allow write: if esAdmin();
    }

    // Padrón (legajo → nombre) para "¿Quién sos?": se busca de a un legajo, nunca la lista.
    match /padron_jefes/{legajo} {
      allow get: if request.auth != null;
      allow list, write: if esAdmin();
    }

    match /cj/{docId} {
      allow read, delete: if esAdmin();
      allow create, update: if request.auth != null
        && request.resource.data.uid == request.auth.uid
        && docId == request.resource.data.mes + "_" + request.auth.uid
        && request.resource.data.edits.size() < 1000;
    }

    // Pedidos de cambio de turno: solo registrados y admin
    match /pedidos_jefes/{doc} {
      allow read, write: if puedeVer();
    }

    // Qué nombre eligió cada celular: cada uno ve el suyo; el admin ve todos
    match /yo_jefes/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || esAdmin());
      allow create, update: if request.auth != null && request.auth.uid == uid;
      allow delete: if request.auth != null && (request.auth.uid == uid || esAdmin());
    }

    // Un solo celular por nombre (se puede consultar de a un legajo; la lista solo el admin)
    match /legajos_jefes/{legajo} {
      allow get: if request.auth != null;
      allow list: if esAdmin();
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update: if request.auth != null && resource.data.uid == request.auth.uid
                    && request.resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null &&
        (resource.data.uid == request.auth.uid || esAdmin());
    }

    // Cada uno publica solo su fila (el documento de SU legajo). El admin puede descartar.
    match /propios_jefes/{docId} {
      allow read: if puedeVer();
      allow create, update: if request.auth != null && (
        (request.resource.data.uid == request.auth.uid
         && docId == request.resource.data.mes + "_" + request.resource.data.id
         && get(/databases/$(database)/documents/legajos_jefes/$(request.resource.data.id)).data.uid == request.auth.uid)
        || esAdmin()
      );
      allow delete: if esAdmin();
    }

    // Invitaciones para externos. Las crea y borra el admin.
    // Cada una sirve para un solo celular (el primero que la usa pone su uid).
    match /invitados_jefes/{code} {
      allow get: if request.auth != null;
      allow list, create, delete: if esAdmin();
      allow update: if request.auth != null
        && !('uid' in resource.data)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['uid', 'usadoEn'])
        && request.resource.data.uid == request.auth.uid;
    }
  }
}
```

## Cómo verificar desde afuera
Con un usuario anónimo nuevo (sin registrar), leer `jefes`, `pedidos_jefes`, `propios_jefes`,
`yo_jefes` y la lista de `legajos_jefes` tiene que dar PERMISSION_DENIED. `padron_jefes/{legajo}`
(de a uno) sí se puede leer.
