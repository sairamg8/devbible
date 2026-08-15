---
title: "01 · What actually happens in a cycle"
sidebar_label: "01 · What happens"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import), [Hoisting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Glossary/Hoisting), [`let` § TDZ](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz) — and ECMAScript [§ Cyclic Module Records](https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-cyclic-module-records) (`Link`, `Evaluate`), [§ Source Text Module Records](https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-source-text-module-records). Documentation-validated; **no timings, no console blocks**.

⚠️ **The mechanism is Master material.** Link-then-evaluate, live bindings and why a cycle lands
in the TDZ are
[02 · Deferred and hoisted](../02-module-semantics/02-deferred-and-hoisted.md). **This page is
what that means in a real cycle** — which patterns survive one, which fail, and why the same
cycle can work from one entry point and throw from another.

🔴 **A circular import is never a syntax error and rarely a load error. ESM resolves it happily
and then hands you a binding you cannot read yet.** That is the whole difficulty: the failure
arrives at *evaluation time*, in a `ReferenceError` several files from the cause.

## The two phases, in one paragraph

Modules are **linked** first: the whole graph is fetched, parsed, and every import is wired to
the exporting module's binding — before a single line runs. Then modules are **evaluated** in
depth-first order. A cycle is detected during linking and is *not* an error; when evaluation
re-enters a module that is already being evaluated, it simply returns, and the importer carries
on with bindings that exist but may not yet hold a value.

**So the question is never "does the binding exist" — it always does. The question is whether it
has been *initialised* by the time you read it.**

## The rule that predicts every case

| What you import | State when a cycle reads it early | Result |
|---|---|---|
| `function` declaration | **hoisted and initialised during linking** | ✅ works |
| `class` declaration | in the **TDZ** until evaluated | 🔴 `ReferenceError` |
| `const` / `let` | in the **TDZ** until evaluated | 🔴 `ReferenceError` |
| `var` | hoisted, holds `undefined` | ⚠️ `undefined`, silently |

🔴 **Function declarations are the reason most cycles work by accident.** Half the cycles in a
real codebase are invisible because both sides only export functions and only *call* them later,
by which time everything has evaluated.

**And the second half of the rule: *when* you read matters as much as *what*.**

```js
// a.js
import { b } from './b.js';
export const a = 'A';
console.log(b);            // 🔴 top-level read — may be in the TDZ

export function useB() {
  return b;                // ✅ read at call time — long after evaluation
}
```

A top-level read runs during evaluation, while the cycle is still unwinding. A read inside a
function runs whenever you call it — and because imports are **live bindings**, it sees the
current value, not a copy taken at import time.

## The worked cycle

```js
// a.js
import { helperB } from './b.js';
export const NAME = 'a';
export function helperA() { return `a→${helperB()}`; }

// b.js
import { NAME } from './a.js';
export function helperB() { return NAME; }        // ✅ read at call time
console.log('b sees NAME as', NAME);              // 🔴 top-level read
```

Enter through `a.js`: evaluation starts on `a`, hits the import of `b`, evaluates `b` first — and
`b`'s top-level `console.log` reads `NAME` while `a` has not run its own body yet. `NAME` is a
`const`, so it is in the TDZ:

```
ReferenceError: Cannot access 'NAME' before initialization
```

Delete that one `console.log` and the cycle is completely fine, because `helperB` is only ever
called later.

### The entry point changes the answer

🔴 **The same cycle can work or throw depending on which module is loaded first.** Depth-first
evaluation starts wherever the entry point is, so which side runs "early" differs:

- entry `a.js` → `b` evaluates first, and `b`'s top-level read of `a`'s `const` throws;
- entry `b.js` → `a` evaluates first, `a`'s body completes, and `b`'s read succeeds.

**This is why a cycle can pass every test and break in production**, or break only after a
bundler changes chunk order, or break only in the test that imports the "wrong" file first. A
cycle that works is not a cycle that is safe — it is one whose entry point happens to be kind.

## `class extends` is the sharpest edge

```js
// base.js
import { Registry } from './registry.js';
export class Base { … }

// registry.js
import { Base } from './base.js';
export class Registry extends Base {}      // 🔴 evaluated at class-definition time
```

`extends` evaluates its expression **when the class is defined**, at the top level — so this is
a top-level read by definition, and there is no "call it later" escape. A cycle through a class
hierarchy fails reliably, and it is the one shape you cannot get away with.

## Top-level `await` makes it worse

A module with top-level `await` suspends its evaluation, so anything downstream in the cycle
waits — and a cycle where two modules each await the other's completion cannot make progress.
Combining top-level `await` with a cycle is a shape to avoid outright; the `await` half of it is
[Phase 7 · 07 · `async`/`await`](../../phase-7-async/07-async-await/README.md) and
[01 · Import and export](../01-es-modules/01-import-and-export.md).

## Gotchas

**Symptom: `ReferenceError: Cannot access 'X' before initialization` from an import.**
Cause — a cycle with a top-level read of a `const`/`let`/`class` binding still in its TDZ.
Fix — move the read inside a function, or break the cycle ([02](./02-diagnosing-and-fixing.md)).

**Symptom: the import is `undefined` and nothing throws.**
Cause — the binding is a `var`, or you are in CommonJS rather than ESM.
Fix — the same, and prefer `const` so the failure is loud rather than silent.

**Symptom: a cycle works everywhere except one test file.**
Cause — that test imports the other side of the cycle first, changing evaluation order.
Fix — remove the cycle; the passing cases were luck.

**Symptom: it broke after a bundler upgrade with no source change.**
Cause — module order changed, so the "early" side of the cycle changed.
Fix — remove the cycle rather than pinning the tool.

**Symptom: `class X extends Y` throws where a function import from the same module works.**
Cause — `extends` is evaluated at definition time; that is a top-level read.
Fix — extract the base class to a third module both can import.

**Symptom: an app hangs at startup with no error.**
Cause — a cycle involving top-level `await`.
Fix — take the `await` out of the cycle; do it lazily inside a function.

## Interview questions

**★ What happens when two ES modules import each other?**
Nothing at link time — the cycle is detected and the bindings are wired. At evaluation, the
re-entered module returns immediately, so the importer may read a binding that exists but has not
been initialised: a `ReferenceError` for `const`/`let`/`class`, `undefined` for `var`, and no
problem at all for a hoisted function declaration.

**★ Why do so many cycles work?**
Because function declarations are initialised during linking, and most code only *calls* imported
functions later, after everything has evaluated. Live bindings mean the value is current when you
finally read it.

**★ Why does the same cycle sometimes throw and sometimes not?**
Evaluation is depth-first from the entry point, so which side of the cycle runs early depends on
which module is loaded first. A different entry point, test, or bundle order flips it.

**★ Why is `class B extends A` in a cycle guaranteed to break?**
Because `extends` evaluates its expression when the class is defined — at the top level — so it
is always an early read, with no deferral available.

**★ ESM throws where CommonJS gives `undefined`. Which is better?**
ESM. A `ReferenceError` at the point of the bad read is far easier to trace than an `undefined`
that flows through the program and fails somewhere else.

**★ Does a cycle stop the modules from loading?**
No. Fetching, parsing and linking all succeed. Only evaluation can fail, and only if something is
read too early.

---

[Topic index](./README.md) · [02 · Diagnosing and fixing](./02-diagnosing-and-fixing.md) →
