# Changelog

## 1.2.0 · Upcoming Windows and Linux release

### Planning and focus

- Added a **Month** calendar with event and task previews and a **Linear** week agenda with clickable items. Switching views keeps the selected date. Both views support keyboard date navigation and task creation for the selected day.
- Added a weekly planner for scheduled, overdue, and unscheduled tasks. Reschedule within the planner or move a task to today.
- Create a task from selected text in a saved journal entry. The task links back to the source entry.
- Search journal text and tags, tasks and subtasks, and calendar event titles and notes from a sidebar that stays open while you work. Search supports multiple terms and type filters. Ctrl+F or Command+F toggles it by default.
- Start focus sessions with a preset or a custom duration from 1 to 180 minutes. The main button shows when to pause, resume, or start again, and the footer keeps running and paused sessions accessible.

### Interface and accessibility

- Added the Pink theme with a muted rose palette. Docs, Docs Dark, Pink, and High Contrast use Instrument Sans. Terminal retains its monospace type.
- Standardized action heights, input styles, card spacing, and dialog controls. Work views reflow as the window narrows, including while Search is open.
- Redrew the Home, Journal, To-do list, and Calendar icons. Added short Search and Calendar transitions that respect reduced-motion settings.
- Added a themed Windows title bar with a drag area, minimize, maximize or restore, and close controls.
- Added configurable shortcuts for Calendar, the weekly planner, event creation, journal-to-task creation, focus start/pause and reset, Undo, and the theme picker. Existing saved shortcuts carry over.
- Empty or invalid fields show themed messages beside the field. Deleting a journal entry, task, subtask, or event offers a dismissible **Undo** notification for 30 seconds.

### Updating

- Existing local databases are upgraded when the app starts. For signed-in workspaces, deploy the matching account service so it can apply the PostgreSQL schema changes and enable the new features. [Account service guide](ACCOUNTS.md)
- Setup and the Linux packages report version 1.2.0. [Release checklist](RELEASE.md)

## Between 1.0.0 and 1.2.0

- Published a separate Android 1.0.0 test APK with local and account workspaces. [Android release](https://github.com/x13-4zur3/productivity/releases/tag/android-v1.0.0)
- Added browser access to the hosted account workspace, with installation from supported browsers. [Web app](https://productivity-accounts.onrender.com)
- Added Read the Docs guides for installation, use, builds, and account hosting. [Documentation](https://productivity.readthedocs.io/en/latest/)

## 1.0.0 · Published desktop baseline

- Shipped Windows Setup with a custom install folder, repair, and uninstall. Published Debian and portable Linux packages.
- Included the journal with moods and tags, to-do lists with priorities, recurring tasks and subtasks, a Home dashboard, and the 5-, 15-, and 25-minute focus presets.
- Included Docs, Docs Dark, Terminal, and High Contrast themes, configurable desktop shortcuts, on-device SQLite, and optional PostgreSQL-backed accounts. [v1.0.0 release](https://github.com/x13-4zur3/productivity/releases/tag/v1.0.0)
