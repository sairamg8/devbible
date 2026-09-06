---
title: "A base class in another file is precisely the input a Compiler is forbidden to read, so Angular does not merge inheritance at build time — it raises four separate errors demanding the base class be decorated too, and emits a reference to a runtime feature that does the merging against the base's definition object"
sidebar_label: "12b · Inheritance and the undecorated base"
sidebar_position: 12.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts) (NG2005, NG2006, NG2007, NG2016 doc comments, verbatim), [`packages/compiler/src/render3/r3_identifiers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_identifiers.ts) (the `features` family, including `ɵɵInheritDefinitionFeature`), [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md) (2018 draft; architecture claims only) and [`packages/compiler/design/separate_compilation.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/separate_compilation.md).
> ⚠️ **Stated as uncertain on this page:** the implementation of `ɵɵInheritDefinitionFeature` was **not** read for this topic. This page says *where* inheritance is resolved, which the emitted identifier settles; it does not enumerate which definition fields the feature merges.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Class inheritance is the sharpest test of locality there is, because a base class is by definition
in some other file — exactly the input `architecture.md` says a Compiler *"must not scan sources or
metadata for other symbols"* to obtain. Angular's answer has two halves and both are visible from
outside. At build time it refuses to guess: four error codes exist purely to say "this class has no
definition and I am not going to infer one". At run time it does the merge, by emitting a reference
to `ɵɵInheritDefinitionFeature` — a function in `@angular/core` — rather than reaching into the base
class's source and folding the fields in itself. The practical rule that falls out is one line:
**every base class that declares Angular features must carry its own decorator.** It explains a
family of bugs that otherwise look like Angular randomly losing your inputs.**

## The four codes that exist because the compiler will not look next door

From `error_code.ts` at `v22.1.5`, verbatim doc comments:

> *"NG2007 `UNDECORATED_CLASS_USING_ANGULAR_FEATURES` — Raised when an undecorated class that is
> using Angular features has been discovered."*

> *"NG2006 `DIRECTIVE_INHERITS_UNDECORATED_CTOR` — Raised when a Directive inherits its constructor
> from a base class without an Angular decorator."*

> *"NG2016 `INJECTABLE_INHERITS_INVALID_CONSTRUCTOR` — Raised when a type with Angular decorator
> inherits its constructor from a base class which has a constructor that is incompatible with
> Angular DI."*

> *"NG2005 `UNDECORATED_PROVIDER` — Raised when an undecorated class is passed in as a provider to a
> module or a directive."*

Four codes, one theme. In every case the compiler has a class in front of it that *would* need
information from a class it is not allowed to read, and rather than reading it, it stops and tells
you to decorate the other class so that class gets a definition of its own. That is locality
enforced as a user-visible contract: **the unit that carries Angular metadata is a decorated class,
and there is no way to be half of one.**

Note the wording of NG2007 in particular — *"an undecorated class that is **using Angular
features**"*. The trigger is not "you extended something", it is "this class declares inputs,
outputs, queries, lifecycle hooks or host bindings and has no decorator to turn them into a
definition". A plain data class with no Angular members is unaffected; it has nothing to lose.

## The decorator that declares without matching

The fix for the base class is a `@Directive()` with **no argument object at all**:

```ts
// src/app/tables/sortable-table-base.ts
// A decorator with no metadata object. It produces a ɵdir — so the class has a
// definition for a subclass to inherit from — and declares no `selector`, so this
// class can never be matched by any template in the application.
import {Directive, Input, Output, EventEmitter} from '@angular/core';

@Directive()
export abstract class SortableTableBase<TRow> {
  @Input() rows: readonly TRow[] = [];
  @Input() sortKey: keyof TRow | null = null;
  @Output() sortChange = new EventEmitter<keyof TRow>();

  protected toggleSort(key: keyof TRow): void {
    this.sortKey = key;
    this.sortChange.emit(key);
  }
}
```

Why it works follows from [12](12-ivy-and-locality.md)'s last section. `separate_compilation.md`
says *"The only pieces of information that are not generated into the definition are the directive
selector and the pipe name as they go into the module scope."* Omit the selector and the class is
invisible to every template while still being a fully compiled directive — exactly the combination
an abstract base needs. It is also why the right decorator here is `@Directive`, not `@Component`: a
`ɵcmp` is built around a compiled template function ([06c](06c-decls-vars-consts-and-dependencies.md)),
and an abstract base has no template for the component compiler to compile.

## Where the merge actually happens

`r3_identifiers.ts` lists the identifiers the compiler is allowed to emit, and one family is
`features`. Its members include `ɵɵNgOnChangesFeature`, `ɵɵProvidersFeature`,
`ɵɵHostDirectivesFeature` and — the one that matters here — **`ɵɵInheritDefinitionFeature`**
([08c](08c-the-instruction-set-is-a-la-carte.md) has the full table).

Read that as evidence of *timing*. Features are functions in `@angular/core` that run when the
definition object is built — [08c](08c-the-instruction-set-is-a-la-carte.md) names exactly this work
(*"resolving directive and pipe defs, running features, computing an id"*) as what happens at
definition-evaluation time, and as the reason the whole call has to be wrapped in `noSideEffects` to
stay tree-shakable. So when a decorated class extends another decorated class, the compiler does not
open the base class's file and copy its inputs into the subclass's emitted definition. It emits a
*reference* to a function, and that function does the work later, against the base class's
already-built definition object.

⚠️ **What this page does not claim.** The implementation of `ɵɵInheritDefinitionFeature` was not read
while researching this topic, so nothing here enumerates which fields it merges or in what order.
The claim being made is narrower and is settled by the emitted identifier alone: **inheritance is
resolved where the definitions are, not where the source is.**

That is also why a base class may live in a published library you never built. The library's `.d.ts`
carries a `ɵɵDirectiveDeclaration` describing its metadata
([06d](06d-the-factory-and-the-d-ts-declaration.md)) and its JavaScript carries a real `ɵdir`; your
subclass's compiler needs the first to type-check and your runtime needs the second to merge. Both
travel in the package. No source, no whole-program pass, no rebuild of the library — which is
[12f](12f-partial-compilation-and-the-linker.md)'s story arriving early.

## Gotchas

**★ Symptom: a component that extends an abstract base silently ignores bindings to the base's `@Input()`s, or the build fails with NG2007 naming a class you think of as "just a TypeScript base class".** Cause: the subclass's compiler never read the base class's file, because *"A Compiler must not depend on any inputs not directly passed to it"*. An undecorated base produces no definition, so there is nothing for `ɵɵInheritDefinitionFeature` to merge and no `ɵɵDirectiveDeclaration` for the template type-checker to consult. Fix: decorate the base with a selectorless `@Directive()`, then the subclass is an ordinary component:

```ts
// src/app/tables/order-table.ts
import {Component} from '@angular/core';
import {SortableTableBase} from './sortable-table-base';

interface Order {
  id: string;
  total: number;
}

@Component({
  selector: 'app-order-table',
  template: `
    <table>
      <thead>
        <tr>
          <th (click)="toggleSort('id')">Order</th>
          <th (click)="toggleSort('total')">Total</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows; track row.id) {
          <tr><td>{{ row.id }}</td><td>{{ row.total }}</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class OrderTable extends SortableTableBase<Order> {}
```

**★ Symptom: you added `@Injectable()` to a service that extends another service and the failure moved to the constructor — NG2016, *"inherits its constructor from a base class which has a constructor that is incompatible with Angular DI"*.** Cause: the compiler emits a `ɵfac` for the subclass from the subclass's file. The subclass declares no constructor, so the only constructor is the base's — in a file the compiler will not read for parameter metadata. Fix: decorate the base so it emits its own `ɵfac` describing its own dependencies, and prefer `inject()` over constructor parameters so the question does not arise at all:

```ts
// src/app/data/http-resource.ts
import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable()
export abstract class HttpResource {
  protected readonly http = inject(HttpClient);
  protected abstract readonly path: string;
}
```

```ts
// src/app/data/order-resource.ts
import {Injectable} from '@angular/core';
import {HttpResource} from './http-resource';

@Injectable({providedIn: 'root'})
export class OrderResource extends HttpResource {
  protected readonly path = '/api/orders';
}
```

**★ Symptom: NG2005 on a class you put in a `providers` array — *"an undecorated class is passed in as a provider"*.** Cause: a class used as its own provider token has to be *constructed by the injector*, which means it needs a `ɵfac`, which means it needs a decorator. Being a plain class with a constructor is not enough, because the compiler will not derive parameter metadata for a class it was not asked to compile. Fix: decorate it. `@Injectable()` with no argument is correct when the class is provided explicitly rather than tree-shakably:

```ts
// src/app/checkout/pricing-strategy.ts
import {Injectable} from '@angular/core';

// Provided per-route rather than `providedIn: 'root'` — but still decorated, because
// the decorator is what produces the factory the injector needs.
@Injectable()
export class PricingStrategy {
  price(subtotalCents: number, taxRate: number): number {
    return Math.round(subtotalCents * (1 + taxRate));
  }
}
```

**Symptom: the base class you need to extend comes from a package with no Angular dependency, so you cannot decorate it, and NG2006 or NG2016 will not go away.** Cause: those two codes are specifically about an *inherited constructor* whose parameters the compiler cannot see metadata for. You cannot fix a file you do not own. Fix: stop inheriting the constructor — either declare one on your subclass and call `super(...)` with values you obtain yourself, or drop `extends` entirely and hold an instance as a field, because a field's type is never something the compiler needs DI metadata for:

```ts
// src/app/search/search-index.ts
import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {LunrIndex} from 'third-party-lunr';

// `LunrIndex` is a plain TypeScript class from npm with no decorator. Composition
// means the compiler is never asked for metadata about it.
@Injectable({providedIn: 'root'})
export class SearchIndex {
  private readonly http = inject(HttpClient);
  private readonly index = new LunrIndex({fields: ['title', 'body']});

  add(doc: {id: string; title: string; body: string}): void {
    this.index.add(doc);
  }
}
```

## Interview questions

**★ Why does Angular make you put `@Directive()` on an abstract base class when TypeScript is perfectly happy without it?**
Because TypeScript and Angular are asking different questions. TypeScript resolves the base class
through the type system at type-check time; Angular has to *generate a definition*, and its design
rule is that a compiler for a decorator may not scan any other file for symbols. So when the
subclass is compiled, the base's `@Input()`s are simply not information the compiler has. Its two
options were to break locality or to require that the base class have been compiled into a
definition of its own, and it chose the second — which is what a bare `@Directive()` does. The
decorator has no `selector`, so the class is not matchable anywhere; it exists purely so that a
`ɵdir` is emitted for the subclass's runtime merge, and a `ɵɵDirectiveDeclaration` is emitted for
the consumer's template type-checker.

**★ The compiler emits `ɵɵInheritDefinitionFeature` rather than merging the base class's metadata itself. What does that tell you about the design?**
It tells you that inheritance is resolved against **definitions**, at run time, rather than against
**sources**, at build time — which is the only option locality leaves open. Features are functions
in `@angular/core` that execute when a definition object is built, so the emitted output for the
subclass says "when you construct this definition, also run the inheritance merge". The compiler
therefore needs nothing from the base class's file beyond the eventual existence of a definition,
which is why a base class can live in a package compiled years ago at a different version. It is the
same pattern as directive matching and input resolution: work a whole-program compiler would have
pre-computed, deliberately deferred so that the compilation of each file stays independent.

**Why is NG2007 phrased around "using Angular features" rather than around inheritance?**
Because the underlying condition is not about the inheritance relationship at all — it is about a
class that declares things only a definition can implement. Inputs, outputs, queries, host bindings
and lifecycle hooks all become entries in a `ɵdir` or `ɵcmp`; a class with no decorator produces no
definition, so those declarations would be inert. Angular reports it at the point of discovery
rather than waiting for a subclass to be bound at runtime and do nothing, which is the failure mode
that would otherwise be almost impossible to diagnose. The inheritance-shaped codes NG2006 and
NG2016 are the narrower, constructor-specific cases of the same problem.

**Two engineers argue about whether Angular "supports inheritance". What is the accurate answer?**
It supports it in exactly one shape: **a decorated class extending a decorated class**. Everything
that makes people say it does not support inheritance is a consequence of locality rather than a
missing feature — an undecorated base has nothing to inherit *from*, a mixin factory produces a
class no decorator ever saw, and an inherited constructor has parameter metadata the compiler
refuses to go and look up. Once both ends are decorated, the merge is a first-class emitted feature
and works across package boundaries. The honest framing is not "inheritance is unsupported" but
"Angular metadata attaches to decorated classes, and inheritance moves between definitions, not
between source files".

---

← Prev: [12 · Ivy and locality](12-ivy-and-locality.md) · Index: [Topic index](README.md) · Next → [12c · What inheritance never carries](12c-what-inheritance-never-carries.md)
