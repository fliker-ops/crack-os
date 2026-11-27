// Energia: bloquear, suspender, reiniciar, apagar, cerrar sesion (con confirmacion)
import { post, conn } from '../api.js';
import { icon, $$, toast, confirm, panel } from '../ui.js';
import { native } from '../native.js';

const ACTS = [['lock', 'Bloquear', 'lock', 'La PC pedirá tu contraseña para volver.', false],
  ['suspend', 'Suspender', 'moon', 'La PC se dormirá. Se despierta con una tecla o el botón.', false],
  ['logout', 'Cerrar sesión', 'logout', 'Se cerrarán tus programas abiertos.', true],
  ['reboot', 'Reiniciar', 'refresh', 'Guarda tu trabajo: la PC se reiniciará en 2 segundos.', true],
  ['poweroff', 'Apagar', 'power', 'La PC se apagará en 2 segundos. Después no podrás controlarla hasta encenderla.', true]];

export default {
  mount(el) {
    el.innerHTML = panel('Energía de la PC', `<div class="grid2">${ACTS.map(([k, l, ic], i) => `<button class="qa" data-i="${i}" style="padding:22px 6px;${k === 'poweroff' ? 'border-color:#ff2832' : ''}">${icon(ic, 30)}<b style="font-size:13px">${l}</b></button>`).join('')}</div>
      ${conn.admin ? '' : '<p class="small mut">Reiniciar y apagar requieren un usuario administrador.</p>'}`);
    $$('[data-i]', el).forEach(b => b.onclick = async () => {
      const [k, l, , txt, danger] = ACTS[+b.dataset.i];
      native.vibrate();
      if (!await confirm(`${l} la PC`, txt, { danger, ok: l })) return;
      try { await post('/api/power', { action: k }); toast(`${l}: listo`); } catch (e) { toast(e.message, 'err'); }
    });
  },
};
