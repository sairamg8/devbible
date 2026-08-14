---
title: "17.3 · Which binding did you get?"
sidebar_label: "3 · Which binding did you get?"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`let`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let), [`var`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var), [`for`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for), [`for...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of), [`Array.prototype.forEach()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await). Documentation-validated; **no timings**.

**One rule explains every bug in the rest of this topic:** a closure captures the **binding**, and
reads it when the closure runs. [06.1 · What is captured](../06-closures/01-what-is-captured.md)
proves that and works the classic `var`-in-a-loop case.

This chunk is the question that actually comes up at a keyboard: **which binding did I get?**

🔴 **"Stale closure" is a misleading name.** Nothing goes stale. The program made a *new* binding
and your function is still holding an older one — or it never made the new bindings you assumed
it would.

## Two failure shapes, and telling them apart

Every case in this topic is one of these two:

| Shape | What happened | Symptom |
|---|---|---|
| **Too few bindings** | You expected one per iteration and got one, shared | Every callback sees the **final** value — `3, 3, 3` |
| **Too many bindings** | A new binding was created (new call, new render) and your function holds an earlier one | The callback sees an **old** value — `0` forever |

🔴 **They look identical in a log and have opposite fixes.** The first is fixed by creating *more*
bindings. The second is fixed by capturing *less* — reading through a box, or rebuilding the
closure.

**The diagnostic question that separates them: is the wrong value the *last* one, or the
*first* one?** Last → too few bindings, and this chunk has the fix. First → too many, and
[17.4](./04-snapshots-and-the-four-fixes.md) has it.

## Loops: which constructs give a fresh binding

The rule is **not** "`let` fixes loops". It is more precise than that, and the precision is what
makes the `while` case predictable:

```js
const fns = [];

// 🔴 one binding for the whole loop
for (var i = 0; i < 3; i++) fns.push(() => i);         // 3, 3, 3

// ✅ the for-head is special-cased: a fresh `i` per iteration
for (let i = 0; i < 3; i++) fns.push(() => i);         // 0, 1, 2
```

```js
// ✅ a let/const declared INSIDE the body is fresh per iteration — in ANY loop
let i = 0;
while (i < 3) { const n = i; fns.push(() => n); i++; } // 0, 1, 2

// 🔴 the same while loop capturing the outer variable
let j = 0;
while (j < 3) { fns.push(() => j); j++; }              // 3, 3, 3
```

Two facts produce all four lines:

- **A block that executes again creates a new environment**, so any `let`/`const` declared
  *inside* a loop body is a new binding on each pass. That is ordinary block scoping — nothing to
  do with loops.
- **`for (let …)` additionally makes the loop *head* per-iteration**, copying the value forward
  between iterations. This is the genuine special case, and it is why `for (let i…)` behaves
  differently from a `while` whose counter is declared outside it.

**`var` has neither property.** It is function-scoped, so there is exactly one binding however
many times the block runs.

⚠️ **The practical consequence:** writing `let` instead of `var` is not a fix by itself. A `let`
**outside** a loop is one binding and behaves exactly like `var` from a closure's point of view.
What matters is *where the declaration is*, not which keyword it uses.

## The constructs that cannot have the bug at all

```js
arr.forEach((item, idx) => fns.push(() => idx));       // ✅ always correct
for (const item of arr) fns.push(() => item);          // ✅ always correct
```

`forEach` invokes your callback once per element, and **every invocation is a new function
scope** — `item` and `idx` are parameters of a fresh call, so there is nothing to share.
`for...of` and `for...in` create a fresh binding per iteration for `let`/`const`.

⚠️ **With `var` they do not.** `for (var x of arr)` shares one function-scoped `x`, exactly like a
C-style loop. The construct does not save you; the declaration does.

🔴 **This is the strongest practical reason to prefer `for...of` and the array methods when the
loop body creates functions** — the bug becomes structurally impossible rather than avoided by
discipline. It is also why the bug has become rare in modern code and still appears in code that
was transpiled or written before block scoping was routine.

## Async loops are the same rule, delayed

```js
// 🔴
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);   // 3, 3, 3

// ✅
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);   // 0, 1, 2
```

Nothing about `setTimeout` is special. The loop runs to completion before any callback is invoked,
so by the time the shared `var` binding is read it holds `3`. The delay only makes the shared
binding **visible**; it does not cause it.

`await` inside the loop has the same property with a sharper edge:

```js
for (var i = 0; i < urls.length; i++) {
  const res = await fetch(urls[i]);
  queue.push(() => console.log(i, res.status));    // 🔴 every closure logs urls.length
}
```

⚠️ **A loop can be half-broken, and that is what makes this one hard to read.** `const res` is
declared in the body, so it is fresh per iteration and correct. Only `i` is shared — and it keeps
advancing across every suspension, so closures created early see a value written long after they
were made. The symptom is "one of the two logged values is right and the other is not", which
sends people looking at `fetch` instead of at the declaration.

**The fix is the same as always:** `let` in the head, or better, iterate the values directly.

```js
for (const url of urls) {
  const res = await fetch(url);
  queue.push(() => console.log(url, res.status));  // ✅ both fresh per iteration
}
```

## Gotchas

**Symptom:** Every callback created in a loop logs the same final value
**Cause:** One shared binding — `var`, or a `let` declared outside the loop.
**Fix:** `for (let i…)`, or declare the variable inside the loop body, or iterate with `forEach` / `for...of`.

**Symptom:** `let` was used and the loop still shares one binding
**Cause:** The `let` is *outside* the loop (`let j = 0; while (…)`). Per-iteration bindings come from the loop body's block or from a `for` head — not from the keyword itself.
**Fix:** Move the declaration inside the body, or copy into a body-scoped `const` first.

**Symptom:** `for...of` did not fix it
**Cause:** It was written `for (var x of arr)`. `for...of` gives a per-iteration binding only for `let`/`const`.
**Fix:** `for (const x of arr)`.

**Symptom:** An `async` loop's closures see a mix of right and wrong values
**Cause:** `var` for the index — shared, and it advances across every `await` — alongside body-scoped `const`s that are fresh.
**Fix:** `let`/`const` throughout, or `for...of` over the values.

**Symptom:** The bug appeared only after adding a `setTimeout` or `await`
**Cause:** The shared binding was always there; deferring the read is what made it observable.
**Fix:** Fix the declaration, not the timing.

**Symptom:** Code that works in the browser fails after transpilation to ES5
**Cause:** `let` per-iteration semantics must be emulated by the transpiler (an IIFE per iteration); a misconfigured target can drop that.
**Fix:** Check the compiled output before assuming the source is wrong.

## Interview questions

**★ Why does `for (var i…)` with `setTimeout` log the final value?**
`var` is function-scoped, so there is one `i` for the whole loop and every closure holds that same
binding. The loop completes before any timer callback runs, so all of them read the value it ended
at. `let` in the `for` head creates a fresh binding per iteration, so each closure holds a
different one.

**★ Does `let` always give you a per-iteration binding?**
No, and this is the part people get wrong. A `let`/`const` declared **inside** the loop body is
fresh each pass because the block runs again — ordinary block scoping. `for (let …)` additionally
special-cases the loop head. A `let` declared **outside** a `while` loop is a single binding and
behaves exactly like `var`.

**★ Which loop constructs cannot have this bug?**
`forEach` and the other callback-taking array methods, because each invocation is its own function
scope; and `for...of` / `for...in` with `let` or `const`, because they create a fresh binding per
iteration. With `var`, `for...of` shares one binding like any other loop.

**★ How do you tell a "shared binding" bug from a "stale capture" bug?**
By which wrong value you get. The **final** value means too few bindings — fix by creating more.
The **first** value means new bindings exist and your closure holds an early one — fix by reading
through a mutable box or rebuilding the closure.

**★ Why does adding `await` to a loop make the `var` bug worse?**
Because the loop variable keeps advancing across suspensions while the closures created in earlier
iterations are already alive. Body-scoped `const`s stay correct, so you get a half-broken loop
where one logged value is right and the other is not.

**★ Did `setTimeout` cause the bug?**
No. The shared binding exists regardless; deferring the read is only what makes it observable. The
fix is in the declaration, never in the timing.

---

← [17.2 · Merging, forwarding and identity](./02-merging-forwarding-and-identity.md) · [Topic index](./README.md) · [Next → 17.4 · Snapshots and the four fixes](./04-snapshots-and-the-four-fixes.md)
