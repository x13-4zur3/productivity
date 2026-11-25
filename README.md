# Productivity

Productivity is a desktop journal, task list, and focus timer. Home shows what’s due, your journal activity, and a writing prompt. Choose Docs, Docs Dark, Terminal, or High Contrast from the appearance menu.

This Python port is based on the original app by azure069. Local work and preferences are saved to SQLite. You can also sign in to a PostgreSQL-backed Productivity account. [Original repository](https://github.com/x13-4zur3/productivity)

## Install and run

### Windows

1. Run `Productivity-Setup-x64.exe` on 64-bit Windows 10 or 11. Choose an install folder and, optionally, a desktop shortcut. Python is included. Setup uses your internet connection to install the Microsoft Edge WebView2 Runtime if needed. The installer is unsigned.
2. Open **Productivity** from Start or your desktop shortcut. To close it, close the window or use **Exit Productivity** from Start.
3. Run Setup again to **Update or repair Productivity** or **Uninstall Productivity**. You can also uninstall from **Settings → Apps → Installed apps**. Your database stays in `%LOCALAPPDATA%\Productivity\productivity.sqlite3`.

If the window reports a missing runtime, install the Evergreen WebView2 Runtime and reopen Productivity. Keep .NET Framework 4.8 or later available through Windows Update. For silent installs with `/S`, install WebView2 beforehand. For silent removal, run `Productivity-Setup-x64.exe /S /UNINSTALL`. [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/#download)

### macOS

1. Quit any running copy of Productivity. Open `Productivity-macOS.dmg` on an Apple silicon or Intel Mac running macOS 11 or newer. Drag **Productivity** into **Applications**, then eject the disk image. Both Python runtimes and the desktop dependencies are included.
2. Open **Productivity** from **Applications**. The distributed disk image is unsigned and unnotarized.
3. To uninstall, quit the app and move `Productivity.app` from Applications to Trash. Your database stays in `~/Library/Application Support/Productivity/productivity.sqlite3`.

### Linux

On Debian 12+, Ubuntu 22.04+, or a compatible distribution, install the package and its GTK and WebKitGTK dependencies with APT.

```sh
sudo apt install ./productivity_1.0.0_all.deb
```

Open **Productivity** from the app launcher or run `productivity` in a graphical session. Close the window or run `productivity --stop` to exit. To remove the package, run `sudo apt remove productivity`.

For other Linux distributions, install Python 3.10 or newer, the Python GObject bindings, GTK 3, and WebKitGTK bindings for API version 4.1 or 4.0. Unpack the portable build and run it in a graphical session.

```sh
tar -xzf Productivity-Linux.tar.gz
cd Productivity
./productivity
```

Both Linux builds store your database at `$XDG_DATA_HOME/productivity/productivity.sqlite3`. The default is `~/.local/share/productivity/productivity.sqlite3`.

## Run the desktop app from source

Run these commands from the extracted project folder. Source and installed launches use the same database for the current operating system.

**Windows** with Python 3.11+, WebView2 Runtime, and .NET Framework 4.8+

```powershell
python.exe -m pip install pywebview==6.2.1
python.exe app.py
```

**macOS** with Python 3.13

```sh
python3 -m pip install pywebview==6.2.1
python3 app.py
```

**Linux** with the system Python and the GTK, WebKitGTK, and GObject dependencies above

```sh
/usr/bin/python3 app.py
```

If you previously ran the standalone browser launcher, its database may be next to that copy of `app.py`. With Productivity closed, you can copy that file into the current app’s data folder if the folder has no database yet.

## Use PostgreSQL accounts

Open **Settings → Account** in the desktop app to connect to a Productivity account server. The server setup guide covers PostgreSQL, app usernames and passwords, and HTTPS for multiple computers. [Account setup guide](ACCOUNTS.md)

## Build the installers from source

Run these commands from the project root. The installers go in `dist/` by default.

| Build | Tools | Command | Artifacts |
| --- | --- | --- | --- |
| Windows x64 | Python 3.10+, standard NSIS 3.11+ | `python packaging/windows/build.py` | `Productivity-Setup-x64.exe` |
| macOS Apple silicon and Intel | Python 3.12+, Go 1.24+ | `python3 packaging/build_unix.py macos` | `Productivity-macOS.dmg` |
| Linux | Python 3.10+, `dpkg-deb` | `python3 packaging/build_unix.py linux` | `productivity_1.0.0_all.deb`, `Productivity-Linux.tar.gz` |

On Windows, use `py -3` if `python` is unavailable. The build looks for the NSIS compiler on `PATH` and in the standard Windows install folders. If you installed NSIS elsewhere, pass `--makensis` with the full path to `makensis.exe`. The build downloads and verifies the Windows Python runtime, the pinned desktop packages, and the Microsoft WebView2 bootstrapper. Use `--python-archive` for an existing Python archive and `--desktop-cache` to reuse the desktop downloads.

The macOS build downloads and verifies both Python runtimes and the pinned desktop dependencies. It can run on macOS or Linux. Use `--runtime-cache /path/to/cache` to reuse the archives and `--go /path/to/go` if needed. Builds on macOS use the system `hdiutil` backend.

After building all four packages, run `python3 packaging/build_bundle.py` to create `dist/Productivity-1.0.0.zip` with the source, installers, and setup guides.

See [RELEASE.md](RELEASE.md) for the GitHub source and release checklist. See [SIGNING.md](SIGNING.md) for Developer ID signing and notarization on macOS, Authenticode on Windows, and detached signatures on Linux.

## Use Productivity

- **Home** shows due and overdue tasks, seven days of journal activity, your latest reflection, and a writing prompt you can swap or take straight into a new entry.
- **Focus timer** supports 5, 15, and 25 minutes. Pause, resume, or reset it. While it’s running, the footer shows the countdown as you move between views. The app remembers the timer between launches.
- **Settings** sits above the theme picker in the desktop sidebar. Use **General** to set your display name and start page, **Appearance** to change themes or reduce motion, and **Shortcuts** to assign, clear, or restore key combinations. Changes are saved on this device.
- Write an entry, choose a mood, and add optional tags. Mood symbols use `:D`, `:|`, `:(`, and `<3`. Find past entries using text search, mood, and tags. Ctrl+Enter or Command+Enter saves the current entry or task by default.
- Enter a task name to add it quickly. Expand **Due date, priority, repeat** for scheduling. Filter by status, sort by date or priority, and expand a task to manage subtasks. Completing a repeating task adds the next occurrence with its subtasks unchecked.
- Use **Reminders** on the To-do list to see tasks due today or overdue. Where desktop alerts are available, enable them from this view and keep the To-do list open to receive them.
- The sidebar shows the local clock and counts for the current view. The task view shows progress across all tasks.

### Keyboard shortcuts

Open **Settings** with Ctrl+, on Windows and Linux or Command+, on macOS. In **Shortcuts**, select an action’s current binding and press your preferred combination. Use Ctrl, Alt, or Command with a letter, digit, comma, or Enter. Esc cancels recording. Choose **Save changes** to keep the new shortcuts.

Deleting an entry, task, or subtask opens a confirmation inside the app. Cancel or press Esc to keep the item. Required fields show a message beside the input and move focus there so you can correct it.

## Import data from the original browser app

1. Open the original app at the address where you used it, in the same browser profile. Open the developer tools console and run this code to download your journal and tasks.

   ```javascript
   (() => {
     const read = key => JSON.parse(localStorage.getItem(key) ?? '[]');
     const todos = read('todos').map(task => {
       if (!task.dueDate) return task;
       const date = new Date(task.dueDate);
       const year = String(date.getFullYear()).padStart(4, '0');
       const month = String(date.getMonth() + 1).padStart(2, '0');
       const day = String(date.getDate()).padStart(2, '0');
       return { ...task, dueDate: [year, month, day].join('-') };
     });
     const json = JSON.stringify({ journalEntries: read('journalEntries'), todos });
     const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
     const link = document.createElement('a');
     link.href = url;
     link.download = 'productivity-browser-export.json';
     link.click();
     setTimeout(() => URL.revokeObjectURL(url), 1000);
   })();
   ```

2. Run the importer with the downloaded file and the database you use to launch Productivity. On Windows, open Command Prompt in the installation folder first.

   **Source checkout**

   ```sh
   python3 import_browser_data.py /path/to/productivity-browser-export.json
   ```

   **Windows installer**

   ```bat
   runtime\python.exe import_browser_data.py "C:\path\to\productivity-browser-export.json" --db "%LOCALAPPDATA%\Productivity\productivity.sqlite3"
   ```

   **macOS disk image**

   ```sh
   resources=/Applications/Productivity.app/Contents/Resources
   case "$(uname -m)" in arm64) arch=aarch64 ;; *) arch=x86_64 ;; esac
   "$resources/runtime-$arch/bin/python3" -B "$resources/app/import_browser_data.py" \
     /path/to/productivity-browser-export.json \
     --db "$HOME/Library/Application Support/Productivity/productivity.sqlite3"
   ```

   **Linux Debian package**

   ```sh
   python3 /usr/lib/productivity/import_browser_data.py /path/to/productivity-browser-export.json \
     --db "${XDG_DATA_HOME:-$HOME/.local/share}/productivity/productivity.sqlite3"
   ```

   For portable Linux, use `./import_browser_data.py` in place of the `/usr/lib` path. For source launches, use `--db` with the platform-specific app database path above. Repeating an import skips records it has already imported.

## License

The original project is licensed under Apache 2.0. See [LICENSE](LICENSE).
