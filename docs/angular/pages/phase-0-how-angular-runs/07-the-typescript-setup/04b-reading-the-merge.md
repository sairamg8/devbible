---
title: "The line that decides which tsconfig wins reads backwards — `parentOptions` is spread last and yet the child wins — and two of the reader's branches drop an entire file's Angular options without any error naming them"
sidebar_label: "04b · Reading the merge"
sidebar_position: 4.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/perform_compile.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/perform_compile.ts),
> read through the GitHub contents API at that tag; and angular.dev
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[04](04-angularcompileroptions-and-how-it-inherits.md) established that Angular merges
`angularCompilerOptions` itself. This page is how to read that merge without getting it backwards.**
The spread that decides precedence looks like parent-wins and is child-wins; array `extends`
resolves right-to-left through a hand-written `reverse()`; an empty object does not clear anything;
and two branches of the reader return early, dropping a whole file's Angular options while the only
error you see is about something else entirely. Every one of those is a line of source, quoted
below.

## Why the child wins even though `parentOptions` is spread last

This is the single most misread line in the Angular tsconfig machinery:

```ts
      let existingNgCompilerOptions = {...angularCompilerOptions, ...parentOptions};
```

A later spread overwrites an earlier one, so `parentOptions` wins — which would mean *parent beats
child*. It does not, because **`parentOptions` is an accumulator threaded downward through the
recursion**, and by the time the walk reaches a base config, that accumulator holds the
**descendant's** values.

Trace a two-file workspace where `tsconfig.app.json` has `"extends": "./tsconfig.json"`:

| Step | Call | `angularCompilerOptions` in the file | `parentOptions` | Accumulator after the spread |
|---|---|---|---|---|
| 1 | `readAngularCompilerOptions('tsconfig.app.json')` | `appOwn` | `{}` (the default) | `appOwn` |
| 2 | recurses: `readAngularCompilerOptions('tsconfig.json', appOwn)` | `rootOwn` | `appOwn` | `{...rootOwn, ...appOwn}` |
| 3 | no `extends` on the root, so it returns | — | — | `{...rootOwn, ...appOwn}` |

At step 2 the leaf's object is the one spread **last**. The identifier is named for the *call
site's* relationship — "the options my caller already resolved" — not for the config hierarchy's.
Read it that way and the direction stops fighting you.

The rule worth memorising: **a key set anywhere down the chain beats the same key set anywhere up
it**, and an intermediate file that does not mention a key is completely transparent to it.

## An empty object does not reset inheritance

```jsonc
// tsconfig.app.json
{
  "extends": "./tsconfig.json",
  "angularCompilerOptions": {}
}
```

`{...rootOwn, ...{}}` is `rootOwn`. Writing an empty object is not a way to start clean — the
parent's values pass straight through. There is no "unset" spelling in this format; to change an
inherited option you must write the value you want.

## `extends` may be an array, and Angular honours it

TypeScript accepts an array for `extends`, and Angular's reader normalises for it:

```ts
      const extendsPaths: string[] =
        typeof config.extends === 'string' ? [config.extends] : config.extends;
```

then reduces over the reversed list, with its own comment:

> *"Reverse the array so the overrides happen from right to left."*

So in `"extends": ["./a.json", "./b.json"]`, `b.json` beats `a.json` — the same direction
TypeScript uses for `compilerOptions`, reproduced by hand for `angularCompilerOptions`. 🔴 Remember
this when you get to [04c](04c-what-the-shallow-merge-costs.md): the *other* implementation of this
merge inside Angular has no array branch at all.

## The `bazelOptions` back door, and why `??` matters

```ts
      const angularCompilerOptions =
        config.angularCompilerOptions ?? config.bazelOptions?.angularCompilerOptions;
```

with the comment above it:

> *"Note: In Google, `angularCompilerOptions` are stored in `bazelOptions`. This function typically
> doesn't run for actual Angular compilations, but tooling like Tsurge, or schematics may leverage
> this helper, so we account for this here."*

The operator is `??`, not `||`. An `angularCompilerOptions` that is present but empty — `{}` — is
not nullish, so it **wins over** any `bazelOptions` copy in the same file. That is irrelevant to an
application workspace and it is the reason the line reads the way it does; a page that quotes the
line without the operator has quoted the wrong half.

## Two ways a file in the chain contributes nothing, silently

Both are visible in the reader, and neither produces an error that mentions
`angularCompilerOptions`.

**A config that will not parse.** `readConfigFile` returns an `error`, and the reader bails to what
it already had:

```ts
      if (error) {
        // Errors are handled later on by 'parseJsonConfigFileContent'
        return parentOptions;
      }
```

You do get an error — a syntax diagnostic, from the *other* parse — but it names the JSON problem,
not the fact that a whole `angularCompilerOptions` block was skipped. Two symptoms, one cause, one
message.

**An `extends` path that does not resolve.** `getExtendedConfigPath` returning `null`
short-circuits that arm of the reduce:

```ts
        return extendedConfigPath === null
          ? prevOptions
          : readAngularCompilerOptions(extendedConfigPath, prevOptions);
```

The accumulated options continue unchanged, and whatever that file was going to contribute is gone.
Note that this is the Angular half only; TypeScript's own resolution of the same `extends` is a
separate code path with its own diagnostics.

## Gotchas

**★ Symptom: you read `{...angularCompilerOptions, ...parentOptions}`, conclude the parent wins, and
design a shared base config around that.** Cause: `parentOptions` is the caller's accumulator, not
the extended file's options — the recursion passes descendant values *down*. Fix: put defaults in
the base and overrides in the leaf, which is the ordinary direction and the one the CLI's generated
workspace already assumes:

```jsonc
// tsconfig.json (base)       →  { "angularCompilerOptions": { "strictTemplates": true } }
// tsconfig.app.json (leaf)   →  { "angularCompilerOptions": { "strictTemplates": false } }
// resolved for the app build →  strictTemplates: false
```

**★ Symptom: an `extends` path typo costs you every Angular option in the extended file, and the
error you get is about something else.** Cause: `getExtendedConfigPath(...) === null` returns
`prevOptions` and the reduce moves on without contributing. Fix: resolve the path against the
config file's *own* directory and keep the `./` prefix, which is exactly what the CLI generates:

```jsonc
{
  "extends": "./tsconfig.json"
}
```

**Symptom: a JSON syntax error in a base config produces a diagnostic about a comma, and separately
your strictness settings revert to their defaults.** Cause: `if (error) return parentOptions;` — the
Angular reader gives up on that file quietly and lets TypeScript's parse report the syntax. Fix: fix
the syntax; there is no second error to chase, and the options come back on their own.

**Symptom: with `"extends": ["./base.json", "./overrides.json"]` you expected `base.json` to win.**
Cause: the reduce runs over `[...extendsPaths].reverse()` so that, per the source comment, *"the
overrides happen from right to left"* — the last entry is the strongest. Fix: order the array
weakest-first:

```jsonc
{
  "extends": ["./tsconfig.base.json", "./tsconfig.strict.json"]
}
```

**Symptom: you added `"angularCompilerOptions": {}` to a leaf expecting to clear inherited Angular
options.** Cause: spreading an empty object changes nothing. Fix: write the value explicitly —
there is no delete:

```jsonc
{
  "extends": "./tsconfig.json",
  "angularCompilerOptions": {
    "strictInputAccessModifiers": false
  }
}
```

**Symptom: you removed a strictness key from `tsconfig.app.json` and the behaviour did not change.**
Cause: removing a key does not disable an option; it hands the decision to whatever is up the
chain, and failing that to the compiler's own default — which for `strictTemplates` in v22 is *on*.
Fix: decide whether you want the default or an explicit value, and if the latter, write it:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**Symptom: in a Bazel-style config, an `angularCompilerOptions: {}` left behind silently overrides a
populated `bazelOptions.angularCompilerOptions`.** Cause: `??` falls through only for `null` and
`undefined`, and `{}` is neither. Fix: delete the empty key rather than leaving it in place.

**Symptom: a three-level chain behaves as if the middle file did not exist.** Cause: it did not, for
that key — a file that does not mention an option contributes nothing to it, and the accumulator
carries the leaf's value past it unchanged. Fix: this is working as designed; if you meant the
middle file to pin the value, write it there and accept that a leaf can still override it.

## Interview questions

**★ In `{...angularCompilerOptions, ...parentOptions}` the parent is spread last. Why does the child
still win?**
Because `parentOptions` is not the extended file's options — it is an accumulator threaded downward
through the recursion. The walk starts at the file you named with `parentOptions = {}`, computes
that file's own options, and then calls itself on the *extended* file, passing the
already-accumulated descendant values as `parentOptions`. By the time the base config is being read,
`parentOptions` holds the leaf's values, and spreading it last makes the leaf win. The identifier
describes the call site's relationship, not the config hierarchy's — which is why quoting the line
without the explanation teaches the inverse of the truth.

**★ What happens to `angularCompilerOptions` if a file in the `extends` chain has a syntax error, or
if its path does not resolve?**
Either way that file contributes nothing and the walk continues. For a parse failure the reader
returns the options it already has — `if (error) return parentOptions;`, with the comment *"Errors
are handled later on by 'parseJsonConfigFileContent'"*. For an unresolvable path, the reduce arm
returns `prevOptions` unchanged. In the first case you will see a syntax diagnostic from
TypeScript's separate parse; in neither case will anything tell you that an `angularCompilerOptions`
block was dropped.

**Does `extends` support an array here, and in which direction do the entries apply?**
Yes. The reader normalises a string to a one-element array and reduces over
`[...extendsPaths].reverse()`, with the comment *"Reverse the array so the overrides happen from
right to left."* The last entry in the array is the strongest — the same direction TypeScript uses
for `compilerOptions`, reproduced by hand for the Angular key.

**How do you turn an inherited Angular option off?**
By writing the value you want in a file further down the chain. There is no way to remove an
inherited key: an empty `angularCompilerOptions: {}` spreads to nothing, and deleting a key simply
falls back to the ancestor's value or, if no ancestor sets it, to the compiler's own default. In
v22 that last step is where people get caught, because several of those defaults are now `true`.

**Why does the source use `??` rather than `||` when falling back to `bazelOptions`?**
So that only `null` or `undefined` triggers the fallback. A present-but-empty
`angularCompilerOptions` object is a deliberate statement — "this file has an Angular options
block" — and `??` preserves it, where `||` would treat it as absent only if it were falsy, which an
object never is. In practice the operator choice matters for a config that carries both keys, which
is a Google-internal arrangement rather than an application one.

## Where this goes next

The reader above merges with **one spread level**, and that is not a detail — it decides what
happens to `extendedDiagnostics`, the only nested object in the public surface:
[04c · What the shallow merge costs](04c-what-the-shallow-merge-costs.md). The second, divergent
implementation of the same walk — the one that rewrites your tsconfig on upgrade — is
[04d · The second implementation](04d-the-second-implementation.md).

{/* FOOTER */}
