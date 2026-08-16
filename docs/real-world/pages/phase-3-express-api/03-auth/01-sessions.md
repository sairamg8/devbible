---
title: "Sessions"
sidebar_label: "1 · Sessions"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span> · Chapter 1 of [Auth](README.md)

> Verified: 2026-08 against the Node v24 crypto docs (`scrypt`, `randomBytes`,
> `timingSafeEqual`), OWASP cheat sheets, MDN Set-Cookie (`__Host-` prefix).

## The problem

Prove who is asking, on every request, without making the API remember
anything in process memory
([statelessness rule](../../phase-0-the-app/02-architecture-and-data-model.md)).
Database sessions are this app's default: an opaque token in an `HttpOnly`
cookie, a `sessions` row as the truth, instant revocation for free.

## The implementation

```js
// src/services/auth.js
import {randomBytes, scrypt, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scryptAsync = promisify(scrypt);

const SCRYPT = {N: 2 ** 15, r: 8, p: 1, keylen: 64};      // ~100ms — the point

export function authService({pool, config}) {
  async function hashPassword(password) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT);
    return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:` +
           `${salt.toString('base64')}:${hash.toString('base64')}`;
  }

  async function verifyPassword(password, stored) {
    const [scheme, N, r, p, saltB64, hashB64] = stored.split(':');
    if (scheme !== 'scrypt') throw new Error(`unknown scheme ${scheme}`);
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'),
      expected.length, {N: +N, r: +r, p: +p});
    return timingSafeEqual(actual, expected);              // never ===
  }

  const tokenHash = (token) =>
    createHash('sha256').update(token).digest('base64');

  return {
    async signup({email, password}) {
      const passwordHash = await hashPassword(password);
      const {rows: [user]} = await pool.query(
        `insert into users (email, password_hash) values ($1, $2)
         on conflict (email) do nothing
         returning id, email, role`,
        [email, passwordHash],
      );
      if (!user) return null;            // taken — ch. 09 maps to a neutral 409
      return user;
    },

    async login({email, password}) {
      const {rows: [user]} = await pool.query(
        `select id, email, role, password_hash from users where email = $1`,
        [email],
      );
      // hash even when the user is missing: no timing oracle on email existence
      const ok = await verifyPassword(password,
        user?.password_hash ?? await hashPassword(randomBytes(8).toString('hex')));
      if (!user || !ok) return null;

      const token = randomBytes(32).toString('base64url'); // 256-bit, opaque
      await pool.query(
        `insert into sessions (user_id, token_hash, expires_at)
         values ($1, $2, now() + make_interval(days => $3))`,
        [user.id, tokenHash(token), config.SESSION_TTL_DAYS],
      );
      return {user: {id: user.id, email: user.email, role: user.role}, token};
    },

    async resolve(token) {
      if (!token) return null;
      const {rows: [row]} = await pool.query(
        `select s.id as session_id, u.id, u.email, u.role
           from sessions s join users u on u.id = s.user_id
          where s.token_hash = $1 and s.expires_at > now()`,
        [tokenHash(token)],
      );
      return row ?? null;
    },

    async logout(token) {
      await pool.query(`delete from sessions where token_hash = $1`,
        [tokenHash(token)]);
    },
  };
}
```

```js
// src/middleware/auth.js — cookie in, req.user out
const COOKIE = '__Host-session';

export function sessionMiddleware({auth}) {
  return async (req, res, next) => {
    try {
      req.user = await auth.resolve(req.cookies?.[COOKIE] ?? null);
      next();
    } catch (err) { next(err); }
  };
}

export function setSessionCookie(res, token, ttlDays) {
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax',
    path: '/', maxAge: ttlDays * 86_400_000,
    // __Host- prefix: the browser enforces secure + path=/ + no Domain —
    // a subdomain cannot plant this cookie
  });
}
```

## The choices that carry the security

- **scrypt over bcrypt, with parameters in the stored string.** scrypt is in
  `node:crypto` (no native-dependency drama) and memory-hard; the
  self-describing format is what lets costs rise later — `verifyPassword`
  reads the row's own parameters, and a login with an old-cost hash can be
  transparently re-hashed at the one moment the plaintext is legitimately
  in hand. (argon2id is the other defensible choice; it costs a native
  dependency — [the concept page](../../../../nodejs/pages/phase-8-security/01-password-storage.md)
  carries that comparison.)
- **The session token is opaque and stored hashed.** 256 random bits mean
  no structure to attack; SHA-256 at rest means a leaked `sessions` table
  contains nothing loggable-in-with. (Fast hashing is correct here — the
  input is already 256-bit random; scrypt's slowness exists for
  *low-entropy* passwords.)
- **The dummy-hash on unknown email** keeps login timing flat: both paths
  cost one scrypt. Combined with one neutral error message
  ("invalid email or password"), account enumeration gets no oracle —
  [timing attacks](../../../../nodejs/pages/phase-8-security/16-timing-attacks.md)
  in practice.
- **`sameSite: 'lax'`** blocks the cookie on cross-site POSTs — the
  [CSRF answer](../../../../nodejs/pages/phase-8-security/11-csrf.md) for
  every state-changing route in this API — while keeping top-level
  navigation logged in.
- **Login after signup rotates nothing, but privilege changes do:** password
  change and role change delete the user's *other* sessions
  (`delete from sessions where user_id = $1 and id <> $2`) — the
  [rotation rule](../../../../nodejs/pages/phase-8-security/05-session-management.md)
  scoped to the events that matter.

The signup/login/logout *routes* are thin `validate` + service + cookie
assemblies (the [structure chapter's](../01-project-structure.md) ten-line
shape); login's route also merges the guest cart — chapter 06 owns that
call.

## Gotchas

- **Symptom:** login works locally over `http://localhost`, cookie never
  arrives. **Cause:** `secure: true` — the browser drops it on plain HTTP;
  `__Host-` *requires* secure. **Fix:** localhost is exempted as a secure
  context by browsers for `Secure` cookies via `https://` only — in dev,
  run the API behind the Vite proxy (Phase 4) so the origin is
  `http://localhost:5173` and use HTTPS in anything shared; do not make
  `secure` conditional on env, which always eventually ships off.
- **Symptom:** users report being logged out "randomly"; sessions rows
  exist. **Cause:** `expires_at` compared in JavaScript against a skewed
  app clock somewhere — or, more often, the cookie's `maxAge` and the row's
  TTL drifted apart after a config change. **Fix:** the row is the truth
  (`expires_at > now()` in SQL — [the time rule](../../phase-1-database/07-money-and-time.md));
  the cookie's `maxAge` is set *from the same config value* so they cannot
  disagree by more than a deploy.
- **Symptom:** a pentest logs in with a session token from the `sessions`
  table dump you gave them. **Cause:** tokens stored raw. **Fix:** the
  `tokenHash` line — and if this finding appears in *your* audit, every
  live session rotates now (delete all rows; users re-login), because the
  dump *is* the credentials.

## Interview questions

1. **★ Why hash the session token at rest when it's already random?** The
   threat is a read-only leak (backup, injection, misconfigured replica): a
   raw token table is a bag of live logins; a hashed one is inert. SHA-256
   suffices — unlike passwords, 256-bit random tokens cannot be
   dictionary-attacked, so the hash only needs to be one-way, not slow.
2. **★ Why does a failed login for a *nonexistent* email still run scrypt?**
   Without it, "unknown email" returns in 2 ms and "wrong password" in
   100 ms — a timing oracle that enumerates accounts. Burning the same cost
   on both paths, plus one shared error string, closes both the timing and
   the wording channel.
3. **What does the `__Host-` prefix actually enforce, and against whom?**
   The browser refuses the cookie unless it is `Secure`, `Path=/`, and has
   no `Domain` attribute — which means a compromised or hostile *subdomain*
   cannot set or override it. It turns three easy-to-forget attributes into
   a contract the platform polices.
4. **Why sessions in Postgres and not Redis?** Instant revocation and
   one-system truth today; the read is one indexed lookup the pool absorbs
   at this scale. The Redis session store is a drop-in *when session reads
   become the measured bottleneck* — the resolve function is the interface,
   and the architecture chapter already reserved that seam.

---

Next → [The JWT variant, and choosing](02-jwt-variant-and-choosing.md) ·
Topic index: [Auth](README.md)
