---
name: devbible-phase8-measurements
description: Measured dataset for Node Phase 8 (security) — crypto costs, timing attacks, ReDoS, prototype pollution, path traversal, the permission model — captured 2026-08-10 on Node 24.19.0
metadata:
  type: reference
---

Child of [[devbible-progress]]. **Working data, not curated.** Scripts are in
`sandbox/p8-security/` **inside the project** (new convention — see
[[devbible-progress]]), so unlike phases 0–6 they survive the session.

Scripts: `ex1-crypto.mjs` `ex2-vulns.mjs` `ex3-permission.mjs` `ex4-throughput.mjs`
`ex5-totp.mjs` `ex6-cmdinj.mjs` `ex7-xss.mjs` — and, added 2026-08-11 for pages 11–16:
`ex8-ssrf.mjs` `ex9-csrf.mjs` `ex10-ssrf-guard.mjs`
`ex11-deser-redirect-massassign.mjs` `ex12-redos.mjs` `ex13-timing.mjs`.
`sandbox/p8-security/` now has `undici` 8.10.0 installed for the SSRF work.

**Still unmeasured:** the practices rows — validation, secrets, HTTPS/HSTS, rate
limiting, headers, supply chain, Web Crypto, encryption, audit logging (pages 17–27).

## Password hashing and naive hashes (page: password storage)

`scrypt` from `node:crypto`, `r:8 p:1`, 64-byte key:

```
scrypt N= 16384 (2^14) ->  88 ms
scrypt N= 32768 (2^15) -> 176 ms
scrypt N= 65536 (2^16) -> 358 ms
scrypt N=131072 (2^17) -> 726 ms
```

Linear in N, so the cost factor is a direct latency dial.

Bare hashes, same machine, single core:

```
md5    x100000 -> 237 ms  (422,438/s)
sha1   x100000 -> 238 ms  (420,622/s)
sha256 x100000 -> 291 ms  (343,776/s)
```

**The whole argument in two numbers:** ~422 000 MD5 guesses/second against ~11/second
at scrypt 2^14. Six orders of magnitude, one core, no GPU.

## timingSafeEqual (page: timing attacks)

```
timingSafeEqual same: true | diff: false
different lengths -> ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH
  | Input buffers must have the same byte length
```

**It throws on unequal lengths** — it cannot hide length, so length must not be secret.
Hash both sides to a fixed width first when it might be.

Naive `===`-style char loop over a 64-char secret, 20 000 iterations:
```
0 chars match  ->  1.6 ms
32 chars match -> 21.3 ms
63 chars match -> 17.8 ms
```
⚠ **Superseded — the non-monotonicity here was a sampling artefact.** Re-run at 200 000
iterations on 2026-08-11 it is a clean staircase; see the timing-attacks section at the
bottom of this file. Use those numbers, not these.

## Randomness (page: node:crypto)

```
randomUUID: 92dc5065-6fee-4a7d-bf82-0f9e80af08e2   (version nibble = 4)
randomBytes(32).base64url: Rxx0iJrbq2DUBctGd3JJuaXor2jP3hMcoQ6B1qTp4Lw
randomUUID x100000 -> 63 ms
```
0.63 µs each — no reason to reach for a weaker source. `Math.random()` is not a CSPRNG.

HMAC-SHA256 of `{"orderId":42}` with key `webhook-secret`:
`0506cc14f21460c7210af9187b6a2cfcdea468836237e02f876515e77067e07e`

## ReDoS (page: ReDoS)

`/^(a+)+$/` against `'a'.repeat(n) + '!'`:

```
20 chars ->   91 ms
24 chars ->  244 ms
26 chars -> 1012 ms
28 chars -> 3655 ms
```

Roughly ×2 per extra character. 28 characters of input blocks the event loop for 3.6 s
— one request, whole process.

Linear alternative `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` on an 81-char non-match: **0.064 ms**.

**Do not reuse the "common email regex" example** — the classic
`/^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z\-])+\.)+([a-zA-Z]{2,4})+$/` returned in 0 ms on the
input tried, so that specific claim is unproven here.

## Prototype pollution (page: prototype pollution)

A recursive `merge({}, JSON.parse('{"__proto__": {"isAdmin": true}}'))`:

```
after merge, ({}).isAdmin = true      <- every object in the process
an unrelated object {name:'ada'}.isAdmin = true
```

**Mechanism, stated correctly:** `JSON.parse` is safe on its own — it creates
`__proto__` as an ordinary **own property**, verified
(`Object.getPrototypeOf(JSON.parse('{"__proto__":{"x":1}}')) === Object.prototype` is
`true`). The damage happens when a naive merge does `target[key] = value`, which goes
through the **setter** on `Object.prototype`.

`structuredClone` **does not drop it** — the clone still has the own property
(`JSON.stringify` → `{"__proto__":{"x":1}}`). Do not claim it sanitises.

`Object.create(null)` has prototype `null` — the real guard, along with rejecting
`__proto__`/`constructor`/`prototype` keys and using `Map`.

## Path traversal (page: path traversal)

```
path.join('/srv/app/uploads', '../../../etc/passwd') -> /etc/passwd
```

`resolve` + prefix check with the separator:
```
report.pdf                   -> /srv/app/uploads/report.pdf
../../../etc/passwd          -> rejected: outside root
a/../../../../etc/shadow     -> rejected: outside root
```

**The bypass to name:** a prefix check *without* `path.sep` passes for
`/srv/app/uploads-evil/x` — verified `true`. Compare against `ROOT + path.sep`.

## Permission model (page: permission model) — **correction to the syllabus**

Node **24.19.0**. Flags that actually exist:

```
--allow-addons  --allow-child-process  --allow-fs-read  --allow-fs-write
--allow-inspector  --allow-wasi  --allow-worker
```

**There is no `--allow-net` on 24** — `node --permission --allow-net=127.0.0.1` →
`node: bad option: --allow-net=127.0.0.1`. And network access is **not restricted**
under `--permission`: `net.connect` under `--permission --allow-fs-read=/tmp` returned
`ECONNREFUSED`, i.e. it attempted the connection.

**So on the target LTS the permission model does not sandbox the network at all.** The
syllabus row says granular `--allow-net` arrived in v25; the page must be explicit that
this is not available on 24, because "use the permission model to contain SSRF" would
be wrong advice here.

What does work:
```
node --permission --allow-fs-read=/tmp app.mjs
read /etc/passwd -> ERR_ACCESS_DENIED
  | Access to this API has been restricted. Use --allow-fs-read to manage permissions.
child_process    -> ERR_ACCESS_DENIED
process.permission -> object   (undefined without the flag)
  has('fs.read')        = false
  has('fs.read','/tmp') = true     <- scoped queries are the useful form
  has('net') = false               <- reported false, but net is not actually enforced
```

`has('net')` returning `false` while the network still works is a trap worth a gotcha.

---

# Added 2026-08-11 — pages 11–16

## CSRF (page 11) — `ex9-csrf.mjs`

Node writes the `Set-Cookie` string verbatim and validates nothing:
`sid=abc123; Path=/; HttpOnly` — **no `SameSite`, no `Secure`**. The Lax default is the
browser's, not the server's. Worth saying on the page: every attribute is yours to set.

A simulated cross-site form POST arrives complete:
```
{"method":"POST","origin":"https://evil.example","referer":"https://evil.example/page",
 "contentType":"application/x-www-form-urlencoded","cookie":"sid=abc123"}
```

`new URL(x).origin` normalisation — the reason to compare origins, not strings:
```
https://app.example.com:443  -> https://app.example.com    (default port dropped)
https://app.example.com/     -> https://app.example.com    (path dropped)
https://app.example.com:8443 -> https://app.example.com:8443
null                         -> URL threw Invalid URL      <- Origin: null is real; guard the parse
```

Signed double submit (`nonce.HMAC(sid.nonce)`): right session `true`, other session
`false`. That one line is the whole argument for signing over plain double-submit.

## SSRF (page 12) — `ex8-ssrf.mjs`, `ex10-ssrf-guard.mjs`

**The finding of the session.** A custom `lookup` guard is **never invoked for a literal
IP** — instrumented and confirmed:
```
127.0.0.1    -> SECRET | lookup called with: NEVER CALLED
2130706433   -> SECRET | lookup called with: NEVER CALLED
localhost    -> SECRET | lookup called with: localhost
```
So a connect-time DNS guard alone is not an SSRF defence. Parse-time `net.isIP` + guarded
lookup + per-hop redirect re-check — all three.

**Contradicts common advice:** `new URL()` normalises every obfuscated IPv4 spelling
(`2130706433`, `0x7f000001`, `0177.0.0.1`, `127.1`) to `127.0.0.1` before you see it, so
checking `url.hostname` sees the canonical form. The "attackers bypass with decimal IPs"
warning does not apply to a hostname-based check on Node.

Two smaller traps: `net.isIP('[::1]')` is **0** (brackets survive `new URL`), and
`::ffff:127.0.0.1` is re-spelled `::ffff:7f00:1`.

Redirects: default `fetch` follows into the private range (`200`, `redirected = true`);
`redirect:'manual'` gives 302 + location; `redirect:'error'` throws `unexpected redirect`.

Schemes through global `fetch`: `file:` → `not implemented... yet...`, `ftp:` →
`unknown scheme`, but **`data:text/plain,hi` returns 200**.

**Dependency trap:** an `Agent` from the npm `undici` passed to the runtime's global
`fetch` fails with `invalid onRequestStart method` — two separate undici copies. Import
`fetch` from `undici` too, or use `http.request({ lookup })`, which needs no dependency.

## Deserialization / open redirects / mass assignment (page 15) — `ex11-…`

`new URL(next, 'https://app.example.com/dashboard')`:
```
"//evil.example/phish"  -> https://evil.example/     OFF SITE
"/\\evil.example"       -> https://evil.example/     OFF SITE   <- slash-backslash, same thing
"https:/evil.example"   -> https://app.example.com/evil.example  (stays on site)
"javascript:alert(1)"   -> javascript:alert(1)       OFF SITE
```
Naive checks measured against those: `startsWith('/')` **passes** `//evil.example` and
`/\evil.example`; `includes('app.example.com')` **passes**
`https://evil.example/#app.example.com`.

`JSON.parse` reviver key order: `x, __proto__, y, constructor, ok, ` — nested first,
empty string last (the root). Free rejection hook.

Mass assignment: `Object.assign({...user}, body)` set `isAdmin:true` and
`credits:999999`. Denylist output still leaked `credits`.

## Prototype pollution extras (page 13)

`--disable-proto=throw`: the recursive merge **throws**
(`Accessing Object.prototype.__proto__ has been disallowed`) instead of polluting, while
`JSON.parse` still yields the own property. `Object.freeze(Object.prototype)` prevents the
write but **silently in sloppy mode** (CJS no-op) vs `TypeError: Cannot add property
isAdmin, object is not extensible` in ESM/strict.

## ReDoS (page 14) — `ex12-redos.mjs`

Re-measured, consistent with 2026-08-10: 20→89 ms, 24→229, 26→898, 28→3653.

**New and much better than a timing table:** during the 3.7 s match a concurrent 10 ms
interval fired **0 times** (≈377 expected). That single line is the page's argument.

Other shapes, all 25–27 chars: `/^(\w+\s?)*$/` 1893 ms · `/^(a|a)+$/` 11084 ms ·
`/(\d+)*$/` 10185 ms. Linear alternative: 1000 calls on an 81-char non-match = 0.670 ms.

Length cap bounds the exponent — same pattern, worst case: 16 chars 1 ms · 20 chars 8 ms ·
24 chars 120 ms. **Careful:** truncating `'a'.repeat(n)+'!'` to all-`a` makes it *match*
and return in 0 ms — that measures nothing. Keep the failing character.

Node 24 has no regex timeout of any kind; `setTimeout`/`AbortSignal` cannot interrupt a
synchronous match. Worker + `terminate()` or `re2`.

## Timing attacks (page 16) — `ex13-timing.mjs`

**Corrects the 2026-08-10 note.** With 200 000 iterations per point (not 20 000) the naive
comparison staircase **is** monotonic and clean:
```
 0 chars match ->   5.4 ms      timingSafeEqual:  0 -> 40.0 ms
16 chars match ->  42.9 ms                       32 -> 44.9 ms
32 chars match ->  78.9 ms                       63 -> 38.0 ms   (flat = noise)
48 chars match -> 109.6 ms
63 chars match -> 141.2 ms
```
The earlier "not monotonic at fine granularity" was a sampling artefact. Say staircase.

`timingSafeEqual` costs 0.2 µs per call — no performance argument against it ever.

**User enumeration is the leak that matters:** unknown user `0.0 ms` vs known user
`83.6 ms`. Dummy-hash fix: `71.2 ms` vs `69.5 ms`, indistinguishable. Milliseconds survive
network jitter; microseconds do not.

## Practices half (pages 17–27) — separate file

Measurements for the practices rows live in
[[devbible-phase8-measurements-practices]] (`reference_phase8_measurements_practices.md`),
so this file stays under the 300-line cap.
