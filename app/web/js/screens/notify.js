// Mandar un aviso que aparece en la pantalla de la PC
import { post } from '../api.js';
import { icon, $, $$, toast, panel } from '../ui.js';
import { native } from '../native.js';

const QUICK = [['🍕', 'La comida está lista'], ['🚪', 'Ya llegué, ábreme'], ['⏰', 'Hora de descansar la vista'], ['📞', 'Te están llamando'], ['🔒', 'No toques mi PC 👀'], ['💀', 'Hackeo en progreso…']];

export default {
  mount(el) {
    el.innerHTML = panel('Aviso en la PC', `<input class="input" id="ti" placeholder="Título" value="Mensaje desde el teléfono" maxlength="80">
      <textarea class="input" id="bo" rows="3" placeholder="Mensaje" style="margin-top:10px"></textarea>
      <div class="row" style="justify-content:space-between;margin:12px 0"><span>Urgente (rojo, no se cierra solo)</span><div class="switch" id="urg"></div></div>
      <button class="btn primary block" id="go">${icon('send', 18)} Mostrar en la PC</button>`)
      + panel('Rápidos', `<div class="grid2">${QUICK.map(([e, t], i) => `<button class="qa" data-i="${i}" style="flex-direction:row;justify-content:flex-start;padding:12px"><span style="font-size:20px">${e}</span><span>${t}</span></button>`).join('')}</div>`);
    let urg = false;
    $('#urg', el).onclick = () => { urg = !urg; $('#urg', el).classList.toggle('on', urg); };
    const send = async (title, body) => {
      try { await post('/api/notify', { title, body, urgency: urg ? 'critical' : 'normal' }); toast('Aviso mostrado en la PC'); native.vibrate(); } catch (e) { toast(e.message, 'err'); }
    };
    $('#go', el).onclick = () => send($('#ti', el).value || 'Mensaje', $('#bo', el).value);
    $$('[data-i]', el).forEach(b => b.onclick = () => { const [e, t] = QUICK[+b.dataset.i]; send(`${e} Crack Remote`, t); });
  },
};
