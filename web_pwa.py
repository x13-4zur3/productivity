"""Serve Productivity's installable web interface and browser sessions."""

from http.cookies import CookieError, SimpleCookie
from http.server import ThreadingHTTPServer
import os
from urllib.parse import urlsplit

from account_server import AccountHandler, AccountStore, LoginLimiter, TOKEN, main, token_hash
from app import Handler, ROOT
from desktop_accounts import DATA_PATH, account_origin

COOKIE = '__Host-ProductivityWeb'
PAGES = {'/', '/journal', '/todos'}
ACTIONS = {
    '/api/account/login': '/api/auth/login',
    '/api/account/register': '/api/auth/register',
    '/api/account/logout': '/api/auth/logout',
}
WEB_HEAD = '''
  <meta name="referrer" content="same-origin">
  <link rel="icon" href="/icon-192.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icon-180.png">
  <style>#account-use-local, #settings-use-local { display: none !important; }</style>
'''


def workspace_id(token):
    return token_hash('web-workspace:' + token).hex()


class WebAccountHandler(AccountHandler):
    assets = {
        **Handler.assets,
        '/manifest.webmanifest': ('manifest.webmanifest', 'application/manifest+json'),
        '/icon-180.png': ('icon-180.png', 'image/png'),
        '/icon-192.png': ('icon-192.png', 'image/png'),
        '/icon-512.png': ('icon-512.png', 'image/png'),
    }

    def browser_token(self):
        try:
            cookie = SimpleCookie(self.headers.get('Cookie', '')).get(COOKIE)
        except CookieError:
            return None
        return cookie.value if cookie and TOKEN.fullmatch(cookie.value) else None

    def check_origin(self):
        if self.headers.get('Origin') == self.server.web_origin:
            return True
        self.send_json(403, {'error': 'Open Productivity from its web address.'})
        return False

    def check_workspace(self, token):
        if self.headers.get('X-Productivity-Workspace') == workspace_id(token):
            return True
        self.send_json(409, {'error': 'Your active account changed. Reload this page and try again.'})
        return False

    def authorize_request(self):
        path = urlsplit(self.path).path
        self.web_action = ACTIONS.get(path) if self.command == 'POST' else None
        if self.command == 'GET' and (path in self.assets or path == '/api/account'):
            return True

        token = self.browser_token()
        if self.web_action:
            if not self.check_origin():
                return False
            if token and self.server.database.session_user(token) is not None:
                return self.check_workspace(token)
            return True

        if not token or self.headers.get('Authorization') or not DATA_PATH.fullmatch(path):
            return super().authorize_request()
        if (self.command != 'GET' or self.headers.get('Origin') is not None) and not self.check_origin():
            return False
        user_id = self.server.database.session_user(token)
        if user_id is None:
            self.send_json(401, {'error': 'Sign in to your Productivity account.'})
            return False
        if not self.check_workspace(token):
            return False
        self.account_store = AccountStore(self.server.database, user_id)
        return True

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in PAGES:
            html = (ROOT / 'static' / 'index.html').read_text(encoding='utf-8')
            html = html.replace('</head>', WEB_HEAD + '</head>', 1)
            self.send_bytes(200, html.encode('utf-8'), 'text/html')
        elif path == '/api/account':
            self.send_json(200, self.browser_status())
        else:
            super().do_GET()

    def browser_status(self):
        token = self.browser_token()
        user = None
        if token:
            with self.server.database.connect() as db:
                user = db.execute(
                    'SELECT a.username FROM sessions AS s JOIN accounts AS a ON a.id = s.user_id '
                    'WHERE s.token_hash = %s AND s.expires_at > now()', (token_hash(token),)
                ).fetchone()
        origin = self.server.web_origin
        return {
            'server': origin,
            'defaultServer': origin,
            'username': user['username'] if user else None,
            'workspace': workspace_id(token) if user else None,
        }

    def do_POST(self):
        if self.web_action == '/api/auth/logout':
            token = self.browser_token()
            if token:
                self.server.database.revoke_session(token)
            self.set_browser_cookie('')
            self.send_json(200, {'ok': True})
            return
        if self.web_action:
            self.path = self.web_action
        super().do_POST()

    def send_login_success(self, status, username, token):
        if not self.web_action:
            return super().send_login_success(status, username, token)
        previous = self.browser_token()
        if previous:
            self.server.database.revoke_session(previous)
        self.set_browser_cookie(token)
        self.send_json(status, {'ok': True})

    def set_browser_cookie(self, token):
        max_age = 43200 if token else 0
        self.cookie_header = (
            f'{COOKIE}={token}; Path=/; Max-Age={max_age}; '
            'Secure; HttpOnly; SameSite=Strict'
        )

    def end_headers(self):
        cookie = getattr(self, 'cookie_header', None)
        if cookie:
            self.send_header('Set-Cookie', cookie)
            self.cookie_header = None
        super().end_headers()


def serve_web(database, host, port, registration):
    origin = account_origin(os.environ.get('PRODUCTIVITY_WEB_ORIGIN'))
    with ThreadingHTTPServer((host, port), WebAccountHandler) as listener:
        listener.database = database
        listener.allow_registration = registration
        listener.login_limiter = LoginLimiter()
        listener.web_origin = origin
        print(f'Productivity web app listening on {host}:{listener.server_port}', flush=True)
        listener.serve_forever()


if __name__ == '__main__':
    main(serve_web)