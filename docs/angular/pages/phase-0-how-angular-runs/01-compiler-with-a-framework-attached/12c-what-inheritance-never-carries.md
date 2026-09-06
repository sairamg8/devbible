---
title: "The subclass's definition is generated from the subclass's own decorator, so a template is never inherited and a class expression returned from a mixin factory is never compiled at all — and the boundary between what the runtime merge does carry and what it does not is one of the places the published sources genuinely do not settle the answer"
sidebar_label: "12c · What inheritance never carries"
sidebar_position: 12.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler/src/render3/view/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/compiler.ts) (`compileComponentFromMetadata` setting `template`, `decls` and `vars` from the metadata it was handed, verbatim), [`packages/compiler/src/render3/r3_identifiers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_identifiers.ts), [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md) (2018 draft; architecture claims only).
> 🔴 **This page contains an explicit "not settled" section.** Where the sources read for this topic do not determine an inheritance behaviour, it says so and gives the practice that is correct under either answer. Nothing here is inferred and then asserted.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[12b](12b-inheritance-and-the-undecorated-base.md) established that inheritance is resolved
between *definitions* at run time, not between *sources* at build time. This chunk is the other
side of that: everything the compiler reads straight out of the decorator argument to build the
definition is the subclass's own value, and a class no decorator sat above is not compiled at all.
The consequences are the two most common disappointments people meet with Angular inheritance — a
template is not inherited, and a TypeScript mixin factory produces a class Angular has never heard
of, failing with no error at all. The third consequence is honest uncertainty: the sources read for
this topic settle *where* the merge happens and not *what* it merges, so this page draws that line
explicitly rather than guessing on your behalf.**

## A template is generated per class, from that class's own metadata

`compileComponentFromMetadata` builds the definition object out of the metadata it was handed.
Verbatim, from `packages/compiler/src/render3/view/compiler.ts`:

```ts
definitionMap.set('decls', o.literal(tpl.root.decls as number));
definitionMap.set('vars', o.literal(tpl.root.vars as number));
definitionMap.set('template', templateFn);
```

Every one of those three values comes from compiling *this* class's template. `decls` and `vars` are
the lengths of the two `LView` regions the template needs
([07b](07b-the-view-is-an-array-decls-and-vars.md)), and `templateFn` is the function whose
instructions address slots inside those regions by integer
([07c](07c-how-instructions-address-the-array.md)).

**That is why a template is not an inheritable thing.** It is not a value that could be copied down
a class hierarchy; it is a function whose slot indices were computed for one specific piece of
markup, alongside two integers that pre-size the array those indices point into. Splicing one
compiled template function into another is not an operation that exists — there is nothing to
reconcile the two index spaces with. A subclass with `@Component` gets a definition containing its
own template function. If you want shared markup, you want composition.

```ts
// src/app/shared/panel-shell.ts
// The reusable half, as a component. Everything variable is a projection slot.
import {Component} from '@angular/core';

@Component({
  selector: 'app-panel-shell',
  template: `
    <section class="panel">
      <header class="panel-header"><ng-content select="[panelTitle]" /></header>
      <div class="panel-body"><ng-content /></div>
      <footer class="panel-footer"><ng-content select="[panelActions]" /></footer>
    </section>
  `,
})
export class PanelShell {}
```

Each consumer then imports `PanelShell` and fills the slots it cares about — the shape is in the
first gotcha below. Note what changed: the relationship went from `extends` to a *reference in an
`imports` array*, which is the only relationship between two components the compiler can see
locally.

## A mixin factory produces a class no compiler ever saw

The TypeScript mixin pattern — a function that takes a base constructor and returns a class
expression — is idiomatic TypeScript and inert Angular:

```ts
// ⛔ src/app/mixins/with-loading.ts — pseudo-code: this shape cannot work under AOT.
// No decorator sits above the returned class expression, so no Compiler ever ran for
// it and it has no definition. `loading` is an ordinary field; if this declared an
// @Input() it would be an ordinary field with a decorator nobody read.
export function withLoading<TBase extends new (...args: never[]) => object>(Base: TBase) {
  return class extends Base {
    loading = false;
  };
}
```

🔴 **The reason this is worse than an error is that it is not an error.** `@Component`,
`@Directive` and `@Injectable` handlers run over decorated class *declarations* found in source. A
class expression returned from a function is neither, so no handler ever considers it, so nothing is
wrong from the compiler's point of view — there is simply no compilation. At runtime the fields
exist and do nothing.

The replacement is a decorated abstract base if the relationship really is "is a", or an injectable
if it is "has a" — which it usually is:

```ts
// src/app/shared/loading-state.ts
import {Injectable, signal} from '@angular/core';

@Injectable()
export class LoadingState {
  readonly loading = signal(false);

  async track<T>(work: Promise<T>): Promise<T> {
    this.loading.set(true);
    try {
      return await work;
    } finally {
      this.loading.set(false);
    }
  }
}
```

```ts
// src/app/orders/order-list.ts
import {Component, inject} from '@angular/core';
import {LoadingState} from '../shared/loading-state';
import {OrderResource} from '../data/order-resource';

@Component({
  selector: 'app-order-list',
  providers: [LoadingState],
  template: `
    @if (state.loading()) {
      <p>Loading…</p>
    }
  `,
})
export class OrderList {
  protected readonly state = inject(LoadingState);
  private readonly orders = inject(OrderResource);

  reload(): Promise<unknown> {
    return this.state.track(this.orders.list());
  }
}
```

## Lifecycle hooks are ordinary methods, with ordinary override semantics

Nothing Angular does changes what `extends` means in JavaScript. If the base declares `ngOnInit` and
the subclass declares `ngOnInit`, the subclass's method replaces it on the prototype chain and the
base's never runs unless you call it. Angular calls the hook once, on the instance; it does not walk
the chain calling every implementation.

This is worth stating explicitly because the previous two sections train you to think of the base
class as "compiled separately and merged", which is true of *declared metadata* and false of
*method bodies*. Metadata merges; methods override.

## 🔴 What the sources read for this topic do not settle

Two questions come up constantly and this page will not answer them by inference:

1. **Does a subclass component's template compile against the base class's `imports`?**
2. **Does a subclass inherit the base's `selector` if it declares none?**

Both hinge on exactly which fields `ɵɵInheritDefinitionFeature` merges, and that implementation was
not read while researching this topic ([12b](12b-inheritance-and-the-undecorated-base.md) says the
same). Nor can it be safely derived from the locality rule: the compiler demonstrably *does* inspect
the base class far enough to raise NG2007 when it is undecorated, so "locality forbids it" is not an
argument that holds here.

**The practice that is correct under either answer** is to declare, on each component, the imports
its own template uses. It costs nothing, it is what the unused-import diagnostic expects
([topic 02 · 05](../02-standalone-by-default/05-unused-imports-and-the-compiler-diagnostics.md)),
and it keeps a text search for a class name a complete answer to "who can use this?"
([topic 02 · 10c](../02-standalone-by-default/10c-incremental-compilation-and-the-scope-cache.md)).
Give every matchable component its own explicit `selector` for the same reason.

## Gotchas

**★ Symptom: you extended a component to reuse its markup and the subclass renders its own template, or you cannot work out what to put in the subclass's `template` at all.** Cause: `template` is set into the definition from the metadata the compiler was handed for *this* class, alongside `decls` and `vars` computed from *this* markup. Nothing merges two compiled template functions. Fix: extract the shared markup into a component and project the differences:

```ts
// src/app/customers/customer-panel.ts
import {Component} from '@angular/core';
import {PanelShell} from '../shared/panel-shell';

@Component({
  selector: 'app-customer-panel',
  imports: [PanelShell],
  template: `
    <app-panel-shell>
      <h2 panelTitle>Customers</h2>
      <ng-content />
    </app-panel-shell>
  `,
})
export class CustomerPanel {}
```

**★ Symptom: a TypeScript mixin compiles cleanly, and at runtime the inputs it declared never bind and the lifecycle hooks it declared never fire.** Cause: the class expression the factory returns has no decorator, so no handler compiled it and it has no definition; its Angular-looking members are plain fields. There is no error because there is no failed compilation — there was no compilation. Fix: move the behaviour into an injectable and inject it, or into a decorated abstract base and extend that. The injectable version is above; the base-class version is exactly [12b](12b-inheritance-and-the-undecorated-base.md)'s `@Directive()` shape.

**★ Symptom: you overrode `ngOnInit` in a subclass and the base class's subscriptions, defaults or logging silently stopped happening.** Cause: ordinary JavaScript override semantics. Angular invokes the hook once on the instance; the base implementation is shadowed. Fix: call it explicitly, and make it a review rule for any decorated base class that implements a lifecycle hook:

```ts
// src/app/tables/paged-order-table.ts
import {Component, OnInit} from '@angular/core';
import {SortableTableBase} from './sortable-table-base';

interface Order {
  id: string;
  total: number;
}

@Component({
  selector: 'app-paged-order-table',
  template: `<p>{{ rows.length }} orders</p>`,
})
export class PagedOrderTable extends SortableTableBase<Order> implements OnInit {
  override ngOnInit(): void {
    super.ngOnInit();
    this.sortKey = 'total';
  }
}
```

**Symptom: you are about to rely on a base component's `imports` array covering a subclass's template, and you cannot find documentation either way.** Cause: this is genuinely unsettled by the sources read for this topic — it depends on which fields the runtime inheritance feature merges, and that implementation was not read. Fix: do not build on an unverified behaviour. Declare the imports on the component whose template uses them; the cost is one array entry and the benefit is that the code is correct under either answer:

```ts
// src/app/tables/exportable-order-table.ts
import {Component} from '@angular/core';
import {SortableTableBase} from './sortable-table-base';
import {ExportButton} from '../shared/export-button';

interface Order {
  id: string;
  total: number;
}

@Component({
  selector: 'app-exportable-order-table',
  // Declared here because THIS template uses it. Whether the base also imports it
  // is not something this component's correctness should depend on.
  imports: [ExportButton],
  template: `
    <app-export-button [rows]="rows" />
    <p>{{ rows.length }} orders</p>
  `,
})
export class ExportableOrderTable extends SortableTableBase<Order> {}
```

## Interview questions

**★ Does a component subclass inherit its parent's template? Why is the answer the opposite of the answer for inputs, when both are "metadata"?**
No, and the difference is that inputs are *data* while a template is *compiled code*. The compiler
sets `template`, `decls` and `vars` into the definition from the metadata it was handed for that one
class: `decls` and `vars` are the lengths of the `LView` regions this markup needs, and the template
function addresses slots inside those regions by integer index. Two compiled template functions
therefore have two unrelated index spaces and there is no meaningful way to merge them. Declared
members are different — a list of input names and their aliases is a list, and merging lists is what
`ɵɵInheritDefinitionFeature` exists to do at definition-build time. So Angular inherits declarations
and does not inherit rendering.

**★ A TypeScript mixin factory compiles and then does nothing. Why is there no error?**
Because there is nothing that failed. Angular's handlers run over decorated class declarations
discovered in source; a class expression returned from a function is neither decorated nor
discovered, so no handler ever looked at it. From the compiler's point of view the file contains a
function that returns an object — completely ordinary code. The Angular-looking members inside it
generate no definition entries, so at runtime there are no inputs registered and no hooks to call.
This is "the decorator is the compiler" showing its sharpest edge: the absence of a decorator is not
an error condition, it is the absence of a compilation, and absences do not produce diagnostics.

**When is `extends` actually the right tool in an Angular codebase?**
When the shared thing is *declared members and behaviour* rather than markup, and when the base can
be decorated. A decorated abstract base holding common inputs, outputs and protected helpers is a
supported, first-class shape and it works across package boundaries. When the shared thing is
markup, the answer is composition — a component plus content projection. When the shared thing is
state or a side-effecting workflow, the answer is an injectable, because that composes without
constraining the class hierarchy and it can be provided at whichever injector scope the lifetime
demands. The tell that you have chosen wrongly is usually a base class that grows a template, or a
mixin.

**You want three components to share a header, a loading state and two inputs. How do you split that?**
Three different mechanisms, one per kind of thing. The header is markup: extract a `PanelShell`
component with `ng-content` projection slots and import it in all three. The loading state is
behaviour and state: put it in an `@Injectable()` class and either provide it per-component or
inject a root instance, so no class hierarchy is involved. The two inputs are declared metadata: a
`@Directive()`-decorated abstract base is the only one of the three that inheritance is genuinely
good at, and it works because the base gets a real `ɵdir` for the runtime feature to merge. Trying
to do all three with one base class is what produces the template problem.

**How should you handle an Angular behaviour you cannot find documented and cannot derive?**
Write code that is correct under every possible answer, and say in the review that you did.
Inheritance has exactly such a case: whether a subclass's template compiles against the base's
`imports` depends on which fields the runtime inheritance feature merges, which is not stated in the
guides and was not read at source for this topic. Locality does not settle it either, because the
compiler demonstrably does inspect the base class far enough to raise NG2007. The defensive
practice — declare imports on the component whose template uses them, give every matchable component
its own selector — costs one line and removes the dependency on the answer entirely. That is a
better outcome than being right about the current implementation and wrong after an upgrade.

---

← Prev: [12b · Inheritance and the undecorated base](12b-inheritance-and-the-undecorated-base.md) · Index: [Topic index](README.md) · Next → [12d · Where locality breaks](12d-where-locality-breaks.md)
