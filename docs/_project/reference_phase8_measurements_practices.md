---
name: devbible-phase8-measurements-practices
description: Measured data behind Node Phase 8 pages 17–27, the practices and tooling rows — validation, secrets, crypto, rate limiting, headers, supply chain, permissions
metadata:
  type: reference
---

Child of [[devbible-phase8-measurements]], which holds pages 01–16. Split out on
2026-08-11 to stay under the 300-line cap ([[devbible-memory-file-cap]]).
All figures on **Node 24.19.0**, scripts in `sandbox/p8-security/`.

## Added 2026-08-11 — page 17 (input validation)

`ex14-validation.mjs`, `ex15-validation-followups.mjs`, `ex16-validation-boundary.mjs`.
**zod 4.4.3 · valibot 1.4.2** installed in `sandbox/p8-security/`.

**Unknown keys.** `z.object()` strips · `z.strictObject()` rejects (`unrecognized_keys`) ·
`z.looseObject()` keeps — **and copies inherited properties**, not only own ones
(`inherited:"yes"` from the prototype appeared in the output). Verified.

**`__proto__`.** Through `JSON.parse` it is a real own key; zod removes it. But
`z.record` keeps `constructor` (`["a","constructor"]`), so a schema narrows the
prototype-pollution door without closing it. Parse output is a **deep copy** — nested
objects are new references.

**Coercion is `Number()`/`Boolean()`.** `""`, `"  "`, `[]`, `null` → `0`; `true` → 1;
`"0x10"` → 16; `" 12 "` → 12; `"1e3"` → 1000. Rejects only `"abc"`, `"12abc"`, `{}`,
`undefined`. `z.coerce.boolean()`: `"false"`/`"0"`/`"no"` → **true**, `""` → false.

**Throughput, 200k parses of a 4-field object:** zod parse 212.8 ms (1.06 µs) · zod
safeParse 207.5 ms (1.04 µs) · valibot 187.2 ms (0.94 µs) · hand-written `if` 5.1 ms
(0.03 µs). **Failure costs ~45×:** valid 0.7 µs · 1 bad field 32.0 µs · 4 bad 40.3 µs.
The cost is *building* the error — never reading `.error` measured the same 598 ms/20k.

**Size cap beats schema.** `JSON.parse` of a 20 MB body = **40.7 ms** of blocked loop
before any schema runs; a 1 KB read cap rejects in 0.002 ms. And `.max()` does **not**
short-circuit: a 200k-element array parsed in 12.3 ms without `.max()`, **40.5 ms with
`.max(20)`** (walks everything, then builds the error).

**`flattenError` trap:** `unrecognized_keys` has an empty path, so it lands in
`formErrors`, not `fieldErrors` — a strict rejection returns `"fields":{}` unless you
send both halves.

## Pages 18–27 — measured 2026-08-11

**18 secrets** (`ex17-secrets.mjs`). `--env-file` does **no variable expansion**
(`${X}` stays literal); a real env var **wins** over the file; missing file = **exit 9**,
`--env-file-if-exists` = exit 0; `process.loadEnvFile()` throws ENOENT. **Best finding:**
`--env-file` values never reach `/proc/<pid>/environ` (an exported var does) — the path
still shows in cmdline. Children inherit the whole env unless given an explicit allowlist.
`git rm` + `.gitignore` left the key in **2 commits** (`git show HEAD~1:.env` returned it).

**19 HTTPS/HSTS/cookies** (`ex18-https-cookies.mjs`). TLS min 1.2 / max 1.3, 120 root
certs. Handshake 6.75 ms (1.2) · 5.58 ms (1.3) · **3.82 ms resumed**. **Trap:** on TLS 1.3
`getSession()` in the connect callback (889 B) does **not** resume; the `'session'` event
value (1229 B) does. A client can set `x-forwarded-proto: https` itself. **Node validates
no cookie attribute** — `SameSite=None` without Secure, `__Host-` with Domain, and a
**5004-byte** cookie all went out with a 200.

**20 node:crypto** (`ex19-crypto.mjs`). **MD5 5.11 µs is SLOWER than sha256 3.68 µs**
(SHA extensions); sha1 3.42 · sha512 6.59 · blake2b512 4.98. `crypto.hash` 2.47 µs beats
`createHash` 3.57. randomUUID 0.45 µs vs randomBytes(16) 5.35 vs
`disableEntropyCache` 3.92. Modulo bias `byte % 100`: **40.7% spread** vs randomInt 2.9%.
UUIDv4 = 122 random bits. **Key-type finding:** `createHmac` with a **Buffer** key
35.91 µs vs **string 8.85 / KeyObject 9.41**; `createCipheriv` Buffer 38.48 vs
KeyObject 13.07. Use `crypto.createSecretKey()` once.

**21 rate limiting** (`ex20-rate-limiting.mjs`, Redis 7 on :6399). Fixed window let
**10 through in 80 ms against a 5/s limit**; sliding window allowed 5. In-memory Map:
4 workers → effective limit 40; 200k keys = **31.2 MB**. `INCR` without `EXPIRE` leaves
ttl **-1** (blocked forever) — use one Lua script. Redis check 0.215 ms sequential /
0.022 ms pipelined. Client-set `X-Forwarded-For` = a fresh bucket per request. Hard
account lockout locked the real user after the attacker's 5 guesses.

**22 security headers** (`ex21-headers.mjs`, helmet 8.3.0). Helmet sets 12 headers;
`x-xss-protection: 0` is deliberate; its default CSP keeps **`style-src 'unsafe-inline'`**
and HSTS **includes `includeSubDomains`**. Cost **0.80 µs** and **356 bytes**. CORS is not
an access control — a non-browser client read an `ACAO:*` response.

**23 supply chain** (npm **12.0.2**). **npm 12 blocks install scripts by default** —
`allowScripts` map in package.json, `npm install-scripts ls/approve/deny`; once approved
the postinstall read **103 env vars** and had write access. Tampered lock hash →
`EINTEGRITY` with wanted/got. `npm audit signatures`: 11 signed, **3 with SLSA
attestations**. `min-release-age` is in **days** (`before = now - 86400000*days`):
0→undici 8.10.0, 30→8.7.0, 365→7.13.0; yarn's is `npmMinimalAgeGate`.

**24 permission model** (`ex22-permission-model.mjs`). Flags: fs-read/fs-write, child,
worker, addons, wasi, inspector. **There is no `--allow-net`** (`node: bad option`), and a
process with only `--allow-fs-read` **completed a TCP connect** — so it cannot contain
SSRF. `process.permission.has()` returns false for unknown scopes too (`bogus.scope`), so
`has('net') === false` proves nothing. Env fully readable; no runtime grant API;
`process.dlopen` → `ERR_DLOPEN_DISABLED`.

**25 Web Crypto** (`ex23-webcrypto.mjs`). `globalThis.crypto === crypto.webcrypto`.
subtle.sign 43.11 µs (key imported once) vs **97.63 re-importing** vs node 8.85.
`extractable:false` → `exportKey` throws `InvalidAccessError` — **node:crypto cannot
express this**. No MD5, no scrypt (`NotSupportedError`). PBKDF2 600k = 292.9 ms.

**26 encryption/keys** (`ex24-encryption-keys.mjs`). ECB: identical plaintext blocks →
identical ciphertext blocks. CBC tamper decrypts to garbage **with no error**; GCM throws.
**IV reuse demo:** `c1 ^ c2 ^ known plaintext` returned `"transfer $900 to mallo"`.
Ed25519 keygen 0.4 ms / sign 151.43 µs / verify 425.44 µs / 64-byte sig vs RSA-2048
107.2 ms / 997.53 / 118.73 / 256 bytes. Envelope encryption + `v`/`kid` is what makes
rotation possible.

**27 audit logging** (`ex25-audit-log.mjs`). HMAC hash chain: edit → `BROKEN at seq 1`,
delete → `BROKEN at seq 2`, **truncate → `intact`** (a chain cannot detect truncation;
anchor the head externally). Chain cost 8.99 µs vs 0.46 µs for JSON.stringify. Opening
with `'a'` did **not** prevent the same process truncating the file.
