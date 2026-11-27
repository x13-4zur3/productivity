"""Open Productivity in a Windows desktop window."""

import argparse
import ctypes
from ctypes import wintypes
from pathlib import Path
import sys
from threading import Event, Thread
import time
import traceback
from urllib.parse import urlsplit

launcher_directory = Path(__file__).resolve().parent
# The installer copies this file beside app.py. The source tree keeps it two levels deeper.
project_directory = launcher_directory if (launcher_directory / 'app.py').is_file() else launcher_directory.parent.parent
sys.path.insert(0, str(project_directory))

from desktop_server import data_directory, desktop_session


MUTEX = r'Local\Productivity.8032dbac.Instance'
STOP_EVENT = r'Local\Productivity.8032dbac.Stop'
ALREADY_EXISTS = 183
SYNCHRONIZE = 0x100000
EVENT_MODIFY_STATE = 2
WEBVIEW_HELP = 'Install or repair the Microsoft Edge WebView2 Runtime and reopen Productivity.'


def win_api(library, signatures):
    api = ctypes.WinDLL(library, use_last_error=True)
    for name, (result, *arguments) in signatures.items():
        method = getattr(api, name)
        method.restype = result
        method.argtypes = arguments
    return api


def kernel_api():
    return win_api('kernel32', {
        'CreateMutexW': (wintypes.HANDLE, wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR),
        'CreateEventW': (wintypes.HANDLE, wintypes.LPVOID, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR),
        'OpenEventW': (wintypes.HANDLE, wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR),
        'OpenProcess': (wintypes.HANDLE, wintypes.DWORD, wintypes.BOOL, wintypes.DWORD),
        'GetCurrentProcessId': (wintypes.DWORD,),
        'SetEvent': (wintypes.BOOL, wintypes.HANDLE),
        'WaitForSingleObject': (wintypes.DWORD, wintypes.HANDLE, wintypes.DWORD),
        'ReleaseMutex': (wintypes.BOOL, wintypes.HANDLE),
        'CloseHandle': (wintypes.BOOL, wintypes.HANDLE),
    })


def focus_window(pid):
    user = win_api('user32', {
        'FindWindowW': (wintypes.HWND, wintypes.LPCWSTR, wintypes.LPCWSTR),
        'GetWindowThreadProcessId': (wintypes.DWORD, wintypes.HWND, ctypes.POINTER(wintypes.DWORD)),
        'IsIconic': (wintypes.BOOL, wintypes.HWND),
        'ShowWindowAsync': (wintypes.BOOL, wintypes.HWND, ctypes.c_int),
        'SetForegroundWindow': (wintypes.BOOL, wintypes.HWND),
    })
    window = user.FindWindowW(None, 'Productivity')
    owner = wintypes.DWORD()
    if not window or not user.GetWindowThreadProcessId(window, ctypes.byref(owner)) or owner.value != pid:
        return False
    if user.IsIconic(window):
        user.ShowWindowAsync(window, 9)  # SW_RESTORE
    user.SetForegroundWindow(window)
    return True


def read_number(path):
    try:
        return int(path.read_text(encoding='ascii'))
    except (OSError, ValueError):
        return 0


def reopen(directory):
    for _ in range(30):
        pid = read_number(directory / 'pid.txt')
        if pid and focus_window(pid):
            return
        time.sleep(0.1)


def load_webview():
    import winreg

    try:
        import webview
    except ImportError as error:
        raise RuntimeError('The desktop window needs pywebview. Run the Productivity installer, or install '
                           'pywebview==6.2.1 in your Python environment.') from error

    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                            r'SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full') as key:
            if int(winreg.QueryValueEx(key, 'Release')[0]) < 528040:
                raise ValueError
    except (OSError, ValueError) as error:
        raise RuntimeError('The desktop window requires .NET Framework 4.8 or later. '
                           'Install it with Windows Update, then reopen Productivity.') from error

    try:
        from webview.guilib import initialize

        if initialize('edgechromium').renderer != 'edgechromium':
            raise RuntimeError(WEBVIEW_HELP)
    except RuntimeError:
        raise
    except Exception as error:
        raise RuntimeError(f'The desktop window could not start. {WEBVIEW_HELP}') from error
    return webview


def install_window_chrome(window, url):
    origin = urlsplit(url).netloc
    user = win_api('user32', {
        'GetWindowLongW': (wintypes.LONG, wintypes.HWND, ctypes.c_int),
        'SetWindowLongW': (wintypes.LONG, wintypes.HWND, ctypes.c_int, wintypes.LONG),
        'SetWindowPos': (wintypes.BOOL, wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                         ctypes.c_int, ctypes.c_int, wintypes.UINT),
        'IsZoomed': (wintypes.BOOL, wintypes.HWND),
    })
    hwnd = None

    def before_show():
        nonlocal hwnd
        from System.Windows.Forms import FormBorderStyle

        handle = window.native.Handle.ToInt64()
        style_index = -16  # GWL_STYLE
        # Retain system resize borders and window states around the custom caption.
        window_styles = 0x00040000 | 0x00080000 | 0x00020000 | 0x00010000
        ctypes.set_last_error(0)
        style = user.GetWindowLongW(handle, style_index)
        if style or not ctypes.get_last_error():
            ctypes.set_last_error(0)
            previous = user.SetWindowLongW(handle, style_index, style | window_styles)
            frame_changed = 0x0027  # FRAMECHANGED | NOZORDER | NOMOVE | NOSIZE
            if (previous or not ctypes.get_last_error()) and user.SetWindowPos(handle, None, 0, 0, 0, 0, frame_changed):
                hwnd = handle
                return
        window.native.FormBorderStyle = FormBorderStyle.Sizable

    def window_chrome(action):
        current = urlsplit(window.get_current_url() or '')
        if not hwnd or current.scheme != 'http' or current.netloc != origin:
            return None
        if action == 'close':
            window.destroy()
            return None
        if action == 'minimize':
            window.minimize()
        elif action == 'maximize':
            if user.IsZoomed(hwnd):
                window.restore()
            else:
                window.maximize()
        elif action != 'state':
            return None
        return {'maximized': bool(user.IsZoomed(hwnd))}

    window.events.before_show += before_show
    window.expose(window_chrome)


def show_desktop(api, stop_event, directory, url, custom_title=True):
    webview = load_webview()
    icon = launcher_directory / 'productivity.ico'
    window = webview.create_window('Productivity', url, width=1200, height=810,
                                   min_size=(400, 520), text_select=True, zoomable=True,
                                   frameless=custom_title, easy_drag=False, background_color='#f7f8fc')
    if custom_title:
        install_window_chrome(window, url)
    finished = Event()
    startup_failed = Event()

    def monitor_window():
        deadline = time.monotonic() + 30
        while not finished.is_set():
            stop_requested = api.WaitForSingleObject(stop_event, 120) == 0
            # WebView2 can fail asynchronously after the Windows frame appears.
            if time.monotonic() >= deadline and not window.events.loaded.is_set():
                startup_failed.set()
            if stop_requested or startup_failed.is_set():
                if window.events.shown.is_set() and not window.events.closed.is_set():
                    window.destroy()
                if window.events.shown.is_set() or finished.wait(0.12):
                    return

    monitor = Thread(target=monitor_window)
    monitor.start()
    try:
        webview.settings['OPEN_EXTERNAL_LINKS_IN_BROWSER'] = False
        webview.start(gui='edgechromium', private_mode=False,
                      storage_path=str(directory / 'DesktopProfile'), icon=str(icon))
    except Exception as error:
        raise RuntimeError(f'The desktop window could not start. {WEBVIEW_HELP}') from error
    finally:
        finished.set()
        monitor.join()
    if startup_failed.is_set() or not window.events.shown.is_set():
        raise RuntimeError(f'The desktop window could not load Productivity. {WEBVIEW_HELP}')


def stop(api, directory):
    event = api.OpenEventW(EVENT_MODIFY_STATE, False, STOP_EVENT)
    if not event:
        return
    process = None
    try:
        pid = read_number(directory / 'pid.txt')
        if pid:
            process = api.OpenProcess(SYNCHRONIZE, False, pid)
        if not api.SetEvent(event):
            raise ctypes.WinError(ctypes.get_last_error())
        if process and api.WaitForSingleObject(process, 10000) != 0:
            raise RuntimeError('Windows is still closing Productivity. Try again in a few seconds.')
    finally:
        if process:
            api.CloseHandle(process)
        api.CloseHandle(event)


def report_error(error, show_dialog):
    if show_dialog:
        ctypes.windll.user32.MessageBoxW(None, str(error), 'Productivity', 0x10)
    else:
        print(f'Productivity: {error}', file=sys.stderr)
        if error.__cause__ and sys.stderr is not None:
            traceback.print_exception(error.__cause__, file=sys.stderr)


def serve(api, directory, custom_title=True):
    ctypes.set_last_error(0)
    mutex = api.CreateMutexW(None, True, MUTEX)
    if not mutex:
        raise ctypes.WinError(ctypes.get_last_error())
    primary = ctypes.get_last_error() != ALREADY_EXISTS
    try:
        if not primary:
            reopen(directory)
            return
        directory.mkdir(parents=True, exist_ok=True)
        pid_path = directory / 'pid.txt'
        pid_path.write_text(str(api.GetCurrentProcessId()), encoding='ascii')
        event = api.CreateEventW(None, True, False, STOP_EVENT)
        try:
            if not event:
                raise ctypes.WinError(ctypes.get_last_error())
            with desktop_session(directory) as (server, url):
                (directory / 'port.txt').write_text(str(server.server_port), encoding='ascii')
                show_desktop(api, event, directory, url, custom_title)
        finally:
            if event:
                api.CloseHandle(event)
            pid_path.unlink(missing_ok=True)
    finally:
        if primary:
            api.ReleaseMutex(mutex)
        api.CloseHandle(mutex)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stop', action='store_true', help='Close the running Productivity window.')
    parser.add_argument('--system-title-bar', action='store_true', help='Use the standard Windows title bar.')
    args = parser.parse_args()
    try:
        api = kernel_api()
        directory = data_directory()
        if args.stop:
            stop(api, directory)
        else:
            serve(api, directory, custom_title=not args.system_title_bar)
    except (OSError, RuntimeError) as error:
        report_error(error, show_dialog=sys.stderr is None and not args.stop)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
