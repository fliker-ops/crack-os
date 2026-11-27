// Registro de opciones (herramientas). Cada opcion tiene entradas, una funcion que calcula el resultado
// y la lista de roles que pueden usarla.
export const TOOLS = [];
export const CATS = [];
const byId = new Map();

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let curCat = null;
export function cat(id, name, icon, roles, desc = '') {
  curCat = { id, name, icon, roles, desc, groups: [] };
  CATS.push(curCat);
  return curCat;
}
let curGroup = '';
export function group(name) { curGroup = name; }

/** T(nombre, entradas, funcion, extras) — registra una opcion en la categoria actual */
export function T(name, inputs, run, extra = {}) {
  const c = extra.cat ? CATS.find(x => x.id === extra.cat) : curCat;
  let id = c.id + '.' + slug(name), n = 2;
  while (byId.has(id)) id = c.id + '.' + slug(name) + '-' + n++;
  const t = { id, name, cat: c.id, group: extra.group || curGroup || c.name, inputs: inputs || [], run, roles: extra.roles || c.roles,
    desc: extra.desc || '', live: extra.live !== false, view: extra.view || null, kw: extra.kw || '' };
  if (!c.groups.includes(t.group)) c.groups.push(t.group);
  TOOLS.push(t); byId.set(id, t);
  return t;
}
export const getTool = (id) => byId.get(id);

// ---- tipos de entrada
export const N = (label, def = '', o = {}) => ({ k: 'n', label, def, ...o });
export const S = (label, def = '', o = {}) => ({ k: 's', label, def, ...o });
export const A = (label, def = '', o = {}) => ({ k: 'a', label, def, ...o });
export const SEL = (label, options, def, o = {}) => ({ k: 'sel', label, options, def: def ?? (Array.isArray(options[0]) ? options[0][0] : options[0]), ...o });
export const D = (label, def = 'today', o = {}) => ({ k: 'd', label, def, ...o });
export const TM = (label, def = '', o = {}) => ({ k: 'tm', label, def, ...o });
export const F = (label, accept = '*/*', o = {}) => ({ k: 'f', label, accept, ...o });
export const C = (label, def = '#ff2832', o = {}) => ({ k: 'c', label, def, ...o });
export const B = (label, def = false, o = {}) => ({ k: 'b', label, def, ...o });

// ---- utilidades de formato para resultados
export const fmt = (x, d = 6) => {
  if (x === '' || x == null || (typeof x === 'number' && !isFinite(x))) return '—';
  if (typeof x !== 'number') return String(x);
  if (Math.abs(x) >= 1e15 || (Math.abs(x) < 1e-6 && x !== 0)) return x.toExponential(d > 6 ? 6 : d).replace('e', ' × 10^');
  return Number(x.toFixed(d)).toLocaleString('es', { maximumFractionDigits: d });
};
export const money = (x, cur = 'Q') => (isFinite(x) ? cur + ' ' + Number(x).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
export const pct = (x, d = 2) => (isFinite(x) ? fmt(x * 100, d) + ' %' : '—');
export const table = (rows) => ({ table: rows });
export const need = (...v) => { if (v.some(x => x === '' || x == null || (typeof x === 'number' && isNaN(x)))) throw new Error('Completa los datos'); };
