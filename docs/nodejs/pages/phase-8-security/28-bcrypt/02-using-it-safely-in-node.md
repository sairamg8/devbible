---
title: "The sync API blocks the event loop, the native addon breaks on deploy, and compare() is the only correct way to verify — bcrypt's operational failures are all in the wiring, not the algorithm"
sidebar_label: "02 · Using it safely in Node"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against **bcrypt 6.0.0** — the `node.bcrypt.js` README
> ([github.com/kelektiv/node.bcrypt.js](https://github.com/kelektiv/node.bcrypt.js)) and
> npm registry metadata. Target: **bcrypt 6.0.0**, `engines: {"node": ">= 18"}`,
> dependencies `node-addon-api ^8.3.0` and `node-gyp-build ^4.8.4`.
> Documentation-verified only — **the package is not installed here**, so there are no
> timings on this page and nothing was probed. Where a number would need a run, the
> mechanism is explained instead.

**Every way bcrypt hurts a running Node service is operational, not cryptographic.** The
algorithm is fine. What breaks is a synchronous call in a request handler, a native
addon that will not build in your container, and a verification written with `===`. This
chunk is those failures and their fixes.

## The API surface

The README names both callback/promise and synchronous forms:

| Async | Sync | What it does |
|---|---|---|
| `hash(data, saltOrRounds)` | `hashSync(data, saltOrRounds)` | Generates a salt (from a rounds number) and hashes |
| `compare(data, encrypted)` | `compareSync(data, encrypted)` | Verifies a password against a stored hash |
| `genSalt(rounds)` | `genSaltSync(rounds)` | Generates a salt string on its own |
| — | `getRounds(encrypted)` | Reads the cost factor back out of a stored hash |

`hash()` accepts **either** a rounds number or a pre-generated salt. Passing the number
is the normal path — there is no reason to generate the salt separately unless you need
the salt string itself, which you almost never do.

`getRounds()` is the one people miss, and it is what makes a cost upgrade checkable:

```js
import bcrypt from 'bcrypt';

const COST = 12;
const needsRehash = (stored) => bcrypt.getRounds(stored) < COST;
```

The library also works with native promises and, per the README, accepts a custom
implementation via `bcrypt.promises.use()`. On any supported Node that is legacy surface
— use the built-in promises.

## 🔴 The sync API blocks the event loop

The README says it plainly:

> *"bcrypt hashing is CPU intensive which will cause the sync APIs to block the event
> loop."*

This is the single most common bcrypt defect in production Node. `hashSync` and
`compareSync` are not "the simpler version" — in a request handler they stop **every**
concurrent request, not just the one being hashed. At a realistic cost factor, one login
freezes the process for a human-perceptible interval; a hundred concurrent logins
serialise into a queue with no concurrency at all.

```js
// 🔴 Never in a request path. One login stalls every other request in the process.
app.post('/login', (req, res) => {
  const ok = bcrypt.compareSync(req.body.password, user.hash);   // blocks the loop
  res.json({ok});
});

// ✅ The async form does the work off-loop.
app.post('/login', async (req, res) => {
  const ok = await bcrypt.compare(req.body.password, user.hash);
  res.json({ok});
});
```

**The sync forms are for scripts** — a seeding script, a one-off migration, a test
fixture — where there is no event loop to protect and the simpler control flow is worth
having. That is the whole of their legitimate use.

⚠️ **The async form is not free concurrency either.** Like `scrypt`, the work lands on
the libuv thread pool, which defaults to four threads — so login throughput has a ceiling
per process regardless of how many requests arrive. The measured version of that argument,
with real numbers from a real run, is on
[01 · Password storage](../01-password-storage.md); the shape is the same here. **Measure
it on your deploy hardware at your cost factor** rather than trusting a number from a
laptop.

## Verification is `compare()`, never `===`

```js
// 🔴 Wrong in two independent ways.
const ok = (await bcrypt.hash(password, 12)) === user.passwordHash;
```

It fails first because **the salt is random per call**: hashing the same password twice
produces two different 60-character strings, so this comparison is false even when the
password is right. And it fails second because a `===` on secret material short-circuits
at the first differing byte, leaking information through timing
([16 · Timing attacks](../16-timing-attacks.md)).

`compare()` is the only correct form. It reads the salt and cost out of the stored hash,
recomputes with those exact parameters, and compares the result properly:

```js
const ok = await bcrypt.compare(password, user.passwordHash);
```

⚠️ **`compare()` rejects rather than returning `false` when the stored value is not a
valid bcrypt hash** — a `NULL` column, an empty string, a value truncated by a narrow
column. Handle it, because "user has no password set" is a real state in any system with
social login:

```js
export async function verify(password, stored) {
  if (typeof stored !== 'string' || stored.length !== 60) return false;
  return bcrypt.compare(password, stored);
}
```

🔴 **Do not return early when the user does not exist.** Hash anyway so a miss costs the
same as a hit, or you have built an account-enumeration oracle — the full argument, with
the timing numbers behind it, is on [01 · Password storage](../01-password-storage.md).

## It is a native addon, and that is a deployment property

The registry metadata for 6.0.0 lists `node-addon-api` and `node-gyp-build` as
dependencies. bcrypt is **compiled C++**, not JavaScript, and `node-gyp-build` resolves a
prebuilt binary for your platform when one exists and falls back to compiling when it
does not. Practical consequences, all of which show up at deploy time rather than in
development:

**A `node_modules` copied between platforms will not work.** A binary built on macOS
does not load on Alpine Linux. Anything that bakes `node_modules` into an image on one
platform and runs it on another breaks here first.

**Alpine is the classic failure.** The musl C library is not glibc, so a prebuild
targeting glibc will not load and the fallback compile needs `python3`, `make` and `g++`
in the image. A multi-stage Dockerfile that installs build tools in the builder and
copies only `node_modules` forward produces a binary that cannot load at runtime unless
the runtime base matches the builder.

**A Node major upgrade can require a rebuild.** Native addons are built against a
specific ABI. `node-addon-api` targets the stable Node-API, which is what makes prebuilds
survive Node upgrades — but a mismatch still surfaces as a load error at startup, not as
a failed install.

**`engines` says `>= 18`**, and the README says Node 18+ is actively tested. Below that
you are on untested ground with a native addon, which is the worst combination.

⚠️ **`scrypt` has none of these problems** — it is in `node:crypto`, with nothing to
build. If your deployment story is fragile, that alone is a strong argument for the
migration described on [01 · Password storage](../01-password-storage.md).

## Choosing a cost factor

The cost is an exponent: cost 12 means 2¹² iterations, and each step up **doubles** the
work. The method, which does not depend on any number this page could give you:

1. Decide the login latency you can afford, and the logins per second you must sustain.
2. On **deploy hardware**, time `bcrypt.hash()` at a candidate cost.
3. Take the highest cost that fits both budgets, remembering the thread-pool ceiling
   caps concurrency regardless of per-hash latency.
4. Re-check annually. Hardware gets faster; a cost chosen in 2019 is weaker now.

🔴 **This page deliberately gives no millisecond figures.** There is no sandbox in this
project, and a timing quoted from memory would be a fabricated measurement — the exact
defect the evidence rules exist to prevent. The scrypt equivalent on
[01 · Password storage](../01-password-storage.md) *does* carry real numbers because a
committed script produced them.

Because `getRounds()` reads the cost back out, raising it is transparent — verify with
the stored cost, rehash at login when it is below policy, and old hashes keep working
until their owners next sign in.

## Gotchas

**★ Symptom: the whole service stalls during login spikes, and profiling blames nothing
in particular.** Cause: `hashSync`/`compareSync` in a request handler blocking the event
loop, exactly as the README warns. Fix: the async forms everywhere in request paths;
reserve sync for scripts.

**★ Symptom: `compare()` always returns false even with the right password.** Cause:
usually the stored value was altered — a truncating column, a trimmed string, or a hash
re-hashed on read. Fix: check the stored value is exactly 60 characters before blaming
the password.

**★ Symptom: verification throws instead of returning false.** Cause: the stored value is
`NULL`, empty, or not a bcrypt hash — common for accounts created via social login. Fix:
guard the shape first and return false, rather than letting a rejected promise become a
500.

**★ Symptom: `npm install` succeeds locally, the container fails at startup with a module
load error.** Cause: the native addon's prebuild does not match the runtime platform —
typically glibc-built binaries on musl/Alpine, or `node_modules` copied across platforms.
Fix: build on the same base image you run, or move to `scrypt` and delete the problem.

**★ Symptom: a Node major upgrade breaks the login path at startup.** Cause: the compiled
addon was built against a different ABI. Fix: rebuild dependencies as part of the
upgrade; do not treat a native addon as a pure-JS dependency.

**★ Symptom: someone "optimises" login by comparing hashes with `===`.** Cause: bcrypt
salts randomly, so re-hashing never reproduces the stored string — and comparing secrets
with `===` leaks timing. Fix: `compare()`, always.

**Symptom: cost was raised and login latency became unusable.** Cause: cost is an
exponent — two steps is four times the work. Fix: step it one at a time, measuring on
deploy hardware between steps.

**Symptom: hashes are generated in a `for` loop during a bulk import and the process
stops responding.** Cause: even the async form saturates the four-thread pool. Fix: bound
concurrency explicitly and run bulk work outside the request process.

## Interview questions

**★ Why is `compareSync` a problem in an Express handler when the code looks correct?**
Because bcrypt is deliberately CPU-intensive and the sync API runs that work on the main
thread — the README says the sync APIs block the event loop. In Node that does not slow
one request, it stops every request in the process for the duration, so a login spike
degrades endpoints that have nothing to do with authentication. The async form moves the
work to the libuv thread pool and keeps the loop free, at the cost of a per-process
concurrency ceiling you should measure.

**★ Why can't you verify a password by hashing it again and comparing strings?**
Because bcrypt generates a fresh random salt on every `hash()` call, so the same password
produces a different 60-character string each time and the comparison is false even when
the password is right. `compare()` exists precisely because verification must reuse the
salt and cost embedded in the stored hash. Separately, comparing secret material with
`===` short-circuits at the first differing byte and leaks information through timing.

**★ What does it mean that bcrypt is a native addon, and when does it bite?**
It ships compiled C++ rather than JavaScript, resolved by `node-gyp-build` to a prebuilt
binary or compiled on install. It bites at deploy time: binaries are platform-specific,
so `node_modules` cannot be copied between platforms, Alpine's musl libc will not load a
glibc prebuild, and a Node major upgrade can require a rebuild. All of these surface as a
module-load error at startup rather than a failed install, which makes them look like an
application bug. `scrypt` in `node:crypto` has none of these properties, which is a real
argument in its favour beyond cryptography.

**★ How do you pick a cost factor, and why can't I just tell you a good one?**
You measure it on the hardware you deploy to, against a latency budget and a required
logins-per-second, then take the highest cost that fits both — remembering the thread
pool caps concurrency independently of per-hash latency. A number quoted from someone
else's machine is worthless because the whole point of the parameter is to track
available compute, which is why it needs revisiting annually. It is an exponent, so each
step doubles the cost.

**★ How do you raise the cost factor on a live system without locking anyone out?**
`getRounds()` reads the cost out of each stored hash, so you verify with the parameters
that hash was created with — old hashes keep working. On a successful login, when you
legitimately hold the plaintext, compare the stored cost to policy and rewrite the hash
at the new cost if it is lower. Existing users migrate as they sign in; you cannot do it
in bulk because you do not have the plaintexts.

**Why are the sync APIs in the library at all?**
Because there are contexts with no event loop to protect: seeding scripts, migrations,
test fixtures and CLI tools, where straight-line control flow is genuinely simpler and
blocking costs nothing. The rule is not "sync is bad", it is "sync is never in a request
path".

---

← [The algorithm and the 72-byte trap](01-the-algorithm-and-the-72-byte-trap.md) ·
[Topic index](README.md) · Next → [Phase 9 · Testing](../../phase-9-testing/)
