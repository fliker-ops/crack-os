// Pantalla de la PC en vivo + capturas guardadas en la PC o en el telefono
import { post, api, url } from '../api.js';
import { icon, $, toast, panel, busy } from '../ui.js';
import { native } from '../native.js';

export default {
  mount(el) {
    el.innerHTML = `${panel('Pantalla en vivo', `<div style="position:relative;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#000;aspect-ratio:16/9"><img id="img" style="width:100%;height:100%;object-fit:contain;display:block"></div>
      <div class="row small mut" style="justify-content:space-between;margin-top:8px"><span id="fps">—</span><div class="row"><span>Calidad</span><input type="range" id="q" min="20" max="90" value="55" style="width:90px"></div></div>
      <div class="grid2" style="margin-top:10px"><button class="btn" id="pause">${icon('play', 16)} Pausar</button><button class="btn" id="full">${icon('eye', 16)} Pantalla completa</button></div>`)}
      ${panel('Capturas', `<div class="grid2"><button class="btn" id="phone">${icon('download', 16)} Guardar en teléfono</button><button class="btn primary" id="pcsave">${icon('camera', 16)} Guardar en la PC</button></div>
      <p class="small mut">La captura en la PC se guarda en ~/Imágenes/Capturas.</p>`)}`;
    const img = $('#img', el);
    let on = true, t, frames = 0, t0 = performance.now();
    const loop = () => {
      if (!on) return;
      const n = new Image();
      n.onload = () => { img.src = n.src; frames++; const dt = (performance.now() - t0) / 1000; if (dt > 2) { $('#fps', el).textContent = `${(frames / dt).toFixed(1)} cuadros/s`; frames = 0; t0 = performance.now(); } t = setTimeout(loop, 120); };
      n.onerror = () => { $('#fps', el).textContent = 'sin imagen (¿hay sesión abierta en la PC?)'; t = setTimeout(loop, 2000); };
      n.src = url('/api/screen', { scale: 0.5, q: $('#q', el).value, r: Date.now() });
    };
    loop();
    $('#pause', el).onclick = () => { on = !on; $('#pause', el).innerHTML = on ? `${icon('play', 16)} Pausar` : `${icon('play', 16)} Seguir`; if (on) loop(); };
    $('#full', el).onclick = () => { native.setOrientation('landscape'); img.parentElement.requestFullscreen?.().catch(() => {}); };
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) native.setOrientation('portrait'); });
    $('#phone', el).onclick = async (e) => {
      const b = e.currentTarget; busy(b, true);
      try { const blob = await api('/api/screen?scale=1&fmt=png', { raw: true, timeout: 30000 }); const r = await native.saveFile(blob, `captura-pc-${Date.now()}.png`, 'image/png'); toast('Guardada en ' + (r?.path || 'Imágenes')); }
      catch (err) { toast(err.message, 'err'); }
      busy(b, false);
    };
    $('#pcsave', el).onclick = async (e) => {
      const b = e.currentTarget; busy(b, true);
      try { const r = await post('/api/screenshot'); toast('Guardada en la PC: ' + r.path.split('/').pop()); } catch (err) { toast(err.message, 'err'); }
      busy(b, false);
    };
    return () => { on = false; clearTimeout(t); };
  },
};
