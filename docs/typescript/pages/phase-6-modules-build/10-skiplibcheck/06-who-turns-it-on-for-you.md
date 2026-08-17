---
title: "Who turns it on for you"
sidebar_label: "06 · Who turns it on for you"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the `tsc --init` template, `defaultInitCompilerOptions`,
> the `jsconfig.json` implicit options and the TS server's internal project
> overrides are all read out of the installed **TypeScript 5.9.3** build. The
> conflicting default is the **TSConfig reference**'s, quoted verbatim, and the
> **TypeScript 5.4 release notes** were checked and do **not** mention
> `skipLibCheck`. **No sandbox, no console blocks.**

Every discussion of this flag opens with some version of *"nearly everyone sets
it"*. That is true, and it is usually said as if it were a fact about developer
culture. It is not. **It is mostly a fact about what TypeScript writes into your
config for you**, and four separate mechanisms do it.

Knowing which one applies to you matters, because the answer to *"why is this
here?"* is very often *"nobody put it here"*.

## 1. 🔴 `tsc --init` writes it, under "Recommended Options"

The template emitter in 5.9.3 groups the options it generates under headers.
`skipLibCheck` is in this group:

```js
emitHeader(Diagnostics.Recommended_Options);
emitOption("strict",                       /*defaultValue*/ true);
emitOption("jsx", ReactJSX);
emitOption("verbatimModuleSyntax",         /*defaultValue*/ true);
emitOption("isolatedModules",              /*defaultValue*/ true);
emitOption("noUncheckedSideEffectImports", /*defaultValue*/ true);
emitOption("moduleDetection", Force);
emitOption("skipLibCheck",                 /*defaultValue*/ true);
```

> 🔴 **The compiler files `skipLibCheck: true` under `Recommended_Options`,
> alongside `strict`.**

That is the honest answer to "why does every project have this?". It is not
cargo-culting. TypeScript recommends it, in the file it generates, in the same
block as the flag everyone considers non-negotiable.

The older `defaultInitCompilerOptions` object in the same build carries it too:

```js
var defaultInitCompilerOptions = {
  module: CommonJS, target: ES2016, strict: true,
  esModuleInterop: true, forceConsistentCasingInFileNames: true,
  skipLibCheck: true
};
```

⚠️ **Being in "Recommended Options" does not make it right for your project.**
The recommendation is aimed at the common case — an application, consuming
dependencies, where you cannot fix other people's declarations anyway. It is
[chunk 02](./02-it-skips-your-declarations-too.md)'s library author for whom the
recommendation is actively wrong, and `tsc --init` has no way to know which you
are.

## 2. 🔴 The documented default conflicts with the compiler, and here is the resolution

This is worth doing carefully, because two authoritative-looking sources
disagree.

| Source | What it says |
|---|---|
| **TSConfig reference** | *"Default: `true` (as of TypeScript 5.4)"* |
| **The compiler's option record** | `defaultValueDescription: false` |
| **The predicate** | `options.skipLibCheck && …` — falsy when the option is absent |

**The compiler is decisive on the question actually being asked.** If your
`tsconfig.json` does not mention `skipLibCheck`, `options.skipLibCheck` is
`undefined`, the first clause of the predicate is falsy, and **every declaration
file is checked**. There is no computed-default machinery for this option — no
entry in `_computedOptions`, unlike `esModuleInterop`, whose real default *is*
computed ([topic 09 chunk 02](../09-esmoduleinterop-and-default-imports/02-the-two-flags.md)).

So the resolution is:

> ✅ **The compiler's default is `false`.** What changed in 5.4 is the config
> `tsc --init` generates, not the behaviour of an unconfigured program.

⚠️ **Stated with the uncertainty it deserves:** the 5.4 release notes were
checked and do not mention `skipLibCheck` at all, so the "as of 5.4" attribution
comes from the reference page and could not be confirmed against a release note
or changelog entry. What *was* confirmed directly is the part that matters — the
option record's default, and the predicate's behaviour when the option is absent.

📌 **Why this is not pedantry.** If you believe the default is `true`, you
believe a config with no `skipLibCheck` line is skipping declaration checks — so
you will not think to add `skipLibCheck: false` to your library build, because
you will assume removing the line achieves it. It does not. `false` has to be
written explicitly to be sure.

## 3. `jsconfig.json` sets it implicitly

A config file *named* `jsconfig.json` gets a different starting set of options:

```js
const options = configFileName && getBaseFileName(configFileName) === "jsconfig.json"
  ? { allowJs: true, maxNodeModuleJsDepth: 2,
      allowSyntheticDefaultImports: true, skipLibCheck: true, noEmit: true }
  : {};
```

> **A `jsconfig.json` project has `skipLibCheck: true` and nobody chose it.**

The filename alone does it. That is reasonable for its intended use — a
JavaScript project getting editor support — but it means a JS-plus-`@types`
codebase is not checking any of the declaration files it depends on, and the
config gives no visible sign of that.

## 4. The TypeScript server sets it on its internal projects

Two of the language server's own projects hard-code it:

```js
// AutoImportProviderProject.compilerOptionsOverrides
{ diagnostics: false, skipLibCheck: true, sourceMap: false,
  types: [], lib: [], noLib: true }
```

and `getCompilerOptionsForNoDtsResolutionProject`, which adds `noDtsResolution:
true`, `allowJs: true` and `maxNodeModuleJsDepth: 3` to the same idea.

These are internal — the project that scans for auto-import candidates, and the
one used for certain refactorings. They do not affect the diagnostics you see in
your own files. They are worth knowing about only because they are a further
demonstration of how the flag is meant to be used: **when you want to *read*
declarations without *validating* them, this is the flag.** That is precisely
what an auto-import index needs.

## 5. The `@tsconfig/*` bases

`@tsconfig/node22` and its siblings set `"skipLibCheck": true`, and
[phase 7 quotes `node22.json` in full](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md).
If your config `extends` a base, you have the flag whether or not your own file
mentions it.

## So: how to find out what you actually have

The config file is not the answer, because of everything above. Ask the compiler:

```bash
tsc --showConfig | grep -i skiplibcheck
```

🔴 **`--showConfig` resolves `extends` chains and applies the implicit
`jsconfig.json` options**, so it reports what the compiler will really use. A
`grep` of `tsconfig.json` does not.

## Gotchas

**Symptom:** Every project you have ever seen has this flag and nobody can say
why.
**Cause:** `tsc --init` writes it under "Recommended Options".
**Fix:** Nothing to fix — but knowing it means you can evaluate it on merit
rather than assuming a predecessor had a reason.

**Symptom:** You removed the `skipLibCheck` line expecting checking to be off,
based on "the default is `true`".
**Cause:** The compiler's default is `false`. Removing the line turns checking
**on**.
**Fix:** Write `"skipLibCheck": false` explicitly when you mean it, and read the
resolution above.

**Symptom:** A `jsconfig.json` project never reports errors in declaration files.
**Cause:** The filename implies `skipLibCheck: true`.
**Fix:** Set it explicitly to `false` if you want the checks; the implicit value
is invisible otherwise.

**Symptom:** `tsconfig.json` has no `skipLibCheck` and the build behaves as
though it does.
**Cause:** An `extends` chain — very likely an `@tsconfig/*` base.
**Fix:** `tsc --showConfig`.

**Symptom:** Two projects in a monorepo behave differently and their
`tsconfig.json` files look identical.
**Cause:** Different bases, or one is a `jsconfig.json`.
**Fix:** `tsc --showConfig -p <each>` and diff the output.

**Symptom:** Someone cites the TSConfig reference to argue the flag is on by
default and therefore harmless to leave unset.
**Cause:** The reference's "Default" field describes the generated config.
**Fix:** The option record says `false` and the predicate is falsy when absent.
Both can be checked in a second.

**Symptom:** A new project created with `tsc --init` is not catching a broken
`.d.ts` you wrote on day one.
**Cause:** The generated config already has the flag.
**Fix:** For a library, change it in the build config immediately — this is the
single most common way the library-author trap gets set.

**Symptom:** Auto-import suggestions appear for a package whose types do not
compile.
**Cause:** The auto-import provider project sets `skipLibCheck: true`
deliberately.
**Fix:** Working as designed — indexing declarations is not the same as
validating them.

## Interview questions

**★ Why does nearly every TypeScript project have `skipLibCheck: true`?**
Mostly because TypeScript put it there. `tsc --init` emits it under a
"Recommended Options" header alongside `strict`, `verbatimModuleSyntax` and
`isolatedModules`; the `@tsconfig/*` bases set it; and a `jsconfig.json` gets it
implicitly from its filename.

**★ Is `skipLibCheck` on by default?**
No. The compiler's option record gives `false` and the predicate is falsy when
the option is absent, so an unconfigured program checks every declaration file.
The TSConfig reference's "Default: `true` (as of 5.4)" describes the config
`tsc --init` generates, not the compiler's behaviour.

**★ Why does that distinction have practical consequences?**
Because if you think the default is `true`, you will assume *deleting* the line
disables declaration checking. It does the opposite. To be sure of the value you
have to write it explicitly.

**★ How do you find out whether a project really has it?**
`tsc --showConfig`. It resolves `extends` chains and applies the implicit
`jsconfig.json` options, which grepping the config file does not.

**What does a `jsconfig.json` imply beyond `skipLibCheck`?**
`allowJs: true`, `maxNodeModuleJsDepth: 2`, `allowSyntheticDefaultImports: true`
and `noEmit: true` — all from the filename, none of them visible in the file.

**Why does the TypeScript server set the flag on its own internal projects?**
Because the auto-import index needs to *read* declarations, not *validate* them
— which is exactly the use case the flag is designed for.

**Does `tsc --init` recommending it mean it is right for your project?**
It is right for the common case: an application whose declaration files all
belong to dependencies. It is wrong for a library, whose emitted `.d.ts` is the
deliverable, and `--init` cannot tell the two apart.

---

← Prev: [05 · `skipDefaultLibCheck` and the neighbours](./05-skipdefaultlibcheck-and-neighbours.md) · Next → [07 · The `.tsbuildinfo` interaction](./07-the-tsbuildinfo-interaction.md)
