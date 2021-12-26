#!/bin/sh
cd server
NODE_OPTIONS="--insecure-http-parser --tls-cipher-list='DEFAULT:@SECLEVEL=1'"  node server.js
