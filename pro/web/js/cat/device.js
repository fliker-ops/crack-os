// Telefono: informacion, sensores, sonido, camara, imagenes y archivos
import { cat, group, T, N, S, A, SEL, F, B, C, fmt, need, table } from '../tool.js';
import { G } from '../roles.js';
import { native } from '../native.js';
import { audioCtx, beep } from './time.js';
import { HASHES } from './dev.js';
import { bytes } from '../ui.js';

const two = (n) => String(n).padStart(2, '0');

cat('dev2', 'Teléfono', 'phone', G.vis, 'Información del equipo, sensores, linterna, pantalla y vibración');
group('Información');
T('Información del teléfono', [], async () => { const i = native.info() || {}; let bat = '—'; try { const b = await native.battery(); bat = b.level + ' %' + (b.charging ? ' (cargando)' : ''); } catch {}
  return table([['Modelo', native.device], ['Android', i.android || '—'], ['Fabricante', i.maker || '—'], ['Pantalla', `${screen.width}×${screen.height} @${devicePixelRatio}x`], ['Batería', bat], ['Memoria RAM', i.ram ? bytes(i.ram) : (navigator.deviceMemory ? navigator.deviceMemory + ' GB aprox.' : '—')], ['Almacenamiento libre', i.free ? bytes(i.free) + ' de ' + bytes(i.total) : '—'], ['Núcleos CPU', navigator.hardwareConcurrency || '—'], ['Idioma', navigator.language], ['Zona horaria', Intl.DateTimeFormat().resolvedOptions().timeZone], ['Versión de la app', native.version]]); }, { live: false, roles: G.all });
T('Estado de la batería', [], async () => { const b = await native.battery(); return { big: b.level + ' %', html: `<div class="meter"><i style="width:${b.level}%;background:${b.level < 20 ? '#ff2832' : '#3ddc84'}"></i></div>`, table: [['Cargando', b.charging ? 'Sí' : 'No'], ...(b.temp ? [['Temperatura', fmt(b.temp, 1) + ' °C']] : []), ...(b.health ? [['Salud', b.health]] : []), ...(b.voltage ? [['Voltaje', fmt(b.voltage / 1000, 2) + ' V']] : [])] }; }, { live: false, roles: G.all, refresh: 5000 });
T('Información de pantalla', [], () => table([['Resolución física', `${Math.round(screen.width * devicePixelRatio)} × ${Math.round(screen.height * devicePixelRatio)} px`], ['Resolución lógica', `${screen.width} × ${screen.height}`], ['Densidad', devicePixelRatio + 'x'], ['Área visible', `${innerWidth} × ${innerHeight}`], ['Orientación', screen.orientation?.type || '—'], ['Profundidad de color', screen.colorDepth + ' bits']]), { live: false });
T('Almacenamiento de la app', [], async () => { const e = navigator.storage?.estimate ? await navigator.storage.estimate() : {}; let ls = 0; for (const k in localStorage) if (localStorage.hasOwnProperty(k)) ls += (localStorage[k].length + k.length) * 2; return table([['Datos de Crack Pro', bytes(ls)], ['Usado por la app', e.usage ? bytes(e.usage) : '—'], ['Cuota disponible', e.quota ? bytes(e.quota) : '—']]); }, { live: false });
group('Herramientas');
T('Linterna', null, null, { roles: G.all, view(el) {
  let on = false;
  el.innerHTML = `<button class="torch" id="t">${'<svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 3h10l-2 6h3l-8 12 2-9H8z"/></svg>'}</button><p class="center mut" id="m">Toca para encender</p><div class="grid2"><button class="btn" id="sos">SOS</button><button class="btn" id="scr">Pantalla blanca</button></div>`;
  const set = async (v) => { try { await native.torch(v); on = v; el.querySelector('#t').classList.toggle('on', on); el.querySelector('#m').textContent = on ? 'Encendida' : 'Apagada'; } catch (e) { el.querySelector('#m').textContent = e.message; } };
  el.querySelector('#t').onclick = () => set(!on);
  let sosT; el.querySelector('#sos').onclick = () => { if (sosT) { clearTimeout(sosT); sosT = null; set(false); return; } const seq = [1, 1, 1, 3, 3, 3, 1, 1, 1]; let i = 0; const step = async () => { const d = seq[i % 9] * 200; await native.torch(true).catch(() => {}); sosT = setTimeout(async () => { await native.torch(false).catch(() => {}); i++; sosT = setTimeout(step, i % 9 === 0 ? 1400 : 200); }, d); }; step(); };
  el.querySelector('#scr').onclick = () => { const w = document.createElement('div'); w.className = 'fullwhite'; w.onclick = () => { w.remove(); native.brightness(-1); }; document.body.appendChild(w); native.brightness(1); };
  return () => { clearTimeout(sosT); if (on) native.torch(false).catch(() => {}); };
} });
T('Prueba de vibración', null, null, { roles: G.vis, view(el) {
  const P = { Corta: [60], Larga: [800], Doble: [120, 120, 120], Latido: [80, 120, 200, 600, 80, 120, 200], SOS: [150, 100, 150, 100, 150, 300, 450, 100, 450, 100, 450, 300, 150, 100, 150, 100, 150], Escalera: [50, 50, 100, 50, 200, 50, 400] };
  el.innerHTML = `<div class="grid2">${Object.keys(P).map(k => `<button class="btn" data-k="${k}">${k}</button>`).join('')}</div>`;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => native.pattern(P[b.dataset.k]));
} });
T('Prueba de pantalla (píxeles)', null, null, { roles: G.vis, view(el) {
  el.innerHTML = `<p class="mut">Muestra colores puros a pantalla completa para revisar píxeles muertos o manchas. Toca para cambiar de color y mantén presionado para salir.</p><button class="btn primary block" id="go">Iniciar prueba</button>`;
  el.querySelector('#go').onclick = () => { const cols = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#808080', '#ffff00', '#00ffff', '#ff00ff']; let i = 0; const w = document.createElement('div'); w.className = 'fullwhite'; w.style.background = cols[0];
    w.onclick = () => { i++; if (i >= cols.length) { w.remove(); return; } w.style.background = cols[i]; }; let lp; w.ontouchstart = () => lp = setTimeout(() => w.remove(), 900); w.ontouchend = () => clearTimeout(lp); document.body.appendChild(w); };
} });
T('Prueba de pantalla táctil', null, null, { roles: G.vis, view(el) {
  el.innerHTML = `<p class="mut small">Dibuja con uno o varios dedos. Muestra cuántos toques detecta a la vez.</p><canvas id="c" class="touchpad"></canvas><div class="row"><b id="n">0 toques</b><span class="sp"></span><button class="btn sm" id="cl">Limpiar</button></div>`;
  const c = el.querySelector('#c'); c.width = c.clientWidth * 2; c.height = c.clientHeight * 2; const g = c.getContext('2d'); g.lineWidth = 6; g.lineCap = 'round'; const last = {}; let mx = 0;
  const cols = ['#ff2832', '#3fd0e0', '#3ddc84', '#ffb020', '#d9b45a', '#fff', '#a06bff', '#ff4d8d', '#00e5ff', '#9aff00'];
  const pos = t => { const r = c.getBoundingClientRect(); return [(t.clientX - r.left) * 2, (t.clientY - r.top) * 2]; };
  c.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) last[t.identifier] = pos(t); mx = Math.max(mx, e.touches.length); el.querySelector('#n').textContent = `${e.touches.length} toques (máx. ${mx})`; }, { passive: false });
  c.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { const p = pos(t), l = last[t.identifier] || p; g.strokeStyle = cols[t.identifier % 10]; g.beginPath(); g.moveTo(...l); g.lineTo(...p); g.stroke(); last[t.identifier] = p; } }, { passive: false });
  c.addEventListener('touchend', e => { el.querySelector('#n').textContent = `${e.touches.length} toques (máx. ${mx})`; });
  el.querySelector('#cl').onclick = () => { g.clearRect(0, 0, c.width, c.height); mx = 0; };
} });
T('Mantener pantalla encendida', null, null, { roles: G.vis, view(el) {
  let on = false; el.innerHTML = `<div class="row" style="justify-content:space-between"><span>Pantalla siempre encendida mientras la app esté abierta</span><div class="switch" id="s"></div></div>`;
  el.querySelector('#s').onclick = (e) => { on = !on; e.currentTarget.classList.toggle('on', on); native.keepAwake(on); };
  return () => native.keepAwake(false);
} });
T('Abrir llamada telefónica', [S('Número', '+502 5555 1234')], ([n]) => { need(n.trim()); native.openUrl('tel:' + n.replace(/[^\d+]/g, '')); return { big: 'Abriendo marcador…' }; }, { live: false });
T('Enviar SMS', [S('Número', ''), A('Mensaje', 'Hola desde Crack Pro')], ([n, m]) => { need(n.trim()); native.openUrl(`sms:${n.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(m)}`); return { big: 'Abriendo mensajes…' }; }, { live: false });
T('Abrir chat de WhatsApp sin guardar número', [S('Número con código de país', '502'), A('Mensaje', '')], ([n, m]) => { const d = n.replace(/\D/g, ''); if (d.length < 8) throw new Error('Número incompleto'); native.openUrl(`https://wa.me/${d}?text=${encodeURIComponent(m)}`); return { big: 'Abriendo WhatsApp…' }; }, { live: false });
T('Abrir ubicación en mapas', [S('Dirección o coordenadas', 'Antigua Guatemala')], ([q]) => { need(q.trim()); native.openUrl('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q)); return { big: 'Abriendo mapas…' }; }, { live: false });
T('Redactar correo', [S('Para', ''), S('Asunto', ''), A('Mensaje', '')], ([a, s, m]) => { native.openUrl(`mailto:${a}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(m)}`); return { big: 'Abriendo correo…' }; }, { live: false, roles: G.staff });
group('Sensores');
const sensorView = (title, setup) => ({ roles: G.vis, view(el) { el.innerHTML = `<div id="sv"></div><p class="small mut" id="msg"></p>`; return setup(el.querySelector('#sv'), el.querySelector('#msg')); } });
T('Ubicación GPS', [], async () => { const p = await native.location(); return { big: `${fmt(p.lat, 6)}, ${fmt(p.lon, 6)}`, text: `${p.lat}, ${p.lon}`, table: [['Precisión', fmt(p.acc, 0) + ' m'], ['Fuente', p.src], ['Mapa', `https://maps.google.com/?q=${p.lat},${p.lon}`]] }; }, { live: false, roles: G.vis });
T('Compartir mi ubicación', [], async () => { const p = await native.location(); const u = `https://maps.google.com/?q=${p.lat},${p.lon}`; await native.shareText('Mi ubicación: ' + u); return { big: 'Ubicación lista para compartir', text: u }; }, { live: false });
T('Brújula', null, null, sensorView('Brújula', (box, msg) => {
  box.innerHTML = `<div class="compass"><div class="rose" id="r"><b style="top:6px">N</b><b style="right:8px;top:46%">E</b><b style="bottom:6px">S</b><b style="left:8px;top:46%">O</b></div><i></i></div><div class="clockbig" id="h" style="font-size:34px">—</div>`;
  const f = (e) => { let h = e.webkitCompassHeading ?? (e.absolute || e.alpha != null ? 360 - e.alpha : null); if (h == null) return; box.querySelector('#r').style.transform = `rotate(${-h}deg)`; const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']; box.querySelector('#h').textContent = `${Math.round(h)}° ${dirs[Math.round(h / 45) % 8]}`; };
  const ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'; addEventListener(ev, f); msg.textContent = 'Aleja el teléfono de imanes y metales. Mueve en forma de 8 para calibrar.';
  return () => removeEventListener(ev, f);
}));
T('Nivel de burbuja', null, null, sensorView('Nivel', (box) => {
  box.innerHTML = `<div class="level"><i id="b"></i><span></span></div><div class="grid2"><div class="stat"><small>Inclinación X</small><b id="x">0°</b></div><div class="stat"><small>Inclinación Y</small><b id="y">0°</b></div></div>`;
  const f = (e) => { const x = Math.max(-45, Math.min(45, e.gamma || 0)), y = Math.max(-45, Math.min(45, e.beta || 0)); box.querySelector('#b').style.transform = `translate(${x * 2.4}px, ${y * 2.4}px)`; box.querySelector('#b').classList.toggle('ok', Math.abs(x) < 1 && Math.abs(y) < 1); box.querySelector('#x').textContent = fmt(x, 1) + '°'; box.querySelector('#y').textContent = fmt(y, 1) + '°'; };
  addEventListener('deviceorientation', f); return () => removeEventListener('deviceorientation', f);
}));
T('Acelerómetro', null, null, sensorView('Acelerómetro', (box) => {
  box.innerHTML = `<div class="grid3"><div class="stat"><small>X</small><b id="x">0</b></div><div class="stat"><small>Y</small><b id="y">0</b></div><div class="stat"><small>Z</small><b id="z">0</b></div></div><canvas id="c" class="chartc"></canvas><div class="stat"><small>Fuerza G máxima</small><b id="m">0</b></div>`;
  const c = box.querySelector('#c'); c.width = 600; c.height = 200; const g = c.getContext('2d'); const hist = []; let mx = 0;
  const f = (e) => { const a = e.accelerationIncludingGravity || {}; const v = [a.x || 0, a.y || 0, a.z || 0]; ['x', 'y', 'z'].forEach((k, i) => box.querySelector('#' + k).textContent = fmt(v[i], 2)); const G2 = Math.hypot(...v) / 9.81; mx = Math.max(mx, G2); box.querySelector('#m').textContent = fmt(mx, 2) + ' g';
    hist.push(v); if (hist.length > 150) hist.shift(); g.clearRect(0, 0, 600, 200); ['#ff2832', '#3ddc84', '#3fd0e0'].forEach((col, k) => { g.strokeStyle = col; g.beginPath(); hist.forEach((h, i) => g[i ? 'lineTo' : 'moveTo'](i * 4, 100 - h[k] * 5)); g.stroke(); }); };
  addEventListener('devicemotion', f); return () => removeEventListener('devicemotion', f);
}));
T('Contador de pasos', null, null, sensorView('Pasos', (box) => {
  box.innerHTML = `<div class="clockbig" id="n">0</div><p class="center mut">pasos detectados</p><div class="grid2"><div class="stat"><small>Distancia</small><b id="d">0 m</b></div><div class="stat"><small>Calorías</small><b id="k">0</b></div></div><button class="btn block" id="r">Reiniciar</button>`;
  let n = 0, last = 0, up = false;
  const f = (e) => { const a = e.accelerationIncludingGravity || {}; const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0); const t = performance.now(); if (m > 11.5 && !up && t - last > 280) { up = true; n++; last = t; box.querySelector('#n').textContent = n; box.querySelector('#d').textContent = fmt(n * .72, 0) + ' m'; box.querySelector('#k').textContent = fmt(n * .04, 1); } if (m < 9.5) up = false; };
  box.querySelector('#r').onclick = () => { n = 0; box.querySelector('#n').textContent = 0; }; addEventListener('devicemotion', f); native.keepAwake(true); return () => { removeEventListener('devicemotion', f); native.keepAwake(false); };
}));
T('Velocímetro GPS', null, null, sensorView('Velocímetro', (box, msg) => {
  box.innerHTML = `<div class="clockbig huge" id="v">0</div><p class="center mut">km/h</p><div class="grid2"><div class="stat"><small>Máxima</small><b id="mx">0</b></div><div class="stat"><small>Distancia</small><b id="d">0 m</b></div></div>`;
  if (!navigator.geolocation) { msg.textContent = 'GPS no disponible'; return; } let mx = 0, dist = 0, prev = null;
  const id = navigator.geolocation.watchPosition(p => { const s = (p.coords.speed || 0) * 3.6; mx = Math.max(mx, s); if (prev) { const R2 = 6371000, dl = (p.coords.latitude - prev.latitude) * Math.PI / 180, dn = (p.coords.longitude - prev.longitude) * Math.PI / 180; const a = Math.sin(dl / 2) ** 2 + Math.cos(prev.latitude * Math.PI / 180) * Math.cos(p.coords.latitude * Math.PI / 180) * Math.sin(dn / 2) ** 2; const d = 2 * R2 * Math.asin(Math.sqrt(a)); if (d > p.coords.accuracy / 2) { dist += d; prev = p.coords; } } else prev = p.coords;
    box.querySelector('#v').textContent = Math.round(s); box.querySelector('#mx').textContent = Math.round(mx) + ' km/h'; box.querySelector('#d').textContent = dist > 1000 ? fmt(dist / 1000, 2) + ' km' : Math.round(dist) + ' m'; msg.textContent = 'Precisión ' + Math.round(p.coords.accuracy) + ' m'; }, e => msg.textContent = 'Activa la ubicación: ' + e.message, { enableHighAccuracy: true });
  native.keepAwake(true); return () => { navigator.geolocation.clearWatch(id); native.keepAwake(false); };
}));
T('Altímetro GPS', [], async () => { const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })); return { big: p.coords.altitude != null ? fmt(p.coords.altitude, 0) + ' m s. n. m.' : 'El GPS no dio altitud', table: [['Precisión vertical', p.coords.altitudeAccuracy ? fmt(p.coords.altitudeAccuracy, 0) + ' m' : '—']] }; }, { live: false });
T('Medidor de distancia entre dos puntos GPS', [N('Latitud 1', 14.6349), N('Longitud 1', -90.5069), N('Latitud 2', 14.5586), N('Longitud 2', -90.7295)], ([a, b, c, d]) => { need(a, b, c, d); const R2 = 6371, dl = (c - a) * Math.PI / 180, dn = (d - b) * Math.PI / 180; const x = Math.sin(dl / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dn / 2) ** 2; const km = 2 * R2 * Math.asin(Math.sqrt(x)); const brg = (Math.atan2(Math.sin(dn) * Math.cos(c * Math.PI / 180), Math.cos(a * Math.PI / 180) * Math.sin(c * Math.PI / 180) - Math.sin(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.cos(dn)) * 180 / Math.PI + 360) % 360; return { big: fmt(km, 3) + ' km', table: [['Rumbo', fmt(brg, 1) + '°'], ['Millas', fmt(km / 1.609344, 3)]] }; });

// ------------------------------------------------------------- sonido
cat('sound', 'Sonido', 'music', ['visitante', 'asistente', 'programador', 'admin'], 'Tonos, notas, metrónomo, ruido, sonómetro y afinador');
group('Notas musicales');
const NOTES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
for (const oct of [4, 5]) NOTES.forEach((n, i) => { const f = 440 * 2 ** ((i - 9 + (oct - 4) * 12) / 12); T(`Tocar nota ${n}${oct}`, [N('Duración (ms)', 800), SEL('Timbre', ['sine', 'triangle', 'square', 'sawtooth'])], ([d, t]) => { beep(f, d || 800, t, .35); return { big: `${n}${oct} · ${fmt(f, 2)} Hz` }; }, { live: false, kw: 'nota musica piano' }); });
T('Piano', null, null, { view(el) {
  el.innerHTML = `<div class="piano">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(i => `<button class="${[1, 3, 6, 8, 10].includes(i % 12) ? 'blk' : ''}" data-i="${i}"><span>${NOTES[i % 12]}</span></button>`).join('')}</div>`;
  el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('pointerdown', () => { beep(261.63 * 2 ** (+b.dataset.i / 12), 700, 'triangle', .35); native.vibrate(5); }));
} });
group('Generadores de sonido');
T('Generador de tono', null, null, { view(el) {
  el.innerHTML = `<div class="clockbig" id="f" style="font-size:34px">440 Hz</div><input type="range" id="r" min="20" max="20000" value="440" class="range"><div class="chips" style="margin:8px 0">${['sine', 'square', 'triangle', 'sawtooth'].map((t, i) => `<button class="chip ${i ? '' : 'on'}" data-t="${t}">${['Seno', 'Cuadrada', 'Triángulo', 'Sierra'][i]}</button>`).join('')}</div><button class="btn primary block" id="go">Reproducir</button>`;
  let o, g, type = 'sine'; const ac = audioCtx();
  const set = () => { const v = +el.querySelector('#r').value; el.querySelector('#f').textContent = v + ' Hz'; if (o) o.frequency.value = v; };
  el.querySelector('#r').oninput = set;
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); if (o) o.type = type; });
  const stop = () => { try { o?.stop(); } catch {} o = null; el.querySelector('#go').textContent = 'Reproducir'; };
  el.querySelector('#go').onclick = () => { if (o) return stop(); o = ac.createOscillator(); g = ac.createGain(); g.gain.value = .25; o.type = type; o.frequency.value = +el.querySelector('#r').value; o.connect(g); g.connect(ac.destination); o.start(); el.querySelector('#go').textContent = 'Detener'; };
  return stop;
} });
T('Metrónomo', null, null, { view(el) {
  el.innerHTML = `<div class="clockbig" id="b" style="font-size:44px">120</div><p class="center mut">pulsos por minuto</p><input type="range" id="r" min="30" max="240" value="120" class="range"><div class="beats" id="dots"><i></i><i></i><i></i><i></i></div><button class="btn primary block" id="go">Iniciar</button>`;
  let iv, k = 0; const run = () => { clearInterval(iv); iv = setInterval(() => { beep(k % 4 ? 900 : 1500, 60, 'square', .2); el.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', i === k % 4)); k++; }, 60000 / +el.querySelector('#r').value); };
  el.querySelector('#r').oninput = (e) => { el.querySelector('#b').textContent = e.target.value; if (iv) run(); };
  el.querySelector('#go').onclick = (e) => { if (iv) { clearInterval(iv); iv = null; e.target.textContent = 'Iniciar'; } else { run(); e.target.textContent = 'Detener'; } };
  return () => clearInterval(iv);
} });
const noise = (kind) => ({ view(el) {
  el.innerHTML = `<p class="mut">Ruido ${kind} continuo para concentrarte o dormir.</p><input type="range" id="v" min="0" max="100" value="40" class="range"><button class="btn primary block" id="go">Reproducir</button>`;
  let src, gain; const ac = audioCtx();
  const make = () => { const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'blanco') d[i] = w * .5; else if (kind === 'rosa') { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .11; } else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } } return buf; };
  el.querySelector('#v').oninput = (e) => { if (gain) gain.gain.value = e.target.value / 100; };
  const stop = () => { try { src?.stop(); } catch {} src = null; el.querySelector('#go').textContent = 'Reproducir'; };
  el.querySelector('#go').onclick = () => { if (src) return stop(); src = ac.createBufferSource(); src.buffer = make(); src.loop = true; gain = ac.createGain(); gain.gain.value = el.querySelector('#v').value / 100; src.connect(gain); gain.connect(ac.destination); src.start(); el.querySelector('#go').textContent = 'Detener'; };
  return stop;
} });
T('Ruido blanco', null, null, noise('blanco'));
T('Ruido rosa', null, null, noise('rosa'));
T('Ruido café (marrón)', null, null, noise('café'));
T('Frecuencia de prueba de audífonos', null, null, { view(el) {
  el.innerHTML = `<p class="mut">Prueba cada lado de tus audífonos y el rango de frecuencias que escuchas.</p><div class="grid2"><button class="btn" data-p="-1">Izquierdo</button><button class="btn" data-p="1">Derecho</button></div><div class="chips" style="margin-top:10px">${[50, 100, 250, 1000, 4000, 8000, 12000, 15000, 17000].map(f => `<button class="chip" data-f="${f}">${f >= 1000 ? f / 1000 + 'k' : f} Hz</button>`).join('')}</div>`;
  const ac = audioCtx(); const play = (f, pan) => { const o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner(); o.frequency.value = f; p.pan.value = pan; g.gain.value = .3; o.connect(g); g.connect(p); p.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + 1); o.stop(ac.currentTime + 1.05); };
  el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => play(440, +b.dataset.p)); el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => play(+b.dataset.f, 0));
} });
group('Micrófono');
const micView = (setup) => ({ view(el) {
  el.innerHTML = `<div id="mv"></div><p class="small mut" id="msg">Pidiendo permiso del micrófono…</p>`; let stream, raf, alive = true;
  navigator.mediaDevices?.getUserMedia({ audio: true }).then(s => { if (!alive) { s.getTracks().forEach(t => t.stop()); return; } stream = s; el.querySelector('#msg').textContent = ''; const ac = audioCtx(); const an = ac.createAnalyser(); an.fftSize = 4096; ac.createMediaStreamSource(s).connect(an); const loop = setup(el.querySelector('#mv'), an, ac); const f = () => { loop(); raf = requestAnimationFrame(f); }; f(); })
    .catch(e => el.querySelector('#msg').textContent = 'Sin acceso al micrófono: ' + e.message);
  return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
} });
T('Sonómetro (decibeles)', null, null, micView((box, an) => {
  box.innerHTML = `<div class="clockbig huge" id="d">0</div><p class="center mut">dB aprox.</p><div class="meter"><i id="m"></i></div><div class="grid2"><div class="stat"><small>Máximo</small><b id="mx">0</b></div><div class="stat"><small>Nivel</small><b id="l">—</b></div></div>`;
  const buf = new Float32Array(an.fftSize); let mx = 0, sm = 0;
  return () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; const db = Math.max(0, 20 * Math.log10(Math.sqrt(s / buf.length)) + 94); sm = sm * .85 + db * .15; mx = Math.max(mx, sm);
    box.querySelector('#d').textContent = Math.round(sm); box.querySelector('#m').style.width = Math.min(100, sm / 1.2) + '%'; box.querySelector('#mx').textContent = Math.round(mx) + ' dB'; box.querySelector('#l').textContent = sm < 40 ? 'Silencioso' : sm < 60 ? 'Normal' : sm < 80 ? 'Ruidoso' : '⚠ Dañino'; };
}));
T('Afinador de guitarra', null, null, micView((box, an, ac) => {
  box.innerHTML = `<div class="clockbig huge" id="n">—</div><div class="center" id="f">— Hz</div><div class="tuner"><i id="needle"></i></div><p class="small mut center">Cuerdas: Mi2 La2 Re3 Sol3 Si3 Mi4</p>`;
  const buf = new Float32Array(an.fftSize);
  return () => { an.getFloatTimeDomainData(buf); let rms = 0; for (const v of buf) rms += v * v; if (Math.sqrt(rms / buf.length) < .01) return;
    let best = -1, bc = 0; for (let lag = 40; lag < 1000; lag++) { let c = 0; for (let i = 0; i < 2048; i++) c += buf[i] * buf[i + lag]; if (c > bc) { bc = c; best = lag; } } if (best < 0) return;
    const f = ac.sampleRate / best, n = 12 * Math.log2(f / 440) + 69, r = Math.round(n), cents = Math.round((n - r) * 100);
    box.querySelector('#n').textContent = NOTES[(r % 12 + 12) % 12] + (Math.floor(r / 12) - 1); box.querySelector('#f').textContent = `${fmt(f, 1)} Hz · ${cents > 0 ? '+' : ''}${cents} cents`; box.querySelector('#needle').style.transform = `rotate(${Math.max(-50, Math.min(50, cents))}deg)`; box.querySelector('#needle').classList.toggle('ok', Math.abs(cents) < 5); };
}));
T('Grabadora de voz', null, null, { view(el) {
  el.innerHTML = `<div class="clockbig" id="t">00:00</div><div class="grid2"><button class="btn primary" id="go">Grabar</button><button class="btn" id="sv" disabled>Guardar</button></div><audio id="a" controls style="width:100%;margin-top:12px;display:none"></audio>`;
  let rec, chunks = [], t0, iv, blob, stream;
  el.querySelector('#go').onclick = async (e) => { if (rec?.state === 'recording') { rec.stop(); return; } try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { e.target.textContent = 'Sin micrófono'; return; }
    rec = new MediaRecorder(stream); chunks = []; rec.ondataavailable = d => chunks.push(d.data); rec.onstop = () => { clearInterval(iv); stream.getTracks().forEach(t => t.stop()); blob = new Blob(chunks, { type: rec.mimeType }); const a = el.querySelector('#a'); a.src = URL.createObjectURL(blob); a.style.display = 'block'; el.querySelector('#sv').disabled = false; e.target.textContent = 'Grabar de nuevo'; };
    rec.start(); t0 = Date.now(); e.target.textContent = 'Detener'; iv = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); el.querySelector('#t').textContent = `${two(Math.floor(s / 60))}:${two(s % 60)}`; }, 300); };
  el.querySelector('#sv').onclick = async () => { const r = await native.saveFile(blob, `grabacion-${Date.now()}.webm`, blob.type); el.querySelector('#t').textContent = 'Guardado en ' + (r?.path || 'Descargas'); };
  return () => { clearInterval(iv); try { rec?.state === 'recording' && rec.stop(); } catch {} stream?.getTracks().forEach(t => t.stop()); };
} });

// ------------------------------------------------------------- camara
cat('cam', 'Cámara y escáner', 'camera', ['visitante', 'asistente', 'verificador', 'ceo', 'admin'], 'Escanear códigos QR y de barras, verificar carnets, espejo y lupa');
const camView = (setup, facing = 'environment') => ({ view(el, ctx) {
  el.innerHTML = `<div class="cam"><video id="v" playsinline muted autoplay></video><i class="frame"></i></div><div id="cv"></div><p class="small mut" id="msg">Abriendo la cámara…</p>`; let stream, alive = true, stop;
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } } }).then(s => { if (!alive) return s.getTracks().forEach(t => t.stop()); stream = s; const v = el.querySelector('#v'); v.srcObject = s; el.querySelector('#msg').textContent = ''; stop = setup(v, el.querySelector('#cv'), el.querySelector('#msg'), ctx, s); })
    .catch(e => el.querySelector('#msg').textContent = 'Sin acceso a la cámara: ' + e.message);
  return () => { alive = false; stop?.(); stream?.getTracks().forEach(t => t.stop()); };
} });
const scanner = (onCode) => camView((v, box, msg, ctx) => {
  if (!('BarcodeDetector' in window)) { msg.textContent = 'Este teléfono no tiene lector de códigos integrado. Actualiza “Android System WebView” desde Play Store.'; return; }
  const det = new window.BarcodeDetector(); let busy = false, done = false; const iv = setInterval(async () => { if (busy || done || v.readyState < 2) return; busy = true; try { const r = await det.detect(v); if (r[0]) { done = true; native.vibrate(40); await onCode(r[0], box, ctx); setTimeout(() => done = false, 2500); } } catch {} busy = false; }, 250);
  return () => clearInterval(iv);
});
T('Escanear código QR o de barras', null, null, scanner(async (c, box) => {
  const url = /^https?:\/\//.test(c.rawValue);
  box.innerHTML = `<div class="result"><div class="small mut">${c.format.toUpperCase()}</div><div class="big-out" style="word-break:break-all">${c.rawValue.replace(/</g, '&lt;')}</div><div class="grid3"><button class="btn sm" id="cp">Copiar</button><button class="btn sm" id="sh">Compartir</button>${url ? '<button class="btn sm primary" id="op">Abrir</button>' : ''}</div></div>`;
  box.querySelector('#cp').onclick = () => native.copy(c.rawValue); box.querySelector('#sh').onclick = () => native.shareText(c.rawValue); if (url) box.querySelector('#op').onclick = () => native.openUrl(c.rawValue);
  const h = JSON.parse(localStorage.getItem('pro.scans') || '[]'); h.unshift({ t: Date.now(), v: c.rawValue, f: c.format }); localStorage.setItem('pro.scans', JSON.stringify(h.slice(0, 200)));
}));
T('Historial de escaneos', [], () => { const h = JSON.parse(localStorage.getItem('pro.scans') || '[]'); return h.length ? table(h.map(x => [new Date(x.t).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + x.f, x.v])) : { big: 'Aún no hay escaneos' }; }, { live: false });
T('Verificar carnet Crack escaneando el QR', null, null, { roles: ['verificador', 'ceo', 'admin'], ...scanner(async (c, box, ctx) => { box.innerHTML = ctx.verifyCard(c.rawValue); }) });
T('Espejo (cámara frontal)', null, null, camView((v) => { v.style.transform = 'scaleX(-1)'; }, 'user'));
T('Lupa', null, null, camView((v, box) => { box.innerHTML = `<input type="range" class="range" id="z" min="1" max="5" step=".1" value="2">`; const z = box.querySelector('#z'); const f = () => v.style.transform = `scale(${z.value})`; z.oninput = f; f(); const tr = v.srcObject.getVideoTracks()[0]; return () => {}; }));
T('Tomar foto', null, null, camView((v, box) => { box.innerHTML = `<button class="btn primary block" id="s">Capturar y guardar</button>`; box.querySelector('#s').onclick = async () => { const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); const r = await native.saveFile(b, `foto-${Date.now()}.jpg`, 'image/jpeg'); box.insertAdjacentHTML('beforeend', `<p class="small mut">Guardada en ${r?.path || 'Imágenes'}</p>`); native.vibrate(30); }; }));
T('Detector de color con cámara', null, null, camView((v, box) => { box.innerHTML = `<div class="row"><span class="swatch-big" id="sw"></span><b id="hx" style="font-size:22px">—</b></div>`; const c = document.createElement('canvas'); c.width = c.height = 10; const g = c.getContext('2d', { willReadFrequently: true }); const iv = setInterval(() => { if (v.readyState < 2) return; g.drawImage(v, v.videoWidth / 2 - 5, v.videoHeight / 2 - 5, 10, 10, 0, 0, 10, 10); const d = g.getImageData(0, 0, 10, 10).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; const hx = '#' + [r, gg, b].map(x => Math.round(x / n).toString(16).padStart(2, '0')).join(''); box.querySelector('#sw').style.background = hx; box.querySelector('#hx').textContent = hx.toUpperCase(); }, 300); return () => clearInterval(iv); }));

// ------------------------------------------------------------- imagenes
cat('img', 'Imágenes', 'image', ['visitante', 'asistente', 'programador', 'ceo', 'admin'], 'Filtros, conversión, tamaño y datos de imágenes');
async function loadImg(file) { if (!file) throw new Error('Elige una imagen'); const bmp = await createImageBitmap(file); return bmp; }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const toBlob = (c, type = 'image/png', q = .92) => new Promise(r => c.toBlob(r, type, q));
const imgOut = async (c, name, type = 'image/png', q) => { const b = await toBlob(c, type, q); return { img: URL.createObjectURL(b), blob: b, name, table: [['Tamaño', `${c.width} × ${c.height}`], ['Peso', bytes(b.size)]] }; };
const IMG = F('Imagen', 'image/*');
const FILTERS = [['Blanco y negro', 'grayscale(1)'], ['Sepia', 'sepia(1)'], ['Invertir colores', 'invert(1)'], ['Desenfocar', 'blur(4px)'], ['Más brillo', 'brightness(1.35)'], ['Menos brillo', 'brightness(.7)'], ['Más contraste', 'contrast(1.5)'], ['Más saturación', 'saturate(1.8)'], ['Desaturar', 'saturate(.35)'], ['Rotar tono 90°', 'hue-rotate(90deg)'], ['Rotar tono 180°', 'hue-rotate(180deg)'], ['Estilo vintage', 'sepia(.45) contrast(1.1) saturate(.8) brightness(1.05)'], ['Estilo hacker rojo', 'grayscale(1) sepia(1) hue-rotate(-50deg) saturate(5) contrast(1.2)'], ['Estilo frío', 'saturate(1.1) hue-rotate(-15deg) brightness(1.05)'], ['Estilo cálido', 'sepia(.3) saturate(1.3)']];
group('Filtros');
for (const [n, f] of FILTERS) T('Filtro ' + n.toLowerCase(), [IMG], async ([file]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.filter = f; g.drawImage(b, 0, 0); return imgOut(c, 'filtro.png'); }, { live: false, kw: 'foto filtro' });
T('Pixelar imagen', [IMG, N('Tamaño del píxel', 12)], async ([file, p]) => { const b = await loadImg(file); p = Math.max(2, p || 12); const s = canvasOf(Math.ceil(b.width / p), Math.ceil(b.height / p)); s.getContext('2d').drawImage(b, 0, 0, s.width, s.height); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, c.width, c.height); return imgOut(c, 'pixel.png'); }, { live: false });
T('Umbral blanco y negro puro', [IMG, N('Umbral (0-255)', 128)], async ([file, t]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.drawImage(b, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const v = (d.data[i] * .3 + d.data[i + 1] * .59 + d.data[i + 2] * .11) > t ? 255 : 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; } g.putImageData(d, 0, 0); return imgOut(c, 'umbral.png'); }, { live: false });
T('Agregar marca de agua', [IMG, S('Texto', '© Crack Pro'), C('Color', '#ffffff')], async ([file, t, col]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.drawImage(b, 0, 0); const fs = Math.max(16, b.width / 18); g.font = `700 ${fs}px sans-serif`; g.fillStyle = col; g.globalAlpha = .55; g.textAlign = 'right'; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(t, b.width - fs / 2, b.height - fs / 2); return imgOut(c, 'marca.png'); }, { live: false });
T('Agregar borde', [IMG, N('Grosor (px)', 30), C('Color', '#ff2832')], async ([file, w, col]) => { const b = await loadImg(file); w = w || 0; const c = canvasOf(b.width + w * 2, b.height + w * 2); const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.drawImage(b, w, w); return imgOut(c, 'borde.png'); }, { live: false });
T('Esquinas redondeadas', [IMG, N('Radio (px)', 60)], async ([file, r]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.beginPath(); g.roundRect(0, 0, b.width, b.height, r || 0); g.clip(); g.drawImage(b, 0, 0); return imgOut(c, 'redondeada.png'); }, { live: false });
T('Recortar en círculo (foto de perfil)', [IMG], async ([file]) => { const b = await loadImg(file); const s = Math.min(b.width, b.height); const c = canvasOf(s, s); const g = c.getContext('2d'); g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, 7); g.clip(); g.drawImage(b, (b.width - s) / 2, (b.height - s) / 2, s, s, 0, 0, s, s); return imgOut(c, 'perfil.png'); }, { live: false });
group('Transformar');
T('Cambiar tamaño de imagen', [IMG, N('Nuevo ancho (px)', 1080)], async ([file, w]) => { const b = await loadImg(file); need(w); const h = Math.round(b.height * w / b.width); const c = canvasOf(w, h); c.getContext('2d').drawImage(b, 0, 0, w, h); return imgOut(c, 'redimensionada.png'); }, { live: false });
T('Comprimir imagen (JPG)', [IMG, N('Calidad (10-100)', 70)], async ([file, q]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(b, 0, 0); const r = await imgOut(c, 'comprimida.jpg', 'image/jpeg', (q || 70) / 100); r.table.push(['Original', bytes(file.size)], ['Ahorro', fmt((1 - r.blob.size / file.size) * 100, 1) + ' %']); return r; }, { live: false });
for (const [n, t, ext] of [['PNG', 'image/png', 'png'], ['JPG', 'image/jpeg', 'jpg'], ['WEBP', 'image/webp', 'webp']]) T('Convertir imagen a ' + n, [IMG], async ([file]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); if (ext === 'jpg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(b, 0, 0); return imgOut(c, 'imagen.' + ext, t, .92); }, { live: false });
for (const [n, deg] of [['90° a la derecha', 90], ['90° a la izquierda', -90], ['180°', 180]]) T('Rotar imagen ' + n, [IMG], async ([file]) => { const b = await loadImg(file); const sw = Math.abs(deg) === 90; const c = canvasOf(sw ? b.height : b.width, sw ? b.width : b.height); const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(deg * Math.PI / 180); g.drawImage(b, -b.width / 2, -b.height / 2); return imgOut(c, 'rotada.png'); }, { live: false });
T('Voltear imagen horizontal', [IMG], async ([file]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.scale(-1, 1); g.drawImage(b, -b.width, 0); return imgOut(c, 'volteada.png'); }, { live: false });
T('Voltear imagen vertical', [IMG], async ([file]) => { const b = await loadImg(file); const c = canvasOf(b.width, b.height); const g = c.getContext('2d'); g.scale(1, -1); g.drawImage(b, 0, -b.height); return imgOut(c, 'volteada.png'); }, { live: false });
T('Recortar imagen cuadrada', [IMG], async ([file]) => { const b = await loadImg(file); const s = Math.min(b.width, b.height); const c = canvasOf(s, s); c.getContext('2d').drawImage(b, (b.width - s) / 2, (b.height - s) / 2, s, s, 0, 0, s, s); return imgOut(c, 'cuadrada.png'); }, { live: false });
T('Recortar a 16:9', [IMG], async ([file]) => { const b = await loadImg(file); let w = b.width, h = Math.round(w * 9 / 16); if (h > b.height) { h = b.height; w = Math.round(h * 16 / 9); } const c = canvasOf(w, h); c.getContext('2d').drawImage(b, (b.width - w) / 2, (b.height - h) / 2, w, h, 0, 0, w, h); return imgOut(c, '16x9.png'); }, { live: false });
T('Unir dos imágenes lado a lado', [F('Imagen 1', 'image/*'), F('Imagen 2', 'image/*')], async ([f1, f2]) => { const a = await loadImg(f1), b = await loadImg(f2); const h = Math.min(a.height, b.height), wa = a.width * h / a.height, wb = b.width * h / b.height; const c = canvasOf(Math.round(wa + wb), h); const g = c.getContext('2d'); g.drawImage(a, 0, 0, wa, h); g.drawImage(b, wa, 0, wb, h); return imgOut(c, 'unidas.png'); }, { live: false });
T('Crear ícono de app (512 px)', [IMG, C('Fondo', '#000000')], async ([file, bg]) => { const b = await loadImg(file); const c = canvasOf(512, 512); const g = c.getContext('2d'); g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, 512, 512, 110); g.fill(); const s = Math.min(400 / b.width, 400 / b.height); g.drawImage(b, 256 - b.width * s / 2, 256 - b.height * s / 2, b.width * s, b.height * s); return imgOut(c, 'icono.png'); }, { live: false, roles: ['asistente', 'programador', 'admin'] });
group('Analizar');
T('Información de imagen', [IMG], async ([file]) => { const b = await loadImg(file); const g2 = (a, c) => c ? g2(c, a % c) : a; const d = g2(b.width, b.height); return table([['Nombre', file.name], ['Tipo', file.type], ['Peso', bytes(file.size)], ['Dimensiones', `${b.width} × ${b.height} px`], ['Megapíxeles', fmt(b.width * b.height / 1e6, 2)], ['Proporción', `${b.width / d}:${b.height / d}`], ['Modificado', new Date(file.lastModified).toLocaleString('es')]]); }, { live: false });
T('Colores dominantes de imagen', [IMG], async ([file]) => { const b = await loadImg(file); const c = canvasOf(64, 64); const g = c.getContext('2d'); g.drawImage(b, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data; const m = {}; for (let i = 0; i < d.length; i += 4) { const k = [d[i], d[i + 1], d[i + 2]].map(v => Math.round(v / 32) * 32).join(','); m[k] = (m[k] || 0) + 1; } const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => '#' + k.split(',').map(v => Math.min(255, +v).toString(16).padStart(2, '0')).join('')); return { html: `<div class="palette">${top.map(c2 => `<div style="background:${c2}"><span>${c2}</span></div>`).join('')}</div>`, text: top.join(' ') }; }, { live: false });
T('Imagen a Base64', [IMG], async ([file]) => { if (!file) throw new Error('Elige una imagen'); const s = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(file); }); return { pre: s.slice(0, 2000) + (s.length > 2000 ? '…' : ''), text: s, table: [['Longitud', s.length.toLocaleString('es') + ' caracteres']] }; }, { live: false, roles: G.dev });
T('Imagen a arte ASCII', [IMG, N('Ancho en caracteres', 60)], async ([file, w]) => { const b = await loadImg(file); w = Math.min(160, w || 60); const h = Math.round(b.height / b.width * w * .5); const c = canvasOf(w, h); const g = c.getContext('2d'); g.drawImage(b, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; const ch = '@%#*+=-:. '; let s = ''; for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; s += ch[Math.floor((d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 256 * ch.length)]; } s += '\n'; } return { pre: s, text: s }; }, { live: false });
T('Generar imagen de texto (banner)', [S('Texto', 'CRACK PRO'), C('Color de texto', '#ffffff'), C('Fondo', '#ff2832'), N('Ancho (px)', 1200), N('Alto (px)', 400)], async ([t, tc, bg, w, h]) => { need(w, h); const c = canvasOf(w, h); const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = tc; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = h * .45; g.font = `800 ${fs}px sans-serif`; while (g.measureText(t).width > w * .9 && fs > 8) { fs -= 4; g.font = `800 ${fs}px sans-serif`; } g.fillText(t, w / 2, h / 2); return imgOut(c, 'banner.png'); }, { live: false });

// ------------------------------------------------------------- archivos
cat('file', 'Archivos', 'file', ['verificador', 'programador', 'ceo', 'admin'], 'Integridad, hashes y contenido de archivos');
const FILE = F('Archivo');
const readBytes = async (f) => { if (!f) throw new Error('Elige un archivo'); return new Uint8Array(await f.arrayBuffer()); };
group('Integridad');
for (const [n, f] of HASHES.slice(0, 6)) T(`Hash ${n} de archivo`, [FILE], async ([file]) => { const b = await readBytes(file); const h = await f(b); return { big: h, text: h, mono: true, table: [['Archivo', file.name], ['Tamaño', bytes(file.size)]] }; }, { live: false, kw: 'checksum integridad' });
T('Verificar integridad de archivo', [FILE, S('Hash esperado (SHA-256, SHA-1 o MD5)', '')], async ([file, exp]) => { const b = await readBytes(file); exp = exp.trim().toLowerCase(); need(exp); const alg = exp.length === 64 ? 'SHA-256' : exp.length === 40 ? 'SHA-1' : exp.length === 32 ? 'MD5' : exp.length === 128 ? 'SHA-512' : null; if (!alg) throw new Error('Longitud de hash no reconocida'); const h = await HASHES.find(x => x[0] === alg)[1](b); return { big: h === exp ? '✔ ARCHIVO ÍNTEGRO' : '✘ NO COINCIDE', ok: h === exp, table: [['Algoritmo', alg], ['Calculado', h]] }; }, { live: false });
T('Comparar dos archivos', [F('Archivo A'), F('Archivo B')], async ([a, b]) => { const x = await readBytes(a), y = await readBytes(b); const [hx, hy] = await Promise.all([HASHES[0][1](x), HASHES[0][1](y)]); let first = -1; if (hx !== hy) for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) { first = i; break; } return { big: hx === hy ? '✔ Son idénticos' : '✘ Son diferentes', table: [['Tamaño A', bytes(x.length)], ['Tamaño B', bytes(y.length)], ...(first >= 0 ? [['Primera diferencia en el byte', first]] : [])] }; }, { live: false });
group('Contenido');
T('Información de archivo', [FILE], async ([file]) => { const b = await readBytes(file); const sig = [...b.slice(0, 8)].map(x => x.toString(16).padStart(2, '0')).join(' '); const magic = { '89 50 4e 47': 'PNG', 'ff d8 ff': 'JPEG', '25 50 44 46': 'PDF', '50 4b 03 04': 'ZIP / DOCX / XLSX / APK', '47 49 46 38': 'GIF', '7f 45 4c 46': 'Ejecutable Linux (ELF)', '4d 5a': 'Ejecutable Windows (EXE)', '52 61 72 21': 'RAR', '1f 8b': 'GZIP', '49 44 33': 'MP3', '52 49 46 46': 'RIFF (WAV/AVI/WEBP)' }; const real = Object.entries(magic).find(([k]) => sig.startsWith(k))?.[1] || 'Desconocido';
  return table([['Nombre', file.name], ['Tamaño', bytes(file.size) + ` (${file.size.toLocaleString('es')} bytes)`], ['Tipo declarado', file.type || '—'], ['Tipo real (firma)', real], ['Firma', sig], ['Modificado', new Date(file.lastModified).toLocaleString('es')]]); }, { live: false });
T('Ver archivo en hexadecimal', [FILE, N('Bytes a mostrar', 512)], async ([file, n]) => { const b = (await readBytes(file)).slice(0, Math.min(8192, n || 512)); let s = ''; for (let i = 0; i < b.length; i += 16) { const row = b.slice(i, i + 16); s += i.toString(16).padStart(8, '0') + '  ' + [...row].map(x => x.toString(16).padStart(2, '0')).join(' ').padEnd(48) + '  ' + [...row].map(x => x >= 32 && x < 127 ? String.fromCharCode(x) : '.').join('') + '\n'; } return { pre: s, text: s }; }, { live: false, roles: G.dev.concat('verificador') });
T('Ver archivo de texto', [F('Archivo de texto', '.txt,.csv,.json,.md,.log,.xml,.html,.js,.py,text/*')], async ([file]) => { if (!file) throw new Error('Elige un archivo'); const t = await file.text(); return { pre: t.slice(0, 50000), text: t, table: [['Líneas', t.split('\n').length], ['Caracteres', t.length]] }; }, { live: false });
T('Extraer texto legible de archivo', [FILE, N('Largo mínimo', 5)], async ([file, m]) => { const b = await readBytes(file); const r = []; let cur = ''; for (const x of b) { if (x >= 32 && x < 127) cur += String.fromCharCode(x); else { if (cur.length >= (m || 5)) r.push(cur); cur = ''; } if (r.length > 3000) break; } return { pre: r.join('\n'), text: r.join('\n'), table: [['Cadenas encontradas', r.length]] }; }, { live: false, roles: G.dev.concat('verificador') });
T('Archivo a Base64', [FILE], async ([file]) => { const b = await readBytes(file); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); const r = btoa(s); return { pre: r.slice(0, 3000) + (r.length > 3000 ? '…' : ''), text: r }; }, { live: false, roles: G.dev });
T('Base64 a archivo', [A('Base64', ''), S('Nombre del archivo', 'archivo.bin')], async ([s, n]) => { need(s.trim()); const d = s.includes(',') ? s.split(',')[1] : s; const b = Uint8Array.from(atob(d.trim()), c => c.charCodeAt(0)); const blob = new Blob([b]); return { blob, name: n || 'archivo.bin', big: 'Archivo listo: ' + bytes(b.length) }; }, { live: false, roles: G.dev });
T('Contar palabras de archivo de texto', [F('Archivo', '.txt,.md,.csv,text/*')], async ([file]) => { if (!file) throw new Error('Elige un archivo'); const t = await file.text(); return table([['Palabras', (t.match(/\S+/g) || []).length], ['Líneas', t.split('\n').length], ['Caracteres', t.length]]); }, { live: false });
T('Estadísticas de un CSV', [F('Archivo CSV', '.csv,text/csv')], async ([file]) => { if (!file) throw new Error('Elige un archivo'); const t = (await file.text()).trim(); const rows = t.split('\n').map(l => l.split(',')); const h = rows.shift(); return table(h.map((c, i) => { const v = rows.map(r => parseFloat(r[i])).filter(x => !isNaN(x)); return [c, v.length ? `suma ${fmt(v.reduce((a, b) => a + b, 0))} · prom. ${fmt(v.reduce((a, b) => a + b, 0) / v.length)} · mín ${fmt(Math.min(...v))} · máx ${fmt(Math.max(...v))}` : `${new Set(rows.map(r => r[i])).size} valores distintos`]; }).concat([['Filas', rows.length]])); }, { live: false });
T('Crear archivo de texto', [S('Nombre', 'nota.txt'), A('Contenido', 'Escrito con Crack Pro')], ([n, t]) => ({ blob: new Blob([t], { type: 'text/plain' }), name: n || 'nota.txt', big: 'Archivo listo para guardar' }), { live: false, roles: G.staff.concat('ceo') });
