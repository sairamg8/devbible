---
title: "01.1 · import and export"
sidebar_label: "01 · import and export"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import), [`export`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export). Documentation-validated.

**A module is a file with its own scope and an explicit interface.** Before modules, every
script shared one global namespace and the interface was "whatever you happened to leave on
`window`". MDN states the change directly:

> "module features are imported into the scope of a single script — **they aren't available
> in the global scope**. Therefore, you will only be able to access imported features in the
> script they are imported into, and you won't be able to access them from the JavaScript
> console, for example."

That last clause catches everyone once: **a variable in a module is not reachable from the
devtools console**, because it is not global. Nothing is broken; the scope is simply doing
its job.

The reverse still holds — genuinely global values (`window`, `document`, anything set on the
global object) **are** visible inside a module.

## Named exports

The default way to expose things, and the one to prefer:

```js
// square.js
export const name = "square";
export function draw(ctx) { /* … */ }

// or gathered at the bottom
export { name, draw, reportArea, reportPerimeter };
```

```js
import { name, draw } from "./modules/square.js";
```

The names on both sides must match, which is the point — the identifier is part of the
contract. Rename explicitly when you need to:

```js
import { draw as drawSquare } from "./modules/square.js";
export { draw as drawSquare };            // renaming on the way out
```

## Default exports

MDN:

> "**Default exports** are designed to provide a single default function/value per module"

```js
export default randomSquare;
export default function (ctx) { /* … */ }   // may be anonymous
```

```js
import randomSquare from "./modules/square.js";   // no braces
```

🔴 **A default import's name is chosen by the importer, not the exporter.** There is no
contract on the name at all:

```js
import literallyAnything from "./modules/square.js";   // valid
```

That flexibility is the case against defaults in a codebase of any size:

| | Named | Default |
|---|---|---|
| Name is part of the contract | **yes** | no — the importer picks |
| Typo in the name | **build error** | silently imports the default |
| Rename across a codebase | mechanical, greppable | must be done by hand, per import |
| Editor auto-import | reliable | guesses a name |
| Tree shaking | straightforward | works, but coarser in practice |

**MDN does not state a preference** — it simply describes both — so this is a judgement, not
a documented rule. The judgement most large codebases arrive at is *named exports by
default, and a default export only where a module genuinely is one thing* (a React
component, a config object). The rest of this bible follows that convention.

A file can have both, and mixing them is where the confusion usually starts:

```js
export default Button;
export { ButtonGroup };

import Button, { ButtonGroup } from "./Button.js";   // default first, then braces
```

## Live bindings — the part that is not obvious

An import is **not a copy of a value**. MDN:

> "The imported values are **read-only views** of the features that were exported. Similar to
> `const` variables, you cannot re-assign the variable that was imported, but you **can still
> modify properties of object values**. The value can only be re-assigned by the **module
> exporting it**."

Two rules in one paragraph.

**You cannot reassign an import:**

```js
import { count } from "./counter.js";
count = 5;              // ⚠️ TypeError: Assignment to constant variable
```

**But the exporting module can, and you will see the new value:**

```js
// counter.js
export let count = 0;
export function increment() { count++; }
```

```js
// main.js
import { count, increment } from "./counter.js";
console.log(count);     // 0
increment();
console.log(count);     // 1  ← the binding is live
```

🔴 **This is the single biggest difference from CommonJS**, where `require` copies the value
at the time of the call and a later reassignment in the exporting module is invisible. Code
translated from `require` to `import` can therefore start *working* in a way it did not
before — or start surprising you, if it relied on the snapshot.

And the third case, which follows from "read-only view" but reads as a contradiction until
you separate the binding from the value:

```js
import { config } from "./config.js";
config = {};            // ⚠️ TypeError — cannot rebind
config.debug = true;    // ✅ allowed — mutating the object, not the binding
```

**The binding is frozen; the object is not.** Exactly the `const` rule from
[Phase 1 · 07](../../phase-1-values-and-coercion/07-const-is-not-immutable.md).

## Namespace imports

```js
import * as square from "./modules/square.js";
square.draw(ctx);
```

The namespace object collects every named export. It is a real object but a peculiar one —
its properties are the live bindings above, so they are read-only, and the object itself is
sealed. Useful when a module has many exports and you want them grouped; less useful when it
defeats tree shaking, since a bundler must work harder to prove which properties you touched.

## Re-exporting

```js
export { draw } from "./square.js";        // pass through, without importing locally
export * from "./shapes.js";               // everything named
export { default as Button } from "./Button.js";   // promote a default to a name
```

This is how a barrel file (`index.js`) is built. Worth knowing that `export *` **does not
re-export the default** — that is what the third form is for, and its absence is a common
half-hour of confusion.

## The specifier must be a string literal

```js
import { x } from "./a.js";                // ✅
const path = "./a.js";
import { x } from path;                    // ⚠️ SyntaxError
```

`import` declarations are **statically analysable by design** — the specifier cannot be
computed, and the statement cannot be nested inside a block or a function. That constraint is
what makes tree shaking and dependency graphs possible before any code runs. When you need a
computed or conditional import, that is dynamic `import()`, a separate expression form
covered in this phase's Understand tier.

## Gotchas

**Symptom:** A module's variable is `undefined` in the devtools console
**Cause:** MDN: module features *"aren't available in the global scope"*. Nothing is broken.
**Fix:** Set a breakpoint inside the module, or temporarily attach it to `globalThis` while
debugging.

**Symptom:** `TypeError: Assignment to constant variable` on an imported name
**Cause:** Imports are **read-only views**; only the exporting module may reassign.
**Fix:** Export a setter function, or export an object and mutate its properties.

**Symptom:** A value imported once keeps changing
**Cause:** Live bindings — expected. The exporting module reassigned it, and you see the
current value.
**Fix:** Expected, and the main behavioural difference from CommonJS `require`, which copies.

**Symptom:** A typo'd named import fails the build; a typo'd default import silently works
**Cause:** The default import's name is chosen by the importer and has no contract.
**Fix:** Prefer named exports where the identifier should be part of the interface.

**Symptom:** `export * from './x.js'` does not re-export `x`'s default
**Cause:** `export *` covers named exports only.
**Fix:** `export { default as X } from './x.js'`.

**Symptom:** `SyntaxError` on an `import` with a computed path, or inside an `if`
**Cause:** `import` declarations are static — the specifier must be a string literal and the
statement must be top-level.
**Fix:** Use dynamic `import()`, which is an expression and returns a promise.

## Interview questions

**★ Why can't you see a module's variables in the console?**
Because module scope is not global. MDN: module features *"aren't available in the global
scope"*. Globals are still visible **inside** a module; the relationship is one-way.

**★ What is a live binding?**
An import is a **read-only view** of the exporting module's binding, not a copy. If the
exporter reassigns, importers see the new value; importers themselves cannot reassign. This
is the main behavioural difference from CommonJS `require`, which copies the value at call
time.

**★ Can you mutate an imported object?**
Yes. MDN: *"you cannot re-assign the variable that was imported, but you **can** still modify
properties of object values."* The binding is frozen, the object is not — the same
distinction as `const`.

**★ Named or default exports?**
MDN documents both without preferring either, so this is a judgement. Named exports make the
identifier part of the contract: a typo is a build error, renames are greppable, and
auto-import is reliable. A default export's name is chosen by the importer, so none of that
holds. Prefer named, and use a default only where the module genuinely is one thing.

**★ Why must an import specifier be a string literal?**
So the module graph is knowable **before execution**, which is what makes tree shaking and
static dependency analysis possible. Computed or conditional loading is dynamic `import()`,
an expression that returns a promise.

**Does `export *` re-export the default?**
No — named exports only. Use `export { default as X } from "./x.js"`.

---

[Topic index](./README.md) · Next → [02 · Module specifiers and the graph](./02-specifiers-and-the-graph.md)
