---
title: "Stateless or database sessions is not a performance question — it is settled by whether you can answer 'log this user out, now' with yes"
sidebar_label: "Stateless vs stateful sessions"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (docs `lastUpdated: 2026-08-25`), Auth.js [Session strategies](https://authjs.dev/concepts/session-strategies), and Clerk's [Session tokens](https://clerk.com/docs/guides/sessions/session-tokens.md) reference. Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4**. Prior page: [The Data Access Layer](03b-the-data-access-layer-server-only-and-the-dto.md).

**There are exactly two places session state can live, and the Next.js docs name both: in the cookie, or in a database with only an identifier in the cookie. Every trade you will read about — speed, cost, scaling, edge compatibility — is downstream of one property. A stateless token is valid until it expires because nothing else is consulted. A database session is valid until you delete a row. When a support ticket says "we think this account is compromised, sign them out everywhere", one model answers in a query and the other answers "in up to seven days". Decide that first; the rest follows.**

## The two models, as the docs define them

> *"**Stateless**: Session data (or a token) is stored in the browser's cookies. The cookie is sent with each request, allowing the session to be verified on the server. This method is simpler, but can be less secure if not implemented correctly."*

> *"**Database**: Session data is stored in a database, with the user's browser only receiving the encrypted session ID. This method is more secure, but can be complex and use more server resources."*

Auth.js draws the same line and is unusually candid about the cost of each. Its disadvantage list for the JWT strategy opens with the sentence that decides most real arguments:

> *"Expiring a JSON Web Token before its encoded expiry is not possible - doing so requires maintaining a server-side blocklist of invalidated tokens (at least until they truly expire) and checking every token against the list every time a token is presented. Auth.js will destroy the cookie, but if the user has the JWT saved elsewhere, it will be valid (the server will accept it) until it expires."*

Read the middle clause slowly. **Signing out deletes the cookie, not the token.** If the token was captured — by a proxy, by an XSS before you added `HttpOnly`, by a support engineer pasting a HAR file into a ticket — the sign-out button did nothing to it.

And the corresponding advantage list for database sessions:

> *"Database sessions can be at any time modified server-side, so you can implement features that might be more difficult - but not impossible - using the JWT strategy, etc.: 'sign out everywhere', or limiting concurrent logins."*

## What each model actually costs

| Property | Stateless (JWT) | Database session |
|---|---|---|
| Per-request work | Verify a signature | Verify + one indexed read |
| Revoke one session | Not possible before `exp` without a blocklist | `DELETE` one row |
| Revoke all of a user's sessions | Not possible before `exp` without a version column or blocklist | `DELETE WHERE userId = …` |
| Role change takes effect | At next token issue | At next request |
| Cookie size | Grows with claims; ~4096-byte browser limit | Constant — one identifier |
| Horizontal scale | No shared state | Shared store on the request path |
| A leaked token is worth | Everything until `exp` | Everything until the row is deleted |

Auth.js documents the size ceiling explicitly, along with what it does about it:

> *"As with database session tokens, JSON Web Tokens are limited in the amount of data you can store in them. There is typically a limit of around 4096 bytes per cookie, though the exact limit varies between browsers. … Auth.js implements session cookie chunking so that cookies over the 4kb limit will get split and reassembled upon parsing. However, since this data needs to be transmitted on every request, you need to be aware of how much data you want to transfer using this technique."*

Chunking removes the hard failure and leaves the real cost: **every byte in the token is paid on every request, forever.** A permissions array that grows with the product is a bandwidth regression nobody attributes to auth.

The Next.js guide's payload rule is the right discipline regardless of model:

> *"The payload should contain the **minimum**, unique user data that'll be used in subsequent requests, such as the user's ID, role, etc. It should not contain personally identifiable information like phone number, email address, credit card information, etc, or sensitive data like passwords."*

⚠️ Note *why*, and it is not only privacy. A signed JWT is **not encrypted** — the payload is base64url, readable by anyone holding the token, including the browser and every proxy in between. Auth.js's own JWT session is additionally *encrypted* ("the JWT is encrypted with a secret key only known to the server"), which is a JWE and a different guarantee from a plain signed JWT you rolled yourself. Do not assume your hand-rolled `SignJWT` payload is private; it is not.

## The stateless implementation, and its four honest mitigations

You do not have to abandon stateless sessions to get revocation. You have to buy it back, and there are four ways, in ascending cost:

**1 — Short expiry plus rotation.** Auth.js's own answer:

> *"Shorter session expiry times are used when using JSON Web Tokens as session tokens to allow sessions to be invalidated sooner and simplify this problem."*

and the UX repairs it ships to make that bearable:

> *"Auth.js enables advanced features to mitigate the downsides of using shorter session expiry times on the user experience, including automatic session token rotation, optionally sending keep-alive messages (session polling) to prevent short-lived sessions from expiring if there is a window or tab open, background re-validation, and automatic tab/window syncing that keeps sessions in sync across windows any time session state changes or a window or tab gains or loses focus."*

This narrows the window; it never closes it. A fifteen-minute token means a stolen credential is good for up to fifteen minutes.

**2 — A session-version claim.** One integer on the user row, copied into every token. Bumping it invalidates every token that user holds, at the cost of one read per request — which is most of the database session's cost, for one of its benefits.

```ts
// lib/session-version.ts
import 'server-only'
import { db } from '@/lib/db'
import { cache } from 'react'

export const currentSessionVersion = cache(async (userId: string) => {
  const row = await db.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } })
  return row?.sessionVersion ?? null
})

export async function signOutEverywhere(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  })
}
```

```ts
// inside the DAL's session read
const payload = await decodeSession(token)
if (!payload) return null
const version = await currentSessionVersion(payload.userId)
if (version === null || version !== payload.sessionVersion) return null
```

**3 — A blocklist.** Store the `jti` of every revoked token until its `exp` passes, and check it on every request. Correct, and now you are running a session store that also has all the token's disadvantages.

**4 — A refresh-token pair.** A short-lived access token plus a long-lived refresh token that is *stateful*. Revocation deletes the refresh token; the access token lives out its few minutes. This is the model hosted providers use, and the reason is that it puts the state in one place that is consulted rarely.

The Next.js guide points at the mechanism without prescribing an implementation: *"Check if your auth library supports refresh tokens, which can be used to extend the user's session."*

🔴 If you implement rotation yourself, rotate the refresh token on every use and treat **reuse of an already-rotated refresh token as a compromise signal** — the legitimate client cannot present a token it already exchanged, so a second presentation means someone copied it. The correct response is to revoke the whole family, not to reject the single request. The Next.js documentation does not cover refresh-token rotation, so treat this paragraph as standard OAuth practice rather than a framework guarantee.

## The stateful implementation the docs actually show

The guide's database-session example is not "put a random id in a cookie". It signs the session id, and says why:

> *"Encrypt the session ID before storing it in the user's browser, and ensure the database and cookie stay in sync (this is optional, but recommended for optimistic auth checks in Proxy)."*

```ts
// lib/session-db.ts
import 'server-only'
import { db } from '@/lib/db'
import { signSession } from '@/lib/session'
import { writeSessionCookie, sessionExpiry } from '@/lib/session-cookie'

export async function createDatabaseSession(userId: string) {
  const expiresAt = sessionExpiry()

  const session = await db.session.create({
    data: { userId, expiresAt },
    select: { id: true },
  })

  const token = await signSession({ sessionId: session.id, expiresAt })
  await writeSessionCookie(token, expiresAt)
}
```

The signature is what lets the proxy layer decide "there is plausibly a session here" without touching the database — a signed id it can verify locally. The database read still happens, but in the DAL, once, where it belongs.

The docs add two operational notes worth keeping:

> *"For faster access, you may consider adding server caching for the lifetime of the session. You can also keep the session data in your primary database, and combine data requests to reduce the number of queries."*

> *"You may opt to use database sessions for more advanced use cases, such as keeping track of the last time a user logged in, or number of active devices, or give users the ability to log out of all devices."*

Auth.js records one more caveat about what a database session actually stores, which surprises people who expect it to be a key-value bag:

> *"The session object is not persisted server-side, even when using database sessions - only data such as the session token (id), the user, and the expiry time is stored in the session table. If you need to persist session data server-side, you must save it elsewhere."*

## Refreshing a session, and the sliding-window trap

The guide's `updateSession()` re-sets the cookie with a later expiry — and, notably, **re-sets the same token**:

```ts
const session = (await cookies()).get('session')?.value
const payload = await decrypt(session)
if (!session || !payload) return null
const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
cookieStore.set('session', session, { httpOnly: true, secure: true, expires, sameSite: 'lax', path: '/' })
```

For a **database** session that is correct and complete: the cookie carries an identifier, the expiry that matters is the row's, and you extend both. For a **stateless** session it is a trap. Extending the *cookie's* lifetime does not extend the *token's* `exp`. The browser dutifully keeps sending a token the server rejects, and the user is bounced to `/login` at the moment the token expires regardless of how recently they were active. If you want a sliding window on a stateless session you must **re-sign** the payload with a new `exp` and set the new token.

## Clock skew is a real failure mode, not a footnote

`exp`, `nbf` and `iat` are absolute timestamps compared against *the verifying machine's clock*. A serverless fleet whose instances drift by a few seconds will reject freshly-minted tokens with "not before" errors — intermittently, on some instances only, which is the worst shape a bug can have. Clerk exposes this as a first-class knob, describing `nbf` as:

> *"The time before which the token is considered invalid, as a Unix timestamp. Determined using the **Allowed Clock Skew** JWT template setting in the Clerk Dashboard."*

If you verify tokens yourself, allow a small tolerance (a handful of seconds) and, more importantly, never issue a token with `nbf` in the future unless you mean it.

## So which one

- **You cannot name a way to revoke a session today → database sessions.** This is most applications. Compliance, support and incident response all eventually ask for it.
- **A token has to cross a service boundary you do not control → stateless**, short-lived, plus a stateful refresh token.
- **A read-heavy public product where sessions are advisory → stateless** is genuinely cheaper and the risk is genuinely small.
- **You are choosing stateless to avoid a database you already have → choose database sessions.** The read is indexed and single-row, it is in the same request as your other queries, and you get "sign out everywhere" for free.

Auth.js supports both behind one config key, so the decision is reversible — see [03e · Auth.js in the App Router](03e-authjs-nextauth-in-the-app-router.md).

## Gotchas

**★ Symptom: a user reports their account was compromised; you click "sign out all sessions" and they are still signed in from the attacker's machine.** Cause: stateless sessions. The button deleted a cookie in *their* browser. Auth.js states it exactly: *"Auth.js will destroy the cookie, but if the user has the JWT saved elsewhere, it will be valid … until it expires."* Fix: add a version claim checked on every request, and bump it.

```ts
await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } })
```

**★ Symptom: a demoted admin keeps admin powers for the rest of the day.** Cause: the role was baked into the token at sign-in, and nothing re-reads it. Fix: either move authorization-relevant claims out of the token and read them per request in the DAL, or bump the session version on any role change so the old token stops validating.

**★ Symptom: users are logged out abruptly at exactly seven days regardless of activity, even though a "refresh" runs.** Cause: the refresh extended the cookie's `expires` but re-set the *same* token, whose `exp` is unchanged. Fix: re-sign with a new expiry and write the new token.

```ts
const expiresAt = sessionExpiry()
const renewed = await signSession({ ...payload, expiresAt })
await writeSessionCookie(renewed, expiresAt)
```

**★ Symptom: requests fail intermittently with a "not before" or "token used too early" error on some instances only.** Cause: clock drift between the signing machine and the verifying machine, with `nbf` set to issue time. Fix: allow a small tolerance when verifying, and do not set `nbf` unless the token genuinely must not be usable yet.

**★ Symptom: response headers grow past what a load balancer accepts, or the session cookie stops round-tripping in one browser and not another.** Cause: claims accreted into the token past the ~4096-byte per-cookie limit. Fix: store the identifier and read the rest per request. If you are on Auth.js, chunking hides the failure but not the per-request bandwidth cost.

**★ Symptom: a support engineer can read a customer's email address out of a session token pasted into a ticket.** Cause: a signed JWT is encoded, not encrypted; the payload is public to anyone holding the token. Fix: put only the id and coarse role in the payload, exactly as the guide instructs, and look everything else up server-side.

**★ Symptom: "sign out everywhere" works, and users who were signed out on one device get signed out on all of them every time an admin edits any user field.** Cause: the session version is bumped by a generic user-update path. Fix: increment it only from an explicit `signOutEverywhere` and from credential changes (password reset, MFA enrolment), never from a general update.

**★ Symptom: a database session's row is deleted but the user stays signed in.** Cause: the DAL verified the cookie's signature and trusted the payload without loading the row — a stateless check wearing a stateful schema. Fix: after verifying the signature, load the session row and reject if it is missing or expired.

```ts
const payload = await decodeSession(token)
if (!payload) return null
const row = await db.session.findUnique({ where: { id: payload.sessionId }, select: { userId: true, expiresAt: true } })
if (!row || row.expiresAt < new Date()) return null
```

**★ Symptom: expired session rows accumulate until the sessions table is the largest in the database.** Cause: nothing deletes them; the cookie expiring client-side does not touch the row. Fix: a scheduled `DELETE FROM sessions WHERE expires_at < now()`, plus an index on `expires_at` so it is cheap.

**★ Symptom: a stolen refresh token keeps working after the legitimate user refreshes.** Cause: refresh tokens are not rotated, so both parties hold a valid one indefinitely. Fix: issue a new refresh token on every exchange, invalidate the old one, and treat presentation of an already-exchanged token as evidence of theft — revoke the entire family rather than just failing the request.

## Interview questions

**★ What single question settles stateless versus database sessions?**
"Can we sign this user out right now?" If the answer has to be yes — and for anything with compliance obligations, an admin console, or a support team it does — you need server-side state on the request path, either as the session itself or as a version/blocklist check that costs the same read. Everything else in the comparison is a second-order performance argument that a single indexed lookup usually settles in the database's favour anyway.

**★ Auth.js says signing out with the JWT strategy "destroys the cookie". Why is that a weaker statement than it sounds?**
Because the cookie is the browser's copy, not the credential's only copy. The token is a self-contained bearer credential: anything that holds a copy — a captured HAR file, a logging proxy, an extension, an attacker who exfiltrated it before you set `HttpOnly` — can present it, and the server will accept it, until `exp`. Destroying the cookie removes the user's own convenience copy. It does not revoke anything.

**★ You need "log out of all devices" but the product is on stateless sessions and a rewrite is off the table. What do you actually build?**
A monotonically increasing `sessionVersion` integer on the user row, stamped into every issued token, and compared on every request in the DAL. "Log out everywhere" becomes one increment. Be honest about what you have bought: you now perform a database read per request, which is most of the cost of database sessions, so the remaining argument for staying stateless is small. Cache the version aggressively if the read hurts, accepting that the cache TTL becomes the revocation delay.

**★ Why is `SameSite` a weaker CSRF defence for a stateless session than people assume?**
It is not weaker for CSRF specifically — it is that the two controls solve different problems and get conflated. `SameSite` stops another site from causing the browser to send your cookie. It does nothing about a token that has already left the browser. Stateless sessions are exposed to *exfiltration*, and the mitigation for that is short lifetimes and revocability, not cookie attributes.

**★ Why does putting a permissions array in the token feel efficient and turn out expensive?**
Because you pay for it on every request, in both directions, forever — and the payload is public to anyone holding the token. It also freezes authorization state at issue time, so a permission revoked today does not take effect until the token expires. The efficient-looking version optimizes one database read and pessimizes bandwidth, revocation latency and confidentiality simultaneously. Store the id; look up the rest.

**★ What is refresh-token rotation, and what does reuse detection buy you?**
Rotation means each refresh exchange returns a *new* refresh token and invalidates the one presented, so at any moment only one is live. Reuse detection is the consequence: if a token that has already been exchanged is presented again, two parties hold copies, which means one of them stole it — and since you cannot tell which, the correct response is to revoke the whole family and force re-authentication. Without rotation, a stolen refresh token is a permanent credential. Note that this is OAuth practice rather than anything the Next.js documentation specifies.

**★ Someone argues a JWT is fine because "it's encrypted". How do you check?**
Ask which library and which mode. A plain signed JWT (JWS) is base64url-encoded and readable by anyone; signing proves integrity, not confidentiality. Auth.js's session token is genuinely encrypted — its docs say the JWT *"is encrypted with a secret key only known to the server"*, which is a JWE. If your code calls `SignJWT(...).sign(key)` from `jose`, you have a JWS and the payload is public. The two are easy to confuse and the confusion always runs in the unsafe direction.

**★ Why can clock skew be worse than an outright expiry bug?**
Because it is intermittent and instance-local. A token minted on an instance whose clock is two seconds ahead has an `iat`/`nbf` in the future for a verifier whose clock is correct, so *some* requests fail while identical requests on other instances succeed. It presents as flakiness rather than as an auth error, and it disappears when you retry. Allowing a few seconds of tolerance on verification removes an entire category of unreproducible ticket.

---

← [The Data Access Layer](03b-the-data-access-layer-server-only-and-the-dto.md) · [Chapter 10 overview](01-explanation.md) · Next → [Verifying a token without getting it wrong](03d-verifying-a-token-alg-none-and-algorithm-confusion.md)
