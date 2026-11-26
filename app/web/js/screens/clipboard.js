// Portapapeles compartido entre el telefono y la PC
import { get, post } from '../api.js';
import { icon, $, $$, esc, toast, panel } from '../ui.js';
import { native } from '../native.js';

export default {
  async mount(el) {
    const hist = JSON.parse(localStorage.getItem('crk.cliphist') || '[]');
    el.innerHTML = `${panel('Enviar a la PC', `<textarea class="input" id="t" rows="4" placeholder="Escribe o pega aquí. Luego en la PC solo presiona Ctrl+V."></textarea>
        <div class="grid2" style="margin-top:10px"><button class="btn" id="paste">${icon('clip', 16)} Pegar del teléfono</button><button class="btn primary" id="send">${icon('send', 16)} Copiar en la PC</button></div>`)}
      ${panel('Portapapeles de la PC', `<div class="terminal-log" id="pc" style="min-height:60px">—</div>
        <div class="grid2" style="margin-top:10px"><button class="btn" id="read">${icon('refresh', 16)} Leer</button><button class="btn" id="copy">${icon('download', 16)} Copiar al teléfono</button></div>`)}
      ${panel('Historial', '<div id="h"></div>')}`;
    const renderH = () => {
      $('#h', el).innerHTML = hist.length ? hist.map((x, i) => `<div class="kv" data-i="${i}"><span style="max-width:80%;overflow:hidden;text-overflow:ellipsis">${esc(x)}</span><span class="red">${icon('send', 14)}</span></div>`).join('') : '<p class="small mut">Lo que envíes aparecerá aquí.</p>';
      $$('[data-i]', el).forEach(r => r.onclick = () => send(hist[+r.dataset.i]));
    };
    const send = async (text) => {
      if (!text) return;
      try { await post('/api/clipboard', { text }); toast('Copiado en la PC'); native.vibrate();
        hist.splice(hist.indexOf(text) >>> 0, hist.includes(text) ? 1 : 0); hist.unshift(text); hist.length = Math.min(hist.length, 12);
        localStorage.setItem('crk.cliphist', JSON.stringify(hist)); renderH(); } catch (e) { toast(e.message, 'err'); }
    };
    $('#send', el).onclick = () => send($('#t', el).value);
    $('#paste', el).onclick = async () => { try { $('#t', el).value = await navigator.clipboard.readText(); } catch { toast('Mantén presionado el cuadro y elige Pegar', 'err'); } };
    const read = async () => { try { const r = await get('/api/clipboard'); $('#pc', el).textContent = r.text || '(vacío)'; } catch (e) { $('#pc', el).textContent = e.message; } };
    $('#read', el).onclick = read;
    $('#copy', el).onclick = async () => { try { await navigator.clipboard.writeText($('#pc', el).textContent); toast('Copiado en el teléfono'); } catch { toast('No se pudo copiar', 'err'); } };
    renderH(); read();
  },
};
