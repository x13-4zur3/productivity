"""Build the Linux packages or the macOS disk image for Productivity."""

import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import shutil
import subprocess
import tarfile
from tempfile import TemporaryDirectory
from urllib.parse import quote
from urllib.request import urlretrieve
from zipfile import ZipFile


PACKAGING = Path(__file__).resolve().parent
ROOT = PACKAGING.parent
VERSION = '1.0.0'
APP_FILES = ('app.py', 'desktop_server.py', 'desktop_accounts.py', 'account-service.json',
             'import_browser_data.py', 'README.md', 'ACCOUNTS.md', 'LICENSE')
PYTHON_BUILD = '20261124'
PYTHON_VERSION = '3.13.18'
RUNTIMES = {
    'aarch64': '296f0903cccda15a5c9d3d8393cd2204718aeffd9b095a00f812d75c7b1c0967',
    'x86_64': 'bb16e167ec9e38368118ce3e43ba2c7852fea2cdba16e1852555a8997747f78a',
}


def stage_app(destination):
    destination.mkdir(parents=True)
    for name in APP_FILES:
        shutil.copyfile(ROOT / name, destination / name)
    shutil.copyfile(PACKAGING / 'desktop_unix.py', destination / 'desktop_unix.py')
    shutil.copytree(ROOT / 'static', destination / 'static')
    for path in (destination, *destination.rglob('*')):
        path.chmod(0o755 if path.is_dir() else 0o644)


def write_text(path, content, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
    path.chmod(mode)


def build_linux(work, output):
    package = work / 'deb'
    app = package / 'usr' / 'lib' / 'productivity'
    stage_app(app)
    write_text(app / 'productivity', (PACKAGING / 'linux' / 'productivity').read_text(), 0o755)
    write_text(package / 'usr' / 'bin' / 'productivity',
               '#!/bin/sh\nexec /usr/bin/python3 /usr/lib/productivity/desktop_unix.py "$@"\n', 0o755)
    desktop_file = 'org.productivity.Productivity.desktop'
    write_text(package / 'usr' / 'share' / 'applications' / desktop_file,
               (PACKAGING / 'linux' / desktop_file).read_text())
    write_text(package / 'DEBIAN' / 'control', f'''Package: productivity
Version: {VERSION}
Section: utils
Priority: optional
Architecture: all
Depends: python3 (>= 3.10), python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1 | gir1.2-webkit2-4.0, ca-certificates
Maintainer: Productivity contributors
Description: Local journal and to-do list
 Productivity is a desktop app for journaling, planning tasks and focusing.
 Data is stored on your computer in SQLite.
''')
    for path in (package, *package.rglob('*')):
        if path.is_dir():
            path.chmod(0o755)
    subprocess.run(['dpkg-deb', '--root-owner-group', '--build', str(package),
                    str(output / f'productivity_{VERSION}_all.deb')], check=True)
    with tarfile.open(output / 'Productivity-Linux.tar.gz', 'w:gz') as archive:
        archive.add(app, 'Productivity')


def add_runtime(architecture, checksum, destination, cache):
    archive = cache / f'python-{architecture}.tar.gz'
    if not archive.exists():
        asset = f'cpython-{PYTHON_VERSION}+{PYTHON_BUILD}-{architecture}-apple-darwin-install_only_stripped.tar.gz'
        urlretrieve(f'https://github.com/astral-sh/python-build-standalone/releases/download/'
                    f'{PYTHON_BUILD}/{quote(asset)}', archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
        raise ValueError(f'Python runtime checksum did not match for {architecture}.')
    with tarfile.open(archive) as runtime:
        runtime.extractall(destination, filter='data')


def stage_macos_dependencies(packages, cache):
    wheels = json.loads((PACKAGING / 'macos' / 'desktop-dependencies.json').read_text(encoding='utf-8'))
    shared = json.loads((PACKAGING / 'windows' / 'desktop-dependencies.json').read_text(encoding='utf-8'))
    wheels.extend(entry for entry in shared if entry['filename'].startswith(
        ('bottle-', 'certifi-', 'proxy_tools-', 'pywebview-', 'typing_extensions-')))
    for entry in wheels:
        archive = cache / entry['filename']
        if not archive.is_file():
            with TemporaryDirectory(dir=cache) as temp:
                staged = Path(temp) / archive.name
                urlretrieve(entry['url'], staged)
                if hashlib.sha256(staged.read_bytes()).hexdigest() != entry['sha256']:
                    raise ValueError(f'Checksum does not match for {archive.name}.')
                staged.replace(archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError(f'Checksum does not match for {archive.name}.')
        if archive.suffix == '.whl':
            with ZipFile(archive) as wheel:
                wheel.extractall(packages, [name for name in wheel.namelist()
                                            if not name.split('/')[0].endswith('.data')])
        else:
            with tarfile.open(archive) as source:
                for name in ('proxy_tools/__init__.py', 'proxy_tools.egg-info/PKG-INFO'):
                    with source.extractfile(f'proxy_tools-0.1.0/{name}') as content:
                        destination = packages / name
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(content.read())


def build_macos(work, output, cache, go):
    bundle = work / 'Productivity.app'
    contents = bundle / 'Contents'
    resources = contents / 'Resources'
    stage_app(resources / 'app')
    write_text(contents / 'MacOS' / 'Productivity', (PACKAGING / 'macos' / 'Productivity').read_text(), 0o755)
    plist = contents / 'Info.plist'
    with plist.open('wb') as output_plist:
        plistlib.dump({
            'CFBundleName': 'Productivity', 'CFBundleDisplayName': 'Productivity',
            'CFBundleExecutable': 'Productivity', 'CFBundleIdentifier': 'io.github.x13-4zur3.productivity',
            'CFBundleInfoDictionaryVersion': '6.0', 'CFBundlePackageType': 'APPL',
            'CFBundleShortVersionString': VERSION, 'CFBundleVersion': VERSION,
            'LSMinimumSystemVersion': '11.0', 'NSHighResolutionCapable': True,
            'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True},
        }, output_plist)
    plist.chmod(0o644)
    with TemporaryDirectory(dir=work, prefix='desktop-packages-') as temp:
        stage_macos_dependencies(Path(temp), cache)
        for architecture, checksum in RUNTIMES.items():
            with TemporaryDirectory(dir=work, prefix='runtime-') as runtime_temp:
                add_runtime(architecture, checksum, Path(runtime_temp), cache)
                runtime = resources / f'runtime-{architecture}'
                shutil.move(Path(runtime_temp) / 'python', runtime)
                shutil.copytree(temp, runtime / 'lib' / 'python3.13' / 'site-packages', dirs_exist_ok=True)
    for directory in (bundle, contents, contents / 'MacOS', resources):
        directory.chmod(0o755)
    subprocess.run([go, 'run', '.', str(bundle), str(output / 'Productivity-macOS.dmg')],
                   cwd=PACKAGING / 'macos' / 'dmg', check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('platform', choices=('linux', 'macos'))
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--runtime-cache', type=Path)
    parser.add_argument('--go', default='go')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='productivity-build-') as directory:
        work = Path(directory)
        if args.platform == 'linux':
            build_linux(work, output)
        else:
            cache = args.runtime_cache or work
            cache.mkdir(parents=True, exist_ok=True)
            build_macos(work, output, cache, args.go)
    print(f'Packages written to {output}')


if __name__ == '__main__':
    main()
