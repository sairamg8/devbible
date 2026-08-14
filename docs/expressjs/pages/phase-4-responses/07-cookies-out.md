---
title: "Setting cookies"
sidebar_label: "07 · Cookies out"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**`res.cookie` is built in. Flags decide whether browser JS can read the cookie
and when it is sent.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [`res.cookie`](https://expressjs.com/en/5x/api/response/) documents the full option
> set used here: `httpOnly` (*"flags the cookie to be accessible only by the web
> server"*), `secure` (HTTPS only), `sameSite`, `path` — **default `"/"`** —,
> `domain`, `expires` (*"if not specified or set to 0, creates a session cookie"*),
> `maxAge` (**milliseconds**, relative to now), `signed`, `encode` (defaults to
> `encodeURIComponent`), plus `priority` and `partitioned` for CHIPS.
> Two asymmetries worth holding on to: **`signed: true` requires cookie-parser**, the
> same package [Phase 3](../phase-3-requests/08-cookies-and-helpers.md) needs to *read*
> cookies; and `maxAge` here is milliseconds, while the `Max-Age` attribute that reaches
> the browser is in seconds — Express does the conversion, your intuition should not.

```js
// set-cookie.mjs
import express from 'express';

const app = express();
app.get('/set', (req, res) => {
  res.cookie('sid', 'abc', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  res.end('ok');
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/set`);
  console.log(res.headers.getSetCookie?.() || res.headers.get('set-cookie'));
  server.close();
});
```

```console
$ node set-cookie.mjs
[ 'sid=abc; Path=/; HttpOnly; SameSite=Lax' ]
```

| Flag | Why |
|---|---|
| `httpOnly` | Block `document.cookie` (XSS mitigation for session tokens) |
| `secure` | HTTPS only — required with `SameSite=None` |
| `sameSite` | CSRF posture for cookie-based sessions |
| `path` / `domain` | Scope |

Reading cookies needs `cookie-parser` (Phase 3). Auth product rules: Phase 8 and
Node Phase 8.

## Interview questions

**★ Why httpOnly on session cookies?**  
Stops trivial XSS from stealing the cookie via JavaScript.

**★ What does `sameSite` actually defend against, and what does it not?**  
It constrains when the browser attaches the cookie to cross-site requests, which
blunts CSRF. It does nothing about XSS — script running on your own origin is
same-site by definition. `httpOnly` and `sameSite` cover different attacks; you
want both.

**Why must `clearCookie` repeat the original attributes?**  
A cookie is identified by name **plus** `path` and `domain`. Clear it with
different values and the browser treats it as a different cookie, leaves the
original in place, and the user stays logged in.

**`maxAge` is in what unit?**  
Milliseconds in `res.cookie`. The `Max-Age` attribute sent to the browser is in
seconds — Express converts. Passing seconds yourself produces a cookie that
expires a thousand times sooner than intended.

## Trade-off

`httpOnly` is what makes a session cookie worth using — it takes token theft off
the table for any XSS that cannot also make requests. The price is that your
front end cannot read the session at all, so "am I logged in?" has to become a
request to the server rather than a glance at storage. Teams reach for a
JS-readable cookie or `localStorage` to avoid that round trip, and trade a
whole-class defence for one saved request. **Keep `httpOnly`.** Answer the
question with a `/me` endpoint, or a second non-sensitive cookie carrying only
display data.

## Gotchas

**Symptom:** `clearCookie` runs but the browser keeps sending the cookie  
**Cause:** It was set with a `path` or `domain` that the clear call did not repeat  
**Fix:** Pass the identical `path`/`domain` options to `clearCookie` that you passed
to `res.cookie`

**Symptom:** The cookie never arrives in production, but works locally  
**Cause:** `secure: true` over a plain-HTTP hop — usually a proxy terminating TLS with
`trust proxy` unset, so Express believes the connection is insecure  
**Fix:** Configure `trust proxy` (Phase 9) so `req.secure` reflects the client's
connection, not the proxy's

**Symptom:** A cross-site page stopped receiving the cookie after a browser update  
**Cause:** `SameSite` now defaults to `Lax` in browsers, so it is no longer sent on
cross-site subrequests  
**Fix:** Decide deliberately — `SameSite=None; Secure` if the flow genuinely is
cross-site, otherwise leave the safer default and fix the flow

**Symptom:** `signed: true` throws, or `req.signedCookies` is always empty  
**Cause:** cookie-parser is not mounted with a secret  
**Fix:** `app.use(cookieParser(secret))`. Signing and verification both live in that
package, not in Express

**Symptom:** A session expires almost immediately  
**Cause:** `maxAge` given in seconds  
**Fix:** Milliseconds — `maxAge: 900_000` for fifteen minutes

---

← Prev: [SPA fallback](06-spa-fallback.md) · Next → [Streaming and downloads](08-streaming-and-downloads.md)
