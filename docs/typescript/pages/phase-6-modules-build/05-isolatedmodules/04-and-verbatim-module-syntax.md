---
title: "04 — Its relationship to `verbatimModuleSyntax`"
sidebar_label: "04 · And `verbatimModuleSyntax`"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from `_computedOptions.isolatedModules`,
> `isolatedModulesLikeFlagName`, the `isolatedModules` and
> `verbatimModuleSyntax` option records, `generateTSConfig` and the `TS5047`
> message text — all read out of the installed **TypeScript 5.9.3** build. **No
> sandbox, no console blocks.**

The two flags are constantly confused, and for a good reason: **one turns the
other on**, and the diagnostics they produce are literally the same strings.

## 🔴 `verbatimModuleSyntax` implies `isolatedModules`

Not "is similar to". Implies, in the compiler's own computation:

```js
isolatedModules: {
  dependencies: ["verbatimModuleSyntax"],
  computeValue: (compilerOptions) =>
    !!(compilerOptions.isolatedModules || compilerOptions.verbatimModuleSyntax),
}
```

So `"verbatimModuleSyntax": true` alone gives you every rule in chunk 02, every
consequence in chunk 03, and no line in your `tsconfig.json` saying so.

⚠️ **This is why "we don't use `isolatedModules`" is so often wrong.** Check the
computed value, not the file. And it is why chunk 03's `preserveConstEnums`
surprise reaches projects that never wrote either name — `preserveConstEnums`
depends on the *computed* `isolatedModules`, which depends on
`verbatimModuleSyntax`.

## The messages are shared, and the compiler picks the name

```js
var isolatedModulesLikeFlagName =
  compilerOptions.verbatimModuleSyntax ? "verbatimModuleSyntax" : "isolatedModules";
```

That variable appears twice in the checker and is passed as `{0}` or `{1}` into
every message in chunk 02's table. So:

> *"Re-exporting a type when **'verbatimModuleSyntax'** is enabled requires using
> 'export type'."*

and

> *"Re-exporting a type when **'isolatedModules'** is enabled requires using
> 'export type'."*

are **the same diagnostic, TS1205**, with a different word substituted. Reading
the flag name out of the message tells you which one is set — but it does *not*
tell you that the other is off.

🔴 **Practical consequence: never search for a fix by the flag name in the
message.** The rule, the code and the fix are identical either way; only the
label differs. Search by the code.

## What `verbatimModuleSyntax` adds on top

`isolatedModules` says *"each file must be independently emittable"*.
`verbatimModuleSyntax` says *"and emit exactly what I wrote"* — no elision, no
rewriting of import forms.

The option records make the difference concrete:

| | `isolatedModules` | `verbatimModuleSyntax` |
|---|---|---|
| `affectsEmit` | — | ✅ |
| `affectsSemanticDiagnostics` | — | ✅ |
| `affectsBuildInfo` | — | ✅ |
| `transpileOptionValue` | `true` | — |
| Category | Interop Constraints | Interop Constraints |

**`isolatedModules` restricts the input. `verbatimModuleSyntax` also changes the
output.** That single row — `affectsEmit` — is the whole distinction, and it is
why one is a portability guarantee and the other is an emit policy.

Topic 02 argues `verbatimModuleSyntax` in full, including the elision behaviour,
the CommonJS caveat and the adoption path. This chunk only claims the
relationship between the two.

## `isolatedModules` needs a module system

**TS5047** — *"Option 'isolatedModules' can only be used when either option
'--module' is provided or option 'target' is 'ES2015' or higher."*

The flag's promise is about files being independently emittable, and a project
with no module system has no independent files — everything shares one global
scope. There is nothing for the guarantee to mean.

⚠️ In practice this fires only on very old configs, because `module` is derived
from `target` and both defaults have long since moved past ES2015.

## 🔴 `tsc --init` turns both on

The clearest signal of the language team's position is what a fresh project gets.
`generateTSConfig` — the function behind `tsc --init` — writes a section headed
**"Recommended Options"** containing, in order:

```jsonc
"strict": true,
"jsx": "react-jsx",
"verbatimModuleSyntax": true,
"isolatedModules": true,
"noUncheckedSideEffectImports": true,
"moduleDetection": "force",
"skipLibCheck": true
```

and, above it, `"module": "nodenext"`, `"target": "esnext"` and — worth
noticing — `"types": []`.

Four of those are this phase's subjects, and three appear in this topic alone:

- **`isolatedModules` and `verbatimModuleSyntax` together**, despite one implying
  the other, because writing both is self-documenting.
- **`moduleDetection: force`** — which pre-empts TS1280 from chunk 02 by making
  every file a module.
- **`types: []`** — chunk 06 of topic 04 argues why, and `tsc --init` agreeing is
  the strongest available endorsement.

**A new TypeScript project is `isolatedModules`-clean from the first line.** The
flag is not an opt-in for people using esbuild; it is the default posture, and
turning it off is now the decision that needs justifying.

## Two flags this replaced

`importsNotUsedAsValues` and `preserveValueImports` both carry
`category: Backwards_Compatibility` in their option records — the compiler's own
verdict on them. They were partial attempts at the same problem, and
`verbatimModuleSyntax` is the single flag that superseded both. If you meet
either in an old config, the migration is to delete it and set
`verbatimModuleSyntax`.

## Gotchas

**Symptom:** a rule from chunk 02 fires and `isolatedModules` is not in the
config.
**Cause:** `verbatimModuleSyntax` is, and it implies it.
**Fix:** none needed. Read the computed options, not the file.

**Symptom:** the error message names `verbatimModuleSyntax` and searching for
that plus the message text finds nothing useful.
**Cause:** the message is shared; the same code exists with the other flag name
substituted, and most write-ups use the other one.
**Fix:** search by the code number.

**Symptom:** you removed `isolatedModules` to "get the const enum inlining back"
and nothing changed.
**Cause:** `verbatimModuleSyntax` is still on, so the computed value is still
true, so `preserveConstEnums` is still true.
**Fix:** both have to go — which is almost certainly the wrong trade.

**Symptom:** TS5047 on an old project.
**Cause:** no `module` and a `target` below ES2015.
**Fix:** set `module`. The flag is meaningless without one, and so, mostly, is
the project's config.

**Symptom:** a fresh `tsc --init` project has flags nobody chose.
**Cause:** the "Recommended Options" block writes seven of them live, not
commented.
**Fix:** read the generated file before assuming it is a blank slate. It is an
opinionated starting point, and mostly a good one.

**Symptom:** an old config has `importsNotUsedAsValues: "error"` and the team
does not know why.
**Cause:** it predates `verbatimModuleSyntax`. The compiler classifies it as
Backwards Compatibility.
**Fix:** delete it, set `verbatimModuleSyntax`, and fix whatever surfaces.

**Symptom:** two packages in a monorepo disagree about whether a `const enum`
inlines.
**Cause:** one has `verbatimModuleSyntax` and the other does not, and neither
mentions `isolatedModules`.
**Fix:** the implication chain is the explanation. Set both explicitly
everywhere, as `tsc --init` does.

## Interview questions

**How are `isolatedModules` and `verbatimModuleSyntax` related?**
`verbatimModuleSyntax` implies `isolatedModules` — the computed value is
`isolatedModules || verbatimModuleSyntax`. Setting the second gives you every
rule of the first.

**How do their diagnostics differ?**
They do not. The checker substitutes the flag name via
`isolatedModulesLikeFlagName`, so the codes and the fixes are identical and only
the word changes.

**What is the actual difference between the two flags?**
`isolatedModules` restricts what source is accepted. `verbatimModuleSyntax` also
changes emit — it is the one with `affectsEmit` in its option record.

**Why does `isolatedModules` require `module` or `target: es2015`?**
TS5047. Without a module system there are no independent files, so the
guarantee has nothing to be about.

**Which of the two does `tsc --init` write?**
Both, in a section headed "Recommended Options", alongside `strict`,
`moduleDetection: force`, `noUncheckedSideEffectImports` and `skipLibCheck` —
with `types: []` above.

**What replaced `importsNotUsedAsValues` and `preserveValueImports`?**
`verbatimModuleSyntax`. Both old flags carry `category:
Backwards_Compatibility` in the compiler's own option records.

**If a project sets neither flag, is it `isolatedModules`-safe?**
Unknown, and that is the point. Nothing has checked, so the codebase may contain
the patterns in chunk 02 and will not find out until the toolchain changes.

---

← [03 · `const enum` under the flag](./03-const-enum.md) · Next → [05 · Adopting it](./05-adopting-it.md)
