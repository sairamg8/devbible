---
title: "02 · The rest, and why you should not write your own"
sidebar_label: "02 · The rest, and why not"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto), [`SubtleCrypto.encrypt()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt), [`SubtleCrypto.generateKey()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey), [`SubtleCrypto.deriveKey()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [`SubtleCrypto.sign()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign), [`CryptoKey`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey), [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API). Documentation-validated; **no timings and no console output**.

The rest of `crypto.subtle` — encryption, keys, signatures — is a correct, audited implementation
of primitives that are **very easy to combine incorrectly**. The API being available is not the
same as the design being sound, and the design is the part that fails.

## 🔴 First: what is the browser protecting against?

Client-side cryptography protects data from **whoever cannot run script in the page**. It does
not protect it from:

| Threat | Why the browser cannot help |
|---|---|
| Your own server | it serves the script that does the encrypting; it can serve a different one tomorrow |
| A compromised dependency | it runs with full access to your keys and plaintext ([02 · Client-side security](../02-client-side-security/README.md)) |
| XSS | script in the page *is* the page |
| A user reading their own data | it is their browser, and their debugger |

**So the honest uses are narrow, and they are real:** end-to-end encryption where the key never
reaches your server, encrypting something before putting it in storage you consider hostile,
verifying a signature over data you fetched, and deriving a key from a passphrase the user types
and you never see. Everything else — sessions, authorisation, password handling, secrets — is a
server responsibility (**13 · What belongs on the server** *(not written yet)*).

## Keys are objects, not strings

```js
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  false,                              // 🔴 extractable: false — cannot be read out, ever
  ['encrypt', 'decrypt'],
);
```

A `CryptoKey` is an opaque handle. Three properties do the work:

| | |
|---|---|
| `extractable: false` | `exportKey` will refuse. Use this whenever the key does not have to leave |
| `usages` | a key generated for `['encrypt']` **cannot** sign — the API enforces the separation |
| `algorithm` | fixed at creation; a key is bound to one algorithm |

🔴 **A `CryptoKey` is structured-cloneable, so it can be stored in IndexedDB** — including a
non-extractable one. That is the platform's answer to "where do I keep the key": in the browser's
own storage, in a form JavaScript can use but not read. Storing key *material* in
`localStorage` as a hex string is the opposite of that, and it is what most hand-rolled attempts
do.

`importKey` brings in raw bytes or a JWK from elsewhere; `deriveKey` produces one from a password
or a shared secret.

## Encryption: AES-GCM, and the one rule that matters

```js
const iv = crypto.getRandomValues(new Uint8Array(12));           // 96-bit, fresh EVERY time
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
// store iv alongside ciphertext — it is not secret
const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
```

🔴 **Never reuse an IV with the same key.** With GCM, two messages encrypted under the same
key and nonce leak the relationship between their plaintexts and can destroy the authentication
guarantee entirely. This is the single most common catastrophic mistake in application
cryptography, and the API cannot stop you making it: a hard-coded `new Uint8Array(12)` of zeroes
looks fine and works fine.

**The IV is not secret** — store or transmit it with the ciphertext, conventionally prefixed.
**AES-GCM is authenticated**: `decrypt` rejects if the ciphertext was tampered with, which is why
it is the default choice over AES-CBC, where you would have to add a MAC yourself and get *that*
right too.

## Deriving a key from a password

```js
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase),
  'PBKDF2', false, ['deriveKey']);

const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: crypto.getRandomValues(new Uint8Array(16)),
    iterations: 600_000, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
);
```

**A fresh random salt per user, stored alongside; iterations as high as the device tolerates.**
PBKDF2 is what WebCrypto offers — Argon2 and scrypt are not in the API, which is another reason
password *verification* belongs on a server that has them.

⚠️ **This is for deriving an encryption key from a passphrase**, not for authenticating a login.
Do not send the derived key to the server as a password substitute; you have then invented a
password, with extra steps.

## Signing and verifying

```js
const sig = await crypto.subtle.sign('HMAC', hmacKey, data);        // symmetric — same key both sides
const ok  = await crypto.subtle.verify('HMAC', hmacKey, sig, data);
```

**Use `verify`, never a manual comparison.** Comparing two arrays with a loop leaks timing
information, and JavaScript gives you no constant-time comparison; `verify()` is the constant-time
primitive.

⚠️ **HMAC verification in the browser proves nothing to your server** — if the browser holds the
key, so does anyone who reads the bundle. Asymmetric signatures (`ECDSA`, `RSA-PSS`) are the ones
that make sense client-side: the browser holds only the **public** key and checks something the
server signed.

## Traps, briefly, because each is a real incident

| Trap | What happens |
|---|---|
| Reusing a GCM IV | catastrophic; the classic nonce-reuse failure |
| Rolling your own construction (encrypt-then-what?) | authentication that does not authenticate |
| Storing key material in `localStorage` | one XSS reads it — use a non-extractable `CryptoKey` in IndexedDB |
| ECB mode, "just for speed" | not offered by WebCrypto, and that is deliberate |
| Comparing MACs with `===` on a hex string | timing side channel; use `verify` |
| Encrypting client-side to "protect from the server" | the server ships the code doing the encrypting |
| A "random" IV from `Math.random()` | not random ([01](./01-randomness-and-hashing.md)) |

## 🔴 So what should you actually do?

1. **Use TLS.** Almost every "we should encrypt this in the browser" is already solved by HTTPS
   plus a server that stores things properly.
2. **Let the server hold secrets.** Sessions in `HttpOnly` cookies, tokens minted and verified
   server-side, passwords hashed with Argon2 or bcrypt there.
3. **Where the browser genuinely must do crypto, use a reviewed high-level library** built on
   WebCrypto rather than assembling primitives — the primitives are correct and the *composition*
   is where things break.
4. **If you must use `subtle` directly, keep it to one small module**, with the IV rule and the
   key-usage rules encoded in the function signatures so callers cannot get them wrong.

**"Do not roll your own crypto" is not about the algorithms** — WebCrypto already gives you
correct AES and SHA-2. It is about protocol design: key management, nonce handling, authentication
order, replay, rotation. That is where working code turns out to be broken, and it does so
silently.

## Gotchas

**Symptom: decryption fails with an unhelpful `OperationError`.**
Cause — wrong key, wrong IV, or tampered ciphertext; GCM refuses rather than returning garbage.
Fix — check that the IV is stored and retrieved with the ciphertext; treat the failure as
"authentication failed", which is exactly what it is.

**Symptom: `exportKey` throws.**
Cause — the key was created with `extractable: false`.
Fix — that is the point; keep the key as a `CryptoKey` in IndexedDB and never materialise it.

**Symptom: encryption "works" but a reviewer calls it insecure.**
Cause — a constant or reused IV.
Fix — a fresh `getRandomValues(new Uint8Array(12))` per message, stored with the output.

**Symptom: keys vanish for some users.**
Cause — IndexedDB was evicted; storage is not permanent by default.
Fix — `navigator.storage.persist()`, and design for the key being gone — data encrypted under a
lost key is lost.

**Symptom: a MAC check passes for a wrong signature under load.**
Cause — a hand-written comparison, possibly short-circuiting.
Fix — `crypto.subtle.verify`.

**Symptom: `crypto.subtle` is `undefined`.**
Cause — insecure context.
Fix — HTTPS; see [01](./01-randomness-and-hashing.md).

## Interview questions

**★ What does client-side encryption actually protect against?**
Anyone who cannot run script in the page. Not your server, which serves the script; not a
compromised dependency; not XSS. The honest uses are end-to-end schemes where the key never
reaches the server, hostile-storage encryption, and verifying signatures with a public key.

**★ What is the most dangerous mistake with AES-GCM?**
Reusing an IV with the same key. It breaks confidentiality and authentication, it is easy to do by
accident with a constant IV, and nothing in the API warns you. Fresh 96-bit random IV per message,
stored alongside the ciphertext.

**★ Where do you keep a key in a browser?**
As a non-extractable `CryptoKey` in IndexedDB — structured-cloneable, usable by the API, not
readable by script. Never as key material in `localStorage`.

**★ Is PBKDF2 in the browser a substitute for server-side password hashing?**
No. It derives an encryption key from a passphrase. Authentication belongs on the server with a
memory-hard function such as Argon2 or scrypt, neither of which WebCrypto offers.

**★ Why use `subtle.verify` instead of comparing the bytes yourself?**
Because a naive comparison leaks timing information, and JavaScript offers no constant-time
comparison. `verify` is the primitive that does it correctly.

**"Don't roll your own crypto" — but WebCrypto gives me AES. What is left to get wrong?**
The protocol: key management, nonce handling, whether authentication covers everything it should,
replay, rotation, and what happens when a key is lost. The primitives are the easy part.

---

← [01 · Randomness and hashing](./01-randomness-and-hashing.md) · [Topic index](./README.md)
