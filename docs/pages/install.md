# Install and update

Choose your platform below. The published downloads are **1.0.0**. To try the upcoming Windows and Linux update, [build 1.1.0 from source](build.md) or see [what’s new](changes.md#productivity-110).

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

=== "Android"

    The v1.0.0 APK is a debug build for testing on Android 7.0 or later. It supports ARM64 and x86-64 devices.

    1. Download [Productivity-Android-1.0.0-debug.apk](https://github.com/x13-4zur3/productivity/releases/download/android-v1.0.0/Productivity-Android-1.0.0-debug.apk) on your device.
    2. Open the APK. If Android prompts you, allow **Install unknown apps** for the browser or file manager you used, then return to the installer.
    3. Tap **Install**, then open **Productivity**. Create an account, sign in, or choose **Use local data**.

    To update, install a newer APK signed with the same key over the current app. Uninstalling Productivity removes the local workspace from the device.

=== "Web"

    Open [Productivity in your browser](https://productivity-accounts.onrender.com) and sign in with your Productivity account. In a supported browser, use **Install** or **Add to Home Screen** to open it like an app.

    On iPhone or iPad, open the site in Safari and choose **Share → Add to Home Screen**. Use the same account to open the workspace on desktop or Android.

## Next steps

[Use the journal, tasks, and focus timer](use.md) or [set up an account](accounts.md). If the app fails to open, see [Troubleshooting](troubleshooting.md).
