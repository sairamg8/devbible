---
title: "03 — The extension you type in an import"
sidebar_label: "03 · The extension you type in an import"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the `TS2834`, `TS2835`, `TS5097` and `TS5096` message
> texts read out of the installed **TypeScript 5.9.3** build, and `TS5096`
> cross-checked against the **7.0.2** native binary, where its text differs.
> **No sandbox, no console blocks.**

This is the rule people find hardest to accept, and it is a direct consequence of
one sentence from topic 01: **the specifier is emitted exactly as written.**

## The rule

```ts
// src/app.ts
import { route } from "./router.js";   // ✅ — and ./router.js does not exist
```

You are importing a `.ts` file. You write `.js`. The file `router.js` does not
exist in your source tree and will not until you build.

**Because the compiler does not rewrite the string.** It emits
`import { route } from "./router.js"` verbatim, and at runtime `./router.js` is
exactly what is there. The specifier describes the **output**, not the input.

The mental model that makes this stop being annoying: *you are writing the import
that your compiled file will contain.* The `.ts` file is a source for a `.js`
file, and the import points at the other `.js` file.

## When it is required

Under `moduleResolution` `node16` or `nodenext`, in a file whose detected format
is ESM. Two diagnostics say so:

**TS2834** — *"Relative import paths need explicit file extensions in ECMAScript
imports when '--moduleResolution' is 'node16' or 'nodenext'. Consider adding an
extension to the import path."*

**TS2835** — the same sentence, ending *"Did you mean '{0}'?"*

🔴 **They are a pair, and the difference is whether the compiler worked out the
answer.** TS2835 fills `{0}` with the specifier it thinks you meant — so when you
get 2835 the fix is in the message, and when you get 2834 the compiler could not
resolve the target and the problem may be larger than a missing extension.

⚠️ **Under `moduleResolution: bundler` neither fires.** Bundlers do their own
resolution and are happy with extensionless specifiers. This is the single
biggest day-to-day difference between the two strategies, and topic 01 chunk 06
argues it.

## The mapping you are performing

| The file you are importing | What you write |
|---|---|
| `router.ts` | `"./router.js"` |
| `router.tsx` | `"./router.js"` |
| `router.mts` | `"./router.mjs"` |
| `router.cts` | `"./router.cjs"` |
| `router.d.ts` (a declaration) | the implementation's name, or `import type` |

It is chunk 01's output table, applied in reverse. If you know what a file emits,
you know what to type.

## Why not just write `./router.ts`?

Because the emitted string would be `./router.ts`, and there is no `.ts` file at
runtime. The compiler refuses:

**TS5097** — *"An import path can only end with a '{0}' extension when
'allowImportingTsExtensions' is enabled."*

And `allowImportingTsExtensions` has a precondition, whose exact text **changed
between the two compilers in this corpus**:

| Version | `TS5096` |
|---|---|
| **5.9.3** | *"Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set."* |
| **7.0.2** | *"Option 'allowImportingTsExtensions' can only be used when one of 'noEmit', 'emitDeclarationOnly', or **'rewriteRelativeImportExtensions'** is set."* |

The reasoning behind both is the same: writing `.ts` in a specifier is safe only
if **something guarantees the string never reaches a runtime unchanged**. `noEmit`
guarantees it by producing nothing. `rewriteRelativeImportExtensions` — new in
the 7.0 list — guarantees it by rewriting `./router.ts` to `./router.js` on the
way out.

⚠️ **Neither flag is this topic's to argue.**
[Phase 7 · Who compiles](../../phase-7-server/01-tsconfig-for-a-node-service/01-who-compiles.md)
works the pair through on a real Node service, including that
`rewriteRelativeImportExtensions` handles **relative** paths only — a `paths`
alias ending in `.ts` is not rewritten and is topic 03's problem. This chunk
claims only the extension rule that makes them necessary.

## Directory imports do not work either

```ts
import { x } from "./utils";          // ❌ under node16/nodenext ESM
import { x } from "./utils/index.js"; // ✅
```

`./utils/index.js` is not a convention the ES module resolver knows. It was a
Node CommonJS convenience, and it did not survive into ESM. The compiler models
the runtime, so it does not survive into `node16`/`nodenext` either.

⚠️ **This is what actually makes a `node10` → `nodenext` migration tedious**, far
more than the format questions: every barrel import in the codebase grows
`/index.js`. It is mechanical, and it is a large diff.

## Non-relative specifiers are a different question

Everything above is about **relative** paths. `import { z } from "zod"` has no
extension and never needs one, because a bare specifier is resolved through
`node_modules` and the package's `exports` map — a mechanism that has its own
rules and is topic 01's.

The dividing line is worth stating because people over-apply the extension rule:
**leading `./` or `../` → you write the extension. Anything else → you do not.**

## Gotchas

**Symptom:** `./router.js` is flagged by your editor as a missing file.
**Cause:** an editor or linter resolving specifiers against the source tree
rather than through TypeScript.
**Fix:** configure the linter's resolver (`eslint-import-resolver-typescript`
and equivalents understand the rule). The compiler is right.

**Symptom:** TS2834 on a file, and TS2835 on another, from the same missing
extension.
**Cause:** 2835 means the compiler resolved the target and can name it; 2834
means it could not.
**Fix:** for 2834, check the file actually exists and is in the program before
adding an extension.

**Symptom:** no extension errors at all, and the built output crashes on Node.
**Cause:** `moduleResolution: bundler`, which permits extensionless specifiers,
in a project that emits for Node.
**Fix:** `bundler` is a promise that a bundler will resolve this. If nothing
does, the strategy is wrong — topic 01 chunk 06.

**Symptom:** you wrote `./router.ts` and got TS5097, then enabled
`allowImportingTsExtensions` and got TS5096.
**Cause:** the flag has a precondition, and it differs by compiler version.
**Fix:** on 5.x, `noEmit` or `emitDeclarationOnly`. On 7.x,
`rewriteRelativeImportExtensions` also qualifies.

**Symptom:** `rewriteRelativeImportExtensions` did not fix an alias import.
**Cause:** it rewrites *relative* paths only, as its own message says.
**Fix:** aliases are topic 03's problem and have their own four solutions.

**Symptom:** every barrel import broke on migrating to `nodenext`.
**Cause:** directory imports are not ESM. `./utils` must become
`./utils/index.js`.
**Fix:** mechanical, and worth doing with a codemod rather than by hand.

**Symptom:** someone "fixed" the extensions by adding `.js` to a bare specifier
like `"lodash/get.js"`.
**Cause:** confusion between relative and package specifiers.
**Fix:** it may even work, but it bypasses the package's `exports` map. Only
relative paths take the rule.

**Symptom:** a `.d.ts` you import directly errors, and adding `.js` makes it
worse.
**Cause:** you are importing a declaration file, which is TS2846 — chunk 02.
**Fix:** `import type`, or import the implementation.

## Interview questions

**Why do you write `./router.js` when the file is `router.ts`?**
Because the compiler emits the specifier exactly as written and does not rewrite
it. The string has to be correct for the *output* file, which is `.js`.

**When is the extension required?**
Under `moduleResolution` `node16` or `nodenext`, for relative paths in a file
detected as ESM. `bundler` does not require it, and non-relative specifiers never
do.

**What is the difference between TS2834 and TS2835?**
TS2835 names the specifier it believes you meant in `{0}`; TS2834 could not
resolve the target and only advises adding an extension.

**What do you write for a `.mts` file?**
`./thing.mjs` — the output extension. And note that extensionless resolution
would not have found it anyway, per chunk 02.

**Why can't you just write `./router.ts`?**
TS5097 — the emitted string would point at a file that does not exist at
runtime. `allowImportingTsExtensions` lifts it, but only alongside something that
guarantees the string never ships unchanged.

**What changed about that precondition in TypeScript 7?**
`TS5096` gained a third option. 5.9.3 requires `noEmit` or `emitDeclarationOnly`;
7.0.2 also accepts `rewriteRelativeImportExtensions`, which fixes the string at
emit rather than suppressing emit.

**Why do directory imports stop working under `nodenext`?**
`./utils/index.js` was a CommonJS convenience that ESM never adopted. The
compiler models the runtime, so it does not offer what the runtime will not do.

**Which is the larger migration cost — formats or extensions?**
Extensions, usually. Format questions are a handful of decisions; adding
`/index.js` to every barrel import is a change in every file that has one.

---

← [02 · How the compiler picks a file](./02-resolution-order.md) · Next → [04 · Choosing an extension](./04-choosing.md)
