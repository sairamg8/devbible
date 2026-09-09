---
title: "Two Angular compiler options are resolved outside both the `strictTemplates` branch and the override block, using two further default idioms — so host bindings are type-checked even in a project that opted out of `strictTemplates`, and `strictStandalone` is off unless you write it"
sidebar_label: "06d · The options outside the switch"
sidebar_position: 6.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts) —
> both read through the GitHub contents API at that tag; and angular.dev
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Not every Angular compiler option that shapes type checking goes through the two layers.** Two of
them — `typeCheckHostBindings` and `strictStandalone` — are read directly where they are needed, with
their own default idioms, and neither is affected by `strictTemplates` in either direction. 🔴 The
consequence that matters in a real upgraded project: **host-binding type checking survives a
`strictTemplates: false`.** The consequence that matters in a new one: `strictStandalone` is off
unless you wrote it, and no amount of strictness elsewhere turns it on.

## `typeCheckHostBindings` — no documented default, and the default is `true`

Its declaration in `interface TypeCheckingOptions` in
[`public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
carries a one-line JSDoc and **no default**, unlike every other member of that interface:

```ts
  /** Whether type checking of host bindings is enabled. */
  typeCheckHostBindings?: boolean;
```

The default lives in the implementation, in `compiler.ts`:

```ts
    const typeCheckHostBindings = this.options.typeCheckHostBindings ?? true;
```

angular.dev supplies the missing sentence on
[Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options):

> *"When `true`, enables type checking of expressions in the `host` object literal and
> `@HostBinding`/`@HostListener` decorators of components and directives. Default is `true`."*

That variable is then threaded into three call sites, alongside `!!this.options.strictStandalone` —
it never touches the `TypeCheckingConfig` the two layers build. So:

```jsonc
// An upgraded project. Templates are unchecked; host bindings are NOT.
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

```jsonc
// The only way to switch host-binding checking off.
{
  "angularCompilerOptions": {
    "typeCheckHostBindings": false
  }
}
```

## `strictStandalone` — a different interface, and off by default

It is not even in `TypeCheckingOptions`; it lives in `interface DiagnosticOptions`, next to
`extendedDiagnostics`:

```ts
  /**
   * If enabled, non-standalone declarations are prohibited and result in build errors.
   */
  strictStandalone?: boolean;
```

No documented default, and the implementation resolves it with a third idiom:

```ts
        !!this.options.strictStandalone,
```

`!!undefined` is `false`, so **an absent `strictStandalone` is off** — the opposite of
`typeCheckHostBindings`, whose absence is on. Two options, two idioms, opposite outcomes for the
same absence:

```jsonc
{
  "angularCompilerOptions": {
    "strictStandalone": true
  }
}
```

## Three default idioms in one file

| Option | Idiom in `compiler.ts` | Absent | Explicit `null` |
|---|---|---|---|
| `strictTemplates` | `this.options.strictTemplates !== false` | **on** | **on** |
| `typeCheckHostBindings` | `this.options.typeCheckHostBindings ?? true` | **on** | **on** |
| `strictStandalone` | `!!this.options.strictStandalone` | **off** | **off** |

🔴 The three agree on nothing except that they are all resolved in the same file, by hand, per
option. There is no framework-wide rule that an absent Angular compiler option means "off" or
"take the strict path" — the answer is per option, and the only reliable source for it is the line
that reads it. That is the single most portable lesson of this whole chunk group: **for any Angular
compiler option, find the read, not the documentation.**

## Gotchas

**★ Symptom: host bindings are type-checked in a project that opted out of `strictTemplates`, and
you cannot find what enabled them.** Cause: `typeCheckHostBindings` is resolved as `?? true`,
outside both the strict/non-strict branch and the override block. Fix, if you genuinely want it off:

```jsonc
{
  "angularCompilerOptions": {
    "typeCheckHostBindings": false
  }
}
```

**★ Symptom: you enabled every strictness option you could find and non-standalone declarations
still compile.** Cause: `strictStandalone` is read as `!!this.options.strictStandalone`, so an
absent value is `false` and no other option implies it. Fix: write it:

```jsonc
{
  "angularCompilerOptions": {
    "strictStandalone": true
  }
}
```

**★ Symptom: you reasoned "Angular compiler options default to strict in v22" and got two of them
wrong.** Cause: there is no such rule — three options in the same file use three different idioms,
and one of them (`strictStandalone`) defaults off. Fix: check the read for the option in question
rather than generalising; the table above is the list for these three:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "typeCheckHostBindings": true,
    "strictStandalone": true
  }
}
```

**Symptom: `typeCheckHostBindings` is not documented with a default in the type, so you assumed it
was `false`.** Cause: it is the only member of `TypeCheckingOptions` whose JSDoc omits a default;
the value is in the implementation and on angular.dev, which states *"Default is `true`."* Fix: when
a JSDoc default is missing, read the resolution line — an omitted default in a doc comment is not a
default of `false`.

**Symptom: a project sets `"typeCheckHostBindings": null` expecting to disable it.** Cause: `??`
falls through for `null`, so the result is `true`. Fix: write the boolean:

```jsonc
{
  "angularCompilerOptions": {
    "typeCheckHostBindings": false
  }
}
```

**Symptom: `strictStandalone` errors appear in an application that has always been standalone.**
Cause: the option prohibits non-standalone declarations outright — per its JSDoc, *"non-standalone
declarations are prohibited and result in build errors"* — so a single legacy declaration anywhere
in the compilation fails the build. Fix: that is the intent; migrate the declaration, or scope the
option to the projects that are ready for it, remembering that `angularCompilerOptions` inherits
through `extends` ([04](04-angularcompileroptions-and-how-it-inherits.md)).

**Symptom: you looked for `strictStandalone` in the template-strictness list and did not find it.**
Cause: it is declared in `DiagnosticOptions`, not `TypeCheckingOptions` — a different interface in
the same file. Fix: search the whole options module rather than one interface; the split between
those interfaces is about how the compiler groups them internally, not about what a tsconfig may
contain.

## Interview questions

**★ Is `typeCheckHostBindings` governed by `strictTemplates`?**
No. It is resolved separately as `this.options.typeCheckHostBindings ?? true`, outside both the
strict/non-strict branch and the override block, and threaded into its own call sites. So host
bindings and `@HostBinding`/`@HostListener` expressions are type-checked even in a project that set
`strictTemplates: false` — which is genuinely useful to know about an upgraded project carrying the
v22 migration's opt-out, because it means one class of checking survived the opt-out entirely.

**★ What is the default of an Angular compiler option you have never seen before?**
Unknowable without reading the line that reads it. Three options in `compiler.ts` use three
different idioms — `!== false` for `strictTemplates`, `?? true` for `typeCheckHostBindings`, `!!` for
`strictStandalone` — and they disagree about what an absent value means. There is no framework-wide
convention to fall back on, and the JSDoc does not always carry a default: `typeCheckHostBindings`
has none, and angular.dev supplies it instead. The habit worth forming is *find the read*.

**★ Why does `strictStandalone` default to off when v22's direction of travel is towards strict
defaults?**
The sources read here do not say. What they establish is the mechanism — `!!this.options.strictStandalone`
makes an absent value `false` — and the semantics from the JSDoc: *"If enabled, non-standalone
declarations are prohibited and result in build errors."* A reasonable reading is that an option
which fails the build on a legacy declaration is a harder migration than one that adds type errors
to templates, but that is an inference and not something a source stated; it should be offered as
such rather than asserted.

**Where would you look to decide whether an option affects your build?**
The read site in `compiler.ts`, in this order: is it in the `if (strictTemplates)` branch, is it in
the `!== undefined` override block, or is it read directly somewhere else? Those three locations
have different implications — the first means `strictTemplates` decides it, the second means your
key overrides a baseline, and the third means the option stands alone and no amount of strictness
elsewhere reaches it.

**A team wants a single tsconfig that documents its full type-checking posture. Which options must
they write out explicitly?**
At minimum the ones whose absence does not mean what a reader would guess: `strictStandalone`
(absent means off), `typeCheckHostBindings` (absent means on, with no documented default in the
type), `strictInputAccessModifiers` (absent means off even under `strictTemplates`), and
`strictTemplates` itself (absent means on since v22). Those four carry the surprises; the remaining
flags follow the baseline predictably and can reasonably be left absent.

---

← Prev: [The override layer](06c-the-override-layer.md) · Index: [Topic index](README.md) · Next → [What strictTemplates rejects](07-what-stricttemplates-rejects.md)
