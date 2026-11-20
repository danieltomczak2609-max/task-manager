/* Quest – Task Manager mit Fokus-Timer, Zeitmessung, Wochen-Review und Sync. */
(() => {
  'use strict';

  // ================= Helpers =================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const todayISO = () => toISO(new Date());
  const now = () => Date.now();
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const MON_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const QCOLORS = ['#a78bfa', '#c3e66e', '#f0866b', '#60a5fa', '#5eead4', '#f472b6', '#facc15', '#fb923c'];
  const QICONS = ['✦', '🚀', '🎬', '💪', '📚', '💼', '❤️', '🏠', '🎯', '💡', '🎵', '✍️'];
  let HOUR_PX = 44;
  // Stundenhöhe passt sich der Fensterhöhe an, damit 7–23 Uhr ohne Scrollen sichtbar sind
  const calcHourPx = () => Math.max(40, Math.min(96, Math.floor((window.innerHeight - 56 - 275) / 16)));

  const weekStart = (iso) => { const d = fromISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); };
  const dayStartMs = (iso) => fromISO(iso).getTime();
  const dayRange = (iso) => [dayStartMs(iso), dayStartMs(addDays(iso, 1))];
  const weekRange = (ws) => [dayStartMs(ws), dayStartMs(addDays(ws, 7))];
  function fmtDur(ms) {
    const m = Math.floor(Math.max(0, ms) / 60000), h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  }
  function fmtClock(ms) {
    const s = Math.floor(Math.max(0, ms) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }
  const fmtHM = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtRange = (ws) => {
    const a = fromISO(ws), b = fromISO(addDays(ws, 6));
    return a.getMonth() === b.getMonth() ? `${a.getDate()}.–${b.getDate()}. ${MON[a.getMonth()]}` : `${a.getDate()}. ${MON[a.getMonth()]} – ${b.getDate()}. ${MON[b.getMonth()]}`;
  };
  const longDate = (iso) => { const d = fromISO(iso); return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MON_LONG[d.getMonth()]}`; };

  // ================= State =================
  const KEY = 'quest.v1';
  const COLLS = ['quests', 'tasks', 'sessions', 'recurring', 'reviews'];
  const emptyState = () => ({ v: 1, quests: [], tasks: [], sessions: [], recurring: [], reviews: [], settings: { id: 'settings', weeklyTarget: 20, updatedAt: 0 }, deleted: {} });

  function normalize(s) {
    const e = emptyState();
    s = { ...e, ...(s || {}) };
    COLLS.forEach((c) => { if (!Array.isArray(s[c])) s[c] = []; });
    s.settings = { ...e.settings, ...(s.settings || {}) };
    s.deleted ||= {};
    return s;
  }

  function migrateOld() {
    // Übernimmt Aufgaben aus der ersten App-Version (Projekte → Quests)
    try {
      const raw = localStorage.getItem('taskmanager.v1');
      if (!raw) return null;
      const old = JSON.parse(raw);
      const DEMO = ['Willkommen! Klick mich an, um Details zu sehen 👋', 'Wocheneinkauf erledigen', 'Präsentation vorbereiten', 'E-Mails beantworten'];
      const tasks = (old.tasks || []).filter((t) => !DEMO.includes(t.title));
      if (!tasks.length) return null;
      const s = emptyState();
      const used = new Set(tasks.map((t) => t.projectId).filter(Boolean));
      (old.projects || []).filter((p) => used.has(p.id)).forEach((p, i) => s.quests.push({
        id: p.id, name: p.name, description: '', color: QCOLORS[i % QCOLORS.length], icon: QICONS[i % QICONS.length], status: 'active', order: i, createdAt: now(),
      }));
      tasks.forEach((t, i) => s.tasks.push({
        id: t.id, title: t.title, notes: t.notes || '', questId: t.projectId || null, date: t.due || null,
        done: t.status === 'done', doneAt: t.completedAt || null, order: i, createdAt: t.createdAt || now(),
      }));
      return s;
    } catch { return null; }
  }

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { console.warn(e); }
    return normalize(migrateOld() || emptyState());
  }

  let state = load();
  const ui = Object.assign({
    view: 'home', planStart: null, calWeek: null, reviewWeek: null, questTab: 'active', addPos: 'top', showDone: false, focusPick: null, lastQuest: null,
  }, (() => { try { return JSON.parse(localStorage.getItem('quest.ui') || '{}'); } catch { return {}; } })());
  ui.planStart = null; ui.calWeek = null; ui.reviewWeek = null;
  const saveUI = () => localStorage.setItem('quest.ui', JSON.stringify({ view: ui.view, questTab: ui.questTab, addPos: ui.addPos, lastQuest: ui.lastQuest }));

  // ---------- Change stamping (for sync) ----------
  let snap = new Map();
  const itemJSON = (it) => { const { updatedAt, ...rest } = it; return JSON.stringify(rest); };
  const allItems = () => [...COLLS.flatMap((c) => state[c]), state.settings];
  function stamp(init = false) {
    const t = now(); let changed = false; const seen = new Set();
    for (const it of allItems()) {
      seen.add(it.id);
      const j = itemJSON(it);
      if (snap.get(it.id) === j) continue;
      if (snap.has(it.id) || !it.updatedAt) it.updatedAt = t;
      if (!init && state.deleted[it.id]) { delete state.deleted[it.id]; it.updatedAt = t; }
      if (!init) changed = true;
      snap.set(it.id, j);
    }
    for (const id of [...snap.keys()]) if (!seen.has(id)) { state.deleted[id] = t; snap.delete(id); changed = true; }
    for (const [id, ts] of Object.entries(state.deleted)) if (t - ts > 120 * 86400000) delete state.deleted[id];
    return changed;
  }
  function resetSnap() { snap = new Map(); for (const it of allItems()) snap.set(it.id, itemJSON(it)); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Speichern fehlgeschlagen: ' + e.message); } }
  let saveT;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { if (stamp()) scheduleSync(); persist(); }, 60); }
  function commit() { save(); render(); }

  // ================= Domain =================
  const getTask = (id) => state.tasks.find((t) => t.id === id);
  const getQuest = (id) => state.quests.find((q) => q.id === id);
  const activeQuests = () => state.quests.filter((q) => q.status !== 'completed').sort((a, b) => a.order - b.order);
  const qColor = (qid) => getQuest(qid)?.color || '#4a4a52';
  const running = () => state.sessions.find((s) => s.end == null);
  const sEnd = (s) => (s.end == null ? now() : s.end);
  const sQuest = (s) => { const t = getTask(s.taskId); return t ? t.questId : s.questId; };
  const overlap = (s, a, b) => Math.max(0, Math.min(sEnd(s), b) - Math.max(s.start, a));
  const taskTime = (id) => state.sessions.reduce((sum, s) => sum + (s.taskId === id ? sEnd(s) - s.start : 0), 0);
  function timeIn(a, b, pred = () => true) { return state.sessions.reduce((sum, s) => sum + (pred(s) ? overlap(s, a, b) : 0), 0); }
  const isQuestSession = (s) => { const q = sQuest(s); return !!(q && getQuest(q)); };
  const questTimeIn = (a, b) => timeIn(a, b, isQuestSession);

  function tasksOn(iso, filter = () => true) {
    return state.tasks.filter((t) => t.date === iso && filter(t)).sort((a, b) => (a.done - b.done) || a.order - b.order);
  }
  function orderFor(date, pos) {
    const list = state.tasks.filter((t) => t.date === date);
    if (!list.length) return 0;
    return pos === 'bottom' ? Math.max(...list.map((t) => t.order)) + 1 : Math.min(...list.map((t) => t.order)) - 1;
  }
  function parseQuestTag(text) {
    let questId = null;
    const title = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (m, sp, name) => {
      const n = name.toLowerCase();
      const q = activeQuests().find((x) => x.name.toLowerCase().replace(/\s+/g, '') === n) || activeQuests().find((x) => x.name.toLowerCase().startsWith(n));
      if (q) { questId = q.id; return sp; }
      return m;
    }).replace(/\s+/g, ' ').trim();
    return { title, questId };
  }
  function addTask({ title, questId = null, date = todayISO(), pos = ui.addPos }) {
    const t = { id: uid(), title, notes: '', questId, date, done: false, doneAt: null, order: orderFor(date, pos), createdAt: now() };
    state.tasks.push(t);
    if (questId) ui.lastQuest = questId;
    commit();
    return t;
  }

  // Timer
  function startTask(id) {
    const t = getTask(id); if (!t) return;
    const r = running();
    if (r) { if (r.taskId === id) return; stopSession(r); }
    if (t.done) { t.done = false; t.doneAt = null; }
    if (!t.date || t.date < todayISO()) t.date = todayISO();
    state.sessions.push({ id: uid(), taskId: id, questId: t.questId || null, start: now(), end: null });
    commit();
  }
  function stopSession(s) {
    s.end = now();
    if (s.end - s.start < 5000) state.sessions = state.sessions.filter((x) => x !== s); // versehentliche Klicks verwerfen
  }
  function pauseTimer() { const r = running(); if (r) { stopSession(r); commit(); } }
  function completeTask(id) {
    const t = getTask(id); if (!t) return;
    const r = running(); if (r && r.taskId === id) stopSession(r);
    t.done = true; t.doneAt = now();
    if (!t.date) t.date = todayISO();
    const time = taskTime(id);
    commit();
    toast(`✓ Erledigt${time ? ' · ' + fmtDur(time) : ''}`, () => { t.done = false; t.doneAt = null; commit(); });
  }
  function toggleDone(id) {
    const t = getTask(id); if (!t) return;
    if (t.done) { t.done = false; t.doneAt = null; commit(); } else completeTask(id);
  }
  function deleteTask(id) {
    const idx = state.tasks.findIndex((t) => t.id === id); if (idx < 0) return;
    const [t] = state.tasks.splice(idx, 1);
    const r = running(); if (r && r.taskId === id) stopSession(r);
    commit();
    toast('Aufgabe gelöscht', () => { state.tasks.splice(idx, 0, t); commit(); });
  }

  // Wiederkehrende Aufgaben (gleiche ID auf allen Geräten → keine Duplikate beim Sync)
  function ensureRecurring(fromISO_, toISO_) {
    let added = false;
    const start = fromISO_ < todayISO() ? todayISO() : fromISO_;
    for (const r of state.recurring) {
      const since = toISO(new Date(r.createdAt || 0));
      for (let d = start; d <= toISO_; d = addDays(d, 1)) {
        if (d < since || !r.days.includes(fromISO(d).getDay())) continue;
        const id = `r_${r.id}_${d}`;
        if (state.deleted[id] || getTask(id)) continue;
        state.tasks.push({ id, title: r.title, notes: '', questId: r.questId || null, date: d, done: false, doneAt: null, order: -1000 + (r.order || 0), recurringId: r.id, createdAt: now() });
        added = true;
      }
    }
    if (added) save();
  }

  // ================= Rendering =================
  const TITLES = { home: 'Home', plan: 'Plan', calendar: 'Kalender', focus: 'Fokus', quests: 'Quests', review: 'Review' };
  function render() {
    const v = ui.view;
    HOUR_PX = calcHourPx();
    $$('[data-act="go"]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $('#mobile-title').textContent = TITLES[v] || '';
    const view = $('#view');
    const keepScroll = view.querySelector('.cal-wrap, .timeline-card');
    const sc = keepScroll ? keepScroll.scrollTop : null;
    const planSc = view.querySelector('.plan-scroll')?.scrollLeft;
    view.innerHTML = ({ home: renderHome, plan: renderPlan, calendar: renderCalendar, focus: renderFocus, quests: renderQuests, review: renderReview }[v] || renderHome)();
    const wrap = view.querySelector('.cal-wrap, .timeline-card');
    if (wrap) wrap.scrollTop = sc ?? Math.max(0, 7 * HOUR_PX - 10);
    const ps = view.querySelector('.plan-scroll'); if (ps && planSc != null) ps.scrollLeft = planSc;
    renderRunbar();
    tick();
  }

  function taskCard(t, opts = {}) {
    const q = getQuest(t.questId);
    const r = running(); const isRun = r && r.taskId === t.id;
    const time = taskTime(t.id);
    return `<div class="tcard${t.done ? ' done' : ''}${isRun ? ' running' : ''}" data-task="${t.id}" draggable="true" style="--qc:${q ? q.color : '#3a3a40'}">
      <div class="tc-title" data-act="edit-task" data-id="${t.id}">${esc(t.title) || '<i>Ohne Titel</i>'}</div>
      <div class="tc-meta">
        <button class="chk${t.done ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Erledigt">✓</button>
        ${opts.noQuest ? '' : `<span class="qchip"><i></i>${q ? esc(q.name) : 'Keine Quest'}</span>`}
        ${time || isRun ? `<span class="ttime"><i></i><span data-live-task="${t.id}">${isRun ? fmtClock(time) : fmtDur(time)}</span></span>` : ''}
        ${t.recurringId ? '<span class="rec" title="Wiederkehrend">↻</span>' : ''}
        <span class="sp"></span>
        ${t.done ? '' : isRun ? `<button class="iconb" data-act="pause" title="Pausieren">❚❚</button>` : `<button class="iconb" data-act="start" data-id="${t.id}" title="Timer starten">▶</button>`}
      </div></div>`;
  }

  function addRow({ date, mode, placeholder }) {
    const qs = activeQuests();
    const sel = mode === 'quest' && qs.length
      ? `<select data-role="quest" aria-label="Quest">${qs.map((q) => `<option value="${q.id}"${q.id === ui.lastQuest ? ' selected' : ''}>${esc(q.name)}</option>`).join('')}</select>` : '';
    return `<form class="addrow" data-form="add" data-date="${date}" data-mode="${mode}">
      <input placeholder="${esc(placeholder)}" maxlength="200" />
      ${sel}
      <span class="pos"><button type="button" data-act="pos" data-pos="top" class="${ui.addPos === 'top' ? 'on' : ''}">↑ Oben</button><button type="button" data-act="pos" data-pos="bottom" class="${ui.addPos === 'bottom' ? 'on' : ''}">↓ Unten</button></span>
    </form>`;
  }

  function weekProgress() {
    const ws = weekStart(todayISO());
    const [a, b] = weekRange(ws);
    const w = questTimeIn(a, b);
    const target = (state.settings.weeklyTarget || 20) * 3600000;
    return { w, target, pct: Math.min(100, (w / target) * 100) };
  }

  // ---------- Home ----------
  function renderHome() {
    const t = todayISO();
    ensureRecurring(t, addDays(t, 7));
    const [a, b] = dayRange(t);
    const todayMs = timeIn(a, b);
    const wp = weekProgress();
    const qs = tasksOn(t, (x) => x.questId && getQuest(x.questId));
    const other = tasksOn(t, (x) => !x.questId || !getQuest(x.questId));
    const overdue = state.tasks.filter((x) => !x.done && x.date && x.date < t);
    const listSection = (list) => {
      const open = list.filter((x) => !x.done), done = list.filter((x) => x.done);
      const shownDone = ui.showDone ? done : done.slice(0, 1);
      return `<div class="tlist" data-drop-date="${t}">${open.map((x) => taskCard(x)).join('')}${shownDone.map((x) => taskCard(x)).join('')}</div>
        ${done.length > 1 ? `<button class="showall" data-act="showdone">${ui.showDone ? 'Weniger zeigen ▴' : `Alle ${done.length} erledigten zeigen ▾`}</button>` : ''}
        ${!list.length ? '<div class="empty">Noch nichts geplant.</div>' : ''}`;
    };
    const h = Math.floor(todayMs / 3600000), m = Math.floor((todayMs % 3600000) / 60000);
    return `<div class="page-head">
        <div><h1>${longDate(t)}</h1></div>
        <div class="right today-total">
          <div class="row"><div class="big num"><span data-live-today>${h}<small>h</small>${pad(m)}<small>m</small></span> <small>heute</small></div>
          <div class="pwrap"><div class="pbar"><div data-live-weekbar style="width:${wp.pct}%"></div></div><span class="label num" style="letter-spacing:.02em;text-transform:none"><span data-live-week>${fmtDur(wp.w)}</span> diese Woche · Ziel ${state.settings.weeklyTarget}h</span></div></div>
        </div>
      </div>
      <div class="home-grid">
        <div>
          ${overdue.length ? `<div class="overdue-hint">⏳ ${overdue.length} offene Aufgabe${overdue.length > 1 ? 'n' : ''} aus den letzten Tagen<button data-act="move-overdue">Auf heute holen</button></div>` : ''}
          ${!sync ? `<div class="overdue-hint">☁︎ Sync ist aus – Mac und Handy zeigen noch nicht dieselben Aufgaben.<button data-act="sync-setup">Jetzt verbinden</button></div>` : ''}
          ${!state.quests.length ? `<div class="overdue-hint">✦ Lege zuerst deine großen Ziele als <b>Quests</b> an – jede Aufgabe zahlt dann auf eine Quest ein.<button data-act="new-quest">Quest anlegen</button></div>` : ''}
          <div class="section">
            <div class="section-head"><span class="label">Quest-Arbeit</span></div>
            ${addRow({ date: t, mode: 'quest', placeholder: 'Quest-Arbeit hinzufügen…' })}
            ${listSection(qs)}
          </div>
          <div class="section">
            <div class="section-head"><span class="label">Sonstiges</span></div>
            ${addRow({ date: t, mode: 'other', placeholder: 'Aufgabe hinzufügen…' })}
            ${listSection(other)}
          </div>
        </div>
        <div class="card timeline-card">${dayGrid([t])}</div>
      </div>`;
  }

  // ---------- Time grid (Home + Kalender) ----------
  function layoutBlocks(iso) {
    const [a, b] = dayRange(iso);
    const items = state.sessions.filter((s) => overlap(s, a, b) > 0 || (s.end == null && s.start < b && s.start >= a))
      .map((s) => ({ s, a: Math.max(s.start, a), b: Math.max(Math.min(sEnd(s), b), Math.max(s.start, a) + 60000) }))
      .sort((x, y) => x.a - y.a);
    const clusters = []; let cur = null;
    for (const it of items) {
      if (!cur || it.a >= cur.end) { cur = { items: [], end: 0, lanes: [] }; clusters.push(cur); }
      let lane = cur.lanes.findIndex((e) => e <= it.a);
      if (lane < 0) { lane = cur.lanes.length; cur.lanes.push(0); }
      cur.lanes[lane] = it.b; it.lane = lane; cur.items.push(it); cur.end = Math.max(cur.end, it.b);
    }
    clusters.forEach((c) => c.items.forEach((it) => (it.n = c.lanes.length)));
    return { items, dayA: a };
  }
  function dayColumn(iso) {
    const { items, dayA } = layoutBlocks(iso);
    const isToday = iso === todayISO();
    let html = `<div class="daycol${isToday ? ' today' : ''}" style="height:${24 * HOUR_PX}px" data-day="${iso}">`;
    for (let h = 1; h < 24; h++) html += `<div class="hline" style="top:${h * HOUR_PX}px"></div>`;
    for (const it of items) {
      const top = ((it.a - dayA) / 3600000) * HOUR_PX;
      const hgt = Math.max(15, ((it.b - it.a) / 3600000) * HOUR_PX - 2);
      const t = getTask(it.s.taskId);
      const w = 100 / it.n;
      html += `<div class="block${it.s.end == null ? ' live' : ''}" data-act="edit-session" data-id="${it.s.id}" style="--qc:${qColor(sQuest(it.s))};top:${top}px;height:${hgt}px;left:calc(${it.lane * w}% + 3px);width:calc(${w}% - 6px)" title="${esc(t?.title || 'Gelöschte Aufgabe')} · ${fmtHM(it.s.start)}–${it.s.end == null ? 'läuft' : fmtHM(it.s.end)}">
        <div class="bt">${esc(t?.title || 'Gelöschte Aufgabe')}</div>${hgt > 30 ? `<div class="br">${fmtHM(it.s.start)} – ${it.s.end == null ? 'jetzt' : fmtHM(it.s.end)}</div>` : ''}</div>`;
    }
    if (isToday) { const d = new Date(); html += `<div class="nowline" style="top:${(d.getHours() + d.getMinutes() / 60) * HOUR_PX}px"></div>`; }
    return html + '</div>';
  }
  function dayGrid(days) {
    let hours = `<div class="hours" style="height:${24 * HOUR_PX}px">`;
    for (let h = 1; h < 24; h++) hours += `<div style="top:${h * HOUR_PX}px">${pad(h)}:00</div>`;
    hours += '</div>';
    return `<div class="tgrid${days.length > 1 ? ' week' : ''}">${hours}${days.map(dayColumn).join('')}</div>`;
  }

  // ---------- Plan ----------
  function renderPlan() {
    const t = todayISO();
    if (!ui.planStart) ui.planStart = addDays(t, -2);
    const days = [...Array(9)].map((_, i) => addDays(ui.planStart, i));
    ensureRecurring(days[0], days[days.length - 1]);
    const filter = ui.planFilter || '';
    const qs = activeQuests();
    const d0 = fromISO(days[2]);
    return `<div class="page-head">
        <div><h1>Woche planen</h1><div class="sub">Plane Quest-Arbeit auf Tage. Ziehe Aufgaben zwischen den Spalten.</div></div>
        <div class="right">
          <select class="btn" data-role="planfilter" title="Nach Quest filtern"><option value="">Alle Quests</option>${qs.map((q) => `<option value="${q.id}"${filter === q.id ? ' selected' : ''}>${esc(q.name)}</option>`).join('')}<option value="none"${filter === 'none' ? ' selected' : ''}>Ohne Quest</option></select>
          <span class="muted small">${MON_LONG[d0.getMonth()]} ${d0.getFullYear()}</span>
          <button class="btn" data-act="plan-shift" data-n="-7">‹</button>
          <button class="btn" data-act="plan-today">Heute</button>
          <button class="btn" data-act="plan-shift" data-n="7">›</button>
          <button class="btn" data-act="recurring">↻ Wiederkehrend</button>
        </div>
      </div>
      <div class="plan-scroll">${days.map((d) => {
        const dt = fromISO(d);
        const list = tasksOn(d, (x) => !filter || (filter === 'none' ? !x.questId : x.questId === filter));
        const [a, b] = dayRange(d);
        const spent = timeIn(a, b);
        return `<div class="pcol${d === t ? ' today' : ''}${d < t ? ' past' : ''}">
          <div class="pcol-head"><span class="dn">${WD[dt.getDay()]} ${dt.getDate()}</span>${spent ? `<small>${fmtDur(spent)}</small>` : ''}</div>
          <form class="addrow" data-form="add" data-date="${d}" data-mode="plan"><input placeholder="Aufgabe… (#Quest)" maxlength="200" /></form>
          <div class="tlist" data-drop-date="${d}">${list.map((x) => taskCard(x)).join('')}</div>
        </div>`;
      }).join('')}</div>`;
  }

  // ---------- Calendar ----------
  function renderCalendar() {
    const t = todayISO();
    if (!ui.calWeek) ui.calWeek = weekStart(t);
    const days = [...Array(7)].map((_, i) => addDays(ui.calWeek, i));
    const [a, b] = weekRange(ui.calWeek);
    const q = questTimeIn(a, b);
    const target = (state.settings.weeklyTarget || 20) * 3600000;
    return `<div class="page-head">
        <div style="display:flex;align-items:center;gap:14px"><h1>Kalender</h1>
          <div class="weeknav"><button class="iconb" data-act="cal-shift" data-n="-7">‹</button><span class="range">${fmtRange(ui.calWeek)}</span><button class="iconb" data-act="cal-shift" data-n="7">›</button>
          <button class="btn ghost" data-act="cal-today">Diese Woche</button></div></div>
        <div class="right today-total"><div class="row">
          <button class="btn" data-act="add-session">＋ Zeit eintragen</button>
          <div class="big num">${fmtDur(q)} <small>/ ${state.settings.weeklyTarget}h Quest</small></div>
          <div class="pbar"><div style="width:${Math.min(100, (q / target) * 100)}%"></div></div></div></div>
      </div>
      ${state.sessions.some((s) => overlap(s, a, b) > 0) ? '' : `<div class="overdue-hint">◷ Diese Woche wurde noch keine Zeit gemessen. Starte bei einer Aufgabe den ▶-Timer – oder trage Zeit nach.<button data-act="add-session">Zeit eintragen</button></div>`}
      <div class="card cal-wrap">
        <div class="weekhead"><div></div>${days.map((d) => {
          const dt = fromISO(d); const [x, y] = dayRange(d);
          return `<div class="d${d === t ? ' today' : ''}">${WD[dt.getDay()]} ${dt.getDate()}<small>${fmtDur(timeIn(x, y))}</small></div>`;
        }).join('')}</div>
        ${dayGrid(days)}
      </div>`;
  }

  // ---------- Focus ----------
  function renderFocus() {
    const r = running();
    const t = todayISO();
    let task = r ? getTask(r.taskId) : null;
    const candidates = state.tasks.filter((x) => !x.done && x.date && x.date <= t).sort((x, y) => (!!getQuest(y.questId) - !!getQuest(x.questId)) || (x.date < y.date ? -1 : x.date > y.date ? 1 : x.order - y.order));
    if (!task) task = getTask(ui.focusPick) && !getTask(ui.focusPick).done ? getTask(ui.focusPick) : candidates[0];
    const [a, b] = dayRange(t);
    const doneToday = state.tasks.filter((x) => x.done && x.doneAt && x.doneAt >= a && x.doneAt < b).length;
    if (!task) {
      return `<div class="focus"><div class="ftop"><button data-act="go" data-view="home">← Zurück</button><span>Fokus</span></div>
        <div class="pill">Nichts offen für heute</div>
        <h2>Was ist heute die eine wichtige Sache?</h2>
        <form class="addrow" data-form="add" data-date="${t}" data-mode="focus" style="width:min(460px,90vw);margin-top:20px"><input placeholder="Aufgabe eingeben und Enter drücken…" /></form>
        <div class="today-line">${doneToday ? `${doneToday} heute erledigt · ` : ''}${fmtDur(timeIn(a, b))} heute gemessen</div></div>`;
    }
    const q = getQuest(task.questId);
    const isRun = r && r.taskId === task.id;
    const others = candidates.filter((x) => x.id !== task.id);
    return `<div class="focus" style="--qc:${q ? q.color : 'var(--dim)'}">
      <div class="ftop"><button data-act="go" data-view="home">← Zurück</button><span>${isRun ? '<span class="live-dot"></span>' : ''}Fokus · ${esc(q ? q.name : 'Sonstiges')}</span></div>
      <span class="pill"><i></i>${esc(q ? q.name : 'Keine Quest')}</span>
      <h2>${esc(task.title)}</h2>
      <div class="clock" data-live-focus="${task.id}">${fmtClock(taskTime(task.id))}</div>
      <div class="state">${isRun ? 'Läuft' : 'Pausiert'}</div>
      <div class="actions">
        ${isRun ? '<button class="btn" data-act="pause">❚❚ Pause</button>' : `<button class="btn gold" data-act="start" data-id="${task.id}">▶ Start</button>`}
        <button class="btn" data-act="complete" data-id="${task.id}">✓ Abschließen</button>
      </div>
      ${others.length && !isRun ? `<div class="pick">Andere Aufgabe: <select data-role="focuspick"><option value="">— wählen —</option>${others.map((x) => `<option value="${x.id}">${esc(x.title)}${getQuest(x.questId) ? ' · ' + esc(getQuest(x.questId).name) : ''}</option>`).join('')}</select></div>` : ''}
      <div class="today-line">Leertaste: Start/Pause · Enter: Abschließen${doneToday ? ` · ${doneToday} heute erledigt` : ''}</div>
    </div>`;
  }

  // ---------- Quests ----------
  function sparkline(values, color) {
    const w = 90, h = 30, max = Math.max(1, ...values);
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - (v / max) * (h - 6)}`).join(' ');
    const last = pts.split(' ').pop().split(',');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.2" fill="${color}"/></svg>`;
  }
  function questWeekHours(qid, ws) {
    const [a, b] = weekRange(ws);
    return timeIn(a, b, (s) => sQuest(s) === qid);
  }
  function renderQuests() {
    const ws = weekStart(todayISO());
    const total = timeIn(0, 8.64e15, isQuestSession);
    const active = activeQuests();
    const completed = state.quests.filter((q) => q.status === 'completed');
    const list = ui.questTab === 'completed' ? completed : active;
    return `<div class="page-head">
        <div><h1>Quests</h1><div class="sub">Gib deiner Zeit einen Sinn. Schaffe Raum für das, was kommt.</div></div>
        <div class="right"><button class="btn gold" data-act="new-quest">＋ Neue Quest</button></div>
      </div>
      <div class="card stats3">
        <div><div class="label" style="text-transform:none;letter-spacing:0">Quest-Stunden · gesamt</div><div class="v">${fmtDur(total)}</div></div>
        <div><div class="label" style="text-transform:none;letter-spacing:0">In Arbeit</div><div class="v">${pad(active.length)}</div></div>
        <div><div class="label" style="text-transform:none;letter-spacing:0">🏆 Abgeschlossen</div><div class="v">${pad(completed.length)}</div></div>
      </div>
      <div style="display:flex;align-items:center;margin-top:20px;gap:12px">
        <div class="seg"><button class="${ui.questTab !== 'completed' ? 'on' : ''}" data-act="qtab" data-tab="active">Aktiv · ${active.length}</button><button class="${ui.questTab === 'completed' ? 'on' : ''}" data-act="qtab" data-tab="completed">Abgeschlossen · ${completed.length}</button></div>
        <span class="muted small" style="margin-left:auto">Kleine Schritte. Großer Fortschritt.</span>
      </div>
      <div class="muted small" style="margin-top:12px">Klicke auf eine Quest, um sie zu bearbeiten oder abzuschließen.</div>
      <div class="qgrid">
        ${list.map((q) => {
          const weeks = [...Array(8)].map((_, i) => questWeekHours(q.id, addDays(ws, (i - 7) * 7)) / 3600000);
          const tot = timeIn(0, 8.64e15, (s) => sQuest(s) === q.id);
          return `<div class="card qcard" data-act="edit-quest" data-id="${q.id}">
            <div class="qtop"><div class="qicon">${esc(q.icon || '✦')}</div><div><div class="qname">${esc(q.name)}</div>${q.description ? `<div class="qdesc">${esc(q.description)}</div>` : ''}</div></div>
            <div class="qbottom"><div><div class="qhours">${fmtDur(questWeekHours(q.id, ws))}</div><div class="qsmall">Diese Woche</div></div>
            <div>${sparkline(weeks, q.color)}<div class="qtotal">${fmtDur(tot)} gesamt</div></div></div>
          </div>`;
        }).join('')}
        ${ui.questTab !== 'completed' ? '<button class="card qcard new" data-act="new-quest"><span class="plus">＋</span>Neue Quest</button>' : ''}
      </div>
      ${!list.length && ui.questTab === 'completed' ? '<div class="empty-big">Noch keine abgeschlossenen Quests.</div>' : ''}`;
  }

  // ---------- Review ----------
  function renderReview() {
    const t = todayISO();
    if (!ui.reviewWeek) ui.reviewWeek = weekStart(t);
    const ws = ui.reviewWeek;
    const days = [...Array(7)].map((_, i) => addDays(ws, i));
    const [a, b] = weekRange(ws);
    const qTime = questTimeIn(a, b);
    const all = timeIn(a, b);
    const other = all - qTime;
    const target = (state.settings.weeklyTarget || 20) * 3600000;
    const elapsedDays = Math.max(1, Math.min(7, Math.floor((Math.min(now(), b) - a) / 86400000) + (now() < b ? 1 : 0)));
    const perDay = days.map((d) => { const [x, y] = dayRange(d); return timeIn(x, y, isQuestSession); });
    const maxDay = Math.max(3600000, ...perDay);
    const byQuest = state.quests.map((q) => ({ q, ms: timeIn(a, b, (s) => sQuest(s) === q.id) })).filter((x) => x.ms > 0).sort((x, y) => y.ms - x.ms);
    const maxQ = Math.max(1, ...byQuest.map((x) => x.ms));
    const weeks = [...Array(8)].map((_, i) => { const w = addDays(ws, (i - 7) * 7); const [x, y] = weekRange(w); return { w, ms: questTimeIn(x, y) }; });
    const prev4 = weeks.slice(-4).map((x) => x.ms); const avg4 = prev4.reduce((s, x) => s + x, 0) / 4;
    const review = state.reviews.find((r) => r.id === 'w_' + ws) || {};
    const doneTasks = state.tasks.filter((x) => x.done && x.doneAt >= a && x.doneAt < b).sort((x, y) => x.doneAt - y.doneAt);
    const doneByDay = days.map((d) => { const [x, y] = dayRange(d); return { d, items: doneTasks.filter((k) => k.doneAt >= x && k.doneAt < y) }; }).filter((g) => g.items.length);
    const isCur = ws === weekStart(t);
    return `<div class="page-head">
        <div><h1>Wochen-Review</h1><div class="sub">Wie viel hat diese Woche deine Quests vorangebracht?</div></div>
        <div class="right weeknav"><button class="iconb" data-act="rev-shift" data-n="-7">‹</button><span class="range">${fmtRange(ws)}</span><button class="iconb" data-act="rev-shift" data-n="7">›</button><button class="btn ghost" data-act="rev-today">${isCur ? '◷ Diese Woche' : 'Zu dieser Woche'}</button></div>
      </div>
      <div class="rgrid three">
        <div class="card kpi"><div class="label">Quest-Stunden</div><div class="v gold">${fmtDur(qTime)} <small>/ ${state.settings.weeklyTarget}h</small></div><div class="s">${Math.round((qTime / target) * 100)} % vom Ziel</div></div>
        <div class="card kpi"><div class="label">Tagesdurchschnitt</div><div class="v">${fmtDur(all / elapsedDays)}</div><div class="s">über ${elapsedDays} Tag${elapsedDays > 1 ? 'e' : ''}</div></div>
        <div class="card kpi"><div class="label">Quest-Arbeit vs. Sonstiges</div><div class="v">${all ? Math.round((qTime / all) * 100) : 0} <small>%</small></div><div class="s">${doneTasks.length} Aufgaben erledigt</div></div>
      </div>
      <div class="rgrid two" style="margin-top:14px">
        <div class="card panel"><div class="label">Quest-Stunden · pro Tag</div>
          ${perDay.some((x) => x > 0) ? '' : '<div class="empty" style="padding:8px 0 0">Diese Woche noch keine Quest-Zeit gemessen.</div>'}
          <div class="bars">${days.map((d, i) => `<div class="b${d === t ? ' cur' : ''}"><span class="t">${fmtDur(perDay[i])}</span><div class="col" style="height:${(perDay[i] / maxDay) * 140}px"></div><span class="d">${WD[fromISO(d).getDay()]}</span></div>`).join('')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card panel"><div class="label">Stunden nach Quest</div>
            <div class="hbars">${byQuest.length ? byQuest.map((x) => `<div class="hbar"><span class="n"><i style="background:${x.q.color}"></i>${esc(x.q.name)}</span><span class="track"><div style="width:${(x.ms / maxQ) * 100}%;background:${x.q.color}"></div></span><span class="val">${fmtDur(x.ms)}</span></div>`).join('') : '<div class="empty">Diese Woche noch keine Quest-Zeit gemessen.</div>'}</div>
          </div>
          <div class="card panel"><div class="label">Quest-Arbeit vs. Sonstiges</div>
            <div class="split"><div style="width:${all ? (qTime / all) * 100 : 0}%"></div></div>
            <div class="legend"><span><i style="background:var(--gold)"></i>Quest-Arbeit · ${fmtDur(qTime)}</span><span><i style="background:var(--card-3)"></i>Sonstiges · ${fmtDur(other)}</span></div>
          </div>
        </div>
      </div>
      <div class="card panel" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start"><div class="label">Quest-Stunden · letzte Wochen</div>
          <div style="text-align:right"><div class="small muted">— Ø 4 Wochen</div><div style="font-size:22px;color:var(--gold)" class="num">${fmtDur(avg4)} <small class="muted" style="font-size:12px">/Woche</small></div></div></div>
        ${weeksChart(weeks, ws)}
      </div>
      <div class="card panel" style="margin-top:14px">
        <div class="label">Ritualisierte Reflexion</div>
        <div class="reflect" data-review="${ws}">
          <div><label>Was lief diese Woche gut?</label><textarea data-rf="good" placeholder="Erfolge, auch kleine…">${esc(review.good || '')}</textarea></div>
          <div><label>Was hat mich gebremst?</label><textarea data-rf="bad" placeholder="Ablenkungen, Hindernisse…">${esc(review.bad || '')}</textarea></div>
          <div><label>Fokus für nächste Woche</label><textarea data-rf="next" placeholder="Die eine Sache, die zählt…">${esc(review.next || '')}</textarea></div>
        </div>
      </div>
      <div class="card panel donelist" style="margin-top:14px">
        <div class="label">Done-Liste · ${doneTasks.length} erledigt</div>
        ${doneByDay.length ? doneByDay.map((g) => `<div class="day"><div class="label" style="color:var(--dim)">${longDate(g.d)}</div>${g.items.map((k) => {
          const q = getQuest(k.questId); const tm = taskTime(k.id);
          return `<div class="item" style="--qc:${q ? q.color : 'var(--teal)'}"><span class="chk on">✓</span><span>${esc(k.title)}</span>${q ? `<span class="qchip muted small"><i></i>${esc(q.name)}</span>` : ''}<span class="t">${tm ? fmtDur(tm) : ''}</span></div>`;
        }).join('')}</div>`).join('') : '<div class="empty">Noch nichts erledigt in dieser Woche.</div>'}
      </div>`;
  }
  function weeksChart(weeks, curWs) {
    // HTML-Balken + SVG-Linie ohne Verzerrung (Text/Punkte bleiben bei jeder Breite sauber)
    if (!weeks.some((w) => w.ms > 0)) {
      return `<div class="weeks-chart empty"><div><div style="font-size:22px">◷</div>Noch keine Quest-Stunden in den letzten 8 Wochen.<br>Starte bei einer Aufgabe den ▶-Timer – hier entsteht dann dein Verlauf.</div></div>`;
    }
    const max = Math.max(3600000, ...weeks.map((w) => w.ms));
    const avgs = weeks.map((_, i) => { const sl = weeks.slice(Math.max(0, i - 3), i + 1); return sl.reduce((s, x) => s + x.ms, 0) / sl.length; });
    const n = weeks.length;
    const xPct = (i) => ((i + 0.5) / n) * 100;
    const yPct = (ms) => 100 - (ms / max) * 100;
    const pts = avgs.map((v, i) => `${xPct(i)},${yPct(v)}`).join(' ');
    return `<div class="weeks-chart">
      <div class="wc-plot">
        <div class="wc-bars">${weeks.map((w) => `<div class="wc-b${w.w === curWs ? ' cur' : ''}" title="${fmtRange(w.w)}: ${fmtDur(w.ms)}"><span class="wc-v">${w.ms ? fmtDur(w.ms) : ''}</span><div style="height:${(w.ms / max) * 100}%"></div></div>`).join('')}</div>
        <svg class="wc-line" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" vector-effect="non-scaling-stroke"/></svg>
        ${avgs.map((v, i) => `<i class="wc-dot" style="left:${xPct(i)}%;top:${yPct(v)}%" title="Ø 4 Wochen: ${fmtDur(v)}"></i>`).join('')}
      </div>
      <div class="wc-labels">${weeks.map((w) => { const d = fromISO(w.w); return `<span class="${w.w === curWs ? 'cur' : ''}">${d.getDate()}.${d.getMonth() + 1}.</span>`; }).join('')}</div>
    </div>`;
  }

  // ---------- Running bar (mobile) & live tick ----------
  function renderRunbar() {
    const rb = $('#runbar'); const r = running();
    if (!r || ui.view === 'focus') { rb.hidden = true; return; }
    const t = getTask(r.taskId);
    rb.hidden = false;
    rb.style.setProperty('--qc', qColor(sQuest(r)));
    rb.innerHTML = `<span class="rt" data-act="go" data-view="focus">${esc(t?.title || '')}</span><span class="rc" data-live-task="${r.taskId}">${fmtClock(taskTime(r.taskId))}</span><button class="iconb" data-act="pause">❚❚</button><button class="iconb" data-act="complete" data-id="${r.taskId}">✓</button>`;
  }
  let lastMinute = -1;
  function tick() {
    const r = running();
    if (r) {
      const tt = fmtClock(taskTime(r.taskId));
      $$(`[data-live-task="${r.taskId}"]`).forEach((el) => (el.textContent = tt));
      $$(`[data-live-focus="${r.taskId}"]`).forEach((el) => (el.textContent = tt));
      const t = getTask(r.taskId);
      document.title = `${tt} · ${t?.title || 'Quest'}`;
    } else document.title = 'Quest';
    const el = $('[data-live-today]');
    if (el && r) {
      const [a, b] = dayRange(todayISO()); const ms = timeIn(a, b);
      el.innerHTML = `${Math.floor(ms / 3600000)}<small>h</small>${pad(Math.floor((ms % 3600000) / 60000))}<small>m</small>`;
      const wp = weekProgress();
      const w = $('[data-live-week]'); if (w) w.textContent = fmtDur(wp.w);
      const wb = $('[data-live-weekbar]'); if (wb) wb.style.width = wp.pct + '%';
    }
    // Zeitleisten jede Minute neu zeichnen (laufender Block wächst, Jetzt-Linie wandert)
    const m = new Date().getMinutes();
    if (m !== lastMinute) {
      const first = lastMinute === -1; lastMinute = m;
      if (!first && ['home', 'calendar'].includes(ui.view) && !isTyping()) render();
    }
  }
  const isTyping = () => { const a = document.activeElement; return a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName); };

  // ================= Dialogs =================
  const dlg = () => $('#dialog');
  function openDialog(html, onMount) {
    const d = dlg(); d.innerHTML = html; d.showModal(); onMount && onMount(d);
    $$('[data-close]', d).forEach((b) => (b.onclick = () => d.close()));
  }
  const questOptions = (sel) => `<option value="">Keine Quest (Sonstiges)</option>${activeQuests().map((q) => `<option value="${q.id}"${q.id === sel ? ' selected' : ''}>${esc(q.name)}</option>`).join('')}${sel && getQuest(sel)?.status === 'completed' ? `<option value="${sel}" selected>${esc(getQuest(sel).name)} (abgeschlossen)</option>` : ''}`;

  function taskDialog(id) {
    const t = getTask(id); if (!t) return;
    const tm = taskTime(id);
    openDialog(`<form method="dialog" id="tf"><h2>Aufgabe</h2>
      <div class="field"><label>Titel</label><input type="text" name="title" value="${esc(t.title)}" required maxlength="200" /></div>
      <div class="row2">
        <div class="field"><label>Quest</label><select name="quest">${questOptions(t.questId)}</select></div>
        <div class="field"><label>Tag</label><input type="date" name="date" value="${t.date || ''}" /></div>
      </div>
      <div class="field"><label>Notizen</label><textarea name="notes" rows="3">${esc(t.notes || '')}</textarea></div>
      <div class="field"><label>Gemessene Zeit: ${fmtDur(tm)}</label>
        <div style="display:flex;gap:8px"><input type="number" name="addmin" min="1" max="1440" placeholder="Minuten nachtragen" class="input" style="flex:1" /><button type="button" class="btn" id="addmin">＋ Nachtragen</button></div></div>
      <div class="dlg-actions">
        <button type="button" class="btn danger left" id="del">Löschen</button>
        <button type="button" class="btn" id="focusbtn">◎ Fokus</button>
        <button type="button" class="btn" data-close>Abbrechen</button>
        <button type="submit" class="btn gold">Speichern</button>
      </div></form>`, (d) => {
      const f = $('#tf', d);
      f.onsubmit = (e) => {
        e.preventDefault();
        t.title = f.title.value.trim() || t.title; t.questId = f.quest.value || null; t.date = f.date.value || null; t.notes = f.notes.value;
        d.close(); commit();
      };
      $('#del', d).onclick = () => { d.close(); deleteTask(id); };
      $('#focusbtn', d).onclick = () => { d.close(); ui.focusPick = id; go('focus'); };
      $('#addmin', d).onclick = () => {
        const m = Number(f.addmin.value); if (!m) return;
        const end = now(); state.sessions.push({ id: uid(), taskId: id, questId: t.questId, start: end - m * 60000, end, manual: true });
        d.close(); commit(); toast(`${m} Minuten nachgetragen`);
      };
    });
  }

  function questDialog(id) {
    const q = id ? getQuest(id) : null;
    let color = q?.color || QCOLORS[state.quests.length % QCOLORS.length];
    let icon = q?.icon || QICONS[state.quests.length % QICONS.length];
    openDialog(`<form method="dialog" id="qf"><h2>${q ? 'Quest bearbeiten' : 'Neue Quest'}</h2>
      <div class="field"><label>Name</label><input type="text" name="name" value="${esc(q?.name || '')}" placeholder="z. B. Gesundheit, Business, Studium" required maxlength="40" /></div>
      <div class="field"><label>Ziel / Beschreibung</label><input type="text" name="desc" value="${esc(q?.description || '')}" placeholder="z. B. Marathon unter 4h im Oktober" maxlength="80" /></div>
      <div class="field"><label>Symbol</label><div class="icons">${QICONS.map((i) => `<button type="button" data-icon="${i}" class="${i === icon ? 'on' : ''}">${i}</button>`).join('')}</div></div>
      <div class="field"><label>Farbe</label><div class="swatches">${QCOLORS.map((c) => `<button type="button" data-color="${c}" class="${c === color ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div></div>
      <div class="dlg-actions">
        ${q ? `<button type="button" class="btn danger left" id="del">Löschen</button><button type="button" class="btn" id="complete">${q.status === 'completed' ? '↺ Reaktivieren' : '🏆 Abschließen'}</button>` : ''}
        <button type="button" class="btn" data-close>Abbrechen</button>
        <button type="submit" class="btn gold">Speichern</button>
      </div></form>`, (d) => {
      $$('[data-color]', d).forEach((b) => (b.onclick = () => { color = b.dataset.color; $$('[data-color]', d).forEach((x) => x.classList.toggle('on', x === b)); }));
      $$('[data-icon]', d).forEach((b) => (b.onclick = () => { icon = b.dataset.icon; $$('[data-icon]', d).forEach((x) => x.classList.toggle('on', x === b)); }));
      const f = $('#qf', d);
      f.onsubmit = (e) => {
        e.preventDefault();
        const name = f.name.value.trim(); if (!name) return;
        if (q) Object.assign(q, { name, description: f.desc.value.trim(), color, icon });
        else { const nq = { id: uid(), name, description: f.desc.value.trim(), color, icon, status: 'active', order: state.quests.length, createdAt: now() }; state.quests.push(nq); ui.lastQuest = nq.id; }
        d.close(); commit();
      };
      if (q) {
        $('#complete', d).onclick = () => {
          q.status = q.status === 'completed' ? 'active' : 'completed'; q.completedAt = q.status === 'completed' ? now() : null;
          d.close(); commit(); if (q.status === 'completed') toast(`🏆 Quest „${q.name}“ abgeschlossen!`);
        };
        $('#del', d).onclick = () => {
          const n = state.tasks.filter((t) => t.questId === q.id).length;
          if (!confirm(`Quest „${q.name}“ löschen?${n ? `\n${n} Aufgabe(n) werden zu „Sonstiges“.` : ''}\nGemessene Zeiten bleiben erhalten.`)) return;
          state.tasks.forEach((t) => { if (t.questId === q.id) t.questId = null; });
          state.quests = state.quests.filter((x) => x.id !== q.id);
          d.close(); commit();
        };
      }
    });
  }

  function sessionDialog(id) {
    const s = id ? state.sessions.find((x) => x.id === id) : null;
    const dayISO = s ? toISO(new Date(s.start)) : todayISO();
    const tasks = state.tasks.filter((t) => !t.done || t.id === s?.taskId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const endVal = s ? (s.end == null ? '' : fmtHM(s.end)) : fmtHM(now());
    const startVal = s ? fmtHM(s.start) : fmtHM(now() - 3600000);
    openDialog(`<form method="dialog" id="sf"><h2>${s ? 'Zeiteintrag' : 'Zeit eintragen'}</h2>
      <div class="field"><label>Aufgabe</label><select name="task" required>${s && !getTask(s.taskId) ? '<option value="">(gelöschte Aufgabe)</option>' : ''}${tasks.map((t) => `<option value="${t.id}"${t.id === s?.taskId ? ' selected' : ''}>${esc(t.title)}${getQuest(t.questId) ? ' · ' + esc(getQuest(t.questId).name) : ''}</option>`).join('')}</select></div>
      <div class="row3">
        <div class="field"><label>Tag</label><input type="date" name="day" value="${dayISO}" required /></div>
        <div class="field"><label>Von</label><input type="time" name="from" value="${startVal}" required /></div>
        <div class="field"><label>Bis</label><input type="time" name="to" value="${endVal}" ${s && s.end == null ? 'disabled placeholder="läuft"' : 'required'} /></div>
      </div>
      ${s && s.end == null ? '<p class="muted small">Dieser Eintrag läuft gerade.</p>' : ''}
      <div class="dlg-actions">
        ${s ? '<button type="button" class="btn danger left" id="del">Löschen</button>' : ''}
        <button type="button" class="btn" data-close>Abbrechen</button>
        <button type="submit" class="btn gold">Speichern</button>
      </div></form>`, (d) => {
      const f = $('#sf', d);
      if (!tasks.length && !s) { f.task.outerHTML = '<p class="muted small">Lege zuerst eine Aufgabe an.</p>'; }
      f.onsubmit = (e) => {
        e.preventDefault();
        const taskId = f.task?.value; if (!taskId && !s) return;
        const base = dayStartMs(f.day.value);
        const [fh, fm] = f.from.value.split(':').map(Number);
        const start = base + (fh * 60 + fm) * 60000;
        let end = null;
        if (!(s && s.end == null)) {
          const [th, tm] = f.to.value.split(':').map(Number);
          end = base + (th * 60 + tm) * 60000; if (end <= start) end += 86400000;
        }
        if (s) { Object.assign(s, { start, end, taskId: taskId || s.taskId }); s.questId = getTask(s.taskId)?.questId ?? s.questId; }
        else state.sessions.push({ id: uid(), taskId, questId: getTask(taskId)?.questId || null, start, end, manual: true });
        d.close(); commit();
      };
      if (s) $('#del', d).onclick = () => {
        const idx = state.sessions.indexOf(s); state.sessions.splice(idx, 1); d.close(); commit();
        toast('Zeiteintrag gelöscht', () => { state.sessions.splice(idx, 0, s); commit(); });
      };
    });
  }

  function recurringDialog() {
    const list = state.recurring;
    const dayBoxes = [1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="d" value="${d}" ${d >= 1 && d <= 5 ? 'checked' : ''}/>${WD[d]}</label>`).join('');
    openDialog(`<h2>Wiederkehrende Aufgaben</h2>
      <div class="rlist">${list.length ? list.map((r) => `<div class="r" style="--qc:${qColor(r.questId)}"><div>${esc(r.title)}<br><small>${r.days.length === 7 ? 'Täglich' : [1, 2, 3, 4, 5, 6, 0].filter((d) => r.days.includes(d)).map((d) => WD[d]).join(', ')}${getQuest(r.questId) ? ' · ' + esc(getQuest(r.questId).name) : ''}</small></div><button class="iconb" data-rdel="${r.id}" title="Löschen">✕</button></div>`).join('') : '<div class="empty">Noch keine. Z. B. „Morning Check-in“ jeden Tag.</div>'}</div>
      <form id="rf">
        <div class="field"><label>Neue Routine</label><input type="text" name="title" placeholder="z. B. Weekly Planning" required maxlength="120" /></div>
        <div class="field"><label>Quest</label><select name="quest">${questOptions(null)}</select></div>
        <div class="field"><label>Tage</label><div class="days7">${dayBoxes}</div></div>
        <div class="dlg-actions"><button type="button" class="btn" data-close>Fertig</button><button type="submit" class="btn gold">＋ Hinzufügen</button></div>
      </form>`, (d) => {
      $('#rf', d).onsubmit = (e) => {
        e.preventDefault(); const f = e.target;
        const days = $$('input[name=d]:checked', f).map((x) => Number(x.value)); if (!days.length) { toast('Mindestens einen Tag wählen'); return; }
        state.recurring.push({ id: uid(), title: f.title.value.trim(), questId: f.quest.value || null, days, order: state.recurring.length, createdAt: dayStartMs(todayISO()) });
        save(); ensureRecurring(todayISO(), addDays(todayISO(), 14)); render(); recurringDialog();
      };
      $$('[data-rdel]', d).forEach((b) => (b.onclick = () => {
        const id = b.dataset.rdel;
        state.recurring = state.recurring.filter((r) => r.id !== id);
        state.tasks = state.tasks.filter((t) => !(t.recurringId === id && !t.done && t.date >= todayISO()));
        commit(); recurringDialog();
      }));
    });
  }

  function settingsDialog() {
    const link = sync ? syncLink() : '';
    openDialog(`<h2>Einstellungen</h2>
      <div class="field"><label>Wochenziel Quest-Stunden</label><input type="number" id="wt" min="1" max="100" value="${state.settings.weeklyTarget}" /></div>
      <hr class="sep" />
      <div class="field"><label>Mac & Handy synchronisieren</label>
        ${sync ? `<p class="small muted" style="margin-top:0">Status: <b style="color:var(--text)">${syncLabel()}</b>. Auf weiteren Geräten einfach mit demselben Sync-Passwort anmelden – oder diesen Link öffnen:</p>
          <div class="keybox" id="synclink">${esc(link)}</div>
          <div class="dlg-actions" style="justify-content:flex-start"><button class="btn gold" id="copy">Link kopieren</button>${navigator.share ? '<button class="btn" id="share">Teilen…</button>' : ''}<button class="btn" id="syncnow">Jetzt synchronisieren</button><button class="btn danger" id="unlink">Trennen</button></div>
          <p class="small muted">Wer diesen Link hat, kann deine Aufgaben sehen – teile ihn nur mit dir selbst.</p>`
        : `<p class="small muted" style="margin-top:0">Sync ist aus. Melde dich auf jedem Gerät einmal mit demselben Sync-Passwort an – danach gleichen sich Mac und Handy automatisch ab.</p>
          <div class="dlg-actions" style="justify-content:flex-start"><button class="btn gold" id="pwsetup">☁︎ Mit Sync-Passwort verbinden</button></div>`}
      </div>
      <hr class="sep" />
      <div class="field"><label>Daten</label><div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="export">⬇ Export (JSON)</button>
        <label class="btn" style="cursor:pointer">⬆ Import<input type="file" id="import" accept="application/json" hidden /></label>
        <button class="btn" id="help">⌨ Tastenkürzel</button></div></div>
      <div class="dlg-actions"><button class="btn gold" data-close>Fertig</button></div>`, (d) => {
      $('#wt', d).onchange = (e) => { state.settings.weeklyTarget = Math.max(1, Math.min(100, Number(e.target.value) || 20)); commit(); };
      if (sync) {
        $('#copy', d).onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link kopiert'); } catch { const r = document.createRange(); r.selectNodeContents($('#synclink', d)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Link markiert – jetzt kopieren'); } };
        $('#share', d) && ($('#share', d).onclick = () => navigator.share({ title: 'Quest Sync-Link', url: link }).catch(() => {}));
        $('#syncnow', d).onclick = () => { doSync(); };
        $('#unlink', d).onclick = () => { if (!confirm('Dieses Gerät vom Sync trennen? Die Daten bleiben hier erhalten.')) return; sync = null; localStorage.removeItem(SYNC_KEY); setSyncStatus('off'); d.close(); };
      } else {
        $('#pwsetup', d).onclick = () => { d.close(); syncPasswordDialog(); };
      }
      $('#export', d).onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
        a.download = `quest-backup-${todayISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      $('#import', d).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const data = normalize(JSON.parse(await file.text()));
          if (!confirm(`${data.tasks.length} Aufgaben und ${data.quests.length} Quests importieren und mit den aktuellen Daten zusammenführen?`)) return;
          state = mergeStates(state, data); resetSnap(); stamp(true); persist(); d.close(); render(); scheduleSync(); toast('Import erfolgreich');
        } catch (err) { toast('Import fehlgeschlagen: ' + err.message); }
      };
      $('#help', d).onclick = helpDialog;
    });
  }


  // ---------- Sync per Passwort (einmal pro Gerät) ----------
  async function passwordToKey(pw) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('quest-sync-v1'), iterations: 250000 }, base, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function syncPasswordDialog(firstRun = false) {
    openDialog(`<form id="pwf" autocomplete="on"><h2>☁︎ Mac & Handy verbinden</h2>
      <p class="small muted" style="margin-top:0">Gib auf <b>jedem Gerät einmal dasselbe Sync-Passwort</b> ein. Danach synchronisiert die App automatisch – du musst nie wieder etwas tun.</p>
      <input type="text" name="username" value="Quest Sync" autocomplete="username" hidden readonly />
      <div class="field"><label>Sync-Passwort</label><input type="password" class="input" name="pw" autocomplete="current-password" minlength="8" required placeholder="mind. 8 Zeichen" /></div>
      <div class="field" id="pw2wrap" hidden><label>Neues Passwort wiederholen</label><input type="password" class="input" name="pw2" autocomplete="new-password" placeholder="zur Sicherheit nochmal" /></div>
      <p class="small muted" id="pwmsg"></p>
      <div class="dlg-actions">${firstRun ? '<button type="button" class="btn ghost left" data-close>Später</button>' : '<button type="button" class="btn left" data-close>Abbrechen</button>'}<button type="submit" class="btn gold" id="pwgo">Verbinden</button></div>
    </form>`, (d) => {
      const f = $('#pwf', d); let creating = false;
      f.pw.focus();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const pw = f.pw.value; const msg = $('#pwmsg', d); const btn = $('#pwgo', d);
        if (pw.length < 8) { msg.textContent = 'Bitte mindestens 8 Zeichen.'; return; }
        btn.disabled = true; btn.textContent = 'Prüfe…'; msg.textContent = '';
        try {
          const key = await passwordToKey(pw);
          if (!creating) {
            const remote = await rpc('tm_pull', { p_key: key });
            if (!remote.exists) {
              creating = true; $('#pw2wrap', d).hidden = false; f.pw2.focus();
              msg.textContent = 'Für dieses Passwort gibt es noch keinen Sync. Wiederhole es, um ihn neu anzulegen – nutze danach auf allen Geräten genau dieses Passwort.';
              btn.disabled = false; btn.textContent = 'Sync anlegen'; return;
            }
          } else if (f.pw2.value !== pw) { msg.textContent = 'Die Passwörter stimmen nicht überein.'; btn.disabled = false; btn.textContent = 'Sync anlegen'; return; }
          localStorage.setItem('quest.syncPrompted', '1');
          d.close();
          await connectSync(key, creating);
        } catch (err) {
          msg.textContent = 'Verbindung fehlgeschlagen – bist du online? (' + err.message + ')';
          btn.disabled = false; btn.textContent = creating ? 'Sync anlegen' : 'Verbinden';
        }
      };
      d.addEventListener('close', () => localStorage.setItem('quest.syncPrompted', '1'), { once: true });
    });
  }

  function helpDialog() {
    const rows = [['1 – 6', 'Home, Plan, Kalender, Fokus, Quests, Review'], ['⌘K oder /', 'Suchen & springen'], ['N', 'Neue Aufgabe'], ['Leertaste', 'Fokus: Start / Pause'], ['Enter', 'Fokus: Abschließen'], ['Esc', 'Schließen / zurück']];
    openDialog(`<h2>Tastenkürzel</h2><table style="width:100%;font-size:13px">${rows.map(([k, v]) => `<tr><td style="padding:5px 0"><kbd class="pill">${k}</kbd></td><td class="muted">${v}</td></tr>`).join('')}</table>
      <p class="small muted">Tipp: Beim Hinzufügen kannst du mit <b>#Questname</b> direkt eine Quest zuordnen.</p>
      <div class="dlg-actions"><button class="btn gold" data-close>OK</button></div>`);
  }

  // ---------- Command palette ----------
  function openPalette() {
    const p = $('#palette'); p.hidden = false;
    p.innerHTML = `<div class="box"><input placeholder="Aufgabe suchen oder Ansicht öffnen…" autocomplete="off" /><div class="res"></div></div>`;
    const input = $('input', p), res = $('.res', p);
    let items = [], sel = 0;
    const views = Object.entries(TITLES).map(([k, v]) => ({ type: 'view', id: k, label: v, hint: 'Ansicht' }));
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const vs = views.filter((v) => !q || v.label.toLowerCase().includes(q));
      const ts = q ? state.tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 30) : state.tasks.filter((t) => !t.done && t.date === todayISO()).slice(0, 8);
      const qs = state.quests.filter((x) => q && x.name.toLowerCase().includes(q));
      items = [...vs, ...qs.map((x) => ({ type: 'quest', id: x.id, label: x.name, hint: 'Quest', color: x.color })),
        ...ts.map((t) => ({ type: 'task', id: t.id, label: t.title, hint: (t.done ? '✓ ' : '') + (t.date ? fmtDay(t.date) : ''), color: qColor(t.questId) }))];
      sel = Math.min(sel, Math.max(0, items.length - 1));
      res.innerHTML = items.map((it, i) => `<div class="it${i === sel ? ' sel' : ''}" data-i="${i}" style="--qc:${it.color || 'var(--dim)'}">${it.type === 'view' ? '→' : '<i></i>'}<span>${esc(it.label)}</span><small>${esc(it.hint)}</small></div>`).join('') || '<div class="empty" style="padding:12px">Nichts gefunden</div>';
    };
    const choose = (it) => {
      if (!it) return; closePalette();
      if (it.type === 'view') go(it.id);
      else if (it.type === 'quest') { go('quests'); questDialog(it.id); }
      else taskDialog(it.id);
    };
    input.oninput = () => { sel = 0; draw(); };
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { choose(items[sel]); e.preventDefault(); }
      else if (e.key === 'Escape') closePalette();
    };
    res.onclick = (e) => { const el = e.target.closest('[data-i]'); if (el) choose(items[Number(el.dataset.i)]); };
    p.onclick = (e) => { if (e.target === p) closePalette(); };
    draw(); input.focus();
  }
  const fmtDay = (iso) => { const t = todayISO(); if (iso === t) return 'Heute'; if (iso === addDays(t, 1)) return 'Morgen'; if (iso === addDays(t, -1)) return 'Gestern'; const d = fromISO(iso); return `${WD[d.getDay()]} ${d.getDate()}. ${MON[d.getMonth()]}`; };
  function closePalette() { $('#palette').hidden = true; $('#palette').innerHTML = ''; }

  // ---------- Toast ----------
  let toastT;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Rückgängig</button>' : ''}`;
    if (undo) $('button', el).onclick = () => { undo(); el.classList.remove('show'); };
    el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 4200);
  }

  // ================= Events =================
  function go(view) { ui.view = view; saveUI(); render(); window.scrollTo(0, 0); }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    switch (act) {
      case 'go': go(el.dataset.view); break;
      case 'toggle': toggleDone(id); break;
      case 'start': startTask(id); break;
      case 'pause': pauseTimer(); break;
      case 'complete': completeTask(id); break;
      case 'edit-task': taskDialog(id); break;
      case 'edit-quest': questDialog(id); break;
      case 'new-quest': questDialog(null); break;
      case 'edit-session': sessionDialog(id); break;
      case 'add-session': sessionDialog(null); break;
      case 'recurring': recurringDialog(); break;
      case 'settings': settingsDialog(); break;
      case 'sync-setup': syncPasswordDialog(); break;
      case 'palette': openPalette(); break;
      case 'showdone': ui.showDone = !ui.showDone; render(); break;
      case 'pos': ui.addPos = el.dataset.pos; saveUI(); $$('[data-act="pos"]').forEach((b) => b.classList.toggle('on', b.dataset.pos === ui.addPos)); break;
      case 'qtab': ui.questTab = el.dataset.tab; saveUI(); render(); break;
      case 'plan-shift': ui.planStart = addDays(ui.planStart, Number(el.dataset.n)); render(); break;
      case 'plan-today': ui.planStart = addDays(todayISO(), -2); render(); break;
      case 'cal-shift': ui.calWeek = addDays(ui.calWeek, Number(el.dataset.n)); render(); break;
      case 'cal-today': ui.calWeek = weekStart(todayISO()); render(); break;
      case 'rev-shift': ui.reviewWeek = addDays(ui.reviewWeek, Number(el.dataset.n)); render(); break;
      case 'rev-today': ui.reviewWeek = weekStart(todayISO()); render(); break;
      case 'move-overdue': {
        const t = todayISO(); const list = state.tasks.filter((x) => !x.done && x.date && x.date < t);
        list.forEach((x) => { x.date = t; x.order = orderFor(t, 'bottom'); }); commit(); toast(`${list.length} Aufgabe(n) auf heute verschoben`); break;
      }
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form="add"]'); if (!f) return;
    e.preventDefault();
    const input = $('input', f); const raw = input.value.trim(); if (!raw) return;
    let { title, questId } = parseQuestTag(raw);
    if (!title) return;
    if (!questId && f.dataset.mode === 'quest') questId = $('select[data-role="quest"]', f)?.value || null;
    if (!questId && f.dataset.mode === 'plan' && ui.planFilter && ui.planFilter !== 'none') questId = ui.planFilter;
    if (f.dataset.mode === 'quest' && !questId && !state.quests.length) { toast('Lege zuerst eine Quest an'); questDialog(null); return; }
    const t = addTask({ title, questId, date: f.dataset.date });
    if (f.dataset.mode === 'focus') { ui.focusPick = t.id; render(); return; }
    const again = $(`form[data-form="add"][data-date="${f.dataset.date}"][data-mode="${f.dataset.mode}"] input`);
    again?.focus();
  });

  document.addEventListener('change', (e) => {
    const r = e.target.dataset.role;
    if (r === 'planfilter') { ui.planFilter = e.target.value; render(); }
    if (r === 'focuspick') { ui.focusPick = e.target.value; render(); }
    if (r === 'quest') ui.lastQuest = e.target.value;
  });

  document.addEventListener('input', (e) => {
    const rf = e.target.dataset.rf; if (!rf) return;
    const ws = e.target.closest('[data-review]').dataset.review;
    let r = state.reviews.find((x) => x.id === 'w_' + ws);
    if (!r) { r = { id: 'w_' + ws, week: ws }; state.reviews.push(r); }
    r[rf] = e.target.value; save();
  });

  // Drag & Drop
  let dragId = null;
  document.addEventListener('dragstart', (e) => {
    const c = e.target.closest?.('.tcard'); if (!c) return;
    dragId = c.dataset.task; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId);
  });
  document.addEventListener('dragend', () => { dragId = null; $$('.dragging,.drop-before,.drop').forEach((x) => x.classList.remove('dragging', 'drop-before', 'drop')); });
  document.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const list = e.target.closest?.('[data-drop-date]'); if (!list) return;
    e.preventDefault();
    $$('.drop-before,.drop').forEach((x) => x.classList.remove('drop-before', 'drop'));
    const over = e.target.closest('.tcard');
    if (over && over.dataset.task !== dragId) over.classList.add('drop-before'); else list.classList.add('drop');
  });
  document.addEventListener('drop', (e) => {
    if (!dragId) return;
    const list = e.target.closest?.('[data-drop-date]'); if (!list) return;
    e.preventDefault();
    const t = getTask(dragId); const date = list.dataset.dropDate;
    const over = e.target.closest('.tcard');
    if (over && over.dataset.task !== dragId) {
      const target = getTask(over.dataset.task);
      const sameDay = state.tasks.filter((x) => x.date === target.date && x.id !== t.id).sort((a, b) => a.order - b.order);
      const i = sameDay.indexOf(target);
      t.date = target.date;
      t.order = i <= 0 ? target.order - 1 : (sameDay[i - 1].order + target.order) / 2;
    } else if (t.date !== date) { t.date = date; t.order = orderFor(date, 'bottom'); }
    dragId = null; commit();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); return; }
    if (!$('#palette').hidden || dlg().open) return;
    if (isTyping()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const views = ['home', 'plan', 'calendar', 'focus', 'quests', 'review'];
    if (/^[1-6]$/.test(e.key)) { go(views[Number(e.key) - 1]); return; }
    if (e.key === '/') { e.preventDefault(); openPalette(); return; }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); if (!['home', 'plan'].includes(ui.view)) go('home'); $('form[data-form="add"] input')?.focus(); return; }
    if (ui.view === 'focus') {
      if (e.key === ' ') { e.preventDefault(); const r = running(); if (r) pauseTimer(); else { const b = $('[data-act="start"]'); b && startTask(b.dataset.id); } }
      if (e.key === 'Enter') { const b = $('.focus [data-act="complete"]'); b && completeTask(b.dataset.id); }
      if (e.key === 'Escape') go('home');
    }
  });

  // ================= Sync (Supabase) =================
  const SB_URL = 'https://eateylhfvzdefutzemgn.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdGV5bGhmdnpkZWZ1dHplbWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODc2MjUsImV4cCI6MjExMDc2MzYyNX0.LQbg1_qFb9LhCQ3vWVWwtl2DE2tfzT3NujfeIdwKsjA';
  const SYNC_KEY = 'quest.sync';
  let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch { return null; } })();
  let syncStatus = sync ? 'busy' : 'off', syncing = false, syncAgain = false, syncT;
  const saveSync = () => localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
  const newKey = () => { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const syncLink = () => `${location.origin}${location.pathname}#sync=${sync.key}`;
  const syncLabel = () => ({ ok: 'Synchronisiert ✓', busy: 'Synchronisiere…', err: 'Fehler – versuche es erneut', offline: 'Offline – wird nachgeholt', off: 'Aus' }[syncStatus]);
  function setSyncStatus(s) {
    syncStatus = s; const el = $('#syncdot');
    el.className = 'syncdot ' + ({ ok: 'ok', busy: 'busy', err: 'err', offline: 'err' }[s] || '');
    el.title = 'Sync: ' + syncLabel();
  }
  async function rpc(fn, body) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  const payload = (s) => ({ v: 1, quests: s.quests, tasks: s.tasks, sessions: s.sessions, recurring: s.recurring, reviews: s.reviews, settings: s.settings, deleted: s.deleted });
  const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',')}}` : JSON.stringify(o));

  function mergeStates(a, b) {
    b = normalize(b);
    const deleted = { ...a.deleted };
    for (const [id, t] of Object.entries(b.deleted)) deleted[id] = Math.max(deleted[id] || 0, t);
    const mergeColl = (x, y) => {
      const m = new Map();
      for (const it of [...x, ...y]) { const cur = m.get(it.id); if (!cur || (it.updatedAt || 0) > (cur.updatedAt || 0)) m.set(it.id, it); }
      return [...m.values()].filter((it) => !(deleted[it.id] && deleted[it.id] >= (it.updatedAt || 0)));
    };
    const out = { ...a, deleted };
    COLLS.forEach((c) => (out[c] = mergeColl(a[c], b[c])));
    out.settings = (b.settings.updatedAt || 0) > (a.settings.updatedAt || 0) ? b.settings : a.settings;
    // Nur eine laufende Sitzung: die jüngste gewinnt
    const runs = out.sessions.filter((s) => s.end == null).sort((x, y) => y.start - x.start);
    runs.slice(1).forEach((s) => { const i = out.sessions.indexOf(s); out.sessions[i] = { ...s, end: runs[0].start, updatedAt: now() }; });
    return out;
  }

  function scheduleSync(delay = 1200) { if (!sync) return; clearTimeout(syncT); syncT = setTimeout(doSync, delay); }
  async function doSync() {
    if (!sync) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true; setSyncStatus('busy');
    try {
      clearTimeout(saveT); if (stamp()) persist();
      for (let i = 0; i < 5; i++) {
        const remote = await rpc('tm_pull', { p_key: sync.key });
        if (remote.exists) {
          const merged = mergeStates(state, remote.data);
          if (canon(payload(merged)) !== canon(payload(state))) {
            const focused = isTyping();
            state = merged; resetSnap(); persist();
            if (!focused && !dlg().open) render();
          }
          if (canon(payload(state)) === canon(payload(normalize(remote.data)))) { sync.version = remote.version; saveSync(); break; }
        }
        const res = await rpc('tm_push', { p_key: sync.key, p_data: payload(state), p_base_version: remote.exists ? remote.version : 0 });
        if (res.ok) { sync.version = res.version; saveSync(); break; }
      }
      setSyncStatus('ok');
    } catch (err) {
      console.warn('Sync', err);
      setSyncStatus(navigator.onLine ? 'err' : 'offline');
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; doSync(); }
    }
  }
  async function connectSync(key, isNew) {
    sync = { key, version: 0 }; saveSync(); setSyncStatus('busy');
    if (!isNew) {
      try {
        const remote = await rpc('tm_pull', { p_key: key });
        if (remote.exists) {
          const hasLocal = state.tasks.length || state.quests.length || state.sessions.length;
          state = mergeStates(hasLocal ? state : emptyState(), remote.data); resetSnap(); persist(); render();
          toast(hasLocal ? '☁︎ Verbunden – Daten zusammengeführt' : '☁︎ Verbunden – Daten geladen');
        } else toast('☁︎ Verbunden');
      } catch { toast('Verbindung fehlgeschlagen – wird erneut versucht'); }
    } else toast('☁︎ Sync angelegt – auf dem anderen Gerät einfach dasselbe Passwort eingeben');
    render(); doSync();
  }
  function handleHash() {
    const m = location.hash.match(/sync=([A-Za-z0-9_-]{32,})/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (sync && sync.key === m[1]) { doSync(); return; }
    if (sync && !confirm('Dieses Gerät ist schon mit einem anderen Sync verbunden. Wechseln?')) return;
    connectSync(m[1], false);
  }
  setInterval(() => { if (sync && document.visibilityState === 'visible') doSync(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { doSync(); render(); } });
  window.addEventListener('online', () => doSync());
  window.addEventListener('hashchange', handleHash);
  window.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { state = normalize(JSON.parse(e.newValue)); resetSnap(); render(); } });

  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (calcHourPx() !== HOUR_PX && !isTyping()) render(); }, 200); });

  // ================= Start =================
  stamp(true);
  persist();
  if (!TITLES[ui.view]) ui.view = 'home';
  render();
  setSyncStatus(syncStatus);
  setInterval(tick, 1000);
  handleHash();
  if (sync) doSync();
  else if (!localStorage.getItem('quest.syncPrompted') && !location.hash.includes('sync=')) setTimeout(() => { if (!sync && !dlg().open) syncPasswordDialog(true); }, 600);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

  window.__q = { get state() { return state; }, mergeStates, doSync, go };
})();
