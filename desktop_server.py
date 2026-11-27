"""Private local connection between a Productivity window and its database."""

from contextlib import contextmanager
from hmac import compare_digest
from http.cookies import CookieError, SimpleCookie
from http.server import ThreadingHTTPServer
import os
from pathlib import Path
from secrets import token_urlsafe
import sys
from threading import Event, Lock, Thread
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, build_opener

from app import Handler, InputError, Store
from desktop_accounts import AccountError, DATA_PATH, DesktopAccounts, NoRedirect


READY_PATH = '/_productivity_ready'
STOP_PATH = '/_productivity_stop'
ACTIVATE_PATH = '/_productivity_activate'
APP_ID = 'productivity-desktop'
SESSION_COOKIE = 'ProductivitySession'


def local_client():
    return build_opener(ProxyHandler({}), NoRedirect())


def url_for(port):
    return f'http://127.0.0.1:{port}'


class DesktopHandler(Handler):
    def log_message(self, *args):
        pass

    def parse_request(self):
        if not super().parse_request():
            return False
        host = f'127.0.0.1:{self.server.server_port}'
        url = url_for(self.server.server_port)
        origin = self.headers.get('Origin')
        if self.headers.get('Host') != host or (origin and origin != url):
            return self.deny()

        if self.command == 'GET' and self.path == READY_PATH:
            self.send_response(204)
            self.send_header('X-Productivity-App', APP_ID)
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return False
        if self.command == 'POST' and self.path in (STOP_PATH, ACTIVATE_PATH):
            supplied = self.headers.get('X-Productivity-Stop', '').encode('latin-1')
            if not compare_digest(supplied, self.server.control_token):
                return self.deny()
            self.send_json(200, {'ok': True})
            event = self.server.stop_requested if self.path == STOP_PATH else self.server.activate_requested
            event.set()
            return False
        if self.command == 'GET' and self.path.startswith('/_desktop/'):
            return self.open_session()

        try:
            cookie = SimpleCookie(self.headers.get('Cookie', '')).get(SESSION_COOKIE)
            if cookie and compare_digest(cookie.value.encode('latin-1'), self.server.session_cookie):
                return True
        except (CookieError, UnicodeError):
            pass
        return self.deny()

    def deny(self):
        self.send_json(403, {'error': 'Open Productivity from its desktop app.'})
        return False

    def dispatch(self):
        path = urlsplit(self.path).path
        accounts = self.server.accounts
        try:
            if path == '/api/account' and self.command == 'GET':
                self.send_json(200, accounts.status())
                return
            if self.command == 'POST' and path in ('/api/account/login', '/api/account/register',
                                                    '/api/account/logout', '/api/account/local'):
                if path.endswith(('/login', '/register')):
                    accounts.sign_in(self.read_json(), register=path.endswith('/register'))
                else:
                    accounts.sign_out(local=path.endswith('/local'))
                self.send_json(200, accounts.status())
                return
            if DATA_PATH.fullmatch(path):
                origin, token = accounts.connection(self.headers.get('X-Productivity-Workspace'))
                if origin:
                    data = self.read_json() if self.command in ('POST', 'PATCH') else None
                    self.send_json(*accounts.forward(origin, token, self.path, self.command, data))
                    return
        except AccountError as error:
            self.send_json(error.status, {'error': str(error)})
            return
        except InputError as error:
            self.send_json(400, {'error': str(error)})
            return
        except OSError:
            self.send_json(503, {'error': 'Could not save your account connection on this device.'})
            return
        if self.command == 'GET':
            super().do_GET()
        else:
            super().mutate()

    do_GET = do_POST = do_PATCH = do_DELETE = dispatch

    def open_session(self):
        with self.server.ticket_lock:
            ticket = self.server.ticket
            if not ticket or not compare_digest(self.path.encode('latin-1'), b'/_desktop/' + ticket):
                return self.deny()
            self.server.ticket = None
        self.send_response(303)
        self.send_header('Location', '/')
        self.send_header('Set-Cookie', f'{SESSION_COOKIE}={self.server.session_cookie.decode("ascii")}; Path=/; HttpOnly; SameSite=Strict')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', '0')
        self.end_headers()
        return False


def data_directory():
    if sys.platform == 'darwin':
        return Path.home() / 'Library' / 'Application Support' / 'Productivity'
    if os.name == 'nt':
        return Path(os.environ['LOCALAPPDATA']) / 'Productivity'
    location = Path(os.environ.get('XDG_DATA_HOME') or Path.home() / '.local' / 'share')
    if not location.is_absolute():
        location = Path.home() / '.local' / 'share'
    return location / 'productivity'


def preferred_port(directory):
    if os.name == 'nt':
        try:
            port = int((directory / 'port.txt').read_text(encoding='ascii'))
            if 1 <= port <= 65535:
                return port
        except (OSError, ValueError):
            pass
    return 48765


def issue_window_url(server):
    with server.ticket_lock:
        server.ticket = token_urlsafe(32).encode('ascii')
        return url_for(server.server_port) + '/_desktop/' + server.ticket.decode('ascii')


@contextmanager
def desktop_session(directory, *, port=None):
    if port is None:
        port = preferred_port(directory)
    try:
        listener = ThreadingHTTPServer(('127.0.0.1', port), DesktopHandler)
    except OSError:
        listener = ThreadingHTTPServer(('127.0.0.1', 0), DesktopHandler)
    with listener as server:
        server.store = Store(directory / 'productivity.sqlite3')
        server.accounts = DesktopAccounts(directory)
        server.ticket_lock = Lock()
        server.session_cookie = token_urlsafe(32).encode('ascii')
        server.control_token = token_urlsafe(32).encode('ascii')
        server.stop_requested = Event()
        server.activate_requested = Event()
        url = issue_window_url(server)
        worker = Thread(target=server.serve_forever)
        worker.start()
        try:
            yield server, url
        finally:
            server.shutdown()
            worker.join()
