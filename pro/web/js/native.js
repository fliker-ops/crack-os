// Puente con la parte nativa de Android (CrackNative). En el navegador usa alternativas web.
const N = window.CrackNative;
let seq = 0;
const pending = new Map();
window.__crkCb = (id, json) => {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  let v = json;
  try { v = JSON.parse(json); } catch {}
  if (v && v.error) p.reject(new Error(v.error)); else p.resolve(v);
};

function call(method, ...args) {
  return new Promise((resolve, reject) => {
    const id = 'c' + (++seq);
    pending.set(id, { resolve, reject });
    try { N[method](...args, id); } catch (e) { pending.delete(id); reject(e); }
  });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function blobToB64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}

const has = (m) => !!(N && typeof N[m] === 'function');

export const native = {
  available: !!N,
  version: N ? N.appVersion() : 'web',
  device: N ? N.deviceName() : (navigator.userAgentData?.platform || navigator.platform || 'Navegador'),
  info() { try { return N ? JSON.parse(N.deviceInfo()) : null; } catch { return null; } },
  location() {
    if (N) return call('location');
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('sin GPS'));
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude,
        acc: p.coords.accuracy, alt: p.coords.altitude, speed: p.coords.speed, src: 'gps' }), e => rej(new Error(e.message)), { enableHighAccuracy: true, timeout: 12000 });
    });
  },
  async saveFile(blob, name, mime) {
    if (N) return call('saveFile', await blobToB64(blob), name, mime || blob.type || 'application/octet-stream');
    download(blob, name); return { path: 'Descargas/' + name };
  },
  async shareText(text) {
    if (has('shareText')) { N.shareText(String(text)); return true; }
    if (navigator.share) { await navigator.share({ text: String(text) }); return true; }
    await native.copy(text); return false;
  },
  async copy(text) {
    text = String(text);
    if (has('copy')) { N.copy(text); return; }
    try { await navigator.clipboard.writeText(text); return; } catch {}
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove();
  },
  async paste() {
    if (has('paste')) return N.paste();
    try { return await navigator.clipboard.readText(); } catch { return ''; }
  },
  openUrl(u) { if (has('openUrl')) N.openUrl(u); else window.open(u, '_blank'); },
  torch(on) { if (has('torch')) return call('torch', !!on); return Promise.reject(new Error('La linterna solo funciona en la app instalada')); },
  speak(text, rate = 1) {
    if (has('speak')) { N.speak(String(text), rate); return; }
    const u = new SpeechSynthesisUtterance(String(text)); u.lang = 'es-ES'; u.rate = rate; speechSynthesis.speak(u);
  },
  stopSpeak() { if (has('stopSpeak')) N.stopSpeak(); else try { speechSynthesis.cancel(); } catch {} },
  async battery() {
    if (has('battery')) return JSON.parse(N.battery());
    if (navigator.getBattery) { const b = await navigator.getBattery(); return { level: Math.round(b.level * 100), charging: b.charging }; }
    throw new Error('Batería no disponible');
  },
  vibrate(ms = 15) { try { N ? N.vibrate(ms) : navigator.vibrate?.(ms); } catch {} },
  pattern(arr) { try { if (has('pattern')) N.pattern(JSON.stringify(arr)); else navigator.vibrate?.(arr); } catch {} },
  keepAwake(on) { try { N && N.keepAwake(!!on); } catch {} },
  brightness(v) { try { if (has('brightness')) N.brightness(v); } catch {} },
};
