import functools
import http.server
import os
import socket
import socketserver
import webbrowser
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent
ENTRY = "index.html"


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def main():
    port = find_free_port()
    handler = functools.partial(QuietHandler, directory=str(ROOT))

    with socketserver.TCPServer(("127.0.0.1", port), handler) as server:
        url = f"http://127.0.0.1:{port}/{quote(ENTRY)}"
        print(f"BFMIDI webApp: {url}")
        if os.environ.get("BFMIDI_WEBAPP_OPEN", "1") != "0":
            webbrowser.open(url)
        server.serve_forever()


if __name__ == "__main__":
    main()
