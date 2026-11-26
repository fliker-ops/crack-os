// Terminal remota: shell real del usuario en la PC (PTY por WebSocket)
import { Terminal } from '../../lib/xterm.mjs';
import { FitAddon } from '../../lib/addon-fit.mjs';
import { ws } from '../api.js';
import { $, $$, toast } from '../ui.js';
import { native } from '../native.js';

const EXTRA = [['Esc', '\x1b'], ['Tab', '\t'], ['Ctrl', null], ['↑', '\x1b[A'], ['↓', '\x1b[B'], ['←', '\x1b[D'], ['→', '\x1b[C'],
  ['|', '|'], ['~', '~'], ['/', '/'], ['-', '-'], ['$', '$'], ['&&', ' && '], ['^C', '\x03'], ['^D', '\x04'], ['^L', '\x0c'], ['^Z', '\x1a']];
const SNIPS = ['fastfetch', 'btop', 'ls -la', 'df -h', 'ip a', 'sudo apt update', 'cmatrix', 'htop', 'neofetch'];

export default {
  full: true,
  mount(el) {
    el.style.display = 'flex'; el.style.flexDirection = 'column';
    el.innerHTML = `<div class="termwrap" id="tw"></div>
      <div class="termkeys" id="snips">${SNIPS.map(s => `<button data-s="${s}" style="padding:0 10px">${s}</button>`).join('')}</div>
      <div class="termkeys" id="tk" style="border-top:0">${EXTRA.map(([l], i) => `<button data-i="${i}">${l}</button>`).join('')}
        <button data-a="minus">A-</button><button data-a="plus">A+</button></div>`;
    const size = Number(localStorage.getItem('crk.tsize') || 12);
    const term = new Terminal({
      fontFamily: 'JBM, monospace', fontSize: size, cursorBlink: true, allowProposedApi: true, scrollback: 3000,
      theme: { background: '#050304', foreground: '#e6e6e6', cursor: '#ff2832', cursorAccent: '#000', selectionBackground: '#ff283255',
        black: '#0a0a0a', red: '#ff2832', green: '#3ddc84', yellow: '#ffb020', blue: '#5d8cff', magenta: '#ff4d8d', cyan: '#3fd0e0', white: '#dddddd',
        brightBlack: '#555', brightRed: '#ff5a62', brightGreen: '#6dffa8', brightYellow: '#ffd060', brightBlue: '#8fb0ff', brightMagenta: '#ff7aa8', brightCyan: '#7ae8f0', brightWhite: '#ffffff' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open($('#tw', el));
    let sock, ctrl = false;
    const start = () => {
      fit.fit();
      sock = ws('/ws/terminal', { cols: term.cols, rows: term.rows });
      sock.onopen = () => term.focus();
      sock.onmessage = (e) => {
        if (typeof e.data === 'string') { try { if (JSON.parse(e.data).t === 'exit') term.write('\r\n\x1b[31m[sesión terminada · toca para reconectar]\x1b[0m\r\n'); } catch {} return; }
        term.write(new Uint8Array(e.data));
      };
      sock.onclose = () => term.write('\r\n\x1b[31m[desconectado]\x1b[0m\r\n');
      sock.onerror = () => toast('No se pudo abrir la terminal', 'err');
    };
    const sendIn = (d) => {
      if (!sock || sock.readyState > 1) { start(); return; }
      if (ctrl && d.length === 1) { const c = d.toUpperCase().charCodeAt(0); if (c >= 64 && c < 96) d = String.fromCharCode(c - 64); ctrl = false; $$('#tk button')[2].classList.remove('on'); }
      sock.readyState === 1 && sock.send(JSON.stringify({ t: 'in', d }));
    };
    term.onData(sendIn);
    term.onResize(({ cols, rows }) => sock?.readyState === 1 && sock.send(JSON.stringify({ t: 'resize', cols, rows })));
    start();
    const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} });
    ro.observe($('#tw', el));
    $$('#tk button', el).forEach(b => b.onclick = () => {
      native.vibrate(5);
      if (b.dataset.a) {
        term.options.fontSize = Math.max(8, Math.min(22, term.options.fontSize + (b.dataset.a === 'plus' ? 1 : -1)));
        localStorage.setItem('crk.tsize', term.options.fontSize); fit.fit(); return;
      }
      const [, seq] = EXTRA[+b.dataset.i];
      if (seq === null) { ctrl = !ctrl; b.classList.toggle('on', ctrl); term.focus(); return; }
      sendIn(seq); term.focus();
    });
    $$('#snips button', el).forEach(b => b.onclick = () => { native.vibrate(5); sendIn(b.dataset.s + '\r'); term.focus(); });
    window.__crkTerm = term;
    return () => { ro.disconnect(); sock?.close(); term.dispose(); };
  },
};
