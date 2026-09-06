---
title: "`schemas` moved from the NgModule to the component, which turned a feature-wide escape hatch into a one-template one — and it still buys you nothing at runtime, because a schema silences the compiler, not the browser"
sidebar_label: "06g · Where `schemas` lives"
sidebar_position: 6.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8001 Invalid Element](https://angular.dev/errors/NG8001) —
> and `angular/angular` at tag `v22.1.5`:
> [`core/src/metadata/directives.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/directives.ts),
> [`core/src/metadata/ng_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/ng_module.ts),
> [`compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`compiler/src/schema/dom_element_schema_registry.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/schema/dom_element_schema_registry.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two things about `schemas` are usually learned the hard way. The first is that it is now a
`@Component` field and only a standalone one — putting it on a `standalone: false` class is NG2010,
and the field still exists on `@NgModule` for exactly the components that module declares. That move
is a narrowing: an escape hatch opened for one third-party widget used to switch off element
validation for every component in the module, and now it covers one template. The second is that a
schema is a statement to the *compiler* and nothing else. It does not define a custom element, does
not import one, and does not make the browser upgrade a tag. A component with
`CUSTOM_ELEMENTS_SCHEMA` and no registration renders an inert unknown element with your attributes
set and no behaviour attached, silently and with a clean build.**

## Per component, not per module

In v22 `schemas` sits on `@Component`, alongside `imports`, and carries the same standalone-only
restriction. Putting it on a `standalone: false` component is **NG2010**, raised from `handler.ts`
with the message verbatim:

```
'schemas' is only valid on a component that is standalone.
```

The field is still declared on `@NgModule` too — the v22.1.5 interface lists `providers`,
`declarations`, `imports`, `exports`, `bootstrap`, `schemas`, `id` and `jit` — so a legacy module can
still relax validation for everything it declares. That is precisely the behaviour the component-level
field replaced.

| | `@NgModule.schemas` | `@Component.schemas` (v22) |
|---|---|---|
| Applies to | every component in `declarations` | one template |
| Opened by | whoever edited the module | whoever wrote the tag |
| Blast radius of a mistake | a whole feature area silently stops checking elements | one file |
| Legal on a non-standalone class | yes | no — NG2010 |

The practical rule that follows: **put the schema on the smallest component that needs it.** A thin
wrapper around the third-party element keeps validation on for everything else, including your own
hyphenated selectors, which `CUSTOM_ELEMENTS_SCHEMA` would otherwise stop checking.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, input, output } from '@angular/core';
import './vendor/stripe-card-element';

@Component({
  selector: 'app-stripe-card',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<stripe-card-element [publishableKey]="key()" (token)="token.emit($event)" />`,
})
export class StripeCard {
  readonly key = input.required<string>();
  readonly token = output<Event>();
}
```

Everything above that wrapper stays fully checked:

```ts
@Component({
  selector: 'app-checkout',
  imports: [StripeCard],
  template: `<app-stripe-card [key]="publishableKey" (token)="onToken($event)" />`,
})
export class Checkout {
  readonly publishableKey = 'pk_live_placeholder';

  onToken(event: Event): void {
    console.warn('token event', event);
  }
}
```

## A schema silences the compiler, not the browser

`hasElement` and `hasProperty` run at build time. Nothing in Angular calls
`customElements.define()` on your behalf, and nothing checks that anything else did. So the two
failure modes are completely independent:

- **Build passes, element undefined.** The tag renders as an inert unknown element. Your attribute
  bindings are set on it, no behaviour is attached, and there is no error anywhere.
- **Element defined, build fails.** The registration happened in some other entry point that the
  compiler cannot see, and you still need the schema.

The fix for the first is to import the vendor module for its side effect in the same file as the
template that uses it, so the definition travels with the component and cannot be tree-shaken away
from it:

```ts
import './vendor/stripe-card-element';
```

⚠️ **This is the asymmetry to keep in mind:** checking is relaxed at compile time and there is no
check at all at run time. That is the real cost of the escape hatch, and the reason to keep its scope
as small as possible.

## Gotchas

**★ Symptom: `schemas: [CUSTOM_ELEMENTS_SCHEMA]` produces `'schemas' is only valid on a component that
is standalone.`** Cause: the component still carries `standalone: false`, so NG2010 fires on the
`schemas` property before the template is ever checked. Fix: delete `standalone: false` and move the
class's template dependencies into its own `imports`; `schemas` becomes legal in the same edit:

```ts
@Component({
  selector: 'app-checkout',
  imports: [DatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<stripe-card-element [publishableKey]="key" /><p>{{ now | date }}</p>`,
})
export class Checkout {
  readonly key = 'pk_live_placeholder';
  readonly now = new Date();
}
```

**★ Symptom: the custom element passes compilation but renders as an empty tag with no behaviour.**
Cause: the schema tells Angular's compiler to stop checking; it does not tell the browser to define
the element. If the script calling `customElements.define()` never ran, nothing upgrades the tag. Fix:
import the vendor module for its side effect in the component file, so the definition cannot be
separated from the template that needs it:

```ts
import './vendor/stripe-card-element';
```

**★ Symptom: an input on your own component stops being type-checked after you add a schema.** Cause:
`hasProperty` returns `true` for *any* property on a hyphenated tag once `CUSTOM_ELEMENTS_SCHEMA` is
present — and your own component selectors are hyphenated too, so they fall in the same branch. Fix:
move the schema onto the smallest wrapper component and keep the page component clean:

```ts
@Component({
  selector: 'app-stripe-card',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<stripe-card-element [publishableKey]="key()" />`,
})
export class StripeCard {
  readonly key = input.required<string>();
}
```

**★ Symptom: a legacy area of the app never reports unknown elements at all.** Cause: an
`@NgModule.schemas` entry somewhere, applying to every component that module declares — the field
still exists in v22.1.5. Fix: remove it from the module, then add `CUSTOM_ELEMENTS_SCHEMA` to the one
or two components that genuinely need it. Expect real errors to surface; they were being suppressed,
not absent.

**★ Symptom: you moved a component into a different file and its custom element started failing
again.** Cause: `schemas` is per component, so it travelled with the class — but the side-effect
`import` that registered the element stayed behind in the old file. Fix: keep the registration import
next to the `schemas` declaration; they are two halves of the same decision and should never live
apart.

**★ Symptom: a shared `schemas` constant does not apply everywhere you expected.** Cause: there is no
inheritance and no ambient schema — the array is read per component from that component's own
metadata. Fix: nothing shared will help; either repeat the entry on each component that needs it, or
better, wrap the foreign element once and import the wrapper:

```ts
export const CUSTOM_ELEMENTS = [CUSTOM_ELEMENTS_SCHEMA];

@Component({
  selector: 'app-stripe-card',
  schemas: CUSTOM_ELEMENTS,
  template: `<stripe-card-element [publishableKey]="key()" />`,
})
export class StripeCard {
  readonly key = input.required<string>();
}
```

## Interview questions

**★ What is the difference between `CUSTOM_ELEMENTS_SCHEMA` on a component and the old
`@NgModule.schemas`?**
Scope. In the module world one entry relaxed element validation for every component the module
declared, which meant one third-party integration silently disabled typo detection across a whole
feature area. In v22 `schemas` is a `@Component` field applying to that component's template only, and
putting it on a non-standalone component is NG2010. The escape hatch got narrower without getting
weaker — and the right practice follows from that: put it on the smallest wrapper component you can,
because `CUSTOM_ELEMENTS_SCHEMA` also stops checking your own hyphenated selectors in that template.

**★ If schemas only affect compile-time checking, what stops a bad custom element from breaking at
runtime?**
Nothing in Angular. The schema removes a compile-time objection; whether the element exists is decided
by whatever calls `customElements.define()`, and Angular has no visibility into that. An undefined
custom element renders as an inert unknown element with your attributes set and no behaviour attached,
silently and with a clean build. That asymmetry — checking relaxed at build time, no check at all at
run time — is the real cost of the escape hatch.

**Why is there no way to declare a schema once for a whole standalone application?**
Because that is exactly what the `NgModule` version was, and it was the problem. A schema is a
statement that *this template* contains markup Angular does not own; making it global would restore
the ambient behaviour the whole standalone model exists to remove, and would mean a typo anywhere in
the app went unreported. The verbosity of repeating it, or of writing one wrapper component, is the
mechanism that keeps the relaxation visible in the file it affects.

**A colleague proposes adding `NO_ERRORS_SCHEMA` to the root component to "stop the noise". What do
you say?**
That it does nothing for child components — schemas are per component and do not inherit — and that on
the root component itself it disables both element and property validation for that template
permanently. The noise is a list of real defects: missing imports, misspelled selectors, and bindings
to properties that do not exist. The correct response is to fix the imports, and to reach for
`CUSTOM_ELEMENTS_SCHEMA` on a single wrapper if a genuine foreign element is involved.

**Why should the side-effect import that registers a custom element live in the same file as the
`schemas` declaration?**
Because they are the two halves of one decision, and only one of them is checked. If the registration
sits in a distant entry point, a refactor can move or tree-shake it away and the only symptom is a tag
that renders inert — no build error, no runtime error, nothing to search for. Keeping
`import './vendor/stripe-card-element'` next to `schemas: [CUSTOM_ELEMENTS_SCHEMA]` makes the coupling
visible in the file that depends on it.

---

← Prev: [What `schemas` actually does](06f-what-schemas-actually-does.md) · Index: [Topic index](README.md) · Next → **07 · What replaced each `NgModule` responsibility** *(not written yet)*
