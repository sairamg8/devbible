---
title: "02.2 · Deferred and hoisted"
sidebar_label: "02 · Deferred and hoisted"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import), [`<script>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script). Documentation-validated.

**Two more free properties: a module script never blocks parsing, and its imports are
resolved before any of its own code runs.**

## Deferred automatically

MDN:

> "There is no need to use the `defer` attribute when loading a module script; **modules are
> deferred automatically**."

So this:

```html
<script type="module" src="main.js"></script>
```

behaves like `<script defer src="main.js">`, not like a classic `<script>`:

- **It does not block HTML parsing.** The document keeps being built while the module graph
  is fetched.
- **It runs after the document has been parsed.** So the DOM is available without waiting for
  `DOMContentLoaded`.
- **Order is preserved** between multiple deferred module scripts, in document order.

🔴 **The practical consequence: `document.querySelector` at the top of a module works, even
though the `<script>` is in `<head>`.** With a classic script that is the classic bug —
`null` because the element does not exist yet. Modules removed a whole category of "wrap it
in `DOMContentLoaded`" boilerplate, and code carried over from the classic era still contains
the wrapper unnecessarily.

The counterpart is that **you cannot use `document.write`** from a module, and nothing in the
page can depend on the module having run during parsing. If something must run before the
page renders — a theme flash guard, for instance — a module script is the wrong tool.

## Imports are hoisted

`import` declarations are hoisted to the top of the module, and — more importantly — the
imported modules are **fully evaluated before any of the importing module's own code runs**.

```js
console.log("main starting");
import { helper } from "./helper.js";   // ⚠️ misleading placement
```

`helper.js` is evaluated **before** `"main starting"` prints. Writing an `import` halfway down
a file is legal and completely inert as documentation of ordering — which is exactly why the
convention is to put imports at the top: not because the language requires it, but so the
file reads the way it executes.

This gives modules a clean two-phase model that mirrors
[Phase 3 · 08 · Hoisting and the TDZ](../../phase-3-functions/08-hoisting-and-tdz/README.md):

1. **Link.** The whole graph is fetched and parsed; every `import` is matched to an `export`.
   Missing exports fail **here**, before anything runs.
2. **Evaluate.** Modules execute depth-first, dependencies before dependents.

Phase 1 is why a bad import name is a **build/load-time** error rather than a runtime
`undefined`:

```js
import { drwa } from "./square.js";   // ⚠️ SyntaxError: does not provide an export named 'drwa'
```

Compare CommonJS, where `const { drwa } = require("./square.js")` is simply `undefined` and
fails later, somewhere else. **This is the strongest everyday argument for ESM over
CommonJS**, and it comes entirely from imports being static
([01 · 01](../01-es-modules/01-import-and-export.md)).

## Hoisting plus live bindings: the useful part

Because bindings are linked in phase 1 and values arrive in phase 2, a function can reference
an import that has not been *initialised* yet, as long as it is not **called** until it has:

```js
// a.js
import { greeting } from "./b.js";
export function sayHi() { return greeting; }   // fine — not called yet
```

This is what makes mutually referencing modules work at all when the references are inside
functions. Where it breaks is a top-level read during a cycle:

```js
// a.js
import { value } from "./b.js";
export const doubled = value * 2;   // ⚠️ if b.js imports a.js, `value` may be in its TDZ
```

The failure is either `ReferenceError: Cannot access 'value' before initialization`, or
`undefined` where the binding was a `var`-like function declaration. **Circular imports get
their own topic** in this phase's Understand tier; the point here is that the mechanism
causing it is the ordinary two-phase model plus the TDZ, not a special case.

## Order of execution, concretely

```js
// main.js
import "./a.js";
import "./b.js";
console.log("main");
```

Evaluation is depth-first in import order: everything `a.js` imports, then `a.js`, then
everything `b.js` imports (skipping anything already evaluated), then `b.js`, then `main`.
So **`"main"` prints last**, always — a module's own body is the last thing to run in its
subtree.

That, combined with "runs once", means the *first* importer in the graph determines when a
module is evaluated, and every later importer just gets the finished result.

## Gotchas

**Symptom:** `document.querySelector` returns an element even though the script is in
`<head>`
**Cause:** Modules are **deferred automatically**, so they run after parsing.
**Fix:** Expected. The `DOMContentLoaded` wrapper carried over from classic scripts is
unnecessary.

**Symptom:** A theme or layout flash before the module runs
**Cause:** Deferred means it cannot run before render.
**Fix:** A small classic inline script for anything that must run during parsing.

**Symptom:** `document.write` does nothing from a module
**Cause:** It is deferred; the document is already parsed.
**Fix:** Use DOM APIs.

**Symptom:** A module's code runs before a `console.log` written above its `import`
**Cause:** Imports are **hoisted** and evaluated first, regardless of placement.
**Fix:** Put imports at the top so the file reads the way it runs.

**Symptom:** `SyntaxError: The requested module does not provide an export named 'x'`
**Cause:** Linking happens before evaluation, so a wrong name fails at load.
**Fix:** Fix the name — and note this is the error CommonJS would have given you as
`undefined` much later.

**Symptom:** `ReferenceError: Cannot access 'x' before initialization` across two modules
**Cause:** A circular import with a **top-level** read; the binding is still in its TDZ.
**Fix:** Move the use inside a function, so it runs after both modules have evaluated.

## Interview questions

**★ Do module scripts block HTML parsing?**
No. MDN: *"modules are deferred automatically"* — no `defer` attribute needed. They run after
the document is parsed, in document order, which is why `document.querySelector` at the top
of a module works even when the tag is in `<head>`.

**★ What happens if you put an `import` in the middle of a file?**
Nothing different — imports are **hoisted**, and imported modules are fully evaluated before
any of the importing module's code runs. Putting them at the top is a readability
convention, not a language requirement.

**★ Why is a mistyped import name an error, when CommonJS gives you `undefined`?**
Because ESM **links before it evaluates**: every import is matched to an export in a phase
before any code runs, so a missing export fails at load. `require` is a function call
returning an object, so a wrong property is just `undefined` and fails later, elsewhere.

**★ In what order do modules execute?**
Depth-first, in import order, dependencies before dependents, each module once. A module's own
body is the last thing to run in its subtree.

**★ Why does a circular import give `ReferenceError: Cannot access … before initialization`?**
Because linking created the binding but evaluation has not reached its initialiser — it is in
the TDZ. Reading it inside a function instead of at the top level defers the read until both
modules have finished evaluating.

**When is a module script the wrong choice?**
When something must run *during* parsing — a flash-of-unstyled-content guard, or anything
using `document.write`. Deferred execution rules that out; use a small classic inline script.

---

← Prev [01 · Singletons and strict](./01-singletons-and-strict.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
