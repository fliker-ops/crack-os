// Editor de fondos: mueve la calavera, cambia textos y colores y lo aplica en la PC
import { get, post, url } from '../api.js';
import { icon, $, $$, esc, toast, busy, panel } from '../ui.js';
import { native } from '../native.js';

const BASES = [['rain', 'Lluvia Crack OS'], ['black', 'Negro'], ['red', 'Degradado rojo'], ['grid', 'Rejilla HUD'], ['pc', 'Fondo actual de la PC']];
const COLORS = [['Rojo', 0], ['Naranja', 25], ['Verde', 120], ['Cian', 180], ['Azul', 220], ['Morado', 275], ['Rosa', 320]];
const PRESETS = { centro: { x: .5, y: .37, s: .30, tx: .5, ty: .66 }, derecha: { x: .76, y: .5, s: .36, tx: .3, ty: .52 },
  izquierda: { x: .24, y: .5, s: .36, tx: .7, ty: .52 }, esquina: { x: .86, y: .78, s: .2, tx: .5, ty: .5 }, grande: { x: .5, y: .5, s: .62, tx: .5, ty: .9 } };

const img = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('no se pudo cargar la imagen')); i.src = src; });

export default {
  async mount(el, params) {
    const wp = await get('/api/wallpapers');
    const [W, H] = wp.screen;
    const saved = JSON.parse(localStorage.getItem('crk.editor') || 'null');
    const st = saved || { base: 'rain', x: .5, y: .37, s: .30, rot: 0, hue: 0, glow: 1, op: 1, skull: true,
      title: 'CRACK OS', sub: 'secure · stealth · system', tx: .5, ty: .66, tsize: .078, tshow: true, vignette: true, scan: false, sel: 'skull' };
    if (params.base && params.base !== wp.current) st.base = 'pc';
    el.innerHTML = `
      <div class="stage" id="stage"><canvas id="cv"></canvas></div>
      <p class="small mut" style="margin:6px 2px">Arrastra con un dedo para mover · pellizca para cambiar tamaño · ${W}×${H}</p>
      <div class="layerbar"><button class="chip" data-sel="skull">${icon('skull', 14)} Calavera</button><button class="chip" data-sel="title">T Texto</button>
        <span class="sp"></span><button class="chip" id="undo">${icon('refresh', 14)} Reiniciar</button></div>
      ${panel('Posición rápida', `<div class="chips">${Object.keys(PRESETS).map(k => `<button class="chip" data-p="${k}">${k}</button>`).join('')}</div>`)}
      <div id="skullctl">${panel('Calavera', `
        <div class="row" style="justify-content:space-between"><span>Mostrar calavera</span><div class="switch" id="skull"></div></div>
        <div class="ctl"><label><span>Tamaño</span><span id="sv"></span></label><input type="range" id="s" min="5" max="90"></div>
        <div class="ctl"><label><span>Giro</span><span id="rv"></span></label><input type="range" id="rot" min="-45" max="45"></div>
        <div class="ctl"><label><span>Brillo neón</span></label><input type="range" id="glow" min="0" max="30"></div>
        <div class="ctl"><label><span>Opacidad</span></label><input type="range" id="op" min="10" max="100"></div>
        <div class="ctl"><label><span>Color del neón</span></label><div class="swatches">${COLORS.map(([n, h]) => `<button class="swatch" data-h="${h}" title="${n}" style="background:hsl(${(356 + h) % 360} 100% 55%)"></button>`).join('')}</div></div>`)}</div>
      <div id="titlectl" style="display:none">${panel('Texto', `
        <div class="row" style="justify-content:space-between"><span>Mostrar texto</span><div class="switch" id="tshow"></div></div>
        <div class="ctl"><label><span>Título</span></label><input class="input" id="title" maxlength="24"></div>
        <div class="ctl"><label><span>Subtítulo</span></label><input class="input" id="sub" maxlength="48"></div>
        <div class="ctl"><label><span>Tamaño</span></label><input type="range" id="tsize" min="2" max="16"></div>`)}</div>
      ${panel('Fondo', `<div class="chips">${BASES.map(([k, l]) => `<button class="chip" data-b="${k}">${l}</button>`).join('')}</div>
        <div class="row" style="justify-content:space-between;margin-top:12px"><span>Viñeta oscura</span><div class="switch" id="vignette"></div></div>
        <div class="row" style="justify-content:space-between;margin-top:10px"><span>Líneas de escaneo</span><div class="switch" id="scan"></div></div>
        <p class="small mut">“Lluvia Crack OS” es el fondo original sin la calavera, así puedes moverla a donde quieras.</p>`)}
      <div class="grid2" style="margin:10px 0 20px"><button class="btn" id="save">${icon('download', 18)} Guardar en teléfono</button>
        <button class="btn primary" id="apply">${icon('zap', 18)} Aplicar en la PC</button></div>`;

    const cv = $('#cv', el);
    const assets = { skull: await img('assets/skull.png'), rain: await img('assets/rain.jpg') };
    let pcImg = null;
    const loadPc = async () => { if (!pcImg) pcImg = await img(url('/api/wallpaper/image', { path: params.base || wp.current, w: W })).catch(() => null); };
    if (st.base === 'pc') await loadPc();

    const draw = (c, w, h) => {
      const g = c.getContext('2d');
      g.save(); g.clearRect(0, 0, w, h);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      if (st.base === 'rain') { const s = Math.max(w / assets.rain.width, h / assets.rain.height); g.drawImage(assets.rain, (w - assets.rain.width * s) / 2, (h - assets.rain.height * s) / 2, assets.rain.width * s, assets.rain.height * s); }
      else if (st.base === 'red') { const gr = g.createRadialGradient(w / 2, h * .45, 0, w / 2, h / 2, w * .7); gr.addColorStop(0, '#3a0610'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      else if (st.base === 'grid') { g.strokeStyle = 'rgba(255,40,50,.12)'; g.lineWidth = Math.max(1, w / 1920);
        const step = w / 48; for (let x = 0; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        for (let y = 0; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .6); gr.addColorStop(0, 'rgba(120,8,18,.35)'); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      else if (st.base === 'pc' && pcImg) g.drawImage(pcImg, 0, 0, w, h);
      if (st.skull) {
        const sk = assets.skull, sh = h * st.s, sw = sh * sk.width / sk.height;
        g.save(); g.translate(st.x * w, st.y * h); g.rotate(st.rot * Math.PI / 180);
        g.globalAlpha = st.op;
        g.filter = `hue-rotate(${st.hue}deg)` + (st.glow ? ` drop-shadow(0 0 ${st.glow * h / 1080}px hsl(${(356 + st.hue) % 360} 100% 50%))` : '');
        g.drawImage(sk, -sw / 2, -sh / 2, sw, sh);
        g.restore();
      }
      if (st.tshow && st.title) {
        const fs = h * st.tsize;
        g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `700 ${fs}px JBM`;
        const sp = fs * .32, chars = [...st.title];
        const widths = chars.map(ch => g.measureText(ch).width), tw = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
        let x = st.tx * w - tw / 2;
        g.shadowColor = `hsl(${(356 + st.hue) % 360} 100% 30%)`; g.shadowBlur = fs * .25; g.fillStyle = '#ebebeb';
        chars.forEach((ch, i) => { g.fillText(ch, x + widths[i] / 2, st.ty * h); x += widths[i] + sp; });
        if (st.sub) {
          g.shadowBlur = 0; g.font = `400 ${fs * .22}px JBM`; g.fillStyle = `hsl(${(356 + st.hue) % 360} 70% 50%)`;
          const s2 = [...st.sub], sp2 = fs * .09, w2 = s2.map(ch => g.measureText(ch).width), t2 = w2.reduce((a, b) => a + b, 0) + sp2 * (s2.length - 1);
          let x2 = st.tx * w - t2 / 2; s2.forEach((ch, i) => { g.fillText(ch, x2 + w2[i] / 2, st.ty * h + fs * .75); x2 += w2[i] + sp2; });
        }
        g.restore();
      }
      if (st.vignette) { const gr = g.createRadialGradient(w / 2, h / 2, h * .35, w / 2, h / 2, w * .75); gr.addColorStop(0, 'transparent'); gr.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      if (st.scan) { g.fillStyle = 'rgba(0,0,0,.22)'; const lh = Math.max(2, h / 360); for (let y = 0; y < h; y += lh * 2) g.fillRect(0, y, w, lh); }
      g.restore();
    };
    const preview = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio);
      cv.width = r.width * d; cv.height = r.width * d * H / W;
      draw(cv, cv.width, cv.height);
      localStorage.setItem('crk.editor', JSON.stringify(st));
    };
    // controles
    const bindRange = (id, k, f = 100, show) => { const r = $('#' + id, el); r.value = st[k] * f; r.oninput = () => { st[k] = r.value / f; show && show(); preview(); }; };
    const showVals = () => { $('#sv', el).textContent = Math.round(st.s * 100) + '%'; $('#rv', el).textContent = Math.round(st.rot) + '°'; };
    bindRange('s', 's', 100, showVals); bindRange('rot', 'rot', 1, showVals); bindRange('glow', 'glow', 1); bindRange('op', 'op', 100); bindRange('tsize', 'tsize', 100);
    showVals();
    const bindSwitch = (id) => { const s = $('#' + id, el); s.classList.toggle('on', !!st[id]); s.onclick = () => { st[id] = !st[id]; s.classList.toggle('on', st[id]); preview(); }; };
    ['skull', 'tshow', 'vignette', 'scan'].forEach(bindSwitch);
    ['title', 'sub'].forEach(k => { const i = $('#' + k, el); i.value = st[k]; i.oninput = () => { st[k] = i.value; preview(); }; });
    const syncChips = () => {
      $$('[data-b]', el).forEach(c => c.classList.toggle('on', c.dataset.b === st.base));
      $$('[data-h]', el).forEach(c => c.classList.toggle('on', +c.dataset.h === st.hue));
      $$('[data-sel]', el).forEach(c => c.classList.toggle('on', c.dataset.sel === st.sel));
      $('#skullctl', el).style.display = st.sel === 'skull' ? '' : 'none';
      $('#titlectl', el).style.display = st.sel === 'title' ? '' : 'none';
    };
    $$('[data-b]', el).forEach(c => c.onclick = async () => { st.base = c.dataset.b; if (st.base === 'pc') await loadPc(); syncChips(); preview(); });
    $$('[data-h]', el).forEach(c => c.onclick = () => { st.hue = +c.dataset.h; syncChips(); preview(); });
    $$('[data-sel]', el).forEach(c => c.onclick = () => { st.sel = c.dataset.sel; syncChips(); });
    $$('[data-p]', el).forEach(c => c.onclick = () => { const p = PRESETS[c.dataset.p]; Object.assign(st, { x: p.x, y: p.y, s: p.s, tx: p.tx, ty: p.ty }); $('#s', el).value = st.s * 100; showVals(); preview(); native.vibrate(); });
    $('#undo', el).onclick = () => { localStorage.removeItem('crk.editor'); Object.assign(st, { x: .5, y: .37, s: .30, rot: 0, hue: 0, glow: 1, op: 1, skull: true, title: 'CRACK OS', sub: 'secure · stealth · system', tx: .5, ty: .66, tsize: .078, tshow: true, vignette: true, scan: false, base: 'rain' }); syncInputs(); syncChips(); preview(); toast('Editor reiniciado'); };
    const syncInputs = () => { [['s', 's', 100], ['rot', 'rot', 1], ['glow', 'glow', 1], ['op', 'op', 100], ['tsize', 'tsize', 100]].forEach(([id, k, f]) => $('#' + id, el).value = st[k] * f);
      ['skull', 'tshow', 'vignette', 'scan'].forEach(id => $('#' + id, el).classList.toggle('on', !!st[id])); $('#title', el).value = st.title; $('#sub', el).value = st.sub; showVals(); };
    syncChips();

    // gestos sobre el lienzo
    const stage = $('#stage', el);
    const ptrs = new Map(); let pinch0 = 0, s0 = 0;
    stage.addEventListener('pointerdown', e => {
      stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); s0 = st.sel === 'skull' ? st.s : st.tsize; }
      if (ptrs.size === 1) {   // seleccionar lo que este mas cerca del dedo
        const r = stage.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        const ds = Math.hypot(px - st.x, py - st.y), dt = Math.hypot(px - st.tx, py - st.ty);
        const nsel = st.tshow && dt < ds ? 'title' : 'skull'; if (nsel !== st.sel) { st.sel = nsel; syncChips(); }
      }
    });
    stage.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const r = stage.getBoundingClientRect();
      if (ptrs.size === 1) {
        const dx = (e.clientX - p.x) / r.width, dy = (e.clientY - p.y) / r.height;
        if (st.sel === 'skull') { st.x = Math.min(1, Math.max(0, st.x + dx)); st.y = Math.min(1, Math.max(0, st.y + dy)); }
        else { st.tx = Math.min(1, Math.max(0, st.tx + dx)); st.ty = Math.min(1, Math.max(0, st.ty + dy)); }
      }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const k = Math.hypot(a.x - b.x, a.y - b.y) / pinch0;
        if (st.sel === 'skull') { st.s = Math.min(.9, Math.max(.05, s0 * k)); $('#s', el).value = st.s * 100; showVals(); } else st.tsize = Math.min(.16, Math.max(.02, s0 * k)); }
      preview();
    });
    const up = e => ptrs.delete(e.pointerId);
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);

    const render = () => new Promise(r => { const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c, W, H); c.toBlob(r, 'image/png'); });
    $('#apply', el).onclick = async (e) => {
      const b = e.currentTarget; busy(b, true, 'Enviando…');
      try { const blob = await render(); await post('/api/wallpaper/upload?' + new URLSearchParams({ name: 'crack-editor-' + Date.now(), apply: '1' }), blob, { timeout: 60000 }); toast('¡Fondo aplicado en la PC!'); native.vibrate(40); }
      catch (err) { toast(err.message, 'err'); }
      busy(b, false);
    };
    $('#save', el).onclick = async () => { const blob = await render(); const r = await native.saveFile(blob, `crackos-fondo-${Date.now()}.png`, 'image/png'); toast('Guardado en ' + (r?.path || 'Imágenes')); };
    await document.fonts.load('700 40px JBM');
    preview();
    const ro = new ResizeObserver(preview); ro.observe(stage);
    window.__crkEditor = st;
    return () => ro.disconnect();
  },
};
