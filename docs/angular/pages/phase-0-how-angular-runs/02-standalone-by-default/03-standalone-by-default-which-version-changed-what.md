---
title: "`standalone` is not a flag you set — it is a flag the compiler infers from the version of `@angular/core` it resolves, and knowing exactly which release changed which half of that is the difference between reading v22 code and guessing at it"
sidebar_label: "03 · Which version changed what"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — the
> [v19.0.0 CHANGELOG](https://github.com/angular/angular/blob/19.0.x/CHANGELOG.md) and
> [v20.0.0 CHANGELOG](https://github.com/angular/angular/blob/20.0.x/CHANGELOG.md);
> angular.dev [Using components](https://angular.dev/guide/components) and
> [`strictStandalone`](https://angular.dev/reference/configs/angular-compiler-options);
> the published `@angular/core` **14.3.0**, **15.2.10** and **22.1.5** type definitions;
> `@angular/core` 19.2.25 and 22.1.5 `schematics/migrations.json`; `@angular/compiler-cli`
> 22.1.5 `NgCompiler` construction and `ErrorCode` table. npm release dates from the
> `@angular/core` registry metadata. Documentation-validated; **no sandbox run**.

**Three different populations of Angular developer read the same `@Component` decorator
differently. Someone who learned on v14 expects `standalone: true` and treats its absence as
"this component belongs to a module". Someone who learned on v19 knows the default flipped
but is not sure whether the flag is deprecated. Someone who started on v20 or later has
never typed the word. All three are looking at the same code and reaching different
conclusions, and that is a real source of broken pull requests. This chunk fixes the
timeline to specific releases, then shows the compiler code that actually decides the
value — because the decision is not "v22, therefore standalone", it is "which version of
`@angular/core` does this compilation resolve".**

## The timeline, release by release

| Release | Date | What changed for `standalone` |
|---|---|---|
| **14.0.0** | 2 Jun 2022 | Standalone components, directives and pipes land, plus `bootstrapApplication`, `importProvidersFrom` and route `loadComponent`. The `standalone` field on `@Component`, `@Directive` and `@Pipe` carries `@developerPreview` in the shipped 14.3.0 typings. Default is `false`. |
| **15.0.0** | 16 Nov 2022 | The `@developerPreview` tag is **gone** from all three decorators in the 15.2.10 typings — the API is supported. Default is still `false`; you write `standalone: true` on every class. |
| 15.2.0 | Feb 2023 | Minimum version the official standalone migration schematic supports. |
| **19.0.0** | 19 Nov 2024 | 🔴 **The default flips.** Also: the `explicit-standalone-flag` `ng update` migration, the `strictStandalone` compiler option, and the NG8113 unused-imports diagnostic. |
| **20.0.0** | 28 May 2025 | `@angular/platform-browser-dynamic` deprecated in full; `ngIf` / `ngFor` / `ngSwitch` deprecated in favour of `@if` / `@for` / `@switch`. Nothing about `standalone` itself. |
| **21.0.0** | 19 Nov 2025 | The standalone migration gains `CommonModule` support — it can now replace a `CommonModule` import with the individual directives and pipes actually used. |
| **22.0.0** | 3 Jun 2026 | `createNgModuleRef`, `ComponentFactory` and `ComponentFactoryResolver` removed. `standalone` itself unchanged: still an optional `boolean`, still not deprecated. |

The v19.0.0 breaking-change entry, verbatim and complete — it is three lines and every one
of them matters:

> *"Angular directives, components and pipes are now standalone by default."*
> *"Specify `standalone: false` for declarations that are currently declared in modules."*
> *"`ng update` for v19 will take care of this automatically."*

That third line names a specific migration. It is in `@angular/core@19.2.25`'s
`schematics/migrations.json` under the key `explicit-standalone-flag`, at version 19.0.0,
described as:

> *"Updates non-standalone Directives, Component and Pipes to 'standalone:false' and removes
> 'standalone:true' from those who are standalone"*

**So v19 did both halves in one pass** — it flipped the default *and* stripped the now-redundant
`standalone: true` from every class that had it. This is the answer to "which version removed
the boilerplate": v19.0.0, not v20. v20 changed nothing about `standalone`.

🔴 That migration is **only** in v19. `@angular/core@22.1.5`'s `migrations.json` contains
eight entries and none of them is about standalone. Skip v19 on the way from v18 to v22 and
nothing will ever add `standalone: false` to your module-declared components — which is the
concrete, checkable version of the warning in topic **04 · `ng update`, not `npm install`**
*(not written yet)*.

## How the compiler actually decides

The default is not hard-coded to "v22 behaviour". `NgCompiler` computes it once, per
compilation, from the version of `@angular/core` it resolved:

```ts
// @angular/compiler-cli 22.1.5 — NgCompiler construction (shipped source)
this.implicitStandaloneValue =
  this.angularCoreVersion === null ||
  coreVersionSupportsFeature(this.angularCoreVersion, '>= 19.0.0');
```

`implicitStandaloneValue` is then threaded into `ComponentDecoratorHandler`,
`DirectiveDecoratorHandler` and `PipeDecoratorHandler` as the value to use when the
decorator has no `standalone` key. Read the two branches:

- **`@angular/core` resolves to 19.0.0 or later** → a decorator with no `standalone` key
  compiles as standalone.
- **it resolves to anything older** → the same decorator compiles as *non-standalone*.
- **the version cannot be determined at all** (`null`) → standalone, the modern default.

This is the fix the v19 changelog lists as *"disable standalone by default on older versions
of Angular"*. It exists because the compiler in your workspace may be compiling a library
that resolves an older `@angular/core` — and flipping that library's default under it would
change its meaning. The practical consequence is a gotcha below.

## What `standalone: true` and `standalone: false` mean now

The v22.1.5 type is unchanged from v14 and the documentation comment is one sentence:

```ts
// @angular/core 22.1.5 — Directive and Component metadata
/**
 * Set `standalone` to `false` if you want to import the directive into an NgModule.
 */
standalone?: boolean;
```

- **`standalone: true`** — redundant in v22 and has been since v19. It is **not deprecated**;
  the 22.1.5 typings carry no `@deprecated` tag on the field, and nothing warns about it. It
  is simply noise, and `ng update` to v19 would have removed it for you. Delete it when you
  touch the file.
- **omitted** — standalone. This is what `ng generate component` produces.
- **`standalone: false`** — the legacy-interop opt-out. The class now *must* be declared in
  exactly one `NgModule`, and specifying `imports` or `schemas` on it becomes a compile
  error (NG2010, covered in chunk [05 · Unused imports and the compiler diagnostics](05-unused-imports-and-the-compiler-diagnostics.md)).

angular.dev states the reader-facing consequence directly:

> *"By default, Angular components are standalone, meaning that you can directly add them to
> the `imports` array of other components."*

and, for the other direction:

> *"Any components, directives, or pipes must be explicitly marked as `standalone: false` in
> order to be declared in an NgModule."*

## Forbidding the opt-out: `strictStandalone`

If you want the compiler to refuse `standalone: false` outright, v19 added a flag. From
angular.dev's compiler-options reference:

> *"When `true`, reports an error if a component, directive, or pipe is not standalone."*

```json
// tsconfig.json
{
  "angularCompilerOptions": {
    "strictStandalone": true,
    "strictTemplates": true
  }
}
```

The errors it produces are NG2023, verbatim from `@angular/compiler-cli` 22.1.5:

```text
Only standalone components/directives are allowed when 'strictStandalone' is enabled.
Only standalone pipes are allowed when 'strictStandalone' is enabled.
```

This is the right setting for a greenfield v22 app and the wrong setting for one mid-migration
— it will reject every class the migration has not reached yet.

## Checking at runtime

There is a supported predicate, exported from `@angular/core` since v14:

```ts
import { isStandalone } from '@angular/core';

/**
 * Checks whether a given Component, Directive or Pipe is marked as standalone.
 * Returns false if passed anything other than a Component, Directive, or Pipe class.
 */
if (!isStandalone(SomeLibraryComponent)) {
  throw new Error('SomeLibraryComponent must be imported through its NgModule');
}
```

Useful in a library's own tests, or in a lint-style assertion while migrating a large app.
It reads the `standalone` field off the compiled `ɵcmp` / `ɵdir` / `ɵpipe` definition, so it
reflects what the compiler decided, not what the source file says.

## Gotchas

**★ Symptom: a component with no `standalone` key compiles as non-standalone, and the error
says it is not standalone and cannot be imported directly.** Cause: that file was compiled
against an `@angular/core` older than 19.0.0 — a library in a monorepo pinned to v18, or a
`node_modules` copy hoisted from a dependency that carries its own `@angular/core`. The
compiler's `implicitStandaloneValue` is per-compilation, and it read the old version. Fix:
align the `@angular/core` version the library resolves, or write the flag explicitly in that
package so its meaning does not depend on resolution:

```ts
@Component({
  standalone: true,
  selector: 'lib-badge',
  template: `<span class="badge"><ng-content /></span>`,
})
export class BadgeComponent {}
```

**★ Symptom: you jumped from v18 straight to v22 and every module-declared component now
fails to compile.** Cause: the `explicit-standalone-flag` migration ships **only** in v19.
Jumping over v19 means no pass ever added `standalone: false` to the classes that need it,
and the v22 compiler now infers `true` for all of them. Fix: run the v19 migration
explicitly against your current tree, then move on:

```bash
ng update @angular/core@19 @angular/cli@19
# then, one major at a time
ng update @angular/core@20 @angular/cli@20
ng update @angular/core@21 @angular/cli@21
ng update @angular/core@22 @angular/cli@22
```

**★ Symptom: a code review argument about whether `standalone: true` should be deleted.**
Cause: the field is redundant but not deprecated, so neither the compiler nor the linter has
an opinion and both sides can cite "no warning". Fix: settle it with a rule rather than a
preference — turn on `strictStandalone`, which makes `standalone: false` an error and leaves
`standalone: true` merely redundant, and delete the redundant ones as you touch files. Do not
run a repo-wide reformat for it; it produces a diff nobody can review.

**★ Symptom: a tutorial's `@Component({ standalone: true, imports: [...] })` copies in fine,
but the same author's `@NgModule` example fails.** Cause: the tutorial predates v19. Its
components are explicit, so they still work; its modules assume the classes they declare
default to non-standalone, which stopped being true. Fix: add `standalone: false` to any
class you intend to keep in `declarations`, or — better — stop copying the module.

**Symptom: `standalone: false` on a class that is not in any `NgModule`, and the template
resolves nothing.** Cause: a non-standalone class has no compilation scope of its own; it
inherits one from the module that declares it. With no declaring module there is no scope,
so no directive, component or pipe resolves. Fix: either declare it in a module or make it
standalone and give it an `imports` array.

**Symptom: `strictStandalone: true` and a third-party library breaks the build.** Cause: it
does not. `strictStandalone` is checked by `ngtsc` while compiling *your* source; a library
shipped in partial-compiled form is processed by the linker, not the decorator handlers.
Fix: none needed — but if the "library" is actually a path-mapped source folder in your
workspace, it *is* your source and the flag does apply. Move it to a real build boundary or
mark its classes standalone.

## Interview questions

**★ Which Angular version made components standalone by default, and what exactly did it do?**
19.0.0, released 19 November 2024. It did two things: changed the compiler's implicit value
for the `standalone` field to `true`, and shipped an `ng update` migration
(`explicit-standalone-flag`) that added `standalone: false` to every class still declared in
an `NgModule` and deleted the now-redundant `standalone: true` everywhere else. v14
introduced the feature as developer preview; v15 dropped the developer-preview tag; v20 and
later changed nothing about it.

**★ Is `standalone: true` deprecated in Angular 22?**
No. It is redundant — the compiler infers it — but the field carries no `@deprecated` tag in
the 22.1.5 typings and produces no diagnostic. `standalone: false` is likewise not
deprecated; it is the supported way to keep a class in an `NgModule`. If you want the
compiler to reject it, that is what `strictStandalone` is for.

**★ How does the compiler decide whether an undecorated `standalone` field means true or
false?**
It resolves the version of `@angular/core` for the compilation and asks whether it is
`>= 19.0.0`. If the version cannot be determined, it assumes yes. That check is computed once
per `NgCompiler` and passed to the component, directive and pipe decorator handlers. This is
why the same source file can compile to different meanings in two packages of one monorepo.

**★ What happens if you skip v19 on the way from v18 to v22?**
Every class that was declared in an `NgModule` and relied on the old `false` default silently
becomes standalone, so the modules that declare them fail with NG6008 ("is standalone, and
cannot be declared in an NgModule") and their templates lose their compilation scope. The
migration that would have prevented this only exists in v19's `migrations.json`, so no later
`ng update` can rescue you. The fix is to run v19's update against your v18 tree first.

**Why did Angular need a flag at all, rather than just making everything standalone in v14?**
Because `NgModule` scope and standalone scope are different compilation models and both had to
be legal at once for three years while an ecosystem migrated. The flag is the switch between
"this class gets its template scope from a module" and "this class carries its own". Removing
the flag would have meant a hard break for every published library; changing the default
moved the cost from everyone to the shrinking group still on modules.

**Why is the implicit value read from the resolved `@angular/core` version rather than from
the compiler's own version?**
Because the compiler compiles code that is not necessarily written against it. A library in
the workspace can pin an older `@angular/core`; if the compiler applied its own default, the
meaning of that library's source would change purely because you upgraded the toolchain. Tying
the default to the resolved runtime version keeps a source file's meaning a property of the
package it lives in.

---

← Prev: [The `NgModule` bootstrap it replaced](01b-the-ngmodule-bootstrap-it-replaced.md) · Index: [Topic index](README.md) · Next → [What `imports` actually means](04-what-imports-actually-means.md)
