# Productivity

Productivity is a journal, task list, and focus timer for desktop and Android. Home shows what’s due, your journal activity, and a writing prompt. Choose Docs, Docs Dark, Terminal, or High Contrast from the appearance menu.

This Python port is based on the original app by azure069. Local work and preferences are saved to SQLite. You can also sign in to a PostgreSQL-backed Productivity account. [Original repository](https://github.com/x13-4zur3/productivity)

Installation, usage, and account setup guides are available on [Read the Docs](https://productivity.readthedocs.io/en/latest/).

## Downloads

| Platform | Productivity 1.0.0 |
| --- | --- |
| Windows x64 | [Setup installer (.exe)](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/Productivity-Setup-x64.exe) |
| Linux | [Debian and Ubuntu package (.deb)](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/productivity_1.0.0_all.deb) · [Portable archive (.tar.gz)](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/Productivity-Linux.tar.gz) |
| macOS | [Build the disk image](#build-the-desktop-installers-from-source) |
| Android | [Test APK (.apk)](https://github.com/x13-4zur3/productivity/releases/download/android-v1.0.0/Productivity-Android-1.0.0-debug.apk) |

See the release notes for [Windows and Linux (`v1.0.0`)](https://github.com/x13-4zur3/productivity/releases/tag/v1.0.0) and [Android (`android-v1.0.0`)](https://github.com/x13-4zur3/productivity/releases/tag/android-v1.0.0).

## Install and run

### Windows

1. Run `Productivity-Setup-x64.exe` on 64-bit Windows 10 or 11. Choose an install folder and, optionally, a desktop shortcut. Python is included. Setup uses your internet connection to install the Microsoft Edge WebView2 Runtime if needed. The installer is unsigned.
2. Open **Productivity** from Start or your desktop shortcut. To close it, close the window or use **Exit Productivity** from Start.
3. Run Setup again to **Update or repair Productivity** or **Uninstall Productivity**. You can also uninstall from **Settings → Apps → Installed apps**. Your database stays in `%LOCALAPPDATA%\Productivity\productivity.sqlite3`.

If the window reports a missing runtime, install the Evergreen WebView2 Runtime and reopen Productivity. Keep .NET Framework 4.8 or later available through Windows Update. For silent installs with `/S`, install WebView2 beforehand. For silent removal, run `Productivity-Setup-x64.exe /S /UNINSTALL`. [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/#download)

### macOS

1. Quit any running copy of Productivity. Open `Productivity-macOS.dmg` on an Apple silicon or Intel Mac running macOS 11 or newer. Drag **Productivity** into **Applications**, then eject the disk image. Both Python runtimes and the desktop dependencies are included.
2. Open **Productivity** from **Applications**. The standard local build is unsigned and unnotarized.
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

### Android

Productivity requires Android 7.0 or later on ARM64 or x86-64. The published v1.0.0 APK is a debug build for testing.

1. Download the test APK from the [Android release](https://github.com/x13-4zur3/productivity/releases/tag/android-v1.0.0) and open it on your device.
2. If Android prompts you, allow **Install unknown apps** for the browser or file manager you used, then return to the installer and tap **Install**.
3. Open **Productivity**. Create an account, sign in, or choose **Use local data** to keep your journal and tasks on the device.

To update in place, install a newer APK signed with the same key. Uninstalling Productivity removes its local workspace from the device.

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

On desktop or Android, open **Settings → Account** to create an account, sign in, or switch to local data. Use the same account on another device to access your account workspace. The released builds use the configured HTTPS account service. To run your own service with PostgreSQL, follow the [account setup guide](ACCOUNTS.md).

## Build the desktop installers from source
