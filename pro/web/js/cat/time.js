// Fechas, horas, zonas horarias y relojes
import { cat, group, T, N, S, A, SEL, D, TM, fmt, need, table } from '../tool.js';
import { G } from '../roles.js';
import { native } from '../native.js';

const day = 86400000;
const pd = (s) => { if (!s) throw new Error('Elige una fecha'); const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fd = (d) => d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const two = (n) => String(n).padStart(2, '0');

cat('time', 'Fechas y hora', 'clock', G.all, 'Calendario, edades, plazos, zonas horarias y relojes');
group('Fechas');
T('Días entre dos fechas', [D('Desde', 'today'), D('Hasta', '2026-12-31')], ([a, b]) => { const d = Math.round((pd(b) - pd(a)) / day); return { big: d + ' días', table: [['Semanas', fmt(d / 7, 2)], ['Meses aprox.', fmt(d / 30.4375, 2)], ['Años aprox.', fmt(d / 365.2425, 3)], ['Horas', d * 24]] }; });
T('Sumar días a una fecha', [D('Fecha'), N('Días (negativo para restar)', 30)], ([a, n]) => { need(n); const d = new Date(pd(a).getTime() + n * day); return { big: fd(d), text: iso(d) }; });
T('Sumar meses a una fecha', [D('Fecha'), N('Meses', 6)], ([a, n]) => { need(n); const d = pd(a); d.setMonth(d.getMonth() + n); return { big: fd(d), text: iso(d) }; });
T('Sumar años a una fecha', [D('Fecha'), N('Años', 1)], ([a, n]) => { need(n); const d = pd(a); d.setFullYear(d.getFullYear() + n); return { big: fd(d), text: iso(d) }; });
T('Calcular edad exacta', [D('Fecha de nacimiento', '2000-01-15')], ([a]) => {
  const b = pd(a), n = new Date(); let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth(), d = n.getDate() - b.getDate();
  if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; }
  const next = new Date(n.getFullYear(), b.getMonth(), b.getDate()); if (next < n) next.setFullYear(n.getFullYear() + 1);
  return { big: `${y} años, ${m} meses y ${d} días`, table: [['Días vividos', Math.floor((n - b) / day).toLocaleString('es')], ['Próximo cumpleaños', `${fd(next)} (faltan ${Math.ceil((next - n) / day)} días)`], ['Naciste un', b.toLocaleDateString('es', { weekday: 'long' })]] };
});
T('¿Qué día de la semana fue?', [D('Fecha', '1990-07-20')], ([a]) => ({ big: pd(a).toLocaleDateString('es', { weekday: 'long' }), text: fd(pd(a)) }));
T('Número de semana del año', [D('Fecha')], ([a]) => { const d = pd(a); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return { big: 'Semana ' + Math.ceil(((t - y0) / day + 1) / 7), table: [['Día del año', Math.floor((d - new Date(d.getFullYear(), 0, 0)) / day)]] }; });
T('¿Es año bisiesto?', [N('Año', 2028)], ([y]) => { need(y); return { big: (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 'Sí, es bisiesto' : 'No es bisiesto' }; });
T('Días hábiles entre fechas', [D('Desde'), D('Hasta', '2026-12-31'), S('Feriados (AAAA-MM-DD, coma)', '2026-12-24,2026-12-25,2026-12-31')], ([a, b, h]) => { const H = new Set(h.split(/[\s,]+/).filter(Boolean)); let c = 0; for (let d = pd(a); d <= pd(b); d = new Date(d.getTime() + day)) if (d.getDay() % 6 && !H.has(iso(d))) c++; return { big: c + ' días hábiles' }; }, { roles: G.office });
T('Sumar días hábiles', [D('Fecha'), N('Días hábiles', 10)], ([a, n]) => { need(n); let d = pd(a), c = 0; while (c < n) { d = new Date(d.getTime() + day); if (d.getDay() % 6) c++; } return { big: fd(d), text: iso(d) }; }, { roles: G.office });
T('Calendario del mes', [N('Año', new Date().getFullYear()), N('Mes (1-12)', new Date().getMonth() + 1)], ([y, m]) => { need(y, m); const f = new Date(y, m - 1, 1), dim = new Date(y, m, 0).getDate(), off = (f.getDay() + 6) % 7; const today = new Date(); let c = ''; for (let i = 0; i < off; i++) c += '<i></i>'; for (let d = 1; d <= dim; d++) c += `<b class="${today.getFullYear() === y && today.getMonth() === m - 1 && today.getDate() === d ? 'on' : ''}">${d}</b>`;
  return { html: `<div class="cal-h">${f.toLocaleDateString('es', { month: 'long', year: 'numeric' })}</div><div class="cal"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>${c}</div>` }; });
T('Fecha de Semana Santa', [N('Año', 2027)], ([y]) => { need(y); const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = (h + l - 7 * m + 114) % 31 + 1; const E = new Date(y, mo - 1, da);
  return table([['Domingo de Resurrección', fd(E)], ['Jueves Santo', fd(new Date(E - 3 * day))], ['Viernes Santo', fd(new Date(E - 2 * day))], ['Miércoles de Ceniza', fd(new Date(E - 46 * day))]]); });
T('Feriados de Guatemala', [N('Año', new Date().getFullYear())], ([y]) => { need(y); return table([['1 ene', 'Año Nuevo'], ['Semana Santa', 'Jueves, Viernes y Sábado Santo'], ['1 may', 'Día del Trabajo'], ['30 jun', 'Día del Ejército'], ['15 sep', 'Independencia'], ['20 oct', 'Revolución de 1944'], ['1 nov', 'Todos los Santos'], ['24 dic', 'Nochebuena (medio día)'], ['25 dic', 'Navidad'], ['31 dic', 'Fin de año (medio día)']].map(([d, n]) => [d + ' ' + y, n])); });
T('Fase de la luna', [D('Fecha')], ([a]) => { const d = pd(a); const lp = 2551443; const nm = new Date(1970, 0, 7, 20, 35).getTime(); const ph = ((d.getTime() - nm) / 1000 % lp) / lp; const n = ['🌑 Luna nueva', '🌒 Creciente', '🌓 Cuarto creciente', '🌔 Gibosa creciente', '🌕 Luna llena', '🌖 Gibosa menguante', '🌗 Cuarto menguante', '🌘 Menguante']; return { big: n[Math.round(ph * 8) % 8], table: [['Iluminación aprox.', fmt((1 - Math.cos(ph * 2 * Math.PI)) / 2 * 100, 0) + ' %'], ['Edad lunar', fmt(ph * 29.53, 1) + ' días']] }; }, { roles: G.vis });
T('Signo zodiacal', [D('Fecha de nacimiento', '2000-03-25')], ([a]) => { const d = pd(a), md = (d.getMonth() + 1) * 100 + d.getDate(); const z = [[120, 'Capricornio'], [219, 'Acuario'], [320, 'Piscis'], [420, 'Aries'], [521, 'Tauro'], [621, 'Géminis'], [722, 'Cáncer'], [823, 'Leo'], [923, 'Virgo'], [1023, 'Libra'], [1122, 'Escorpio'], [1222, 'Sagitario'], [1231, 'Capricornio']]; const ch = ['Mono', 'Gallo', 'Perro', 'Cerdo', 'Rata', 'Buey', 'Tigre', 'Conejo', 'Dragón', 'Serpiente', 'Caballo', 'Cabra']; return table([['Zodiaco', z.find(x => md < x[0] || x[0] === 1231)[1]], ['Horóscopo chino', ch[d.getFullYear() % 12]]]); }, { roles: G.vis });
T('Fecha a formatos', [D('Fecha')], ([a]) => { const d = pd(a); return table([['ISO', iso(d)], ['Latino', d.toLocaleDateString('es')], ['EE. UU.', `${two(d.getMonth() + 1)}/${two(d.getDate())}/${d.getFullYear()}`], ['Largo', fd(d)], ['Unix', Math.floor(d / 1000)], ['Juliana', fmt(d / day + 2440587.5, 1)]]); });
T('Cuenta regresiva a una fecha', [D('Fecha objetivo', `${new Date().getFullYear()}-12-31`), TM('Hora', '23:59')], ([a, h]) => { const [H, M] = (h || '00:00').split(':').map(Number); const t = pd(a); t.setHours(H, M); let s = Math.max(0, (t - Date.now()) / 1000); const d = Math.floor(s / 86400); s %= 86400; return { big: `${d}d ${two(Math.floor(s / 3600))}h ${two(Math.floor(s % 3600 / 60))}m ${two(Math.floor(s % 60))}s` }; }, { refresh: 1000 });
group('Horas');
T('Sumar horas y minutos', [TM('Hora inicial', '08:30'), N('Horas', 2), N('Minutos', 45)], ([t, h, m]) => { const [H, M] = t.split(':').map(Number); const total = ((H * 60 + M + (h || 0) * 60 + (m || 0)) % 1440 + 1440) % 1440; return { big: `${two(Math.floor(total / 60))}:${two(total % 60)}` }; });
T('Diferencia entre dos horas', [TM('Entrada', '08:00'), TM('Salida', '17:30')], ([a, b]) => { const f = s => { const [H, M] = s.split(':').map(Number); return H * 60 + M; }; let d = f(b) - f(a); if (d < 0) d += 1440; return { big: `${Math.floor(d / 60)} h ${d % 60} min`, table: [['Decimal', fmt(d / 60, 2) + ' h']] }; });
T('Horas trabajadas en la semana', [A('Entradas y salidas por día (08:00-17:00)', '08:00-17:00\n08:00-17:00\n08:30-17:30\n08:00-16:00\n08:00-12:00'), N('Descanso diario (min)', 60)], ([s, br]) => { let tot = 0; const r = s.trim().split('\n').map((l, i) => { const [a, b] = l.split('-').map(x => { const [H, M] = x.trim().split(':').map(Number); return H * 60 + M; }); const d = Math.max(0, b - a - (br || 0)); tot += d; return ['Día ' + (i + 1), fmt(d / 60, 2) + ' h']; }); return { big: fmt(tot / 60, 2) + ' horas', table: r }; }, { roles: G.office });
T('Horas decimales a horas y minutos', [N('Horas decimales', 7.75)], ([h]) => { need(h); return { big: `${Math.floor(h)} h ${Math.round(h % 1 * 60)} min` }; });
T('Horas y minutos a decimal', [N('Horas', 7), N('Minutos', 45)], ([h, m]) => { need(h, m); return { big: fmt(h + m / 60, 4) + ' h' }; });
T('Formato 24 h a 12 h', [TM('Hora', '18:45')], ([t]) => { const [H, M] = t.split(':').map(Number); return { big: `${H % 12 || 12}:${two(M)} ${H < 12 ? 'a. m.' : 'p. m.'}` }; });
T('Segundos a días, horas y minutos', [N('Segundos', 100000)], ([s]) => { need(s); return { big: `${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h ${Math.floor(s % 3600 / 60)}m ${Math.floor(s % 60)}s` }; });
T('Unix a fecha', [N('Marca de tiempo (s o ms)', 1800000000)], ([t]) => { need(t); const d = new Date(t > 1e12 ? t : t * 1000); return table([['Local', d.toLocaleString('es')], ['UTC', d.toUTCString()], ['ISO', d.toISOString()]]); }, { roles: G.tech });
T('Fecha a Unix', [D('Fecha'), TM('Hora', '12:00')], ([a, h]) => { const d = pd(a); const [H, M] = (h || '00:00').split(':').map(Number); d.setHours(H, M); return { big: String(Math.floor(d / 1000)), table: [['Milisegundos', d.getTime()]] }; }, { roles: G.tech });
group('Zonas horarias');
const ZONES = [['Guatemala', 'America/Guatemala'], ['Ciudad de México', 'America/Mexico_City'], ['San Salvador', 'America/El_Salvador'], ['Tegucigalpa', 'America/Tegucigalpa'], ['Managua', 'America/Managua'], ['San José (CR)', 'America/Costa_Rica'],
  ['Panamá', 'America/Panama'], ['Bogotá', 'America/Bogota'], ['Lima', 'America/Lima'], ['Caracas', 'America/Caracas'], ['Santiago', 'America/Santiago'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'], ['São Paulo', 'America/Sao_Paulo'],
  ['Nueva York', 'America/New_York'], ['Los Ángeles', 'America/Los_Angeles'], ['Chicago', 'America/Chicago'], ['Toronto', 'America/Toronto'], ['Madrid', 'Europe/Madrid'], ['Londres', 'Europe/London'], ['París', 'Europe/Paris'], ['Berlín', 'Europe/Berlin'],
  ['Moscú', 'Europe/Moscow'], ['Dubái', 'Asia/Dubai'], ['Nueva Delhi', 'Asia/Kolkata'], ['Pekín', 'Asia/Shanghai'], ['Tokio', 'Asia/Tokyo'], ['Seúl', 'Asia/Seoul'], ['Sídney', 'Australia/Sydney'], ['Auckland', 'Pacific/Auckland'], ['UTC', 'UTC']];
const tz = (d, z) => d.toLocaleString('es', { timeZone: z, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short' });
for (const [n, z] of ZONES) T('Hora actual en ' + n, [], () => ({ big: new Date().toLocaleTimeString('es', { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit' }), table: [['Fecha', new Date().toLocaleDateString('es', { timeZone: z, weekday: 'long', day: 'numeric', month: 'long' })], ['Zona', z]] }), { roles: G.vis, refresh: 1000, kw: 'zona horaria reloj mundial' });
T('Reloj mundial', [], () => table(ZONES.map(([n, z]) => [n, tz(new Date(), z)])), { roles: G.vis, refresh: 1000 });
T('Convertir hora entre zonas', [TM('Hora', '09:00'), SEL('Desde', ZONES.map(z => z[0])), SEL('Hacia', ZONES.map(z => z[0]), 'Madrid')], ([t, a, b]) => {
  const za = ZONES.find(z => z[0] === a)[1], zb = ZONES.find(z => z[0] === b)[1]; const [H, M] = t.split(':').map(Number); const now = new Date();
  const off = (z) => { const s = now.toLocaleString('en-US', { timeZone: z, hourCycle: 'h23' }); return (new Date(s) - new Date(now.toLocaleString('en-US', { timeZone: 'UTC', hourCycle: 'h23' }))) / 60000; };
  const m = ((H * 60 + M - off(za) + off(zb)) % 1440 + 1440) % 1440; return { big: `${two(Math.floor(m / 60))}:${two(m % 60)} en ${b}`, table: [['Diferencia', fmt((off(zb) - off(za)) / 60, 1) + ' h']] };
}, { roles: G.vis });
T('Planificar reunión internacional', [TM('Hora en Guatemala', '10:00')], ([t]) => { const [H, M] = t.split(':').map(Number); const now = new Date(); const off = (z) => (new Date(now.toLocaleString('en-US', { timeZone: z, hourCycle: 'h23' })) - new Date(now.toLocaleString('en-US', { timeZone: 'America/Guatemala', hourCycle: 'h23' }))) / 60000; return table(ZONES.map(([n, z]) => { const m = ((H * 60 + M + off(z)) % 1440 + 1440) % 1440; const h = Math.floor(m / 60); return [n, `${two(h)}:${two(m % 60)} ${h >= 8 && h < 18 ? '✔ laboral' : h >= 22 || h < 6 ? '✘ noche' : '• fuera de horario'}`]; })); }, { roles: G.office });

// ---- relojes interactivos
group('Relojes');
T('Cronómetro', null, null, { roles: G.all, view(el) {
  let t0 = 0, acc = 0, run = false, laps = [], raf;
  el.innerHTML = `<div class="clockbig" id="v">00:00.00</div><div class="grid3"><button class="btn primary" id="go">Iniciar</button><button class="btn" id="lap">Vuelta</button><button class="btn" id="rs">Reiniciar</button></div><div id="laps" class="laps"></div>`;
  const f = ms => `${two(Math.floor(ms / 60000))}:${two(Math.floor(ms / 1000) % 60)}.${two(Math.floor(ms / 10) % 100)}`;
  const tick = () => { el.querySelector('#v').textContent = f(acc + (run ? performance.now() - t0 : 0)); raf = requestAnimationFrame(tick); }; tick();
  el.querySelector('#go').onclick = (e) => { if (run) { acc += performance.now() - t0; run = false; e.target.textContent = 'Seguir'; } else { t0 = performance.now(); run = true; e.target.textContent = 'Pausar'; } native.vibrate(8); };
  el.querySelector('#lap').onclick = () => { const v = acc + (run ? performance.now() - t0 : 0); laps.unshift(v); el.querySelector('#laps').innerHTML = laps.map((x, i) => `<div><span>Vuelta ${laps.length - i}</span><b>${f(x)}</b><small>+${f(x - (laps[i + 1] || 0))}</small></div>`).join(''); };
  el.querySelector('#rs').onclick = () => { acc = 0; run = false; laps = []; el.querySelector('#laps').innerHTML = ''; el.querySelector('#go').textContent = 'Iniciar'; };
  return () => cancelAnimationFrame(raf);
} });
T('Temporizador', null, null, { roles: G.all, view(el) {
  let end = 0, left = 300000, run = false, iv;
  el.innerHTML = `<div class="clockbig" id="v">05:00</div><div class="chips" style="justify-content:center;margin-bottom:10px">${[1, 3, 5, 10, 15, 25, 30, 60].map(m => `<button class="chip" data-m="${m}">${m} min</button>`).join('')}</div>
    <div class="grid2"><button class="btn primary" id="go">Iniciar</button><button class="btn" id="rs">Reiniciar</button></div>`;
  const show = () => { const s = Math.ceil(left / 1000); el.querySelector('#v').textContent = `${two(Math.floor(s / 60))}:${two(s % 60)}`; };
  const loop = () => { left = end - Date.now(); if (left <= 0) { left = 0; run = false; clearInterval(iv); native.pattern([400, 200, 400, 200, 800]); beep(); el.querySelector('#go').textContent = 'Iniciar'; } show(); };
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { left = +b.dataset.m * 60000; run = false; clearInterval(iv); el.querySelector('#go').textContent = 'Iniciar'; show(); });
  el.querySelector('#go').onclick = (e) => { if (run) { run = false; clearInterval(iv); e.target.textContent = 'Seguir'; } else if (left > 0) { end = Date.now() + left; run = true; iv = setInterval(loop, 200); e.target.textContent = 'Pausar'; native.keepAwake(true); } };
  el.querySelector('#rs').onclick = () => { left = 300000; run = false; clearInterval(iv); el.querySelector('#go').textContent = 'Iniciar'; show(); };
  return () => { clearInterval(iv); native.keepAwake(false); };
} });
T('Pomodoro (enfoque)', null, null, { roles: G.vis, view(el) {
  const phases = [['Enfoque', 25], ['Descanso', 5], ['Enfoque', 25], ['Descanso', 5], ['Enfoque', 25], ['Descanso', 5], ['Enfoque', 25], ['Descanso largo', 15]];
  let i = 0, end = 0, left = 25 * 60000, run = false, iv, done = 0;
  el.innerHTML = `<div class="center red" id="ph" style="letter-spacing:.2em">ENFOQUE</div><div class="clockbig" id="v">25:00</div><div class="center mut small" id="cnt">Pomodoros completados: 0</div><div class="grid2" style="margin-top:12px"><button class="btn primary" id="go">Iniciar</button><button class="btn" id="sk">Saltar fase</button></div>`;
  const show = () => { const s = Math.ceil(left / 1000); el.querySelector('#v').textContent = `${two(Math.floor(s / 60))}:${two(s % 60)}`; el.querySelector('#ph').textContent = phases[i][0].toUpperCase(); };
  const next = () => { if (phases[i][0] === 'Enfoque') done++; i = (i + 1) % phases.length; left = phases[i][1] * 60000; end = Date.now() + left; el.querySelector('#cnt').textContent = 'Pomodoros completados: ' + done; native.pattern([300, 150, 300]); beep(); show(); };
  el.querySelector('#go').onclick = (e) => { if (run) { run = false; clearInterval(iv); e.target.textContent = 'Seguir'; } else { end = Date.now() + left; run = true; e.target.textContent = 'Pausar'; iv = setInterval(() => { left = end - Date.now(); if (left <= 0) next(); show(); }, 250); native.keepAwake(true); } };
  el.querySelector('#sk').onclick = () => next();
  return () => { clearInterval(iv); native.keepAwake(false); };
} });
T('Reloj grande de pantalla', null, null, { roles: G.all, view(el) {
  el.innerHTML = `<div class="clockbig huge" id="v"></div><div class="center mut" id="d"></div>`;
  const f = () => { const n = new Date(); el.querySelector('#v').textContent = n.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); el.querySelector('#d').textContent = fd(n); };
  f(); const iv = setInterval(f, 500); native.keepAwake(true); return () => { clearInterval(iv); native.keepAwake(false); };
} });
T('Alarma con sonido', null, null, { roles: G.vis, view(el) {
  el.innerHTML = `<label class="small mut">Hora de la alarma</label><input type="time" class="input" id="t" value="07:00"><button class="btn primary block" id="go" style="margin-top:10px">Activar alarma</button><div class="clockbig" id="v" style="font-size:22px"></div><p class="small mut">La alarma suena mientras la app esté abierta.</p>`;
  let at = null; const iv = setInterval(() => { if (!at) return; const ms = at - Date.now(); if (ms <= 0) { at = null; el.querySelector('#v').textContent = '⏰ ¡ALARMA!'; for (let k = 0; k < 6; k++) setTimeout(beep, k * 700); native.pattern([600, 300, 600, 300, 600]); el.querySelector('#go').textContent = 'Activar alarma'; } else el.querySelector('#v').textContent = `Suena en ${Math.floor(ms / 3600000)}h ${two(Math.floor(ms / 60000) % 60)}m ${two(Math.floor(ms / 1000) % 60)}s`; }, 500);
  el.querySelector('#go').onclick = (e) => { if (at) { at = null; e.target.textContent = 'Activar alarma'; el.querySelector('#v').textContent = ''; return; } const [H, M] = el.querySelector('#t').value.split(':').map(Number); const d = new Date(); d.setHours(H, M, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); at = d.getTime(); e.target.textContent = 'Cancelar alarma'; native.keepAwake(true); };
  return () => { clearInterval(iv); native.keepAwake(false); };
} });

let AC;
export function beep(freq = 880, ms = 250, type = 'sine', vol = .3) {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol; o.connect(g); g.connect(AC.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + ms / 1000); o.stop(AC.currentTime + ms / 1000 + .05); } catch {}
}
export function audioCtx() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); return AC; }
