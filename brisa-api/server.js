require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const {
  MONGODB_URI,
  ADMIN_KEY,
  DB_NAME = 'brisa',
  ALLOWED_ORIGINS = '',
  PORT = 3000,
} = process.env;

if (!MONGODB_URI || !ADMIN_KEY) {
  console.error('Faltan variables de entorno: MONGODB_URI y ADMIN_KEY son obligatorias.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '50kb' }));

const origins = ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));

let db, appts, services, settings;

/* ---------- utilidades ---------- */
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function requireAdmin(req, res, next) {
  const given = Buffer.from(String(req.get('x-admin-key') || ''));
  const real = Buffer.from(ADMIN_KEY);
  if (given.length === real.length && crypto.timingSafeEqual(given, real)) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ids numéricos autoincrementales (como el "identity" de Postgres)
async function nextId(name) {
  const r = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return r.seq;
}

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const isInt = Number.isInteger;

function validDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!isInt(id) || id < 1) {
    res.status(400).json({ error: 'id inválido' });
    return null;
  }
  return id;
}

const NO_ID = { projection: { _id: 0 } };

/* ---------- salud ---------- */
app.get('/', (req, res) => res.json({ ok: true, name: 'brisa-api' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ---------- servicios ---------- */
function parseService(b = {}) {
  const v = {
    name: clean(b.name),
    price: b.price,
    minutes: b.minutes === undefined ? 30 : b.minutes,
    emoji: b.emoji === undefined ? '✦' : clean(b.emoji),
    descr: b.descr === undefined ? '' : clean(b.descr),
    tags: b.tags === undefined ? '' : clean(b.tags),
  };
  if (v.name.length < 1 || v.name.length > 80) return { error: 'El nombre debe tener entre 1 y 80 caracteres' };
  if (!isInt(v.price) || v.price < 0) return { error: 'El precio debe ser un entero mayor o igual a 0' };
  if (!isInt(v.minutes) || v.minutes <= 0) return { error: 'La duración debe ser un entero mayor que 0' };
  if (v.emoji.length > 8) return { error: 'Emoji demasiado largo' };
  if (v.descr.length > 500) return { error: 'Descripción demasiado larga (máx. 500)' };
  if (v.tags.length > 200) return { error: 'Etiquetas demasiado largas (máx. 200)' };
  return { value: v };
}

app.get('/api/services', wrap(async (req, res) => {
  res.json(await services.find({}, NO_ID).sort({ id: 1 }).toArray());
}));

app.post('/api/services', requireAdmin, wrap(async (req, res) => {
  const { error, value } = parseService(req.body);
  if (error) return res.status(400).json({ error });
  const doc = { id: await nextId('services'), ...value };
  await services.insertOne({ ...doc });
  res.status(201).json(doc);
}));

app.put('/api/services/:id', requireAdmin, wrap(async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const { error, value } = parseService(req.body);
  if (error) return res.status(400).json({ error });
  const r = await services.findOneAndUpdate(
    { id }, { $set: value }, { returnDocument: 'after', projection: { _id: 0 } }
  );
  if (!r) return res.status(404).json({ error: 'Servicio no encontrado' });
  res.json(r);
}));

app.delete('/api/services/:id', requireAdmin, wrap(async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const r = await services.deleteOne({ id });
  if (!r.deletedCount) return res.status(404).json({ error: 'Servicio no encontrado' });
  res.status(204).end();
}));

/* ---------- configuración (una sola fila, id = 1) ---------- */
app.get('/api/settings', wrap(async (req, res) => {
  const doc = await settings.findOne({ id: 1 }, NO_ID);
  res.json(doc || { id: 1, data: {} });
}));

app.put('/api/settings', requireAdmin, wrap(async (req, res) => {
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: '"data" debe ser un objeto' });
  }
  await settings.updateOne({ id: 1 }, { $set: { data } }, { upsert: true });
  res.json({ id: 1, data });
}));

/* ---------- turnos ---------- */
// Pública: solo devuelve qué horarios están ocupados (sin nombre ni teléfono)
app.get('/api/appointments/availability', wrap(async (req, res) => {
  const day = clean(req.query.day);
  if (!validDay(day)) return res.status(400).json({ error: 'day debe tener formato AAAA-MM-DD' });
  const filter = { day, cancelled: false };
  const staff = clean(req.query.staff);
  if (staff) filter.staff = staff;
  const rows = await appts
    .find(filter, { projection: { _id: 0, day: 1, staff: 1, start_min: 1, minutes: 1 } })
    .sort({ start_min: 1 })
    .toArray();
  res.json(rows);
}));

// Solo administrador: lista completa con datos de clientes
app.get('/api/appointments', requireAdmin, wrap(async (req, res) => {
  const filter = {};
  const day = clean(req.query.day);
  if (day) {
    if (!validDay(day)) return res.status(400).json({ error: 'day debe tener formato AAAA-MM-DD' });
    filter.day = day;
  }
  const staff = clean(req.query.staff);
  if (staff) filter.staff = staff;
  res.json(await appts.find(filter, NO_ID).sort({ day: 1, start_min: 1 }).toArray());
}));

// Pública: crear un turno (valida y evita que se pisen dos turnos)
app.post('/api/appointments', wrap(async (req, res) => {
  const b = req.body || {};
  const day = clean(b.day);
  const service = clean(b.service);
  const staff = clean(b.staff);
  const client = clean(b.client);
  const phone = clean(b.phone);
  const start_min = b.start_min;

  if (!validDay(day)) return res.status(400).json({ error: 'day debe tener formato AAAA-MM-DD' });
  if (!service) return res.status(400).json({ error: 'Falta el servicio' });
  if (!staff) return res.status(400).json({ error: 'Falta el profesional' });
  if (client.length < 2 || client.length > 80) return res.status(400).json({ error: 'El nombre debe tener entre 2 y 80 caracteres' });
  if (!/^[0-9]{7,15}$/.test(phone)) return res.status(400).json({ error: 'El teléfono debe tener entre 7 y 15 dígitos' });
  if (!isInt(start_min) || start_min < 0 || start_min > 1439) return res.status(400).json({ error: 'start_min debe estar entre 0 y 1439' });

  // Si el servicio existe, el precio y la duración salen de la base de datos
  // (así nadie puede mandar un precio inventado desde el navegador)
  const svc = await services.findOne({ name: service });
  const minutes = svc ? svc.minutes : b.minutes;
  const price = svc ? svc.price : (b.price === undefined ? 0 : b.price);
  if (!isInt(minutes) || minutes <= 0) return res.status(400).json({ error: 'minutes debe ser un entero mayor que 0' });
  if (!isInt(price) || price < 0) return res.status(400).json({ error: 'price inválido' });

  const end = start_min + minutes;
  const clash = await appts.findOne({
    day, staff, cancelled: false,
    start_min: { $lt: end },
    $expr: { $gt: [{ $add: ['$start_min', '$minutes'] }, start_min] },
  });
  if (clash) return res.status(409).json({ error: 'Ese horario ya está ocupado' });

  const doc = {
    id: await nextId('appointments'),
    day, start_min, minutes, price, service, staff, client, phone,
    cancelled: false,
    created_at: new Date(),
  };
  await appts.insertOne({ ...doc });
  res.status(201).json(doc);
}));

// Solo administrador: cancelar un turno
app.patch('/api/appointments/:id/cancel', requireAdmin, wrap(async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const r = await appts.findOneAndUpdate(
    { id }, { $set: { cancelled: true } }, { returnDocument: 'after', projection: { _id: 0 } }
  );
  if (!r) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json(r);
}));

/* ---------- errores ---------- */
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

/* ---------- arranque ---------- */
(async () => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  appts = db.collection('appointments');
  services = db.collection('services');
  settings = db.collection('settings');
  await appts.createIndex({ day: 1, staff: 1 });
  await appts.createIndex({ id: 1 }, { unique: true });
  await services.createIndex({ id: 1 }, { unique: true });
  await settings.createIndex({ id: 1 }, { unique: true });
  app.listen(PORT, () => console.log('Brisa API escuchando en el puerto ' + PORT));
})().catch((e) => {
  console.error('No se pudo conectar a MongoDB:', e.message);
  process.exit(1);
});
