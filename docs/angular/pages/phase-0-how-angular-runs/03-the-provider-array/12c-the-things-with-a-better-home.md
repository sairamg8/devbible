---
title: "Triage steps one and three are the same argument about ownership — a class that can carry its own provider record should, and a feature that owns four entries should own the function that returns them"
sidebar_label: "12c · The things with a better home"
sidebar_position: 12.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection),
> [Creating and using services](https://angular.dev/guide/di/creating-and-using-services) — and the
> `core` public-API golden at tag `v22.1.5`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two of the five triage steps are the same argument wearing different clothes: the thing being
configured should own its own configuration.** A class that needs nothing special can carry its
provider record on itself and disappear from the root config entirely; a feature that occupies four
lines of the root config can export one function that returns all four, and then own them. Both
moves take wiring out of the file every team edits and put it next to the code it describes. This
chunk works them in code. The third step — lifetime — is a different axis and is
[12d](12d-lifetime-is-the-whole-question.md).

## Step 1 — the class that can declare itself

**The test:** does this class need an override, constructor injection, a non-root scope, or an
advanced provider key such as `useClass` or `useExisting`? If the answer to all four is no, it
should carry its own record and the config line should go.

```ts
// before — app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    ReportingService,
    PricingCalculator,
    {provide: FeatureFlags, useClass: FeatureFlags},
  ],
};
```

```ts
// after — app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
};

// reporting.ts
@Service()
export class ReportingService {
  private readonly http = inject(HttpClient);
}

// pricing-calculator.ts
@Service()
export class PricingCalculator {
  private readonly flags = inject(FeatureFlags);
}

// feature-flags.ts — @Injectable, because this one is overridden in tests
@Injectable({providedIn: 'root'})
export class FeatureFlags {}
```

Three notes on that rewrite, each of which is a mistake people make in it.

**`{provide: FeatureFlags, useClass: FeatureFlags}` was always a no-op.** A bare class in the array
already means exactly that. When you find that form it is usually the residue of an override that
was reverted, and the class can declare itself like the others.

**`@Service()` cannot express everything `@Injectable` can.** angular.dev calls it *"a modern,
ergonomic shorthand for the traditional `@Injectable({ providedIn: 'root' })` syntax"*, and the
capability table on
[Creating and using services](https://angular.dev/guide/di/creating-and-using-services) is explicit
that it does **not** support constructor-based DI, advanced provider keys, or non-root scopes.
`inject()` works in both. The full table is reproduced in **14 · `providedIn: 'root'` vs listing in
the array** *(not written yet)*; for triage purposes, if the class takes its dependencies through a
constructor, either convert them to `inject()` or use `@Injectable({providedIn: 'root'})`.

**Keeping both the decorator and the array entry is worse than either alone.** The record from the
array wins ([12b](12b-collisions-multi-tokens-and-the-triage-order.md)) and the static reference
defeats the tree-shaking the decorator existed to enable, so you pay the bundle cost and get none
of the benefit. The same page's tree-shaking callout is quoted in
[12](12-what-does-not-belong.md).

## Step 3 — the three entries that were always one feature

```ts
// before — app.config.ts, four of its lines belong to billing
providers: [
  provideRouter(routes),
  provideHttpClient(),
  BillingClient,
  {provide: BILLING_CONFIG, useValue: {currency: 'EUR', retries: 3}},
  {provide: APP_INITIALIZER, useValue: () => inject(BillingClient).warm(), multi: true},
]
```

```ts
// after — billing/provide-billing.ts, next to the code it configures
export function provideBilling(config: BillingConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    BillingClient,
    {provide: BILLING_CONFIG, useValue: config},
    provideAppInitializer(() => inject(BillingClient).warm()),
  ]);
}

// app.config.ts
providers: [
  provideRouter(routes),
  provideHttpClient(),
  provideBilling({currency: 'EUR', retries: 3}),
]
```

The mechanics — `makeEnvironmentProviders`, `with*` features, `ngDevMode` validation, and the one
rule that keeps optional features tree-shakable — are
[04 · Writing your own `provide*` function](04-writing-your-own-provide-function.md). The judgement
call is the part that belongs here: **the win is not the three lines.** It is that adding a fourth
billing service is now a change inside `billing/`, reviewed by whoever owns billing, instead of a
change to the file every feature in the application also edits.

Note the second thing the rewrite did: the hand-written `{provide: APP_INITIALIZER, useValue: fn,
multi: true}` became `provideAppInitializer(fn)`. That is not cosmetic either — the hand-written
form is the one that produces `Cannot mix multi providers and regular providers` the day somebody
writes the same token without `multi: true`
([12b](12b-collisions-multi-tokens-and-the-triage-order.md)), and the typed function cannot make
that mistake. [06](06-startup-and-error-listener-providers.md) covers what the initializer itself
guarantees.

⚠️ **Do step 1 before step 3, always.** Packaging four entries into a `provideBilling()` when three
of them were classes that could have declared themselves gives you a tidy-looking function that
still holds three unnecessary static references — and now they are one level further from the
reviewer who would have noticed.

And once a feature has its own `provide*`, ask the lifetime question again: if only the `/billing`
route uses it, `provideBilling()` belongs in that route's `providers`, where it loads with the
route rather than at bootstrap. That is [12d](12d-lifetime-is-the-whole-question.md).

## Gotchas

**★ Symptom: you added `@Service()` and left the class in `app.config.ts` "to be safe", and the
bundle did not shrink.** Cause: the array entry is a static reference, so the class stays
reachable; the decorator's tree-shaking benefit only exists when nothing statically references the
class. Fix: delete the array entry. The decorator is not a supplement to the entry, it is a
replacement for it.

**★ Symptom: `@Service()` on a class with constructor injection does not compile, or the
dependencies arrive `undefined`.** Cause: the capability table is explicit that `@Service` does not
support constructor-based DI. Fix: convert the parameters to `inject()` calls in field
initialisers, or use `@Injectable({providedIn: 'root'})`, which supports both:

```ts
// does not work
@Service()
export class ReportingService {
  constructor(private readonly http: HttpClient) {}
}

// works
@Service()
export class ReportingService {
  private readonly http = inject(HttpClient);
}
```

**★ Symptom: you removed a class from the array, added `@Service()`, and a test that used to
override it with `useClass` now gets the real implementation.** Cause: nothing about the decorator
prevents an override — `TestBed.configureTestingModule({providers: [{provide: ReportingService,
useClass: FakeReporting}]})` still wins — but a test that was overriding the *token by string* or
relying on the class not being provided at all will now find a real record where it previously
found none. Fix: keep the override explicit in the test's providers; if the class is a deliberate
seam, prefer `@Injectable({providedIn: 'root'})` and say so in a comment, because that is the form
readers associate with "expected to be replaced".

**★ Symptom: your new `provideBilling()` is called from `app.config.ts` and again from the
`/billing` route, and the initializer runs once while the client is instantiated twice.** Cause:
two injectors, two `BillingClient` records — but `APP_INITIALIZER` is consumed once, at bootstrap,
from the root injector only. Fix: call `provideBilling()` in exactly one place. The double-call
failure mode is worked in [04](04-writing-your-own-provide-function.md), and the initializer half
in [06b](06b-initializer-ordering-and-failure.md).

**★ Symptom: you collapsed a feature into `provideFeature()` and a component that lists one of its
services in its own `providers` now gets a service with no configuration.** Cause: the component
injector creates a fresh record for the class; its dependencies still resolve by walking up, so the
config token is found, but the *instance* is per-component and misses anything the feature's
initializer did to the shared one. Fix: do not list a feature's own services in a component's
`providers` — [04](04-writing-your-own-provide-function.md) has the same gotcha from the library
author's side.

**★ Symptom: after collapsing four entries into one `provideBilling()`, the billing code is in the
initial bundle even though only one lazy route uses it.** Cause: the call site is still
`app.config.ts`, and reachability follows the import, not the directory. Packaging changed who owns
the wiring, not when it loads. Fix: move the call to the route's `providers`
([12d](12d-lifetime-is-the-whole-question.md)) — packaging and scoping are two separate wins and
you have to take them separately.

**★ Symptom: your `provideBilling()` grew a `defaults` object listing every optional feature, and
now nothing tree-shakes.** Cause: the base function references the implementations it was supposed
not to know about, so every feature is reachable from a call to the base. Fix: keep the base
`provide*` free of any reference to an optional feature's implementation; that is the single rule
in [04](04-writing-your-own-provide-function.md), and a "documentation" constant is the usual way
it gets broken months later.

## Interview questions

**★ When is `@Service()` the wrong answer even though the class could technically take it?**
When the class is a seam. If you override it in tests with `useClass`, or a consumer of your library
is expected to swap it, or it needs a non-root scope, `@Service()` cannot express any of that — and
`@Injectable({providedIn: 'root'})` plus an explicit array entry at the override site is the honest
encoding. It is also the wrong answer for anything that is not a class: a configuration object, a
function, an interface-typed value. Those need an `InjectionToken`, which is
[12e](12e-untyped-values-and-string-tokens.md). The nuance worth stating in an interview is that
"can it take `@Service()`" and "should it" are different questions — the decorator's whole benefit
is tree-shaking, and a class that everything injects anyway gains nothing from it, while a class
that is a documented extension point actively loses clarity.

**★ Why run the triage in the order delete, move, collapse rather than collapsing first?**
Because collapsing hides the evidence for the other two steps. A `provideBilling()` that wraps four
entries looks like one well-organised line, and nobody afterwards asks whether three of those four
were classes that could have carried their own record — the static references are still there, they
are just one file further from review. Deleting first shrinks the problem, moving second puts what
remains at the right scope, and collapsing last packages only what genuinely has to be packaged.
The same argument applies inside a feature: a `provide*` function is a good home for configuration
tokens, multi contributions and overrides, and a bad hiding place for services that never needed a
provider entry at all.

**★ Your `provideBilling()` returns `EnvironmentProviders`. What did that buy you over returning
`Provider[]`?**
It makes the return value un-placeable on a component, which for application-wide wiring is always
what you want — a helper returning `Provider[]` can be spread into a component's `providers` by
anyone, and the result is a second copy of a subsystem rather than an error. It also makes the
package opaque: consumers cannot filter or reorder what is inside, so you can change the internal
provider set in a patch release. The cost is symmetrical and worth stating: you cannot inspect it
either, and a consumer who needs to override one token inside it has to know which token, because
the wrapper will not tell them. [03](03-environmentproviders-vs-provider.md) has the branded type
and [04](04-writing-your-own-provide-function.md) the construction.

**★ A reviewer asks why a feature's `provide*` function lives in the feature directory rather than
next to `app.config.ts` with the other wiring. What is the answer?**
Because the point of the refactor is change locality, and putting it next to `app.config.ts` throws
that away while keeping the extra indirection. The measure of whether the move worked is what a
future change looks like: adding a fifth billing service should touch only files under `billing/`,
should be reviewed by whoever owns billing, and should not appear in the diff of the file every
other team also edits. If the function lives beside the root config, every one of those is still
false and you have gained one function call. The secondary benefit follows from the same
arrangement — a feature that owns its `provide*` can later be moved behind a lazy route, or
published as a package, without the root config changing at all.

{/* FOOTER */}
