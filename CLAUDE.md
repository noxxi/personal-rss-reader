# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal web-based RSS reader with full keyboard control. Built with TypeScript (client and server), Express.js, SQLite database. Designed for fast, efficient feed reading with keyboard shortcuts, duplicate detection across feeds, and displays a cat picture when all items are read.

## Build and Development Commands

### Initial Setup
```bash
# Install dependencies and compile both client and server
(cd server && npm i && tsc)
(cd client && npm i && tsc && npx webpack)
```

### Starting the Server
```bash
# Start server (requires --insecure-http-parser for feeds with invalid HTTP headers)
(cd server && node --insecure-http-parser server.js)

# Or use the provided script
./start-server.sh
```

Server runs on http://localhost:3000/

### Compilation
```bash
# Compile server TypeScript
(cd server && tsc)

# Compile client TypeScript and bundle with webpack
(cd client && tsc && npx webpack)
```

### Command Line Tools
```bash
# Add feeds
(cd server && node addfeed.js <feed-url> [feed-url...])

# Delete feeds
(cd server && node delfeed.js <feed-url> [feed-url...])

# Force update all feeds immediately
(cd server && node updfeed.js)

# Delete old items
(cd server && node delolditems.js)
```

### Cat Picture Server (Optional)
```bash
# Install dependencies
pip install Pillow reverse_geocoder

# Run the custom cat picture server with GPS extraction and offline location names
cd cataas && python cataas.py
```

Server runs on https://localhost:4443/

Configure client to use custom server: `localStorage.setItem("cataas", "https://localhost:4443/")`

## Architecture

### Overall Structure

- **server/** - Express.js backend with TypeScript
- **client/** - Frontend SPA with TypeScript, bundled with webpack
- **cataas/** - Python HTTPS server that serves random cat images with GPS metadata
- **webext-background-tab/** - Optional browser extension for background tab opening
- **nginx/** - Basic auth configuration for reverse proxy deployment

### Server Architecture (server/)

**server.ts** - Main Express application
- Serves static files from `../client`
- REST API endpoints under `/api/`
- Auto-updates feeds every 5 seconds via timer
- Listens on port 3000

**db.ts** - Database layer (SQLite)
- Tables: feeds, items, icons, read
- Wraps sqlite3 in Promise-based API
- Handles feed CRUD, item CRUD, read/unread marking, favicon storage

**rss.ts** - RSS feed logic
- Uses `rss-parser` to fetch and parse feeds
- Implements adaptive update intervals (1-10 minutes) with exponential backoff
- Sanitizes HTML content with `sanitize-html`
- Deduplicates items by URL across feeds
- Fetches and caches favicons via Google's favicon service or local override files in `server/favicons/`

**types.ts** - Shared TypeScript type definitions
- Feed, FeedItem, XFeed, XFeedItem, ItemFilter, Icon types

Command line tools (**addfeed.ts**, **delfeed.ts**, **updfeed.ts**, **delolditems.ts**) provide CLI access to feed management.

### Client Architecture (client/src/)

**app.ts** - Entry point, initializes dialog polyfill and calls main.init()

**main.ts** - SPA router and initialization
- Hash-based routing (#/items, #/feeds)
- Keyboard event handling setup

**items.ts** - ItemView (main reading interface)
- Displays feed items with keyboard navigation
- Mark read/unread, toggle details, preserve items
- Shows cat picture when all items read (via cataas.ts)

**feeds.ts** - FeedView (feed management)
- Lists all feeds with unread/total counts
- Add/edit/delete feeds
- Filter feeds by search

**rest.ts** - REST API client
- Wrapper for fetch() to communicate with server

**keydown.ts** - Keyboard shortcut handling
- Full keyboard control (?, space, enter, navigation keys, etc.)

**cataas.ts** - Cat picture display when all items read
- Fetches random image from configurable URL (default: cataas.com)
- Displays GPS location link if image contains geo-coordinates
- Extracts `X-Geo-Location` header and creates Google Maps link

**util.ts** - Utility functions (escapeHtml, date formatting, DOM helpers)

**types.ts** - Client-side TypeScript types

**webpack.config.js** - Bundles all client TypeScript into single `app.js`

### Cat Picture Server (cataas/)

**cataas.py** - Python HTTPS server for serving random images
- Serves random images from `cataas/images/` directory (supports .jpg, .png, .jpeg, .gif)
- Runs on https://localhost:4443 with self-signed certificates (cert.pem, key.pem)
- Extracts EXIF GPS data from images using PIL/Pillow
- Returns images with custom headers:
  - `X-Filename`: Image filename
  - `X-Geo-Location`: GPS coordinates in decimal format (latitude,longitude) if available
- CORS headers allow cross-origin requests from the RSS reader
- Supports deterministic image selection via `?i=<seed>` query parameter

**GPS Coordinate Extraction:**
- Reads EXIF data from JPEG/PNG images
- Extracts GPSLatitude, GPSLongitude, and reference directions (N/S, E/W)
- Converts from degrees/minutes/seconds to decimal degrees
- Returns coordinates with 6 decimal places precision
- Gracefully handles images without GPS data

**Offline Reverse Geocoding:**
- Converts GPS coordinates to location names (city, country) completely offline
- Uses reverse_geocoder library with K-D tree for fast lookups
- No network requests or API rate limits
- Lightweight (2.2 MB) with minimal dependencies

**Dependencies:** Requires Pillow (PIL) for EXIF reading and reverse_geocoder for offline location names: `pip install Pillow reverse_geocoder`

### Database Schema

**feeds** table:
- url, title, lastcheck, lastupd, update_interval, domain

**items** table:
- feed (FK to feeds.rowid), title, url, content, date, lastseen

**icons** table:
- domain, data (blob)

**read** table:
- item (FK to items.rowid), date

### Key REST API Endpoints

- `GET/POST /api/get-items` - Fetch items with filter (unread, feed)
- `GET /api/get-feeds` - Fetch all feeds with unread counts
- `POST /api/get-feed` - Get single feed by rowid
- `POST /api/update-feed` - Create or update feed
- `POST /api/delete-feed` - Delete feed and its items
- `POST /api/set-read` - Mark items as read
- `POST /api/set-unread` - Mark items as unread
- `GET /api/icon/:domain` - Get favicon for domain

### Feed Update Strategy

Server continuously updates feeds in background:
- Adaptive polling interval (1-10 minutes) based on feed activity
- Exponential backoff when no new items, backoff reduction when new items appear
- Tracks `lastcheck` (last fetch attempt) and `lastupd` (last time new items appeared)
- Items are deduplicated by URL across all feeds

### Favicon Handling

1. Check for local override: `server/favicons/{domain}.png`
2. Check database cache
3. Fetch from Google's favicon service: `http://www.google.com/s2/favicons?domain={domain}`
4. Store in database for future use
5. Falls back to generic RSS icon if unavailable

Favicons cached client-side with 30-day expiry headers.

### Security Considerations

- No built-in authentication or HTTPS
- Recommended deployment: behind reverse proxy (nginx) with basic auth or client certificates
- Content-Security-Policy with unsafe-inline (needed for browser extension integration)
- Referrer-Policy set to same-origin
- HTML content sanitized via sanitize-html library
- Input validation using runtypes

### Browser Extension (Optional)

The webext-background-tab/ extension injects `openInBackground()` function to open links in background tabs without switching focus. Useful for workflow where you mark interesting items, open them all in background, then read later.

Must configure `manifest.json` to match your deployment URL (default: http://localhost:3000).

## Important Notes

- TypeScript must be compiled before running (both client and server)
- Client requires webpack bundling after tsc compilation
- Server requires `--insecure-http-parser` flag for some feeds with invalid HTTP headers
- Database file `data.sqlite` created automatically in server/ directory
- Client served as static files from server (Express serves ../client)

### Cat Picture Feature

- The client can use any cat picture service via localStorage setting: `localStorage.setItem("cataas", "https://your-server/")`
- Default is cataas.com (public service)
- The custom cataas.py server in cataas/ directory provides GPS coordinate extraction and offline location names
- To run custom server: `cd cataas && python cataas.py` (requires Pillow and reverse_geocoder: `pip install Pillow reverse_geocoder`)
- Custom server requires cert.pem and key.pem for HTTPS
- GPS coordinates displayed as clickable Google Maps link with location name (e.g., "San Francisco, US") below image when available
- Location names generated completely offline using reverse_geocoder (no API calls, no rate limits)
- Feature gracefully degrades if images lack GPS data or if using standard cataas.com
