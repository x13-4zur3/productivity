# Install and update

Download Productivity 1.0.0 for Windows or Linux. For macOS, use the [build guide](build.md) to create a disk image.

=== "Windows"

    Productivity supports 64-bit Windows 10 and 11. Python is included. Setup can download Microsoft Edge WebView2 if Windows needs it.

    1. Download [Productivity-Setup-x64.exe](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/Productivity-Setup-x64.exe).
    2. Run Setup, choose an installation folder, and select a desktop shortcut if you want one.
    3. Open **Productivity** from Start. Create an account, sign in, or choose **Use local data**.

    !!! note "Windows publisher warning"
        The v1.0.0 Windows installer is unsigned. Windows SmartScreen may show a warning. Use the installer linked from the official [GitHub release](https://github.com/x13-4zur3/productivity/releases/tag/v1.0.0).

    To update, close Productivity and run the newer installer. To repair the current version, reopen Setup and choose **Update or repair Productivity**. To remove it, choose **Uninstall Productivity** in Setup or uninstall it from **Settings → Apps → Installed apps**. The local database stays in `%LOCALAPPDATA%\Productivity\productivity.sqlite3`.

=== "macOS"

    The disk image supports macOS 11 or later on Apple silicon and Intel. Follow [Build the installers](build.md#build-the-installers) to create `Productivity-macOS.dmg`.

    1. Quit Productivity if it is open.
    2. Open the disk image, drag **Productivity** to **Applications**, and eject the image.
    3. Open **Productivity** from Applications.

    Standard local builds are unsigned. For public distribution, follow the [signing and notarization guide](https://github.com/x13-4zur3/productivity/blob/v1.0.0/SIGNING.md).

    To uninstall, close the app and move `Productivity.app` to Trash. Local data stays in `~/Library/Application Support/Productivity/productivity.sqlite3`.

=== "Linux"

    **Debian and Ubuntu package**

    On Debian 12+, Ubuntu 22.04+, or a compatible distribution, download [productivity_1.0.0_all.deb](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/productivity_1.0.0_all.deb). Install the package and its dependencies from your download folder.

    ```bash
    sudo apt install ./productivity_1.0.0_all.deb
    ```

    Open **Productivity** from the app launcher or run `productivity` from a graphical session. To uninstall the Debian package, run `sudo apt remove productivity`.

    **Portable archive**

    Download [Productivity-Linux.tar.gz](https://github.com/x13-4zur3/productivity/releases/download/v1.0.0/Productivity-Linux.tar.gz). The portable build requires Python 3.10+, Python GObject bindings, GTK 3, and WebKitGTK bindings for API 4.1 or 4.0. Launch it from a graphical session.

    ```bash
    tar -xzf Productivity-Linux.tar.gz
    cd Productivity
    ./productivity
    ```

    Both builds keep local data in `$XDG_DATA_HOME/productivity/productivity.sqlite3`. The default location is `~/.local/share/productivity/productivity.sqlite3`.

## Next steps

[Use the journal, tasks, and focus timer](use.md) or [set up an account](accounts.md). If the app fails to open, see [Troubleshooting](troubleshooting.md).
