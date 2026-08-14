---
title: "07.2 · Exactly where it suspends"
sidebar_label: "02 · Where it suspends"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function). Documentation-validated.

**An `async` function is not asynchronous until it reaches an `await`.** Up to that point it
is an ordinary function call running on the caller's stack. This is the single most
useful fact in the topic, and MDN states it directly:

> "The body of an async function can be thought of as being **split by zero or more await
> expressions**. Top-level code, **up to and including the first await expression (if there
> is one), is run synchronously.**"

So an `async` function with no `await` in it runs entirely synchronously — and still returns
a promise, because of [chunk 01](./01-always-a-promise.md).

## What `await` actually does

MDN:

> "When an `await` is encountered in code (either in an async function or in a module), the
> awaited expression is executed, while **all code that depends on the expression's value is
> paused. Control exits the function and returns to the caller.**"

Three distinct things happen, in this order:

1. **The awaited expression is evaluated** — synchronously, right there. `await fetch(url)`
   *calls* `fetch` immediately; the network request is already in flight.
2. **The function suspends** and the rest of its body is registered as a continuation.
3. **Control returns to the caller**, which resumes at the statement after the call.

🔴 **Point 1 is the one that makes concurrency possible.** The expression runs now; only the
*waiting* is deferred. That is why starting work before awaiting it turns a waterfall into
parallel work — the subject of
[09 · Sequential vs parallel `await`](../README.md).

```js
const a = fetch("/a");        // request starts NOW
const b = fetch("/b");        // request starts NOW — both in flight
const ra = await a;
const rb = await b;           // total time ≈ the slower one
```

## It always costs at least one tick

MDN, and this has no exceptions:

> "Even when the used promise is **already fulfilled**, the async function's execution still
> pauses until the **next tick**. In the meantime, the caller of the async function resumes
> execution."

```js
async function f() {
  console.log("a");
  await null;          // already "settled" — still suspends
  console.log("b");
}
f();
console.log("c");
// a, c, b
```

`"a"` prints synchronously. `await null` suspends anyway. `"c"` — the caller's next line —
runs before `"b"`.

**There is no fast path.** `await` on a value that needs no waiting still yields a microtask,
which is why `await` inside a hot loop is a real cost even when nothing is actually
asynchronous.

The continuation is a **microtask**, so it runs before the next task but after all currently
synchronous code — see
[03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md). Consequently
**an `await` loop never yields to rendering**, because rendering happens between *tasks*.

## Awaiting a non-promise

MDN:

> "The `expression` is resolved in the same way as `Promise.resolve()`: it's **always
> converted to a native `Promise`** and then awaited."

```js
async function f3() {
  const y = await 20;
  console.log(y); // 20

  const obj = {};
  console.log((await obj) === obj); // true
}
```

Two facts in that example. The value comes back **unchanged** — `(await obj) === obj` — so
`await` is safe to apply to a value that may or may not be a promise. And it is *converted*,
not skipped, which is why the tick is spent either way.

This makes `await` the right tool for a value of uncertain type:

```js
const value = await maybeAPromise;   // correct whether or not it is one
```

### Thenables are awaited too

```js
async function f2() {
  const thenable = {
    then(resolve) {
      resolve("resolved!");
    },
  };
  console.log(await thenable); // "resolved!"
}
```

Same rule as [05 · 01](../05-promises/01-the-three-states.md) — `await` cares about the
**shape**, not the class. And the same hazard: an object with an unrelated `then` field gets
assimilated rather than returned.

## Where `await` is allowed

MDN gives exactly two contexts:

> 1. Inside an **async function**
> 2. At the **top level of a module** (top-level await)

Top-level `await` is worth knowing precisely because of what it does to the module graph: a
module that awaits at the top level delays evaluation of every module that imports it. It is
correct for genuine initialisation (opening a connection, loading configuration) and a
mistake for anything slow or optional, because there is no way for an importer to opt out of
the wait.

It is also **not available in CommonJS** — `require` is synchronous, so a `.cjs` file cannot
use it. In a `.js` file the answer depends on the package's `"type"` field.

## The split, read as code

Putting the pieces together, this function:

```js
async function load(id) {
  console.log("start");            // synchronous — runs on the caller's stack
  const user = await getUser(id);  // getUser() called NOW; suspend; caller resumes
  console.log("mid");              // continuation 1 — a microtask
  const posts = await getPosts(user);
  return posts;                    // continuation 2 — fulfils load()'s promise
}
```

is three pieces of code that run at three different times, sharing one scope. **The scope
sharing is the whole ergonomic win** — `user` is an ordinary `const` visible to every later
line, where a chain would have to thread it through handler arguments.

## Gotchas

**Symptom:** Code before the first `await` ran immediately, surprising you
**Cause:** MDN: *"Top-level code, up to and including the first await expression … is run
synchronously."*
**Fix:** Expected — and useful for validation and for starting work early.

**Symptom:** `await` on an already-resolved value still delayed the next line
**Cause:** MDN: *"even when the used promise is already fulfilled, the async function's
execution still pauses until the next tick."*
**Fix:** Expected. There is no fast path; avoid `await` in a hot loop where nothing is
actually async.

**Symptom:** Two requests take twice as long as one
**Cause:** Each was awaited before the next was started, so the second call never happened
until the first resolved.
**Fix:** Call both first, then await both — the awaited **expression runs immediately**, so
only the waiting needs to be deferred.

**Symptom:** A UI does not repaint inside an `await` loop
**Cause:** The continuation is a **microtask**; rendering happens between **tasks**.
**Fix:** Yield a task — `await new Promise(r => setTimeout(r, 0))`.

**Symptom:** `SyntaxError` on `await` at the top of a file
**Cause:** Top-level `await` works only in **modules**. CommonJS cannot use it, since
`require` is synchronous.
**Fix:** Wrap in an `async` function, or make the file a module (`.mjs`, or `"type":
"module"`).

**Symptom:** An import became slow after an unrelated change
**Cause:** A dependency added top-level `await`, delaying evaluation of everything that
imports it.
**Fix:** Reserve top-level `await` for genuine initialisation; move optional or slow work
behind an exported function.

**Symptom:** An object came back as a different value from `await`
**Cause:** It was a **thenable** — it had a callable `then` — so it was assimilated.
**Fix:** Do not name a data field `then`; wrap the object if you cannot rename it.

## Interview questions

**★ Where exactly does an `async` function suspend?**
At the first `await`, and at each one after. MDN: the body is *"split by zero or more await
expressions"*, and everything *"up to and including the first await expression … is run
synchronously"*. At the `await`, control *"exits the function and returns to the caller"*.

**★ Does `await fetch(url)` delay the request?**
No. The awaited **expression is evaluated immediately** — the request is already in flight —
and only the code depending on its value is paused. This is exactly why starting several
calls before awaiting them runs them concurrently.

**★ Does `await` on an already-resolved promise cost anything?**
Yes — at least one tick. MDN: *"even when the used promise is already fulfilled, the async
function's execution still pauses until the next tick."* There is no fast path, so `await`
in a hot loop is a real cost.

**★ What does `await 20` do?**
Returns `20`, after a tick. MDN: the expression is *"resolved in the same way as
`Promise.resolve()`: it's always converted to a native `Promise` and then awaited"*, and
`(await obj) === obj` for a plain object. This makes `await` safe on a value that may or may
not be a promise.

**★ Where can `await` be used?**
Inside an `async` function, and at the **top level of a module**. Not in CommonJS, because
`require` is synchronous. Top-level `await` delays evaluation of every importing module, so
it belongs to real initialisation only.

**Why can `user` be used on later lines but a chain has to thread it through?**
Because the pieces of an `async` function split by `await` **share one scope**. Each `.then`
handler in a chain is a separate function, so an earlier value reaches a later handler only
as an argument or via a closure you build yourself.

---

← Prev [01 · Always a promise](./01-always-a-promise.md) · [Topic index](./README.md) · Next → [03 · Reading the ordering](./03-reading-the-ordering.md)
