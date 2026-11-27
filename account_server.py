"""Run Productivity's PostgreSQL account and data API."""

import argparse
from contextlib import contextmanager
from getpass import getpass
from hashlib import scrypt, sha256
from hmac import compare_digest
from http.server import ThreadingHTTPServer
import os
from pathlib import Path
import re
from secrets import token_bytes, token_urlsafe
from threading import BoundedSemaphore, Lock
from time import monotonic
from urllib.parse import urlsplit

import psycopg
from psycopg.rows import dict_row

from app import Handler, InputError, Store


USERNAME = re.compile(r'[a-zA-Z0-9_.-]{3,32}')
TOKEN = re.compile(r'[a-zA-Z0-9_-]{43}')
SCHEMA = Path(__file__).with_name('account_schema.sql')
PROTOCOL = 'productivity-accounts-v1'


def username_value(value):
    if not isinstance(value, str) or not USERNAME.fullmatch(value.strip()):
        raise InputError('Use a username of 3–32 letters, numbers, dots, hyphens, or underscores.')
    return value.strip().lower()


def password_value(value):
    if not isinstance(value, str) or not 12 <= len(value) <= 128:
        raise InputError('Use a password with 12–128 characters.')
    try:
        return value.encode()
    except UnicodeError:
        raise InputError('Use valid characters in your password.') from None


def derive_key(password, salt):
    return scrypt(password, salt=salt, n=2**16, r=8, p=2, maxmem=96 * 1024**2)


def hash_password(password):
    salt = token_bytes(16)
    return salt.hex() + ':' + derive_key(password, salt).hex()


def verify_password(password, stored):
    salt, digest = (bytes.fromhex(part) for part in stored.split(':')) if stored else (bytes(16), bytes(64))
    return compare_digest(derive_key(password, salt), digest) and stored is not None


def token_hash(value):
    return sha256(value.encode('ascii')).digest()


class Database:
    def __init__(self, dsn):
        self.dsn = dsn

    def connect(self):
        return psycopg.connect(self.dsn, row_factory=dict_row, connect_timeout=5,
                               options='-c search_path=productivity,pg_catalog -c statement_timeout=10000')

    def initialize(self):
        with self.connect() as db:
            role = db.execute('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user').fetchone()
            if role['rolsuper'] or role['rolbypassrls']:
                raise ValueError('Connect with a dedicated PostgreSQL role that cannot bypass row security.')
            db.execute(SCHEMA.read_text(encoding='utf-8'), prepare=False)
            for table in ('entries', 'tasks', 'subtasks', 'preferences'):
                row = db.execute('SELECT row_security_active(%s::regclass) AS active', (table,)).fetchone()
                if not row['active']:
                    raise ValueError('Account row security could not be enabled.')

    def create_user(self, username, password):
        digest = hash_password(password)
        with self.connect() as db:
            row = db.execute('INSERT INTO accounts (username, password_hash) VALUES (%s, %s) '
                             'ON CONFLICT (username) DO NOTHING RETURNING id', (username, digest)).fetchone()
            if row is None:
                raise InputError('That username is already taken.')
            return row['id'], digest

    def find_user(self, username):
        with self.connect() as db:
            return db.execute('SELECT id, password_hash FROM accounts WHERE username = %s', (username,)).fetchone()

    def issue_session(self, user_id, password_hash):
        token = token_urlsafe(32)
        with self.connect() as db:
            row = db.execute('SELECT password_hash FROM accounts WHERE id = %s FOR UPDATE', (user_id,)).fetchone()
            if row is None or row['password_hash'] != password_hash:
                return None
            db.execute('DELETE FROM sessions WHERE expires_at <= now()')
            db.execute('INSERT INTO sessions (token_hash, user_id) VALUES (%s, %s)', (token_hash(token), user_id))
        return token

    def session_user(self, token):
        with self.connect() as db:
            row = db.execute('SELECT user_id FROM sessions WHERE token_hash = %s AND expires_at > now()',
                             (token_hash(token),)).fetchone()
            return row['user_id'] if row else None

    def revoke_session(self, token):
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE token_hash = %s', (token_hash(token),))

    def reset_password(self, username, password):
        digest = hash_password(password)
        with self.connect() as db:
            row = db.execute('UPDATE accounts SET password_hash = %s WHERE username = %s RETURNING id',
                             (digest, username)).fetchone()
            if row is None:
                raise InputError('No account has that username.')
            db.execute('DELETE FROM sessions WHERE user_id = %s', (row['id'],))


class PostgresConnection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, query, values=()):
        return self.connection.execute(query.replace('?', '%s'), values)

    def executemany(self, query, values):
        with self.connection.cursor() as cursor:
            cursor.executemany(query.replace('?', '%s'), values)


class AccountStore(Store):
    preference_key = 'owner_id, name'

    def __init__(self, database, user_id):
        self.database = database
        self.user_id = user_id

    @contextmanager
    def connection(self, write=False):
        with self.database.connect() as db:
            if write:
                # Serialize changes to a single account, including generation of recurring tasks.
                db.execute('SELECT pg_advisory_xact_lock(%s::bigint)', (self.user_id,))
            else:
                db.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            db.execute("SELECT set_config('productivity.user_id', %s, true)", (str(self.user_id),))
            yield PostgresConnection(db)

    @staticmethod
    def inserted_id(db, query, values):
        return db.execute(query + ' RETURNING id', values).fetchone()['id']


class LoginLimiter:
    def __init__(self):
        self.lock = Lock()
        self.password_workers = BoundedSemaphore(2)
        self.counts = {}
        self.renew_at = 0

    def allow(self, address, username):
        now = monotonic()
        with self.lock:
            if now >= self.renew_at:
                self.counts.clear()
                self.renew_at = now + 60
            if self.counts.get(address, 0) >= 60 or self.counts.get(username, 0) >= 8:
                return False
            self.counts[address] = self.counts.get(address, 0) + 1
            self.counts[username] = self.counts.get(username, 0) + 1
            return True


class AccountHandler(Handler):
    assets = {}
    auth_paths = {'/api/auth/login', '/api/auth/register', '/api/auth/logout'}

    @property
    def store(self):
        return self.account_store

    def setup(self):
        self.request.settimeout(15)
        super().setup()

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except psycopg.Error as error:
            self.log_error('PostgreSQL request failed (%s)', type(error).__name__)
            self.send_json(503, {'error': 'The account database is temporarily unavailable.'})

    def parse_request(self):
        if not super().parse_request():
            return False
        return self.authorize_request()

    def authorize_request(self):
        path = urlsplit(self.path).path
        if self.headers.get('Origin'):
            self.send_json(403, {'error': 'Open Productivity in the desktop app.'})
            return False
        if self.command == 'GET' and path == '/api/health':
            return True
        if self.command == 'POST' and path in self.auth_paths:
            return True
        if not path.startswith('/api/'):
            self.send_json(404, {'error': 'Page not found.'})
            return False
        token = self.bearer()
        user_id = self.server.database.session_user(token) if token else None
        if user_id is None:
            self.send_json(401, {'error': 'Sign in to your Productivity account.'})
            return False
        self.account_store = AccountStore(self.server.database, user_id)
        return True

    def bearer(self):
        prefix, _, token = self.headers.get('Authorization', '').partition(' ')
        return token if prefix == 'Bearer' and TOKEN.fullmatch(token) else None

    def do_GET(self):
        if urlsplit(self.path).path == '/api/health':
            self.send_json(200, {'service': PROTOCOL, 'registration': self.server.allow_registration})
        else:
            super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in self.auth_paths:
            super().mutate()
            return

        database = self.server.database
        if path == '/api/auth/logout':
            token = self.bearer()
            if token:
                database.revoke_session(token)
            self.send_json(200, {'ok': True})
            return

        register = path == '/api/auth/register'
        if register and not self.server.allow_registration:
            self.send_json(403, {'error': 'Registration is closed. Ask the server administrator to create your account.'})
            return
        try:
            data = self.read_json()
            username = username_value(data.get('username'))
            password = password_value(data.get('password'))
        except InputError as error:
            self.send_json(400 if register else 401, {'error': str(error) if register else 'Incorrect username or password.'})
            return

        limiter = self.server.login_limiter
        if (not limiter.allow(('address', self.client_address[0]), ('username', username))
                or not limiter.password_workers.acquire(blocking=False)):
            self.send_json(429, {'error': 'Too many sign-in attempts. Try again in a moment.'})
            return

        try:
            if register:
                user_id, digest = database.create_user(username, password)
            else:
                user = database.find_user(username)
                if not verify_password(password, user['password_hash'] if user else None):
                    self.send_json(401, {'error': 'Incorrect username or password.'})
                    return
                user_id, digest = user['id'], user['password_hash']

            token = database.issue_session(user_id, digest)
            if token is None:
                self.send_json(401, {'error': 'Sign in again with your current password.'})
                return

            self.send_login_success(201 if register else 200, username, token)
        except InputError as error:
            self.send_json(409, {'error': str(error)})
        finally:
            limiter.password_workers.release()

    def send_login_success(self, status, username, token):
        self.send_json(status, {'username': username, 'token': token})


def serve(database, host, port, registration):
    with ThreadingHTTPServer((host, port), AccountHandler) as listener:
        listener.database = database
        listener.allow_registration = registration
        listener.login_limiter = LoginLimiter()
        print(f'Productivity account service listening on {host}:{listener.server_port}', flush=True)
        listener.serve_forever()


def main(serve_service=serve):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    run = commands.add_parser('serve', help='Start the accounts API.')
    run.add_argument('--host', default='127.0.0.1',
                     help='Listen address. Use 0.0.0.0 behind a managed HTTPS proxy such as Render.')
    run.add_argument('--port', type=int, default=8765)
    run.add_argument('--allow-registration', action='store_true', help='Let people create accounts from the desktop app.')
    for command in ('create-user', 'reset-password'):
        commands.add_parser(command).add_argument('username')
    commands.add_parser('init-db', help='Initialize PostgreSQL tables and row policies.')
    args = parser.parse_args()
    dsn = os.environ.get('PRODUCTIVITY_DATABASE_URL')
    if not dsn:
        parser.error('Set PRODUCTIVITY_DATABASE_URL to your PostgreSQL connection string.')
    if args.command == 'serve' and not 1 <= args.port <= 65535:
        parser.error('Choose a port from 1 to 65535.')
    database = Database(dsn)
    try:
        database.initialize()
        if args.command == 'serve':
            serve_service(database, args.host, args.port, args.allow_registration)
        elif args.command == 'init-db':
            print('Productivity database is ready.')
        else:
            username = username_value(args.username)
            password = password_value(getpass('Account password: '))
            if password != password_value(getpass('Confirm password: ')):
                raise InputError('The passwords do not match.')
            if args.command == 'create-user':
                database.create_user(username, password)
                print(f'Created {username}.')
            else:
                database.reset_password(username, password)
                print(f'Updated the password for {username}.')
    except (OSError, ValueError) as error:
        parser.exit(1, f'Productivity: {error}\n')
    except psycopg.Error as error:
        parser.exit(1, f'PostgreSQL setup failed ({type(error).__name__}). Check the connection, role, and PostgreSQL version.\n')
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
