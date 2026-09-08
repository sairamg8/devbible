---
title: "S3+CloudFront, nginx and Apache have no concept of an SPA at all, so the fallback rule you write is a general-purpose error-response or file-existence mechanism repurposed for routing"
sidebar_label: "01e · SPA fallback: self-managed infra"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the primary source for each piece of infrastructure, named per section — AWS CloudFront documentation, nginx's own module reference, Apache's own module reference. Documentation-validated; **no sandbox run**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ SPA fallback on infrastructure you configure yourself

**Netlify's `_redirects` and Vercel's `vercel.json` were designed with "single-page app" as a use case they know about; S3, CloudFront, nginx and Apache were not.** Each mechanism below is a general-purpose feature — an HTTP error-response remap, a file-existence check, a default-resource directive — that happens to solve the SPA-fallback problem when pointed at `index.html`, but none of them have any built-in notion of what a single-page app is. That has a real consequence: they don't distinguish "this path doesn't exist because it's a client-side route" from "this path doesn't exist because someone mistyped a URL or an asset build broke" — both fall through to the same `index.html`, silently, which is the shape of gotcha that recurs across all three.

Managed platform configs (Netlify, Vercel, Cloudflare Pages, GitHub Pages) are covered in **[01d](01d-spa-fallback-hosted-platforms.md)**.

## S3 + CloudFront — custom error responses

Source: [AWS CloudFront — Generate custom error responses](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GeneratingCustomErrorResponses.html), as of the docs at the time of writing.

An S3 bucket serving static files has no rewrite concept either — a request for `/settings/profile` against a bucket with no such key returns S3's own error, either a `403` (private bucket accessed through an Origin Access Control, which S3 reports as `403` rather than `404` to avoid confirming a key's non-existence to an unauthorized caller) or a `404` (a bucket configured for static-website hosting, or a public bucket). CloudFront sits in front of that origin and is the layer capable of remapping the error:

> *"You can configure CloudFront to return a different HTTP status code to the viewer than what CloudFront received from the origin... you might want CloudFront to return a custom error page and a 200 status code (OK) to the viewer."*

The substitutable codes are an explicit, closed list:

> *"You can configure CloudFront to return any of the following HTTP status codes along with a custom error page: 200; 400, 403, 404, 405, 414, 416; 500, 501, 502, 503, 504."*

The distribution-level configuration is two custom error responses — one for `403`, one for `404`, since which code S3 actually returns depends on the bucket's own access setup — both pointing at `/index.html` with a `200` response code:

```
# CloudFront distribution — Custom Error Responses (console or IaC equivalent)
HTTP Error Code: 403  →  Response Page Path: /index.html  →  HTTP Response Code: 200
HTTP Error Code: 404  →  Response Page Path: /index.html  →  HTTP Response Code: 200
```

As Terraform, the same configuration:

```hcl
resource "aws_cloudfront_distribution" "spa" {
  # ... origin, default_cache_behavior, etc.

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
}
```

The `200` substitution matters for the same reason it matters on Netlify: without it, CloudFront returns `index.html`'s bytes but with a `403`/`404` status line still attached, which a browser will render but which breaks anything checking the HTTP status directly (an uptime monitor, a `fetch` call treating non-2xx as failure, a search-engine crawler).

## nginx — `try_files`

Source: [nginx — `ngx_http_core_module`, `try_files`](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files), nginx's own module reference.

> *"Checks the existence of files in the specified order and uses the first found file for request processing... If none of the files were found, an internal redirect to the `uri` specified in the last parameter is made."*

```
syntax: try_files file ... uri;
context: server, location
```

The SPA fallback pattern applies that generic file-existence check directly — try the exact requested path, try it as a directory, and fall back to `index.html` if neither exists:

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/example.com/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # long-term caching for hashed assets — see 01f for the full reasoning
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

`try_files` is doing no routing here in any SPA-aware sense — it is checking, in order, "does a file at this exact path exist," "does a directory at this path exist (and if so, does its index file)," and finally "since neither exists, internally redirect to `/index.html`." A request for a genuinely missing asset (a typo'd image path, a deleted file that's still referenced somewhere) falls through the exact same three checks and gets the exact same `index.html`, with a `200`, instead of a real `404` — nginx cannot distinguish "this is a client-side route" from "this is a broken reference" because `try_files` was never designed to know the difference.

## Apache — `FallbackResource`

Source: [Apache HTTP Server — `mod_dir`, `FallbackResource`](https://httpd.apache.org/docs/2.4/mod/mod_dir.html#fallbackresource), Apache's own module reference.

> *"Define a default URL for requests that don't map to a file or handler"*

```
syntax: FallbackResource disabled | local-url
default: disabled — httpd will return 404 (Not Found)
```

Apache's own documentation gives the SPA-shaped example directly, for a PHP router rather than a static SPA, but the mechanism is identical:

> *"`FallbackResource /index.php` will cause requests for non-existent files to be handled by `index.php`... Existing files, such as images, css files, and so on, will be served normally."*

For a Vite build, the equivalent `.htaccess` (placed in the same directory as `dist/index.html`) is:

```apache
# dist/.htaccess
FallbackResource /index.html
```

That single line is the entire configuration — `FallbackResource` already has the "existing files are served normally, everything else falls back" behavior built in, which is a meaningfully simpler mechanism than nginx's `try_files` chain because it's purpose-built for exactly this "one default resource" shape rather than a general ordered file-existence check being repurposed. The one place it needs help is a subtree that should be exempted from the fallback entirely — the docs' own sub-URI example shows scoping it per directory:

```apache
<Directory "/var/www/example.com/dist">
    FallbackResource /index.html
</Directory>
<Directory "/var/www/example.com/dist/api-proxy">
    FallbackResource disabled
</Directory>
```

## Gotchas

**★ Symptom: a CloudFront distribution's SPA fallback works for most routes, and a specific deep link consistently returns a plain, unstyled `403 Forbidden` instead of the app.** Cause: only a `404` custom error response was configured, and the S3 origin — behind an Origin Access Control, as is now the standard configuration — returns `403` for a missing key rather than `404`, to avoid confirming or denying a key's existence to an unauthenticated request. Fix: configure **both** the `403` and `404` custom error responses to `/index.html` with a `200` response code; which one you get depends on the bucket's access configuration, not on the request itself.

**★ Symptom: an nginx SPA fallback correctly serves the app for real routes, and a request for a genuinely deleted or mistyped asset (`/assets/old-logo-a1b2c3.png`) returns the full `index.html` with a `200` status instead of a real `404`.** Cause: `try_files $uri $uri/ /index.html;` cannot distinguish "this is a client-side route that should fall back" from "this file used to exist and doesn't anymore" — both fail the first two checks identically and land on the same fallback. Fix: scope the fallback to exclude the assets directory, giving genuinely missing hashed assets a real 404 rather than a silently-wrong 200:
```nginx
location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
location / {
    try_files $uri $uri/ /index.html;
}
```

**★ Symptom: an Apache `.htaccess` with `FallbackResource /index.html` breaks a reverse-proxied `/api/` path that used to work — requests that should reach a backend service instead return the SPA's `index.html`.** Cause: `FallbackResource` applies to the whole scope it's declared in (the directory containing the `.htaccess`, by default recursively), and a proxied path with no matching static file looks, to `FallbackResource`, identical to a missing SPA route. Fix: scope `FallbackResource disabled` to the specific subdirectory that needs different handling, exactly as Apache's own sub-URI example demonstrates, so the fallback applies to the SPA's static tree but not to a proxied API path nested under it.

**★ Symptom: a manually-written CloudFront custom error response serves `index.html` correctly, but every response is missing the app's actual `Cache-Control` headers, or carries the wrong ones.** Cause: a custom error response substitutes the *status code and body*; it does not carry through the cache-control behavior you'd get from a normal successful request to `/index.html` — the error-caching TTL (10 seconds by default) governs how long CloudFront itself caches the substituted response internally, which is a distinct setting from the `Cache-Control` header ultimately sent to the viewer. Fix: set the actual response headers (a short or absent `Cache-Control` on `index.html`, per **[01f](01f-caching-strategy-and-library-mode-deployment.md)**) via a CloudFront response-headers policy or Lambda@Edge, independent of the error-caching TTL, which controls something else entirely.

## Interview questions

**★ Why can none of S3+CloudFront, nginx, or Apache tell the difference between a client-side route and a genuinely broken link, when Cloudflare Pages apparently can?**
Because none of the three have any framework-aware concept of "single-page app" built in — `try_files`, `FallbackResource`, and CloudFront's custom error responses are all general-purpose mechanisms (file-existence checking, a default-resource directive, an HTTP-status remap) that happen to produce the right behavior when pointed at `index.html`, not mechanisms that inspect the request and reason about routing. Cloudflare Pages' automatic behavior isn't smarter about the *request* either — it's making a static, deploy-time decision ("no top-level `404.html` present, therefore treat this as an SPA and route everything to `/`") once, at the platform level, rather than per-request. The underlying limitation is identical across all four: a request for a path that isn't a real file gets the same fallback whether it's a legitimate client-side route or a typo, and it's the operator's job to scope the fallback narrowly enough that the difference doesn't matter in the cases where it would.

**★ Why does the CloudFront SPA fallback need both a `403` and a `404` custom error response, when a plain nginx or Apache setup only ever deals with one status code?**
Because CloudFront is fronting an S3 origin, and which HTTP status S3 itself returns for a missing object depends on how the bucket is configured to be accessed — a bucket behind an Origin Access Control (the current recommended setup, keeping the bucket itself fully private) returns `403 Forbidden` for a missing key, deliberately not distinguishing "doesn't exist" from "not authorized," while a bucket configured for direct public access or static-website hosting returns a plain `404`. nginx and Apache are serving files directly off local disk, where a missing file is unambiguously a `404` — there's no analogous access-control layer producing a different code for the same underlying situation.

**★ What's the actual difference in mechanism between nginx's `try_files` fallback and Apache's `FallbackResource`, beyond "different servers, same idea"?**
`try_files` is a generic ordered file-existence checker that happens to end in a fallback URI as its last parameter — it checks the exact request URI, then the URI as a directory, then falls through to whatever's specified last, and none of those checks are specific to "serve a default page." `FallbackResource` is purpose-built for exactly the shape SPA fallback needs: "serve existing files normally, and for anything else in this scope, serve this one specific resource" — it's a single directive expressing the whole intent directly, rather than three ordered checks that happen to produce the right result when the last one points at `index.html`. The practical consequence is that Apache's version needs less explaining and less can be subtly misconfigured in the ordering, while nginx's version is more flexible (you can insert additional checks between the literal file check and the fallback) at the cost of it being less obviously "this is the SPA rule" when someone else reads the config later.

**★ A CloudFront custom error response correctly serves `index.html` for a deep link, but a monitoring tool that pings the deep-link URL reports the app as down. Why?**
Almost certainly because the custom error response's `HTTP Response Code` was left at its origin default (`403` or `404`) instead of being explicitly set to `200`. CloudFront will happily serve the *bytes* of `index.html` while still reporting the original error status in the HTTP response line, since substituting the response body and substituting the response code are two independent settings — the AWS documentation names this directly as a reason to remap the code (*"you might want CloudFront to return a custom error page and a 200 status code"*), specifically calling out that intermediate devices, and by extension monitoring tools checking status codes rather than content, will otherwise treat the response as an error even though a human looking at a browser would see the app load correctly.

---

← [01d · SPA fallback: hosted platforms](01d-spa-fallback-hosted-platforms.md) · [Vite overview](../../README.md) · Next → [01f · Caching strategy](01f-caching-strategy-and-library-mode-deployment.md)
