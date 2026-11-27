"""Connect a desktop window to a Productivity account service."""

from functools import lru_cache
import json
from pathlib import Path
import re
from secrets import token_urlsafe
import ssl
from tempfile import NamedTemporaryFile
from threading import Lock
from time import monotonic, sleep
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener

from app import InputError


DATA_PATH = re.compile(r'/api/(?:journal|home|preferences|features|calendar(?:/\d+)?|'
                       r'entries(?:/\d+)?|tasks(?:/\d+(?:/subtasks)?)?|subtasks/\d+|'
                       r'deletions/[A-Za-z0-9_-]{32}/(?:undo|finalize))')
TOKEN = re.compile(r'[a-zA-Z0-9_-]{43}')
DEFAULT_SERVER_FILE = Path(__file__).with_name('account-service.json')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def account_origin(value):
    try:
        if not isinstance(value, str):
            raise ValueError
        value = value.strip()
        if not value.isascii() or '\\' in value or any(char.isspace() for char in value):
            raise ValueError
        url = urlsplit(value)
        if (not url.hostname or url.username is not None or url.path not in ('', '/')
                or url.query or url.fragment or url.port == 0 or any(ord(char) < 33 for char in value)):
            raise ValueError
    except ValueError:
        raise InputError('Enter the server address, such as https://accounts.example.com.') from None
    if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('127.0.0.1', '::1')):
        raise InputError('Use HTTPS for an account server, or HTTP on 127.0.0.1 for a local server.')
    return f'{url.scheme}://{url.netloc}'


class AccountError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


@lru_cache(maxsize=1)
def trust_context():
    context = ssl.create_default_context()
    try:
        import certifi
    except ImportError:
        pass
    else:
        context.load_verify_locations(certifi.where())
    return context


def remote_request(origin, path, method='GET', data=None, token=None, *, timeout=8):
    headers = {'Accept': 'application/json'}
    payload = None
    if data is not None:
        headers['Content-Type'] = 'application/json'
        payload = json.dumps(data).encode()
    if token:
        headers['Authorization'] = 'Bearer ' + token
    handlers = [ProxyHandler({}), NoRedirect()]
    if origin.startswith('https:'):
        handlers.append(HTTPSHandler(context=trust_context()))
    opener = build_opener(*handlers)
    request = Request(origin + path, data=payload, headers=headers, method=method)
    try:
        try:
            response = opener.open(request, timeout=timeout)
        except HTTPError as error:
            response = error
        with response:
            if response.headers.get_content_type() != 'application/json':
                raise AccountError(502, 'The address did not respond as a Productivity account server.')
            result = json.load(response)
            return response.code, result
    except (OSError, ValueError) as error:
        raise AccountError(502, 'Could not reach the account server. Check its address and connection.') from error


def default_server():
    try:
        origin = account_origin(json.loads(DEFAULT_SERVER_FILE.read_text(encoding='utf-8'))['server'])
        return origin if origin.startswith('https://') else ''
    except (OSError, ValueError, TypeError, KeyError):
        return ''


def wait_for_accounts(origin, allow_startup):
    deadline = monotonic() + (85 if allow_startup else 8)
    while True:
        remaining = deadline - monotonic()
        if remaining <= 0:
            raise AccountError(503, 'The account service is still starting or offline. Try again shortly.')
        try:
            status, data = remote_request(origin, '/api/health', timeout=min(remaining, 8))
        except AccountError:
            if not allow_startup:
                raise
        else:
            if status == 200 and isinstance(data, dict) and data.get('service') == 'productivity-accounts-v1':
                return
            if status < 500 or not allow_startup:
                raise AccountError(502, 'This address did not respond as a Productivity account service.')
        sleep(min(2, max(0, deadline - monotonic())))


class DesktopAccounts:
    def __init__(self, directory):
        self.path = Path(directory) / 'account-server.json'
        self.lock = Lock()
        self.default_origin = default_server()
        self.origin = self.default_origin
        self.username = None
        self.token = None
        self.workspace = token_urlsafe(16)
        try:
            saved = json.loads(self.path.read_text(encoding='utf-8'))['server']
            self.origin = account_origin(saved) if saved else ''
        except (OSError, ValueError, TypeError, KeyError):
            pass

    def status(self):
        with self.lock:
            return {'server': self.origin, 'defaultServer': self.default_origin,
                    'username': self.username, 'workspace': self.workspace}

    def connection(self, workspace):
        with self.lock:
            if workspace is not None and workspace != self.workspace:
                raise AccountError(409, 'The active workspace changed. Reopen the page and try again.')
            return self.origin, self.token

    def save_origin(self, origin):
        staged = None
        try:
            with NamedTemporaryFile(mode='w', encoding='utf-8', dir=self.path.parent, delete=False) as output:
                staged = Path(output.name)
                json.dump({'server': origin}, output)
            staged.replace(self.path)
        finally:
            if staged is not None:
                staged.unlink(missing_ok=True)

    def revoke(self, origin, token):
        if token:
            try:
                remote_request(origin, '/api/auth/logout', 'POST', token=token)
            except AccountError:
                # The desktop session is cleared even if the remote service is offline.
                pass

    def sign_in(self, data, register):
        origin = account_origin(data.get('server') or self.default_origin)
        wait_for_accounts(origin, origin == self.default_origin or urlsplit(origin).hostname.endswith('.onrender.com'))
        action = 'register' if register else 'login'
        response, result = remote_request(origin, f'/api/auth/{action}', 'POST',
                                          {key: data.get(key) for key in ('username', 'password')})
        if response not in (200, 201):
            if isinstance(result, dict) and isinstance(result.get('error'), str) and 400 <= response < 500:
                raise AccountError(response, result['error'])
            raise AccountError(502, 'The account server could not sign you in.')
        token = result.get('token') if isinstance(result, dict) else None
        username = result.get('username') if isinstance(result, dict) else None
        if not isinstance(token, str) or not TOKEN.fullmatch(token) or not isinstance(username, str):
            raise AccountError(502, 'The address did not respond as a Productivity account server.')
        try:
            with self.lock:
                self.save_origin(origin)
                old_origin, old_token = self.origin, self.token
                self.origin, self.username, self.token = origin, username, token
                self.workspace = token_urlsafe(16)
        except OSError:
            self.revoke(origin, token)
            raise
        self.revoke(old_origin, old_token)

    def sign_out(self, local=False):
        with self.lock:
            origin, token = self.origin, self.token
            if local:
                self.save_origin('')
                self.origin = ''
            self.username = self.token = None
            self.workspace = token_urlsafe(16)
        self.revoke(origin, token)

    def forward(self, origin, token, path, method, data):
        if not token:
            return 401, {'error': 'Sign in to your Productivity account.'}
        status, result = remote_request(origin, path, method, data, token)
        with self.lock:
            if self.token != token or self.origin != origin:
                return 401, {'error': 'Your Productivity account changed. Sign in again.'}
            if status == 401:
                self.token = self.username = None
        return status, result
