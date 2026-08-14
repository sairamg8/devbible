---
title: "11.2 · Floating promises and the forgotten return"
sidebar_label: "02 · Floating promises"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`Array.prototype.forEach()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach). Documentation-validated.

**One bug, four disguises.** A promise that nobody is waiting for and nobody is handling —
MDN's word for it is *floating* — and each disguise is written for a different reason.

## MDN's own worked example

The forgotten `return`, with the damage made concrete:

```js
const listOfIngredients = [];

doSomething()
  .then((url) => {
    // Missing `return` keyword in front of fetch(url).
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        listOfIngredients.push(data);
      });
  })
  .then(() => {
    console.log(listOfIngredients);
    // listOfIngredients will always be [], because the fetch request hasn't completed yet.
  });
```

> "`listOfIngredients` will **always** be `[]`, because the fetch request hasn't completed
> yet."

🔴 **"Always" is the word to notice.** This is not a race that sometimes works — the inner
chain cannot possibly finish before the outer `.then` runs, because the outer one is queued
immediately. It fails deterministically, and it fails the same way in every environment,
which is why it survives testing only when nobody asserts on the result.

MDN's fix, and then its better fix:

```js
  .then((url) => {
    // `return` keyword now included in front of fetch call.
    return fetch(url)
      .then((res) => res.json())
      .then((data) => {
        listOfIngredients.push(data);
      });
  })
```

```js
doSomething()
  .then((url) => fetch(url))
  .then((res) => res.json())
  .then((data) => {
    listOfIngredients.push(data);
  })
  .then(() => {
    console.log(listOfIngredients);
  });
```

**The flattened version cannot have the bug at all**, which is the real argument for
flatness. Nesting is what creates the opportunity to forget, and — per
[06 · 02](../06-chaining/02-error-propagation.md) — nesting is only justified when you are
deliberately scoping a `catch`.

## Disguise 2: the missing `await`

Same bug, `async` syntax, and the worst version because the function lies about its result:

```js
async function checkout(cart) {
  charge(cart);                    // ⚠️ not awaited
  return { status: "ok" };         // reports success while the charge is in flight
}
```

**The return value is wrong**, not merely early. Everything downstream — the response to the
user, the analytics event, the audit log — records a success that has not happened.

## Disguise 3: `forEach` with an `async` callback

```js
items.forEach(async (item) => {
  await save(item);
});
console.log("all saved");          // ⚠️ nothing is saved yet
```

`forEach` **discards its callback's return value** — that is its documented contract, and it
predates promises entirely. So every promise the callback returns is floating: nothing is
awaited, and every rejection escapes.

The two correct shapes, and they are not interchangeable:

```js
for (const item of items) await save(item);              // sequential
await Promise.all(items.map((item) => save(item)));      // concurrent
```

`map` works where `forEach` does not for the single reason that it **keeps** the return
values ([09 · 01](../09-sequential-vs-parallel/01-the-accidental-waterfall.md)).

The same trap applies to any array method that ignores the callback's return value or treats
it as a boolean. `filter(async …)` is quietly broken in a different way: every returned
promise is an object, and every object is truthy, so **`filter` with an `async` predicate
keeps everything**.

## Disguise 4: deliberate fire-and-forget

```js
logAnalytics(event);               // ⚠️ intentional, but unowned
```

Here the author *meant* not to wait — and that is fine. What is not fine is leaving the
promise unowned, because a failure then goes to the global handler, and in Node that is
[raised as an uncaught exception by default](../08-error-handling/03-unhandled-rejections.md).

```js
void logAnalytics(event).catch((e) => log.warn("analytics failed", e));   // ✅
```

🔴 **Not wanting to wait is different from not caring whether it fails.** The attached
`.catch` is what encodes the difference — for the runtime, for the linter, and for the next
reader, who otherwise cannot tell this line from a forgotten `await`.

## The rule, and the tooling

**Every promise gets an owner:** it is `await`ed, `return`ed, or given a `.catch` in the same
turn. Nothing else counts.

All four disguises are invisible in review, which is why this is one of the few places where
tooling is not optional:

- **`@typescript-eslint/no-floating-promises`** — catches disguises 2, 3 and 4 directly.
- **`no-misused-promises`** — catches passing an `async` function where a void-returning
  callback is expected, which is disguise 3 at its source.
- **`require-await`** — flags an `async` function with no `await`, often a leftover.

These rules need **type information** to know what returns a promise, which is one of the
stronger practical arguments for TypeScript on an async-heavy codebase.

## Gotchas

**Symptom:** An array is always empty when logged, in every environment
**Cause:** MDN's case exactly — an inner chain that was not returned. The outer handler is
queued immediately and cannot wait.
**Fix:** `return` the inner chain, or flatten so there is no inner chain to forget.

**Symptom:** A function reports success while its work is still running
**Cause:** A missing `await`. This one produces a **wrong result**, not just a lost error.
**Fix:** `await` it.

**Symptom:** `forEach(async …)` completes instantly and does nothing
**Cause:** `forEach` discards the callback's return value by contract.
**Fix:** `for...of` to sequence, `Promise.all(arr.map(fn))` to run concurrently.

**Symptom:** `filter` with an `async` predicate keeps every element
**Cause:** The predicate returns a **promise**, and every object is truthy.
**Fix:** Resolve first — `const keep = await Promise.all(arr.map(pred))` — then filter with
the booleans.

**Symptom:** A background task fails silently in production
**Cause:** Deliberate fire-and-forget with no handler attached.
**Fix:** `.catch(log)`. It also marks the omission as intentional.

**Symptom:** The linter is quiet but the bugs are there
**Cause:** `no-floating-promises` needs **type information**; it does nothing without a
typed project.
**Fix:** Enable type-aware linting.

## Interview questions

**★ What is a floating promise?**
A promise nobody is waiting for and nobody is handling — not `await`ed, not `return`ed, no
`.catch`. It breaks **sequencing** (the code moves on) and **error handling** (its rejection
cannot reach the surrounding `catch`), and both failures are silent.

**★ In MDN's example, why is the list *always* empty rather than sometimes?**
Because the outer `.then` is queued immediately when the inner chain is merely started. There
is no timing window in which the inner chain could finish first — MDN says the list *"will
always be `[]`"*. It fails deterministically.

**★ Why does `map` work where `forEach` does not?**
`forEach` discards the callback's return value; `map` keeps it. So `map` produces the array
of promises that `Promise.all` needs, while `forEach` throws them away.

**★ What does `filter` with an `async` predicate do?**
Keeps **everything** — the predicate returns a promise, and every object is truthy. Resolve
the predicates first with `Promise.all`, then filter on the resulting booleans.

**★ Is fire-and-forget an anti-pattern?**
Not by itself — but leaving it *unowned* is. Attach a `.catch`, which both handles the
failure and distinguishes a deliberate omission from a forgotten `await`. In Node an
unhandled rejection is raised as an uncaught exception by default.

**How do you enforce this?**
`@typescript-eslint/no-floating-promises` and `no-misused-promises`. They require type
information, which is why an async-heavy codebase benefits disproportionately from
TypeScript — every one of these bugs is invisible in review.

---

← Prev [01 · Explicit construction](./01-explicit-construction.md) · [Topic index](./README.md) · Next → [03 · `return await` and the small ones](./03-return-await-and-others.md)
