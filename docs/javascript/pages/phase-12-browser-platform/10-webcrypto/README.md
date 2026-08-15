---
title: "10 · WebCrypto"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), [`Crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [`SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto), [`CryptoKey`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey). Documentation-validated; **no timings and no console output**.

The syllabus row is *`crypto.randomUUID`, `getRandomValues`, hashing with `subtle.digest`, and why
you do not write your own crypto* — and it is deliberately ordered that way. The first three are
everyday tools you should reach for immediately. The fourth is the reason the rest of the API
needs a warning label.

🔴 **The primitives are correct; the composition is what breaks.** WebCrypto gives you audited
AES, SHA-2 and ECDSA. What it cannot give you is a sound protocol — key management, nonce
handling, what the authentication actually covers — and that is where real systems fail, silently.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Randomness and hashing](./01-randomness-and-hashing.md)** | `randomUUID()` replacing every hand-rolled id; why `Math.random()` is not an identifier; `getRandomValues` and its 65 536-byte limit; `subtle.digest` end to end, including the encode-then-convert steps; what hashing is for — and that it is not passwords, not secrecy, not integrity on its own; the secure-context gate |
| 02 | **[The rest, and why you should not](./02-the-rest-and-why-not.md)** | The threat model client-side crypto actually addresses; `CryptoKey` as an opaque, non-extractable handle stored in IndexedDB; AES-GCM and the never-reuse-an-IV rule; PBKDF2 for deriving a key from a passphrase, and why that is not authentication; `sign`/`verify` and constant-time comparison; the trap table; what to do instead |

## Three facts worth carrying out of this topic

- **`crypto.randomUUID()` is the id generator.** `Math.random()` promises nothing about
  unpredictability or uniqueness, and both matter for ids.
- **Never reuse an AES-GCM IV with the same key.** Fresh 96 random bits per message, stored
  alongside the ciphertext — nothing in the API stops you getting this wrong.
- **Client-side crypto does not protect you from your own server**, which ships the script doing
  the encrypting. Passwords, sessions and secrets stay server-side.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [02 · Client-side security](../02-client-side-security/README.md) — XSS, dependencies and why
  script in the page defeats key secrecy
- [09 · 02 · navigator and screen](../09-window-document-navigator/02-navigator-and-screen.md) —
  the secure-context gate that also hides `crypto.subtle`
- [07 · Web Workers](../07-web-workers/03-deciding-and-patterns.md) — where a large hash or
  derivation belongs, so the main thread stays responsive
- **Phase 11 · 11 · Uploading files** *(not written yet)* — hashing a file before sending it, and
  the memory shape of `arrayBuffer()`
- **13 · What belongs on the server instead** *(not written yet)* — the honest list, of which
  password handling and secret storage are the first two entries

---

Start → [01 · Randomness and hashing](./01-randomness-and-hashing.md)
