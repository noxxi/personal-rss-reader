# nginx Configuration for RSS Reader

Cookie-based authentication using nginx and a login server (runs in the same container as the RSS reader).

## Architecture

1. **nginx** validates the `auth` cookie using native `map` directive (no external modules)
2. **Login server** handles `/login` and `/logout` endpoints (runs alongside RSS reader in same container)
3. Requests without valid cookie are redirected to `/login`

## Setup

### 1. Create Login Configuration

Create a `login.json` file in your data directory with the following structure:

```json
{
    "username": "admin",
    "passwordHash": "<sha256-hash-of-password>",
    "cookieSecret": "<64-char-hex-string>",
    "cookieMaxAgeDays": 30
}
```

Generate the values:
```bash
# Generate cookie secret (64-char hex string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate password hash
node -e "console.log(require('crypto').createHash('sha256').update('yourpassword').digest('hex'))"
```

Configuration fields:
- `username` - login username (default: "admin")
- `passwordHash` - SHA-256 hash of password (required)
- `cookieSecret` - secret token for cookie validation (required)
- `cookieMaxAgeDays` - cookie lifetime in days (default: 30)

### 2. Build and Run Container

Build the Docker image from the repository root:
```bash
docker build -t rss-reader .
```

Run the container (both RSS reader and login server start automatically):
```bash
docker run -d \
  --name rss-reader \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -p 127.0.0.1:3001:3001 \
  -v /path/to/data:/app/data \
  -v /path/to/favicons:/app/favicons \
  rss-reader
```

The login server reads its configuration from `/app/data/login.json` (mounted via the data volume).

### 3. Configure nginx

1. Copy `nginx.conf` to your nginx configuration directory
2. Replace `YOUR-COOKIE-SECRET-HERE` with the same `cookieSecret` value from `login.json`
3. Update `server_name` and SSL certificate paths as needed
4. Reload nginx: `sudo nginx -s reload`

## Usage

1. Access the RSS reader URL - you'll be redirected to `/login`
2. Enter username and password
3. On success, an `auth` cookie is set and you're redirected to the app
4. Access `/logout` to clear the cookie and log out

## Container Management

```bash
# View logs
docker logs rss-reader

# View login server logs specifically
docker logs rss-reader 2>&1 | grep -i login

# Stop
docker stop rss-reader

# Start
docker start rss-reader

# Restart with new config
docker rm -f rss-reader
docker run -d ... (see above)
```

## Security Notes

- Cookie has `HttpOnly`, `Secure`, and `SameSite=Strict` flags
- Password stored as SHA-256 hash
- The same secret must be in both nginx config and `login.json`
- Keep `login.json` secure (readable only by the container)
- Consider adding rate limiting for `/login` endpoint:
  ```nginx
  limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

  location /login {
      limit_req zone=login burst=3 nodelay;
      # ... rest of config
  }
  ```
