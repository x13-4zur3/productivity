'use strict';

const isMac = /Mac/.test(navigator.platform);
const primaryModifier = isMac ? 'Meta' : 'Control';
const workspaceModifier = isMac ? 'Alt+Meta+' : 'Control+Alt+';
const defaultShortcuts = {
  home: workspaceModifier + 'Digit1',
  journal: workspaceModifier + 'Digit2',
  tasks: workspaceModifier + 'Digit3',
  settings: primaryModifier + '+Comma',
  create: isMac ? 'Shift+Meta+KeyN' : 'Control+Shift+KeyN',
  search: primaryModifier + '+KeyF',
  save: primaryModifier + '+Enter',
  calendar: workspaceModifier + 'Digit4',
  planner: workspaceModifier + 'KeyP',
  event: workspaceModifier + 'KeyE',
  journalTask: workspaceModifier + 'KeyJ',
  focusToggle: workspaceModifier + 'KeyF',
  focusReset: workspaceModifier + 'KeyR',
  undo: workspaceModifier + 'KeyZ',
  theme: workspaceModifier + 'KeyT',
};
const legacyShortcutActions = ['home', 'journal', 'tasks', 'settings', 'create', 'search', 'save'];
const shortcutActions = {
  home: 'Go to Home',
  journal: 'Go to Journal',
  tasks: 'Go to To-do list',
  settings: 'Open Settings',
  create: 'Create an item in this view',
  search: 'Toggle Search',
  save: 'Save the current entry or task',
  calendar: 'Go to Calendar',
  planner: 'Open Weekly planner',
  event: 'Add a calendar event',
  journalTask: 'Create task from journal text',
  focusToggle: 'Start or pause focus timer',
  focusReset: 'Reset focus timer',
  undo: 'Undo latest deletion',
  theme: 'Open theme picker',
};
const shortcutGroups = {
  Navigation: ['home', 'journal', 'tasks', 'calendar', 'planner', 'search'],
  Editing: ['create', 'event', 'journalTask', 'save', 'undo'],
  'Focus and settings': ['focusToggle', 'focusReset', 'settings', 'theme'],
};
const preferences = {
  name: '', theme: 'light', startPage: 'home', motion: 'system', shortcuts: defaultShortcuts,
};
let draftShortcuts;
let recording = null;
let deleteAction = null;

function shortcutCombo(event) {
  if (!(event.ctrlKey || event.altKey || event.metaKey)
      || !/^(Key[A-Z]|Digit[0-9]|Enter|Comma)$/.test(event.code)
      || event.getModifierState('AltGraph')) return null;
  return [
    event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift',
    event.metaKey && 'Meta', event.code,
  ].filter(Boolean).join('+');
}

function shortcutParts(shortcut, display = true) {
  return shortcut.split('+').map((part) => {
    const labels = display ? {
      Control: 'Ctrl', Meta: isMac ? '⌘' : 'Meta', Alt: isMac ? 'Option' : 'Alt', Comma: ',',
    } : { Comma: ',' };
    return labels[part] || part.replace(/^(Key|Digit)/, '');
  });
}

function availableShortcutActions() {
  return expandedShortcuts ? Object.keys(shortcutActions) : legacyShortcutActions;
}

function completeShortcuts(saved) {
  const actions = availableShortcutActions();
  const assigned = new Set(actions.map((action) => saved[action]).filter(Boolean));
  return Object.fromEntries(actions.map((action) => {
    if (Object.hasOwn(saved, action)) return [action, saved[action]];
    const fallback = defaultShortcuts[action];
    if (assigned.has(fallback)) return [action, null];
    assigned.add(fallback);
    return [action, fallback];
  }));
}

function searchShortcutAlias() {
  const shortcut = defaultShortcuts.search;
  return preferences.shortcuts.search && !Object.values(preferences.shortcuts).includes(shortcut) ? shortcut : null;
}

function applyPreferences(saved) {
  Object.assign(preferences, saved);
  preferences.shortcuts = completeShortcuts(preferences.shortcuts);
  applyTheme(preferences.theme);
  document.documentElement.dataset.motion = preferences.motion;
  const save = preferences.shortcuts.save;
  const controls = { save: ['save-entry', 'save-task'], search: ['open-global-search'], calendar: ['nav-calendar'],
    planner: ['open-planner'], event: ['new-event'], focusToggle: ['toggle-focus'], focusReset: ['reset-focus'] };
  for (const [action, ids] of Object.entries(controls)) {
    const binding = [preferences.shortcuts[action], action === 'search' && searchShortcutAlias()]
      .filter(Boolean).map((shortcut) => shortcutParts(shortcut, false).join('+')).join(' ');
    for (const id of ids) {
      if (binding) $(id).setAttribute('aria-keyshortcuts', binding);
      else $(id).removeAttribute('aria-keyshortcuts');
    }
  }
  const hint = save ? shortcutParts(save).join(' + ') : '';
  text('save-shortcut', hint);
  text('task-save-shortcut', hint);
  updateGreeting();
}

function inlineMessage(id, message = '') {
  text(id, message);
  show(id, Boolean(message));
}

function chooseSettingsTab(section, moveFocus = false) {
  $('settings-dialog').querySelectorAll('[data-tab]').forEach((tab) => {
    const active = tab.dataset.tab === section;
    tab.setAttribute('aria-selected', active);
    tab.tabIndex = active ? 0 : -1;
    show(tab.getAttribute('aria-controls'), active);
    if (active && moveFocus) tab.focus();
  });
}

function shortcutButton(action) {
  return $('shortcut-list').querySelector(`[data-record="${action}"]`);
}

function renderShortcut(action) {
  const button = shortcutButton(action);
  const value = draftShortcuts[action];
  const binding = recording === action ? 'Press keys…' : value ? shortcutParts(value).join(' + ') : 'Unassigned';
  button.textContent = binding;
  button.dataset.recording = recording === action;
  button.setAttribute('aria-label', `${shortcutActions[action]}: ${binding}`);
  $('shortcut-list').querySelector(`[data-clear="${action}"]`).disabled = !value;
}

function stopRecording() {
  if (!recording) return;
  const action = recording;
  recording = null;
  renderShortcut(action);
}

function openSettings() {
  const dialog = $('settings-dialog');
  if (dialog.open) return;
  $('theme-picker').open = false;
  $('display-name').value = preferences.name;
  $('settings-theme').value = preferences.theme;
  $('start-page').value = preferences.startPage;
  $('motion-setting').value = preferences.motion;
  draftShortcuts = completeShortcuts(preferences.shortcuts);
  renderShortcutList();
  inlineMessage('shortcut-error');
  inlineMessage('settings-error');
  chooseSettingsTab('general');
  dialog.showModal();
  $('general-tab').focus();
}

function renderShortcutList() {
  const available = availableShortcutActions();
  $('shortcut-list').innerHTML = Object.entries(shortcutGroups).map(([group, actions]) => {
    const rows = actions.filter((action) => available.includes(action)).map((action) => `
    <div class="shortcut-row">
      <span>${shortcutActions[action]}</span>
      <button type="button" class="shortcut-key" data-record="${action}" aria-describedby="shortcut-help"></button>
      <button type="button" class="text-button shortcut-clear" data-clear="${action}" aria-label="Clear shortcut for ${shortcutActions[action]}">Clear</button>
    </div>`);
    return `<section class="shortcut-group"><h3>${group}</h3>${rows.join('')}</section>`;
  }).join('');
  available.forEach(renderShortcut);
}

function setupSettings() {
  const dialog = $('settings-dialog');
  const list = $('shortcut-list');
  $('open-settings').addEventListener('click', openSettings);
  const close = () => { if (!$('save-settings').disabled) dialog.close(); };
  $('close-settings').addEventListener('click', close);
  $('cancel-settings').addEventListener('click', close);
  dialog.addEventListener('close', stopRecording);
  dialog.addEventListener('cancel', (event) => {
    if ($('save-settings').disabled) event.preventDefault();
  });
  dialog.querySelector('[role="tablist"]').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) chooseSettingsTab(tab.dataset.tab, true);
  });
  dialog.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
    const tabs = [...dialog.querySelectorAll('[data-tab]')];
    const index = tabs.indexOf(event.target);
    if (index === -1) return;
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    chooseSettingsTab(tabs[(target + tabs.length) % tabs.length].dataset.tab, true);
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const wasRecording = recording;
    stopRecording();
    inlineMessage('shortcut-error');
    if (button.dataset.clear) {
      const action = button.dataset.clear;
      draftShortcuts[action] = null;
      renderShortcut(action);
      shortcutButton(action).focus();
    } else if (button.dataset.record !== wasRecording) {
      recording = button.dataset.record;
      renderShortcut(recording);
    }
  });
  list.addEventListener('focusout', (event) => {
    if (event.target.dataset.record === recording) stopRecording();
  });
  list.addEventListener('keydown', (event) => {
    if (!recording || event.target.dataset.record !== recording || event.key === 'Tab' || event.isComposing) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      stopRecording();
      inlineMessage('shortcut-error');
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    const shortcut = shortcutCombo(event);
    if (!shortcut) {
      inlineMessage('shortcut-error', 'Use Ctrl, Alt, or Command with a letter, number, comma, or Enter.');
      return;
    }
    const conflict = Object.keys(draftShortcuts).find((action) => action !== recording && draftShortcuts[action] === shortcut);
    if (conflict) {
      inlineMessage('shortcut-error', `That shortcut is already used for “${shortcutActions[conflict]}”.`);
      return;
    }
    draftShortcuts[recording] = shortcut;
    stopRecording();
    inlineMessage('shortcut-error');
  });
  $('reset-shortcuts').addEventListener('click', () => {
    stopRecording();
    draftShortcuts = completeShortcuts({});
    availableShortcutActions().forEach(renderShortcut);
    inlineMessage('shortcut-error');
  });

  $('settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if ($('save-settings').disabled) return;
    stopRecording();
    const saved = {
      name: $('display-name').value.trim(),
      startPage: $('start-page').value,
      theme: $('settings-theme').value,
      motion: $('motion-setting').value,
      shortcuts: draftShortcuts,
    };
    inlineMessage('settings-error');
    $('save-settings').disabled = true;
    try {
      await request('/api/preferences', 'PATCH', saved);
      applyPreferences(saved);
      dialog.close();
      notice('Settings saved.');
    } catch (error) {
      inlineMessage('settings-error', error.message);
    } finally {
      $('save-settings').disabled = false;
    }
  });
}

function confirmDeletion(kind, excerpt, action) {
  const dialog = $('delete-dialog');
  if (dialog.open) return;
  deleteAction = action;
  text('delete-title', `Delete this ${kind}?`);
  const description = kind === 'task' ? 'This removes the task and its subtasks.' : `This removes the ${kind}.`;
  text('delete-description', workspaceTools ? `${description} You’ll have 30 seconds to undo.` : `${description} This is permanent.`);
  const preview = excerpt.length > 180 ? excerpt.slice(0, 177).trimEnd() + '…' : excerpt;
  text('delete-preview', preview);
  show('delete-preview', Boolean(preview));
  inlineMessage('delete-error');
  dialog.showModal();
  $('cancel-delete').focus();
}

function setupDeletion() {
  const dialog = $('delete-dialog');
  const confirm = $('confirm-delete');
  $('cancel-delete').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    if (confirm.disabled) event.preventDefault();
  });
  dialog.addEventListener('close', () => { deleteAction = null; });
  confirm.addEventListener('click', async () => {
    if (!deleteAction || confirm.disabled) return;
    confirm.disabled = true;
    $('cancel-delete').disabled = true;
    inlineMessage('delete-error');
    try {
      await deleteAction();
      dialog.close();
      if (!document.activeElement || document.activeElement === document.body) {
        $(currentView === 'calendar' ? 'calendar-title' : 'list-heading').focus();
      }
    } catch (error) {
      inlineMessage('delete-error', error.message);
      confirm.focus();
    } finally {
      confirm.disabled = false;
      $('cancel-delete').disabled = false;
    }
  });
}
