// Herramientas de texto
import { cat, group, T, N, S, A, SEL, B, fmt, need, table } from '../tool.js';
import { G } from '../roles.js';
import { native } from '../native.js';

const TX = (def = 'Crack Pro: herramientas profesionales para cada rol.') => A('Texto', def);
const out = (s) => ({ text: s, pre: s });
const noAcc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = (s) => noAcc(s).replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);

cat('text', 'Texto', 'text', G.staff, 'Transformar, limpiar, contar y analizar textos');
group('Mayúsculas y formato');
T('Contar palabras y caracteres', [TX()], ([s]) => table([['Caracteres', s.length], ['Sin espacios', s.replace(/\s/g, '').length], ['Palabras', (s.match(/\S+/g) || []).length],
  ['Líneas', s ? s.split('\n').length : 0], ['Oraciones', (s.match(/[^.!?]+[.!?]+/g) || []).length], ['Párrafos', s.split(/\n\s*\n/).filter(x => x.trim()).length], ['Tiempo de lectura', Math.max(1, Math.round((s.match(/\S+/g) || []).length / 200)) + ' min']]), { roles: G.all });
T('MAYÚSCULAS', [TX()], ([s]) => out(s.toUpperCase()), { roles: G.all });
T('minúsculas', [TX()], ([s]) => out(s.toLowerCase()), { roles: G.all });
T('Tipo Título', [TX()], ([s]) => out(s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())), { roles: G.all });
T('Tipo oración', [TX('hola mundo. esto es crack pro. funciona bien')], ([s]) => out(s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())));
T('iNVERTIR mAYÚSCULAS', [TX()], ([s]) => out([...s].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('')));
T('AlTeRnAr MaYúScUlAs', [TX()], ([s]) => out([...s].map((c, i) => i % 2 ? c.toLowerCase() : c.toUpperCase()).join('')));
T('camelCase', [TX('nombre del usuario activo')], ([s]) => out(words(s).map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('')), { roles: G.dev });
T('PascalCase', [TX('nombre del usuario activo')], ([s]) => out(words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('')), { roles: G.dev });
T('snake_case', [TX('nombre del usuario activo')], ([s]) => out(words(s).map(w => w.toLowerCase()).join('_')), { roles: G.dev });
T('kebab-case', [TX('nombre del usuario activo')], ([s]) => out(words(s).map(w => w.toLowerCase()).join('-')), { roles: G.dev });
T('CONSTANTE_MAYÚSCULA', [TX('nombre del usuario activo')], ([s]) => out(words(s).map(w => w.toUpperCase()).join('_')), { roles: G.dev });
T('dot.case', [TX('nombre del usuario activo')], ([s]) => out(words(s).map(w => w.toLowerCase()).join('.')), { roles: G.dev });
T('Slug para URL', [TX('¡Mi Artículo Número 1 de Crack OS!')], ([s]) => out(words(s).map(w => w.toLowerCase()).join('-')));
group('Limpieza');
T('Quitar acentos', [TX('Canción, árbol, ñandú, pingüino')], ([s]) => out(noAcc(s)));
T('Quitar espacios extra', [TX('Hola    mundo   con   espacios ')], ([s]) => out(s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim()));
T('Quitar todos los espacios', [TX()], ([s]) => out(s.replace(/\s+/g, '')));
T('Quitar saltos de línea', [TX('línea 1\nlínea 2\nlínea 3')], ([s]) => out(s.replace(/\s*\n\s*/g, ' ')));
T('Quitar líneas vacías', [TX('a\n\n\nb\n\nc')], ([s]) => out(s.split('\n').filter(l => l.trim()).join('\n')));
T('Quitar líneas duplicadas', [TX('uno\ndos\nuno\ntres\ndos')], ([s]) => out([...new Set(s.split('\n'))].join('\n')));
T('Quitar números', [TX('abc123 def456')], ([s]) => out(s.replace(/\d/g, '')));
T('Quitar signos de puntuación', [TX('¡Hola! ¿Cómo estás? Bien, gracias.')], ([s]) => out(s.replace(/[\p{P}\p{S}]/gu, '')));
T('Quitar emojis', [TX('Hola 😀 mundo 🔥')], ([s]) => out(s.replace(/\p{Extended_Pictographic}|️|‍/gu, '')));
T('Quitar etiquetas HTML', [TX('<p>Hola <b>mundo</b></p>')], ([s]) => out(s.replace(/<[^>]*>/g, '')));
T('Solo letras', [TX('a1-b2_c3!')], ([s]) => out(s.replace(/[^\p{L}\s]/gu, '')));
T('Solo números', [TX('Tel: (502) 5555-1234')], ([s]) => out(s.replace(/\D/g, '')));
T('Recortar cada línea', [TX('   hola   \n   mundo  ')], ([s]) => out(s.split('\n').map(l => l.trim()).join('\n')));
group('Líneas y orden');
T('Ordenar líneas A-Z', [TX('pera\nmanzana\nuva\nbanano')], ([s]) => out(s.split('\n').sort((a, b) => a.localeCompare(b, 'es')).join('\n')));
T('Ordenar líneas Z-A', [TX('pera\nmanzana\nuva\nbanano')], ([s]) => out(s.split('\n').sort((a, b) => b.localeCompare(a, 'es')).join('\n')));
T('Ordenar líneas por longitud', [TX('pera\nmanzana\nuva\nbanano')], ([s]) => out(s.split('\n').sort((a, b) => a.length - b.length).join('\n')));
T('Ordenar números', [TX('10\n2\n33\n4')], ([s]) => out(s.split(/[\n,]+/).map(x => x.trim()).filter(Boolean).sort((a, b) => parseFloat(a) - parseFloat(b)).join('\n')));
T('Invertir orden de líneas', [TX('1\n2\n3')], ([s]) => out(s.split('\n').reverse().join('\n')));
T('Mezclar líneas al azar', [TX('a\nb\nc\nd\ne')], ([s]) => { const l = s.split('\n'); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return out(l.join('\n')); }, { live: false });
T('Numerar líneas', [TX('primera\nsegunda\ntercera')], ([s]) => out(s.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')));
T('Agregar prefijo y sufijo a cada línea', [TX('uno\ndos'), S('Prefijo', '- '), S('Sufijo', ';')], ([s, a, b]) => out(s.split('\n').map(l => a + l + b).join('\n')));
T('Unir líneas con separador', [TX('a\nb\nc'), S('Separador', ', ')], ([s, sep]) => out(s.split('\n').filter(Boolean).join(sep)));
T('Separar por delimitador en líneas', [TX('a,b,c,d'), S('Delimitador', ',')], ([s, d]) => out(s.split(d || ',').join('\n')));
T('Filtrar líneas que contienen', [TX('error: disco\ninfo: ok\nerror: red'), S('Contiene', 'error')], ([s, q]) => out(s.split('\n').filter(l => l.toLowerCase().includes(q.toLowerCase())).join('\n')));
T('Filtrar líneas que NO contienen', [TX('error: disco\ninfo: ok\nerror: red'), S('No contiene', 'error')], ([s, q]) => out(s.split('\n').filter(l => !l.toLowerCase().includes(q.toLowerCase())).join('\n')));
T('Comparar dos textos (diferencias)', [A('Texto A', 'uno\ndos\ntres'), A('Texto B', 'uno\ndos y medio\ntres\ncuatro')], ([a, b]) => {
  const x = a.split('\n'), y = b.split('\n'); const n = Math.max(x.length, y.length), r = [];
  for (let i = 0; i < n; i++) { if (x[i] === y[i]) r.push('  ' + (x[i] ?? '')); else { if (x[i] !== undefined) r.push('- ' + x[i]); if (y[i] !== undefined) r.push('+ ' + y[i]); } }
  return { pre: r.join('\n'), text: r.join('\n'), html: `<pre class="diff">${r.map(l => `<span class="${l[0] === '-' ? 'del' : l[0] === '+' ? 'add' : ''}">${l.replace(/</g, '&lt;')}</span>`).join('\n')}</pre>` };
}, { roles: G.tech.concat(G.office) });
T('Líneas en común entre dos listas', [A('Lista A', 'ana\nluis\npedro'), A('Lista B', 'pedro\nmaría\nana')], ([a, b]) => { const y = new Set(b.split('\n').map(s => s.trim())); return out(a.split('\n').map(s => s.trim()).filter(s => y.has(s)).join('\n')); });
T('Líneas solo en la lista A', [A('Lista A', 'ana\nluis\npedro'), A('Lista B', 'pedro\nmaría\nana')], ([a, b]) => { const y = new Set(b.split('\n').map(s => s.trim())); return out(a.split('\n').map(s => s.trim()).filter(s => !y.has(s)).join('\n')); });
group('Buscar y extraer');
T('Buscar y reemplazar', [TX('El gato come. El gato duerme.'), S('Buscar', 'gato'), S('Reemplazar por', 'perro'), B('Distinguir mayúsculas', false)], ([s, a, b, cs]) => { need(a); const re = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), cs ? 'g' : 'gi'); return { ...out(s.replace(re, b)), table: [['Reemplazos', (s.match(re) || []).length]] }; });
T('Contar apariciones de una palabra', [TX('el sol y el mar y el cielo'), S('Palabra', 'el')], ([s, w]) => { need(w); return { big: String((s.match(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length) }; });
T('Extraer correos electrónicos', [TX('Escríbeme a ana@mail.com o a soporte@crack-os.dev')], ([s]) => out((s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).join('\n')));
T('Extraer enlaces (URLs)', [TX('Visita https://crack-os.dev y http://ejemplo.com/a?b=1')], ([s]) => out((s.match(/https?:\/\/[^\s"'<>]+/g) || []).join('\n')));
T('Extraer números de teléfono', [TX('Llama al 5555-1234 o al +502 2222 3333')], ([s]) => out((s.match(/\+?\d[\d\s-]{6,}\d/g) || []).join('\n')));
T('Extraer números', [TX('Compré 3 panes a Q1.50 y 2 jugos a Q7')], ([s]) => out((s.match(/-?\d+(?:[.,]\d+)?/g) || []).join('\n')));
T('Extraer hashtags y menciones', [TX('Hola @ana mira #CrackOS y #linux con @luis')], ([s]) => table([['Hashtags', (s.match(/#\w+/g) || []).join(' ')], ['Menciones', (s.match(/@\w+/g) || []).join(' ')]]));
T('Extraer direcciones IP', [TX('Servidor 192.168.1.10 y gateway 10.0.0.1')], ([s]) => out((s.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).join('\n')), { roles: G.tech });
T('Frecuencia de palabras', [TX('el perro y el gato y el ratón')], ([s]) => { const c = {}; (s.toLowerCase().match(/\p{L}+/gu) || []).forEach(w => c[w] = (c[w] || 0) + 1); return table(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 50)); });
T('Frecuencia de letras', [TX()], ([s]) => { const c = {}; (noAcc(s).toLowerCase().match(/[a-zñ]/g) || []).forEach(w => c[w] = (c[w] || 0) + 1); return table(Object.entries(c).sort((a, b) => b[1] - a[1])); });
T('Palabras más largas', [TX()], ([s]) => out([...new Set(s.match(/\p{L}+/gu) || [])].sort((a, b) => b.length - a.length).slice(0, 10).join('\n')));
group('Juegos de texto');
T('Invertir texto', [TX('Crack Pro')], ([s]) => out([...s].reverse().join('')), { roles: G.all });
T('Invertir palabras', [TX('uno dos tres')], ([s]) => out(s.split(/\s+/).reverse().join(' ')));
T('¿Es palíndromo?', [TX('Anita lava la tina')], ([s]) => { const c = noAcc(s).toLowerCase().replace(/[^a-z0-9ñ]/g, ''); return { big: c && c === [...c].reverse().join('') ? 'Sí es palíndromo' : 'No es palíndromo' }; }, { roles: G.all });
T('¿Son anagramas?', [S('Palabra 1', 'amor'), S('Palabra 2', 'roma')], ([a, b]) => { const k = s => [...noAcc(s).toLowerCase().replace(/\s/g, '')].sort().join(''); return { big: k(a) === k(b) ? 'Sí son anagramas' : 'No' }; });
T('Repetir texto', [S('Texto', 'Crack '), N('Veces', 5), S('Separador', '')], ([s, n, sep]) => out(Array(Math.min(1000, Math.max(0, n || 0))).fill(s).join(sep)));
T('Texto al revés (boca abajo)', [TX('hola mundo')], ([s]) => { const m = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '.': '˙', ',': "'", '?': '¿', '!': '¡' }; return out([...noAcc(s).toLowerCase()].reverse().map(c => m[c] || c).join('')); });
T('Texto en estilo hacker (leet)', [TX('crack os es el mejor')], ([s]) => out(noAcc(s).replace(/[aeiostlbg]/gi, c => ({ a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', b: '8', g: '9' }[c.toLowerCase()]))), { roles: G.all });
const FANCY = [['Negrita', 0x1D400, 0x1D41A, 0x1D7CE], ['Cursiva', 0x1D434, 0x1D44E, null], ['Negrita cursiva', 0x1D468, 0x1D482, null], ['Manuscrita', 0x1D4D0, 0x1D4EA, null],
  ['Gótica', 0x1D56C, 0x1D586, null], ['Doble trazo', 0x1D538, 0x1D552, 0x1D7D8], ['Monoespaciada', 0x1D670, 0x1D68A, 0x1D7F6], ['Sans negrita', 0x1D5D4, 0x1D5EE, 0x1D7EC]];
for (const [n, up, lo, dg] of FANCY) T('Letras ' + n.toLowerCase() + ' para redes', [TX('Crack Pro 2026')], ([s]) => out([...noAcc(s)].map(c => { const k = c.charCodeAt(0);
  if (k >= 65 && k <= 90) return String.fromCodePoint(up + k - 65); if (k >= 97 && k <= 122) return String.fromCodePoint(lo + k - 97); if (dg && k >= 48 && k <= 57) return String.fromCodePoint(dg + k - 48); return c; }).join('')), { roles: G.vis });
T('Texto tachado', [TX('precio anterior')], ([s]) => out([...s].map(c => c + '̶').join('')), { roles: G.vis });
T('Texto subrayado', [TX('importante')], ([s]) => out([...s].map(c => c + '̲').join('')), { roles: G.vis });
T('Texto con espacios entre letras', [TX('CRACK')], ([s]) => out([...s].join(' ')), { roles: G.vis });
T('Texto en burbujas', [TX('crack pro')], ([s]) => out([...noAcc(s)].map(c => { const k = c.charCodeAt(0); if (k >= 97 && k <= 122) return String.fromCodePoint(0x24D0 + k - 97); if (k >= 65 && k <= 90) return String.fromCodePoint(0x24B6 + k - 65); return c; }).join('')), { roles: G.vis });
T('Texto en cuadros', [TX('CRACK')], ([s]) => out([...noAcc(s).toUpperCase()].map(c => { const k = c.charCodeAt(0); return k >= 65 && k <= 90 ? String.fromCodePoint(0x1F130 + k - 65) : c; }).join('')), { roles: G.vis });
T('Texto pequeño (superíndice)', [TX('crack pro')], ([s]) => { const m = 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖ۹ʳˢᵗᵘᵛʷˣʸᶻ'; return out([...noAcc(s).toLowerCase()].map(c => { const k = c.charCodeAt(0) - 97; return k >= 0 && k < 26 ? [...m][k] : c; }).join('')); }, { roles: G.vis });
T('Lorem ipsum', [N('Párrafos', 2)], ([n]) => { const p = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'; return out(Array(Math.min(20, n || 1)).fill(p).join('\n\n')); });
T('Ajustar texto a N columnas', [TX('Este es un texto largo que quiero ajustar a un ancho fijo de columnas para imprimirlo.'), N('Columnas', 30)], ([s, w]) => { const r = []; let l = ''; s.split(/\s+/).forEach(x => { if ((l + ' ' + x).trim().length > w) { r.push(l.trim()); l = x; } else l += ' ' + x; }); if (l.trim()) r.push(l.trim()); return out(r.join('\n')); });
T('Centrar texto en marco', [TX('CRACK PRO\nversión 1.0')], ([s]) => { const l = s.split('\n'), w = Math.max(...l.map(x => x.length)) + 4; return out(['╔' + '═'.repeat(w) + '╗', ...l.map(x => { const p = w - x.length; return '║' + ' '.repeat(Math.floor(p / 2)) + x + ' '.repeat(Math.ceil(p / 2)) + '║'; }), '╚' + '═'.repeat(w) + '╝'].join('\n')); });
group('Voz y lectura');
T('Leer texto en voz alta', [TX('Bienvenido a Crack Pro. Tu rol define tus opciones.'), SEL('Velocidad', [['1', 'Normal'], ['0.75', 'Lenta'], ['1.4', 'Rápida']])], ([s, r]) => { need(s.trim()); native.speak(s, +r); return { big: 'Leyendo…' }; }, { roles: G.vis, live: false });
T('Detener lectura en voz', [], () => { native.stopSpeak(); return { big: 'Detenido' }; }, { roles: G.vis, live: false });
T('Deletrear texto (alfabeto fonético)', [TX('CRK')], ([s]) => { const n = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Eco', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'Noviembre', O: 'Óscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniforme', V: 'Víctor', W: 'Whiskey', X: 'Rayos X', Y: 'Yankee', Z: 'Zulú' }; return out([...noAcc(s).toUpperCase()].map(c => n[c] || c).join(' · ')); });
T('Sílabas aproximadas', [TX('computadora')], ([s]) => { const w = noAcc(s).toLowerCase().match(/[a-zñ]+/g) || []; const c = w.reduce((t, x) => t + ((x.match(/[aeiou]+/g) || []).reduce((a, v) => a + (v.length > 1 && /[aeo]{2}/.test(v) ? 2 : 1), 0)), 0); return { big: c + ' sílabas' }; });

// ------------------------------------------------------------- codificacion
cat('enc', 'Codificación', 'code', G.tech, 'Base64, URL, binario, morse, cifrados clásicos');
group('Codificar');
const b64e = (s) => btoa(unescape(encodeURIComponent(s))), b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''))));
const pairs = [
  ['Base64', b64e, b64d], ['Base64 URL', s => b64e(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), b64d],
  ['URL (encodeURIComponent)', encodeURIComponent, decodeURIComponent], ['URL completa (encodeURI)', encodeURI, decodeURI],
  ['HTML entidades', s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }],
  ['Binario', s => [...new TextEncoder().encode(s)].map(b => b.toString(2).padStart(8, '0')).join(' '), s => new TextDecoder().decode(new Uint8Array(s.trim().split(/\s+/).map(b => parseInt(b, 2))))],
  ['Hexadecimal', s => [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2, '0')).join(' '), s => new TextDecoder().decode(new Uint8Array((s.replace(/[^0-9a-f]/gi, '').match(/../g) || []).map(b => parseInt(b, 16))))],
  ['Octal', s => [...new TextEncoder().encode(s)].map(b => b.toString(8).padStart(3, '0')).join(' '), s => new TextDecoder().decode(new Uint8Array(s.trim().split(/\s+/).map(b => parseInt(b, 8))))],
  ['Decimal (códigos)', s => [...new TextEncoder().encode(s)].join(' '), s => new TextDecoder().decode(new Uint8Array(s.trim().split(/[\s,]+/).map(Number)))],
  ['Unicode escapado (\\u)', s => [...s].map(c => c.charCodeAt(0) > 127 ? '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0') : c).join(''), s => s.replace(/\\u([0-9a-f]{4})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))],
  ['Puntos de código Unicode', s => [...s].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' '), s => s.split(/\s+/).map(x => String.fromCodePoint(parseInt(x.replace(/^U\+/i, ''), 16))).join('')],
  ['Quoted-printable', s => [...new TextEncoder().encode(s)].map(b => (b >= 33 && b <= 126 && b !== 61) || b === 32 ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0')).join(''), s => new TextDecoder().decode(new Uint8Array([...s.replace(/=\r?\n/g, '').matchAll(/=([0-9A-F]{2})|[\s\S]/gi)].map(m => m[1] ? parseInt(m[1], 16) : m[0].charCodeAt(0))))],
  ['Cadena JSON escapada', s => JSON.stringify(s), s => JSON.parse(s)],
];
for (const [n, e, d] of pairs) {
  T('Codificar a ' + n, [TX('Hola Crack Pro ñ')], ([s]) => out(e(s)), { kw: 'encode' });
  T('Decodificar de ' + n, [A('Texto codificado', e('Hola Crack Pro ñ'))], ([s]) => { try { return out(d(s)); } catch { throw new Error('El texto no es ' + n + ' válido'); } }, { kw: 'decode' });
}
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', Ñ: '--.--', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.' };
T('Texto a código Morse', [TX('SOS crack')], ([s]) => out([...s.toUpperCase().replace(/[ÁÉÍÓÚ]/g, c => noAcc(c))].map(c => c === ' ' ? '/' : MORSE[c] || '').join(' ')), { roles: G.vis });
T('Código Morse a texto', [A('Morse', '... --- ... / -.-. .-. .- -.-. -.-')], ([s]) => { const inv = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k])); return out(s.trim().split(/\s*\/\s*|\s{3,}/).map(w => w.split(/\s+/).map(c => inv[c] || '').join('')).join(' ')); }, { roles: G.vis });
T('Reproducir código Morse con vibración', [TX('SOS')], ([s]) => { const p = []; [...s.toUpperCase()].forEach(c => { if (c === ' ') { p.push(0, 700); return; } (MORSE[c] || '').split('').forEach(x => p.push(x === '.' ? 120 : 360, 120)); p.push(0, 240); }); native.pattern(p); return { big: 'Vibrando…' }; }, { roles: G.vis, live: false });
group('Cifrados clásicos');
const shift = (s, k) => s.replace(/[a-z]/gi, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + k) % 26 + 26) % 26 + b); });
T('ROT13', [TX('Hola mundo')], ([s]) => out(shift(s, 13)));
T('ROT47', [TX('Hola mundo 123')], ([s]) => out(s.replace(/[!-~]/g, c => String.fromCharCode(33 + (c.charCodeAt(0) + 14) % 94))));
T('Cifrado César', [TX('ataque al amanecer'), N('Desplazamiento', 3)], ([s, k]) => out(shift(s, k || 0)));
T('Descifrar César', [TX('dwdtxh do dpdqhfhu'), N('Desplazamiento', 3)], ([s, k]) => out(shift(s, -(k || 0))));
T('Romper César (todas las claves)', [TX('dwdtxh do dpdqhfhu')], ([s]) => table(Array.from({ length: 25 }, (_, k) => ['Clave ' + (k + 1), shift(s, -(k + 1))])));
T('Cifrado Vigenère', [TX('ataque al amanecer'), S('Clave', 'CRACK')], ([s, k]) => { need(k); let j = 0; const K = noAcc(k).toUpperCase().replace(/[^A-Z]/g, ''); return out(s.replace(/[a-z]/gi, c => shift(c, K.charCodeAt(j++ % K.length) - 65))); });
T('Descifrar Vigenère', [TX('crtsew cl cwcpgecb'), S('Clave', 'CRACK')], ([s, k]) => { need(k); let j = 0; const K = noAcc(k).toUpperCase().replace(/[^A-Z]/g, ''); return out(s.replace(/[a-z]/gi, c => shift(c, -(K.charCodeAt(j++ % K.length) - 65)))); });
T('Cifrado Atbash', [TX('hola')], ([s]) => out(s.replace(/[a-z]/gi, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(25 - (c.charCodeAt(0) - b) + b); })));
T('Cifrado XOR con clave', [TX('secreto'), S('Clave', 'k')], ([s, k]) => { need(k); return out([...new TextEncoder().encode(s)].map((b, i) => (b ^ k.charCodeAt(i % k.length)).toString(16).padStart(2, '0')).join('')); });
T('Descifrar XOR (hex)', [A('Hex', '180e081904190e'), S('Clave', 'k')], ([s, k]) => { need(k); return out(new TextDecoder().decode(new Uint8Array((s.match(/../g) || []).map((h, i) => parseInt(h, 16) ^ k.charCodeAt(i % k.length))))); });
T('Cifrado Rail Fence', [TX('CRACKOSPRO'), N('Rieles', 3)], ([s, n]) => { need(n); const r = Array.from({ length: n }, () => ''); let i = 0, d = 1; for (const c of s) { r[i] += c; if (n > 1) { if (i === 0) d = 1; else if (i === n - 1) d = -1; i += d; } } return out(r.join('')); });
T('Cifrado Bacon', [TX('CRACK')], ([s]) => out([...noAcc(s).toUpperCase().replace(/[^A-Z]/g, '')].map(c => (c.charCodeAt(0) - 65).toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B')).join(' ')));
T('Teclado del celular (multitap)', [TX('hola')], ([s]) => { const k = ['', '', 'abc', 'def', 'ghi', 'jkl', 'mno', 'pqrs', 'tuv', 'wxyz']; return out([...noAcc(s).toLowerCase()].map(c => { if (c === ' ') return '0'; for (let d = 2; d < 10; d++) { const i = k[d].indexOf(c); if (i >= 0) return String(d).repeat(i + 1); } return c; }).join(' ')); });
