---
title: "08.3 · The temporal dead zone"
sidebar_label: "03 · The temporal dead zone"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`let`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let). Documentation-validated.

**The dead zone is a stretch of time, not a stretch of code.** That is the point of
the name, and it is the part that survives being asked about.

MDN's definition: *"A variable declared with `let`, `const`, or `class` is said to
be in a 'temporal dead zone' (TDZ) from the start of the block until code execution
reaches the place where the variable is declared and initialized."* While inside it,
*"the variable has not been initialized with a value, and any attempt to access it
will result in a `ReferenceError`."*

So the binding from [chunk 1](./01-the-two-step-scope-entry.md) exists — the slot is
there from the top of the block — but it is **empty**, and reading an empty slot is
defined to throw rather than to produce `undefined`.

`undefined` is a value; an uninitialised binding holds no value at all. Those are
different states, and the TDZ is the language taking the trouble to distinguish
them.

## The contrast that makes it concrete

```js
{
  // TDZ starts at beginning of scope
  console.log(bar); // "undefined"
  console.log(foo); // ReferenceError: Cannot access 'foo' before initialization
  var bar = 1;
  let foo = 2; // End of TDZ (for foo)
}
```

Same block, same position, two declaration keywords, two entirely different
outcomes. `bar` is declared-and-initialised-to-`undefined`; `foo` is
declared-and-not-initialised.

Note also which scope each belongs to: `bar`'s binding is in the enclosing
*function*, `foo`'s is in this *block*. **The TDZ begins at the start of the block
that actually contains the `let`** — not at the top of the function.

## "Temporal" is doing real work in that name

MDN: *"The term 'temporal' is used because the zone depends on the order of
execution (time) rather than the order in which the code is written (position)."*

This is the claim that separates people who have read about the TDZ from people who
understand it, and MDN's own example is the cleanest demonstration:

```js
{
  // TDZ starts at beginning of scope
  const func = () => console.log(letVar); // OK

  // Within the TDZ letVar access throws `ReferenceError`

  let letVar = 3; // End of TDZ (for letVar)
  func(); // Called outside TDZ!
}
```

Read that carefully. The arrow function is **defined** above the `let` — textually
inside the dead zone — and that is completely fine. Defining a function that
mentions `letVar` does not *read* `letVar`. The read happens when `func()` is
called, and by then execution has passed the declaration, the binding is
initialised, and it logs `3`.

Move the call up one line, above `let letVar = 3`, and the identical function
throws. **Nothing about the function changed** — only when it ran.

That is why "the TDZ is the region of code above the declaration" is a wrong model
that survives most of the time. The right model:

- The TDZ **opens** when the block is entered.
- The TDZ **closes** when execution reaches and completes the declaration.
- Anything that **reads** the binding in between throws, *wherever that read is
  written*.

The corollary a lot of real code depends on: a function can close over a `let`
declared below it, as long as it is not *invoked* until afterwards. Mutual recursion
between `const`-assigned arrow functions works for exactly this reason, and so does
a module that defines its handlers above the config they reference.

## The declaration closes the zone even without an initialiser

```js
{
  // TDZ for x
  let x;          // ← TDZ ends here
  console.log(x); // undefined
  x = 1;
}
```

`let x;` with no initialiser still **initialises the binding** — to `undefined`. The
dead zone ends at the *declaration*, not at the first assignment.

`const` cannot do this: it requires an initialiser, and omitting one is a
`SyntaxError` at parse time (`Missing initializer in const declaration`), not a TDZ
error. That distinction matters when reading errors — a parse error means nothing in
the file ran at all.

## The self-reference case

```js
{
  let x = x; // ReferenceError
}
```

The right-hand side is evaluated **before** the binding is initialised, so the `x`
on the right is read while still in its own dead zone. A declaration cannot
bootstrap itself from its own value.

Contrast the `var` version, which is silently useless rather than loud:

```js
{
  var y = y; // no error — y is undefined, assigned undefined
}
```

This looks like a curiosity, but it is exactly what happens when someone writes
`const config = config ?? defaults` intending to read an **outer** `config`. Under
`var` it quietly produces `undefined`; under `const` it throws and tells you the
shadowing was a mistake. Which is the argument for the whole feature.

## Where the TDZ shows up that people forget

- **`const` in `for...of` / `for...in`.** A fresh binding per iteration, each with
  its own very short dead zone. This is what makes `for (const item of items)` legal
  despite `const` — each iteration *declares a new* `item`; it is not reassigning
  one.
- **Loop `let` and per-iteration bindings.** The `let`-in-a-loop fix from
  [06 · Closures](../06-closures/01-what-is-captured.md) is the same machinery: each
  iteration gets its own binding, created and initialised fresh, which is why
  closures made in different iterations capture different variables.
- **Class bodies, `extends` clauses, default parameters and circular ES module
  imports** — four places where the TDZ produces an error that does not look like a
  TDZ error. Those are chunks [5](./05-block-functions-and-parameters.md) and
  [6](./06-classes-and-circular-imports.md).

## Gotchas

**Symptom:** `ReferenceError: Cannot access 'x' before initialization`
**Cause:** A `let`, `const` or `class` binding read above its declaration in the same
block — the binding exists but is uninitialised.
**Fix:** Move the read below the declaration, or the declaration up. If the name was
meant to be an *outer* variable, you have an accidental shadow: rename the inner one.

**Symptom:** A function defined above a `let` works fine, and an identical one
throws
**Cause:** The TDZ depends on **when the read happens**, not where it is written.
Defining a closure inside the zone is legal; calling it inside the zone is not.
**Fix:** Check the *call* site, not the definition site.

**Symptom:** `let x = x;` throws while the `var` version silently gives `undefined`
**Cause:** The initialiser is evaluated before the binding is initialised, so the
right-hand `x` is in its own dead zone.
**Fix:** This is the TDZ catching a real bug — you meant an outer binding. Rename
the inner one.

**Symptom:** `SyntaxError: Missing initializer in const declaration`
**Cause:** Not a TDZ error at all — `const` requires a value at declaration, and this
fails at parse time, so nothing in the file runs.
**Fix:** Give it a value, or use `let` if it genuinely has none yet.

**Symptom:** `for (const x of …)` works, but you were told `const` cannot be
reassigned
**Cause:** Each iteration creates a **new** binding rather than reassigning one.
**Fix:** Nothing — it is correct. The same mechanism gives `let` its per-iteration
binding in closures.

## Interview questions

**★ What is the temporal dead zone?**
The period between a block being entered and execution reaching a `let`, `const` or
`class` declaration inside it. The binding exists for that whole period but is
uninitialised, so any read throws `ReferenceError`. It ends at the **declaration**,
not at the first assignment.

**★ Why is it called *temporal* rather than positional?**
Because it is bounded by execution time, not source position. MDN's example: an
arrow function defined *above* a `let` may reference it freely, and calling that
function *after* the declaration works. The definition is inside the zone; the read
is not. Move the call above the declaration and the same function throws.

**★ Does `let x;` without a value leave `x` in the TDZ?**
No. The declaration itself initialises the binding, to `undefined`, so the zone
closes there. `const` has no equivalent — omitting the initialiser is a parse-time
`SyntaxError`.

**Why does `for (const item of items)` work when `const` cannot be reassigned?**
Because each iteration creates a fresh binding rather than reassigning the previous
one. That per-iteration binding is the same mechanism that makes `let` in a loop
capture correctly in closures, and each one has its own brief dead zone.

**Can a function reference a variable declared below it?**
Yes, as long as it is not *called* before the declaration executes. This is what
makes mutual recursion between `const`-assigned arrows work, and it is the practical
consequence of the zone being temporal rather than positional.

---

← [`var` and function declarations](./02-var-and-function-declarations.md) · [Topic index](./README.md) · Next → [`typeof`, error messages and why the TDZ is a feature](./04-typeof-and-why-its-a-feature.md)
