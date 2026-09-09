---
title: "`extendedDiagnostics` is the one angularCompilerOptions key with a nested object, which makes it the one key that inheritance destroys — split `defaultCategory` and `checks` across two tsconfig files and the shallow merge throws half your configuration away, silently"
sidebar_label: "08c · Configuring extended diagnostics"
sidebar_position: 8.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> (`DiagnosticOptions` and `DiagnosticCategoryLabel`, quoted verbatim with their doc comments).
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured
> from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`ng new` does not generate an `extendedDiagnostics` block, so every one that exists was written by
hand — and it is the only `angularCompilerOptions` key whose value is a nested object, which makes it
the only key the inheritance rule can quietly destroy half of.** Split `defaultCategory` and `checks`
across the root and a leaf config and you get `checks`, silently, with the category back at its
default. This page is the block's shape, the three values it accepts, and where it belongs in a CLI
workspace's three files. What an upgrade does to it, and the one combination that is a build error,
are [08d](08d-extended-diagnostics-and-the-upgrade.md).

The roster of check names is
[15b](../01-compiler-with-a-framework-attached/15b-the-roster-of-checks.md); what each check finds is
[15c](../01-compiler-with-a-framework-attached/15c-the-checks-worth-understanding.md); the error codes
this configuration can raise and their resolution order are
[15d](../01-compiler-with-a-framework-attached/15d-configuring-extended-diagnostics.md). What follows
is the tsconfig half.

## The shape, verbatim

From `DiagnosticOptions`:

```ts
export interface DiagnosticOptions {
  /** Options which control how diagnostics are emitted from the compiler. */
  extendedDiagnostics?: {
    /**
     * The category to use for configurable diagnostics which are not overridden by `checks`. Uses
     * `warning` by default.
     */
    defaultCategory?: DiagnosticCategoryLabel;

    /**
     * A map of each extended template diagnostic's name to its category. This can be expanded in
     * the future with more information for each check or for additional diagnostics not part of the
     * extended template diagnostics system.
     */
    checks?: {[Name in ExtendedTemplateDiagnosticName]?: DiagnosticCategoryLabel};
  };
```

and the three legal values, each with its own doc comment:

```ts
export enum DiagnosticCategoryLabel {
  /** Treat the diagnostic as a warning, don't fail the compilation. */
  Warning = 'warning',

  /** Treat the diagnostic as a hard error, fail the compilation. */
  Error = 'error',

  /** Ignore the diagnostic altogether. */
  Suppress = 'suppress',
}
```

Two keys, three values, all lowercase. `defaultCategory` covers *"configurable diagnostics which are
not overridden by `checks`"*, and it is `warning` unless you say otherwise — which is why a project
that has never touched this block is emitting extended diagnostics into a CI log that nobody reads.
`checks` is a **map keyed by check name**, not by `NG` code and not an array.

## 🔴 The placement trap

`angularCompilerOptions` is not merged by TypeScript. TypeScript does not know the key exists; Angular
merges it across `extends` itself, with a **shallow** spread
([04](04-angularcompileroptions-and-how-it-inherits.md) and
[04c](04c-what-the-shallow-merge-costs.md)). For every other option that is invisible, because every
other value is a scalar and child-wins is exactly what you expected. `extendedDiagnostics` is an
object, so child-wins means **the whole object is replaced**, not merged into.

```json
// WRONG — tsconfig.json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": { "defaultCategory": "error" }
  }
}
```

```json
// ...and tsconfig.app.json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": { "checks": { "invalidBananaInBox": "suppress" } }
  }
}
```

The app build gets `checks` and **no `defaultCategory`** — back to `warning`, for every check you did
not name. Nothing reports this. The build is green, the suppression you wrote works, and the
promotion-to-error you also wrote is gone.

```json
// RIGHT — both halves in one object, in one file, and that file is the root.
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "error",
      "checks": {
        "invalidBananaInBox": "suppress"
      }
    }
  }
}
```

**The root is the right file for a second, independent reason.** In a CLI workspace
`tsconfig.spec.json` extends the **root**, not `tsconfig.app.json` — the three configs are a star, not
a chain ([03](03-the-three-tsconfig-files.md)). A block placed in the app config leaves your tests
running a different diagnostic policy from your build, which is exactly the kind of divergence that
produces "it passes locally" arguments.

**The rule that follows is one sentence:** exactly one `extendedDiagnostics` object per workspace, in
the root, containing both keys.

## Gotchas

**★ Symptom: `defaultCategory` set in the root reverts to `warning` for the app build.** Cause: a
`checks` block in `tsconfig.app.json` replaced the whole `extendedDiagnostics` object — the merge is a
shallow spread. Fix: both halves, one object, in the root:

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "error",
      "checks": { "invalidBananaInBox": "suppress" }
    }
  }
}
```

**★ Symptom: `"defaultCategory": "Error"` is rejected.** Cause: the labels are the lowercase enum
values `'warning'`, `'error'` and `'suppress'`. Fix: lowercase it. The error prints the allowed list,
so the answer is inside the message — one of the two places in this area where the diagnostic is
better documentation than the docs.

**★ Symptom: one name in `checks` is ignored while the others obey.** Cause: it is not in the supported
set — an `NG` code where a check name belongs, or a check from a different Angular version. Fix: copy a
name from the list the error prints, or from
[15b](../01-compiler-with-a-framework-attached/15b-the-roster-of-checks.md). The map is keyed by check
*name*, never by code.

**★ Symptom: you set `defaultCategory: "error"` and one diagnostic is still only a warning.** Cause:
`defaultCategory` applies to *"configurable diagnostics which are not overridden by `checks`"* — a name
listed in `checks` wins, whatever the default says. Fix: remove that name from `checks`, or set it
explicitly:

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "error",
      "checks": { "invalidBananaInBox": "error" }
    }
  }
}
```

**Symptom: the block is in `tsconfig.spec.json` and the application build ignores it.** Cause: leaves
do not see each other; the spec config extends the root, and so does the app config. Fix: put it in the
root — unless you deliberately want tests held to a different diagnostic policy from the build, which
is defensible but should be a written-down decision rather than an accident of where someone was
editing.

**Symptom: two `extendedDiagnostics` objects exist in one inheritance chain and only one takes
effect.** Cause: the same shallow spread, seen from further away — the nearest one wins outright and
the ancestor contributes nothing, not even keys the child omitted. Fix: grep the workspace and keep
one:

```bash
grep -rn 'extendedDiagnostics' --include='tsconfig*.json' .
```

**Symptom: `"checks"` written as an array of names has no effect.** Cause: the declared type is a map
from check name to category, not a list — a check name with no category has nothing to say. Fix:

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBox": "error",
        "nullishCoalescingNotNullable": "warning"
      }
    }
  }
}
```

## Interview questions

**★ You set `extendedDiagnostics.defaultCategory` in the root tsconfig and `extendedDiagnostics.checks`
in a leaf. What do you get?**
Only `checks`. Angular merges `angularCompilerOptions` across `extends` itself, with a shallow object
spread, so the leaf's `extendedDiagnostics` replaces the root's entirely and `defaultCategory` falls
back to its own default of `warning`. Nested objects inside `angularCompilerOptions` are all-or-nothing
per file. Keep both halves in the same file, and make that file the root.

**★ What are the three values an extended diagnostic can take?**
`'warning'`, whose doc comment says *"Treat the diagnostic as a warning, don't fail the compilation"*;
`'error'` — *"Treat the diagnostic as a hard error, fail the compilation"*; and `'suppress'` —
*"Ignore the diagnostic altogether"*. They are lowercase enum values and anything else is rejected with
an error that prints the allowed list. `defaultCategory` is `warning` unless set.

**★ Which of the three tsconfig files does the block belong in, and why?**
The root, for two independent reasons. `tsconfig.spec.json` extends the root and not
`tsconfig.app.json`, so a block in the app config gives your tests a different diagnostic policy from
your build. And the merge is shallow, so a second `extendedDiagnostics` object anywhere in the chain
replaces the first entirely rather than adding to it. Both failure modes are silent, which is what
makes the rule worth stating absolutely: exactly one object, in the root, with both keys in it.

**★ Why is `extendedDiagnostics` the only option this trap applies to?**
Because it is the only key in `angularCompilerOptions` whose value is a nested object. Every other
option is a scalar, and for a scalar "the child replaces the parent" is the behaviour everyone already
expects from `extends`. The moment a value has internal structure, "replace" and "merge" stop being the
same thing — and Angular's hand-rolled merge does the first while readers assume the second. The
lesson generalises past this option: any future nested `angularCompilerOptions` value will behave the
same way.

**Why is `warning` the default category, and what should a serious project do about it?**
Because extended diagnostics are heuristics about template style and probable mistakes rather than type
errors, and failing every build on a newly-added heuristic would make upgrades intolerable. The
consequence is that in a default project they are effectively invisible: warnings scroll past in CI and
nobody reads them. A project that intends to benefit from them sets `defaultCategory: "error"` and then
names the specific checks it is not ready for under `checks` — the same escalate-narrowly discipline
that applies to the strictness flags in [07c](07c-the-escape-hatches-are-ranked.md).

{/* FOOTER */}
