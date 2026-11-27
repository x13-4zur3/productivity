# Host the account service

A hosted account service keeps registrations and sign-ins available when your own PC is off. Productivity's desktop clients connect to the Python service over HTTPS. The service stores account workspaces in PostgreSQL.

## Deploy with Neon and Render

1. Create a `productivity` database in Neon and a dedicated PostgreSQL role for the application. Use the SQL and connection steps in the [account setup guide](https://github.com/x13-4zur3/productivity/blob/v1.0.0/ACCOUNTS.md#create-the-neon-database-and-service-role).
2. In Render, create a **Blueprint** connected to your GitHub repository. The current `render.yaml` starts the web app and account API with registration enabled. Put the Neon connection string in `PRODUCTIVITY_DATABASE_URL` and the public HTTPS service address in `PRODUCTIVITY_WEB_ORIGIN`.
3. Open the Render service's `/api/health` endpoint. Check for `"service":"productivity-accounts-v1"` and `"registration":true`.
4. In the project root, set `server` in `account-service.json` to the public HTTPS URL. Rebuild desktop installers so users can sign in without entering the address.

```json
{"server": "https://your-productivity-service.onrender.com"}
```

Keep database credentials in Render. The desktop config contains the public HTTPS address. To enable 1.1.0 features in signed-in workspaces, deploy the server from the same version as the desktop app. The server applies the PostgreSQL schema updates on startup.

## Manage the service yourself

The account server supports local PostgreSQL or a remotely managed database. Use the [full account service guide](https://github.com/x13-4zur3/productivity/blob/v1.0.0/ACCOUNTS.md) for initialization, manual user creation, password resets, HTTPS, and backups.

Use the start command for the service you want to run.

=== "Web app and desktop accounts"

    Set `PRODUCTIVITY_WEB_ORIGIN` to the public HTTPS address, such as `https://your-productivity-service.onrender.com`.

    ```bash
    python web_pwa.py serve --host 0.0.0.0 --port "$PORT" --allow-registration
    ```

=== "Desktop accounts only"

    ```bash
    python account_server.py serve --host 0.0.0.0 --port "$PORT" --allow-registration
    ```

The `--allow-registration` option enables self-signup in the desktop app. For an invite-only service, omit this option and create users with the `create-user` command.
