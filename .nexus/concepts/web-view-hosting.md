---
title: Web View Hosting
aliases: [web view hosting, hosted web view, cloudfront, offline worker, app manifest, install web view]
touches: [raiden-web-view, aws-deployment]
last_updated_by: "#96"
status: active
verification: verified
---

# Web View Hosting

The web view is a build of static files that any HTTPS address can serve. The deployment serves it from a private S3 bucket behind CloudFront in the team's AWS account, at CloudFront's own HTTPS address. Every file is checked for a newer copy on each load, and each web view update clears CloudFront's cache.

## How It Works

The build is static files with relative addresses, so it works at the root or under a sub-path of any HTTPS origin. The font, the icons and the offline page come from the same address.

Only the CloudFront distribution can read the bucket. The distribution redirects plain HTTP to HTTPS and serves the page at the root address. Each file carries its correct content type and tells the browser to revalidate on each load. The edge keeps each file until the next web view update clears its cache. The web view calls the backend at the backend's own address, not through CloudFront.

An app manifest names the app Raiden, opens it in a standalone window and gives it the Raiden icon. An offline worker answers a failed page load with a Raiden page that says the web view needs a connection. Online, every request goes to the network, so the web view never runs an old build.

## Key Invariants

1. The offline worker caches only the offline page and what it needs.
2. A request for a hosted file made straight to storage is refused. Only the web view address serves the files.
3. The browser checks every hosted file for a newer copy on each load, including the service worker and the manifest.
4. When a web view update finishes, the next load of the web view address gets the new files, with no manual cache clear.
5. The hosting writes no request log, so the sign-in return address and its one-time code are logged nowhere.

## Integration Points

- [raiden-web-view](raiden-web-view.md) — this page covers how the web view host's build is served, installed and kept fresh.
- [aws-deployment](aws-deployment.md) — the web view update builds the web view against the deployment and uploads it to the hosting.

## Decision Log

### 2026-11-28 — #96 — Split from raiden-web-view, with hosting on a private bucket behind CloudFront
This page is split from raiden-web-view and holds its build, manifest, offline worker and that page's offline-worker invariant. The deployment now serves the build from a private bucket that only the CloudFront distribution reads, on CloudFront's own HTTPS address, because custom domains are out of scope. Request logging is off, so the sign-in return address is written to no log. The file names carry no content hash, and adding one would change web view code, so every file tells the browser to revalidate on each load. The distribution serves only the web view, because the extension calls the backend cross-origin in every case. Refuted alternative: long cache lifetimes with content-hashed file names, which loads faster on a repeat visit but needs build and code changes the epic ruled out.
