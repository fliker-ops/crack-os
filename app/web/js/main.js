// Crack Remote: app principal (arranque, conexion, inicio de sesion y navegacion)
import { conn, api, get, post, setHost, setSession, clearSession, recentPCs, discover, probe, publicUrl,
  setUnauthorizedHandler } from './api.js';
import { native } from './native.js';
import { icon, h, $, $$, esc, toast, modal, prompt, busy } from './ui.js';

const app = $('#app');
export const state = { stack: [], cleanup: null, tab: 'home', sys: null };

// ---------------------------------------------------------------- fondo HUD
function circuit() {
  const W = innerWidth, H = innerHeight;
  let rnd = 7;
  const r = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
  let paths = '', nodes = '', pulses = '';
  for (let i = 0; i < 14; i++) {
    let x = r() < .5 ? -5 : W + 5, y = r() * H;
    let d = `M${x} ${y}`;
    const dir = x < 0 ? 1 : -1;
    for (let k = 0; k < 4; k++) {
      x += dir * (30 + r() * 90); d += ` L${x} ${y}`;
      const dy = (r() - .5) * 120; x += dir * Math.abs(dy) * .6; y += dy; d += ` L${x} ${y}`;
    }
    paths += `<path class="trace" d="${d}"/>`;
    nodes += `<circle class="node" cx="${x}" cy="${y}" r="2.6"/>`;
    if (i % 3 === 0) pulses += `<path class="pulse" d="${d}" style="animation-delay:${-i * 0.9}s"/>`;
  }
  $('#bgfx').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${paths}${pulses}${nodes}</svg>`;
}

// ---------------------------------------------------------------- arranque
async function boot() {
  const B = $('#boot'), v = $('#bootvid'), bar = $('#boot .bar i'), logEl = $('#boot .log');
  const say = (t) => { logEl.insertAdjacentHTML('beforeend', `<div>${esc(t)}</div>`); while (logEl.children.length > 3) logEl.firstChild.remove(); };
  const quick = new URLSearchParams(location.search).has('fast');
  v.play().catch(() => {});
  const t0 = performance.now();
  setTimeout(() => { B.classList.add('t'); $('.title-crack', B).classList.add('glitch'); }, quick ? 100 : 2600);
  let pct = 0;
  const tick = setInterval(() => { pct = Math.min(pct + 3, 96); bar.style.width = pct + '%'; }, 120);
  say('iniciando Crack Remote ' + native.version);
  let next = 'connect';
  const demo = native.demoHost();
  if (demo) { setHost(demo, 4747, demo); }
  if (conn.host) {
    say('contactando ' + (conn.pcName || conn.host));
    const hello = await probe(conn.host, conn.port, 2500);
    if (hello) {
      say(`PC encontrada: ${hello.name}`);
      if (conn.token) {
        try { state.sys = await get('/api/system', { timeout: 4000 }); next = 'shell'; say('sesión restaurada: ' + conn.user); }
        catch { next = 'login'; }
      } else next = 'login';
    } else say('la PC no responde, buscando otras');
  }
  if (next === 'connect') say('escaneando la red local');
  const wait = quick ? 300 : Math.max(0, 5200 - (performance.now() - t0));
  await new Promise(r => setTimeout(r, wait));
  clearInterval(tick); bar.style.width = '100%';
  say('listo');
  await new Promise(r => setTimeout(r, quick ? 50 : 350));
  B.classList.add('out');
  setTimeout(() => B.remove(), 700);
  if (next === 'shell') showShell(); else if (next === 'login') showLogin(); else showConnect();
}

// ---------------------------------------------------------------- conexion
function showConnect() {
  cleanupAll();
  const el = h(`<div class="screen"><div class="connect">
    <div class="hero"><img src="assets/skull.png"><div class="title-crack">CRACK OS</div><div class="sub">REMOTE · CONTROL · LINK</div></div>
    <section class="panel"><header><span class="ptitle">PCs en tu red</span><i></i><button class="act" id="rescan">${icon('refresh', 14)}</button></header>
      <div class="pbody"><div class="scan" id="scan"></div><div id="pcs"></div><p class="mut small" id="scanmsg">Buscando PCs con Crack OS en tu Wi-Fi…</p></div></section>
    <section class="panel"><header><span class="ptitle">Conectar a mano</span><i></i></header><div class="pbody">
      <div class="row"><input class="input" id="ip" placeholder="IP de la PC (ej. 192.168.1.20)" inputmode="decimal"><button class="btn primary" id="go">${icon('zap', 18)}</button></div>
      <p class="mut small">En la PC abre una terminal y escribe <b class="red">crackos-remote</b> para ver su IP.</p></div></section>
  </div></div>`);
  app.replaceChildren(el);
  const list = $('#pcs', el);
  const shown = new Set();
  const addPC = (pc) => {
    if (shown.has(pc.host)) return;
    shown.add(pc.host);
    const it = h(`<div class="pc"><div class="pcic">${icon('cpu', 24)}</div><div class="sp"><b>${esc(pc.name)}</b>
      <span class="mut small">${esc(pc.host)} · ${pc.users ?? '?'} usuarios</span></div>${icon('back', 18, 'red" style="transform:rotate(180deg)')}</div>`);
    it.onclick = () => { native.vibrate(); setHost(pc.host, pc.port, pc.name); showLogin(); };
    list.appendChild(it);
  };
  const scan = async () => {
    $('#scan', el).style.display = ''; $('#scanmsg', el).textContent = 'Buscando PCs con Crack OS en tu Wi-Fi…';
    const res = await discover(native, addPC);
    $('#scan', el).style.display = 'none';
    $('#scanmsg', el).textContent = res.length || shown.size ? 'Toca una PC para entrar.' : 'No encontré ninguna PC. Revisa que estés en la misma red Wi-Fi.';
  };
  $('#rescan', el).onclick = scan;
  $('#go', el).onclick = async () => {
    const v = $('#ip', el).value.trim();
    if (!v) return;
    const [host, port] = v.split(':');
    const b = $('#go', el); busy(b, true);
    const pc = await probe(host, Number(port || 4747), 4000);
    busy(b, false);
    if (!pc) return toast('No hay un Crack OS en ' + v, 'err');
    setHost(pc.host, pc.port, pc.name); showLogin();
  };
  scan();
}

// ---------------------------------------------------------------- inicio de sesion
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function showLogin() {
  cleanupAll();
  const el = h(`<div class="screen"><div class="login">
    <div class="lhead"><span class="brand">${icon('zap', 16, 'red')} CRACK OS <small class="mut" style="letter-spacing:0;font-weight:400">${esc(conn.pcName)}</small></span><span class="mut" id="ldate"></span></div>
    <div class="clockring"><svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="80" fill="none" stroke="#ff2832" stroke-width="1.5" stroke-dasharray="380 200" opacity=".8"/><circle cx="85" cy="85" r="72" fill="none" stroke="#ff2832" stroke-width="1" stroke-dasharray="2 6" opacity=".4"/></svg>
      <div><div class="t" id="lclock">--:--</div><div class="d" id="lday"></div></div></div>
    <div class="mut" style="margin-top:8px">Selecciona usuario</div>
    <div class="users" id="users"><div class="spin"></div></div>
    <div class="pwrow"><div class="pwbox">${icon('lock', 18)}<input id="pw" type="password" placeholder="Contraseña" autocomplete="current-password"></div><button class="gobtn" id="go">${icon('back', 22, '" style="transform:rotate(180deg)')}</button></div>
    <div class="loginerr" id="err"></div>
    <div class="sp"></div>
    <div class="row" style="width:100%;justify-content:space-between;margin-top:20px">
      <button class="btn sm ghost" id="chg">${icon('wifi', 16)} Cambiar PC</button>
      <span class="mut small">${esc(conn.host)}</span></div>
  </div></div>`);
  app.replaceChildren(el);
  const clock = () => {
    const d = new Date();
    $('#lclock', el).textContent = d.toTimeString().slice(0, 5);
    $('#lday', el).textContent = `${DIAS[d.getDay()]} ${d.getDate()}`;
    $('#ldate', el).textContent = `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  };
  clock(); const ci = setInterval(clock, 1000);
  state.cleanup = () => clearInterval(ci);
  $('#chg', el).onclick = () => showConnect();
  let users = [], sel = null;
  try {
    const r = await get('/api/users');
    users = r.users; conn.pcName = r.host;
  } catch (e) {
    $('#users', el).innerHTML = `<p class="mut">${esc(e.message)}</p>`;
    return;
  }
  const box = $('#users', el);
  box.innerHTML = '';
  if (!users.length) box.innerHTML = '<p class="mut">La PC no tiene usuarios.</p>';
  const select = (u, card) => {
    sel = u; $$('.ucard', box).forEach(c => c.classList.toggle('on', c === card));
    card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    $('#pw', el).placeholder = u.passwordless ? 'Sin contraseña (toca la flecha)' : `Contraseña de ${u.full}`;
    $('#err', el).textContent = '';
    native.vibrate(8);
  };
  users.forEach((u, i) => {
    const c = h(`<button class="ucard"><div class="av"><img src="${publicUrl('/api/avatar', { user: u.name, v: Date.now() })}">${u.online ? '<span class="dot"></span>' : ''}</div>
      <span class="nm">${esc(u.full)}</span><span class="rl">${u.admin ? 'administrador' : 'usuario'} · ${esc(u.name)}</span></button>`);
    c.onclick = () => select(u, c);
    box.appendChild(c);
  });
  const last = users.findIndex(u => u.name === conn.user);
  const first = last >= 0 ? last : Math.max(0, users.findIndex(u => u.online));
  if (users.length) select(users[first], box.children[first]);
  const doLogin = async () => {
    if (!sel) return;
    const b = $('#go', el); busy(b, true);
    try {
      const r = await post('/api/login', { user: sel.name, password: $('#pw', el).value, device: native.device });
      setSession(r.token, r.user, r.admin);
      native.vibrate(30);
      state.sys = await get('/api/system');
      showShell(true);
    } catch (e) {
      busy(b, false);
      $('#err', el).textContent = e.message;
      $('.pwbox', el).classList.remove('shake'); void el.offsetWidth; $('.pwbox', el).classList.add('shake');
      native.vibrate(60);
    }
  };
  $('#go', el).onclick = doLogin;
  $('#pw', el).onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
}

// ---------------------------------------------------------------- navegacion
const TABS = [
  { id: 'home', label: 'INICIO', icon: 'home' },
  { id: 'control', label: 'CONTROL', icon: 'mouse' },
  { id: 'terminal', label: 'TERMINAL', icon: 'term' },
  { id: 'globe', label: 'MUNDO', icon: 'globe' },
  { id: 'more', label: 'MÁS', icon: 'grid' },
];

export const MODULES = [
  { id: 'apps', label: 'Aplicaciones', icon: 'apps', sub: 'abrir en la PC' },
  { id: 'windows', label: 'Ventanas', icon: 'windows', sub: 'y escritorios' },
  { id: 'wallpapers', label: 'Fondos', icon: 'image', sub: 'cambiar fondo' },
  { id: 'editor', label: 'Editor', icon: 'brush', sub: 'crear fondo' },
  { id: 'tasks', label: 'Tareas', icon: 'check', sub: 'pendientes' },
  { id: 'market', label: 'Mercado', icon: 'market', sub: 'trading en vivo' },
  { id: 'stats', label: 'Gráficas', icon: 'chart', sub: 'PC y tokens' },
  { id: 'carnet', label: 'Carnet', icon: 'id', sub: 'ID hacker' },
  { id: 'files', label: 'Archivos', icon: 'folder', sub: 'enviar/bajar' },
  { id: 'procs', label: 'Procesos', icon: 'cpu', sub: 'cerrar programas' },
  { id: 'disks', label: 'Discos', icon: 'disk', sub: 'particiones' },
  { id: 'screen', label: 'Pantalla', icon: 'camera', sub: 'captura en vivo' },
  { id: 'clipboard', label: 'Portapapeles', icon: 'clip', sub: 'copiar/pegar' },
  { id: 'notify', label: 'Mensaje', icon: 'bell', sub: 'aviso en la PC' },
  { id: 'power', label: 'Energía', icon: 'power', sub: 'apagar/bloquear' },
  { id: 'system', label: 'Sistema', icon: 'info', sub: 'info y ajustes' },
];
const TITLES = Object.fromEntries([...MODULES.map(m => [m.id, m.label]),
  ['home', 'Inicio'], ['control', 'Control'], ['terminal', 'Terminal'], ['globe', 'Mundo'], ['more', 'Módulos']]);

let liveTimer;
function showShell(fresh) {
  cleanupAll();
  const el = h(`<div class="screen">
    <div class="topbar"><button class="iconbtn" id="back" style="display:none">${icon('back')}</button>
      <div class="brand" id="tbrand"><img src="assets/icon.png"><div><div>CRACK OS</div><small>${esc(conn.user)}@${esc(state.sys?.host || conn.pcName)}</small></div></div>
      <div class="sub-title" id="ttitle" style="display:none"></div>
      <span class="sp"></span><span class="live" id="live"><i></i><span>EN LÍNEA</span></span></div>
    <div class="content" id="content"></div>
    <nav class="nav">${TABS.map(t => `<button data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></button>`).join('')}</nav>
  </div>`);
  app.replaceChildren(el);
  $$('.nav button', el).forEach(b => b.onclick = () => { native.vibrate(6); state.stack = []; open(b.dataset.tab); });
  $('#back', el).onclick = () => back();
  clearInterval(liveTimer);
  liveTimer = setInterval(async () => {
    const ok = await probe(conn.host, conn.port, 2500);
    const l = $('#live'); if (!l) return;
    l.classList.toggle('off', !ok); l.querySelector('span').textContent = ok ? 'EN LÍNEA' : 'SIN CONEXIÓN';
  }, 6000);
  open('home');
  if (fresh) toast(`Conectado a ${state.sys?.host || conn.pcName} como ${conn.user}`);
}

const loaded = {};
export async function open(id, params = {}, push = false) {
  const content = $('#content');
  if (!content) return;
  if (push) state.stack.push({ id: state.current, params: state.params });
  if (state.cleanup) { try { state.cleanup(); } catch (e) { console.error(e); } state.cleanup = null; }
  state.current = id; state.params = params;
  const isTab = TABS.some(t => t.id === id);
  if (isTab) state.tab = id;
  $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  const sub = !isTab || state.stack.length;
  $('#back').style.display = sub ? '' : 'none';
  $('#tbrand').style.display = sub ? 'none' : '';
  $('#ttitle').style.display = sub ? '' : 'none';
  $('#ttitle').innerHTML = `<small>CRACK//REMOTE</small>${esc(TITLES[id] || id)}`;
  content.className = 'content'; content.removeAttribute('style');
  content.innerHTML = '<div class="empty"><span class="spin"></span></div>';
  content.scrollTop = 0;
  try {
    const mod = loaded[id] || (loaded[id] = (await import(`./screens/${id}.js`)).default);
    if (state.current !== id) return;
    content.innerHTML = '';
    if (mod.full) content.className = 'content full';
    state.cleanup = await mod.mount(content, params, { open: (i, p) => open(i, p, true), back }) || null;
  } catch (e) {
    console.error(e);
    content.innerHTML = `<div class="empty">${icon('x', 30, 'red')}<p>${esc(e.message)}</p></div>`;
  }
}

export function back() {
  const prev = state.stack.pop();
  if (prev) { open(prev.id, prev.params); return true; }
  if (state.current && state.current !== 'home' && $('#content')) { open(TABS.some(t => t.id === state.current) ? 'home' : state.tab); return true; }
  return false;
}
window.crkBack = () => {
  const m = $('.modal-bg'); if (m) { m.click(); return true; }
  return back();
};

function cleanupAll() {
  if (state.cleanup) { try { state.cleanup(); } catch {} state.cleanup = null; }
  clearInterval(liveTimer);
}

export async function logout() {
  try { await post('/api/logout'); } catch {}
  clearSession();
  showLogin();
}

setUnauthorizedHandler((msg) => { clearSession(); toast(msg, 'err'); showLogin(); });
window.addEventListener('resize', circuit);
circuit();
boot();
