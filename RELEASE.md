# Publish Productivity 1.0.0 on GitHub

## Commit the source

Open a terminal in the extracted `Productivity` folder. Stage just these source files, build files, and documentation. A public HTTPS address in `account-service.json` can be committed.

```sh
git add .gitignore LICENSE README.md ACCOUNTS.md RELEASE.md SIGNING.md app.py desktop_accounts.py desktop_server.py import_browser_data.py account_server.py account_schema.sql requirements-server.txt account-service.json render.yaml static packaging
git commit -m "Prepare Productivity 1.0.0"
```

Keep `dist/`, generated installers and ZIP files, virtual environments, caches, SQLite databases, journal exports, developer credentials, database connection strings, and signing private keys outside Git history. Set `PRODUCTIVITY_DATABASE_URL` in Render. The project archive contains the source and build recipes so you can rebuild the binaries after setting your public service address.

## Attach binaries to GitHub Releases

1. Configure the Render HTTPS address in `account-service.json`, commit the change, and push the source to your GitHub repository.
2. Build for each platform using [README.md](README.md). Follow [SIGNING.md](SIGNING.md) to sign the distribution files and notarize the macOS image before public distribution.
3. On GitHub, go to **Releases → Draft a new release**. Choose or create tag `v1.0.0` on the commit matching your release binaries. Use `Productivity 1.0.0` as the title.
4. Attach the files people will install or download. Use the signed variants where you have signed them.

   | Release asset | Use |
   | --- | --- |
   | `Productivity-Setup-x64.exe` | Windows x64 installer |
   | `Productivity-macOS.dmg` | macOS disk image for Apple silicon and Intel |
   | `productivity_1.0.0_all.deb` | Debian and Ubuntu package |
   | `Productivity-Linux.tar.gz` | Portable Linux archive |
   | `Productivity-1.0.0.zip` | Complete bundle with source, guides, and installers |

   GitHub also creates source ZIP and tar archives from the tag. Attach your built files before publishing the release. [GitHub Releases documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

If you previously installed a 1.2.0 or 1.3.0 build on Debian or Ubuntu, APT treats the public 1.0.0 package as a downgrade.

## Use GitHub Packages for registry artifacts

The desktop installers, Linux packages, and distribution ZIP above all go in **Releases**. GitHub Packages is optional for Productivity. If you later build the account service into a Docker or OCI image, you can publish that image to GitHub Container Registry. [GitHub Packages registries](https://docs.github.com/en/packages/learn-github-packages/introduction-to-github-packages)
