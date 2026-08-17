---
title: "The errors, and what each one will accept"
sidebar_label: "04 · The errors"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — every diagnostic below is read out of the compiler's own
> message table (installed **TypeScript 5.9.3**), and `TS1259`'s flag-name switch
> (`moduleKind >= ES2015 ? "allowSyntheticDefaultImports" : "esModuleInterop"`)
> is read from the checker source. **No sandbox, no console blocks.**

Six diagnostics all mean roughly *"this is a CommonJS module and you imported it
like an ES module"*. They differ in **what they will accept as a fix**, and that
difference is the whole of their usefulness.

## The set

> **TS1259:** *"Module '{0}' can only be default-imported using the '{1}' flag"*
> **TS2497:** *"This module can only be referenced with ECMAScript
> imports/exports by turning on the '{0}' flag and referencing its default
> export."*
> **TS2595:** *"'{0}' can only be imported by using a default import."*
> **TS2596:** *"'{0}' can only be imported by turning on the 'esModuleInterop'
> flag and using a default import."*
> **TS2598:** *"'{0}' can only be imported by using a 'require' call or by
> turning on the 'esModuleInterop' flag and using a default import."*
> **TS2617:** *"'{0}' can only be imported by using 'import {1} = require({2})'
> or by turning on the 'esModuleInterop' flag and using a default import."*

And the two that look like this problem and often are not:

> **TS1192:** *"Module '{0}' has no default export."*
> **TS2613:** *"Module '{0}' has no default export. Did you mean to use
> `import { {1} } from {0}` instead?"*

## Reading them as a family

Grouped by what they are telling you to change:

| Code | Change the **flag** | Change the **import form** | Notes |
|---|---|---|---|
| TS1259 | ✓ | — | Names the flag *for your `module` setting* |
| TS2497 | ✓ | ✓ (to a default import) | The namespace-import case |
| TS2595 | — | ✓ | **No flag will help** |
| TS2596 | ✓ | ✓ | Both, together |
| TS2598 | ✓ | ✓ **or** `require()` | Offers an escape hatch |
| TS2617 | ✓ | ✓ **or** `import x = require(…)` | The most specific of the set |

🔴 **`TS2595` is the odd one out and the most informative.** *"'{0}' can only be
imported by using a default import"* — with no mention of a flag — means the
declaration genuinely has a default and you did not ask for one. That is not an
interop problem; it is a wrong import statement, and no configuration change will
fix it.

📌 **The ones that name `require()` (`TS2598`, `TS2617`) are offering you the
honest spelling** from [chunk 01](./01-what-a-default-import-means.md). If you do
not want the flag — because a bundler is doing interop, or because the file must
emit CommonJS — that suggestion is a real option, not a consolation prize.

## `TS1259` names a *different flag* depending on your config

Restating chunk 02's finding here because this is where you meet it. The checker
picks `{1}` like this:

```js
const compilerOptionName = moduleKind >= ES2015 ? "allowSyntheticDefaultImports" : "esModuleInterop";
```

- **`module` emits ES modules** → you are told `allowSyntheticDefaultImports`,
  because TypeScript is not going to write interop helpers into ESM output
  anyway; only the type-level permission is available to you.
- **`module` emits CommonJS** → you are told `esModuleInterop`, because there the
  real fix also emits the helper.

⚠️ **So "which flag does TypeScript say to use?" has no context-free answer**, and
two people quoting the same error at each other are usually both right. Compare
`module` settings before compiler versions.

📌 **`TS1259` also carries related information** pointing at the `export =`
declaration that caused it — the compiler is showing you the line in the `.d.ts`
that says this module is CommonJS. Follow it; it is faster than reasoning about
the package.

## `TS1192` and `TS2613` — usually not this topic

*"Module has no default export"* has three quite different causes, and only one
of them is interop:

1. **The module is ESM with named exports only**, and you wrote a default import
   by habit. `TS2613`'s suggestion — *"Did you mean to use `import { X } from
   …`"* — is exactly right, and no flag is involved.
2. **The module is CommonJS and interop is off.** This is the topic; turn the
   flag on, or use `import x = require(…)`.
3. 🔴 **A hand-written shim declared named exports for a package that assigns
   `module.exports`** — or the reverse. The declaration is wrong about the
   runtime, and changing the flag will make one of the two situations compile
   while leaving the value wrong.

**Distinguishing 2 from 3 takes ten seconds and saves an afternoon:** open the
package's built entry point. If it ends in `module.exports = …`, the declaration
should say `export =`
([topic 07 · chunk 06](../07-authoring-d-ts-files/06-the-export-forms.md)), and
your import form is the flag question. If it has real ES exports, the shim is
wrong.

## The order to work through them

```
error mentions a FLAG?
  ├─ no  → TS2595 / TS2613: fix the import statement. No config change exists.
  └─ yes → is `tsc` emitting the JavaScript you run?
             ├─ yes → esModuleInterop
             └─ no  → allowSyntheticDefaultImports, or the require() form the
                      error itself offered (TS2598 / TS2617)
```

⚠️ **And before any of it: check whether the flag is already on.** With `module`
set to `node16`/`node18`/`node20`/`nodenext`/`preserve` it is on by default
(chunk 02), so an interop error under one of those configurations means something
else is wrong — most often a declaration that does not match the runtime.

## Gotchas

**Symptom:** `TS2595: 'x' can only be imported by using a default import.`
**Cause:** The module genuinely has a default and you used a named or namespace
import.
**Fix:** Change the import. No flag affects this one — the absence of a flag name
in the message is the signal.

**Symptom:** `TS1259` tells a colleague to set a different flag than it told you.
**Cause:** The message's flag name is chosen from the module kind.
**Fix:** Both messages are correct for their configuration. Compare `module`
settings.

**Symptom:** `TS2497` on `import * as x from 'cjs'; x()`.
**Cause:** With interop on, a namespace import is a real module namespace object
and is not callable.
**Fix:** `import x from 'cjs'`. The error names the flag because the flag is what
made the modelling correct.

**Symptom:** An interop error under `module: nodenext`, where the flag is already
on.
**Cause:** Not an interop problem. Usually a declaration that does not match the
package's runtime shape.
**Fix:** Read the built entry point and check the declaration's export form
against it.

**Symptom:** `TS1192: Module 'x' has no default export` and turning on
`esModuleInterop` did not help.
**Cause:** The module is a real ES module with named exports only.
**Fix:** Use a named import. `TS2613`'s variant of the message says so directly.

**Symptom:** You "fixed" `TS1192` by changing a shim to `export default`.
**Cause:** It silences the error.
**Fix:** Revert. If the package assigns `module.exports`, the shim says
`export =` and the import form is the consumer's flag question — otherwise the
build is green and the value `undefined`.

**Symptom:** `TS2598` suggests a `require` call and that feels like a step
backwards.
**Cause:** It is offering the accurate spelling for a CommonJS module.
**Fix:** It is a legitimate choice, particularly where a bundler handles interop
and you do not want TypeScript emitting a second implementation.

**Symptom:** The related information on `TS1259` points into a `.d.ts` you have
never opened.
**Cause:** It is showing you the `export =` declaration that makes this module
CommonJS.
**Fix:** Follow it. That line is the answer to "why does the compiler think this
is CommonJS?".

**Symptom:** Different interop errors from the same package in different files.
**Cause:** The files have different implied module formats — `.mts` versus
`.cts`, or `type: module` boundaries.
**Fix:** That is **06 · File extensions** *(not written yet)* and topic 01's
territory; the interop flag is downstream of the format question.

## Interview questions

**★ What separates `TS2595` from the other interop errors?**
It names no flag. *"'{0}' can only be imported by using a default import"* means
the module really does have a default and your import statement is wrong — a code
fix, not a configuration one. Every other error in the family offers a flag,
which is how you tell them apart at a glance.

**★ `TS1259` told you to set `allowSyntheticDefaultImports` and a colleague was
told `esModuleInterop`. Who is right?**
Both. The checker chooses the flag name from the module kind — ES-module targets
are told the type-only flag, because TypeScript will not emit interop helpers
into ESM anyway; CommonJS targets are told `esModuleInterop`, where the real fix
also emits the helper.

**★ You get an interop error under `module: nodenext`. What does that tell you?**
That it probably is not an interop problem, because `esModuleInterop` is on by
default for the whole Node family. Look instead for a declaration whose export
form does not match what the package's built entry point actually does.

**★ `TS1192: Module has no default export`. What are the possibilities?**
Three: the module is ESM with named exports only and you wrote a default import
by habit (`TS2613` says exactly this); it is CommonJS with interop off; or a
hand-written declaration is wrong about the module's shape. Only the second is
fixed by a flag, and the third is fixed by reading the built entry point.

**Why do `TS2598` and `TS2617` mention `require`?**
Because `import x = require(…)` is the accurate spelling for a CommonJS module
and needs no flag. Where a bundler already does interop, taking that suggestion
avoids having two implementations of the same convention in one pipeline.

**What is the related information attached to `TS1259` for?**
It points at the `export =` declaration that makes the module CommonJS — the
compiler showing you its evidence. Following it is faster than reasoning about
the package from its documentation.

**How do you tell an interop problem from a wrong declaration?**
Open the package's built entry point. `module.exports = …` means the declaration
should be `export =` and your import form is the flag question; real ES exports
mean the declaration is wrong. Ten seconds, and it separates the two causes that
produce identical errors.

---

← Prev: [03 · The emit](./03-the-emit.md) · Next → [05 · Choosing and migrating](./05-choosing-and-migrating.md)
