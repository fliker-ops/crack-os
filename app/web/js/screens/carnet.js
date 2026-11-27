// Carnet digital hacker con creador de personaje (sudaderas, gorras y logos propios)
import qrcode from '../../lib/qrcode.mjs';
import { post, conn } from '../api.js';
import { icon, $, $$, esc, toast, panel, busy } from '../ui.js';
import { native } from '../native.js';
import { state } from '../main.js';

const SKIN = ['#f6d7c3', '#e8b895', '#c98e66', '#a0694a', '#6e4630', '#3f2a1e'];
const CLOTH = ['#111114', '#1d1d22', '#3a0a10', '#8c0a14', '#ff2832', '#e6e6e6', '#2b2f3a', '#0d2a1a', '#1a1a3a', '#4a3b2a'];
const HAIRC = ['#0b0b0b', '#3a2416', '#7a4a22', '#c9a15a', '#e6e6e6', '#ff2832', '#3fd0e0', '#7a3bff'];
const LOGOS = {
  skull: '<path d="M50 14c-18 0-30 13-30 29 0 10 5 16 10 19v12h40V62c5-3 10-9 10-19 0-16-12-29-30-29z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M33 40l12 4-3 9-11-3zM67 40l-12 4 3 9 11-3z" fill="currentColor"/><path d="M50 56l-4 7h8z" fill="currentColor"/><path d="M40 74v-7M47 74v-7M53 74v-7M60 74v-7" stroke="currentColor" stroke-width="3"/>',
  term: '<rect x="12" y="20" width="76" height="60" rx="8" fill="none" stroke="currentColor" stroke-width="5"/><path d="M26 40l12 10-12 10" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M46 62h22" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
  lock: '<rect x="24" y="44" width="52" height="40" rx="6" fill="currentColor"/><path d="M34 44V32a16 16 0 0 1 32 0v12" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="62" r="5" fill="#000"/>',
  binary: '<text x="50" y="45" font-family="monospace" font-size="26" font-weight="bold" text-anchor="middle" fill="currentColor">0101</text><text x="50" y="74" font-family="monospace" font-size="26" font-weight="bold" text-anchor="middle" fill="currentColor">1010</text>',
  bolt: '<path d="M56 8L22 56h22l-6 36 36-50H50z" fill="currentColor"/>',
  eye: '<path d="M8 50s16-26 42-26 42 26 42 26-16 26-42 26S8 50 8 50z" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="50" cy="50" r="13" fill="currentColor"/><path d="M50 4v10M50 86v10" stroke="currentColor" stroke-width="4"/>',
  glitch: '<text x="50" y="72" font-family="monospace" font-size="62" font-weight="900" text-anchor="middle" fill="#00e5ff" opacity=".8">C</text><text x="54" y="70" font-family="monospace" font-size="62" font-weight="900" text-anchor="middle" fill="currentColor">C</text>',
  bug: '<ellipse cx="50" cy="56" rx="18" ry="24" fill="currentColor"/><circle cx="50" cy="28" r="10" fill="currentColor"/><path d="M32 46H16M32 60H14M34 74l-14 10M68 46h16M68 60h18M66 74l14 10M44 20l-6-10M56 20l6-10" stroke="currentColor" stroke-width="4"/>',
  key: '<circle cx="34" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 50h38M78 50v12M68 50v9" stroke="currentColor" stroke-width="7"/>',
  crack: '<text x="50" y="44" font-family="monospace" font-size="22" font-weight="900" text-anchor="middle" fill="currentColor" letter-spacing="2">CRACK</text><text x="50" y="72" font-family="monospace" font-size="22" font-weight="900" text-anchor="middle" fill="currentColor" letter-spacing="6">OS</text>',
};
const DEF = { skin: 1, hairStyle: 'short', hairC: 0, eyes: 'normal', mouth: 'smirk', beard: 'none', hood: true, hoodC: 0, logo: 'skull', logoC: '#ff2832',
  cap: 'none', capC: 4, capLogo: 'term', glasses: 'none', headphones: false, bg: 'circuit', name: '', alias: '', role: '' };

function logoSvg(id, color, imported) {
  if (id && id.startsWith('img:')) { const src = imported[+id.slice(4)]; return src ? `<image href="${src}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>` : ''; }
  return `<g color="${color}" style="color:${color}">${LOGOS[id] || ''}</g>`;
}

export function avatarSVG(a, imported = [], size = 200) {
  const skin = SKIN[a.skin], hc = HAIRC[a.hairC], cloth = CLOTH[a.hoodC], capc = CLOTH[a.capC];
  const shade = 'rgba(0,0,0,.28)';
  let bg = '';
  if (a.bg === 'circuit') bg = `<rect width="200" height="240" fill="#0a0305"/><g stroke="#ff2832" stroke-opacity=".25" fill="none" stroke-width="1.5"><path d="M0 40h40l12 12h30M200 70h-50l-10-10h-40M0 170h30l14-14h20M200 190h-40l-12 12h-30"/></g><g fill="#ff2832" fill-opacity=".5"><circle cx="82" cy="52" r="2.5"/><circle cx="100" cy="60" r="2.5"/><circle cx="64" cy="156" r="2.5"/><circle cx="118" cy="202" r="2.5"/></g><circle cx="100" cy="100" r="80" fill="url(#rg)"/>`;
  else if (a.bg === 'red') bg = `<rect width="200" height="240" fill="#8c0a14"/><circle cx="100" cy="90" r="110" fill="url(#rg2)"/>`;
  else if (a.bg === 'matrix') bg = `<rect width="200" height="240" fill="#020202"/>${Array.from({ length: 14 }, (_, i) => `<text x="${i * 15}" y="${30 + (i * 37) % 160}" fill="#ff2832" fill-opacity="${.15 + (i % 4) * .08}" font-family="monospace" font-size="11" writing-mode="tb">${'01ア10カ1'.repeat(3)}</text>`).join('')}`;
  else bg = `<rect width="200" height="240" fill="#e9e9ee"/>`;
  const hairBack = a.hood ? '' : ({ long: `<path d="M58 92c-4 40 2 70 10 86h64c8-16 14-46 10-86z" fill="${hc}"/>`, curly: `<circle cx="100" cy="78" r="50" fill="${hc}"/>` }[a.hairStyle] || '');
  const hood = a.hood ? `<path d="M48 120c-6-50 18-84 52-84s58 34 52 84l-8 30H56z" fill="${cloth}"/><path d="M60 118c-2-36 14-60 40-60s42 24 40 60" fill="${shade}"/>` : '';
  const body = `<path d="M22 240c0-50 30-76 78-76s78 26 78 76z" fill="${cloth}"/>
    <path d="M70 168c8 14 52 14 60 0" fill="none" stroke="${shade}" stroke-width="5"/>
    ${a.hood ? `<path d="M84 174l-6 34M116 174l6 34" stroke="#ddd" stroke-width="2.5"/><circle cx="78" cy="210" r="3" fill="#ddd"/><circle cx="122" cy="210" r="3" fill="#ddd"/>` : ''}
    <path d="M56 236h88" stroke="${shade}" stroke-width="10"/>
    <g transform="translate(78 186) scale(.44)">${logoSvg(a.logo, a.logoC, imported)}</g>`;
  const neck = `<path d="M86 140h28v26c-8 8-20 8-28 0z" fill="${skin}"/><path d="M86 150h28v6c-10 6-18 6-28 0z" fill="${shade}"/>`;
  const head = `<ellipse cx="100" cy="102" rx="34" ry="42" fill="${skin}"/><ellipse cx="66" cy="106" rx="6" ry="9" fill="${skin}"/><ellipse cx="134" cy="106" rx="6" ry="9" fill="${skin}"/>`;
  const hair = a.hood ? `<path d="M68 82c6-20 58-24 64 0-12-8-50-10-64 0z" fill="${hc}"/>` : ({
    short: `<path d="M64 92c-4-34 22-48 36-48s42 10 36 48c-6-16-14-24-36-24s-30 8-36 24z" fill="${hc}"/>`,
    long: `<path d="M64 96c-4-38 22-52 36-52s42 14 36 52c-6-18-16-28-36-28s-30 10-36 28z" fill="${hc}"/>`,
    mohawk: `<path d="M90 70c0-30 6-44 10-48 4 4 10 18 10 48z" fill="${hc}"/><path d="M68 92c0-10 6-20 10-22M132 92c0-10-6-20-10-22" stroke="${hc}" stroke-width="3" opacity=".5"/>`,
    curly: `<g fill="${hc}">${[[70, 74], [84, 62], [100, 58], [116, 62], [130, 74], [66, 90], [134, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12"/>`).join('')}</g>`,
    bald: '', buzz: `<path d="M66 92c-2-30 20-44 34-44s38 12 34 44c-8-14-18-20-34-20s-26 6-34 20z" fill="${hc}" opacity=".55"/>` }[a.hairStyle] || '');
  const eyes = { normal: `<ellipse cx="86" cy="104" rx="4.5" ry="5" fill="#111"/><ellipse cx="114" cy="104" rx="4.5" ry="5" fill="#111"/><circle cx="87.5" cy="102.5" r="1.4" fill="#fff"/><circle cx="115.5" cy="102.5" r="1.4" fill="#fff"/><path d="M78 94l14 2M122 94l-14 2" stroke="${hc}" stroke-width="3" stroke-linecap="round"/>`,
    angry: `<ellipse cx="86" cy="105" rx="4.5" ry="4" fill="#111"/><ellipse cx="114" cy="105" rx="4.5" ry="4" fill="#111"/><path d="M78 92l15 6M122 92l-15 6" stroke="${hc}" stroke-width="3.5" stroke-linecap="round"/>`,
    red: `<ellipse cx="86" cy="104" rx="5" ry="5" fill="#ff2832"/><ellipse cx="114" cy="104" rx="5" ry="5" fill="#ff2832"/><circle cx="86" cy="104" r="9" fill="#ff2832" opacity=".25"/><circle cx="114" cy="104" r="9" fill="#ff2832" opacity=".25"/><path d="M78 94l14 3M122 94l-14 3" stroke="${hc}" stroke-width="3" stroke-linecap="round"/>`,
    closed: `<path d="M81 105q5 4 10 0M109 105q5 4 10 0" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M78 94l14 2M122 94l-14 2" stroke="${hc}" stroke-width="3" stroke-linecap="round"/>` }[a.eyes];
  const mouth = { smile: '<path d="M88 124q12 10 24 0" stroke="#5a1a1a" stroke-width="3" fill="none" stroke-linecap="round"/>', neutral: '<path d="M90 126h20" stroke="#5a1a1a" stroke-width="3" stroke-linecap="round"/>',
    smirk: '<path d="M90 126q10 4 22-3" stroke="#5a1a1a" stroke-width="3" fill="none" stroke-linecap="round"/>', open: '<path d="M90 122q10 14 20 0z" fill="#5a1a1a"/>' }[a.mouth] || '';
  const nose = `<path d="M100 108l-4 10h7" stroke="${shade}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  const beard = { none: '', stubble: `<path d="M68 112c2 26 16 34 32 34s30-8 32-34c-6 12-18 20-32 20s-26-8-32-20z" fill="${hc}" opacity=".3"/>`,
    beard: `<path d="M66 108c0 32 16 42 34 42s34-10 34-42c-4 10-12 14-16 14-6-4-12-6-18-6s-12 2-18 6c-4 0-12-4-16-14z" fill="${hc}"/>`,
    goatee: `<path d="M90 130c2 10 6 14 10 14s8-4 10-14c-6 4-14 4-20 0z" fill="${hc}"/>`,
    mask: `<path d="M64 110c10 6 24 8 36 8s26-2 36-8l-2 24c-8 12-20 16-34 16s-26-4-34-16z" fill="#111"/><path d="M70 122h60M74 132h52" stroke="#ff2832" stroke-width="1.6" opacity=".8"/><circle cx="100" cy="126" r="3" fill="#ff2832"/>` }[a.beard] || '';
  const glasses = { none: '', visor: `<rect x="70" y="94" width="60" height="18" rx="7" fill="#ff2832" opacity=".9"/><rect x="72" y="96" width="56" height="5" rx="2" fill="#fff" opacity=".35"/><path d="M64 102h6M130 102h6" stroke="#222" stroke-width="3"/>`,
    shades: `<rect x="74" y="96" width="22" height="14" rx="4" fill="#0b0b0b"/><rect x="104" y="96" width="22" height="14" rx="4" fill="#0b0b0b"/><path d="M96 101h8M66 100h8M126 100h8" stroke="#0b0b0b" stroke-width="3"/>`,
    round: `<circle cx="86" cy="104" r="10" fill="none" stroke="#ddd" stroke-width="2.5"/><circle cx="114" cy="104" r="10" fill="none" stroke="#ddd" stroke-width="2.5"/><path d="M96 104h8" stroke="#ddd" stroke-width="2.5"/>`,
    cyber: `<path d="M106 96h20l-3 16h-17z" fill="#ff2832" opacity=".85"/><circle cx="116" cy="104" r="3" fill="#fff"/><path d="M126 100h8l4 8" stroke="#ff2832" stroke-width="2" fill="none"/>` }[a.glasses] || '';
  const cap = a.cap === 'none' ? '' : a.cap === 'front'
    ? `<path d="M64 84c0-26 16-42 36-42s36 16 36 42z" fill="${capc}"/><path d="M60 84c20-6 60-6 80 0l8 8c-30-6-66-6-96 0z" fill="${capc}"/><path d="M58 88c26-8 58-8 84 0" stroke="rgba(0,0,0,.35)" stroke-width="3" fill="none"/><g transform="translate(88 50) scale(.24)">${logoSvg(a.capLogo, '#ffffff', imported)}</g>`
    : `<path d="M64 84c0-26 16-42 36-42s36 16 36 42z" fill="${capc}"/><path d="M118 60c10-2 22 2 28 10l-6 6c-6-6-14-8-22-6z" fill="${capc}"/><g transform="translate(88 52) scale(.22)">${logoSvg(a.capLogo, '#ffffff', imported)}</g>`;
  const hp = a.headphones ? `<path d="M62 100c0-34 18-56 38-56s38 22 38 56" fill="none" stroke="#151515" stroke-width="7"/><rect x="54" y="94" width="14" height="26" rx="6" fill="#151515"/><rect x="132" y="94" width="14" height="26" rx="6" fill="#151515"/><rect x="134" y="100" width="4" height="14" fill="#ff2832"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="${size}" height="${size * 1.2}"><defs><radialGradient id="rg"><stop offset="0" stop-color="#ff2832" stop-opacity=".25"/><stop offset="1" stop-color="#ff2832" stop-opacity="0"/></radialGradient><radialGradient id="rg2"><stop offset="0" stop-color="#ff5a62"/><stop offset="1" stop-color="#3a0610"/></radialGradient></defs>
    ${bg}${hairBack}${hood}${body}${neck}${head}${hair}${beard}${nose}${mouth}${eyes}${glasses}${hp}${cap}</svg>`;
}

const svgToImg = (svg) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });

async function hash(s) {
  let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function qrCanvas(text, px) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'), s = px / (n + 2);
  g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); g.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + 1) * s, (y + 1) * s, Math.ceil(s), Math.ceil(s));
  return c;
}

async function drawCard(cvF, cvB, a, imported) {
  const W = 1012, H = 638;
  const host = state.sys?.host || conn.pcName, user = conn.user;
  const id = 'CRK-' + await hash(user + '@' + host + (a.name || ''));
  const admin = conn.admin;
  const issued = new Date(JSON.parse(localStorage.getItem('crk.cardIssued') || 'null') || Date.now());
  localStorage.setItem('crk.cardIssued', JSON.stringify(issued.getTime()));
  const exp = new Date(issued); exp.setFullYear(exp.getFullYear() + 4);
  const fmt = d => d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
  await document.fonts.load('700 30px JBM'); await document.fonts.load('800 30px JBM');
  // ---- frente
  cvF.width = W; cvF.height = H;
  let g = cvF.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#120406'); bg.addColorStop(.6, '#070203'); bg.addColorStop(1, '#1c0509');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,40,50,.08)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const sk = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'assets/skull.png'; });
  g.globalAlpha = .1; g.drawImage(sk, 600, 120, 420, 436); g.globalAlpha = 1;
  g.fillStyle = '#ff2832'; g.fillRect(0, 0, W, 86);
  g.fillStyle = '#fff'; g.font = '800 34px JBM'; g.fillText('C R A C K   O S', 36, 54);
  g.font = '400 16px JBM'; g.textAlign = 'right'; g.fillText('IDENTIFICACIÓN DIGITAL · OPERADOR', W - 36, 50); g.textAlign = 'left';
  // foto
  const av = await svgToImg(avatarSVG(a, imported, 400));
  g.save(); g.beginPath(); g.roundRect(36, 116, 250, 300, 18); g.clip(); g.drawImage(av, 36, 116, 250, 300); g.restore();
  g.strokeStyle = '#ff2832'; g.lineWidth = 4; g.beginPath(); g.roundRect(36, 116, 250, 300, 18); g.stroke();
  g.shadowColor = '#ff2832'; g.shadowBlur = 18; g.stroke(); g.shadowBlur = 0;
  // datos
  const field = (lab, val, x, y, big) => { g.fillStyle = '#ff4d55'; g.font = '400 15px JBM'; g.fillText(lab, x, y); g.fillStyle = '#fff'; g.font = `${big ? 800 : 700} ${big ? 38 : 25}px JBM`; g.fillText(val, x, y + (big ? 42 : 31)); };
  field('NOMBRE', (a.name || user).toUpperCase().slice(0, 22), 320, 136, true);
  field('ALIAS', '@' + (a.alias || user).slice(0, 18), 320, 218);
  field('ROL', (a.role || (admin ? 'Administrador root' : 'Operador')).slice(0, 24), 320, 286);
  field('NIVEL DE ACCESO', admin ? 'ROOT · NIVEL 5' : 'USUARIO · NIVEL 2', 320, 354);
  field('EMITIDO', fmt(issued), 36, 456); field('VENCE', fmt(exp), 236, 456); field('EQUIPO', host.slice(0, 16), 450, 456);
  g.fillStyle = '#ff2832'; g.font = '700 28px JBM'; g.fillText(id, 36, 580);
  g.fillStyle = '#888'; g.font = '400 13px JBM'; g.fillText('N.º DE IDENTIFICACIÓN', 36, 545);
  // chip y holograma
  const cg = g.createLinearGradient(700, 470, 790, 540); cg.addColorStop(0, '#d9b45a'); cg.addColorStop(1, '#8a6a20');
  g.fillStyle = cg; g.beginPath(); g.roundRect(706, 476, 86, 64, 10); g.fill(); g.strokeStyle = '#5a4210'; g.lineWidth = 2;
  [[706, 498, 792, 498], [706, 518, 792, 518], [748, 476, 748, 540]].forEach(([a1, b1, c1, d1]) => { g.beginPath(); g.moveTo(a1, b1); g.lineTo(c1, d1); g.stroke(); });
  const qr = qrCanvas(`CRACKOS-ID|${id}|${user}@${host}|${admin ? 'root' : 'user'}|${fmt(exp)}`, 150);
  g.drawImage(qr, W - 186, H - 186, 150, 150);
  const holo = g.createLinearGradient(820, 470, 1000, 470); ['#ff283266', '#ffb02055', '#3fd0e055', '#ff4d8d66'].forEach((c, i) => holo.addColorStop(i / 3, c));
  g.fillStyle = holo; g.beginPath(); g.arc(W - 250, H - 110, 34, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '700 11px JBM'; g.textAlign = 'center'; g.fillText('VERIFIED', W - 250, H - 106); g.textAlign = 'left';
  g.strokeStyle = '#ff2832'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
  // ---- reverso
  cvB.width = W; cvB.height = H; g = cvB.getContext('2d');
  g.fillStyle = '#0a0304'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#000'; g.fillRect(0, 60, W, 90);
  g.globalAlpha = .12; g.drawImage(sk, W / 2 - 160, 170, 320, 332); g.globalAlpha = 1;
  g.fillStyle = '#ddd'; g.font = '400 18px JBM';
  ['Este carnet identifica a su portador como operador autorizado', 'del sistema Crack OS en el equipo indicado al frente.',
    'Uso personal e intransferible. Si lo encuentras, devuélvelo', 'al operador o escanea el código QR.'].forEach((l, i) => g.fillText(l, 50, 210 + i * 30));
  g.fillStyle = '#fff'; g.fillRect(50, 360, 520, 70);
  g.fillStyle = '#000'; let x = 60; let seed = parseInt(id.slice(4), 16);
  while (x < 560) { const wd = 2 + (seed % 4); seed = (seed * 1103515245 + 12345) >>> 0; g.fillRect(x, 368, wd, 54); x += wd + 2 + (seed % 3); }
  g.font = '400 16px JBM'; g.fillStyle = '#aaa'; g.fillText(id + ' · ' + user + '@' + host, 50, 460);
  g.strokeStyle = '#ff2832'; g.beginPath(); g.moveTo(620, 420); g.lineTo(960, 420); g.stroke();
  g.fillStyle = '#ff4d55'; g.font = '400 14px JBM'; g.fillText('FIRMA DEL OPERADOR', 620, 444);
  g.fillStyle = '#fff'; g.font = 'italic 700 38px serif'; g.fillText((a.alias || user).slice(0, 14), 640, 405);
  g.fillStyle = '#ff2832'; g.fillRect(0, H - 50, W, 50);
  g.fillStyle = '#fff'; g.font = '700 16px JBM'; g.fillText('SECURE · STEALTH · SYSTEM', 36, H - 19);
  g.textAlign = 'right'; g.fillText('crack-os', W - 36, H - 19); g.textAlign = 'left';
}

export default {
  async mount(el) {
    const a = Object.assign({}, DEF, JSON.parse(localStorage.getItem('crk.avatar') || '{}'));
    const imported = JSON.parse(localStorage.getItem('crk.logos') || '[]');
    const save = () => localStorage.setItem('crk.avatar', JSON.stringify(a));
    el.innerHTML = `
      <div class="idcard-wrap"><div class="idcard" id="card"><canvas id="cf"></canvas><canvas class="back" id="cb"></canvas></div></div>
      <div class="grid3" style="margin:12px 0"><button class="btn sm" id="flip">${icon('refresh', 14)} Voltear</button><button class="btn sm" id="dl">${icon('download', 14)} Guardar</button><button class="btn sm primary" id="pc">${icon('user', 14)} Foto en PC</button></div>
      ${panel('Datos del carnet', `<div class="col"><input class="input" id="f-name" placeholder="Nombre completo" maxlength="22"><div class="grid2"><input class="input" id="f-alias" placeholder="Alias" maxlength="18"><input class="input" id="f-role" placeholder="Rol" maxlength="24"></div></div>`)}
      ${panel('Crear personaje', `<div class="avatar-stage" id="av"></div>
        <div class="tabs" id="tabs" style="margin-top:12px">${[['hood', 'Sudadera'], ['logo', 'Logo'], ['cap', 'Gorra'], ['face', 'Cara'], ['hair', 'Pelo'], ['extra', 'Extras'], ['bg', 'Fondo']].map(([k, l], i) => `<button class="chip ${i ? '' : 'on'}" data-tab="${k}" style="flex:none">${l}</button>`).join('')}</div>
        <div id="opts"></div>
        <input type="file" id="file" accept="image/*" hidden>`)}`;
    ['name', 'alias', 'role'].forEach(k => { const i = $('#f-' + k, el); i.value = a[k]; i.oninput = () => { a[k] = i.value; save(); refreshCard(); }; });
    let tab = 'hood', cardT;
    const refreshAv = () => { $('#av', el).innerHTML = avatarSVG(a, imported); };
    const refreshCard = () => { clearTimeout(cardT); cardT = setTimeout(() => drawCard($('#cf', el), $('#cb', el), a, imported), 150); };
    const mini = (patch) => `<div style="width:52px;height:62px">${avatarSVG({ ...a, ...patch, bg: 'none' }, imported, 52)}</div>`;
    const sw = (cols, key) => `<div class="swatches" style="margin:8px 0">${cols.map((c, i) => `<button class="swatch ${a[key] === i ? 'on' : ''}" data-k="${key}" data-v="${i}" style="background:${c}"></button>`).join('')}</div>`;
    const choice = (key, list) => `<div class="opts">${list.map(([v, label, patch]) => `<button class="opt ${a[key] === v ? 'on' : ''}" data-k="${key}" data-s="${v}" title="${label}">${patch === 'logo' ? `<svg viewBox="0 0 100 100">${logoSvg(v, a.logoC, imported)}</svg>` : mini({ [key]: v, ...(patch || {}) })}</button>`).join('')}</div>`;
    const logoList = () => [...Object.keys(LOGOS).map(k => [k, k, 'logo']), ...imported.map((_, i) => ['img:' + i, 'importado', 'logo'])];
    const renderOpts = () => {
      const o = $('#opts', el);
      if (tab === 'hood') o.innerHTML = `<div class="row" style="justify-content:space-between;margin:6px 0"><span>Capucha puesta</span><div class="switch ${a.hood ? 'on' : ''}" id="hoodsw"></div></div><label class="small mut">Color de la sudadera</label>${sw(CLOTH, 'hoodC')}`;
      if (tab === 'logo') o.innerHTML = `<label class="small mut">Logo al frente de la sudadera</label>${choice('logo', logoList())}
        <label class="small mut">Color del logo</label><div class="swatches" style="margin:8px 0">${['#ff2832', '#ffffff', '#111111', '#3fd0e0', '#3ddc84', '#ffb020'].map(c => `<button class="swatch ${a.logoC === c ? 'on' : ''}" data-lc="${c}" style="background:${c}"></button>`).join('')}</div>
        <button class="btn block" id="imp">${icon('upload', 16)} Importar logo del teléfono</button>`;
      if (tab === 'cap') o.innerHTML = `${choice('cap', [['none', 'sin gorra'], ['front', 'al frente'], ['back', 'hacia atrás']])}<label class="small mut">Color de la gorra</label>${sw(CLOTH, 'capC')}
        <label class="small mut">Logo de la gorra</label>${choice('capLogo', logoList())}<button class="btn block" id="imp">${icon('upload', 16)} Importar logo del teléfono</button>`;
      if (tab === 'face') o.innerHTML = `<label class="small mut">Piel</label>${sw(SKIN, 'skin')}<label class="small mut">Ojos</label>${choice('eyes', [['normal'], ['angry'], ['red'], ['closed']])}
        <label class="small mut">Boca</label>${choice('mouth', [['smirk'], ['smile'], ['neutral'], ['open']])}<label class="small mut">Barba / máscara</label>${choice('beard', [['none'], ['stubble'], ['goatee'], ['beard'], ['mask']])}`;
      if (tab === 'hair') o.innerHTML = `<label class="small mut">Peinado (se ve mejor sin capucha)</label>${choice('hairStyle', [['short', '', { hood: false }], ['long', '', { hood: false }], ['mohawk', '', { hood: false }], ['curly', '', { hood: false }], ['buzz', '', { hood: false }], ['bald', '', { hood: false }]])}<label class="small mut">Color</label>${sw(HAIRC, 'hairC')}`;
      if (tab === 'extra') o.innerHTML = `<label class="small mut">Lentes</label>${choice('glasses', [['none'], ['visor'], ['shades'], ['round'], ['cyber']])}<div class="row" style="justify-content:space-between;margin:10px 0"><span>Audífonos</span><div class="switch ${a.headphones ? 'on' : ''}" id="hpsw"></div></div>`;
      if (tab === 'bg') o.innerHTML = `<div class="chips">${[['circuit', 'Circuito'], ['matrix', 'Matrix'], ['red', 'Rojo'], ['none', 'Claro']].map(([k, l]) => `<button class="chip ${a.bg === k ? 'on' : ''}" data-bg="${k}">${l}</button>`).join('')}</div>`;
      const upd = () => { save(); refreshAv(); renderOpts(); refreshCard(); native.vibrate(6); };
      $$('[data-k][data-v]', o).forEach(b => b.onclick = () => { a[b.dataset.k] = +b.dataset.v; upd(); });
      $$('[data-k][data-s]', o).forEach(b => b.onclick = () => { a[b.dataset.k] = b.dataset.s; if (b.dataset.k === 'hairStyle') a.hood = false; upd(); });
      $$('[data-lc]', o).forEach(b => b.onclick = () => { a.logoC = b.dataset.lc; upd(); });
      $$('[data-bg]', o).forEach(b => b.onclick = () => { a.bg = b.dataset.bg; upd(); });
      $('#hoodsw', o) && ($('#hoodsw', o).onclick = () => { a.hood = !a.hood; upd(); });
      $('#hpsw', o) && ($('#hpsw', o).onclick = () => { a.headphones = !a.headphones; upd(); });
      $('#imp', o) && ($('#imp', o).onclick = () => $('#file', el).click());
    };
    $('#file', el).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const bmp = await createImageBitmap(f); const c = document.createElement('canvas'); const s = 256 / Math.max(bmp.width, bmp.height);
      c.width = bmp.width * s; c.height = bmp.height * s; c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      imported.push(c.toDataURL('image/png')); localStorage.setItem('crk.logos', JSON.stringify(imported.slice(-12)));
      if (tab === 'cap') a.capLogo = 'img:' + (imported.length - 1); else a.logo = 'img:' + (imported.length - 1);
      save(); refreshAv(); renderOpts(); refreshCard(); toast('Logo importado');
      e.target.value = '';
    };
    $$('#tabs .chip', el).forEach(c => c.onclick = () => { tab = c.dataset.tab; $$('#tabs .chip', el).forEach(x => x.classList.toggle('on', x === c)); renderOpts(); });
    $('#flip', el).onclick = () => $('#card', el).classList.toggle('flip');
    $('#card', el).onclick = () => $('#card', el).classList.toggle('flip');
    const blob = (c) => new Promise(r => c.toBlob(r, 'image/png'));
    $('#dl', el).onclick = async () => {
      const r1 = await native.saveFile(await blob($('#cf', el)), `carnet-crackos-${conn.user}.png`, 'image/png');
      await native.saveFile(await blob($('#cb', el)), `carnet-crackos-${conn.user}-reverso.png`, 'image/png');
      toast('Carnet guardado en ' + (r1?.path || 'Imágenes'));
    };
    $('#pc', el).onclick = async (e) => {
      const b = e.currentTarget; busy(b, true);
      try {
        const img = await svgToImg(avatarSVG(a, imported, 512)); const c = document.createElement('canvas'); c.width = c.height = 256;
        c.getContext('2d').drawImage(img, 0, -10, 256, 307);
        await post('/api/avatar', await blob(c)); toast('Ahora es tu foto en la PC y en el inicio de sesión');
      } catch (err) { toast(err.message, 'err'); }
      busy(b, false);
    };
    refreshAv(); renderOpts(); await drawCard($('#cf', el), $('#cb', el), a, imported);
    window.__crkAvatar = { set: (p) => { Object.assign(a, p); save(); refreshAv(); renderOpts(); refreshCard(); } };
  },
};
