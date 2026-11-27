// Modo touchpad: usa la pantalla del telefono como raton y teclado de la PC
import { ws, url } from '../api.js';
import { icon, h, $, $$, toast } from '../ui.js';
import { native } from '../native.js';

const KEYS = [['esc', 'Esc'], ['tab', 'Tab'], ['ctrl', 'Ctrl', 1], ['alt', 'Alt', 1], ['shift', 'Shift', 1], ['super', 'Super'], ['enter', 'Enter'],
  ['backspace', '⌫'], ['left', '←'], ['up', '↑'], ['down', '↓'], ['right', '→'], ['delete', 'Supr'], ['home', 'Inicio'], ['end', 'Fin'],
  ['pageup', 'RePág'], ['pagedown', 'AvPág'], ['print', 'ImpPt'], ...Array.from({ length: 12 }, (_, i) => [`f${i + 1}`, `F${i + 1}`])];
const COMBOS = [['Copiar', 'c', ['ctrl']], ['Pegar', 'v', ['ctrl']], ['Cortar', 'x', ['ctrl']], ['Deshacer', 'z', ['ctrl']],
  ['Alt+Tab', 'tab', ['alt']], ['Lanzador', 'space', ['logo']], ['Cerrar', 'q', ['logo']], ['Terminal', 'Return', ['logo']],
  ['Archivos', 'e', ['logo']], ['Pantalla completa', 'f', ['logo']], ['Escritorio →', 'right', ['ctrl', 'alt']], ['← Escritorio', 'left', ['ctrl', 'alt']]];

export default {
  full: true,
  mount(el) {
    el.style.display = 'flex'; el.style.flexDirection = 'column';
    el.innerHTML = `
      <div class="row" style="padding:6px 14px 8px;gap:8px">
        <button class="chip" id="live">${icon('eye', 14)} Ver pantalla</button>
        <button class="chip" id="kb">${icon('keyboard', 14)} Teclado</button>
        <span class="sp"></span><span class="small mut">Velocidad</span>
        <input type="range" id="sens" min="5" max="40" value="${localStorage.getItem('crk.sens') || 18}" style="width:80px"></div>
      <div id="kbbox" style="display:none;padding:0 14px 8px">
        <div class="row"><input class="input" id="txt" placeholder="Escribe aquí y aparece en la PC…" autocomplete="off" autocapitalize="off" autocorrect="off"><button class="btn" id="enter">${icon('send', 18)}</button></div>
      </div>
      <div class="keys" id="keys">${KEYS.map(([k, l, mod]) => `<button data-k="${k}" ${mod ? 'data-mod="1"' : ''}>${l}</button>`).join('')}</div>
      <div class="keys" id="combos">${COMBOS.map(([l], i) => `<button data-c="${i}" style="padding:0 10px">${l}</button>`).join('')}</div>
      <div class="pad" id="pad"><div class="hint">${icon('mouse', 36)}<div>1 dedo: mover · toque: clic<br>2 dedos: clic derecho · arrastrar 2 dedos: scroll<br>mantener presionado: arrastrar</div></div></div>
      <div class="mbtns"><button id="bl">IZQUIERDO</button><button id="bm">●</button><button id="br">DERECHO</button></div>`;
    const pad = $('#pad', el);
    let sock, ready = false, acc = { dx: 0, dy: 0 }, raf = 0;
    const connect = () => {
      sock = ws('/ws/input');
      sock.onopen = () => { ready = true; };
      sock.onclose = () => { ready = false; };
      sock.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.t === 'error') toast(m.msg, 'err'); } catch {} };
    };
    connect();
    const send = (m) => { if (ready) sock.send(JSON.stringify(m)); else if (sock.readyState > 1) connect(); };
    const flush = () => { raf = 0; if (acc.dx || acc.dy) { send({ t: 'move', dx: Math.round(acc.dx), dy: Math.round(acc.dy) }); acc.dx -= Math.round(acc.dx); acc.dy -= Math.round(acc.dy); } };
    const sensEl = $('#sens', el);
    sensEl.oninput = () => localStorage.setItem('crk.sens', sensEl.value);

    // ---- gestos
    let touches = {}, start = 0, moved = 0, maxFingers = 0, lastY = null, holdTimer = null, dragging = false;
    const dots = {};
    const showDot = (id, x, y) => {
      const r = pad.getBoundingClientRect();
      if (!dots[id]) { dots[id] = h('<div class="touch"></div>'); pad.appendChild(dots[id]); }
      dots[id].style.left = (x - r.left) + 'px'; dots[id].style.top = (y - r.top) + 'px';
    };
    pad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) { touches[t.identifier] = { x: t.clientX, y: t.clientY }; showDot(t.identifier, t.clientX, t.clientY); }
      const n = Object.keys(touches).length;
      if (n === 1 && maxFingers === 0) {
        start = performance.now(); moved = 0;
        holdTimer = setTimeout(() => { if (moved < 8) { dragging = true; send({ t: 'down', b: 'left' }); native.vibrate(40); pad.style.borderColor = '#ff2832'; } }, 520);
      }
      maxFingers = Math.max(maxFingers, n);
      if (n === 2) { clearTimeout(holdTimer); lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2; }
    }, { passive: false });
    pad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const n = e.touches.length;
      const sens = sensEl.value / 10;
      if (n === 1) {
        const t = e.touches[0], p = touches[t.identifier]; if (!p) return;
        const dx = t.clientX - p.x, dy = t.clientY - p.y;
        moved += Math.abs(dx) + Math.abs(dy);
        const sp = Math.hypot(dx, dy), accel = 1 + Math.min(sp / 12, 2.2);
        acc.dx += dx * sens * accel; acc.dy += dy * sens * accel;
        p.x = t.clientX; p.y = t.clientY;
        showDot(t.identifier, t.clientX, t.clientY);
        if (!raf) raf = requestAnimationFrame(flush);
      } else if (n === 2) {
        const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        for (const t of e.touches) { if (touches[t.identifier]) { touches[t.identifier].x = t.clientX; touches[t.identifier].y = t.clientY; } showDot(t.identifier, t.clientX, t.clientY); }
        const d = y - lastY;
        moved += Math.abs(d);
        if (Math.abs(d) > 14) { send({ t: 'scroll', dy: d > 0 ? -1 : 1 }); lastY = y; }
      }
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) { delete touches[t.identifier]; dots[t.identifier]?.remove(); delete dots[t.identifier]; }
      if (Object.keys(touches).length) return;
      clearTimeout(holdTimer);
      const dt = performance.now() - start;
      if (dragging) { send({ t: 'up', b: 'left' }); dragging = false; pad.style.borderColor = ''; }
      else if (dt < 260 && moved < 14) {
        const b = maxFingers >= 3 ? 'middle' : maxFingers === 2 ? 'right' : 'left';
        send({ t: 'click', b }); native.vibrate(8);
      }
      maxFingers = 0;
    };
    pad.addEventListener('touchend', end, { passive: false });
    pad.addEventListener('touchcancel', end, { passive: false });
    // raton (para probar en computadora)
    let mdown = null;
    pad.addEventListener('mousedown', (e) => { mdown = { x: e.clientX, y: e.clientY, t: performance.now(), m: 0 }; });
    window.addEventListener('mousemove', (e) => {
      if (!mdown) return;
      const dx = e.clientX - mdown.x, dy = e.clientY - mdown.y; mdown.m += Math.abs(dx) + Math.abs(dy);
      acc.dx += dx * sensEl.value / 10; acc.dy += dy * sensEl.value / 10; mdown.x = e.clientX; mdown.y = e.clientY;
      if (!raf) raf = requestAnimationFrame(flush);
    });
    const mup = (e) => { if (mdown && mdown.m < 5 && performance.now() - mdown.t < 300) send({ t: 'click', b: e.button === 2 ? 'right' : 'left' }); mdown = null; };
    window.addEventListener('mouseup', mup);
    pad.addEventListener('contextmenu', e => e.preventDefault());
    pad.addEventListener('wheel', (e) => { e.preventDefault(); send({ t: 'scroll', dy: e.deltaY > 0 ? -1 : 1 }); }, { passive: false });

    // botones fisicos
    [['bl', 'left'], ['br', 'right'], ['bm', 'middle']].forEach(([id, b]) => {
      const btn = $('#' + id, el);
      btn.addEventListener('pointerdown', () => { btn.classList.add('held'); send({ t: 'down', b }); native.vibrate(8); });
      const up = () => { if (btn.classList.contains('held')) { btn.classList.remove('held'); send({ t: 'up', b }); } };
      btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
    });

    // teclas
    const mods = new Set();
    $$('#keys button', el).forEach(b => b.onclick = () => {
      native.vibrate(6);
      const k = b.dataset.k;
      if (b.dataset.mod) { mods.has(k) ? mods.delete(k) : mods.add(k); b.classList.toggle('on'); return; }
      send({ t: 'key', key: k === 'super' ? 'Super_L' : k, mods: [...mods] });
      mods.clear(); $$('#keys button[data-mod]', el).forEach(x => x.classList.remove('on'));
    });
    $$('#combos button', el).forEach(b => b.onclick = () => {
      native.vibrate(6);
      const [, key, m] = COMBOS[+b.dataset.c];
      send({ t: 'key', key: { tab: 'Tab', space: 'space', right: 'Right', left: 'Left' }[key] || key, mods: m });
    });

    // teclado de texto
    $('#kb', el).onclick = () => {
      const box = $('#kbbox', el), on = box.style.display === 'none';
      box.style.display = on ? '' : 'none'; $('#kb', el).classList.toggle('on', on);
      if (on) $('#txt', el).focus();
    };
    const txt = $('#txt', el);
    let prev = '';
    txt.addEventListener('input', () => {
      const v = txt.value;
      let i = 0; while (i < prev.length && i < v.length && prev[i] === v[i]) i++;
      const del = prev.length - i, add = v.slice(i);
      for (let k = 0; k < del; k++) send({ t: 'key', key: 'backspace', mods: [] });
      if (add) send({ t: 'text', text: add });
      prev = v;
      if (v.length > 60) { txt.value = ''; prev = ''; }
    });
    txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send({ t: 'key', key: 'enter', mods: [] }); txt.value = ''; prev = ''; } });
    $('#enter', el).onclick = () => { send({ t: 'key', key: 'enter', mods: [] }); txt.value = ''; prev = ''; };

    // pantalla en vivo
    let liveOn = false, img = null, liveT;
    const loop = () => {
      if (!liveOn) return;
      const n = new Image();
      n.onload = () => { if (!liveOn) return; if (!img) { img = n; img.className = 'live'; pad.prepend(img); } else img.src = n.src; liveT = setTimeout(loop, 450); };
      n.onerror = () => { toast('No se pudo ver la pantalla', 'err'); liveT = setTimeout(loop, 2000); };
      n.src = url('/api/screen', { scale: 0.4, q: 50, r: Date.now() });
    };
    $('#live', el).onclick = () => {
      liveOn = !liveOn; $('#live', el).classList.toggle('on', liveOn);
      $('.hint', pad).style.display = liveOn ? 'none' : '';
      if (liveOn) loop(); else { clearTimeout(liveT); img?.remove(); img = null; }
    };
    native.keepAwake(true);
    return () => { liveOn = false; clearTimeout(liveT); sock.close(); window.removeEventListener('mouseup', mup); native.keepAwake(false); };
  },
};
