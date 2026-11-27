# Productivity accounts with PostgreSQL

Productivity 1.1.0 supports username and password accounts. The desktop app connects to the Productivity account service. The service connects to PostgreSQL and stores each account’s journal, tasks, preferences, and focus timer.

## 1. Create the database

Install PostgreSQL 15 or newer on the computer that will run the account service. Open its `psql` shell as your PostgreSQL administrator. On many Windows installs, that is `psql -U postgres -d postgres`. On Debian and Ubuntu, use `sudo -u postgres psql -d postgres`. Use the administrator you created if your installation uses a different role. [PostgreSQL downloads](https://www.postgresql.org/download/)

Run these commands inside `psql`. Choose a database password when prompted.

```sql
CREATE ROLE productivity LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
\password productivity
CREATE DATABASE productivity OWNER productivity;
\q
```

Set up a libpq password file **on the account server**. Use `~/.pgpass` on macOS or Linux, or `%APPDATA%\postgresql\pgpass.conf` on Windows. Add the following line with the database password you chose. On macOS and Linux, run `chmod 600 ~/.pgpass`. Escape any colons and backslashes in the password with a backslash. [PostgreSQL password file](https://www.postgresql.org/docs/current/libpq-pgpass.html)

```text
127.0.0.1:5432:productivity:productivity:YOUR_DATABASE_PASSWORD
```

## 2. Start the account service

Run these commands from the extracted project folder on the PostgreSQL computer.

**Windows PowerShell**

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-server.txt
$env:PRODUCTIVITY_DATABASE_URL = 'host=127.0.0.1 port=5432 dbname=productivity user=productivity'
.\.venv\Scripts\python.exe account_server.py init-db
.\.venv\Scripts\python.exe account_server.py create-user alice
.\.venv\Scripts\python.exe account_server.py serve
```

**macOS and Linux**

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-server.txt
export PRODUCTIVITY_DATABASE_URL='host=127.0.0.1 port=5432 dbname=productivity user=productivity'
.venv/bin/python account_server.py init-db
.venv/bin/python account_server.py create-user alice
.venv/bin/python account_server.py serve
```

`create-user` prompts for the user’s app password, which is separate from the PostgreSQL role password. Usernames use 3–32 letters, digits, dots, hyphens, or underscores and are case-insensitive. App passwords use 12–128 characters.

The account service listens on `127.0.0.1:8765` by default. Use `serve --port 8766` to choose another port. Add `--allow-registration` to `serve` if you want people to create their own accounts in the desktop app. With the default setting, use `create-user USERNAME` to add each user. Use `reset-password USERNAME` to set a new password and invalidate that account’s existing sessions.

## 3. Sign in from Productivity

1. Install or launch Productivity 1.0.0. Open **Settings → Account → Connect to a server**.
2. For an account service on the same computer, enter `http://127.0.0.1:8765` as the server address. Enter the app username and password.
3. Select **Sign in**. If the server allows self-registration, **Create an account** lets you register and sign in from the same dialog.

You can use **Switch account**, **Sign out**, or **Use local data** in Settings. The app remembers the server address and asks you to sign in when you reopen it. Online sessions expire after 12 hours. New account workspaces start empty. **Use local data** opens the existing SQLite journal and tasks on that device.

## 4. Connect from multiple computers

Use an HTTPS address for clients on other computers. Keep the account service and PostgreSQL on the server’s loopback interface. Point your domain at the server and expose your HTTPS reverse proxy. For example, if Caddy runs on the same server, set this in its Caddyfile after replacing the domain. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)

```caddyfile
accounts.example.com {
    reverse_proxy 127.0.0.1:8765
}
```

Enter `https://accounts.example.com` in each desktop app and sign in with the same account to open the same data. Run the Python account service under your server’s service manager for regular use. The desktop app only needs the service URL and the user’s username and password.

To back up the account database, run `pg_dump -Fc -f productivity.dump -h 127.0.0.1 -U productivity productivity` on the server. Keep the backup private because it contains journal data, password hashes, and other account records.

## Host accounts on Neon and Render

This setup keeps signup and login available when your own computer is off. You manage the Neon and Render projects. Users create their Productivity accounts in the desktop app.

### Create the Neon database and service role

1. In Neon, create a project with PostgreSQL 15 or newer. Add a database named `productivity` in the project's **Databases** tab.
2. In Neon’s **Connect** dialog, choose that database and your project’s owner role. Turn connection pooling off and use the **psql** command Neon provides. Run it from a terminal with `psql` installed.
3. In that `psql` session, run the commands below. Choose a strong, unique password at the prompt.

   ```sql
   CREATE ROLE productivity_app LOGIN;
   \password productivity_app
   GRANT CONNECT, CREATE ON DATABASE productivity TO productivity_app;
   \q
   ```

   Create the app role through SQL to keep its privileges limited to the grants above. [Neon role management](https://neon.com/docs/manage/roles)

4. Prepare the **direct** PostgreSQL connection string for `productivity_app` using Neon’s endpoint and the `productivity` database. Keep the TLS parameters from Neon’s generated URL. If you edit the URL by hand, URL-encode special characters in the password. This value goes into Render as `PRODUCTIVITY_DATABASE_URL`. [Connect to Neon](https://neon.com/docs/connect/connect-from-any-app)

### Deploy the account service on Render

1. Commit the source to GitHub using the list in [RELEASE.md](RELEASE.md). The included `render.yaml` defines a free Python web service with self-registration enabled.
2. In Render, select **New → Blueprint** and connect your source repository. Enter the Neon connection string when Render prompts for `PRODUCTIVITY_DATABASE_URL`. Apply the Blueprint.
3. Copy the public HTTPS URL from the Render service dashboard. Open its `/api/health` URL. Expect JSON with `"service":"productivity-accounts-v1"` and `"registration":true`. If the build succeeds but the service fails to start, check the Render logs and confirm the Neon endpoint, role, and database. [Render Blueprint setup](https://render.com/docs/blueprint-spec)

For manual deployment, create a free **Web Service** with the Python runtime, set the build command to `python -m pip install -r requirements-server.txt`, and use this start command. Set `PRODUCTIVITY_DATABASE_URL` under **Environment** and `/api/health` as the health check path. [Render web services](https://render.com/docs/web-services)

```sh
python account_server.py serve --host 0.0.0.0 --port "$PORT" --allow-registration
```

Render’s free service sleeps after 15 minutes without traffic. The first sign-in or registration after idle can take about a minute. The desktop app waits for the account service before sending the signup or login request. Check the free-tier limits before distributing your release. [Render free hosting limits](https://render.com/docs/free) · [Neon pricing](https://neon.com/pricing)

### Put the service address into your installers

1. Open `account-service.json` at the project root. Set `server` to your real public Render HTTPS URL.

   ```json
   {"server": "https://your-productivity-service.onrender.com"}
   ```

2. Rebuild the installers and ZIP using the commands in [README.md](README.md). You can commit this JSON file because it contains the public HTTPS address. Store the Neon connection string and database password in Render.
3. Test an installer with a fresh desktop profile. The app should open its sign-in dialog with **Create an account** and fields for username and password. Use **Use local data** to open the local workspace.

An empty `server` string lets the app run locally and keeps manual server setup available in **Settings → Account**.
