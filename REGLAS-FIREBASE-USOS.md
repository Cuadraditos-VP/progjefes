# Reglas: los usos de la app viajan al pasar el legajo

Cuando el admin pasa un legajo a un celular nuevo (Celulares → "Pasar a este celular"), los usos
de la app (`ab`) del celular viejo se suman al nuevo. Para eso el admin escribe en el `yo_jefes`
del celular nuevo. También puede corregirlos a mano (✎ al lado de los usos).

Con "📲 Pasar a la app" (Safari → app instalada) los usos viajan en el código (`pases_jefes`, campo `ab`).

Sin estas reglas la app sigue andando como antes (los usos no viajan y el ✎ avisa que Firebase no lo deja).

Cambios en las reglas:

```
    // dentro de match /yo_jefes/{uid}: se suma
      allow update: if esAdmin();

    // dentro de match /pases_jefes/{code}, en "allow create": se cambia
    //   request.resource.data.keys().hasOnly(['id', 'uid', 'hasta'])
    // por
        && request.resource.data.keys().hasOnly(['id', 'uid', 'hasta', 'ab'])
        && (!('ab' in request.resource.data) || request.resource.data.ab is number)
```
