---
title: "`ComponentType<T>` defines 'consumable for rendering' as 'has a `ɵcmp`', which makes the set of things your application can ever render a build-time fact — every dynamic API takes a class, and the one door that bypasses the compiler, `[innerHTML]`, renders markup that is inert"
sidebar_label: "08e · Only compiled classes render"
sidebar_position: 8.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts) — `ComponentType<T>` and `DirectiveType<T>` quoted verbatim with their doc comments.
> Documentation-validated; **no sandbox run** — every code block below is ordinary application code or source read from the file named above.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[08d](08d-what-the-fixed-shape-costs.md) covered the two costs that constrain what a template can
do. This is the third and the sharpest: Angular can only render classes the compiler has already
processed, and the type system states it in one line. A virtual-DOM framework has a function that
manufactures a renderable thing out of a tag name and a props object; Angular has no equivalent,
because "renderable" is not a capability granted at runtime — it is a static field. The
practical consequence is that the *set* of components your application can ever show is fixed by
your build, and only the *choice* among them is dynamic. There is exactly one door out of that, and
it leads to inert markup.**

## The type says it in one line

`packages/core/src/render3/interfaces/definition.ts`, verbatim, including both doc comments:

```ts
/**
 * A subclass of `Type` which has a static `ɵcmp`:`ComponentDef` field making it
 * consumable for rendering.
 */
export interface ComponentType<T> extends Type<T> {
  ɵcmp: unknown;
}

/**
 * A subclass of `Type` which has a static `ɵdir`:`DirectiveDef` field making it
 * consumable for rendering.
 */
export interface DirectiveType<T> extends Type<T> {
  ɵdir: unknown;
  ɵfac: unknown;
}
```

🔴 **"Consumable for rendering" is *defined* as "has a `ɵcmp`".** Not "implements an interface", not
"was registered", not "matches a shape the runtime can interpret" — carries a static field the
compiler put there ([06](06-what-the-compiler-emits.md)). Every dynamic-rendering API in the
framework therefore trades in classes: `NgComponentOutlet` takes one,
`ViewContainerRef.createComponent` takes one, the standalone `createComponent` takes one.

```ts
import {Component, ViewContainerRef, viewChild} from '@angular/core';
import {BarChart} from './bar-chart';
import {LineChart} from './line-chart';

type ChartKind = 'bar' | 'line';

@Component({
  selector: 'app-report',
  template: `<ng-container #slot />`,
})
export class Report {
  private readonly slot = viewChild.required('slot', {read: ViewContainerRef});

  // A map over CLASSES, which is the only currency this API accepts.
  private readonly charts = {bar: BarChart, line: LineChart} as const;

  protected render(kind: ChartKind, series: ReadonlyArray<number>): void {
    this.slot().clear();
    const ref = this.slot().createComponent(this.charts[kind]);
    ref.setInput('series', series);
  }
}
```

Note what makes that code work: `BarChart` and `LineChart` are `import`ed, so they are *referenced*
from this file, so they are reachable from the bootstrap function, so they are in the bundle
([08b](08b-the-selector-problem-and-reference-inversion.md)). Dynamic rendering does not escape
reference inversion — it depends on it.

## Where each escape hatch stops

Every construct Angular offers for varying what appears on screen is a bounded answer to one part of
the problem. The useful thing to memorise is not what each gives you but where each stops.

| Construct | Gives you | Stops at |
|---|---|---|
| `@if` / `@switch` | a different **view** per branch | every branch must exist in the template source |
| `@for` | a repeated view | identity must be supplied by `track` ([08d](08d-what-the-fixed-shape-costs.md)) |
| `@defer` | a view whose dependencies load later | only the primary block gets a resolver ([11d](11d-what-defer-never-defers.md)) |
| `ng-template` + `ngTemplateOutlet` | choosing among compiled templates, with context | you choose one; you never build one |
| `ViewContainerRef.createComponent` / `NgComponentOutlet` | a component decided at runtime | the argument is a class carrying `ɵcmp` |
| `[innerHTML]` | arbitrary markup, sanitized | **nothing in it is compiled** — no bindings, no directives, no components |

That last row is the one that costs people a day, and it is the honest edge of the whole design: the
only way to render markup Angular has not seen is to hand it to the browser directly, at which point
it is DOM and nothing more.

## Gotchas

**★ Symptom: you built markup as a string, bound it with `[innerHTML]`, and your `<app-price-tag>` appears in the DOM inspector doing absolutely nothing.** Cause: `[innerHTML]` writes markup into an element through the sanitizer. It does not run the compiler, so nothing inside it is matched against selectors, no binding is created and no component is instantiated — the element is inert unknown markup. Fix: choose among *compiled* components rather than composing strings, which is what `NgComponentOutlet` exists for:

```ts
import {Component, Type, signal} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {PriceTag} from './price-tag';
import {StockBadge} from './stock-badge';

@Component({
  selector: 'app-product-cell',
  imports: [NgComponentOutlet],
  template: `<ng-container [ngComponentOutlet]="widget()" />`,
})
export class ProductCell {
  // A class, not a string. This is the only currency the renderer accepts.
  protected readonly widget = signal<Type<unknown>>(PriceTag);

  protected showStock(): void {
    this.widget.set(StockBadge);
  }
}
```

**★ Symptom: you need server-driven UI — the backend decides which widgets to show — and you reached for building template strings and compiling them at runtime.** Cause: runtime compilation means shipping `@angular/compiler` and re-introducing everything ahead-of-time compilation removed ([08c](08c-the-instruction-set-is-a-la-carte.md)), and the templates still have to be statically analysable to reference anything. Fix: ship a closed registry of compiled components and let the server choose a *key*, not a template. The set of possible widgets stays a build-time fact; which one appears is a runtime fact:

```ts
import {Component, Type, input} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {HeroBanner} from './hero-banner';
import {PromoGrid} from './promo-grid';
import {NewsletterSignup} from './newsletter-signup';

const WIDGETS: Readonly<Record<string, Type<unknown>>> = {
  hero: HeroBanner,
  promos: PromoGrid,
  newsletter: NewsletterSignup,
};

@Component({
  selector: 'app-cms-slot',
  imports: [NgComponentOutlet],
  template: `
    @if (component(); as cmp) {
      <ng-container [ngComponentOutlet]="cmp" />
    } @else {
      <div class="unknown-widget">Unsupported widget: {{ kind() }}</div>
    }
  `,
})
export class CmsSlot {
  readonly kind = input.required<string>();

  protected component(): Type<unknown> | null {
    return WIDGETS[this.kind()] ?? null;
  }
}
```

**★ Symptom: a component rendered through `createComponent` shows up but its inputs are always undefined, and binding syntax is nowhere to be seen.** Cause: there is no template around it, so there are no bindings — a dynamically created component is attached to a view container, not written into a parent's instruction stream, so no `ɵɵproperty` call exists for it. Fix: push values in through `setInput` on the returned `ComponentRef`, and keep doing so whenever they change; the change detector will pick them up on the next pass:

```ts
import {Component, ComponentRef, ViewContainerRef, effect, signal, viewChild} from '@angular/core';
import {GaugeWidget} from './gauge-widget';

@Component({
  selector: 'app-gauge-host',
  template: `<ng-container #slot />`,
})
export class GaugeHost {
  private readonly slot = viewChild.required('slot', {read: ViewContainerRef});
  private ref: ComponentRef<GaugeWidget> | null = null;

  protected readonly reading = signal(0);

  constructor() {
    effect(() => {
      const value = this.reading();
      this.ref ??= this.slot().createComponent(GaugeWidget);
      // No template means no binding: the value has to be pushed.
      this.ref.setInput('value', value);
    });
  }
}
```

**Symptom: a widget registry keyed by a string works in development and one entry is missing in the production bundle.** Cause: a registry only retains what it *references*. If an entry is populated indirectly — resolved from a string with a dynamic property access on a module namespace, or registered by a side-effecting import that the bundler decided was unused — the class is not reachable and gets dropped. This is reference inversion working exactly as designed and against you. Fix: make every entry a direct, static reference in the registry file, and if you want the widget lazy, make it an explicit dynamic `import()` so the reference is real and the chunk boundary is deliberate:

```ts
import {Type} from '@angular/core';

// Every value is a real reference the bundler can follow — and each `import()`
// is an explicit chunk boundary rather than an accident.
export const LAZY_WIDGETS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  hero: () => import('./hero-banner').then((m) => m.HeroBanner),
  promos: () => import('./promo-grid').then((m) => m.PromoGrid),
  newsletter: () => import('./newsletter-signup').then((m) => m.NewsletterSignup),
};
```

## Interview questions

**★ `[innerHTML]` puts arbitrary markup on the page. Why doesn't a component inside it work?**
Because it goes to the browser, not to Angular. The binding writes a string into an element through
the sanitizer; the browser parses it into DOM nodes and stops there. Nothing runs selector matching
against those nodes, so no directive or component is instantiated, and nothing allocates `LView`
slots for them, so no binding exists to update. The result is inert markup that looks correct in the
inspector and does nothing. It is the sharpest illustration of the whole design: the only content
Angular can animate is content it compiled, and `[innerHTML]` is the one door that bypasses the
compiler entirely — which is also why it is the door with a sanitizer bolted to it.

**★ `ComponentType<T>` is `Type<T>` plus a `ɵcmp` field. What does that tell you about the boundaries of dynamic rendering?**
That "renderable" is not a capability the framework can grant at runtime — it is a property a class
either has or does not have, established at compile time, and the type system says so in one line.
The doc comment is explicit that the `ɵcmp` field is what makes a class *"consumable for
rendering"*. Every dynamic API therefore takes a class rather than a description. The design
consequence is that the set of things your application can ever render is fixed by your build and
only the choice among them is dynamic, which is exactly why the correct shape for server-driven UI
in Angular is a registry keyed by a discriminator rather than a template pipeline — and why that
registry has to hold direct references, since a bundler keeps what is referenced and nothing else.

**★ How do you render a component chosen at runtime, and what changes about inputs when you do?**
You call `ViewContainerRef.createComponent(SomeClass)` — or use `NgComponentOutlet`, which wraps the
same idea declaratively — and you get back a `ComponentRef`. What changes is that there is no
template around the component, so there are no bindings for it: nothing emitted a `ɵɵproperty` call
naming its inputs, because no template mentioned it. Values have to be pushed with
`ComponentRef.setInput`, and pushed again when they change. That is also the honest reason to prefer
`@if` over dynamic creation whenever the set of candidates is small and known: the declarative form
gets bindings, lifecycle and type checking; the dynamic form gets a reference and a manual push.

**Does dynamic component rendering escape the tree-shaking argument, since the class is chosen at runtime?**
No — it depends on it. The class still has to be reachable from the entry point for it to exist in
the bundle at all, and it becomes reachable exactly the way everything else does: some file
`import`s it and names it. A registry mapping `'hero'` to `HeroBanner` is a set of ordinary
references, so the bundler keeps all of them; a registry that tried to resolve the name dynamically
would have nothing to keep. That is why the lazy form is written as an explicit `import()` per
entry — it turns "I might need this" into a real reference *and* a real chunk boundary, instead of
hoping a bundler infers one.

---

← Prev: [08d · What the fixed shape costs](08d-what-the-fixed-shape-costs.md) · Index: [Topic index](README.md) · Next → [08f · The cost of generated code](08f-the-cost-of-generated-code.md)
