# Troubleshooting

## The Windows app does not open

1. Open **Productivity** from Start after Setup finishes.
2. If the app reports a missing runtime, install the [Evergreen WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/#download) and reopen it. Keep .NET Framework 4.8 or newer available through Windows Update.
3. If Productivity is already running and the window is missing, choose **Exit Productivity** from Start, then open it again.

When testing 1.2.0 from source, you can start with the system title bar. Close Productivity first and run `py -3 app.py --system-title-bar`.

## Sign-in takes a while

A hosted service on Render's free tier can sleep while it is idle. The first sign-in or registration request after a break may take about a minute. If the problem persists, confirm the server address in **Settings → Account**. [Render free-tier behavior](https://render.com/docs/free)

## My journal or tasks look empty

Check whether you are signed in or using the local workspace. To see local entries, choose **Settings → Account → Use local data**. If you installed on a new computer, sign in to the account you previously used or restore a backup of the local database. [Database locations and backup steps](accounts.md#back-up-your-local-workspace)

## Calendar is missing after signing in

Check the desktop app version and the account server version. Calendar, Weekly planner, and other 1.2.0 features need the matching account server. Ask the server administrator to deploy the 1.2.0 code. [Account hosting guide](hosting.md)

## NSIS cannot find the compiler or a file

Install standard NSIS 3.11 or newer. Pass its full path with `--makensis` if Python cannot find it. The v1.0.0 script supports standard NSIS and uses Windows-compatible paths for the staged files. If an older copy fails while looking for the AMD64 setup stub or WebView2 file, use the script from the [v1.0.0 tag](https://github.com/x13-4zur3/productivity/tree/v1.0.0/packaging/windows).

## Report an issue

Include your operating system, Productivity version, and the error text. Remove account passwords, database connection strings, and private journal content before posting. [GitHub Issues](https://github.com/x13-4zur3/productivity/issues)
