---
title: "The merge is one spread level deep, so a leaf that sets `extendedDiagnostics.checks` discards the root's `defaultCategory` — silently, because nothing in an object spread knows the object has an internal shape"
sidebar_label: "04c · What the shallow merge costs"
sidebar_position: 4.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/perform_compile.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/perform_compile.ts),
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts) —
> read through the GitHub contents API at that tag. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular's `angularCompilerOptions` merge is a single-level object spread, and that one fact is
worth a page.** A nested option is replaced wholesale rather than merged, so splitting
`extendedDiagnostics` across two files loses half of it — with no error, because there is nothing in
a spread that knows the object has an internal shape. Almost every Angular compiler option is a
scalar, so this never comes up until the one option that is not, and then it produces a
configuration that reads correctly, resolves to something else, and reports nothing.

## One spread level

Back to the line from [04](04-angularcompileroptions-and-how-it-inherits.md):

```ts
      let existingNgCompilerOptions = {...angularCompilerOptions, ...parentOptions};
```

Object spread copies **own enumerable properties, one level down**. Two files that each set a
different *top-level* key merge cleanly — that is the case everyone has seen work. Two files that
each set a different property of the *same* nested object do not: the descendant's whole object
replaces the ancestor's.

## `extendedDiagnostics`, the nested object that matters

Its declared shape, verbatim from `interface DiagnosticOptions` in
[`public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts):

```ts
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

Two properties, and the JSDoc supplies the default that will bite you: *"Uses `warning` by
default."* Split the two across a base and a leaf and the base's property is gone:

```jsonc
// tsconfig.json — the root
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "error"
    }
  }
}
```

```jsonc
// tsconfig.app.json — the leaf. This REPLACES the object above, it does not extend it.
{
  "extends": "./tsconfig.json",
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBox": "suppress"
      }
    }
  }
}
```

The resolved `extendedDiagnostics` for the app build is `{checks: {invalidBananaInBox: 'suppress'}}`.
`defaultCategory` is not `"error"` — it is back to `warning`. Nothing is reported, because from the
merge's point of view one valid object replaced another.

**Fix: nested objects are all-or-nothing per file. Write the whole thing in one place.**

```jsonc
// tsconfig.json — one home for the whole object
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

What the categories mean, which checks exist, and why promoting them to `error` is a semver hazard
is [01 · 15 Extended diagnostics](../01-compiler-with-a-framework-attached/15-extended-diagnostics.md)
and [01 · 15d Configuring it, and getting it wrong](../01-compiler-with-a-framework-attached/15d-configuring-extended-diagnostics.md).
This page is only about which *file* the object survives from.

## The validation runs on the resolved value, not on the file

One consequence deserves stating separately, because it turns an inheritance quirk into a build
failure. `verifyCompatibleTypeCheckOptions` in `compiler.ts` tests the merged options bag, so an
`extendedDiagnostics` in one file and a `strictTemplates: false` in another — inherited from
anywhere in the chain — combine into an error before a single template is read:

```ts
  if (options.extendedDiagnostics && options.strictTemplates === false) {
```

whose message text is, verbatim:

> *"Angular compiler option "extendedDiagnostics" is configured, however "strictTemplates" is
> disabled.*
>
> *Using "extendedDiagnostics" requires that "strictTemplates" is also enabled.*
>
> *One of the following actions is required:*
> *1. Remove "strictTemplates: false" to enable it.*
> *2. Remove "extendedDiagnostics" configuration to disable them."*

🔴 The test is `=== false`, the explicit opt-out — not "falsy", and not "absent". That is the same
comparison [05](05-stricttemplates-is-the-default-in-v22.md) is built on, and it means a project
that never mentions `strictTemplates` may configure `extendedDiagnostics` freely.

## Where a key belongs

Putting the whole merge together, the decision is short:

| The option should affect… | Put it in |
|---|---|
| the build **and** the tests | the workspace root `tsconfig.json` |
| the build only | `tsconfig.app.json`, knowing tests will differ |
| the tests only | `tsconfig.spec.json` |
| anything nested (`extendedDiagnostics`) | **exactly one file**, complete |

The reason the first row is the default answer is the shape of the generated workspace: the three
configs form a **star, not a chain** — `tsconfig.app.json` and `tsconfig.spec.json` are siblings
that each extend the root, and neither extends the other. So a key in the app config is invisible to
`ng test`, and a key in the spec config is invisible to `ng build`. That layout is the subject of
[03b · The app and spec configs](03b-the-app-and-spec-configs.md).

## Gotchas

**★ Symptom: `extendedDiagnostics.defaultCategory` is set in the root, `checks` in a leaf, and
`defaultCategory` behaves as if it were never written.** Cause: the merge is a single-level spread,
so the leaf's `extendedDiagnostics` object replaces the root's entirely and `defaultCategory` falls
back to `warning`. Fix: write the whole object in one file:

```jsonc
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

**★ Symptom: an `angularCompilerOptions` key set in `tsconfig.app.json` has no effect on `ng test`.**
Cause: `tsconfig.spec.json` extends the **root**, not the app config — the three files are a star,
not a chain. Fix: move shared options to the root and keep leaf files for genuine per-target
differences:

```jsonc
// tsconfig.json — the only file both leaves see
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

**★ Symptom: the build fails with a configuration error naming `extendedDiagnostics`, even though
the two settings live in different files.** Cause: `verifyCompatibleTypeCheckOptions` runs against
the **resolved** options bag, so inheritance has already flattened them. Fix — apply either of the
two remedies the error message itself names, remembering that removing the `false` is a decision
about strictness rather than a workaround:

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "warning"
    }
  }
}
```

**Symptom: adding one `checks` entry in a leaf turns every other extended diagnostic from an error
back into a warning.** Cause: the same replacement — the leaf's object had no `defaultCategory`, so
the resolved value is the JSDoc default, and every check not named in `checks` follows it. Fix: name
`defaultCategory` in the same object as `checks`, every time:

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "error",
      "checks": {
        "nullishCoalescingNotNullable": "suppress"
      }
    }
  }
}
```

**Symptom: deep-merging seems to work for one nested case and not another.** Cause: it never works;
what looks like a successful deep merge is two files that happened to set *different top-level*
keys. Fix: no config gymnastics — treat every nested value as single-file-only.

**Symptom: a per-project override of one extended check forces you to restate the team's whole
diagnostics policy in that project.** Cause: correct, and unavoidable — the object is replaced, not
merged, so a partial statement is a complete statement. Fix: duplicate the object whole, or generate
the configs from one source; there is no inheritance-based way to split it.

## Interview questions

**★ You set `extendedDiagnostics.defaultCategory` in the root and `extendedDiagnostics.checks` in a
leaf. What do you get?**
Only `checks`. Angular's merge is a shallow object spread, so the leaf's `extendedDiagnostics`
replaces the root's entirely and `defaultCategory` falls back to its own documented default,
`warning`. Nothing warns you, because at the merge layer one valid object simply replaced another.
Nested `angularCompilerOptions` values are all-or-nothing per file — which in practice means
`extendedDiagnostics` has exactly one correct home.

**★ Why does the `extendedDiagnostics` + `strictTemplates: false` error fire even when the two are
in different files?**
Because the check runs on the resolved options bag, after inheritance has flattened it —
`if (options.extendedDiagnostics && options.strictTemplates === false)`. The comparison is against
the literal `false`, so it fires only for an explicit opt-out somewhere in the chain, not for a
project that simply never mentions the option. The message text names both fixes: remove the
`strictTemplates: false`, or remove the `extendedDiagnostics` configuration.

**Where should a shared `angularCompilerOptions` key live in a default CLI workspace?**
In the workspace root `tsconfig.json`. The generated layout is a star: `tsconfig.app.json` and
`tsconfig.spec.json` both extend the root and neither extends the other, so the root is the only
file both the build and the tests see. A key placed in a leaf is a statement that you want that
target to differ — which is occasionally right, and is the wrong default.

**A colleague proposes putting `extendedDiagnostics.checks` in each project's tsconfig and
`defaultCategory` in a shared base, to avoid repetition. What do you say?**
That it cannot work, and it will fail silently. The shallow merge means each project's
`extendedDiagnostics` replaces the base's, so `defaultCategory` never reaches any project — every
check not explicitly listed falls back to `warning`. If the repetition is genuinely painful, the
object has to be duplicated whole per file, or generated from one source.

**Is the shallow merge a bug?**
It is a deliberate simplification with a documented cost. The compiler's helper says only that it
merges `angularCompilerOptions` because TypeScript will not; nothing in the source claims a deep
merge, and Angular's own schematic re-implementation makes the same choice for the same reason. The
right way to hold it is as a format constraint — Angular compiler options are a flat namespace with
one structured member, and that member does not inherit piecewise.

## Where this goes next

The strongest evidence that the shallow, hand-rolled merge is a real quirk rather than an incidental
detail is that Angular implements it **twice**, in two places that behave differently:
[04d · The second implementation](04d-the-second-implementation.md).

---

← Prev: [Reading the merge](04b-reading-the-merge.md) · Index: [Topic index](README.md) · Next → [The second implementation](04d-the-second-implementation.md)
