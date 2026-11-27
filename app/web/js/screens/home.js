import { get, post, ws, publicUrl, conn } from '../api.js';
import { icon, h, $, $$, esc, panel, ring, updateRing, bytes, duration, toast, confirm } from '../ui.js';
import { lineChart } from '../charts.js';
import { native } from '../native.js';
import { state } from '../main.js';

export default {
  async mount(el, params, nav) {
    const sys = state.sys || await get('/api/system');
    el.innerHTML = `
      <div class="hello"><img src="${publicUrl('/api/avatar', { user: conn.user, v: Date.now() })}">
        <div class="sp"><div class="where">BIENVENIDO DE VUELTA</div><div class="who">${esc(conn.user)}</div>
        <div class="where">${esc(sys.host)} · ${esc(sys.os)} · encendida ${duration(sys.uptime)}</div></div></div>
      ${panel('Estado en vivo', `<div class="gauges">
        <div id="g-cpu">${ring(0, '0%', 'CPU', 78)}</div><div id="g-mem">${ring(0, '0%', 'RAM', 78)}</div>
        <div id="g-tmp">${ring(0, '—', 'TEMP', 78)}</div><div id="g-dsk">${ring(100 * sys.root_used / sys.root_total, Math.round(100 * sys.root_used / sys.root_total) + '%', 'DISCO', 78)}</div></div>
        <canvas class="chart" id="c-cpu"></canvas>
        <div class="row small mut" style="justify-content:space-between;margin-top:4px"><span><b class="red">━</b> CPU %</span><span><b style="color:#fff">━</b> RAM %</span><span id="netnow"></span></div>`)}
      ${panel('Accesos rápidos', `<div class="grid4">
        <button class="qa" data-a="lock">${icon('lock')}Bloquear</button>
        <button class="qa" data-a="shot">${icon('camera')}Captura</button>
        <button class="qa" data-a="term">${icon('term')}Terminal</button>
        <button class="qa" data-a="apps">${icon('apps')}Apps</button>
        <button class="qa" data-a="wall">${icon('image')}Fondo</button>
        <button class="qa" data-a="tasks">${icon('check')}Tareas</button>
        <button class="qa" data-a="market">${icon('market')}Mercado</button>
        <button class="qa" data-a="power">${icon('power')}Energía</button></div>`)}
      ${panel('Sonido y brillo', `
        <div class="ctl"><label><span>${icon('vol', 14)} Volumen</span><span id="volv">—</span></label><input type="range" id="vol" min="0" max="150"></div>
        <div class="ctl"><label><span>${icon('sun', 14)} Brillo</span><span id="brv">—</span></label><input type="range" id="br" min="1" max="100"></div>
        <div class="row" id="media" style="margin-top:6px"><div class="sp small"><b id="mt">Sin reproducción</b><div class="mut" id="ma"></div></div>
          <button class="iconbtn" data-m="previous">${icon('prev', 18)}</button><button class="iconbtn" data-m="play-pause">${icon('play', 18)}</button><button class="iconbtn" data-m="next">${icon('next', 18)}</button></div>`)}
      ${panel('Pendientes', '<div id="tprev" class="small mut">Cargando…</div>', '')}
      ${panel('Equipo', `
        <div class="kv"><span>Procesador</span><span>${esc(sys.cpu)} · ${sys.cores} núcleos</span></div>
        <div class="kv"><span>Memoria</span><span>${bytes(sys.mem_total)}</span></div>
        ${sys.gpu ? `<div class="kv"><span>Gráficos</span><span>${esc(sys.gpu)}</span></div>` : ''}
        <div class="kv"><span>Kernel</span><span>${esc(sys.kernel)}</span></div>
        <div class="kv"><span>IP</span><span>${esc(sys.ips.join(', ') || conn.host)}</span></div>
        <div class="kv"><span>Sesión</span><span>${esc(sys.session || 'sin escritorio abierto')}</span></div>
        ${sys.battery ? `<div class="kv"><span>Batería</span><span>${sys.battery.percent}% · ${esc(sys.battery.status)}</span></div>` : ''}`)}`;

    const hist = { cpu: [], mem: [] };
    try {
      const s = await get('/api/stats?n=90');
      s.hist.forEach(x => { hist.cpu.push(x.cpu); hist.mem.push(x.mem); });
    } catch {}
    const draw = (s) => {
      if (!s || s.cpu == null) return;
      updateRing($('#g-cpu .ring', el), s.cpu, Math.round(s.cpu) + '%');
      updateRing($('#g-mem .ring', el), s.mem, Math.round(s.mem) + '%');
      if (s.temp != null) updateRing($('#g-tmp .ring', el), s.temp, Math.round(s.temp) + '°');
      $('#netnow', el).textContent = `↓${bytes(s.rx)}/s ↑${bytes(s.tx)}/s`;
      lineChart($('#c-cpu', el), [{ data: hist.cpu.slice(-90), color: '#ff2832' }, { data: hist.mem.slice(-90), color: '#ffffff', fill: false }],
        { height: 110, max: 100, fmt: v => v.toFixed(0) });
    };
    draw(hist.cpu.length ? { cpu: hist.cpu.at(-1), mem: hist.mem.at(-1) } : null);
    const sock = ws('/ws/stats');
    sock.onmessage = (e) => {
      const s = JSON.parse(e.data);
      if (s.cpu == null) return;
      hist.cpu.push(s.cpu); hist.mem.push(s.mem);
      if (hist.cpu.length > 200) { hist.cpu.shift(); hist.mem.shift(); }
      draw(s);
    };

    $$('.qa', el).forEach(b => b.onclick = async () => {
      native.vibrate();
      const a = b.dataset.a;
      if (a === 'lock') { await post('/api/power', { action: 'lock' }).then(() => toast('PC bloqueada')).catch(e => toast(e.message, 'err')); }
      else if (a === 'shot') nav.open('screen');
      else if (a === 'term') document.querySelector('[data-tab=terminal]').click();
      else if (a === 'apps') nav.open('apps');
      else if (a === 'wall') nav.open('wallpapers');
      else if (a === 'tasks') nav.open('tasks');
      else if (a === 'market') nav.open('market');
      else if (a === 'power') nav.open('power');
    });

    // volumen y brillo
    const vol = $('#vol', el), br = $('#br', el);
    get('/api/volume').then(v => {
      if (v.volume != null) { vol.value = v.volume; $('#volv', el).textContent = v.volume + '%' + (v.muted ? ' (silencio)' : ''); } else { vol.disabled = true; $('#volv', el).textContent = 'sin audio'; }
      if (v.brightness != null) { br.value = v.brightness; $('#brv', el).textContent = v.brightness + '%'; } else { br.disabled = true; $('#brv', el).textContent = 'no disponible'; }
    }).catch(() => {});
    let vt;
    vol.oninput = () => { $('#volv', el).textContent = vol.value + '%'; clearTimeout(vt); vt = setTimeout(() => post('/api/volume', { volume: +vol.value }).catch(e => toast(e.message, 'err')), 120); };
    br.oninput = () => { $('#brv', el).textContent = br.value + '%'; clearTimeout(vt); vt = setTimeout(() => post('/api/volume', { brightness: +br.value }).catch(e => toast(e.message, 'err')), 120); };
    const showMedia = (m) => {
      $('#mt', el).textContent = m.player ? (m.title || m.player) : 'Sin reproducción';
      $('#ma', el).textContent = m.player ? `${m.artist || ''} · ${m.status}` : 'abre música o un video en la PC';
    };
    get('/api/media').then(showMedia).catch(() => {});
    $$('[data-m]', el).forEach(b => b.onclick = () => post('/api/media', { action: b.dataset.m }).then(showMedia).catch(e => toast(e.message, 'err')));

    get('/api/tasks').then(t => {
      const open = t.tasks.filter(x => !x.done);
      const box = $('#tprev', el);
      box.innerHTML = open.length ? open.slice(0, 4).map(x => `<div class="kv"><span>${icon('check', 12, 'red')} ${esc(x.text)}</span><span>${x.due ? esc(x.due) : ''}</span></div>`).join('')
        + `<button class="btn sm block" style="margin-top:10px" id="tall">Ver las ${t.tasks.length} tareas</button>` : 'No tienes tareas pendientes 🎉 <button class="btn sm block" style="margin-top:10px" id="tall">Agregar tarea</button>';
      $('#tall', el).onclick = () => nav.open('tasks');
    }).catch(() => {});

    return () => sock.close();
  },
};
