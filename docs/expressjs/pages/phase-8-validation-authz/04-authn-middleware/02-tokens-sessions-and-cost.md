---
title: "Tokens, sessions and cost"
sidebar_label: "02 · Tokens, sessions and cost"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**A stateless token and a server-side session answer the same question. They
differ in where the truth lives, and that single difference decides what you can
revoke, what every request costs, and what you can never take back.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Express ships
> **no** session or token support: the six built-ins are `json`, `urlencoded`,
> `raw`, `text`, `static` and `Router`
> ([express reference](https://expressjs.com/en/5x/api/express.html)), and
> sessions and cookie parsing are separate packages listed under
> [Express middleware](https://expressjs.com/en/resources/middleware.html) —
> `express-session` (which sets `req.session` and whose default `MemoryStore` its
> README states is not meant for production) and `cookie-parser` (which populates
> `req.cookies`). Bearer credentials are
> [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html); the JWT claim set,
> including `exp`, `iat`, `sub` and `jti`, is
> [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519.html) §4.1; the 401 pairing
> is [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.5.2 and **431
> Request Header Fields Too Large** is
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §5. Cookie attributes
> (`HttpOnly`, `Secure`, `SameSite`, and that `SameSite=None` requires `Secure`)
> are [MDN · Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie).
> Node's header limit is its documented `--max-http-header-size` default of
> **16 KiB** ([Node CLI](https://nodejs.org/api/cli.html#--max-http-header-sizesize)).
> Signing, hashing and storage mechanics are
> [Node Phase 8](../../../../nodejs/pages/phase-8-security/README.md);
> the store itself is
> [Redis](../../../../redis/pages/README.md). **The design guidance is this
> bible's.**

## One question tells them apart

[Chunk 01](01-one-question-only.md) said authentication answers *who is this?*
This page is about **how it answers**, and there is really only one question:

> **When a request arrives, does the server already hold the truth about this
> credential, or does the credential carry it?**

| | Stateless token | Server-side session |
|---|---|---|
| Credential in the request | signed token (usually `Authorization: Bearer …`) | opaque session id, usually in a cookie |
| Where the truth lives | **in the credential**, signed | **on the server**, keyed by the id |
| Verifying it | a signature check, local, no I/O | a **store lookup** — a round trip |
| Revoking it | ⛔ not possible without adding state | ✅ delete the record |
| Changing a role | takes effect at **next issue** | takes effect on **next request** |
| Size on the wire | grows with the claims you put in | one small id |

Everything else people argue about — "JWTs don't scale", "sessions don't work
across services" — is downstream of those six rows.

## What `req.user` should carry, and what it costs

Chunk 01 said `req.user` holds identity plus whatever the credential already
proves. The cost of ignoring that is per request, on every route:

```js
// ⛔ habit: "load the user" on every authenticated request
req.user = await users.findById(payload.sub);       // a query per request

// ✅ decision: the token already proves these
req.user = {id: payload.sub, role: payload.role, tenantId: payload.tid};
```

The first line is not wrong — it is **a decision that must be made
deliberately**. It buys you fresh data (a disabled account stops working
immediately) and it costs a database round trip on every single request,
including the ones that never touch the user record.

🔴 **The middle path is the trap.** Loading the user *only on some routes* means
`req.user` has **two different shapes** depending on which middleware ran, and
downstream code cannot tell which one it got. If you load, load everywhere; if
you do not, fetch the record in the service that needs it, where the dependency
is visible in the signature
([Phase 7 · 02](../../phase-7-layering/02-domain-vs-transport.md)).

## What a signature check does and does not prove

Verifying a signed token proves **the token was issued by the holder of the key
and has not been altered**, plus whatever the library checks about `exp`. That is
all. It does **not** prove:

- that the account still exists,
- that the password has not been changed since,
- that the role in the token is still the role in the database,
- that an administrator has not disabled the account,
- that the user has not logged out.

Every one of those is a **staleness window** whose width is the token's lifetime.
This is the real content of "you cannot revoke a JWT": you can, but only by
adding exactly the server-side state the stateless design was chosen to avoid.

## Revocation, honestly

There are three answers, and only the third is free:

**1 · A denylist.** Store the revoked token's `jti` until its own `exp` passes,
and check it on every request. It works, and it re-introduces a lookup per
request — you now have a session, wearing a token's clothes. It is still worth it
when revocation is rare and the lookup is a cheap in-memory store
([Redis](../../../../redis/pages/README.md)); the entry's TTL should be the
token's **remaining lifetime**, so the list drains itself.

**2 · A version counter.** Keep `tokenVersion` on the user, put it in the token,
and compare. Same lookup, but it revokes *every* token for that user at once —
the right shape for "log me out everywhere" and for a password change.

**3 · Short lifetimes.** Accept the staleness window and make it small. This is
the only one that costs nothing per request, and it is why the pairing below
exists.

## Short access, long refresh

The standard arrangement, and what each half is for:

| | Access token | Refresh token |
|---|---|---|
| Lifetime | minutes | days or weeks |
| Sent | on every request | **only** to the refresh endpoint |
| Stored | memory, or a cookie | `HttpOnly` cookie, or the client's secure storage |
| Revocable | no — it just expires | **yes**, it is a stored record |

The refresh token is state. That is the point: **all the revocability lives in
the one credential that is presented rarely**, so the common path stays a local
signature check.

🔴 **Rotate on use, and treat reuse as theft.** Issue a new refresh token every
time one is redeemed and invalidate the old. If an already-redeemed token is
presented again, the only two explanations are a stolen credential and a client
bug — and you cannot tell which, so **invalidate the whole family** and make the
user log in again. Without rotation, a stolen refresh token is a permanent
credential.

⚠️ **The refresh endpoint is the highest-value route in the application.** Rate
limit it ([Phase 9 · 04](../../phase-9-hardening/04-rate-limiting.md)), and
never let it accept the access token as input.

## Cookies or `Authorization`?

The choice is not about security in the abstract — it is about **what the browser
does automatically**:

- A **cookie** is attached by the browser to matching requests without your code
  asking. That is why it survives a page reload, and it is exactly why CSRF
  exists: a form on another origin can cause the request, and the cookie rides
  along. `SameSite` is the mitigation and the flags are not optional —
  `HttpOnly`, `Secure`, and `SameSite=Lax` as a floor (`None` **requires**
  `Secure`)
  ([Phase 9 · 05](../../phase-9-hardening/05-csrf-and-injection.md),
  [Phase 3 · 08](../../phase-3-requests/08-cookies-and-helpers.md)).
- An **`Authorization` header** is attached only by code that chooses to. There
  is no CSRF, because no other origin's page can make the browser send it — but
  the token must now live somewhere the code can read, which puts XSS squarely in
  scope.

**Neither is "the secure one".** A cookie trades XSS exposure for CSRF exposure;
a header does the reverse. Cross-origin callers add a third consideration: both
forms need CORS configured, and cookies additionally need credentials allowed on
both ends ([Phase 9 · 02](../../phase-9-hardening/02-cors.md)). The wiring for
each is [page 05](../05-cookies-sessions-wireup.md).

## Size is a real constraint

A token is sent on **every** request, so every claim you add is paid for on every
request, forever. Node's default header limit is 16 KiB across all headers
combined, and exceeding it is a **431** — a failure that appears only for the
users who accumulated the most claims, usually the ones with the most roles.

That is the mechanism behind a rule worth keeping: **put identifiers in the
token, not data.** An id, a role, a tenant. Not a permission list, not a display
name, not preferences — those belong in a request the client makes once.

## Choosing, for real

This bible's recommendation, stated as such:

- **One application, browser clients** → **server-side sessions**. Revocation is
  free, the cookie is small, and the store lookup is a millisecond you were going
  to spend on the database anyway.
- **An API with non-browser clients, or several services verifying the same
  credential** → **short-lived tokens plus a refresh token**. The property you are
  buying is that a service can verify without calling the issuer.
- **Either way, decide what revocation means before you ship.** "Log out
  everywhere", "disable this account now" and "this role changed" are product
  requirements, and a design that cannot satisfy them is not a trade-off you made
  — it is one that made itself. Logout is [page 08](../08-tenant-and-logout.md).

## Gotchas

**Symptom:** A disabled account keeps working for another hour
**Cause:** The access token is still within its lifetime, and nothing checks the
account per request
**Fix:** Shorten the lifetime, or add a denylist / version check — knowing it
costs a lookup

**Symptom:** A role change does not take effect until the user logs out
**Cause:** The role is a claim, and claims are fixed at issue time
**Fix:** Re-issue on the change, or read the role from the store per request

**Symptom:** 431 Request Header Fields Too Large, but only for some users
**Cause:** A permission list in the token; the users with the most roles cross
Node's 16 KiB header limit
**Fix:** Identifiers in the token, data behind an endpoint

**Symptom:** Sessions vanish on deploy, or work only on one instance
**Cause:** `express-session`'s default `MemoryStore`, which its README states is
not for production
**Fix:** A shared store; the process must not be the source of truth

**Symptom:** A stolen refresh token grants access indefinitely
**Cause:** Refresh tokens are not rotated, so redeeming one leaves it valid
**Fix:** Rotate on every use, and treat reuse of a redeemed token as theft —
invalidate the family

**Symptom:** Cross-site requests carry the session cookie
**Cause:** No `SameSite` attribute
**Fix:** `SameSite=Lax` as a floor, `HttpOnly` and `Secure` always; `None`
requires `Secure`

**Symptom:** `req.user` has different shapes in different handlers
**Cause:** The full user is loaded on some routes and only decoded on others
**Fix:** One shape. Load everywhere, or nowhere and fetch in the service

## Interview questions

**★ What actually differs between a JWT and a server-side session?**
Where the truth lives. A session's id is a key into server state, so verifying it
is a lookup and revoking it is a delete. A token carries its claims signed, so
verifying it is local and revoking it needs state you deliberately removed.
Everything else follows from that.

**★ How do you revoke a stateless token?**
By adding state: a denylist keyed by `jti` with a TTL equal to the token's
remaining lifetime, or a per-user version counter compared on each request. Both
cost a lookup per request. The alternative is to accept a staleness window and
keep lifetimes short, which is what the refresh-token pattern is for.

**★ Why rotate refresh tokens, and what does reuse mean?**
Rotation means a redeemed refresh token becomes invalid and a new one is issued.
It matters because a stolen refresh token is otherwise a permanent credential.
Reuse of a redeemed token means either theft or a client bug, and you cannot tell
which — so invalidate the whole family.

**★ Cookie or `Authorization` header?**
A cookie is sent by the browser automatically, which is why it survives reload
and why CSRF applies; a header is sent only by your code, which removes CSRF and
puts the token where XSS can reach it. Neither is the secure one — pick the
exposure you can mitigate, and set `HttpOnly`, `Secure` and `SameSite` if you
pick the cookie.

**What should never go in a token?**
Anything that is data rather than an identifier — permission lists, display
names, preferences. It is re-sent on every request forever, and enough of it
produces a 431 for exactly the users with the most roles.

**Is `req.session` an Express feature?**
No. Express ships no session support; `express-session` is a separate package
that adds `req.session`, and its default in-memory store is documented as not
meant for production.

---

← Prev: [One question only](01-one-question-only.md) · Index: [Authn middleware](README.md) · Next → [Mounting and testing](03-mounting-and-testing.md)
