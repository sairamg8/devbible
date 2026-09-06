---
title: "Locality was bought, not granted — Angular's own source comments name three places where work was deliberately pushed into the runtime to keep the compiler local, the published `.d.ts` has to restate every fact a consumer needs, and the entire metadata error catalogue of chunks 09 and 10 is the bill arriving in your editor"
sidebar_label: "12e · What locality costs"
sidebar_position: 12.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/core/src/render3/interfaces/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/view.ts) (`expandoStartIndex`, verbatim), [`packages/core/src/render3/instructions/property.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/property.ts) (verbatim), [`packages/core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts) (`ComponentDef.tView`, verbatim), [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts) and [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md) (2018 draft; architecture claims only).
> Documentation-validated; **no sandbox run** — ⛔ nothing on this page is a measurement. No bundle was sized, no render was profiled and no rebuild was timed.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every page about Ivy sells locality. This one prices it. Three separate comments in Angular's own
source say, in as many words, that a cost was moved into the runtime *in order to* keep the compiler
local — the expando region cannot be sized at build time, the property-versus-input decision cannot
be made at build time, and the `TView` is computed on a component's first render rather than baked
into its definition. On top of that, the published `.d.ts` has to restate every fact a consumer's
compiler needs, because the consumer will never read your source; the emitted definition is a
private ABI, which is why a second compilation mode had to be invented; and the requirement that
metadata be readable without running your program is the direct cause of every error in chunks
[09](09-static-analysability-is-the-load-bearing-constraint.md) and
[10](10-metadata-errors-one-by-one.md). Locality is a good trade. It is not a free one, and a
reference page that only lists the wins has told you half of it.**

## Cost 1 — three comments that say "we pay this at runtime on purpose"

These are not inferences. They are the source explaining itself.

**The expando region cannot be sized at build time.** From
`packages/core/src/render3/interfaces/view.ts`, verbatim:

> *"Unlike the "decls" and "vars" sections of `LView`, the length of this section cannot be
> calculated at compile-time because directives are matched at runtime to preserve locality."*

`decls` and `vars` are integers the compiler emits because it counted the elements and bindings in
*this* template ([07b](07b-the-view-is-an-array-decls-and-vars.md)). The expando region holds
directive instances and host-binding state, and its length depends on which directives matched —
which depends on other files' selectors. A whole-program compiler would have counted them. Ivy
declines, and the view has a region whose layout is decided while rendering.

**Whether a binding is an element property or a directive input is decided at runtime.** From
`packages/core/src/render3/instructions/property.ts`, verbatim:

> *"This check must be conducted at runtime so child components that add new `@Inputs` don't have to
> be re-compiled"*

Read the justification, not just the behaviour: the alternative is that adding an input to a child
component invalidates the compilation of every parent that binds to it. That is exactly the
pre-Ivy *"if any of the transitive information changed, then all factories need to be regenerated"*
world. The cost of avoiding it is a check on every property binding, on every change-detection pass.

**The `TView` is computed at first render.** From
`packages/core/src/render3/interfaces/definition.ts`, on the `tView` field of `ComponentDef`,
verbatim:

> *"Ivy runtime uses this place to store the computed tView for the component. This gets filled on
> the first run of component."*

The `TView` is the static, shared-per-component-type half of a view. It could in principle have been
emitted by the compiler. It is not, because building it requires the resolved directive
definitions — other files again. So the definition ships with an empty slot and the runtime fills it
the first time that component renders.

🔴 **Together these three are the honest answer to "Angular is a compiler, so the runtime must be
small".** The compiler's budget was not spent on eliminating runtime work; it was spent on
eliminating whole-program knowledge. [08f](08f-the-cost-of-generated-code.md) makes the same point
from the code-generation side.

## Cost 2 — every fact a consumer needs must be restated in the `.d.ts`

If a consumer's compiler may not read your source, then everything it needs has to be in what you
publish. `separate_compilation.md`, verbatim:

> *"The information needed by reference inversion and type-checking is included in the type
> declaration of the `ɵcmp` in the `.d.ts`."*

That is why `ɵɵComponentDeclaration` carries **ten type arguments** rather than being a marker type
([06d](06d-the-factory-and-the-d-ts-declaration.md)): selector, inputs, outputs, queries, content
selectors, standalone flag, host directives and the rest are all *published metadata*, encoded as
types because types are what a `.d.ts` can carry.

The costs of that are real and they are the kind that bite in a monorepo:

- **The `.d.ts` is the API, not a by-product.** A change to a selector or an input alias is a change
  to a published artefact, and until the library is rebuilt the old fact is still the true one for
  every consumer.
- **Consumers cannot be type-checked against source.** A stale build in one workspace package
  produces confident, wrong diagnostics in another.
- **Metadata is duplicated by construction.** Your decorator says it, the emitted JavaScript says
  it, and the `.d.ts` says it a third time in the type system. That is three places that a
  hand-edited build output can desynchronise.

## Cost 3 — the emitted definition is private, so publishing needed a second mode

Everything the compiler emits is `ɵ`-prefixed, and `ComponentDef`'s own header warns that the shape
may change between versions ([06b](06b-inside-definecomponent.md)). A library that emits final
definitions is therefore correct against exactly one Angular version — and a library declares a
peer *range*. The result is a whole extra mechanism: a second `compilationMode`, a family of
`ɵɵngDeclare*` functions, and a linker that runs in the consumer's build.
[12f](12f-partial-compilation-and-the-linker.md) is that machinery. **It exists only because
locality made the definition local — and therefore private.**

## Cost 4 — the compiler reads syntax, so your metadata language shrank

The other side of "the decorator is the compiler" is that the decorator must be *readable* without
running it. That single requirement generates:

- the partial evaluator and its final `else`, which is the real grammar of metadata
  ([09c](09c-the-partial-evaluator-is-the-grammar.md));
- the single-return-function rule ([09d](09d-the-single-return-function-rule.md));
- `selector` having to reduce to a string ([09e](09e-selector-must-reduce-to-a-string.md));
- the whole `NG1xxx` / `NG2xxx` / `NG3xxx` catalogue in chunk [10](10-metadata-errors-one-by-one.md).

None of those errors would exist in a framework that evaluated its metadata at runtime. They are
locality's invoice, itemised, and it is a long invoice.

## Cost 5 — a dependency graph nobody else maintains

Because the one non-local input is a *selector match* rather than an import, TypeScript's own
incremental machinery cannot see it — *"TypeScript will not track these changes, it's the
responsibility of `ngtsc`"* ([12d](12d-where-locality-breaks.md)). Angular therefore carries an
invalidation graph of its own, and every build-staleness bug in an Angular project lives in the gap
between that graph and `tsc`'s.

There is a subtler version of the same cost: **nothing in the build has a global view of selectors**,
so nothing can tell you that two packages chose the same one. Global uniqueness checks require
global knowledge, which is the thing locality gave up.

## The ledger, on one line each

| Cost | Paid by | Where |
|---|---|---|
| Directive matching, expando layout, input resolution at runtime | every render | this page, [08f](08f-the-cost-of-generated-code.md) |
| `TView` computed on first render | first render of each component type | this page |
| All published metadata restated in the `.d.ts` | library authors, monorepos | [06d](06d-the-factory-and-the-d-ts-declaration.md) |
| Definitions are a private, versioned ABI | library authors | [12f](12f-partial-compilation-and-the-linker.md) |
| Metadata must be statically readable | everyone who writes a decorator | [09](09-static-analysability-is-the-load-bearing-constraint.md), [10](10-metadata-errors-one-by-one.md) |
| A separate invalidation graph | the build, and you when it is stale | [12d](12d-where-locality-breaks.md) |
| Base classes must be decorated; mixins do not work | anyone factoring out shared members | [12b](12b-inheritance-and-the-undecorated-base.md), [12c](12c-what-inheritance-never-carries.md) |
| No global selector uniqueness check | anyone integrating two libraries | this page |

## Gotchas

**★ Symptom: you expected an ahead-of-time build to make first render cheap, and the docs' "faster rendering" row seemed to promise it.** Cause: that row compares AOT against **JIT** — *"the browser downloads a pre-compiled version of the application"* — not against a hand-written app. Locality means real setup still happens on first render: the `TView` *"gets filled on the first run of component"*, directives are matched then, and the expando region is laid out then. Fix: the lever is *how many distinct component types are on the critical path*, so move the ones that are not needed immediately behind `@defer` ([11](11-why-defer-can-split-a-bundle.md)):

```html
<!-- src/app/dashboard/dashboard.html -->
<app-summary-cards [summary]="summary()" />

@defer (on viewport) {
  <app-revenue-chart [series]="series()" />
} @placeholder {
  <div class="chart-skeleton"></div>
}
```

**★ Symptom: a provider mistake — a wrong token, a factory that returns the wrong thing — builds cleanly and only fails when someone opens the route.** Cause: locality makes the compiler evaluate only the fields it needs a value from. `providers` is not one of them; the directive handler relays it into the definition as `new WrappedNodeExpr(directive.get('providers')!)` and never looks inside ([09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)). Nothing in the Angular build checks it. Fix: get the check from TypeScript instead, by giving every token a real type parameter so the factory's return type is constrained:

```ts
// src/app/checkout/tax-config.ts
import {InjectionToken} from '@angular/core';

export interface TaxConfig {
  rate: number;
  jurisdiction: string;
}

// The type argument is what makes `useFactory` type-checked. An InjectionToken<any>
// or a bare string token gets you no check at all, from Angular or from TypeScript.
export const TAX_CONFIG = new InjectionToken<TaxConfig>('TAX_CONFIG');
```

```ts
// src/app/checkout/checkout.config.ts
import {Provider} from '@angular/core';
import {TAX_CONFIG, TaxConfig} from './tax-config';

export const CHECKOUT_PROVIDERS: Provider[] = [
  {
    provide: TAX_CONFIG,
    useFactory: (): TaxConfig => ({rate: 0.2, jurisdiction: 'GB'}),
  },
];
```

**★ Symptom: you added an `@Input()` to a library component and the application consuming it still reports the property as unknown.** Cause: the consumer never reads your source — it reads the `ɵɵComponentDeclaration` type arguments in your published `.d.ts`, which is where *"the information needed by reference inversion and type-checking"* lives. Until that file is regenerated, the old metadata is the published fact. Fix: rebuild the library on every change while developing against it:

```bash
# Terminal 1 — regenerate the library's JavaScript and .d.ts on every save.
npx ng build order-widgets --watch

# Terminal 2 — the consuming application.
npx ng serve storefront
```

**Symptom: two packages ship directives with the same attribute selector, both apply to the same element, and no part of the build warns you.** Cause: matching happens per template scope at runtime, and nothing in the build has a global view of every selector in the program — global uniqueness is exactly the knowledge locality gave up. Multiple directives matching one element is normal Angular, not an error state, so there is nothing to report. Fix: namespace your own selectors and keep each component's `imports` minimal so the matching set stays small and reviewable:

```ts
// projects/order-widgets/src/lib/sortable-column.ts
import {Directive} from '@angular/core';

// Prefixed on purpose. `[sortable]` would silently co-apply with any other library
// that chose the same word, in any template that imports both.
@Directive({
  selector: '[acmeSortable]',
})
export class AcmeSortableColumn {}
```

## Interview questions

**★ Name the places Angular's own source says a cost was moved into the runtime to preserve locality, and say what each one buys.**
There are three and they are all comments in `@angular/core`. First, the expando region of a view:
*"the length of this section cannot be calculated at compile-time because directives are matched at
runtime to preserve locality"* — the compiler could have counted directive instances if it had had
global knowledge of selectors, and it deliberately does not. Second, property bindings: *"This check
must be conducted at runtime so child components that add new `@Inputs` don't have to be
re-compiled"* — the check buys the property that adding an input to a child does not invalidate the
compilation of every parent. Third, `ComponentDef.tView`: *"This gets filled on the first run of
component"* — the static half of a view is computed at first render because building it needs the
resolved directive definitions. Each of them trades a fixed runtime cost for the removal of a
whole-program build dependency.

**★ What does locality cost a library author specifically?**
Three things. The published `.d.ts` becomes the API surface, because a consumer's compiler will
never read your source and everything it needs — selector, inputs, outputs, queries, content
selectors, standalone flag — has to be encoded in the `ɵɵComponentDeclaration` type arguments; that
means a stale build is a wrong API, and it means metadata changes are breaking changes even when the
TypeScript signature is unchanged. Second, the emitted definition is a private, versioned ABI, so
you cannot publish fully compiled output at all and must use partial compilation and the linker
instead. Third, you have no global view: nothing tells you that your selector collides with another
package's, so prefixing is your responsibility and nobody's build will catch it if you skip it.

**Why is a broken `providers` entry a runtime failure while a broken `selector` is a build failure?**
Because locality makes the compiler evaluate only what it needs a value from *now*. A selector
becomes part of the information other components' template compilations consume, so it has to be
resolved to a string at build time and anything that will not reduce is an error. A `providers`
array is consumed only by this component's runtime injector, so the handler relays it into the
emitted definition untouched — literally wrapping the expression — and never inspects it. The
practical consequence is that the Angular build gives you no safety net over DI wiring at all; the
only checking available is TypeScript's, which is why typing your `InjectionToken` properly is worth
more in an Angular codebase than it looks.

**Someone proposes that production builds should do whole-program analysis anyway, since the whole program is available then. What breaks?**
Several things at once. Libraries stop being publishable in compiled form, because a whole-program
result is only valid for one resolved dependency graph and a library declares a range — the exact
sentence the design doc gives for why pre-Ivy npm packages had to ship metadata rather than
factories. Incremental rebuild correctness gets much harder, because the doc's second reason for the
"do not scan other sources" rule is that traceable dependencies are what make watch mode sound. And
the compiler acquires two modes that behave differently, so a class of bug becomes
production-only — which is the worst possible place to discover that a template matched a different
directive than it did in development. The runtime savings would be real; the price is the four
properties locality was bought for.

**Of everything locality costs, which one will you personally hit most often, and what do you do about it?**
The metadata-must-be-static rule, by a wide margin. Almost nobody publishes a library; everybody
eventually tries to compute a decorator argument, share metadata through a helper, build an
`imports` array with a spread, or extract a base class without decorating it. The mitigation is not
to memorise the error catalogue but to internalise the one question behind it: *does the compiler
need a value from this field in order to generate something now, or is it just being relayed?* That
question predicts the outcome for every field, and it is the same question that explains why an
arrow function is fine in `providers` and fatal in `selector`.

---

← Prev: [12d · Where locality breaks](12d-where-locality-breaks.md) · Index: [Topic index](README.md) · Next → [12f · Partial compilation and the linker](12f-partial-compilation-and-the-linker.md)
