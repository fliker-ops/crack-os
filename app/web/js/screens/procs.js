// Procesos de la PC: ver que consume y cerrar programas trabados
import { get, post, conn } from '../api.js';
import { icon, $, $$, esc, toast, confirm, bytes } from '../ui.js';

export default {
  async mount(el) {
    let sort = 'cpu', mine = false, q = '';
    el.innerHTML = `<div class="row" style="margin:6px 0"><div class="pwbox" style="flex:1;border-width:1px;border-radius:14px">${icon('search', 18)}<input id="q" placeholder="Filtrar procesos…" style="height:42px"></div></div>
      <div class="chips" style="margin-bottom:8px"><button class="chip on" data-s="cpu">CPU</button><button class="chip" data-s="mem">Memoria</button><button class="chip" id="mine">Solo míos</button></div><div id="list"><div class="empty"><span class="spin"></span></div></div>`;
    let procs = [];
    const render = () => {
      const l = procs.filter(p => (!mine || p.user === conn.user) && (!q || p.name.toLowerCase().includes(q))).sort((a, b) => b[sort] - a[sort]).slice(0, 50);
      $('#list', el).innerHTML = l.map(p => `<div class="item"><div style="width:44px;text-align:center"><b class="${p.cpu > 20 ? 'red' : ''}">${p.cpu.toFixed(0)}%</b><div class="small mut">CPU</div></div>
        <div class="meta"><b>${esc(p.name)}</b><small>PID ${p.pid} · ${esc(p.user)} · ${bytes(p.rss)} (${p.mem}%)</small><div class="usebar"><i style="width:${Math.min(100, p.cpu)}%"></i></div></div>
        <button class="iconbtn" data-k="${p.pid}" data-n="${esc(p.name)}">${icon('x', 16)}</button></div>`).join('') || '<div class="empty">Nada que mostrar</div>';
      $$('[data-k]', el).forEach(b => b.onclick = async () => {
        if (!await confirm(`Cerrar ${b.dataset.n}`, `Se enviará la señal para terminar el proceso ${b.dataset.k}. Si no responde puedes forzarlo después.`, { danger: true, ok: 'Cerrar' })) return;
        try { await post('/api/processes/kill', { pid: +b.dataset.k }); toast(`${b.dataset.n} cerrado`); setTimeout(load, 600); } catch (e) { toast(e.message, 'err'); }
      });
    };
    const load = async () => { try { procs = (await get('/api/processes')).procs; render(); } catch (e) { $('#list', el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; } };
    $$('[data-s]', el).forEach(c => c.onclick = () => { sort = c.dataset.s; $$('[data-s]', el).forEach(x => x.classList.toggle('on', x === c)); render(); });
    $('#mine', el).onclick = () => { mine = !mine; $('#mine', el).classList.toggle('on', mine); render(); };
    $('#q', el).oninput = e => { q = e.target.value.toLowerCase(); render(); };
    await load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  },
};
