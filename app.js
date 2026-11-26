(() => {
  'use strict';

  /* ================= Storage ================= */
  const STORE_KEY = 'cute-planner-v1';
  const COLORS = ['pink', 'lavender', 'mint', 'peach', 'sky'];

  function normCycle(c) {
    const ok = c && typeof c === 'object';
    const days = ok && c.days && typeof c.days === 'object' && !Array.isArray(c.days) ? c.days : {};
    return { days, showOnToday: ok ? c.showOnToday !== false : true };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          events: Array.isArray(data.events) ? data.events : [],
          todos: Array.isArray(data.todos) ? data.todos : [],
          cycle: normCycle(data.cycle),
        };
      }
    } catch (err) {
      console.warn('Could not load saved data', err);
    }
    return { events: [], todos: [], cycle: normCycle(null) };
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

  const TITLES = { today: 'Today', week: 'This week', todos: 'To-dos & reminders', cycle: 'My cycle' };
  let monthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

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
    if (currentView === 'cycle') renderCycle();
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
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { openDaySheet(dayBtn.dataset.day); return; }
    if (e.target.closest('#today-cycle')) { switchView('cycle'); return; }
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
    if (sheet.open || daySheet.open) return;
    if (todayKey() !== lastDay) {
      lastDay = todayKey();
      weekStart = startOfWeek(new Date());
    }
    render();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfNeeded(); });
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

  // Pick up changes made in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { state = load(); render(); }
  });

  switchView('today');
})();
