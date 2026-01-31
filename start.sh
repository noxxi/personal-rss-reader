#!/bin/bash

# Start the login server in the background
cd /app/login && node login-server.js &

# Start the main RSS reader server in the foreground
cd /app/server && exec node --insecure-http-parser server.js
