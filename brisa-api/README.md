# Brisa API

API en Node/Express que guarda los datos de Brisa Studio en MongoDB Atlas.

## Probar en tu computador
1. Instala Node.js (https://nodejs.org) si no lo tienes.
2. En la terminal, dentro de esta carpeta: `npm install`
3. Copia `.env.example` como `.env` y completa los valores.
4. `npm start`
5. Abre http://localhost:3000/api/health y debe mostrar `{"ok":true}`.

## Publicar en Render
1. Sube esta carpeta a GitHub (el `.env` NO se sube, el `.gitignore` ya lo evita).
2. En https://render.com crea un **Web Service** conectado a tu repositorio.
3. Root Directory: `brisa-api` (si la dejaste dentro de otro repositorio).
4. Build Command: `npm install`  |  Start Command: `npm start`
5. En **Environment** agrega las 4 variables del `.env.example` con tus valores reales.
6. Cuando termine, tu API queda en `https://TU-SERVICIO.onrender.com`.

Nota: en el plan gratis Render duerme el servicio tras un rato sin uso; la primera petición después puede tardar cerca de un minuto.

## Rutas
| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/services | público |
| POST / PUT / DELETE | /api/services(/:id) | admin |
| GET | /api/settings | público |
| PUT | /api/settings | admin |
| GET | /api/appointments/availability?day=AAAA-MM-DD&staff=... | público (sin datos de clientes) |
| POST | /api/appointments | público |
| GET | /api/appointments | admin |
| PATCH | /api/appointments/:id/cancel | admin |

"Admin" significa enviar el encabezado `x-admin-key` con el valor de `ADMIN_KEY`.
