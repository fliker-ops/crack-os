// Utilidades de interfaz: iconos, elementos, avisos y ventanas de confirmacion
import { native } from './native.js';

const P = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  mouse: 'M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6zM12 3v6M6 9h12',
  term: 'M4 5h16v14H4zM7 9l3 3-3 3M12 15h5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  apps: 'M5 5h3v3H5zM10.5 5h3v3h-3zM16 5h3v3h-3zM5 10.5h3v3H5zM10.5 10.5h3v3h-3zM16 10.5h3v3h-3zM5 16h3v3H5zM10.5 16h3v3h-3zM16 16h3v3h-3z',
  windows: 'M3 5h18v14H3zM3 9h18M6 7h.01M9 7h.01',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  brush: 'M14 4l6 6-9 9H5v-6zM12 6l6 6',
  check: 'M4 12l5 5L20 6',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  folder: 'M3 6h6l2 2h10v11H3z',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  disk: 'M4 6h16v12H4zM4 14h16M16 16h.01M13 16h.01',
  id: 'M3 5h18v14H3zM8 10a2 2 0 1 0 0 .01M5.5 16c.5-2 4.5-2 5 0M14 9h4M14 12h4M14 15h2',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8M20 16v-3',
  market: 'M3 17l5-6 4 3 6-8 3 3M3 21h18',
  clip: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 11h8M8 15h6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  power: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7h.01',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 15-4 16 0',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  keyboard: 'M3 7h18v10H3zM6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10',
  camera: 'M4 8h4l2-2h4l2 2h4v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  vol: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  play: 'M7 5l12 7-12 7z',
  next: 'M5 5l10 7-10 7zM18 5v14',
  prev: 'M19 5L9 12l10 7zM6 5v14',
  pin: 'M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  skull: 'M12 3a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8zM9 11.5a1.5 1.5 0 1 0 0 .01M15 11.5a1.5 1.5 0 1 0 0 .01M10 20v-2M14 20v-2M12 14l-1 2h2z',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  send: 'M4 12l16-8-6 16-2-6z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
};

export function icon(name, size = 22, extra = '') {
  return `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] || P.info}"/></svg>`;
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function bytes(n, d = 1) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; n = Number(n);
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? d : 0)} ${u[i]}`;
}

export function num(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

export function duration(s) {
  s = Math.floor(s);
  const d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d}d ${hh}h ${m}m` : hh ? `${hh}h ${m}m` : `${m}m`;
}

let toastTimer;
export function toast(msg, kind = 'ok') {
  let t = $('#toast');
  if (!t) { t = h('<div id="toast"></div>'); document.body.appendChild(t); }
  t.className = 'show ' + kind;
  t.innerHTML = `${icon(kind === 'err' ? 'x' : 'check', 16)}<span>${esc(msg)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 2600);
  if (kind === 'err') native.vibrate(40);
}

export function modal({ title, body = '', actions = [], danger = false, onOpen }) {
  return new Promise(resolve => {
    const m = h(`<div class="modal-bg"><div class="modal ${danger ? 'danger' : ''}">
      <div class="modal-head"><span class="tag">${danger ? '⚠ ALERTA' : 'CRACK//OS'}</span><h3>${esc(title)}</h3></div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions"></div></div></div>`);
    const box = $('.modal-actions', m);
    const close = (v) => { m.classList.add('out'); setTimeout(() => m.remove(), 180); resolve(v); };
    actions.forEach(a => {
      const b = h(`<button class="btn ${a.kind || ''}">${esc(a.label)}</button>`);
      b.onclick = async () => {
        if (a.handler) { const r = await a.handler(m, b); if (r === false) return; close(r ?? a.value); }
        else close(a.value);
      };
      box.appendChild(b);
    });
    m.addEventListener('click', e => { if (e.target === m) close(null); });
    document.body.appendChild(m);
    onOpen && onOpen(m, close);
  });
}

export function confirm(title, text, { danger = false, ok = 'Aceptar' } = {}) {
  return modal({ title, danger, body: `<p>${esc(text)}</p>`,
    actions: [{ label: 'Cancelar', value: false }, { label: ok, value: true, kind: danger ? 'danger' : 'primary' }] });
}

export function prompt(title, { value = '', placeholder = '', type = 'text', ok = 'Aceptar', multiline = false } = {}) {
  const field = multiline ? `<textarea class="input" rows="4" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
    : `<input class="input" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  return modal({ title, body: field, onOpen: m => setTimeout(() => $('.input', m).focus(), 50),
    actions: [{ label: 'Cancelar', value: null },
      { label: ok, kind: 'primary', handler: m => $('.input', m).value }] });
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${label || ''}`; }
  else { btn.disabled = false; btn.innerHTML = btn.dataset.label || btn.innerHTML; }
}

// Encabezado de panel estilo HUD
export function panel(title, inner = '', cls = '') {
  return `<section class="panel ${cls}"><header><span class="ptitle">${esc(title)}</span><i></i></header><div class="pbody">${inner}</div></section>`;
}

export function ring(pct, label, sub = '', size = 96) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct || 0)) / 100);
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r + 5}" class="ring-ticks"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>
    <div class="ring-txt"><b>${label}</b><small>${esc(sub)}</small></div></div>`;
}

export function updateRing(el, pct, label) {
  const fg = el.querySelector('.ring-fg');
  const c = parseFloat(fg.getAttribute('stroke-dasharray'));
  fg.setAttribute('stroke-dashoffset', c * (1 - Math.min(100, Math.max(0, pct || 0)) / 100));
  el.querySelector('b').textContent = label;
}
