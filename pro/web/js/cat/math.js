// Matematicas, geometria, estadistica, fisica y quimica
import { cat, group, T, N, S, A, SEL, fmt, need, table } from '../tool.js';
import { G } from '../roles.js';

const nums = (s) => String(s).split(/[\s,;]+/).map(x => parseFloat(x.replace(',', '.'))).filter(x => !isNaN(x));
const R = (v, extra) => ({ big: fmt(v, 10), ...(extra ? { table: extra } : {}) });

// evaluador seguro de expresiones (sin eval)
export function evaluate(expr, vars = {}) {
  const src = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/π/g, 'pi');
  let i = 0;
  const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, cbrt: Math.cbrt,
    log: Math.log10, ln: Math.log, exp: Math.exp, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, fact: n => fact(n) };
  const C = { pi: Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2, ...vars };
  const ws = () => { while (src[i] === ' ') i++; };
  const peek = () => { ws(); return src[i]; };
  function prim() {
    ws();
    if (src[i] === '(') { i++; const v = add(); if (peek() !== ')') throw new Error('Falta ")"'); i++; return v; }
    if (src[i] === '-') { i++; return -pow(); }
    if (src[i] === '+') { i++; return pow(); }
    const m = /^(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)/i.exec(src.slice(i));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    const w = /^[a-z_]\w*/i.exec(src.slice(i));
    if (w) {
      i += w[0].length; const name = w[0].toLowerCase();
      if (F[name]) { if (peek() !== '(') throw new Error('Falta "(" después de ' + name); return F[name](prim()); }
      if (name in C) return C[name];
      throw new Error('No conozco "' + w[0] + '"');
    }
    throw new Error('Expresión incompleta');
  }
  function post() { let v = prim(); while (peek() === '!') { i++; v = fact(v); } if (peek() === '%') { i++; v /= 100; } return v; }
  function pow() { const b = post(); if (peek() === '^') { i++; return b ** pow(); } return b; }
  function mul() { let v = pow(); for (;;) { const c = peek(); if (c === '*') { i++; v *= pow(); } else if (c === '/') { i++; v /= pow(); } else if (c === '(' || (c && /[a-z]/i.test(c))) v *= pow(); else return v; } }
  function add() { let v = mul(); for (;;) { const c = peek(); if (c === '+') { i++; v += mul(); } else if (c === '-') { i++; v -= mul(); } else return v; } }
  const v = add(); if (i < src.length && peek() !== undefined) throw new Error('Sobra: ' + src.slice(i));
  return v;
}
function fact(n) { if (n < 0 || n !== Math.floor(n)) return gamma(n + 1); let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; }
function gamma(z) { const g = 7, p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < .5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z)); z -= 1; let x = p[0]; for (let k = 1; k < g + 2; k++) x += p[k] / (z + k); const t = z + g + .5; return Math.sqrt(2 * Math.PI) * t ** (z + .5) * Math.exp(-t) * x; }
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const isPrime = (n) => { if (n < 2 || n !== Math.floor(n)) return false; if (n < 4) return true; if (n % 2 === 0 || n % 3 === 0) return false; for (let k = 5; k * k <= n; k += 6) if (n % k === 0 || n % (k + 2) === 0) return false; return true; };
const factors = (n) => { const f = []; let d = 2; n = Math.floor(n); while (n > 1 && d * d <= n) { while (n % d === 0) { f.push(d); n /= d; } d++; } if (n > 1) f.push(n); return f; };
const big = (n) => { let r = 1n; for (let k = 2n; k <= BigInt(n); k++) r *= k; return r; };

cat('math', 'Matemáticas', 'calc', G.all, 'Calculadora, funciones, álgebra, primos y combinatoria');
group('Básico');
T('Calculadora científica', [S('Expresión', '2*(3+4)^2 - sqrt(16)', { wide: true })], ([e]) => { need(e.trim()); return R(evaluate(e)); }, { kw: 'calcular operacion', desc: 'Admite + − × ÷ ^ ! % ( ), sin cos tan log ln sqrt, pi y e.' });
T('Sumar', [N('A', 12), N('B', 30)], ([a, b]) => { need(a, b); return R(a + b); });
T('Restar', [N('A', 50), N('B', 8)], ([a, b]) => { need(a, b); return R(a - b); });
T('Multiplicar', [N('A', 6), N('B', 7)], ([a, b]) => { need(a, b); return R(a * b); });
T('Dividir', [N('Dividendo', 100), N('Divisor', 7)], ([a, b]) => { need(a, b); return R(a / b, [['Cociente entero', Math.trunc(a / b)], ['Residuo', a % b]]); });
T('Porcentaje de un número', [N('Porcentaje %', 15), N('Número', 200)], ([p, n]) => { need(p, n); return R(p * n / 100); });
T('Qué porcentaje es A de B', [N('A', 30), N('B', 120)], ([a, b]) => { need(a, b); return { big: fmt(a / b * 100, 4) + ' %' }; });
T('Variación porcentual', [N('Valor inicial', 80), N('Valor final', 100)], ([a, b]) => { need(a, b); return { big: fmt((b - a) / a * 100, 4) + ' %' }; });
T('Aumentar un porcentaje', [N('Número', 100), N('Aumento %', 12)], ([n, p]) => { need(n, p); return R(n * (1 + p / 100)); });
T('Disminuir un porcentaje', [N('Número', 100), N('Descuento %', 12)], ([n, p]) => { need(n, p); return R(n * (1 - p / 100)); });
T('Regla de tres simple', [N('Si A', 3), N('equivale a B', 15), N('entonces C', 7)], ([a, b, c]) => { need(a, b, c); return { big: fmt(b * c / a, 6), text: `${a} → ${b}; ${c} → ${fmt(b * c / a, 6)}` }; });
T('Regla de tres inversa', [N('Si A', 4), N('tardan B', 12), N('entonces C', 6)], ([a, b, c]) => { need(a, b, c); return R(a * b / c); });
T('Promedio de números', [A('Números separados por coma o espacio', '7, 8.5, 9, 10')], ([s]) => { const v = nums(s); need(v.length || ''); return R(v.reduce((x, y) => x + y, 0) / v.length, [['Cantidad', v.length], ['Suma', fmt(v.reduce((x, y) => x + y, 0))]]); });
T('Potencia', [N('Base', 2), N('Exponente', 10)], ([a, b]) => { need(a, b); return R(a ** b); });
T('Raíz cuadrada', [N('Número', 144)], ([a]) => { need(a); return R(Math.sqrt(a)); });
T('Raíz cúbica', [N('Número', 27)], ([a]) => { need(a); return R(Math.cbrt(a)); });
T('Raíz enésima', [N('Número', 32), N('Índice', 5)], ([a, n]) => { need(a, n); return R(Math.sign(a) * Math.abs(a) ** (1 / n)); });
T('Inverso (1/x)', [N('x', 8)], ([a]) => { need(a); return R(1 / a); });
T('Valor absoluto', [N('x', -12.5)], ([a]) => { need(a); return R(Math.abs(a)); });
T('Fracción a decimal', [N('Numerador', 3), N('Denominador', 8)], ([a, b]) => { need(a, b); return R(a / b); });
T('Decimal a fracción', [N('Decimal', 0.375)], ([x]) => {
  need(x); let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = x;
  do { const a = Math.floor(b); [h1, h2] = [a * h1 + h2, h1]; [k1, k2] = [a * k1 + k2, k1]; b = 1 / (b - a); } while (Math.abs(x - h1 / k1) > x * 1e-9 && k1 < 1e6);
  return { big: `${h1}/${k1}` };
});
T('Simplificar fracción', [N('Numerador', 42), N('Denominador', 56)], ([a, b]) => { need(a, b); const g = gcd(a, b); return { big: `${a / g}/${b / g}` }; });
T('Sumar fracciones', [S('Fracción 1', '1/2'), S('Fracción 2', '1/3')], ([x, y]) => {
  const [a, b] = x.split('/').map(Number), [c, d] = y.split('/').map(Number); need(a, b, c, d);
  const n = a * d + c * b, m = b * d, g = gcd(n, m); return { big: `${n / g}/${m / g}`, table: [['Decimal', fmt(n / m)]] };
});
T('Multiplicar fracciones', [S('Fracción 1', '2/3'), S('Fracción 2', '3/4')], ([x, y]) => {
  const [a, b] = x.split('/').map(Number), [c, d] = y.split('/').map(Number); need(a, b, c, d);
  const n = a * c, m = b * d, g = gcd(n, m); return { big: `${n / g}/${m / g}`, table: [['Decimal', fmt(n / m)]] };
});
T('Tabla de multiplicar', [N('Número', 7), N('Hasta', 12)], ([n, h]) => { need(n, h); return table(Array.from({ length: Math.min(h, 100) }, (_, i) => [`${n} × ${i + 1}`, fmt(n * (i + 1))])); });

group('Funciones');
for (const [name, fn, lab, deg] of [['Seno', Math.sin, 'Ángulo', 1], ['Coseno', Math.cos, 'Ángulo', 1], ['Tangente', Math.tan, 'Ángulo', 1],
  ['Arcoseno', Math.asin, 'Valor', -1], ['Arcocoseno', Math.acos, 'Valor', -1], ['Arcotangente', Math.atan, 'Valor', -1],
  ['Seno hiperbólico', Math.sinh, 'x', 0], ['Coseno hiperbólico', Math.cosh, 'x', 0], ['Tangente hiperbólica', Math.tanh, 'x', 0],
  ['Logaritmo base 10', Math.log10, 'x', 0], ['Logaritmo natural', Math.log, 'x', 0], ['Logaritmo base 2', Math.log2, 'x', 0], ['Exponencial (e^x)', Math.exp, 'x', 0]]) {
  if (deg === 1) T(name, [N(lab, 30), SEL('Unidad', ['grados', 'radianes'])], ([x, u]) => { need(x); return R(fn(u === 'grados' ? x * Math.PI / 180 : x)); }, { roles: G.vis });
  else if (deg === -1) T(name, [N(lab, .5)], ([x]) => { need(x); const r = fn(x); return { big: fmt(r * 180 / Math.PI, 8) + '°', table: [['Radianes', fmt(r, 10)]] }; }, { roles: G.vis });
  else T(name, [N(lab, 10)], ([x]) => { need(x); return R(fn(x)); }, { roles: G.vis });
}
T('Logaritmo en cualquier base', [N('x', 81), N('Base', 3)], ([x, b]) => { need(x, b); return R(Math.log(x) / Math.log(b)); }, { roles: G.vis });
T('Graficar función', [S('f(x) =', 'sin(x)*x', { wide: true }), N('Desde x', -10), N('Hasta x', 10)], ([e, a, b]) => {
  need(e, a, b); const W = 600, H = 360, pts = []; let mn = Infinity, mx = -Infinity;
  for (let k = 0; k <= 300; k++) { const x = a + (b - a) * k / 300; const y = evaluate(e, { x }); if (isFinite(y)) { mn = Math.min(mn, y); mx = Math.max(mx, y); } pts.push([x, y]); }
  if (mn === mx) { mn -= 1; mx += 1; }
  const sx = x => (x - a) / (b - a) * W, sy = y => H - (y - mn) / (mx - mn) * H;
  const d = pts.filter(p => isFinite(p[1])).map((p, k) => (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('');
  const ax = mn < 0 && mx > 0 ? `<line x1="0" x2="${W}" y1="${sy(0)}" y2="${sy(0)}" stroke="#555"/>` : '', ay = a < 0 && b > 0 ? `<line y1="0" y2="${H}" x1="${sx(0)}" x2="${sx(0)}" stroke="#555"/>` : '';
  return { html: `<svg viewBox="0 0 ${W} ${H}" class="plot">${ax}${ay}<path d="${d}" fill="none" stroke="#ff2832" stroke-width="2.5"/></svg><div class="small mut">y de ${fmt(mn, 3)} a ${fmt(mx, 3)}</div>` };
}, { roles: G.staff, live: false });
T('Tabla de valores de función', [S('f(x) =', 'x^2 - 3x + 2'), N('Desde', -2), N('Hasta', 5), N('Paso', 1)], ([e, a, b, s]) => { need(e, a, b, s); const r = []; for (let x = a; x <= b + 1e-9 && r.length < 200; x += s) r.push([`x = ${fmt(x, 4)}`, fmt(evaluate(e, { x }), 6)]); return table(r); }, { roles: G.staff });
T('Derivada numérica en un punto', [S('f(x) =', 'x^3'), N('x', 2)], ([e, x]) => { need(e, x); const h = 1e-5; return R((evaluate(e, { x: x + h }) - evaluate(e, { x: x - h })) / (2 * h)); }, { roles: G.staff });
T('Integral definida', [S('f(x) =', 'x^2'), N('Desde a', 0), N('Hasta b', 3)], ([e, a, b]) => {
  need(e, a, b); const n = 1000, h = (b - a) / n; let s = evaluate(e, { x: a }) + evaluate(e, { x: b });
  for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * evaluate(e, { x: a + k * h }); return R(s * h / 3, [['Método', 'Simpson (1000 tramos)']]);
}, { roles: G.staff });
T('Raíz de función (Newton)', [S('f(x) =', 'x^2 - 2'), N('Valor inicial', 1)], ([e, x]) => {
  need(e, x); for (let k = 0; k < 100; k++) { const f = evaluate(e, { x }), d = (evaluate(e, { x: x + 1e-6 }) - f) / 1e-6; const nx = x - f / d; if (Math.abs(nx - x) < 1e-12) break; x = nx; } return R(x);
}, { roles: G.staff });

group('Álgebra');
T('Ecuación lineal ax + b = 0', [N('a', 3), N('b', -9)], ([a, b]) => { need(a, b); if (!a) throw new Error('a no puede ser 0'); return { big: 'x = ' + fmt(-b / a, 8) }; }, { roles: G.vis });
T('Ecuación cuadrática', [N('a', 1), N('b', -3), N('c', 2)], ([a, b, c]) => {
  need(a, b, c); const d = b * b - 4 * a * c;
  if (d >= 0) return { big: `x₁ = ${fmt((-b + Math.sqrt(d)) / (2 * a), 8)}   x₂ = ${fmt((-b - Math.sqrt(d)) / (2 * a), 8)}`, table: [['Discriminante', fmt(d)], ['Vértice', `(${fmt(-b / (2 * a))}, ${fmt(c - b * b / (4 * a))})`]] };
  const re = -b / (2 * a), im = Math.sqrt(-d) / (2 * a); return { big: `x = ${fmt(re)} ± ${fmt(Math.abs(im))}i`, table: [['Discriminante', fmt(d)]] };
}, { roles: G.vis });
T('Ecuación cúbica', [N('a', 1), N('b', -6), N('c', 11), N('d', -6)], ([a, b, c, d]) => {
  need(a, b, c, d); const roots = []; const f = x => ((a * x + b) * x + c) * x + d;
  for (let x0 = -1000; x0 <= 1000 && roots.length < 3; x0 += 0.5) { const x1 = x0 + .5; if (f(x0) === 0) roots.push(x0); else if (f(x0) * f(x1) < 0) { let lo = x0, hi = x1; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; f(lo) * f(m) <= 0 ? hi = m : lo = m; } roots.push((lo + hi) / 2); } }
  return { big: roots.map((r, k) => `x${k + 1} = ${fmt(r, 6)}`).join('   ') || 'Sin raíces reales en [-1000, 1000]' };
}, { roles: G.staff });
T('Sistema de ecuaciones 2×2', [N('a₁', 2), N('b₁', 3), N('c₁', 8), N('a₂', 1), N('b₂', -1), N('c₂', -1)], ([a, b, c, d, e, f]) => {
  need(a, b, c, d, e, f); const det = a * e - b * d; if (!det) throw new Error('El sistema no tiene solución única');
  return { big: `x = ${fmt((c * e - b * f) / det, 8)}   y = ${fmt((a * f - c * d) / det, 8)}`, desc: 'a₁x + b₁y = c₁ ; a₂x + b₂y = c₂' };
}, { roles: G.vis, desc: 'a₁x + b₁y = c₁ y a₂x + b₂y = c₂' });
T('Sistema de ecuaciones 3×3', [S('Fila 1: a b c = d', '1 1 1 6'), S('Fila 2', '0 2 5 -4'), S('Fila 3', '2 5 -1 27')], (rows) => {
  const M = rows.map(nums); if (M.some(r => r.length !== 4)) throw new Error('Cada fila lleva 4 números');
  for (let i = 0; i < 3; i++) { let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; if (!M[i][i]) throw new Error('Sin solución única');
    for (let k = 0; k < 3; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]; } }
  return { big: ['x', 'y', 'z'].map((v, i) => `${v} = ${fmt(M[i][3] / M[i][i], 6)}`).join('   ') };
}, { roles: G.staff });
T('Determinante 3×3', [S('Fila 1', '2 0 1'), S('Fila 2', '1 3 2'), S('Fila 3', '1 1 1')], (r) => { const m = r.map(nums); if (m.some(x => x.length !== 3)) throw new Error('3 números por fila'); const [[a, b, c], [d, e, f], [g, h, i]] = m; return R(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)); }, { roles: G.staff });
T('Multiplicar matrices 2×2', [S('Matriz A (a b c d)', '1 2 3 4'), S('Matriz B (a b c d)', '5 6 7 8')], ([x, y]) => { const [a, b, c, d] = nums(x), [e, f, g, h] = nums(y); need(a, b, c, d, e, f, g, h); return { big: `[${a * e + b * g}  ${a * f + b * h}]\n[${c * e + d * g}  ${c * f + d * h}]` }; }, { roles: G.staff });
T('Matriz inversa 2×2', [S('Matriz (a b c d)', '4 7 2 6')], ([x]) => { const [a, b, c, d] = nums(x); need(a, b, c, d); const det = a * d - b * c; if (!det) throw new Error('No tiene inversa'); return { big: `[${fmt(d / det, 4)}  ${fmt(-b / det, 4)}]\n[${fmt(-c / det, 4)}  ${fmt(a / det, 4)}]` }; }, { roles: G.staff });
T('Producto punto de vectores', [S('Vector A', '1 2 3'), S('Vector B', '4 5 6')], ([x, y]) => { const a = nums(x), b = nums(y); if (a.length !== b.length) throw new Error('Mismo tamaño'); return R(a.reduce((s, v, i) => s + v * b[i], 0)); }, { roles: G.staff });
T('Producto cruz de vectores', [S('Vector A (x y z)', '1 0 0'), S('Vector B (x y z)', '0 1 0')], ([x, y]) => { const [a, b, c] = nums(x), [d, e, f] = nums(y); need(a, b, c, d, e, f); return { big: `(${fmt(b * f - c * e)}, ${fmt(c * d - a * f)}, ${fmt(a * e - b * d)})` }; }, { roles: G.staff });
T('Magnitud de vector', [S('Vector', '3 4 12')], ([x]) => R(Math.hypot(...nums(x))), { roles: G.staff });
T('Progresión aritmética', [N('Primer término', 3), N('Diferencia', 4), N('Términos', 10)], ([a, d, n]) => { need(a, d, n); return { big: 'Término n: ' + fmt(a + (n - 1) * d), table: [['Suma', fmt(n / 2 * (2 * a + (n - 1) * d))], ['Serie', Array.from({ length: Math.min(n, 30) }, (_, i) => a + i * d).join(', ')]] }; }, { roles: G.vis });
T('Progresión geométrica', [N('Primer término', 2), N('Razón', 3), N('Términos', 8)], ([a, r, n]) => { need(a, r, n); return { big: 'Término n: ' + fmt(a * r ** (n - 1)), table: [['Suma', fmt(r === 1 ? a * n : a * (1 - r ** n) / (1 - r))], ['Serie', Array.from({ length: Math.min(n, 20) }, (_, i) => fmt(a * r ** i)).join(', ')]] }; }, { roles: G.vis });

group('Teoría de números');
T('¿Es número primo?', [N('Número', 97)], ([n]) => { need(n); return { big: isPrime(n) ? 'Sí, es primo' : 'No es primo', table: isPrime(n) ? [] : [['Factores', factors(n).join(' × ') || '—']] }; });
T('Factores primos', [N('Número', 360)], ([n]) => { need(n); const f = factors(n); const g = {}; f.forEach(x => g[x] = (g[x] || 0) + 1); return { big: Object.entries(g).map(([b, e]) => e > 1 ? `${b}^${e}` : b).join(' × '), table: [['Lista', f.join(' × ')]] }; });
T('Divisores de un número', [N('Número', 60)], ([n]) => { need(n); const d = []; for (let k = 1; k <= Math.sqrt(n); k++) if (n % k === 0) { d.push(k); if (k !== n / k) d.push(n / k); } d.sort((a, b) => a - b); return { big: d.length + ' divisores', text: d.join(', '), table: [['Divisores', d.join(', ')], ['Suma', d.reduce((a, b) => a + b, 0)]] }; });
T('Máximo común divisor (MCD)', [A('Números', '48, 180, 36')], ([s]) => { const v = nums(s); need(v.length || ''); return R(v.reduce(gcd)); });
T('Mínimo común múltiplo (mcm)', [A('Números', '4, 6, 15')], ([s]) => { const v = nums(s); need(v.length || ''); return R(v.reduce((a, b) => a * b / gcd(a, b))); });
T('Lista de primos hasta N', [N('N', 100)], ([n]) => { need(n); const p = []; for (let k = 2; k <= Math.min(n, 100000); k++) if (isPrime(k)) p.push(k); return { big: p.length + ' primos', text: p.join(', '), table: [['Primos', p.slice(0, 500).join(', ')]] }; }, { roles: G.vis });
T('Primo número N', [N('N', 100)], ([n]) => { need(n); let c = 0, k = 1; while (c < n && k < 2e7) { k++; if (isPrime(k)) c++; } return R(k); }, { roles: G.vis });
T('Siguiente primo', [N('Desde', 1000)], ([n]) => { need(n); let k = Math.floor(n) + 1; while (!isPrime(k)) k++; return R(k); }, { roles: G.vis });
T('Factorial', [N('n', 20)], ([n]) => { need(n); if (n <= 170 && n === Math.floor(n) && n >= 0) { const b = big(n).toString(); return { big: b.length > 40 ? b.slice(0, 40) + '…' : b, text: b, table: [['Dígitos', b.length]] }; } return R(fact(n)); });
T('Fibonacci', [N('Posición n', 30)], ([n]) => { need(n); let a = 0n, b = 1n; for (let k = 0; k < n; k++) [a, b] = [b, a + b]; return { big: a.toString() }; }, { roles: G.vis });
T('Serie de Fibonacci', [N('Cantidad', 20)], ([n]) => { need(n); const s = [0n, 1n]; while (s.length < n) s.push(s.at(-1) + s.at(-2)); return { big: s.slice(0, n).join(', '), text: s.slice(0, n).join(', ') }; }, { roles: G.vis });
T('Combinaciones nCr', [N('n', 10), N('r', 3)], ([n, r]) => { need(n, r); let v = 1n; for (let k = 0n; k < BigInt(r); k++) v = v * (BigInt(n) - k) / (k + 1n); return { big: v.toString() }; }, { roles: G.vis });
T('Permutaciones nPr', [N('n', 10), N('r', 3)], ([n, r]) => { need(n, r); let v = 1n; for (let k = 0n; k < BigInt(r); k++) v *= BigInt(n) - k; return { big: v.toString() }; }, { roles: G.vis });
T('Combinaciones con repetición', [N('n', 5), N('r', 3)], ([n, r]) => { need(n, r); let v = 1n; const N2 = BigInt(n + r - 1); for (let k = 0n; k < BigInt(r); k++) v = v * (N2 - k) / (k + 1n); return { big: v.toString() }; }, { roles: G.staff });
T('Número par o impar', [N('Número', 7)], ([n]) => { need(n); return { big: n % 2 === 0 ? 'Par' : 'Impar' }; });
T('¿Es número perfecto?', [N('Número', 28)], ([n]) => { need(n); let s = 0; for (let k = 1; k < n; k++) if (n % k === 0) s += k; return { big: s === n ? 'Sí, es perfecto' : 'No', table: [['Suma de divisores propios', s]] }; }, { roles: G.vis });
T('Números coprimos', [N('A', 14), N('B', 25)], ([a, b]) => { need(a, b); return { big: gcd(a, b) === 1 ? 'Sí son coprimos' : 'No (MCD ' + gcd(a, b) + ')' }; }, { roles: G.vis });
T('Función φ de Euler', [N('n', 36)], ([n]) => { need(n); let r = n; for (const p of new Set(factors(n))) r -= r / p; return R(r); }, { roles: G.dev });
T('Potencia modular', [N('Base', 4), N('Exponente', 13), N('Módulo', 497)], ([b, e, m]) => { need(b, e, m); let r = 1n, B2 = BigInt(b) % BigInt(m), E = BigInt(e); const M = BigInt(m); while (E > 0n) { if (E & 1n) r = r * B2 % M; B2 = B2 * B2 % M; E >>= 1n; } return { big: r.toString() }; }, { roles: G.dev });
T('Inverso modular', [N('a', 3), N('Módulo', 11)], ([a, m]) => { need(a, m); for (let x = 1; x < m; x++) if ((a * x) % m === 1) return R(x); throw new Error('No existe inverso'); }, { roles: G.dev });
T('Dígitos y suma de dígitos', [S('Número', '9876543210')], ([s]) => { const d = s.replace(/\D/g, ''); need(d); return { big: d.split('').reduce((a, b) => a + +b, 0) + '', table: [['Cantidad de dígitos', d.length], ['Raíz digital', 1 + (d.split('').reduce((a, b) => a + +b, 0) - 1) % 9]] }; });
T('¿Es palíndromo numérico?', [S('Número', '12321')], ([s]) => ({ big: s && s === [...s].reverse().join('') ? 'Sí' : 'No' }));

// ------------------------------------------------------------- geometria
cat('geo', 'Geometría', 'layers', G.vis, 'Áreas, perímetros, volúmenes y coordenadas');
group('Áreas y perímetros');
const shapes2d = [
  ['Cuadrado', [N('Lado', 5)], ([l]) => [l * l, 4 * l, [['Diagonal', fmt(l * Math.SQRT2)]]]],
  ['Rectángulo', [N('Base', 8), N('Altura', 3)], ([b, h]) => [b * h, 2 * (b + h), [['Diagonal', fmt(Math.hypot(b, h))]]]],
  ['Círculo', [N('Radio', 4)], ([r]) => [Math.PI * r * r, 2 * Math.PI * r, [['Diámetro', fmt(2 * r)]]]],
  ['Triángulo (base y altura)', [N('Base', 6), N('Altura', 4)], ([b, h]) => [b * h / 2, NaN]],
  ['Triángulo (3 lados, Herón)', [N('Lado a', 3), N('Lado b', 4), N('Lado c', 5)], ([a, b, c]) => { const s = (a + b + c) / 2; return [Math.sqrt(s * (s - a) * (s - b) * (s - c)), a + b + c]; }],
  ['Triángulo equilátero', [N('Lado', 6)], ([l]) => [Math.sqrt(3) / 4 * l * l, 3 * l, [['Altura', fmt(Math.sqrt(3) / 2 * l)]]]],
  ['Trapecio', [N('Base mayor', 10), N('Base menor', 6), N('Altura', 4), N('Lado 1', 4.5), N('Lado 2', 4.5)], ([B1, b, h, l1, l2]) => [(B1 + b) * h / 2, B1 + b + l1 + l2]],
  ['Rombo', [N('Diagonal mayor', 10), N('Diagonal menor', 6)], ([D2, d]) => [D2 * d / 2, 4 * Math.hypot(D2 / 2, d / 2)]],
  ['Paralelogramo', [N('Base', 8), N('Altura', 5), N('Lado', 6)], ([b, h, l]) => [b * h, 2 * (b + l)]],
  ['Elipse', [N('Semieje a', 5), N('Semieje b', 3)], ([a, b]) => [Math.PI * a * b, Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))]],
  ['Polígono regular', [N('Número de lados', 6), N('Lado', 4)], ([n, l]) => [n * l * l / (4 * Math.tan(Math.PI / n)), n * l, [['Apotema', fmt(l / (2 * Math.tan(Math.PI / n)))], ['Ángulo interior', fmt((n - 2) * 180 / n) + '°']]]],
  ['Sector circular', [N('Radio', 5), N('Ángulo °', 60)], ([r, a]) => [Math.PI * r * r * a / 360, 2 * r + 2 * Math.PI * r * a / 360, [['Longitud de arco', fmt(2 * Math.PI * r * a / 360)]]]],
  ['Corona circular', [N('Radio mayor', 6), N('Radio menor', 4)], ([R2, r]) => [Math.PI * (R2 * R2 - r * r), 2 * Math.PI * (R2 + r)]],
  ['Pentágono regular', [N('Lado', 5)], ([l]) => [l * l * Math.sqrt(5 * (5 + 2 * Math.sqrt(5))) / 4, 5 * l]],
  ['Hexágono regular', [N('Lado', 5)], ([l]) => [3 * Math.sqrt(3) / 2 * l * l, 6 * l]],
  ['Octágono regular', [N('Lado', 5)], ([l]) => [2 * (1 + Math.SQRT2) * l * l, 8 * l]],
];
for (const [name, inp, f] of shapes2d) T('Área de ' + name.toLowerCase(), inp, (v) => { need(...v); const [a, p, ex = []] = f(v); return { big: fmt(a, 6) + ' u²', table: [...(isFinite(p) ? [['Perímetro', fmt(p, 6) + ' u']] : []), ...ex] }; });
group('Volúmenes');
const shapes3d = [
  ['Cubo', [N('Arista', 3)], ([a]) => [a ** 3, 6 * a * a]],
  ['Prisma rectangular', [N('Largo', 4), N('Ancho', 3), N('Alto', 2)], ([l, w, h]) => [l * w * h, 2 * (l * w + l * h + w * h)]],
  ['Esfera', [N('Radio', 3)], ([r]) => [4 / 3 * Math.PI * r ** 3, 4 * Math.PI * r * r]],
  ['Semiesfera', [N('Radio', 3)], ([r]) => [2 / 3 * Math.PI * r ** 3, 3 * Math.PI * r * r]],
  ['Cilindro', [N('Radio', 2), N('Altura', 5)], ([r, h]) => [Math.PI * r * r * h, 2 * Math.PI * r * (r + h)]],
  ['Cono', [N('Radio', 2), N('Altura', 5)], ([r, h]) => [Math.PI * r * r * h / 3, Math.PI * r * (r + Math.hypot(r, h))]],
  ['Pirámide cuadrada', [N('Lado de la base', 4), N('Altura', 6)], ([l, h]) => [l * l * h / 3, l * l + 2 * l * Math.hypot(l / 2, h)]],
  ['Tronco de cono', [N('Radio mayor', 4), N('Radio menor', 2), N('Altura', 5)], ([R2, r, h]) => [Math.PI * h / 3 * (R2 * R2 + R2 * r + r * r), Math.PI * (R2 + r) * Math.hypot(R2 - r, h) + Math.PI * (R2 * R2 + r * r)]],
  ['Prisma triangular', [N('Base del triángulo', 3), N('Altura del triángulo', 4), N('Largo', 10)], ([b, h, l]) => [b * h / 2 * l, NaN]],
  ['Elipsoide', [N('Semieje a', 3), N('Semieje b', 2), N('Semieje c', 1)], ([a, b, c]) => [4 / 3 * Math.PI * a * b * c, NaN]],
  ['Toro (dona)', [N('Radio mayor', 5), N('Radio del tubo', 1)], ([R2, r]) => [2 * Math.PI * Math.PI * R2 * r * r, 4 * Math.PI * Math.PI * R2 * r]],
  ['Tanque cilíndrico en litros', [N('Diámetro (cm)', 100), N('Altura (cm)', 150)], ([d, h]) => [Math.PI * (d / 2) ** 2 * h / 1000, NaN]],
];
for (const [name, inp, f] of shapes3d) T('Volumen de ' + name.toLowerCase(), inp, (v) => { need(...v); const [vol, s] = f(v); return { big: fmt(vol, 6) + (name.includes('litros') ? ' L' : ' u³'), table: isFinite(s) ? [['Superficie', fmt(s, 6) + ' u²']] : [] }; });
group('Triángulos y coordenadas');
T('Teorema de Pitágoras (hipotenusa)', [N('Cateto a', 3), N('Cateto b', 4)], ([a, b]) => { need(a, b); return R(Math.hypot(a, b)); });
T('Teorema de Pitágoras (cateto)', [N('Hipotenusa', 13), N('Cateto conocido', 5)], ([c, a]) => { need(c, a); return R(Math.sqrt(c * c - a * a)); });
T('Resolver triángulo (3 lados)', [N('a', 7), N('b', 8), N('c', 9)], ([a, b, c]) => { need(a, b, c); const A2 = Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180 / Math.PI, B2 = Math.acos((a * a + c * c - b * b) / (2 * a * c)) * 180 / Math.PI; return table([['Ángulo A', fmt(A2, 4) + '°'], ['Ángulo B', fmt(B2, 4) + '°'], ['Ángulo C', fmt(180 - A2 - B2, 4) + '°']]); });
T('Ley de senos (lado)', [N('Lado a', 10), N('Ángulo A °', 30), N('Ángulo B °', 45)], ([a, A2, B2]) => { need(a, A2, B2); return R(a * Math.sin(B2 * Math.PI / 180) / Math.sin(A2 * Math.PI / 180)); });
T('Ley de cosenos (lado)', [N('Lado b', 5), N('Lado c', 7), N('Ángulo A °', 60)], ([b, c, A2]) => { need(b, c, A2); return R(Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A2 * Math.PI / 180))); });
T('Distancia entre dos puntos', [N('x₁', 1), N('y₁', 2), N('x₂', 4), N('y₂', 6)], ([a, b, c, d]) => { need(a, b, c, d); return R(Math.hypot(c - a, d - b)); });
T('Punto medio', [N('x₁', 1), N('y₁', 2), N('x₂', 4), N('y₂', 6)], ([a, b, c, d]) => { need(a, b, c, d); return { big: `(${fmt((a + c) / 2)}, ${fmt((b + d) / 2)})` }; });
T('Pendiente y ecuación de la recta', [N('x₁', 1), N('y₁', 2), N('x₂', 4), N('y₂', 8)], ([a, b, c, d]) => { need(a, b, c, d); const m = (d - b) / (c - a); return { big: `y = ${fmt(m)}x ${b - m * a >= 0 ? '+' : '−'} ${fmt(Math.abs(b - m * a))}`, table: [['Pendiente', fmt(m)], ['Ángulo', fmt(Math.atan(m) * 180 / Math.PI, 4) + '°']] }; });
T('Distancia de punto a recta', [N('Punto x', 3), N('Punto y', 4), N('A (Ax+By+C=0)', 1), N('B', -1), N('C', 0)], ([x, y, a, b, c]) => { need(x, y, a, b, c); return R(Math.abs(a * x + b * y + c) / Math.hypot(a, b)); });
T('Área de polígono por coordenadas', [A('Puntos x,y uno por línea', '0,0\n4,0\n4,3\n0,3')], ([s]) => { const p = s.trim().split('\n').map(l => nums(l)); if (p.length < 3) throw new Error('Mínimo 3 puntos'); let a = 0; p.forEach((q, i) => { const r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; }); return R(Math.abs(a) / 2); });
T('Coordenadas polares a cartesianas', [N('Radio', 5), N('Ángulo °', 53.13)], ([r, a]) => { need(r, a); return { big: `(${fmt(r * Math.cos(a * Math.PI / 180), 6)}, ${fmt(r * Math.sin(a * Math.PI / 180), 6)})` }; });
T('Coordenadas cartesianas a polares', [N('x', 3), N('y', 4)], ([x, y]) => { need(x, y); return { big: `r = ${fmt(Math.hypot(x, y), 6)}, θ = ${fmt(Math.atan2(y, x) * 180 / Math.PI, 6)}°` }; });
T('Ángulos de un polígono', [N('Número de lados', 8)], ([n]) => { need(n); return table([['Suma de ángulos interiores', fmt((n - 2) * 180) + '°'], ['Ángulo interior', fmt((n - 2) * 180 / n, 4) + '°'], ['Ángulo exterior', fmt(360 / n, 4) + '°'], ['Diagonales', n * (n - 3) / 2]]); });
T('Escala de mapa o plano', [N('Medida en el plano (cm)', 5), N('Escala 1 :', 50000)], ([m, e]) => { need(m, e); return { big: fmt(m * e / 100000, 4) + ' km', table: [['Metros', fmt(m * e / 100)]] }; });
T('Pendiente de terreno o rampa', [N('Altura (m)', 1), N('Distancia horizontal (m)', 12)], ([h, d]) => { need(h, d); return { big: fmt(h / d * 100, 3) + ' %', table: [['Ángulo', fmt(Math.atan(h / d) * 180 / Math.PI, 3) + '°'], ['Largo de la rampa', fmt(Math.hypot(h, d), 3) + ' m']] }; });

// ------------------------------------------------------------- estadistica
cat('stat', 'Estadística', 'chart', G.staff, 'Promedios, dispersión, probabilidad y regresión');
group('Descriptiva');
const st = (v) => { const n = v.length, s = [...v].sort((a, b) => a - b), mean = v.reduce((a, b) => a + b, 0) / n, q = p => { const i = (n - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
  const vp = v.reduce((a, b) => a + (b - mean) ** 2, 0) / n, vs = n > 1 ? vp * n / (n - 1) : 0; return { n, s, mean, q, vp, vs }; };
const D1 = A('Datos (separados por coma, espacio o línea)', '4, 8, 15, 16, 23, 42');
const statTool = (name, f) => T(name, [D1], ([x]) => { const v = nums(x); if (!v.length) throw new Error('Escribe datos'); return f(st(v), v); });
statTool('Resumen estadístico completo', (o) => table([['Cantidad', o.n], ['Suma', fmt(o.mean * o.n)], ['Media', fmt(o.mean)], ['Mediana', fmt(o.q(.5))], ['Mínimo', fmt(o.s[0])], ['Máximo', fmt(o.s.at(-1))],
  ['Rango', fmt(o.s.at(-1) - o.s[0])], ['Q1', fmt(o.q(.25))], ['Q3', fmt(o.q(.75))], ['Desviación estándar (muestra)', fmt(Math.sqrt(o.vs))], ['Desviación estándar (población)', fmt(Math.sqrt(o.vp))], ['Varianza (muestra)', fmt(o.vs)]]));
statTool('Media aritmética', o => R(o.mean));
statTool('Mediana', o => R(o.q(.5)));
statTool('Moda', (o, v) => { const c = {}; v.forEach(x => c[x] = (c[x] || 0) + 1); const m = Math.max(...Object.values(c)); return { big: m === 1 ? 'Sin moda' : Object.keys(c).filter(k => c[k] === m).join(', '), table: [['Repeticiones', m]] }; });
statTool('Media geométrica', (o, v) => R(Math.exp(v.reduce((a, b) => a + Math.log(b), 0) / v.length)));
statTool('Media armónica', (o, v) => R(v.length / v.reduce((a, b) => a + 1 / b, 0)));
statTool('Media cuadrática', (o, v) => R(Math.sqrt(v.reduce((a, b) => a + b * b, 0) / v.length)));
statTool('Desviación estándar', o => R(Math.sqrt(o.vs), [['Población', fmt(Math.sqrt(o.vp))]]));
statTool('Varianza', o => R(o.vs, [['Población', fmt(o.vp)]]));
statTool('Rango y extremos', o => table([['Mínimo', fmt(o.s[0])], ['Máximo', fmt(o.s.at(-1))], ['Rango', fmt(o.s.at(-1) - o.s[0])]]));
statTool('Cuartiles y rango intercuartil', o => table([['Q1', fmt(o.q(.25))], ['Q2', fmt(o.q(.5))], ['Q3', fmt(o.q(.75))], ['RIC', fmt(o.q(.75) - o.q(.25))]]));
statTool('Coeficiente de variación', o => ({ big: fmt(Math.sqrt(o.vs) / o.mean * 100, 4) + ' %' }));
statTool('Ordenar datos', o => ({ big: o.s.join(', '), text: o.s.join(', ') }));
statTool('Puntuaciones Z', (o, v) => table(v.map(x => [String(x), fmt((x - o.mean) / Math.sqrt(o.vs), 4)])));
statTool('Detectar valores atípicos', (o, v) => { const i = o.q(.75) - o.q(.25), lo = o.q(.25) - 1.5 * i, hi = o.q(.75) + 1.5 * i; const out = v.filter(x => x < lo || x > hi); return { big: out.length ? out.join(', ') : 'Sin atípicos', table: [['Límite inferior', fmt(lo)], ['Límite superior', fmt(hi)]] }; });
statTool('Tabla de frecuencias', (o, v) => { const c = {}; v.forEach(x => c[x] = (c[x] || 0) + 1); let acc = 0; return table(Object.keys(c).sort((a, b) => a - b).map(k => { acc += c[k]; return [k, `f=${c[k]} · ${fmt(c[k] / v.length * 100, 2)}% · acum ${acc}`]; })); });
statTool('Histograma', (o, v) => { const k = Math.ceil(Math.log2(v.length) + 1), mn = o.s[0], w = (o.s.at(-1) - mn) / k || 1, bins = Array(k).fill(0); v.forEach(x => bins[Math.min(k - 1, Math.floor((x - mn) / w))]++); const mx = Math.max(...bins);
  return { html: `<div class="bars">${bins.map((b, i) => `<div class="bar-row"><span>${fmt(mn + i * w, 2)}</span><i style="width:${b / mx * 100}%"></i><b>${b}</b></div>`).join('')}</div>` }; });
statTool('Percentil de los datos', (o) => table([5, 10, 25, 50, 75, 90, 95, 99].map(p => ['P' + p, fmt(o.q(p / 100))])));
T('Media ponderada', [A('Valores', '80, 90, 70'), A('Pesos', '30, 50, 20')], ([a, b]) => { const v = nums(a), w = nums(b); if (v.length !== w.length) throw new Error('Misma cantidad de valores y pesos'); return R(v.reduce((s, x, i) => s + x * w[i], 0) / w.reduce((s, x) => s + x, 0)); });
group('Relación entre variables');
T('Regresión lineal', [A('Valores X', '1, 2, 3, 4, 5'), A('Valores Y', '2.1, 3.9, 6.2, 7.8, 10.1')], ([a, b]) => {
  const x = nums(a), y = nums(b); if (x.length !== y.length || x.length < 2) throw new Error('Mismo número de X e Y (mínimo 2)');
  const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
  const m = sxy / sxx, c = my - m * mx; return { big: `y = ${fmt(m, 6)}x ${c >= 0 ? '+' : '−'} ${fmt(Math.abs(c), 6)}`, table: [['Correlación r', fmt(sxy / Math.sqrt(sxx * syy), 6)], ['R²', fmt(sxy * sxy / (sxx * syy), 6)]] };
});
T('Correlación de Pearson', [A('Valores X', '1, 2, 3, 4, 5'), A('Valores Y', '5, 4, 3, 2, 1')], ([a, b]) => {
  const x = nums(a), y = nums(b); if (x.length !== y.length) throw new Error('Misma cantidad'); const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; }); const r = sxy / Math.sqrt(sxx * syy);
  return { big: fmt(r, 6), table: [['Interpretación', Math.abs(r) > .7 ? 'Fuerte' : Math.abs(r) > .4 ? 'Moderada' : 'Débil']] };
});
group('Probabilidad');
const erf = (x) => { const t = 1 / (1 + .3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
T('Distribución normal (probabilidad acumulada)', [N('Valor x', 1.96), N('Media', 0), N('Desviación', 1)], ([x, m, s]) => { need(x, m, s); const p = .5 * (1 + erf((x - m) / (s * Math.SQRT2))); return { big: fmt(p * 100, 4) + ' %', table: [['P(X > x)', fmt((1 - p) * 100, 4) + ' %']] }; });
T('Distribución binomial', [N('Ensayos n', 10), N('Éxitos k', 3), N('Probabilidad p', .5)], ([n, k, p]) => { need(n, k, p); let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); const v = c * p ** k * (1 - p) ** (n - k); return { big: fmt(v * 100, 4) + ' %' }; });
T('Distribución de Poisson', [N('Promedio λ', 3), N('Eventos k', 2)], ([l, k]) => { need(l, k); return { big: fmt(Math.exp(-l) * l ** k / fact(k) * 100, 4) + ' %' }; });
T('Probabilidad de eventos independientes', [N('P(A) %', 50), N('P(B) %', 30)], ([a, b]) => { need(a, b); a /= 100; b /= 100; return table([['A y B', pctS(a * b)], ['A o B', pctS(a + b - a * b)], ['Ni A ni B', pctS((1 - a) * (1 - b))], ['Solo A', pctS(a * (1 - b))]]); });
const pctS = (x) => fmt(x * 100, 4) + ' %';
T('Tamaño de muestra', [N('Población', 10000), N('Confianza %', 95), N('Margen de error %', 5)], ([N2, c, e]) => { need(N2, c, e); const z = { 90: 1.645, 95: 1.96, 99: 2.576 }[c] || 1.96; const n0 = z * z * .25 / (e / 100) ** 2; return R(Math.ceil(n0 / (1 + (n0 - 1) / N2))); });
T('Intervalo de confianza de la media', [N('Media', 50), N('Desviación', 10), N('Tamaño n', 100), N('Confianza %', 95)], ([m, s, n, c]) => { need(m, s, n, c); const z = { 90: 1.645, 95: 1.96, 99: 2.576 }[c] || 1.96; const e = z * s / Math.sqrt(n); return { big: `${fmt(m - e, 4)} a ${fmt(m + e, 4)}`, table: [['Margen', fmt(e, 4)]] }; });
T('Probabilidad de cumpleaños compartido', [N('Personas', 23)], ([n]) => { need(n); let p = 1; for (let i = 0; i < n; i++) p *= (365 - i) / 365; return { big: pctS(1 - p) }; });
T('Probabilidad de lotería', [N('Números totales', 49), N('Números a acertar', 6)], ([n, k]) => { need(n, k); let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return { big: '1 en ' + Math.round(c).toLocaleString('es') }; }, { roles: G.vis });

// ------------------------------------------------------------- fisica y quimica
cat('sci', 'Ciencia', 'atom', ['visitante', 'verificador', 'programador', 'admin'], 'Física, electricidad y química');
group('Mecánica');
const g = 9.80665;
T('Velocidad (distancia/tiempo)', [N('Distancia (m)', 100), N('Tiempo (s)', 9.58)], ([d, t]) => { need(d, t); return { big: fmt(d / t, 4) + ' m/s', table: [['km/h', fmt(d / t * 3.6, 4)]] }; });
T('Distancia recorrida', [N('Velocidad (km/h)', 80), N('Tiempo (h)', 2.5)], ([v, t]) => { need(v, t); return { big: fmt(v * t, 4) + ' km' }; });
T('Tiempo de viaje', [N('Distancia (km)', 300), N('Velocidad (km/h)', 90)], ([d, v]) => { need(d, v); const h = d / v; return { big: `${Math.floor(h)} h ${Math.round(h % 1 * 60)} min` }; });
T('Aceleración', [N('Velocidad inicial (m/s)', 0), N('Velocidad final (m/s)', 27.8), N('Tiempo (s)', 6)], ([a, b, t]) => { need(a, b, t); return { big: fmt((b - a) / t, 4) + ' m/s²' }; });
T('Fuerza (segunda ley de Newton)', [N('Masa (kg)', 70), N('Aceleración (m/s²)', 9.81)], ([m, a]) => { need(m, a); return { big: fmt(m * a, 4) + ' N' }; });
T('Peso en la Tierra', [N('Masa (kg)', 70)], ([m]) => { need(m); return { big: fmt(m * g, 4) + ' N' }; });
T('Peso en otros planetas', [N('Masa (kg)', 70)], ([m]) => { need(m); return table([['Luna', 1.62], ['Marte', 3.71], ['Venus', 8.87], ['Júpiter', 24.79], ['Saturno', 10.44], ['Mercurio', 3.7], ['Sol', 274]].map(([p, gg]) => [p, `${fmt(m * gg, 2)} N (como ${fmt(m * gg / g, 1)} kg en la Tierra)`])); });
T('Energía cinética', [N('Masa (kg)', 1000), N('Velocidad (m/s)', 20)], ([m, v]) => { need(m, v); return { big: fmt(.5 * m * v * v, 4) + ' J' }; });
T('Energía potencial', [N('Masa (kg)', 10), N('Altura (m)', 5)], ([m, h]) => { need(m, h); return { big: fmt(m * g * h, 4) + ' J' }; });
T('Trabajo', [N('Fuerza (N)', 50), N('Distancia (m)', 10), N('Ángulo °', 0)], ([f, d, a]) => { need(f, d, a); return { big: fmt(f * d * Math.cos(a * Math.PI / 180), 4) + ' J' }; });
T('Potencia mecánica', [N('Trabajo (J)', 1000), N('Tiempo (s)', 10)], ([w, t]) => { need(w, t); return { big: fmt(w / t, 4) + ' W', table: [['hp', fmt(w / t / 745.7, 4)]] }; });
T('Momento lineal', [N('Masa (kg)', 5), N('Velocidad (m/s)', 3)], ([m, v]) => { need(m, v); return { big: fmt(m * v, 4) + ' kg·m/s' }; });
T('Caída libre', [N('Altura (m)', 20)], ([h]) => { need(h); const t = Math.sqrt(2 * h / g); return table([['Tiempo', fmt(t, 4) + ' s'], ['Velocidad al llegar', fmt(g * t, 4) + ' m/s (' + fmt(g * t * 3.6, 2) + ' km/h)']]); });
T('Tiro parabólico', [N('Velocidad (m/s)', 20), N('Ángulo °', 45)], ([v, a]) => { need(v, a); const r = a * Math.PI / 180; return table([['Alcance', fmt(v * v * Math.sin(2 * r) / g, 4) + ' m'], ['Altura máxima', fmt((v * Math.sin(r)) ** 2 / (2 * g), 4) + ' m'], ['Tiempo de vuelo', fmt(2 * v * Math.sin(r) / g, 4) + ' s']]); });
T('Movimiento circular', [N('Radio (m)', 2), N('Velocidad (m/s)', 4)], ([r, v]) => { need(r, v); return table([['Aceleración centrípeta', fmt(v * v / r, 4) + ' m/s²'], ['Periodo', fmt(2 * Math.PI * r / v, 4) + ' s'], ['RPM', fmt(v / (2 * Math.PI * r) * 60, 4)]]); });
T('Péndulo simple', [N('Largo (m)', 1)], ([l]) => { need(l); return { big: fmt(2 * Math.PI * Math.sqrt(l / g), 4) + ' s' }; });
T('Densidad', [N('Masa (kg)', 2), N('Volumen (m³)', .001)], ([m, v]) => { need(m, v); return { big: fmt(m / v, 4) + ' kg/m³' }; });
T('Presión (fuerza/área)', [N('Fuerza (N)', 500), N('Área (m²)', .25)], ([f, a]) => { need(f, a); return { big: fmt(f / a, 4) + ' Pa' }; });
T('Presión hidrostática', [N('Profundidad (m)', 10), N('Densidad (kg/m³)', 1000)], ([h, d]) => { need(h, d); return { big: fmt(d * g * h, 4) + ' Pa', table: [['atm', fmt(d * g * h / 101325, 4)]] }; });
T('Ley de gravitación universal', [N('Masa 1 (kg)', 5.97e24), N('Masa 2 (kg)', 7.35e22), N('Distancia (m)', 3.84e8)], ([a, b, d]) => { need(a, b, d); return { big: fmt(6.674e-11 * a * b / (d * d), 4) + ' N' }; });
T('Ley de Hooke (resorte)', [N('Constante k (N/m)', 200), N('Estiramiento (m)', .05)], ([k, x]) => { need(k, x); return table([['Fuerza', fmt(k * x, 4) + ' N'], ['Energía', fmt(.5 * k * x * x, 4) + ' J']]); });
T('Distancia de frenado', [N('Velocidad (km/h)', 80), N('Fricción (0.7 seco)', .7)], ([v, mu]) => { need(v, mu); const ms = v / 3.6; return table([['Frenado', fmt(ms * ms / (2 * mu * g), 3) + ' m'], ['Reacción (1 s)', fmt(ms, 3) + ' m'], ['Total', fmt(ms * ms / (2 * mu * g) + ms, 3) + ' m']]); });
T('Distancia de un rayo', [N('Segundos entre rayo y trueno', 3)], ([s]) => { need(s); return { big: fmt(s * 343, 3) + ' m' }; }, { roles: G.vis });
T('Efecto Doppler', [N('Frecuencia (Hz)', 440), N('Velocidad de la fuente (m/s, + acerca)', 30)], ([f, v]) => { need(f, v); return { big: fmt(f * 343 / (343 - v), 4) + ' Hz' }; });
T('Longitud de onda', [N('Frecuencia (Hz)', 100e6), N('Velocidad (m/s)', 299792458)], ([f, v]) => { need(f, v); return { big: fmt(v / f, 6) + ' m' }; });
T('Equivalencia masa-energía E=mc²', [N('Masa (kg)', .001)], ([m]) => { need(m); return { big: fmt(m * 299792458 ** 2, 4) + ' J', table: [['kWh', fmt(m * 299792458 ** 2 / 3.6e6, 4)]] }; });
group('Electricidad');
T('Ley de Ohm: voltaje', [N('Corriente (A)', 2), N('Resistencia (Ω)', 110)], ([i, r]) => { need(i, r); return { big: fmt(i * r, 4) + ' V' }; });
T('Ley de Ohm: corriente', [N('Voltaje (V)', 120), N('Resistencia (Ω)', 60)], ([v, r]) => { need(v, r); return { big: fmt(v / r, 4) + ' A' }; });
T('Ley de Ohm: resistencia', [N('Voltaje (V)', 12), N('Corriente (A)', .5)], ([v, i]) => { need(v, i); return { big: fmt(v / i, 4) + ' Ω' }; });
T('Potencia eléctrica', [N('Voltaje (V)', 120), N('Corriente (A)', 10)], ([v, i]) => { need(v, i); return { big: fmt(v * i, 4) + ' W' }; });
T('Resistencias en serie', [A('Resistencias (Ω)', '100, 220, 330')], ([s]) => R(nums(s).reduce((a, b) => a + b, 0)));
T('Resistencias en paralelo', [A('Resistencias (Ω)', '100, 220, 330')], ([s]) => R(1 / nums(s).reduce((a, b) => a + 1 / b, 0)));
T('Capacitores en serie', [A('Capacitancias (µF)', '10, 22')], ([s]) => ({ big: fmt(1 / nums(s).reduce((a, b) => a + 1 / b, 0), 6) + ' µF' }));
T('Capacitores en paralelo', [A('Capacitancias (µF)', '10, 22')], ([s]) => ({ big: fmt(nums(s).reduce((a, b) => a + b, 0), 6) + ' µF' }));
T('Divisor de voltaje', [N('Voltaje de entrada (V)', 12), N('R1 (Ω)', 1000), N('R2 (Ω)', 2000)], ([v, a, b]) => { need(v, a, b); return { big: fmt(v * b / (a + b), 4) + ' V' }; });
T('Resistencia para LED', [N('Voltaje fuente (V)', 5), N('Voltaje del LED (V)', 2), N('Corriente (mA)', 20)], ([v, l, i]) => { need(v, l, i); const r = (v - l) / (i / 1000); return table([['Resistencia', fmt(r, 2) + ' Ω'], ['Potencia', fmt((v - l) * i / 1000, 3) + ' W']]); });
T('Código de colores de resistencia', [SEL('Banda 1', COL()), SEL('Banda 2', COL(), 'Negro'), SEL('Multiplicador', COL(), 'Rojo'), SEL('Tolerancia', ['Dorado ±5%', 'Plateado ±10%', 'Marrón ±1%', 'Rojo ±2%'])], ([a, b, m, t]) => {
  const c = COL(); const v = (c.indexOf(a) * 10 + c.indexOf(b)) * 10 ** c.indexOf(m); return { big: (v >= 1e6 ? fmt(v / 1e6) + ' MΩ' : v >= 1e3 ? fmt(v / 1e3) + ' kΩ' : v + ' Ω') + ' ' + t.split(' ')[1] };
});
function COL() { return ['Negro', 'Marrón', 'Rojo', 'Naranja', 'Amarillo', 'Verde', 'Azul', 'Violeta', 'Gris', 'Blanco']; }
T('Consumo eléctrico y costo', [N('Potencia del aparato (W)', 1200), N('Horas al día', 3), N('Precio kWh (Q)', 1.8)], ([w, h, p]) => { need(w, h, p); const kwh = w * h / 1000; return table([['kWh por día', fmt(kwh, 3)], ['kWh por mes', fmt(kwh * 30, 2)], ['Costo por mes', 'Q ' + fmt(kwh * 30 * p, 2)], ['Costo por año', 'Q ' + fmt(kwh * 365 * p, 2)]]); }, { roles: G.all });
T('Duración de batería', [N('Capacidad (mAh)', 5000), N('Consumo (mA)', 350)], ([c, i]) => { need(c, i); const h = c / i * .85; return { big: `${Math.floor(h)} h ${Math.round(h % 1 * 60)} min`, table: [['Con 85% de eficiencia', '']] }; }, { roles: G.all });
T('Calibre de cable recomendado', [N('Corriente (A)', 20)], ([i]) => { need(i); const t = [[15, '14 AWG'], [20, '12 AWG'], [30, '10 AWG'], [40, '8 AWG'], [55, '6 AWG'], [70, '4 AWG'], [95, '2 AWG'], [Infinity, '1/0 AWG o mayor']]; return { big: t.find(x => i <= x[0])[1] }; });
T('Paneles solares necesarios', [N('Consumo diario (kWh)', 8), N('Horas de sol', 5), N('Panel (W)', 450)], ([k, h, w]) => { need(k, h, w); return { big: Math.ceil(k * 1000 / (h * w * .8)) + ' paneles', table: [['Potencia total', fmt(k * 1000 / (h * .8), 0) + ' W']] }; }, { roles: G.boss.concat(G.tech) });
group('Química');
const EL = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
const MASS = [1.008, 4.0026, 6.94, 9.0122, 10.81, 12.011, 14.007, 15.999, 18.998, 20.18, 22.99, 24.305, 26.982, 28.085, 30.974, 32.06, 35.45, 39.948, 39.098, 40.078, 44.956, 47.867, 50.942, 51.996, 54.938, 55.845, 58.933, 58.693, 63.546, 65.38, 69.723, 72.63, 74.922, 78.971, 79.904, 83.798, 85.468, 87.62, 88.906, 91.224, 92.906, 95.95, 98, 101.07, 102.91, 106.42, 107.87, 112.41, 114.82, 118.71, 121.76, 127.6, 126.9, 131.29, 132.91, 137.33, 138.91, 140.12, 140.91, 144.24, 145, 150.36, 151.96, 157.25, 158.93, 162.5, 164.93, 167.26, 168.93, 173.05, 174.97, 178.49, 180.95, 183.84, 186.21, 190.23, 192.22, 195.08, 196.97, 200.59, 204.38, 207.2, 208.98, 209, 210, 222, 223, 226, 227, 232.04, 231.04, 238.03, 237, 244, 243, 247, 247, 251, 252, 257, 258, 259, 266, 267, 268, 269, 270, 277, 278, 281, 282, 285, 286, 289, 290, 293, 294, 294];
const NAMES = 'Hidrógeno Helio Litio Berilio Boro Carbono Nitrógeno Oxígeno Flúor Neón Sodio Magnesio Aluminio Silicio Fósforo Azufre Cloro Argón Potasio Calcio Escandio Titanio Vanadio Cromo Manganeso Hierro Cobalto Níquel Cobre Zinc Galio Germanio Arsénico Selenio Bromo Kriptón Rubidio Estroncio Itrio Circonio Niobio Molibdeno Tecnecio Rutenio Rodio Paladio Plata Cadmio Indio Estaño Antimonio Telurio Yodo Xenón Cesio Bario Lantano Cerio Praseodimio Neodimio Prometio Samario Europio Gadolinio Terbio Disprosio Holmio Erbio Tulio Iterbio Lutecio Hafnio Tantalio Wolframio Renio Osmio Iridio Platino Oro Mercurio Talio Plomo Bismuto Polonio Astato Radón Francio Radio Actinio Torio Protactinio Uranio Neptunio Plutonio Americio Curio Berkelio Californio Einstenio Fermio Mendelevio Nobelio Laurencio Rutherfordio Dubnio Seaborgio Bohrio Hasio Meitnerio Darmstatio Roentgenio Copernicio Nihonio Flerovio Moscovio Livermorio Teneso Oganesón'.split(' ');
T('Buscar elemento químico', [S('Nombre, símbolo o número', 'Fe')], ([q]) => {
  q = q.trim(); need(q); const i = /^\d+$/.test(q) ? +q - 1 : EL.findIndex(e => e.toLowerCase() === q.toLowerCase()) >= 0 ? EL.findIndex(e => e.toLowerCase() === q.toLowerCase()) : NAMES.findIndex(n => n.toLowerCase().startsWith(q.toLowerCase()));
  if (i < 0 || i >= EL.length) throw new Error('No encontrado'); return { big: `${EL[i]} · ${NAMES[i]}`, table: [['Número atómico', i + 1], ['Masa atómica', MASS[i] + ' u']] };
});
export function molarMass(f) {
  const tok = f.match(/([A-Z][a-z]?|\d+|\(|\))/g); if (!tok) throw new Error('Fórmula vacía'); const stack = [{}]; let i = 0;
  while (i < tok.length) { const t = tok[i++];
    if (t === '(') stack.push({}); else if (t === ')') { const g2 = stack.pop(); let m = 1; if (/^\d+$/.test(tok[i] || '')) m = +tok[i++]; for (const k in g2) stack.at(-1)[k] = (stack.at(-1)[k] || 0) + g2[k] * m; }
    else if (/^[A-Z]/.test(t)) { const idx = EL.indexOf(t); if (idx < 0) throw new Error('Elemento desconocido: ' + t); let m = 1; if (/^\d+$/.test(tok[i] || '')) m = +tok[i++]; stack.at(-1)[t] = (stack.at(-1)[t] || 0) + m; } }
  const c = stack[0]; let tot = 0; for (const k in c) tot += MASS[EL.indexOf(k)] * c[k]; return { tot, c };
}
T('Masa molar de un compuesto', [S('Fórmula', 'C6H12O6')], ([f]) => { need(f.trim()); const { tot, c } = molarMass(f.trim()); return { big: fmt(tot, 4) + ' g/mol', table: Object.entries(c).map(([k, v]) => [k + ' × ' + v, fmt(MASS[EL.indexOf(k)] * v / tot * 100, 2) + ' %']) }; });
T('Gramos a moles', [S('Fórmula', 'H2O'), N('Gramos', 36)], ([f, gr]) => { need(f, gr); return { big: fmt(gr / molarMass(f).tot, 6) + ' mol' }; });
T('Moles a gramos', [S('Fórmula', 'NaCl'), N('Moles', 2)], ([f, m]) => { need(f, m); return { big: fmt(m * molarMass(f).tot, 6) + ' g' }; });
T('Moles a moléculas', [N('Moles', 1)], ([m]) => { need(m); return { big: fmt(m * 6.02214076e23, 6) + ' moléculas' }; });
T('Molaridad', [N('Moles de soluto', .5), N('Litros de solución', 2)], ([n, l]) => { need(n, l); return { big: fmt(n / l, 6) + ' M' }; });
T('Dilución C1V1 = C2V2', [N('C1', 2), N('V1', 100), N('C2', .5)], ([c1, v1, c2]) => { need(c1, v1, c2); return { big: 'V2 = ' + fmt(c1 * v1 / c2, 6), table: [['Agua a agregar', fmt(c1 * v1 / c2 - v1, 6)]] }; });
T('pH a partir de [H+]', [N('[H+] (mol/L)', 1e-7)], ([h]) => { need(h); const p = -Math.log10(h); return { big: 'pH ' + fmt(p, 4), table: [['pOH', fmt(14 - p, 4)], ['Tipo', p < 7 ? 'Ácido' : p > 7 ? 'Básico' : 'Neutro']] }; });
T('[H+] a partir de pH', [N('pH', 3)], ([p]) => { need(p); return { big: fmt(10 ** -p, 6) + ' mol/L' }; });
T('Ley de gases ideales (presión)', [N('Moles', 1), N('Temperatura (K)', 273.15), N('Volumen (L)', 22.4)], ([n, t, v]) => { need(n, t, v); return { big: fmt(n * .082057 * t / v, 6) + ' atm' }; });
T('Ley de gases ideales (volumen)', [N('Moles', 1), N('Temperatura (K)', 298), N('Presión (atm)', 1)], ([n, t, p]) => { need(n, t, p); return { big: fmt(n * .082057 * t / p, 6) + ' L' }; });
T('Ley de Boyle', [N('P1', 1), N('V1', 10), N('P2', 2)], ([p1, v1, p2]) => { need(p1, v1, p2); return { big: 'V2 = ' + fmt(p1 * v1 / p2, 6) }; });
T('Ley de Charles', [N('V1', 2), N('T1 (K)', 300), N('T2 (K)', 450)], ([v1, t1, t2]) => { need(v1, t1, t2); return { big: 'V2 = ' + fmt(v1 * t2 / t1, 6) }; });
T('Porcentaje en masa', [N('Masa de soluto (g)', 20), N('Masa de solución (g)', 200)], ([a, b]) => { need(a, b); return { big: fmt(a / b * 100, 4) + ' %' }; });
T('Vida media radiactiva', [N('Cantidad inicial', 100), N('Vida media', 5730), N('Tiempo transcurrido', 10000)], ([a, h, t]) => { need(a, h, t); return { big: fmt(a * .5 ** (t / h), 6) }; });
T('Calor específico Q = mcΔT', [N('Masa (g)', 500), N('Calor específico (J/g°C)', 4.186), N('Cambio de temperatura (°C)', 80)], ([m, c, t]) => { need(m, c, t); return { big: fmt(m * c * t, 4) + ' J', table: [['kcal', fmt(m * c * t / 4184, 4)]] }; });
