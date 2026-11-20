/* Task Manager – Vanilla JS, speichert alles lokal im Browser (localStorage). */
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'];
  const PRIO_LABEL = { 0: 'Keine', 1: 'Hoch', 2: 'Mittel', 3: 'Niedrig' };
  const STATUS_LABEL = { todo: 'Offen', doing: 'In Arbeit', done: 'Erledigt' };
  const REC_LABEL = { none: 'Keine', daily: 'Täglich', weekdays: 'Werktags', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich' };

  function fmtDue(iso) {
    if (!iso) return '';
    const t = todayISO();
    const diff = daysBetween(t, iso);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === -1) return 'Gestern';
    const d = fromISO(iso);
    if (diff > 1 && diff < 7) return WD_SHORT[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()];
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return `${d.getDate()}. ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
  }
  function dueClass(iso) {
    if (!iso) return '';
    const diff = daysBetween(todayISO(), iso);
    return diff < 0 ? 'overdue' : diff === 0 ? 'today' : '';
  }

  // ---------- State ----------
  const KEY = 'taskmanager.v1';
  let state = load();
  let ui = {
    view: 'inbox', // inbox | today | upcoming | all | done | stats | project:<id> | tag:<name>
    layout: localStorage.getItem('taskmanager.layout') || 'list',
    sort: 'manual',
    search: '',
    selected: null,
  };
  try { Object.assign(ui, JSON.parse(localStorage.getItem('taskmanager.ui') || '{}'), { search: '', selected: null }); } catch {}

  function defaultState() {
    const p1 = { id: uid(), name: 'Privat', color: '#22c55e' };
    const p2 = { id: uid(), name: 'Arbeit', color: '#3b82f6' };
    const t = todayISO();
    const mk = (o, i) => ({
      id: uid(), title: '', notes: '', projectId: null, due: null, priority: 0, tags: [], subtasks: [],
      status: 'todo', recurrence: 'none', createdAt: Date.now() - i * 1000, completedAt: null, order: i, ...o,
    });
    return {
      version: 1,
      projects: [p1, p2],
      tasks: [
        mk({ title: 'Willkommen! Klick mich an, um Details zu sehen 👋', notes: 'Hier kannst du Notizen, Unteraufgaben, Fälligkeit, Priorität, Tags und Wiederholung festlegen.\n\nTastenkürzel: N = neue Aufgabe, / = Suchen, ? = Hilfe.', subtasks: [{ id: uid(), title: 'Aufgabe abhaken', done: false }, { id: uid(), title: 'Board-Ansicht ausprobieren', done: false }] }, 0),
        mk({ title: 'Wocheneinkauf erledigen', projectId: p1.id, due: t, priority: 2, tags: ['einkauf'], recurrence: 'weekly' }, 1),
        mk({ title: 'Präsentation vorbereiten', projectId: p2.id, due: addDays(t, 2), priority: 1, tags: ['meeting'], status: 'doing' }, 2),
        mk({ title: 'E-Mails beantworten', projectId: p2.id, due: t, priority: 3, recurrence: 'weekdays' }, 3),
      ],
      settings: { theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { console.warn('Konnte Daten nicht laden', e); }
    return defaultState();
  }
  function migrate(s) {
    s.projects ||= []; s.tasks ||= []; s.settings ||= { theme: 'light' };
    s.tasks.forEach((t, i) => {
      t.tags ||= []; t.subtasks ||= []; t.status ||= (t.done ? 'done' : 'todo');
      t.recurrence ||= 'none'; t.priority ??= 0; t.order ??= i; t.notes ??= '';
      delete t.done;
    });
    return s;
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { toast('Speichern fehlgeschlagen: ' + e.message); }
    }, 80);
  }
  function saveUI() {
    localStorage.setItem('taskmanager.ui', JSON.stringify({ view: ui.view, sort: ui.sort, layout: ui.layout }));
  }
  function commit() { save(); render(); }

  const getTask = (id) => state.tasks.find((t) => t.id === id);
  const getProject = (id) => state.projects.find((p) => p.id === id);
  const isDone = (t) => t.status === 'done';

  // ---------- Quick-add parsing ----------
  function parseQuick(text) {
    let title = ' ' + text + ' ';
    const out = { tags: [], priority: 0, due: null, projectId: null };
    title = title.replace(/\s#([\p{L}\p{N}_-]+)/gu, (_, tag) => { out.tags.push(tag.toLowerCase()); return ' '; });
    title = title.replace(/\s!([1-3])(?=\s)/g, (_, p) => { out.priority = Number(p); return ' '; });
    title = title.replace(/\s@([\p{L}\p{N}_-]+)/gu, (m, name) => {
      const p = state.projects.find((x) => x.name.toLowerCase() === name.toLowerCase())
        || state.projects.find((x) => x.name.toLowerCase().startsWith(name.toLowerCase()));
      if (p) { out.projectId = p.id; return ' '; }
      return m;
    });
    const t = todayISO();
    const rules = [
      [/\s(heute)(?=\s)/i, () => t],
      [/\s(übermorgen)(?=\s)/i, () => addDays(t, 2)],
      [/\s(morgen)(?=\s)/i, () => addDays(t, 1)],
      [/\s(nächste woche)(?=\s)/i, () => addDays(t, 7)],
      [/\s(?:am\s)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?=\s)/i, (m) => {
        const target = WEEKDAYS.indexOf(m[1].toLowerCase());
        let diff = (target - new Date().getDay() + 7) % 7; if (diff === 0) diff = 7;
        return addDays(t, diff);
      }],
      [/\s(?:am\s)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?=\s)/, (m) => {
        const now = new Date();
        let y = m[3] ? Number(m[3]) : now.getFullYear(); if (y < 100) y += 2000;
        const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
        if (isNaN(d) || d.getMonth() !== Number(m[2]) - 1) return null;
        if (!m[3] && toISO(d) < t) d.setFullYear(y + 1);
        return toISO(d);
      }],
    ];
    for (const [re, fn] of rules) {
      const m = title.match(re);
      if (m) { const v = fn(m); if (v) { out.due = v; title = title.replace(re, ' '); break; } }
    }
    out.title = title.replace(/\s+/g, ' ').trim();
    return out;
  }

  // ---------- Task operations ----------
  function addTask(partial) {
    const minOrder = Math.min(0, ...state.tasks.map((t) => t.order));
    const task = {
      id: uid(), title: '', notes: '', projectId: null, due: null, priority: 0, tags: [], subtasks: [],
      status: 'todo', recurrence: 'none', createdAt: Date.now(), completedAt: null, order: minOrder - 1, ...partial,
    };
    // Kontext der aktuellen Ansicht übernehmen
    if (!partial.projectId && ui.view.startsWith('project:')) task.projectId = ui.view.slice(8);
    if (!partial.due && ui.view === 'today') task.due = todayISO();
    if (ui.view.startsWith('tag:')) { const tg = ui.view.slice(4); if (!task.tags.includes(tg)) task.tags.push(tg); }
    state.tasks.push(task);
    commit();
    return task;
  }

  function nextDue(iso, rec) {
    const base = iso || todayISO();
    const d = fromISO(base);
    switch (rec) {
      case 'daily': d.setDate(d.getDate() + 1); break;
      case 'weekdays': do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); break;
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'monthly': { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); break; }
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
      default: return null;
    }
    return toISO(d);
  }

  function toggleDone(id) {
    const t = getTask(id); if (!t) return;
    if (!isDone(t) && t.recurrence !== 'none') {
      // Wiederkehrend: erledigte Kopie archivieren, Original auf nächsten Termin schieben
      state.tasks.push({ ...structuredClone(t), id: uid(), status: 'done', completedAt: Date.now(), recurrence: 'none' });
      t.due = nextDue(t.due, t.recurrence);
      t.subtasks.forEach((s) => (s.done = false));
      t.status = 'todo';
      commit();
      toast(`🔁 Erledigt – nächster Termin: ${fmtDue(t.due)}`);
      return;
    }
    if (isDone(t)) { t.status = 'todo'; t.completedAt = null; }
    else { t.status = 'done'; t.completedAt = Date.now(); toast('✅ Erledigt', () => { t.status = 'todo'; t.completedAt = null; commit(); }); }
    commit();
  }

  function deleteTask(id) {
    const idx = state.tasks.findIndex((t) => t.id === id); if (idx < 0) return;
    const [removed] = state.tasks.splice(idx, 1);
    if (ui.selected === id) closeDetail();
    commit();
    toast('🗑️ Aufgabe gelöscht', () => { state.tasks.splice(idx, 0, removed); commit(); });
  }

  function duplicateTask(id) {
    const t = getTask(id); if (!t) return;
    const copy = { ...structuredClone(t), id: uid(), title: t.title + ' (Kopie)', createdAt: Date.now(), status: 'todo', completedAt: null, order: t.order + 0.5 };
    copy.subtasks.forEach((s) => (s.id = uid()));
    state.tasks.push(copy);
    normalizeOrder();
    commit();
    openDetail(copy.id);
  }

  function normalizeOrder() {
    [...state.tasks].sort((a, b) => a.order - b.order).forEach((t, i) => (t.order = i));
  }

  // ---------- Filtering ----------
  function baseFilter(view) {
    const t = todayISO();
    if (view === 'inbox') return (x) => !x.projectId && !isDone(x);
    if (view === 'today') return (x) => !isDone(x) && x.due && x.due <= t;
    if (view === 'upcoming') return (x) => !isDone(x) && x.due && x.due > t;
    if (view === 'all') return (x) => !isDone(x);
    if (view === 'done') return (x) => isDone(x);
    if (view.startsWith('project:')) { const id = view.slice(8); return (x) => x.projectId === id; }
    if (view.startsWith('tag:')) { const tg = view.slice(4); return (x) => x.tags.includes(tg); }
    return () => false;
  }
  function matchesSearch(x, q) {
    if (!q) return true;
    q = q.toLowerCase();
    const p = getProject(x.projectId);
    return [x.title, x.notes, ...x.tags.map((t) => '#' + t), p?.name, ...x.subtasks.map((s) => s.title)]
      .some((s) => s && s.toLowerCase().includes(q));
  }
  function sortTasks(arr) {
    const s = ui.sort;
    const prio = (x) => (x.priority === 0 ? 9 : x.priority);
    const cmp = {
      manual: (a, b) => a.order - b.order,
      due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || prio(a) - prio(b) || a.order - b.order,
      priority: (a, b) => prio(a) - prio(b) || (a.due || '9999').localeCompare(b.due || '9999'),
      created: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.title.localeCompare(b.title, 'de'),
    }[s] || ((a, b) => a.order - b.order);
    return arr.sort(cmp);
  }
  function visibleTasks(view = ui.view) {
    // Suche durchsucht immer alle Aufgaben
    const f = ui.search ? () => true : baseFilter(view);
    return sortTasks(state.tasks.filter((x) => f(x) && matchesSearch(x, ui.search)));
  }

  // ---------- Rendering ----------
  function render() {
    document.documentElement.dataset.theme = state.settings.theme;
    renderSidebar();
    renderHeader();
    renderContent();
    if (ui.selected) renderDetail();
  }

  function renderSidebar() {
    const counts = {
      inbox: state.tasks.filter(baseFilter('inbox')).length,
      today: state.tasks.filter(baseFilter('today')).length,
      upcoming: state.tasks.filter(baseFilter('upcoming')).length,
      all: state.tasks.filter(baseFilter('all')).length,
    };
    $$('[data-count]').forEach((el) => (el.textContent = counts[el.dataset.count] || ''));
    $$('#nav-main .nav-item, #bottom-nav [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view && !ui.search));

    const projNav = $('#nav-projects');
    projNav.innerHTML = state.projects.length
      ? state.projects.map((p) => {
        const n = state.tasks.filter((t) => t.projectId === p.id && !isDone(t)).length;
        return `<button class="nav-item${ui.view === 'project:' + p.id && !ui.search ? ' active' : ''}" data-view="project:${p.id}" data-project-drop="${p.id}">
          <span class="dot" style="background:${esc(p.color)}"></span><span class="name">${esc(p.name)}</span><span class="count">${n || ''}</span></button>`;
      }).join('')
      : '<div class="empty-small">Noch keine Projekte</div>';

    const tags = [...new Set(state.tasks.flatMap((t) => t.tags))].sort();
    $('#nav-tags').innerHTML = tags.length
      ? tags.map((t) => `<span class="tag${ui.view === 'tag:' + t ? ' active' : ''}" data-view="tag:${esc(t)}">#${esc(t)}</span>`).join('')
      : '<div class="empty-small">Tags mit #name beim Erstellen</div>';
  }

  function viewTitle() {
    if (ui.search) return ['Suche', `Ergebnisse für „${ui.search}“`];
    const map = {
      inbox: ['Eingang', 'Aufgaben ohne Projekt'],
      today: ['Heute', new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })],
      upcoming: ['Demnächst', 'Alles mit Termin in der Zukunft'],
      all: ['Alle Aufgaben', 'Alle offenen Aufgaben'],
      done: ['Erledigt', 'Abgeschlossene Aufgaben'],
      stats: ['Statistik', 'Dein Fortschritt'],
    };
    if (map[ui.view]) return map[ui.view];
    if (ui.view.startsWith('project:')) { const p = getProject(ui.view.slice(8)); return [p ? p.name : 'Projekt', 'Projekt']; }
    if (ui.view.startsWith('tag:')) return ['#' + ui.view.slice(4), 'Tag'];
    return ['', ''];
  }

  function renderHeader() {
    const [title, sub] = viewTitle();
    $('#view-title').textContent = title;
    $('#view-subtitle').textContent = sub;
    document.title = `${title} · Task Manager`;
    $('#sort').value = ui.sort;
    $$('#layout-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.layout === ui.layout));
    const isProject = ui.view.startsWith('project:') && !ui.search;
    $('#project-menu').hidden = !isProject;
    const hideAdd = ui.view === 'stats' || ui.view === 'done';
    $('#quick-add').style.display = hideAdd ? 'none' : '';
    $('#quick-hint').style.display = hideAdd ? 'none' : '';
    $('#layout-toggle').style.display = ui.view === 'stats' ? 'none' : '';
    $('#sort').style.display = ui.view === 'stats' ? 'none' : '';
  }

  function taskHTML(t) {
    const p = getProject(t.projectId);
    const subDone = t.subtasks.filter((s) => s.done).length;
    const meta = [];
    if (t.due) meta.push(`<span class="${isDone(t) ? '' : dueClass(t.due)}">📅 ${fmtDue(t.due)}</span>`);
    if (t.recurrence !== 'none') meta.push(`<span title="Wiederholung">🔁 ${REC_LABEL[t.recurrence]}</span>`);
    if (t.subtasks.length) meta.push(`<span>☑️ ${subDone}/${t.subtasks.length}</span>`);
    if (t.notes) meta.push('<span title="Notizen">📝</span>');
    if (t.status === 'doing' && ui.layout === 'list') meta.push('<span class="badge-status">In Arbeit</span>');
    if (p && !ui.view.startsWith('project:')) meta.push(`<span class="proj-chip"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</span>`);
    t.tags.forEach((tg) => meta.push(`<span class="tag">#${esc(tg)}</span>`));
    return `<div class="task${isDone(t) ? ' done' : ''}${ui.selected === t.id ? ' selected' : ''}" data-id="${t.id}" draggable="true">
      <button class="check${isDone(t) ? ' checked' : ''}${t.priority ? ' p' + t.priority : ''}" data-action="toggle" title="Erledigt umschalten" aria-label="Erledigt"></button>
      <div class="task-body">
        <div class="task-title">${esc(t.title) || '<i>Ohne Titel</i>'}</div>
        ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
      </div>
    </div>`;
  }

  function emptyHTML() {
    const msgs = {
      today: ['🎉', 'Nichts mehr für heute. Genieß den Tag!'],
      done: ['📭', 'Noch nichts erledigt.'],
      inbox: ['📥', 'Eingang ist leer.'],
    };
    const [ico, txt] = ui.search ? ['🔍', 'Keine Treffer.'] : (msgs[ui.view] || ['✨', 'Keine Aufgaben. Leg oben los!']);
    return `<div class="empty"><div class="big">${ico}</div><p>${txt}</p></div>`;
  }

  function renderContent() {
    const c = $('#content');
    if (ui.view === 'stats' && !ui.search) { c.innerHTML = statsHTML(); return; }
    const tasks = visibleTasks();
    if (ui.layout === 'board' && ui.view !== 'done') { c.innerHTML = boardHTML(tasks); return; }
    if (!tasks.length) { c.innerHTML = emptyHTML(); return; }

    // Gruppierung
    let groups;
    if (ui.view === 'upcoming' && !ui.search) {
      const m = new Map();
      tasks.sort((a, b) => a.due.localeCompare(b.due) || a.order - b.order).forEach((t) => {
        if (!m.has(t.due)) m.set(t.due, []); m.get(t.due).push(t);
      });
      groups = [...m].map(([d, arr]) => {
        const date = fromISO(d);
        return { title: `${fmtDue(d)} · ${date.toLocaleDateString('de-DE', { weekday: 'long' })}`, tasks: arr };
      });
    } else if (ui.view === 'today' && !ui.search) {
      const t = todayISO();
      const overdue = tasks.filter((x) => x.due < t);
      const today = tasks.filter((x) => x.due === t);
      groups = [];
      if (overdue.length) groups.push({ title: 'Überfällig', cls: 'overdue', tasks: overdue });
      if (today.length) groups.push({ title: 'Heute', tasks: today });
    } else if (ui.view === 'done' && !ui.search) {
      const m = new Map();
      tasks.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).forEach((t) => {
        const k = t.completedAt ? toISO(new Date(t.completedAt)) : 'unbekannt';
        if (!m.has(k)) m.set(k, []); m.get(k).push(t);
      });
      groups = [...m].map(([k, arr]) => ({ title: k === 'unbekannt' ? 'Unbekannt' : fmtDue(k), tasks: arr }));
    } else if (ui.view.startsWith('project:') && !ui.search) {
      const open = tasks.filter((x) => !isDone(x));
      const done = tasks.filter(isDone);
      groups = [{ title: '', tasks: open }];
      if (done.length) groups.push({ title: `Erledigt (${done.length})`, tasks: done });
    } else {
      groups = [{ title: '', tasks }];
    }
    c.innerHTML = groups.map((g) => `<div class="group">
      ${g.title ? `<div class="group-title ${g.cls || ''}">${esc(g.title)} <span>${g.tasks.length}</span></div>` : ''}
      <div class="task-list">${g.tasks.map(taskHTML).join('')}</div></div>`).join('');
  }

  function boardHTML(tasks) {
    // Im Board auch erledigte Aufgaben der Ansicht anzeigen (außer bei "Erledigt")
    let all = tasks;
    if (!ui.search && ui.view !== 'done') {
      const f = baseFilter(ui.view);
      const t = todayISO();
      const doneMatches = state.tasks.filter((x) => isDone(x) && (
        ui.view.startsWith('project:') || ui.view.startsWith('tag:') ? f(x)
          : ui.view === 'inbox' ? !x.projectId
            : ui.view === 'today' ? x.completedAt && toISO(new Date(x.completedAt)) === t
              : ui.view === 'upcoming' ? x.due && x.due > t : true));
      all = [...tasks.filter((x) => !isDone(x)), ...doneMatches.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 30)];
    }
    const cols = ['todo', 'doing', 'done'];
    return `<div class="board">${cols.map((s) => {
      const list = all.filter((x) => x.status === s);
      return `<div class="column" data-status="${s}"><h3>${STATUS_LABEL[s]} <span class="small-muted">${list.length}</span></h3>
        <div class="task-list">${list.map(taskHTML).join('')}</div></div>`;
    }).join('')}</div>`;
  }

  function statsHTML() {
    const all = state.tasks;
    const done = all.filter(isDone);
    const open = all.filter((x) => !isDone(x));
    const t = todayISO();
    const overdue = open.filter((x) => x.due && x.due < t).length;
    const doneToday = done.filter((x) => x.completedAt && toISO(new Date(x.completedAt)) === t).length;
    const days = [...Array(14)].map((_, i) => addDays(t, i - 13));
    const perDay = days.map((d) => done.filter((x) => x.completedAt && toISO(new Date(x.completedAt)) === d).length);
    const max = Math.max(1, ...perDay);
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = addDays(t, -i);
      const n = done.filter((x) => x.completedAt && toISO(new Date(x.completedAt)) === d).length;
      if (n) streak++; else if (i > 0) break; else continue;
      if (i > 3650) break;
    }
    const projRows = state.projects.map((p) => {
      const ts = all.filter((x) => x.projectId === p.id);
      const d = ts.filter(isDone).length;
      const pct = ts.length ? Math.round((d / ts.length) * 100) : 0;
      return `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between"><span class="proj-chip"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</span><span class="small-muted">${d}/${ts.length} · ${pct}%</span></div>
        <div class="progress"><div style="width:${pct}%;background:${esc(p.color)}"></div></div></div>`;
    }).join('') || '<div class="small-muted">Keine Projekte.</div>';
    return `<div class="stats-grid">
        <div class="stat"><div class="num">${open.length}</div><div class="lbl">Offen</div></div>
        <div class="stat"><div class="num">${doneToday}</div><div class="lbl">Heute erledigt</div></div>
        <div class="stat"><div class="num" style="color:${overdue ? 'var(--danger)' : 'inherit'}">${overdue}</div><div class="lbl">Überfällig</div></div>
        <div class="stat"><div class="num">${done.length}</div><div class="lbl">Insgesamt erledigt</div></div>
        <div class="stat"><div class="num">🔥 ${streak}</div><div class="lbl">Tage in Folge produktiv</div></div>
      </div>
      <div class="chart"><b>Erledigt in den letzten 14 Tagen</b>
        <div class="bars">${perDay.map((n, i) => `<div class="bar" title="${n} erledigt"><span>${n || ''}</span><div style="height:${(n / max) * 100}%"></div><span>${WD_SHORT[fromISO(days[i]).getDay()]}</span></div>`).join('')}</div>
      </div>
      <div class="chart"><b>Projekte</b>${projRows}</div>`;
  }

  // ---------- Detail panel ----------
  function openDetail(id) {
    ui.selected = id;
    $('#detail').classList.add('open');
    $('#detail').setAttribute('aria-hidden', 'false');
    renderDetail();
    $$('.task').forEach((el) => el.classList.toggle('selected', el.dataset.id === id));
  }
  function closeDetail() {
    ui.selected = null;
    $('#detail').classList.remove('open');
    $('#detail').setAttribute('aria-hidden', 'true');
    $('#detail').innerHTML = '';
    $$('.task.selected').forEach((el) => el.classList.remove('selected'));
  }

  function renderDetail() {
    const t = getTask(ui.selected);
    if (!t) { closeDetail(); return; }
    const d = $('#detail');
    // Fokus erhalten, wenn bereits gerendert
    const active = document.activeElement;
    const activeKey = active && d.contains(active) ? active.dataset.field || active.dataset.sub : null;
    if (activeKey && d.dataset.for === t.id) { refreshDetailPassive(t); return; }
    d.dataset.for = t.id;
    const subDone = t.subtasks.filter((s) => s.done).length;
    d.innerHTML = `<div class="detail-inner">
      <div class="detail-head">
        <button class="check${isDone(t) ? ' checked' : ''}${t.priority ? ' p' + t.priority : ''}" data-d="toggle" title="Erledigt"></button>
        <span class="small-muted">${STATUS_LABEL[t.status]}</span>
        <span class="spacer"></span>
        <button class="icon-btn" data-d="duplicate" title="Duplizieren">⧉</button>
        <button class="icon-btn" data-d="delete" title="Löschen">🗑️</button>
        <button class="icon-btn" data-d="close" title="Schließen (Esc)">✕</button>
      </div>
      <textarea class="title-input" data-field="title" rows="1" placeholder="Titel">${esc(t.title)}</textarea>
      <div>
        <label class="lbl">Notizen</label>
        <textarea data-field="notes" rows="4" placeholder="Details, Links, Gedanken…">${esc(t.notes)}</textarea>
      </div>
      <div class="row2">
        <div><label class="lbl">Fällig</label><input type="date" data-field="due" value="${t.due || ''}" /></div>
        <div><label class="lbl">Priorität</label>
          <select data-field="priority">${[1, 2, 3, 0].map((p) => `<option value="${p}"${t.priority === p ? ' selected' : ''}>${p ? '!' + p + ' ' : ''}${PRIO_LABEL[p]}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div><label class="lbl">Projekt</label>
          <select data-field="projectId"><option value="">📥 Eingang</option>${state.projects.map((p) => `<option value="${p.id}"${t.projectId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div><label class="lbl">Status</label>
          <select data-field="status">${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}"${t.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div><label class="lbl">Wiederholen</label>
          <select data-field="recurrence">${Object.entries(REC_LABEL).map(([k, v]) => `<option value="${k}"${t.recurrence === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="lbl">Tags</label><input type="text" data-field="tags" value="${esc(t.tags.join(', '))}" placeholder="arbeit, wichtig" /></div>
      </div>
      <div>
        <label class="lbl">Unteraufgaben ${t.subtasks.length ? `· ${subDone}/${t.subtasks.length}` : ''}</label>
        ${t.subtasks.length ? `<div class="progress" style="margin-bottom:8px"><div style="width:${(subDone / t.subtasks.length) * 100}%"></div></div>` : ''}
        <div class="subtasks">${t.subtasks.map((s) => `<div class="subtask${s.done ? ' done' : ''}" data-sid="${s.id}">
            <button class="check${s.done ? ' checked' : ''}" data-d="subtoggle"></button>
            <input type="text" data-sub="${s.id}" value="${esc(s.title)}" />
            <button class="icon-btn" data-d="subdelete" title="Entfernen">✕</button></div>`).join('')}
        </div>
        <input type="text" class="field-input" data-d="subadd" placeholder="＋ Unteraufgabe hinzufügen (Enter)" style="margin-top:6px" />
      </div>
      <div class="small-muted">Erstellt: ${new Date(t.createdAt).toLocaleString('de-DE')}${t.completedAt ? ' · Erledigt: ' + new Date(t.completedAt).toLocaleString('de-DE') : ''}</div>
    </div>`;
    autoGrow($('.title-input', d));
  }
  function refreshDetailPassive(t) {
    // Nur Kopfzeile/Check aktualisieren, ohne Eingaben zu stören
    const c = $('.detail-head .check', $('#detail'));
    if (c) c.className = `check${isDone(t) ? ' checked' : ''}${t.priority ? ' p' + t.priority : ''}`;
  }
  function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

  function updateField(t, field, value) {
    switch (field) {
      case 'title': t.title = value; break;
      case 'notes': t.notes = value; break;
      case 'due': t.due = value || null; break;
      case 'priority': t.priority = Number(value); break;
      case 'projectId': t.projectId = value || null; break;
      case 'recurrence': t.recurrence = value; break;
      case 'tags': t.tags = [...new Set(value.split(/[,\s]+/).map((s) => s.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))]; break;
      case 'status':
        t.status = value;
        t.completedAt = value === 'done' ? (t.completedAt || Date.now()) : null;
        break;
    }
  }

  // ---------- Toast & dialogs ----------
  let toastTimer;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Rückgängig</button>' : ''}`;
    if (undo) $('button', el).onclick = () => { undo(); el.classList.remove('show'); };
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
  }

  function projectDialog(project) {
    const dlg = $('#dialog');
    let color = project?.color || COLORS[(state.projects.length * 3) % COLORS.length];
    dlg.innerHTML = `<form method="dialog">
      <h2>${project ? 'Projekt bearbeiten' : 'Neues Projekt'}</h2>
      <input class="field-input" name="name" placeholder="Name" value="${esc(project?.name || '')}" required maxlength="60" />
      <div class="colors">${COLORS.map((c) => `<button type="button" data-color="${c}" style="background:${c}" class="${c === color ? 'sel' : ''}"></button>`).join('')}</div>
      <div class="actions">
        ${project ? '<button type="button" class="danger-btn left" data-act="delete">Löschen</button>' : ''}
        <button type="button" class="secondary-btn" data-act="cancel">Abbrechen</button>
        <button type="submit" class="primary-btn">Speichern</button>
      </div></form>`;
    $$('.colors button', dlg).forEach((b) => b.onclick = () => {
      color = b.dataset.color; $$('.colors button', dlg).forEach((x) => x.classList.toggle('sel', x === b));
    });
    $('[data-act=cancel]', dlg).onclick = () => dlg.close();
    const del = $('[data-act=delete]', dlg);
    if (del) del.onclick = () => {
      const n = state.tasks.filter((t) => t.projectId === project.id).length;
      if (!confirm(`Projekt „${project.name}“ löschen?${n ? `\n${n} Aufgabe(n) werden in den Eingang verschoben.` : ''}`)) return;
      state.tasks.forEach((t) => { if (t.projectId === project.id) t.projectId = null; });
      state.projects = state.projects.filter((p) => p.id !== project.id);
      ui.view = 'inbox'; saveUI(); dlg.close(); commit();
    };
    $('form', dlg).onsubmit = (e) => {
      e.preventDefault();
      const name = $('[name=name]', dlg).value.trim(); if (!name) return;
      if (project) Object.assign(project, { name, color });
      else { const p = { id: uid(), name, color }; state.projects.push(p); ui.view = 'project:' + p.id; saveUI(); }
      dlg.close(); commit();
    };
    dlg.showModal();
    $('[name=name]', dlg).focus();
  }

  function helpDialog() {
    const dlg = $('#dialog');
    const rows = [
      ['N', 'Neue Aufgabe'], ['/', 'Suchen'], ['Esc', 'Detailansicht schließen'],
      ['↑ / ↓  oder  J / K', 'Aufgabe auswählen'], ['Enter', 'Ausgewählte Aufgabe öffnen'], ['X', 'Ausgewählte Aufgabe erledigen'],
      ['Entf', 'Ausgewählte Aufgabe löschen'], ['1 – 6', 'Eingang, Heute, Demnächst, Alle, Erledigt, Statistik'], ['B', 'Liste/Board umschalten'], ['?', 'Diese Hilfe'],
    ];
    dlg.innerHTML = `<h2>Tastenkürzel & Tipps</h2>
      <table class="shortcuts">${rows.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
      <p class="small-muted">Schnelleingabe: „Zahnarzt anrufen morgen #privat !1 @Privat“ setzt Termin, Tag, Priorität und Projekt automatisch.<br>
      Aufgaben per Drag &amp; Drop sortieren, auf ein Projekt in der Seitenleiste ziehen oder im Board zwischen Spalten verschieben.<br>
      Deine Daten bleiben nur in diesem Browser gespeichert – nutze Export/Import für Backups oder zum Umziehen auf ein anderes Gerät.</p>
      <div class="actions"><button class="primary-btn" onclick="this.closest('dialog').close()">Alles klar</button></div>`;
    dlg.showModal();
  }

  // ---------- Navigation ----------
  function setView(v) {
    ui.view = v; ui.search = ''; $('#search').value = '';
    saveUI(); closeSidebar(); render();
  }
  function openSidebar() { $('#sidebar').classList.add('open'); $('#backdrop').classList.add('show'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#backdrop').classList.remove('show'); }

  // ---------- Events ----------
  function bind() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-view]');
      if (nav) { setView(nav.dataset.view); return; }
    });
    $('#menu-btn').onclick = openSidebar;
    $('#more-btn').onclick = openSidebar;
    $('#fab').onclick = () => {
      if (ui.view === 'stats' || ui.view === 'done') setView('inbox');
      const input = $('#quick-input');
      input.scrollIntoView({ block: 'center' });
      input.focus();
    };
    $('#backdrop').onclick = closeSidebar;
    $('#add-project').onclick = () => projectDialog();
    $('#project-menu').onclick = () => { const p = getProject(ui.view.slice(8)); if (p) projectDialog(p); };
    $('#help-btn').onclick = helpDialog;
    $('#theme-toggle').onclick = () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; commit(); };
    $('#sort').onchange = (e) => { ui.sort = e.target.value; saveUI(); render(); };
    $$('#layout-toggle button').forEach((b) => (b.onclick = () => { ui.layout = b.dataset.layout; saveUI(); render(); }));
    $('#search').addEventListener('input', (e) => { ui.search = e.target.value.trim(); render(); });

    $('#quick-add').onsubmit = (e) => {
      e.preventDefault();
      const input = $('#quick-input');
      const raw = input.value.trim(); if (!raw) return;
      const parsed = parseQuick(raw);
      if (!parsed.title) { toast('Bitte einen Titel eingeben'); return; }
      if (ui.view === 'done' || ui.view === 'stats') ui.view = 'inbox';
      addTask(parsed);
      input.value = '';
      const bits = [parsed.due && '📅 ' + fmtDue(parsed.due), parsed.priority && '!' + parsed.priority, ...parsed.tags.map((t) => '#' + t), parsed.projectId && '@' + getProject(parsed.projectId).name].filter(Boolean);
      toast('➕ Hinzugefügt' + (bits.length ? ' · ' + bits.join(' ') : ''));
    };

    // Task list clicks
    $('#content').addEventListener('click', (e) => {
      const taskEl = e.target.closest('.task'); if (!taskEl) return;
      const id = taskEl.dataset.id;
      if (e.target.closest('[data-action=toggle]')) { toggleDone(id); return; }
      openDetail(id);
    });

    // Detail events
    const d = $('#detail');
    d.addEventListener('input', (e) => {
      const t = getTask(ui.selected); if (!t) return;
      const f = e.target.dataset.field;
      if (f === 'title' || f === 'notes' || f === 'tags') {
        updateField(t, f, e.target.value);
        if (f === 'title') autoGrow(e.target);
        save(); renderContent(); if (f === 'tags') renderSidebar();
      }
      const sid = e.target.dataset.sub;
      if (sid) { const s = t.subtasks.find((x) => x.id === sid); if (s) { s.title = e.target.value; save(); renderContent(); } }
    });
    d.addEventListener('change', (e) => {
      const t = getTask(ui.selected); if (!t) return;
      const f = e.target.dataset.field;
      if (f && !['title', 'notes', 'tags'].includes(f)) {
        updateField(t, f, e.target.value);
        d.dataset.for = ''; commit();
      }
    });
    d.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-d]'); if (!btn) return;
      const t = getTask(ui.selected); if (!t) return;
      const act = btn.dataset.d;
      if (act === 'close') closeDetail();
      else if (act === 'delete') deleteTask(t.id);
      else if (act === 'duplicate') duplicateTask(t.id);
      else if (act === 'toggle') { toggleDone(t.id); d.dataset.for = ''; renderDetail(); }
      else if (act === 'subtoggle' || act === 'subdelete') {
        const sid = btn.closest('.subtask').dataset.sid;
        if (act === 'subtoggle') { const s = t.subtasks.find((x) => x.id === sid); s.done = !s.done; }
        else t.subtasks = t.subtasks.filter((x) => x.id !== sid);
        d.dataset.for = ''; commit();
      }
    });
    d.addEventListener('keydown', (e) => {
      if (e.target.dataset.d === 'subadd' && e.key === 'Enter') {
        e.preventDefault();
        const v = e.target.value.trim(); if (!v) return;
        const t = getTask(ui.selected);
        t.subtasks.push({ id: uid(), title: v, done: false });
        d.dataset.for = ''; commit();
        $('[data-d=subadd]', d)?.focus();
      }
      if (e.target.dataset.field === 'title' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    });

    // Export / Import
    $('#export-btn').onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tasks-backup-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('⬇️ Backup heruntergeladen');
    };
    $('#import-input').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = migrate(JSON.parse(await file.text()));
        if (!Array.isArray(data.tasks)) throw new Error('Ungültige Datei');
        if (!confirm(`${data.tasks.length} Aufgaben und ${data.projects.length} Projekte importieren?\nDie aktuellen Daten werden ersetzt.`)) return;
        const prev = state; state = data; closeDetail(); commit();
        toast('⬆️ Import erfolgreich', () => { state = prev; commit(); });
      } catch (err) { toast('Import fehlgeschlagen: ' + err.message); }
      e.target.value = '';
    };

    bindDragAndDrop();
    bindKeyboard();
  }

  function bindDragAndDrop() {
    let dragId = null;
    const content = $('#content');
    content.addEventListener('dragstart', (e) => {
      const el = e.target.closest('.task'); if (!el) return;
      dragId = el.dataset.id; el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    content.addEventListener('dragend', () => {
      dragId = null;
      $$('.dragging, .drag-over').forEach((x) => x.classList.remove('dragging', 'drag-over'));
      $$('.drop-target').forEach((x) => x.classList.remove('drop-target'));
    });
    content.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      $$('.drag-over').forEach((x) => x.classList.remove('drag-over'));
      const over = e.target.closest('.task');
      if (over && over.dataset.id !== dragId) over.classList.add('drag-over');
      else { const col = e.target.closest('.column'); if (col) col.classList.add('drag-over'); }
    });
    content.addEventListener('drop', (e) => {
      if (!dragId) return;
      e.preventDefault();
      const t = getTask(dragId);
      const col = e.target.closest('.column');
      if (col && col.dataset.status !== t.status) {
        updateField(t, 'status', col.dataset.status);
        if (col.dataset.status === 'done') toast('✅ Erledigt');
      }
      const over = e.target.closest('.task');
      if (over && over.dataset.id !== dragId) {
        const target = getTask(over.dataset.id);
        ui.sort = 'manual'; saveUI();
        normalizeOrder();
        const to = target.order;
        state.tasks.forEach((x) => { if (x.id !== t.id && x.order >= to) x.order += 1; });
        t.order = to;
        normalizeOrder();
      }
      commit();
    });
    // Auf Projekte in der Sidebar ziehen
    const projNav = $('#nav-projects');
    const inbox = $('[data-view=inbox]');
    [projNav, inbox].forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        const btn = e.target.closest('[data-project-drop], [data-view=inbox]'); if (!btn || !dragId) return;
        e.preventDefault(); $$('.drop-target').forEach((x) => x.classList.remove('drop-target')); btn.classList.add('drop-target');
      });
      zone.addEventListener('dragleave', (e) => { e.target.closest?.('.nav-item')?.classList.remove('drop-target'); });
      zone.addEventListener('drop', (e) => {
        const btn = e.target.closest('[data-project-drop], [data-view=inbox]'); if (!btn || !dragId) return;
        e.preventDefault(); e.stopPropagation();
        const t = getTask(dragId);
        t.projectId = btn.dataset.projectDrop || null;
        const p = getProject(t.projectId);
        toast(`📁 Verschoben nach ${p ? p.name : 'Eingang'}`);
        btn.classList.remove('drop-target');
        commit();
      });
    });
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if ($('#dialog').open) return;
        if (typing) { e.target.blur(); if (e.target.id === 'search' && ui.search) { ui.search = ''; e.target.value = ''; render(); } return; }
        if (ui.selected) closeDetail(); else closeSidebar();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || $('#dialog').open) return;
      const ids = $$('#content .task').map((x) => x.dataset.id);
      const cur = ids.indexOf(ui.selected);
      const views = ['inbox', 'today', 'upcoming', 'all', 'done', 'stats'];
      switch (e.key) {
        case 'n': case 'N': e.preventDefault(); if (ui.view === 'stats' || ui.view === 'done') setView('inbox'); $('#quick-input').focus(); break;
        case '/': e.preventDefault(); $('#search').focus(); break;
        case '?': helpDialog(); break;
        case 'b': case 'B': ui.layout = ui.layout === 'list' ? 'board' : 'list'; saveUI(); render(); break;
        case 'ArrowDown': case 'j': if (ids.length) { e.preventDefault(); openDetail(ids[Math.min(ids.length - 1, cur + 1)]); scrollSel(); } break;
        case 'ArrowUp': case 'k': if (ids.length) { e.preventDefault(); openDetail(ids[Math.max(0, cur - 1)]); scrollSel(); } break;
        case 'Enter': if (ui.selected) { $('#detail .title-input')?.focus(); e.preventDefault(); } break;
        case 'x': case 'X': if (ui.selected) toggleDone(ui.selected); break;
        case 'Delete': case 'Backspace': if (ui.selected) { e.preventDefault(); deleteTask(ui.selected); } break;
        default:
          if (/^[1-6]$/.test(e.key)) setView(views[Number(e.key) - 1]);
      }
    });
  }
  function scrollSel() { $('#content .task.selected')?.scrollIntoView({ block: 'nearest' }); }

  // Tageswechsel erkennen (z. B. App über Nacht offen)
  let lastDay = todayISO();
  setInterval(() => { if (todayISO() !== lastDay) { lastDay = todayISO(); render(); } }, 60000);
  // Sync zwischen mehreren Tabs
  window.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { state = migrate(JSON.parse(e.newValue)); render(); } });

  // ---------- Start ----------
  if (!getProject(ui.view.slice(8)) && ui.view.startsWith('project:')) ui.view = 'inbox';
  bind();
  render();
  save();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Für Tests
  window.__tm = { parseQuick, get state() { return state; }, nextDue };
})();
