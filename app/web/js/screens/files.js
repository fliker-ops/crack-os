// Archivos de la PC: navegar, descargar al telefono y enviar archivos a la PC
import { get, post, api } from '../api.js';
import { icon, $, $$, esc, toast, bytes, busy } from '../ui.js';
import { native } from '../native.js';

const EXT = { image: /\.(png|jpe?g|gif|webp|svg)$/i, video: /\.(mp4|mkv|webm|avi)$/i, audio: /\.(mp3|ogg|flac|wav)$/i, code: /\.(py|js|sh|c|cpp|rs|go|html|css|json|conf)$/i, zip: /\.(zip|tar|gz|xz|7z|rar|deb|iso)$/i };
const kind = n => Object.keys(EXT).find(k => EXT[k].test(n)) || 'file';

export default {
  async mount(el, params) {
    let cur = params.path || null, home = null;
    const load = async (path) => {
      el.innerHTML = '<div class="empty"><span class="spin"></span></div>';
      let r;
      try { r = await get('/api/files' + (path ? '?' + new URLSearchParams({ path }) : '')); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      cur = r.path; home = r.home;
      const rel = cur.startsWith(home) ? '~' + cur.slice(home.length) : cur;
      const quick = ['Descargas', 'Documentos', 'Imágenes', 'Escritorio', 'Música', 'Vídeos'];
      el.innerHTML = `<div class="row" style="margin:6px 0"><button class="iconbtn" id="up" ${cur === home ? 'disabled' : ''}>${icon('back', 18)}</button>
          <div class="sp small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="mut">ruta</span><br><b>${esc(rel)}</b></div>
          <button class="btn sm primary" id="send">${icon('upload', 14)} Enviar aquí</button></div>
        <div class="chips" style="flex-wrap:nowrap;overflow-x:auto;padding-bottom:8px"><button class="chip" data-q="">${icon('home', 12)} Inicio</button>${quick.map(q => `<button class="chip" style="flex:none" data-q="${q}">${q}</button>`).join('')}</div>
        <input type="file" id="file" multiple hidden>
        <div>${r.items.length ? r.items.map((it, i) => `<div class="item" data-i="${i}"><div class="ico">${icon(it.dir ? 'folder' : { image: 'image', video: 'play', audio: 'vol', code: 'term', zip: 'disk' }[kind(it.name)] || 'clip', 20)}</div>
          <div class="meta"><b>${esc(it.name)}</b><small>${it.dir ? 'carpeta' : bytes(it.size)} · ${new Date(it.mtime * 1000).toLocaleDateString('es')}</small></div>${it.dir ? icon('back', 16, '" style="transform:rotate(180deg)') : icon('download', 16, 'red')}</div>`).join('') : '<div class="empty">Carpeta vacía</div>'}</div>`;
      $('#up', el).onclick = () => load(cur.replace(/\/[^/]+\/?$/, '') || '/');
      $$('[data-q]', el).forEach(c => c.onclick = () => load(c.dataset.q ? home + '/' + c.dataset.q : home));
      $$('.item', el).forEach(d => d.onclick = async () => {
        const it = r.items[+d.dataset.i], p = cur + '/' + it.name;
        if (it.dir) return load(p);
        native.vibrate(); d.style.borderColor = '#ff2832';
        try { const blob = await api('/api/files/download?' + new URLSearchParams({ path: p }), { raw: true, timeout: 120000 }); const s = await native.saveFile(blob, it.name); toast('Guardado en ' + (s?.path || 'Descargas')); }
        catch (e) { toast(e.message, 'err'); }
        d.style.borderColor = '';
      });
      $('#send', el).onclick = () => $('#file', el).click();
      $('#file', el).onchange = async (e) => {
        const b = $('#send', el); busy(b, true);
        for (const f of e.target.files) {
          try { await post('/api/files/upload?' + new URLSearchParams({ name: f.name, dir: cur }), f, { timeout: 300000 }); toast(`${f.name} enviado a la PC`); }
          catch (err) { toast(err.message, 'err'); }
        }
        busy(b, false); load(cur);
      };
    };
    await load(cur);
  },
};
