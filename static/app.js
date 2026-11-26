'use strict';

const $ = (id) => document.getElementById(id);
const routes = { home: '/', journal: '/journal', tasks: '/todos', calendar: '/calendar' };
const routeViews = { '/': 'home', '/journal': 'journal', '/todos': 'tasks', '/calendar': 'calendar' };
const lists = { journal: 'journal-records', tasks: 'task-records' };
const reports = { journal: null, tasks: null };
const reportVersions = { journal: 0, tasks: 0 };
const pendingReports = {};
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const moods = { happy: ['Happy', ':D'], neutral: ['Neutral', ':|'], sad: ['Sad', ':('], loved: ['Loved', '<3'] };
const priorities = { low: 'Low', medium: 'Medium', high: 'High' };
const themes = { light: 'Docs', dark: 'Docs Dark', terminal: 'Terminal', contrast: 'High Contrast', pink: 'Pink' };
const mediumDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const prompts = [
  'What was one small thing that made today better?',
  'What are you looking forward to this week?',
  'What surprised you about yourself today?',
  'What feels lighter than it did yesterday?',
  'What is something you want to make more time for?',
  'What would you tell a friend who had the same day as you?',
  'Which moment from today would you like to remember?',
  'What’s one thing you can do to make tomorrow easier?',
];
const selectedTags = new Set();
const openTasks = new Set();
const subtaskDrafts = new Map();
let draftTags = [];
let taskFilter = 'all';
let editingEntry = null;
let editingTask = null;
let currentView;
let viewAnimation;
let homeStale = true;
let homeVersion = 0;
let noticeTimer;
let focus = { minutes: 25, remaining: 25 * 60000, endsAt: null };
let savingFocus = false;

function show(id, visible) {
  $(id).hidden = !visible;
}

function text(id, value) {
  const element = $(id);
  if (element.textContent !== String(value)) element.textContent = value;
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function getPreference(key) {
  try { return localStorage.getItem(`productivity.${key}`); }
  catch { return null; }
}

function setPreference(key, value) {
  try { localStorage.setItem(`productivity.${key}`, value); }
  catch { /* Keep the current view when local storage is unavailable. */ }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  text('theme-label', themes[theme]);
  $('theme-picker').querySelectorAll('[data-theme-option]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.themeOption === theme);
  });
}

function setupTheme() {
  const picker = $('theme-picker');
  const summary = picker.querySelector('summary');
  picker.addEventListener('click', async (event) => {
    const option = event.target.closest('[data-theme-option]');
    if (!option) return;
    const theme = option.dataset.themeOption;
    const previous = preferences.theme;
    if (theme !== previous) applyPreferences({ theme });
    picker.open = false;
    summary.focus();
    try {
      if (theme !== previous) await request('/api/preferences', 'PATCH', { theme });
    } catch (error) {
      if (preferences.theme === theme) applyPreferences({ theme: previous });
      notice(error.message, true);
    }
  });
  document.addEventListener('click', (event) => {
    if (!picker.contains(event.target)) picker.open = false;
  });
  picker.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picker.open) {
      picker.open = false;
      summary.focus();
    }
  });
}

function updateClock() {
  const now = new Date();
  const value = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
  $('clock-time').dateTime = value;
  text('clock-time', value);
  text('clock-date', fullDate.format(now));
}

function notice(message, error = false) {
  clearTimeout(noticeTimer);
  $('notice').dataset.error = error;
  text('notice-mark', error ? '!' : '✓');
  text('notice-message', message);
  show('notice', true);
  noticeTimer = setTimeout(hideNotice, error ? 6500 : 2600);
}

function hideNotice() {
  show('notice', false);
  text('notice-message', '');
}

async function request(path, method = 'GET', data) {
  const headers = {};
  const options = { method, headers };
  if (accountState.workspace) headers['X-Productivity-Workspace'] = accountState.workspace;
  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
    if (path === '/api/preferences') options.keepalive = true;
  }
  const response = await fetch(path, options);
  const result = await response.json();
  if (response.status === 401 && accountState.username && !path.startsWith('/api/account')) {
    accountState.username = null;
    location.replace('/');
  }
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

function updateGreeting() {
  if (currentView !== 'home') return;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  text('home-date', fullDate.format(now));
  $('home-date').dateTime = now.toISOString();
  text('home-greeting', preferences.name ? `${greeting}, ${preferences.name}.` : `${greeting}.`);
}

function focusRemaining() {
  return focus.endsAt ? Math.max(0, Math.min(focus.remaining, focus.endsAt - Date.now())) : focus.remaining;
}

function renderFocus() {
  const remaining = focusRemaining();
  const seconds = Math.ceil(remaining / 1000);
  const value = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const running = remaining > 0 && Boolean(focus.endsAt);
  const complete = remaining === 0;
  show('footer-focus', running);
  if (running) text('footer-focus', `Focus · ${value}`);
  if (currentView === 'home') {
    text('focus-time', value);
    text('focus-label', complete ? 'Session complete!' : running ? 'In focus' :
      remaining < focus.minutes * 60000 ? 'Paused' : 'Ready to focus');
    text('toggle-focus', running ? 'Pause' : 'Start');
    $('focus-display').style.setProperty('--progress', `${100 * (1 - remaining / (focus.minutes * 60000))}%`);
    $('focus-display').dataset.complete = complete;
    $('focus-presets').querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', Number(button.dataset.minutes) === focus.minutes);
      button.disabled = running || savingFocus;
    });
    $('toggle-focus').disabled = savingFocus;
    $('reset-focus').disabled = savingFocus;
    $('set-custom-focus').disabled = running || savingFocus;
  }
  if (complete && focus.endsAt && !savingFocus) {
    notice('Focus session complete. Take a breath :)');
    void saveFocus({ ...focus, remaining: 0, endsAt: null });
  }
}

async function saveFocus(value) {
  const previous = focus;
  savingFocus = true;
  focus = value;
  renderFocus();
  try { await request('/api/preferences', 'PATCH', { focus: value }); }
  catch (error) {
    focus = previous;
    notice(error.message, true);
  } finally {
    savingFocus = false;
  }
}

function setupFocus() {
  $('toggle-focus').addEventListener('click', () => {
    const remaining = focusRemaining();
    if (focus.endsAt && remaining) void saveFocus({ ...focus, remaining, endsAt: null });
    else {
      const duration = remaining || focus.minutes * 60000;
      void saveFocus({ ...focus, remaining: duration, endsAt: Date.now() + duration });
    }
  });
  const reset = (minutes) => saveFocus({ minutes, remaining: minutes * 60000, endsAt: null });
  $('reset-focus').addEventListener('click', () => void reset(focus.minutes));
  $('focus-presets').addEventListener('click', (event) => {
    const minutes = Number(event.target.dataset.minutes);
    if (minutes) void reset(minutes);
  });
  $('custom-focus').addEventListener('submit', (event) => {
    event.preventDefault();
    if ($('set-custom-focus').disabled) return;
    const minutes = $('custom-minutes').valueAsNumber;
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 180) void reset(minutes);
  });
}

async function loadPreferences() {
  try {
    const saved = await request('/api/preferences');
    if (saved.focus) {
      focus = saved.focus;
      if (![5, 15, 25].includes(focus.minutes)) $('custom-minutes').value = focus.minutes;
    }
    const legacy = accountState.server ? null : getPreference('theme');
    const theme = saved.theme || (Object.hasOwn(themes, legacy) ? legacy : 'light');
    const { name = accountState.username || '', startPage = 'home', motion = 'system', shortcuts = defaultShortcuts } = saved;
    applyPreferences({ name, theme, startPage, motion, shortcuts });
    if (!saved.theme && theme !== 'light') await request('/api/preferences', 'PATCH', { theme });
  } catch (error) {
    notice(error.message, true);
  }
  renderFocus();
}

async function loadHome() {
  const version = ++homeVersion;
  homeStale = false;
  try {
    const data = await request('/api/home');
    if (version !== homeVersion) return;
    text('home-due', data.due);
    text('home-active', data.active);
    text('home-completed', data.completed);
    text('home-note', data.due ? `${data.due} ${data.due === 1 ? 'task needs' : 'tasks need'} your attention.` :
      'You’re caught up on due tasks.');
    show('home-empty-tasks', data.tasks.length === 0);
    $('home-tasks').innerHTML = data.tasks.map(({ id, text: label, due_date }) =>
      `<li><a href="/todos#task-${id}">${escape(label)}</a><time datetime="${due_date || ''}">${due_date ? dateLabel(due_date) : 'Anytime'}</time></li>`).join('');
    const total = data.activity.reduce((count, day) => count + day.count, 0);
    const peak = Math.max(1, ...data.activity.map((day) => day.count));
    text('activity-summary', `${total} ${total === 1 ? 'entry' : 'entries'} in the last seven days`);
    $('activity-days').innerHTML = data.activity.map(({ day, count }) =>
      `<li><span class="sr-only">${dateLabel(day)}: ${count} ${count === 1 ? 'entry' : 'entries'}</span>
        <span aria-hidden="true" class="activity-count">${count}</span>
        <span aria-hidden="true" class="activity-bar" style="--bar-height:${100 * count / peak}%"></span>
        <span aria-hidden="true">${weekday.format(new Date(`${day}T00:00:00`))}</span></li>`).join('');
    show('latest-entry', Boolean(data.latest));
    if (data.latest) {
      const savedDate = mediumDate.format(new Date(data.latest.created_at));
      text('latest-entry-date', `Latest reflection · ${savedDate} · ${moods[data.latest.mood]?.[0] || 'Neutral'}`);
      text('latest-entry-excerpt', data.latest.excerpt);
    }
  } catch (error) {
    if (version === homeVersion) {
      homeStale = true;
      if (currentView === 'home') notice(error.message, true);
    }
  }
}

function setupHome() {
  const now = new Date();
  let index = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000) % prompts.length;
  const showPrompt = () => {
    text('writing-prompt', prompts[index]);
    $('use-prompt').href = `/journal?compose=1&prompt=${index}`;
  };
  $('next-prompt').addEventListener('click', () => {
    index = (index + 1) % prompts.length;
    showPrompt();
  });
  showPrompt();
  setupFocus();
}

function renderSummary(view) {
  const data = reports[view];
  const tasks = view === 'tasks';
  text('first-stat', data ? tasks ? data.active : data.total : '–');
  text('second-stat', data ? tasks ? data.completed : data.month : '–');
  const total = tasks && data ? data.active + data.completed : 0;
  show('completion-progress', total > 0);
  if (total) {
    $('task-progress').max = total;
    $('task-progress').value = data.completed;
    text('task-progress-label', `${Math.round(100 * data.completed / total)}%`);
  }
}

function refresh(view) {
  const tasks = view === 'tasks';
  const version = ++reportVersions[view];
  const query = tasks
    ? new URLSearchParams({ status: taskFilter, sort: $('task-sort').value })
    : new URLSearchParams({ q: $('search').value, mood: $('mood-filter').value });
  if (!tasks) selectedTags.forEach((tag) => query.append('tag', tag));

  const list = $(lists[view]);
  list.setAttribute('aria-busy', 'true');
  const result = request(`/api/${view}?${query}`).then((data) => {
    if (version !== reportVersions[view]) return;
    reports[view] = data;
    if (tasks) renderTasks(data);
    else renderJournal(data);
    if (view === currentView) renderSummary(view);
  }).catch((error) => {
    if (version !== reportVersions[view]) return;
    if (view === currentView) notice(error.message, true);
  }).finally(() => {
    if (version !== reportVersions[view]) return;
    delete pendingReports[view];
    list.setAttribute('aria-busy', 'false');
  });
  pendingReports[view] = result;
  return result;
}

async function updateRecords(view, path, method, data, onSuccess) {
  await request(path, method, data);
  onSuccess?.();
  homeStale = true;
  if (currentView === 'home') void loadHome();
  await refresh(view);
}

async function mutate(view, path, method, data, onSuccess, onError) {
  try {
    await updateRecords(view, path, method, data, onSuccess);
    return true;
  } catch (error) {
    if (onError) onError(error.message);
    else notice(error.message, true);
    return false;
  }
}

function fieldMessage(field, message = '', focus = Boolean(message)) {
  inlineMessage(field.dataset.error, message);
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  if (focus && field.offsetWidth) field.focus();
}

function formText(field, emptyMessage) {
  const value = field.value.trim();
  fieldMessage(field, value ? '' : emptyMessage);
  return value;
}

function emptyState(icon, title, details) {
  return `<div class="empty"><span class="empty-symbol" aria-hidden="true"><i class="icon icon-${icon}"></i></span><strong>${title}</strong><p>${details}</p></div>`;
}

function tagChip(tag, remove = false) {
  const label = escape(tag);
  const state = remove ? `aria-label="Remove tag ${label}"` : `aria-pressed="${selectedTags.has(tag)}"`;
  return `<button type="button" class="chip" data-tag="${label}" ${state}>${label}${remove ? ' <span aria-hidden="true">×</span>' : ''}</button>`;
}

function renderJournal(data) {
  let removedFilter = false;
  for (const tag of selectedTags) {
    if (!data.tags.includes(tag)) {
      selectedTags.delete(tag);
      removedFilter = true;
    }
  }
  if (removedFilter) void refresh('journal');
  const focusTag = $('tag-options').contains(document.activeElement) ? document.activeElement.dataset.tag : null;
  $('tag-options').innerHTML = data.tags.map((tag) => tagChip(tag)).join('');
  if (focusTag !== null) [...$('tag-options').children].find((chip) => chip.dataset.tag === focusTag)?.focus();
  show('tag-filters', data.tags.length > 0);
  show('tag-filter-count', selectedTags.size > 0);
  text('tag-filter-count', selectedTags.size);
  show('clear-filters', Boolean(selectedTags.size || $('mood-filter').value || $('search').value));
  $('journal-records').innerHTML = data.entries.map((entry) => {
    const [mood, sign] = moods[entry.mood] || moods.neutral;
    return `<article class="card record" id="entry-${entry.id}" data-id="${entry.id}" tabindex="-1">
      <div class="record-top"><div class="record-meta"><time datetime="${escape(entry.created_at)}">${mediumDate.format(new Date(entry.created_at))}</time><span aria-hidden="true">·</span><code class="mood-sign" aria-hidden="true">${escape(sign)}</code>${mood}</div>
        <div class="actions">${workspaceTools ? '<button type="button" class="text-button" data-action="create-task">Create task</button>' : ''}<button class="text-button" data-action="edit">Edit</button><button class="text-button delete" data-action="delete">Delete</button></div>
      </div><p class="entry-body">${escape(entry.content)}</p><div class="chips">${entry.tags.map((tag) => tagChip(tag)).join('')}</div>
    </article>`;
  }).join('') || (data.total ? emptyState('search', 'No matching entries', 'Try another search or clear the filters.')
    : emptyState('book', 'No entries yet', 'Your saved reflections will appear here.'));
}

function toggleTag(tag) {
  if (!selectedTags.delete(tag)) selectedTags.add(tag);
  void refresh('journal');
}

function renderDraftTags() {
  $('draft-tags').innerHTML = draftTags.map((tag) => tagChip(tag, true)).join('');
}

function addDraftTag() {
  const input = $('new-tag');
  const tag = formText(input, 'Type a tag to add it.');
  if (!tag) return;
  if (draftTags.includes(tag)) {
    fieldMessage(input, 'That tag is already added.');
    return;
  }
  if (draftTags.length >= 20) {
    fieldMessage(input, 'You can add up to 20 tags.');
    return;
  }
  draftTags.push(tag);
  input.value = '';
  renderDraftTags();
}

function editEntry(entry) {
  editingEntry = entry?.id ?? null;
  $('entry-form').reset();
  fieldMessage($('entry-content'));
  fieldMessage($('new-tag'));
  draftTags = entry ? [...entry.tags] : [];
  if (entry) {
    $('entry-content').value = entry.content;
    $('entry-form').elements.mood.value = entry.mood;
    $('entry-content').focus();
  }
  renderDraftTags();
  text('journal-form-title', entry ? 'Edit entry' : 'New entry');
  text('save-entry', entry ? 'Save changes' : 'Save entry');
  show('cancel-entry', Boolean(entry));
}

function setupJournal() {
  $('new-tag').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.isComposing) {
      event.preventDefault();
      addDraftTag();
    }
  });
  $('add-tag').addEventListener('click', addDraftTag);
  $('draft-tags').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-tag]');
    if (!chip) return;
    draftTags = draftTags.filter((tag) => tag !== chip.dataset.tag);
    renderDraftTags();
    $('new-tag').focus();
  });
  $('cancel-entry').addEventListener('click', () => editEntry(null));
  $('entry-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if ($('save-entry').disabled) return;
    const input = $('entry-content');
    const content = formText(input, 'Write something in your journal before saving.');
    if (!content) return;
    const pending = $('new-tag').value.trim();
    const tags = pending && !draftTags.includes(pending) ? [...draftTags, pending] : draftTags;
    if (tags.length > 20) {
      fieldMessage($('new-tag'), 'You can add up to 20 tags.');
      return;
    }
    const data = { content, mood: event.currentTarget.elements.mood.value, tags };
    const id = editingEntry;
    $('save-entry').disabled = true;
    await mutate('journal', id ? `/api/entries/${id}` : '/api/entries', id ? 'PATCH' : 'POST', data, () => {
      editEntry(null);
      notice(id ? 'Changes saved.' : 'Entry saved.');
    }, (message) => fieldMessage(input, message));
    $('save-entry').disabled = false;
  });
  let searchTimer;
  $('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refresh('journal'), 130);
  });
  $('mood-filter').addEventListener('change', () => refresh('journal'));
  $('tag-options').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-tag]');
    if (chip) toggleTag(chip.dataset.tag);
  });
  $('clear-filters').addEventListener('click', () => {
    $('search').value = '';
    $('mood-filter').value = '';
    $('tag-filters').open = false;
    selectedTags.clear();
    $('search').focus();
    void refresh('journal');
  });
  $('journal-records').addEventListener('pointerdown', keepJournalSelection);
  $('journal-records').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.tag !== undefined) {
      toggleTag(button.dataset.tag);
      return;
    }
    const id = Number(button.closest('article').dataset.id);
    const entry = reports.journal?.entries.find((record) => record.id === id);
    if (!entry) return;
    if (button.dataset.action === 'edit') editEntry(entry);
    if (button.dataset.action === 'create-task') openSourceTask(entry);
    if (button.dataset.action === 'delete') {
      confirmDeletion('entry', entry.content, async () => {
        await deleteWorkspaceRecord('journal', `/api/entries/${id}`, 'Entry', () => {
          if (editingEntry === id) editEntry(null);
        });
      });
    }
  });
}

function dateLabel(date) {
  return mediumDate.format(new Date(`${date}T00:00:00`));
}

function renderReminders(due, today) {
  $('due-tasks').innerHTML = due.length ? `<ul class="due-list">${due.map((task) => `
    <li><a href="#task-${task.id}" data-reminder="${task.id}">${escape(task.text)}</a> (${task.due_date === today ? 'today' : 'overdue'})</li>`).join('')}</ul>`
    : '<p>No tasks due today or overdue.</p>';
  const supports = 'Notification' in window;
  show('enable-reminders', supports && Notification.permission === 'default');
  if (currentView !== 'tasks' || !supports || Notification.permission !== 'granted') return;
  for (const task of due) {
    const workspace = accountState.username ? `${accountState.server}.${accountState.username}.` : '';
    const key = `reminder.${workspace}${task.id}.${task.due_date}`;
    if (getPreference(key)) continue;
    try {
      new Notification(task.due_date === today ? 'Task due today' : 'Task overdue', { body: task.text, tag: key });
      setPreference(key, 'seen');
    } catch { /* The in-app reminders remain available. */ }
  }
}

function renderTasks(data) {
  $('task-records').innerHTML = data.tasks.map((task) => {
    const overdue = !task.completed && task.due_date < data.today;
    const due = task.due_date ? `<span class="${overdue ? 'overdue' : ''}">Due ${dateLabel(task.due_date)}</span>` : '';
    const repeat = task.cadence !== 'none' ? `<span>Repeats ${escape(task.cadence)}</span>` : '';
    const options = Object.entries(priorities).map(([key, label]) => `<option value="${key}" ${key === task.priority ? 'selected' : ''}>${label}</option>`).join('');
    const count = task.subtasks.length;
    const done = task.subtasks.filter((subtask) => subtask.completed).length;
    const subtasks = task.subtasks.map((subtask) => `<li>
      <label class="check-label"><input type="checkbox" data-subtask="${subtask.id}" ${subtask.completed ? 'checked' : ''}><span>${escape(subtask.text)}</span></label>
      <button class="text-button delete" type="button" data-action="delete-subtask" data-subtask-id="${subtask.id}" aria-label="Delete subtask ${escape(subtask.text)}">Delete</button></li>`).join('');
    return `<article class="card record task-record" id="task-${task.id}" data-id="${task.id}">
      <div class="record-top"><label class="check-label"><input type="checkbox" data-task-toggle ${task.completed ? 'checked' : ''}><span>${escape(task.text)}</span></label>
        <div class="actions"><span class="priority-control" data-level="${escape(task.priority)}"><select class="priority-select" aria-label="Priority for ${escape(task.text)}" data-priority>${options}</select></span><button class="text-button" type="button" data-action="edit">Edit</button><button class="text-button delete" type="button" data-action="delete">Delete</button></div>
      </div><div class="record-meta task-meta">${due}${repeat}${task.source_entry_id ? `<a href="/journal#entry-${task.source_entry_id}">Source journal entry</a>` : ''}</div>
      <details class="task-details" ${openTasks.has(task.id) ? 'open' : ''}>
        <summary>Subtasks${count ? ` (${done}/${count})` : ''}</summary><ul class="subtasks">${subtasks}</ul>
        <form data-subtask-form novalidate>
          <div class="inline-input"><input type="text" name="text" required maxlength="300" aria-label="New subtask" aria-describedby="subtask-error-${task.id}" data-error="subtask-error-${task.id}" placeholder="Add a subtask…" value="${escape(subtaskDrafts.get(task.id) || '')}"><button class="secondary" type="submit">Add subtask</button></div>
          <p class="field-error" id="subtask-error-${task.id}" aria-live="polite" hidden></p>
        </form>
      </details>
    </article>`;
  }).join('') || (data.active + data.completed ? emptyState('check', 'No tasks in this view', 'Choose another status to see more tasks.')
    : emptyState('check', 'No tasks yet', 'Add a task to start planning.'));
  renderReminders(data.due, data.today);
}

function editTask(task) {
  editingTask = task?.id ?? null;
  const form = $('task-form');
  form.reset();
  fieldMessage($('task-text'));
  fieldMessage($('task-due'));
  $('task-options').open = Boolean(task && (task.due_date || task.priority !== 'low' || task.cadence !== 'none'));
  if (task) {
    for (const field of ['text', 'due_date', 'priority', 'cadence']) form.elements[field].value = task[field] ?? '';
    form.elements.text.focus();
  }
  $('task-due').required = form.elements.cadence.value !== 'none';
  text('task-form-title', task ? 'Edit task' : 'New task');
  text('save-task', task ? 'Save changes' : 'Add task');
  show('cancel-task', Boolean(task));
}

function setStatus(value) {
  taskFilter = value;
  $('task-filters').querySelectorAll('[data-status]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.status === value);
  });
}

function setupTasks() {
  $('task-repeat').addEventListener('change', () => {
    $('task-due').required = $('task-repeat').value !== 'none';
    if (!$('task-due').required) fieldMessage($('task-due'));
  });
  $('cancel-task').addEventListener('click', () => editTask(null));
  $('task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if ($('save-task').disabled) return;
    const input = $('task-text');
    const name = formText(input, 'Give your task a name before saving.');
    if (!name) return;
    const due = $('task-due');
    if (due.validity.badInput || due.validity.rangeOverflow || (due.required && !due.value)) {
      $('task-options').open = true;
      fieldMessage(due, due.required && !due.value ? 'Choose a due date for this repeating task.' : 'Enter a valid due date.');
      return;
    }
    const id = editingTask;
    const data = { ...Object.fromEntries(new FormData(event.currentTarget)), text: name };
    $('save-task').disabled = true;
    await mutate('tasks', id ? `/api/tasks/${id}` : '/api/tasks', id ? 'PATCH' : 'POST', data, () => {
      editTask(null);
      if (!id && taskFilter === 'completed') setStatus('active');
      notice(id ? 'Changes saved.' : 'Task added.');
    }, (message) => fieldMessage(input, message));
    $('save-task').disabled = false;
  });
  $('task-sort').addEventListener('change', () => refresh('tasks'));
  $('task-filters').addEventListener('click', (event) => {
    if (!event.target.dataset.status) return;
    setStatus(event.target.dataset.status);
    void refresh('tasks');
  });
  $('task-records').addEventListener('toggle', (event) => {
    if (!event.target.matches('.task-details') || !event.target.isConnected) return;
    const id = Number(event.target.closest('article').dataset.id);
    if (event.target.open) openTasks.add(id);
    else openTasks.delete(id);
  }, true);
  $('task-records').addEventListener('input', (event) => {
    if (event.target.form?.hasAttribute('data-subtask-form')) {
      subtaskDrafts.set(Number(event.target.closest('article').dataset.id), event.target.value);
    }
  });
  $('task-records').addEventListener('submit', async (event) => {
    if (!event.target.hasAttribute('data-subtask-form')) return;
    event.preventDefault();
    const id = Number(event.target.closest('article').dataset.id);
    const button = event.target.querySelector('button');
    if (button.disabled) return;
    const input = event.target.elements.text;
    const name = formText(input, 'Give your subtask a name before adding it.');
    if (!name) return;
    button.disabled = true;
    await mutate('tasks', `/api/tasks/${id}/subtasks`, 'POST', { text: name }, () => {
      openTasks.add(id);
      subtaskDrafts.delete(id);
    }, (message) => fieldMessage(input, message));
    button.disabled = false;
  });
  $('task-records').addEventListener('change', async (event) => {
    const input = event.target;
    if (!input.matches('[data-task-toggle], [data-subtask], [data-priority]')) return;
    const id = Number(input.closest('article').dataset.id);
    const path = input.dataset.subtask ? `/api/subtasks/${input.dataset.subtask}` : `/api/tasks/${id}`;
    const data = input.hasAttribute('data-priority') ? { priority: input.value } : { completed: input.checked };
    input.disabled = true;
    if (!await mutate('tasks', path, 'PATCH', data)) await refresh('tasks');
    input.disabled = false;
  });
  $('task-records').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = Number(button.closest('article').dataset.id);
    const task = reports.tasks?.tasks.find((record) => record.id === id);
    if (!task) return;
    if (button.dataset.action === 'edit') editTask(task);
    if (button.dataset.action === 'delete') {
      confirmDeletion('task', task.text, async () => {
        await deleteWorkspaceRecord('tasks', `/api/tasks/${id}`, 'Task', () => {
          if (editingTask === id) editTask(null);
          openTasks.delete(id);
          subtaskDrafts.delete(id);
        });
      });
    }
    if (button.dataset.action === 'delete-subtask') {
      const subtask = task.subtasks.find((record) => record.id === Number(button.dataset.subtaskId));
      if (subtask) confirmDeletion('subtask', subtask.text, async () => {
        await deleteWorkspaceRecord('tasks', `/api/subtasks/${subtask.id}`, 'Subtask');
      });
    }
  });
  $('due-tasks').addEventListener('click', async (event) => {
    const link = event.target.closest('[data-reminder]');
    if (!link || $(`task-${link.dataset.reminder}`)) return;
    event.preventDefault();
    setStatus('active');
    await refresh('tasks');
    $(`task-${link.dataset.reminder}`)?.scrollIntoView({ block: 'center' });
  });
  $('enable-reminders').addEventListener('click', async () => {
    try {
      if (await Notification.requestPermission() === 'granted') notice('Desktop alerts enabled.');
      await refresh('tasks');
    } catch { notice('Desktop alerts could not be enabled.', true); }
  });
  setInterval(async () => {
    if (currentView !== 'tasks') return;
    try {
      const { due, today } = await request('/api/tasks');
      renderReminders(due, today);
    } catch { /* Leave the last loaded reminders available. */ }
  }, 60000);
}


function focusComposer() {
  if (currentView === 'calendar') {
    openEvent();
    return;
  }
  if (currentView === 'home') {
    navigate('/journal?compose=1');
  } else {
    $(currentView === 'tasks' ? 'task-text' : 'entry-content').focus();
  }
}

function renderWorkView(view) {
  const tasks = view === 'tasks';
  text('page-title', tasks ? 'To-do list' : 'Journal');
  text('page-description', tasks ? 'Plan your work and keep track of what’s due.'
    : 'Write a reflection, log how you feel, and find it again by mood or tag.');
  text('quick-create-label', tasks ? 'New task' : 'New entry');
  text('list-heading', tasks ? 'Tasks' : 'Entries');
  text('stats-title', tasks ? 'Task stats' : 'Journal stats');
  text('first-stat-label', tasks ? 'Active tasks' : 'Total entries');
  text('second-stat-label', tasks ? 'Completed' : 'This month');
  ['task-compose', 'task-controls', 'task-filters', 'task-records', 'reminders'].forEach((id) => show(id, tasks));
  ['journal-compose', 'search-control', 'journal-filters', 'journal-records'].forEach((id) => show(id, !tasks));
  renderSummary(view);
  if (tasks && reports.tasks) renderReminders(reports.tasks.due, reports.tasks.today);
  if (!reports[view] && !pendingReports[view]) void refresh(view);
}

async function showTask(hash) {
  const taskId = hash.slice(1);
  await pendingReports.tasks;
  if (currentView !== 'tasks' || location.hash !== hash) return;
  if (!$(taskId) && taskFilter !== 'all') {
    setStatus('all');
    await refresh('tasks');
  }
  if (currentView === 'tasks' && location.hash === hash) $(taskId)?.scrollIntoView({ block: 'center' });
}

function activate(url, focusHeading = false) {
  const view = routeViews[url.pathname];
  if (!view) return;
  if (view === 'calendar' && !workspaceTools) {
    history.replaceState({}, '', '/');
    activate(new URL(location.href), focusHeading);
    return;
  }
  const changed = view !== currentView;
  currentView = view;
  const home = view === 'home';
  const calendar = view === 'calendar';
  if (changed) {
    for (const name of Object.keys(routes)) {
      const nav = $(`nav-${name}`);
      if (name === view) nav.setAttribute('aria-current', 'page');
      else nav.removeAttribute('aria-current');
    }
    show('home-view', home);
    show('calendar-view', calendar);
    show('work-view', !home && !calendar);
    if (home) {
      updateGreeting();
      renderFocus();
      if (homeStale) void loadHome();
    } else if (!calendar) {
      renderWorkView(view);
      updateClock();
    }
    window.scrollTo(0, 0);
    viewAnimation?.cancel();
    const panel = $(home ? 'home-view' : calendar ? 'calendar-view' : 'work-view');
    if (panel.animate && preferences.motion !== 'reduce' && !motionQuery.matches) {
      viewAnimation = panel.animate(
        [{ opacity: .74, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 135, easing: 'ease-out' },
      );
    }
  }

  if (view === 'journal') {
    const index = url.searchParams.get('prompt');
    const prompt = index !== null && /^\d+$/.test(index) ? prompts[index] : '';
    text('entry-prompt', prompt || '');
    show('entry-prompt', Boolean(prompt));
    $('entry-content').setAttribute('aria-describedby', prompt ? 'entry-prompt entry-error' : 'entry-error');
  }
  if (calendar) {
    void loadCalendar(url.hash);
    if (changed && focusHeading) $('calendar-title').focus({ preventScroll: true });
  } else if (!home && url.searchParams.has('compose')) {
    focusComposer();
  } else if (view === 'tasks' && /^#task-\d+$/.test(url.hash)) {
    void showTask(url.hash);
  } else if (view === 'journal' && /^#entry-\d+$/.test(url.hash)) {
    void showSourceEntry(url.hash);
  } else if (home && url.hash === '#focus-title') {
    $('focus-title').scrollIntoView({ block: 'center' });
  } else if (changed && focusHeading) {
    $(home ? 'home-greeting' : 'page-title').focus({ preventScroll: true });
  }
}

function navigate(path, focusHeading = true) {
  const url = new URL(path, location.href);
  if (url.href !== location.href) history.pushState({}, '', url);
  activate(url, focusHeading);
}

function setupNavigation() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="/"]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !Object.hasOwn(routeViews, url.pathname)) return;
    event.preventDefault();
    navigate(url, event.detail === 0);
  });
  window.addEventListener('popstate', () => activate(new URL(location.href), true));
  $('quick-create').addEventListener('click', focusComposer);
}

function setupShortcuts() {
  const search = openGlobalSearch;
  const save = () => {
    if (currentView !== 'journal' && currentView !== 'tasks') return;
    const task = currentView === 'tasks';
    const button = $(task ? 'save-task' : 'save-entry');
    if (!button.disabled) button.form.requestSubmit(button);
  };
  const actions = { settings: openSettings, create: focusComposer, search, save };
  document.addEventListener('keydown', (event) => {
    if (!currentView || event.defaultPrevented || event.isComposing || event.repeat || document.querySelector('dialog[open]')) return;
    const shortcut = shortcutCombo(event);
    if (!shortcut) return;
    const action = Object.keys(shortcutActions).find((key) => preferences.shortcuts[key] === shortcut);
    if (!action && (shortcut === 'Control+KeyK' || shortcut === 'Meta+KeyK')) {
      event.preventDefault();
      openGlobalSearch();
      return;
    }
    if (!action) return;
    event.preventDefault();
    if (Object.hasOwn(routes, action)) navigate(routes[action]);
    else actions[action]();
  });
}

setupTheme();
setupSettings();
setupAccounts();
setupDeletion();
setupNavigation();
setupShortcuts();
setupHome();
setupJournal();
setupTasks();
setupWorkspaceTools();
document.addEventListener('input', (event) => {
  if (event.target.dataset.error && event.target.hasAttribute('aria-invalid')) fieldMessage(event.target);
});
$('dismiss-notice').addEventListener('click', hideNotice);
applyPreferences({});
setInterval(renderFocus, 250);
setInterval(() => {
  if (currentView && currentView !== 'home') updateClock();
}, 1000);
setInterval(updateGreeting, 60000);
async function startWorkspace() {
  try {
    if (!await loadAccount()) return;
    await loadWorkspaceTools();
    void refresh('journal');
    void refresh('tasks');
    void loadHome();
    await loadPreferences();
    if (currentView) return;
    const url = new URL(location.href);
    if (url.pathname === '/' && !url.hash && !url.search && preferences.startPage !== 'home') {
      history.replaceState({}, '', routes[preferences.startPage]);
      activate(new URL(location.href));
    } else {
      activate(url);
    }
  } catch (error) {
    notice(error.message, true);
  }
}

void startWorkspace();
