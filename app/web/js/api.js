// Conexion con el agente Crack OS Remote que corre en la PC
const LS = window.localStorage;

export const conn = {
  host: LS.getItem('crk.host') || '',
  port: Number(LS.getItem('crk.port') || 4747),
  token: LS.getItem('crk.token') || '',
  user: LS.getItem('crk.user') || '',
  admin: LS.getItem('crk.admin') === '1',
  pcName: LS.getItem('crk.pcname') || '',
};

export function base() { return `http://${conn.host}:${conn.port}`; }

export function setHost(host, port = 4747, name = '') {
  conn.host = host; conn.port = port; conn.pcName = name || host;
  LS.setItem('crk.host', host); LS.setItem('crk.port', String(port)); LS.setItem('crk.pcname', conn.pcName);
  const recent = recentPCs().filter(p => p.host !== host);
  recent.unshift({ host, port, name: conn.pcName, t: Date.now() });
  LS.setItem('crk.recent', JSON.stringify(recent.slice(0, 6)));
}

export function recentPCs() {
  try { return JSON.parse(LS.getItem('crk.recent') || '[]'); } catch { return []; }
}

export function setSession(tok, user, admin) {
  conn.token = tok; conn.user = user; conn.admin = !!admin;
  LS.setItem('crk.token', tok); LS.setItem('crk.user', user); LS.setItem('crk.admin', admin ? '1' : '0');
}

export function clearSession() {
  conn.token = ''; LS.removeItem('crk.token');
}

export class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(path, { method = 'GET', body, raw = false, timeout = 15000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const h = { ...headers };
  if (conn.token) h['Authorization'] = 'Bearer ' + conn.token;
  let payload = body;
  if (body && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)) {
    payload = JSON.stringify(body); h['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(base() + path, { method, body: payload, headers: h, signal: ctrl.signal });
  } catch (e) {
    throw new ApiError(0, e.name === 'AbortError' ? 'La PC no respondió a tiempo' : 'No se pudo conectar con la PC');
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    if (res.status === 401 && conn.token && path !== '/api/login') onUnauthorized(msg);
    throw new ApiError(res.status, msg);
  }
  if (raw) return res.blob();
  return res.json();
}

export const get = (p, o) => api(p, o);
export const post = (p, body, o = {}) => api(p, { ...o, method: 'POST', body });
export const put = (p, body, o = {}) => api(p, { ...o, method: 'PUT', body });

export function url(path, params = {}) {
  const q = new URLSearchParams({ ...params, t: conn.token });
  return `${base()}${path}?${q}`;
}

export function publicUrl(path, params = {}) {
  return `${base()}${path}?${new URLSearchParams(params)}`;
}

export function ws(path, params = {}) {
  const q = new URLSearchParams({ ...params, t: conn.token });
  const s = new WebSocket(`ws://${conn.host}:${conn.port}${path}?${q}`);
  s.binaryType = 'arraybuffer';
  return s;
}

export async function probe(host, port = 4747, timeout = 1500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`http://${host}:${port}/api/hello`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    return { host, port, name: j.name, agent: j.agent, users: j.users };
  } catch { return null; } finally { clearTimeout(t); }
}

// Busca PCs con Crack OS en la red: primero UDP (app nativa), despues barrido HTTP de la subred
export async function discover(native, onFound) {
  const found = new Map();
  const add = (pc) => { if (pc && !found.has(pc.host)) { found.set(pc.host, pc); onFound(pc); } };
  const jobs = [];
  if (native.available) {
    jobs.push(native.discover(4747).then(list => list.forEach(add)).catch(() => {}));
  }
  const tries = new Set(native.available ? [] : ['127.0.0.1']);
  recentPCs().forEach(p => tries.add(p.host));
  let subnet = null;
  if (native.available) subnet = await native.localSubnet().catch(() => null);
  for (const h of tries) jobs.push(probe(h).then(add));
  if (subnet) {
    const hosts = [];
    for (let i = 1; i < 255; i++) hosts.push(`${subnet}.${i}`);
    for (let i = 0; i < hosts.length; i += 40) {
      await Promise.all(hosts.slice(i, i + 40).map(h => probe(h, 4747, 900).then(add)));
    }
  }
  await Promise.all(jobs);
  return [...found.values()];
}
