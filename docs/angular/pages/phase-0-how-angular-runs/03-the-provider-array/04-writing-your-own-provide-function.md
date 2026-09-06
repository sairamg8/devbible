---
title: "Any wiring your own codebase repeats in app.config.ts should become a provide* function, and the framework hands you every piece needed to build one"
sidebar_label: "04 · Writing your own provide*"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`makeEnvironmentProviders`](https://angular.dev/api/core/makeEnvironmentProviders),
> [`provideEnvironmentInitializer`](https://angular.dev/api/core/provideEnvironmentInitializer),
> [`InjectionToken`](https://angular.dev/api/core/InjectionToken) — and `angular/angular` at tag
> `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts)
> (the reference implementation of the feature pattern),
> [`di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts).
> Documentation-validated; **no sandbox run**.

**The `provide*`/`with*` convention is not privileged framework machinery. It is
`makeEnvironmentProviders` plus a discriminated union, and copying it for your own feature areas is
the single highest-leverage thing you can do to keep `app.config.ts` from turning into a
forty-entry list — because it moves each subsystem's wiring next to the subsystem.**

## The minimum viable `provideX()`

Three ingredients: a typed token for the configuration, the services, and a wrapper.

```ts
// src/app/billing/billing.providers.ts
import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
  Provider,
} from '@angular/core';
import { BillingClient } from './billing-client';
import { BillingCache } from './billing-cache';

export interface BillingConfig {
  readonly endpoint: string;
  readonly currency: 'GBP' | 'EUR' | 'USD';
  readonly retryLimit: number;
}

export const BILLING_CONFIG = new InjectionToken<BillingConfig>('billing.config');

export function provideBilling(config: BillingConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: BILLING_CONFIG, useValue: config },
    BillingClient,
    BillingCache,
  ]);
}
```

The application config now says one thing instead of four:

```ts
// src/app/app.config.ts
providers: [
  provideBilling({ endpoint: '/api/billing', currency: 'GBP', retryLimit: 3 }),
]
```

Everything the feature needs is declared in the feature's own directory, `BILLING_CONFIG` is not
exported into the application's vocabulary unless someone imports it, and adding a fourth service
to billing does not touch `app.config.ts`.

## Adding features, the way the framework does

The framework's own feature objects are a two-field discriminated record. Copy the shape:

```ts
// src/app/billing/billing.providers.ts (continued)
export const enum BillingFeatureKind {
  Interceptors,
  OfflineQueue,
  Telemetry,
}

export interface BillingFeature<KindT extends BillingFeatureKind> {
  ɵkind: KindT;
  ɵproviders: Provider[];
}

function billingFeature<KindT extends BillingFeatureKind>(
  kind: KindT,
  providers: Provider[],
): BillingFeature<KindT> {
  return { ɵkind: kind, ɵproviders: providers };
}

export function withOfflineQueue(
  options: { maxEntries: number } = { maxEntries: 100 },
): BillingFeature<BillingFeatureKind.OfflineQueue> {
  return billingFeature(BillingFeatureKind.OfflineQueue, [
    OfflineQueue,
    { provide: OFFLINE_QUEUE_LIMIT, useValue: options.maxEntries },
  ]);
}

export function withTelemetry(): BillingFeature<BillingFeatureKind.Telemetry> {
  return billingFeature(BillingFeatureKind.Telemetry, [
    { provide: BILLING_EVENT_SINKS, useClass: TelemetrySink, multi: true },
  ]);
}
```

and make the base function variadic over them:

```ts
export function provideBilling(
  config: BillingConfig,
  ...features: BillingFeature<BillingFeatureKind>[]
): EnvironmentProviders {
  if (ngDevMode) {
    const kinds = new Set(features.map((f) => f.ɵkind));
    if (kinds.size !== features.length) {
      throw new Error(
        `Configuration error: a billing feature was passed twice to provideBilling().`,
      );
    }
  }

  const providers: Provider[] = [
    { provide: BILLING_CONFIG, useValue: config },
    BillingClient,
    BillingCache,
  ];

  for (const feature of features) {
    providers.push(...feature.ɵproviders);
  }

  return makeEnvironmentProviders(providers);
}
```

That loop is not a paraphrase — it is the shape `provideHttpClient` uses verbatim:

```ts
for (const feature of features) {
  providers.push(...feature.ɵproviders);
}

return makeEnvironmentProviders(providers);
```

## `ngDevMode` and the validation you get for free

`ngDevMode` is a global the Angular build defines and sets to `false` (and then dead-code-eliminates)
in a production build. Guarding your validation with it means the checks cost nothing in production
— which is why `provideHttpClient` can afford to build a `Set` of feature kinds on every call.

Two rules for using it in library-shaped code:

- Write `if (ngDevMode)` when the file is only ever loaded by an Angular build, and
  `if (typeof ngDevMode === 'undefined' || ngDevMode)` when it might be loaded by something else —
  the framework uses the long form in files that run before the global is guaranteed. Angular's own
  `provideHttpClient` uses the short form; `provideZonelessChangeDetection` uses the long one.
- **Throw for a contradiction, warn for a suspicion.** `provideHttpClient` throws when
  `withXsrfConfiguration()` and `withNoXsrfProtection()` are both present, because no behaviour is
  correct. The framework only *warns* when both `provideZoneChangeDetection` and
  `provideZonelessChangeDetection` are present, because one of them does win and the app still runs.

## Initialisers inside your own provider

If the feature has startup work, put it inside the provider rather than asking every consumer to
remember a second entry:

```ts
export function withOfflineQueue(
  options: { maxEntries: number } = { maxEntries: 100 },
): BillingFeature<BillingFeatureKind.OfflineQueue> {
  return billingFeature(BillingFeatureKind.OfflineQueue, [
    OfflineQueue,
    { provide: OFFLINE_QUEUE_LIMIT, useValue: options.maxEntries },
    provideEnvironmentInitializer(() => {
      inject(OfflineQueue).restoreFromStorage();
    }),
  ]);
}
```

`provideEnvironmentInitializer(initializerFn: () => void)` returns `EnvironmentProviders`, and
`makeEnvironmentProviders` accepts `(Provider | EnvironmentProviders)[]`, so nesting is legal — but
the array literal above is `Provider[]` because it is a *feature's* `ɵproviders`. If you need an
initializer inside a feature, either widen that array's type or move the initializer up into the
base `provide*` call. Angular's router does the latter:
`withEnabledBlockingInitialNavigation()` builds a `Provider[]` containing a
`provideAppInitializer(...)` result, which works because `Provider` includes `any[]` and the
collection walk flattens nested arrays and wrappers alike.

🔴 **Choose the initializer deliberately.** `provideEnvironmentInitializer` is **not awaited**;
`provideAppInitializer` is. [Chunk 06](06-startup-and-error-listener-providers.md) is the full
comparison.

## Making it tree-shakable — the one rule

The base `provide*` must not reference an optional feature's implementation. In the example above,
`OfflineQueue` and `TelemetrySink` are imported by `withOfflineQueue` and `withTelemetry`
respectively, and nothing in `provideBilling`'s body mentions them. An application that calls
`provideBilling(config)` and never `withOfflineQueue()` has no import path to `OfflineQueue`, so the
bundler drops it.

The failure mode is subtle and easy to introduce later: add a `defaults` object at module scope that
references every feature "just for documentation", and every feature becomes reachable again.

## Gotchas

**★ Symptom: your `provideBilling()` works in the app but a component that lists `BillingClient` in
its own `providers` gets a *second* instance with no config.** Cause: `BILLING_CONFIG` lives in the
environment injector; `BillingClient` listed on a component creates a fresh record in the component
injector, which resolves its dependencies starting there and finds the config by walking up — but
the *client itself* is now per-component. Fix: do not list your feature's services in component
`providers`. If a component genuinely needs an isolated instance, give it an explicitly
component-scoped class, not the shared one.

**★ Symptom: calling `provideBilling()` twice (once in `app.config.ts`, once on a route) silently
uses the first configuration for services created before navigation and the second afterwards.**
Cause: the route call creates a route injector with its own `BILLING_CONFIG` record; anything
already instantiated against the application injector keeps the application's config. Fix: pick one
level. If billing is application-wide, call it once in `app.config.ts`; if it is feature-scoped,
remove it from `app.config.ts` entirely — [chunk 15](15-route-level-providers.md).

**★ Symptom: `ReferenceError: ngDevMode is not defined` in a unit test or a Node script.** Cause: the
bare `if (ngDevMode)` form assumes the Angular build has defined the global. Fix: use the defensive
form in code that can be loaded outside an Angular build —

```ts
if (typeof ngDevMode === 'undefined' || ngDevMode) {
  // validation
}
```

**★ Symptom: your library's `provideX()` is fine, but consumers report the bundle contains features
they never enabled.** Cause: something in the base function's module scope references the optional
implementations — a `const ALL_FEATURES = [withTelemetry, withOfflineQueue]` for docs, a re-export
barrel that the base file imports from, or a default-options object naming a feature class. Fix:
keep each feature's implementation in its own module, have only the `with*` function import it, and
never have the base file import the barrel.

**★ Symptom: TypeScript accepts `provideBilling(config, withOfflineQueue(), withOfflineQueue())`.**
Cause: the variadic parameter is typed by the union of kinds, not by uniqueness; the type system
cannot express "at most one of each". Fix: check it at runtime under `ngDevMode`, as the example
above does. This is exactly why the framework's feature objects carry `ɵkind` at all.

**★ Symptom: you export `BILLING_CONFIG` and consumers start overriding it directly with
`{ provide: BILLING_CONFIG, useValue: ... }` after your `provideBilling()` call.** Cause: last
non-multi provider wins, so this works — and now your validation is bypassed and your function is no
longer the only way to configure the feature. Fix: decide. If that is a supported extension point,
document it; if not, keep the token internal to the feature directory and export only
`provideBilling` and the `with*` functions.

## Interview questions

**★ You have twelve entries in `app.config.ts` and three of them belong to the same feature. What do
you do?**
Write a `provideThatFeature()` in the feature's own directory that returns
`makeEnvironmentProviders([...those three])`, and replace the three entries with one call. The win
is not the line count — it is that the feature's wiring now lives with the feature, so adding a
fourth service is a change inside the feature and not a change to the application's root
configuration. It also gives you one place to put validation and one place to put an initializer.

**★ What does `makeEnvironmentProviders` buy you that returning a `Provider[]` would not?**
It makes the return value un-placeable on a component. A helper that returns `Provider[]` can be
spread into a component's `providers` array by anyone, which for application-wide wiring is always a
bug and is a very quiet one — you get a second copy of a subsystem rather than an error. The wrapper
converts that into a compile error, and if the compile error is bypassed, into `NG0207`.

**★ How do you make an optional feature of your own library tree-shakable?**
Put its implementation in a module that only the `with*` function imports, and keep the base
`provide*` function free of any reference to it. Reachability from the entry point is what the
bundler follows, so a `with*` function that is never called is a symbol that is never imported. The
common way to lose this is a barrel file or a "list of all features" constant that the base function's
module pulls in.

**Why do Angular's feature objects use `ɵ`-prefixed property names?**
`ɵ` is the framework's marker for "internal, unstable, not part of the public API contract". The
properties have to be enumerable and public for the `provide*` function in another package to read
them, but the prefix signals that consumer code must not. Copying the convention in your own library
sends the same signal to your consumers.

**When should a feature be a `with*` function rather than a field on the options object?**
When enabling it pulls in code. An options field is read at runtime, so its implementation must be
imported unconditionally; a `with*` function is a call site, so its implementation is imported only
when used. Booleans that only change behaviour of already-present code (`retryLimit`, `currency`)
belong in the options object; anything that brings a class, a backend, or a chunk of a third-party
library with it belongs in a feature function.

---

← Prev: [EnvironmentProviders vs Provider](03-environmentproviders-vs-provider.md) · Index: [Topic index](README.md) · Next → [Change detection providers](05-change-detection-providers.md)
