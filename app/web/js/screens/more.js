import { icon, esc } from '../ui.js';
import { MODULES } from '../main.js';
import { native } from '../native.js';

export default {
  mount(el, params, nav) {
    el.innerHTML = `<p class="mut small" style="margin:6px 2px 12px">Todo lo que puedes controlar en tu PC desde aquí.</p>
      <div class="tiles">${MODULES.map(m => `<button class="tile" data-id="${m.id}">${icon(m.icon, 28)}<span>${esc(m.label)}</span><small>${esc(m.sub)}</small></button>`).join('')}</div>`;
    el.querySelectorAll('.tile').forEach(t => t.onclick = () => { native.vibrate(); nav.open(t.dataset.id); });
  },
};
