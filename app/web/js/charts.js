// Graficas en canvas (datos reales que llegan de la PC o del mercado)
export function setupCanvas(cv, height) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || cv.parentElement.clientWidth;
  const hh = height || cv.clientHeight || 140;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    cv.style.height = hh + 'px';
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: hh };
}

const COLORS = ['#ff2832', '#ffffff', '#ff9a3c', '#9a9aa5'];

// series: [{data:[numbers], color, fill, label}]
export function lineChart(cv, series, { height = 140, max, min = 0, fmt = v => v.toFixed(0), grid = 4, labels } = {}) {
  const { ctx, w, h } = setupCanvas(cv, height);
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 34, r: 6, t: 8, b: labels ? 16 : 6 };
  const all = series.flatMap(s => s.data).filter(v => v != null);
  let hi = max ?? Math.max(1, ...all) * 1.15;
  const lo = min;
  ctx.font = '9px JBM, monospace';
  for (let i = 0; i <= grid; i++) {
    const y = pad.t + (h - pad.t - pad.b) * i / grid;
    ctx.strokeStyle = 'rgba(255,40,50,.12)'; ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#77777f'; ctx.textAlign = 'right';
    ctx.fillText(fmt(hi - (hi - lo) * i / grid), pad.l - 4, y + 3);
  }
  series.forEach((s, si) => {
    const d = s.data; if (!d.length) return;
    const n = Math.max(d.length - 1, 1);
    const X = i => pad.l + (w - pad.l - pad.r) * i / n;
    const Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / (hi - lo || 1));
    const col = s.color || COLORS[si];
    ctx.beginPath();
    d.forEach((v, i) => { const x = X(i), y = Y(v ?? 0); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (s.fill !== false) {
      ctx.save();
      ctx.lineTo(X(d.length - 1), Y(lo)); ctx.lineTo(X(0), Y(lo)); ctx.closePath();
      const g = ctx.createLinearGradient(0, pad.t, 0, h);
      g.addColorStop(0, hexA(col, .35)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.beginPath(); d.forEach((v, i) => { const x = X(i), y = Y(v ?? 0); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    }
    ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
    const lx = X(d.length - 1), ly = Y(d[d.length - 1] ?? 0);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, 7); ctx.fill();
  });
  if (labels) {
    ctx.fillStyle = '#77777f'; ctx.textAlign = 'center';
    const step = Math.ceil(labels.length / 6);
    labels.forEach((l, i) => {
      if (i % step) return;
      const x = pad.l + (w - pad.l - pad.r) * i / Math.max(labels.length - 1, 1);
      ctx.fillText(l, x, h - 3);
    });
  }
}

export function barChart(cv, groups, { height = 160, stacked = true, colors = COLORS, labels = [], fmt = v => v } = {}) {
  const { ctx, w, h } = setupCanvas(cv, height);
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 38, r: 4, t: 8, b: 16 };
  const tot = groups.map(g => stacked ? g.reduce((a, b) => a + b, 0) : Math.max(...g));
  const hi = Math.max(1, ...tot) * 1.12;
  ctx.font = '9px JBM, monospace';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h - pad.t - pad.b) * i / 4;
    ctx.strokeStyle = 'rgba(255,40,50,.12)'; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#77777f'; ctx.textAlign = 'right'; ctx.fillText(fmt(hi * (1 - i / 4)), pad.l - 4, y + 3);
  }
  const bw = (w - pad.l - pad.r) / Math.max(groups.length, 1);
  groups.forEach((g, i) => {
    let y0 = h - pad.b;
    g.forEach((v, k) => {
      const bh = (h - pad.t - pad.b) * v / hi;
      const x = pad.l + i * bw + bw * .18;
      ctx.fillStyle = colors[k];
      ctx.shadowColor = colors[k]; ctx.shadowBlur = k === 0 ? 6 : 0;
      ctx.fillRect(x, y0 - bh, bw * .64, bh);
      ctx.shadowBlur = 0;
      if (stacked) y0 -= bh;
    });
    if (labels[i] && (groups.length < 10 || i % Math.ceil(groups.length / 8) === 0)) {
      ctx.fillStyle = '#77777f'; ctx.textAlign = 'center';
      ctx.fillText(labels[i], pad.l + i * bw + bw / 2, h - 3);
    }
  });
}

export function donut(cv, parts, { size = 140, center = '', sub = '' } = {}) {
  const { ctx, w, h } = setupCanvas(cv, size);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 10;
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
  let a = -Math.PI / 2;
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#2a0508'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  parts.forEach((p, i) => {
    const da = Math.PI * 2 * p.v / tot;
    ctx.strokeStyle = p.color || COLORS[i % 4];
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(cx, cy, r, a + 0.02, a + da - 0.02); ctx.stroke();
    a += da;
  });
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,40,50,.35)'; ctx.lineWidth = 1; ctx.setLineDash([1, 5]);
  ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 17px JBM, monospace';
  ctx.fillText(center, cx, cy + 4);
  ctx.fillStyle = '#888'; ctx.font = '9px JBM, monospace'; ctx.fillText(sub, cx, cy + 18);
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
