# Accounts and data

Choose **Use local data** to work with the journal and tasks stored on your device. Sign in to an account when you want to open the same account workspace on another computer.

## Create an account or sign in

1. Open Productivity. If the sign-in screen is already open, start there. Otherwise, go to **Settings → Account** and connect to a server.
2. Choose **Create an account** when the server allows registration, or enter the username and password for an existing account.
3. On another computer, connect to the same server and sign in using the same account.

The official Windows installer includes a service address. For a custom build, enter the HTTPS address your server administrator provides. The sign-in form uses a Productivity username and password.

You can open the same account workspace in the [web app](https://productivity-accounts.onrender.com) when you use the hosted Productivity service. For features such as Calendar and Weekly planner, the desktop app and account service both need the 1.1.0 code. [Host the account service](hosting.md)

!!! note "Your local workspace and account workspace are separate"
    A new account starts empty. Choose **Use local data** to return to the journal and tasks stored on that computer.

## Back up your local workspace

Close Productivity, then copy `productivity.sqlite3` to a private backup location. The app creates and reuses the database in your user data folder.

| Platform | Default database location |
| --- | --- |
| Windows | `%LOCALAPPDATA%\Productivity\productivity.sqlite3` |
| macOS | `~/Library/Application Support/Productivity/productivity.sqlite3` |
| Linux | `~/.local/share/productivity/productivity.sqlite3` |

On Linux, a custom `XDG_DATA_HOME` changes the parent data directory. Hosted account data is backed up on the server by its administrator.

## Move data from the older browser app

Use the [browser data import instructions](https://github.com/x13-4zur3/productivity/blob/v1.0.0/README.md#import-data-from-the-original-browser-app) to export your journal and tasks from the original browser profile and import them into the desktop app's local workspace.