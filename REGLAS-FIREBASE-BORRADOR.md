# Reglas de Firebase: borrador compartido de la División (jefes)

Lo que la División cambia y todavía no publicó (turnos en ámbar y colores) se guarda en
`borrador_jefes/{mes}` para que lo vean al instante todos los de la División, en cualquier PC o celular.
Campos: `mes`, `e` (turnos: `"<legajo>_<día>": {c, n, t}`), `col` y `let` (colores y letras).
⬆ Publicar lo pasa a lo oficial y lo saca del borrador.

Agregar a las reglas (dentro de `match /databases/{database}/documents`, junto a los bloques de la División):

```
    // Borrador compartido de la División: lo que cambió y todavía no publicó
    match /borrador_jefes/{mes} {
      allow read: if esDivision() || esAdmin();
      allow create, update: if (esDivision() || esAdmin())
                   && request.resource.data.keys().hasOnly(['mes', 'e', 'fer', 'col', 'let']);
      allow delete: if esAdmin();
    }
```

## Cómo verificar desde afuera
Un anónimo sin registrar (o un registrado que no es División) no puede leer ni escribir `borrador_jefes` (PERMISSION_DENIED).
