// Crack Pro: arranque, registro por rol, inicio de sesión y navegación por categorías.
import { TOOLS, CATS, getTool } from './registry.js';
import { ROLES, ROLE, canUse } from './roles.js';
import { store, profiles, roleCodes, favs, recent, usage, audit, sha } from './store.js';
import { icon, h, $, $$, esc, toast, modal, confirm, prompt, busy } from './ui.js';
import { native } from './native.js';
import { avatarEditor, drawCard, checkCard, cardResultHTML, AVATAR_DEF } from './card.js';
import { runnerView } from './runner.js';

const app = $('#app');
export const state = { cleanup: null };
const ctx = { verifyCard: (t) => cardResultHTML(checkCard(t, profiles.all())) };

// --------------------------------------------------- fondo
function bgfx() {
  const W = innerWidth, H = innerHeight; let rnd = 7; const r = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
  let paths = '', nodes = '', pulses = '';
  for (let i = 0; i < 12; i++) { let x = r() < .5 ? -5 : W + 5, y = r() * H; let d = `M${x} ${y}`; const dir = x < 0 ? 1 : -1;
    for (let k = 0; k < 4; k++) { x += dir * (30 + r() * 90); d += ` L${x} ${y}`; const dy = (r() - .5) * 120; x += dir * Math.abs(dy) * .6; y += dy; d += ` L${x} ${y}`; }
    paths += `<path class="trace" d="${d}"/>`; nodes += `<circle class="node" cx="${x}" cy="${y}" r="2.4"/>`; if (i % 3 === 0) pulses += `<path class="pulse" d="${d}" style="animation-delay:${-i * .9}s"/>`; }
  $('#bgfx').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${paths}${pulses}${nodes}</svg>`;
}

// --------------------------------------------------- arranque
async function boot() {
  const B = $('#boot'), v = $('#bootvid'), bar = $('#boot .bar i'), logEl = $('#boot .log');
  const say = (t) => { logEl.insertAdjacentHTML('beforeend', `<div>${esc(t)}</div>`); while (logEl.children.length > 3) logEl.firstChild.remove(); };
  const quick = new URLSearchParams(location.search).has('fast');
  v?.play().catch(() => {});
  setTimeout(() => { B.classList.add('t'); $('.title-crack', B)?.classList.add('glitch'); }, quick ? 100 : 2400);
  let pct = 0; const tick = setInterval(() => { pct = Math.min(pct + 4, 96); bar.style.width = pct + '%'; }, 110);
  say('iniciando Crack Pro ' + native.version); say('cargando ' + TOOLS.length + ' opciones');
  const cur = profiles.current();
  if (cur && !cur.disabled) say('sesión activa: @' + cur.alias); else say('listo para iniciar sesión');
  await new Promise(r => setTimeout(r, quick ? 250 : 2600));
  clearInterval(tick); bar.style.width = '100%'; say('listo');
  await new Promise(r => setTimeout(r, quick ? 40 : 300));
  B.classList.add('out'); setTimeout(() => B.remove(), 700);
  route();
}

function route() {
  const cur = profiles.current();
  if (cur && !cur.disabled) showHome();
  else if (profiles.all().length) showLogin();
  else showWelcome();
}

// --------------------------------------------------- bienvenida / registro
function showWelcome() {
  cleanup();
  const el = h(`<div class="screen onboard"><div class="hero"><img src="assets/skull.png" class="skull"><div class="title-crack">CRACK PRO</div><div class="sub">SECURE · STEALTH · SYSTEM</div></div>
    <p class="welcome-txt">Caja de herramientas profesional del grupo. Crea tu carnet, elige tu rol y desbloquea tus opciones.</p>
    <button class="btn primary block big-btn" id="create">${icon('id', 18)} Crear mi carnet</button>
    <p class="mut small center">Ya hay ${TOOLS.length} opciones esperando, repartidas en ${CATS.length} categorías.</p></div>`);
  app.replaceChildren(el);
  $('#create', el).onclick = () => showRegister();
}

function showRegister() {
  cleanup();
  const first = profiles.all().length === 0;
  const draft = { avatar: { ...AVATAR_DEF }, logos: [] };
  const el = h(`<div class="screen"><div class="topbar"><button class="iconbtn" id="back">${icon('back', 20)}</button><div class="sub-title">Nuevo carnet<small>CRACK PRO</small></div></div>
    <div class="content">
      <section class="panel"><header><span class="ptitle">Tus datos</span><i></i></header><div class="pbody col">
        <label class="fld-lab">Nombre del carnet</label><input class="input" id="name" placeholder="Nombre completo" maxlength="24">
        <label class="fld-lab">Alias</label><input class="input" id="alias" placeholder="Tu apodo o usuario" maxlength="18">
      </div></section>
      <section class="panel"><header><span class="ptitle">Tu rol</span><i></i></header><div class="pbody">
        <div class="roles" id="roles">${ROLES.map(r => `<button class="role-opt" data-role="${r.id}" style="--c:${r.color}"><b>${r.badge}</b><span>${r.name}</span><small>Nivel ${r.level}</small></button>`).join('')}</div>
        <p class="role-desc mut small" id="rdesc">Elige un rol para ver qué incluye.</p>
        <div id="codebox"></div>
      </div></section>
      <section class="panel"><header><span class="ptitle">Tu personaje</span><i></i></header><div class="pbody"><div id="editor"></div></div></section>
      <button class="btn primary block big-btn" id="done" style="margin:14px 0 30px">${icon('check', 18)} Crear carnet y entrar</button>
    </div></div>`);
  app.replaceChildren(el);
  $('#back', el).onclick = () => route();
  avatarEditor($('#editor', el), draft.avatar, draft.logos, (a, l) => { draft.avatar = a; draft.logos = l; });
  let role = 'invitado';
  const codebox = $('#codebox', el);
  const renderCode = () => { const r = ROLE[role]; const protdirected = !['invitado', 'visitante'].includes(role);
    codebox.innerHTML = protididtext(role); };
  function protididtext(rid) { if (['invitado', 'visitante'].includes(rid)) return '<p class="small ok">Este rol no necesita código.</p>'; if (rid === 'admin') return first ? '<label class="fld-lab">Crea tu PIN maestro (4 a 12 dígitos)</label><input class="input" id="code" type="password" inputmode="numeric" placeholder="PIN de administrador" maxlength="12">' : '<label class="fld-lab">PIN de administrador</label><input class="input" id="code" type="password" inputmode="numeric" placeholder="PIN maestro" maxlength="12">'; const has = roleCodes.get()[rid]; return `<label class="fld-lab">Código del rol ${ROLE[rid].name}</label><input class="input" id="code" inputmode="numeric" placeholder="${has ? 'Pídeselo a un administrador' : 'Aún no hay código: queda libre'}" maxlength="12">${has ? '' : '<p class="small mut">Este rol todavía no tiene código; puedes entrar sin él.</p>'}`; }
  $$('[data-role]', el).forEach(b => b.onclick = () => { role = b.dataset.role; $$('[data-role]', el).forEach(x => x.classList.toggle('on', x === b)); $('#rdesc', el).innerHTML = `<b style="color:${ROLE[role].color}">${ROLE[role].name}:</b> ${esc(ROLE[role].desc)} · ${TOOLS.filter(t => canUse(role, t)).length} opciones`; renderCode(); native.vibrate(8); });
  $$('[data-role]', el)[0].click();
  $('#done', el).onclick = async () => {
    const name = $('#name', el).value.trim(), alias = $('#alias', el).value.trim();
    if (!name || !alias) return toast('Escribe tu nombre y alias', 'err');
    const codeEl = $('#code', el); const code = codeEl ? codeEl.value.trim() : '';
    if (role === 'admin') { if (first) { if (!/^\d{4,12}$/.test(code)) return toast('Crea un PIN de 4 a 12 dígitos', 'err'); } else { const adm = profiles.all().find(p => p.role === 'admin' && p.pin); if (adm && await sha(adm.id + ':' + code) !== adm.pin) return toast('PIN de administrador incorrecto', 'err'); } }
    else if (!['invitado', 'visitante'].includes(role)) { const ok = await roleCodes.check(role, code); if (ok === false) return toast('Código de rol incorrecto', 'err'); }
    const p = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, alias, role, avatar: draft.avatar, logos: draft.logos, created: Date.now(), issued: Date.now() };
    if (role === 'admin' && first) p.pin = await sha(p.id + ':' + code);
    profiles.upsert(p); profiles.setCurrent(p.id); audit('creó carnet y entró', `${alias} · ${role}`);
    toast('¡Bienvenido, ' + alias + '!'); showHome();
  };
}

function showLogin() {
  cleanup();
  const list = profiles.all().filter(p => !p.disabled);
  const el = h(`<div class="screen onboard"><div class="hero"><img src="assets/skull.png" class="skull"><div class="title-crack">CRACK PRO</div><div class="sub">ELIGE TU CARNET</div></div>
    <div class="login-list">${list.map(p => `<button class="login-card" data-id="${p.id}" style="--c:${ROLE[p.role].color}"><div class="lc-badge">${ROLE[p.role].badge}</div><div class="lc-info"><b>${esc(p.name)}</b><small>@${esc(p.alias)} · ${ROLE[p.role].name}</small></div>${icon('back', 18, 'flip')}</button>`).join('') || '<p class="mut center">No hay carnets. Crea uno nuevo.</p>'}</div>
    <button class="btn block" id="new">${icon('plus', 16)} Crear otro carnet</button></div>`);
  app.replaceChildren(el);
  $('#new', el).onclick = () => showRegister();
  $$('[data-id]', el).forEach(b => b.onclick = async () => {
    const p = profiles.get(b.dataset.id);
    if (p.pin) { const v = await prompt('PIN de ' + p.alias, { type: 'number' }); if (v == null) return; if (await sha(p.id + ':' + v) !== p.pin) return toast('PIN incorrecto', 'err'); }
    profiles.setCurrent(p.id); audit('inició sesión', p.alias); showHome();
  });
}

// --------------------------------------------------- inicio (home)
function topbar(title, sub, back) {
  const p = profiles.current(); const r = ROLE[p.role];
  return `<div class="topbar">${back ? `<button class="iconbtn" id="back">${icon('back', 20)}</button>` : `<div class="brand"><img src="assets/skull.png"><div>CRACK PRO<br><small>${esc(r.name)}</small></div></div>`}
    <div class="sp"></div>${title ? `<div class="sub-title" style="text-align:right">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>` : ''}
    <button class="iconbtn" id="me"><span class="rolebadge" style="--c:${r.color}">${r.badge}</span></button></div>`;
}
function bindTop(el) {
  $('#me', el) && ($('#me', el).onclick = showProfile);
  $('#back', el) && ($('#back', el).onclick = () => history.length > 1 ? showHome() : showHome());
}

function showHome() {
  cleanup();
  const p = profiles.current(); const avail = CATS.filter(c => c.roles.includes(p.role) || p.role === 'admin');
  const fav = favs.list().map(getTool).filter(Boolean).filter(t => canUse(p.role, t));
  const rec = recent.list().map(getTool).filter(Boolean).filter(t => canUse(p.role, t)).slice(0, 8);
  const total = TOOLS.filter(t => canUse(p.role, t)).length;
  const el = h(`<div class="screen">${topbar('', '', false)}
    <div class="content">
      <div class="search-bar" id="searchbar"><span>${icon('search', 18)}</span><input placeholder="Buscar en ${total} opciones…" id="q" readonly></div>
      <div class="hello"><b>Hola, ${esc(p.alias)}</b><small>${ROLE[p.role].name} · ${total} opciones desbloqueadas</small></div>
      ${fav.length ? `<section class="panel"><header><span class="ptitle">Favoritos</span><i></i></header><div class="pbody"><div class="tool-grid">${fav.map(toolCard).join('')}</div></div></section>` : ''}
      ${rec.length ? `<section class="panel"><header><span class="ptitle">Recientes</span><i></i></header><div class="pbody"><div class="chips scrollx">${rec.map(t => `<button class="chip" data-tool="${t.id}">${esc(t.name)}</button>`).join('')}</div></div></section>` : ''}
      <div class="cat-grid">${avail.map(c => `<button class="cat-tile" data-cat="${c.id}"><span class="cat-ic">${icon(c.icon, 26)}</span><b>${esc(c.name)}</b><small>${TOOLS.filter(t => t.cat === c.id && canUse(p.role, t)).length} opciones</small></button>`).join('')}</div>
      <p class="mut small center" style="margin:16px 0 30px">Crack Pro · ${TOOLS.length} opciones en total · tu rol ve ${total}</p>
    </div></div>`);
  app.replaceChildren(el); bindTop(el);
  $('#searchbar', el).onclick = () => showSearch();
  $$('[data-cat]', el).forEach(b => b.onclick = () => showCat(b.dataset.cat));
  $$('[data-tool]', el).forEach(b => b.onclick = () => openTool(b.dataset.tool));
  el.addEventListener('click', e => { const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); favs.toggle(f.dataset.fav); showHome(); } });
}
function toolCard(t) { return `<button class="tool-card" data-tool="${t.id}"><b>${esc(t.name)}</b><button class="fav ${favs.has(t.id) ? 'on' : ''}" data-fav="${t.id}">${icon('star', 15)}</button></button>`; }

function showCat(catId) {
  cleanup();
  const p = profiles.current(); const c = CATS.find(x => x.id === catId);
  const tools = TOOLS.filter(t => t.cat === catId && canUse(p.role, t));
  const groups = {}; tools.forEach(t => (groups[t.group] = groups[t.group] || []).push(t));
  const el = h(`<div class="screen">${topbar(c.name, c.desc, true)}
    <div class="content">
      <div class="search-bar sm"><span>${icon('search', 16)}</span><input placeholder="Filtrar ${tools.length} opciones…" id="q"></div>
      <div id="groups">${Object.entries(groups).map(([g, l]) => `<section class="panel grp"><header><span class="ptitle">${esc(g)}</span><i></i><span class="act">${l.length}</span></header><div class="pbody"><div class="tool-list">${l.map(toolRow).join('')}</div></div></section>`).join('')}</div>
    </div></div>`);
  app.replaceChildren(el); bindTop(el);
  const bind = () => { $$('[data-tool]', el).forEach(b => b.onclick = (e) => { if (e.target.closest('[data-fav]')) return; openTool(b.dataset.tool); }); el.querySelectorAll('[data-fav]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.classList.toggle('on', favs.toggle(b.dataset.fav)); }); };
  bind();
  $('#q', el).oninput = (e) => { const q = e.target.value.toLowerCase().trim();
    $('#groups', el).innerHTML = Object.entries(groups).map(([g, l]) => { const f = l.filter(t => !q || (t.name + t.group + t.kw + t.desc).toLowerCase().includes(q)); return f.length ? `<section class="panel grp"><header><span class="ptitle">${esc(g)}</span><i></i><span class="act">${f.length}</span></header><div class="pbody"><div class="tool-list">${f.map(toolRow).join('')}</div></div></section>` : ''; }).join('') || '<p class="mut center">Sin resultados</p>'; bind(); };
}
function toolRow(t) { return `<div class="tool-row" data-tool="${t.id}"><span class="tr-name">${esc(t.name)}</span><button class="fav ${favs.has(t.id) ? 'on' : ''}" data-fav="${t.id}">${icon('star', 15)}</button><span class="tr-go">${icon('back', 16, 'flip')}</span></div>`; }

function showSearch() {
  cleanup();
  const p = profiles.current(); const pool = TOOLS.filter(t => canUse(p.role, t));
  const el = h(`<div class="screen">${topbar('Buscar', '', true)}
    <div class="content"><div class="search-bar"><span>${icon('search', 18)}</span><input placeholder="Escribe lo que buscas…" id="q" autofocus></div><div id="res"><p class="mut center" style="margin-top:20px">Busca entre ${pool.length} opciones por nombre o tema.</p></div></div></div>`);
  app.replaceChildren(el); bindTop(el);
  const res = $('#res', el); const q = $('#q', el);
  setTimeout(() => q.focus(), 100);
  q.oninput = () => { const s = q.value.toLowerCase().trim(); if (!s) { res.innerHTML = ''; return; }
    const hits = pool.map(t => { const txt = (t.name + ' ' + t.group + ' ' + CATS.find(c => c.id === t.cat).name + ' ' + t.kw + ' ' + t.desc).toLowerCase(); let score = 0; if (t.name.toLowerCase().startsWith(s)) score = 3; else if (t.name.toLowerCase().includes(s)) score = 2; else if (txt.includes(s)) score = 1; return [t, score]; }).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 60).map(x => x[0]);
    res.innerHTML = hits.length ? `<div class="tool-list">${hits.map(t => `<div class="tool-row" data-tool="${t.id}"><span class="tr-name">${esc(t.name)}<small class="mut"> · ${esc(CATS.find(c => c.id === t.cat).name)}</small></span><span class="tr-go">${icon('back', 16, 'flip')}</span></div>`).join('')}</div>` : '<p class="mut center" style="margin-top:20px">Sin resultados</p>';
    $$('[data-tool]', res).forEach(b => b.onclick = () => openTool(b.dataset.tool)); };
}

function openTool(id) {
  const t = getTool(id); const p = profiles.current(); if (!t || !canUse(p.role, t)) return toast('Tu rol no tiene esta opción', 'err');
  cleanup(); recent.push(id);
  const el = h(`<div class="screen">${topbar(t.name, CATS.find(c => c.id === t.cat).name, true)}
    <div class="content"><div class="tool-head"><h2>${esc(t.name)}</h2><button class="fav big ${favs.has(id) ? 'on' : ''}" id="fav">${icon('star', 20)}</button></div><div id="run"></div></div></div>`);
  app.replaceChildren(el); bindTop(el);
  $('#back', el).onclick = () => showCat(t.cat);
  $('#fav', el).onclick = (e) => e.currentTarget.classList.toggle('on', favs.toggle(id));
  state.cleanup = runnerView(t, $('#run', el), ctx);
}

// --------------------------------------------------- perfil / carnet
function showProfile() {
  cleanup();
  const p = profiles.current(); const r = ROLE[p.role];
  const el = h(`<div class="screen">${topbar('Mi perfil', '', true)}
    <div class="content">
      <div class="idcard-wrap"><div class="idcard" id="card"><canvas id="cf"></canvas><canvas class="back" id="cb"></canvas></div></div>
      <div class="grid3" style="margin:12px 0"><button class="btn sm" id="flip">${icon('refresh', 14)} Voltear</button><button class="btn sm" id="dl">${icon('download', 14)} Guardar</button><button class="btn sm" id="edit">${icon('user', 14)} Editar</button></div>
      <section class="panel"><header><span class="ptitle">Carnet</span><i></i></header><div class="pbody">
        <div class="kv2"><span>Nombre</span><b>${esc(p.name)}</b></div><div class="kv2"><span>Alias</span><b>@${esc(p.alias)}</b></div>
        <div class="kv2"><span>Rol</span><b style="color:${r.color}">${r.name} · nivel ${r.level}</b></div>
        <div class="kv2"><span>Opciones</span><b>${TOOLS.filter(t => canUse(p.role, t)).length} desbloqueadas</b></div></div></section>
      <button class="btn block" id="switch">${icon('users', 16)} Cambiar de carnet</button>
      <button class="btn block ghost" id="out" style="margin-top:8px">${icon('logout', 16)} Cerrar sesión</button>
      <p class="mut small center" style="margin:16px 0 30px">${r.desc}</p>
    </div></div>`);
  app.replaceChildren(el); bindTop(el);
  drawCard($('#cf', el), $('#cb', el), p);
  const card = $('#card', el); const flip = () => card.classList.toggle('flip'); $('#flip', el).onclick = flip; card.onclick = flip;
  $('#dl', el).onclick = async () => { const bl = c => new Promise(r2 => c.toBlob(r2, 'image/png')); const r1 = await native.saveFile(await bl($('#cf', el)), `carnet-${p.alias}.png`, 'image/png'); await native.saveFile(await bl($('#cb', el)), `carnet-${p.alias}-reverso.png`, 'image/png'); toast('Carnet guardado en ' + (r1?.path || 'Imágenes')); };
  $('#edit', el).onclick = () => editProfile();
  $('#switch', el).onclick = () => { profiles.setCurrent(null); showLogin(); };
  $('#out', el).onclick = async () => { if (await confirm('Cerrar sesión', '¿Salir de este carnet?')) { audit('cerró sesión', p.alias); profiles.setCurrent(null); route(); } };
}

function editProfile() {
  cleanup();
  const p = profiles.current(); const draft = { avatar: { ...p.avatar }, logos: [...(p.logos || [])] };
  const el = h(`<div class="screen">${topbar('Editar carnet', '', true)}
    <div class="content">
      <section class="panel"><header><span class="ptitle">Datos</span><i></i></header><div class="pbody col">
        <label class="fld-lab">Nombre</label><input class="input" id="name" value="${esc(p.name)}" maxlength="24">
        <label class="fld-lab">Alias</label><input class="input" id="alias" value="${esc(p.alias)}" maxlength="18"></div></section>
      <section class="panel"><header><span class="ptitle">Personaje</span><i></i></header><div class="pbody"><div id="editor"></div></div></section>
      <button class="btn primary block" id="save" style="margin:12px 0 30px">${icon('check', 16)} Guardar cambios</button></div></div>`);
  app.replaceChildren(el); bindTop(el); $('#back', el).onclick = showProfile;
  avatarEditor($('#editor', el), draft.avatar, draft.logos, (a, l) => { draft.avatar = a; draft.logos = l; });
  $('#save', el).onclick = () => { p.name = $('#name', el).value.trim() || p.name; p.alias = $('#alias', el).value.trim() || p.alias; p.avatar = draft.avatar; p.logos = draft.logos; profiles.upsert(p); audit('editó su carnet'); toast('Carnet actualizado'); showProfile(); };
}

function cleanup() { if (state.cleanup) { try { state.cleanup(); } catch {} state.cleanup = null; } }

addEventListener('resize', () => { if ($('#bgfx')) bgfx(); });
bgfx(); boot();
