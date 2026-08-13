---
title: "08.2 · The temporal dead zone"
sidebar_label: "02 · The temporal dead zone"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`let`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let), [`class`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/class), [ReferenceError: can't access lexical declaration before initialization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cant_access_lexical_declaration_before_init). Documentation-validated.

**The dead zone is a stretch of time, not a stretch of code.** That is the whole
point of the name, and it is the part that survives being asked about.

MDN's definition: *"A variable declared with `let`, `const`, or `class` is said to
be in a 'temporal dead zone' (TDZ) from the start of the block until code
execution reaches the place where the variable is declared and initialized."*
While inside it, *"the variable has not been initialized with a value, and any
attempt to access it will result in a `ReferenceError`."*

So the binding from [chunk 1](./01-what-hoisting-actually-is.md) exists — the slot
is there from the top of the block — but it is **empty**, and reading an empty
slot is defined to throw rather than to produce `undefined`. `undefined` is a
value; an uninitialised binding holds no value at all. Those are different states,
and the TDZ is the language taking the trouble to distinguish them.

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
*function*, `foo`'s is in this *block*. The TDZ begins at the start of the block
that actually contains the `let` — not at the top of the function.

## "Temporal" is doing real work in that name

MDN: *"The term 'temporal' is used because the zone depends on the order of
execution (time) rather than the order in which the code is written (position)."*

This is the claim that separates people who have read about the TDZ from people
who understand it, and MDN's own example is the cleanest demonstration:

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
mentions `letVar` does not read `letVar`. The read happens when `func()` is
called, and by then execution has passed the declaration, the binding is
initialised, and it logs `3`.

Move the call up one line, above `let letVar = 3`, and the identical function
throws. **Nothing about the source changed for the function itself** — only when
it ran.

That is why "the TDZ is the region of code above the declaration" is a wrong
model that survives most of the time. The right model:

- The TDZ **opens** when the block is entered.
- The TDZ **closes** when execution reaches and completes the declaration.
- Anything that *reads* the binding in between throws, **wherever that read is
  written**.

The corollary a lot of code depends on: a function can close over a `let` declared
below it, as long as it is not *invoked* until afterwards. Mutual recursion
between `const`-assigned arrow functions works for exactly this reason.

### The declaration closes the zone even without an initialiser

```js
{
  // TDZ for x
  let x;        // ← TDZ ends here
  console.log(x); // undefined
  x = 1;
}
```

`let x;` with no initialiser still initialises the binding — to `undefined`. The
dead zone ends at the *declaration*, not at the first assignment. `const` cannot
do this: it requires an initialiser, and omitting one is a `SyntaxError` at parse
time (`Missing initializer in const declaration`), not a TDZ error.

## `typeof` is no longer a safe probe

```js
{
  typeof i; // ReferenceError: Cannot access 'i' before initialization
  let i = 10;
}
```

MDN states this outright: *"Using the `typeof` operator for a variable in its TDZ
will throw a `ReferenceError`."*

This is a genuine behaviour change in the language, and it is worth understanding
what it broke. Before `let`, `typeof` was the one totally safe way to ask "does
this name exist?" — because for a name that was never declared at all, it returns
the string `"undefined"` instead of throwing:

```js
console.log(typeof undeclaredVariable); // "undefined"
```

That is still true. So `typeof` now has **two different behaviours for two
different kinds of "missing"**:

| The name is | `typeof name` |
|---|---|
| never declared anywhere | `"undefined"` — no throw |
| declared with `let`/`const`/`class`, in its TDZ | **throws `ReferenceError`** |
| declared with `var`, above its assignment | `"undefined"` — no throw |

The practical fallout: the old feature-detection idiom
`if (typeof SomeGlobal !== "undefined")` is still correct for genuinely undeclared
globals, which is what it was always for. But `typeof` cannot be used to guard
against a lexical binding in its own scope — the guard itself is the thing that
throws. Use `globalThis.SomeGlobal !== undefined` when you are actually probing a
global, and restructure your code when you are not.

## The engine's error messages differ

MDN's error reference lists all three, and it is worth recognising them because
you will meet whichever your runtime uses:

| Engine | Message |
|---|---|
| V8 (Chrome, Node) | `ReferenceError: Cannot access 'X' before initialization` |
| SpiderMonkey (Firefox) | `ReferenceError: can't access lexical declaration 'X' before initialization` |
| JavaScriptCore (Safari) | `ReferenceError: Cannot access uninitialized variable.` |

All three are `ReferenceError`. Note Safari's does **not** name the variable — if
you are debugging a Safari-only bug report, the identifier will not be in the
message and you have to find it from the stack frame.

The one to memorise is V8's, since it is what Node and Chrome both print, and it
is the string you will grep for. Distinguish it carefully from
`ReferenceError: X is not defined`, which is a *different* failure: no binding
exists at all. One means "too early"; the other means "never".

## The self-reference case

```js
{
  let x = x; // ReferenceError
}
```

The right-hand side is evaluated *before* the binding is initialised, so `x` on
the right is read while still in its own dead zone. A declaration cannot bootstrap
itself from its own value.

Contrast the `var` version, which is silently useless rather than loud:

```js
{
  var y = y; // no error — y is undefined, assigned undefined
}
```

This looks like a curiosity, but it is exactly what happens when someone writes
`const config = config ?? defaults` intending to read an outer `config`. Under
`var` it would have quietly produced `undefined`; under `const` it throws and
tells you the shadowing was a mistake. Which is the argument for the whole
feature, so:

## Why the TDZ is a feature, not an annoyance

Three concrete things it buys, in increasing order of importance:

**1. Use-before-initialisation becomes an error instead of a wrong value.** The
`var` version of a use-before-declaration bug does not fail at the mistake; it
produces `undefined` and fails somewhere later, usually as
`TypeError: x is not a function` or as a `NaN` that propagates through three
functions before anyone notices. The TDZ fails at the line that is wrong, with the
name of the thing that is wrong in the message.

**2. It makes `const` mean something.** Without a dead zone, a `const` binding
would have to be observable as `undefined` before its initialiser ran — which is a
second value, and would make `const` a lie. Leaving the binding uninitialised and
refusing to read it is what allows `const` to guarantee exactly one value for its
entire observable lifetime.

**3. It makes shadowing safe to reason about.** Because a `let` shadow occupies its
block *from the very top*, there is no window in which the name resolves to the
outer binding and then flips to the inner one. Consider:

```js
const value = "outer";
{
  console.log(value); // ReferenceError — NOT "outer"
  let value = "inner";
}
```

The inner `value` owns the name for the whole block. Without a TDZ this would log
`"outer"` and then silently mean something else four lines down — the same
identifier resolving to two different bindings depending on the line. The dead
zone converts that entire class of confusion into an error. **This is the reason
the TDZ has to start at the top of the block rather than at the declaration.**

## Where the TDZ shows up that people forget

- **`const` in `for...of` / `for...in`.** A fresh binding per iteration, each with
  its own (very short) dead zone. This is what makes
  `for (const item of items)` legal despite `const` — each iteration declares a new
  `item`, it is not reassigning one.
- **Loop `let` and per-iteration bindings.** The `let`-in-a-loop fix from
  [06 · Closures](../06-closures/01-what-is-captured.md) is the same machinery:
  each iteration gets its own binding, created and initialised fresh, which is why
  closures made in different iterations capture different variables.
- **Class bodies, `extends` clauses, default parameters, and circular ES module
  imports** — four places where the TDZ produces an error that does not look like
  a TDZ error at first glance. Those are
  [chunk 3](./03-where-hoisting-bites.md).

## Gotchas

**Symptom:** `ReferenceError: Cannot access 'x' before initialization`
**Cause:** A `let`, `const` or `class` binding read above its declaration in the
same block — the binding exists but is uninitialised.
**Fix:** Move the read below the declaration, or move the declaration up. If the
name was meant to be an *outer* variable, you have an accidental shadow: rename
the inner one.

**Symptom:** `typeof someName` throws instead of returning a string
**Cause:** `someName` is a lexical declaration in its own TDZ. MDN: *"Using the
`typeof` operator for a variable in its TDZ will throw a `ReferenceError`."*
**Fix:** `typeof` is only safe for names that were never declared. For a global,
probe `globalThis.someName !== undefined` instead.

**Symptom:** A function defined above a `let` works fine, and an identical one
throws
**Cause:** The TDZ depends on **when the read happens**, not where it is written.
Defining a closure inside the zone is legal; calling it inside the zone is not.
**Fix:** Check the *call* site, not the definition site.

**Symptom:** `console.log(x)` prints the outer value in old code and throws after a
refactor to `let`
**Cause:** The inner `let` shadows the name from the top of the block, so the outer
binding is unreachable there. Under `var` there was no such zone.
**Fix:** This is the TDZ catching a real ambiguity — rename one of the two
bindings rather than reverting to `var`.

**Symptom:** `SyntaxError: Missing initializer in const declaration`
**Cause:** Not a TDZ error at all — `const` requires a value at declaration, and
this fails at parse time, so nothing in the file runs.
**Fix:** Give it a value, or use `let` if it genuinely has none yet.

**Symptom:** Safari reports `Cannot access uninitialized variable.` with no name
**Cause:** JavaScriptCore's wording omits the identifier (MDN error reference).
**Fix:** Get the name from the stack frame or line number; the underlying bug is
the same TDZ access as V8's `Cannot access 'X' before initialization`.

## Interview questions

**★ What is the temporal dead zone?**
The period between a block being entered and execution reaching a `let`, `const`
or `class` declaration inside it. The binding exists for that whole period but is
uninitialised, so any read throws `ReferenceError`. It ends at the declaration, not
at the first assignment.

**★ Why is it called *temporal* rather than positional?**
Because it is bounded by execution time, not source position. MDN's example: an
arrow function defined *above* a `let` may reference it freely, and calling that
function *after* the declaration works. The definition is inside the zone; the read
is not. Move the call above the declaration and the same function throws.

**★ Why does `typeof` throw for a variable in the TDZ?**
Because `typeof` still has to read the binding to report its type, and reading an
uninitialised binding is defined to throw. The special case where `typeof` returns
`"undefined"` applies only to names with **no binding at all**. So `typeof` is safe
for undeclared globals and unsafe as a guard for lexical declarations.

**★ Is the TDZ a bug or a feature?**
A feature, and for three reasons: it turns use-before-initialisation into an error
at the offending line instead of a `undefined` that fails later; it is what allows
`const` to guarantee a single observable value; and it makes a shadowing `let` own
its name for the whole block, so one identifier never silently means two different
bindings in one scope.

**What is the difference between `Cannot access 'x' before initialization` and
`x is not defined`?**
The first means the binding exists but is uninitialised — a lexical declaration
used too early, fixable by reordering. The second means no binding was found
anywhere in the scope chain — a typo, a missing import, or a wrong scope.

**Does `let x;` without a value leave `x` in the TDZ?**
No. The declaration itself initialises the binding, to `undefined`, so the zone
closes there. `const` has no equivalent — omitting the initialiser is a parse-time
`SyntaxError`.

---

← [What hoisting actually is](./01-what-hoisting-actually-is.md) · [Topic index](./README.md) · Next → [Where hoisting bites](./03-where-hoisting-bites.md)
