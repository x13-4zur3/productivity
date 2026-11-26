'use strict';

let workspaceTools = false;
let sourceEntry = null;
let plannerWeek;
let plannerTasks = [];
let calendarDay = civilDay(new Date());
let calendarMonth = calendarDay.slice(0, 7) + '-01';
let calendarItems = { events: [], tasks: [], entries: [] };
let calendarLoad = 0;
let editingEvent = null;
let searchItems = null;
let searchLoad = 0;

const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function civilDay(value) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

function noon(day) {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(2000, 0, 1, 12);
  value.setFullYear(year, month - 1, date);
  return value;
}

function shiftDay(day, amount) {
  const date = noon(day);
  date.setDate(date.getDate() + amount);
  return civilDay(date);
}

function monday(day) {
  return shiftDay(day, -((noon(day).getDay() + 6) % 7));
}

async function loadWorkspaceTools() {
  try { workspaceTools = Boolean((await request('/api/features')).workspaceTools); }
  catch { workspaceTools = false; }
  for (const id of ['nav-calendar', 'open-planner', 'custom-focus']) show(id, workspaceTools);
  const pink = $('settings-theme').querySelector('[value="pink"]');
  pink.disabled = pink.hidden = !workspaceTools;
  document.querySelector('[data-theme-option="pink"]').hidden = !workspaceTools;
  show('open-global-search', true);
}

function selectedJournalText(entryId) {
  const body = $(`entry-${entryId}`)?.querySelector('.entry-body');
  const selection = window.getSelection();
  if (!body || !selection?.anchorNode || !selection.focusNode) return '';
  return body.contains(selection.anchorNode) && body.contains(selection.focusNode) ? selection.toString().trim() : '';
}

function keepJournalSelection(event) {
  const button = event.target.closest('[data-action="create-task"]');
  if (button && selectedJournalText(button.closest('article').dataset.id)) event.preventDefault();
}

function openSourceTask(entry) {
  sourceEntry = entry.id;
  $('source-task-form').reset();
  fieldMessage($('source-task-text'));
  fieldMessage($('source-task-due'));
  inlineMessage('source-task-error');
  const selected = selectedJournalText(entry.id) || entry.content.split('\n').find((line) => line.trim()) || '';
  $('source-task-text').value = selected.trim().replace(/\s+/g, ' ').slice(0, 300);
  $('source-task-dialog').showModal();
  $('source-task-text').focus();
}

async function showSourceEntry(hash) {
  const id = hash.slice(1);
  await pendingReports.journal;
  if (currentView !== 'journal' || location.hash !== hash) return;
  if (!$(id) && ($('search').value || $('mood-filter').value || selectedTags.size)) {
    $('search').value = '';
    $('mood-filter').value = '';
    selectedTags.clear();
    await refresh('journal');
  }
  if (currentView !== 'journal' || location.hash !== hash) return;
  const entry = $(id);
  if (entry) {
    entry.focus({ preventScroll: true });
    entry.scrollIntoView({ block: 'center' });
  } else notice('That journal entry is unavailable.', true);
}

function renderPlanner() {
  const today = civilDay(new Date());
  const week = Array.from({ length: 7 }, (_, index) => shiftDay(plannerWeek, index));
  text('planner-range', `${mediumDate.format(noon(week[0]))} – ${mediumDate.format(noon(week[6]))}`);
  const active = plannerTasks.filter((task) => !task.completed);
  const groups = [
    ['Other overdue tasks', active.filter((task) => task.due_date && task.due_date < today && !week.includes(task.due_date))],
    ...week.map((day) => [dayName.format(noon(day)), active.filter((task) => task.due_date === day)]),
    ['Unscheduled', active.filter((task) => !task.due_date)],
  ];
  $('planner-days').innerHTML = groups.map(([label, tasks]) => `<section class="planner-day">
    <h3>${escape(label)} <span>${tasks.length}</span></h3>
    ${tasks.map((task) => `<form class="planner-task" data-planner-task="${task.id}" novalidate>
      <a href="/todos#task-${task.id}">${escape(task.text)}</a>
      <div class="workspace-actions"><input name="due" type="date" value="${task.due_date || ''}" max="9999-12-31" required aria-label="New date for ${escape(task.text)}" data-error="planner-date-error-${task.id}" aria-describedby="planner-date-error-${task.id}">
      <button class="secondary" type="submit">Move</button>
      ${task.due_date && task.due_date < today ? '<button class="text-button" type="button" data-carry>Move to today</button>' : ''}</div>
      <p id="planner-date-error-${task.id}" class="field-error" aria-live="polite" hidden></p>
    </form>`).join('') || '<p class="workspace-hint">No tasks</p>'}</section>`).join('');
}

async function reloadPlanner() {
  inlineMessage('planner-error');
  try {
    plannerTasks = (await request('/api/tasks?sort=dueDate')).tasks;
    renderPlanner();
  } catch (error) { inlineMessage('planner-error', error.message); }
}

async function movePlannerTask(form, day) {
  if (form.dataset.pending) return;
  form.dataset.pending = 'true';
  for (const field of form.querySelectorAll('button, input')) field.disabled = true;
  inlineMessage('planner-error');
  try {
    await updateRecords('tasks', `/api/tasks/${form.dataset.plannerTask}`, 'PATCH', { due_date: day });
    await reloadPlanner();
    notice('Task moved.');
  } catch (error) { inlineMessage('planner-error', error.message); }
  finally {
    delete form.dataset.pending;
    for (const field of form.querySelectorAll('button, input')) field.disabled = false;
  }
}

function calendarRecords(day) {
  return {
    events: calendarItems.events.filter((record) => record.start_day <= day && day <= record.end_day),
    tasks: calendarItems.tasks.filter((record) => record.due_date === day),
    entries: calendarItems.entries.filter((record) => record.day === day),
  };
}

function calendarBadge(kind, label, count) {
  return count ? `<span class="calendar-tag" data-kind="${kind}"><span>${label}</span><b>${count}</b></span>` : '';
}

function agendaGroup(label, items) {
  return items.length ? `<section class="agenda-group"><h3>${label}</h3>${items.join('')}</section>` : '';
}

function renderCalendar() {
  const today = civilDay(new Date());
  const month = calendarMonth.slice(0, 7);
  text('calendar-month', monthName.format(noon(calendarMonth)));
  text('calendar-day-title', fullDate.format(noon(calendarDay)));
  const start = monday(calendarMonth);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = shiftDay(start, index);
    if (day.length !== 10 || day.startsWith('0000-')) return '<span aria-hidden="true"></span>';
    const { events, tasks, entries } = calendarRecords(day);
    const value = noon(day);
    const date = fullDate.format(value);
    const label = `${date}, ${events.length} events, ${tasks.length} tasks, ${entries.length} journal entries`;
    return `<button type="button" class="calendar-cell" data-calendar-day="${day}" data-outside="${!day.startsWith(month)}" data-weekend="${[0, 6].includes(value.getDay())}"
      aria-label="${escape(label)}" aria-pressed="${day === calendarDay}" ${day === today ? 'aria-current="date"' : ''}>
      <span class="calendar-number">${value.getDate()}</span><span class="calendar-tags">
      ${calendarBadge('event', 'Events', events.length)}${calendarBadge('task', 'Tasks', tasks.length)}${calendarBadge('journal', 'Journal', entries.length)}</span></button>`;
  });
  $('calendar-days').innerHTML = cells.join('');
  const { events, tasks, entries } = calendarRecords(calendarDay);
  $('calendar-agenda').innerHTML = [
    agendaGroup('Events', events.map((item) => `<button type="button" class="agenda-item" data-event-id="${item.id}">
      <span class="calendar-tag" data-kind="event">${eventTime(item, calendarDay)}</span><strong>${escape(item.title)}</strong></button>`)),
    agendaGroup('Tasks due', tasks.map((item) => `<a class="agenda-item" href="/todos#task-${item.id}"><span class="calendar-tag" data-kind="task">${item.completed ? 'Done' : 'Due'}</span>
      <strong>${escape(item.text)}</strong></a>`)),
    agendaGroup('Journal entries', entries.map((item) => `<a class="agenda-item" href="/journal#entry-${item.id}"><span class="calendar-tag" data-kind="journal">${escape(moods[item.mood]?.[0] || 'Entry')}</span>
      <strong>${escape(excerpt(item.content))}</strong></a>`)),
  ].join('') || '<p class="workspace-hint">No schedules, tasks, or entries for this date.</p>';
}

function eventTime(event, day) {
  if (!event.start_time) return 'All day';
  if (event.start_day === event.end_day) return `${escape(event.start_time)} – ${escape(event.end_time)}`;
  if (day === event.start_day) return `Starts ${escape(event.start_time)}`;
  if (day === event.end_day) return `Ends ${escape(event.end_time)}`;
  return 'Continues';
}

function selectCalendarDay(day) {
  calendarDay = day;
  calendarMonth = day.slice(0, 7) + '-01';
  renderCalendar();
}

async function loadCalendar(hash = '') {
  const version = ++calendarLoad;
  inlineMessage('calendar-error');
  renderCalendar();
  try {
    const data = await loadWorkspaceRecords(true);
    if (version !== calendarLoad || currentView !== 'calendar') return;
    calendarItems = data;
    const match = /^#event-(\d+)$/.exec(hash);
    const event = match && calendarItems.events.find((record) => record.id === Number(match[1]));
    if (event) selectCalendarDay(event.start_day);
    else renderCalendar();
    if (event) $('calendar-agenda').querySelector(`[data-event-id="${event.id}"]`)?.focus();
  } catch (error) {
    if (version === calendarLoad) inlineMessage('calendar-error', error.message);
  }
}

function openEvent(event) {
  editingEvent = event?.id ?? null;
  const form = $('event-form');
  form.reset();
  for (const input of form.querySelectorAll('[name]')) input.value = event?.[input.name] ?? '';
  for (const input of form.querySelectorAll('[data-error]')) fieldMessage(input);
  if (!event) form.elements.start_day.value = calendarDay;
  text('event-title', event ? 'Edit event' : 'New event');
  show('delete-event', Boolean(event));
  inlineMessage('event-error');
  $('event-dialog').showModal();
  $('event-name').focus();
}

function excerpt(value, limit = 110) {
  const summary = value.trim().replace(/\s+/g, ' ');
  return summary.length > limit ? `${summary.slice(0, limit - 1)}…` : summary;
}

function validatedEvent(form) {
  const { title, start_day: start, end_day: end, start_time: from, end_time: to } = form.elements;
  for (const input of form.querySelectorAll('[data-error]')) fieldMessage(input);
  const name = formText(title, 'Give your event a title.');
  if (!name) return null;
  if (!start.value || !start.validity.valid) {
    fieldMessage(start, 'Choose a valid start date.');
    return null;
  }
  if (!end.validity.valid || (end.value && end.value < start.value)) {
    fieldMessage(end, 'Choose an end date on or after the start date.');
    return null;
  }
  for (const [field, other, label] of [[from, to, 'start'], [to, from, 'end']]) {
    if (!field.validity.valid || (other.value && !field.value)) {
      fieldMessage(field, `Choose a valid ${label} time.`);
      return null;
    }
  }
  if ((!end.value || end.value === start.value) && from.value && to.value <= from.value) {
    fieldMessage(to, 'Choose an end time after the start time.');
    return null;
  }
  return { ...Object.fromEntries(new FormData(form)), title: name };
}

async function loadWorkspaceRecords(includeEvents) {
  const [journal, tasks, calendar] = await Promise.all([
    request('/api/journal'), request('/api/tasks'), includeEvents ? request('/api/calendar') : { events: [] },
  ]);
  return { entries: journal.entries.map((entry) => ({ ...entry, day: civilDay(entry.created_at) })),
    tasks: tasks.tasks, events: calendar.events };
}

function renderSearchResults() {
  if (searchItems === null) return;
  const query = $('global-query').value.trim().toLocaleLowerCase();
  const matches = query ? searchItems.filter((item) => item.value.includes(query)) : [];
  text('global-search-status', !query ? 'Type to search your workspace.' : !matches.length ? 'No matching results.' :
    matches.length <= 24 ? `${matches.length} ${matches.length === 1 ? 'result' : 'results'}` : `Showing 24 of ${matches.length} results`);
  $('global-results').innerHTML = matches.slice(0, 24).map((item) => `<a class="agenda-item" href="${item.href}">
    <span class="calendar-tag" data-kind="${item.kind}">${item.label}</span><strong>${escape(item.title)}</strong></a>`).join('');
}

function openGlobalSearch() {
  if (!currentView) return;
  const panel = $('global-search-panel');
  if (panel.hidden) {
    show('global-search-panel', true);
    document.body.classList.add('search-open');
    $('open-global-search').setAttribute('aria-expanded', 'true');
    void refreshGlobalSearch();
  }
  $('global-query').focus({ preventScroll: true });
}

function closeGlobalSearch() {
  ++searchLoad;
  show('global-search-panel', false);
  document.body.classList.remove('search-open');
  $('open-global-search').setAttribute('aria-expanded', 'false');
  $('open-global-search').focus({ preventScroll: true });
}

async function refreshGlobalSearch() {
  const panel = $('global-search-panel');
  if (panel.hidden) return;
  const version = ++searchLoad;
  if (searchItems === null) text('global-search-status', 'Loading your workspace…');
  try {
    const { entries, tasks, events } = await loadWorkspaceRecords(workspaceTools);
    if (version !== searchLoad || panel.hidden) return;
    searchItems = [
      ...tasks.map((item) => ({ kind: 'task', label: 'Task', href: `/todos#task-${item.id}`, title: item.text,
        value: [item.text, item.due_date, ...item.subtasks.map((sub) => sub.text)].join(' ').toLocaleLowerCase() })),
      ...entries.map((item) => ({ kind: 'journal', label: 'Journal', href: `/journal#entry-${item.id}`, title: excerpt(item.content),
        value: [item.content, item.day, ...item.tags].join(' ').toLocaleLowerCase() })),
      ...events.map((item) => ({ kind: 'event', label: 'Event', href: `/calendar#event-${item.id}`, title: item.title,
        value: [item.title, item.notes, item.start_day, item.end_day].join(' ').toLocaleLowerCase() })),
    ];
    renderSearchResults();
  } catch (error) {
    if (version === searchLoad) text('global-search-status', error.message);
  }
}

async function refreshAfterDeletion(view) {
  homeStale = true;
  void refreshGlobalSearch();
  if (view === 'calendar' || currentView === 'calendar') await loadCalendar();
  if (view === 'journal') await Promise.all([refresh('journal'), refresh('tasks')]);
  else if (view === 'tasks') await refresh('tasks');
  if (currentView === 'home') void loadHome();
}

async function deleteWorkspaceRecord(view, path, label, onDelete) {
  const result = await request(workspaceTools ? `${path}?undo=1` : path, 'DELETE');
  onDelete?.();
  if (result.token) showUndoToast(result, view, label);
  else notice(`${label} deleted.`);
  await refreshAfterDeletion(view);
}

function showUndoToast({ token, seconds }, view, label) {
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = `<span role="status">${label} deleted.</span><span class="undo-seconds" aria-hidden="true">${seconds}s</span>
    <button type="button" class="text-button">Undo</button><button type="button" class="dialog-close" aria-label="Dismiss deletion notice">×</button>`;
  const [undo, close] = toast.querySelectorAll('button');
  const counter = toast.querySelector('.undo-seconds');
  const deadline = performance.now() + seconds * 1000;
  let undoPending = false;
  const finish = () => {
    clearInterval(timer);
    toast.remove();
    void request(`/api/deletions/${token}/finalize`, 'POST', {}).catch(() => {});
  };
  const timer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    counter.textContent = `${remaining}s`;
    if (!remaining && !undoPending) finish();
  }, 250);
  close.addEventListener('click', () => {
    clearInterval(timer);
    toast.remove();
    setTimeout(finish, Math.max(0, deadline - performance.now()));
  });
  undo.addEventListener('click', async () => {
    if (performance.now() >= deadline) { finish(); return; }
    undoPending = undo.disabled = close.disabled = true;
    try {
      await request(`/api/deletions/${token}/undo`, 'POST', {});
      clearInterval(timer);
      toast.remove();
      await refreshAfterDeletion(view);
      notice(`${label} restored.`);
    } catch (error) {
      notice(error.message, true);
      if (performance.now() >= deadline) finish();
    } finally { undoPending = undo.disabled = close.disabled = false; }
  });
  $('undo-notices').append(toast);
}

function setupWorkspaceTools() {
  $('source-task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('save-source-task');
    if (button.disabled) return;
    const name = formText($('source-task-text'), 'Give your task a name before saving.');
    if (!name) return;
    const due = $('source-task-due');
    if (!due.validity.valid) {
      fieldMessage(due, 'Choose a valid due date.');
      return;
    }
    fieldMessage(due);
    button.disabled = true;
    await mutate('tasks', '/api/tasks', 'POST', { text: name,
      due_date: due.value, source_entry_id: sourceEntry }, () => {
      $('source-task-dialog').close();
      notice('Task created and linked to the journal entry.');
    }, (message) => inlineMessage('source-task-error', message));
    button.disabled = false;
  });
  $('close-source-task').addEventListener('click', () => $('source-task-dialog').close());
  $('open-planner').addEventListener('click', () => {
    plannerWeek = monday(civilDay(new Date()));
    $('planner-dialog').showModal();
    renderPlanner();
    void reloadPlanner();
  });
  $('close-planner').addEventListener('click', () => $('planner-dialog').close());
  $('current-week').addEventListener('click', () => {
    plannerWeek = monday(civilDay(new Date()));
    renderPlanner();
  });
  for (const [id, offset] of [['previous-week', -7], ['next-week', 7]]) {
    $(id).addEventListener('click', () => { plannerWeek = shiftDay(plannerWeek, offset); renderPlanner(); });
  }
  $('planner-days').addEventListener('submit', (event) => {
    event.preventDefault();
    const due = event.target.elements.due;
    if (!due.value || !due.validity.valid) {
      fieldMessage(due, 'Choose a new due date.');
      return;
    }
    fieldMessage(due);
    void movePlannerTask(event.target, due.value);
  });
  $('planner-days').addEventListener('click', (event) => {
    if (event.target.closest('a')) $('planner-dialog').close();
    if (event.target.closest('[data-carry]')) void movePlannerTask(event.target.closest('form'), civilDay(new Date()));
  });

  for (const [id, offset] of [['previous-month', -1], ['next-month', 1]]) {
    $(id).addEventListener('click', () => {
      const month = noon(calendarMonth);
      month.setMonth(month.getMonth() + offset);
      if (month.getFullYear() < 1 || month.getFullYear() > 9999) return;
      selectCalendarDay(civilDay(month));
    });
  }
  $('calendar-today').addEventListener('click', () => selectCalendarDay(civilDay(new Date())));
  $('calendar-days').addEventListener('click', (event) => {
    const day = event.target.closest('[data-calendar-day]');
    if (day) {
      selectCalendarDay(day.dataset.calendarDay);
      $('calendar-days').querySelector(`[data-calendar-day="${day.dataset.calendarDay}"]`)?.focus();
    }
  });
  $('new-event').addEventListener('click', () => openEvent());
  $('close-event').addEventListener('click', () => $('event-dialog').close());
  $('calendar-agenda').addEventListener('click', (event) => {
    const button = event.target.closest('[data-event-id]');
    if (button) openEvent(calendarItems.events.find((item) => item.id === Number(button.dataset.eventId)));
  });
  $('event-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const save = $('save-event');
    if (save.disabled) return;
    inlineMessage('event-error');
    const data = validatedEvent(event.target);
    if (!data) return;
    save.disabled = $('delete-event').disabled = true;
    try {
      await request(editingEvent ? `/api/calendar/${editingEvent}` : '/api/calendar', editingEvent ? 'PATCH' : 'POST', data);
      selectCalendarDay(data.start_day);
      $('event-dialog').close();
      void refreshGlobalSearch();
      await loadCalendar();
      notice('Event saved.');
    } catch (error) { inlineMessage('event-error', error.message); }
    finally { save.disabled = $('delete-event').disabled = false; }
  });
  $('delete-event').addEventListener('click', () => {
    const event = calendarItems.events.find((item) => item.id === editingEvent);
    if (!event) return;
    $('event-dialog').close();
    confirmDeletion('event', event.title, () => deleteWorkspaceRecord('calendar', `/api/calendar/${event.id}`, 'Event'));
  });
  $('open-global-search').addEventListener('click', openGlobalSearch);
  $('close-global-search').addEventListener('click', closeGlobalSearch);
  $('global-query').addEventListener('input', renderSearchResults);
  $('global-query').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('global-results').querySelector('a')?.click();
  });
  $('global-search-panel').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeGlobalSearch();
  });
}
