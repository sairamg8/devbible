---
title: "CSRF"
sidebar_label: "11 · CSRF"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — headers, cookie output and token comparison
> executed on this machine.

**CSRF is an authority problem, not an input problem.** Nothing in the request is
malformed. The attacker's page cannot read your cookie, cannot see your response, and
does not need to — it only needs the browser to attach the cookie to a request it
composed. The server sees a perfectly valid, fully authenticated call to `POST /transfer`.

## The shape of the attack

A page on `evil.example` contains a form that submits itself:

```html
<!-- pseudo-code: the attacker's page, not yours -->
<form action="https://bank.example/transfer" method="POST">
  <input name="to" value="mallory">
  <input name="amount" value="1000">
</form>
<script>document.forms[0].submit()</script>
```

The browser attaches `bank.example`'s cookies because the cookie belongs to the
destination, not to the page that triggered the request. Here is what your handler
actually receives — a real request against a Node server, with the headers a browser
would send:

```console
{"method":"POST","origin":"https://evil.example","referer":"https://evil.example/page",
 "contentType":"application/x-www-form-urlencoded","cookie":"sid=abc123"}
```

The cookie is there. The only thing distinguishing it from a legitimate request is the
`Origin` header — and that is the whole defence.

**CORS does not stop this.** CORS governs whether the attacker's script may *read the
response*. The request is still sent and the write still happens. A form post with
`application/x-www-form-urlencoded` is a "simple request": no preflight, nothing to
block.

## What `SameSite` already fixed

Every current browser defaults cookies to `SameSite=Lax` when the attribute is absent.
Lax means the cookie is withheld from cross-site **POST**, `fetch`, `XMLHttpRequest`,
iframes and image loads, and sent only on top-level GET navigations. That removes the
classic form-post attack above by default.

Node writes exactly the string you give it and validates nothing:

```console
Set-Cookie as written  -> sid=abc123; Path=/; HttpOnly
```

No `SameSite`, no `Secure` — the browser supplies the Lax default, your server does not.
Set it explicitly so the behaviour is visible in your code rather than inherited from
whichever browser is calling:

```js
res.setHeader('Set-Cookie', [
  `sid=${id}`,
  'HttpOnly',            // JavaScript cannot read it
  'Secure',              // HTTPS only
  'SameSite=Lax',        // withheld from cross-site writes
  'Path=/',
  'Max-Age=1209600',
].join('; '));
```

**`SameSite=Strict`** additionally withholds the cookie on top-level GET navigation, so
a user following a link from an email arrives logged out. Use it for admin surfaces and
accept the friction; `Lax` for everything else.

**`SameSite=None` re-opens the attack in full** and requires `Secure`. You need it for
genuine third-party embedding — a widget on someone else's domain. If you set it, tokens
are mandatory, not optional.

## When you still need a token

`SameSite=Lax` is a browser default, not a server guarantee. Add explicit defence when:

- you set `SameSite=None`, for embedding
- your API is called by a native or desktop client whose cookie handling you don't control
- you must support browsers or webviews that predate the default
- the endpoint is high-value enough that "the browser handles it" is not an answer you
  want to give in an incident review

### Origin checking — the cheapest real defence

```js
const ALLOWED = new Set(['https://app.example.com', 'https://admin.example.com']);

export function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const origin = req.headers.origin;
  if (origin) {
    if (!ALLOWED.has(new URL(origin).origin)) return res.status(403).end('cross-origin');
    return next();
  }
  // no Origin header: fall back to Referer, and reject if neither is present
  const referer = req.headers.referer;
  if (referer && ALLOWED.has(new URL(referer).origin)) return next();
  return res.status(403).end('missing origin');
}
```

`new URL(x).origin` is what makes the comparison correct rather than approximate:

```console
https://app.example.com        -> https://app.example.com
https://app.example.com:443    -> https://app.example.com     <- default port dropped
https://app.example.com/       -> https://app.example.com     <- path dropped
https://app.example.com:8443   -> https://app.example.com:8443
http://app.example.com         -> http://app.example.com      <- scheme is part of it
null                           -> URL threw Invalid URL
```

Note the last line: `Origin: null` is a **real value** browsers send from sandboxed
iframes and some redirects, and `new URL('null')` throws. Guard the parse or the check
becomes a 500 — which is at least a closed failure, but a confusing one.

### Double-submit tokens

Send a random value in both a cookie and a header; the attacker can set neither.

```js
import crypto from 'node:crypto';

const token = crypto.randomBytes(32).toString('base64url');   // 43 chars
```

Compare it in constant time, guarding the length first — `timingSafeEqual` throws on
mismatched lengths (see [page 16](./16-timing-attacks.md)):

```js
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
```

```console
same      = true
tampered  = false
short     = false
```

**The naive version has a hole:** a plain double-submit trusts that only your site can
write the cookie. A subdomain you don't control — or an XSS on `blog.example.com` — can
set a cookie for `.example.com`, then send the matching header. Bind the token to the
session with an HMAC:

```js
const sign = (sid, nonce) =>
  crypto.createHmac('sha256', SECRET).update(`${sid}.${nonce}`).digest('base64url');

const nonce = crypto.randomBytes(16).toString('base64url');
const csrfCookie = `${nonce}.${sign(sid, nonce)}`;

function verify(sid, value) {
  const [nonce, mac] = String(value).split('.');
  return Boolean(nonce && mac) && safeEqual(mac, sign(sid, nonce));
}
```

```console
right session  = true
other session  = false
```

A token lifted from another session no longer verifies. That is the difference between
double-submit and *signed* double-submit, and it costs one HMAC.

## What is not a defence

**A custom header alone**, on an endpoint that also accepts form encoding. Requiring
`X-Requested-With` works only because a cross-site `fetch` with a custom header triggers
a preflight — which means it works only if the endpoint refuses
`application/x-www-form-urlencoded`, `multipart/form-data` and `text/plain`. Enforce
`Content-Type: application/json` on writes and the custom header becomes meaningful.

**`POST`-only routing.** GET requests that mutate state are the original CSRF bug, but
switching to POST alone changes nothing — the form above is a POST.

**Checking `Referer` only.** It is stripped by privacy settings and by
`Referrer-Policy: no-referrer`, so a Referer-only check either fails closed for real users
or is bypassed by omission. Prefer `Origin`, fall back to `Referer`.

## Gotchas

**Symptom:** CSRF protection breaks after enabling a third-party embed
**Cause:** `SameSite=None` was required for the embed, removing the browser's default protection.
**Fix:** Add signed double-submit tokens; `None` without tokens is unprotected.

**Symptom:** Origin check throws `Invalid URL` and returns 500
**Cause:** `Origin: null` from a sandboxed iframe or a cross-origin redirect.
**Fix:** Handle the literal string `null` before parsing; treat it as untrusted.

**Symptom:** Logged-in users arrive at the site logged out from email links
**Cause:** `SameSite=Strict` withholds the cookie on top-level cross-site GET.
**Fix:** Use `Lax` for the main session, or a separate Strict cookie for sensitive routes.

**Symptom:** A CSRF token is accepted for a different user's session
**Cause:** Unsigned double-submit — the token is only compared against a cookie.
**Fix:** HMAC the token over the session id and verify with `timingSafeEqual`.

**Symptom:** Token comparison throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`
**Cause:** `timingSafeEqual` requires equal byte lengths and a wrong-length token was sent.
**Fix:** Compare lengths first and return `false`; the length was never secret.

**Symptom:** CORS is configured but state still changes from another origin
**Cause:** CORS restricts reading the response, not sending the request.
**Fix:** CSRF defence is a separate mechanism — `SameSite`, Origin check, or tokens.

## Interview questions

**★ Why doesn't CORS prevent CSRF?**
CORS decides whether the attacker's script may *read* your response. The request is still
delivered and the side effect still happens. A cross-site form POST with
`application/x-www-form-urlencoded` is a simple request with no preflight at all.

**★ Has `SameSite=Lax` made CSRF tokens obsolete?**
For a first-party app on modern browsers, largely yes — Lax is the default and withholds
cookies from cross-site writes. Tokens are still required when you set `SameSite=None`
for embedding, when non-browser clients are involved, or when you cannot rely on the
browser's default.

**★ What is the difference between double-submit and signed double-submit?**
Plain double-submit compares a cookie to a header and assumes only your origin can write
that cookie — a subdomain or a subdomain XSS breaks that assumption. Signed double-submit
HMACs the token over the session id, so a token from another session fails verification.
Verified: a valid token checked against a different session id returns `false`.

**★ Why check `Origin` rather than `Referer`?**
`Origin` is sent on cross-origin writes and contains only scheme, host and port, so
nothing leaks. `Referer` is frequently stripped by `Referrer-Policy` or privacy settings,
which makes a Referer-only check either bypassable or broken for legitimate users.

**Which requests should skip the CSRF check?**
`GET`, `HEAD` and `OPTIONS` — provided they are genuinely side-effect free. If a GET
changes state, that is the bug to fix first.

**What does Node do about CSRF by default?**
Nothing. It writes the `Set-Cookie` string you hand it, unvalidated — verified output was
`sid=abc123; Path=/; HttpOnly`, with no `SameSite` and no `Secure`. Every attribute is
yours to set.

---

← Prev: [Path traversal](./10-path-traversal.md) · Next → [SSRF](./12-ssrf.md)
