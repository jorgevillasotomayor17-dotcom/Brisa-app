# Brisa API

API en Node/Express que guarda los datos de Brisa Studio en MongoDB Atlas y alimenta el asistente de IA.

## Probar en tu computador
1. Instala Node.js (https://nodejs.org) si no lo tienes.
2. En la terminal, dentro de esta carpeta: `npm install`
3. Copia `.env.example` como `.env` y completa los valores.
4. `npm start`
5. Abre http://localhost:3000/api/health y debe mostrar `{"ok":true}`.

Si sale el error `EADDRINUSE`, el puerto 3000 ya está ocupado: cierra la otra terminal con la API o cambia `PORT` en el `.env`.

## Publicar la API en Render
1. Sube el proyecto a GitHub (el `.env` NO se sube, el `.gitignore` ya lo evita).
2. En https://render.com crea un **Web Service** conectado a tu repositorio.
3. Root Directory: `brisa-api`. Build Command: `npm install`. Start Command: `npm start`.
4. En **Environment** agrega las variables del `.env.example` con tus valores reales.
   `ALLOWED_ORIGINS` debe incluir tu GitHub Pages (por ejemplo `https://TU_USUARIO.github.io`, sin la ruta del repo).
5. Cuando termine, tu API queda en `https://TU-SERVICIO.onrender.com`.
6. Pon esa dirección en la constante `API` de `js/app.js`.

Nota: en el plan gratis Render duerme el servicio tras un rato sin uso; la primera petición después puede tardar cerca de un minuto.

## Publicar la página en GitHub Pages
1. En el repositorio: **Settings → Pages**.
2. Source: `Deploy from a branch`, rama `main`, carpeta `/ (root)`.
3. Tu sitio queda en `https://TU_USUARIO.github.io/NOMBRE-DEL-REPO/`.
4. La página de inicio es `index.html`. El panel del equipo está en `admin.html` (enlace "Acceso equipo" en el pie de página).
## Variables de entorno
| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `MONGODB_URI` | sí | Conexión a MongoDB Atlas |
| `ADMIN_KEY` | sí | Clave del administrador y firma de las sesiones |
| `DB_NAME` | no | Nombre de la base (por defecto `brisa`) |
| `ALLOWED_ORIGINS` | sí en producción | Orígenes que pueden llamar a la API |
| `ANTHROPIC_API_KEY` | no | Activa la IA del asistente; sin ella usa reglas locales |
| `AI_MODEL` | no | Modelo de IA (por defecto `claude-haiku-5-5`) |
| `TZ_APP` | no | Zona horaria (por defecto `America/Bogota`) |

## Rutas
| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/health | público |
| POST | /api/admin/login | público (10 intentos fallidos cada 15 min por IP) |
| GET | /api/admin/check | admin |
| GET | /api/services | público |
| POST / PUT / DELETE | /api/services(/:id) | admin |
| GET | /api/settings | público |
| PUT | /api/settings | admin |
| GET | /api/appointments/availability?day=AAAA-MM-DD&staff=... | público (sin datos de clientes) |
| POST | /api/appointments | público (20 por 15 min por IP) |
| GET | /api/appointments/mine?phone=... | público |
| POST | /api/appointments/:id/cancel-mine | público (con el celular) |
| GET | /api/appointments | admin |
| PATCH | /api/appointments/:id/cancel | admin |
| POST | /api/chat | público (20 por 10 min por IP) |

"Admin" significa enviar `Authorization: Bearer TOKEN` (el token sale de `/api/admin/login`) o el encabezado `x-admin-key` con el valor de `ADMIN_KEY`.
