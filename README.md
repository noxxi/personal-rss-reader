# Private, web based RSS reader with full keyboard control

## Use case

- read information based on RSS feeds
- in a fast and efficient and friendly way
    - full keyboard control
    - compact display of items for fast processing
    - cute cat picture once everything is read - powered by cataas.com
- will deal with duplicate entries from multiple RSS feeds, i.e. keep only one
- will use SQLite, i.e. no extra DB engine needed
- currently not recommended for mobile phones, since keyboard control cannot be
  used there

## Keyboard shortcuts

| Key(s)        | Action    |
| ------------- | --------- |
| k, Arrow Down | next item |
| j, Arrow Up   | previous item |
| Space         | toggle current item details |
| Enter         | open current item in new tab and mark it read |
| m             | mark current item read |
| n             | mark all items read which are currently in view |
| a             | mark all items read until the current one |
| u             | undo last "mark read" operation |
| h             | toggle display of items marked as read |
| f             | toggle between Feeds and Items view |

## Setup

### Software installation

- nodejs is needed, tested with v10.19.0 on Ubuntu 20.04
- Typescript compiler is needed, tested with 3.8.3 on Ubuntu 20.04
- to install these on Ubuntu 20.04: apt install nodejs node-typescript

### Load dependencies and compile

    $ (cd server && npm i && tsc)
    $ (cd client && npm i && tsc && npx webpack)

### Startup and Run

    $ (cd server && node --insecure-http-parser server.js)

Note that `--insecure-http-parser` is needed in case a feed has an invalid
HTTP header (as currently the case with https://www.sans.org/blog/feed.xml)

Server listens on http://localhost:3000/ and will update feeds in the
background. Debug output (mostly about feed updates) is logged to stdout. 

### Adding and removing feeds

There is no GUI support for this, since it is seldom needed.

    # Add feed
    (cd server && node addfeeds.js feed-url)

    # Delete feed
    (cd server && node delfeeds.js feed-url)

    # Update all favicons for feeds
    (cd server && node updicon.js)

    # Forced update of all feeds now
    (cd server && node updfeed.js)


## Security and Privacy

- There is no authentication and no HTTPS done. Recommended setup when installed
  on a public system is behind some reverse proxy which terminates HTTPS and
  requires some authentication (like basic authentication or client certificate).
- Items are sanitized, so that hopefully no XSS is possible
- Content-Security-Policy is used, although it currently allows unsafe-inline
  since this is needed for interaction with a private browser extension (to open
  a link in a new tab but in the background). This might be further hardened in
  client/index.html.
- Referrer-Policy is set to same-origin, so that no HTTP-Referer is send when
  opening or including content from external sites.

