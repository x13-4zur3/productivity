"""Import journal entries and tasks from the original browser application."""

import argparse
from datetime import date, datetime, timezone
import json
from pathlib import Path
import sqlite3

from app import InputError, MOODS, PRIORITIES, ROOT, Store, choice, completion


def records(data, key):
    value = data.get(key, [])
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise InputError(f'{key} must be a list of records.')
    return value


def text_value(record, key):
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise InputError(f'{key} must be nonempty text.')
    return value


def created_at(record, key):
    text = text_value(record, key)
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'
    try:
        value = datetime.fromisoformat(text)
        if value.tzinfo is None:
            raise ValueError
        return value.astimezone(timezone.utc).isoformat(timespec='microseconds')
    except (ValueError, OverflowError):
        raise InputError(f'{key} must be an ISO timestamp with a time zone.') from None


def reserve_original_id(db, kind, record):
    key = record.get('id')
    if type(key) is not int or not 0 < key <= 2**53 - 1:
        raise InputError('Each original entry and task needs a valid ID.')
    return db.execute('INSERT OR IGNORE INTO browser_imports VALUES (?, ?)', (kind, key)).rowcount


def import_data(store, export):
    if not isinstance(export, dict) or not {'journalEntries', 'todos'} & export.keys():
        raise InputError('Use an export containing journalEntries or todos.')
    entries, tasks = records(export, 'journalEntries'), records(export, 'todos')
    entry_count = task_count = 0
    with store.connection(write=True) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS browser_imports (
            kind TEXT NOT NULL, original_id INTEGER NOT NULL, PRIMARY KEY (kind, original_id)
        )''')
        for entry in entries:
            if not reserve_original_id(db, 'entry', entry):
                continue
            tags = entry.get('tags', [])
            if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
                raise InputError('tags must be a list of strings.')
            db.execute('INSERT INTO entries (content, mood, tags, created_at) VALUES (?, ?, ?, ?)', (
                text_value(entry, 'content'), choice(entry.get('mood', 'neutral'), MOODS, 'mood'),
                json.dumps(tags), created_at(entry, 'date'),
            ))
            entry_count += 1
        for task in tasks:
            if not reserve_original_id(db, 'task', task):
                continue
            due = task.get('dueDate')
            if due is not None:
                try:
                    due = date.fromisoformat(due).isoformat()
                except (TypeError, ValueError):
                    raise InputError('dueDate must be a calendar date. Use the export steps in README.md.') from None
            task_id = db.execute('''INSERT INTO tasks
                (text, priority, due_date, cadence, created_at, completed) VALUES (?, ?, ?, 'none', ?, ?)''', (
                text_value(task, 'text'), choice(task.get('priority', 'low'), PRIORITIES, 'priority'),
                due, created_at(task, 'createdAt'), completion(task.get('completed', False)),
            )).lastrowid
            db.executemany('INSERT INTO subtasks (task_id, text, completed) VALUES (?, ?, ?)', (
                (task_id, text_value(subtask, 'text'), completion(subtask.get('completed', False)))
                for subtask in records(task, 'subtasks')
            ))
            task_count += 1
    return entry_count, task_count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    parser.add_argument('--db', type=Path, default=ROOT / 'productivity.sqlite3')
    args = parser.parse_args()
    try:
        export = json.loads(args.export.read_text(encoding='utf-8'))
        entries, tasks = import_data(Store(args.db), export)
    except (ValueError, OSError, sqlite3.Error) as error:
        parser.exit(1, f'Import failed: {error}\n')
    print(f'Imported {entries} journal entries and {tasks} tasks into {args.db.resolve()}.')


if __name__ == '__main__':
    main()
