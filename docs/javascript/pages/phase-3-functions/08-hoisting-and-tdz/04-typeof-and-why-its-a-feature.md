---
title: "08.4 · `typeof`, error messages, and why the TDZ is a feature"
sidebar_label: "04 · typeof and why it's a feature"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`let`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let), [ReferenceError: can't access lexical declaration before initialization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cant_access_lexical_declaration_before_init). Documentation-validated.

The consequences of the dead zone: one operator it broke, three error strings you
will meet, and the argument for why any of this is worth having.

## `typeof` is no longer a safe probe

```js
{
  typeof i; // ReferenceError: Cannot access 'i' before initialization
  let i = 10;
}
```

MDN states it outright: *"Using the `typeof` operator for a variable in its TDZ will
throw a `ReferenceError`."*

This is a genuine behaviour change in the language, and it is worth understanding
what it broke. Before `let`, `typeof` was the one totally safe way to ask "does this
name exist?" — because for a name that was **never declared at all**, it returns the
string `"undefined"` instead of throwing:

```js
console.log(typeof undeclaredVariable); // "undefined"
```

That is still true. So `typeof` now has **two different behaviours for two different
kinds of "missing"**:

| The name is | `typeof name` |
|---|---|
| never declared anywhere | `"undefined"` — no throw |
| declared with `let`/`const`/`class`, in its TDZ | **throws `ReferenceError`** |
| declared with `var`, above its assignment | `"undefined"` — no throw |

**The practical fallout:** the old feature-detection idiom
`if (typeof SomeGlobal !== "undefined")` is still correct for genuinely undeclared
globals, which is what it was always for. But `typeof` **cannot** be used to guard
against a lexical binding in its own scope — the guard itself is the thing that
throws.

Use `globalThis.SomeGlobal !== undefined` when you are actually probing a global,
and restructure your code when you are not. There is no expression that safely
"checks whether a `let` is initialised yet" — by design, because needing one means
the code is ordered wrongly.

## The engine's error messages differ

MDN's error reference lists all three, and it is worth recognising whichever your
runtime uses:

| Engine | Message |
|---|---|
| V8 (Chrome, Node) | `ReferenceError: Cannot access 'X' before initialization` |
| SpiderMonkey (Firefox) | `ReferenceError: can't access lexical declaration 'X' before initialization` |
| JavaScriptCore (Safari) | `ReferenceError: Cannot access uninitialized variable.` |

All three are `ReferenceError`. Note Safari's does **not name the variable** — if
you are debugging a Safari-only bug report, the identifier will not be in the
message and you have to find it from the stack frame.

The one to memorise is V8's, since Node and Chrome both print it and it is the
string you will grep for. Distinguish it carefully from
`ReferenceError: X is not defined`, which is a **different failure**: no binding
exists at all. One means "too early"; the other means "never". They have different
fixes — reordering versus finding the missing declaration or import.

## Why the TDZ is a feature, not an annoyance

Three concrete things it buys, in increasing order of importance.

**1. Use-before-initialisation becomes an error instead of a wrong value.** The
`var` version of a use-before-declaration bug does not fail at the mistake; it
produces `undefined` and fails somewhere later — usually as
`TypeError: x is not a function`, or as a `NaN` that propagates through three
functions before anyone notices. The TDZ fails **at the line that is wrong**, with
the name of the thing that is wrong in the message. That is the difference between a
five-second fix and an afternoon.

**2. It makes `const` mean something.** Without a dead zone, a `const` binding would
have to be observable as `undefined` before its initialiser ran — which is a second
value, and would make `const` a lie. Leaving the binding uninitialised and refusing
to read it is what allows `const` to guarantee **exactly one value** for its entire
observable lifetime.

**3. It makes shadowing safe to reason about.** Because a `let` shadow occupies its
block *from the very top*, there is no window in which the name resolves to the
outer binding and then flips to the inner one:

```js
const value = "outer";
{
  console.log(value); // ReferenceError — NOT "outer"
  let value = "inner";
}
```

The inner `value` owns the name for the whole block. Without a TDZ this would log
`"outer"` and then silently mean something else four lines down — **the same
identifier resolving to two different bindings in one scope**, depending on the
line. The dead zone converts that entire class of confusion into an error.

This is also the reason the TDZ has to start at the **top of the block** rather than
at the declaration. A zone that began at the declaration would leave exactly that
window open.

## Gotchas

**Symptom:** `typeof someName` throws instead of returning a string
**Cause:** `someName` is a lexical declaration in its own TDZ. MDN: *"Using the
`typeof` operator for a variable in its TDZ will throw a `ReferenceError`."*
**Fix:** `typeof` is only safe for names that were **never declared**. For a global,
probe `globalThis.someName !== undefined`.

**Symptom:** A feature-detection guard that worked for years throws after a refactor
**Cause:** The name became a `let`/`const`/`class` in the same scope, so
`typeof X !== "undefined"` now reads a binding in its TDZ rather than probing an
undeclared global.
**Fix:** `globalThis.X !== undefined` for genuine globals; reorder the module if the
binding is local.

**Symptom:** `console.log(x)` printed the outer value in old code and throws after a
refactor to `let`
**Cause:** The inner `let` shadows the name from the **top of the block**, so the
outer binding is unreachable there. Under `var` there was no such zone.
**Fix:** This is the TDZ catching a real ambiguity — rename one of the two bindings
rather than reverting to `var`.

**Symptom:** Safari reports `Cannot access uninitialized variable.` with no name
**Cause:** JavaScriptCore's wording omits the identifier (MDN error reference).
**Fix:** Get the name from the stack frame or line number; the underlying bug is the
same TDZ access as V8's `Cannot access 'X' before initialization`.

**Symptom:** You cannot tell whether an error means "too early" or "does not exist"
**Cause:** `Cannot access 'x' before initialization` and `x is not defined` are both
`ReferenceError` but mean opposite things.
**Fix:** Read the message, not just the type. The first is fixed by reordering, the
second by declaring or importing.

## Interview questions

**★ Why does `typeof` throw for a variable in the TDZ?**
Because `typeof` still has to **read the binding** to report its type, and reading
an uninitialised binding is defined to throw. The special case where `typeof`
returns `"undefined"` applies only to names with **no binding at all**. So `typeof`
is safe for undeclared globals and unsafe as a guard for lexical declarations.

**★ Is the TDZ a bug or a feature?**
A feature, for three reasons: it turns use-before-initialisation into an error at the
offending line instead of an `undefined` that fails later; it is what allows `const`
to guarantee a single observable value; and it makes a shadowing `let` own its name
for the whole block, so one identifier never silently means two different bindings
in one scope.

**★ What is the difference between `Cannot access 'x' before initialization` and
`x is not defined`?**
The first means the binding **exists but is uninitialised** — a lexical declaration
used too early, fixable by reordering. The second means **no binding was found**
anywhere in the scope chain — a typo, a missing import, or the wrong scope. Both are
`ReferenceError`, which is why the message matters.

**Why does the TDZ have to start at the top of the block rather than at the
declaration?**
Because otherwise there would be a window in which the shadowed **outer** binding
was visible, and the same identifier would mean two different things at two points
in one block. Starting at the top makes the inner binding own the name throughout.

**How do you feature-detect a global safely now?**
`globalThis.SomeGlobal !== undefined`, which is a property access and cannot hit a
dead zone. `typeof SomeGlobal !== "undefined"` still works for a genuinely
undeclared global, but throws if the name happens to be a lexical declaration in
scope.

---

← [The temporal dead zone](./03-the-temporal-dead-zone.md) · [Topic index](./README.md) · Next → [Block functions and the parameter list](./05-block-functions-and-parameters.md)
