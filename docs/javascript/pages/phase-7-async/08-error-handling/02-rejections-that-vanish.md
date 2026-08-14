---
title: "08.2 · Rejections that vanish"
sidebar_label: "02 · Rejections that vanish"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Promise.prototype.catch()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await). Documentation-validated.

**A rejection never crashes at the point of failure.** It sits inside a promise object,
waiting for someone to ask. If nobody ever asks, it is discovered late, by the runtime,
with no useful stack — or not at all.

This chunk is a catalogue of the ways "nobody asks", because every one of them is silent and
each has a different fix.

## 1. The floating promise

The base case: a promise nobody holds.

```js
saveAnalytics(event);          // ⚠️ fire and forget
doTheRealWork();
```

If `saveAnalytics` rejects, nothing is attached, and the rejection goes to the global handler
([chunk 03](./03-unhandled-rejections.md)). The intent here is usually legitimate — you
genuinely do not want to wait for analytics — but **"I don't want to wait" is not the same as
"I don't care if it fails"**.

```js
saveAnalytics(event).catch((e) => log.warn("analytics failed", e));   // ✅ explicit
void saveAnalytics(event).catch(reportSilently);                       // ✅ intent marked
```

🔴 **Deliberate fire-and-forget still needs a `catch`.** Attaching one is how you distinguish
"handled by ignoring" from "forgotten", both for the runtime and for the next reader.

## 2. The missing `return` in a chain

Covered mechanically in [06 · 01](../06-chaining/01-flattening.md); here it is as a *failure*
mode. MDN:

> "If the previous handler started a promise but did not return it, there's no way to track
> its settlement anymore, and the promise is said to be 'floating'."

```js
fetchUser(id)
  .then((user) => {
    fetchPosts(user.id);       // ⚠️ floating — its rejection escapes the chain
  })
  .catch(report);              // never sees a fetchPosts failure
```

The `.catch` is right there and still cannot help: it is attached to the outer chain, and the
inner promise was never joined to it.

## 3. The missing `await`

The `async`/`await` form of the same bug:

```js
async function checkout(cart) {
  try {
    charge(cart);              // ⚠️ no await — rejection escapes the try
    return "ok";
  } catch (e) {
    return "failed";           // never runs
  }
}
```

The function reports success while the charge is still in flight and may fail. This is the
most damaging item on the list, because the missing `await` makes the code **return the wrong
answer**, not merely lose an error.

## 4. `forEach` with an async callback

```js
items.forEach(async (item) => {
  await save(item);            // ⚠️ every rejection floats
});
```

`forEach` discards the callback's return value, so all the promises are floating at once. Use
`for...of` to sequence, or `Promise.all(items.map(save))` to run concurrently *and* collect
failures.

## 5. The `catch` that swallows

```js
.catch((e) => log(e))          // ⚠️ chain now FULFILS with undefined
.then((cfg) => start(cfg))     // start(undefined)
```

Not a vanished rejection but a **converted** one: handling restores the chain
([05 · 02](../05-promises/02-then-catch-finally.md)), so the failure becomes a successful
result of `undefined`. The symptom appears downstream, in code that has nothing to do with
the original error.

**Rule:** a `catch` either returns a deliberate fallback or re-throws. It does not just log.

## 6. `.then(onOk, onErr)` where `onOk` throws

From [06 · 02](../06-chaining/02-error-propagation.md): the second argument handles
**upstream** rejections only. A throw inside `onOk` rejects the *next* promise, and if the
chain ends there, it is unhandled.

```js
doThing().then(
  (v) => { throw new Error("boom"); },
  (e) => report(e),
);                              // ⚠️ chain ends; "boom" is unhandled
```

## 7. `finally` at the end of a chain

```js
doWork().finally(() => spinner.hide());   // ⚠️ still unhandled if doWork rejects
```

`finally` is transparent ([06 · 03](../06-chaining/03-finally-and-timing.md)) and marks
nothing handled. This one is especially easy to write because the chain *looks* terminated.

## 8. A `catch` attached too late

A rejection is judged unhandled after a bounded window — Node's documentation defines it as
*"no error handler is attached to the promise within a turn of the event loop"*. So a handler
attached in a later turn is **too late to prevent the report**, even though it does still
receive the rejection:

```js
const p = doWork();
setTimeout(() => p.catch(report), 1000);   // ⚠️ unhandledRejection fires first
```

Both Node and the browser provide a *second* event for precisely this — `rejectionHandled` /
`rejectionhandled`, described by Node as firing when a handler is attached *"later than one
turn of the Node.js event loop"*. Their existence is the documentation's acknowledgement that
late attachment happens; it is not a pattern to rely on.

**Attach the handler in the same turn you create the promise.**

## 9. Errors the executor never converts

From [05 · 02](../05-promises/02-then-catch-finally.md), MDN's two cases: a throw
**asynchronously** inside an executor, and a throw **after `resolve()`** has settled the
promise. Neither becomes a rejection at all, so there is nothing for any handler to catch.
The first reaches the global error handler; the second is silently discarded.

## The two habits that remove most of this

**Every promise gets an owner.** Either it is `await`ed, or `return`ed, or it has a `.catch`
attached in the same turn. If none of the three is true, the promise is floating.

**Enable the lint rules.** `no-floating-promises` and `require-await`
(`@typescript-eslint`) catch items 1, 2, 3 and 4 mechanically, which matters because all four
are invisible in review. This is one of the strongest practical arguments for TypeScript on
an async-heavy codebase, since the rule needs type information to know what returns a
promise.

## Gotchas

**Symptom:** An operation reports success while its work is still in flight
**Cause:** A missing `await` on a call inside the function.
**Fix:** `await` it. This bug returns a **wrong answer**, not just a lost error.

**Symptom:** A `.catch` on a chain never fires for an inner call's failure
**Cause:** The inner promise was **floating** — started but not returned.
**Fix:** `return` it so the chain adopts it.

**Symptom:** A downstream function receives `undefined` after an unrelated failure
**Cause:** A `catch` that logged and returned nothing, fulfilling the chain.
**Fix:** Return a deliberate fallback, or re-throw.

**Symptom:** A chain ending in `.finally()` still reports an unhandled rejection
**Cause:** `finally` is transparent and marks nothing handled.
**Fix:** End with `.catch()`, or return the chain to a caller that does.

**Symptom:** An `unhandledRejection` is reported even though a `catch` exists
**Cause:** The handler was attached in a **later turn** — Node: *"no error handler is
attached … within a turn of the event loop"*.
**Fix:** Attach it in the same turn the promise is created.

**Symptom:** Fire-and-forget work fails invisibly in production
**Cause:** No handler attached, because waiting was not wanted.
**Fix:** `.catch(log)` on it. Not wanting to *wait* is different from not caring whether it
*fails*.

## Interview questions

**★ Name three ways an async error can disappear entirely.**
A **floating promise** (fire-and-forget with no `catch`); a **missing `return`** in a chain,
which detaches the inner promise from the outer `.catch`; and a **missing `await`**, which
makes the enclosing `try` useless and the function report success. `forEach(async …)` is a
fourth, and a `catch` that only logs is a fifth — that one *converts* the failure into a
fulfilled `undefined` rather than losing it.

**★ Which of those is the most dangerous, and why?**
The missing `await`, because it does not merely lose an error — the function **returns the
wrong answer**. A checkout reports success while the charge is still in flight.

**★ Is fire-and-forget acceptable?**
Yes, but attach a `.catch` anyway. Not wanting to wait is different from not caring whether
it fails, and the attached handler is what tells the runtime and the next reader that the
omission was deliberate.

**★ Can attaching a `catch` later still count as unhandled?**
Yes. Node emits `'unhandledRejection'` when no handler is attached *"within a turn of the
event loop"*, and provides `'rejectionHandled'` for a handler attached *"later than one
turn"*. The late handler still receives the rejection, but the report has already fired.

**★ What is the rule that removes most of these bugs?**
**Every promise gets an owner** — `await`ed, `return`ed, or given a `.catch` in the same
turn. If none of the three applies, it is floating. Enforce it with `no-floating-promises`,
since all these cases are invisible in review.

**Why does `.finally()` at the end of a chain not prevent an unhandled rejection?**
Because it is transparent — it reflects the original outcome and marks nothing handled. Only
`catch` or a two-argument `then` does.

---

← Prev [01 · try/catch around await](./01-try-catch-around-await.md) · [Topic index](./README.md) · Next → [03 · Unhandled rejections](./03-unhandled-rejections.md)
