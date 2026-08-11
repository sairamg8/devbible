---
title: "Promise anti-patterns"
sidebar_label: "17 · Promise anti-patterns"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Six shapes that keep appearing in real code. Each one works often enough to
survive review, and each one is either strictly worse than the plain version or
actively loses errors.**

## 1. The explicit construction antipattern

Wrapping something that already returns a promise in `new Promise`:

```js
// ❌ five lines that do nothing
function getUser(id) {
  return new Promise((resolve, reject) => {
    fetchUser(id).then(u => resolve(u)).catch(e => reject(e));
  });
}

// ✅
function getUser(id) {
  return fetchUser(id);
}
```

Both return the same value. The wrapper adds a promise, a closure and two places
to get it wrong — forget the `.catch` and the rejection vanishes into a promise
that never settles.

`new Promise` is correct in exactly one situation: **wrapping a callback or event
API that has no promise form** — see
[callbacks and promisify](13-callbacks-and-promisify.md).

## 2. The `async` executor

```js
// exec.mjs
process.on('unhandledRejection', (r) => console.log('unhandledRejection →', r.message));

const p = new Promise(async (resolve) => {
  throw new Error('lost');            // rejects the async function, not p
});

let settled = false;
p.then(() => settled = 'fulfilled', () => settled = 'rejected');
setTimeout(() => console.log('p settled?', settled), 50);
```

```console
$ node exec.mjs
unhandledRejection → lost
p settled? false
```

The executor is an `async` function, so its `throw` rejects **the executor's own
promise**, which nobody holds. `p` is never resolved and never rejected — it stays
pending forever, and anything awaiting it hangs.

You will often read that the error is "silently swallowed". That was true before
Node 15; today the orphaned rejection surfaces as an `unhandledRejection` and
**kills the process by default**. Removing the handler above exits with code 1. The
error is loud — but it is reported at the wrong place, and `p` is still stuck.

An `async` executor is always a mistake. If you need `await` inside, you already
have a promise: use an async function.

## 3. Nesting `.then` instead of chaining

```js
// ❌ the pyramid, rebuilt with promises
get(1).then(a => {
  get(a).then(b => {
    get(b).then(c => console.log(c));
  });
});

// ✅ flat
get(1).then(get).then(get).then(c => console.log(c));
```

Both print `8`. The nested version reintroduces the callback pyramid promises were
invented to remove, and — worse — the inner promises are floating: a `.catch` on
the outer chain never sees their rejections.

## 4. Forgetting `return` inside `.then`

```js
// nest.mjs
function bad()  { return get(1).then(a => { get(a); }); }    // no return
function good() { return get(1).then(a => get(a)); }
console.log('no-return →', await bad(), '| with-return →', await good());
```

```console
$ node nest.mjs
no-return → undefined | with-return → 4
```

The braces are the trap: `a => get(a)` returns, `a => { get(a); }` does not. The
outer promise resolves to `undefined` immediately while the inner work runs
unwatched. This is the [floating promise](12-floating-promises.md) bug in chaining
form, and the single most common promise mistake there is.

## 5. Mixing `await` and `.then`

```js
// ❌ two styles, one statement
const user = await getUser(id).then(u => u.profile);

// ✅ pick one
const user = (await getUser(id)).profile;
```

It works. It is just harder to read, and the mixed form invites the classic
mistake of putting a `.catch` after an `await` and expecting it to catch the
`await`'s own failure. Use `await` with `try`/`catch`, or chains with `.catch` —
not both in one expression.

## 6. The redundant `async` wrapper

```js
// ❌ awaits only to immediately return
async function load(id) { return await fetchUser(id); }

// ✅
function load(id) { return fetchUser(id); }
```

The `await` adds microtask ticks for nothing, since returning a promise from an
async function already adopts it.

**The one exception is `return await` inside `try`** — there, dropping the `await`
means the promise is returned before it settles, so the `catch` never runs. That
case is covered in [error handling](11-error-handling.md), and it is deliberate,
not redundant.

## Gotchas

**Symptom:** An `await` hangs forever with no error
**Cause:** A `new Promise` whose executor threw, or one path that never calls
`resolve` or `reject`.
**Fix:** Do not construct promises around promise-returning code. If wrapping a
callback API, make sure every path settles.

**Symptom:** `unhandledRejection` points at a promise nobody is awaiting
**Cause:** An `async` executor, or a nested `.then` whose inner chain has no
handler.
**Fix:** Flatten the chain; never make an executor `async`.

**Symptom:** A `.then` resolves to `undefined` instead of the value
**Cause:** A block-bodied arrow with no `return`.
**Fix:** `a => get(a)`, or add the `return`.

**Symptom:** A `.catch` after an `await` never fires
**Cause:** It is attached to the *result*, not to the awaited promise.
**Fix:** `try`/`catch` around the `await`.

**Symptom:** Wrapping is "needed" to convert an error type
**Cause:** Reaching for `new Promise` when `.catch(e => { throw new X(e) })` or
`try`/`catch` does it.
**Fix:** Rethrow with [`{ cause }`](16-error-design.md).

## Interview questions

**★ What is the explicit construction antipattern?**
Wrapping code that already returns a promise in `new Promise(...)`. It adds no
behaviour and creates two new failure modes — a forgotten `reject` path, and a
promise that never settles. `new Promise` belongs only around callback or event
APIs that have no promise form.

**★ What goes wrong with `new Promise(async (resolve) => ...)`?**
The executor's `throw` rejects the async function's own promise, which nobody
holds, so the constructed promise never settles and awaiting it hangs. On modern
Node the orphaned rejection also surfaces as an `unhandledRejection` and is fatal
by default — reported far from the actual bug.

**★ Why is forgetting `return` inside `.then` such a common bug?**
A block-bodied arrow returns `undefined`, so the chain resolves immediately while
the inner promise runs unobserved. The outer `.catch` never sees its rejection and
the value is lost. The concise form `a => get(a)` avoids it.

**★ When is `return await` not redundant?**
Inside a `try` block. Without the `await`, the promise is returned before it
settles, so the enclosing `catch` cannot see its rejection. Everywhere else the
`await` just adds microtask ticks.

**Is nesting `.then` calls ever right?**
Only when the inner operation genuinely needs a value from an outer closure that
cannot be threaded through the chain — and even then, `async`/`await` expresses it
better. Nesting hides rejections from the outer `.catch`.

---

← Prev: [Error design](16-error-design.md) · Next → [Async iterators](18-async-iterators.md)
