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

export const native = {
  available: !!N,
  version: N ? N.appVersion() : 'web',
  device: N ? N.deviceName() : (navigator.userAgentData?.platform || 'Navegador'),
  discover: (port) => N ? call('discover', port) : Promise.resolve([]),
  localSubnet: () => N ? call('localSubnet') : Promise.resolve(null),
  location() {
    if (N) return call('location');
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('sin GPS'));
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude,
        acc: p.coords.accuracy, src: 'gps' }), e => rej(e), { enableHighAccuracy: true, timeout: 12000 });
    });
  },
  async saveFile(blob, name, mime) {
    if (N) return call('saveFile', await blobToB64(blob), name, mime || blob.type || 'application/octet-stream');
    download(blob, name); return { path: 'Descargas/' + name };
  },
  async share(blob, name, mime) {
    if (N) return call('share', await blobToB64(blob), name, mime || blob.type);
    download(blob, name);
  },
  vibrate(ms = 15) { try { N ? N.vibrate(ms) : navigator.vibrate?.(ms); } catch {} },
  keepAwake(on) { try { N && N.keepAwake(!!on); } catch {} },
  setOrientation(mode) { try { N && N.setOrientation(mode); } catch {} },
  demoHost() { try { return N ? N.demoHost() : new URLSearchParams(location.search).get('demo'); } catch { return null; } },
};
