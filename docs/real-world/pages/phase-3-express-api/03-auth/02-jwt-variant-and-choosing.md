---
title: "The JWT variant, and choosing"
sidebar_label: "2 · JWT variant & choosing"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span> · Chapter 2 of [Auth](README.md)

> Verified: 2026-08 against RFC 7519 (JWT), RFC 6749 (OAuth's refresh
> pattern), the Node v24 crypto docs, and the jose library docs. Concept home:
> [Node — sessions vs JWT](../../../../nodejs/pages/phase-8-security/02-sessions-vs-jwt.md)
> and [token storage](../../../../nodejs/pages/phase-8-security/03-token-storage.md).

## The problem

Chunk 1's sessions hit the database on every request. The JWT pitch is to
stop: a signed token carries the user's identity, any instance verifies the
signature locally, and the session store disappears. This chunk implements
that variant *for this app* — same endpoints, same cookie discipline — so
the comparison at the end is between two working designs, not a design and
a slogan.

## The variant

Two tokens, because one cannot do both jobs: a **short-lived access token**
(10 minutes, JWT, verified statelessly) and a **long-lived refresh token**
(30 days, *opaque and stored hashed* — exactly chunk 1's session row wearing
a different name).

```js
// src/services/auth-jwt.js — the parts that differ from chunk 1
import {SignJWT, jwtVerify} from 'jose';

const ACCESS_TTL_S = 600;

export function jwtAuthService({pool, config}) {
  const key = new TextEncoder().encode(config.JWT_SECRET); // HS256: one issuer,
                                                           // same-party verifier
  return {
    async issueAccess(user) {
      return new SignJWT({role: user.role})
        .setProtectedHeader({alg: 'HS256'})
        .setSubject(String(user.id))
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TTL_S}s`)
        .sign(key);
    },

    async verifyAccess(token) {
      try {
        const {payload} = await jwtVerify(token, key, {algorithms: ['HS256']});
        return {id: Number(payload.sub), role: payload.role};
      } catch {
        return null;                       // expired or forged — same answer
      }
    },

    // refresh tokens: chunk 1's machinery, table renamed refresh_tokens,
    // one twist — rotation with reuse detection:
    async refresh(oldToken) {
      const row = await this.consumeRefreshToken(oldToken); // deletes the row
      if (!row) {
        // token unknown OR already used: if it belonged to a family, an
        // attacker and the user are racing — revoke the whole family.
        await this.revokeFamilyOf(oldToken);
        return null;
      }
      const next = await this.issueRefreshToken(row.userId, row.familyId);
      return {access: await this.issueAccess(row.user), refresh: next};
    },
  };
}
```

The middleware verifies the access token from the cookie; on `null`, the
client calls `POST /auth/refresh`; refresh rotates the refresh token and
returns a new access token. Logout deletes the refresh row — and the access
token *stays valid for up to ten minutes*. That sentence is the entire
trade-off, so it gets its own section.

## The honest comparison, on this app's requirements

| Requirement (from the spec) | DB sessions (chunk 1) | JWT + refresh |
|---|---|---|
| Logout works *now* | ✅ delete the row | ⚠️ access token lives out its TTL, or you keep a denylist — which is a session store again |
| Role change takes effect | ✅ next request | ⚠️ up to TTL late — an admin you just demoted is an admin for 10 more minutes |
| Per-request cost | one indexed SELECT | ~0 (HMAC verify) |
| Instances share nothing | ✅ (the DB is the share) | ✅ |
| A second consumer of identity (the worker? a second API?) | needs the DB | verifies locally with the key |
| Implementation surface | small | tokens ×2, rotation, reuse detection, clock skew |

**This app ships chunk 1.** The deciding facts: revocation and role changes
have *security meaning* here (admin moderation, account takeover response);
one database serves every instance comfortably at this scale; and there is
no second identity consumer — the worker never authenticates users. The JWT
variant is the right answer when verifiers multiply (microservices, an edge
runtime, a partner API) or when the identity provider is a separate system —
at which point this chunk is the migration document.

The cookie discipline does not change either way:
[token storage](../../../../nodejs/pages/phase-8-security/03-token-storage.md)
already settled `HttpOnly` cookies over `localStorage` — a JWT in
`localStorage` is one XSS from theft, and "but JWTs are stateless" never
changed that.

## Gotchas

- **Symptom:** users are "randomly" logged out exactly at round intervals.
  **Cause:** the client ignores 401s instead of calling refresh — the
  access TTL is doing its job and the client isn't doing its half. **Fix:**
  Phase 4's fetch wrapper: on 401, refresh once, replay the request, and
  only then surface the logout.
- **Symptom:** `jwtVerify` intermittently rejects fresh tokens in one
  environment. **Cause:** clock skew between the signer and verifier
  crossing `iat`/`exp` — containers with drifting clocks
  ([the container-time page](../../../../docker/pages/phase-10-production/15-time-and-timezones.md)).
  **Fix:** fix the host clock (NTP); a `clockTolerance` of a few seconds is
  the permissible patch, not a substitute.
- **Symptom:** a refresh token leaked (extension, log line) and the account
  is compromised for 30 days. **Cause:** rotation without reuse detection —
  the thief refreshes quietly forever. **Fix:** the family revocation in
  the code above: the *legitimate* client's next refresh presents the
  now-consumed token, the family dies, both parties are logged out, and
  the user logs in again. Detection converts a silent 30-day breach into a
  noisy re-login.
- **Symptom:** "we set `alg: none`… " **Cause:** letting the token declare
  its own algorithm. **Fix:** the `algorithms: ['HS256']` allow-list in
  `jwtVerify` — the verifier decides what it accepts, always; this is the
  classic JWT implementation kill.

## Interview questions

1. **★ Why do JWTs need a refresh token at all?** Because the two virtues
   fight: stateless verification wants long-lived tokens (fewer round
   trips), revocation wants short-lived ones. The split gives each job to
   the token that can do it — access tokens short enough that revocation
   lag is bounded, refresh tokens long-lived but *stateful*, so they can
   be killed. Every "stateless auth" system that can log users out is
   hiding a stateful token somewhere.
2. **★ What is refresh-token rotation with reuse detection, and what attack
   does it convert?** Each refresh consumes the presented token and issues
   a successor in the same "family". A stolen token means two parties hold
   members of one family; whichever refreshes second presents a consumed
   token, which triggers family-wide revocation. It converts *silent
   long-term account takeover* into *a forced re-login for both parties* —
   detection, not prevention, and worth it because prevention (not leaking)
   already failed.
3. **When is HS256 the wrong signing choice?** The moment the verifier is
   not the issuer's own codebase — a partner, another team's service, an
   edge function. Shared-secret verification means every verifier can also
   *mint* tokens. Asymmetric (RS256/EdDSA) splits the powers: private key
   signs, public key verifies, and verifiers can't forge. One party: HMAC;
   more: asymmetric.
4. **Your PM says "use JWTs so we scale". What is the correct response?**
   That the session lookup is one indexed read on a pool this app already
   holds open, that the actual JWT costs land on revocation and role
   propagation — which this product's admin and security flows depend on —
   and that the switch is warranted by *verifier topology*, not request
   volume. Scaling reads is a cache/replica problem; JWTs solve a
   *distribution of trust* problem.

---

← Prev: [Sessions](01-sessions.md) · Topic index: [Auth](README.md) ·
Next → [Authorization](../04-authorization.md)
