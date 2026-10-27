# Brisa Studio

App web de reservas para barberías y salones de estética.

- Reserva de turnos por servicio, profesional, día y hora (sin turnos duplicados)
- Confirmación por WhatsApp
- Panel del equipo con login: agenda, servicios y datos del negocio editables
- Brisi, asistente que recomienda servicios y responde precios y horarios
- Diseño glass, responsive para celular, tablet y computador

## Archivos
- `index.html` estructura de la página
- `css/styles.css` estilos
- `js/app.js` lógica (los datos del negocio están en `CFG` al inicio)

## Datos y login
Los turnos, servicios y ajustes se guardan en Supabase (tablas con RLS). El panel usa Supabase Auth con el correo del equipo.
