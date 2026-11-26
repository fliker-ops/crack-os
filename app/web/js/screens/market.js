// Mercado: graficas de trading en tiempo real (cripto, datos publicos de Binance; Coinbase de respaldo)
import { post } from '../api.js';
import { icon, $, $$, esc, toast, panel, prompt, num } from '../ui.js';
import { setupCanvas } from '../charts.js';
import { native } from '../native.js';

const SYMS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA'];
const IVS = [['1m', 60], ['5m', 300], ['15m', 900], ['1h', 3600], ['4h', 14400], ['1d', 86400]];
const SRC = window.__crkMarket || {
  binance: { rest: 'https://api.binance.com', ws: 'wss://stream.binance.com:9443' },
  coinbase: { rest: 'https://api.exchange.coinbase.com', ws: 'wss://ws-feed.exchange.coinbase.com' },
};

const fmtP = p => p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : p >= 1 ? p.toFixed(3) : p.toFixed(5);
const ema = (arr, n) => { const k = 2 / (n + 1); let e = null; return arr.map(v => e = e == null ? v : v * k + e * (1 - k)); };

export default {
  async mount(el) {
    let sym = localStorage.getItem('crk.msym') || 'BTC', iv = localStorage.getItem('crk.miv') || '1m';
    let candles = [], book = { b: [], a: [] }, sock = null, src = 'binance', view = { n: 60, off: 0 }, cross = null, alive = true;
    const alerts = JSON.parse(localStorage.getItem('crk.alerts') || '[]');
    el.innerHTML = `
      <div class="chips" id="syms" style="flex-wrap:nowrap;overflow-x:auto;margin:6px 0">${SYMS.map(s => `<button class="chip" data-s="${s}" style="flex:none">${s}</button>`).join('')}</div>
      <div class="panel"><div class="pbody">
        <div class="row"><div class="sp"><div class="small mut"><span id="pair"></span> · <span id="srcl">conectando…</span></div>
          <div class="price" id="price">—</div><div class="small"><span class="chg" id="chg"></span> <span class="mut" id="hl"></span></div></div>
          <button class="iconbtn" id="alert" title="Alerta de precio">${icon('bell', 18)}</button></div>
        <div class="chips" id="ivs" style="margin:10px 0 6px">${IVS.map(([k]) => `<button class="chip" data-i="${k}">${k}</button>`).join('')}</div>
        <div class="mkt-chart" id="mc"><canvas id="cv"></canvas></div>
        <div class="row small mut" style="justify-content:space-between;margin-top:6px"><span><b style="color:#ffb020">━</b> EMA 20</span><span><b style="color:#5d8cff">━</b> EMA 50</span><span id="vol"></span><span id="live" class="red">● EN VIVO</span></div>
      </div></div>
      ${panel('Libro de órdenes', '<div class="book" id="book"><div class="small mut">esperando datos…</div></div>')}
      ${panel('Alertas de precio', '<div id="alerts"></div>')}
      <p class="small mut center" style="margin-bottom:20px">Datos públicos en tiempo real. Esto no es consejo de inversión.</p>`;
    const cv = $('#cv', el), mc = $('#mc', el);

    const draw = () => {
      const { ctx: g, w, h } = setupCanvas(cv, mc.clientHeight);
      g.clearRect(0, 0, w, h);
      if (!candles.length) { g.fillStyle = '#777'; g.font = '12px JBM'; g.fillText('Cargando velas…', 12, 24); return; }
      const end = Math.max(view.n, candles.length - view.off), vis = candles.slice(Math.max(0, end - view.n), end);
      const closes = candles.map(c => c.c), e20 = ema(closes, 20), e50 = ema(closes, 50);
      const i0 = Math.max(0, end - view.n);
      const padR = 64, ch = h * 0.78, vh = h * 0.16;
      const hi = Math.max(...vis.map(c => c.h)), lo = Math.min(...vis.map(c => c.l)), rng = (hi - lo) || 1;
      const Y = p => 8 + (ch - 16) * (1 - (p - lo) / rng);
      const cw = (w - padR) / view.n, bw = Math.max(1, cw * 0.66);
      // rejilla
      g.font = '9px JBM'; g.textAlign = 'left';
      for (let k = 0; k <= 4; k++) { const p = lo + rng * k / 4, y = Y(p); g.strokeStyle = 'rgba(255,40,50,.1)'; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(w - padR, y); g.stroke(); g.setLineDash([]); g.fillStyle = '#777'; g.fillText(fmtP(p), w - padR + 4, y + 3); }
      const vmax = Math.max(...vis.map(c => c.v)) || 1;
      vis.forEach((c, i) => {
        const x = i * cw + cw / 2, up = c.c >= c.o, col = up ? '#3ddc84' : '#ff2832';
        g.fillStyle = up ? 'rgba(61,220,132,.25)' : 'rgba(255,40,50,.3)';
        const vhh = vh * c.v / vmax; g.fillRect(x - bw / 2, h - vhh, bw, vhh);
        g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x, Y(c.h)); g.lineTo(x, Y(c.l)); g.stroke();
        g.fillStyle = col; const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c)); g.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
      });
      [[e20, '#ffb020'], [e50, '#5d8cff']].forEach(([e, col]) => { g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); vis.forEach((_, i) => { const v = e[i0 + i], x = i * cw + cw / 2; i ? g.lineTo(x, Y(v)) : g.moveTo(x, Y(v)); }); g.stroke(); });
      // precio actual
      const last = candles.at(-1), ly = Y(last.c);
      g.strokeStyle = last.c >= last.o ? '#3ddc84' : '#ff2832'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(0, ly); g.lineTo(w - padR, ly); g.stroke(); g.setLineDash([]);
      g.fillStyle = g.strokeStyle; g.fillRect(w - padR, ly - 9, padR, 18); g.fillStyle = '#000'; g.font = 'bold 10px JBM'; g.fillText(fmtP(last.c), w - padR + 4, ly + 4);
      alerts.filter(a => a.sym === sym).forEach(a => { const y = Y(a.p); if (y < 0 || y > ch) return; g.strokeStyle = '#ffb020'; g.setLineDash([1, 3]); g.beginPath(); g.moveTo(0, y); g.lineTo(w - padR, y); g.stroke(); g.setLineDash([]); });
      if (cross) {
        const i = Math.min(vis.length - 1, Math.max(0, Math.floor(cross.x / cw))), c = vis[i], x = i * cw + cw / 2;
        g.strokeStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.moveTo(0, cross.y); g.lineTo(w - padR, cross.y); g.stroke();
        g.fillStyle = 'rgba(10,0,2,.9)'; g.strokeStyle = '#ff2832'; g.fillRect(6, 6, 168, 62); g.strokeRect(6, 6, 168, 62);
        g.fillStyle = '#fff'; g.font = '10px JBM';
        g.fillText(new Date(c.t).toLocaleString('es', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), 12, 20);
        g.fillText(`A ${fmtP(c.o)}  C ${fmtP(c.c)}`, 12, 36); g.fillText(`Máx ${fmtP(c.h)}  Mín ${fmtP(c.l)}`, 12, 50); g.fillText(`Vol ${num(c.v)}`, 12, 63);
      }
    };

    const setHeader = (t) => {
      const pe = $('#price', el), old = parseFloat(pe.dataset.v || 0);
      pe.textContent = '$' + fmtP(t.price); pe.dataset.v = t.price;
      if (old && t.price !== old) { pe.classList.remove('flash-up', 'flash-dn'); void pe.offsetWidth; pe.classList.add(t.price > old ? 'flash-up' : 'flash-dn'); }
      if (t.chg != null) { const c = $('#chg', el); c.className = 'chg ' + (t.chg >= 0 ? 'up' : 'dn'); c.textContent = `${t.chg >= 0 ? '▲' : '▼'} ${t.chg.toFixed(2)}% 24h`; }
      if (t.high) $('#hl', el).textContent = `máx ${fmtP(t.high)} · mín ${fmtP(t.low)}`;
      if (t.vol) $('#vol', el).textContent = `vol 24h ${num(t.vol)}`;
      checkAlerts(t.price);
    };
    const renderBook = () => {
      const mx = Math.max(...book.b.map(x => x[1]), ...book.a.map(x => x[1]), 1e-9);
      $('#book', el).innerHTML = `<div>${book.b.slice(0, 8).map(([p, q]) => `<div class="bid"><i style="width:${q / mx * 100}%;background:#3ddc84"></i><span>${fmtP(p)}</span><span>${q.toFixed(4)}</span></div>`).join('')}</div>
        <div>${book.a.slice(0, 8).map(([p, q]) => `<div class="ask"><i style="width:${q / mx * 100}%;background:#ff2832"></i><span>${fmtP(p)}</span><span>${q.toFixed(4)}</span></div>`).join('')}</div>`;
    };
    const checkAlerts = (p) => {
      let changed = false;
      alerts.forEach(a => {
        if (a.sym !== sym || a.hit) return;
        if ((a.dir === 'up' && p >= a.p) || (a.dir === 'down' && p <= a.p)) {
          a.hit = true; changed = true; native.vibrate(300);
          toast(`🔔 ${a.sym} llegó a $${fmtP(a.p)}`);
          post('/api/notify', { title: `Alerta ${a.sym}`, body: `${a.sym} ${a.dir === 'up' ? 'subió a' : 'bajó a'} $${fmtP(p)}`, urgency: 'critical' }).catch(() => {});
        }
      });
      if (changed) { localStorage.setItem('crk.alerts', JSON.stringify(alerts)); renderAlerts(); }
    };
    const renderAlerts = () => {
      const box = $('#alerts', el);
      box.innerHTML = alerts.length ? alerts.map((a, i) => `<div class="kv"><span>${a.hit ? '✓' : '🔔'} ${a.sym} ${a.dir === 'up' ? '≥' : '≤'} $${fmtP(a.p)}</span><span><button class="btn sm ghost" data-x="${i}">${icon('x', 12)}</button></span></div>`).join('')
        : '<p class="small mut">Toca la campana para avisarte (aquí y en la PC) cuando el precio llegue a un valor.</p>';
      $$('[data-x]', box).forEach(b => b.onclick = () => { alerts.splice(+b.dataset.x, 1); localStorage.setItem('crk.alerts', JSON.stringify(alerts)); renderAlerts(); draw(); });
    };

    // ---------- fuentes de datos
    const ivSec = () => IVS.find(x => x[0] === iv)[1];
    async function loadBinance() {
      const s = sym + 'USDT';
      const [k, t] = await Promise.all([
        fetch(`${SRC.binance.rest}/api/v3/klines?symbol=${s}&interval=${iv}&limit=300`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch(`${SRC.binance.rest}/api/v3/ticker/24hr?symbol=${s}`).then(r => r.json())]);
      candles = k.map(x => ({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5] }));
      setHeader({ price: +t.lastPrice, chg: +t.priceChangePercent, high: +t.highPrice, low: +t.lowPrice, vol: +t.quoteVolume });
      const st = s.toLowerCase();
      sock = new WebSocket(`${SRC.binance.ws}/stream?streams=${st}@kline_${iv}/${st}@depth10@1000ms/${st}@ticker`);
      sock.onmessage = e => {
        const { stream, data: d } = JSON.parse(e.data);
        if (stream.includes('@kline')) {
          const k = d.k, c = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
          if (candles.length && candles.at(-1).t === c.t) candles[candles.length - 1] = c; else { candles.push(c); if (candles.length > 600) candles.shift(); }
          setHeader({ price: c.c }); draw();
        } else if (stream.includes('@depth')) { book = { b: d.bids.map(x => [+x[0], +x[1]]), a: d.asks.map(x => [+x[0], +x[1]]) }; renderBook(); }
        else if (stream.includes('@ticker')) setHeader({ price: +d.c, chg: +d.P, high: +d.h, low: +d.l, vol: +d.q });
      };
      return 'Binance';
    }
    async function loadCoinbase() {
      const p = sym + '-USD', g = ivSec() === 14400 ? 21600 : ivSec();
      const [k, st] = await Promise.all([fetch(`${SRC.coinbase.rest}/products/${p}/candles?granularity=${g}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch(`${SRC.coinbase.rest}/products/${p}/stats`).then(r => r.json())]);
      candles = k.reverse().map(x => ({ t: x[0] * 1000, l: x[1], h: x[2], o: x[3], c: x[4], v: x[5] }));
      setHeader({ price: candles.at(-1).c, chg: (st.last - st.open) / st.open * 100, high: +st.high, low: +st.low, vol: +st.volume * +st.last });
      sock = new WebSocket(SRC.coinbase.ws);
      sock.onopen = () => sock.send(JSON.stringify({ type: 'subscribe', product_ids: [p], channels: ['ticker', 'level2_batch'] }));
      sock.onmessage = e => {
        const d = JSON.parse(e.data);
        if (d.type === 'ticker') {
          const price = +d.price, t = Math.floor(Date.now() / 1000 / g) * g * 1000;
          const last = candles.at(-1);
          if (last && last.t === t) { last.c = price; last.h = Math.max(last.h, price); last.l = Math.min(last.l, price); last.v += +d.last_size || 0; }
          else candles.push({ t, o: price, h: price, l: price, c: price, v: +d.last_size || 0 });
          setHeader({ price, chg: (price - +d.open_24h) / +d.open_24h * 100, high: +d.high_24h, low: +d.low_24h }); draw();
        } else if (d.type === 'snapshot') { book = { b: d.bids.slice(0, 10).map(x => [+x[0], +x[1]]), a: d.asks.slice(0, 10).map(x => [+x[0], +x[1]]) }; renderBook(); }
      };
      return 'Coinbase';
    }
    const start = async () => {
      sock?.close(); candles = []; book = { b: [], a: [] }; view.off = 0; draw();
      $('#pair', el).textContent = `${sym}/USD`;
      $$('[data-s]', el).forEach(c => c.classList.toggle('on', c.dataset.s === sym));
      $$('[data-i]', el).forEach(c => c.classList.toggle('on', c.dataset.i === iv));
      for (const [name, fn] of (src === 'coinbase' ? [['coinbase', loadCoinbase], ['binance', loadBinance]] : [['binance', loadBinance], ['coinbase', loadCoinbase]])) {
        try { const label = await fn(); src = name; $('#srcl', el).textContent = (SRC.label || label) + ' · tiempo real'; draw(); return; } catch (e) { console.warn(name, e); }
      }
      $('#srcl', el).textContent = 'sin conexión a internet';
      $('#price', el).textContent = 'sin datos';
    };
    $$('[data-s]', el).forEach(c => c.onclick = () => { sym = c.dataset.s; localStorage.setItem('crk.msym', sym); native.vibrate(); start(); });
    $$('[data-i]', el).forEach(c => c.onclick = () => { iv = c.dataset.i; localStorage.setItem('crk.miv', iv); start(); });
    $('#alert', el).onclick = async () => {
      const cur = parseFloat($('#price', el).dataset.v || 0);
      const v = await prompt(`Alerta para ${sym}`, { value: cur ? fmtP(cur * 1.01).replace(/,/g, '') : '', type: 'number', ok: 'Crear alerta' });
      const p = parseFloat(v); if (!p) return;
      alerts.push({ sym, p, dir: p >= cur ? 'up' : 'down', hit: false }); localStorage.setItem('crk.alerts', JSON.stringify(alerts)); renderAlerts(); draw();
      toast(`Te aviso cuando ${sym} ${p >= cur ? 'suba' : 'baje'} a $${fmtP(p)}`);
    };
    // gestos: arrastrar = mover en el tiempo, pellizcar = zoom, mantener = cruz con datos
    const ptr = new Map(); let p0 = 0, n0 = 0, holdT;
    mc.addEventListener('pointerdown', e => { mc.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = mc.getBoundingClientRect();
      if (ptr.size === 1) holdT = setTimeout(() => { cross = { x: e.clientX - r.left, y: e.clientY - r.top }; native.vibrate(10); draw(); }, 350);
      if (ptr.size === 2) { clearTimeout(holdT); const [a, b] = [...ptr.values()]; p0 = Math.abs(a.x - b.x); n0 = view.n; } });
    mc.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return; const r = mc.getBoundingClientRect();
      if (cross) { cross = { x: e.clientX - r.left, y: e.clientY - r.top }; draw(); return; }
      if (Math.abs(e.clientX - p.x) > 3) clearTimeout(holdT);
      if (ptr.size === 1) { const cw = (r.width - 64) / view.n; const d = Math.round((e.clientX - p.x) / cw); if (d) { view.off = Math.max(0, Math.min(candles.length - view.n, view.off + d)); p.x = e.clientX; draw(); } }
      else { p.x = e.clientX; const [a, b] = [...ptr.values()]; view.n = Math.round(Math.max(20, Math.min(240, n0 * p0 / Math.max(20, Math.abs(a.x - b.x))))); draw(); }
    });
    const up = e => { ptr.delete(e.pointerId); clearTimeout(holdT); if (!ptr.size && cross) { cross = null; draw(); } };
    mc.addEventListener('pointerup', up); mc.addEventListener('pointercancel', up);
    mc.addEventListener('wheel', e => { e.preventDefault(); view.n = Math.max(20, Math.min(240, view.n + (e.deltaY > 0 ? 8 : -8))); draw(); }, { passive: false });
    const blink = setInterval(() => { const l = $('#live', el); if (l) l.style.opacity = l.style.opacity === '0.3' ? '1' : '0.3'; }, 700);
    renderAlerts();
    start();
    const ro = new ResizeObserver(draw); ro.observe(mc);
    return () => { alive = false; sock?.close(); clearInterval(blink); ro.disconnect(); };
  },
};
