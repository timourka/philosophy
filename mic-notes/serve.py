from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import mimetypes

ROOT = Path(__file__).resolve().parent
mimetypes.add_type('text/javascript', '.mjs')
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8766), partial(Handler, directory=str(ROOT)))
    print('Mic notes: http://127.0.0.1:8766', flush=True)
    server.serve_forever()
