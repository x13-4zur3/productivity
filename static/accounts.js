'use strict';

let accountState = { server: '', username: null };
let accountBusy = false;
let registrationMode = false;
let signInRequired = false;

function usesDefaultServer() {
  return Boolean(accountState.defaultServer && (!accountState.server || accountState.server === accountState.defaultServer));
}

function renderAccount() {
  text('account-workspace', accountState.username || (accountState.server ? 'Signed out' : 'Local data'));
  text('account-details-server', accountState.server);
  text('account-connect', accountState.username ? 'Switch account'
    : accountState.server || accountState.defaultServer ? 'Sign in' : 'Connect to a server');
  show('account-server-row', Boolean(accountState.server && !usesDefaultServer()));
  show('account-logout', Boolean(accountState.username));
  show('settings-use-local', Boolean(accountState.server));
}

function setRegistrationMode(register) {
  registrationMode = register;
  text('account-title', register ? 'Create account' : 'Sign in');
  text('account-submit', register ? 'Create account' : 'Sign in');
  text('account-toggle', register ? 'Back to sign in' : 'Create an account');
  $('account-password').autocomplete = register ? 'new-password' : 'current-password';
  $('account-password').value = '';
  fieldMessage($('account-password'));
  inlineMessage('account-error');
}

function openAccount(required = false) {
  const dialog = $('account-dialog');
  signInRequired = required;
  const configured = usesDefaultServer();
  $('account-server').value = accountState.server || accountState.defaultServer || '';
  show('account-address-field', !configured);
  text('account-description', configured ? 'Access your journal, tasks, and preferences.'
    : 'Connect to the service that holds your Productivity account.');
  $('account-username').value = '';
  for (const id of ['account-server', 'account-username']) fieldMessage($(id));
  setRegistrationMode(false);
  show('close-account', !required);
  dialog.showModal();
  $(accountState.server || configured ? 'account-username' : 'account-server').focus();
}

function setAccountBusy(busy) {
  accountBusy = busy;
  for (const id of ['account-submit', 'account-toggle', 'close-account', 'account-use-local',
                    'account-connect', 'account-logout', 'settings-use-local']) {
    $(id).disabled = busy;
  }
}

async function changeWorkspace(action, data) {
  if (accountBusy) return;
  const dialog = $('account-dialog');
  const messageId = dialog.open ? 'account-error' : 'settings-error';
  inlineMessage(messageId);
  inlineMessage('account-progress', dialog.open && data ? 'Connecting. The first connection may take about a minute.' : '');
  setAccountBusy(true);
  try {
    await request('/api/account/' + action, 'POST', data);
    $('account-password').value = '';
    location.replace('/');
  } catch (error) {
    inlineMessage(messageId, error.message);
  } finally {
    inlineMessage('account-progress');
    setAccountBusy(false);
  }
}

function setupAccounts() {
  const dialog = $('account-dialog');
  $('account-connect').addEventListener('click', () => {
    $('settings-dialog').close();
    openAccount();
  });
  $('account-logout').addEventListener('click', () => void changeWorkspace('logout'));
  $('settings-use-local').addEventListener('click', () => void changeWorkspace('local'));
  $('close-account').addEventListener('click', () => dialog.close());
  $('account-use-local').addEventListener('click', () => {
    if (accountState.server) void changeWorkspace('local');
    else dialog.close();
  });
  $('account-toggle').addEventListener('click', () => setRegistrationMode(!registrationMode));
  dialog.addEventListener('cancel', (event) => {
    if (signInRequired || accountBusy) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    $('account-password').value = '';
    if (!signInRequired && document.activeElement === document.body) $('open-settings').focus();
  });
  $('account-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const server = formText($('account-server'), 'Enter your Productivity server address.');
    if (!server) return;
    const username = formText($('account-username'), 'Enter your username.');
    if (!username) return;
    const field = $('account-password');
    const password = field.value;
    if (!password || (registrationMode && Array.from(password).length < 12)) {
      fieldMessage(field, registrationMode ? 'Use a password of at least 12 characters.' : 'Enter your password.');
      return;
    }
    void changeWorkspace(registrationMode ? 'register' : 'login', { server, username, password });
  });
}

async function loadAccount() {
  accountState = await request('/api/account');
  renderAccount();
  if (accountState.server && !accountState.username) {
    openAccount(true);
    return false;
  }
  return true;
}
