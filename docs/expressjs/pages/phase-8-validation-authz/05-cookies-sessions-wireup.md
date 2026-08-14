---
title: "Cookies and session wire-up"
sidebar_label: "05 · Sessions wire-up"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Express mounts cookie/session middleware and sets cookie flags. Choosing sessions vs JWT is Node Phase 8.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The asymmetry this page exists to explain is documented on both sides: **writing
> cookies is built in** — `res.cookie` with `httpOnly`, `secure`, `sameSite`, `signed`,
> `path` (default `"/"`), `maxAge` **in milliseconds**, and `expires` (*"if not specified
> or set to 0, creates a session cookie"*)
> ([response reference](https://expressjs.com/en/5x/api/response/)) — while **reading them
> is not**: `req.cookies` and `req.signedCookies` exist only *"when using cookie-parser
> middleware"* ([request reference](https://expressjs.com/en/5x/api/request/)).
> `secure: true` depends on `req.secure`, which behind a proxy depends on **`trust proxy`**
> ([Phase 9](../phase-9-hardening/README.md)) — that is the usual "works locally, no cookie
> in production" cause. Session stores, JWT signing and the stateless-versus-stateful
> decision are [Node Phase 8](../../../nodejs/pages/phase-8-security/README.md).

- `cookie-parser` before session  
- `res.cookie` flags: httpOnly, secure, sameSite (Phase 4)  
- Session store (`connect-redis`) is integration only — Redis syllabus owns Redis  

## The auth cookie, flag by flag

Every flag on a session cookie is defending against something specific. Setting
them by cargo cult is how one gets dropped in a refactor.

| Flag | Value | Defends against |
|---|---|---|
| `httpOnly` | **`true`** | XSS reading the cookie from JavaScript. Non-negotiable for a session |
| `secure` | **`true`** in production | The cookie travelling over plain HTTP |
| `sameSite` | **`'lax'`** default, `'strict'` for high-value | CSRF — the browser withholds it on cross-site requests |
| `path` | `'/'`, or narrower | Scope. Must match exactly on `clearCookie` |
| `maxAge` | Short, **in ms** | Unbounded session lifetime |
| `signed` | `true` (needs a cookie-parser secret) | Tampering — proves *you* issued it |

Two clarifications that matter:

- **`signed` proves origin, not truth.** A signed cookie has not been modified; its
  contents are still whatever you put there and are still *readable* by anyone
  holding the cookie. Do not treat signing as encryption.
- **`sameSite: 'lax'` is a browser default now**, so relying on the default silently
  changes behaviour for genuinely cross-site flows. Set it explicitly and know why.

`SameSite=None` requires `Secure`, and browsers reject the combination without it —
so a cross-site cookie that "just stopped working" is usually this pair.

## Mount order, and why it is not arbitrary

```js
app.use(cookieParser(process.env.COOKIE_SECRET));  // 1. populates req.cookies
app.use(session({store, ...}));                    // 2. reads the session cookie
app.use(requireAuth(deps));                        // 3. reads req.session/req.user
```

Each layer consumes what the previous produced — the documented reason
`req.cookies` is empty otherwise. Getting this wrong produces the confusing
symptom that the browser *is* sending the cookie (visible in devtools) and the
server behaves as if it were not.

**Give `cookieParser` the same secret the session uses**, or signed cookies verify
against a different key and silently fail to appear in `req.signedCookies`.

## Rotate the session id on privilege change

The one security rule that belongs in this phase rather than Node's, because it is
a wiring decision:

**On login, and on any privilege elevation, issue a new session id.** Otherwise an
attacker who plants a known session id in a victim's browser (session fixation)
still holds a valid id after the victim authenticates — their id, now attached to
the victim's account.

Session libraries expose this as a regenerate step. It costs one line and closes an
attack that is otherwise invisible in testing.

## Trade-off

Cookie-based sessions give you `httpOnly` — the browser stores and sends the
credential and JavaScript cannot read it, which removes token theft from the XSS
threat model. That is a large, real benefit, and it is why cookies remain the
default for browser clients.

They cost you CSRF exposure (cookies are sent automatically, which is exactly the
property `sameSite` and CSRF tokens exist to constrain), and they are awkward for
non-browser clients — a mobile app or a service caller wants a header, not a cookie
jar.

Bearer tokens in a header invert both: no CSRF, and trivial for API clients, but
the token must live somewhere JavaScript can reach, which puts theft back on the
table. **Cookies for browsers, bearer tokens for API clients** is a defensible split
— and Node Phase 8 covers the stateless-versus-stateful half of the decision.

## Gotchas

**Symptom:** `req.cookies` is `{}` although the browser is sending cookies  
**Cause:** `cookie-parser` not mounted, or mounted after the route  
**Fix:** Mount it first. Reading cookies is not built into Express

**Symptom:** The auth cookie never arrives in production but works locally  
**Cause:** `secure: true` with TLS terminated at a proxy, and `trust proxy` unset — so
Express believes the connection is insecure  
**Fix:** Configure `trust proxy` (Phase 9) so `req.secure` reflects the client's connection

**Symptom:** `req.signedCookies` is empty despite `signed: true`  
**Cause:** `cookieParser()` mounted without a secret, or with a different one  
**Fix:** One secret, passed to `cookieParser(secret)`, matching the session's

**Symptom:** Logout leaves the user logged in  
**Cause:** `clearCookie` called without the original `path`/`domain`, so it cleared a
different cookie  
**Fix:** Pass identical options to `clearCookie`
([page 08](08-tenant-and-logout.md))

**Symptom:** A session survives a login as a different user  
**Cause:** No session regeneration on authentication — session fixation  
**Fix:** Issue a new session id at login and on any privilege change

**Symptom:** A cross-site flow breaks after a browser update  
**Cause:** `SameSite` defaulting to `Lax`, or `None` sent without `Secure`  
**Fix:** Set `sameSite` explicitly; `None` always with `Secure`

## Interview questions

**★ Why mount cookie-parser before session middleware?**  
Session libraries read cookies from the parsed object.

**★ Which parts of cookie handling does Express provide, and which does it not?**  
Writing is built in — `res.cookie` with the full flag set. **Reading is not**:
`req.cookies` and `req.signedCookies` exist only when cookie-parser is mounted. That
asymmetry surprises people who assume `req.cookies` is native.

**★ What does a signed cookie actually guarantee?**  
That you issued it and it has not been tampered with. It is **not encryption** — the
value is still readable by anyone holding the cookie, so nothing secret goes in it.

**★ Why does a `secure` cookie disappear in production but work locally?**  
TLS terminates at a proxy, so Express sees a plain HTTP connection, `req.secure` is
false, and the browser is never sent the cookie. `trust proxy` fixes what Express
believes about the connection.

**Why regenerate the session id at login?**  
Session fixation. An attacker who plants a known id in the victim's browser
otherwise holds a valid session for the victim's account the moment they log in.

**Cookies or bearer tokens?**  
Cookies for browsers — `httpOnly` takes credential theft out of the XSS threat model
— at the price of CSRF exposure. Bearer tokens for API clients: no CSRF, but the
token lives where JavaScript can reach it.


---

← Prev: [Authn middleware](04-authn-middleware.md) · Next → [RBAC middleware](06-rbac-middleware.md)
