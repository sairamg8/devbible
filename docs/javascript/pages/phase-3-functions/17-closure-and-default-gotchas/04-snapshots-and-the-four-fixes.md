---
title: "17.4 · Snapshots and the four fixes"
sidebar_label: "4 · Snapshots and the four fixes"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`EventTarget.removeEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`clearInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearInterval). Documentation-validated; **no timings**.

The second failure shape from [17.3](./03-which-binding-did-you-get.md): **too many bindings.**
Nothing loops. A function was created **once**, at a moment when the world looked a certain way,
and it still describes that moment.

## Registration is a moment, not a subscription

```js
let theme = "light";

button.addEventListener("click", () => applyTheme(theme));               // ✅ reads the variable
button.addEventListener("click", ((t) => () => applyTheme(t))(theme));   // 🔴 froze "light"
```

The first handler closes over the **variable** `theme` and follows every reassignment. The second
copied the value into a parameter at registration time and can never see an update. Both are
one-line handlers; only one of them tracks reality.

The same shape, far more often written by accident:

```js
function startPolling(config) {
  const url = config.url;                   // 🔴 a copy, taken now
  setInterval(() => fetch(url), 5000);      //    config.url can change; url cannot
}
```

🔴 **The tell is a `const` that copies out of something mutable, immediately above a function that
outlives the copy.** `const url = config.url` reads like tidying up — a shorter name, one fewer
property access. It is a snapshot, and it is the whole bug.

```js
setInterval(() => fetch(config.url), 5000);   // ✅ reads through the object each tick
```

⚠️ **Destructuring is the same snapshot with nicer syntax.**
`const { url, retries } = config` copies both values out at that instant. Inside a long-lived
callback it has exactly the effect of the `const` above — which is why destructuring a props or
config object at the top of a function that registers listeners is a recurring source of this bug.

## The counter that works — and why it matters

```js
function attach(el) {
  let clicks = 0;
  el.addEventListener("click", () => {
    console.log(clicks);        // ✅ 0, 1, 2 … reads the live binding
    clicks += 1;
  });
}
```

This is **correct**, and it belongs next to the broken versions because it is the proof that
closures are not the problem. One binding, one handler, reading and writing the same variable
forever.

🔴 **The bug appears only when something creates a second binding** — a second call to `attach`, a
re-render, a hot-reloaded module — **and the old closure is still installed alongside the new
one.**

```js
attach(el);
attach(el);      // ⚠️ two listeners, two separate `clicks`, every click counted twice
```

`addEventListener` does not replace a previous listener unless it is given the **same function
reference**, and an arrow function is a new reference every evaluation. So the second call adds a
second listener rather than replacing the first. Both closures are live, each with its own
`clicks`, and both run on every click.

The related retention problem — a closure keeping its whole enclosing scope alive — is in
[06.2 · Private state and memory](../06-closures/02-state-and-memory.md).

## The four fixes, and when each is right

Whenever a closure holds the wrong value, exactly one of these applies. Working out **which** is
the whole skill; applying it is mechanical.

### 1 · Close over the variable, not a copy

The cheapest fix and the one to try first: delete the intermediate `const`, read `config.url` or
`state.count` at the moment the closure runs.

**Right when** the mutable thing is still reachable from where the closure executes.
**Wrong when** each call or render genuinely creates new variables, so there is no single
long-lived one to read.

### 2 · Read through a mutable box

When there is no shared variable to reach, put the value somewhere with a **stable identity** and
capture *that* instead:

```js
const latest = { current: initial };        // this object's identity never changes
element.addEventListener("click", () => send(latest.current));
// elsewhere, whenever the value changes:
latest.current = newValue;
```

This is exactly what a React `ref` is, and it behaves identically in plain JavaScript — the
closure holds the box, and the box holds whatever is current.

⚠️ **Cost: the handler now reads a value that can change under it**, so this is wrong for anything
that must act on the value *as of when it was attached* — an "undo" that should target the record
the user was looking at, for example.

### 3 · Recreate the closure when the value changes

Remove the old listener and add a new one built over the new binding.

```js
el.removeEventListener("click", handler);   // 🔴 must be the SAME reference
handler = () => applyTheme(theme);
el.addEventListener("click", handler);
```

**Right when** the closure is cheap and the value changes rarely. This is what a framework's
dependency list automates.

🔴 **Keep the reference in a variable.** `removeEventListener` matches by identity, so an inline
arrow can never be removed — the old closure stays installed, keeps its scope alive, and now both
handlers run on every event.

⚠️ **`AbortController` is the better teardown for a group of listeners.** Pass
`{ signal }` to each `addEventListener` and call `controller.abort()` once; every listener
registered with that signal is removed, and you never have to hold the references.

### 4 · Never capture it — take it as an argument

The most robust of the four, and the least used:

```js
const send = (value) => { … };
element.addEventListener("click", () => send(readCurrentValue()));
```

**A function that receives what it needs cannot hold a stale version of it.** Where a closure is
being used purely to smuggle a value into a callback, a parameter is usually the better design —
it makes the data flow visible in the signature and makes the function testable without
reconstructing a scope.

### Choosing between them

| The value… | Fix |
|---|---|
| lives in a variable the closure can still see | **1** — read it directly |
| is replaced wholesale on each render/call | **2** — a box, or **3** if it changes rarely |
| must be the value *as of registration* | none — the snapshot is correct; document it |
| is derivable when the callback runs | **4** — pass it in |

## Diagnosing one in ten seconds

**Log the wrong value against the sequence.** Final value → too few bindings, and the fix is in
[17.3](./03-which-binding-did-you-get.md). First value → too many bindings, and it is fix 2 or 3.

**Log identity, not just contents.** `console.log(obj === lastSeen)` distinguishes "the same
object, mutated" from "a new object each time" — which is exactly the difference between fix 1
and fix 2, and contents alone cannot tell you.

**Use the debugger's Closure scope.** Pausing inside the callback shows a `Closure` section per
enclosing scope with the exact values that closure holds. That answers "which binding did I get?"
**directly**, rather than by inference from behaviour — and it is the fastest route when two
bindings share a name.

**Count your listeners.** In Chrome DevTools, the Event Listeners pane on the selected element
shows every registered handler. Two entries where you expect one is the "attach ran twice"
diagnosis, and no amount of reading the closure will reveal it.

## Gotchas

**Symptom:** A handler ignores updates to a value it visibly references
**Cause:** It closed over a *copy* — `const url = config.url`, or a destructure — taken at registration.
**Fix:** Read through the object at call time, or hold a `{ current }` box.

**Symptom:** Destructuring props/config at the top of a function broke live updates
**Cause:** Destructuring is a snapshot; the extracted `const`s never change.
**Fix:** Keep the object and read from it inside the callback.

**Symptom:** `removeEventListener` did not remove the listener
**Cause:** It matches by function identity, and an inline arrow is a new reference each evaluation.
**Fix:** Keep the handler in a variable and pass the same reference to both calls — or register with an `AbortController` signal and `abort()`.

**Symptom:** A counter increments by two, or a handler runs twice
**Cause:** The attach function ran twice; each run created its own closure and both listeners are installed.
**Fix:** Remove before adding, guard with a flag, or use `{ once: true }` where that fits.

**Symptom:** The value updates in the debugger but not in the callback
**Cause:** Two bindings with the same name — you are watching one and the closure holds the other.
**Fix:** Read the `Closure` section of the debugger's scope pane rather than the source variable.

**Symptom:** A "box" fix made an undo button act on the wrong record
**Cause:** Fix 2 deliberately reads the *latest* value; this handler needed the value as of registration.
**Fix:** Capture the snapshot on purpose here — not every frozen value is a bug.

**Symptom:** Memory grows on every navigation or re-attach
**Cause:** Old closures held alive by listeners or intervals that were never removed; each retains its whole enclosing scope.
**Fix:** `removeEventListener` / `clearInterval` on teardown, or an `AbortController` per lifecycle — see [06.2 · Private state and memory](../06-closures/02-state-and-memory.md).

## Interview questions

**★ A `const url = config.url` above a `setInterval` — what is wrong with it?**
It takes a snapshot. The interval will fetch that URL forever even after `config.url` changes,
because the closure holds the copy rather than the object. Read `config.url` inside the callback.

**★ Is destructuring safe inside a function that registers a listener?**
Not if the values change. Destructuring copies at that instant, so the extracted bindings are as
frozen as any other `const`. Keep the object and read through it in the callback.

**★ What are the four ways to fix a closure holding the wrong value?**
Close over the variable rather than a copy; read through a `{ current }` box with a stable
identity; recreate the closure when the value changes; or pass the value in as an argument so
nothing is captured. The last is usually the best design and the least used.

**★ How do you choose between the box and recreating the closure?**
A box is right when the value changes often and the handler should always act on the latest one.
Recreating is right when the value changes rarely and the closure is cheap — and it is what a
framework's dependency list does for you. If the handler must act on the value as of registration,
neither applies: the snapshot was correct.

**★ Why did `removeEventListener` not work?**
It matches listeners by function identity, and an inline arrow creates a new function object each
time it is evaluated, so the reference passed to `remove` is not the one that was added. Store the
handler in a variable, or register everything with an `AbortController` signal and call `abort()`.

**★ A counter closure that reads and writes one variable across many calls — is that a bug?**
No, that is the counter factory and it works. The bug appears only when a *second* binding comes
into existence — a second call, a re-render, a hot reload — and an old closure is still live
alongside the new one.

**★ How would you diagnose one quickly?**
Ask whether the wrong value is the sequence's last or first. Then log identity rather than
contents, to separate "same object, mutated" from "new object each time". Then pause in the
callback and read the debugger's `Closure` scope, which names the binding directly. If a handler
appears to run twice, count listeners in the Event Listeners pane.

---

← [17.3 · Which binding did you get?](./03-which-binding-did-you-get.md) · [Topic index](./README.md) · [Next → 17.5 · The stale closure, framework-scale](./05-the-stale-closure.md)
