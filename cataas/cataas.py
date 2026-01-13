import http.server
import ssl
import random
import urllib.parse
import urllib.request
import json
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

# Config
IMAGE_DIR = "images"  # Folder containing images (supports .jpg and .png)
HOST = 'localhost'
PORT = 4443
CERT_FILE = 'cert.pem'
KEY_FILE = 'key.pem'

# Preload image paths (sorted for deterministic ordering)
base = Path(IMAGE_DIR)
image_paths = sorted(
    list(base.rglob("*.jpg", case_sensitive=False)) + list(base.rglob("*.png", case_sensitive=False)) + list(base.rglob("*.jpeg", case_sensitive=False)) + list(base.rglob("*.gif", case_sensitive=False))
)

if not image_paths:
    raise RuntimeError(f"No image files found in {IMAGE_DIR}")

def get_gps_coordinates(image_path):
    """Extract GPS coordinates from image EXIF data if available.
    Returns a tuple of (latitude, longitude) or None if not available."""
    try:
        image = Image.open(image_path)
        exifdata = image.getexif()

        if not exifdata:
            return None

        # Get GPS IFD (Image File Directory) - 0x8825 is the GPS IFD tag
        gps_ifd = exifdata.get_ifd(0x8825)

        if not gps_ifd:
            return None

        # Convert GPS IFD to dictionary with tag names
        gps_info = {}
        for tag_id, value in gps_ifd.items():
            tag = GPSTAGS.get(tag_id, tag_id)
            gps_info[tag] = value

        if not gps_info:
            return None

        # Extract latitude
        if 'GPSLatitude' not in gps_info or 'GPSLatitudeRef' not in gps_info:
            return None

        lat = gps_info['GPSLatitude']
        lat_ref = gps_info['GPSLatitudeRef']

        # Extract longitude
        if 'GPSLongitude' not in gps_info or 'GPSLongitudeRef' not in gps_info:
            return None

        lon = gps_info['GPSLongitude']
        lon_ref = gps_info['GPSLongitudeRef']

        # Convert to decimal degrees
        def to_decimal(coord):
            # coord is typically (degrees, minutes, seconds) as rationals
            degrees = float(coord[0])
            minutes = float(coord[1])
            seconds = float(coord[2])
            return degrees + (minutes / 60.0) + (seconds / 3600.0)

        latitude = to_decimal(lat)
        if lat_ref == 'S':
            latitude = -latitude

        longitude = to_decimal(lon)
        if lon_ref == 'W':
            longitude = -longitude

        return (latitude, longitude)

    except Exception as e:
        # If any error occurs during EXIF reading, just return None
        return None

def get_date_taken(image_path):
    """Extract date taken from image EXIF data if available.
    Returns a date string or None if not available."""
    try:
        image = Image.open(image_path)
        exifdata = image.getexif()

        if not exifdata:
            return None

        # Try to get DateTimeOriginal (tag 36867) first, then DateTime (tag 306)
        # DateTimeOriginal is when the photo was taken
        # DateTime is when the file was last modified
        date_taken = None

        # Check main EXIF IFD for DateTimeOriginal (0x9003)
        exif_ifd = exifdata.get_ifd(0x8769)  # EXIF IFD
        if exif_ifd:
            date_taken = exif_ifd.get(0x9003)  # DateTimeOriginal

        # Fallback to DateTime in main IFD
        if not date_taken:
            date_taken = exifdata.get(306)  # DateTime tag

        if date_taken:
            # EXIF date format is "YYYY:MM:DD HH:MM:SS"
            # Convert to more readable format "YYYY-MM-DD HH:MM:SS"
            return date_taken.replace(':', '-', 2)

        return None

    except Exception as e:
        # If any error occurs during EXIF reading, just return None
        return None

def get_location_name(latitude, longitude):
    """Reverse geocode coordinates to get location name using OpenStreetMap Nominatim.
    Returns a string with city/area name or None if not available."""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={latitude}&lon={longitude}&format=json&zoom=10"
        req = urllib.request.Request(url, headers={'User-Agent': 'CatImageServer/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))

            address = data.get('address', {})
            # Try to get the most relevant location name
            # Priority: city > town > village > municipality > county > state > country
            for key in ['city', 'town', 'village', 'municipality', 'county', 'state', 'country']:
                if key in address:
                    location = address[key]
                    # Add country if different from main location
                    country = address.get('country', '')
                    if country and key != 'country':
                        return f"{location}, {country}"
                    return location

            # Fallback to display_name if no specific location found
            display_name = data.get('display_name', '')
            if display_name:
                # Return first two parts of the display name
                parts = display_name.split(', ')
                return ', '.join(parts[:2]) if len(parts) > 1 else parts[0]

            return None
    except Exception as e:
        # If reverse geocoding fails, just return None
        return None

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


            self.log_message("serving %s", selected)

            # Extract GPS coordinates and date if available
            gps_coords = get_gps_coordinates(selected)
            date_taken = get_date_taken(selected)

            self.send_response(200)
            content_type = "image/png" if selected.suffix.lower() == ".png" else "image/jpeg"
            self.send_header("Content-type", content_type)
            self.send_header("X-Filename", selected)

            # Add GPS coordinates header if available
            exposed_headers = 'X-Filename'
            if gps_coords:
                lat, lon = gps_coords
                self.send_header("X-Geo-Location", f"{lat:.6f},{lon:.6f}")
                exposed_headers += ', X-Geo-Location'
                self.log_message("GPS coordinates: %f, %f", lat, lon)

                # Reverse geocode to get location name
                location_name = get_location_name(lat, lon)
                if location_name:
                    self.send_header("X-Location-Name", location_name)
                    exposed_headers += ', X-Location-Name'
                    self.log_message("Location: %s", location_name)

            # Add date taken header if available
            if date_taken:
                self.send_header("X-Date-Taken", date_taken)
                exposed_headers += ', X-Date-Taken'
                self.log_message("Date taken: %s", date_taken)

            self.send_header("Access-Control-Allow-Origin", self.headers['Origin'])
            self.send_header("Access-Control-Expose-Headers", exposed_headers)
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

