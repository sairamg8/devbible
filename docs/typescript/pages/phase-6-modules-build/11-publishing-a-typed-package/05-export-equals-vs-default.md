---
title: "`export =` vs `export default`, and named exports"
sidebar_label: "05 · export = vs export default"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`arethetypeswrong` problem documentation**
> (`FalseExportDefault.md` and `NamedExports.md`, quoted verbatim) and the
> **TypeScript handbook** — *Modules* and *Declaration Files → Deep Dive*.
> `TS2497` and `TS1471`'s message text is read from the compiler's own diagnostic
> table in the installed **TypeScript 5.9.3** build. **No sandbox, no console
> blocks.**

The format is right, the map is right, and a consumer still gets `undefined`.
This chunk is the other half of publishing correctly: declaring your exports the
way your JavaScript actually performs them.

Two independent failures live here, and they are usually confused with each
other.

## Failure 1 — `export default` describing `module.exports =`

The quote is precise:

> *"The resolved types use `export default` where the JavaScript file appears to
> use `module.exports =`. This will cause TypeScript under the `node16` module
> mode to think an extra `.default` property access is required, but that will
> likely fail at runtime."*

And the correction, which is the sentence to memorise:

> 🔴 **`export default` describes `module.exports.default`, not `module.exports`
> itself.**

So the mapping is mechanical:

| Your JavaScript does | Your declaration must say |
|---|---|
| `module.exports = x` | **`export = x`** |
| `module.exports.default = x` | `export default x` |
| `exports.foo = x` | `export declare const foo: …` |
| `export default x` (real ESM) | `export default x` |

The tool's own note on where this comes from: *"This problem typically stems from
library authors hand-authoring declaration files rather than generating them from
TypeScript source."* Which is [topic 07 chunk 04](../07-authoring-d-ts-files/04-generated-or-handwritten.md)'s
argument arriving with a consequence attached — a generated declaration cannot
get this wrong, because the compiler emits `export =` for the construct that
produced `module.exports =`.

### Why the mistake is so easy

Because it *looks* right, and because `esModuleInterop` hides it locally.

A consumer with `esModuleInterop: true` writing `import x from 'pkg'` gets the
synthetic default, so an `export default` declaration and an `export =`
declaration behave the same for them —
[topic 09](../09-esmoduleinterop-and-default-imports/README.md) is the whole
story. Under `node16`/`nodenext` in a genuinely ESM consumer, they do not: the
declaration says there is a `default` property and Node says there is not.

⚠️ **So the bug is invisible in exactly the configuration most authors test in**,
and appears for the consumers who are on the most modern setup.

### The diagnostic that names it from the other side

```text
TS2497: This module can only be referenced with ECMAScript imports/exports by
        turning on the '{0}' flag and referencing its default export.
```

That is what a consumer sees when your declarations correctly say `export =` and
they try to default-import it without the interop flag. **It is the *healthy*
error** — it means your declaration is honest about being CommonJS.
[Topic 07 chunk 06](../07-authoring-d-ts-files/06-the-export-forms.md) covers the
export forms; this chunk is about choosing between them for a *published*
package.

## Failure 2 — named exports that do not exist at runtime

Different mechanism, same symptom class:

> *"TypeScript allows ESM named imports of the properties of this CommonJS
> module, but they will crash at runtime because they don't exist or can't be
> statically detected by Node.js."*

🔴 **Node does not execute your module to find out what it exports.** For a
CommonJS module imported from ESM, it runs **`cjs-module-lexer`** — a static
analyser — and only the properties that analysis can see become named imports.

Your declaration file makes a claim; the lexer makes a different one; TypeScript
believes yours.

### The line between analysable and not

The documentation's own example, and it is the whole distinction:

```js
exports.a = 'a';               // ✅ analysable — `a` becomes a named import
module.exports = { a: 'a' };   // ❌ not analysable
```

Both are ordinary, correct CommonJS. Only one of them supports
`import { a } from 'pkg'` in Node.

📌 **The scope note matters too:** *"This problem is only issued when the types
contain exports not found in the JavaScript, not vice versa."* Extra runtime
exports the types do not mention are not this bug — they are merely
under-declared, and harmless.

### The documented workaround

If your emit uses an unanalysable pattern and you cannot change it, there is a
hint the lexer reads:

```js
module.exports = { a: "a" };

0 && (module.exports = { a });
```

That second line *"will never run"* — `0 &&` short-circuits — but it is a
syntactic form `cjs-module-lexer` recognises, so the property becomes visible to
the analyser.

⚠️ **It looks like dead code and it is load-bearing.** Anyone minifying,
tree-shaking or "tidying" the output will delete it and reintroduce the bug, so
if you use it, it needs a comment saying why. Some bundlers emit this pattern
themselves for exactly this reason.

## The two failures side by side

| | Failure 1 | Failure 2 |
|---|---|---|
| **Claim** | there is a `default` property | there are named properties |
| **Reality** | `module.exports` *is* the value | the lexer cannot see them |
| **Fix** | `export =` instead of `export default` | `exports.x =` form, or the `0 &&` hint |
| **Whose analysis** | TypeScript's model of CommonJS | Node's `cjs-module-lexer` |
| **Caught by** | `arethetypeswrong` (FalseExportDefault) | `arethetypeswrong` (NamedExports) |

🔴 **Neither is caught by compiling your own package**, because your build never
performs the consumer's import. [Chunk 07](./07-the-problem-catalogue.md).

## Gotchas

**Symptom:** A consumer on `nodenext` reports that `.default` is required and
then crashes.
**Cause:** The declarations say `export default` where the JavaScript does
`module.exports =`.
**Fix:** `export = x`. `export default` describes `module.exports.default`.

**Symptom:** It works for every consumer you tested with.
**Cause:** They had `esModuleInterop` on, which synthesises the default and hides
the mismatch.
**Fix:** Test under `nodenext` from a real ESM consumer. Chunk 08 automates it.

**Symptom:** `import { thing } from 'pkg'` type-checks and crashes in Node.
**Cause:** `cjs-module-lexer` cannot see `thing` — most likely `module.exports =
{ … }`.
**Fix:** Switch to `exports.thing =`, or add the `0 && (module.exports = {
thing })` hint.

**Symptom:** The `0 &&` line was removed as dead code and named imports broke.
**Cause:** It is not dead — it is the analyser's only evidence.
**Fix:** Restore it with a comment. Exclude it from any "unused code" cleanup.

**Symptom:** The types declare fewer exports than the runtime has, and
`arethetypeswrong` says nothing.
**Cause:** By design — the check only fires when the *types* claim more than the
JavaScript.
**Fix:** Not this bug. Still worth fixing for completeness, but nothing breaks.

**Symptom:** `TS2497` from a consumer, and it is treated as a package bug.
**Cause:** It is the correct error for an honest `export =` declaration reached
without the interop flag.
**Fix:** The consumer enables `esModuleInterop` or writes `import x =
require('pkg')`. Your declaration is right.

**Symptom:** A hand-written `.d.ts` was "modernised" from `export =` to
`export default`.
**Cause:** `export =` looks archaic, so it gets tidied.
**Fix:** Revert. The syntax describes the runtime shape and is not a style
choice.

**Symptom:** A package emits `export default` from TypeScript source and
consumers still need `.default`.
**Cause:** Correct and expected — that source really does put the value on
`.default` when emitted to CommonJS.
**Fix:** Nothing, unless you meant `export =`. This is the case where the
declaration and reality agree.

## Interview questions

**★ Your JavaScript does `module.exports = fn`. What must the declaration say?**
`export = fn`. `export default fn` describes `module.exports.default`, which does
not exist — so consumers under `node16`/`nodenext` are told to write an extra
`.default` access that fails at runtime.

**★ Why does that bug survive testing?**
Because `esModuleInterop` synthesises a default for CommonJS modules, so the
mismatch is invisible to any consumer with the flag on — which is most of them,
and almost certainly the author's own test project.

**★ Why can a named import type-check and then crash in Node?**
Because Node does not execute a CommonJS module to discover its exports — it runs
`cjs-module-lexer` statically. Only properties that analysis can see become named
imports, and TypeScript believes your declaration file instead.

**★ Which CommonJS export patterns are analysable?**
`exports.a = 'a'` is; `module.exports = { a: 'a' }` is not. Both are correct
CommonJS, and only the first supports `import { a } from 'pkg'`.

**★ What is `0 && (module.exports = { a });` doing in a build output?**
It is a hint for `cjs-module-lexer`. The expression never runs, but it is a form
the analyser recognises, so the property becomes a valid named import. It must
not be removed as dead code.

**When is a mismatch between the types' exports and the runtime's *not* reported
by `arethetypeswrong`?**
When the runtime has *more* than the types claim. The check only fires when the
types claim exports the JavaScript does not have — the direction that breaks
consumers.

**A consumer reports `TS2497`. Is your package broken?**
No — that is the correct error for a truthful `export =` declaration reached
without `esModuleInterop`. They enable the flag or use `import x =
require('pkg')`.

**Why does generating declarations from source avoid failure 1 entirely?**
Because the compiler emits `export =` for exactly the construct that produces
`module.exports =`. The mismatch is only reachable by hand-authoring.

---

← Prev: [04 · Dual ESM/CJS](./04-dual-esm-cjs.md) · Next → [06 · `typesVersions`](./06-typesversions.md)
