# Productivity

Productivity is a journal, to-do list, calendar, and focus timer. Work locally with SQLite or sign in to access your account workspace on multiple devices. This Python port is based on the original app by azure069.

[Open the web app](https://productivity-accounts.onrender.com) · [Read the Docs](https://productivity.readthedocs.io/en/latest/) · [Changelog](CHANGELOG.md)

## Install

| Platform | Download and open |
| --- | --- |
| Windows 10 or 11, x64 | Run [Productivity-Setup-x64.exe](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/Productivity-Setup-x64.exe), choose an install folder, then open Productivity from Start. Setup installs WebView2 if needed. |
| Linux | Install the [Debian/Ubuntu package](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/productivity_1.0.0_all.deb) with `sudo apt install ./productivity_1.0.0_all.deb`, then open Productivity from the app menu. For the [portable build](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/Productivity-Linux.tar.gz), extract it and run `./productivity` inside the extracted folder after installing Python, GTK, and WebKitGTK. |
| macOS 11+ | Follow the [build guide](docs/pages/build.md#build-the-installers) to create a disk image, then drag Productivity into Applications. |
| Android 7.0+ | Open the [v1.0.0 test APK](https://github.com/x13-4zur3/productivity/releases/tag/android-v1.0.0) on your device and allow installation from that source if prompted. Future APKs must use the same signing key to update in place. |
| Web | Open [Productivity](https://productivity-accounts.onrender.com) and sign in. Use **Install** or **Add to Home Screen** in your browser if available. |

The downloads above are the published **1.0.0** releases. This branch prepares **1.2.0** for Windows and Linux. Close Productivity before installing an update. Windows Setup can also repair or uninstall the app. For requirements, removal steps, and SmartScreen information, see the [installation guide](docs/pages/install.md).

## Start using Productivity

- **Home** shows upcoming tasks, recent journal activity, and a writing prompt. Pick a focus preset or choose **Custom**, enter **1 to 180 minutes**, and select **Start focus**. The footer keeps the timer handy while it’s running or paused.
- **Journal** saves reflections with moods and tags. Select text in a saved entry to create a linked task.
- **To-do list** supports due dates, priorities, repeat schedules, and subtasks. Use **Weekly planner** to review deadlines and move tasks between dates.
- **Calendar** has a **Month** grid and a **Linear** agenda. Both show events, tasks, and journal entries. Select a date to see its agenda or create a task due that day.
- **Search** opens alongside the workspace. Press **Ctrl+F** on Windows and Linux or **Command+F** on macOS to open it, then press the same keys to close it. Search multiple words and filter results by type.
- **Settings** has themes, motion preferences, a start page, and editable shortcuts. Deletions can be undone from the notification for **30 seconds**.

### Calendar and keyboard tips

**Linear** lists one Monday-to-Sunday week in date order, with clickable events, tasks, and journal entries. Use the arrows beside the date range to change weeks, or choose **Today** to jump back. Switching views keeps your selected date. When a date has focus, use Left/Right to move by day in Month view and Up/Down to move by day in Linear. The other arrow pair moves by week.

Your saved Search shortcut still toggles the panel. **Ctrl+F** or **Command+F** is also available when that key is unassigned and Search has a binding. You can change bindings or reduce animations in **Settings**.

### Windows window controls

The Windows title bar follows the selected theme. Drag the title area to move the window, double-click it to maximize or restore, or use the buttons at the right. To start with the standard Windows frame from source, close Productivity and run `py -3 app.py --system-title-bar`.

### Accounts and local data

Choose **Use local data** for the workspace saved on your device. To open your account workspace, sign in from **Settings → Account** on each device. Local and account workspaces are separate. Features in 1.2.0 require the matching account server when signed in. [Account and data guide](docs/pages/accounts.md)

| Platform | Default local database folder |
| --- | --- |
| Windows | `%LOCALAPPDATA%\Productivity` |
| macOS | `~/Library/Application Support/Productivity` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/productivity` |

The database is named `productivity.sqlite3`. For an older browser-only workspace, follow the [data import guide](https://github.com/x13-4zur3/productivity/blob/v1.0.0/README.md#import-data-from-the-original-browser-app).

## Run or build from source

Run these commands from the repository root.

| Platform | Run the app | Build the installer |
| --- | --- | --- |
| Windows | Install Python 3.11+, WebView2, and .NET Framework 4.8+. Run `py -3 -m pip install pywebview==6.2.1`, then `py -3 app.py`. | With standard NSIS 3.11+, run `py -3 packaging/windows/build.py`. |
| Linux | With Python 3.10+, GObject, GTK 3, and WebKitGTK installed, run `/usr/bin/python3 app.py` in a graphical session. | With `dpkg-deb`, run `python3 packaging/build_unix.py linux`. |
| macOS | With Python 3.13, run `python3 -m pip install pywebview==6.2.1`, then `python3 app.py`. | With Python 3.12+ and Go 1.24+, run `python3 packaging/build_unix.py macos`. |

Desktop installers are written to `dist/`. The [build guide](docs/pages/build.md) covers dependencies and the Android build. To host accounts, follow the [PostgreSQL, Render, and Neon guide](ACCOUNTS.md). For distribution, see the [release checklist](RELEASE.md) and the [signing guide](https://github.com/x13-4zur3/productivity/blob/v1.0.0/SIGNING.md).

## Help

[Troubleshooting](docs/pages/troubleshooting.md) · [Report an issue](https://github.com/x13-4zur3/productivity/issues) · [Apache 2.0 license](LICENSE)
