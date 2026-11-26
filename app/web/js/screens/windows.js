// Ventanas abiertas y escritorios de la PC
import { get, post } from '../api.js';
import { icon, $$, esc, toast, panel } from '../ui.js';
import { native } from '../native.js';

export default {
  async mount(el) {
    const load = async () => {
      let w;
      try { w = await get('/api/windows'); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      el.innerHTML = panel('Escritorios', `<div class="grid3" style="grid-template-columns:repeat(6,1fr);gap:6px">${[1, 2, 3, 4, 5, 6].map(n => {
          const c = w.windows.filter(x => x.ws === n).length;
          return `<button class="qa" data-ws="${n}" style="${w.workspace === n ? 'background:#ff2832;color:#fff;box-shadow:0 0 14px #ff283288' : ''}"><b style="font-size:16px">${n}</b><small>${c}</small></button>`; }).join('')}</div>`)
        + panel(`Ventanas abiertas (${w.windows.length})`, w.windows.length ? w.windows.map(x => `<div class="item">
          <div class="ico">${icon('windows', 20)}</div><div class="meta"><b>${esc(x.title || x.app)}</b><small>${esc(x.app)} · escritorio ${x.ws}${x.focused ? ' · activa' : ''}</small></div>
          <button class="iconbtn" data-f="${esc(x.id)}" title="Mostrar">${icon('eye', 16)}</button>
          <button class="iconbtn" data-fs="${esc(x.id)}" title="Pantalla completa">${icon('zap', 16)}</button>
          <button class="iconbtn" data-c="${esc(x.id)}" title="Cerrar">${icon('x', 16)}</button></div>`).join('') : '<div class="empty">No hay ventanas abiertas.</div>')
        + `<p class="small mut center">Sesión: ${esc(w.kind || 'sin escritorio')} · se actualiza sola</p>`;
      const act = (action, id, ws) => post('/api/windows', { action, id, ws }).then(() => { native.vibrate(); setTimeout(load, 400); }).catch(e => toast(e.message, 'err'));
      $$('[data-ws]', el).forEach(b => b.onclick = () => act('workspace', null, +b.dataset.ws));
      $$('[data-f]', el).forEach(b => b.onclick = () => act('focus', b.dataset.f));
      $$('[data-fs]', el).forEach(b => b.onclick = () => act('fullscreen', b.dataset.fs));
      $$('[data-c]', el).forEach(b => b.onclick = () => act('close', b.dataset.c).then(() => toast('Ventana cerrada')));
    };
    await load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  },
};
