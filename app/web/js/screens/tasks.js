// Lista de tareas: se guarda en la PC (~/.config/crackos/tareas.json) y se sincroniza
import { get, put } from '../api.js';
import { icon, $, $$, esc, toast, modal, ring, updateRing, confirm } from '../ui.js';
import { native } from '../native.js';

const PRI = { alta: '#ff2832', media: '#ffb020', baja: '#5a5a66' };
const CATS = ['General', 'Hacking', 'Estudio', 'Trabajo', 'PC', 'Personal'];

export default {
  async mount(el) {
    let tasks = [], filter = 'pend', cat = 'Todas';
    el.innerHTML = `<div class="panel"><div class="pbody row" style="gap:16px">
        <div id="pr">${ring(0, '0%', 'HECHO', 92)}</div>
        <div class="sp"><div class="big" id="cnt">0</div><div class="mut small">pendientes</div>
          <div class="small" style="margin-top:6px"><span class="red" id="hot">0</span> de prioridad alta · <span id="due">0</span> vencen hoy</div>
          <div class="small mut" id="sync">sincronizado con la PC</div></div></div></div>
      <div class="row" style="gap:8px"><input class="input" id="quick" placeholder="Nueva tarea rápida…"><button class="btn primary" id="add">${icon('plus', 20)}</button></div>
      <div class="chips" style="margin:12px 0 6px"><button class="chip" data-f="pend">Pendientes</button><button class="chip" data-f="done">Hechas</button><button class="chip" data-f="all">Todas</button>
        <span class="sp"></span><button class="chip" id="more">${icon('gear', 14)} Detallada</button></div>
      <div class="chips" id="cats" style="flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px"></div>
      <div id="list"></div>`;
    const save = async (added) => {
      localStorage.setItem('crk.tasks', JSON.stringify(tasks));
      $('#sync', el).textContent = 'guardando en la PC…';
      try { await put('/api/tasks', { tasks, added }); $('#sync', el).textContent = 'sincronizado con la PC ✓'; }
      catch (e) { $('#sync', el).textContent = 'sin conexión: se guardó en el teléfono'; }
    };
    const today = new Date().toISOString().slice(0, 10);
    const render = () => {
      const done = tasks.filter(t => t.done).length, pend = tasks.length - done;
      updateRing($('#pr .ring', el), tasks.length ? 100 * done / tasks.length : 0, (tasks.length ? Math.round(100 * done / tasks.length) : 0) + '%');
      $('#cnt', el).textContent = pend;
      $('#hot', el).textContent = tasks.filter(t => !t.done && t.pri === 'alta').length;
      $('#due', el).textContent = tasks.filter(t => !t.done && t.due && t.due <= today).length;
      $$('[data-f]', el).forEach(c => c.classList.toggle('on', c.dataset.f === filter));
      const cats = ['Todas', ...new Set(tasks.map(t => t.cat || 'General'))];
      $('#cats', el).innerHTML = cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-c="${esc(c)}" style="flex:none">${esc(c)}</button>`).join('');
      $$('#cats .chip', el).forEach(c => c.onclick = () => { cat = c.dataset.c; render(); });
      const order = { alta: 0, media: 1, baja: 2 };
      const list = tasks.filter(t => (filter === 'all' || (filter === 'done') === !!t.done) && (cat === 'Todas' || (t.cat || 'General') === cat))
        .sort((a, b) => (a.done - b.done) || (order[a.pri] - order[b.pri]) || (a.due || '9').localeCompare(b.due || '9'));
      $('#list', el).innerHTML = list.length ? list.map(t => `<div class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
          <span class="pri" style="background:${PRI[t.pri] || PRI.media}"></span>
          <button class="cb" data-t="${t.id}" style="background:${t.done ? '' : 'none'}">${t.done ? icon('check', 14) : ''}</button>
          <div class="sp"><div class="tt">${esc(t.text)}</div><div class="tm"><span class="badge ${t.pri === 'alta' ? 'r' : ''}">${esc(t.pri)}</span>
            <span class="badge">${esc(t.cat || 'General')}</span>${t.due ? `<span class="badge ${!t.done && t.due <= today ? 'r' : ''}">📅 ${esc(t.due)}</span>` : ''}</div></div>
          <button class="iconbtn" data-e="${t.id}" style="width:34px;height:34px">${icon('brush', 15)}</button>
          <button class="iconbtn" data-d="${t.id}" style="width:34px;height:34px">${icon('trash', 15)}</button></div>`).join('')
        : `<div class="empty">${icon('check', 34, 'red')}<p>${filter === 'done' ? 'Aún no completas tareas.' : 'Nada pendiente. Agrega una tarea arriba.'}</p></div>`;
      $$('[data-t]', el).forEach(b => b.onclick = () => { const t = tasks.find(x => x.id === b.dataset.t); t.done = !t.done; t.doneAt = t.done ? Date.now() : null; native.vibrate(t.done ? 25 : 8); render(); save(); });
      $$('[data-d]', el).forEach(b => b.onclick = async () => { if (await confirm('Borrar tarea', 'Se borrará de la PC también.', { danger: true, ok: 'Borrar' })) { tasks = tasks.filter(x => x.id !== b.dataset.d); render(); save(); } });
      $$('[data-e]', el).forEach(b => b.onclick = () => edit(tasks.find(x => x.id === b.dataset.e)));
    };
    const edit = async (t) => {
      const isNew = !t;
      t = t || { id: Math.random().toString(36).slice(2, 10), text: $('#quick', el).value.trim(), pri: 'media', cat: 'General', due: '', done: false, created: Date.now() };
      const r = await modal({ title: isNew ? 'Nueva tarea' : 'Editar tarea', body: `
        <div class="col"><input class="input" id="m-t" placeholder="¿Qué hay que hacer?" value="${esc(t.text)}">
        <label class="small mut">Prioridad</label><div class="chips" id="m-p">${Object.keys(PRI).map(p => `<button class="chip ${p === t.pri ? 'on' : ''}" data-p="${p}">${p}</button>`).join('')}</div>
        <label class="small mut">Categoría</label><div class="chips" id="m-c">${CATS.map(c => `<button class="chip ${c === t.cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
        <label class="small mut">Fecha límite</label><input class="input" type="date" id="m-d" value="${esc(t.due)}"></div>`,
        onOpen: m => {
          m.querySelectorAll('#m-p .chip').forEach(c => c.onclick = () => { t.pri = c.dataset.p; m.querySelectorAll('#m-p .chip').forEach(x => x.classList.toggle('on', x === c)); });
          m.querySelectorAll('#m-c .chip').forEach(c => c.onclick = () => { t.cat = c.dataset.c; m.querySelectorAll('#m-c .chip').forEach(x => x.classList.toggle('on', x === c)); });
        },
        actions: [{ label: 'Cancelar', value: null }, { label: 'Guardar', kind: 'primary', handler: m => ({ text: m.querySelector('#m-t').value.trim(), due: m.querySelector('#m-d').value }) }] });
      if (!r || !r.text) return;
      t.text = r.text; t.due = r.due;
      if (isNew) { tasks.unshift(t); $('#quick', el).value = ''; }
      render(); save(isNew ? t.text : null);
    };
    const quickAdd = () => {
      const v = $('#quick', el).value.trim(); if (!v) return edit();
      const pri = /!|urgente/i.test(v) ? 'alta' : 'media';
      const t = { id: Math.random().toString(36).slice(2, 10), text: v.replace(/!+$/, '').trim(), pri, cat: 'General', due: '', done: false, created: Date.now() };
      tasks.unshift(t); $('#quick', el).value = ''; native.vibrate(15); render(); save(t.text); toast('Tarea agregada (también en la PC)');
    };
    $('#add', el).onclick = quickAdd;
    $('#quick', el).onkeydown = e => { if (e.key === 'Enter') quickAdd(); };
    $('#more', el).onclick = () => edit();
    $$('[data-f]', el).forEach(c => c.onclick = () => { filter = c.dataset.f; render(); });
    try { tasks = (await get('/api/tasks')).tasks; }
    catch { tasks = JSON.parse(localStorage.getItem('crk.tasks') || '[]'); $('#sync', el).textContent = 'sin conexión: mostrando copia del teléfono'; }
    render();
    window.__crkTasks = { add: (text) => { $('#quick', el).value = text; quickAdd(); } };
  },
};
