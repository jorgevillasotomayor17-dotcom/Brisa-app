/* ===== Configuración: cambia estos datos para cada cliente ===== */
const CFG={bot:"Brisi",title:"Tu turno, sin esperas",sub:"Reserva en un minuto, elige a tu profesional y confirma por WhatsApp.",name:"Brisa Studio",wa:"573000000000",open:9,close:19,closed:[0],staff:["Mateo","Laura","Camilo"]};
/* ===== Supabase: la clave publishable es pública por diseño; la seguridad la dan las políticas RLS ===== */
const SB_URL="https://lhbnyiivfqmkadjuovvt.supabase.co",SB_KEY="sb_publishable_xYCxEeRRw-TO-s-G7V_ldQ_NAwwfiqd";
const sb=window.supabase?window.supabase.createClient(SB_URL,SB_KEY):null;
const mapSv=r=>({id:r.id,n:r.name,p:r.price,m:r.minutes,e:r.emoji,d:r.descr,t:r.tags});
const mapAp=r=>({id:r.id,date:r.day,t:r.start_min,m:r.minutes,p:r.price,sv:r.service,st:r.staff,c:r.client,ph:r.phone,x:r.cancelled});
async function loadPublic(){const[a,b]=await Promise.all([sb.from("services").select("*").order("id"),sb.from("settings").select("data").eq("id",1).maybeSingle()]);
 if(a.error)throw a.error;svcs=a.data.map(mapSv);if(b.data&&b.data.data)Object.assign(CFG,b.data.data)}
async function loadBusy(){const n=new Date(),e=new Date(n.getFullYear(),n.getMonth(),n.getDate()+40),r=await sb.rpc("get_busy",{d_from:ymd(n),d_to:ymd(e)});if(!r.error)busyList=r.data}
async function loadAdmin(){const r=await sb.from("appointments").select("*").eq("cancelled",false).gte("day",ymd(new Date())).order("day").order("start_min");if(!r.error)appts=r.data.map(mapAp)}
const $=i=>document.getElementById(i),pad=n=>String(n).padStart(2,"0");
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"$"+Number(n).toLocaleString("es-CO");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const hm=m=>{const h=Math.floor(m/60);return((h+11)%12+1)+":"+pad(m%60)+(h>=12?" p. m.":" a. m.")};
const dlab=d=>d.toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"});
let svcs=[],appts=[],busyList=[],logged=false,sel={sv:null,st:"any",d:null,t:null};
function applyCfg(){document.querySelectorAll(".bn").forEach(e=>e.textContent=CFG.name);$("wa").href="https://wa.me/"+CFG.wa;$("hT").textContent=CFG.title;$("hS").textContent=CFG.sub;$("nb").textContent=CFG.bot;$("botH").textContent=CFG.bot+", tu guía de estilo";$("hr").textContent=hm(CFG.open*60)+" a "+hm(CFG.close*60);
 $("tmw").innerHTML=CFG.staff.map(n=>`<button class="glass tm" data-p="${esc(n)}"><span class="av" aria-hidden="true">${esc(n[0])}</span><span><b>${esc(n)}</b><br><span class="sub">Reservar con ${esc(n)}</span></span></button>`).join("")}

/* ===== Disponibilidad ===== */
const days=()=>{const a=[],n=new Date();for(let i=0;a.length<14&&i<30;i++){const x=new Date(n.getFullYear(),n.getMonth(),n.getDate()+i);if(!CFG.closed.includes(x.getDay()))a.push(x)}return a};
const times=()=>{const a=[];for(let t=CFG.open*60;t<CFG.close*60;t+=30)a.push(t);return a};
function busy(date,s){const o=new Set();busyList.filter(a=>a.day===date&&a.staff===s).forEach(a=>{for(let k=0;k<Math.ceil(a.minutes/30);k++)o.add(a.start_min+30*k)});return o}
function free(date,t,min,st){const n=new Date();
 if(date===ymd(n)&&t<=n.getHours()*60+n.getMinutes())return[];
 if(t+min>CFG.close*60)return[];
 return(st&&st!=="any"?[st]:CFG.staff).filter(s=>{const b=busy(date,s);for(let k=0;k<Math.ceil(min/30);k++)if(b.has(t+30*k))return false;return true})}
function nextFree(){for(const d of days())for(const t of times())if(free(ymd(d),t,30,"any").length)return{d,t};return null}
const cur=()=>svcs.find(s=>s.id===sel.sv);

/* ===== Render ===== */
function renderSv(){
 $("svGrid").innerHTML=svcs.map(s=>`<article class="glass sv"><div class="e" aria-hidden="true">${s.e||"✦"}</div><h3>${esc(s.n)}</h3><p>${esc(s.d||"")}</p><div class="pr">${money(s.p)} <small>· ${s.m} min</small></div><button class="btn g" data-r="${s.id}">Reservar</button></article>`).join("")||"<p>Pronto publicaremos nuestros servicios.</p>";
 $("svSel").innerHTML=svcs.map(s=>`<option value="${s.id}">${esc(s.n)} · ${money(s.p)} · ${s.m} min</option>`).join("");
 if(!cur()&&svcs[0])sel.sv=svcs[0].id;if(sel.sv)$("svSel").value=sel.sv;
}
function renderBook(){
 const s=cur(),ch=(a,l,on,x="")=>`<button type="button" class="chip" aria-pressed="${on}" ${x}>${l}</button>`;
 $("stC").innerHTML=["any",...CFG.staff].map(n=>ch(0,n==="any"?"Cualquiera":esc(n),sel.st===n,`data-s="${esc(n)}"`)).join("");
 $("dC").innerHTML=days().map(d=>ch(0,dlab(d),sel.d===ymd(d),`data-d="${ymd(d)}"`)).join("");
 $("tC").innerHTML=!s?"":!sel.d?"<span class='sub'>Elige primero un día.</span>":times().map(t=>{const ok=free(sel.d,t,s.m,sel.st).length>0;return`<button type="button" class="chip" aria-pressed="${sel.t===t}" data-t="${t}" ${ok?"":"disabled"}>${hm(t)}</button>`}).join("");
 const n=nextFree();$("next").textContent=n?"Próximo turno libre: "+(ymd(n.d)===ymd(new Date())?"hoy":dlab(n.d))+", "+hm(n.t):"Sin turnos por ahora, escríbenos";renderHero();
}
async function showMine(){const ph=$("qp").value.replace(/\D/g,"");if(ph.length<7){$("qr").innerHTML="<p class='msg err'>Escribe el celular con el que reservaste.</p>";return}
 const r=await sb.rpc("my_appointments",{p_phone:ph});
 if(r.error){$("qr").innerHTML="<p class='msg err'>No pudimos consultar. Intenta de nuevo.</p>";return}
 $("qr").innerHTML=r.data.length?r.data.map(a=>`<p>${esc(a.service)} con ${esc(a.staff)}, ${dlab(new Date(a.day+"T12:00:00"))} a las ${hm(a.start_min)} <button class="chip" data-q="${a.id}">Cancelar</button></p>`).join(""):"<p>No encontramos turnos próximos con ese celular.</p>"}
$("qf").onsubmit=e=>{e.preventDefault();showMine()};
$("qr").onclick=async e=>{const b=e.target.closest("[data-q]");if(b){await sb.rpc("cancel_my_appointment",{p_id:+b.dataset.q,p_phone:$("qp").value.replace(/\D/g,"")});await loadBusy();showMine();renderBook()}};
function renderHero(){const s=cur();if(!s)return;const o=[];for(const d of days().slice(0,4)){const L=times().filter(t=>free(ymd(d),t,s.m,"any").length);if(L.length){o.push([d,L[0]]);const a=L.find(t=>t>=840);if(a&&a!==L[0])o.push([d,a])}}
 $("hf").innerHTML=o.slice(0,6).map(([d,t])=>`<button class="chip" data-h="${ymd(d)}|${t}">${ymd(d)===ymd(new Date())?"Hoy":dlab(d)} · ${hm(t)}</button>`).join("")||"<p>Sin turnos por ahora.</p>"}
function fillCfg(){$("k1").value=CFG.name;$("k2").value=CFG.wa;$("k3").value=CFG.title;$("k4").value=CFG.sub;$("k5").value=CFG.open;$("k6").value=CFG.close;$("k7").value=CFG.staff.join(", ")}
$("cf2").onsubmit=async e=>{e.preventDefault();const st=$("k7").value.split(",").map(s=>s.trim()).filter(Boolean),o=+$("k5").value,c=+$("k6").value,m=$("km");
 if(!$("k1").value.trim()||!st.length||!(c>o)){m.className="msg err";m.textContent="Revisa el nombre, el equipo y que la hora de cierre sea mayor que la de apertura.";return}
 const v={name:$("k1").value.trim(),wa:$("k2").value.replace(/\D/g,""),title:$("k3").value.trim(),sub:$("k4").value.trim(),open:o,close:c,staff:st};const sv=await sb.from("settings").upsert({id:1,data:v});if(sv.error){m.className="msg err";m.textContent="No se pudo guardar. Revisa tu sesión.";return}
 Object.assign(CFG,v);if(!st.includes(sel.st))sel.st="any";applyCfg();renderBook();m.className="msg ok";m.textContent="Cambios guardados."};
function renderAdmin(){
 $("lb").hidden=logged;$("pn").hidden=!logged;if(!logged)return;
 const td=ymd(new Date()),up=appts.filter(a=>!a.x&&a.date>=td).sort((a,b)=>a.date.localeCompare(b.date)||a.t-b.t);
 $("s1").textContent=up.filter(a=>a.date===td).length;$("s2").textContent=up.length;$("s3").textContent=money(up.reduce((x,a)=>x+a.p,0));
 $("ag").innerHTML=up.length?`<table><tr><th>Día</th><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Con</th><th></th></tr>${up.map(a=>`<tr><td>${a.date}</td><td>${hm(a.t)}</td><td>${esc(a.c)}<br><small>${esc(a.ph)}</small></td><td>${esc(a.sv)}</td><td>${esc(a.st)}</td><td><a class="chip" target="_blank" rel="noopener" href="https://wa.me/${a.ph.length===10?"57"+a.ph:a.ph}?text=${encodeURIComponent("Hola "+a.c+", te recordamos tu turno en "+CFG.name+": "+a.sv+" el "+a.date+" a las "+hm(a.t))}">Recordar</a> <button class="chip" data-x="${a.id}">Cancelar</button></td></tr>`).join("")}</table>`:"<p>No hay turnos próximos. Las reservas nuevas aparecerán aquí.</p>";
 $("sl").innerHTML=`<table>${svcs.map(s=>`<tr><td>${esc(s.n)}</td><td>${money(s.p)}</td><td>${s.m} min</td><td><button class="chip" data-ds="${s.id}">Borrar</button></td></tr>`).join("")}</table>`;
}

/* ===== Eventos ===== */
document.addEventListener("click",e=>{const h=e.target.closest("[data-h]");if(h){const[d,t]=h.dataset.h.split("|");sel.d=d;sel.t=+t;renderBook();$("reservar").scrollIntoView();return}
const p=e.target.closest("[data-p]");if(p){sel.st=p.dataset.p;sel.t=null;renderBook();$("reservar").scrollIntoView();return}
const r=e.target.closest("[data-r]");if(r){sel.sv=+r.dataset.r;sel.t=null;$("svSel").value=sel.sv;renderBook();$("reservar").scrollIntoView()}});
$("svSel").onchange=e=>{sel.sv=+e.target.value;sel.t=null;renderBook()};
$("stC").onclick=e=>{const b=e.target.closest("[data-s]");if(b){sel.st=b.dataset.s;sel.t=null;renderBook()}};
$("dC").onclick=e=>{const b=e.target.closest("[data-d]");if(b){sel.d=b.dataset.d;sel.t=null;renderBook()}};
$("tC").onclick=e=>{const b=e.target.closest("[data-t]");if(b&&!b.disabled){sel.t=+b.dataset.t;renderBook()}};
$("bf").onsubmit=async e=>{e.preventDefault();const m=$("bm"),s=cur(),n=$("bn").value.trim(),ph=$("bp").value.replace(/\D/g,"");
 const bad=t=>{m.className="msg err";m.textContent=t};
 if(!s||!sel.d||sel.t==null)return bad("Elige servicio, día y hora.");
 if(n.length<2)return bad("Escribe tu nombre.");if(ph.length<7)return bad("Escribe un celular válido.");
 const form=e.target,btn=form.querySelector(".btn"),cands=free(sel.d,sel.t,s.m,sel.st);
 if(!cands.length){renderBook();return bad("Ese horario se acaba de ocupar. Elige otro.")}
 btn.disabled=true;m.className="msg";m.textContent="Guardando…";let f=null;
 for(const c of cands){const r=await sb.rpc("book_appointment",{p_day:sel.d,p_start:sel.t,p_service_id:s.id,p_staff:c,p_client:n,p_phone:ph});if(!r.error){f=c;break}if(!/ocupado/i.test(r.error.message)){btn.disabled=false;return bad("No pudimos guardar tu turno. Intenta de nuevo.")}}
 await loadBusy();btn.disabled=false;
 if(!f){renderBook();return bad("Ese horario se acaba de ocupar. Elige otro.")}
 const dt=new Date(sel.d+"T12:00:00"),txt=`Hola ${CFG.name}, soy ${n}. Reservé ${s.n} con ${f} el ${dlab(dt)} a las ${hm(sel.t)}`;
 m.textContent="";$("done").hidden=false;
 $("done").innerHTML=`<b>Turno reservado</b><br>${esc(s.n)} con ${esc(f)}, ${dlab(dt)} a las ${hm(sel.t)}<br><br><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${CFG.wa}?text=${encodeURIComponent(txt)}">Confirmar por WhatsApp</a>`;
 sel.t=null;form.reset();renderBook()};
$("ga").onclick=()=>{$("admin").hidden=false};
if(location.hash==="#admin")$("admin").hidden=false;
$("lf").onsubmit=async e=>{e.preventDefault();const r=await sb.auth.signInWithPassword({email:$("lu").value.trim(),password:$("lp").value});
 if(r.error){const t=r.error.message||"",c=/confirm/i.test(t)?"Tu correo aún no está confirmado en Supabase.":/invalid login/i.test(t)?"Correo o contraseña incorrectos.":"No se pudo iniciar sesión: "+t;$("lm").className="msg err";$("lm").textContent=c;console.error("Login:",r.error);return}
 logged=true;$("lm").textContent="";await enterAdmin()};
async function enterAdmin(){await loadAdmin();fillCfg();renderAdmin()}
$("lo").onclick=async()=>{await sb.auth.signOut();logged=false;appts=[];$("lp").value="";renderAdmin()};
$("ag").onclick=async e=>{const b=e.target.closest("[data-x]");if(b){await sb.from("appointments").update({cancelled:true}).eq("id",+b.dataset.x);await loadAdmin();await loadBusy();renderAdmin();renderBook()}};
$("sl").onclick=async e=>{const b=e.target.closest("[data-ds]");if(b){await sb.from("services").delete().eq("id",+b.dataset.ds);await loadPublic();renderSv();renderBook();renderAdmin()}};
$("af").onsubmit=async e=>{e.preventDefault();const n=$("an").value.trim(),p=+$("ap").value,m=+$("am").value||30;if(!n||!p)return;
 await sb.from("services").insert({name:n,price:p,minutes:m,emoji:"✦",descr:"",tags:n.toLowerCase()});await loadPublic();e.target.reset();renderSv();renderBook();renderAdmin()};

/* ===== Asistente (reglas locales; conectable a una API de IA desde un backend) ===== */
const norm=s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const say=(t,w,btns=[])=>{const d=document.createElement("div");d.className="b "+w;d.textContent=t;btns.forEach(s=>{const b=document.createElement("button");b.className="chip";b.textContent="Reservar "+s.n;b.onclick=()=>{sel.sv=s.id;sel.t=null;$("svSel").value=s.id;renderBook();$("reservar").scrollIntoView()};d.appendChild(document.createElement("br"));d.appendChild(b)});$("log").appendChild(d);$("log").scrollTop=1e5};
function reply(q){q=norm(q);
 if(/horari|abren|cierr|atienden|a que hora/.test(q))return[`Atendemos de ${hm(CFG.open*60)} a ${hm(CFG.close*60)}, ${CFG.closed.includes(0)?"de lunes a sábado":"todos los días"}.`,[]];
 if(/precio|cuest|cuanto|valor|tarifa/.test(q))return["Nuestros precios: "+svcs.map(s=>`${s.n} ${money(s.p)}`).join(", ")+".",[]];
 if(/donde|ubic|direcc|llegar/.test(q))return["Escríbenos por WhatsApp y te enviamos la ubicación.",[]];
 const sc=svcs.map(s=>({s,k:norm(s.t+" "+s.n).split(/\s+/).filter(w=>w.length>3&&q.includes(w)).length})).filter(x=>x.k).sort((a,b)=>b.k-a.k).slice(0,2).map(x=>x.s);
 return sc.length?["Te recomiendo:\n"+sc.map(s=>`• ${s.n} (${money(s.p)}, ${s.m} min)`).join("\n"),sc]:["Cuéntame qué buscas: corte, barba, color, manicure o facial. También puedo decirte horarios y precios.",[]]}
const ask=q=>{say(q,"me");const[t,b]=reply(q);say(t,"bot",b)};
$("log").style.whiteSpace="pre-line";
say("Hola, soy "+CFG.bot+", la guía de "+CFG.name+". ¿Qué te gustaría hacerte?","bot");
$("sug").innerHTML=["Arreglar la barba","Quiero cambiar de color","¿Cuánto cuesta?","¿Qué horario tienen?"].map(s=>`<button class="chip" type="button">${s}</button>`).join("");
$("sug").onclick=e=>{if(e.target.matches(".chip"))ask(e.target.textContent)};
$("cf").onsubmit=e=>{e.preventDefault();const v=$("ci").value.trim();if(v){ask(v);$("ci").value=""}};

applyCfg();renderSv();renderBook();renderAdmin();
(async()=>{try{await Promise.all([loadPublic(),loadBusy()]);applyCfg();renderSv();renderBook();
 const r=await sb.auth.getSession();if(r.data.session){logged=true;await enterAdmin()}}
 catch(e){$("next").textContent="No pudimos conectar con el servidor. Recarga la página."}})();