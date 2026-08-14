---
title: "05.3 · Credentials and exposure"
sidebar_label: "03 · Credentials and exposure"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [`Access-Control-Allow-Credentials`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials), [`Access-Control-Expose-Headers`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers), [`RequestInit.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials), [`Vary`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary). Documentation-validated.

**Credentials change every CORS rule.** The wildcard stops working, the response headers you can
read shrink, and a caching layer that ignores `Vary` starts serving one origin's permission to
another.

## Cookies are opt-in, in both directions

The client half, from [04 · Auth and the 401
refresh](../03-fetch-wrapper/04-auth-and-refresh.md): `fetch` defaults to
`credentials: "same-origin"`, so a cross-origin call sends **no cookies** unless you ask.

```js
fetch("https://api.example.com/me", { credentials: "include" });
```

The server half must agree:

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
```

**Both are required.** Omit the client option and the server sees an anonymous request. Omit the
server header and the browser blocks the response even though the cookies were sent — the
request happened, the answer is withheld.

🔴 **The wildcard is rejected once credentials are involved.** MDN, on responding to a
credentialed request:

> "The server **must not** specify the `*` wildcard for the `Access-Control-Allow-Origin`
> response-header value, but must instead specify an explicit origin; for example:
> `Access-Control-Allow-Origin: https://example.com`"

> "If a request includes a credential (most commonly a `Cookie` header) and the response includes
> an `Access-Control-Allow-Origin: *` header (that is, with the wildcard), the browser will
> **block access to the response**, and report a CORS error in the devtools console."

The reason is the whole point of the same-origin policy: `*` plus credentials would mean *any*
site could make authenticated requests on the user's behalf and read the answers. So the server
must name the origin — which in practice means **reading the request's `Origin` header, checking
it against an allowlist, and echoing it back**.

The same restriction applies to `Access-Control-Allow-Headers: *` and
`Access-Control-Allow-Methods: *` on credentialed requests: the wildcard is not honoured, and
every header and method must be named explicitly.

## `Vary: Origin` — the bug that only appears in production

If the server echoes the request's origin, its response **depends on a request header**. Any
cache in between — a CDN, a reverse proxy, the browser's own — must be told, or it will serve the
first caller's `Access-Control-Allow-Origin` to the second.

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

⚠️ **This is the classic "CORS works locally and breaks behind the CDN" bug**, and it is
intermittent by nature: it depends on which origin populated the cache entry first. A staging
origin's permission gets served to production, or vice versa, and the error appears for some
users and not others.

It is a server-side fix, but recognising the *shape* — CORS failing non-deterministically, only
in a deployed environment, only for some users — is what stops a week being spent in the client.

## Reading response headers: the second allowlist

By default a cross-origin response exposes only the **CORS-safelisted response headers** to
script: `Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`,
`Last-Modified`, `Pragma`. Everything else is invisible to JavaScript even though it arrived.

MDN:

> "The `Access-Control-Expose-Headers` header **adds the specified headers to the allowlist that
> JavaScript** (such as `Response.headers`) in browsers **is allowed to access**."

```http
Access-Control-Expose-Headers: X-Total-Count, X-Request-Id
```

🔴 **This is why `res.headers.get("x-total-count")` returns `null` while the network tab clearly
shows the header.** Nothing is wrong with your code; the header is on the wire and hidden from
script. Pagination totals, rate-limit headers and request ids all hit this, and the symptom looks
exactly like a server that forgot to send them.

**Two consequences for API design:** if a client needs a value, either expose the header
explicitly or put it in the body — and the body is usually the better answer, because it survives
proxies, does not need a CORS header, and is easier to type.

## What `credentials: "include"` does not do

⚠️ **It does not make cookies appear that the browser would not otherwise send.** Cookie
attributes still apply, and `SameSite` is the one that bites:

- `SameSite=Lax` (**the default in modern browsers**) — not sent on cross-site subrequests, so a
  cross-site `fetch` gets nothing regardless of `credentials: "include"`.
- `SameSite=None` — sent cross-site, and **requires `Secure`**, so it needs HTTPS.
- `SameSite=Strict` — never sent cross-site.

🔴 **`credentials: "include"` and `SameSite` are two independent gates, and both must open.**
Setting the fetch option while the cookie is `Lax` produces exactly the same symptom as not
setting it at all, which is why this one costs so much time. The cookie half belongs to the
server that set it — the Express syllabus owns the header side.

Note also that "same-site" and "same-origin" are different tests: `app.example.com` and
`api.example.com` are the same *site* (so `Lax` cookies flow) but different *origins* (so CORS
applies). A request can therefore need CORS headers and still carry cookies happily — or the
reverse.

## The client-side checklist

When a credentialed cross-origin call fails, in the order that finds it fastest:

1. **`credentials: "include"`** on the request? (Client — yours.)
2. **The `OPTIONS` request** — does it return 2xx with the headers, and does it avoid auth?
   ([02 · Simple versus preflighted](./02-simple-vs-preflighted.md).)
3. **`Access-Control-Allow-Origin`** — is it the explicit origin, not `*`?
4. **`Access-Control-Allow-Credentials: true`** — present?
5. **`Vary: Origin`** — present, if the origin is echoed?
6. **The cookie's `SameSite`** — `None; Secure` for cross-site?
7. **`Access-Control-Expose-Headers`** — only if you need to *read* a header.

Steps 2–7 are server-side. **That is the real lesson of this topic**: the client's entire
contribution to CORS is one option, and the rest of the debugging is reading someone else's
headers accurately.

## Gotchas

**Symptom:** Cookies are not sent cross-origin
**Cause:** `credentials` defaults to `"same-origin"`.
**Fix:** `credentials: "include"` — and check `SameSite` too.

**Symptom:** `credentials: "include"` is set and cookies still do not arrive
**Cause:** The cookie is `SameSite=Lax` (the modern default) or `Strict`.
**Fix:** `SameSite=None; Secure` on the server that sets it.

**Symptom:** A CORS error appears only once credentials are added
**Cause:** `Access-Control-Allow-Origin: *` is rejected for credentialed requests — MDN: *"the
browser will block access to the response."*
**Fix:** Echo the specific origin from an allowlist.

**Symptom:** `Access-Control-Allow-Headers: *` stops working with credentials
**Cause:** Wildcards are not honoured on credentialed requests, for headers and methods too.
**Fix:** Name each one explicitly.

**Symptom:** CORS works locally, fails intermittently behind a CDN
**Cause:** The echoed origin was cached without `Vary: Origin`.
**Fix:** Add `Vary: Origin` server-side.

**Symptom:** `res.headers.get("x-total-count")` is `null` but the network tab shows it
**Cause:** Only safelisted response headers are exposed to script.
**Fix:** `Access-Control-Expose-Headers`, or move the value into the body.

**Symptom:** Rate-limit headers are unreadable in the client
**Cause:** Same allowlist.
**Fix:** Same — expose them, or return them in the payload.

**Symptom:** The API works from `api.example.com` to `app.example.com` for cookies but still
errors
**Cause:** Same *site* (cookies flow) but different *origin* (CORS applies). They are different
tests.
**Fix:** Send the CORS headers as well.

## Interview questions

**★ What does `credentials: "include"` require from the server?**
`Access-Control-Allow-Credentials: true` **and** an explicit `Access-Control-Allow-Origin` — MDN:
the server *"must not specify the `*` wildcard … but must instead specify an explicit origin."*
With a wildcard the browser *"will block access to the response."*

**★ Why is the wildcard forbidden with credentials?**
Because it would let any site make authenticated requests as the user and read the results,
which is precisely what the same-origin policy exists to prevent.

**★ Why does a server echoing the request origin need `Vary: Origin`?**
Because the response now depends on a request header. Without `Vary`, a shared cache serves the
first origin's `Access-Control-Allow-Origin` to a different origin — a CORS failure that appears
only in deployed environments and only for some users.

**★ `res.headers.get("x-total-count")` returns `null` although the header is on the wire. Why?**
Cross-origin responses expose only CORS-safelisted response headers to script. The server must
list others in `Access-Control-Expose-Headers` — or put the value in the body, which is usually
better.

**★ `credentials: "include"` is set and cookies still are not sent. What else?**
`SameSite`. `Lax` is the modern default and is not sent on cross-site subrequests; cross-site
needs `SameSite=None; Secure`. The fetch option and the cookie attribute are independent gates.

**★ Are `app.example.com` and `api.example.com` same-site or same-origin?**
Same **site**, different **origin**. So `SameSite=Lax` cookies flow between them, and CORS still
applies. Conflating the two tests is why cookies and CORS seem to contradict each other.

**How much of CORS can the client actually control?**
One option — `credentials` — plus the choice of headers and method that decide whether a
preflight happens. Everything else is the server's, and the client's job is to read the console
and the `OPTIONS` response accurately.

---

← [02 · Simple vs preflighted](./02-simple-vs-preflighted.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
