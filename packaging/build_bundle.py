"""Bundle the Productivity source and installers in one ZIP."""

import argparse
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

from build_unix import VERSION


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
SOURCE = (
    '.gitignore', 'LICENSE', 'README.md', 'SIGNING.md', 'app.py', 'desktop_server.py', 'import_browser_data.py',
    'ACCOUNTS.md', 'RELEASE.md', 'render.yaml', 'account-service.json', 'account_server.py', 'account_schema.sql',
    'requirements-server.txt', 'desktop_accounts.py',
    'static/index.html', 'static/app.js', 'static/accounts.js', 'static/settings.js', 'static/style.css',
    'packaging/build_bundle.py', 'packaging/build_unix.py', 'packaging/desktop_unix.py',
    'packaging/linux/org.productivity.Productivity.desktop', 'packaging/linux/productivity',
    'packaging/macos/Productivity', 'packaging/macos/launcher.c', 'packaging/macos/sign-and-notarize.sh',
    'packaging/macos/desktop-dependencies.json',
    'packaging/macos/dmg/go.mod', 'packaging/macos/dmg/go.sum',
    'packaging/macos/dmg/main.go', 'packaging/windows/build.py', 'packaging/windows/Productivity.nsi',
    'packaging/windows/windows_launcher.py', 'packaging/windows/desktop-dependencies.json',
    'packaging/windows/productivity.ico',
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DIST / f'Productivity-{VERSION}.zip')
    parser.add_argument('--macos-dmg', type=Path, default=DIST / 'Productivity-macOS.dmg')
    parser.add_argument('--windows-setup', type=Path, default=DIST / 'Productivity-Setup-x64.exe')
    parser.add_argument('--deb-signature', type=Path)
    parser.add_argument('--portable-signature', type=Path)
    args = parser.parse_args()
    deb_name = f'productivity_{VERSION}_all.deb'
    files = {name: ROOT / name for name in SOURCE}
    files.update({
        'dist/Productivity-macOS.dmg': args.macos_dmg,
        'dist/Productivity-Setup-x64.exe': args.windows_setup,
        f'dist/{deb_name}': DIST / deb_name,
        'dist/Productivity-Linux.tar.gz': DIST / 'Productivity-Linux.tar.gz',
    })
    if args.deb_signature is not None:
        files[f'dist/{deb_name}.asc'] = args.deb_signature
    if args.portable_signature is not None:
        files['dist/Productivity-Linux.tar.gz.asc'] = args.portable_signature
    for path in files.values():
        if not path.is_file():
            parser.error(f'Missing file: {path}')
        if path.resolve() == args.output.resolve():
            parser.error(f'Output must be separate from {path}.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='.productivity-', dir=args.output.parent) as temp:
        staged = Path(temp) / args.output.name
        with ZipFile(staged, 'w', compression=ZIP_DEFLATED) as bundle:
            for name, path in files.items():
                compression = ZIP_STORED if name.startswith('dist/') else ZIP_DEFLATED
                bundle.write(path, f'Productivity/{name}', compress_type=compression)
        staged.replace(args.output)
    print(f'ZIP written to {args.output.resolve()}')


if __name__ == '__main__':
    main()
