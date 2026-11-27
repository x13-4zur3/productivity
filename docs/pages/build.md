# Build from source

Use the [`v1.0.0` tag](https://github.com/x13-4zur3/productivity/tree/v1.0.0) for the desktop builds. Run the desktop commands from the project root.

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

## Build the Android APK

To build the current `main` branch, open [Build Productivity Android APK](https://github.com/x13-4zur3/productivity/actions/workflows/build-android.yml) in GitHub Actions and select **Run workflow**. Download the debug APK from **Artifacts** when the run succeeds.

To build v1.0.0 locally, check out the [`android-v1.0.0` tag](https://github.com/x13-4zur3/productivity/tree/android-v1.0.0). Set up Java 21, Python 3.13, Android SDK Platform 36, and Build Tools 35.0.0. Run the Gradle wrapper from the `android/` directory.

=== "Windows"

    ```powershell
    .\gradlew.bat :app:assembleDebug
    ```

=== "macOS or Linux"

    ```bash
    ./gradlew :app:assembleDebug
    ```

The APK is saved to `android/app/build/outputs/apk/debug/app-debug.apk`. Select **Android** in [Install and update](install.md) for installation steps.
