---
title: "Floating promises"
sidebar_label: "12 · Floating promises"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**An async call nobody awaited. It runs, it fails, and either nothing happens or
the whole process dies — both outcomes are worse than an ordinary error.**

## What it looks like

```js
// float.mjs
async function save(record) {
  throw new Error('db write failed');
}

save({ id: 1 });                 // ← floating: no await, no .catch
setTimeout(() => console.log('THIS NEVER PRINTS'), 100);
```

```console
$ node float.mjs
Error: db write failed
    at save (file:///home/you/float.mjs:2:9)
...
$ echo $?
1
```

The process **died**. Since Node 15, an unhandled rejection terminates the process
by default — see [unhandled rejections](15-unhandled-rejections.md).

The other outcome is quieter and worse:

```js
// silent.mjs
async function audit(event) {
  await writeToAuditLog(event);      // fails intermittently
}

async function handler(req, res) {
  audit({ user: req.user });         // ← floating
  res.json({ ok: true });            // responds 200 regardless
}
```

The request succeeds. The audit silently did not happen. Nothing in the logs says
so, and you find out during an incident review months later.

## The three ways it happens

**1. Forgetting `await`** — the plain case, usually in a refactor when a function
becomes async and one call site is missed.

**2. `forEach` with an async callback:**

```js
// foreach.mjs
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const t = Date.now();
[1, 2, 3].forEach(async (n) => { await sleep(100); });
console.log('forEach returned after', Date.now() - t, 'ms — it did not wait');
```

```console
$ node foreach.mjs
forEach returned after 0 ms — it did not wait
```

`forEach` ignores its callback's return value. Three promises were created and
dropped. Use `for...of` or `Promise.all(map(...))` —
[sequential vs parallel](10-sequential-vs-parallel.md).

**3. Not returning inside `.then`** — the same bug in chaining form, covered in
[promise states](07-promise-states.md).

## Making it deliberate

Sometimes you genuinely do not want to wait — metrics, cache warming,
fire-and-forget notifications. That is fine, but it must be **explicit and
handled**:

```js
// ✅ deliberate, with a handler
metrics.flush().catch(err => log.warn('metrics flush failed', err));

// ✅ deliberate, with a name that says so
void trackEvent('checkout').catch(reportError);
```

The `void` operator is the convention that tells both a reader and the linter "I
know this is a promise and I am choosing not to await it." It is not magic — the
`.catch` is what makes it safe.

Never leave the `.catch` off. A background task that fails silently is a bug you
cannot see; a background task that kills the process is worse.

## Catching them before production

This is a class of bug that tooling solves almost completely:

```json
// .eslintrc — with typescript-eslint
{
  "rules": {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error"
  }
}
```

`no-floating-promises` flags every promise-returning call whose result is
discarded. `no-misused-promises` catches the `forEach` case and async callbacks
passed where a sync function is expected. Both need type information, so they need
TypeScript — which is the strongest practical argument for TypeScript in a Node
codebase.

Without TypeScript, the runtime net is a process-level handler that logs loudly:

```js
process.on('unhandledRejection', (reason) => {
  log.fatal('unhandled rejection', reason);
  process.exitCode = 1;
});
```

That is a detector, not a fix — see [page 15](15-unhandled-rejections.md).

## Gotchas

**Symptom:** The process exits with code 1 and a stack trace from code that "should
not be fatal"
**Cause:** A floating promise rejected. Unhandled rejections are fatal by default.
**Fix:** `await` it, or attach `.catch()`.

**Symptom:** An async side effect never happens, with no error anywhere
**Cause:** Floating promise that rejected — or one abandoned when the process
exited before it settled.
**Fix:** `await` it before responding, or make it explicitly deferred with a
handler and a queue.

**Symptom:** `await` inside `forEach` appears to do nothing
**Cause:** `forEach` discards the returned promise.
**Fix:** `for...of` or `Promise.all(items.map(fn))`.

**Symptom:** A background task's failure kills a healthy request
**Cause:** Floating rejection crashing the process mid-request.
**Fix:** `.catch()` on the background task. Decide deliberately whether its failure
should be fatal.

**Symptom:** Tests pass but log warnings after the run finishes
**Cause:** Floating promises settling after the test completed.
**Fix:** Await everything in tests. Most runners can fail on unhandled rejections.

## Interview questions

**★ What is a floating promise and why is it dangerous?**
A promise-returning call whose result is never awaited or handled. If it rejects,
there is no handler — and since Node 15 an unhandled rejection terminates the
process by default. If it fulfils, its work may simply never be observed, so a side
effect silently does not happen.

**★ Why does `await` inside `forEach` not work?**
`forEach` ignores its callback's return value, so each async callback returns a
promise that is immediately discarded. The loop finishes synchronously while the
work is still in flight. Use `for...of` for sequential or `Promise.all` with `map`
for parallel.

**★ How do you deliberately not await a promise?**
Attach a `.catch()` so the rejection is handled, and mark the intent — `void
doThing().catch(handle)`. The `void` is a signal to readers and linters; the
`.catch` is what actually makes it safe.

**★ How do you catch floating promises before production?**
`@typescript-eslint/no-floating-promises` and `no-misused-promises` flag them at
lint time. Both require type information, so this is one of the strongest practical
arguments for TypeScript in Node. At runtime, a `process.on('unhandledRejection')`
handler detects what slipped through.

**Is a `process.on('unhandledRejection')` handler a fix?**
No — it is a detector. It tells you a promise was unhandled, usually far from where
the bug is, and suppressing the default crash there can leave the process in an
inconsistent state. Fix the call site.

---

← Prev: [Error handling](11-error-handling.md) · Next → [Callbacks and promisify](13-callbacks-and-promisify.md)
