// Fondos de pantalla de la PC
import { get, post, url } from '../api.js';
import { icon, $, $$, esc, toast, panel } from '../ui.js';
import { native } from '../native.js';

export default {
  async mount(el, params, nav) {
    const load = async () => {
      const w = await get('/api/wallpapers');
      el.innerHTML = `<button class="btn primary block" id="new" style="margin:6px 0">${icon('brush', 18)} Crear / personalizar fondo</button>
        ${panel('Fondos en la PC', `<div class="thumbs">${w.items.map((it, i) => `<div class="thumb ${it.path === w.current ? 'cur' : ''}" data-i="${i}">
          <img loading="lazy" src="${url('/api/wallpaper/image', { path: it.path, w: 360 })}"><span>${esc(it.name)}${it.system ? '' : ' · tuyo'}</span></div>`).join('')}</div>
          <p class="small mut" style="margin-top:10px">Toca un fondo para ponerlo · mantén presionado para editarlo. Pantalla de la PC: ${w.screen[0]}×${w.screen[1]}</p>`)}
        <button class="btn block" id="upload">${icon('upload', 18)} Usar una foto del teléfono</button><input type="file" id="file" accept="image/*" hidden>`;
      $$('.thumb', el).forEach(t => {
        let timer;
        const it = w.items[+t.dataset.i];
        t.addEventListener('pointerdown', () => { timer = setTimeout(() => { timer = null; native.vibrate(30); nav.open('editor', { base: it.path }); }, 550); });
        t.addEventListener('pointerleave', () => clearTimeout(timer));
        t.addEventListener('pointerup', async () => {
          if (!timer) return; clearTimeout(timer);
          native.vibrate();
          try { await post('/api/wallpaper/set', { path: it.path }); toast('Fondo cambiado en la PC'); load(); } catch (e) { toast(e.message, 'err'); }
        });
      });
      $('#new', el).onclick = () => nav.open('editor', { base: w.current });
      $('#upload', el).onclick = () => $('#file', el).click();
      $('#file', el).onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const blob = await toJpeg(f);
          await post('/api/wallpaper/upload?' + new URLSearchParams({ name: 'foto-' + Date.now() }), blob);
          toast('Foto puesta como fondo'); load();
        } catch (err) { toast(err.message, 'err'); }
      };
    };
    await load();
  },
};

async function toJpeg(file) {
  const img = await createImageBitmap(file);
  const c = document.createElement('canvas');
  const s = Math.min(1, 3840 / img.width);
  c.width = img.width * s; c.height = img.height * s;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
}
