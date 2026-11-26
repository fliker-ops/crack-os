// Lanzador: abre en la PC cualquier aplicacion instalada
import { get, post, url } from '../api.js';
import { icon, $, $$, esc, toast, prompt } from '../ui.js';
import { native } from '../native.js';

const CATS = [['all', 'Todas'], ['fav', '★ Favoritas'], ['Network', 'Internet'], ['Development', 'Desarrollo'], ['AudioVideo', 'Multimedia'],
  ['Graphics', 'Gráficos'], ['Office', 'Oficina'], ['System', 'Sistema'], ['Utility', 'Utilidades'], ['Settings', 'Ajustes'], ['Game', 'Juegos']];
const FALLBACK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ff2832" stroke-width="1.7"><path d="M5 5h3v3H5zM10.5 5h3v3h-3zM16 5h3v3h-3zM5 10.5h3v3H5zM10.5 10.5h3v3h-3zM16 10.5h3v3h-3zM5 16h3v3H5zM10.5 16h3v3h-3zM16 16h3v3h-3z"/></svg>');

export default {
  async mount(el) {
    el.innerHTML = `<div class="row" style="margin:6px 0 10px"><div class="pwbox" style="flex:1;border-width:1px;border-radius:14px">${icon('search', 18)}<input id="q" placeholder="Buscar aplicación…" style="height:44px"></div>
      <button class="iconbtn" id="cmd" title="Ejecutar comando">${icon('term', 18)}</button></div>
      <div class="chips" id="cats" style="flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px">${CATS.map(([k, l], i) => `<button class="chip ${i ? '' : 'on'}" data-c="${k}" style="flex:none">${l}</button>`).join('')}</div>
      <div id="list" style="margin-top:8px"><div class="empty"><span class="spin"></span></div></div>`;
    const { apps } = await get('/api/apps');
    const favs = new Set(JSON.parse(localStorage.getItem('crk.favapps') || '[]'));
    let cat = 'all';
    const render = () => {
      const q = $('#q', el).value.toLowerCase();
      const list = apps.filter(a => (cat === 'all' || (cat === 'fav' ? favs.has(a.id) : a.cats.includes(cat))) &&
        (!q || a.name.toLowerCase().includes(q) || a.comment.toLowerCase().includes(q)));
      $('#list', el).innerHTML = list.length ? `<p class="small mut">${list.length} aplicaciones · toca para abrir en la PC, mantén para favorita</p>` +
        list.map(a => `<div class="item" data-id="${esc(a.id)}"><div class="ico"><img loading="lazy" src="${url('/api/icon', { name: a.icon })}" onerror="this.onerror=null;this.src='${FALLBACK}'"></div>
          <div class="meta"><b>${favs.has(a.id) ? '★ ' : ''}${esc(a.name)}</b><small>${esc(a.comment || a.cats.slice(0, 2).join(' · '))}</small></div>${icon('play', 16, 'red')}</div>`).join('')
        : '<div class="empty">No hay aplicaciones que coincidan.</div>';
      $$('.item', el).forEach(it => {
        let t;
        it.addEventListener('pointerdown', () => { t = setTimeout(() => { t = null; const id = it.dataset.id; favs.has(id) ? favs.delete(id) : favs.add(id);
          localStorage.setItem('crk.favapps', JSON.stringify([...favs])); native.vibrate(30); render(); }, 600); });
        it.addEventListener('pointerup', async () => {
          if (!t) return; clearTimeout(t);
          const a = apps.find(x => x.id === it.dataset.id);
          it.style.borderColor = '#ff2832'; native.vibrate(15);
          try { await post('/api/apps/launch', { id: a.id }); toast(`${a.name} abierta en la PC`); } catch (e) { toast(e.message, 'err'); }
          setTimeout(() => it.style.borderColor = '', 600);
        });
        it.addEventListener('pointerleave', () => clearTimeout(t));
      });
    };
    $('#q', el).oninput = render;
    $$('#cats .chip', el).forEach(c => c.onclick = () => { cat = c.dataset.c; $$('#cats .chip', el).forEach(x => x.classList.toggle('on', x === c)); render(); });
    $('#cmd', el).onclick = async () => {
      const cmd = await prompt('Ejecutar en la PC', { placeholder: 'ej. firefox-esr https://github.com', ok: 'Ejecutar' });
      if (cmd) post('/api/apps/launch', { cmd }).then(() => toast('Comando enviado')).catch(e => toast(e.message, 'err'));
    };
    render();
  },
};
