'use strict';

const isMac = /Mac/.test(navigator.platform);
const primaryModifier = isMac ? 'Meta' : 'Control';
const defaultShortcuts = {
  home: isMac ? 'Alt+Meta+Digit1' : 'Control+Alt+Digit1',
  journal: isMac ? 'Alt+Meta+Digit2' : 'Control+Alt+Digit2',
  tasks: isMac ? 'Alt+Meta+Digit3' : 'Control+Alt+Digit3',
  settings: primaryModifier + '+Comma',
  create: isMac ? 'Shift+Meta+KeyN' : 'Control+Shift+KeyN',
  search: primaryModifier + '+KeyF',
  save: primaryModifier + '+Enter',
};
const shortcutActions = {
  home: 'Go to Home',
  journal: 'Go to Journal',
  tasks: 'Go to To-do list',
  settings: 'Open Settings',
  create: 'Start an entry or task',
  search: 'Search journal entries',
  save: 'Save the current entry or task',
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

function applyPreferences(saved) {
  Object.assign(preferences, saved);
  applyTheme(preferences.theme);
  document.documentElement.dataset.motion = preferences.motion;
  const save = preferences.shortcuts.save;
  for (const button of [$('save-entry'), $('save-task')]) {
    if (save) button.setAttribute('aria-keyshortcuts', shortcutParts(save, false).join('+'));
    else button.removeAttribute('aria-keyshortcuts');
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
  draftShortcuts = { ...preferences.shortcuts };
  Object.keys(shortcutActions).forEach(renderShortcut);
  inlineMessage('shortcut-error');
  inlineMessage('settings-error');
  chooseSettingsTab('general');
  dialog.showModal();
  $('general-tab').focus();
}

function setupSettings() {
  const dialog = $('settings-dialog');
  const list = $('shortcut-list');
  list.innerHTML = Object.entries(shortcutActions).map(([action, label]) => `
    <div class="shortcut-row">
      <span>${label}</span>
      <button type="button" class="shortcut-key" data-record="${action}" aria-describedby="shortcut-help"></button>
      <button type="button" class="text-button shortcut-clear" data-clear="${action}" aria-label="Clear shortcut for ${label}">Clear</button>
    </div>`).join('');

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
    draftShortcuts = { ...defaultShortcuts };
    Object.keys(shortcutActions).forEach(renderShortcut);
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
  text('delete-description', kind === 'task'
    ? 'This removes the task and its subtasks. You can’t undo this.'
    : `This removes the ${kind} permanently.`);
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
      if (!document.activeElement || document.activeElement === document.body) $('list-heading').focus();
    } catch (error) {
      inlineMessage('delete-error', error.message);
      confirm.focus();
    } finally {
      confirm.disabled = false;
      $('cancel-delete').disabled = false;
    }
  });
}
