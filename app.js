(() => {
  'use strict';

  /* ================= Storage ================= */
  const STORE_KEY = 'cute-planner-v1';
  const COLORS = ['pink', 'lavender', 'mint', 'peach', 'sky'];

  const DEFAULT_ROUTINE = {
    morning: ['💧 Glass of water', '🛏️ Make the bed', '📋 Look at today\'s plan', '👜 Bag, lunch & keys ready'],
    night: ['✅ Tick off today', '🌙 Check tomorrow', '👗 Clothes & bag ready', '🔌 Phone on charge', '😴 Lights out (7+ hours sleep)'],
  };
  function normRoutine(r) {
    const ok = r && typeof r === 'object';
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const list = (arr, def) => (Array.isArray(arr) ? arr : def.map((title) => ({ id: newId(), title })))
      .filter((x) => x && typeof x.title === 'string' && x.id);
    return {
      morning: list(ok && r.morning, DEFAULT_ROUTINE.morning),
      night: list(ok && r.night, DEFAULT_ROUTINE.night),
      done: ok && r.done && typeof r.done === 'object' && !Array.isArray(r.done) ? r.done : {},
    };
  }

  function normCycle(c) {
    const ok = c && typeof c === 'object';
    const days = ok && c.days && typeof c.days === 'object' && !Array.isArray(c.days) ? c.days : {};
    return { days, showOnToday: ok ? c.showOnToday !== false : true };
  }

  function normGoogle(g) {
    const ok = g && typeof g === 'object';
    return {
      clientId: ok && typeof g.clientId === 'string' ? g.clientId : '',
      connected: ok ? !!g.connected : false,
      autoPush: ok ? g.autoPush !== false : true,
      events: ok && Array.isArray(g.events) ? g.events : [],
      range: ok && g.range && typeof g.range.from === 'string' ? g.range : null,
      lastSync: ok && typeof g.lastSync === 'number' ? g.lastSync : 0,
      pendingDeletes: ok && Array.isArray(g.pendingDeletes) ? g.pendingDeletes : [],
      tasks: ok && Array.isArray(g.tasks) ? g.tasks : [],
      needsReauth: ok ? !!g.needsReauth : false,
      tasksOff: ok ? !!g.tasksOff : false,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        return normState(JSON.parse(raw));
      }
    } catch (err) {
      console.warn('Could not load saved data', err);
    }
    return normState({});
  }

  function normState(data) {
    const d = data && typeof data === 'object' ? data : {};
    const lock = d.lock && typeof d.lock === 'object' ? d.lock : {};
    const backup = d.backup && typeof d.backup === 'object' ? d.backup : {};
    return {
      events: Array.isArray(d.events) ? d.events : [],
      todos: Array.isArray(d.todos) ? d.todos : [],
      cycle: normCycle(d.cycle),
      routine: normRoutine(d.routine),
      journal: d.journal && typeof d.journal === 'object' && !Array.isArray(d.journal) ? d.journal : {},
      google: normGoogle(d.google),
      lock: {
        on: !!lock.on && typeof lock.hash === 'string' && typeof lock.salt === 'string',
        hash: typeof lock.hash === 'string' ? lock.hash : '',
        salt: typeof lock.salt === 'string' ? lock.salt : '',
      },
      backup: { last: typeof backup.last === 'number' ? backup.last : 0 },
    };
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
  const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ================= Cycle maths ================= */
  const FLOWS = ['light', 'medium', 'heavy'];
  const SYMPTOMS = [
    ['cramps', '🌀 Cramps'], ['headache', '🤕 Headache'], ['bloating', '🎈 Bloating'],
    ['tired', '😴 Tired'], ['moody', '🌧️ Moody'], ['spots', '🫧 Spots'],
    ['tender', '💗 Tender breasts'], ['backache', '🦴 Back pain'], ['cravings', '🍫 Cravings'],
    ['good', '🌈 Feeling good'],
  ];
  const isPeriodDay = (e) => !!e && FLOWS.includes(e.flow);
  const hasLog = (e) => !!e && ((Array.isArray(e.symptoms) && e.symptoms.length > 0) || !!e.note);
  const mean = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  function cycleStats() {
    const days = state.cycle.days;
    const tk = todayKey();
    const keys = Object.keys(days).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= tk && isPeriodDay(days[k])).sort();
    const periods = [];
    let cur = null;
    for (const k of keys) {
      if (cur && diffDays(cur.end, k) <= 2) cur.end = k; // a 1-day gap still counts as the same period
      else { cur = { start: k, end: k }; periods.push(cur); }
    }
    periods.forEach((p) => { p.length = diffDays(p.start, p.end) + 1; });
    const cycles = [];
    for (let i = 1; i < periods.length; i++) {
      const d = diffDays(periods[i - 1].start, periods[i].start);
      if (d >= 15 && d <= 60) cycles.push(d); // ignore missed logs / outliers
    }
    return {
      periods,
      cycles,
      avgCycle: cycles.length ? mean(cycles.slice(-6)) : 28,
      avgPeriod: (() => {
        // leave out a period that's still going, so it doesn't drag the average down
        const ongoing = periods.length && diffDays(periods[periods.length - 1].end, tk) <= 1;
        const done = ongoing ? periods.slice(0, -1) : periods;
        return done.length ? Math.min(10, mean(done.slice(-6).map((p) => p.length))) : 5;
      })(),
      last: periods[periods.length - 1] || null,
    };
  }

  function cyclePredictions(st, untilKey) {
    const period = new Set();
    const fertile = new Set();
    const out = { period, fertile, nextStart: null, lateBy: 0, starts: [] };
    if (!st.last) return out;
    const tk = todayKey();
    const today = parseKey(tk);
    let s = addDays(parseKey(st.last.start), st.avgCycle);
    if (s < today && st.last.end < tk) {
      out.lateBy = diffDays(dateKey(s), tk);
      s = today;
    }
    out.nextStart = dateKey(s);
    if (out.lateBy > 45) return out; // data is stale, don't guess
    const until = parseKey(untilKey);
    for (let i = 0; i < 24 && addDays(s, -19) <= until; i++) {
      out.starts.push(dateKey(s));
      for (let j = 0; j < st.avgPeriod; j++) period.add(dateKey(addDays(s, j)));
      const ovulation = addDays(s, -14);
      for (let j = -5; j <= 1; j++) {
        const k = dateKey(addDays(ovulation, j));
        if (k >= tk && k > st.last.end) fertile.add(k);
      }
      s = addDays(s, st.avgCycle);
    }
    return out;
  }

  /* ================= Cycle phases ================= */
  const PHASES = {
    menstrual: {
      name: 'Menstrual', emoji: '🩸',
      about: 'Your period. Hormone levels are at their lowest, so you might feel tired, crampy or want to turn inward.',
      tips: '💡 Rest, warmth on your tummy, iron-rich foods and gentle movement like walking or stretching.',
    },
    follicular: {
      name: 'Follicular', emoji: '🌱',
      about: 'Estrogen rises as your body gets an egg ready. Many people feel energy, mood and motivation lift.',
      tips: '💡 A great time to start new things, make plans, be social or try a tougher workout.',
    },
    ovulation: {
      name: 'Ovulation', emoji: '✨',
      about: 'An egg is released, usually around the middle of your cycle. Energy and confidence often peak, and this is your most fertile time.',
      tips: '💡 Drink plenty of water. Some people notice a mild twinge on one side, which is normal.',
    },
    luteal: {
      name: 'Luteal', emoji: '🍂',
      about: 'Progesterone rises after ovulation. Towards the end you may notice PMS, like bloating, cravings, tender breasts or mood dips.',
      tips: '💡 Slow down a little, get extra sleep and eat regular meals. Magnesium-rich foods like dark chocolate, nuts and leafy greens can help.',
    },
  };
  const PHASE_ORDER = ['menstrual', 'follicular', 'ovulation', 'luteal'];

  // Ovulation is estimated ~14 days before the next period
  function phaseRanges(L, P) {
    const O = Math.max(P + 2, L - 14);
    return { menstrual: [1, P], follicular: [P + 1, O - 2], ovulation: [O - 1, O + 1], luteal: [O + 2, L] };
  }
  function phaseOfDay(day, L, P) {
    const r = phaseRanges(L, P);
    return PHASE_ORDER.find((ph) => day >= r[ph][0] && day <= r[ph][1]) || 'luteal';
  }

  // Everything the cycle screens need, in one place
  function cycleModel(untilKey) {
    const tk = todayKey();
    const st = cycleStats();
    const pred = cyclePredictions(st, untilKey > tk ? untilKey : tk);
    const cycles = st.periods.map((p, i) => {
      const ongoing = i === st.periods.length - 1 && diffDays(p.end, tk) <= 1;
      return { start: p.start, P: ongoing ? Math.max(p.length, st.avgPeriod) : p.length };
    });
    pred.starts.forEach((s) => { if (s > (st.last ? st.last.end : '')) cycles.push({ start: s, P: st.avgPeriod }); });
    cycles.forEach((c, i) => { c.L = cycles[i + 1] ? diffDays(c.start, cycles[i + 1].start) : st.avgCycle; });

    function phaseFor(key) {
      let c = null;
      for (const x of cycles) { if (x.start <= key) c = x; else break; }
      if (!c) return null;
      const day = diffDays(c.start, key) + 1;
      if (isPeriodDay(state.cycle.days[key])) return { phase: 'menstrual', day, L: c.L, P: c.P };
      if (day > c.L || (c.L > 60 && day > st.avgCycle)) return null; // gap in logging, don't guess
      return { phase: phaseOfDay(day, c.L, c.P), day, L: c.L, P: c.P };
    }
    return { st, pred, phaseFor };
  }

  function cycleStatus(st, pred) {
    const tk = todayKey();
    if (!st.last) {
      return { num: '–', label: 'Day', p: 0, short: '',
        status: 'Start tracking 🌙',
        sub: 'Tap “My period started” on day one, or tap days on the calendar to log past periods.' };
    }
    const day = diffDays(st.last.start, tk) + 1;
    const p = Math.min(100, Math.round((day / st.avgCycle) * 100));
    if (isPeriodDay(state.cycle.days[tk])) {
      return { num: day, label: 'Period day', p, short: `Period day ${day}`,
        status: 'On your period 🩸', sub: 'Be gentle with yourself today 💗' };
    }
    if (pred.lateBy > 45) {
      return { num: day, label: 'Cycle day', p: 100, short: `Cycle day ${day}`,
        status: 'Time for an update', sub: 'Log your latest period to get fresh predictions.' };
    }
    if (pred.lateBy > 0) {
      return { num: day, label: 'Cycle day', p: 100, short: `Period ${plural(pred.lateBy, 'day')} late`,
        status: `Period is ${plural(pred.lateBy, 'day')} late`,
        sub: 'Cycles can shift with stress, travel, illness or sleep.' };
    }
    const until = diffDays(tk, pred.nextStart);
    const status = until === 0 ? 'Period may start today' : `Next period in ~${plural(until, 'day')}`;
    let sub = `Expected around ${fmtDate(pred.nextStart, { weekday: 'short', day: 'numeric', month: 'short' })}`;
    if (pred.fertile.has(tk)) sub += ' · in your fertile window (estimate)';
    if (!st.cycles.length) sub += '. Based on a typical 28-day cycle until you log another period.';
    return { num: day, label: 'Cycle day', p, short: `Cycle day ${day} · ${status.charAt(0).toLowerCase()}${status.slice(1)}`, status, sub };
  }

  /* ================= Item templates ================= */
  function eventHTML(ev) {
    return `<li class="item event c-${safeColor(ev.color)}" data-kind="event" data-id="${esc(ev.id)}">
      <button class="item-main" type="button" data-action="edit" aria-label="Edit event ${esc(ev.title)}">
        <span class="time-pill">${ev.time ? esc(fmtTime(ev.time)) : 'All day'}</span>
        <span class="item-title">${esc(ev.title)}</span>
        ${ev.gSync && state.google.connected ? '<span class="g-badge" title="Also in Google Calendar">🗓️</span>' : ''}
      </button>
    </li>`;
  }

  const safeHex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#7fc4ec');

  function gEventHTML(g) {
    const time = g.allDay ? 'All day' : fmtTime(g.time);
    const inner = `<span class="time-pill">${esc(time)}</span>
      <span class="g-text"><span class="item-title">${esc(g.title)}</span><span class="item-meta">${esc(g.calName || 'Google')}</span></span>`;
    const link = typeof g.link === 'string' && g.link.startsWith('https://') ? g.link : '';
    return `<li class="item event gcal" style="--gc:${safeHex(g.color)}">${link
      ? `<a class="item-main" href="${esc(link)}" target="_blank" rel="noopener" aria-label="${esc(g.title)}, open in Google Calendar">${inner}</a>`
      : `<div class="item-main">${inner}</div>`}</li>`;
  }

  // Google events on a given day (skipping ones that are copies of planner events)
  function gEventsOn(key) {
    if (!state.google.connected) return [];
    const mine = new Set(state.events.map((e) => e.gId).filter(Boolean));
    return state.google.events.filter((g) => {
      if (g.primary && mine.has(g.gid)) return false;
      return g.allDay ? g.start <= key && key < g.end : g.start === key;
    });
  }

  // Planner + Google events for a day, sorted by time
  function dayEvents(key) {
    const mine = state.events.filter((e) => e.date === key).map((e) => ({ time: e.time || '', title: e.title, html: eventHTML(e) }));
    const theirs = gEventsOn(key).map((g) => ({ time: g.allDay ? '' : g.time, title: g.title, html: gEventHTML(g) }));
    return mine.concat(theirs).sort(byTime).map((x) => x.html);
  }

  // Local to-dos plus Google Tasks, in one list
  function allTodos() {
    const g = state.google.connected
      ? state.google.tasks.map((t) => ({ ...t, isG: true, time: '', created: 0 }))
      : [];
    return state.todos.concat(g);
  }

  function gtaskHTML(t) {
    const today = todayKey();
    const overdue = !t.done && t.due && t.due < today;
    const where = `Google Tasks${t.listName && t.listName !== 'My Tasks' ? ` · ${t.listName}` : ''}`;
    const meta = (t.due ? `📅 ${relDay(t.due)}${overdue ? ' · overdue' : ''} · ` : '') + where;
    const link = typeof t.link === 'string' && t.link.startsWith('https://') ? t.link : '';
    return `<li class="item todo gtask${t.done ? ' done' : ''}${overdue ? ' overdue' : ''}" data-kind="gtask" data-id="${esc(t.id)}">
      <button class="check" type="button" data-action="toggle" aria-pressed="${t.done ? 'true' : 'false'}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}: ${esc(t.title)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </button>
      ${link ? `<a class="item-main" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Open ${esc(t.title)} in Google Tasks">` : '<button class="item-main" type="button" data-action="edit">'}
        <span class="item-title">${esc(t.title)}</span>
        <span class="item-meta">${esc(meta)}</span>
      ${link ? '</a>' : '</button>'}
    </li>`;
  }

  function todoHTML(t) {
    if (t.isG) return gtaskHTML(t);
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

  /* ================= Routines ================= */
  // Morning shows from 3 am until midday, night from 8 pm
  const routineSlot = (hour) => (hour >= 3 && hour < 12 ? 'morning' : hour >= 20 ? 'night' : null);

  function routineDay(key) {
    const d = state.routine.done[key];
    return d && typeof d === 'object' ? d : {};
  }

  function routineStreak(slot) {
    let n = 0;
    let d = new Date();
    if (!routineDay(todayKey())[`${slot}All`]) d = addDays(d, -1); // today still in progress
    for (let i = 0; i < 400; i++) {
      if (!routineDay(dateKey(d))[`${slot}All`]) break;
      n++;
      d = addDays(d, -1);
    }
    return n;
  }

  function renderRoutine(hour) {
    const card = $('#routine-card');
    const slot = routineSlot(hour);
    const steps = slot ? state.routine[slot] : [];
    card.hidden = !slot || !steps.length;
    if (card.hidden) return;
    const done = Array.isArray(routineDay(todayKey())[slot]) ? routineDay(todayKey())[slot] : [];
    const count = steps.filter((s) => done.includes(s.id)).length;
    const all = count === steps.length;
    const streak = routineStreak(slot);
    card.classList.toggle('is-night', slot === 'night');
    card.classList.toggle('is-done', all);
    $('#routine-title').textContent = slot === 'morning' ? '☀️ Morning routine' : '🌙 Night routine';
    $('#routine-sub').textContent = (all ? 'All done, well done! 🎉' : `${count} of ${steps.length} done`) +
      (streak ? ` · 🔥 ${plural(streak, 'day')} in a row` : '');
    $('#routine-list').innerHTML = steps.map((s) => {
      const on = done.includes(s.id);
      return `<li><button class="routine-step${on ? ' done' : ''}" type="button" data-step="${esc(s.id)}" data-slot="${slot}" aria-pressed="${on}">
        <span class="tick" aria-hidden="true">✓</span><span>${esc(s.title)}</span></button></li>`;
    }).join('');
  }

  function toggleStep(slot, id) {
    const key = todayKey();
    const day = { ...routineDay(key) };
    const list = Array.isArray(day[slot]) ? day[slot].slice() : [];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    day[slot] = list;
    const wasAll = !!day[`${slot}All`];
    day[`${slot}All`] = state.routine[slot].every((s) => list.includes(s.id));
    state.routine.done[key] = day;
    // keep about two months of history
    const cutoff = dateKey(addDays(new Date(), -60));
    Object.keys(state.routine.done).forEach((k) => { if (k < cutoff) delete state.routine.done[k]; });
    save();
    render();
    if (day[`${slot}All`] && !wasAll) showToast(slot === 'morning' ? 'Morning routine done! Have a great day ☀️' : 'All done. Sleep well 🌙');
  }

  /* ================= Views ================= */
  let currentView = 'today';
  let weekStart = startOfWeek(new Date());
  let todoFilter = 'active';

  const TITLES = { today: 'Today', week: 'This week', todos: 'To-dos & reminders', cycle: 'My cycle', journal: 'Journal' };
  let monthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  function renderHeader() {
    const now = new Date();
    $('#screen-title').textContent = TITLES[currentView];
    $('#screen-eyebrow').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function todaysTodos() {
    const key = todayKey();
    return sortTodos(allTodos().filter((t) =>
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

    const events = dayEvents(key);
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
      ? events.join('')
      : emptyHTML('No events today ✨');
    $('#today-todos').innerHTML = todos.length
      ? todos.map(todoHTML).join('')
      : emptyHTML('All clear! Add a to-do to get started 🌱');

    // Evening mode: from 8 pm, show what's coming tomorrow
    const evening = hour >= 20;
    $('#tomorrow-block').hidden = !evening;
    if (evening) {
      const tk = dateKey(addDays(now, 1));
      const tasks = sortTodos(allTodos().filter((t) => t.due === tk && !t.done)).map(todoHTML);
      const items = dayEvents(tk).concat(tasks);
      $('#tomorrow-date').textContent = fmtDate(tk, { weekday: 'long', day: 'numeric', month: 'long' });
      $('#tomorrow-list').innerHTML = items.length
        ? items.join('')
        : emptyHTML('Nothing planned yet. A fresh start 🌱');
    }

    renderRoutine(hour);
    const jEntry = journalEntry(key);
    $('#today-journal').hidden = !(hour >= 19 && !(jEntry && (jEntry.mood || jEntry.text)));

    const mini = $('#today-cycle');
    const model = cycleModel(todayKey());
    if (state.cycle.showOnToday && model.st.last) {
      const info = cycleStatus(model.st, model.pred);
      const ph = model.phaseFor(todayKey());
      mini.innerHTML = `<span>🌙 ${esc(info.short)}</span>` +
        (ph ? `<small>${PHASES[ph.phase].emoji} ${PHASES[ph.phase].name} phase</small>` : '');
      mini.hidden = false;
    } else {
      mini.hidden = true;
    }
  }

  function renderCycle() {
    const tk = todayKey();
    const days = state.cycle.days;
    const first = monthCursor;
    const gridStart = startOfWeek(first);
    const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const gridEnd = addDays(startOfWeek(lastOfMonth), 6);
    const model = cycleModel(dateKey(gridEnd));
    const { st, pred } = model;
    const info = cycleStatus(st, pred);

    // Current phase card
    const cur = model.phaseFor(tk);
    const card = $('#phase-card');
    card.hidden = !cur;
    if (cur) {
      const ph = PHASES[cur.phase];
      card.className = `phase-card ph-${cur.phase}`;
      $('#phase-emoji').textContent = ph.emoji;
      $('#phase-name').textContent = `${ph.name} phase`;
      $('#phase-about').textContent = ph.about;
      $('#phase-tips').textContent = ph.tips;
      const L = Math.max(cur.L, cur.day);
      const r = phaseRanges(L, cur.P);
      $('#phase-bar').innerHTML = PHASE_ORDER
        .filter((k) => r[k][1] >= r[k][0])
        .map((k) => `<span class="phase-seg ph-${k}" style="flex-grow:${r[k][1] - r[k][0] + 1}"></span>`)
        .join('') + `<span class="phase-marker" style="left:${((cur.day - 0.5) / L) * 100}%"></span>`;
      $('#phase-list').innerHTML = PHASE_ORDER
        .filter((k) => r[k][1] >= r[k][0])
        .map((k) => {
          const [a, b] = r[k];
          const days = a === b ? `Day ${a}` : `Days ${a}–${b}`;
          return `<li class="ph-${k}${k === cur.phase ? ' is-current' : ''}"><span class="dot"></span>${PHASES[k].emoji} ${PHASES[k].name}${k === cur.phase ? ' · now' : ''}<span class="days">${days}</span></li>`;
        }).join('');
    }

    $('#cycle-ring').style.setProperty('--p', info.p);
    $('#cycle-ring-label').textContent = info.label;
    $('#cycle-ring-num').textContent = info.num;
    $('#cycle-status').textContent = info.status;
    $('#cycle-sub').textContent = info.sub;

    // Quick buttons
    const todayEntry = days[tk];
    const yesterdayEntry = days[dateKey(addDays(new Date(), -1))];
    const quick = $('#cycle-quick');
    if (isPeriodDay(todayEntry)) { quick.textContent = '✏️ Edit today'; quick.dataset.mode = 'edit'; }
    else if (isPeriodDay(yesterdayEntry)) { quick.textContent = '🩸 Still on my period'; quick.dataset.mode = 'log'; }
    else { quick.textContent = '🩸 My period started'; quick.dataset.mode = 'log'; }
    $('#cycle-feel').hidden = isPeriodDay(todayEntry);

    // Month calendar
    $('#month-label').textContent = first.toLocaleDateString([], { month: 'long', year: 'numeric' });
    const now = new Date();
    $('#month-today').hidden = first.getFullYear() === now.getFullYear() && first.getMonth() === now.getMonth();
    let html = '';
    for (let i = 0; i < 7; i++) {
      html += `<div class="cal-dow" aria-hidden="true">${esc(addDays(gridStart, i).toLocaleDateString([], { weekday: 'narrow' }))}</div>`;
    }
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      const key = dateKey(d);
      const e = days[key];
      const cls = ['cal-day'];
      const notes = [];
      if (d.getMonth() !== first.getMonth()) cls.push('out');
      const ph = model.phaseFor(key);
      if (ph) { cls.push(`ph-${ph.phase}`); notes.push(`${PHASES[ph.phase].name.toLowerCase()} phase`); }
      if (key === tk) { cls.push('today'); notes.push('today'); }
      if (isPeriodDay(e)) { cls.push('period'); notes.push(`period, ${e.flow} flow`); }
      else if (e && e.flow === 'spotting') { cls.push('spotting'); notes.push('spotting'); }
      else if (pred.period.has(key)) { cls.push('predicted'); notes.push('predicted period'); }
      else if (pred.fertile.has(key)) { cls.push('fertile'); notes.push('fertile window estimate'); }
      if (hasLog(e)) { cls.push('has-log'); notes.push('has notes'); }
      const label = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) + (notes.length ? ' — ' + notes.join(', ') : '');
      html += `<button type="button" class="${cls.join(' ')}" data-day="${key}" aria-label="${esc(label)}">${d.getDate()}</button>`;
    }
    $('#cal').innerHTML = html;

    // Stats
    $('#stat-cycle').textContent = st.cycles.length ? `${st.avgCycle}d` : '–';
    $('#stat-period').textContent = st.periods.length ? `${st.avgPeriod}d` : '–';
    $('#stat-count').textContent = st.periods.length;

    // History
    const hist = st.periods.slice().reverse().slice(0, 12).map((p, idx, arr) => {
      const range = p.start === p.end
        ? fmtDate(p.start, { day: 'numeric', month: 'short' })
        : `${fmtDate(p.start, { day: 'numeric', month: 'short' })} – ${fmtDate(p.end, { day: 'numeric', month: 'short' })}`;
      const year = p.start.slice(0, 4) !== tk.slice(0, 4) ? ` ${p.start.slice(0, 4)}` : '';
      let meta = plural(p.length, 'day');
      if (idx === 0) meta += ` · current cycle, day ${diffDays(p.start, tk) + 1}`;
      else meta += ` · ${diffDays(p.start, arr[idx - 1].start)}-day cycle`;
      return `<li class="item"><button class="item-main" type="button" data-day="${p.start}">
        <span class="item-title">🩸 ${esc(range + year)}</span><span class="item-meta">${esc(meta)}</span></button></li>`;
    });
    $('#period-history').innerHTML = hist.length ? hist.join('') : emptyHTML('Your periods will show up here 🌸');
    $('#cycle-show-today').checked = state.cycle.showOnToday;
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
      const evs = dayEvents(key);
      const tds = sortTodos(allTodos().filter((t) => t.due === key));
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
        <ul class="list">${evs.length ? evs.join('') : (tds.length ? '' : emptyHTML('Free day 🌸'))}</ul>
        ${tds.length ? `<ul class="list">${tds.map(todoHTML).join('')}</ul>` : ''}
      </section>`;
    }
    $('#week-days').innerHTML = html;
    maybeFetchWeek();
  }

  function renderTodos() {
    const everything = allTodos();
    const active = everything.filter((t) => !t.done);
    const done = everything.filter((t) => t.done);
    $('#count-active').textContent = active.length ? `(${active.length})` : '';
    $('#count-done').textContent = done.length ? `(${done.length})` : '';
    $$('.chip').forEach((c) => {
      const on = c.dataset.filter === todoFilter;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    const list = todoFilter === 'active' ? active : todoFilter === 'done' ? done : everything;
    const msg = todoFilter === 'done' ? 'Nothing ticked off yet — you got this 💪' : 'No to-dos! Type one above 🌱';
    $('#todo-list').innerHTML = list.length ? sortTodos(list).map(todoHTML).join('') : emptyHTML(msg);
    $('#clear-done').hidden = !(state.todos.some((t) => t.done) && todoFilter !== 'active');
  }

  // Journal and Cycle hide behind the PIN lock when it's on
  let unlocked = false;
  const PRIVATE_VIEWS = { journal: 'Journal', cycle: 'Cycle' };
  const isLocked = () => state.lock.on && !unlocked;
  const isLockedView = (v) => isLocked() && !!PRIVATE_VIEWS[v];

  function render() {
    const lockedView = isLockedView(currentView);
    $('#view-lock').classList.toggle('is-active', lockedView);
    const viewEl = document.getElementById(`view-${currentView}`);
    if (viewEl) viewEl.classList.toggle('is-active', !lockedView);
    if (lockedView) {
      $('#lock-title').textContent = `${PRIVATE_VIEWS[currentView]} is locked`;
      $('#lock-error').hidden = true;
      renderGBar();
      renderHeader();
      return;
    }
    if (currentView === 'today') renderToday();
    if (currentView === 'week') renderWeek();
    if (currentView === 'todos') renderTodos();
    if (currentView === 'cycle') renderCycle();
    if (currentView === 'journal') renderJournal();
    renderGBar();
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
    const fromGoogle = kind === 'event' && item.gId && item.gSync;
    if (fromGoogle) state.google.pendingDeletes.push(item.gId);
    save();
    render();
    showToast(kind === 'event' ? (fromGoogle ? 'Deleted here and in Google' : 'Event deleted') : 'To-do deleted', true);
    if (fromGoogle) googlePush(true); // quiet, so the Undo button stays visible
  }

  function undoDelete() {
    if (!lastDeleted) return;
    const { kind, item, index } = lastDeleted;
    const list = kind === 'event' ? state.events : state.todos;
    list.splice(Math.min(index, list.length), 0, item);
    lastDeleted = null;
    if (kind === 'event' && item.gId && item.gSync) {
      const pd = state.google.pendingDeletes;
      if (pd.includes(item.gId)) state.google.pendingDeletes = pd.filter((x) => x !== item.gId);
      else { item.gId = null; item.gDirty = true; } // already removed from Google, so add it again
      googlePush();
    }
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
    $('#f-gsync-row').hidden = !(isEvent && state.google.connected);
    $('#f-gsync').checked = item ? !!item.gSync : state.google.autoPush;
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
      if (state.google.connected) {
        data.gSync = $('#f-gsync').checked;
        if (data.gSync) data.gDirty = true;
      }
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
    if (kind === 'event' && data.gSync) googlePush();
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
    const jday = e.target.closest('[data-jday]');
    if (jday) { openJournal(jday.dataset.jday); return; }
    if (e.target.closest('#today-journal')) {
      // writing a new entry needs no PIN; only an existing entry stays behind the lock
      if (isLocked() && journalEntry(todayKey())) switchView('journal'); else openJournal(todayKey());
      return;
    }
    if (e.target.closest('#backup-nudge')) { openSettings(); return; }
    const step = e.target.closest('[data-step]');
    if (step) { toggleStep(step.dataset.slot, step.dataset.step); return; }
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { openDaySheet(dayBtn.dataset.day); return; }
    if (e.target.closest('#today-cycle')) { switchView('cycle'); return; }
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const d = addBtn.dataset.date;
      const date = d === 'today' ? todayKey() : d === 'tomorrow' ? dateKey(addDays(new Date(), 1)) : d;
      openSheet(addBtn.dataset.add, null, { date });
      return;
    }
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const li = actionBtn.closest('[data-kind]');
    if (!li) return;
    const { kind, id } = li.dataset;
    if (kind === 'gtask') {
      if (actionBtn.dataset.action === 'toggle') toggleGTask(id); else openGTask(id);
      return;
    }
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
    if (sheet.open || daySheet.open || settingsSheet.open || routineSheet.open || journalSheet.open) return;
    if (todayKey() !== lastDay) {
      lastDay = todayKey();
      weekStart = startOfWeek(new Date());
    }
    render();
    maybeAutoSync();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.lock.on && unlocked) { unlocked = false; render(); } // lock again when you leave the app
      return;
    }
    refreshIfNeeded();
  });
  setInterval(refreshIfNeeded, 60 * 1000);

  /* ================= Cycle wiring ================= */
  const daySheet = $('#day-sheet');
  let editingDay = null;

  $('#symptom-group').innerHTML = SYMPTOMS.map(([id, label]) =>
    `<label class="pill"><input type="checkbox" name="symptom" value="${id}"><span>${label}</span></label>`).join('');

  function openDaySheet(key) {
    editingDay = key;
    const e = state.cycle.days[key] || {};
    const rel = relDay(key);
    const long = fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#day-title').textContent = ['Today', 'Tomorrow', 'Yesterday'].includes(rel) ? `${rel} · ${long}` : long;
    const ph = cycleModel(key).phaseFor(key);
    $('#day-phase').textContent = ph
      ? `${PHASES[ph.phase].emoji} ${PHASES[ph.phase].name} phase · cycle day ${ph.day}${key > todayKey() ? ' (estimate)' : ''}`
      : '';
    $$('input[name="flow"]').forEach((r) => { r.checked = r.value === (e.flow || ''); });
    const syms = Array.isArray(e.symptoms) ? e.symptoms : [];
    $$('input[name="symptom"]').forEach((c) => { c.checked = syms.includes(c.value); });
    $('#day-note').value = e.note || '';
    $('#day-clear').hidden = !state.cycle.days[key];
    daySheet.showModal();
  }

  function closeDaySheet() {
    if (daySheet.open) daySheet.close();
    editingDay = null;
  }

  $('#day-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingDay) return;
    const flow = ($('input[name="flow"]:checked') || {}).value || '';
    const symptoms = $$('input[name="symptom"]:checked').map((c) => c.value);
    const note = $('#day-note').value.trim();
    if (flow || symptoms.length || note) state.cycle.days[editingDay] = { flow, symptoms, note };
    else delete state.cycle.days[editingDay];
    save();
    closeDaySheet();
    render();
    showToast('Saved 🌙');
  });
  $('#day-cancel').addEventListener('click', closeDaySheet);
  $('#day-clear').addEventListener('click', () => {
    if (editingDay) delete state.cycle.days[editingDay];
    save();
    closeDaySheet();
    render();
    showToast('Day cleared');
  });
  daySheet.addEventListener('click', (e) => { if (e.target === daySheet) closeDaySheet(); });
  daySheet.addEventListener('close', () => { editingDay = null; });

  $('#cycle-quick').addEventListener('click', (e) => {
    const tk = todayKey();
    if (e.currentTarget.dataset.mode === 'edit') { openDaySheet(tk); return; }
    const prev = state.cycle.days[dateKey(addDays(new Date(), -1))];
    const existing = state.cycle.days[tk] || { symptoms: [], note: '' };
    state.cycle.days[tk] = { ...existing, flow: isPeriodDay(prev) ? prev.flow : 'medium' };
    save();
    render();
    showToast('Logged for today 🩸');
  });
  $('#cycle-feel').addEventListener('click', () => openDaySheet(todayKey()));
  $('#cycle-show-today').addEventListener('change', (e) => {
    state.cycle.showOnToday = e.target.checked;
    save();
  });
  $('#month-prev').addEventListener('click', () => {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1); render();
  });
  $('#month-next').addEventListener('click', () => {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1); render();
  });
  $('#month-today').addEventListener('click', () => {
    const n = new Date(); monthCursor = new Date(n.getFullYear(), n.getMonth(), 1); render();
  });

  /* ================= Journal ================= */
  const MOODS = { 1: ['😞', 'Awful'], 2: ['😕', 'Meh'], 3: ['😐', 'Okay'], 4: ['🙂', 'Good'], 5: ['😄', 'Great'] };
  const ENERGY = { 1: '🪫 Low energy', 2: '🔋 Okay energy', 3: '⚡ High energy' };
  const journalSheet = $('#journal-sheet');
  let editingJournal = null;

  function journalEntry(key) {
    const e = state.journal[key];
    return e && typeof e === 'object' ? e : null;
  }
  const moodOf = (e) => (e && MOODS[e.mood] ? Number(e.mood) : 0);
  const moodEmoji = (avg) => MOODS[Math.min(5, Math.max(1, Math.round(avg)))][0];
  const avgOf = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  function entryContext(key) {
    const parts = [];
    const ph = cycleModel(key).phaseFor(key);
    if (ph) parts.push(`${PHASES[ph.phase].emoji} ${PHASES[ph.phase].name} · cycle day ${ph.day}`);
    const n = dayEvents(key).length;
    if (n) parts.push(plural(n, 'event'));
    const r = routineDay(key);
    if (r.morningAll) parts.push('☀️ routine done');
    if (r.nightAll) parts.push('🌙 routine done');
    return parts.join(' · ');
  }

  function openJournal(key) {
    editingJournal = key;
    const e = journalEntry(key) || {};
    const rel = relDay(key);
    const long = fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#journal-title').textContent = ['Today', 'Yesterday'].includes(rel) ? `${rel} · ${long}` : long;
    $('#journal-context').textContent = entryContext(key);
    $$('input[name="jmood"]').forEach((r) => { r.checked = Number(r.value) === Number(e.mood); });
    $$('input[name="jenergy"]').forEach((r) => { r.checked = Number(r.value) === Number(e.energy); });
    $('#journal-text').value = e.text || '';
    $('#journal-good').value = e.good || '';
    $('#journal-delete').hidden = !journalEntry(key);
    journalSheet.showModal();
  }

  $('#journal-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!editingJournal) return;
    const mood = Number(($('input[name="jmood"]:checked') || {}).value) || 0;
    const energy = Number(($('input[name="jenergy"]:checked') || {}).value) || 0;
    const text = $('#journal-text').value.trim().slice(0, 5000);
    const good = $('#journal-good').value.trim();
    if (mood || energy || text || good) {
      state.journal[editingJournal] = { mood, energy, text, good, updated: Date.now() };
    } else {
      delete state.journal[editingJournal];
    }
    save();
    journalSheet.close();
    render();
    showToast('Saved to your journal 📓');
  });
  $('#journal-cancel').addEventListener('click', () => journalSheet.close());
  $('#journal-delete').addEventListener('click', () => {
    if (!editingJournal || !confirm('Delete this journal entry?')) return;
    delete state.journal[editingJournal];
    save();
    journalSheet.close();
    render();
    showToast('Entry deleted');
  });
  journalSheet.addEventListener('click', (e) => { if (e.target === journalSheet) journalSheet.close(); });
  journalSheet.addEventListener('close', () => { editingJournal = null; });
  $('#journal-search').addEventListener('input', () => renderJournalList());

  function entryItemHTML(key, label) {
    const e = journalEntry(key);
    const m = moodOf(e);
    const ph = cycleModel(key).phaseFor(key);
    const meta = [fmtDate(key, { weekday: 'short', day: 'numeric', month: 'short' })];
    if (ph) meta.push(`${PHASES[ph.phase].emoji} ${PHASES[ph.phase].name}`);
    if (e.energy && ENERGY[e.energy]) meta.push(ENERGY[e.energy]);
    const text = e.text || (e.good ? `🌟 ${e.good}` : '');
    return `<li class="item"><button class="item-main" type="button" data-jday="${key}">
      ${label ? `<span class="lookback-label">${esc(label)}</span>` : ''}
      <span class="item-title">${m ? `${MOODS[m][0]} ${MOODS[m][1]}` : '📝 Entry'}</span>
      <span class="item-meta">${esc(meta.join(' · '))}</span>
      ${text ? `<span class="excerpt">${esc(text)}</span>` : ''}
    </button></li>`;
  }

  function renderJournalList() {
    const q = $('#journal-search').value.trim().toLowerCase();
    const keys = Object.keys(state.journal).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && journalEntry(k)).sort().reverse();
    const shown = q
      ? keys.filter((k) => { const e = journalEntry(k); return `${e.text || ''} ${e.good || ''}`.toLowerCase().includes(q); })
      : keys;
    $('#journal-list').innerHTML = shown.length
      ? shown.slice(0, 200).map((k) => entryItemHTML(k)).join('')
      : emptyHTML(q ? 'Nothing found for that search' : 'Your entries will appear here 🌸');
  }

  function hbarHTML(label, avg, n, cls = '') {
    if (!n) return `<div class="hbar"><span class="hbar-label">${esc(label)}</span><span class="hbar-track"></span><span class="hbar-value none">–</span></div>`;
    return `<div class="hbar" role="img" aria-label="${esc(label)}: average mood ${avg.toFixed(1)} out of 5 from ${plural(n, 'entry')}">
      <span class="hbar-label">${esc(label)}</span>
      <span class="hbar-track"><span class="hbar-fill ${cls}" style="display:block;width:${(avg / 5) * 100}%"></span></span>
      <span class="hbar-value">${moodEmoji(avg)} ${avg.toFixed(1)}</span></div>`;
  }

  function renderJournal() {
    const tk = todayKey();
    const today = journalEntry(tk);

    // Today's card
    const m = moodOf(today);
    $('#journal-today').innerHTML = today
      ? `<div class="journal-card"><h2>${m ? `<span class="journal-mood-big">${MOODS[m][0]}</span>` : ''}Today: ${m ? MOODS[m][1] : 'written'}</h2>
          <p>${esc(today.text ? today.text.slice(0, 140) + (today.text.length > 140 ? '…' : '') : today.good ? `🌟 ${today.good}` : 'Add a few words about your day.')}</p>
          <button class="btn ghost" type="button" data-jday="${tk}">✏️ Edit today's entry</button></div>`
      : `<div class="journal-card"><h2>📓 How did today go?</h2><p>A minute is enough: pick a mood and write a line or two.</p>
          <button class="btn primary" type="button" data-jday="${tk}">✍️ Write today's entry</button></div>`;

    // Gentle backup reminder once there's something worth protecting
    const entries = Object.keys(state.journal).length;
    if (entries >= 3 && Date.now() - state.backup.last > 14 * 86400000) {
      $('#journal-today').insertAdjacentHTML('beforeend',
        '<button class="btn ghost wide backup-nudge" type="button" id="backup-nudge">💾 Time to back up your journal</button>');
    }

    // Look back
    const looks = [];
    const weekAgo = dateKey(addDays(new Date(), -7));
    if (journalEntry(weekAgo)) looks.push(entryItemHTML(weekAgo, 'A week ago'));
    const st = cycleStats();
    if (st.periods.length >= 2) {
      const day = diffDays(st.last.start, tk);
      const sameKey = dateKey(addDays(parseKey(st.periods[st.periods.length - 2].start), day));
      if (sameKey < st.last.start && journalEntry(sameKey)) looks.push(entryItemHTML(sameKey, 'Same point last cycle'));
    }
    const monthAgo = dateKey(addDays(new Date(), -30));
    if (journalEntry(monthAgo)) looks.push(entryItemHTML(monthAgo, 'A month ago'));
    $('#journal-lookback').innerHTML = looks.length
      ? `<div class="section-head"><h2>🕰️ Look back</h2></div><ul class="list lookback">${looks.join('')}</ul>`
      : '';

    // Mood chart, last 30 days
    const model = cycleModel(tk);
    let html = '';
    let withPhase = false;
    let logged = 0;
    for (let i = 29; i >= 0; i--) {
      const key = dateKey(addDays(new Date(), -i));
      const e = journalEntry(key);
      const mood = moodOf(e);
      if (mood) logged++;
      const ph = model.phaseFor(key);
      if (ph) withPhase = true;
      const label = `${fmtDate(key, { weekday: 'short', day: 'numeric', month: 'short' })}: ${mood ? `${MOODS[mood][1]} mood` : 'no entry'}${ph ? `, ${PHASES[ph.phase].name} phase` : ''}`;
      html += `<button class="mood-col${key === tk ? ' is-today' : ''}" type="button" data-jday="${key}" title="${esc(label)}" aria-label="${esc(label)}">
        ${mood ? `<span class="bar" style="height:${mood * 18}px"></span>` : '<span class="nodata"></span>'}
        <span class="ph${ph ? ` ph-${ph.phase}` : ''}"></span></button>`;
    }
    $('#mood-chart').innerHTML = html;
    $('#mood-chart').setAttribute('aria-label', `Mood for the last 30 days, ${plural(logged, 'day')} logged`);
    const a = addDays(new Date(), -29);
    const b = addDays(new Date(), -15);
    $('#mood-axis').innerHTML = [a, b].map((d) => `<span>${esc(d.toLocaleDateString([], { day: 'numeric', month: 'short' }))}</span>`).join('') + '<span>Today</span>';
    $('#mood-legend').hidden = !withPhase;

    // Patterns
    const keys = Object.keys(state.journal).filter((k) => moodOf(journalEntry(k)));
    const need = 5;
    if (keys.length < need) {
      $('#journal-patterns').innerHTML = `<div class="pattern-card"><h3>Patterns appear after ${need} entries</h3>
        <p class="insight">You've rated your mood on ${plural(keys.length, 'day')} so far. Keep going 🌱 Then you'll see your best days of the week, how your mood moves with your cycle, and whether your routines help.</p></div>`;
    } else {
      let out = '';
      // By weekday (Mon..Sun)
      const days = [[], [], [], [], [], [], []];
      keys.forEach((k) => days[(parseKey(k).getDay() + 6) % 7].push(moodOf(journalEntry(k))));
      const names = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(startOfWeek(new Date()), i).toLocaleDateString([], { weekday: 'short' }));
      const longNames = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(startOfWeek(new Date()), i).toLocaleDateString([], { weekday: 'long' }));
      const scored = days.map((d, i) => ({ i, n: d.length, avg: d.length ? avgOf(d) : 0 })).filter((x) => x.n);
      const best = scored.reduce((p, c) => (c.avg > p.avg ? c : p), scored[0]);
      const worst = scored.reduce((p, c) => (c.avg < p.avg ? c : p), scored[0]);
      out += `<div class="pattern-card"><h3>🗓️ Mood by day of the week</h3>
        <p class="insight">${best.i !== worst.i ? `Your best days are usually <b>${esc(longNames[best.i])}s</b>, and the hardest are <b>${esc(longNames[worst.i])}s</b>.` : 'Not enough variety yet. Keep writing!'}</p>
        ${days.map((d, i) => hbarHTML(names[i], d.length ? avgOf(d) : 0, d.length)).join('')}</div>`;

      // By cycle phase
      const byPhase = { menstrual: [], follicular: [], ovulation: [], luteal: [] };
      keys.forEach((k) => { const ph = cycleModel(k).phaseFor(k); if (ph) byPhase[ph.phase].push(moodOf(journalEntry(k))); });
      const phScored = PHASE_ORDER.filter((p) => byPhase[p].length).map((p) => ({ p, avg: avgOf(byPhase[p]) }));
      if (phScored.length >= 2) {
        const pb = phScored.reduce((x, y) => (y.avg > x.avg ? y : x));
        const pw = phScored.reduce((x, y) => (y.avg < x.avg ? y : x));
        out += `<div class="pattern-card wide"><h3>🌙 Mood through your cycle</h3>
          <p class="insight">You tend to feel best in your <b>${esc(PHASES[pb.p].name.toLowerCase())}</b> phase and lowest in your <b>${esc(PHASES[pw.p].name.toLowerCase())}</b> phase. Good to know for planning big days!</p>
          ${PHASE_ORDER.map((p) => hbarHTML(`${PHASES[p].emoji} ${PHASES[p].name}`, byPhase[p].length ? avgOf(byPhase[p]) : 0, byPhase[p].length, `ph-${p}`)).join('')}</div>`;
      }

      // Routines vs mood
      const cmp = (slot) => {
        const yes = []; const no = [];
        keys.forEach((k) => (routineDay(k)[`${slot}All`] ? yes : no).push(moodOf(journalEntry(k))));
        return yes.length >= 2 && no.length >= 2 ? { yes: avgOf(yes), no: avgOf(no) } : null;
      };
      [['morning', '☀️ Morning routine'], ['night', '🌙 Night routine']].forEach(([slot, label]) => {
        const c = cmp(slot);
        if (!c) return;
        const diff = c.yes - c.no;
        const msg = diff > 0.2 ? 'Your mood is better on days you finish it. It\'s working! 💪'
          : diff < -0.2 ? 'Interesting: no mood boost showing yet. Maybe tweak the steps?'
            : 'About the same either way so far.';
        out += `<div class="pattern-card"><h3>${label} & mood</h3><p class="insight">${msg}</p>
          <div class="compare-row"><div><b>${moodEmoji(c.yes)} ${c.yes.toFixed(1)}</b><span>Routine done</span></div>
          <div><b>${moodEmoji(c.no)} ${c.no.toFixed(1)}</b><span>Not done</span></div></div></div>`;
      });

      // Energy
      const en = keys.map((k) => journalEntry(k)).filter((e) => e.energy);
      if (en.length >= need) {
        const low = en.filter((e) => Number(e.energy) === 1).length;
        out += `<div class="pattern-card"><h3>⚡ Energy</h3><p class="insight">You've had low energy on ${plural(low, 'day')} out of ${en.length}.${low / en.length > 0.4 ? ' That\'s a lot. Worth looking at sleep and what\'s on those days 💗' : ''}</p></div>`;
      }
      $('#journal-patterns').innerHTML = out;
    }

    renderJournalList();
  }

  /* ================= Routine editor & printing ================= */
  const routineSheet = $('#routine-sheet');
  $('#routine-edit').addEventListener('click', () => {
    $('#routine-morning').value = state.routine.morning.map((s) => s.title).join('\n');
    $('#routine-night').value = state.routine.night.map((s) => s.title).join('\n');
    routineSheet.showModal();
  });
  $('#routine-cancel').addEventListener('click', () => routineSheet.close());
  routineSheet.addEventListener('click', (e) => { if (e.target === routineSheet) routineSheet.close(); });
  $('#routine-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const parse = (text, old) => text.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 12).map((title) => {
      const same = old.find((s) => s.title === title); // keep today's ticks on unchanged steps
      return { id: same ? same.id : uid(), title: title.slice(0, 80) };
    });
    state.routine.morning = parse($('#routine-morning').value, state.routine.morning);
    state.routine.night = parse($('#routine-night').value, state.routine.night);
    save();
    routineSheet.close();
    render();
    showToast('Routines saved 🌱');
  });

  $('#print-week').addEventListener('click', () => window.print());

  /* ================= PIN lock ================= */
  const te = new TextEncoder();
  const td = new TextDecoder();
  function toB64(bytes) {
    const a = new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(str) {
    const s = atob(str);
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  async function hashPin(pin, saltB64) {
    const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: 150000, hash: 'SHA-256' }, base, 256);
    return toB64(bits);
  }
  const validPin = (p) => /^\d{4}$/.test(p);
  let wrongTries = 0;
  let waitUntil = 0;

  $('#lock-pin').addEventListener('input', async (e) => {
    const pin = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = pin;
    if (pin.length < 4) return;
    if (Date.now() < waitUntil) {
      $('#lock-error').textContent = `Too many tries. Wait ${Math.ceil((waitUntil - Date.now()) / 1000)} seconds.`;
      $('#lock-error').hidden = false;
      e.target.value = '';
      return;
    }
    const ok = (await hashPin(pin, state.lock.salt)) === state.lock.hash;
    e.target.value = '';
    if (ok) {
      wrongTries = 0;
      unlocked = true;
      render();
    } else {
      wrongTries++;
      if (wrongTries >= 5) { waitUntil = Date.now() + 30000; wrongTries = 0; }
      $('#lock-error').textContent = 'That PIN isn\'t right. Try again.';
      $('#lock-error').hidden = false;
    }
  });
  $('#lock-form').addEventListener('submit', (e) => e.preventDefault());
  $('#lock-forgot').addEventListener('click', () => {
    if (!confirm('Forgot your PIN? To protect your privacy, the only way to reset it is to ERASE your journal and cycle data on this phone. (If you have a backup, you can restore it afterwards.)\n\nErase and remove the lock?')) return;
    if (!confirm('Are you sure? This can\'t be undone.')) return;
    state.journal = {};
    state.cycle = normCycle(null);
    state.lock = { on: false, hash: '', salt: '' };
    unlocked = false;
    save();
    render();
    showToast('Lock removed and private data erased');
  });

  function renderPrivacy() {
    $('#lock-status').textContent = state.lock.on
      ? '🔒 On. Journal and Cycle need your PIN, and lock again whenever you leave the app.'
      : 'Off. Turn it on to keep your Journal and Cycle private.';
    $('#lock-setup').hidden = state.lock.on;
    $('#lock-manage').hidden = !state.lock.on;
    ['#lock-new', '#lock-new2', '#lock-current'].forEach((s) => { $(s).value = ''; });
    const last = state.backup.last;
    $('#backup-status').textContent = last
      ? `Last backup: ${ago(last)}.`
      : 'No backup yet. Make one now and then every couple of weeks.';
    $('#backup-share').hidden = !pendingBackup;
    $('#backup-save').hidden = !!pendingBackup;
  }

  $('#lock-set').addEventListener('click', async () => {
    const a = $('#lock-new').value.trim();
    const b = $('#lock-new2').value.trim();
    if (!validPin(a)) { showToast('Your PIN needs to be 4 numbers'); return; }
    if (a !== b) { showToast("Those PINs don't match"); return; }
    const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
    state.lock = { on: true, salt, hash: await hashPin(a, salt) };
    unlocked = true; // you just set it, so stay unlocked until you leave the app
    save();
    renderPrivacy();
    render();
    showToast('Lock is on 🔒 Remember your PIN!');
  });
  $('#lock-off').addEventListener('click', async () => {
    const pin = $('#lock-current').value.trim();
    if (!validPin(pin) || (await hashPin(pin, state.lock.salt)) !== state.lock.hash) { showToast('That PIN isn\'t right'); return; }
    state.lock = { on: false, hash: '', salt: '' };
    save();
    renderPrivacy();
    render();
    showToast('Lock turned off');
  });

  /* ================= Backup & restore ================= */
  let pendingBackup = null;

  async function backupKey(pass, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptBackup(obj, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iter = 310000;
    const key = await backupKey(pass, salt, iter);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
    return JSON.stringify({ app: 'cute-planner-backup', v: 1, kdf: 'PBKDF2-SHA256', iter, salt: toB64(salt), iv: toB64(iv), data: toB64(data), created: new Date().toISOString() });
  }
  async function decryptBackup(text, pass) {
    const f = JSON.parse(text);
    if (!f || f.app !== 'cute-planner-backup') throw new Error('not a backup');
    const iter = Math.min(Math.max(Number(f.iter) || 310000, 100000), 2000000);
    const key = await backupKey(pass, fromB64(f.salt), iter);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(f.iv) }, key, fromB64(f.data));
    return JSON.parse(td.decode(plain));
  }

  async function deliverFile(name, text) {
    const file = new File([text], name, { type: 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Planner backup' }); return true; } catch (e) {
        if (e && e.name === 'AbortError') return false;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  }

  $('#backup-save').addEventListener('click', async () => {
    if (isLocked()) { showToast('Unlock your Journal first (open it and enter your PIN)'); return; }
    const pass = $('#backup-pass').value;
    if (pass.length < 6) { showToast('Choose a password with at least 6 characters'); $('#backup-pass').focus(); return; }
    $('#backup-save').disabled = true;
    try {
      pendingBackup = { name: `planner-backup-${todayKey()}.planner`, text: await encryptBackup(state, pass) };
      renderPrivacy();
      showToast('Backup ready. Tap "Save the backup file" 📤');
    } catch (e) {
      showToast('Something went wrong making the backup');
    } finally {
      $('#backup-save').disabled = false;
    }
  });
  $('#backup-share').addEventListener('click', async () => {
    if (!pendingBackup) return;
    const ok = await deliverFile(pendingBackup.name, pendingBackup.text);
    if (ok) {
      state.backup.last = Date.now();
      pendingBackup = null;
      save();
      showToast('Backup saved 💾');
    }
    renderPrivacy();
  });

  $('#backup-restore').addEventListener('click', () => {
    if (!$('#backup-pass').value) { showToast("First type the backup's password above"); $('#backup-pass').focus(); return; }
    $('#backup-file').click();
  });
  $('#backup-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
      data = await decryptBackup(await file.text(), $('#backup-pass').value);
    } catch (err) {
      showToast("Couldn't open it: wrong password, or not a planner backup");
      return;
    }
    if (!confirm('Restore this backup? It will REPLACE everything in the planner on this phone.')) return;
    const keepGoogle = state.google; // keep this phone's Google connection
    state = normState(data);
    if (keepGoogle.connected) state.google = keepGoogle;
    unlocked = false;
    pendingBackup = null;
    save();
    renderPrivacy();
    render();
    showToast('Backup restored 🌸');
  });

  /* ================= Google Calendar ================= */
  const G_TOKEN_KEY = 'cute-planner-gtoken';
  const G_NONCE_KEY = 'cute-planner-gnonce';
  const G_API = 'https://www.googleapis.com/calendar/v3';
  const T_API = 'https://tasks.googleapis.com/tasks/v1';
  const G_SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/tasks',
  ];
  const settingsSheet = $('#settings-sheet');
  const fetchedWeeks = new Set();
  let syncing = false;

  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

  function getToken() {
    try {
      const t = JSON.parse(lsGet(G_TOKEN_KEY) || 'null');
      if (t && t.token && t.exp > Date.now() + 60 * 1000) return t.token;
    } catch (e) { /* ignore */ }
    return null;
  }

  function ago(ts) {
    if (!ts) return 'never';
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
    return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  // Send you to Google's sign-in page; Google sends you back here with a short-lived key
  function startGoogleAuth(silent) {
    if (!state.google.clientId) { openSettings(); return; }
    if (location.protocol === 'file:') { showToast('Open the planner from its website link to connect Google'); return; }
    const nonce = uid() + uid();
    lsSet(G_NONCE_KEY, nonce);
    const params = new URLSearchParams({
      client_id: state.google.clientId,
      redirect_uri: redirectUri(),
      response_type: 'token',
      scope: G_SCOPES.join(' '),
      include_granted_scopes: 'true',
      state: nonce,
    });
    if (silent) params.set('prompt', 'none');
    location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  function handleGoogleRedirect() {
    if (!location.hash || location.hash.length < 2) return false;
    const p = new URLSearchParams(location.hash.slice(1));
    if (!p.has('access_token') && !p.has('error')) return false;
    const expected = lsGet(G_NONCE_KEY);
    lsDel(G_NONCE_KEY);
    history.replaceState(null, '', location.pathname + location.search);
    if (!expected || p.get('state') !== expected) {
      showToast("Google sign-in didn't match. Please try again.");
      return true;
    }
    const err = p.get('error');
    if (err) {
      if (['interaction_required', 'login_required', 'consent_required', 'account_selection_required'].includes(err)) {
        startGoogleAuth(false); // quick sign-in wasn't possible, so ask properly
      } else {
        showToast(err === 'access_denied' ? 'Google access was not allowed' : `Google sign-in failed (${err})`);
      }
      return true;
    }
    const granted = p.get('scope') || '';
    lsSet(G_TOKEN_KEY, JSON.stringify({
      token: p.get('access_token'),
      exp: Date.now() + (Number(p.get('expires_in')) || 3600) * 1000,
    }));
    state.google.connected = true;
    state.google.needsReauth = false;
    save();
    if (!G_SCOPES.every((s) => granted.includes(s))) {
      showToast('Tip: tick all the boxes on Google\'s screen so everything works');
    }
    googleSync();
    return true;
  }

  async function gApi(path, { method = 'GET', body } = {}) {
    const token = getToken();
    if (!token) throw Object.assign(new Error('Please sign in to Google again'), { auth: true });
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(path.startsWith('https://') ? path : G_API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401) {
      lsDel(G_TOKEN_KEY);
      throw Object.assign(new Error('Please sign in to Google again'), { auth: true });
    }
    if (!res.ok) {
      let msg = `error ${res.status}`;
      try { const j = await res.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) { /* ignore */ }
      throw Object.assign(new Error(msg), { status: res.status });
    }
    return res.status === 204 ? null : res.json();
  }

  function mapGEvent(ev, cal) {
    if (!ev || ev.status === 'cancelled' || !ev.start) return null;
    const base = {
      id: `${cal.id}|${ev.id}`,
      gid: ev.id,
      primary: !!cal.primary,
      calName: cal.primary ? 'Google Calendar' : (cal.summaryOverride || cal.summary || 'Google'),
      color: safeHex(cal.backgroundColor),
      title: ev.summary || '(No title)',
      link: typeof ev.htmlLink === 'string' && ev.htmlLink.startsWith('https://') ? ev.htmlLink : '',
    };
    if (ev.start.date) {
      const end = ev.end && ev.end.date ? ev.end.date : dateKey(addDays(parseKey(ev.start.date), 1));
      return { ...base, allDay: true, start: ev.start.date, end, time: '' };
    }
    const s = new Date(ev.start.dateTime);
    if (isNaN(s)) return null;
    return { ...base, allDay: false, start: dateKey(s), end: dateKey(s), time: `${pad(s.getHours())}:${pad(s.getMinutes())}` };
  }

  async function fetchGoogleRange(from, to) {
    const list = await gApi('/users/me/calendarList?minAccessRole=reader&maxResults=250');
    const cals = (list.items || []).filter((c) => c.selected || c.primary);
    const out = [];
    for (const cal of cals) {
      let pageToken = '';
      do {
        const q = new URLSearchParams({
          timeMin: from.toISOString(), timeMax: to.toISOString(),
          singleEvents: 'true', orderBy: 'startTime', maxResults: '2500',
        });
        if (pageToken) q.set('pageToken', pageToken);
        const r = await gApi(`/calendars/${encodeURIComponent(cal.id)}/events?${q}`);
        (r.items || []).forEach((ev) => { const m = mapGEvent(ev, cal); if (m) out.push(m); });
        pageToken = r.nextPageToken || '';
      } while (pageToken);
    }
    return out;
  }

  function gBody(ev) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!ev.time) {
      return { summary: ev.title, start: { date: ev.date }, end: { date: dateKey(addDays(parseKey(ev.date), 1)) } };
    }
    const [h, m] = ev.time.split(':').map(Number);
    const end = parseKey(ev.date);
    end.setHours(h + 1, m);
    return {
      summary: ev.title,
      start: { dateTime: `${ev.date}T${ev.time}:00`, timeZone },
      end: { dateTime: `${dateKey(end)}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`, timeZone },
    };
  }

  const waitingCount = () =>
    state.events.filter((e) => e.gSync && (e.gDirty || !e.gId)).length +
    state.google.pendingDeletes.length +
    state.google.tasks.filter((t) => t.dirty).length;

  const isScopeError = (e) => e && e.status === 403 && /scope|insufficient|permission/i.test(e.message);
  const isDisabledError = (e) => e && e.status === 403 && /disabled|has not been used|not enabled/i.test(e.message);

  /* ---- Google Tasks ---- */
  async function fetchGoogleTasks() {
    const lists = await gApi(`${T_API}/users/@me/lists?maxResults=100`);
    const cutoff = Date.now() - 14 * 86400000; // hide tasks finished more than 2 weeks ago
    const out = [];
    for (const l of lists.items || []) {
      let pageToken = '';
      do {
        const q = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100' });
        if (pageToken) q.set('pageToken', pageToken);
        const r = await gApi(`${T_API}/lists/${encodeURIComponent(l.id)}/tasks?${q}`);
        for (const t of r.items || []) {
          if (t.deleted) continue;
          const done = t.status === 'completed';
          const comp = t.completed ? new Date(t.completed) : null;
          if (done && comp && comp.getTime() < cutoff) continue;
          out.push({
            id: `${l.id}|${t.id}`,
            tid: t.id,
            list: l.id,
            listName: l.title || 'Tasks',
            title: t.title || '(No title)',
            due: typeof t.due === 'string' ? t.due.slice(0, 10) : '',
            done,
            doneOn: comp && !isNaN(comp) ? dateKey(comp) : '',
            link: typeof t.webViewLink === 'string' && t.webViewLink.startsWith('https://') ? t.webViewLink : '',
          });
        }
        pageToken = r.nextPageToken || '';
      } while (pageToken);
    }
    return out;
  }

  function tasksError(e) {
    if (isDisabledError(e)) {
      state.google.tasksOff = true;
      showToast('To see Google Tasks, turn on the Tasks API in Google Cloud');
    } else if (isScopeError(e)) {
      state.google.needsReauth = true;
      showToast('Tap the 🗓️ bar to let the planner see your Google Tasks');
    } else {
      showToast(`Google Tasks: ${e.message}`);
    }
  }

  function toggleGTask(id) {
    const t = state.google.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneOn = t.done ? todayKey() : '';
    t.dirty = true;
    save();
    render();
    if (t.done) showToast('Nice one! 🎉');
    googlePush(true);
  }

  function openGTask(id) {
    const t = state.google.tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.link) window.open(t.link, '_blank', 'noopener');
    else showToast('You can edit this task in the Google Tasks app');
  }

  // Send planner changes (new, edited, deleted events) to Google
  async function pushPending() {
    for (const gid of state.google.pendingDeletes.slice()) {
      try {
        await gApi(`/calendars/primary/events/${encodeURIComponent(gid)}`, { method: 'DELETE' });
      } catch (e) {
        if (e.status !== 404 && e.status !== 410) throw e; // already gone is fine
      }
      state.google.pendingDeletes = state.google.pendingDeletes.filter((x) => x !== gid);
      save();
    }
    for (const t of state.google.tasks) {
      if (!t.dirty) continue;
      try {
        await gApi(`${T_API}/lists/${encodeURIComponent(t.list)}/tasks/${encodeURIComponent(t.tid)}`, {
          method: 'PATCH',
          body: t.done ? { status: 'completed' } : { status: 'needsAction', completed: null },
        });
        t.dirty = false;
      } catch (e) {
        if (e.auth) throw e;
        if (e.status === 404 || e.status === 410) t.dirty = false;
        else if (isScopeError(e) || isDisabledError(e)) { tasksError(e); break; }
        else throw e;
      }
      save();
    }
    for (const ev of state.events) {
      if (!ev.gSync || (!ev.gDirty && ev.gId)) continue;
      if (ev.gId) {
        try {
          await gApi(`/calendars/primary/events/${encodeURIComponent(ev.gId)}`, { method: 'PATCH', body: gBody(ev) });
        } catch (e) {
          if (e.status !== 404 && e.status !== 410) throw e;
          ev.gId = null; // it was deleted in Google, so make a new one
        }
      }
      if (!ev.gId) {
        const r = await gApi('/calendars/primary/events', { method: 'POST', body: gBody(ev) });
        ev.gId = r.id;
      }
      ev.gDirty = false;
      save();
    }
  }

  function googleError(e) {
    if (e && e.auth) showToast('Google needs you to sign in again. Tap the 🗓️ button.');
    else showToast(`Google: ${e && e.message ? e.message : 'something went wrong'}`);
  }

  async function googlePush(quiet) {
    if (!state.google.connected) return;
    if (!getToken()) { renderGBar(); return; }
    try {
      const n = waitingCount();
      await pushPending();
      if (n && !quiet) showToast('Sent to Google Calendar 🗓️');
    } catch (e) { googleError(e); }
    render();
  }

  async function googleSync() {
    if (syncing || !state.google.connected) return;
    if (!getToken()) { renderGBar(); return; }
    syncing = true;
    renderGBar();
    try {
      await pushPending();
      const from = addDays(startOfWeek(new Date()), -28);
      const to = addDays(from, 7 * 22);
      state.google.events = await fetchGoogleRange(from, to);
      state.google.range = { from: dateKey(from), to: dateKey(to) };
      state.google.lastSync = Date.now();
      fetchedWeeks.clear();
      try {
        const fresh = await fetchGoogleTasks();
        const waiting = new Map(state.google.tasks.filter((t) => t.dirty).map((t) => [t.id, t]));
        state.google.tasks = fresh.map((t) => waiting.get(t.id) || t);
        state.google.needsReauth = false;
        state.google.tasksOff = false;
      } catch (e) {
        if (e.auth) throw e;
        tasksError(e);
      }
      save();
    } catch (e) {
      googleError(e);
    } finally {
      syncing = false;
      render();
      if (settingsSheet.open) renderSettings();
    }
  }

  // Looking at a week outside what's been downloaded? Fetch just that week.
  function maybeFetchWeek() {
    const g = state.google;
    if (!g.connected || !g.range || syncing || !getToken()) return;
    const a = dateKey(weekStart);
    const b = dateKey(addDays(weekStart, 7));
    if ((a >= g.range.from && b <= g.range.to) || fetchedWeeks.has(a)) return;
    fetchedWeeks.add(a);
    const ws = new Date(weekStart);
    fetchGoogleRange(ws, addDays(ws, 7)).then((evs) => {
      const ids = new Set(evs.map((x) => x.id));
      state.google.events = state.google.events.filter((x) => !ids.has(x.id) && !(x.start >= a && x.start < b)).concat(evs);
      save();
      if (currentView === 'week') render();
    }).catch((e) => { fetchedWeeks.delete(a); if (!e.auth) googleError(e); });
  }

  function maybeAutoSync() {
    if (state.google.connected && getToken() && Date.now() - state.google.lastSync > 5 * 60 * 1000) googleSync();
  }

  function renderGBar() {
    const btn = $('#gsync');
    const g = state.google;
    const show = g.connected && (currentView === 'today' || currentView === 'week' || currentView === 'todos');
    btn.hidden = !show;
    if (!show) return;
    const waiting = waitingCount();
    let text;
    if (syncing) text = '🗓️ Syncing with Google…';
    else if (g.needsReauth) text = '🗓️ Tap to allow Google Tasks';
    else if (!getToken()) text = `🗓️ Tap to sync with Google${waiting ? ` · ${waiting} waiting to send` : ''}`;
    else text = `🗓️ Google synced ${ago(g.lastSync)}${waiting ? ` · ${waiting} waiting` : ''} · tap to refresh`;
    btn.textContent = text;
    btn.disabled = syncing;
  }

  function renderSettings() {
    const g = state.google;
    const live = !!getToken();
    let status;
    if (!g.clientId) status = "Not set up yet. Follow the setup steps, then paste your Client ID below.";
    else if (!g.connected) status = 'Ready to connect.';
    else if (live) status = `Connected ✅ · synced ${ago(g.lastSync)}`;
    else status = 'Connected ✅ · Google signs you out after about an hour, so tap Sync now to refresh.';
    if (g.connected && g.tasksOff) status += ' Google Tasks is off: turn on the Tasks API in Google Cloud.';
    if (g.connected && g.needsReauth) status += ' Tap Sync now to allow Google Tasks.';
    $('#g-status').textContent = status;
    $('#g-client-field').hidden = g.connected;
    $('#g-connect').hidden = g.connected;
    $('#g-sync').hidden = !g.connected;
    $('#g-disconnect').hidden = !g.connected;
    $('#g-autopush-row').hidden = !g.connected;
    $('#g-autopush').checked = g.autoPush;
  }

  function openSettings() {
    $('#g-client').value = state.google.clientId;
    renderSettings();
    renderPrivacy();
    settingsSheet.showModal();
  }

  $('#open-settings').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', () => settingsSheet.close());
  settingsSheet.addEventListener('click', (e) => { if (e.target === settingsSheet) settingsSheet.close(); });

  $('#g-connect').addEventListener('click', () => {
    const id = $('#g-client').value.trim();
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)) {
      showToast('That should end in .apps.googleusercontent.com');
      $('#g-client').focus();
      return;
    }
    state.google.clientId = id;
    save();
    startGoogleAuth(false);
  });
  $('#g-sync').addEventListener('click', () => {
    settingsSheet.close();
    if (state.google.needsReauth) startGoogleAuth(false);
    else if (getToken()) googleSync(); else startGoogleAuth(true);
  });
  $('#g-autopush').addEventListener('change', (e) => { state.google.autoPush = e.target.checked; save(); });
  $('#g-disconnect').addEventListener('click', () => {
    if (!confirm('Disconnect Google Calendar? Your Google events will disappear from the planner, but they stay safe in Google.')) return;
    const token = getToken();
    if (token) fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
    lsDel(G_TOKEN_KEY);
    state.google = normGoogle({ clientId: state.google.clientId, autoPush: state.google.autoPush });
    save();
    renderSettings();
    render();
    showToast('Google Calendar disconnected');
  });
  $('#gsync').addEventListener('click', () => {
    if (state.google.needsReauth) startGoogleAuth(false);
    else if (getToken()) googleSync(); else startGoogleAuth(true);
  });

  // Pick up changes made in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { state = load(); render(); }
  });

  switchView('today');
  if (!handleGoogleRedirect()) maybeAutoSync();
})();
