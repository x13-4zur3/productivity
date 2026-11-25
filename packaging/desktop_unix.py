"""Open Productivity on macOS or Linux."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import sys
from threading import Event, Thread
import time
from urllib.request import Request

launcher_directory = Path(__file__).resolve().parent
if not (launcher_directory / 'app.py').is_file():
    sys.path.insert(0, str(launcher_directory.parent))

from desktop_server import ACTIVATE_PATH, APP_ID, READY_PATH, STOP_PATH, data_directory, desktop_session, local_client, url_for


def try_lock(lock):
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return False
    return True


def contact_running(lock, info_path, stop):
    client = local_client()
    for _ in range(35):
        try:
            info = json.loads(info_path.read_text(encoding='utf-8'))
            port, token = info['port'], info['token']
            if type(port) is not int or not 1 <= port <= 65535 or not isinstance(token, str):
                raise ValueError
            url = url_for(port)
            with client.open(url + READY_PATH, timeout=0.3) as response:
                if response.headers.get('X-Productivity-App') == APP_ID:
                    break
        except (OSError, KeyError, TypeError, ValueError):
            pass
        time.sleep(0.12)
    else:
        raise RuntimeError('Productivity is already starting. Try again in a few seconds.')

    request = Request(url + (STOP_PATH if stop else ACTIVATE_PATH), method='POST',
                      headers={'X-Productivity-Stop': token})
    with client.open(request, timeout=3) as response:
        response.read()
    if stop:
        for _ in range(50):
            if try_lock(lock):
                return
            time.sleep(0.1)
        raise RuntimeError('Productivity is still closing.')


def show_linux(server, url):
    try:
        import gi

        gi.require_version('Gtk', '3.0')
        try:
            gi.require_version('WebKit2', '4.1')
        except ValueError:
            gi.require_version('WebKit2', '4.0')
        from gi.repository import GLib, Gtk, WebKit2
    except (ImportError, ValueError) as error:
        raise RuntimeError('Install GTK 3 and WebKitGTK with Python GObject bindings to open Productivity.') from error

    if not Gtk.init_check()[0]:
        raise RuntimeError('Open Productivity from a graphical desktop session.')
    window = Gtk.Window(title='Productivity')
    window.set_default_size(1200, 810)
    window.set_size_request(400, 520)
    view = WebKit2.WebView.new_with_context(WebKit2.WebContext.new_ephemeral())
    view.get_settings().set_javascript_can_open_windows_automatically(False)
    window.add(view)
    window.connect('destroy', Gtk.main_quit)
    view.load_uri(url)
    window.show_all()

    def check_requests():
        if server.stop_requested.is_set():
            window.destroy()
            return False
        if server.activate_requested.is_set():
            server.activate_requested.clear()
            window.present()
        return True

    source = GLib.timeout_add(100, check_requests)
    try:
        Gtk.main()
    finally:
        if GLib.MainContext.default().find_source_by_id(source) is not None:
            GLib.source_remove(source)


def show_macos(server, directory, url):
    try:
        import webview
        from webview.guilib import initialize
        initialize('cocoa')
    except Exception as error:
        raise RuntimeError('The window requires WebKit and the macOS desktop dependencies.') from error

    webview.settings['OPEN_EXTERNAL_LINKS_IN_BROWSER'] = False
    window = webview.create_window('Productivity', url, width=1200, height=810,
                                   min_size=(400, 520), text_select=True, zoomable=True,
                                   background_color='#f7f8fc')
    finished = Event()

    def check_requests():
        while not finished.wait(0.1):
            if not window.events.shown.is_set():
                continue
            if server.stop_requested.is_set():
                if not window.events.closed.is_set():
                    window.destroy()
                return
            if server.activate_requested.is_set():
                server.activate_requested.clear()
                window.show()

    monitor = Thread(target=check_requests)
    monitor.start()
    try:
        webview.start(gui='cocoa', private_mode=False, storage_path=str(directory / 'DesktopProfile'))
    finally:
        finished.set()
        monitor.join()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stop', action='store_true', help='Close the running Productivity window.')
    args = parser.parse_args()
    directory = data_directory()
    info_path = directory / 'instance.json'
    try:
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        with (directory / 'instance.lock').open('a+b') as lock:
            if not try_lock(lock):
                contact_running(lock, info_path, args.stop)
                return 0
            if args.stop:
                return 0
            with desktop_session(directory) as (server, url):
                fd = os.open(info_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                try:
                    with os.fdopen(fd, 'w', encoding='utf-8') as info:
                        json.dump({'port': server.server_port, 'token': server.control_token.decode('ascii')}, info)
                    if sys.platform == 'darwin':
                        show_macos(server, directory, url)
                    else:
                        show_linux(server, url)
                finally:
                    info_path.unlink(missing_ok=True)
    except (OSError, RuntimeError) as error:
        print(f'Productivity: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
