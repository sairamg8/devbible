---
title: "Before `imports`, a component had no dependency list of its own — it inherited an ambient scope from whichever NgModule happened to declare it, and that is why moving a file could break a template that had compiled for a year"
sidebar_label: "04d · The ambient scope it replaced"
sidebar_position: 4.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and `angular/angular` at tag `v22.1.5`: [`packages/core/src/render3/deps_tracker/deps_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/deps_tracker/deps_tracker.ts), [`packages/compiler-cli/src/ngtsc/scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The reason `imports` feels like extra typing is that it made a cost visible that used to be
hidden. Under `NgModule`, a component's template scope was *ambient*: the union of everything
its declaring module imported, shared identically by every other class in that module's
`declarations`, and recorded nowhere in the component's own file. That model has one property
`imports` does not — you write the dependency once for a whole folder of components — and
several it does not survive: a component that cannot be read on its own, a template that
breaks when the file moves, a class that may only be declared by one module in the entire
application, and providers that are collected eagerly and apply everywhere. This chunk is the
before picture, in Angular's own words, because you cannot judge the trade `imports` made
without it.**

## The old model, stated by Angular

angular.dev still documents `NgModule` fully — it is not deprecated in v22.1.5 — and its
overview page states the model in four sentences. Verbatim, from
[NgModules overview](https://angular.dev/guide/ngmodules/overview):

> *"The `declarations` property of the `@NgModule` metadata declares the components,
> directives, and pipes that belong to the NgModule."*

> *"Components declared in an NgModule may depend on other components, directives, and pipes.
> Add these dependencies to the `imports` property of the `@NgModule` metadata."*

> *"An NgModule can _export_ its declared components, directives, and pipes such that they're
> available to other components and NgModules."*

> *"When you bootstrap an application from an NgModule, the collected `providers` of this
> module and all of the `providers` of its `imports` are eagerly loaded and available to
> inject for the entire application."*

Read those in order and the shape is clear. `declarations` is *membership*: which classes this
module owns. `NgModule.imports` is *scope*, granted to all of them at once. `exports` is
*publication*. And `providers` is not scoped to anything — it is collected and applied
application-wide.

```ts
// src/app/orders/orders.module.ts — the "before" picture, still legal in v22
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {OrderListComponent} from './order-list.component';
import {OrderRowComponent} from './order-row.component';
import {CurrencyBadgeComponent} from './currency-badge.component';

@NgModule({
  declarations: [OrderListComponent, OrderRowComponent, CurrencyBadgeComponent],
  imports: [CommonModule, RouterModule, MatButtonModule],
  exports: [OrderListComponent],
})
export class OrdersModule {}
```

All three declared components may use `routerLink`, `mat-button` and each other, and none of
their three files says so. `OrderRowComponent` could be deleted tomorrow and `OrdersModule`
would not change. Add a fourth component to `declarations` and it silently acquires the same
three dependencies, used or not.

🔴 **One class, one module.** angular.dev, verbatim: *"If Angular discovers any components,
directives, or pipes declared in more than one NgModule, it reports an error."* That single
rule is the origin of the `SharedModule` pattern — if a directive can only be declared once,
every consumer has to reach it through a module that exports it, which is why large
`NgModule` applications grew a module whose only job was re-export. A standalone class has no
such constraint: it is imported by as many components as need it, and by none that do not.

## The failure mode that argument was really about

The scope was ambient, so nothing in a component's own file recorded which of those things it
actually used. That produces one specific bug, and everyone who worked in that era has hit it:

1. `OrderRowComponent` uses `routerLink` and compiles inside `OrdersModule`, because
   `OrdersModule` imports `RouterModule`.
2. A year later someone moves the file into `AdminModule` for reuse, and updates the two
   `declarations` arrays.
3. The template immediately reports `routerLink` as an unknown property — because the
   dependency was never *declared*, only *ambiently available*, and `AdminModule` imports a
   different set.

Nothing in the moved file changed. Nothing in the moved file was ever wrong. The dependency
lived in a different file entirely, and the compiler had no way to tell you which one. The
`imports` array fixes this by construction: the dependency list travels with the class,
because it is written on the class.

## The runtime keeps the same split

The compile-time contrast has an exact runtime twin. `deps_tracker.ts`, at `v22.1.5`, shows
both models in one function:

```ts
if (def.standalone) {
  const scope = this.getStandaloneComponentScope(type, rawImports);
  if (scope.compilation.isPoisoned) {
    return {dependencies: []};
  }
  return {
    dependencies: [
      ...scope.compilation.directives,
      ...scope.compilation.pipes,
      ...scope.compilation.ngModules,
    ],
  };
} else {
  if (!this.ownerNgModule.has(type)) {
    // This component is orphan! No need to handle the error since the component rendering
    // pipeline (e.g., view_container_ref) will check for this error based on configs.
    return {dependencies: []};
  }
  // ...falls back to the declaring module's transitive scope...
}
```

A standalone component **carries** its dependency list. A non-standalone one **looks its owner
up** in an `ownerNgModule` map that is only populated once the declaring module has been
loaded — and if nothing has loaded that module yet, the framework's own comment calls the
component an **orphan**. That lookup is a global side-effect ordering problem: whether your
component renders correctly depends on module-evaluation order elsewhere in the program. That
is the difference in one sentence, and removing it is what makes a component file
self-describing.

## The trade-off, honestly

| | `NgModule` scope | Component `imports` |
|---|---|---|
| Where the dependency is written | in a module file, once for many classes | in each component that uses it |
| Reading one component file tells you | membership, not dependencies | the complete dependency list |
| Effect of moving the file | may silently break the template | none |
| Same class used by 30 components | one line | thirty lines |
| A class may be declared | by exactly one NgModule | n/a — no declaration at all |
| Unused dependency | invisible | NG8113 warning per component, for a directive or pipe named directly |
| Providers | eager, application-wide | scoped to the importing component's injector |

The honest cost is the fifth row: `imports` is more typing, and it is the same typing repeated.
Angular's answer is not "it is not repetition", it is that the repetition is mechanical —
editors add the import when you complete the tag, the unused ones are diagnosed, and a
schematic removes them. What you buy is the fourth row, and it is the row that used to cost
afternoons.

## Gotchas

**★ Symptom: a component you moved between modules stops compiling, and the diff on that file
is only its import statements.** Cause: its template scope came from the old module's
`imports`, and the new module imports something different. Fix: make the class standalone and
give it its own list — then the file is portable:

```ts
// src/app/orders/order-row.component.ts
import {Component, input} from '@angular/core';
import {RouterLink} from '@angular/router';

export interface OrderRow {
  id: string;
  reference: string;
}

@Component({
  selector: 'app-order-row',
  imports: [RouterLink],
  template: `<a [routerLink]="['/orders', row().id]">{{ row().reference }}</a>`,
})
export class OrderRowComponent {
  readonly row = input.required<OrderRow>();
}
```

**★ Symptom: adding a component to a second module's `declarations` is an error.** Cause:
angular.dev's rule — *"If Angular discovers any components, directives, or pipes declared in
more than one NgModule, it reports an error"*. Fix: declare it once and `export` it from that
module, or make it standalone and delete the declaration entirely.

**★ Symptom: during a partial migration a component renders with no directives applied at all,
rather than erroring on a specific one.** Cause: the non-standalone branch above — the class
has no entry in `ownerNgModule`, so `getComponentDependencies` returns an empty list. It is an
orphan, not a component with a missing import. Fix: make sure something actually loads the
declaring module, or convert the class to standalone so it carries its own dependencies.

**★ Symptom: a service is instantiated at startup even though the feature that needs it is
never opened.** Cause: the last quoted sentence — a bootstrapped module's `providers`, and
those of everything it imports, are *"eagerly loaded and available to inject for the entire
application"*. Fix: this is one of the things `imports` does not do; move the provider to a
route's `providers`, to `providedIn: 'root'` (which is tree-shakable), or to the component
that needs it.

**★ Symptom: `SharedModule` has grown to forty exports and every feature imports it.** Cause:
the one-class-one-module rule made re-export the only way to share, so the module became a
dumping ground. Fix: there is no `SharedModule` in the standalone model — export the classes
themselves, and let each component import the two or three it uses:

```ts
// src/app/shared/index.ts — a re-export, not a scope; each consumer still imports what it uses
export {AvatarComponent} from './avatar.component';
export {HighlightDirective} from './highlight.directive';
export {InitialsPipe} from './initials.pipe';
```

## Interview questions

**★ What broke, under `NgModule`, when you moved a component between modules — and why can that
not happen now?**
The old compilation scope was ambient: a component could use anything its declaring module
imported, without saying so anywhere in its own file. Move it to a module with a different
`imports` list and the dependencies silently disappear. It cannot happen now because the
dependency list lives in the component's own decorator; moving the file moves the list with it.

**★ Why did every large Angular application end up with a `SharedModule`?**
Because a component, directive or pipe may be declared by exactly one NgModule, and a class
you have not declared you cannot use. The only way to share was for one module to declare and
`export` it and for everyone else to import that module. Standalone removes the constraint —
there is no declaration, so there is nothing to centralise.

**★ Why does the runtime need a `deps_tracker` at all if the compiler already resolved the
scope?**
For the JIT and local-compilation paths, where a component definition may exist before its
dependencies are known. The interesting part is the branch: a standalone component's
dependencies come straight off its own resolved scope, while a non-standalone one has to look
its owner up in an `ownerNgModule` map that is only populated once the declaring module has
been loaded — which is why an unloaded module produces an orphan component rather than a
missing directive.

**Is the `NgModule` model deprecated in Angular 22?**
No. `@NgModule` and every field it has are undeprecated in `@angular/core` 22.1.5, and
`platformBrowser().bootstrapModule(...)` still works. What changed is the default and the
recommendation, not the support status — which is why the interop and "where NgModule still
legitimately appears" chunks later in this topic are about real, current code rather than
history.

**What did the ambient model actually get right?**
One line of configuration for a whole folder of components, and no repetition when thirty
components use the same directive. That is a genuine advantage and the standalone model does
not have it; the shared-constant trick (`imports: [SHARED_UI]`) recovers part of it at the
cost of importing more than you use. The trade Angular made was locality over brevity, and
the payoff is that a component file can be read, moved and lazily loaded on its own.

---

← Prev: [What the compiler does with the array](04c-what-the-compiler-does-with-the-array.md) · Index: [Topic index](README.md) · Next → **05 · Unused imports and the compiler diagnostics** *(not written yet)*
