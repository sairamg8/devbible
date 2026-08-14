---
title: "05.2 · Simple versus preflighted"
sidebar_label: "02 · Simple vs preflighted"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [CORS-safelisted request header](https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header), [`Access-Control-Max-Age`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age). Documentation-validated.

**Whether a request is "simple" decides whether the browser asks permission first.** It is a
mechanical test with an unintuitive result: `Content-Type: application/json` — the header on
almost every API call you will ever write — is what makes a request non-simple.

## The exact test

MDN: *"A simple request is one that meets **all** the following conditions"*:

**Method** — one of:

- `GET`
- `HEAD`
- `POST`

**Headers** — apart from those the user agent sets itself, *"the only headers which are allowed
to be manually set are the CORS-safelisted request-headers, which are"*:

- `Accept`
- `Accept-Language`
- `Content-Language`
- `Content-Type` (with the restriction below)
- `Range` (single range values only, e.g. `bytes=256-`)

**`Content-Type`** — *"The only type/subtype combinations allowed"*:

- `application/x-www-form-urlencoded`
- `multipart/form-data`
- `text/plain`

**And** no `ReadableStream` body, and no listeners on `XMLHttpRequest.upload`.

🔴 **`application/json` is not on that list.** So the ordinary JSON `POST` —

```js
fetch("https://api.example.com/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },   // ← not safelisted
  body: JSON.stringify(order),
});
```

— is **preflighted**. So is any request carrying `Authorization`, or `X-Request-Id`, or any
custom header at all. In practice **almost every real API call from a browser is preflighted**,
and "simple" describes form posts and `<img>`/`<script>` loads more than it describes anything
you write.

The reason for the rule is historical and worth knowing: a plain HTML form can already issue a
cross-origin `POST` with those three content types, with no JavaScript involved. The safelist is
"things the web could already do before `fetch` existed" — so requiring permission for them
would break the web, while requiring it for anything *new* costs nothing.

## What a preflight looks like

MDN:

> "for 'preflighted' requests the browser first sends an HTTP request using the `OPTIONS` method
> to the resource on the other origin, in order to determine if the actual request is safe to
> send."

```http
OPTIONS /orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type, authorization
```

MDN on the two request headers:

> "`Access-Control-Request-Method` … lets the server know **what HTTP method will be used** when
> the actual request is made."

> "`Access-Control-Request-Headers` … lets the server know **what HTTP headers will be used**
> when the actual request is made … answered by the complementary server-side header of
> `Access-Control-Allow-Headers`."

And the answer that permits the real request:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

🔴 **The preflight is a separate request that your handler probably does not implement.** An
`OPTIONS` to `/orders` on a server whose router only knows `POST /orders` typically answers 404
or 405 — and a preflight that does not succeed blocks the real request entirely. This is why
"my `GET` works and my `POST` does not" is such a common shape: the `GET` was simple and the
`POST` was preflighted into a route that does not exist.

⚠️ **Preflight responses must not require authentication.** The `OPTIONS` request carries **no
credentials and no `Authorization` header** — the browser sends it before it sends yours. An
auth middleware that runs before the CORS middleware answers 401, the preflight fails, and the
symptom is a CORS error on an endpoint whose auth is otherwise fine.

## The cost, and `Access-Control-Max-Age`

A preflight is a full round trip before the real one — two round trips per call, on the network
where latency is worst.

MDN:

> "The `Access-Control-Max-Age` header indicates **how long the results of a preflight request
> can be cached**. The `delta-seconds` parameter indicates the number of seconds the results can
> be cached."

The cache is keyed per origin, per URL and per method/header set, so the second call to the same
endpoint skips the `OPTIONS`. ⚠️ **Browsers cap the value** — the header may ask for 86400 and
the browser will enforce its own, much lower, maximum. Treat it as an optimisation, never as a
guarantee, and do not conclude the header is being ignored because a preflight reappears.

**What actually reduces preflights** is avoiding the triggers, and mostly you should not:

- Sending `text/plain` instead of `application/json` to dodge the preflight is a real technique
  and a bad idea — it discards content negotiation and confuses every intermediary.
- Dropping a custom header (`X-Request-Id`) to stay safelisted may be worth it on a hot path.
- Putting the API on the **same origin** as the app removes CORS entirely, and is the reason
  reverse-proxying `/api` is such a common production layout.

## Reading the console error properly

Browser messages are precise once you know the vocabulary. The three you will actually meet:

**`No 'Access-Control-Allow-Origin' header is present on the requested resource.`**
The server did not opt in at all — or, more often, it did for the *real* request but the
**preflight** answered without the header (a 404/405/401 from a route that does not handle
`OPTIONS`). **Look at the `OPTIONS` request in the network tab, not the one you wrote.**

**`Method PATCH is not allowed by Access-Control-Allow-Methods in preflight response.`**
The preflight succeeded and the server's allowlist does not include the method. A server-side
one-line fix.

**`Request header field x-request-id is not allowed by Access-Control-Allow-Headers in preflight
response.`**
Same shape, for headers. Every custom header must be named in `Access-Control-Allow-Headers` —
there is no wildcard that works with credentials (see
[03 · Credentials and exposure](./03-credentials-and-exposure.md)).

**`Redirect is not allowed for a preflight request.`**
The `OPTIONS` hit a redirect — commonly `http` → `https`, or a trailing-slash normalisation.
Request the final URL directly.

🔴 **The single most useful debugging habit: in the network tab, filter by the `OPTIONS` request
and read *its* response headers.** Most CORS bugs are preflight bugs, and the request everyone
stares at is the one that never happened.

## Gotchas

**Symptom:** `GET` works, `POST` fails with a CORS error
**Cause:** The `GET` was simple; the `POST` carries `Content-Type: application/json` and is
preflighted into an `OPTIONS` route the server does not handle.
**Fix:** Handle `OPTIONS` (usually the CORS middleware, mounted before the router).

**Symptom:** Adding one custom header broke a working request
**Cause:** Any non-safelisted header triggers a preflight.
**Fix:** Add it to `Access-Control-Allow-Headers` server-side.

**Symptom:** The preflight returns 401
**Cause:** Auth middleware runs before CORS, and the `OPTIONS` carries no credentials by design.
**Fix:** Mount CORS before authentication, and never require auth on `OPTIONS`.

**Symptom:** The preflight returns 404 or 405
**Cause:** The route only registers `POST`.
**Fix:** Answer `OPTIONS` for the path.

**Symptom:** Every call makes two round trips
**Cause:** No `Access-Control-Max-Age`, so nothing is cached.
**Fix:** Set it — while knowing browsers cap the value.

**Symptom:** `Access-Control-Max-Age: 86400` and preflights still reappear
**Cause:** Browsers enforce their own maximum, and the cache is per method/header set.
**Fix:** Expected behaviour, not a bug.

**Symptom:** `Redirect is not allowed for a preflight request`
**Cause:** The `OPTIONS` was redirected — `http`→`https`, or a trailing slash.
**Fix:** Call the canonical URL directly.

**Symptom:** A `FormData` upload is simple but the JSON version is not
**Cause:** `multipart/form-data` is on the safelist; `application/json` is not.
**Fix:** Nothing — but it explains why the two behave differently.

## Interview questions

**★ What makes a CORS request "simple"?**
Method `GET`, `HEAD` or `POST`; only CORS-safelisted headers set manually (`Accept`,
`Accept-Language`, `Content-Language`, `Content-Type`, `Range`); a `Content-Type` of
`application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`; no `ReadableStream`
body; and no `XMLHttpRequest.upload` listeners.

**★ Why is a normal JSON `POST` preflighted?**
Because `application/json` is not one of the three allowed content types. The safelist covers
what an HTML form could already do cross-origin before `fetch` existed; anything beyond it needs
explicit permission.

**★ What is in a preflight, and what answers it?**
An `OPTIONS` request carrying `Origin`, `Access-Control-Request-Method` and
`Access-Control-Request-Headers`. The server answers with `Access-Control-Allow-Origin`,
`-Methods`, `-Headers` and optionally `-Max-Age`.

**★ `GET` works and `POST` gives a CORS error. First thing you check?**
The `OPTIONS` request in the network tab. The `POST` is preflighted, and the failure is almost
always the preflight — a 404/405 from a route that only handles `POST`, or a 401 from auth
middleware mounted before CORS.

**★ Why does the preflight carry no credentials?**
It is the browser asking permission before your request exists. Requiring authentication on
`OPTIONS` therefore breaks every credentialed cross-origin call, and presents as a CORS error
rather than an auth error.

**★ How do you reduce preflight cost?**
`Access-Control-Max-Age` to cache the result (browsers cap it), avoid non-safelisted headers on
hot paths, or remove CORS entirely by serving the API from the same origin behind a reverse
proxy.

**What does `Redirect is not allowed for a preflight request` mean?**
The `OPTIONS` was redirected — usually `http`→`https` or a trailing-slash normalisation.
Preflights must not redirect; call the canonical URL.

---

← [01 · What the browser does](./01-what-the-browser-is-doing.md) · [Topic index](./README.md) ·
Next → [03 · Credentials and exposure](./03-credentials-and-exposure.md)
