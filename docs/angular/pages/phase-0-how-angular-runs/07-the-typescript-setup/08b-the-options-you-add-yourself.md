---
title: "Four angularCompilerOptions nobody generates for you — host-binding checks that stay on when you opt out of strict templates, a standalone gate that is silent unless you spell it exactly right, a version check whose documented sentence has two halves people read as one, and a TypeScript option Angular refuses outright"
sidebar_label: "08b · The options you add yourself"
sidebar_position: 8.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> (`strictStandalone`, quoted verbatim),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (the `typeCheckHostBindings` default and the `emitDeclarationOnly` message) — and angular.dev
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured
> from a terminal; the error text below is quoted from the source that constructs it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[08](08-the-other-angular-compiler-options.md) covered the three keys `ng new` writes. These are the
ones it does not.** None of them behaves the way the neighbouring options do: one defaults *on* using a
different idiom from every flag around it, one defaults off despite reading like a strictness flag,
one has a documented sentence whose second half is the important one, and one is a TypeScript option
the Angular compiler refuses rather than accommodates. `extendedDiagnostics`, the largest of the
options you add yourself, has its own page — [08c](08c-configuring-extended-diagnostics.md).

## `typeCheckHostBindings` — on by default, and not governed by `strictTemplates`

angular.dev states the value plainly:

> *"When `true`, enables type checking of expressions in the `host` object literal and
> `@HostBinding`/`@HostListener` decorators of components and directives. Default is `true`."*

The default lives in the implementation rather than the JSDoc:

```ts
    const typeCheckHostBindings = this.options.typeCheckHostBindings ?? true;
```

🔴 **`?? true`, not `!== false`, and it is resolved independently of `strictTemplates`.** So a project
that opted out of strict templates entirely is *still* type-checking its `host` expressions and
`@HostListener` arguments. That surprises people twice — once when host-binding errors survive an
opt-out that was supposed to make the build quiet, and once when they cannot find the option on the
template-typecheck guide, because it is documented only on the compiler-options reference page.

Note the two idioms sitting in the same file: `?? true` here, `!== false` for `strictTemplates`
([07c](07c-the-escape-hatches-are-ranked.md)), and `!== undefined` for every individual strictness flag
([06c](06c-the-override-layer.md)). Three default-resolution idioms in one file; they agree on `null`
and disagree on nothing an application can express in JSON, but they are different code and a reader
tracing one should not assume the others.
[14f](../01-compiler-with-a-framework-attached/14f-what-stricttemplates-actually-switches.md)
covers what host-binding checking newly rejects.

```json
// Only if you really want it off. There is rarely a good reason.
{
  "angularCompilerOptions": {
    "typeCheckHostBindings": false
  }
}
```

## `strictStandalone` — off unless you write it, and silent if you misspell it

Verbatim from `DiagnosticOptions`:

```ts
  /**
   * If enabled, non-standalone declarations are prohibited and result in build errors.
   */
  strictStandalone?: boolean;
```

angular.dev: *"When `true`, reports an error if a component, directive, or pipe is not standalone."*
The compiler reads it as `!!this.options.strictStandalone`, so it is **`false` unless explicitly
set** — there is no default-on behaviour to discover, and no diagnostic if the key never arrives.

This is the option that turns "we are migrating to standalone" from a convention into a build gate.
Since the schematics generate standalone declarables by default, in practice it catches
copied-from-an-old-answer code and half-finished migrations rather than new work. What standalone
means, and where an `NgModule` still legitimately appears, is
[topic 02](../02-standalone-by-default/README.md).

```json
{
  "angularCompilerOptions": {
    "strictStandalone": true
  }
}
```

## `disableTypeScriptVersionCheck` — read the sentence twice

angular.dev:

> *"When `true`, the compiler does not look at the TypeScript version and does not report an error
> when an unsupported version of TypeScript is used."*

**It does not *look*, and it does not *report*.** Those are two clauses and people read them as one.
It does not make an unsupported TypeScript work — it stops the compiler telling you which problem you
have, which converts one precise failure into an unbounded set of imprecise ones. The pin it silences,
the second install-time mechanism enforcing the same range, and why the range is only one minor wide
are [01](01-the-typescript-peer-pin.md), [01b](01b-the-check-inside-the-compiler.md) and
[02](02-why-the-pin-is-one-minor-wide.md).

## The TypeScript option Angular refuses

`emitDeclarationOnly` is rejected at config time with a one-line message, quoted verbatim from the
source that constructs it:

```
TS compiler option "emitDeclarationOnly" is not supported.
```

The reason is structural rather than a matter of taste: Angular's class-defining transformer runs on
the JavaScript emit path, and `emitDeclarationOnly` removes that path — you would get declarations
describing definitions that were never generated.
[13e](../01-compiler-with-a-framework-attached/13e-the-option-surface-and-config-time-diagnostics.md)
walks the transformer split. The point here is narrower: some `compilerOptions` keys are not
"compatible or not with Angular", they are **refused**, and no `angularCompilerOptions` setting
negotiates them.

🔴 **A diagnostic in the 4000s is about your tsconfig, not your code.** The whole `4001`–`4006` block
is `CONFIG_*` — flat-module indexes, the extended-diagnostics compatibility rules, unknown category
labels, unknown check names, and this one. That is worth memorising while reading a build log: the
file named in a 4000-series error is a configuration file, and no amount of editing components changes
the outcome. The enumeration is
[13e](../01-compiler-with-a-framework-attached/13e-the-option-surface-and-config-time-diagnostics.md).

## Gotchas

**★ Symptom: host bindings are type-checked in a project that set `strictTemplates: false`.** Cause:
`typeCheckHostBindings` is a separate option resolved as `?? true`, unaffected by `strictTemplates`.
Fix — only if you truly want it off:

```json
{
  "angularCompilerOptions": {
    "typeCheckHostBindings": false
  }
}
```

The better fix is almost always to fix the `host` expression; a host binding error is a real one.

**★ Symptom: `@HostListener('blur', ['$event.target.value'])` fails after the upgrade and the
template compiles fine.** Cause: the same class of failure as
[07b](07b-the-dollar-event-target-rejection.md) — `Event.target` is `EventTarget | null` — but reached
through host-binding checking, which is a different option. Fix: take the event and narrow in the
method, exactly as in a template handler:

```ts
@HostListener('blur', ['$event'])
onBlur(event: Event): void {
  this.value.set((event.target as HTMLInputElement).value);
}
```

**★ Symptom: `strictStandalone: true` reports nothing on a codebase you know contains `NgModule`
declarables.** Cause: it is read as `!!this.options.strictStandalone`, so a typo in the key name leaves
it `false` and silent — and `angularCompilerOptions` does not validate key names, so a misspelling is
indistinguishable from an option you never wrote. Fix: verify the spelling character by character
against the reference page, then confirm the flag took by checking that a known non-standalone
declarable now errors.

**★ Symptom: `TS compiler option "emitDeclarationOnly" is not supported.`** Cause: `emitDeclarationOnly`
in `compilerOptions`. Angular does not tolerate it. Fix: remove it and let the build emit both outputs —

```json
{
  "compilerOptions": {
    "emitDeclarationOnly": false,
    "declaration": true
  }
}
```

**★ Symptom: you set `disableTypeScriptVersionCheck: true` and now have thousands of unrelated type
errors.** Cause: the check was the guardrail, not the problem. The compiler emits type-check blocks
against TypeScript internals whose shape moved between majors. Fix: delete the flag and pin the version
instead —

```json
{
  "devDependencies": {
    "typescript": "~6.0.2"
  }
}
```

**Symptom: you cannot find `typeCheckHostBindings` anywhere on the template type-checking guide.**
Cause: it is documented only on the compiler-options reference page, and it is not one of the
strictness flags. Fix: read
[Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) as a
separate surface from the template-typecheck guide — the two pages do not cover the same option set,
and this is the option most often missed because of it.

**Symptom: a config error names a tsconfig you did not expect.** Cause: `angular.json` selects the
tsconfig per target, so `ng build` and `ng test` can be reading different files, and the error is about
the one *that* build resolved. Fix: read the target's `tsConfig` option before editing anything —
[06 · 05c](../06-angular-json-anatomy/05c-the-build-target.md) is where it is written.

**Symptom: you added a compiler option and nothing changed, with no error.** Cause: it went into the
wrong object. `angularCompilerOptions` and `compilerOptions` are siblings in one JSON file read by two
different consumers, and neither validates unknown keys in the other's territory. Fix: check which
object the key belongs to on the reference page, and remember that `strictTemplates` and friends are
**never** `compilerOptions` keys.

## Interview questions

**★ Is `typeCheckHostBindings` governed by `strictTemplates`?**
No. It is resolved separately as `this.options.typeCheckHostBindings ?? true` and threaded through its
own call sites, so host bindings are type-checked even in a project that set `strictTemplates: false`.
That is a genuinely useful distinction during an upgrade: a team that took the migration's opt-out
still gets `host` object literals and `@HostBinding`/`@HostListener` expressions checked, which is
usually the first place they discover the opt-out was not total. It is also documented only on the
compiler-options reference page and not on the template-typecheck guide, which is why it surprises
people.

**★ What does a diagnostic in the 4000s tell you?**
That the problem is in your tsconfig, not your code. The whole `4001`–`4006` block is `CONFIG_*`, and
it covers flat-module indexes, the extended-diagnostics compatibility rules, unknown category labels,
unknown check names, and `emitDeclarationOnly`. Recognising the range saves the wrong debugging
session: no component edit clears one of these, and the file to open is whichever tsconfig *that*
target resolved, which is not necessarily the one at the repository root.

**★ What does `disableTypeScriptVersionCheck` actually do, and when is it legitimate?**
It skips the compiler's in-constructor TypeScript version check. Read the documented sentence carefully
— the compiler *"does not look at the TypeScript version and does not report an error"* — because both
halves matter: it does not make an unsupported TypeScript work, it stops the compiler telling you that
it will not. Its legitimate home is a monorepo where the TypeScript version is managed globally by
something outside npm, which is the case the source comments name. In an ordinary application it turns
one clear failure into an unbounded set of obscure ones, because the compiler emits type-check blocks
against TypeScript internals whose shape has moved.

**★ Why would a team set `strictStandalone`, given the schematics already generate standalone code?**
Because generation is not enforcement. New files are standalone; hand-edited files, files copied from
older answers, and half-finished migrations are not, and nothing reports them. The option turns the
convention into a build gate — *"non-standalone declarations are prohibited and result in build
errors"* — which is what you want in the middle of a migration and after it. The catch is that it is
`false` unless written and there is no validation of the key name, so a misspelling gives you a project
that believes it is gated and is not.

**Why does Angular refuse `emitDeclarationOnly` rather than working around it?**
Because the transformer that writes `ɵcmp`, `ɵdir`, `ɵpipe` and `ɵfac` into a class runs on the path
to the JavaScript emit, and `emitDeclarationOnly` removes that path. The declaration transformer would
still run, so the build would produce `.d.ts` files describing definitions that were never generated —
a silently broken package rather than a failed build. Refusing at config time is the honest outcome.
Note that the source states the refusal, not the reasoning; the reasoning is read off the transformer
split in
[13e](../01-compiler-with-a-framework-attached/13e-the-option-surface-and-config-time-diagnostics.md).

**Two objects, one file — what goes in `compilerOptions` and what goes in `angularCompilerOptions`?**
`compilerOptions` is TypeScript's and is parsed and merged by TypeScript. `angularCompilerOptions` is
Angular's; TypeScript does not know the key exists and Angular merges it across `extends` itself. Every
`strict*` template option, `extendedDiagnostics`, `typeCheckHostBindings`, `strictStandalone` and
`disableTypeScriptVersionCheck` are Angular's. `strict`, `target`, `module` and `isolatedModules` are
TypeScript's. Putting one in the other's object produces no error at all in either direction, which is
why the mistake survives so long — see
[04](04-angularcompileroptions-and-how-it-inherits.md) for the merge that makes this true.

{/* FOOTER */}
