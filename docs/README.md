# Productivity documentation

The `docs/` directory contains the Markdown pages, the site theme, and the MkDocs configuration. Place `docs/` and `.readthedocs.yaml` in the root of `x13-4zur3/productivity`.

## Preview locally

From the repository root, run these commands in a Python virtual environment. On Windows, `py -3` can replace `python`.

```sh
python -m pip install -r docs/requirements.txt
python -m mkdocs serve -f docs/mkdocs.yml -a 127.0.0.1:8000
```

Open `http://127.0.0.1:8000/`. Before committing a change, run a strict build. The default output folder is `docs/site/`, which `docs/.gitignore` excludes.

```sh
python -m mkdocs build --strict -f docs/mkdocs.yml
```

## Host it on Read the Docs

1. Commit and push the root `.readthedocs.yaml` and the `docs/` directory to the GitHub repository.
2. Sign in to Read the Docs Community with GitHub and add the `x13-4zur3/productivity` project.
3. If you previously set a custom config path, open **Admin → Settings** and set **Build configuration file** to `.readthedocs.yaml`.
4. In **Versions**, build **latest** and open the completed build's documentation. `latest` follows the default branch, so it can include documentation added after the `v1.0.0` tag.

Read the Docs detects the root `.readthedocs.yaml` by default. Keep the `docs/` prefixes in its `requirements` and `configuration` values. [Read the Docs configuration reference](https://docs.readthedocs.com/platform/stable/config-file/v2.html)
