/* ===== Configuración: cambia estos datos para cada cliente ===== */
const CFG = { bot: "Brisi", title: "Tu turno, sin esperas", sub: "Reserva en un minuto, elige a tu profesional y confirma por WhatsApp.", name: "Brisa Studio", wa: "573000000000", open: 9, close: 19, closed: [0], staff: ["Mateo", "Laura", "Camilo"] };
/* ===== API propia (Express + MongoDB Atlas) =====
   En tu computador usa el servidor local; ya publicada usa la dirección de Render.
   >>> Cambia la dirección de Render cuando tengas la tuya <<< */
const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:3000" : "https://brisa-api.onrender.com";
let adminToken = sessionStorage.getItem("brisa_admin") || "";
async function api(path, o = {}) {
    const headers = {};
    if (o.body) headers["Content-Type"] = "application/json";
    if (o.admin && adminToken) headers["Authorization"] = "Bearer " + adminToken;
    const r = await fetch(API + path, { method: o.method || "GET", headers, body: o.body ? JSON.stringify(o.body) : undefined });
    let data = null; try { data = await r.json() } catch (e) { }
    if (!r.ok) { const err = new Error((data && data.error) || "Error " + r.status); err.status = r.status; throw err }
    return data
}
function endSession() { adminToken = ""; sessionStorage.removeItem("brisa_admin"); logged = false; appts = []; renderAdmin() }
const mapSv = r => ({ id: r.id, n: r.name, p: r.price, m: r.minutes, e: r.emoji, d: r.descr, t: r.tags });
const mapAp = r => ({ id: r.id, date: r.day, t: r.start_min, m: r.minutes, p: r.price, sv: r.service, st: r.staff, c: r.client, ph: r.phone, x: r.cancelled });
async function loadPublic() {
    const [a, b] = await Promise.all([api("/api/services"), api("/api/settings")]);
    svcs = a.map(mapSv); if (b && b.data) Object.assign(CFG, b.data)
}
async function loadBusy() { const n = new Date(), e = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 40); try { busyList = await api("/api/appointments/availability?from=" + ymd(n) + "&to=" + ymd(e)) } catch (err) { } }
async function loadAdmin() { try { msgs = await api("/api/contact", { admin: true }) } catch (err) { } try { appts = (await api("/api/appointments?cancelled=false&from=" + ymd(new Date()), { admin: true })).map(mapAp) } catch (err) { if (err.status === 401) endSession() } }
const $ = i => document.getElementById(i) || document.createElement("div"), pad = n => String(n).padStart(2, "0");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n).toLocaleString("es-CO");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const hm = m => { const h = Math.floor(m / 60); return ((h + 11) % 12 + 1) + ":" + pad(m % 60) + (h >= 12 ? " p. m." : " a. m.") };
const dlab = d => d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
let svcs = [], appts = [], msgs = [], busyList = [], logged = false, sel = { sv: null, st: "any", d: null, t: null };
function applyCfg() {
    document.querySelectorAll(".bn").forEach(e => e.textContent = CFG.name); $("wa").href = "https://wa.me/" + CFG.wa; $("hT").textContent = CFG.title; $("hS").textContent = CFG.sub; $("nb").textContent = CFG.bot; $("botH").textContent = CFG.bot + ", tu guía de estilo"; $("hr").textContent = hm(CFG.open * 60) + " a " + hm(CFG.close * 60);
    $("tmw").innerHTML = CFG.staff.map(n => `<button class="glass tm" data-p="${esc(n)}"><span class="av" aria-hidden="true">${esc(n[0])}</span><span><b>${esc(n)}</b><br><span class="sub">Reservar con ${esc(n)}</span></span></button>`).join("")
}

/* ===== Disponibilidad ===== */
const days = () => { const a = [], n = new Date(); for (let i = 0; a.length < 14 && i < 30; i++) { const x = new Date(n.getFullYear(), n.getMonth(), n.getDate() + i); if (!CFG.closed.includes(x.getDay())) a.push(x) } return a };
const times = () => { const a = []; for (let t = CFG.open * 60; t < CFG.close * 60; t += 30)a.push(t); return a };
function busy(date, s) { const o = new Set(); busyList.filter(a => a.day === date && a.staff === s).forEach(a => { for (let k = 0; k < Math.ceil(a.minutes / 30); k++)o.add(a.start_min + 30 * k) }); return o }
function free(date, t, min, st) {
    const n = new Date();
    if (date === ymd(n) && t <= n.getHours() * 60 + n.getMinutes()) return [];
    if (t + min > CFG.close * 60) return [];
    return (st && st !== "any" ? [st] : CFG.staff).filter(s => { const b = busy(date, s); for (let k = 0; k < Math.ceil(min / 30); k++)if (b.has(t + 30 * k)) return false; return true })
}
function nextFree() { for (const d of days()) for (const t of times()) if (free(ymd(d), t, 30, "any").length) return { d, t }; return null }
const cur = () => svcs.find(s => s.id === sel.sv);
// Si la reserva está en otra página, vamos a ella; si está en esta, bajamos hasta ella
function goBook(q) { if ($("reservar").isConnected) { renderBook(); $("reservar").scrollIntoView() } else location.href = "reservar.html?" + q }

/* ===== Render ===== */
function renderSv() {
    $("svGrid").innerHTML = svcs.map(s => `<article class="glass sv"><div class="e" aria-hidden="true">${s.e || "✦"}</div><h3>${esc(s.n)}</h3><p>${esc(s.d || "")}</p><div class="pr">${money(s.p)} <small>· ${s.m} min</small></div><button class="btn g" data-r="${s.id}">Reservar</button></article>`).join("") || "<p>Pronto publicaremos nuestros servicios.</p>";
    $("svSel").innerHTML = svcs.map(s => `<option value="${s.id}">${esc(s.n)} · ${money(s.p)} · ${s.m} min</option>`).join("");
    if (!cur() && svcs[0]) sel.sv = svcs[0].id; if (sel.sv) $("svSel").value = sel.sv;
}
function renderBook() {
    const s = cur(), ch = (a, l, on, x = "") => `<button type="button" class="chip" aria-pressed="${on}" ${x}>${l}</button>`;
    $("stC").innerHTML = ["any", ...CFG.staff].map(n => ch(0, n === "any" ? "Cualquiera" : esc(n), sel.st === n, `data-s="${esc(n)}"`)).join("");
    $("dC").innerHTML = days().map(d => ch(0, dlab(d), sel.d === ymd(d), `data-d="${ymd(d)}"`)).join("");
    $("tC").innerHTML = !s ? "" : !sel.d ? "<span class='sub'>Elige primero un día.</span>" : times().map(t => { const ok = free(sel.d, t, s.m, sel.st).length > 0; return `<button type="button" class="chip" aria-pressed="${sel.t === t}" data-t="${t}" ${ok ? "" : "disabled"}>${hm(t)}</button>` }).join("");
    const n = nextFree(); $("next").textContent = n ? "Próximo turno libre: " + (ymd(n.d) === ymd(new Date()) ? "hoy" : dlab(n.d)) + ", " + hm(n.t) : "Sin turnos por ahora, escríbenos"; renderHero();
}
async function showMine() {
    const ph = $("qp").value.replace(/\D/g, ""); if (ph.length < 7) { $("qr").innerHTML = "<p class='msg err'>Escribe el celular con el que reservaste.</p>"; return }
    let rows; try { rows = await api("/api/appointments/mine?phone=" + ph) } catch (err) { $("qr").innerHTML = "<p class='msg err'>No pudimos consultar. Intenta de nuevo.</p>"; return }
    $("qr").innerHTML = rows.length ? rows.map(a => `<p>${esc(a.service)} con ${esc(a.staff)}, ${dlab(new Date(a.day + "T12:00:00"))} a las ${hm(a.start_min)} <button class="chip" data-q="${a.id}">Cancelar</button></p>`).join("") : "<p>No encontramos turnos próximos con ese celular.</p>"
}
$("qf").onsubmit = e => { e.preventDefault(); showMine() };
$("qr").onclick = async e => { const b = e.target.closest("[data-q]"); if (b) { try { await api("/api/appointments/" + +b.dataset.q + "/cancel-mine", { method: "POST", body: { phone: $("qp").value.replace(/\D/g, "") } }) } catch (err) { } await loadBusy(); showMine(); renderBook() } };
function renderHero() {
    const s = cur(); if (!s) return; const o = []; for (const d of days().slice(0, 4)) { const L = times().filter(t => free(ymd(d), t, s.m, "any").length); if (L.length) { o.push([d, L[0]]); const a = L.find(t => t >= 840); if (a && a !== L[0]) o.push([d, a]) } }
    $("hf").innerHTML = o.slice(0, 6).map(([d, t]) => `<button class="chip" data-h="${ymd(d)}|${t}">${ymd(d) === ymd(new Date()) ? "Hoy" : dlab(d)} · ${hm(t)}</button>`).join("") || "<p>Sin turnos por ahora.</p>"
}
function fillCfg() { $("k1").value = CFG.name; $("k2").value = CFG.wa; $("k3").value = CFG.title; $("k4").value = CFG.sub; $("k5").value = CFG.open; $("k6").value = CFG.close; $("k7").value = CFG.staff.join(", ") }
$("cf2").onsubmit = async e => {
    e.preventDefault(); const st = $("k7").value.split(",").map(s => s.trim()).filter(Boolean), o = +$("k5").value, c = +$("k6").value, m = $("km");
    if (!$("k1").value.trim() || !st.length || !(c > o)) { m.className = "msg err"; m.textContent = "Revisa el nombre, el equipo y que la hora de cierre sea mayor que la de apertura."; return }
    const v = { name: $("k1").value.trim(), wa: $("k2").value.replace(/\D/g, ""), title: $("k3").value.trim(), sub: $("k4").value.trim(), open: o, close: c, staff: st }; let fail = false; try { await api("/api/settings", { method: "PUT", admin: true, body: { data: v } }) } catch (err) { fail = true; if (err.status === 401) endSession() } if (fail) { m.className = "msg err"; m.textContent = "No se pudo guardar. Revisa tu sesión."; return }
    Object.assign(CFG, v); if (!st.includes(sel.st)) sel.st = "any"; applyCfg(); renderBook(); m.className = "msg ok"; m.textContent = "Cambios guardados."
};
function renderAdmin() {
    $("lb").hidden = logged; $("pn").hidden = !logged; if (!logged) return;
    $("ms").innerHTML = msgs.length ? `<table><tr><th>Fecha</th><th>Nombre</th><th>Contacto</th><th>Mensaje</th><th></th></tr>${msgs.map(m => `<tr><td>${esc(String(m.created_at).slice(0, 10))}</td><td>${esc(m.name)}</td><td>${esc(m.phone || "")}${m.phone && m.email ? "<br>" : ""}${esc(m.email || "")}</td><td>${esc(m.message)}</td><td><button class="chip" data-dm="${m.id}">Borrar</button></td></tr>`).join("")}</table>` : "<p>Aún no hay mensajes.</p>";
    const td = ymd(new Date()), up = appts.filter(a => !a.x && a.date >= td).sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t);
    $("s1").textContent = up.filter(a => a.date === td).length; $("s2").textContent = up.length; $("s3").textContent = money(up.reduce((x, a) => x + a.p, 0));
    $("ag").innerHTML = up.length ? `<table><tr><th>Día</th><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Con</th><th></th></tr>${up.map(a => `<tr><td>${a.date}</td><td>${hm(a.t)}</td><td>${esc(a.c)}<br><small>${esc(a.ph)}</small></td><td>${esc(a.sv)}</td><td>${esc(a.st)}</td><td><a class="chip" target="_blank" rel="noopener" href="https://wa.me/${a.ph.length === 10 ? "57" + a.ph : a.ph}?text=${encodeURIComponent("Hola " + a.c + ", te recordamos tu turno en " + CFG.name + ": " + a.sv + " el " + a.date + " a las " + hm(a.t))}">Recordar</a> <button class="chip" data-x="${a.id}">Cancelar</button></td></tr>`).join("")}</table>` : "<p>No hay turnos próximos. Las reservas nuevas aparecerán aquí.</p>";
    $("sl").innerHTML = `<table>${svcs.map(s => `<tr><td>${esc(s.e || "✦")} ${esc(s.n)}</td><td>${money(s.p)}</td><td>${s.m} min</td><td><button class="chip" data-es="${s.id}">Editar</button> <button class="chip" data-ds="${s.id}">Borrar</button></td></tr>`).join("")}</table>`;
}

/* ===== Eventos ===== */
document.addEventListener("click", e => {
    const h = e.target.closest("[data-h]"); if (h) { const [d, t] = h.dataset.h.split("|"); sel.d = d; sel.t = +t; renderBook(); $("reservar").scrollIntoView(); return }
    const p = e.target.closest("[data-p]"); if (p) { sel.st = p.dataset.p; sel.t = null; goBook("p=" + encodeURIComponent(sel.st)); return }
    const r = e.target.closest("[data-r]"); if (r) { sel.sv = +r.dataset.r; sel.t = null; $("svSel").value = sel.sv; goBook("s=" + sel.sv) }
});
$("svSel").onchange = e => { sel.sv = +e.target.value; sel.t = null; renderBook() };
$("stC").onclick = e => { const b = e.target.closest("[data-s]"); if (b) { sel.st = b.dataset.s; sel.t = null; renderBook() } };
$("dC").onclick = e => { const b = e.target.closest("[data-d]"); if (b) { sel.d = b.dataset.d; sel.t = null; renderBook() } };
$("tC").onclick = e => { const b = e.target.closest("[data-t]"); if (b && !b.disabled) { sel.t = +b.dataset.t; renderBook() } };
$("bf").onsubmit = async e => {
    e.preventDefault(); const m = $("bm"), s = cur(), n = $("bn").value.trim(), ph = $("bp").value.replace(/\D/g, "");
    const bad = t => { m.className = "msg err"; m.textContent = t };
    if (!s || !sel.d || sel.t == null) return bad("Elige servicio, día y hora.");
    if (n.length < 2) return bad("Escribe tu nombre."); if (ph.length < 7) return bad("Escribe un celular válido.");
    const form = e.target, btn = form.querySelector(".btn"), cands = free(sel.d, sel.t, s.m, sel.st);
    if (!cands.length) { renderBook(); return bad("Ese horario se acaba de ocupar. Elige otro.") }
    btn.disabled = true; m.className = "msg"; m.textContent = "Guardando…"; let f = null;
    for (const c of cands) { try { await api("/api/appointments", { method: "POST", body: { day: sel.d, start_min: sel.t, service_id: s.id, staff: c, client: n, phone: ph } }); f = c; break } catch (err) { if (err.status === 409) continue; btn.disabled = false; return bad("No pudimos guardar tu turno. Intenta de nuevo.") } }
    await loadBusy(); btn.disabled = false;
    if (!f) { renderBook(); return bad("Ese horario se acaba de ocupar. Elige otro.") }
    const dt = new Date(sel.d + "T12:00:00"), txt = `Hola ${CFG.name}, soy ${n}. Reservé ${s.n} con ${f} el ${dlab(dt)} a las ${hm(sel.t)}`;
    m.textContent = ""; $("done").hidden = false;
    $("done").innerHTML = `<b>Turno reservado</b><br>${esc(s.n)} con ${esc(f)}, ${dlab(dt)} a las ${hm(sel.t)}<br><br><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${CFG.wa}?text=${encodeURIComponent(txt)}">Confirmar por WhatsApp</a>`;
    sel.t = null; form.reset(); renderBook()
};
$("ga").onclick = () => { $("admin").hidden = false };
if (location.hash === "#admin") $("admin").hidden = false;
$("lf").onsubmit = async e => {
    e.preventDefault();
    try { const r = await api("/api/admin/login", { method: "POST", body: { key: $("lp").value } }); adminToken = r.token; sessionStorage.setItem("brisa_admin", adminToken) }
    catch (err) { $("lm").className = "msg err"; $("lm").textContent = err.status === 401 ? "Clave incorrecta." : err.status === 429 ? "Demasiados intentos. Espera unos minutos." : "No se pudo iniciar sesión. Intenta de nuevo."; return }
    logged = true; $("lm").textContent = ""; $("lp").value = ""; await enterAdmin()
};
async function enterAdmin() { await loadAdmin(); fillCfg(); renderAdmin() }
$("lo").onclick = () => { $("lp").value = ""; endSession() };
$("ag").onclick = async e => { const b = e.target.closest("[data-x]"); if (b) { try { await api("/api/appointments/" + +b.dataset.x + "/cancel", { method: "PATCH", admin: true }) } catch (err) { if (err.status === 401) return endSession() } await loadAdmin(); await loadBusy(); renderAdmin(); renderBook() } };
$("sl").onclick = async e => { const ed = e.target.closest("[data-es]"); if (ed) { startEdit(+ed.dataset.es); return } const b = e.target.closest("[data-ds]"); if (b) { try { await api("/api/services/" + +b.dataset.ds, { method: "DELETE", admin: true }) } catch (err) { if (err.status === 401) return endSession() } await loadPublic(); renderSv(); renderBook(); renderAdmin() } };
let editId = null;
function startEdit(id) { const s = svcs.find(x => x.id === id); if (!s) return; editId = id; $("an").value = s.n; $("ap").value = s.p; $("am").value = s.m; $("ae").value = s.e || ""; $("ad").value = s.d || ""; $("ab").textContent = "Guardar cambios"; $("ac").hidden = false; $("an").focus() }
function stopEdit() { editId = null; $("af").reset(); $("ab").textContent = "Agregar"; $("ac").hidden = true }
$("ac").onclick = stopEdit;
$("af").onsubmit = async e => {
    e.preventDefault(); const n = $("an").value.trim(), p = +$("ap").value, m = +$("am").value || 30, em = $("ae").value.trim() || "✦", d = $("ad").value.trim();
    if (!n || $("ap").value === "" || !(p >= 0)) return;
    const body = { name: n, price: p, minutes: m, emoji: em, descr: d, tags: (n + " " + d).toLowerCase().slice(0, 200) };
    try { await api(editId ? "/api/services/" + editId : "/api/services", { method: editId ? "PUT" : "POST", admin: true, body }) }
    catch (err) { if (err.status === 401) return endSession(); alert(err.message); return }
    stopEdit(); await loadPublic(); renderSv(); renderBook(); renderAdmin()
};

/* ===== Contacto ===== */
$("ct").onsubmit = async e => {
    e.preventDefault(); const m = $("cs"), btn = e.target.querySelector(".btn");
    btn.disabled = true; m.className = "msg"; m.textContent = "Enviando…";
    try { await api("/api/contact", { method: "POST", body: { name: $("cn").value, phone: $("cp").value, email: $("ce").value, message: $("cm").value, website: $("cw").value } }); m.className = "msg ok"; m.textContent = "¡Mensaje enviado! Te responderemos pronto."; e.target.reset() }
    catch (err) { m.className = "msg err"; m.textContent = err.status === 400 ? err.message : err.status === 429 ? "Demasiados mensajes. Intenta más tarde." : "No pudimos enviar el mensaje. Intenta de nuevo." }
    btn.disabled = false
};
$("ms").onclick = async e => { const b = e.target.closest("[data-dm]"); if (b) { try { await api("/api/contact/" + +b.dataset.dm, { method: "DELETE", admin: true }) } catch (err) { if (err.status === 401) return endSession() } await loadAdmin(); renderAdmin() } };
// Agrega "Contacto" al menú de todas las páginas
{ const nl = document.querySelector("nav .l"), nb = $("nb"); if (nl && nb.isConnected && !nl.querySelector('[href="contacto.html"]')) { const a = document.createElement("a"); a.href = "contacto.html"; a.textContent = "Contacto"; if (location.pathname.endsWith("contacto.html")) a.setAttribute("aria-current", "page"); nl.insertBefore(a, nb) } }

/* ===== Asistente: IA real vía /api/chat, con respaldo de reglas locales si la IA no responde ===== */
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const say = (t, w, btns = []) => { const d = document.createElement("div"); d.className = "b " + w; d.textContent = t; btns.forEach(s => { const b = document.createElement("button"); b.className = "chip"; b.textContent = "Reservar " + s.n; b.onclick = () => { sel.sv = s.id; sel.t = null; $("svSel").value = s.id; goBook("s=" + s.id) }; d.appendChild(document.createElement("br")); d.appendChild(b) }); $("log").appendChild(d); $("log").scrollTop = 1e5; return d };
function reply(q) {
    q = norm(q);
    if (/horari|abren|cierr|atienden|a que hora/.test(q)) return [`Atendemos de ${hm(CFG.open * 60)} a ${hm(CFG.close * 60)}, ${CFG.closed.includes(0) ? "de lunes a sábado" : "todos los días"}.`, []];
    if (/precio|cuest|cuanto|valor|tarifa/.test(q)) return ["Nuestros precios: " + svcs.map(s => `${s.n} ${money(s.p)}`).join(", ") + ".", []];
    if (/donde|ubic|direcc|llegar/.test(q)) return ["Escríbenos por WhatsApp y te enviamos la ubicación.", []];
    const sc = svcs.map(s => ({ s, k: norm(s.t + " " + s.n).split(/\s+/).filter(w => w.length > 3 && q.includes(w)).length })).filter(x => x.k).sort((a, b) => b.k - a.k).slice(0, 2).map(x => x.s);
    return sc.length ? ["Te recomiendo:\n" + sc.map(s => `• ${s.n} (${money(s.p)}, ${s.m} min)`).join("\n"), sc] : ["Cuéntame qué buscas: corte, barba, color, manicure o facial. También puedo decirte horarios y precios.", []]
}
const chatHist = [];
async function ask(q) {
    say(q, "me");
    const wait = say("Escribiendo…", "bot");
    let t, b = [];
    try {
        const r = await api("/api/chat", { method: "POST", body: { message: q, history: chatHist.slice(-6) } });
        t = r.reply; b = svcs.filter(s => (r.services || []).includes(s.id))
    } catch (err) { [t, b] = reply(q) }
    wait.remove(); say(t, "bot", b);
    chatHist.push({ role: "user", text: q }, { role: "assistant", text: t })
}
$("log").style.whiteSpace = "pre-line";
say("Hola, soy " + CFG.bot + ", la guía de " + CFG.name + ". ¿Qué te gustaría hacerte?", "bot");
$("sug").innerHTML = ["Arreglar la barba", "Quiero cambiar de color", "¿Cuánto cuesta?", "¿Qué horario tienen?"].map(s => `<button class="chip" type="button">${s}</button>`).join("");
$("sug").onclick = e => { if (e.target.matches(".chip")) ask(e.target.textContent) };
$("cf").onsubmit = e => { e.preventDefault(); const v = $("ci").value.trim(); if (v) { ask(v); $("ci").value = "" } };

applyCfg(); renderSv(); renderBook(); renderAdmin();
(async () => {
    try {
        await Promise.all([loadPublic(), loadBusy()]); const qs = new URLSearchParams(location.search); if (qs.get("s")) sel.sv = +qs.get("s"); if (qs.get("p")) sel.st = qs.get("p"); applyCfg(); renderSv(); renderBook();
        if (adminToken) { try { await api("/api/admin/check", { admin: true }); logged = true; await enterAdmin() } catch (err) { endSession() } }
    }
    catch (e) { $("next").textContent = "No pudimos conectar con el servidor. Recarga la página." }
})();