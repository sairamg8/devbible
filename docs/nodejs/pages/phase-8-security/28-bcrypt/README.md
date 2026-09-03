---
title: "28 · bcrypt — the hash you inherit"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against **bcrypt 6.0.0** — the `node.bcrypt.js` README
> ([github.com/kelektiv/node.bcrypt.js](https://github.com/kelektiv/node.bcrypt.js)) and
> the npm registry metadata. Target: **bcrypt 6.0.0** (published 2025-05-11),
> `engines: {"node": ">= 18"}`. Documentation-verified — **the package is not installed
> in this checkout**, so nothing here was probed and no page carries a timing.

**bcrypt is the password hash you will meet, not the one you would choose.** For new
code the answer is argon2id, or scrypt if you want zero dependencies — that argument,
with measured numbers, is [01 · Password storage](../01-password-storage.md). This topic
exists because bcrypt is in every Node codebase written before roughly 2020, and you
cannot migrate off it, or safely maintain it, without knowing the two things that define
it: **the cost factor lives inside the hash**, and it **silently ignores everything past
the 72nd byte**.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The algorithm and the 72-byte trap](01-the-algorithm-and-the-72-byte-trap.md)** | Anatomy of the 60-character output — version prefix, cost, embedded salt — and why the column is `CHAR(60)`; cost as an **exponent**, not a multiplier; `$2a$` vs `$2b$` and why a mixed table needs no migration; 🔴 **the 72-BYTE limit** and why "byte" is the load-bearing word (`'é'.repeat(72)` is 144 bytes, eighteen emoji is the whole budget); the three ways out and what each costs; and 🔴 **the `<5.0.0` boundary** — NUL mishandling and 255-character truncation make that upgrade a data migration with locked-out users, not a dependency bump |
| 2 | **[Using it safely in Node](02-using-it-safely-in-node.md)** | The API surface including the overlooked `getRounds()`; 🔴 **the sync APIs block the event loop** (verbatim from the README) and the only contexts they belong in; why `===` verification is wrong **twice** — random salting *and* timing — and what `compare()` does instead; handling a stored value that is `NULL` or truncated so a rejected promise is not a 500; 🔴 **bcrypt is a compiled native addon**, so Alpine/musl, cross-platform `node_modules` and Node major upgrades all fail at startup; and how to choose a cost factor **without** a number quoted from someone else's machine |

## Phase gate

You are done with this topic when you can say what each field of a 60-character bcrypt
hash is for, explain why the 72-byte limit is a security bug rather than a quirk and name
the three responses to it, say why `compareSync` in a request handler is a
whole-process problem rather than a slow endpoint, explain why re-hashing and comparing
with `===` can never work, and describe a cost-factor upgrade that locks nobody out.

## Where this connects

- [01 · Password storage](../01-password-storage.md) — the tier-1 argument: why a
  password hash must be slow, argon2id vs scrypt vs bcrypt, and the **measured** numbers
  this topic deliberately does not duplicate
- [16 · Timing attacks](../16-timing-attacks.md) — why comparing secrets with `===`
  leaks, and what constant-time comparison is for
- [20 · Node crypto](../20-node-crypto.md) — `scrypt` and the rest of `node:crypto`, the
  zero-dependency alternative with no native addon to break
- [21 · Rate limiting](../21-rate-limiting.md) — a slow hash raises the cost per guess
  and does not cap the number of guesses; it is also a denial-of-service surface

---

← [Phase index](../README.md) · Start → [The algorithm and the 72-byte trap](01-the-algorithm-and-the-72-byte-trap.md)
