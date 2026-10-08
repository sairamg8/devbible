---
title: "On Node 24 argon2id is a core function, not a dependency — but it returns a raw Buffer, so the stored format is yours"
sidebar_label: "01b · argon2 in node:crypto"
sidebar_position: 1.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-08 against the Node.js `crypto` API docs for v24.19.0
> ([nodejs.org/docs/latest-v24.x/api/crypto.html](https://nodejs.org/docs/latest-v24.x/api/crypto.html),
> read from `doc/api/crypto.md` at tag `v24.19.0`, and the same file at `v24.18.0`, `v24.7.0` and `v22.x`), and
> `CHANGELOG_V24.md` / `CHANGELOG_V22.md` ([github.com/nodejs/node](https://github.com/nodejs/node/tree/main/doc/changelogs)).
> Target: **Node 24.19.0**. Documentation-verified only: the example below was not run, and no
> timing or output appears on this page. The measured numbers are on [01 · Password storage](./01-password-storage.md).

**Before Node 24.7.0, "use argon2id" meant installing a native package; on the pinned 24.19.0 it means
one import from `node:crypto`.** What the core API does not give you is a storage format: it returns
the derived key as a `Buffer`, so the string you store, the parameters inside it and the migration from
any other scheme are code you write. This page is the argon2 half of
[01 · Password storage](./01-password-storage.md), split out when it outgrew the file cap.

## What shipped, and when

`crypto.argon2(algorithm, parameters, callback)` and `crypto.argon2Sync(algorithm, parameters)`
carry `added: v24.7.0` in the docs. The v24.18.0 docs mark `argon2` `Stability: 1.2 - Release
candidate`; the 24.19.0 changelog lists *"doc,crypto: mark argon2 and encap/decap as stable"*,
and the 24.19.0 page has no separate banner, so the module-level `Stability: 2 - Stable`
applies. The 22.x docs and `CHANGELOG_V22.md` contain no argon2 entry — it was not
backported to 22. (Older lines: not checked.)

Patch releases after the pin touch it: the 24.20.0 changelog lists *"crypto: fix Argon2 validation errors"* and
*"crypto: fix Argon2 bypassing FIPS mode"*, a reason to run a current 24.x patch rather than 24.19.0 itself.

> *"`algorithm` Variant of Argon2, one of `"argon2d"`, `"argon2i"` or `"argon2id"`."*
> *"`memory` REQUIRED, memory cost in 1KiB blocks. Must be at least `8 * parallelism` and at most `2**32-1`."*
> *"The `nonce` should be as unique as possible. It is recommended that a nonce is random and at least 16 bytes long."*

The result is a raw `Buffer` (*"`derivedKey` is passed to the callback as a `Buffer`"*), so
the stored-string format is yours, exactly as with scrypt on [01](./01-password-storage.md):

```js
import {argon2, randomBytes, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const argon2Async = promisify(argon2);
const COST = {parallelism: 4, tagLength: 32, memory: 65536, passes: 3};  // memory: 1 KiB blocks

export async function hashPasswordArgon2(password) {
  const nonce = randomBytes(16);
  const tag = await argon2Async('argon2id',
    {...COST, message: password.normalize('NFKC'), nonce});
  return ['argon2id', COST.memory, COST.passes, COST.parallelism,
    nonce.toString('base64'), tag.toString('base64')].join('$');
}

export async function verifyPasswordArgon2(password, stored) {
  const [scheme, memory, passes, parallelism, nonceB64, tagB64] = stored.split('$');
  if (scheme !== 'argon2id') throw new Error(`unknown scheme ${scheme}`);
  const expected = Buffer.from(tagB64, 'base64');
  const actual = await argon2Async('argon2id', {
    message: password.normalize('NFKC'), nonce: Buffer.from(nonceB64, 'base64'),
    memory: Number(memory), passes: Number(passes), parallelism: Number(parallelism),
    tagLength: expected.length});
  return timingSafeEqual(actual, expected);
}
```

The cost values are the docs' own example (`parallelism: 4`, `memory: 65536`, `passes: 3`),
not a recommendation; the docs link RFC 9106 and give no policy numbers, so measure on
your hardware as for scrypt. `memory: 65536` is 64 MiB per concurrent hash. `argon2Sync`
blocks the event loop like `scryptSync` and stays out of request paths.

## Gotchas

**Symptom:** Code calling `crypto.argon2` works locally on Node 24 and breaks on a Node 22 runner
**Cause:** `argon2` was `added: v24.7.0` and is absent from the 22.x docs and changelog.
**Fix:** Pin `engines` to `>=24.7.0`, or feature-detect and fall back:
`const hasArgon2 = typeof require('node:crypto').argon2Sync === 'function';` (CommonJS; in an ES module use `import * as crypto from 'node:crypto'` and test `typeof crypto.argon2Sync`)

**Symptom:** Hashes from the `argon2` package cannot be verified with `crypto.argon2`
**Cause:** The core API takes `message`, `nonce` and cost fields and returns a raw `Buffer`; it
has no encoded-string reader or verify helper. Any stored format, and any import of old
hashes, is code you write (the other package's string layout is not documented here).
**Fix:** Keep verifying old hashes with the old package by scheme prefix, the same scheme-prefix migration shown in [01 · Password storage](./01-password-storage.md).

## Interview questions

**★ Do you still need the `argon2` npm package on Node 24?**
Not for hashing: `crypto.argon2()` and `argon2Sync()` exist from 24.7.0 and are stable as of
24.19.0. You still need it on Node 22 or earlier, or if you rely on its encoded-hash
strings, because the core API returns only the raw derived key.

---

← Prev: [Password storage](./01-password-storage.md) · Next → [Sessions vs JWT](./02-sessions-vs-jwt.md)
