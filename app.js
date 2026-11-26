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
    };
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
          google: normGoogle(data.google),
        };
      }
    } catch (err) {
      console.warn('Could not load saved data', err);
    }
    return { events: [], todos: [], cycle: normCycle(null), google: normGoogle(null) };
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
        <ul class="list">${evs.length ? evs.join('') : (tds.length ? '' : emptyHTML('Free day 🌸'))}</ul>
        ${tds.length ? `<ul class="list">${tds.map(todoHTML).join('')}</ul>` : ''}
      </section>`;
    }
    $('#week-days').innerHTML = html;
    maybeFetchWeek();
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
    if (sheet.open || daySheet.open || settingsSheet.open) return;
    if (todayKey() !== lastDay) {
      lastDay = todayKey();
      weekStart = startOfWeek(new Date());
    }
    render();
    maybeAutoSync();
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

  /* ================= Google Calendar ================= */
  const G_TOKEN_KEY = 'cute-planner-gtoken';
  const G_NONCE_KEY = 'cute-planner-gnonce';
  const G_API = 'https://www.googleapis.com/calendar/v3';
  const G_SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
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
    save();
    if (!G_SCOPES.every((s) => granted.includes(s))) {
      showToast('Tip: tick both calendar boxes on Google\'s screen so everything works');
    }
    googleSync();
    return true;
  }

  async function gApi(path, { method = 'GET', body } = {}) {
    const token = getToken();
    if (!token) throw Object.assign(new Error('Please sign in to Google again'), { auth: true });
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(G_API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
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
    state.events.filter((e) => e.gSync && (e.gDirty || !e.gId)).length + state.google.pendingDeletes.length;

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
    const show = g.connected && (currentView === 'today' || currentView === 'week');
    btn.hidden = !show;
    if (!show) return;
    const waiting = waitingCount();
    let text;
    if (syncing) text = '🗓️ Syncing with Google…';
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
    if (getToken()) googleSync(); else startGoogleAuth(true);
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
    if (getToken()) googleSync(); else startGoogleAuth(true);
  });

  // Pick up changes made in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { state = load(); render(); }
  });

  switchView('today');
  if (!handleGoogleRedirect()) maybeAutoSync();
})();
