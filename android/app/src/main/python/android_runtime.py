"""Keep a private Productivity session alive for the Android app process."""

from contextlib import ExitStack
from pathlib import Path
from threading import Lock

from desktop_server import desktop_session, issue_window_url


_session = ExitStack()
_server = None
_lock = Lock()


def new_window(data_path):
    """Return a one-use URL for a new WebView in the current app process."""
    global _server
    with _lock:
        if _server is None:
            _server, url = _session.enter_context(desktop_session(Path(data_path), port=0))
            return url
        return issue_window_url(_server)
