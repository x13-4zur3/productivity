# Build from source

Use the [`v1.0.0` tag](https://github.com/x13-4zur3/productivity/tree/v1.0.0) to build this version. Run the platform command from the project root.

## Run the desktop app from source

=== "Windows"

    Install Python 3.11+, the WebView2 Runtime, and .NET Framework 4.8 or newer.

    ```powershell
    py -3 -m pip install pywebview==6.2.1
    py -3 app.py
    ```

=== "macOS"

    Use Python 3.13.

    ```bash
    python3 -m pip install pywebview==6.2.1
    python3 app.py
    ```

=== "Linux"

    Install the Python GObject, GTK 3, and WebKitGTK dependencies described in [Install and update](install.md). Run from a graphical session.

    ```bash
    /usr/bin/python3 app.py
    ```

## Build the installers

| Target | Build tools | Output in `dist/` |
| --- | --- | --- |
| Windows x64 | Python 3.10+, standard NSIS 3.11+ | `Productivity-Setup-x64.exe` |
| macOS Apple silicon and Intel | Python 3.12+, Go 1.24+ | `Productivity-macOS.dmg` |
| Debian and portable Linux | Python 3.10+, `dpkg-deb` | `productivity_1.0.0_all.deb`, `Productivity-Linux.tar.gz` |

=== "Windows"

    ```powershell
    py -3 packaging/windows/build.py
    ```

    If NSIS is installed outside the standard location, pass `--makensis` with the full path to `makensis.exe`.

=== "macOS"

    ```bash
    python3 packaging/build_unix.py macos
    ```

    The macOS build runs on macOS or Linux. Use a Mac for signing and notarization.

=== "Linux"

    ```bash
    python3 packaging/build_unix.py linux
    ```

For a hosted-account build, set the public HTTPS address in `account-service.json` before building. See [Host the account service](hosting.md) and the [release checklist](https://github.com/x13-4zur3/productivity/blob/v1.0.0/RELEASE.md).
