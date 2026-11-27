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
      anchorM: ok && typeof r.anchorM === 'string' ? r.anchorM : 'After I turn off my alarm',
      anchorN: ok && typeof r.anchorN === 'string' ? r.anchorN : 'When my wind-down reminder goes off',
      bed: ok && typeof r.bed === 'string' && /^\d\d:\d\d$/.test(r.bed) ? r.bed : '22:30',
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
      // never overwrite data we couldn't read: keep a rescue copy first
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) localStorage.setItem(`${STORE_KEY}-rescue-${Date.now()}`, raw);
      } catch (e) { /* ignore */ }
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
      look: ['cherry', 'soft', 'clean', 'matcha', 'y2k', 'midnight'].includes(d.look) ? d.look : 'cherry',
      reading: {
        size: d.reading && ['m', 'l', 'xl'].includes(d.reading.size) ? d.reading.size : 'm',
        font: d.reading && ['nunito', 'verdana', 'atkinson'].includes(d.reading.font) ? d.reading.font : 'nunito',
        spacing: !!(d.reading && d.reading.spacing),
      },
      profile: {
        name: d.profile && typeof d.profile.name === 'string' ? d.profile.name.slice(0, 30) : '',
        toured: !!(d.profile && d.profile.toured),
      },
      goals: Array.isArray(d.goals)
        ? d.goals.filter((g) => g && typeof g.title === 'string' && g.id)
          .map((g) => ({ ...g, steps: Array.isArray(g.steps) ? g.steps.filter((s) => s && typeof s.title === 'string' && s.id) : [] }))
        : [],
      weekly: d.weekly && typeof d.weekly === 'object' && !Array.isArray(d.weekly) ? d.weekly : {},
      plants: Array.isArray(d.plants) ? d.plants.filter((p) => p && p.id && typeof p.name === 'string') : [],
      habits: Array.isArray(d.habits) ? d.habits.filter((h) => h && h.id && typeof h.title === 'string') : [],
      habitLog: d.habitLog && typeof d.habitLog === 'object' && !Array.isArray(d.habitLog) ? d.habitLog : {},
      meals: d.meals && typeof d.meals === 'object' && !Array.isArray(d.meals) ? d.meals : {},
      mealFavs: Array.isArray(d.mealFavs) ? d.mealFavs.filter((x) => typeof x === 'string') : [],
      mealShow: d.mealShow === 'all' ? 'all' : 'dinner',
      mealLib: Array.isArray(d.mealLib) ? d.mealLib.filter((m) => m && m.id && typeof m.name === 'string') : [],
      mealLibInit: !!d.mealLibInit,
      shopping: Array.isArray(d.shopping) ? d.shopping.filter((x) => x && x.id && typeof x.title === 'string') : [],
      plant: {
        name: d.plant && typeof d.plant.name === 'string' && d.plant.name ? d.plant.name : 'Pip',
        xp: d.plant && Number.isFinite(d.plant.xp) ? d.plant.xp : 0,
        last: d.plant && typeof d.plant.last === 'string' ? d.plant.last : '',
      },
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      showToast(err && err.name === 'QuotaExceededError'
        ? "Storage is full. Try removing a few plant photos."
        : "Couldn't save. Is private browsing on?");
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
    if (pred.fertile.has(tk)) sub += '\nIn your fertile window (estimate)';
    if (!st.cycles.length) sub += '. Based on a typical 28-day cycle until you log another period.';
    return { num: day, label: 'Cycle day', p, short: `Cycle day ${day}\n${status}`, status, sub };
  }

  /* ================= Item templates ================= */
  function eventHTML(ev) {
    return `<li class="item event c-${safeColor(ev.color)}" data-kind="event" data-id="${esc(ev.id)}">
      <button class="item-main" type="button" data-action="edit" aria-label="Edit event ${esc(ev.title)}">
        <span class="time-pill">${ev.time ? esc(fmtTime(ev.time)) : 'All day'}</span>
        <span class="item-title">${esc(ev.title)}</span>
        ${ev.repeat && REPEATS[ev.repeat] ? `<span class="repeat-badge" title="${REPEATS[ev.repeat]}" aria-label="Repeats: ${REPEATS[ev.repeat]}">🔁</span>` : ''}
        ${ev.gSync && state.google.connected ? '<span class="g-badge" title="Also in Google Calendar">🗓️</span>' : ''}
      </button>
    </li>`;
  }

  // Repeating events: '' (once), 'daily', 'weekdays' or 'weekly'
  const REPEATS = { daily: 'Every day', weekdays: 'Weekdays', weekly: 'Every week', monthly: 'Every month' };
  function occursOn(ev, key) {
    if (!ev.repeat || !REPEATS[ev.repeat]) return ev.date === key;
    if (key < ev.date) return false;
    if (ev.repeat === 'daily') return true;
    const dow = parseKey(key).getDay();
    if (ev.repeat === 'weekdays') return dow >= 1 && dow <= 5;
    if (ev.repeat === 'monthly') return parseKey(key).getDate() === parseKey(ev.date).getDate();
    return dow === parseKey(ev.date).getDay();
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
    const mine = new Set(state.events.map((e) => e.gId).concat(state.todos.map((t) => t.gEvId)).concat(state.plants.map((p) => p.gEvId)).filter(Boolean));
    return state.google.events.filter((g) => {
      if (g.primary && (mine.has(g.gid) || (g.series && mine.has(g.series)))) return false;
      return g.allDay ? g.start <= key && key < g.end : g.start === key;
    });
  }

  // Planner + Google events for a day, sorted by time
  function hm(t) { const [a, b] = String(t).split(':').map(Number); return a * 60 + b; }
  function dayEventItems(key) {
    const len = (g) => { if (!g.endTime || !g.time) return 60; const d = hm(g.endTime) - hm(g.time); return d > 0 ? d : 60; };
    const mine = state.events.filter((e) => occursOn(e, key)).map((e) => ({ time: e.time || '', title: e.title, dur: 60, html: eventHTML(e) }));
    const theirs = gEventsOn(key).map((g) => ({ time: g.allDay ? '' : g.time, title: g.title, dur: len(g), html: gEventHTML(g) }));
    return mine.concat(theirs).sort(byTime);
  }
  function dayEvents(key) { return dayEventItems(key).map((x) => x.html); }

  // Today's events as a timeline: free gaps, a "now" line and lights-out
  function timelineHTML(key) {
    const items = dayEventItems(key);
    const timed = items.filter((x) => x.time);
    if (!timed.length) return items.map((x) => x.html).join('');
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
    const nowRow = () => `<li class="tl-now"><span>Now: ${esc(fmtTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`))}</span></li>`;
    const gap = (m) => `<li class="tl-gap">☁️ ${dur(m)} free</li>`;
    const out = items.filter((x) => !x.time).map((x) => x.html);
    let prevEnd = null;
    let nowDone = false;
    timed.forEach((x) => {
      const s = hm(x.time);
      if (prevEnd !== null && s - prevEnd >= 30) out.push(gap(s - prevEnd));
      if (!nowDone && s > nowMin) { out.push(nowRow()); nowDone = true; }
      out.push(s + x.dur <= nowMin ? x.html.replace('class="item event', 'class="item event past') : x.html);
      prevEnd = Math.max(prevEnd === null ? 0 : prevEnd, s + x.dur);
    });
    const bed = state.routine.bed ? hm(state.routine.bed) : null;
    if (bed !== null && bed > prevEnd) {
      if (bed - prevEnd >= 30) out.push(gap(bed - prevEnd));
      if (!nowDone && nowMin < bed) { out.push(nowRow()); nowDone = true; }
      out.push(`<li class="tl-bed">🛏️ Lights out at ${esc(fmtTime(state.routine.bed))}</li>`);
    }
    if (!nowDone) out.push(nowRow());
    return out.join('');
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
    const where = `Google Tasks${t.listName && t.listName !== 'My Tasks' ? `: ${t.listName}` : ''}`;
    const meta = (t.due ? `📅 ${relDay(t.due)}${overdue ? ' (overdue)' : ''}\n` : '') + where;
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
      meta = (t.time ? (t.remind !== undefined && t.remind !== '' ? '🔔 ' : '⏰ ') : '📅 ') + relDay(t.due) + (t.time ? ', ' + fmtTime(t.time) : '') + (overdue ? '\nOverdue' : '');
    }
    if (t.repeat && REPEATS[t.repeat] && !t.done) meta = (meta ? `${meta}\n` : '') + `🔁 ${REPEATS[t.repeat]}`;
    if (Array.isArray(t.steps) && t.steps.length) {
      meta = (meta ? `${meta}\n` : '') + `👣 ${t.steps.filter((s) => s.done).length}/${t.steps.length} steps`;
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

  // Forgiving streak: research shows one missed day doesn't undo a habit,
  // so a single gap is allowed. Two missed days in a row ends the streak ("never miss twice").
  function routineStreak(slot) {
    let n = 0;
    let misses = 0;
    let d = new Date();
    if (!routineDay(todayKey())[`${slot}All`]) d = addDays(d, -1); // today still in progress
    for (let i = 0; i < 400; i++) {
      if (routineDay(dateKey(d))[`${slot}All`]) { n++; misses = 0; } else if (++misses >= 2) break;
      d = addDays(d, -1);
    }
    return n;
  }

  // Habits take ~66 days on average to feel automatic (Lally et al., 2010)
  const habitDays = (slot) => Object.keys(state.routine.done).filter((k) => routineDay(k)[`${slot}All`]).length;

  function untilBed() {
    const now = new Date();
    const [h, m] = state.routine.bed.split(':').map(Number);
    let diff = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
    if (diff < -12 * 60) diff += 24 * 60; // lights-out after midnight
    return diff;
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
      (streak ? `\n🔥 ${streak}-day streak` : '');
    const meta = [];
    const anchor = slot === 'morning' ? state.routine.anchorM : state.routine.anchorN;
    if (anchor) meta.push(`🔗 ${anchor}`);
    if (slot === 'night' && state.routine.bed) {
      const diff = untilBed();
      const at = fmtTime(state.routine.bed);
      if (diff > 0 && diff <= 6 * 60) meta.push(`🛏️ Lights out in ${diff >= 60 ? `${Math.floor(diff / 60)} h${diff % 60 ? ` ${diff % 60} min` : ''}` : `${diff} min`} (${at})`);
      else if (diff <= 0 && diff > -3 * 60) meta.push(`🛏️ It's past lights-out (${at}). Time for bed 😴`);
    }
    const days = habitDays(slot);
    if (days) meta.push(days >= 66 ? `🌳 ${days} days: this routine is a real habit now!` : `🌱 Habit-building: day ${days} of ~66`);
    $('#routine-meta').innerHTML = meta.map((x) => `<span>${esc(x)}</span>`).join('');
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
    const cutoff = dateKey(addDays(new Date(), -400));
    Object.keys(state.routine.done).forEach((k) => { if (k < cutoff) delete state.routine.done[k]; });
    save();
    render();
    if (day[`${slot}All`] && !wasAll) {
      showToast(slot === 'morning' ? 'Morning routine done! Have a great day ☀️' : 'All done. Sleep well 🌙');
      celebrate(true);
      grow(3);
    } else if (list.includes(id)) {
      celebrate(false);
    }
  }

  /* ================= Views ================= */
  let currentView = 'today';
  let weekStart = startOfWeek(new Date());
  let todoFilter = 'active';

  const TITLES = { today: 'Today', week: 'This week', todos: 'To-dos & reminders', cycle: 'My cycle', journal: 'Journal', goals: 'Life goals' };
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

    const nm = state.profile.name;
    $('#today-greeting').textContent = nm ? greeting.replace(/ (\S+)$/, `, ${nm} $1`) : greeting;
    // One fact per line, so it's quick to scan
    let lines;
    if (!events.length && !todos.length && !mealDay(key).d) lines = ['Nothing planned yet. Enjoy the calm 🍵'];
    else {
      lines = [
        events.length ? `🗓️ ${plural(events.length, 'event')}` : '🗓️ No events',
        todos.length ? `✅ ${done} of ${todos.length} to-dos done${done === todos.length ? ' 🎉' : ''}` : '✅ No to-dos',
      ];
    }
    if (mealDay(key).d) lines.push(`🍝 Dinner: ${mealDay(key).d}`);
    $('#today-summary').innerHTML = lines.map((l) => `<span>${esc(l)}</span>`).join('');
    $('#today-progress').style.width = todos.length ? `${Math.round((done / todos.length) * 100)}%` : '0%';

    $('#today-events').innerHTML = events.length
      ? timelineHTML(key)
      : emptyHTML('No events today ✨ Tap ➕ to add one');
    // Only the next 3 to-dos, so it never feels like too much
    const pending = todos.filter((t) => !t.done);
    const collapsed = !showAllToday && pending.length > 3;
    const shown = collapsed ? pending.slice(0, 3) : todos;
    $('#today-todos').innerHTML = shown.length
      ? shown.map(todoHTML).join('')
      : emptyHTML('All clear! Tap ➕ to add a to-do 🌱');
    const more = $('#today-more');
    more.hidden = !(collapsed || (showAllToday && pending.length > 3));
    more.textContent = collapsed ? `Show ${todos.length - 3} more` : 'Just show the next 3';
    $('#focus-start').hidden = !pending.length;
    $('#focus-start').textContent = `🎯 Focus mode\n${plural(pending.length, 'thing')} to do`;
    renderUpNext();
    renderPlantChip();
    renderSnack();
    renderGardenCard();
    renderHabitCard();
    renderEmblems();
    $('#today-weekly').hidden = !!state.weekly[targetWeek()] || ![0, 1, 2].includes(now.getDay());

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
          return `<li class="ph-${k}${k === cur.phase ? ' is-current' : ''}"><span class="dot"></span>${PHASES[k].emoji} ${PHASES[k].name}${k === cur.phase ? ' (now)' : ''}<span class="days">${days}</span></li>`;
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
      if (idx === 0) meta += `\nCurrent cycle, day ${diffDays(p.start, tk) + 1}`;
      else meta += `\n${diffDays(p.start, arr[idx - 1].start)}-day cycle`;
      return `<li class="item"><button class="item-main" type="button" data-day="${p.start}">
        <span class="item-title">🩸 ${esc(range + year)}</span><span class="item-meta">${esc(meta)}</span></button></li>`;
    });
    $('#period-history').innerHTML = hist.length ? hist.join('') : emptyHTML('Your periods will show up here 🌸');
    $('#cycle-show-today').checked = state.cycle.showOnToday;
  }

  function renderWeek() {
    $('#week-mode').hidden = weekMode !== 'week';
    $('#month-mode').hidden = weekMode !== 'month';
    $('#meals-mode').hidden = weekMode !== 'meals';
    $$('.week-seg [data-wmode]').forEach((b) => {
      const on = b.dataset.wmode === weekMode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (weekMode === 'month') { renderMonthView(); return; }
    if (weekMode === 'meals') { renderMeals(); return; }
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
        ${mealDay(key).d ? `<ul class="list"><li class="garden-week-item meal-week-item">🍝 ${esc(mealDay(key).d)}</li></ul>` : ''}
        ${plantsDueOn(key).length ? `<ul class="list"><li class="garden-week-item">💧 Water ${esc(plantsDueOn(key).map((pl) => pl.name).join(', '))}</li></ul>` : ''}
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
    $$('.chip[data-filter]').forEach((c) => {
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
    if (currentView === 'goals') renderGoals();
    renderGBar();
    renderHeader();
  }

  function switchView(name) {
    currentView = name;
    const isMe = name === 'journal' || name === 'cycle';
    if (isMe) meSub = name;
    $('#me-seg').hidden = !isMe;
    $$('#me-seg [data-me]').forEach((b) => {
      const on = b.dataset.me === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${name}`));
    $$('.tab').forEach((t) => {
      const on = t.dataset.view === name || (t.dataset.view === 'me' && isMe);
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
    if (t.stepId) setStepDone(t.stepId, t.done);
    const nextOne = handleRepeat(t);
    grow(t.done ? 1 : -1);
    if (t.remind !== undefined && t.remind !== '') t.gRemindDirty = true;
    save();
    render();
    if (t.done) { showToast(nextOne ? `Done ✓ Next one: ${relDay(nextOne)}` : CHEERS[Math.floor(Math.random() * CHEERS.length)]); celebrate(false); }
    if (t.gEvId || (t.remind !== undefined && t.remind !== '')) googlePush(true); // add or remove the reminder
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
    if (kind === 'todo' && item.gEvId) { state.google.pendingDeletes.push(item.gEvId); googlePush(true); }
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
    if (kind === 'todo' && item.gEvId) {
      const pd = state.google.pendingDeletes;
      if (pd.includes(item.gEvId)) state.google.pendingDeletes = pd.filter((x) => x !== item.gEvId);
      else { item.gEvId = null; item.gRemindDirty = true; }
      googlePush(true);
    }
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
      ? (item && item.repeat ? 'Changes apply to every repeat. ' : '') + 'Leave the time empty for an all-day event.'
      : 'Date and time are optional — add them to make it a reminder.';
    $('#f-clear-when').hidden = isEvent;
    $('#f-colors').hidden = !isEvent;
    $('#f-repeat-field').hidden = false;
    $('#f-repeat').value = item && item.repeat && REPEATS[item.repeat] ? item.repeat : '';
    $('#f-steps-field').hidden = isEvent;
    $('#f-steps').value = !isEvent && item && Array.isArray(item.steps) ? item.steps.map((s) => s.title).join('\n') : '';
    const color = item ? safeColor(item.color) : 'pink';
    $$('input[name="color"]').forEach((r) => { r.checked = r.value === color; });
    $('#btn-delete').hidden = !item;
    $('#f-gsync-row').hidden = !(isEvent && state.google.connected);
    $('#f-gsync').checked = item ? !!item.gSync : state.google.autoPush;
    const canNotify = state.google.connected;
    $('#f-remind-field').hidden = !canNotify;
    $('#f-remind').value = item && item.remind !== undefined && item.remind !== null ? String(item.remind) : '';
    $('#f-remind-hint').textContent = canNotify
      ? (isEvent ? 'Notifications come from Google Calendar on your phone.' : 'Needs a date and time. The notification comes from Google Calendar on your phone.')
      : '🔔 Want notifications? Connect Google Calendar in ⚙️ Settings → Extras.';
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
      const repeat = $('#f-repeat').value;
      data = { title, date: fDate.value, time: fTime.value, color: safeColor(color), repeat: REPEATS[repeat] ? repeat : '' };
      if (state.google.connected) {
        data.remind = $('#f-remind').value;
        data.gSync = $('#f-gsync').checked || data.remind !== ''; // a notification needs the Google copy
        if (data.gSync) data.gDirty = true;
      }
    } else {
      let due = fDate.value;
      const time = fTime.value;
      if (time && !due) due = todayKey();
      const old = id ? find('todo', id) : null;
      const steps = $('#f-steps').value.split('\n').map((x) => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).slice(0, 20)
        .map((st) => (old && Array.isArray(old.steps) && old.steps.find((s) => s.title === st)) || { id: uid(), title: st.slice(0, 100), done: false });
      const repeat = REPEATS[$('#f-repeat').value] ? $('#f-repeat').value : '';
      if (repeat && !due) due = todayKey();
      data = { title, due, time, steps, repeat };
      if (state.google.connected) {
        data.remind = $('#f-remind').value;
        if (data.remind !== '' && !time) return showError('Add a time so I know when to notify you', fTime);
        data.gRemindDirty = true;
      }
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
    if (kind === 'todo' && state.google.connected) googlePush(true);
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
  let meSub = 'journal'; // the Me tab remembers Journal or Cycle
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view === 'me' ? meSub : tab.dataset.view)));
  $('#me-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-me]'); if (b) switchView(b.dataset.me); });

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
    const raw = input.value.trim();
    if (!raw) { input.focus(); return; }
    const q = parseQuick(raw); // "Call Mum Friday 3pm" → title, date and time
    state.todos.push({ id: uid(), created: Date.now(), title: q.title, due: q.due, time: q.time, repeat: q.repeat, done: false });
    input.value = '';
    $('#quick-tip').textContent = QUICK_TIP;
    if (todoFilter === 'done') todoFilter = 'active';
    save();
    render();
    showToast(q.due ? `Added for ${relDay(q.due)}${q.time ? `, ${fmtTime(q.time)}` : ''} 🌷` : 'To-do added 🌷');
  });

  $$('.chip[data-filter]').forEach((chip) => chip.addEventListener('click', () => { todoFilter = chip.dataset.filter; render(); }));

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
    if (sheet.open || daySheet.open || settingsSheet.open || routineSheet.open || journalSheet.open || focusSheet.open || dumpSheet.open || addSheet.open || tourEl.open
      || whySheet.open || plantSheet.open || goalSheet.open || weeklySheet.open || gardenSheet.open || gardenEdit.open || habitSheet.open || mealSheet.open || libSheet.open) return;
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
    $('#day-title').textContent = ['Today', 'Tomorrow', 'Yesterday'].includes(rel) ? `${rel}\n${long}` : long;
    const ph = cycleModel(key).phaseFor(key);
    $('#day-phase').textContent = ph
      ? `${PHASES[ph.phase].emoji} ${PHASES[ph.phase].name} phase\nCycle day ${ph.day}${key > todayKey() ? ' (estimate)' : ''}`
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

  /* ================= ADHD helpers: rewards, up next, focus, brain dump ================= */
  const CHEERS = ['Nice work ✨', 'Done ✓', 'One less thing on your mind', 'That\'s progress 💪',
    'Well done', 'Ticked off ✓', 'Good going ✨', 'Sorted'];
  let showAllToday = false;

  function celebrate(big) {
    try { if (navigator.vibrate) navigator.vibrate(big ? [30, 40, 30] : 20); } catch (e) { /* ignore */ }
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    const themed = state.look !== 'soft';
    const colours = themed
      ? ['var(--accent)', 'var(--ink)', 'var(--pink)', 'var(--mint)', 'var(--sky)', 'var(--butter)']
      : ['var(--ch-mood)', 'var(--ch-follicular)', 'var(--ch-ovulation)', 'var(--ch-luteal)', 'var(--mint)', 'var(--peach)'];
    const emojis = (LOOKS[state.look] || LOOKS.cherry).confetti;
    const n = big ? 64 : 26;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      if (i % 4 === 0) { s.className = 'emo'; s.textContent = emojis[i % emojis.length]; } else s.style.background = colours[i % colours.length];
      s.style.setProperty('--x', `${(Math.random() * 2 - 1) * (big ? 48 : 32)}vw`);
      s.style.setProperty('--y', `${-(20 + Math.random() * (big ? 50 : 30))}vh`);
      s.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
      s.style.setProperty('--d', `${Math.random() * 0.15}s`);
      layer.appendChild(s);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1900);
  }

  // ---- Up next ----
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  function timedOn(key) {
    return state.events.filter((e) => e.time && occursOn(e, key)).map((e) => ({ title: e.title, time: e.time }))
      .concat(gEventsOn(key).filter((g) => !g.allDay && g.time).map((g) => ({ title: g.title, time: g.time })))
      .sort(byTime);
  }
  function renderUpNext() {
    const el = $('#upnext');
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let u = null;
    const next = timedOn(todayKey()).find((x) => toMin(x.time) >= nowMin - 15);
    if (next) {
      const diff = toMin(next.time) - nowMin;
      let when;
      if (diff <= 0) when = 'happening now';
      else if (diff < 60) when = `in ${diff} min`;
      else when = `in ${Math.floor(diff / 60)} h${diff % 60 ? ` ${diff % 60} min` : ''}`;
      u = { title: next.title, when, at: fmtTime(next.time), soon: diff <= 30 };
    } else {
      const tm = timedOn(dateKey(addDays(now, 1)))[0];
      if (tm) u = { title: tm.title, when: 'tomorrow', at: fmtTime(tm.time), soon: false };
    }
    el.hidden = !u;
    if (!u) return;
    el.classList.toggle('is-soon', u.soon);
    el.innerHTML = `<span class="upnext-label">⏰ Up next ${whyBtn('upnext')}</span><span class="upnext-title">${esc(u.title)}</span><span class="upnext-when">${esc(u.when.charAt(0).toUpperCase() + u.when.slice(1))}\nat ${esc(u.at)}</span>`;
  }
  setInterval(() => { if (currentView === 'today' && !document.hidden) renderUpNext(); }, 30 * 1000);

  // ---- Focus mode: one thing at a time ----
  const focusSheet = $('#focus-sheet');
  const RING = 326.73;
  let focusQueue = [];
  let focusIdx = 0;
  let focusKind = 'todo';
  let focusSlot = null;
  let timerMin = 10;
  let timerLeft = 600;
  let timerEnd = 0;
  let timerId = null;
  let wakeLock = null;
  let audioCtx = null;

  function openFocus(kind) {
    focusKind = kind;
    if (kind === 'routine') {
      focusSlot = routineSlot(new Date().getHours());
      const doneSteps = routineDay(todayKey())[focusSlot] || [];
      focusQueue = (focusSlot ? state.routine[focusSlot] : []).filter((s) => !doneSteps.includes(s.id))
        .map((s) => ({ id: s.id, title: s.title, meta: focusSlot === 'morning' ? '☀️ Morning routine' : '🌙 Night routine' }));
    } else {
      const tk = todayKey();
      focusQueue = [];
      todaysTodos().filter((t) => !t.done).forEach((t) => {
        const subs = !t.isG && Array.isArray(t.steps) ? t.steps.filter((s) => !s.done) : [];
        if (subs.length) {
          subs.forEach((s) => focusQueue.push({ id: t.id, subId: s.id, title: s.title, meta: `👣 Step of: ${t.title}` }));
        } else {
          focusQueue.push({
            id: t.id,
            isG: !!t.isG,
            title: t.title,
            meta: t.due ? `${relDay(t.due)}${t.time ? `, ${fmtTime(t.time)}` : ''}${t.due < tk ? '\nOverdue' : ''}` : '',
          });
        }
      });
    }
    if (!focusQueue.length) { showToast('Nothing left here. Nice! 🌸'); return; }
    focusIdx = 0;
    setTimer(kind === 'routine' ? 5 : timerMin);
    renderFocus();
    focusSheet.showModal();
  }

  function renderFocus() {
    const finished = focusIdx >= focusQueue.length;
    $('#focus-main').hidden = finished;
    $('#focus-finished').hidden = !finished;
    if (finished) {
      $('#focus-count').textContent = '';
      $('#focus-finished-msg').textContent = focusKind === 'routine' ? 'Routine complete. Nice work.' : "That's everything for today. Nice work.";
      stopTimer();
      celebrate(true);
      return;
    }
    const item = focusQueue[focusIdx];
    const left = focusQueue.length - focusIdx;
    $('#focus-count').textContent = left === 1 ? 'Last one!' : `${left} left`;
    $('#focus-kicker').textContent = 'Right now, just this:';
    $('#focus-title').textContent = item.title;
    $('#focus-meta').textContent = item.meta || '';
    $('#focus-skip').hidden = left === 1;
  }

  function drawTimer() {
    const total = timerMin * 60;
    const m = Math.floor(timerLeft / 60);
    const s = Math.floor(timerLeft % 60);
    $('#timer-text').textContent = `${m}:${pad(s)}`;
    $('#timer-prog').style.strokeDashoffset = String(RING * (1 - timerLeft / total));
    $('#timer-toggle').textContent = timerId ? '⏸️ Pause' : timerLeft > 0 && timerLeft < total ? '▶️ Keep going' : '▶️ Start timer';
    $$('#timer-pick .chip').forEach((c) => c.classList.toggle('is-active', Number(c.dataset.min) === timerMin));
  }
  function setTimer(min) { stopTimer(); timerMin = min; timerLeft = min * 60; drawTimer(); }
  function startTimer() {
    if (timerLeft <= 0) timerLeft = timerMin * 60;
    timerEnd = Date.now() + timerLeft * 1000;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume();
    } catch (e) { audioCtx = null; }
    try {
      if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
    } catch (e) { /* ignore */ }
    timerId = setInterval(tickTimer, 250);
    drawTimer();
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ }
    wakeLock = null;
    drawTimer();
  }
  function chime() {
    if (!audioCtx) return;
    [0, 0.35, 0.7].forEach((t, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = [660, 880, 990][i];
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.3);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t);
      o.stop(audioCtx.currentTime + t + 0.32);
    });
  }
  function tickTimer() {
    timerLeft = Math.max(0, (timerEnd - Date.now()) / 1000);
    drawTimer();
    if (timerLeft <= 0) {
      stopTimer();
      chime();
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
      $('#focus-kicker').textContent = "⏰ Time's up! Done, or another round?";
    }
  }

  $('#timer-toggle').addEventListener('click', () => { if (timerId) stopTimer(); else startTimer(); });
  $$('#timer-pick .chip').forEach((c) => c.addEventListener('click', () => setTimer(Number(c.dataset.min))));
  $('#focus-done').addEventListener('click', () => {
    const item = focusQueue[focusIdx];
    if (!item) return;
    if (focusKind === 'routine') toggleStep(focusSlot, item.id);
    else if (item.subId) doSubStep(item.id, item.subId);
    else if (item.isG) toggleGTask(item.id);
    else toggleTodo(item.id);
    focusIdx++;
    setTimer(timerMin);
    renderFocus();
  });
  $('#focus-skip').addEventListener('click', () => {
    if (focusQueue.length - focusIdx <= 1) return;
    focusQueue.push(focusQueue.splice(focusIdx, 1)[0]); // come back to it later
    setTimer(timerMin);
    renderFocus();
  });
  const closeFocus = () => { if (focusSheet.open) focusSheet.close(); };
  $('#focus-close').addEventListener('click', closeFocus);
  $('#focus-finish-close').addEventListener('click', closeFocus);
  focusSheet.addEventListener('close', () => { stopTimer(); render(); });
  $('#focus-start').addEventListener('click', () => openFocus('todo'));
  $('#routine-start').addEventListener('click', () => openFocus('routine'));
  $('#today-more').addEventListener('click', () => { showAllToday = !showAllToday; render(); });

  // ---- Brain dump ----
  const dumpSheet = $('#dump-sheet');
  function openDump() {
    $('#dump-text').value = '';
    dumpSheet.showModal();
    setTimeout(() => $('#dump-text').focus(), 50);
  }
  $('#dump-cancel').addEventListener('click', () => dumpSheet.close());
  dumpSheet.addEventListener('click', (e) => { if (e.target === dumpSheet) dumpSheet.close(); });
  $('#dump-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const lines = $('#dump-text').value.split('\n').map((l) => l.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).slice(0, 50);
    if (!lines.length) { dumpSheet.close(); return; }
    lines.forEach((line, i) => {
      const q = parseQuick(line);
      state.todos.push({ id: uid(), created: Date.now() + i, title: q.title, due: q.due, time: q.time, repeat: q.repeat, done: false });
    });
    save();
    dumpSheet.close();
    render();
    showToast(`${plural(lines.length, 'thing')} out of your head and into your to-dos 🧠✨`);
    celebrate(false);
  });

  /* ================= Learn: "Why?" explanations & daily brain snacks ================= */
  const WHY = {
    meals: {
      t: '🍽️ Why plan meals?',
      b: 'Deciding what to eat at 6 pm when you are tired is hard, which is when takeaways win. In a study of about 40,000 adults, people who planned their meals ahead ate a healthier, more varied diet and were less likely to be obese. Planning a few dinners, plus a shopping list, also means fewer extra trips to the shop.',
      s: 'Ducrot et al., 2017 (International Journal of Behavioral Nutrition and Physical Activity)',
    },
    habits: {
      t: '✨ Why track habits?',
      b: 'Ticking a box each day keeps your progress visible, and that helps. A big review of 138 studies found that monitoring progress made people more likely to reach their goals, especially when the progress was actually recorded. Start with 2 to 4 small habits. Missing one day is fine; just try not to miss twice.',
      s: 'Harkin et al., 2016 (Psychological Bulletin); Lally et al., 2010',
    },
    pixels: {
      t: '🌈 Why a Year in Pixels?',
      b: 'Seeing a whole year of moods at once makes patterns jump out: tough weeks, good seasons, and how your routines or cycle line up with how you feel. It is one of the most popular bullet journal pages of all time, and the planner fills it in for you from your journal.',
      s: 'Bullet Journal community',
    },
    plants: {
      t: '🪴 Why these watering times?',
      b: 'Every plant drinks differently. Basil and tomatoes are thirsty, while succulents, string of hearts and snake plants rot if they are watered too often. These schedules are a starting point: light, heat, wind, pot size and the season all change how fast soil dries. The best test is your finger: water when the top few centimetres of soil feel dry. Outdoor pots in sun and wind dry out faster, so the planner shortens their schedule.',
      s: 'Royal Horticultural Society (RHS) watering advice; general houseplant care guides',
    },
    reading: {
      t: '👓 Why these reading options?',
      b: 'Bigger text and extra space between letters make words easier to pick out. In one study, extra-wide letter spacing doubled reading accuracy for children with dyslexia. Plain fonts without serifs or slanting are read more easily than fancy ones. Special "dyslexia fonts" like OpenDyslexic didn\'t beat regular fonts in studies, so here you get clear, proven fonts instead. Everyone is different, so try them and keep what feels easiest.',
      s: 'Zorzi et al., 2012 (PNAS); Rello & Baeza-Yates, 2013; Wery & Diliberto, 2017; British Dyslexia Association style guide',
    },
    upnext: {
      t: '⏰ Why a countdown?',
      b: 'ADHD can make it hard to feel time passing (often called "time blindness"). Seeing "in 25 min" turns time into something you can see, so you get caught out less. Clinical guides recommend timers, countdowns and alarms for exactly this reason.',
      s: 'NHS ADHD self-help guidance; HelpGuide',
    },
    focus: {
      t: '🎯 Why one thing at a time?',
      b: 'A long list makes your brain spend energy choosing, and that can freeze you. Showing one task removes the choice, and a visible timer gives a clear finish line. "Just 10 minutes" is much easier to start than "the whole thing".',
      s: 'Same idea as ADHD apps like Llama Life and Routinery; NHS guidance on timers',
    },
    top3: {
      t: '🌱 Why only 3 to-dos?',
      b: 'Seeing everything at once can trigger overwhelm and "where do I even start?". Showing the next 3 keeps it doable, and the rest are still there when you want them. Designers of ADHD apps found the same thing in testing: too much on one screen recreates the overwhelm.',
      s: 'ADHD app design case studies',
    },
    routine: {
      t: '🔁 Why routines work',
      b: 'In a UCL study, new daily habits took 66 days on average to feel automatic (anywhere from 18 to 254), and missing a single day did not undo progress. That\'s why your streak forgives one missed day. Tying a routine to a trigger ("After I turn off my alarm…") is called an if-then plan: across 94 studies it made people noticeably more likely to follow through. And a regular lights-out time matters too: large 2023 studies linked a regular sleep schedule with better health, even more strongly than hours slept.',
      s: 'Lally et al., 2010; Gollwitzer & Sheeran, 2006; Windred et al., 2023',
    },
    dump: {
      t: '🧠 Why a brain dump?',
      b: 'Holding lots of little things in your head uses up working memory, your brain\'s "sticky note" space, which is often already stretched with ADHD. Getting thoughts out onto paper frees that space: in one study, anxious students who wrote down their worries before an exam did better on it.',
      s: 'Ramirez & Beilock, 2011 (Science)',
    },
    journal: {
      t: '📓 Why journal?',
      b: 'Writing about your thoughts and feelings for a few minutes has been linked to better mood and wellbeing in many studies. Noting good things helps too: people who wrote down three good things each evening for a week were happier for months afterwards. And rating your mood lets the planner show patterns you\'d never spot from memory.',
      s: 'Pennebaker\'s expressive writing research; Seligman et al., 2005',
    },
    goals: {
      t: '🎯 Why goals with small steps?',
      b: 'Big goals like "do nails full-time" are too blurry to act on, so they get put off. Small, concrete steps give your brain a clear next thing to do. And feeling progress on something that matters to you is one of the biggest boosts to motivation there is.',
      s: 'Amabile & Kramer, "The Progress Principle" (2011)',
    },
    weekly: {
      t: '🗓️ Why a weekly reset?',
      b: 'People are more likely to start fresh at "new beginnings" like a Monday, a new month or a birthday. Researchers call it the fresh start effect. A short look back also helps you notice what worked, instead of only remembering what went wrong.',
      s: 'Dai, Milkman & Riis, 2014',
    },
    breakdown: {
      t: '🪄 Why break tasks down?',
      b: 'With ADHD the hardest part is often starting, especially when a task feels big and fuzzy. A tiny, concrete first step ("open the laptop") is easy to begin, and once you\'re moving it\'s easier to keep going. That\'s why tools like Goblin Tools\' Magic ToDo are so loved.',
      s: 'Executive-function support guides; Goblin Tools',
    },
    plant: {
      t: '🌱 Why a plant buddy?',
      b: 'ADHD brains tend to respond more strongly to rewards that come right away than to ones far in the future. Small instant rewards, like confetti or your plant growing, give a little "yes!" for each step while the big goal is still far off. Your plant never dies; it just waits for you, because guilt doesn\'t help anyone get started.',
      s: 'Research on reward and delay in ADHD (e.g. Sonuga-Barke); apps like Finch',
    },
    phases: {
      t: '🌙 Why track cycle phases?',
      b: 'Hormone levels change across the menstrual cycle, and many people notice their energy, mood and focus shift with them. Everyone is different, so your own data is the best guide: your journal\'s patterns will show how your mood moves through your phases.',
      s: 'Menstrual-cycle research; your own journal patterns',
    },
    timeline: {
      t: '🕒 Why see your day as a timeline?',
      b: 'A plain list hides how much time you actually have. Seeing events, free gaps and "now" on a line makes time concrete, which is why visual planners like Tiimo (Apple\'s iPhone App of the Year 2025) are so popular with ADHD users.',
      s: 'Tiimo; NHS guidance on making time visible',
    },
  };

  const SNACKS = [
    ['New habits took 66 days on average to feel automatic in a UCL study, not 21! It ranged from 18 to 254 days, so be patient with yourself.', 'Lally et al., 2010'],
    ['Missing one day did not undo habit-building in the UCL habit study. What mattered was not missing lots. So: never miss twice.', 'Lally et al., 2010'],
    ['The "21 days to form a habit" idea comes from a 1960 self-help book about getting used to changes, not from a study.', 'UCL Behavioural Science & Health blog'],
    ['If-then plans ("After I turn off my alarm, I\'ll drink water") made people noticeably more likely to follow through, across 94 studies.', 'Gollwitzer & Sheeran, 2006'],
    ['Writing a to-do list for tomorrow before bed helped people fall asleep faster than writing about what they had already done.', 'Scullin et al., 2018'],
    ['Going to bed and waking at regular times was linked to better long-term health, even more strongly than how many hours people slept.', 'Windred et al., 2023 (60,000+ people)'],
    ['Writing down three good things each evening for one week made people happier for months afterwards.', 'Seligman et al., 2005'],
    ['Anxious students who spent 10 minutes writing about their worries before an exam did better on it. Brain dumps work!', 'Ramirez & Beilock, 2011'],
    ['People are more likely to start new goals on "fresh start" days: Mondays, the 1st of the month, birthdays. Use them!', 'Dai, Milkman & Riis, 2014'],
    ['Making progress on meaningful work, even small progress, was the biggest boost to people\'s mood and motivation at work.', 'Amabile & Kramer, 2011'],
    ['Morning daylight helps set your body clock, which can make it easier to feel sleepy at bedtime. Open the curtains or step outside!', 'Circadian sleep research'],
    ['Studies, mostly in children and teens with ADHD, found short bursts of exercise can give a small, temporary boost to attention and focus.', 'Meta-analyses of exercise and ADHD'],
    ['People with ADHD often underestimate how long things take. A common tip: add a buffer of about half again to your guesses.', 'HelpGuide; ADHD coaching advice'],
    ['ADHD is linked to differences in how the brain handles reward, which is part of why quick, small rewards can feel so motivating.', 'Research on reward processing in ADHD'],
    ['"Body doubling" (working alongside someone) is popular with ADHD, but proper trials are still missing. If it helps you, that\'s what counts.', 'CHADD; Popular Science'],
    ['Tracking your progress helps you reach goals: across 138 studies, people who monitored their progress did better, especially when they wrote it down.', 'Harkin et al., 2016'],
    ['Even mild dehydration has been linked to lower mood and concentration in studies of young women. Water first thing is a great habit.', 'Armstrong et al., 2012'],
  ];
  let snackOffset = 0;

  function renderSnack() {
    const dayNo = Math.floor(parseKey(todayKey()).getTime() / 86400000);
    const [fact, source] = SNACKS[(((dayNo + snackOffset) % SNACKS.length) + SNACKS.length) % SNACKS.length];
    $('#snack-card').innerHTML = `<div class="snack-head"><span class="snack-label">🧠 Brain snack</span>
      <button class="link-btn speak-btn" type="button" data-speak-snack aria-label="Read aloud">🔊</button>
      <button class="link-btn" type="button" id="snack-next">Another one ➡️</button></div>
      <p class="snack-fact">${esc(fact)}</p><p class="snack-source">📚 ${esc(source)}</p>`;
  }

  const whySheet = $('#why-sheet');
  document.addEventListener('click', (e) => {
    const w = e.target.closest('[data-why]');
    if (w && WHY[w.dataset.why]) {
      e.preventDefault();
      const info = WHY[w.dataset.why];
      $('#why-title').textContent = info.t;
      $('#why-body').textContent = info.b;
      $('#why-source').textContent = `📚 ${info.s}`;
      whySheet.showModal();
      return;
    }
    if (e.target.closest('#snack-next')) { snackOffset++; renderSnack(); }
  });
  $('#why-close').addEventListener('click', () => whySheet.close());
  whySheet.addEventListener('click', (e) => { if (e.target === whySheet) whySheet.close(); });
  const whyBtn = (key) => `<button class="why-btn" type="button" data-why="${key}" aria-label="Why this helps">💡</button>`;

  /* ================= Plant buddy ================= */
  const STAGES = [
    [0, '🌱', 'Seedling'], [10, '🌿', 'Sprout'], [30, '🪴', 'Little plant'], [60, '🌷', 'Budding'],
    [100, '🌸', 'Blooming'], [160, '🌳', 'Mighty tree'], [250, '🌺', 'Secret garden'],
  ];
  const plantStage = (xp) => { let i = 0; STAGES.forEach((s, j) => { if (xp >= s[0]) i = j; }); return i; };

  function grow(n) {
    const p = state.plant;
    const before = plantStage(p.xp);
    p.xp = Math.max(0, p.xp + n);
    if (n > 0) p.last = todayKey();
    save();
    const after = plantStage(p.xp);
    if (after > before) {
      setTimeout(() => {
        showToast(`${STAGES[after][1]} ${p.name} grew into a ${STAGES[after][2].toLowerCase()}!`);
        celebrate(true);
      }, 1400);
    }
  }

  function renderPlantChip() {
    const p = state.plant;
    const i = plantStage(p.xp);
    const [, emoji, label] = STAGES[i];
    const next = STAGES[i + 1];
    const thirsty = p.last && diffDays(p.last, todayKey()) >= 3;
    const pct = next ? Math.round(((p.xp - STAGES[i][0]) / (next[0] - STAGES[i][0])) * 100) : 100;
    $('#plant-chip').innerHTML = `<span class="plant-emoji" aria-hidden="true">${thirsty ? '🥀' : emoji}</span>
      <span class="plant-info"><span class="plant-name">${esc(p.name)}\n<small>${thirsty ? 'Missed you! 💧' : label}</small></span>
      <span class="plant-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <small>${next ? `${next[0] - p.xp} to ${next[2].toLowerCase()} ${next[1]}` : 'Fully grown! 🌺'}</small></span>`;
    $('#plant-chip').setAttribute('aria-label', `Your plant ${p.name}: ${label}, ${p.xp} growth points`);
  }

  const plantSheet = $('#plant-sheet');
  $('#plant-chip').addEventListener('click', () => {
    const p = state.plant;
    const i = plantStage(p.xp);
    $('#plant-big').textContent = STAGES[i][1];
    $('#plant-name').value = p.name;
    $('#plant-status').textContent = `${STAGES[i][2]}\n${p.xp} growth points`;
    $('#plant-stages').innerHTML = STAGES.map((s, j) => `<span class="${j <= i ? 'got' : ''}" title="${esc(s[2])}">${s[1]}</span>`).join('');
    plantSheet.showModal();
  });
  $('#plant-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#plant-name').value.trim().slice(0, 20);
    if (name) state.plant.name = name;
    save();
    plantSheet.close();
    render();
  });
  plantSheet.addEventListener('click', (e) => { if (e.target === plantSheet) plantSheet.close(); });

  /* ================= Life goals ================= */
  const GOAL_IDEAS = [
    { emoji: '💅', title: 'Do nails full-time', why: 'Freedom to do what I love', steps: ['Choose my business name', 'Set up my Instagram page', 'Work out my prices', 'Do 10 practice clients', 'Get my certificate'] },
    { emoji: '💸', title: 'Pay off my debt', why: 'Less stress, more freedom', steps: ['List every debt and its interest rate', 'Set up an automatic payment', 'Pay extra on the highest-interest one'] },
    { emoji: '💪', title: 'Feel healthier', why: 'More energy for the things I love', steps: ['Walk 3 times a week', 'Drink water every morning', 'Cook one new meal a week'] },
  ];
  const goalSheet = $('#goal-sheet');
  let editingGoal = null;

  const findGoalStep = (sid) => {
    for (const g of state.goals) { const s = g.steps.find((x) => x.id === sid); if (s) return { g, s }; }
    return null;
  };
  const linkedTodo = (sid) => state.todos.find((t) => t.stepId === sid);

  function renderGoals() {
    // Weekly reset card
    const wk = targetWeek();
    const w = state.weekly[wk];
    if (w) {
      const picks = state.todos.filter((t) => t.weekOf === wk);
      const doneN = picks.filter((t) => t.done).length;
      $('#weekly-card').innerHTML = `<div class="weekly-card"><h2>✅ This week's focus ${whyBtn('weekly')}</h2>
        <p class="weekly-sub">${picks.length ? `${doneN} of ${picks.length} done${doneN === picks.length ? ' 🎉' : ''}` : 'Reset done for this week'}</p>
        ${picks.length ? `<ul class="list">${picks.map(todoHTML).join('')}</ul>` : ''}
        ${w.win ? `<p class="weekly-sub">🏆 Last week's win: ${esc(w.win)}</p>` : ''}</div>`;
    } else {
      $('#weekly-card').innerHTML = `<div class="weekly-card"><h2>🗓️ Weekly reset ${whyBtn('weekly')}</h2>
        <p class="weekly-sub">10 minutes to look back and pick your 3 things for the week. Sundays or Mondays are perfect.</p>
        <button class="btn primary wide" type="button" id="weekly-start">✨ Start my weekly reset</button></div>`;
    }

    // Goals
    if (!state.goals.length) {
      $('#goal-list').innerHTML = `<div class="goal-card empty-goals"><p>What do you want your life to look like? Add a goal, or start from an idea:</p>
        <div class="chips">${GOAL_IDEAS.map((g, i) => `<button class="chip" type="button" data-goal-idea="${i}">${g.emoji} ${esc(g.title)}</button>`).join('')}</div></div>`;
      return;
    }
    $('#goal-list').innerHTML = state.goals.map((g) => {
      const doneN = g.steps.filter((s) => s.done).length;
      const pct = g.steps.length ? Math.round((doneN / g.steps.length) * 100) : 0;
      return `<div class="goal-card">
        <div class="goal-head"><span class="goal-emoji" aria-hidden="true">${esc(g.emoji || '🎯')}</span>
          <div class="goal-text"><h3>${esc(g.title)}</h3>${g.why ? `<p class="goal-why">💖 ${esc(g.why)}</p>` : ''}</div>
          <button class="link-btn" type="button" data-goal-edit="${esc(g.id)}">Edit</button></div>
        <div class="goal-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <p class="goal-count">${g.steps.length ? `${doneN} of ${g.steps.length} steps${pct === 100 ? '\nGoal reached! 🏆' : ''}` : 'Add some small steps with Edit'}</p>
        <ul class="goal-steps">${g.steps.map((s) => {
          const linked = linkedTodo(s.id);
          const onList = linked && !linked.done;
          return `<li><button class="routine-step goal-step${s.done ? ' done' : ''}" type="button" data-goal-step="${esc(s.id)}" aria-pressed="${s.done}">
            <span class="tick" aria-hidden="true">✓</span><span>${esc(s.title)}</span></button>
            ${s.done ? '' : `<button class="mini-btn" type="button" data-goal-todo="${esc(s.id)}" ${onList ? 'disabled' : ''}>${onList ? 'On list ✓' : '+ To-do'}</button>`}</li>`;
        }).join('')}</ul></div>`;
    }).join('');
  }

  function setStepDone(sid, done) {
    const f = findGoalStep(sid);
    if (!f || f.s.done === done) return;
    f.s.done = done;
    if (done) grow(2);
  }

  function openGoal(id, idea) {
    const g = id ? state.goals.find((x) => x.id === id) : null;
    editingGoal = g ? g.id : null;
    const src = g || idea || {};
    $('#goal-sheet-title').textContent = g ? 'Edit goal' : 'New goal';
    $('#goal-emoji').value = src.emoji || '🎯';
    $('#goal-title').value = src.title || '';
    $('#goal-why-input').value = src.why || '';
    $('#goal-steps').value = (src.steps || []).map((s) => (typeof s === 'string' ? s : s.title)).join('\n');
    $('#goal-delete').hidden = !g;
    goalSheet.showModal();
  }

  $('#goal-add').addEventListener('click', () => openGoal(null));
  $('#goal-cancel').addEventListener('click', () => goalSheet.close());
  goalSheet.addEventListener('click', (e) => { if (e.target === goalSheet) goalSheet.close(); });
  $('#goal-delete').addEventListener('click', () => {
    if (!editingGoal || !confirm('Delete this goal and its steps?')) return;
    state.goals = state.goals.filter((g) => g.id !== editingGoal);
    save();
    goalSheet.close();
    render();
  });
  $('#goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#goal-title').value.trim();
    if (!title) { showToast('Give your goal a name 🙂'); $('#goal-title').focus(); return; }
    const old = editingGoal ? state.goals.find((g) => g.id === editingGoal) : null;
    const steps = $('#goal-steps').value.split('\n').map((x) => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).slice(0, 30)
      .map((t) => { const same = old && old.steps.find((s) => s.title === t); return same || { id: uid(), title: t.slice(0, 100), done: false }; });
    const data = { emoji: $('#goal-emoji').value.trim().slice(0, 4) || '🎯', title: title.slice(0, 80), why: $('#goal-why-input').value.trim().slice(0, 120), steps };
    if (old) Object.assign(old, data); else state.goals.push({ id: uid(), created: Date.now(), ...data });
    save();
    goalSheet.close();
    render();
    showToast(old ? 'Goal saved ✨' : 'New goal added 🎯 You\'ve got this!');
  });

  /* ================= Weekly reset ================= */
  const weeklySheet = $('#weekly-sheet');
  // On Sunday you plan the week ahead; any other day, the current week
  function targetWeek() {
    const d = new Date();
    return dateKey(startOfWeek(d.getDay() === 0 ? addDays(d, 1) : d));
  }
  let weeklyPicks = [];

  function openWeekly() {
    const last7 = [];
    for (let i = 1; i <= 7; i++) last7.push(dateKey(addDays(new Date(), -i)));
    const mDone = last7.filter((k) => routineDay(k).morningAll).length;
    const nDone = last7.filter((k) => routineDay(k).nightAll).length;
    const tDone = allTodos().filter((t) => t.done && t.doneOn && last7.concat(todayKey()).includes(t.doneOn)).length;
    const moods = last7.map((k) => moodOf(journalEntry(k))).filter(Boolean);
    const avg = moods.length ? avgOf(moods) : 0;
    $('#weekly-stats').innerHTML = `
      <div><b>${mDone}/7</b>☀️ morning routines</div>
      <div><b>${nDone}/7</b>🌙 night routines</div>
      <div><b>${tDone}</b>✅ to-dos done</div>
      <div><b>${avg ? `${moodEmoji(avg)} ${avg.toFixed(1)}` : '–'}</b>💗 average mood</div>`;
    weeklyPicks = [];
    const open = [];
    state.goals.forEach((g) => g.steps.forEach((s) => { if (!s.done) open.push({ sid: s.id, label: `${g.emoji || '🎯'} ${s.title}` }); }));
    $('#weekly-picks').innerHTML = open.length
      ? open.slice(0, 15).map((o) => `<button class="chip" type="button" data-pick="${esc(o.sid)}">${esc(o.label)}</button>`).join('')
      : '<p class="hint">Add a goal in the Goals tab to get suggestions here. For now, type your own below.</p>';
    ['#weekly-win', '#weekly-lesson', '#weekly-own1', '#weekly-own2', '#weekly-own3'].forEach((s) => { $(s).value = ''; });
    updatePickCount();
    weeklySheet.showModal();
  }
  function updatePickCount() {
    const own = ['#weekly-own1', '#weekly-own2', '#weekly-own3'].filter((s) => $(s).value.trim()).length;
    const n = weeklyPicks.length + own;
    $('#weekly-count').textContent = n > 3 ? `That's ${n}: only the first 3 will be kept 🌱` : `${n} of 3 picked`;
  }
  $('#weekly-picks').addEventListener('click', (e) => {
    const c = e.target.closest('[data-pick]');
    if (!c) return;
    const sid = c.dataset.pick;
    const own = ['#weekly-own1', '#weekly-own2', '#weekly-own3'].filter((s) => $(s).value.trim()).length;
    if (weeklyPicks.includes(sid)) weeklyPicks = weeklyPicks.filter((x) => x !== sid);
    else if (weeklyPicks.length + own < 3) weeklyPicks.push(sid);
    else { showToast('3 is plenty! Unpick one first 🌱'); return; }
    c.classList.toggle('is-active', weeklyPicks.includes(sid));
    updatePickCount();
  });
  ['#weekly-own1', '#weekly-own2', '#weekly-own3'].forEach((s) => $(s).addEventListener('input', updatePickCount));
  $('#weekly-cancel').addEventListener('click', () => weeklySheet.close());
  $('#weekly-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const wk = targetWeek();
    const own = ['#weekly-own1', '#weekly-own2', '#weekly-own3'].map((s) => $(s).value.trim()).filter(Boolean);
    const titles = [];
    weeklyPicks.slice(0, 3).forEach((sid, i) => {
      const f = findGoalStep(sid);
      if (!f) return;
      const existing = linkedTodo(sid);
      if (existing && !existing.done) { existing.weekOf = wk; titles.push(existing.title); return; }
      const title = `${f.g.emoji || '🎯'} ${f.s.title}`;
      state.todos.push({ id: uid(), created: Date.now() + i, title, due: '', time: '', done: false, stepId: sid, weekOf: wk });
      titles.push(title);
    });
    own.slice(0, Math.max(0, 3 - titles.length)).forEach((title, i) => {
      state.todos.push({ id: uid(), created: Date.now() + 10 + i, title: title.slice(0, 120), due: '', time: '', done: false, weekOf: wk });
      titles.push(title);
    });
    state.weekly[wk] = { win: $('#weekly-win').value.trim().slice(0, 200), lesson: $('#weekly-lesson').value.trim().slice(0, 200), picks: titles, at: Date.now() };
    grow(5);
    save();
    weeklySheet.close();
    render();
    showToast('Your week is set ✨');
    celebrate(true);
  });

  // Clicks inside the Goals tab
  $('#view-goals').addEventListener('click', (e) => {
    const idea = e.target.closest('[data-goal-idea]');
    if (idea) { openGoal(null, GOAL_IDEAS[Number(idea.dataset.goalIdea)]); return; }
    const ed = e.target.closest('[data-goal-edit]');
    if (ed) { openGoal(ed.dataset.goalEdit); return; }
    const st = e.target.closest('[data-goal-step]');
    if (st) {
      const f = findGoalStep(st.dataset.goalStep);
      if (!f) return;
      const now = !f.s.done;
      setStepDone(f.s.id, now);
      const t = linkedTodo(f.s.id);
      if (t && t.done !== now) { t.done = now; t.doneOn = now ? todayKey() : null; }
      save();
      render();
      if (now) { showToast(CHEERS[Math.floor(Math.random() * CHEERS.length)]); celebrate(false); }
      return;
    }
    const td = e.target.closest('[data-goal-todo]');
    if (td && !td.disabled) {
      const f = findGoalStep(td.dataset.goalTodo);
      if (!f) return;
      state.todos.push({ id: uid(), created: Date.now(), title: `${f.g.emoji || '🎯'} ${f.s.title}`, due: '', time: '', done: false, stepId: f.s.id });
      save();
      render();
      showToast('Added to your to-dos 🌷');
      return;
    }
    if (e.target.closest('#weekly-start')) openWeekly();
  });
  $('#today-weekly').addEventListener('click', () => openWeekly());

  // A tiny step from "Break it down" is done
  function doSubStep(todoId, subId) {
    const t = find('todo', todoId);
    if (!t || !Array.isArray(t.steps)) return;
    const s = t.steps.find((x) => x.id === subId);
    if (s) s.done = true;
    if (t.steps.every((x) => x.done)) { if (!t.done) toggleTodo(t.id); return; }
    save();
    render();
    showToast(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    celebrate(false);
  }

  /* ================= Friendly: welcome tour & one add button ================= */
  const TOUR = [
    { e: '👋', t: 'Welcome to your planner', x: 'Your day, goals, journal and cycle in one place. Everything is saved privately on this phone.', name: true },
    { e: '🍒', t: 'Today', x: 'See what\'s next, your routine and your to-dos. The round shortcuts near the top take you to every part of the planner. Swipe them sideways to see more.' },
    { e: '➕', t: 'Add anything with +', x: 'The pink + button at the bottom right adds a to-do, an event, a journal entry or a goal. Or use Brain dump to get everything out of your head at once.' },
    { e: '🎯', t: 'Plan ahead', x: 'Week shows the next 7 days. Goals breaks bigger plans into small steps.' },
    { e: '💜', t: 'Me', x: 'Your journal and cycle. You can lock them with a PIN in ⚙️ Settings, and make text bigger or easier to read there too. Tap 💡 to see why a feature helps.' },
  ];
  const tourEl = $('#tour');
  let tourStep = 0;
  function renderTour() {
    const s = TOUR[tourStep];
    $('#tour-emoji').textContent = s.e;
    $('#tour-title').textContent = s.t;
    $('#tour-text').textContent = s.x;
    $('#tour-name-field').hidden = !s.name;
    $('#tour-count').textContent = `${tourStep + 1} of ${TOUR.length}`;
    $('#tour-dots').innerHTML = TOUR.map((_, i) => `<span class="${i === tourStep ? 'on' : ''}"></span>`).join('');
    $('#tour-next').textContent = tourStep === TOUR.length - 1 ? 'Get started' : 'Next';
  }
  function openTour() {
    tourStep = 0;
    $('#tour-name').value = state.profile.name;
    renderTour();
    tourEl.showModal();
  }
  function finishTour() {
    const n = $('#tour-name').value.trim().slice(0, 30);
    if (n) state.profile.name = n;
    state.profile.toured = true;
    save();
    if (tourEl.open) tourEl.close();
    render();
  }
  $('#tour-next').addEventListener('click', () => {
    if (tourStep < TOUR.length - 1) { tourStep++; renderTour(); return; }
    finishTour();
    celebrate(true);
    showToast(state.profile.name ? `You're all set, ${state.profile.name} ✨` : "You're all set ✨");
  });
  $('#tour-skip').addEventListener('click', finishTour);
  tourEl.addEventListener('cancel', (e) => { e.preventDefault(); finishTour(); });
  $('#tour-again').addEventListener('click', () => { settingsSheet.close(); openTour(); });
  $('#profile-name').addEventListener('change', (e) => { state.profile.name = e.target.value.trim().slice(0, 30); save(); render(); });

  function logPeriodToday() {
    const tk = todayKey();
    const cur = state.cycle.days[tk];
    if (isPeriodDay(cur)) { showToast('Already logged for today 🩸'); return; }
    const prev = state.cycle.days[dateKey(addDays(new Date(), -1))];
    state.cycle.days[tk] = { ...(cur || { symptoms: [], note: '' }), flow: isPeriodDay(prev) ? prev.flow : 'medium' };
    save();
    render();
    showToast('Logged for today 🩸 Be gentle with yourself 💗');
  }

  const addSheet = $('#add-sheet');
  $('#add-fab').addEventListener('click', () => addSheet.showModal());
  $('#add-cancel').addEventListener('click', () => addSheet.close());
  addSheet.addEventListener('click', (e) => {
    if (e.target === addSheet) { addSheet.close(); return; }
    const b = e.target.closest('[data-addwhat]');
    if (!b) return;
    addSheet.close();
    const tk = todayKey();
    const what = b.dataset.addwhat;
    if (what === 'todo') openSheet('todo', null, {});
    else if (what === 'event') openSheet('event', null, { date: tk });
    else if (what === 'dump') openDump();
    else if (what === 'journal') { if (isLocked() && journalEntry(tk)) switchView('journal'); else openJournal(tk); }
    else if (what === 'goal') { switchView('goals'); openGoal(null); }
    else if (what === 'period') logPeriodToday();
    else if (what === 'plant') openGardenEdit(null);
    else if (what === 'plants') openGardenManager();
    else if (what === 'habits') openHabitSheet(!state.habits.length);
    else if (what === 'meals') { weekMode = 'meals'; weekStart = startOfWeek(new Date()); switchView('week'); }
  });

  /* ================= Reading comfort & read aloud ================= */
  function applyReading() {
    const r = state.reading;
    const root = document.documentElement;
    // Bigger text: every font size in the stylesheet is multiplied by --fs
    root.style.setProperty('--fs', String({ m: 1, l: 1.12, xl: 1.25 }[r.size] || 1));
    root.classList.toggle('ts-l', r.size === 'l');
    root.classList.toggle('ts-xl', r.size === 'xl');
    root.classList.toggle('spacious', r.spacing);
    root.classList.toggle('font-verdana', r.font === 'verdana');
    root.classList.toggle('font-atkinson', r.font === 'atkinson');
    if (r.font === 'atkinson' && !document.getElementById('font-atkinson')) {
      const l = document.createElement('link');
      l.id = 'font-atkinson';
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    $$('#reading-size [data-size]').forEach((b) => b.classList.toggle('is-active', b.dataset.size === r.size));
    $$('#reading-font [data-font]').forEach((b) => b.classList.toggle('is-active', b.dataset.font === r.font));
    $('#reading-spacing').checked = r.spacing;
  }
  $('#reading-size').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (!b) return; state.reading.size = b.dataset.size; save(); applyReading(); });
  $('#reading-font').addEventListener('click', (e) => { const b = e.target.closest('[data-font]'); if (!b) return; state.reading.font = b.dataset.font; save(); applyReading(); });
  $('#reading-spacing').addEventListener('change', (e) => { state.reading.spacing = e.target.checked; save(); applyReading(); });
  applyReading();

  // Looks: colours, heading font, tab icons and confetti for each aesthetic
  const LOOKS = {
    cherry: { bg: '#f7f1ec', font: 'Playfair+Display:wght@700;800', icons: ['🍒', '💎', '💋'], confetti: ['🍒', '💋', '✨', '🎀', '💎'] },
    soft: { bg: '#fde8ef', font: '', icons: ['🌼', '🎯', '💜'], confetti: ['✨', '💖', '🌸', '⭐', '🎉'] },
    clean: { bg: '#f6f2ec', font: 'DM+Serif+Display', icons: ['☕', '🤍', '🕊️'], confetti: ['🤍', '✨', '☕', '🕊️', '🌾'] },
    matcha: { bg: '#f2f4ec', font: '', icons: ['🍵', '🌿', '🌱'], confetti: ['🍵', '🌿', '✨', '🍃', '🌼'] },
    y2k: { bg: '#f4f6fb', font: 'Unbounded:wght@600;700', icons: ['🦋', '💿', '💖'], confetti: ['🦋', '💖', '✨', '💿', '⭐'] },
    midnight: { bg: '#0e0d12', font: 'DM+Serif+Display', icons: ['🌙', '⭐', '🖤'], confetti: ['🖤', '✨', '🌙', '⭐', '💜'] },
  };
  function applyLook() {
    const look = LOOKS[state.look] ? state.look : 'cherry';
    const L = LOOKS[look];
    const root = document.documentElement;
    root.setAttribute('data-look', look);
    root.classList.toggle('themed', look !== 'soft');
    if (L.font && !document.getElementById(`font-${look}`)) {
      const l = document.createElement('link');
      l.id = `font-${look}`;
      l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${L.font}&display=swap`;
      document.head.appendChild(l);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', L.bg);
    ['today', 'goals', 'me'].forEach((v, i) => {
      const el = document.querySelector(`.tab[data-view="${v}"] .tab-icon`);
      if (el) el.textContent = L.icons[i];
    });
    $$('#look-pick [data-look]').forEach((b) => {
      const on = b.dataset.look === look;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  $('#look-pick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-look]');
    if (!b) return;
    state.look = b.dataset.look;
    save();
    applyLook();
  });
  applyLook();

  function speak(text) {
    if (!('speechSynthesis' in window)) { showToast('Read aloud isn\'t available on this browser'); return; }
    speechSynthesis.cancel();
    const clean = String(text).replace(/\p{Extended_Pictographic}|️/gu, '').replace(/\s+/g, ' ').trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }
  $('#why-speak').addEventListener('click', () => speak(`${$('#why-title').textContent}. ${$('#why-body').textContent}`));
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-speak-snack]')) speak($('.snack-fact') ? $('.snack-fact').textContent : '');
  });
  $('#why-sheet').addEventListener('close', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });

  /* ================= Plant care ================= */
  // Rough starting points; light, heat, wind, pot size and season all change how fast soil dries.
  const PLANT_TYPES = {
    tomato: { e: '🍅', n: 'Tomato', every: 2, tip: 'Water deeply at the base, not on the leaves. Pots in hot sun can need water every day.' },
    basil: { e: '🌿', n: 'Basil', every: 2, tip: 'Keep the soil lightly moist but never soggy. Water in the morning, at the base.' },
    rosemary: { e: '🌲', n: 'Rosemary', every: 8, tip: 'Let the soil dry out between waterings. Rosemary hates wet roots.' },
    hearts: { e: '💚', n: 'String of hearts', every: 12, tip: 'Water only when the soil is completely dry, and even less in winter. Too much water is the most common problem.' },
    succulent: { e: '🌵', n: 'Cactus or succulent', every: 14, tip: 'Soak it, then let it dry out completely. Water much less in winter.' },
    pothos: { e: '🪴', n: 'Pothos', every: 8, tip: 'Water when the top few centimetres of soil are dry. Droopy leaves mean it is thirsty.' },
    monstera: { e: '🍃', n: 'Monstera', every: 9, tip: 'Water when the top few centimetres are dry. Yellow leaves can mean too much water.' },
    snake: { e: '🐍', n: 'Snake plant', every: 18, tip: 'Very drought-tolerant. Let the soil dry out fully between waterings.' },
    peace: { e: '🤍', n: 'Peace lily', every: 6, tip: 'It droops when thirsty and perks up after a drink. Keep the soil lightly moist.' },
    fern: { e: '🌾', n: 'Fern', every: 3, tip: 'Likes soil that stays slightly moist, and a bit of humidity. Don\'t let it dry out completely.' },
    orchid: { e: '🌸', n: 'Orchid', every: 7, tip: 'Soak the roots for about 10 minutes, then let it drain fully. Never leave it sitting in water.' },
    herb: { e: '🌱', n: 'Other herb', every: 3, tip: 'Most herbs like moist, well-drained soil. Thyme and sage like it a bit drier.' },
    other: { e: '🪴', n: 'Other plant', every: 7, tip: 'Check the soil with your finger: water when the top few centimetres feel dry.' },
  };
  const ptype = (p) => PLANT_TYPES[p.type] || PLANT_TYPES.other;
  const nextDue = (p) => dateKey(addDays(parseKey(p.last || todayKey()), Math.max(1, Number(p.every) || 7)));
  const daysUntilWater = (p) => diffDays(todayKey(), nextDue(p));
  const suggestedEvery = (type, outdoor) => Math.max(1, Math.round((PLANT_TYPES[type] || PLANT_TYPES.other).every * (outdoor ? 0.7 : 1)));

  // Your own photo if there is one, otherwise the plant type's emoji
  function plantPic(p, t, big) {
    const ok = typeof p.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo);
    if (!ok) return `<span class="garden-photo${big ? ' big' : ''}" aria-hidden="true">${t.e}</span>`;
    return `<span class="garden-photo${big ? ' big' : ''}" role="img" aria-label="Photo of ${esc(p.name)}" style="background-image:url('${p.photo}')"><span class="badge" aria-hidden="true">${t.e}</span></span>`;
  }

  // Shrink a photo to a small square so it doesn't fill up the phone's storage
  function shrinkPhoto(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const size = 320;
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  function waterStatus(p) {
    const d = daysUntilWater(p);
    if (d < 0) return `Overdue by ${plural(-d, 'day')}`;
    if (d === 0) return 'Water today';
    if (d === 1) return 'Water tomorrow';
    return `Water in ${d} days`;
  }

  function gardenRow(p, manager) {
    const t = ptype(p);
    const due = daysUntilWater(p) <= 0;
    return `<li class="garden-row${due ? ' due' : ''}">
      ${plantPic(p, t)}
      <span class="garden-text"><b>${esc(p.name)}</b><small>${esc([p.name.toLowerCase() === t.n.toLowerCase() ? '' : t.n, p.outdoor ? 'Outdoors' : ''].filter(Boolean).join(', '))}${p.name.toLowerCase() === t.n.toLowerCase() && !p.outdoor ? '' : '\n'}💧 ${esc(waterStatus(p))}</small></span>
      <span class="garden-btns">
        ${due || manager ? `<button class="btn primary garden-water" type="button" data-water="${esc(p.id)}">💧 Watered</button>` : ''}
        ${manager ? `<button class="link-btn" type="button" data-garden-edit="${esc(p.id)}">Edit</button>` : ''}
      </span></li>`;
  }

  function renderGardenCard() {
    const card = $('#garden-card');
    if (!state.plants.length) { card.hidden = true; return; }
    card.hidden = false;
    const due = state.plants.filter((p) => daysUntilWater(p) <= 0).sort((a, b) => daysUntilWater(a) - daysUntilWater(b));
    let body;
    if (due.length) body = `<ul class="garden-list">${due.map((p) => gardenRow(p, false)).join('')}</ul>`;
    else {
      const next = [...state.plants].sort((a, b) => nextDue(a).localeCompare(nextDue(b)))[0];
      const d = daysUntilWater(next);
      body = `<p class="garden-ok">All watered 🌿\nNext: ${esc(next.name)} ${d === 1 ? 'tomorrow' : `in ${d} days`}</p>`;
    }
    card.innerHTML = `<div class="garden-head"><h2>🪴 Plants ${whyBtn('plants')}</h2>
      <button class="link-btn" type="button" data-garden-manage>See all</button></div>${body}`;
  }

  function plantsDueOn(key) {
    const tk = todayKey();
    if (key < tk) return [];
    return state.plants.filter((p) => {
      const every = Math.max(1, Number(p.every) || 7);
      let d = nextDue(p);
      if (d < tk) d = tk; // overdue plants show up today
      const gap = diffDays(d, key);
      return gap >= 0 && gap % every === 0;
    });
  }

  function renderGardenManager() {
    $('#garden-list').innerHTML = state.plants.length
      ? [...state.plants].sort((a, b) => nextDue(a).localeCompare(nextDue(b))).map((p) => gardenRow(p, true)).join('')
      : '<li class="empty">No plants yet. Add your first one 🌱</li>';
  }

  function waterPlant(id) {
    const p = state.plants.find((x) => x.id === id);
    if (!p) return;
    p.last = todayKey();
    p.gRemindDirty = true;
    grow(1);
    save();
    render();
    if (gardenSheet.open) renderGardenManager();
    showToast(`${p.name} says thank you 💧`);
    celebrate(false);
    if (p.remind) googlePush(true);
  }

  // ---- manager & editor ----
  const gardenSheet = $('#garden-sheet');
  const gardenEdit = $('#garden-edit');
  let editingPlant = null;
  let everyTouched = false;
  $('#garden-type').innerHTML = Object.entries(PLANT_TYPES).map(([k, t]) => `<option value="${k}">${t.e} ${t.n}</option>`).join('');

  function openGardenManager() { renderGardenManager(); gardenSheet.showModal(); }

  function updateGardenTip() {
    const type = $('#garden-type').value;
    if (!everyTouched) $('#garden-every').value = suggestedEvery(type, $('#garden-outdoor').checked);
    $('#garden-tip').textContent = `💡 ${PLANT_TYPES[type].tip}`;
  }

  function openGardenEdit(id) {
    const p = id ? state.plants.find((x) => x.id === id) : null;
    editingPlant = p ? p.id : null;
    everyTouched = !!p;
    $('#garden-edit-title').textContent = p ? 'Edit plant' : 'New plant';
    $('#garden-name').value = p ? p.name : '';
    $('#garden-type').value = p && PLANT_TYPES[p.type] ? p.type : 'other';
    $('#garden-outdoor').checked = p ? !!p.outdoor : false;
    $('#garden-every').value = p ? p.every : suggestedEvery('other', false);
    $('#garden-last').value = p ? p.last : todayKey();
    $('#garden-remind-field').hidden = !state.google.connected;
    $('#garden-remind').value = p && p.remind ? p.remind : '';
    $('#garden-remind-hint').textContent = state.google.connected
      ? 'Optional. You\'ll get a Google Calendar notification on watering days.'
      : '🔔 Want watering notifications? Connect Google Calendar in ⚙️ Settings → Extras.';
    $('#garden-delete').hidden = !p;
    editingPhoto = p && p.photo ? p.photo : '';
    updatePhotoPreview();
    updateGardenTip();
    gardenEdit.showModal();
  }

  let editingPhoto = '';
  function updatePhotoPreview() {
    const t = PLANT_TYPES[$('#garden-type').value] || PLANT_TYPES.other;
    $('#garden-photo-preview').outerHTML = plantPic({ name: $('#garden-name').value || t.n, photo: editingPhoto }, t, true)
      .replace('class="garden-photo', 'id="garden-photo-preview" class="garden-photo');
    $('#garden-photo-label').textContent = editingPhoto ? 'Change photo' : 'Add photo';
    $('#garden-photo-remove').hidden = !editingPhoto;
  }
  $('#garden-photo-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      editingPhoto = await shrinkPhoto(file);
      updatePhotoPreview();
    } catch (err) {
      showToast("Couldn't open that photo. Try another one?");
    }
  });
  $('#garden-photo-remove').addEventListener('click', () => { editingPhoto = ''; updatePhotoPreview(); });
  $('#garden-type').addEventListener('change', () => { everyTouched = false; updateGardenTip(); updatePhotoPreview(); });
  $('#garden-outdoor').addEventListener('change', () => { everyTouched = false; updateGardenTip(); });
  $('#garden-every').addEventListener('input', () => { everyTouched = true; });
  $('#garden-cancel').addEventListener('click', () => gardenEdit.close());
  $('#garden-done').addEventListener('click', () => gardenSheet.close());
  $('#garden-add').addEventListener('click', () => openGardenEdit(null));
  gardenEdit.addEventListener('click', (e) => { if (e.target === gardenEdit) gardenEdit.close(); });
  gardenSheet.addEventListener('click', (e) => { if (e.target === gardenSheet) gardenSheet.close(); });

  $('#garden-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = $('#garden-type').value;
    const data = {
      name: ($('#garden-name').value.trim() || PLANT_TYPES[type].n).slice(0, 40),
      type,
      outdoor: $('#garden-outdoor').checked,
      every: Math.min(60, Math.max(1, Math.round(Number($('#garden-every').value) || PLANT_TYPES[type].every))),
      last: /^\d{4}-\d{2}-\d{2}$/.test($('#garden-last').value) ? $('#garden-last').value : todayKey(),
      remind: state.google.connected && /^\d\d:\d\d$/.test($('#garden-remind').value) ? $('#garden-remind').value : '',
      photo: editingPhoto,
      gRemindDirty: true,
    };
    const old = editingPlant ? state.plants.find((x) => x.id === editingPlant) : null;
    if (old) Object.assign(old, data); else state.plants.push({ id: uid(), created: Date.now(), ...data });
    save();
    gardenEdit.close();
    render();
    if (gardenSheet.open) renderGardenManager();
    showToast(old ? 'Plant saved 🪴' : `${data.name} added 🌱`);
    if (state.google.connected) googlePush(true);
  });

  $('#garden-delete').addEventListener('click', () => {
    const p = state.plants.find((x) => x.id === editingPlant);
    if (!p || !confirm(`Remove ${p.name} from your plants?`)) return;
    if (p.gEvId) state.google.pendingDeletes.push(p.gEvId);
    state.plants = state.plants.filter((x) => x.id !== p.id);
    save();
    gardenEdit.close();
    render();
    if (gardenSheet.open) renderGardenManager();
    googlePush(true);
  });

  document.addEventListener('click', (e) => {
    const w = e.target.closest('[data-water]');
    if (w) { waterPlant(w.dataset.water); return; }
    const ed = e.target.closest('[data-garden-edit]');
    if (ed) { openGardenEdit(ed.dataset.gardenEdit); return; }
    if (e.target.closest('[data-garden-manage]')) openGardenManager();
  });

  // Google Calendar reminder for the next watering day
  const wantsWaterReminder = (p) => !!p.remind && state.google.connected;
  function waterReminderBody(p) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let day = nextDue(p);
    if (day < todayKey()) day = todayKey();
    const [h, m] = p.remind.split(':').map(Number);
    const end = parseKey(day);
    end.setHours(h, m + 15);
    return {
      summary: `💧 Water ${p.name}`,
      description: ptype(p).tip,
      start: { dateTime: `${day}T${p.remind}:00`, timeZone },
      end: { dateTime: `${dateKey(end)}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`, timeZone },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    };
  }
  async function pushPlantReminders() {
    for (const p of state.plants) {
      if (wantsWaterReminder(p)) {
        if (!p.gRemindDirty && p.gEvId) continue;
        if (p.gEvId) {
          try {
            await gApi(`/calendars/primary/events/${encodeURIComponent(p.gEvId)}`, { method: 'PATCH', body: waterReminderBody(p) });
          } catch (e) {
            if (e.status !== 404 && e.status !== 410) throw e;
            p.gEvId = null;
          }
        }
        if (!p.gEvId) {
          const r = await gApi('/calendars/primary/events', { method: 'POST', body: waterReminderBody(p) });
          p.gEvId = r.id;
        }
        p.gRemindDirty = false;
        save();
      } else if (p.gEvId) {
        try {
          await gApi(`/calendars/primary/events/${encodeURIComponent(p.gEvId)}`, { method: 'DELETE' });
        } catch (e) {
          if (e.status !== 404 && e.status !== 410) throw e;
        }
        p.gEvId = null;
        p.gRemindDirty = false;
        save();
      }
    }
  }

  /* ================= Smart typing: "Call Mum Friday 3pm", "Bins every Thursday" ================= */
  const WD_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const END = '(?=[\\s,.!?]|$)';
  function dayIndex(w) {
    const x = w.toLowerCase().slice(0, 3);
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(x);
  }
  function upcoming(dow, allowToday) {
    let d = parseKey(todayKey());
    if (!allowToday) d = addDays(d, 1);
    while (d.getDay() !== dow) d = addDays(d, 1);
    return d;
  }
  function dayMonth(day, monthIdx) {
    const now = parseKey(todayKey());
    let d = new Date(now.getFullYear(), monthIdx, day);
    if (d.getMonth() !== monthIdx) return '';
    if (d < now) d = new Date(now.getFullYear() + 1, monthIdx, day);
    return dateKey(d);
  }

  function parseQuick(text) {
    let s = ` ${text} `;
    let due = '';
    let time = '';
    let repeat = '';
    const take = (re) => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };
    const SHORT = '(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)';
    const FULL = '(monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
    let m;
    // Repeats
    if ((m = take(new RegExp(`\\s(every\\s?day|daily)${END}`, 'i')))) repeat = 'daily';
    else if ((m = take(new RegExp(`\\s(every\\s+weekday|weekdays)${END}`, 'i')))) repeat = 'weekdays';
    else if ((m = take(new RegExp(`\\severy\\s+${FULL}${END}`, 'i'))) || (m = take(new RegExp(`\\severy\\s+${SHORT}${END}`, 'i')))) {
      repeat = 'weekly';
      due = dateKey(upcoming(dayIndex(m[1]), true));
    } else if ((m = take(new RegExp(`\\s(every\\s+week|weekly)${END}`, 'i')))) repeat = 'weekly';
    else if ((m = take(new RegExp(`\\s(every\\s+month|monthly)${END}`, 'i')))) repeat = 'monthly';
    // Time
    if ((m = take(new RegExp(`\\s(?:at\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s?(am|pm)${END}`, 'i')))) {
      const h = (Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
      time = `${pad(h)}:${pad(Number(m[2] || 0))}`;
    } else if ((m = take(new RegExp(`\\s(?:at\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)${END}`)))) time = `${pad(Number(m[1]))}:${m[2]}`;
    else if ((m = take(new RegExp(`\\s(?:at\\s+)?noon${END}`, 'i')))) time = '12:00';
    // Dates
    if (!due) {
      if ((m = take(new RegExp(`\\s(today|tonight)${END}`, 'i')))) {
        due = todayKey();
        if (m[1].toLowerCase() === 'tonight' && !time) time = '20:00';
      } else if ((m = take(new RegExp(`\\s(tomorrow|tmrw|tmr)${END}`, 'i')))) due = dateKey(addDays(new Date(), 1));
      else if ((m = take(new RegExp(`\\sin\\s+(\\d{1,2})\\s+days?${END}`, 'i')))) due = dateKey(addDays(new Date(), Number(m[1])));
      else if ((m = take(new RegExp(`\\s(next\\s+week|in\\s+a\\s+week)${END}`, 'i')))) due = dateKey(addDays(new Date(), 7));
      else if ((m = take(new RegExp(`\\s(?:(?:on|this|next)\\s+)?${FULL}${END}`, 'i'))) || (m = take(new RegExp(`\\s(?:on|this|next)\\s+${SHORT}${END}`, 'i')))) {
        due = dateKey(upcoming(dayIndex(m[1]), false));
      } else if ((m = take(new RegExp(`\\s(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MON3.join('|')})[a-z]*${END}`, 'i')))) {
        due = dayMonth(Number(m[1]), MON3.indexOf(m[2].toLowerCase().slice(0, 3)));
      } else if ((m = take(new RegExp(`\\s(?:on\\s+)?(${MON3.join('|')})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?${END}`, 'i')))) {
        due = dayMonth(Number(m[2]), MON3.indexOf(m[1].toLowerCase().slice(0, 3)));
      } else if ((m = take(new RegExp(`\\s(?:on\\s+)?(\\d{1,2})\\/(\\d{1,2})${END}`)))) {
        due = dayMonth(Number(m[1]), Number(m[2]) - 1); // day/month, the NZ way
      }
    }
    if ((repeat || time) && !due) due = todayKey();
    let title = s.replace(/\s+/g, ' ').trim().replace(/\s+(at|on|by|every)$/i, '').replace(/^(at|on)\s+/i, '').trim();
    if (!title) title = text.trim();
    return { title: title.slice(0, 120), due, time, repeat };
  }

  function describeParsed(q) {
    const bits = [];
    if (q.due) bits.push(`📅 ${relDay(q.due)}${q.time ? `, ${fmtTime(q.time)}` : ''}`);
    if (q.repeat) bits.push(`🔁 ${REPEATS[q.repeat]}`);
    return bits.join('   ');
  }

  /* ================= Repeating to-dos ================= */
  function nextRepeatDate(t) {
    const anchorDay = parseKey(t.due || todayKey()).getDate();
    const step = (d) => {
      if (t.repeat === 'daily') return addDays(d, 1);
      if (t.repeat === 'weekdays') { let x = addDays(d, 1); while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1); return x; }
      if (t.repeat === 'weekly') return addDays(d, 7);
      if (t.repeat === 'monthly') {
        const x = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
        x.setDate(Math.min(anchorDay, last));
        return x;
      }
      return null;
    };
    const today = parseKey(todayKey());
    let d = step(parseKey(t.due || todayKey()));
    for (let i = 0; d && d <= today && i < 400; i++) d = step(d);
    return d ? dateKey(d) : '';
  }

  // Called when a to-do is ticked or unticked. Returns the next date if a new copy was made.
  function handleRepeat(t) {
    if (t.done && t.repeat && REPEATS[t.repeat] && !t.nextId) {
      const nd = nextRepeatDate(t);
      if (!nd) return '';
      const copy = {
        ...t,
        id: uid(),
        created: Date.now(),
        done: false,
        doneOn: null,
        due: nd,
        gEvId: null,
        gRemindDirty: true,
        nextId: null,
        stepId: undefined,
        weekOf: undefined,
        steps: Array.isArray(t.steps) ? t.steps.map((s) => ({ id: uid(), title: s.title, done: false })) : [],
      };
      state.todos.push(copy);
      t.nextId = copy.id;
      return nd;
    }
    if (!t.done && t.nextId) {
      const c = find('todo', t.nextId);
      if (c && !c.done) {
        if (c.gEvId) state.google.pendingDeletes.push(c.gEvId);
        state.todos = state.todos.filter((x) => x.id !== c.id);
      }
      t.nextId = null;
    }
    return '';
  }

  /* ================= Habit tracker ================= */
  const HABIT_IDEAS = ['💧 Drink water', '💊 Vitamins', '🚶 Move for 20 minutes', '📖 Read for 10 minutes', '🧴 Skincare', '📵 No phone in bed'];
  const habitSheet = $('#habit-sheet');
  let habitMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const habitDone = (id, key) => Array.isArray(state.habitLog[key]) && state.habitLog[key].includes(id);

  function habitStreak(id) {
    let n = 0;
    let misses = 0;
    let d = new Date();
    if (!habitDone(id, todayKey())) d = addDays(d, -1);
    for (let i = 0; i < 400; i++) {
      if (habitDone(id, dateKey(d))) { n++; misses = 0; } else if (++misses >= 2) break; // one missed day is OK
      d = addDays(d, -1);
    }
    return n;
  }

  function toggleHabit(id) {
    const k = todayKey();
    const list = Array.isArray(state.habitLog[k]) ? state.habitLog[k].slice() : [];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    state.habitLog[k] = list;
    grow(i >= 0 ? -1 : 1);
    save();
    render();
    if (habitSheet.open) renderHabitSheet();
    if (i < 0) {
      const all = state.habits.every((h) => list.includes(h.id));
      showToast(all ? 'Every habit done today ✨' : CHEERS[Math.floor(Math.random() * CHEERS.length)]);
      celebrate(all);
    }
  }

  function renderHabitCard() {
    const card = $('#habit-card');
    if (!state.habits.length) { card.hidden = true; return; }
    card.hidden = false;
    const k = todayKey();
    const done = state.habits.filter((h) => habitDone(h.id, k)).length;
    card.innerHTML = `<div class="garden-head"><h2>✨ Habits ${whyBtn('habits')}</h2>
      <button class="link-btn" type="button" data-habit-open>See month</button></div>
      <p class="habit-sub">${done} of ${state.habits.length} done today</p>
      <div class="habit-chips">${state.habits.map((h) => {
        const on = habitDone(h.id, k);
        return `<button class="habit-chip${on ? ' on' : ''}" type="button" data-habit="${esc(h.id)}" aria-pressed="${on}"><span class="tick" aria-hidden="true">✓</span>${esc(h.title)}</button>`;
      }).join('')}</div>`;
  }

  function renderHabitSheet() {
    const first = habitMonth;
    const now = new Date();
    $('#habit-month-label').textContent = first.toLocaleDateString([], { month: 'long', year: 'numeric' });
    $('#habit-month-today').hidden = first.getFullYear() === now.getFullYear() && first.getMonth() === now.getMonth();
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday first
    const tk = todayKey();
    const dows = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(startOfWeek(new Date()), i).toLocaleDateString([], { weekday: 'narrow' }));
    $('#habit-months').innerHTML = state.habits.length ? state.habits.map((h) => {
      let count = 0;
      let cells = dows.map((d) => `<span class="hm-dow">${esc(d)}</span>`).join('') + '<span></span>'.repeat(lead);
      for (let day = 1; day <= daysIn; day++) {
        const key = dateKey(new Date(first.getFullYear(), first.getMonth(), day));
        const on = habitDone(h.id, key);
        if (on) count++;
        cells += `<span class="hm-day${on ? ' on' : ''}${key === tk ? ' today' : ''}${key > tk ? ' future' : ''}" title="${esc(fmtDate(key, { day: 'numeric', month: 'short' }))}${on ? ': done' : ''}">${day}</span>`;
      }
      const streak = habitStreak(h.id);
      return `<div class="habit-month"><h3>${esc(h.title)}</h3>
        <p class="habit-sub">${count} of ${daysIn} days${streak ? `\n🔥 ${streak}-day streak` : ''}</p>
        <div class="hm-grid" role="img" aria-label="${esc(h.title)}: done on ${count} days this month">${cells}</div></div>`;
    }).join('') : '';
    const editing = !state.habits.length || !$('#habit-edit').hidden;
    $('#habit-edit').hidden = !editing;
    $('#habit-ideas').innerHTML = HABIT_IDEAS.filter((x) => !state.habits.some((h) => h.title === x))
      .map((x) => `<button class="chip" type="button" data-habit-idea="${esc(x)}">${esc(x)}</button>`).join('');
  }

  function openHabitSheet(edit) {
    habitMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    $('#habit-edit').hidden = !edit && state.habits.length > 0;
    $('#habit-text').value = state.habits.map((h) => h.title).join('\n');
    renderHabitSheet();
    habitSheet.showModal();
  }

  $('#habit-prev').addEventListener('click', () => { habitMonth = new Date(habitMonth.getFullYear(), habitMonth.getMonth() - 1, 1); renderHabitSheet(); });
  $('#habit-next').addEventListener('click', () => { habitMonth = new Date(habitMonth.getFullYear(), habitMonth.getMonth() + 1, 1); renderHabitSheet(); });
  $('#habit-month-today').addEventListener('click', () => { habitMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderHabitSheet(); });
  $('#habit-edit-btn').addEventListener('click', () => {
    $('#habit-edit').hidden = false;
    $('#habit-text').value = state.habits.map((h) => h.title).join('\n');
    renderHabitSheet();
    $('#habit-text').focus();
  });
  $('#habit-ideas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-habit-idea]');
    if (!b) return;
    const t = $('#habit-text');
    t.value = (t.value.trim() ? `${t.value.trim()}\n` : '') + b.dataset.habitIdea;
    b.remove();
  });
  $('#habit-save').addEventListener('click', () => {
    const lines = $('#habit-text').value.split('\n').map((x) => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).slice(0, 10);
    state.habits = lines.map((title) => state.habits.find((h) => h.title === title) || { id: uid(), title: title.slice(0, 50) });
    save();
    $('#habit-edit').hidden = state.habits.length > 0;
    renderHabitSheet();
    render();
    showToast(state.habits.length ? 'Habits saved ✨' : 'Habits cleared');
  });
  $('#habit-done').addEventListener('click', () => habitSheet.close());
  habitSheet.addEventListener('click', (e) => { if (e.target === habitSheet) habitSheet.close(); });
  document.addEventListener('click', (e) => {
    const h = e.target.closest('[data-habit]');
    if (h) { toggleHabit(h.dataset.habit); return; }
    if (e.target.closest('[data-habit-open]')) openHabitSheet(false);
  });

  /* ================= Month view (Week tab) ================= */
  let weekMode = 'week';
  let monthView = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  function renderMonthView() {
    const first = monthView;
    const now = new Date();
    $('#mv-label').textContent = first.toLocaleDateString([], { month: 'long', year: 'numeric' });
    $('#mv-today').hidden = first.getFullYear() === now.getFullYear() && first.getMonth() === now.getMonth();
    TITLES.week = 'Month';
    const gridStart = startOfWeek(first);
    const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const gridEnd = addDays(startOfWeek(lastOfMonth), 6);
    const tk = todayKey();
    let html = '';
    for (let i = 0; i < 7; i++) html += `<div class="cal-dow" aria-hidden="true">${esc(addDays(gridStart, i).toLocaleDateString([], { weekday: 'narrow' }))}</div>`;
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      const key = dateKey(d);
      const items = dayEventItems(key);
      const todos = allTodos().filter((t) => t.due === key && !t.done).length;
      const dots = items.slice(0, 4).map(() => '<i></i>').join('');
      const label = `${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}: ${plural(items.length, 'event')}${todos ? `, ${plural(todos, 'to-do')}` : ''}`;
      html += `<button type="button" class="mv-day${d.getMonth() !== first.getMonth() ? ' out' : ''}${key === tk ? ' today' : ''}" data-mday="${key}" aria-label="${esc(label)}">
        <span class="mv-num">${d.getDate()}</span><span class="mv-dots">${dots}</span>${todos ? `<span class="mv-todo">✓${todos}</span>` : ''}</button>`;
    }
    $('#mv-cal').innerHTML = html;
  }

  $('.week-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wmode]');
    if (!b) return;
    weekMode = b.dataset.wmode;
    if (weekMode === 'month') monthView = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    render();
  });
  $('#mv-prev').addEventListener('click', () => { monthView = new Date(monthView.getFullYear(), monthView.getMonth() - 1, 1); render(); });
  $('#mv-next').addEventListener('click', () => { monthView = new Date(monthView.getFullYear(), monthView.getMonth() + 1, 1); render(); });
  $('#mv-today').addEventListener('click', () => { monthView = new Date(new Date().getFullYear(), new Date().getMonth(), 1); render(); });
  $('#mv-cal').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mday]');
    if (!b) return;
    weekMode = 'week';
    weekStart = startOfWeek(parseKey(b.dataset.mday));
    render();
    const el = document.getElementById(`day-${b.dataset.mday}`);
    if (el) el.scrollIntoView({ block: 'start' });
  });

  /* ================= Year in pixels (Journal) ================= */
  function renderPixels() {
    const year = new Date().getFullYear();
    const tk = todayKey();
    let html = '<span></span>';
    for (let d = 1; d <= 31; d++) html += `<span class="px-head">${d % 5 === 0 || d === 1 ? d : ''}</span>`;
    let logged = 0;
    for (let mo = 0; mo < 12; mo++) {
      html += `<span class="px-month">${esc(new Date(year, mo, 1).toLocaleDateString([], { month: 'narrow' }))}</span>`;
      for (let d = 1; d <= 31; d++) {
        const date = new Date(year, mo, d);
        if (date.getMonth() !== mo) { html += '<span class="px none"></span>'; continue; }
        const key = dateKey(date);
        const mood = moodOf(journalEntry(key));
        if (mood) logged++;
        html += `<span class="px${mood ? ` m${mood}` : ''}${key > tk ? ' future' : ''}"${mood ? ` title="${esc(fmtDate(key, { day: 'numeric', month: 'short' }))}: ${MOODS[mood][1]}"` : ''}></span>`;
      }
    }
    $('#pixels').innerHTML = html;
    $('#pixels').setAttribute('aria-label', `Year in pixels for ${year}: mood logged on ${plural(logged, 'day')}`);
    $('#pixels-year').textContent = String(year);
  }

  const QUICK_TIP = 'Tip: type “Call Mum Friday 3pm” or “Bins every Thursday” and the date fills in for you.';
  $('#quick-tip').textContent = QUICK_TIP;
  $('#quick-title').addEventListener('input', () => {
    const v = $('#quick-title').value.trim();
    const q = v ? parseQuick(v) : null;
    const d = q ? describeParsed(q) : '';
    $('#quick-tip').textContent = d ? `${d}\n✍️ ${q.title}` : QUICK_TIP;
  });

  /* ================= Meal planner & shopping list ================= */
  const MEAL_SLOTS = { b: ['🍳', 'Breakfast'], l: ['🥪', 'Lunch'], d: ['🍝', 'Dinner'] };
  const mealDay = (key) => (state.meals[key] && typeof state.meals[key] === 'object' ? state.meals[key] : {});
  const mealSheet = $('#meal-sheet');
  let editingMeal = null; // { key, slot }

  function renderMeals() {
    const end = addDays(weekStart, 6);
    $('#meals-range').textContent = `${weekStart.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
    $('#meals-today').hidden = dateKey(weekStart) === dateKey(startOfWeek(new Date()));
    TITLES.week = 'Meals';
    $$('#meal-show [data-mshow]').forEach((b) => b.classList.toggle('is-active', b.dataset.mshow === state.mealShow));
    const slots = state.mealShow === 'all' ? ['b', 'l', 'd'] : ['d'];
    const tk = todayKey();
    let html = '';
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const key = dateKey(day);
      const m = mealDay(key);
      const rel = relDay(key);
      const label = ['Today', 'Tomorrow', 'Yesterday'].includes(rel) ? `${rel}, ${day.toLocaleDateString([], { day: 'numeric', month: 'short' })}` : day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
      html += `<section class="meal-day${key === tk ? ' is-today' : ''}"><h3>${esc(label)}</h3>${slots.map((s) => {
        const [emoji, name] = MEAL_SLOTS[s];
        const val = typeof m[s] === 'string' ? m[s] : '';
        return `<button class="meal-row${val ? ' set' : ''}" type="button" data-meal="${key}|${s}" aria-label="${esc(name)} on ${esc(label)}: ${esc(val || 'not planned')}">
          <span class="meal-emoji" aria-hidden="true">${emoji}</span>
          <span class="meal-text"><small>${name}</small>${val ? esc(val) : '<span class="empty-txt">Tap to plan</span>'}</span></button>`;
      }).join('')}</section>`;
    }
    $('#meal-days').innerHTML = html;
    renderMealLib();
    renderShopping();
  }

  function renderShopping() {
    const items = state.shopping;
    $('#shop-list').innerHTML = items.length
      ? items.map((it) => `<li><button class="routine-step${it.done ? ' done' : ''}" type="button" data-shop="${esc(it.id)}" aria-pressed="${it.done}">
          <span class="tick" aria-hidden="true">✓</span><span>${esc(it.title)}</span></button></li>`).join('')
      : '<li class="empty">Your shopping list is empty 🛒</li>';
    $('#shop-clear').hidden = !items.some((it) => it.done);
  }

  function addShopping(lines) {
    let added = 0;
    lines.map((x) => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).forEach((title) => {
      if (state.shopping.some((it) => !it.done && it.title.toLowerCase() === title.toLowerCase())) return;
      state.shopping.push({ id: uid(), title: title.slice(0, 80), done: false });
      added++;
    });
    return added;
  }

  function mealSuggestions() {
    const recent = [];
    Object.keys(state.meals).sort().reverse().slice(0, 40).forEach((k) => {
      Object.values(mealDay(k)).forEach((v) => { if (typeof v === 'string' && v && !recent.includes(v)) recent.push(v); });
    });
    const favs = state.mealFavs.filter((f) => typeof f === 'string');
    const lib = state.mealLib.map((m) => m.name).filter((n) => !favs.includes(n) && !recent.includes(n)).sort();
    return [...favs.map((f) => ({ t: f, fav: true })), ...recent.filter((r) => !favs.includes(r)).map((r) => ({ t: r, fav: false })),
      ...lib.map((n) => ({ t: n, fav: false }))].slice(0, 24);
  }

  function openMeal(key, slot) {
    editingMeal = { key, slot };
    const [emoji, name] = MEAL_SLOTS[slot];
    const rel = relDay(key);
    $('#meal-title').textContent = `${emoji} ${name}\n${['Today', 'Tomorrow', 'Yesterday'].includes(rel) ? rel : fmtDate(key, { weekday: 'long', day: 'numeric', month: 'short' })}`;
    const val = mealDay(key)[slot] || '';
    $('#meal-text').value = val;
    $('#meal-mins').value = val && libFind(val) && libFind(val).mins ? libFind(val).mins : '';
    $('#meal-fav').checked = !!val && state.mealFavs.includes(val);
    $('#meal-ingredients').value = '';
    $('#meal-clear').hidden = !val;
    const sugg = mealSuggestions();
    $('#meal-favs-wrap').hidden = !sugg.length;
    $('#meal-favs').innerHTML = sugg.map((s) => {
      const lib = libFind(s.t);
      return `<button class="chip" type="button" data-meal-pick="${esc(s.t)}">${s.fav ? '⭐ ' : ''}${esc(s.t)}${lib && lib.mins ? ` (${esc(fmtMins(lib.mins))})` : ''}</button>`;
    }).join('');
    mealSheet.showModal();
  }

  $('#meal-favs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-meal-pick]');
    if (!b) return;
    $('#meal-text').value = b.dataset.mealPick;
    $('#meal-fav').checked = state.mealFavs.includes(b.dataset.mealPick);
    const lib = libFind(b.dataset.mealPick);
    $('#meal-mins').value = lib && lib.mins ? lib.mins : '';
  });
  $('#meal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingMeal) return;
    const { key, slot } = editingMeal;
    const text = $('#meal-text').value.trim().slice(0, 80);
    const day = { ...mealDay(key) };
    if (text) day[slot] = text; else delete day[slot];
    if (Object.keys(day).length) state.meals[key] = day; else delete state.meals[key];
    if (text && $('#meal-fav').checked && !state.mealFavs.includes(text)) state.mealFavs = [text, ...state.mealFavs].slice(0, 30);
    if (text && !$('#meal-fav').checked) state.mealFavs = state.mealFavs.filter((f) => f !== text);
    const ingr = $('#meal-ingredients').value.split('\n').map((x) => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean);
    if (text) saveToLib(text, $('#meal-mins').value, ingr);
    const added = addShopping($('#meal-ingredients').value.split('\n'));
    // keep about a year of meal history
    const cutoff = dateKey(addDays(new Date(), -370));
    Object.keys(state.meals).forEach((k) => { if (k < cutoff) delete state.meals[k]; });
    save();
    mealSheet.close();
    render();
    showToast(added ? `Saved, and ${plural(added, 'item')} added to your shopping list 🛒` : text ? 'Meal planned 🍽️' : 'Meal cleared');
  });
  $('#meal-clear').addEventListener('click', () => { $('#meal-text').value = ''; $('#meal-form').requestSubmit(); });
  $('#meal-cancel').addEventListener('click', () => mealSheet.close());
  mealSheet.addEventListener('click', (e) => { if (e.target === mealSheet) mealSheet.close(); });
  mealSheet.addEventListener('close', () => { editingMeal = null; });

  $('#meals-mode').addEventListener('click', (e) => {
    const m = e.target.closest('[data-meal]');
    if (m) { const [key, slot] = m.dataset.meal.split('|'); openMeal(key, slot); return; }
    const sh = e.target.closest('[data-shop]');
    if (sh) {
      const it = state.shopping.find((x) => x.id === sh.dataset.shop);
      if (it) { it.done = !it.done; save(); renderShopping(); if (it.done) celebrate(false); }
      return;
    }
    const ms = e.target.closest('[data-mshow]');
    if (ms) { state.mealShow = ms.dataset.mshow; save(); render(); }
  });
  $('#shop-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#shop-text').value.trim();
    if (!v) return;
    addShopping(v.split(/,|\n/));
    $('#shop-text').value = '';
    save();
    renderShopping();
  });
  $('#shop-clear').addEventListener('click', () => {
    state.shopping = state.shopping.filter((it) => !it.done);
    save();
    renderShopping();
    showToast('Ticked items cleared 🛒');
  });
  $('#meals-prev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); render(); });
  $('#meals-next').addEventListener('click', () => { weekStart = addDays(weekStart, 7); render(); });
  $('#meals-today').addEventListener('click', () => { weekStart = startOfWeek(new Date()); render(); });

  /* ================= Shortcut emblems on Today ================= */
  function emblemData() {
    const tk = todayKey();
    const pendingTodos = todaysTodos().filter((t) => !t.done).length;
    const habitsDone = state.habits.filter((h) => habitDone(h.id, tk)).length;
    const plantsDue = state.plants.filter((p) => daysUntilWater(p) <= 0).length;
    const eventsToday = dayEvents(tk).length;
    const dinner = mealDay(tk).d;
    const wroteToday = !!journalEntry(tk);
    const weeklyDone = !!state.weekly[targetWeek()];
    const ph = state.cycle.showOnToday ? cycleModel(tk).phaseFor(tk) : null;
    return [
      { go: 'todos', e: '✅', n: 'To-do', b: pendingTodos || '', alert: false, say: pendingTodos ? `${pendingTodos} left today` : '' },
      { go: 'week', e: '🗓️', n: 'Week', b: eventsToday || '', soft: true, say: eventsToday ? `${plural(eventsToday, 'event')} today` : '' },
      { go: 'month', e: '📅', n: 'Month' },
      { go: 'meals', e: '🍽️', n: 'Meals', b: dinner ? '✓' : '', soft: true, say: dinner ? `Dinner: ${dinner}` : 'Dinner not planned' },
      { go: 'habits', e: '✨', n: 'Habits', b: state.habits.length ? `${habitsDone}/${state.habits.length}` : '', soft: habitsDone === state.habits.length, say: state.habits.length ? `${habitsDone} of ${state.habits.length} done` : 'Not set up yet' },
      { go: 'plants', e: '🪴', n: 'Plants', b: plantsDue ? `💧${plantsDue}` : '', alert: plantsDue > 0, say: plantsDue ? `${plantsDue} need water` : '' },
      { go: 'goals', e: '💎', n: 'Goals', b: state.goals.length || '', soft: true, say: state.goals.length ? plural(state.goals.length, 'goal') : '' },
      { go: 'journal', e: '📓', n: 'Journal', b: wroteToday ? '✓' : '', soft: true, say: wroteToday ? 'Written today' : '' },
      { go: 'cycle', e: '🌙', n: 'Cycle', b: ph ? ph.day : '', soft: true, say: ph ? `Cycle day ${ph.day}` : '' },
      { go: 'focus', e: '🎯', n: 'Focus' },
      { go: 'dump', e: '🧠', n: 'Brain dump' },
      { go: 'weekly', e: '🔄', n: 'Weekly reset', b: weeklyDone ? '✓' : '', soft: true, say: weeklyDone ? 'Done this week' : '' },
      { go: 'settings', e: '⚙️', n: 'Settings' },
    ];
  }

  function renderEmblems() {
    $('#emblems').innerHTML = emblemData().map((x) => `<button class="emblem${x.alert ? ' alert' : ''}" type="button" data-go="${x.go}"
      aria-label="${esc(x.n)}${x.say ? `: ${esc(x.say)}` : ''}">
      <span class="emblem-icon" aria-hidden="true">${x.e}${x.b !== '' && x.b !== undefined ? `<span class="emblem-badge${x.soft ? ' soft' : ''}">${esc(String(x.b))}</span>` : ''}</span>
      <span>${esc(x.n)}</span></button>`).join('');
  }

  function goTo(where) {
    if (where === 'week' || where === 'month' || where === 'meals') {
      weekMode = where;
      weekStart = startOfWeek(new Date());
      monthView = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      switchView('week');
    } else if (['todos', 'goals', 'journal', 'cycle'].includes(where)) switchView(where);
    else if (where === 'habits') openHabitSheet(!state.habits.length);
    else if (where === 'plants') { if (state.plants.length) openGardenManager(); else openGardenEdit(null); }
    else if (where === 'focus') openFocus('todo');
    else if (where === 'dump') openDump();
    else if (where === 'weekly') openWeekly();
    else if (where === 'settings') openSettings();
  }

  $('#emblems').addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    b.classList.add('pop');
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (err) { /* ignore */ }
    setTimeout(() => goTo(b.dataset.go), 160); // let the little pop play first
  });

  /* ================= Journal prompts: 2 a day ================= */
  // One about the day, one about you (feelings, gratitude, growth). They change every day.
  const PROMPTS_DAY = [
    'What was the best part of today?',
    'What took most of your energy today?',
    'What is one thing you got done today, big or small?',
    'Who did you talk to today, and how did it feel?',
    'What surprised you today?',
    'What would you do differently if you could redo today?',
    'What made you laugh or smile today?',
    'What was hard today, and how did you get through it?',
    'What did you do today just for yourself?',
    'Describe today in three words. Why those words?',
    'What is something you learned today?',
    'When did you feel most like yourself today?',
    'What is one thing you are glad you didn\'t give up on today?',
    'What did you put off today? What would make it easier tomorrow?',
    'How did your body feel today: energy, sleep, food?',
    'What moment from today do you want to remember?',
  ];
  const PROMPTS_YOU = [
    'Name three small things you are grateful for right now.',
    'What is on your mind that you want to let go of before bed?',
    'What is one kind thing you can say to yourself today?',
    'What are you looking forward to this week?',
    'What does your ideal day look like a year from now?',
    'What is something you are proud of yourself for lately?',
    'What is draining you at the moment, and what could help?',
    'Which nail set or idea are you most excited to try next?',
    'What does "a good week" mean to you right now?',
    'Who or what made your life a little easier recently?',
    'What is one thing you want more of in your life? Less of?',
    'If your best friend had your day, what would you tell them?',
    'What worry feels big right now? What is one small step for it?',
    'What is a habit that is working for you? Why do you think it works?',
    'What would make tomorrow 1% better?',
    'What did you need today that you didn\'t get? How can you give it to yourself?',
  ];
  let promptOffset = 0;
  function promptsFor(key, off) {
    const n = Math.floor(parseKey(key).getTime() / 86400000) + off * 3;
    const a = PROMPTS_DAY[((n % PROMPTS_DAY.length) + PROMPTS_DAY.length) % PROMPTS_DAY.length];
    const b = PROMPTS_YOU[(((n * 5 + 2) % PROMPTS_YOU.length) + PROMPTS_YOU.length) % PROMPTS_YOU.length];
    return [a, b];
  }
  // Gentle prompts that fit each cycle phase (everyone is different, so these are just ideas)
  const PHASE_PROMPTS = {
    menstrual: [
      'What does your body need most today: rest, warmth, food, or quiet?',
      'What can you take off your plate this week so you can rest?',
      'How are you feeling, honestly, today? No need to make it pretty.',
      'What small comfort helped you today?',
      'What would being gentle with yourself look like tomorrow?',
    ],
    follicular: [
      'Your energy is often rising now. What new thing do you want to start?',
      'What idea has been exciting you lately?',
      'If you had a burst of motivation this week, where would you use it?',
      'What is one goal step you could take while you feel fresh?',
      'What would you like to plan or try for the first time?',
    ],
    ovulation: [
      'Who would you love to connect with this week?',
      'When did you feel most confident recently?',
      'What conversation or plan have you been putting off that feels doable now?',
      'What do you want to say yes to this week?',
      'What made you feel good about yourself today?',
    ],
    luteal: [
      'What is draining your energy right now, and what could you drop?',
      'What helps you most when you feel moody or tired?',
      'What do you need to say no to this week?',
      'Are there any cravings or feelings showing up? What might they be telling you?',
      'What can you prepare now to make next week feel easier?',
    ],
  };
  function renderPrompts(key) {
    const text = $('#journal-text').value;
    const list = promptsFor(key, promptOffset).map((t) => ({ t, tag: '' }));
    const ph = cycleModel(key).phaseFor(key);
    if (ph && PHASE_PROMPTS[ph.phase]) {
      const pool = PHASE_PROMPTS[ph.phase];
      const n = Math.floor(parseKey(key).getTime() / 86400000) + promptOffset;
      list[1] = { t: pool[((n % pool.length) + pool.length) % pool.length], tag: `${PHASES[ph.phase].emoji} ${PHASES[ph.phase].name} phase` };
    }
    $('#prompt-list').innerHTML = list.map((p) =>
      `<button class="prompt-btn${text.includes(p.t) ? ' used' : ''}" type="button" data-prompt="${esc(p.t)}">${p.tag ? `<small class="prompt-tag">${esc(p.tag)}</small>` : ''}${esc(p.t)}</button>`).join('');
  }
  $('#prompt-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-prompt]');
    if (!b) return;
    const ta = $('#journal-text');
    const p = b.dataset.prompt;
    if (!ta.value.includes(p)) ta.value = `${ta.value.trim() ? `${ta.value.trimEnd()}\n\n` : ''}${p}\n`;
    b.classList.add('used');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
  $('#prompt-shuffle').addEventListener('click', () => {
    promptOffset++;
    if (editingJournal) renderPrompts(editingJournal);
  });

  /* ================= My meals: every planned meal is saved, with its cooking time ================= */
  const libFind = (name) => state.mealLib.find((m) => m.name.toLowerCase() === String(name).trim().toLowerCase());
  const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
  const cleanMins = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 600 ? n : 0; };
  let libFilter = 0;
  let editingLib = null;
  const libSheet = $('#lib-sheet');

  function saveToLib(name, mins, ingredients) {
    let m = libFind(name);
    if (!m) { m = { id: uid(), name: name.slice(0, 80), mins: 0, ingredients: [], created: Date.now() }; state.mealLib.push(m); }
    if (cleanMins(mins)) m.mins = cleanMins(mins);
    if (ingredients && ingredients.length) m.ingredients = ingredients.slice(0, 40);
    m.used = (m.used || 0) + 1;
    return m;
  }

  // First time: add every meal already in the planner
  if (!state.mealLibInit) {
    Object.values(state.meals).forEach((day) => Object.values(day || {}).forEach((v) => {
      if (typeof v === 'string' && v && !libFind(v)) state.mealLib.push({ id: uid(), name: v.slice(0, 80), mins: 0, ingredients: [], created: Date.now() });
    }));
    state.mealFavs.forEach((v) => { if (!libFind(v)) state.mealLib.push({ id: uid(), name: v.slice(0, 80), mins: 0, ingredients: [], created: Date.now() }); });
    state.mealLibInit = true;
    save();
  }

  function renderMealLib() {
    $$('#lib-filter [data-lfilter]').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.lfilter) === libFilter));
    let list = [...state.mealLib];
    if (libFilter) list = list.filter((m) => m.mins && m.mins <= libFilter);
    list.sort((a, b) => (Number(state.mealFavs.includes(b.name)) - Number(state.mealFavs.includes(a.name)))
      || ((a.mins || 9999) - (b.mins || 9999)) || a.name.localeCompare(b.name));
    let empty;
    if (!state.mealLib.length) empty = 'Meals you plan are saved here automatically 🍽️';
    else if (!list.length) {
      const noTime = state.mealLib.filter((m) => !m.mins).length;
      empty = `No meals that take ${fmtMins(libFilter)} or less yet.${noTime ? `\n${plural(noTime, 'meal')} still need a time: tap one under "Any" to add it.` : ''}`;
    }
    $('#lib-list').innerHTML = list.length
      ? list.map((m) => `<li><button class="lib-item" type="button" data-lib="${esc(m.id)}">
          <span class="lib-name">${state.mealFavs.includes(m.name) ? '⭐ ' : ''}${esc(m.name)}</span>
          <span class="lib-time${m.mins ? '' : ' none'}">${m.mins ? `⏱️ ${esc(fmtMins(m.mins))}` : 'Add time'}</span></button></li>`).join('')
      : `<li class="empty" style="white-space:pre-line">${esc(empty)}</li>`;
  }

  function openLib(id) {
    const m = id ? state.mealLib.find((x) => x.id === id) : null;
    editingLib = m ? m.id : null;
    $('#lib-title').textContent = m ? m.name : 'New meal';
    $('#lib-name').value = m ? m.name : '';
    $('#lib-mins').value = m && m.mins ? m.mins : '';
    $('#lib-ingredients').value = m && m.ingredients ? m.ingredients.join('\n') : '';
    $('#lib-fav').checked = !!m && state.mealFavs.includes(m.name);
    $('#lib-delete').hidden = !m;
    libSheet.showModal();
    if (!m) setTimeout(() => $('#lib-name').focus(), 50);
  }

  // Save the sheet's fields; returns the meal (or null if no name)
  function saveLibForm() {
    const name = $('#lib-name').value.trim().slice(0, 80);
    if (!name) { showToast('Give the meal a name 🙂'); $('#lib-name').focus(); return null; }
    const ingredients = $('#lib-ingredients').value.split('\n').map((x) => x.replace(/^[-*•\s]+/, '').trim()).filter(Boolean).slice(0, 40);
    let m = editingLib ? state.mealLib.find((x) => x.id === editingLib) : null;
    const clash = libFind(name);
    if (!m && clash) m = clash;
    if (!m) { m = { id: uid(), created: Date.now() }; state.mealLib.push(m); }
    const oldName = m.name;
    if (oldName && oldName !== name) {
      // rename it everywhere it's planned
      Object.values(state.meals).forEach((day) => Object.keys(day).forEach((s) => { if (day[s] === oldName) day[s] = name; }));
      state.mealFavs = state.mealFavs.map((f) => (f === oldName ? name : f));
    }
    Object.assign(m, { name, mins: cleanMins($('#lib-mins').value), ingredients });
    const fav = $('#lib-fav').checked;
    if (fav && !state.mealFavs.includes(name)) state.mealFavs = [name, ...state.mealFavs].slice(0, 30);
    if (!fav) state.mealFavs = state.mealFavs.filter((f) => f !== name);
    editingLib = m.id;
    save();
    return m;
  }

  $('#lib-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!saveLibForm()) return;
    libSheet.close();
    render();
    showToast('Meal saved 📖');
  });
  $('#lib-tonight').addEventListener('click', () => {
    const m = saveLibForm();
    if (!m) return;
    const tk = todayKey();
    state.meals[tk] = { ...mealDay(tk), d: m.name };
    m.used = (m.used || 0) + 1;
    save();
    libSheet.close();
    render();
    showToast(`🍝 Tonight: ${m.name}${m.mins ? ` (${fmtMins(m.mins)})` : ''}`);
    celebrate(false);
  });
  $('#lib-shop').addEventListener('click', () => {
    const m = saveLibForm();
    if (!m) return;
    if (!m.ingredients.length) { showToast('Add some ingredients first 🛒'); $('#lib-ingredients').focus(); return; }
    const n = addShopping(m.ingredients);
    save();
    renderShopping();
    showToast(n ? `${plural(n, 'item')} added to your shopping list 🛒` : 'Those are already on your list ✓');
  });
  $('#lib-delete').addEventListener('click', () => {
    const m = state.mealLib.find((x) => x.id === editingLib);
    if (!m || !confirm(`Remove "${m.name}" from My meals? Days you've already planned stay as they are.`)) return;
    state.mealLib = state.mealLib.filter((x) => x.id !== m.id);
    state.mealFavs = state.mealFavs.filter((f) => f !== m.name);
    save();
    libSheet.close();
    render();
  });
  $('#lib-cancel').addEventListener('click', () => libSheet.close());
  libSheet.addEventListener('click', (e) => { if (e.target === libSheet) libSheet.close(); });
  libSheet.addEventListener('close', () => { editingLib = null; });
  $('#lib-add').addEventListener('click', () => openLib(null));
  $('#meal-lib').addEventListener('click', (e) => {
    const f = e.target.closest('[data-lfilter]');
    if (f) { libFilter = Number(f.dataset.lfilter); renderMealLib(); return; }
    const it = e.target.closest('[data-lib]');
    if (it) openLib(it.dataset.lib);
  });

  /* ================= Swipe down to close pop-ups (like iPhone sheets) ================= */
  function enableSwipeClose(dlg) {
    let startY = null;
    let dy = 0;
    let t0 = 0;
    let fromTop = false;
    let dragging = false;
    const reset = () => {
      dlg.style.transition = '';
      dlg.style.transform = '';
    };
    dlg.addEventListener('touchstart', (e) => {
      startY = null;
      if (e.touches.length !== 1 || e.target.closest('input, textarea, select')) return;
      const y = e.touches[0].clientY;
      fromTop = y - dlg.getBoundingClientRect().top < 80; // the handle area at the top
      if (!fromTop && dlg.scrollTop > 0) return; // let it scroll normally
      startY = y;
      dy = 0;
      t0 = Date.now();
      dragging = false;
    }, { passive: true });
    dlg.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      dy = e.touches[0].clientY - startY;
      if (!dragging) {
        if (dy > 8 && (fromTop || dlg.scrollTop <= 0)) {
          dragging = true;
          dlg.style.transition = 'none';
        } else if (dy < -4) {
          startY = null; // swiping up: scroll as usual
          return;
        } else return;
      }
      e.preventDefault();
      dlg.style.transform = `translateY(${Math.max(0, dy)}px)`;
    }, { passive: false });
    const end = () => {
      if (startY === null) return;
      startY = null;
      if (!dragging) return;
      dragging = false;
      const fast = dy / Math.max(1, Date.now() - t0) > 0.6;
      if (dy > 110 || (fast && dy > 40)) {
        dlg.style.transition = 'transform .2s ease';
        dlg.style.transform = 'translateY(100%)';
        setTimeout(() => {
          if (dlg.open && !dismissSheet(dlg)) {
            // couldn't save (e.g. a title is missing): slide back so you can fix it
            dlg.style.transform = '';
            setTimeout(reset, 220);
            return;
          }
          reset();
        }, 200);
      } else {
        dlg.style.transition = 'transform .2s ease';
        dlg.style.transform = '';
        setTimeout(reset, 220);
      }
    };
    dlg.addEventListener('touchend', end);
    dlg.addEventListener('touchcancel', end);
    dlg.addEventListener('close', reset);
  }
  // Swiping away or tapping outside saves what you typed (Cancel still means "don't save")
  const AUTOSAVE_FORMS = new Set(['sheet-form', 'journal-form', 'day-form', 'meal-form', 'lib-form', 'goal-form',
    'garden-form', 'routine-form', 'dump-form', 'plant-form']);
  function dismissSheet(dlg) {
    if (dlg.dataset.dirty === '1') {
      if (dlg.id === 'habit-sheet' && !$('#habit-edit').hidden) { $('#habit-save').click(); if (dlg.open) dlg.close(); return true; }
      const form = dlg.querySelector('form');
      if (form && AUTOSAVE_FORMS.has(form.id)) {
        form.requestSubmit();
        return !dlg.open; // still open means something needs fixing first
      }
    }
    if (dlg.open) dlg.close();
    return true;
  }
  $$('dialog.sheet').forEach((dlg) => {
    enableSwipeClose(dlg);
    const markDirty = () => { dlg.dataset.dirty = '1'; };
    dlg.addEventListener('input', markDirty);
    dlg.addEventListener('change', markDirty);
    // quick-pick buttons fill in fields without typing
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-meal-pick], [data-prompt], [data-habit-idea], [data-pick], #f-clear-when, #garden-photo-remove')) markDirty();
    });
    dlg.addEventListener('close', () => { delete dlg.dataset.dirty; });
    // tapping the dimmed background: save first (runs before the older "just close" handlers)
    dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return;
      e.stopImmediatePropagation();
      dismissSheet(dlg);
    }, { capture: true });
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
    if (ph) parts.push(`${PHASES[ph.phase].emoji} ${PHASES[ph.phase].name}, cycle day ${ph.day}`);
    const n = dayEvents(key).length;
    if (n) parts.push(plural(n, 'event'));
    const r = routineDay(key);
    if (r.morningAll) parts.push('☀️ routine done');
    if (r.nightAll) parts.push('🌙 routine done');
    return parts.join('\n');
  }

  function openJournal(key) {
    editingJournal = key;
    const e = journalEntry(key) || {};
    const rel = relDay(key);
    const long = fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#journal-title').textContent = ['Today', 'Yesterday'].includes(rel) ? `${rel}\n${long}` : long;
    $('#journal-context').textContent = entryContext(key);
    promptOffset = 0;
    renderPrompts(key);
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
    if ((mood || energy || text || good) && !journalEntry(editingJournal)) grow(2);
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
      <span class="item-meta">${esc(meta.join('\n'))}</span>
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
      : `<div class="journal-card"><h2>📓 How did today go? ${whyBtn('journal')}</h2><p>A minute is enough: pick a mood and write a line or two.</p><p class="today-prompt">💭 ${esc(promptsFor(tk, 0)[0])}</p>
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
    renderPixels();

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
    $('#routine-anchor-m').value = state.routine.anchorM;
    $('#routine-anchor-n').value = state.routine.anchorN;
    $('#routine-bed').value = state.routine.bed;
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
    state.routine.anchorM = $('#routine-anchor-m').value.trim().slice(0, 60);
    state.routine.anchorN = $('#routine-anchor-n').value.trim().slice(0, 60);
    if (/^\d\d:\d\d$/.test($('#routine-bed').value)) state.routine.bed = $('#routine-bed').value;
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
      series: typeof ev.recurringEventId === 'string' ? ev.recurringEventId : '',
    };
    if (ev.start.date) {
      const end = ev.end && ev.end.date ? ev.end.date : dateKey(addDays(parseKey(ev.start.date), 1));
      return { ...base, allDay: true, start: ev.start.date, end, time: '' };
    }
    const s = new Date(ev.start.dateTime);
    if (isNaN(s)) return null;
    const e2 = ev.end && ev.end.dateTime ? new Date(ev.end.dateTime) : null;
    const endTime = e2 && !isNaN(e2) && dateKey(e2) === dateKey(s) ? `${pad(e2.getHours())}:${pad(e2.getMinutes())}` : '';
    return { ...base, allDay: false, start: dateKey(s), end: dateKey(s), time: `${pad(s.getHours())}:${pad(s.getMinutes())}`, endTime };
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
    const RULES = { daily: 'RRULE:FREQ=DAILY', weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'RRULE:FREQ=WEEKLY', monthly: 'RRULE:FREQ=MONTHLY' };
    const recurrence = RULES[ev.repeat] ? [RULES[ev.repeat]] : [];
    const reminders = ev.remind !== undefined && ev.remind !== ''
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: Number(ev.remind) }] }
      : { useDefault: true };
    if (!ev.time) {
      return { summary: ev.title, start: { date: ev.date }, end: { date: dateKey(addDays(parseKey(ev.date), 1)) }, recurrence, reminders };
    }
    const [h, m] = ev.time.split(':').map(Number);
    const end = parseKey(ev.date);
    end.setHours(h + 1, m);
    return {
      summary: ev.title,
      start: { dateTime: `${ev.date}T${ev.time}:00`, timeZone },
      end: { dateTime: `${dateKey(end)}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`, timeZone },
      recurrence,
      reminders,
    };
  }

  // A to-do reminder becomes a short "⏰" event in Google Calendar with a notification
  const wantsReminder = (t) => t.remind !== undefined && t.remind !== '' && !!t.due && !!t.time && !t.done;
  function reminderBody(t) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [h, m] = t.time.split(':').map(Number);
    const end = parseKey(t.due);
    end.setHours(h, m + 15);
    return {
      summary: `⏰ ${t.title}`,
      description: 'Reminder from your planner',
      start: { dateTime: `${t.due}T${t.time}:00`, timeZone },
      end: { dateTime: `${dateKey(end)}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`, timeZone },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: Number(t.remind) }] },
    };
  }

  const waitingCount = () =>
    state.events.filter((e) => e.gSync && (e.gDirty || !e.gId)).length +
    state.google.pendingDeletes.length +
    state.google.tasks.filter((t) => t.dirty).length +
    state.todos.filter((t) => (wantsReminder(t) && (t.gRemindDirty || !t.gEvId)) || (!wantsReminder(t) && t.gEvId)).length +
    state.plants.filter((p) => (wantsWaterReminder(p) && (p.gRemindDirty || !p.gEvId)) || (!wantsWaterReminder(p) && p.gEvId)).length;

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
    grow(t.done ? 1 : -1);
    save();
    render();
    if (t.done) { showToast(CHEERS[Math.floor(Math.random() * CHEERS.length)]); celebrate(false); }
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
    for (const t of state.todos) {
      if (wantsReminder(t)) {
        if (!t.gRemindDirty && t.gEvId) continue;
        if (t.gEvId) {
          try {
            await gApi(`/calendars/primary/events/${encodeURIComponent(t.gEvId)}`, { method: 'PATCH', body: reminderBody(t) });
          } catch (e) {
            if (e.status !== 404 && e.status !== 410) throw e;
            t.gEvId = null;
          }
        }
        if (!t.gEvId) {
          const r = await gApi('/calendars/primary/events', { method: 'POST', body: reminderBody(t) });
          t.gEvId = r.id;
        }
        t.gRemindDirty = false;
        save();
      } else if (t.gEvId) {
        // done, no time any more, or notification switched off: remove the reminder
        try {
          await gApi(`/calendars/primary/events/${encodeURIComponent(t.gEvId)}`, { method: 'DELETE' });
        } catch (e) {
          if (e.status !== 404 && e.status !== 410) throw e;
        }
        t.gEvId = null;
        t.gRemindDirty = false;
        save();
      }
    }
    await pushPlantReminders();
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
    else if (!getToken()) text = `🗓️ Tap to sync with Google${waiting ? `\n${waiting} waiting to send` : ''}`;
    else text = `🗓️ Google synced ${ago(g.lastSync)}${waiting ? `, ${waiting} waiting` : ''}\nTap to refresh`;
    btn.textContent = text;
    btn.disabled = syncing;
  }

  function renderSettings() {
    const g = state.google;
    const live = !!getToken();
    let status;
    if (!g.clientId) status = "Not set up yet. Follow the setup steps, then paste your Client ID below.";
    else if (!g.connected) status = 'Ready to connect.';
    else if (live) status = `Connected ✅\nSynced ${ago(g.lastSync)}`;
    else status = 'Connected ✅\nGoogle signs you out after about an hour, so tap Sync now to refresh.';
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
    $('#profile-name').value = state.profile.name;
    $('#settings-more').open = !!state.google.clientId;
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
  // First visit: a quick, friendly tour (skipped by automated browsers)
  if (!state.profile.toured && !navigator.webdriver) openTour();
})();
