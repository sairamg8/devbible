---
title: "Session management — rotation, invalidation, expiry"
sidebar_label: "05 · Session management"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `node:crypto` for identifier generation.

**A session is a credential with a lifecycle, and every transition in that lifecycle is
a place to get it wrong.** Issuing one is easy. Rotating it at the right moments,
invalidating it everywhere on logout, and expiring it on two independent clocks is where
the work is.

## Creating one

```js
import {randomBytes} from 'node:crypto';

export async function createSession(userId, req) {
  const id = randomBytes(32).toString('base64url');       // 256 bits from a CSPRNG
  await redis.set(`sess:${id}`, JSON.stringify({
    userId,
    createdAt: Date.now(),
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }), {EX: 86_400});
  await redis.sAdd(`user-sessions:${userId}`, id);        // so you can revoke them all
  return id;
}
```

Three decisions in there:

**32 bytes from `randomBytes`, not `Math.random`.** A session id is a bearer credential —
guessing one is a login. `Math.random()` is not a CSPRNG
(page 20).

**The index by user.** Without `user-sessions:${userId}`, "log out everywhere" and "this
account is compromised" have no implementation. Adding it later means the sessions
already out there are unrevocable.

**No authorization data in the value.** Store `userId` and look permissions up — same
reasoning as [page 04](./04-authentication-vs-authorization.md).

## Rotate on every privilege change

**Session fixation** is the attack this prevents: an attacker gets a victim to use a
session id the attacker already knows, waits for them to log in, and now shares an
authenticated session. It works whenever the identifier survives the login.

```js
export async function login(req, credentials) {
  const user = await verifyCredentials(credentials);
  if (!user) return null;

  await destroySession(req.cookies.sid);                  // kill the pre-login session
  const sid = await createSession(user.id, req);          // brand new identifier
  return sid;
}
```

Rotate on **every change of privilege level**, not only login:

| Event | Why |
|---|---|
| Login | Fixation — the whole point |
| Logout | The old id must stop working |
| Password change | Anyone holding an old session should lose it |
| Email change | It is a password-reset path |
| MFA completion | Privilege genuinely increased ([page 07](./07-mfa-totp.md)) |
| Role elevation | Same reasoning |
| "Log out other devices" | Explicit user intent |

## Logout must be server-side

```js
// no — the cookie is gone from this browser and the session still works
res.clearCookie('sid');
```

Clearing the cookie deletes the client's copy. Anyone who captured the id — a proxy log,
a shared machine, an XSS payload — still has a working credential. Delete the record:

```js
export async function logout(sid) {
  const raw = await redis.get(`sess:${sid}`);
  if (raw) await redis.sRem(`user-sessions:${JSON.parse(raw).userId}`, sid);
  await redis.del(`sess:${sid}`);
}
```

And on password change, revoke the whole set:

```js
const ids = await redis.sMembers(`user-sessions:${userId}`);
await Promise.all(ids.map((id) => redis.del(`sess:${id}`)));
await redis.del(`user-sessions:${userId}`);
```

This is the property a JWT does not have, and the reason
[page 02](./02-sessions-vs-jwt.md) recommends sessions by default.

## Two expiries, not one

**Idle timeout** — expires after inactivity, refreshed on use. **Absolute timeout** —
expires a fixed time after creation, never extended. You need both: idle alone means a
session used daily lives forever, and absolute alone logs out an active user mid-task.

```js
const IDLE = 30 * 60;              // 30 minutes
const ABSOLUTE = 12 * 60 * 60;     // 12 hours

export async function touchSession(sid) {
  const raw = await redis.get(`sess:${sid}`);
  if (!raw) return null;
  const sess = JSON.parse(raw);

  if (Date.now() - sess.createdAt > ABSOLUTE * 1000) {
    await logout(sid);
    return null;                   // absolute cap reached — no extension
  }
  await redis.expire(`sess:${sid}`, IDLE);      // slide the idle window
  return sess;
}
```

Note the absolute check reads `createdAt` from the value; the Redis TTL only implements
the idle window. Relying on TTL alone gives you no absolute cap at all.

Pick durations from blast radius, not habit: a banking session is minutes, a webmail
session is weeks. "Remember me" is a **separate long-lived token** that mints short
sessions — not a session with a long TTL.

## Detecting theft

You cannot prevent a stolen id from working; you can notice.

**Bind loosely to context.** Record IP and user agent at creation and treat changes as
signal. Do **not** hard-invalidate on IP change — mobile networks change addresses
constantly and you will log out legitimate users all day. A changed user agent on the
same session is a stronger signal than a changed IP.

**Show sessions to the user.** A list of active sessions with device, location and last
use, plus a revoke button, is the most effective control here — users spot their own
anomalies better than your heuristics do.

**Log the lifecycle.** Creation, rotation, destruction, and failed lookups, with the
session id **hashed**, never raw — a log full of live session ids is a credential store
([Phase 10, page 04](../phase-10-observability/04-what-to-log.md)).

## Where sessions live

| Store | Trade |
|---|---|
| **Redis** | The default. Fast, TTL built in, shared across instances. Losing it logs everyone out |
| **PostgreSQL** | One less dependency, survives restarts, needs a cleanup job for expired rows |
| In-memory | Only for a single process you never scale or restart. Not production |
| Signed cookie, no server state | No revocation — this is a JWT wearing a cookie ([page 02](./02-sessions-vs-jwt.md)) |

Redis needs persistence configured if "all users logged out" during a restart is
unacceptable.

## Gotchas

**Symptom:** A user stays logged in as someone else after login
**Cause:** The session id survived the privilege change — fixation.
**Fix:** Destroy and recreate on login and every privilege change.

**Symptom:** Logout does not actually log out
**Cause:** Only the cookie was cleared.
**Fix:** Delete the server-side record; clear the cookie as well.

**Symptom:** Sessions never expire for active users
**Cause:** Idle timeout only, refreshed forever.
**Fix:** Add an absolute cap checked against `createdAt`.

**Symptom:** Changing a password does not end other sessions
**Cause:** No per-user session index.
**Fix:** Maintain `user-sessions:${userId}` and revoke the set.

**Symptom:** Mobile users are logged out constantly
**Cause:** Hard binding to IP address.
**Fix:** Treat IP change as signal, not as invalidation.

**Symptom:** A restart logs everyone out
**Cause:** In-memory store, or Redis without persistence.
**Fix:** A shared store with persistence configured.

**Symptom:** Session ids appear in logs or URLs
**Cause:** Logging raw ids, or session-in-query-string.
**Fix:** Hash before logging; never put credentials in a URL — they land in referrers and
proxy logs.

## Interview questions

**★ What is session fixation and how do you prevent it?**
An attacker gets the victim to use a session id they already know, then rides it once the
victim authenticates. Prevention is rotation: destroy the pre-login session and issue a
new identifier at login, and at every later privilege change.

**★ Why is clearing the cookie not enough for logout?**
It removes the browser's copy while the server-side record stays valid, so anyone who
captured the id still has a working credential. Logout must delete the record; clearing
the cookie is cleanup, not revocation.

**★ Why do you need two expiry clocks?**
Idle timeout alone lets a daily-used session live forever; absolute timeout alone
interrupts active users. Together they bound both inactivity and total lifetime. The
absolute cap has to be checked against a stored `createdAt` — a sliding Redis TTL cannot
express it.

**★ How do you log a user out of every device?**
Keep a per-user index of session ids at creation time and delete the whole set. Without
that index, existing sessions are unrevocable — and it cannot be added retroactively for
sessions already issued.

**Should you invalidate a session when the IP changes?**
No — mobile networks change addresses routinely, so you would log out legitimate users
constantly. Record it as signal, surface active sessions to users with a revoke button,
and let them make the call.

**How long should a session last?**
From blast radius: minutes for banking, weeks for low-risk consumer apps. "Remember me"
should be a separate long-lived token that mints short sessions, not a session with a
long TTL.

---

← Prev: [Authz vs authn](./04-authentication-vs-authorization.md) · Next → [OAuth 2.0 and OIDC](./06-oauth-oidc.md)
