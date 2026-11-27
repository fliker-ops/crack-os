// Almacenamiento local: perfiles, sesion, auditoria, favoritos y datos de las mini apps
const LS = window.localStorage;
const K = (k) => 'pro.' + k;

export const store = {
  get(k, def = null) { try { const v = LS.getItem(K(k)); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { LS.setItem(K(k), JSON.stringify(v)); },
  del(k) { LS.removeItem(K(k)); },
  keys() { return Object.keys(LS).filter(k => k.startsWith('pro.')).map(k => k.slice(4)); },
};

export async function sha(s) {
  if (crypto.subtle) return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16);
}

// ---- perfiles
export const profiles = {
  all() { return store.get('profiles', []); },
  save(list) { store.set('profiles', list); },
  get(id) { return this.all().find(p => p.id === id); },
  upsert(p) { const l = this.all(); const i = l.findIndex(x => x.id === p.id); if (i >= 0) l[i] = p; else l.push(p); this.save(l); return p; },
  remove(id) { this.save(this.all().filter(p => p.id !== id)); store.del('fav.' + id); store.del('recent.' + id); },
  current() { const id = store.get('current'); return id ? this.get(id) : null; },
  setCurrent(id) { if (id) store.set('current', id); else store.del('current'); },
  hasAdmin() { return this.all().some(p => p.role === 'admin' && p.pin); },
};

// ---- codigos de rol (los define el administrador)
export const roleCodes = {
  get() { return store.get('roleCodes', {}); },
  async set(role, code) { const c = this.get(); if (code) c[role] = await sha('role:' + role + ':' + code); else delete c[role]; store.set('roleCodes', c); },
  async check(role, code) { const c = this.get(); if (!c[role]) return null; return c[role] === await sha('role:' + role + ':' + code); },
};

// ---- auditoria
export function audit(action, detail = '') {
  const p = profiles.current();
  const l = store.get('audit', []);
  l.push({ t: Date.now(), who: p ? p.alias || p.name : '—', role: p?.role || '—', action, detail: String(detail).slice(0, 160) });
  store.set('audit', l.slice(-3000));
}

// ---- favoritos y recientes por perfil
export const favs = {
  list() { const p = profiles.current(); return p ? store.get('fav.' + p.id, []) : []; },
  toggle(id) { const p = profiles.current(); if (!p) return false; let l = this.list(); const on = !l.includes(id); l = on ? [id, ...l] : l.filter(x => x !== id); store.set('fav.' + p.id, l); return on; },
  has(id) { return this.list().includes(id); },
};
export const recent = {
  list() { const p = profiles.current(); return p ? store.get('recent.' + p.id, []) : []; },
  push(id) { const p = profiles.current(); if (!p) return; store.set('recent.' + p.id, [id, ...this.list().filter(x => x !== id)].slice(0, 24)); },
};
export const usage = {
  bump(id) { const u = store.get('usage', {}); u[id] = (u[id] || 0) + 1; store.set('usage', u); },
  all() { return store.get('usage', {}); },
};

// ---- colecciones de datos para mini apps (notas, tareas, caja, etc.)
export function coll(name, perProfile = false) {
  const key = () => 'data.' + name + (perProfile ? '.' + (profiles.current()?.id || 'x') : '');
  return {
    list() { return store.get(key(), []); },
    save(l) { store.set(key(), l); },
    add(item) { const l = this.list(); const it = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), ...item }; l.push(it); this.save(l); return it; },
    update(id, patch) { const l = this.list(); const i = l.findIndex(x => x.id === id); if (i >= 0) { l[i] = { ...l[i], ...patch }; this.save(l); } },
    remove(id) { this.save(this.list().filter(x => x.id !== id)); },
  };
}
