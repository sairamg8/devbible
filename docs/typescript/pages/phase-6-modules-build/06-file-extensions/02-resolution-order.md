---
title: "02 — How the compiler picks a file"
sidebar_label: "02 · How the compiler picks a file"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from `supportedTSExtensions`, `allSupportedExtensions`,
> `supportedDeclarationExtensions`, `supportedTSImplementationExtensions` and
> `extensionsNotSupportingExtensionlessResolution`, read out of the installed
> **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

`import "./util"` with `util.ts`, `util.js` and `util.d.ts` all on disk resolves
to exactly one of them, deterministically. The rule is a short array in the
compiler, and reading it answers several questions at once.

## The array, and why it is nested

```js
var allSupportedExtensions = [
  [".ts", ".tsx", ".d.ts", ".js", ".jsx"],
  [".cts", ".d.cts", ".cjs"],
  [".mts", ".d.mts", ".mjs"],
];
```

Two structures in one value:

- **The outer array is the three families** from chunk 01 — ambiguous, then
  always-CJS, then always-ESM.
- **The inner arrays are priority order.** Within a family, the compiler tries
  each extension left to right and takes the first that exists.

So for `./util`, with everything present:

| Candidate | Result |
|---|---|
| `util.ts` | ✅ **wins** |
| `util.tsx` | tried second |
| `util.d.ts` | tried third |
| `util.js` | tried fourth |
| `util.jsx` | tried last |

## Three things that follow immediately

**1 · A source file always beats its own build output.** `util.ts` is tried
before `util.js`, so a stale `dist/util.js` sitting next to your sources is
invisible to resolution. That is why the "compiled files shadowing sources"
problem people expect does not actually happen — as long as the `.ts` is in the
program.

**2 · A `.d.ts` beats a `.js`.** If a package ships both `util.js` and
`util.d.ts`, you get the declarations. This is the mechanism behind the whole
`@types` ecosystem and it is one line of an array.

**3 · `.tsx` beats `.d.ts`.** Rarely relevant, but it means a `.tsx` and a
`.d.ts` with the same base name resolve to the implementation, not the
declaration.

## 🔴 The `m` and `c` families do not support extensionless imports

```js
var extensionsNotSupportingExtensionlessResolution =
  [".mts", ".d.mts", ".mjs", ".cts", ".d.cts", ".cjs"];
```

**`import "./util"` will never find `util.mts`.** Not "is discouraged from" —
cannot. The extension is on a list that excludes it from extensionless
resolution entirely.

That is a mechanical fact worth knowing before you rename a file, because it is
the reason a `.ts` → `.mts` rename breaks imports that never mentioned an
extension:

```ts
import { x } from "./util";        // found util.ts        ✅
// rename util.ts → util.mts
import { x } from "./util";        // finds nothing        ❌
import { x } from "./util.mjs";    // ✅ — the output extension, chunk 03
```

It is also consistent with the runtime: Node requires explicit extensions for ES
modules, so an extensionless `.mjs` specifier would not have worked there either.
The compiler is refusing to model something the runtime cannot do — which is this
whole phase's theme.

## Declarations and implementations are separate sets

Two more arrays, and the split between them explains several diagnostics:

```js
var supportedDeclarationExtensions      = [".d.ts", ".d.cts", ".d.mts"];
var supportedTSImplementationExtensions = [".ts", ".cts", ".mts", ".tsx"];
```

The compiler distinguishes *a file that describes something* from *a file that is
something*, and it will tell you when you have confused them:

**TS2846** — *"A declaration file cannot be imported without 'import type'. Did
you mean to import an implementation file '{0}' instead?"*

```ts
import { Config } from "./config.d.ts";        // ❌ TS2846
import type { Config } from "./config.d.ts";   // ✅
import { Config } from "./config.js";          // ✅ if that is what you meant
```

🔴 **The message's `{0}` is filled in with the implementation file it found**,
which makes it one of the more genuinely helpful diagnostics in this area — it
does not just refuse, it names the file you probably meant.

## What `allowJs` changes

`getSupportedExtensions` chooses between `supportedTSExtensions` and
`allSupportedExtensions` based on `allowJs`:

```js
var supportedTSExtensions = [[".ts", ".tsx", ".d.ts"], [".cts", ".d.cts"], [".mts", ".d.mts"]];
```

Without `allowJs`, the `.js`, `.jsx`, `.cjs` and `.mjs` entries are **not in the
candidate list at all**. So `import "./util"` with only `util.js` on disk fails
to resolve, rather than resolving to an untyped file.

⚠️ **This is a different mechanism from `TS7016`** (the implicit-`any`
untyped-module error), which is lane D's
[topic 08](../08-typing-an-untyped-dependency/01-reading-the-symptom.md). One is
"the file is not a candidate"; the other is "the file resolved and has no types".
The errors read similarly and the fixes are different.

## `.json` is opt-in

`.json` appears only in the `*WithJson` variants of these arrays, which are used
when `resolveJsonModule` is on. Off by default, it is not a resolution candidate
at all.

Lane D's **topic 16 · Typing non-code imports** *(not written yet)* covers JSON,
CSS modules and `allowArbitraryExtensions` — the mechanism for importing a
`.css` given a `foo.d.css.ts` beside it.

## Gotchas

**Symptom:** renaming `.ts` → `.mts` broke imports that had no extension.
**Cause:** `.mts` is on `extensionsNotSupportingExtensionlessResolution`.
**Fix:** add the extension to every specifier — and note it is the *output*
extension, `.mjs`. Chunk 03.

**Symptom:** a stale `.js` next to a `.ts` is being used.
**Cause:** almost certainly not resolution — `.ts` is tried first. More likely
the `.ts` is excluded from the program by `include`/`exclude`.
**Fix:** check which files are in the program before suspecting extension
priority.

**Symptom:** a package's `.d.ts` is ignored and you get `any`.
**Cause:** the `.d.ts` is not beside the `.js` it describes, or the package's
`exports` map has no `types` condition.
**Fix:** priority only applies to candidates with the same base path. Lane D's
topic 11 covers the `exports` side.

**Symptom:** `import "./config.d.ts"` errors even though the file exists.
**Cause:** TS2846 — a declaration file is not an implementation.
**Fix:** `import type`, or import the implementation the message names in `{0}`.

**Symptom:** turning off `allowJs` produced "cannot find module" rather than an
untyped-module error.
**Cause:** without `allowJs`, `.js` is not a resolution candidate, so the failure
is at resolution rather than at checking.
**Fix:** expected. The two failure modes are different and only one is `TS7016`.

**Symptom:** `import data from "./data.json"` cannot find the module.
**Cause:** `resolveJsonModule` is off, so `.json` is not in the candidate list.
**Fix:** enable it. Note it also affects what is emitted and copied.

**Symptom:** two files, `Button.tsx` and `Button.d.ts`, and the declaration is
being ignored.
**Cause:** `.tsx` is tried before `.d.ts` in the same family.
**Fix:** working as designed — an implementation beside a declaration means the
implementation wins. Delete the stray `.d.ts`.

## Interview questions

**Given `util.ts`, `util.js` and `util.d.ts`, which does `import "./util"`
resolve to?**
`util.ts`. The order within the ambiguous family is `.ts`, `.tsx`, `.d.ts`,
`.js`, `.jsx`, first match wins.

**Why does a `.d.ts` beat a `.js`?**
Because it comes earlier in that array. It is the mechanism behind `@types`
packages supplying types for untyped JavaScript.

**Can `import "./util"` find `util.mts`?**
No. `.mts` is on `extensionsNotSupportingExtensionlessResolution`, along with
`.d.mts`, `.mjs`, `.cts`, `.d.cts` and `.cjs`. Extensionless resolution is
excluded for both unambiguous families.

**Why is that consistent rather than arbitrary?**
Node requires explicit extensions for ES modules, so an extensionless `.mjs`
specifier would fail at runtime. The compiler declines to model something the
runtime cannot do.

**What does `allowJs` change about resolution?**
It swaps the candidate list. Without it, `.js`, `.jsx`, `.cjs` and `.mjs` are not
candidates at all, so a JavaScript-only file fails to resolve rather than
resolving untyped.

**What is TS2846?**
*"A declaration file cannot be imported without 'import type'."* — and its `{0}`
names the implementation file it found instead, which is usually what you wanted.

**Why is `.json` not always a candidate?**
It is only in the `*WithJson` arrays, used when `resolveJsonModule` is enabled.
It is off by default.

---

← [01 · The extension table](./01-the-extension-table.md) · Next → [03 · The extension you type in an import](./03-the-specifier-extension.md)
