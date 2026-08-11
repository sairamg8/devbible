---
title: "Sessions vs JWT — the honest comparison"
sidebar_label: "02 · Sessions vs JWT"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `node:crypto` for the signing primitives.

**The whole trade is revocation against a database lookup.** Everything else people
argue about — "stateless", "scales better", "modern" — is downstream of that one
sentence, and most of it is repeated without being checked.

## What each one actually is

**A session** is a random opaque id in a cookie. The server holds the truth:

```js
const sessionId = randomBytes(32).toString('base64url');
await redis.set(`sess:${sessionId}`, JSON.stringify({userId, roles}), {EX: 86400});
res.cookie('sid', sessionId, {httpOnly: true, secure: true, sameSite: 'lax'});
```

The cookie means nothing on its own. Look it up or you know nothing.

**A JWT** is the claims themselves, signed so they cannot be edited:

```js
const header  = base64url(JSON.stringify({alg: 'HS256', typ: 'JWT'}));
const payload = base64url(JSON.stringify({sub: userId, roles, exp: nowSec + 900}));
const sig     = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
const token   = `${header}.${payload}.${sig}`;
```

Anyone can *read* it — base64url is encoding, not encryption. Only the key holder can
*forge* it. The server needs no storage to validate it, which is the appeal and the
whole problem.

## The comparison, without the marketing

| | Session | JWT |
|---|---|---|
| Server storage | Yes — Redis or a table | None to validate |
| Validation cost | A lookup (~0.5 ms to Redis) | An HMAC verify (~microseconds) |
| **Revocation** | **Instant — delete the row** | **Not possible until expiry** |
| Change roles mid-session | Next request sees it | Not until the token is reissued |
| Size on the wire | ~32 bytes | 300–1000+ bytes, every request |
| Readable by the client | No | Yes — never put secrets in it |
| Cross-domain / mobile | Cookies get awkward | Easy, a bearer header |
| Failure mode | Session store down = everyone out | Leaked key = forge anything, silently |

**Revocation is the row that decides it.** A user logs out, an admin is demoted, an
account is compromised — with sessions you delete a key and the next request is denied.
With a JWT you cannot: the token is valid because the maths says so, and the server has
nothing to check it against. The standard answer is short expiry plus a refresh token —
which means you now maintain a revocation list or a refresh-token store, and **you have
rebuilt sessions with extra steps**.

## The claims worth checking

**"JWTs are stateless, so they scale better."** True only until you need logout,
role changes, or a ban to take effect. Then you add a denylist, which is a lookup on
every request — the exact cost you adopted JWTs to avoid, plus token size.

**"A session lookup is a database hit per request."** It is a Redis `GET` — sub-millisecond,
and you are almost certainly already calling Redis or Postgres in that handler anyway.
Weigh it against sending an extra 500 bytes on every request, forever.

**"JWTs work across services."** This one is real. If several services must verify a
token without sharing a session store, asymmetric JWTs (RS256/EdDSA) let them verify
with a public key and no shared state. That is the strongest genuine argument, and it is
an argument about *service topology*, not about login.

**"Sessions do not work for mobile or SPAs."** They do — a cookie is just a header, and
`SameSite`/CORS handle the browser cases. It is a configuration question, not a
capability one.

## Choosing

**Default to sessions.** For a single application with a browser front end — which is
most MERN/PERN work — an opaque session id in an `HttpOnly` cookie is simpler, smaller,
revocable, and has no key-rotation story to get wrong.

**Reach for JWTs when** several independent services must verify identity without a
shared store, when a third party consumes your API, or when you are the identity
provider issuing tokens for others. Use **asymmetric** signing there so verifiers hold
only a public key.

**The hybrid is what large systems actually run:** a short-lived access JWT (5–15
minutes) for cheap verification, plus an opaque, revocable refresh token in an
`HttpOnly` cookie, stored server-side. You accept a bounded window — up to the access
token's lifetime — during which a revoked user still works. Choose that window
deliberately; it is a real security property, not a config default.

## If you do use JWTs

The library handles the maths. These are the parts it will not decide for you:

```js
const claims = jwt.verify(token, PUBLIC_KEY, {
  algorithms: ['RS256'],          // pin it — never trust the header's `alg`
  issuer:     'https://auth.example.com',
  audience:   'shop-api',
  clockTolerance: 5,
});
```

**Pin the algorithm.** The classic attack is a token arriving with `alg: "none"`, or
`alg: "HS256"` against a service expecting RS256 — where the *public* key gets used as
an HMAC secret, and the public key is public. Passing `algorithms` explicitly closes
both. Any library still honouring `alg: none` by default is one to leave.

**Check `iss` and `aud`.** Without them, a valid token for another service is a valid
token for yours.

**Keep expiry short**, because it is your only revocation.

**Never put secrets in the payload.** It is readable by anyone holding the token,
including whoever it leaks to.

**Have a key rotation plan** — a `kid` header and more than one accepted key — before you
need one.

## Gotchas

**Symptom:** A logged-out user's token still works
**Cause:** JWTs are valid until expiry; logout is a client-side gesture.
**Fix:** Short expiry plus a server-side denylist or refresh-token store — that is,
sessions for the part that must be revocable.

**Symptom:** A demoted admin keeps admin rights for 15 minutes
**Cause:** Roles are baked into the token at issue time.
**Fix:** Keep authorisation data server-side and look it up, or reissue on privilege
change (page 04).

**Symptom:** Anyone can read data you put in the token
**Cause:** JWT payloads are base64url-encoded, not encrypted.
**Fix:** Put an id in the token; keep the data server-side.

**Symptom:** A forged token is accepted
**Cause:** `alg` taken from the token header — `none`, or HS256 verified against the
public key.
**Fix:** Pin `algorithms` explicitly on every verify.

**Symptom:** Requests grew by a kilobyte each
**Cause:** Claims accumulating in the token.
**Fix:** Reference, do not embed.

**Symptom:** Everyone is logged out at once
**Cause:** Session store restarted without persistence, or the signing key rotated with
no overlap.
**Fix:** Persist sessions; support two valid keys during rotation.

**Symptom:** Tokens from a sibling service are accepted
**Cause:** `aud` and `iss` not validated.
**Fix:** Validate both.

## Interview questions

**★ Sessions or JWTs — how do you choose?**
On revocation. Sessions are revocable instantly because the server holds the truth; a
JWT is valid until it expires, because validity is a signature check with nothing to
consult. If you need logout, bans or role changes to take effect immediately — most
applications — sessions are simpler and correct. JWTs earn their place when independent
services must verify identity without a shared store.

**★ Are JWTs really stateless?**
Only until the first requirement that needs state — logout, ban, role change. Then you
add a denylist or refresh-token store, which is a lookup per request: the cost you
adopted JWTs to avoid, plus a larger token on every request.

**★ What is the `alg: none` attack?**
A forged token declares `alg: "none"` and a library that trusts the header skips
verification. The variant is sending `HS256` to a service expecting `RS256`, so the
public key is used as an HMAC secret — and it is public. Always pass an explicit
`algorithms` allowlist.

**★ Can you put user data in a JWT?**
Non-secret data, yes — that is the point of claims. But the payload is base64url, not
encrypted, so anyone holding the token reads it. And embedded data goes stale: roles in
a token reflect issue time, not now.

**What does a hybrid setup look like?**
A short-lived access JWT (5–15 min) for cheap verification, plus an opaque revocable
refresh token in an `HttpOnly` cookie, stored server-side. You accept a revocation
window equal to the access token's lifetime — a deliberate trade, not a default.

**Why asymmetric signing for multi-service setups?**
Verifiers only need the public key, so a compromised service cannot mint tokens. With
HS256 every verifier holds the signing secret, and every one of them is a forgery risk.

---

← Prev: [Password storage](./01-password-storage.md) · Next → [Where to store tokens](./03-token-storage.md)
