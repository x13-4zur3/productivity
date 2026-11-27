# Publish Productivity 1.2.0 on GitHub

## Prepare the release

1. Review and finish the `v-1.2.0` branch. Commit source, build files, and docs. Keep generated installers, SQLite data, and credentials out of Git. The public HTTPS address in `account-service.json` can be committed.
2. Deploy the matching account server to Render so signed-in Windows and Linux users can access the new tools. Verify `/api/health` and sign in with a test account before publishing. Existing databases are upgraded when the app or server starts.
3. Build the Windows and Linux installers from the same commit you plan to tag. Run the Windows command on a machine with the standard NSIS compiler. Run the Linux command on a system with `dpkg-deb`.

   ```powershell
   py -3 packaging/windows/build.py
   ```

   ```sh
   python3 packaging/build_unix.py linux
   ```

4. Test upgrading an existing 1.0.0 installation. Open the calendar, create a task from a journal entry, move it in the weekly planner, and delete and undo a test item. Test the Windows installer with WebView2 available and check the Linux package in a graphical session.

## Attach the Windows and Linux downloads

On GitHub, choose **Releases → Draft a new release**. Create `v1.2.0` on the commit that built your installers, enter `Productivity 1.2.0`, and attach the files from `dist/`.

| Release asset | Use |
| --- | --- |
| `Productivity-Setup-x64.exe` | Windows x64 installer |
| `productivity_1.2.0_all.deb` | Debian and Ubuntu package |
| `Productivity-Linux.tar.gz` | Portable Linux archive |

Use your signed installer and signature files if you sign the release. GitHub generates source archives automatically from the tag. [GitHub Releases guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
