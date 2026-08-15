---
title: "error_page — the directive and its forms"
sidebar_label: "01 · The directive and its forms"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> — `error_page` syntax, the `=response` and bare `=` forms, the named-location
> form, URL redirects and their restriction to 301/302/303/307/308 (with 307 not
> treated as a redirect before 1.1.16/1.0.13 and 308 not before 1.13.0), and
> *"the client request method changed to `GET` (for all methods other than `GET`
> and `HEAD`)"* — plus `internal`.
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Four forms, and the difference between them is entirely about what status code
the client ends up with.**

## The basic form

```text
Syntax:  error_page code ... [=response] uri;
Default: —
Context: http, server, location, if in location
```

```nginx
error_page 404             /404.html;
error_page 500 502 503 504 /50x.html;

location = /404.html { internal; root /srv/errors; }
location = /50x.html { internal; root /srv/errors; }
```

This *"causes an internal redirect to the specified `uri`"* — the mechanism from
[topic 06](../06-internal-redirects/README.md). The error page is fetched exactly
as if the client had asked for it, so it goes through location matching and can be
a static file, a proxied response, or anything else.

Marking those locations `internal` ([page 04](../04-named-and-internal.md)) means
nobody can request `/50x.html` directly and receive an error-styled page with
status **200** — otherwise a small but real source of confusion for users, crawlers
and monitors.

The `uri` value can contain variables, which is occasionally useful for
per-language or per-tenant error pages.

## ⚠️ The method changes to GET

Documented, and easy to miss: the internal redirect happens *"with the client
request method changed to `GET` (for all methods other than `GET` and `HEAD`)"*.

A failed `POST /api/orders` fetches its error page with a **GET**. That is almost
always what you want — but it means an `error_page` target must not assume the
original method, and it explains why an error page pointing at a POST-only backend
route misbehaves.

**A static file is the safest target** precisely because it is trivially safe to
`GET`.

## Form 2 — `=response`, replace the code

```nginx
error_page 404 =200 /empty.gif;
```

The client receives **200**, not 404. Legitimate uses are narrow: a transparent
placeholder image, or an SPA shell where a "not found" genuinely is a valid
application state that the frontend will render.

🔴 **Used carelessly this is how you make an API lie.** A backend 404 turned into a
200 carrying HTML tells every client — browsers, `fetch`, monitoring, crawlers —
that the request succeeded. It is the same failure as an SPA fallback swallowing
`/api` ([topic 06, chunk 02](../06-internal-redirects/02-cycles-and-debugging.md)),
reached by a different directive.

**Never `=200` an API path.** Reserve it for content the client is meant to render
as an ordinary page.

## Form 3 — a bare `=`, take the handler's code

```nginx
error_page 404 = /404.php;
```

Documented for the case where *"an error response is processed by a proxied server
or a FastCGI/uwsgi/SCGI/gRPC server, and the server may return different response
codes (e.g. 200, 302, 401 or 404)"*. The bare `=` means **"use whatever status the
error page's own handler returns"**.

The three forms side by side, for a 404 whose handler returns 200:

| Written as | Client receives |
|---|---|
| `error_page 404 /404.php;` | **404** — the handler's status is discarded |
| `error_page 404 =200 /404.php;` | **200** — forced, whatever the handler said |
| `error_page 404 = /404.php;` | **200** — because that is what the handler returned |

Use the bare `=` when the error page is dynamic and its status is meaningful.
Without it, a dynamic handler's carefully chosen code is thrown away.

## Form 4 — hand it to a named location

```nginx
location / {
    error_page 404 = @fallback;
}

location @fallback {
    proxy_pass http://backend;
}
```

The documentation gives exactly this: *"If there is no need to change URI and
method during internal redirection it is possible to pass error processing into a
named location."*

Note what that sentence promises — **this form preserves the URI and the method**,
which the plain URI form does not. So a failed `POST /thing` reaches `@fallback`
still as a `POST` to `/thing`.

That makes it the right shape for "try the static file, else ask the app", and for
migration configs that fall back to a legacy backend without mangling the request.

## Form 5 — redirect the client instead

```nginx
error_page 403      http://example.com/forbidden.html;
error_page 404 =301 http://example.com/notfound.html;
```

A **URL** target sends a real redirect to the client rather than an internal one.
By default the code is **302**, and it *"can only be changed to one of the redirect
status codes (301, 302, 303, 307 and 308)"*.

Two version notes from the documentation: 307 was not treated as a redirect before
1.1.16 / 1.0.13, and 308 not before 1.13.0.

This form costs a round trip and changes the URL the user sees, so it suits
"this whole site moved" far better than "this page is missing".

## Gotchas

**Symptom:** Users can browse to `/50x.html` and see the error page with status
200.
**Cause:** The error-page location is not `internal`.
**Fix:** Add `internal;` to it.

**Symptom:** A dynamic error handler returns 401 and the client still sees 404.
**Cause:** The plain form discards the handler's status.
**Fix:** Use the bare `=` form — `error_page 404 = /handler;`.

**Symptom:** Monitoring says the site is healthy while users see error pages.
**Cause:** An `error_page … =200` is reporting success for real failures.
**Fix:** Only rewrite to 200 where the response genuinely is a success, and never
on an API path.

**Symptom:** A failed `POST` fetched an error page that behaved strangely.
**Cause:** The internal redirect changes the method to `GET` for anything other
than `GET`/`HEAD`.
**Fix:** Expected. Point at a static file, or use the named-location form, which
preserves the method.

**Symptom:** An `error_page` pointing at an external URL returned 302 when you
wanted 301.
**Cause:** 302 is the default for the URL form.
**Fix:** Write `=301` explicitly — and note only 301, 302, 303, 307 and 308 are
accepted there.

## Trade-off

**The three status forms give you precise control and no way to tell them apart at
a glance.** `error_page 404 /x;`, `error_page 404 =200 /x;` and
`error_page 404 = /x;` differ by one or four characters and produce three
different status codes. A reviewer skimming a diff will not notice which one
changed.

The mitigation is a comment on any line that is not the plain form, because the
plain form is the only one whose behaviour is obvious from reading it. The bare
`=` in particular looks like a typo and is not.

## Interview questions

**★ What does `error_page` actually do?**
It maps one or more status codes to a URI and issues an internal redirect to it,
so the error page is served through normal location matching. The redirect changes
the request method to `GET` for anything other than `GET` or `HEAD`.

**★ What does `error_page 404 =200 /empty.gif;` do, and when is it dangerous?**
It serves `/empty.gif` with status **200** instead of 404. That is fine for content
the client should render normally — a placeholder image, an SPA shell. It is
dangerous on an API path, because every client and every monitor is then told a
failed request succeeded.

**★ What is the difference between `error_page 404 /404.php;` and
`error_page 404 = /404.php;`?**
Without the `=`, the client receives the original 404 whatever the handler
returns. With a bare `=`, the status comes from whatever handles the error page —
the documented form for a dynamic handler that may itself return 200, 302, 401 or
404.

**Why should error-page locations be marked `internal`?**
So they cannot be requested directly. Without it, anyone can fetch `/50x.html` and
receive the error page with status 200 — confusing for users and misleading for
crawlers and monitors.

**What is special about handing error processing to a named location?**
It preserves the URI and the request method, which the plain URI form does not.
The documentation gives it as the form to use when there is no need to change
either — which makes it right for "try this, else ask the app".

**What happens if `error_page` points at an external URL?**
nginx sends the client a real redirect rather than serving the page internally —
302 by default, changeable only to 301, 302, 303, 307 or 308. It costs a round
trip and changes the URL the user sees.

---

← Index: [`error_page`](README.md) · Next → [With a backend, and what not to do](02-with-a-backend.md)
