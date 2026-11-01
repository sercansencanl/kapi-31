"""Kapı 31 yerel sunucusu: önbelleği kapatır, böylece tarayıcı her zaman son dosyaları yükler."""
import functools
import http.server
import os
import webbrowser

PORT = 8000


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


root = os.path.dirname(os.path.abspath(__file__))
server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(NoCache, directory=root))
print(f'Kapı 31 çalışıyor: http://localhost:{PORT}  (kapatmak için bu pencereyi kapat)')
webbrowser.open(f'http://localhost:{PORT}')
server.serve_forever()
