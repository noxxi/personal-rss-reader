import http.server
import ssl
import random
import urllib.parse
from pathlib import Path

# Config
IMAGE_DIR = "images"  # Folder containing images (supports .jpg and .png)
HOST = 'localhost'
PORT = 4443
CERT_FILE = 'cert.pem'
KEY_FILE = 'key.pem'

# Preload image paths (sorted for deterministic ordering)
image_paths = sorted(
    list(Path(IMAGE_DIR).rglob("*.jpg")) + list(Path(IMAGE_DIR).rglob("*.png"))
)

if not image_paths:
    raise RuntimeError(f"No image files found in {IMAGE_DIR}")

class RandomImageHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_url.query)
        idx_param = query.get("i", [None])[0]

        if parsed_url.path == "/":
            try:
                if idx_param is not None:
                    seed = int(idx_param)
                    rng = random.Random(seed)
                    selected = rng.choice(image_paths)
                else:
                    selected = random.choice(image_paths)
            except Exception as e:
                self.send_error(400, f"Bad request: {e}")
                return

            self.send_response(200)
            content_type = "image/jpeg" if selected.suffix.lower() == ".jpg" else "image/png"
            self.send_header("Content-type", content_type)
            self.end_headers()
            with open(selected, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404)

# Setup HTTPS server with modern SSLContext
httpd = http.server.HTTPServer((HOST, PORT), RandomImageHandler)
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)

print(f"Serving HTTPS on https://{HOST}:{PORT} with {len(image_paths)} image(s)")
httpd.serve_forever()

