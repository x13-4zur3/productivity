"""Build the Windows x64 installer with NSIS 3.11 or newer."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from tarfile import open as open_tar
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve
from zipfile import ZipFile


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VERSION = '3.13.12'
ARCHIVE = f'python-{VERSION}-embed-amd64.zip'
CHECKSUM = '76f238f606250c87c6beac75dccd35ee99070a13490555936abb6cb64ecce3d0'


def locate_compiler(requested):
    compiler = shutil.which(requested or 'makensis')
    if compiler:
        return compiler
    if requested is not None:
        raise FileNotFoundError(f'Could not find the NSIS compiler at {requested!r}. Check the --makensis path.')
    if os.name == 'nt':
        for variable in ('ProgramFiles(x86)', 'ProgramFiles'):
            directory = os.environ.get(variable)
            if directory:
                compiler = Path(directory) / 'NSIS' / 'makensis.exe'
                if compiler.is_file():
                    return str(compiler)
    raise FileNotFoundError('Could not find makensis. Install NSIS 3.11 or newer, '
                            'then add it to PATH or pass --makensis with the executable path.')


def verified_file(entry, cache):
    path = cache / entry['filename']
    if not path.is_file():
        with TemporaryDirectory(dir=cache) as temp:
            staged = Path(temp) / path.name
            urlretrieve(entry['url'], staged)
            verify(staged, entry['sha256'])
            staged.replace(path)
    else:
        verify(path, entry['sha256'])
    return path


def verify(path, expected):
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f'The checksum does not match for {path.name}.')


def bundle_desktop(payload, runtime, cache):
    packages = runtime / 'desktop-packages'
    for entry in json.loads((HERE / 'desktop-dependencies.json').read_text(encoding='utf-8')):
        archive = verified_file(entry, cache)
        if archive.suffix == '.whl':
            with ZipFile(archive) as wheel:
                wheel.extractall(packages, [name for name in wheel.namelist()
                                            if not name.split('/')[0].endswith('.data')])
        elif archive.name == 'proxy_tools-0.1.0.tar.gz':
            with open_tar(archive) as source:
                for name in ('proxy_tools/__init__.py', 'proxy_tools.egg-info/PKG-INFO'):
                    with source.extractfile(f'proxy_tools-0.1.0/{name}') as content:
                        destination = packages / name
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(content.read())
        elif archive.name == 'MicrosoftEdgeWebview2Setup.exe':
            shutil.copy2(archive, payload)
        else:
            raise ValueError(f'Unknown desktop dependency: {archive.name}')


def build(compiler, target, archive, desktop_cache):
    compiler = locate_compiler(compiler)
    with TemporaryDirectory(prefix='productivity-setup-') as directory:
        payload = Path(directory) / 'payload'
        runtime = payload / 'runtime'
        runtime.mkdir(parents=True)
        if archive is None:
            archive = Path(directory) / ARCHIVE
            urlretrieve(f'https://www.python.org/ftp/python/{VERSION}/{ARCHIVE}', archive)
        verify(archive, CHECKSUM)
        with ZipFile(archive) as source:
            source.extractall(runtime)
        with (runtime / 'python313._pth').open('a', encoding='ascii') as paths:
            paths.write('\n..\ndesktop-packages\n')
        cache = desktop_cache or Path(directory)
        cache.mkdir(parents=True, exist_ok=True)
        bundle_desktop(payload, runtime, cache)
        for name in ('app.py', 'desktop_server.py', 'desktop_accounts.py', 'account-service.json',
                     'import_browser_data.py', 'README.md', 'ACCOUNTS.md', 'LICENSE'):
            shutil.copy2(ROOT / name, payload)
        shutil.copy2(HERE / 'windows_launcher.py', payload)
        shutil.copytree(ROOT / 'static', payload / 'static')
        target.parent.mkdir(parents=True, exist_ok=True)
        prefix = '/' if os.name == 'nt' else '-'
        subprocess.run([compiler, f'{prefix}DPAYLOAD={payload}', f'{prefix}DOUTPUT={target}',
                        str(HERE / 'Productivity.nsi')], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--makensis', help='Path to the NSIS compiler. Defaults to PATH or a standard NSIS installation.')
    parser.add_argument('--python-archive', type=Path)
    parser.add_argument('--desktop-cache', type=Path, help='Reuse previously downloaded desktop dependencies.')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / 'Productivity-Setup-x64.exe')
    args = parser.parse_args()
    try:
        build(args.makensis, args.output.resolve(), args.python_archive, args.desktop_cache)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Build failed: {error}\n')
    print(f'Installer written to {args.output.resolve()}')


if __name__ == '__main__':
    main()
