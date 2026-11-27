// Informacion del sistema y ajustes de la app
import { get, post, conn } from '../api.js';
import { icon, $, esc, toast, panel, bytes, duration, prompt, confirm } from '../ui.js';
import { native } from '../native.js';
import { logout } from '../main.js';

export default {
  async mount(el) {
    const s = await get('/api/system');
    el.innerHTML = panel('Sistema', `
        <div class="kv"><span>Equipo</span><span>${esc(s.host)}</span></div><div class="kv"><span>Sistema</span><span>${esc(s.os)}</span></div>
        <div class="kv"><span>Kernel</span><span>${esc(s.kernel)}</span></div><div class="kv"><span>Encendida</span><span>${duration(s.uptime)}</span></div>
        <div class="kv"><span>Procesador</span><span>${esc(s.cpu)}</span></div><div class="kv"><span>Núcleos</span><span>${s.cores}</span></div>
        <div class="kv"><span>Memoria</span><span>${bytes(s.mem_total)}</span></div><div class="kv"><span>Disco /</span><span>${bytes(s.root_used)} de ${bytes(s.root_total)}</span></div>
        ${s.gpu ? `<div class="kv"><span>Gráficos</span><span>${esc(s.gpu)}</span></div>` : ''}
        <div class="kv"><span>IP</span><span>${esc(s.ips.join(', ') || conn.host)}</span></div>
        <div class="kv"><span>Escritorio</span><span>${esc(s.session || 'sin sesión gráfica')}</span></div>
        <div class="kv"><span>Agente remoto</span><span>v${esc(s.agent)} · puerto ${conn.port}</span></div>`)
      + panel('Comando rápido', `<div class="row"><input class="input" id="cmd" placeholder="ej. uptime"><button class="btn primary" id="run">${icon('play', 16)}</button></div><div class="terminal-log" id="out" style="margin-top:10px;display:none"></div>`)
      + panel('Tu sesión', `<div class="kv"><span>Usuario</span><span>${esc(conn.user)} ${conn.admin ? '(administrador)' : ''}</span></div>
        <div class="kv"><span>App</span><span>Crack Remote ${esc(native.version)}</span></div><div class="kv"><span>Teléfono</span><span>${esc(native.device)}</span></div>
        <div class="grid2" style="margin-top:12px"><button class="btn" id="out-s">${icon('logout', 16)} Cambiar usuario</button><button class="btn" id="chg">${icon('wifi', 16)} Otra PC</button></div>`)
      + `<p class="small mut center" style="margin:16px 0 24px">CRACK OS · SECURE · STEALTH · SYSTEM</p>`;
    const run = async () => {
      const c = $('#cmd', el).value.trim(); if (!c) return;
      const o = $('#out', el); o.style.display = ''; o.textContent = '…';
      try { const r = await post('/api/run', { cmd: c }, { timeout: 25000 }); o.textContent = (r.out + r.err).trim() || `(sin salida, código ${r.rc})`; } catch (e) { o.textContent = e.message; }
    };
    $('#run', el).onclick = run; $('#cmd', el).onkeydown = e => { if (e.key === 'Enter') run(); };
    $('#out-s', el).onclick = () => logout();
    $('#chg', el).onclick = async () => { if (await confirm('Cambiar de PC', 'Se cerrará la sesión actual.')) { await logout(); localStorage.removeItem('crk.host'); location.reload(); } };
  },
};
