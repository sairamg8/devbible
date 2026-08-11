---
title: "Password storage — argon2, scrypt, bcrypt"
sidebar_label: "01 · Password storage"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `scrypt` and the hash functions from the
> built-in `node:crypto`.

**A password hash must be slow on purpose.** Every other property — the salt, the
algorithm's name, the output format — is secondary to that one idea. A fast hash is
not a weak version of a password hash; it is the wrong tool entirely.

## The whole argument, in two numbers

Bare hashes, one core, no GPU:

```console
md5    x100000 -> 237 ms  (422,438/s)
sha1   x100000 -> 238 ms  (420,622/s)
sha256 x100000 -> 291 ms  (343,776/s)
```

`scrypt` at its default-ish cost, same machine:

```console
scrypt N= 16384 (2^14) ->  88 ms
scrypt N= 32768 (2^15) -> 176 ms
scrypt N= 65536 (2^16) -> 358 ms
scrypt N=131072 (2^17) -> 726 ms
```

**422,000 guesses per second against about 11.** Six orders of magnitude, on one CPU
core — and an attacker with a GPU cluster widens the MD5 side by another three or four
orders while barely moving the scrypt side, because scrypt is deliberately
memory-hard.

That is the entire reason `sha256` is wrong here. It is an excellent hash. It is
excellent at being fast, which is precisely the property you do not want.

## What to use

| Algorithm | Use it? | Notes |
|---|---|---|
| **argon2id** | **First choice** | Winner of the Password Hashing Competition; memory-hard and side-channel resistant. Needs the `argon2` package |
| **scrypt** | **Good, and built in** | Memory-hard, in `node:crypto`, zero dependencies |
| **bcrypt** | Acceptable | Everywhere, well understood; capped at 72 bytes of input |
| PBKDF2 | Only if mandated | Not memory-hard — cheap to attack on a GPU. Chosen for FIPS compliance, not security |
| sha256 / sha512 | **No** | Fast by design |
| md5 / sha1 | **No** | Fast *and* broken |
| Plain / encrypted | **No** | Encryption is reversible; that is the problem |

**Take argon2id** for a new project. **Take scrypt** when you want zero dependencies —
it is genuinely fine, and `node:crypto` means no native build to break on a Node
upgrade. Either is a defensible answer in an interview; `sha256` is not.

## scrypt, correctly

```js
import {scrypt, randomBytes, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const scryptAsync = promisify(scrypt);
const PARAMS = {N: 2 ** 15, r: 8, p: 1, maxmem: 256 * 1024 * 1024};

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt') throw new Error(`unknown scheme ${scheme}`);
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(
    password.normalize('NFKC'), salt, expected.length,
    {N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024});
  return timingSafeEqual(actual, expected);
}
```

Five things in there that are not decoration:

**The salt is random and per-password**, 16 bytes from a CSPRNG. It does not need to be
secret — it is stored right next to the hash — it needs to be *unique*. Its job is to
make one precomputed table useless against your whole table, so two users with the same
password get different hashes.

**The parameters are stored with the hash.** `scrypt$32768$8$1$…` means a hash made
with today's cost is still verifiable after you raise the cost next year. A bare hash
with parameters in a constant somewhere is a migration you cannot perform.

**`timingSafeEqual`, not `===`.** Comparing secrets with `===` leaks how much of the
value matched through timing ([page 16](./16-timing-attacks.md)).

**`normalize('NFKC')`** so a password typed with a composed accent on one device and a
decomposed one on another still matches. Rare, infuriating when it happens.

**`await`, because scrypt is CPU work.** The callback form runs on the libuv thread
pool, so the event loop stays free. The pool has four threads by default, and the
consequence is measurable:

```console
UV_THREADPOOL_SIZE = (default 4)
 1 concurrent -> 174 ms total,  5.7 hashes/s
 4 concurrent -> 166 ms total, 24.1 hashes/s
 8 concurrent -> 359 ms total, 22.3 hashes/s
20 concurrent -> 843 ms total, 23.7 hashes/s
```

Four hashes take the same wall-clock time as one — genuine parallelism across the pool.
Past four they queue, and **throughput flattens at roughly 23 logins per second per
process** no matter how many arrive. That is your login capacity, and it is a number
worth knowing before a marketing email goes out ([Phase 0](../phase-0-runtime-model/)).

The *synchronous* `scryptSync` would block the event loop entirely and must never
appear in a request path.

## Choosing the cost

Pick the latency you can afford at your login rate, then use the highest cost that fits.
The measured curve is linear in `N`, so it is a direct dial: 2¹⁵ ≈ 176 ms is a
reasonable default for a web login, 2¹⁴ if you are latency-sensitive, higher for
administrative accounts.

Two constraints bound it from above. Memory: scrypt uses roughly `128 × N × r` bytes,
so 2¹⁵ with `r: 8` is about 32 MB **per concurrent hash** — twenty at once is 640 MB, and
`maxmem` must be raised or it throws. And throughput, as above.

Re-measure on the hardware you deploy to, not your laptop, and revisit annually.

## Upgrading the cost, and migrating algorithms

Because the parameters are in the string, you can raise cost transparently — at login,
when you have the plaintext:

```js
export async function login(email, password) {
  const user = await users.findByEmail(email);
  if (!user) { await hashPassword(password); return null; }   // constant-ish work — see below
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  if (needsRehash(user.passwordHash)) {                        // params below current policy
    await users.updateHash(user.id, await hashPassword(password));
  }
  return user;
}
```

The same shape migrates from bcrypt to argon2id: keep verifying old hashes by their
stored scheme prefix, write the new scheme on successful login, and after a year expire
whatever is left. You can never recompute them in bulk — you do not have the plaintext,
which is the point.

Note the `if (!user)` branch hashing anyway. Returning instantly for an unknown email
and 176 ms later for a known one **tells an attacker which emails are registered**. Do
comparable work either way.

## What else the password path needs

Hashing is necessary and not sufficient:

- **Rate limit and lock out.** A slow hash costs an attacker 90 ms per guess; it does
  not stop a hundred million of them. This is also a denial-of-service surface in its own
  right — an unauthenticated endpoint that burns 176 ms of CPU per request is an
  invitation ([page 21](./21-rate-limiting.md)).
- **Check against breached-password lists.** The most effective single control there is,
  because most cracked passwords are not brute-forced, they are reused.
- **Length over composition.** Enforce a minimum length, allow the whole Unicode range,
  and drop the "must contain a symbol" rules — they produce `Password1!` and nothing
  more.
- **Never log it.** Not at debug, not in an error object, not in a request dump. Keep it
  out of anything that serialises the request body.
- **Rotate the session on login** (page 05).

## Gotchas

**Symptom:** A password dump is cracked within hours of a breach
**Cause:** A fast hash — measured, MD5 allows ~422,000 guesses per second per core.
**Fix:** argon2id or scrypt, with stored parameters.

**Symptom:** Two users with the same password have identical hashes
**Cause:** No salt, or a shared one.
**Fix:** A fresh 16-byte random salt per password, stored alongside.

**Symptom:** Login latency collapses under load
**Cause:** CPU-bound hashing exhausting the four-thread pool.
**Fix:** Measure logins/sec at your cost factor; raise `UV_THREADPOOL_SIZE` or scale
processes; never use `scryptSync`.

**Symptom:** `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` under concurrency
**Cause:** `maxmem` exceeded — roughly `128 × N × r` bytes per hash.
**Fix:** Raise `maxmem` deliberately and bound concurrent logins.

**Symptom:** You cannot raise the cost factor without breaking existing users
**Cause:** Parameters live in code, not in the stored hash.
**Fix:** Store `scheme$params$salt$hash`; rehash at login when below policy.

**Symptom:** An attacker can enumerate registered email addresses
**Cause:** The unknown-email path returns much faster than the known-email path.
**Fix:** Hash anyway on the miss; return an identical message either way.

**Symptom:** A long password is silently truncated
**Cause:** bcrypt ignores input past 72 bytes.
**Fix:** argon2id or scrypt; or pre-hash before bcrypt, deliberately.

## Interview questions

**★ Why can't you use SHA-256 for passwords?**
Because it is fast, and speed is the attacker's advantage. Measured on one core:
~344,000 SHA-256 hashes per second against about 11 scrypt hashes at N=2¹⁵. A password
hash must be deliberately slow and, ideally, memory-hard so GPUs do not help.

**★ What is a salt, and does it need to be secret?**
A unique random value per password, stored with the hash. It is not secret — its job is
to make each hash unique so one precomputed table cannot attack every user at once, and
so identical passwords do not produce identical hashes.

**★ argon2 vs scrypt vs bcrypt?**
argon2id is the current first choice — memory-hard and side-channel resistant. scrypt is
memory-hard and built into `node:crypto`, so it is the best zero-dependency option.
bcrypt is acceptable and ubiquitous but silently truncates at 72 bytes. PBKDF2 is not
memory-hard and is chosen for compliance, not strength.

**★ How do you raise the cost factor later?**
Store the parameters in the hash string. At login you have the plaintext, so verify with
the stored parameters and, if they are below current policy, rehash and write it back.
Bulk recomputation is impossible — you do not have the plaintexts, which is the whole
point.

**★ What limits how high you can set the cost?**
Login throughput and memory. Measured at N=2¹⁵: four concurrent hashes finish in the
same 166 ms as one, then throughput flattens at about **23 logins per second per
process** because the libuv thread pool has four threads. And scrypt needs roughly
`128 × N × r` bytes per concurrent hash — around 32 MB each at `r: 8`.

**Is a slow hash enough on its own?**
No. It raises the cost per guess; it does not cap the number of guesses. You still need
rate limiting and lockout, breached-password checks, and awareness that an expensive
unauthenticated endpoint is itself a denial-of-service target.

**Why hash the password even when the email does not exist?**
Otherwise the miss returns in microseconds and a hit takes ~176 ms, which lets an
attacker enumerate registered accounts by timing alone.

---

Phase index: [Security](./README.md) · Next → [Sessions vs JWT](./02-sessions-vs-jwt.md)
