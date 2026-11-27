// Graficas reales: rendimiento de la PC y consumo de tokens de Claude
import { get, post, ws } from '../api.js';
import { icon, $, $$, esc, toast, panel, num, bytes, prompt, modal } from '../ui.js';
import { lineChart, barChart, donut } from '../charts.js';

export default {
  async mount(el) {
    el.innerHTML = `
      <div class="chips" style="margin:6px 0 4px"><button class="chip on" data-t="tok">${icon('zap', 14)} Tokens de Claude</button><button class="chip" data-t="pc">${icon('cpu', 14)} Rendimiento PC</button></div>
      <div id="tok"></div><div id="pc" style="display:none"></div>`;
    let sock;
    $$('[data-t]', el).forEach(c => c.onclick = () => {
      $$('[data-t]', el).forEach(x => x.classList.toggle('on', x === c));
      $('#tok', el).style.display = c.dataset.t === 'tok' ? '' : 'none';
      $('#pc', el).style.display = c.dataset.t === 'pc' ? '' : 'none';
      if (c.dataset.t === 'pc' && !sock) startPc();
      if (c.dataset.t === 'tok') loadTok();
    });

    // ------------------------------------------------ tokens
    const loadTok = async () => {
      const box = $('#tok', el);
      let t;
      try { t = await get('/api/tokens'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const last7 = t.days.slice(-14);
      const today = t.days.find(d => d.day === new Date().toISOString().slice(0, 10)) || { in: 0, out: 0, cache: 0 };
      const lim5 = t.limit5h, limM = t.limitMonth;
      const rem5 = lim5 ? Math.max(0, lim5 - t.window5h) : null, remM = limM ? Math.max(0, limM - t.month) : null;
      box.innerHTML = (t.found ? '' : `<div class="panel"><div class="pbody small">${icon('info', 16, 'red')} No encontré registros de Claude Code en la PC para tu usuario (~/.claude/projects). Cuando uses Claude Code en la PC, aquí verás tu consumo real.</div></div>`)
        + panel('Ventana actual de 5 horas', `<div class="row" style="gap:14px">
            <canvas id="d5" style="width:130px;flex:none"></canvas>
            <div class="sp"><div class="small mut">USADOS (últimas 5 h)</div><div class="big glow">${num(t.window5h)}</div>
              <div class="small mut" style="margin-top:6px">${lim5 ? `QUEDAN <b class="red">${num(rem5)}</b> de ${num(lim5)}` : 'Configura tu límite para ver cuántos te quedan'}</div>
              <button class="btn sm" id="lim" style="margin-top:10px">${icon('gear', 14)} Límites</button></div></div>`)
        + panel('Últimas 24 horas', '<canvas class="chart" id="h24"></canvas>')
        + panel('Por día (entrada / salida / caché)', `<canvas class="chart" id="days"></canvas>
            <div class="row small mut" style="justify-content:space-between;margin-top:6px"><span><b class="red">■</b> entrada</span><span><b style="color:#fff">■</b> salida</span><span><b style="color:#5a0810">■</b> caché</span></div>`)
        + panel('Resumen', `<div class="kv"><span>Hoy</span><span>${num(today.in + today.out)} (+${num(today.cache)} caché)</span></div>
            <div class="kv"><span>Últimos 30 días</span><span>${num(t.month)}</span></div>
            ${limM ? `<div class="kv"><span>Te quedan este mes</span><span class="red">${num(remM)}</span></div>` : ''}
            ${Object.entries(t.models).map(([m, v]) => `<div class="kv"><span>${esc(m)}</span><span>${num(v)}</span></div>`).join('')}
            <p class="small mut">Fuente: ${esc(t.source)} · se calcula en la PC con los registros reales de cada respuesta.</p>`);
      donut($('#d5', box), lim5 ? [{ v: t.window5h, color: '#ff2832' }, { v: rem5, color: '#2a0508' }] : [{ v: t.window5h || 1, color: '#ff2832' }],
        { size: 130, center: lim5 ? Math.round(100 * t.window5h / lim5) + '%' : num(t.window5h), sub: lim5 ? 'del límite' : 'tokens' });
      lineChart($('#h24', box), [{ data: t.hours, color: '#ff2832' }], { height: 120, fmt: num, labels: t.hours.map((_, i) => (i - 23) + 'h') });
      barChart($('#days', box), last7.map(d => [d.in, d.out, d.cache]), { height: 170, colors: ['#ff2832', '#ffffff', '#5a0810'], labels: last7.map(d => d.day.slice(8)), fmt: num });
      $('#lim', box).onclick = async () => {
        const r = await modal({ title: 'Límites de tokens', body: `<p class="small">Pon los límites de tu plan de Claude para calcular cuántos tokens te quedan.</p>
          <label class="small mut">Límite por ventana de 5 horas</label><input class="input" id="l5" inputmode="numeric" value="${lim5 || ''}" placeholder="ej. 2000000" style="margin:6px 0 12px">
          <label class="small mut">Límite mensual</label><input class="input" id="lm" inputmode="numeric" value="${limM || ''}" placeholder="ej. 50000000" style="margin-top:6px">`,
          actions: [{ label: 'Cancelar', value: null }, { label: 'Guardar', kind: 'primary', handler: m => ({ limit5h: +m.querySelector('#l5').value || null, limitMonth: +m.querySelector('#lm').value || null }) }] });
        if (r) { await post('/api/tokens/limits', r).catch(e => toast(e.message, 'err')); loadTok(); }
      };
    };

    // ------------------------------------------------ PC
    const startPc = async () => {
      const box = $('#pc', el);
      box.innerHTML = panel('CPU por núcleo', '<div id="cores"></div>') + panel('CPU y RAM (15 min)', '<canvas class="chart" id="c1"></canvas>')
        + panel('Red', '<canvas class="chart" id="c2"></canvas><div class="row small mut" style="justify-content:space-between"><span id="rx"></span><span id="tx"></span></div>')
        + panel('Disco (lectura / escritura)', '<canvas class="chart" id="c3"></canvas>') + panel('Temperatura', '<canvas class="chart" id="c4"></canvas>');
      const H = { cpu: [], mem: [], rx: [], tx: [], dr: [], dw: [], temp: [] };
      const push = s => { Object.keys(H).forEach(k => { H[k].push(s[k] ?? null); if (H[k].length > 900) H[k].shift(); }); };
      try { (await get('/api/stats?n=900')).hist.forEach(push); } catch {}
      let last = null;
      const draw = () => {
        lineChart($('#c1', box), [{ data: H.cpu, color: '#ff2832' }, { data: H.mem, color: '#ffffff', fill: false }], { height: 130, max: 100 });
        lineChart($('#c2', box), [{ data: H.rx.slice(-180), color: '#ff2832' }, { data: H.tx.slice(-180), color: '#ffffff', fill: false }], { height: 120, fmt: v => bytes(v, 0) });
        lineChart($('#c3', box), [{ data: H.dr.slice(-180), color: '#ff2832' }, { data: H.dw.slice(-180), color: '#ff9a3c', fill: false }], { height: 110, fmt: v => bytes(v, 0) });
        const temps = H.temp.filter(v => v != null);
        if (temps.length) lineChart($('#c4', box), [{ data: temps.slice(-300), color: '#ff2832' }], { height: 100, min: Math.max(0, Math.min(...temps) - 10), max: Math.max(...temps) + 10, fmt: v => v.toFixed(0) + '°' });
        else if ($('#c4', box)) $('#c4', box).outerHTML = '<p class="small mut">Esta PC no reporta sensores de temperatura.</p>';
        if (last) {
          $('#rx', box).textContent = '↓ ' + bytes(last.rx) + '/s'; $('#tx', box).textContent = '↑ ' + bytes(last.tx) + '/s';
          $('#cores', box).innerHTML = `<div class="grid4">${last.cores.map((c, i) => `<div><div class="small mut">núcleo ${i}</div><div class="usebar"><i style="width:${c}%"></i></div><b class="small">${c.toFixed(0)}%</b></div>`).join('')}</div>`;
        }
      };
      sock = ws('/ws/stats');
      sock.onmessage = e => { const s = JSON.parse(e.data); if (s.cpu == null) return; last = s; push(s); draw(); };
      draw();
    };
    await loadTok();
    return () => sock?.close();
  },
};
