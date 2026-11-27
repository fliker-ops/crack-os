// Conversiones: cada par de unidades es una opcion propia (de A a B)
import { cat, group, T, N, S, SEL, fmt, need } from '../tool.js';
import { G } from '../roles.js';

const MAG = [
  // [grupo, roles, unidades: [nombre, simbolo, factor a la unidad base]]
  ['Longitud', G.all, [['Milímetros', 'mm', 1e-3], ['Centímetros', 'cm', 1e-2], ['Metros', 'm', 1], ['Kilómetros', 'km', 1e3], ['Pulgadas', 'in', .0254],
    ['Pies', 'ft', .3048], ['Yardas', 'yd', .9144], ['Millas', 'mi', 1609.344], ['Millas náuticas', 'nmi', 1852], ['Varas', 'vara', .8359]]],
  ['Masa', G.all, [['Miligramos', 'mg', 1e-6], ['Gramos', 'g', 1e-3], ['Kilogramos', 'kg', 1], ['Toneladas', 't', 1e3], ['Onzas', 'oz', .028349523125],
    ['Libras', 'lb', .45359237], ['Quintales', 'qq', 45.359237], ['Arrobas', '@', 11.33980925]]],
  ['Tiempo', G.all, [['Milisegundos', 'ms', 1e-3], ['Segundos', 's', 1], ['Minutos', 'min', 60], ['Horas', 'h', 3600], ['Días', 'd', 86400],
    ['Semanas', 'sem', 604800], ['Meses', 'mes', 2629746], ['Años', 'año', 31556952]]],
  ['Volumen', G.all, [['Mililitros', 'ml', 1e-3], ['Litros', 'l', 1], ['Metros cúbicos', 'm³', 1e3], ['Galones (EE. UU.)', 'gal', 3.785411784],
    ['Galones (R. U.)', 'gal uk', 4.54609], ['Onzas líquidas', 'fl oz', .0295735295625], ['Tazas', 'taza', .2365882365], ['Cucharadas', 'cda', .01478676478125]]],
  ['Área', G.vis, [['Centímetros²', 'cm²', 1e-4], ['Metros²', 'm²', 1], ['Kilómetros²', 'km²', 1e6], ['Hectáreas', 'ha', 1e4], ['Acres', 'ac', 4046.8564224],
    ['Pies²', 'ft²', .09290304], ['Manzanas', 'mz', 6987.37], ['Varas²', 'v²', .69872]]],
  ['Velocidad', G.vis, [['Metros/segundo', 'm/s', 1], ['Kilómetros/hora', 'km/h', 1 / 3.6], ['Millas/hora', 'mph', .44704], ['Nudos', 'kn', .514444], ['Pies/segundo', 'ft/s', .3048]]],
  ['Presión', G.vis, [['Pascales', 'Pa', 1], ['Kilopascales', 'kPa', 1e3], ['Bar', 'bar', 1e5], ['PSI', 'psi', 6894.757293], ['Atmósferas', 'atm', 101325], ['mmHg', 'mmHg', 133.322387]]],
  ['Energía', G.vis, [['Julios', 'J', 1], ['Kilojulios', 'kJ', 1e3], ['Calorías', 'cal', 4.184], ['Kilocalorías', 'kcal', 4184], ['Vatios-hora', 'Wh', 3600],
    ['Kilovatios-hora', 'kWh', 3.6e6], ['BTU', 'BTU', 1055.05585]]],
  ['Potencia', G.vis, [['Vatios', 'W', 1], ['Kilovatios', 'kW', 1e3], ['Caballos de fuerza', 'hp', 745.699872], ['BTU/hora', 'BTU/h', .29307107]]],
  ['Ángulo', G.vis, [['Grados', '°', Math.PI / 180], ['Radianes', 'rad', 1], ['Gradianes', 'grad', Math.PI / 200], ['Vueltas', 'vuelta', 2 * Math.PI]]],
  ['Datos', G.tech, [['Bits', 'b', 1 / 8], ['Bytes', 'B', 1], ['Kilobytes', 'KB', 1e3], ['Megabytes', 'MB', 1e6], ['Gigabytes', 'GB', 1e9], ['Terabytes', 'TB', 1e12],
    ['Kibibytes', 'KiB', 1024], ['Mebibytes', 'MiB', 1048576], ['Gibibytes', 'GiB', 1073741824]]],
  ['Frecuencia', G.tech, [['Hercios', 'Hz', 1], ['Kilohercios', 'kHz', 1e3], ['Megahercios', 'MHz', 1e6], ['Gigahercios', 'GHz', 1e9]]],
];

cat('conv', 'Conversiones', 'ruler', G.all, 'Más de 500 conversiones de unidades, cada par es una opción');
for (const [g, roles, units] of MAG) {
  group(g);
  for (const a of units) for (const b of units) {
    if (a === b) continue;
    T(`${a[0]} a ${b[0].toLowerCase()}`, [N(`Cantidad en ${a[1]}`, 1)], ([x]) => {
      need(x);
      const r = x * a[2] / b[2];
      return { big: `${fmt(r, 8)} ${b[1]}`, text: `${fmt(x, 8)} ${a[1]} = ${fmt(r, 8)} ${b[1]}`,
        table: [['Fórmula', `${a[1]} × ${fmt(a[2] / b[2], 10)}`], ['Inverso', `1 ${b[1]} = ${fmt(b[2] / a[2], 10)} ${a[1]}`]] };
    }, { roles, kw: `${a[1]} ${b[1]} convertir` });
  }
}

// temperatura (no es lineal con factor)
group('Temperatura');
const TEMP = { C: ['Celsius', '°C', v => v, v => v], F: ['Fahrenheit', '°F', v => (v - 32) * 5 / 9, v => v * 9 / 5 + 32],
  K: ['Kelvin', 'K', v => v - 273.15, v => v + 273.15], R: ['Rankine', '°R', v => (v - 491.67) * 5 / 9, v => (v + 273.15) * 9 / 5] };
for (const [ka, a] of Object.entries(TEMP)) for (const [kb, b] of Object.entries(TEMP)) {
  if (ka === kb) continue;
  T(`${a[0]} a ${b[0].toLowerCase()}`, [N(`Temperatura en ${a[1]}`, 25)], ([x]) => {
    need(x); const r = b[3](a[2](x)); return { big: `${fmt(r, 4)} ${b[1]}`, text: `${fmt(x, 4)} ${a[1]} = ${fmt(r, 4)} ${b[1]}` };
  }, { roles: G.all, kw: 'temperatura grados' });
}

// consumo de combustible
group('Consumo de combustible');
const FUEL = { kml: ['Km por litro', 'km/l', v => v, v => v], l100: ['Litros cada 100 km', 'l/100km', v => 100 / v, v => 100 / v],
  mpg: ['Millas por galón', 'mpg', v => v * 0.425144, v => v / 0.425144], kmg: ['Km por galón', 'km/gal', v => v / 3.785411784, v => v * 3.785411784] };
for (const [ka, a] of Object.entries(FUEL)) for (const [kb, b] of Object.entries(FUEL)) {
  if (ka === kb) continue;
  T(`${a[0]} a ${b[0].toLowerCase()}`, [N(a[1], 12)], ([x]) => { need(x); const r = b[3](a[2](x)); return { big: `${fmt(r, 3)} ${b[1]}` }; }, { roles: G.vis });
}

// bases numericas: cada par es una opcion
group('Bases numéricas');
const BASES = [['Binario', 2], ['Octal', 8], ['Decimal', 10], ['Hexadecimal', 16], ['Base 32', 32], ['Base 36', 36]];
for (const [na, ba] of BASES) for (const [nb, bb] of BASES) {
  if (ba === bb) continue;
  T(`${na} a ${nb.toLowerCase()}`, [S(`Número en base ${ba}`, ba === 2 ? '101010' : ba === 16 ? 'FF' : '42')], ([s]) => {
    s = s.trim().toLowerCase().replace(/^0[xbo]/, '').replace(/[\s_]/g, '');
    need(s);
    const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, ba);
    let v = 0n; const neg = s.startsWith('-'); if (neg) s = s.slice(1);
    for (const ch of s) { const d = digits.indexOf(ch); if (d < 0) throw new Error(`"${ch}" no es válido en base ${ba}`); v = v * BigInt(ba) + BigInt(d); }
    const out = (neg ? '-' : '') + v.toString(bb).toUpperCase();
    return { big: out, text: out };
  }, { roles: G.dev, kw: 'base numero' });
}

// numeros romanos y en letras
group('Números');
const ROM = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
T('Decimal a romano', [N('Número (1 a 3999)', 2026)], ([n]) => {
  need(n); if (n < 1 || n > 3999) throw new Error('Debe estar entre 1 y 3999');
  let s = ''; n = Math.floor(n); for (const [v, r] of ROM) while (n >= v) { s += r; n -= v; } return { big: s };
}, { roles: G.all });
T('Romano a decimal', [S('Número romano', 'MMXXVI')], ([s]) => {
  s = s.toUpperCase().trim(); need(s); const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let t = 0; for (let i = 0; i < s.length; i++) { const v = map[s[i]], nx = map[s[i + 1]] || 0; if (!v) throw new Error('Letra inválida: ' + s[i]); t += v < nx ? -v : v; }
  return { big: String(t) };
}, { roles: G.all });

const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
function letras999(n) {
  if (n === 0) return ''; if (n === 100) return 'cien';
  const c = Math.floor(n / 100), r = n % 100;
  let s = CEN[c];
  if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : ''));
  return s;
}
export function enLetras(n) {
  n = Math.floor(Math.abs(n)); if (n === 0) return 'cero';
  const parts = [[1e12, 'billón', 'billones'], [1e6, 'millón', 'millones'], [1e3, 'mil', 'mil']];
  let s = '';
  for (const [v, one, many] of parts) {
    const q = Math.floor(n / v); n %= v;
    if (!q) continue;
    if (v === 1e3) s += (q === 1 ? 'mil' : enLetras(q).replace(/uno$/, 'un') + ' mil') + ' ';
    else s += (q === 1 ? 'un ' + one : enLetras(q).replace(/uno$/, 'un') + ' ' + many) + ' ';
  }
  return (s + letras999(n)).trim();
}
T('Número a letras', [N('Número', 1250)], ([n]) => { need(n); return { big: enLetras(n), text: enLetras(n) }; }, { roles: G.all, kw: 'cheque escribir' });
T('Cantidad en quetzales a letras (cheque)', [N('Monto Q', 1520.5)], ([n]) => {
  need(n); const ent = Math.floor(n), cts = Math.round((n - ent) * 100);
  const s = `${enLetras(ent).replace(/uno$/, 'un')} quetzales con ${String(cts).padStart(2, '0')}/100`; return { big: s.toUpperCase(), text: s.toUpperCase() };
}, { roles: G.office });
T('Notación científica', [N('Número', 299792458)], ([n]) => { need(n); return { big: n.toExponential(6).replace('e', ' × 10^'), table: [['Ingeniería', (() => { const e = Math.floor(Math.log10(Math.abs(n)) / 3) * 3; return fmt(n / 10 ** e, 6) + ' × 10^' + e; })()]] }; }, { roles: G.vis });
T('Redondear número', [N('Número', 3.14159), N('Decimales', 2)], ([n, d]) => { need(n, d); return { big: n.toFixed(Math.max(0, Math.min(15, d))), table: [['Hacia arriba', Math.ceil(n * 10 ** d) / 10 ** d], ['Hacia abajo', Math.floor(n * 10 ** d) / 10 ** d]] }; }, { roles: G.all });

// tallas
group('Tallas y cocina');
T('Talla de zapato EE. UU. a europea', [N('Talla EE. UU. (hombre)', 9)], ([n]) => { need(n); return { big: fmt(n + 33, 1) + ' EU', table: [['Centímetros', fmt((n + 22) * 0.847, 1) + ' cm'], ['Mujer EE. UU.', fmt(n + 1.5, 1)]] }; }, { roles: G.vis });
T('Talla de zapato europea a EE. UU.', [N('Talla europea', 42)], ([n]) => { need(n); return { big: fmt(n - 33, 1) + ' US', table: [['Mujer EE. UU.', fmt(n - 31.5, 1)]] }; }, { roles: G.vis });
T('Tazas de harina a gramos', [N('Tazas', 1)], ([n]) => { need(n); return { big: fmt(n * 125, 1) + ' g' }; }, { roles: G.vis });
T('Tazas de azúcar a gramos', [N('Tazas', 1)], ([n]) => { need(n); return { big: fmt(n * 200, 1) + ' g' }; }, { roles: G.vis });
T('Tazas de arroz a gramos', [N('Tazas', 1)], ([n]) => { need(n); return { big: fmt(n * 185, 1) + ' g' }; }, { roles: G.vis });
T('Cucharadas de mantequilla a gramos', [N('Cucharadas', 2)], ([n]) => { need(n); return { big: fmt(n * 14.2, 1) + ' g' }; }, { roles: G.vis });
T('Porciones de receta', [N('Porciones originales', 4), N('Porciones deseadas', 6), N('Cantidad del ingrediente', 250)], ([a, b, c]) => { need(a, b, c); return { big: fmt(c * b / a, 2), text: `Multiplica todo por ${fmt(b / a, 3)}` }; }, { roles: G.vis });
T('Grados de horno °C a gas mark', [N('°C', 180)], ([c]) => { need(c); return { big: 'Gas ' + fmt(Math.max(.25, (c - 121) / 14), 1) }; }, { roles: G.vis });
