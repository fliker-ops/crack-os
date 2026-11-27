// Discos y particiones de la PC + formateo con confirmaciones fuertes
import { get, post } from '../api.js';
import { icon, h, $, $$, esc, toast, modal, bytes, panel } from '../ui.js';
import { native } from '../native.js';

const FS = [['ext4', 'ext4', 'Linux (recomendado para Crack OS)'], ['exfat', 'exFAT', 'USB y discos grandes, sirve en todos lados'],
  ['fat32', 'FAT32', 'máxima compatibilidad, archivos < 4 GB'], ['ntfs', 'NTFS', 'para usar en Windows']];
const PCOL = ['#ff2832', '#c4101b', '#ff6a3c', '#8c0a14', '#ff9aa0', '#5a0810'];

export default {
  async mount(el) {
    const load = async () => {
      el.innerHTML = '<div class="empty"><span class="spin"></span></div>';
      let r;
      try { r = await get('/api/disks'); } catch (e) { if (!el.isConnected) return; el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      if (!el.isConnected) return;
      el.innerHTML = `<p class="small mut" style="margin:6px 2px">${r.disks.length} discos encontrados. Las particiones donde corre el sistema están protegidas y no se pueden formatear.</p>` +
        r.disks.map((d, di) => {
          const parts = d.parts.length ? d.parts : [{ ...d, whole: true, type: d.fstype ? 'sin tabla de particiones' : 'vacío' }];
          const tran = { usb: 'USB', nvme: 'NVMe', sata: 'SATA', virtio: 'Virtual', ata: 'ATA' }[d.tran] || (d.removable ? 'Extraíble' : 'Disco');
          return panel(`${tran} · ${d.name}`, `
            <div class="row"><div class="ico" style="width:46px;height:46px;border-radius:12px;display:grid;place-items:center;background:rgba(255,40,50,.12);color:#ff2832">${icon(d.removable || d.tran === 'usb' ? 'download' : 'disk', 24)}</div>
              <div class="sp"><b>${esc(d.model || d.path)}</b><div class="small mut">${esc(d.path)} · ${bytes(d.size)} · ${d.parts.length} particiones</div></div>
              ${d.protected ? `<span class="badge r">${icon('lock', 10)} SISTEMA</span>` : `<button class="btn sm danger" data-whole="${di}">Formatear disco</button>`}</div>
            <div class="dbar">${parts.map((p, i) => `<div style="flex:${Math.max(p.size / d.size, 0.04)};background:${PCOL[i % PCOL.length]}">${esc(p.label || p.fstype || p.name)}</div>`).join('')}</div>
            ${parts.map((p, pi) => {
              const used = p.used != null && p.size ? p.used / (Number(p.used) + Number(p.avail || 0)) : null;
              return `<div class="item" style="align-items:flex-start"><span style="width:10px;height:10px;border-radius:3px;margin-top:5px;background:${PCOL[pi % PCOL.length]}"></span>
                <div class="meta"><b>${esc(p.name)} ${p.label ? `· ${esc(p.label)}` : ''}</b>
                  <small>${esc(p.fstype || 'sin formato')} · ${bytes(p.size)} · ${esc(p.type || '')}</small>
                  ${p.mounts?.length ? `<small>montada en ${esc(p.mounts.join(', '))}</small>` : ''}
                  ${used != null ? `<div class="usebar"><i style="width:${used * 100}%"></i></div><small>${bytes(p.used)} usados · ${bytes(p.avail)} libres</small>` : ''}
                  ${p.protected ? `<small class="red">${icon('lock', 10)} protegida: ${esc(p.protected)}</small>` : ''}</div>
                ${p.protected ? '' : `<button class="btn sm" data-fmt="${di}:${pi}">${icon('zap', 14)} Formatear</button>`}</div>`; }).join('')}`);
        }).join('') + (r.admin ? '' : `<p class="small red center">Tu usuario no es administrador: puedes ver los discos pero no formatear.</p>`)
        + `<button class="btn block ghost" id="reload" style="margin-bottom:20px">${icon('refresh', 16)} Actualizar</button>`;
      $('#reload', el).onclick = load;
      $$('[data-fmt]', el).forEach(b => b.onclick = () => {
        const [di, pi] = b.dataset.fmt.split(':').map(Number), d = r.disks[di];
        const p = d.parts.length ? d.parts[pi] : d;
        formatFlow(p.path, p, d.parts.length === 0, r.admin).then(ok => ok && load());
      });
      $$('[data-whole]', el).forEach(b => b.onclick = () => { const d = r.disks[+b.dataset.whole]; formatFlow(d.path, d, true, r.admin).then(ok => ok && load()); });
    };
    await load();
  },
};

async function formatFlow(path, dev, whole, admin) {
  if (!admin) { toast('Solo un administrador puede formatear', 'err'); return false; }
  // paso 1: opciones
  let fs = 'exfat', label = (dev.label || 'CRACK').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 11) || 'CRACK';
  const opt = await modal({ title: `Formatear ${path}`, body: `
    <p>${whole ? 'Se creará una tabla de particiones nueva en <b>todo el disco</b>.' : 'Se formateará solo esta partición.'}</p>
    <div class="kv"><span>Dispositivo</span><span>${esc(path)}</span></div><div class="kv"><span>Tamaño</span><span>${bytes(dev.size)}</span></div>
    <div class="kv"><span>Ahora tiene</span><span>${esc(dev.fstype || 'nada')} ${dev.label ? '· ' + esc(dev.label) : ''}</span></div>
    <label class="small mut" style="display:block;margin:12px 0 6px">Sistema de archivos</label>
    <div class="col" id="fsl">${FS.map(([k, n, d]) => `<button class="item" data-fs="${k}" style="margin:0;text-align:left;color:inherit"><div class="meta"><b>${n}</b><small>${d}</small></div><span class="switch ${k === fs ? 'on' : ''}"></span></button>`).join('')}</div>
    <label class="small mut" style="display:block;margin:12px 0 6px">Nombre del volumen</label><input class="input" id="lab" maxlength="16" value="${esc(label)}">`,
    onOpen: m => m.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { fs = b.dataset.fs; m.querySelectorAll('[data-fs] .switch').forEach(s => s.classList.toggle('on', s.parentElement === b)); }),
    actions: [{ label: 'Cancelar', value: null }, { label: 'Continuar', kind: 'danger', handler: m => ({ label: m.querySelector('#lab').value }) }] });
  if (!opt) return false;
  let prep;
  try { prep = await post('/api/disks/format/prepare', { path, fstype: fs, label: opt.label }); }
  catch (e) { toast(e.message, 'err'); return false; }
  native.vibrate(120);
  // paso 2: advertencia fuerte
  const res = await modal({ title: '¿Borrar todo?', danger: true, body: `
    <p style="color:#fff;font-size:15px">Se va a <b class="red">BORRAR TODO</b> lo que hay en <b>${esc(path)}</b> (${bytes(prep.size)}${dev.label ? ', ' + esc(dev.label) : ''}). Esto <b>no se puede deshacer</b>.</p>
    ${prep.mounts.length ? `<p class="red">Está montada en ${esc(prep.mounts.join(', '))}; se desmontará.</p>` : ''}
    <p class="small">Quedará como <b>${esc(prep.fstype)}</b> con el nombre <b>${esc(prep.label)}</b>.</p>
    <label class="small mut">1. Escribe exactamente: <b class="red" style="user-select:text">${esc(prep.phrase)}</b></label>
    <input class="input" id="ph" autocomplete="off" autocapitalize="characters" style="margin:6px 0 12px">
    <label class="small mut">2. Tu contraseña de la PC</label>
    <input class="input" id="pw" type="password" style="margin:6px 0 12px">
    <label class="small mut">3. Mantén presionado el botón rojo 2 segundos</label>
    <div class="err small red" id="merr" style="min-height:16px;margin-top:8px"></div>`,
    onOpen: (m, close) => {
      const box = m.querySelector('.modal-actions');
      const btn = h(`<button class="btn danger hold" disabled style="flex:2"><i></i><span>Espera ${prep.wait}s…</span></button>`);
      box.appendChild(btn);
      let left = prep.wait;
      const tick = setInterval(() => { left--; if (left <= 0) { clearInterval(tick); btn.disabled = false; btn.querySelector('span').textContent = 'MANTÉN PARA FORMATEAR'; } else btn.querySelector('span').textContent = `Espera ${left}s…`; }, 1000);
      let holdT, startT, raf;
      const bar = btn.querySelector('i');
      const fill = () => { const k = Math.min(1, (performance.now() - startT) / 2000); bar.style.width = k * 100 + '%'; if (k < 1) raf = requestAnimationFrame(fill); };
      const down = () => {
        if (btn.disabled) return;
        const ph = m.querySelector('#ph').value.trim(), pw = m.querySelector('#pw').value;
        if (ph !== prep.phrase) { m.querySelector('#merr').textContent = 'La frase no coincide.'; native.vibrate(80); return; }
        if (!pw) { m.querySelector('#merr').textContent = 'Falta la contraseña.'; return; }
        startT = performance.now(); fill(); native.vibrate(20);
        holdT = setTimeout(async () => {
          btn.disabled = true; btn.querySelector('span').textContent = 'Formateando…';
          try { const r = await post('/api/disks/format/confirm', { ticket: prep.ticket, phrase: ph, password: pw }); close(r.job); }
          catch (e) { m.querySelector('#merr').textContent = e.message; btn.disabled = false; btn.querySelector('span').textContent = 'MANTÉN PARA FORMATEAR'; bar.style.width = 0; }
        }, 2000);
      };
      const up = () => { clearTimeout(holdT); cancelAnimationFrame(raf); if (!btn.disabled || btn.querySelector('span').textContent !== 'Formateando…') bar.style.width = 0; };
      btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up);
      window.__crkFormat = { phrase: prep.phrase, confirmNow: async (pw) => { const r = await post('/api/disks/format/confirm', { ticket: prep.ticket, phrase: prep.phrase, password: pw }); close(r.job); } };
    },
    actions: [{ label: 'Cancelar', value: null }] });
  if (!res) return false;
  // paso 3: progreso real
  return new Promise(resolve => {
    let poll;
    modal({ title: `Formateando ${path}`, body: `<div class="usebar" style="height:10px"><i id="jp" style="width:0"></i></div><p class="small mut" id="jst">Trabajando…</p><div class="terminal-log" id="jl"></div>`,
      onOpen: (m, close) => {
        poll = setInterval(async () => {
          try {
            const j = await get('/api/jobs?id=' + res);
            m.querySelector('#jp').style.width = j.progress + '%';
            m.querySelector('#jl').textContent = j.log.join('\n');
            m.querySelector('#jl').scrollTop = 1e6;
            if (j.state !== 'running') {
              clearInterval(poll);
              m.querySelector('#jst').innerHTML = j.state === 'ok' ? '<b style="color:#3ddc84">✓ Formateo terminado</b>' : '<b class="red">✗ Hubo un error</b>';
              native.vibrate(j.state === 'ok' ? 40 : 120);
              toast(j.state === 'ok' ? `${path} formateado` : 'El formateo falló', j.state === 'ok' ? 'ok' : 'err');
            }
          } catch {}
        }, 700);
      },
      actions: [{ label: 'Cerrar', value: true, kind: 'primary' }] }).then(() => { clearInterval(poll); resolve(true); });
  });
}
