// Ejecuta una opcion: construye el formulario, corre la funcion y muestra el resultado.
import { icon, $, $$, esc, toast, busy } from './ui.js';
import { native } from './native.js';
import { favs, recent, usage, audit } from './store.js';
import { qrDataURL } from './card.js';

const today = () => new Date().toISOString().slice(0, 10);

function field(f) {
  const id = 'f_' + f.k || Math.random();
  const lab = `<label class="fld-lab">${esc(f.label)}</label>`;
  if (f.k === 'n') return `${lab}<input class="input" data-in type="number" inputmode="decimal" step="any" value="${f.def ?? ''}" placeholder="${esc(f.label)}">`;
  if (f.k === 'a') return `${lab}<textarea class="input" data-in rows="3" placeholder="${esc(f.label)}">${esc(f.def ?? '')}</textarea>`;
  if (f.k === 'sel') return `${lab}<select class="input" data-in>${f.options.map(o => Array.isArray(o) ? `<option value="${esc(o[0])}" ${o[0] === f.def ? 'selected' : ''}>${esc(o[1])}</option>` : `<option ${o === f.def ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (f.k === 'd') return `${lab}<input class="input" data-in type="date" value="${f.def === 'today' ? today() : (f.def || '')}">`;
  if (f.k === 'tm') return `${lab}<input class="input" data-in type="time" value="${f.def || ''}">`;
  if (f.k === 'f') return `${lab}<input class="input" data-in type="file" accept="${f.accept || '*/*'}">`;
  if (f.k === 'c') return `${lab}<div class="row"><input type="color" data-in value="${f.def || '#ff2832'}" class="colorpick"><input class="input" data-mirror value="${f.def || '#ff2832'}" style="flex:1"></div>`;
  if (f.k === 'b') return `<label class="row chkrow"><input type="checkbox" data-in ${f.def ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
  return `${lab}<input class="input" data-in type="${f.type || 'text'}" value="${esc(f.def ?? '')}" placeholder="${esc(f.label)}">`;
}

function readInputs(form, tool) {
  const els = $$('[data-in]', form);
  return tool.inputs.map((f, i) => { const e = els[i]; if (!e) return ''; if (f.k === 'f') return e.files[0]; if (f.k === 'b') return e.checked; if (f.k === 'n') { const v = e.value.trim(); return v === '' ? '' : parseFloat(v.replace(',', '.')); } return e.value; });
}

function renderResult(box, r) {
  if (r == null) { box.innerHTML = ''; return; }
  if (typeof r === 'string') r = { big: r };
  let h = '';
  if (r.big != null) h += `<div class="big-out ${r.mono ? 'mono' : ''}">${esc(r.big)}</div>`;
  if (r.img) h += `<img class="out-img" src="${r.img}">`;
  if (r.qr) h += `<div class="qr-wrap"><img class="qr" src="${qrDataURL(r.qr, 420)}"></div>`;
  if (r.svg || (r.html && r.html.includes('<svg'))) h += r.svg ? `<div class="svg-wrap">${r.svg}</div>` : r.html;
  else if (r.html) h += r.html;
  if (r.pre != null && !r.big) h += `<pre class="out-pre">${esc(r.pre)}</pre>`;
  else if (r.pre != null) h += `<pre class="out-pre">${esc(r.pre)}</pre>`;
  if (r.table && r.table.length) h += `<table class="out-table">${r.table.map(row => `<tr>${row.map((c, i) => `<${i ? 'td' : 'th'}>${esc(c)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>`;
  const copyText = r.text ?? (r.big && !r.img && !r.qr ? r.big : r.pre);
  h += `<div class="out-actions">`;
  if (copyText) h += `<button class="btn sm" data-act="copy">${icon('copy', 14)} Copiar</button><button class="btn sm" data-act="share">${icon('share', 14)} Compartir</button>`;
  if (r.blob || r.img) h += `<button class="btn sm primary" data-act="save">${icon('download', 14)} Guardar</button>`;
  h += `</div>`;
  box.innerHTML = h;
  box.dataset.copy = copyText || '';
  box._res = r;
}

export function runnerView(tool, el, ctx) {
  usage.bump(tool.id); audit('usó opción', tool.name);
  el.innerHTML = `<div class="runner">
    ${tool.desc ? `<p class="tool-desc">${esc(tool.desc)}</p>` : ''}
    ${tool.view ? '<div id="viewbox"></div>' : `<form id="form" class="runner-form">${tool.inputs.map(field).join('')}${tool.inputs.length && !tool.live ? `<button class="btn primary block" type="submit">${icon('zap', 16)} Calcular</button>` : ''}</form><div id="out" class="out"></div>`}
  </div>`;
  // carnet-color helper context for cyber/verify card tools
  let cleanup;
  if (tool.view) { cleanup = tool.view(el.querySelector('#viewbox'), ctx); }
  else {
    const form = el.querySelector('#form'), out = el.querySelector('#out');
    $$('.colorpick', form).forEach(c => { const mir = c.parentElement.querySelector('[data-mirror]'); c.oninput = () => { mir.value = c.value; live(); }; mir.oninput = () => { c.value = mir.value; live(); }; });
    let timer, lastErr;
    const run = async () => {
      let r; try { r = await tool.run(readInputs(form, tool), ctx); } catch (e) { out.innerHTML = `<div class="out-err">${icon('x', 14)} ${esc(e.message)}</div>`; return; }
      renderResult(out, r);
    };
    const live = () => { if (!tool.live || !tool.inputs.length) return; clearTimeout(timer); timer = setTimeout(run, 180); };
    form.oninput = live; form.onchange = live;
    form.onsubmit = (e) => { e.preventDefault(); run(); };
    if (tool.live && tool.inputs.length) run();
    if (!tool.inputs.length) run();
    if (tool.refresh) { const iv = setInterval(() => { if (document.body.contains(out)) run(); }, tool.refresh); cleanup = () => clearInterval(iv); }
    out.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return; const r = out._res || {};
      if (b.dataset.act === 'copy') { await native.copy(out.dataset.copy); toast('Copiado'); }
      else if (b.dataset.act === 'share') { await native.shareText(out.dataset.copy); }
      else if (b.dataset.act === 'save') { let blob = r.blob; if (!blob && r.img) blob = await (await fetch(r.img)).blob(); if (!blob && r.qr) blob = await (await fetch(qrDataURL(r.qr, 600))).blob(); if (blob) { const res = await native.saveFile(blob, r.name || 'crackpro-' + Date.now() + '.png', blob.type); toast('Guardado en ' + (res?.path || 'Descargas')); } }
    });
  }
  return cleanup;
}
