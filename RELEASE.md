# Publish Productivity 1.1.0 on GitHub

## Prepare the release

1. Use the 1.1.0 source on the release branch, for example `v-1.1.0`. Commit source, build files, and docs. Keep generated installers, SQLite data, and credentials out of Git. The public HTTPS address in `account-service.json` can be committed.
2. Deploy the matching account server to Render so signed-in Windows and Linux users can access the new tools. Verify `/api/health` and sign in with a test account before publishing. Existing databases are upgraded when the app or server starts.
3. Build the installers from the same commit you plan to tag. Run the Windows command on a machine with the standard NSIS compiler. Run the Linux command on a system with `dpkg-deb`.

   ```powershell
   py -3 packaging/windows/build.py
   ```

   ```sh
   python3 packaging/build_unix.py linux
   python3 packaging/build_unix.py macos
   ```

   For the Android APK, see [Build the Android APK](docs/pages/build.md#build-the-android-apk). The Android 1.1.0 debug APK is for testing.

4. Test upgrading an existing 1.0.0 installation. Open the calendar, create a task from a journal entry, move it in the weekly planner, and delete and undo a test item. Test the Windows installer with WebView2 available and check the Linux package in a graphical session.

## Attach the release downloads

On GitHub, choose **Releases → Draft a new release**. Create `v1.1.0` on the commit that built your installers, enter `Productivity 1.1.0`, and attach the files from `dist/`.

| Release asset | Use |
| --- | --- |
| `Productivity-Setup-x64.exe` | Windows x64 installer |
| `productivity_1.1.0_all.deb` | Debian and Ubuntu package |
| `Productivity-Linux.tar.gz` | Portable Linux archive |
| `Productivity-macOS.dmg` | macOS disk image for Apple silicon and Intel |
| `Productivity-Android-1.1.0-debug.apk` | Android test APK |

Use your signed installer and signature files if you sign the release. GitHub generates source archives automatically from the tag. [GitHub Releases guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

The installable web app runs from the included source. Deploy it with the account server and public web origin configured. [Hosting guide](docs/pages/hosting.md)

The GitHub Packages workflow takes the SHA-256 of the installer attached to the GitHub release. Use the final installer file when calculating the checksum.
