"""Productivity's internal request handler and SQLite storage."""

import calendar
from contextlib import closing, contextmanager
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path
import re
from secrets import token_urlsafe
import sqlite3
from urllib.parse import parse_qs, urlsplit


ROOT = Path(__file__).resolve().parent
MOODS = ('happy', 'neutral', 'sad', 'loved')
PRIORITIES = ('low', 'medium', 'high')
CADENCES = ('none', 'daily', 'weekly', 'monthly')
THEMES = ('light', 'dark', 'terminal', 'contrast', 'pink')
UNDO_SECONDS = 30
DELETABLE = ('entries', 'tasks', 'subtasks', 'calendar_events')
LEGACY_SHORTCUT_ACTIONS = {'home', 'journal', 'tasks', 'settings', 'create', 'search', 'save'}
SHORTCUT_ACTIONS = LEGACY_SHORTCUT_ACTIONS | {'calendar', 'planner', 'event', 'journalTask', 'focusToggle',
                                             'focusReset', 'undo', 'theme'}
SHORTCUT = re.compile(r'(?:Control\+)?(?:Alt\+)?(?:Shift\+)?(?:Meta\+)?(?:Key[A-Z]|Digit[0-9]|Enter|Comma)')
SCHEMA = '''
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, mood TEXT NOT NULL,
    tags TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, priority TEXT NOT NULL,
    due_date TEXT, cadence TEXT NOT NULL, month_day INTEGER, completed INTEGER NOT NULL DEFAULT 0,
    next_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS preferences (name TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, start_day TEXT NOT NULL, end_day TEXT NOT NULL,
    start_time TEXT, end_time TEXT, notes TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_deletions (
    kind TEXT NOT NULL CHECK (kind IN ('entries', 'tasks', 'subtasks', 'calendar_events')),
    record_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires TEXT NOT NULL, PRIMARY KEY (kind, record_id)
);
'''


class InputError(ValueError):
    pass


class MissingRecord(LookupError):
    pass


def visible_rows(table):
    return f"id NOT IN (SELECT record_id FROM pending_deletions WHERE kind = '{table}')"


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')


def required_text(value, label, limit):
    if not isinstance(value, str) or not value.strip():
        raise InputError(f'{label} is required.')
    if len(value) > limit:
        raise InputError(f'{label} must be {limit:,} characters or fewer.')
    if '\x00' in value:
        raise InputError(f'{label} contains an unsupported character.')
    return value.strip()


def choice(value, options, label):
    if value not in options:
        raise InputError(f'Choose a valid {label}.')
    return value


def completion(value):
    if not isinstance(value, bool):
        raise InputError('Choose a valid completion state.')
    return value


def task_fields(data):
    text = required_text(data.get('text'), 'Task name', 300)
    priority = choice(data.get('priority', 'low'), PRIORITIES, 'priority')
    cadence = choice(data.get('cadence', 'none'), CADENCES, 'repeat interval')
    due = data.get('due_date') or None
    if due is not None:
        try:
            due = date.fromisoformat(due).isoformat()
        except (TypeError, ValueError):
            raise InputError('Choose a valid due date.') from None
    if cadence != 'none' and due is None:
        raise InputError('Repeating tasks need a due date.')
    return text, priority, due, cadence


def next_due(due, cadence, month_day):
    if cadence in ('daily', 'weekly'):
        return due + timedelta(days=1 if cadence == 'daily' else 7)
    year, month = (due.year + 1, 1) if due.month == 12 else (due.year, due.month + 1)
    return date(year, month, min(month_day or due.day, calendar.monthrange(year, month)[1]))


def event_fields(data):
    title = required_text(data.get('title'), 'Event title', 180)
    try:
        start_day = date.fromisoformat(data.get('start_day')).isoformat()
        end_day = date.fromisoformat(data.get('end_day') or start_day).isoformat()
    except (TypeError, ValueError):
        raise InputError('Enter a valid start and end date.') from None
    start_time = data.get('start_time') or None
    end_time = data.get('end_time') or None
    for value in (start_time, end_time):
        if value is not None and (not isinstance(value, str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value)):
            raise InputError('Choose a valid time.')
    if (start_time is None) != (end_time is None):
        raise InputError('Choose both a start and an end time, or leave both blank for an all-day event.')
    if end_day < start_day or (start_day == end_day and start_time is not None and end_time <= start_time):
        raise InputError('The event must end after it starts.')
    notes = data.get('notes', '')
    if not isinstance(notes, str) or len(notes) > 3000 or '\x00' in notes:
        raise InputError('Use up to 3,000 characters for event notes.')
    return title, start_day, end_day, start_time, end_time, notes.strip()


class Store:
    preference_key = 'name'

    def __init__(self, filename):
        self.filename = Path(filename)
        self.filename.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript(SCHEMA)
        with self.connection(write=True) as db:
            if not any(row['name'] == 'source_entry_id' for row in db.execute('PRAGMA table_info(tasks)')):
                db.execute('ALTER TABLE tasks ADD COLUMN source_entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL')

    @contextmanager
    def connection(self, write=False):
        with closing(sqlite3.connect(self.filename)) as db, db:
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA foreign_keys = ON')
            db.execute('BEGIN IMMEDIATE' if write else 'BEGIN')
            yield db

    @staticmethod
    def record(db, table, record_id):
        record = db.execute(f'SELECT * FROM {table} WHERE id = ? AND {visible_rows(table)}', (record_id,)).fetchone()
        if record is None:
            raise MissingRecord
        if table == 'subtasks':
            Store.record(db, 'tasks', record['task_id'])
        return record

    def journal(self, query):
        search = query.get('q', [''])[0].strip().casefold()
        mood = query.get('mood', [''])[0]
        tags = set(query.get('tag', []))
        with self.connection() as db:
            entries = [dict(row) for row in db.execute(
                f'SELECT id, content, mood, tags, created_at FROM entries WHERE {visible_rows("entries")} '
                'ORDER BY created_at DESC, id DESC')]
        for entry in entries:
            entry['tags'] = json.loads(entry['tags'])
        current_month = date.today().replace(day=1)
        return {
            'total': len(entries),
            'month': sum(datetime.fromisoformat(entry['created_at']).astimezone().date().replace(day=1) == current_month
                         for entry in entries),
            'tags': sorted({tag for entry in entries for tag in entry['tags']}, key=str.casefold),
            'entries': [entry for entry in entries if search in entry['content'].casefold() and
                        (not mood or entry['mood'] == mood) and tags.issubset(entry['tags'])],
        }

    def save_entry(self, data, entry_id=None):
        text = required_text(data.get('content'), 'Journal entry', 50000)
        mood = choice(data.get('mood', 'neutral'), MOODS, 'mood')
        tags = data.get('tags', [])
        if not isinstance(tags, list) or len(tags) > 20:
            raise InputError('Use up to 20 tags per entry.')
        serialized_tags = json.dumps(list(dict.fromkeys(required_text(tag, 'Tag', 40) for tag in tags)))
        with self.connection(write=True) as db:
            if entry_id is None:
                db.execute('INSERT INTO entries (content, mood, tags, created_at) VALUES (?, ?, ?, ?)',
                           (text, mood, serialized_tags, timestamp()))
            else:
                self.record(db, 'entries', entry_id)
                db.execute('UPDATE entries SET content = ?, mood = ?, tags = ? WHERE id = ?',
                           (text, mood, serialized_tags, entry_id))

    def tasks(self, query):
        status = query.get('status', ['all'])[0]
        sort = query.get('sort', ['date'])[0]
        today = date.today().isoformat()
        with self.connection() as db:
            tasks = {row['id']: dict(row) for row in db.execute(
                'SELECT id, text, priority, due_date, cadence, month_day, completed, next_task_id, created_at, '
                "CASE WHEN source_entry_id IN (SELECT record_id FROM pending_deletions WHERE kind = 'entries') "
                'THEN NULL ELSE source_entry_id END AS source_entry_id '
                f'FROM tasks WHERE {visible_rows("tasks")} ORDER BY created_at DESC, id DESC')}
            for task in tasks.values():
                task['subtasks'] = []
                task['completed'] = bool(task['completed'])
            for row in db.execute(f'SELECT id, task_id, text, completed FROM subtasks WHERE {visible_rows("subtasks")} ORDER BY id'):
                if row['task_id'] not in tasks:
                    continue
                tasks[row['task_id']]['subtasks'].append({
                    'id': row['id'], 'text': row['text'], 'completed': bool(row['completed']),
                })
        active = [task for task in tasks.values() if not task['completed']]
        visible = [task for task in tasks.values() if status not in ('active', 'completed') or
                   task['completed'] == (status == 'completed')]
        if sort == 'priority':
            visible.sort(key=lambda task: -PRIORITIES.index(task['priority']))
        elif sort == 'dueDate':
            visible.sort(key=lambda task: (task['due_date'] is None, task['due_date']))
        return {
            'active': len(active), 'completed': len(tasks) - len(active), 'today': today,
            'due': [{'id': task['id'], 'text': task['text'], 'due_date': task['due_date']}
                    for task in active if task['due_date'] and task['due_date'] <= today],
            'tasks': visible,
        }

    def add_task(self, data):
        text, priority, due, cadence = task_fields(data)
        anchor = date.fromisoformat(due).day if cadence == 'monthly' else None
        source = data.get('source_entry_id')
        with self.connection(write=True) as db:
            if source is not None:
                if type(source) is not int or not 1 <= source <= 2**63 - 1:
                    raise InputError('Choose a valid journal entry.')
                self.record(db, 'entries', source)
            db.execute('''INSERT INTO tasks (text, priority, due_date, cadence, month_day, created_at, source_entry_id)
                          VALUES (?, ?, ?, ?, ?, ?, ?)''', (text, priority, due, cadence, anchor, timestamp(), source))

    def update_task(self, task_id, data):
        with self.connection(write=True) as db:
            task = self.record(db, 'tasks', task_id)
            if 'completed' in data:
                self.set_completed(db, task, completion(data['completed']))
            elif 'text' in data:
                text, priority, due, cadence = task_fields(data)
                anchor = None
                if cadence == 'monthly':
                    anchor = (task['month_day'] if due == task['due_date'] else None) or date.fromisoformat(due).day
                db.execute('''UPDATE tasks SET text = ?, priority = ?, due_date = ?, cadence = ?, month_day = ?
                              WHERE id = ?''', (text, priority, due, cadence, anchor, task_id))
            elif 'due_date' in data:
                _, _, due, cadence = task_fields({**dict(task), 'due_date': data['due_date']})
                anchor = None
                if cadence == 'monthly':
                    anchor = (task['month_day'] if due == task['due_date'] else None) or date.fromisoformat(due).day
                db.execute('UPDATE tasks SET due_date = ?, month_day = ? WHERE id = ?', (due, anchor, task_id))
            else:
                priority = choice(data.get('priority'), PRIORITIES, 'priority')
                db.execute('UPDATE tasks SET priority = ? WHERE id = ?', (priority, task_id))

    @staticmethod
    def inserted_id(db, query, values):
        return db.execute(query, values).lastrowid

    def set_completed(self, db, task, completed):
        if completed == bool(task['completed']):
            return
        successor = task['next_task_id']
        if completed and task['cadence'] != 'none' and successor is None:
            try:
                due = next_due(date.fromisoformat(task['due_date']), task['cadence'], task['month_day'])
            except (ValueError, OverflowError):
                raise InputError('Change the due date before completing this repeating task.') from None
            successor = self.inserted_id(db, '''INSERT INTO tasks
                (text, priority, due_date, cadence, month_day, created_at, source_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?)''',
                                         (task['text'], task['priority'], due.isoformat(), task['cadence'],
                                          task['month_day'], timestamp(), task['source_entry_id']))
            db.execute('INSERT INTO subtasks (task_id, text) SELECT ?, text FROM subtasks '
                       f'WHERE task_id = ? AND {visible_rows("subtasks")} ORDER BY id',
                       (successor, task['id']))
        db.execute('UPDATE tasks SET completed = ?, next_task_id = ? WHERE id = ?',
                   (int(completed), successor, task['id']))

    def add_subtask(self, task_id, data):
        text = required_text(data.get('text'), 'Subtask name', 300)
        with self.connection(write=True) as db:
            self.record(db, 'tasks', task_id)
            db.execute('INSERT INTO subtasks (task_id, text) VALUES (?, ?)', (task_id, text))

    def update_subtask(self, subtask_id, data):
        completed = completion(data.get('completed'))
        with self.connection(write=True) as db:
            self.record(db, 'subtasks', subtask_id)
            db.execute('UPDATE subtasks SET completed = ? WHERE id = ?', (int(completed), subtask_id))

    def delete(self, table, record_id):
        with self.connection(write=True) as db:
            self.record(db, table, record_id)
            db.execute(f'DELETE FROM {table} WHERE id = ?', (record_id,))

    def defer_delete(self, table, record_id):
        with self.connection(write=True) as db:
            self.record(db, table, record_id)
            token = token_urlsafe(24)
            expires = (datetime.now(timezone.utc) + timedelta(seconds=UNDO_SECONDS)).isoformat(timespec='microseconds')
            db.execute('INSERT INTO pending_deletions (kind, record_id, token, expires) VALUES (?, ?, ?, ?)',
                       (table, record_id, token, expires))
        return {'token': token, 'seconds': UNDO_SECONDS}

    @staticmethod
    def commit_deletion(db, pending):
        kind = pending['kind']
        if kind in DELETABLE:
            db.execute(f'DELETE FROM {kind} WHERE id = ?', (pending['record_id'],))
        db.execute('DELETE FROM pending_deletions WHERE token = ?', (pending['token'],))

    def finish_delete(self, token, undo):
        with self.connection(write=True) as db:
            pending = db.execute('SELECT * FROM pending_deletions WHERE token = ?', (token,)).fetchone()
            if pending is None:
                return False
            kind = pending['kind']
            if (undo and pending['expires'] > timestamp() and kind in DELETABLE
                    and db.execute(f'SELECT id FROM {kind} WHERE id = ?', (pending['record_id'],)).fetchone()):
                db.execute('DELETE FROM pending_deletions WHERE token = ?', (token,))
                return True
            self.commit_deletion(db, pending)
            return False

    def clear_expired_deletions(self):
        cutoff = timestamp()
        with self.connection() as db:
            expired = db.execute('SELECT 1 FROM pending_deletions WHERE expires <= ? LIMIT 1', (cutoff,)).fetchone()
        if expired:
            with self.connection(write=True) as db:
                for pending in db.execute('SELECT * FROM pending_deletions WHERE expires <= ?', (cutoff,)).fetchall():
                    self.commit_deletion(db, pending)

    def calendar(self, _query):
        with self.connection() as db:
            return {'events': [dict(row) for row in db.execute(
                'SELECT id, title, start_day, end_day, start_time, end_time, notes '
                f'FROM calendar_events WHERE {visible_rows("calendar_events")} ORDER BY start_day, start_time, id')]}

    def save_event(self, data, event_id=None):
        fields = event_fields(data)
        with self.connection(write=True) as db:
            if event_id is None:
                db.execute('INSERT INTO calendar_events (title, start_day, end_day, start_time, end_time, notes) '
                           'VALUES (?, ?, ?, ?, ?, ?)', fields)
            else:
                self.record(db, 'calendar_events', event_id)
                db.execute('UPDATE calendar_events SET title = ?, start_day = ?, end_day = ?, start_time = ?, '
                           'end_time = ?, notes = ? WHERE id = ?', (*fields, event_id))

    def preferences(self, query):
        with self.connection() as db:
            saved = {row['name']: json.loads(row['value']) for row in db.execute('SELECT name, value FROM preferences')}
        if 'shortcuts' in saved and query.get('shortcuts') != ['expanded']:
            saved['shortcuts'] = {action: value for action, value in saved['shortcuts'].items()
                                  if action in LEGACY_SHORTCUT_ACTIONS}
        return saved

    def home(self, _query):
        today = date.today()
        days = {(today - timedelta(days=offset)).isoformat(): 0 for offset in range(6, -1, -1)}
        journal = self.journal({})
        for entry in journal['entries']:
            day = datetime.fromisoformat(entry['created_at']).astimezone().date().isoformat()
            if day in days:
                days[day] += 1
        latest = None
        if journal['entries']:
            entry = journal['entries'][0]
            latest = {'created_at': entry['created_at'], 'mood': entry['mood'], 'excerpt': entry['content'][:180]}
        tasks = self.tasks({'status': ['active'], 'sort': ['dueDate']})
        return {
            'activity': [{'day': day, 'count': count} for day, count in days.items()], 'latest': latest,
            'active': tasks['active'], 'completed': tasks['completed'], 'due': len(tasks['due']),
            'tasks': [{key: task[key] for key in ('id', 'text', 'due_date')} for task in tasks['tasks'][:3]],
        }

    def save_preferences(self, data):
        if not data or data.keys() - {'theme', 'name', 'focus', 'startPage', 'motion', 'shortcuts'}:
            raise InputError('Choose a valid preference.')
        if 'theme' in data:
            choice(data['theme'], THEMES, 'theme')
        if 'name' in data:
            name = data['name']
            if not isinstance(name, str) or len(name) > 40:
                raise InputError('Use a display name of 40 characters or fewer.')
            data['name'] = name.strip()
        if 'startPage' in data:
            choice(data['startPage'], ('home', 'journal', 'tasks'), 'start page')
        if 'motion' in data:
            choice(data['motion'], ('system', 'reduce'), 'motion setting')
        if 'shortcuts' in data:
            shortcuts = data['shortcuts']
            if not isinstance(shortcuts, dict) or shortcuts.keys() not in (LEGACY_SHORTCUT_ACTIONS, SHORTCUT_ACTIONS):
                raise InputError('Choose a valid keyboard shortcut.')
            assigned = set()
            for shortcut in shortcuts.values():
                if shortcut is None:
                    continue
                if (not isinstance(shortcut, str) or not SHORTCUT.fullmatch(shortcut)
                        or not {'Control', 'Alt', 'Meta'}.intersection(shortcut.split('+'))
                        or shortcut in assigned):
                    raise InputError('Use a different keyboard shortcut for each action.')
                assigned.add(shortcut)
        if 'focus' in data:
            focus = data['focus']
            if not isinstance(focus, dict) or focus.keys() != {'minutes', 'remaining', 'endsAt'}:
                raise InputError('Choose a valid focus timer.')
            minutes, remaining, ends_at = focus['minutes'], focus['remaining'], focus['endsAt']
            if (type(minutes) is not int or not 1 <= minutes <= 180
                    or type(remaining) is not int or not 0 <= remaining <= minutes * 60000
                    or ends_at is not None and (type(ends_at) is not int or not 0 < ends_at <= 8640000000000000)):
                raise InputError('Choose a valid focus timer.')
        with self.connection(write=True) as db:
            if 'shortcuts' in data and shortcuts.keys() == LEGACY_SHORTCUT_ACTIONS:
                row = db.execute("SELECT value FROM preferences WHERE name = 'shortcuts'").fetchone()
                if row:
                    saved = json.loads(row['value'])
                    retained = {action: value if value not in assigned else None for action, value in saved.items()
                                if action in SHORTCUT_ACTIONS - LEGACY_SHORTCUT_ACTIONS}
                    data['shortcuts'] = {**retained, **shortcuts}
            db.executemany(f'INSERT INTO preferences (name, value) VALUES (?, ?) '
                           f'ON CONFLICT ({self.preference_key}) DO UPDATE SET value = excluded.value',
                           ((key, json.dumps(value)) for key, value in data.items()))


class Handler(BaseHTTPRequestHandler):
    assets = {
        '/': ('index.html', 'text/html'), '/journal': ('index.html', 'text/html'), '/todos': ('index.html', 'text/html'),
        '/calendar': ('index.html', 'text/html'),
        '/style.css': ('style.css', 'text/css'), '/app.js': ('app.js', 'text/javascript'),
        '/settings.js': ('settings.js', 'text/javascript'),
        '/accounts.js': ('accounts.js', 'text/javascript'),
        '/workspace.js': ('workspace.js', 'text/javascript'),
        '/fonts/InstrumentSans-Regular.ttf': ('fonts/InstrumentSans-Regular.ttf', 'font/ttf'),
    }

    @property
    def store(self):
        return self.server.store

    def send_bytes(self, code, content, content_type):
        self.send_response(code)
        self.send_header('Content-Type', f'{content_type}; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, code, data):
        self.send_bytes(code, json.dumps(data).encode(), 'application/json')

    def read_json(self):
        if self.headers.get_content_type() != 'application/json':
            raise InputError('Send the request as JSON.')
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 400000:
                raise ValueError
            data = json.loads(self.rfile.read(size))
        except (ValueError, RecursionError):
            raise InputError('Send a valid JSON object within the size limit.') from None
        if not isinstance(data, dict):
            raise InputError('Send a JSON object.')
        return data

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path in self.assets:
            file, mime = self.assets[url.path]
            self.send_bytes(200, (ROOT / 'static' / file).read_bytes(), mime)
            return
        if url.path == '/api/features':
            self.store.clear_expired_deletions()
            self.send_json(200, {'workspaceTools': True, 'expandedShortcuts': True})
            return
        views = {'/api/journal': self.store.journal, '/api/tasks': self.store.tasks,
                 '/api/preferences': self.store.preferences, '/api/home': self.store.home,
                 '/api/calendar': self.store.calendar}
        if url.path in views:
            try:
                query = parse_qs(url.query, max_num_fields=100)
                self.send_json(200, views[url.path](query))
            except ValueError:
                self.send_json(400, {'error': 'Invalid query.'})
            return
        self.send_json(404, {'error': 'Page not found.'})

    def mutate(self):
        store = self.store
        routes = {
            'POST': {r'/api/entries': store.save_entry, r'/api/tasks': store.add_task, r'/api/calendar': store.save_event,
                     r'/api/tasks/(\d+)/subtasks': store.add_subtask},
            'PATCH': {r'/api/preferences': store.save_preferences,
                      r'/api/entries/(\d+)': lambda key, data: store.save_entry(data, key),
                      r'/api/tasks/(\d+)': store.update_task, r'/api/subtasks/(\d+)': store.update_subtask,
                      r'/api/calendar/(\d+)': lambda key, data: store.save_event(data, key)},
        }
        try:
            url = urlsplit(self.path)
            path = url.path
            deletion = re.fullmatch(r'/api/deletions/([\w-]{32})/(undo|finalize)', path, re.ASCII)
            if self.command == 'POST' and deletion:
                undo = deletion[2] == 'undo'
                restored = store.finish_delete(deletion[1], undo)
                self.send_json(410 if undo and not restored else 200,
                               {'error': 'The undo period has ended.'} if undo and not restored else {'ok': True})
                return
            if self.command == 'DELETE':
                match = re.fullmatch(r'/api/(entries|tasks|subtasks|calendar)/(\d+)', path)
                if match is None:
                    raise MissingRecord
                table = 'calendar_events' if match[1] == 'calendar' else match[1]
                key = self.record_id(match[2])
                if url.query == 'undo=1':
                    self.send_json(200, store.defer_delete(table, key))
                    return
                store.delete(table, key)
            else:
                for pattern, action in routes[self.command].items():
                    if match := re.fullmatch(pattern, path):
                        action(*(self.record_id(key) for key in match.groups()), self.read_json())
                        break
                else:
                    raise MissingRecord
        except InputError as error:
            self.send_json(400, {'error': str(error)})
        except (MissingRecord, OverflowError):
            self.send_json(404, {'error': 'This item could not be found.'})
        else:
            self.send_json(201 if self.command == 'POST' else 200, {'ok': True})

    do_POST = do_PATCH = do_DELETE = mutate

    @staticmethod
    def record_id(value):
        if len(value) > 19 or not 1 <= int(value) <= 2**63 - 1:
            raise MissingRecord
        return int(value)


if __name__ == '__main__':
    from runpy import run_path
    import sys

    if sys.platform == 'win32':
        installed, source = 'windows_launcher.py', 'packaging/windows/windows_launcher.py'
    else:
        installed, source = 'desktop_unix.py', 'packaging/desktop_unix.py'
    launcher = ROOT / installed
    run_path(str(launcher if launcher.is_file() else ROOT / source), run_name='__main__')