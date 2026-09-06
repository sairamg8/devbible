---
title: "`NgModule` is not deprecated in Angular 22 — but every first-party Angular module now declares nothing, which means the modules you still import are bundles and provider carriers rather than compilation scopes"
sidebar_label: "11 · Where `NgModule` still legitimately appears"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and `angular/angular`
> at tag `v22.1.5`: [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md),
> [`goldens/public-api/common/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/common/index.api.md),
> [`goldens/public-api/router/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/router/index.api.md),
> [`goldens/public-api/platform-browser/testing/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser/testing/index.api.md),
> [`goldens/public-api/upgrade/static/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/upgrade/static/index.api.md);
> and the published `@angular/material` **22.1.5** `types/button.d.ts`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every previous chunk in this topic argued that you should not write an `NgModule`. This one
is the honest counterweight, and it starts with the fact people get backwards: `NgModule` is
not deprecated in Angular 22. The Angular team *recommends against it for new code*, which is
a far narrower claim than "removed", and confusing the two produces two opposite failure
modes — one developer rips a working `MatButtonModule` out of a build because "it's
deprecated", another reaches for a new module the moment two components share a directive.
The fact that settles the argument is mechanical and you can read it off a `.d.ts`: at
22.1.5 the `Declarations` slot of `RouterModule`, `CommonModule`, `MatButtonModule`,
`BrowserTestingModule` and `UpgradeModule` is `never`. Not one of them declares anything.
A module you still import in 2026 is a re-export bundle or a provider carrier, and neither of
those is a compilation scope.**

## "Recommends against" is not "deprecates" — and both halves matter

angular.dev's `NgModule` guide opens with a banner, verbatim:

> *"IMPORTANT: The Angular team recommends using [standalone components](https://angular.dev/guide/components) instead of `NgModule` for all new code. Use this guide to understand existing code built with `@NgModule`."*

and repeats the same shape for bootstrapping, verbatim:

> *"IMPORTANT: The Angular team recommends using [bootstrapApplication](https://angular.dev/api/platform-browser/bootstrapApplication) instead of `bootstrapModule` for all new code. Use this guide to understand existing applications bootstrapped with `@NgModule`."*

🔴 **Now read the typings.** In `goldens/public-api/core/index.api.md` at `v22.1.5`, the
`NgModule` interface carries no `@deprecated` marker at all — every field is still public:

```ts
// @public
export interface NgModule {
    bootstrap?: Array<Type<any> | any[]>;
    declarations?: Array<Type<any> | any[]>;
    exports?: Array<Type<any> | any[]>;
    id?: string;
    imports?: Array<Type<any> | ModuleWithProviders<{}> | any[]>;
    jit?: true;
    providers?: Array<Provider | EnvironmentProviders>;
    schemas?: Array<SchemaMetadata | any[]>;
}
```

The same golden leaves `PlatformRef.bootstrapModule` undeprecated while marking
`bootstrapModuleFactory` `@deprecated` right beside it — so even the module *bootstrap* path
is supported, and only its factory-based sibling is not. **`ng update` will not migrate your
modules away, and no release note has scheduled their removal.** Anyone who tells you
`@NgModule` is deprecated in v22 is reading a recommendation and reporting a removal.

The four places a module legitimately survives:

| # | Kind | Example at 22.1.5 | Do you write it? |
|---|---|---|---|
| 1 | **A bundle** — a library re-exporting standalone classes for import convenience | `MatButtonModule`, `CommonModule`, `RouterModule` | No — you import from it |
| 2 | **A provider carrier** — a `ModuleWithProviders` you reach for its `providers` | `RouterModule.forRoot(routes)` | No — prefer the `provide*` function |
| 3 | **A framework internal you never wrote** | `DynamicTestModule`, `BrowserTestingModule`, `ApplicationModule` | Never |
| 4 | **Code nobody has migrated yet** | your `app.module.ts` from 2021 | It is already written |

**If a module in a 2026 codebase is none of the first three, it is the fourth and nobody has
noticed.** Category 4 has a schematic — the **standalone migration schematic** *(not written
yet)* is the chunk that runs it. This page owns category 1; categories 2 and 3 are each large
enough to own a page of their own, and they follow.

## Every first-party Angular module at 22.1.5 declares nothing

This is the fact that makes the whole category readable, and it is one type argument.
A compiled module's shape is `ɵɵNgModuleDeclaration<T, Declarations, Imports, Exports>`, and
the second slot is what the module *owns*. Read it in the goldens at `v22.1.5`:

```ts
// packages/router — @public
static ɵmod: i0.ɵɵNgModuleDeclaration<RouterModule, never,
  [typeof RouterOutlet, typeof RouterLink, typeof RouterLinkActive, typeof ɵEmptyOutletComponent],
  [typeof RouterOutlet, typeof RouterLink, typeof RouterLinkActive, typeof ɵEmptyOutletComponent]>;
```

```ts
// packages/common — @public, truncated to the first four of its twenty-four entries,
// which appear identically in both the Imports and Exports slots
static ɵmod: i0.ɵɵNgModuleDeclaration<CommonModule, never,
  [typeof NgClass, typeof NgComponentOutlet, typeof NgForOf, typeof NgIf /* … 20 more */],
  [typeof NgClass, typeof NgComponentOutlet, typeof NgForOf, typeof NgIf /* … 20 more */]>;
```

```ts
// packages/platform-browser/testing — @public
static ɵmod: i0.ɵɵNgModuleDeclaration<BrowserTestingModule, never, never, [typeof BrowserModule]>;
```

```ts
// packages/upgrade/static — @public
static ɵmod: i0.ɵɵNgModuleDeclaration<UpgradeModule, never, never, never>;
```

🔴 **`never`, `never`, `never`, `never`.** `RouterModule` does not declare `RouterOutlet`; it
imports and re-exports it, because `RouterOutlet` is standalone and owns itself.
`CommonModule` does not declare `NgIf`. `UpgradeModule` declares nothing at all and is pure
providers. The pattern holds outside the framework too — from the published
`@angular/material@22.1.5` `types/button.d.ts`, which is a **type declaration and therefore
source, not compiler output**:

```ts
declare class MatButtonModule {
    static ɵfac: i0.ɵɵFactoryDeclaration<MatButtonModule, never>;
    static ɵmod: i0.ɵɵNgModuleDeclaration<MatButtonModule, never,
      [typeof MatRippleModule, typeof MatButton, typeof MatMiniFabButton, typeof MatIconButton, typeof MatFabButton],
      [typeof i2.BidiModule, typeof MatButton, typeof MatMiniFabButton, typeof MatIconButton, typeof MatFabButton]>;
    static ɵinj: i0.ɵɵInjectorDeclaration<MatButtonModule>;
}
```

and `MatButton`'s own declaration confirms the other half — the second-to-last type argument
of `ɵɵComponentDeclaration` is the standalone flag, and it is `true`:

```ts
static ɵcmp: i0.ɵɵComponentDeclaration<MatButton, "button[matButton], a[matButton], …",
  ["matButton", "matAnchor"], { "appearance": { "alias": "matButton"; "required": false; }; },
  {}, never, [ /* ngContentSelectors */ ], true, never>;
```

⚠️ **Do not generalise this to "libraries" in general.** Only `@angular/material` 22.1.5 and
the first-party goldens above were read here. Whether a given third-party package ships
standalone classes behind its module, or still ships real `declarations`, is a question you
answer by opening its `.d.ts` — not by assumption.

## Importing the class instead of the bundle

Both of these compile, and they are not equally maintainable:

```ts
// invoice-actions.ts — the module import: convenient, and permanently opaque
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-invoice-actions',
  imports: [MatButtonModule],
  template: `<button matButton type="button" (click)="send()">Send invoice</button>`,
})
export class InvoiceActions {
  sent = false;

  send(): void {
    this.sent = true;
  }
}
```

```ts
// invoice-actions.ts — the class import: identical behaviour, and NG8113 can police it
import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-invoice-actions',
  imports: [MatButton],
  template: `<button matButton type="button" (click)="send()">Send invoice</button>`,
})
export class InvoiceActions {
  sent = false;

  send(): void {
    this.sent = true;
  }
}
```

**The difference is diagnosability, not output.** The unused-standalone-imports diagnostic can
tell you that `MatButton` went stale the day you delete the last button; it can never tell
you that about `MatButtonModule`, because a module whose exports are *partly* used is, to the
compiler, used. The [unused-imports chunk](05-unused-imports-and-the-compiler-diagnostics.md) owns the rule itself. Prefer
the class import for anything you can name, and keep the module import only for a library
whose surface you genuinely consume wholesale.

## Gotchas

**★ Symptom: a reviewer says "`NgModule` is deprecated, delete `MatButtonModule`".** Cause:
the angular.dev banner says *recommends against for new code*, and that has been repeated
online as a deprecation. Fix: check the marker yourself before acting — at 22.1.5 the golden
line above `NgModule` is `// @public`, not `// @public @deprecated`. Compare a genuinely
deprecated neighbour in the same file, which reads:

```ts
// @public @deprecated
export abstract class NgModuleFactory<T> {
    abstract create(parentInjector: Injector | null): NgModuleRef<T>;
    abstract get moduleType(): Type<T>;
}
```

**★ Symptom: you delete the last `<button matButton>` from a template and no diagnostic
fires, so `MatButtonModule` sits in `imports` forever.** Cause: the unused-standalone-imports
rule asks whether an entry contributed *anything* the template used; a module whose exports
are partly used is used, so it is never flagged. Fix: import the classes, so the diagnostic
has something to police —

```ts
// before — one entry that is never flagged
imports: [MatButtonModule],

// after — three entries, each individually flagged when it goes stale
imports: [MatButton, MatIcon, MatTooltip],
```

**★ Symptom: a library upgrade turns an unchanged `imports: [SomeLibModule]` line into a
compile error naming a class you have never referenced.** Cause: the module re-exports other
modules transitively, so its exported surface changed underneath a single entry of yours. Fix:
pin what you actually use, so a future break names your own line and not the library's:

```ts
// the transitive surface of a bundle is not your API contract
imports: [MatButton, MatIcon],
```

**★ Symptom: you cannot tell whether a third-party module in `imports` is a bundle or a real
compilation scope.** Cause: nothing in the `import` statement distinguishes them. Fix: open
the package's `.d.ts` and read the second type argument of `ɵɵNgModuleDeclaration` — `never`
means it declares nothing and is a bundle you can bypass; a tuple of classes means it owns
real `declarations`, those classes are not standalone, and the module import is load-bearing:

```ts
// a bundle — safe to bypass
static ɵmod: i0.ɵɵNgModuleDeclaration<MatButtonModule, never, [/* imports */], [/* exports */]>;

// a real scope — the module import is doing work
static ɵmod: i0.ɵɵNgModuleDeclaration<LegacyChartsModule, [typeof ChartHost], [/* imports */], [typeof ChartHost]>;
```

**★ Symptom: `imports: [CommonModule]` is added "to be safe" and NG8113 never complains.**
Cause: `CommonModule` re-exports twenty-four symbols, so almost any template uses at least
one — a single `| date` keeps the whole bundle looking used. Fix: import the one or two
symbols the template actually names; the [`CommonModule` anti-fix chunk](06e-the-commonmodule-anti-fix.md)
argues the case in full, but the mechanical version is one line:

```ts
// before
imports: [CommonModule],

// after
imports: [DatePipe, AsyncPipe],
```

## Interview questions

**★ Is `@NgModule` deprecated in Angular 22?**
No. angular.dev *recommends against it for new code* — *"The Angular team recommends using
standalone components instead of `NgModule` for all new code"* — but the v22.1.5 public-API
golden marks the `NgModule` interface `// @public`, with no `@deprecated` tag on the decorator
or on any of its eight fields, and `PlatformRef.bootstrapModule` is undeprecated beside it.
The things around it that *are* deprecated are `NgModuleFactory`, `getModuleFactory`,
`Compiler`, `CompilerFactory` and `bootstrapModuleFactory` — the ViewEngine-era factory and
JIT surface, not the decorator.

**★ How can you prove, without running anything, that `RouterModule` is no longer a
compilation scope?**
Read its `ɵɵNgModuleDeclaration` in `goldens/public-api/router/index.api.md` at `v22.1.5`.
The type is `<T, Declarations, Imports, Exports>` and the `Declarations` slot is `never`;
`RouterOutlet`, `RouterLink`, `RouterLinkActive` and `ɵEmptyOutletComponent` appear in both
the `Imports` and `Exports` slots instead. A module that declares nothing owns nothing — it
is a list of standalone classes with a name. The same is true of `CommonModule` (twenty-four
re-exports, zero declarations), `MatButtonModule`, `BrowserTestingModule` and `UpgradeModule`.

**★ `imports: [MatButtonModule]` and `imports: [MatButton]` render identically. Why prefer the
second?**
Because the module buys you no scope the class does not already carry — its `Declarations`
slot is `never` — while costing you diagnosability. The unused-standalone-imports rule can
flag `MatButton` the day you delete the last button and can never flag `MatButtonModule`,
because partial use of a bundle's exports counts as use. The class import also stops the
library's transitive re-export surface from being part of your component's contract, so an
upgrade that moves a symbol breaks a line you wrote rather than one you inherited.

**What does it mean that `UpgradeModule` has `never` in all three of its `Declarations`,
`Imports` and `Exports` slots?**
That it contributes nothing whatsoever to any template's compilation scope, and exists purely
as a class with providers and a constructor. It is the cleanest example of the "module as a
bridge" category: you import it to obtain a bootstrap hook and a shared injector, not to make
anything visible to a template. The next chunks cover the two remaining live categories — the
modules the framework builds for your tests, and the imperative and hybrid escape hatches.

---

← Prev: [Incremental compilation and the scope cache](10c-incremental-compilation-and-the-scope-cache.md) · Index: [Topic index](README.md) · Next → [The provider array is the wiring](../03-the-provider-array/README.md)
