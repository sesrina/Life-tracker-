(() => {
  'use strict';

  /* ================= Storage ================= */
  const STORE_KEY = 'cute-planner-v1';
  const COLORS = ['pink', 'lavender', 'mint', 'peach', 'sky'];

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          events: Array.isArray(data.events) ? data.events : [],
          todos: Array.isArray(data.todos) ? data.todos : [],
        };
      }
    } catch (err) {
      console.warn('Could not load saved data', err);
    }
    return { events: [], todos: [] };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      showToast("Couldn't save — is private browsing on?");
    }
  }

  let state = load();

  /* ================= Helpers ================= */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const todayKey = () => dateKey(new Date());
  function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return addDays(x, -((x.getDay() + 6) % 7)); // weeks start on Monday
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function fmtDate(key, opts) {
    return parseKey(key).toLocaleDateString([], opts);
  }

  function relDay(key) {
    const now = new Date();
    if (key === dateKey(now)) return 'Today';
    if (key === dateKey(addDays(now, 1))) return 'Tomorrow';
    if (key === dateKey(addDays(now, -1))) return 'Yesterday';
    return fmtDate(key, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const byTime = (a, b) => (a.time || '').localeCompare(b.time || '') || String(a.title).localeCompare(String(b.title));

  function sortTodos(list) {
    return list.slice().sort((a, b) =>
      (Number(!!a.done) - Number(!!b.done)) ||
      (a.due || '9999').localeCompare(b.due || '9999') ||
      (a.time || '99').localeCompare(b.time || '99') ||
      (a.created || 0) - (b.created || 0));
  }

  const safeColor = (c) => (COLORS.includes(c) ? c : 'pink');

  /* ================= Item templates ================= */
  function eventHTML(ev) {
    return `<li class="item event c-${safeColor(ev.color)}" data-kind="event" data-id="${esc(ev.id)}">
      <button class="item-main" type="button" data-action="edit" aria-label="Edit event ${esc(ev.title)}">
        <span class="time-pill">${ev.time ? esc(fmtTime(ev.time)) : 'All day'}</span>
        <span class="item-title">${esc(ev.title)}</span>
      </button>
    </li>`;
  }

  function todoHTML(t) {
    const today = todayKey();
    const overdue = !t.done && t.due && t.due < today;
    let meta = '';
    if (t.due) {
      meta = (t.time ? '⏰ ' : '📅 ') + relDay(t.due) + (t.time ? ' · ' + fmtTime(t.time) : '') + (overdue ? ' · overdue' : '');
    }
    return `<li class="item todo${t.done ? ' done' : ''}${overdue ? ' overdue' : ''}" data-kind="todo" data-id="${esc(t.id)}">
      <button class="check" type="button" data-action="toggle" aria-pressed="${t.done ? 'true' : 'false'}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}: ${esc(t.title)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </button>
      <button class="item-main" type="button" data-action="edit" aria-label="Edit to-do ${esc(t.title)}">
        <span class="item-title">${esc(t.title)}</span>
        ${meta ? `<span class="item-meta">${esc(meta)}</span>` : ''}
      </button>
    </li>`;
  }

  const emptyHTML = (msg) => `<li class="empty">${msg}</li>`;

  /* ================= Views ================= */
  let currentView = 'today';
  let weekStart = startOfWeek(new Date());
  let todoFilter = 'active';

  const TITLES = { today: 'Today', week: 'This week', todos: 'To-dos & reminders' };

  function renderHeader() {
    const now = new Date();
    $('#screen-title').textContent = TITLES[currentView];
    $('#screen-eyebrow').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function todaysTodos() {
    const key = todayKey();
    return sortTodos(state.todos.filter((t) =>
      t.due === key ||                       // due today (done or not)
      (!t.done && t.due && t.due < key) ||   // overdue
      (!t.done && !t.due) ||                 // anytime
      (t.done && t.doneOn === key)           // finished today
    ));
  }

  function renderToday() {
    const now = new Date();
    const key = todayKey();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning ☀️' : hour < 18 ? 'Good afternoon 🌤️' : 'Good evening 🌙';

    const events = state.events.filter((e) => e.date === key).sort(byTime);
    const todos = todaysTodos();
    const done = todos.filter((t) => t.done).length;

    $('#today-greeting').textContent = greeting;
    let summary;
    if (!events.length && !todos.length) summary = 'Nothing planned yet — enjoy the calm 🍵';
    else {
      const parts = [];
      parts.push(`${events.length} event${events.length === 1 ? '' : 's'}`);
      parts.push(todos.length ? `${done} of ${todos.length} to-dos done` : 'no to-dos');
      summary = parts.join(' · ') + (todos.length && done === todos.length ? ' 🎉' : '');
    }
    $('#today-summary').textContent = summary;
    $('#today-progress').style.width = todos.length ? `${Math.round((done / todos.length) * 100)}%` : '0%';

    $('#today-events').innerHTML = events.length
      ? events.map(eventHTML).join('')
      : emptyHTML('No events today ✨');
    $('#today-todos').innerHTML = todos.length
      ? todos.map(todoHTML).join('')
      : emptyHTML('All clear! Add a to-do to get started 🌱');
  }

  function renderWeek() {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const startLabel = weekStart.toLocaleDateString([], sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
    const endLabel = end.toLocaleDateString([], { day: 'numeric', month: 'short' });
    $('#week-range').textContent = `${startLabel} – ${endLabel}`;

    const isThisWeek = dateKey(weekStart) === dateKey(startOfWeek(new Date()));
    $('#week-today').hidden = isThisWeek;
    TITLES.week = isThisWeek ? 'This week' : 'Week';

    const today = todayKey();
    let html = '';
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const key = dateKey(day);
      const evs = state.events.filter((e) => e.date === key).sort(byTime);
      const tds = sortTodos(state.todos.filter((t) => t.due === key));
      const isToday = key === today;
      const rel = relDay(key);
      const label = ['Today', 'Tomorrow', 'Yesterday'].includes(rel)
        ? rel
        : day.toLocaleDateString([], { weekday: 'long' });

      html += `<section class="day-card${isToday ? ' is-today' : ''}" id="day-${key}">
        <div class="day-head">
          <div class="day-badge" aria-hidden="true">
            <span class="dow">${esc(day.toLocaleDateString([], { weekday: 'short' }))}</span>
            <span class="dnum">${day.getDate()}</span>
          </div>
          <div class="day-title">${esc(label)}<small>${esc(day.toLocaleDateString([], { day: 'numeric', month: 'long' }))}</small></div>
          <button class="btn-add" type="button" data-add="event" data-date="${key}" aria-label="Add event on ${esc(day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }))}">+</button>
        </div>
        <ul class="list">${evs.length ? evs.map(eventHTML).join('') : (tds.length ? '' : emptyHTML('Free day 🌸'))}</ul>
        ${tds.length ? `<ul class="list">${tds.map(todoHTML).join('')}</ul>` : ''}
      </section>`;
    }
    $('#week-days').innerHTML = html;
  }

  function renderTodos() {
    const active = state.todos.filter((t) => !t.done);
    const done = state.todos.filter((t) => t.done);
    $('#count-active').textContent = active.length ? `(${active.length})` : '';
    $('#count-done').textContent = done.length ? `(${done.length})` : '';
    $$('.chip').forEach((c) => {
      const on = c.dataset.filter === todoFilter;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    const list = todoFilter === 'active' ? active : todoFilter === 'done' ? done : state.todos;
    const msg = todoFilter === 'done' ? 'Nothing ticked off yet — you got this 💪' : 'No to-dos! Type one above 🌱';
    $('#todo-list').innerHTML = list.length ? sortTodos(list).map(todoHTML).join('') : emptyHTML(msg);
    $('#clear-done').hidden = !(done.length && todoFilter !== 'active');
  }

  function render() {
    if (currentView === 'today') renderToday();
    if (currentView === 'week') renderWeek();
    if (currentView === 'todos') renderTodos();
    renderHeader();
  }

  function switchView(name) {
    currentView = name;
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${name}`));
    $$('.tab').forEach((t) => {
      const on = t.dataset.view === name;
      t.classList.toggle('is-active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    render();
    window.scrollTo({ top: 0 });
    if (name === 'week') {
      const el = document.getElementById(`day-${todayKey()}`);
      if (el && el.offsetTop > window.innerHeight * 0.5) el.scrollIntoView({ block: 'start' });
    }
  }

  /* ================= Actions ================= */
  const find = (kind, id) => (kind === 'event' ? state.events : state.todos).find((x) => x.id === id);

  function toggleTodo(id) {
    const t = find('todo', id);
    if (!t) return;
    t.done = !t.done;
    t.doneOn = t.done ? todayKey() : null;
    save();
    render();
    if (t.done) showToast('Nice one! 🎉');
  }

  let lastDeleted = null;
  function deleteItem(kind, id) {
    const list = kind === 'event' ? state.events : state.todos;
    const index = list.findIndex((x) => x.id === id);
    if (index < 0) return;
    const [item] = list.splice(index, 1);
    lastDeleted = { kind, item, index };
    save();
    render();
    showToast(kind === 'event' ? 'Event deleted' : 'To-do deleted', true);
  }

  function undoDelete() {
    if (!lastDeleted) return;
    const { kind, item, index } = lastDeleted;
    const list = kind === 'event' ? state.events : state.todos;
    list.splice(Math.min(index, list.length), 0, item);
    lastDeleted = null;
    save();
    render();
    showToast('Restored 🌸');
  }

  /* ================= Sheet (add / edit) ================= */
  const sheet = $('#sheet');
  const form = $('#sheet-form');
  const fTitle = $('#f-title');
  const fDate = $('#f-date');
  const fTime = $('#f-time');
  const fError = $('#f-error');
  let editing = null; // { kind, id }

  function nextHour() {
    const h = Math.min(new Date().getHours() + 1, 23);
    return `${pad(h)}:00`;
  }

  function openSheet(kind, id, defaults = {}) {
    const item = id ? find(kind, id) : null;
    if (id && !item) return;
    editing = { kind, id: item ? item.id : null };
    const isEvent = kind === 'event';

    $('#sheet-title').textContent = `${item ? 'Edit' : 'New'} ${isEvent ? 'event' : 'to-do'}`;
    fTitle.placeholder = isEvent ? "What's happening?" : 'What do you need to do?';
    fTitle.value = item ? item.title : '';
    if (isEvent) {
      fDate.value = item ? item.date : (defaults.date || todayKey());
      fTime.value = item ? (item.time || '') : nextHour();
    } else {
      fDate.value = item ? (item.due || '') : (defaults.date || '');
      fTime.value = item ? (item.time || '') : '';
    }
    $('#f-hint').textContent = isEvent
      ? 'Leave the time empty for an all-day event.'
      : 'Date and time are optional — add them to make it a reminder.';
    $('#f-clear-when').hidden = isEvent;
    $('#f-colors').hidden = !isEvent;
    const color = item ? safeColor(item.color) : 'pink';
    $$('input[name="color"]').forEach((r) => { r.checked = r.value === color; });
    $('#btn-delete').hidden = !item;
    fError.hidden = true;

    sheet.showModal();
    if (!item) setTimeout(() => fTitle.focus(), 50);
  }

  function closeSheet() {
    if (sheet.open) sheet.close();
    editing = null;
  }

  function showError(msg, field) {
    fError.textContent = msg;
    fError.hidden = false;
    field.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editing) return;
    const { kind, id } = editing;
    const title = fTitle.value.trim();
    if (!title) return showError('Please add a title 🙂', fTitle);

    let data;
    if (kind === 'event') {
      if (!fDate.value) return showError('Events need a date', fDate);
      const color = ($('input[name="color"]:checked') || {}).value;
      data = { title, date: fDate.value, time: fTime.value, color: safeColor(color) };
    } else {
      let due = fDate.value;
      const time = fTime.value;
      if (time && !due) due = todayKey();
      data = { title, due, time };
    }

    if (id) {
      Object.assign(find(kind, id), data);
    } else {
      const item = { id: uid(), created: Date.now(), ...data };
      if (kind === 'todo') item.done = false;
      (kind === 'event' ? state.events : state.todos).push(item);
    }
    save();
    closeSheet();
    render();
    showToast(id ? 'Saved ✨' : kind === 'event' ? 'Event added 🗓️' : 'To-do added 🌷');
  });

  $('#btn-cancel').addEventListener('click', closeSheet);
  $('#btn-delete').addEventListener('click', () => {
    if (!editing || !editing.id) return;
    const { kind, id } = editing;
    closeSheet();
    deleteItem(kind, id);
  });
  $('#f-clear-when').addEventListener('click', () => { fDate.value = ''; fTime.value = ''; });
  // Tap the dimmed background to close
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('close', () => { editing = null; });

  /* ================= Toast ================= */
  let toastTimer;
  function showToast(msg, withUndo = false) {
    const toast = $('#toast');
    $('#toast-msg').textContent = msg;
    $('#toast-undo').hidden = !withUndo;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      if (withUndo) lastDeleted = null;
    }, withUndo ? 5000 : 1800);
  }
  $('#toast-undo').addEventListener('click', () => {
    clearTimeout(toastTimer);
    $('#toast').classList.remove('show');
    undoDelete();
  });

  /* ================= Wiring ================= */
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));

  // One listener handles taps on every list item and "+" button
  $('#main').addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const date = addBtn.dataset.date === 'today' ? todayKey() : addBtn.dataset.date;
      openSheet(addBtn.dataset.add, null, { date });
      return;
    }
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const li = actionBtn.closest('[data-kind]');
    if (!li) return;
    const { kind, id } = li.dataset;
    if (actionBtn.dataset.action === 'toggle') toggleTodo(id);
    else if (actionBtn.dataset.action === 'edit') openSheet(kind, id);
  });

  // Week navigation
  $('#week-prev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); render(); });
  $('#week-next').addEventListener('click', () => { weekStart = addDays(weekStart, 7); render(); });
  $('#week-today').addEventListener('click', () => { weekStart = startOfWeek(new Date()); render(); });

  // Swipe left / right on the week screen to change week
  let touchStart = null;
  const weekView = $('#view-week');
  weekView.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  weekView.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) {
      weekStart = addDays(weekStart, dx < 0 ? 7 : -7);
      render();
    }
  }, { passive: true });

  // To-do quick add
  $('#quick-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#quick-title');
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    state.todos.push({ id: uid(), created: Date.now(), title, due: '', time: '', done: false });
    input.value = '';
    if (todoFilter === 'done') todoFilter = 'active';
    save();
    render();
    showToast('To-do added 🌷');
  });

  $$('.chip').forEach((chip) => chip.addEventListener('click', () => { todoFilter = chip.dataset.filter; render(); }));

  $('#clear-done').addEventListener('click', () => {
    const count = state.todos.filter((t) => t.done).length;
    if (!count || !confirm(`Remove ${count} finished to-do${count === 1 ? '' : 's'}?`)) return;
    state.todos = state.todos.filter((t) => !t.done);
    save();
    render();
    showToast('Tidied up ✨');
  });

  // Keep "Today" fresh when you come back to the app (e.g. the next morning)
  let lastDay = todayKey();
  function refreshIfNeeded() {
    if (sheet.open) return;
    if (todayKey() !== lastDay) {
      lastDay = todayKey();
      weekStart = startOfWeek(new Date());
    }
    render();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfNeeded(); });
  setInterval(refreshIfNeeded, 60 * 1000);

  // Pick up changes made in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { state = load(); render(); }
  });

  switchView('today');
})();
