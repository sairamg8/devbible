---
title: "The export forms, and `declare module`"
sidebar_label: "05 · The export forms"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Files →
> Templates → module.d.ts* — the `export =` and `export as namespace` guidance is
> quoted verbatim; *Modules* for `import x = require()`) and the compiler's
> diagnostic table for `TS2309`, `TS1203`, `TS1319`, `TS2497`, `TS2686`, `TS2664`
> and `TS2665`, read out of the installed **5.9.3** message table. **No sandbox,
> no console blocks.**

[Chunk 05](./05-module-or-global.md) settled *whether* a declaration file
exports. This one settles **how** — and the governing principle is short:

> 🔴 **The export form is a description of the runtime, not a preference.**
> If the JavaScript assigns `module.exports = fn`, the declaration says
> `export =`. If it has a real `export default`, the declaration says
> `export default`. Choosing by taste is how interop bugs are born.

## Named exports — the ordinary case

```ts
export function myFunction(a: string): string;
export const myField: number;
export interface SomeType {
  name: string;
  length: number;
  extras?: string[];
}
```

Note there is no `declare` here. `export` already satisfies `TS1046`
([chunk 01](./01-what-a-declaration-file-is.md)), and inside a `.d.ts` the
declarations are ambient anyway.

This is what you write for any modern package, and what `tsc` generates. If you
are hand-writing a shim and the package is ESM or transpiled ESM, stop here — the
rest of this chunk is for the CommonJS and UMD shapes you will meet in older
dependencies.

## `export =` — for CommonJS `module.exports = x`

The handbook:

> This handles cases where CommonJS exports a single value as `module.exports`.

```ts
declare const helloWorld: RegExp;
export = helloWorld;
```

The value can be anything JavaScript can assign — the handbook shows a regular
expression, a number, and the case worth memorising, because it is what a large
slice of npm looks like:

```ts
declare function getArrayLength(arr: any[]): number;
declare namespace getArrayLength {
  const maxInterval: 12;
}
export = getArrayLength;
```

That works because of the function + namespace merge from
[chunk 03](./03-the-three-spaces.md): one name in the value space,
one in the namespace space, no conflict.

**Two rules attach to `export =`:**

> **TS2309:** *"An export assignment cannot be used in a module with other
> exported elements."*
> **TS1203:** *"Export assignment cannot be used when targeting ECMAScript
> modules. Consider using 'export default' or another module format instead."*

So it is **all-or-nothing** — you cannot mix it with named exports, and the
namespace merge above is the supported way to hang extra names off it — and it is
a **CommonJS** description that the compiler refuses under an ESM target.

### Consuming an `export =`

The matching import form is `import x = require('…')`, which the handbook
describes as syntax that *"directly correlates to a CommonJS and AMD `require`"*
and which *"ensures you have a 1 to 1 match in your TypeScript file with the
CommonJS output"*:

```ts
import getArrayLength = require("get-array-length");
```

Whether a consumer may instead write the friendlier `import x from 'pkg'` is the
`esModuleInterop` question — [09 · `esModuleInterop` and default imports](../09-esmoduleinterop-and-default-imports/README.md) — and the diagnostic when they cannot is:

> **TS2497:** *"This module can only be referenced with ECMAScript
> imports/exports by turning on the '{0}' flag and referencing its default
> export."*

⚠️ **Do not "fix" `TS2497` by changing the declaration to `export default`.**
That makes the error go away and the runtime wrong: the consumer will get
`undefined` where they expected the module, because the JavaScript never had a
`default` property. The flag is the fix; the declaration was right.

## `export default` — for a real ES module

```ts
export default function greet(s: string): void;
```

Legal only where the module genuinely is an ES module:

> **TS1319:** *"A default export can only be used in an ECMAScript-style
> module."*

⚠️ **A default export in a hand-written declaration is a claim that a `default`
property exists.** For a transpiled ESM package it does (bundlers add
`__esModule` and a `default` key); for a hand-written CommonJS package it does
not. Check the built JavaScript before writing this line, not the source.

📌 **Prefer named exports in anything you author.** A default export cannot be
augmented by name, it renames freely at every call site, and it makes
`import type` and re-export chains harder to read. This is a style position
rather than a rule, but it is the one the TypeScript ecosystem has converged on.

## `export as namespace` — the UMD global

> You can use `export as namespace` to declare that your module will be available
> in the global scope in UMD contexts.

```ts
export as namespace myLib;

export function myFunction(a: string): string;
```

This describes a library that is *both* importable and, when loaded by a
`<script>` tag, available as a global. The compiler enforces that you pick one
per consuming file:

> **TS2686:** *"'{0}' refers to a UMD global, but the current file is a module.
> Consider adding an import instead."*

Inside a module you must import it; the bare global form is for script files
only. Modern packages rarely need this — it is a jQuery-era shape you will meet
in `@types` rather than write yourself.

## The one that is not an export form

`declare module 'name' { … }` looks like it belongs in this list and does not: it
declares (or augments) *another* module rather than shaping this file's exports,
and which of those two it does depends on whether the module already resolves.
That is [chunk 07](./07-declare-module-and-choosing.md), together with the
decision table for picking a form.

## Gotchas

**Symptom:** `TS2309: An export assignment cannot be used in a module with other
exported elements.`
**Cause:** `export =` alongside named exports.
**Fix:** Pick one. To attach names to an `export =` value, merge a `declare
namespace` of the same name into it.

**Symptom:** `TS1203: Export assignment cannot be used when targeting ECMAScript
modules.`
**Cause:** `export =` in a file the compiler treats as ESM.
**Fix:** Use `export default` — but first check the built JavaScript really is an
ES module. The declaration describes the runtime, not the target you wish you had.

**Symptom:** `TS1319: A default export can only be used in an ECMAScript-style
module.`
**Cause:** `export default` in a file resolved as CommonJS.
**Fix:** `export =` if the JavaScript assigns `module.exports`; otherwise fix the
module format ([topic 01](../README.md), lane C).

**Symptom:** `TS2497: This module can only be referenced with ECMAScript
imports/exports by turning on the '…' flag…`
**Cause:** A consumer wrote `import x from` against an `export =` declaration
without `esModuleInterop`.
**Fix:** Turn the flag on, or use `import x = require('…')`. ⛔ Do **not** change
the declaration to `export default` — that makes the types lie.

**Symptom:** `import pkg from 'pkg'` gives `undefined` at runtime, and it
type-checked.
**Cause:** The declaration claimed a `default` export the JavaScript does not
have.
**Fix:** Correct the declaration to `export =`, and let interop handle the import
form.

**Symptom:** `TS2686: 'myLib' refers to a UMD global, but the current file is a
module.`
**Cause:** Using a UMD global by bare name inside a module file.
**Fix:** Import it. The global form is available in script files only.

**Symptom:** Named exports on an `export =` module are invisible to consumers.
**Cause:** They were written as `export const` alongside the assignment
(`TS2309`), or inside the wrong namespace.
**Fix:** Merge a `declare namespace` with the same name as the exported value.

## Interview questions

**★ When do you use `export =` instead of `export default`?**
When the JavaScript being described assigns a single value to `module.exports` —
the CommonJS shape. `export default` describes a real ES module default. The
declaration must match the runtime; mismatching them is the root of most
`esModuleInterop` confusion. `export =` also cannot coexist with named exports
(`TS2309`).

**★ A consumer gets `TS2497` importing your package. What is the fix?**
Turn on `esModuleInterop` (or use `import x = require('…')`). The declaration is
correct — it describes a CommonJS module with no `default` property. Changing it
to `export default` silences the error and makes the types lie, so the import
succeeds at compile time and yields `undefined` at runtime.

**★ How would you type a function that also has properties on it, exported as a
CommonJS default?**
Declare a function and a namespace of the same name so they merge, then
`export =` the function. The handbook's `getArrayLength` / `maxInterval` example
is exactly this shape, and it works because a value and a namespace never
conflict.

**What is `export as namespace` for?**
UMD packages: the module is importable *and* exposes a global when loaded by a
`<script>` tag. Inside a module file you must still import it — referring to the
bare global there is `TS2686`.

**Why prefer named exports in a package you author?**
They can be augmented by name, they keep one canonical identifier across call
sites, and they make re-export chains and `import type` readable. A default
export is a single anonymous slot every consumer renames.

---

← Prev: [05 · Module or global](./05-module-or-global.md) · Next → [07 · `declare module`, and choosing](./07-declare-module-and-choosing.md)
