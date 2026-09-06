---
title: "A router feature is a two-property object carrying a kind tag and a provider array, `provideRouter` flattens them without validating anything, and the whole `ExtraOptions` bag from `forRoot` maps onto them one field at a time"
sidebar_label: "08 · Router features, one by one"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideRouter`](https://angular.dev/api/router/provideRouter),
> [`RouterConfigOptions`](https://angular.dev/api/router/RouterConfigOptions),
> [`withHashLocation`](https://angular.dev/api/router/withHashLocation); and `angular/angular` at tag
> `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config.ts),
> [`goldens/public-api/router/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/router/index.api.md),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Twelve `with*` functions are exported from `@angular/router`, and every one of them returns the same
two-property object: a `ɵkind` tag and a `ɵproviders` array.** `provideRouter` does nothing with the
tag. It maps the features to their provider arrays, drops them into the return value, and lets the
injector's ordinary flattening rules decide the rest — which means, unlike `provideHttpClient`, it
performs **no duplicate detection and no contradiction checking at all**. This chunk is the record,
the complete inventory with each function's real stability tag, why the missing validation is a
defensible design rather than an oversight, and the field-by-field mapping from
`RouterModule.forRoot`'s `ExtraOptions` bag onto the feature list. The six chunks that follow take
the features themselves: [08b](08b-with-router-config-and-hash-location.md) is the two that only
write configuration, [08c](08c-with-component-input-binding.md) and
[08d](08d-view-transitions-and-scrolling.md) are the three the user actually notices, and
[08e](08e-preloading-and-navigation-errors.md), [08f](08f-initial-navigation.md) and
[08g](08g-tracing-and-the-experimental-end.md) are the operational, bootstrap-facing and
never-shipped ends of the list.

## The record is three lines

```ts
export interface RouterFeature<FeatureKind extends RouterFeatureKind> {
  ɵkind: FeatureKind;
  ɵproviders: Array<Provider | EnvironmentProviders>;
}

function routerFeature<FeatureKind extends RouterFeatureKind>(
  kind: FeatureKind,
  providers: Array<Provider | EnvironmentProviders>,
): RouterFeature<FeatureKind> {
  return {ɵkind: kind, ɵproviders: providers};
}
```

⚠️ **The router's `ɵproviders` is `Array<Provider | EnvironmentProviders>`, while `HttpFeature`'s is a
bare `Provider[]`.** That difference is not cosmetic: it is what lets
`withEnabledBlockingInitialNavigation()` put a `provideAppInitializer(...)` result — an
`EnvironmentProviders` — directly inside a feature's array. Chunk
[04](04-writing-your-own-provide-function.md) covers the same choice for your own features and what it
costs.

Nothing consumes `ɵkind` inside `@angular/router`. It exists so the *type* of each feature is
distinct, which is what makes `RouterFeatures` a discriminated union and gives you a compile error
when you pass an `HttpFeature` to `provideRouter`.

## The complete inventory at v22.1.5

Every `with*` exported from the router golden, what it actually provides, and its **JSDoc** stability
tag — not the golden's `// @public`, which is API-Extractor's release tag and says nothing about
Angular's own stability promise.

| Function | Provides | Stability | Chunk |
|---|---|---|---|
| `withRouterConfig(options)` | `ROUTER_CONFIGURATION` | `@publicApi` | [08b](08b-with-router-config-and-hash-location.md) |
| `withHashLocation()` | `LocationStrategy` → `HashLocationStrategy` | `@publicApi` | [08b](08b-with-router-config-and-hash-location.md) |
| `withComponentInputBinding(options?)` | `INPUT_BINDER` | `@publicApi` on the type | [08c](08c-with-component-input-binding.md) |
| `withViewTransitions(options?)` | `CREATE_VIEW_TRANSITION`, `VIEW_TRANSITION_OPTIONS` | 🔴 **`@developerPreview 19.0`** | [08d](08d-view-transitions-and-scrolling.md) |
| `withInMemoryScrolling(options?)` | `ROUTER_SCROLLER` | `@publicApi` | [08d](08d-view-transitions-and-scrolling.md) |
| `withPreloading(strategy)` | `ROUTER_PRELOADER`, `PreloadingStrategy` | `@publicApi` | [08e](08e-preloading-and-navigation-errors.md) |
| `withNavigationErrorHandler(handler)` | `NAVIGATION_ERROR_HANDLER` | `@publicApi` | [08e](08e-preloading-and-navigation-errors.md) |
| `withDebugTracing()` | `ENVIRONMENT_INITIALIZER` (dev only) | `@publicApi` | [08g](08g-tracing-and-the-experimental-end.md) |
| `withEnabledBlockingInitialNavigation()` | `INITIAL_NAVIGATION`, `IS_ENABLED_BLOCKING_INITIAL_NAVIGATION`, an app initializer | `@publicApi` | [08f](08f-initial-navigation.md) |
| `withDisabledInitialNavigation()` | `INITIAL_NAVIGATION`, an app initializer | `@publicApi` | [08f](08f-initial-navigation.md) |
| `withExperimentalAutoCleanupInjectors()` | `ROUTE_INJECTOR_CLEANUP` | 🔴 **`@experimental 21.1`** | [08g](08g-tracing-and-the-experimental-end.md) |
| `withExperimentalPlatformNavigation()` | `StateManager`, `Location` | 🔴 **`@experimental 21.1`** | [08g](08g-tracing-and-the-experimental-end.md) |

🔴 **There is a thirteenth, `withRouterResources()`, which is exported from `provide_router.ts` but is
absent from the public-API golden.** Its JSDoc is `@experimental` with no version, and its type alias
is declared as `RouterFeature<RouterFeatureKind.ViewTransitionsFeature>` — it reuses the
view-transitions kind rather than having one of its own. Treat it as internal and do not build on it.

⚠️ **`withRouterFeatures` does not exist.** It is a plausible-sounding name that appears in
third-party material; the golden at `v22.1.5` has no such export. What exists is the *type*
`RouterFeatures`, the union `provideRouter`'s rest parameter accepts.

That union is worth reading beside the enum, because they do not line up:

```ts
export type RouterFeatures =
  | PreloadingFeature
  | DebugTracingFeature
  | InitialNavigationFeature
  | InMemoryScrollingFeature
  | RouterConfigurationFeature
  | NavigationErrorHandlerFeature
  | ComponentInputBindingFeature
  | ViewTransitionsFeature
  | ExperimentalAutoCleanupInjectorsFeature
  | RouterHashLocationFeature
  | ExperimentalPlatformNavigationFeature;

export const enum RouterFeatureKind {
  PreloadingFeature,
  DebugTracingFeature,
  EnabledBlockingInitialNavigationFeature,
  DisabledInitialNavigationFeature,
  InMemoryScrollingFeature,
  RouterConfigurationFeature,
  RouterHashLocationFeature,
  NavigationErrorHandlerFeature,
  ComponentInputBindingFeature,
  ViewTransitionsFeature,
  ExperimentalAutoCleanupInjectorsFeature,
  ExperimentalPlatformNavigationFeature,
}
```

Eleven members in the union, twelve in the enum: the two initial-navigation kinds collapse into one
`InitialNavigationFeature` alias in the union, and `RouterResourcesFeature` is in neither.

## 🔴 `provideRouter` validates nothing, and that is deliberate

`provideHttpClient` builds a `Set` of feature kinds and throws on two specific contradictions:

```ts
      throw new Error(
        `Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in the same call to provideHttpClient(), which is a contradiction.`,
      );
```

`provideRouter` has no equivalent. Its features line is one expression:

```ts
    features.map((feature) => feature.ɵproviders),
```

So passing the same feature twice, or two features that fight over one token, produces no error and no
warning. What happens instead is the ordinary injector rule from chunk 13: the arrays are flattened in
order, and for a **non-multi** token the last record wins.

**Why that is defensible.** Almost every router feature provides a *distinct* token, so a duplicate
degrades to "the same value written twice" and a pair degrades to "the later one wins" — both
well-defined. HTTP's contradictions target the *same* token with opposite meanings, where last-wins
would silently pick a security posture. The router only has one pair that genuinely collides
(`withHashLocation` versus `withExperimentalPlatformNavigation`, both touching location strategy), and
one of those is experimental.

**What it costs you.** Nothing tells you that a feature is redundant, so a feature added twice in two
different files — a shared config helper plus an explicit call — is invisible.

## Every `ExtraOptions` field, and the `with*` it became

`RouterModule.forRoot(routes, options)` took one options object. This is that object, field by field,
against the feature list — chunk [02](02-why-provide-functions-replaced-forroot.md)'s argument made
concrete.

| `ExtraOptions` field | Standalone equivalent |
|---|---|
| `enableTracing` | `withDebugTracing()` |
| `useHash` | `withHashLocation()` |
| `initialNavigation` | `withEnabledBlockingInitialNavigation()` / `withDisabledInitialNavigation()` |
| `bindToComponentInputs` | `withComponentInputBinding(options?)` |
| `enableViewTransitions` | `withViewTransitions(options?)` |
| `errorHandler` | `withNavigationErrorHandler(handler)` |
| `preloadingStrategy` | `withPreloading(strategy)` |
| `anchorScrolling`, `scrollPositionRestoration` | `withInMemoryScrolling(options?)` |
| the six `RouterConfigOptions` fields | `withRouterConfig(options)` |
| `scrollOffset` | ⚠️ **no `with*` counterpart** |

⚠️ **`scrollOffset` is the one field with no feature function.** `withInMemoryScrolling` accepts only
`InMemoryScrollingOptions`, which is `anchorScrolling` and `scrollPositionRestoration`. The feature's
JSDoc carries `@see {@link ViewportScroller}`, which is the injectable the router's scroller uses — so
that is where to look — but **I could not find a documentation sentence naming a standalone
replacement for `scrollOffset`**, and I have not verified the `ViewportScroller` API at v22. Treat this
row as a known gap rather than as a recipe.

Read the table the other way and the design becomes obvious: every row where the option's
implementation is a *class* became a function, because a function that is never called is never
imported. Every row where the option is only a *value* the router reads — the six `RouterConfigOptions`
fields — stayed a value, collected by a single feature.

## Gotchas

**★ Symptom: you passed the same feature twice and nothing complained.** Cause: `provideRouter` does
no duplicate detection whatsoever — its features line is `features.map((feature) => feature.ɵproviders)`,
and the injector flattens the result. For a non-multi token the later record simply wins. Fix: pass
each feature once; if a shared helper already contributes features, compose the list rather than
adding to it —

```ts
// ✅ one place decides the feature list
export function appRouterFeatures(): RouterFeatures[] {
  return [withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })];
}

providers: [provideRouter(routes, ...appRouterFeatures())],
```

**Symptom: a feature you were told is stable turns out to be developer preview.** Cause: reading the
public-API golden, where every entry is tagged `// @public` because that is API-Extractor's release
tag, not Angular's stability marker. `withViewTransitions` is `// @public` in the golden and
`@developerPreview 19.0` in its JSDoc. Fix: read the JSDoc on the function in `provide_router.ts`, or
the tag angular.dev renders on the API page; treat the golden as an inventory, never as a stability
claim.

**Symptom: `withRouterFeatures` cannot be imported.** Cause: it does not exist. `RouterFeatures` is a
*type* — the union `provideRouter`'s rest parameter accepts — and it is the thing to reach for when you
want to hold a list of features in a variable. Fix:

```ts
import { RouterFeatures, withComponentInputBinding, withDebugTracing } from '@angular/router';

const features: RouterFeatures[] = [withComponentInputBinding()];
if (!environment.production) {
  features.push(withDebugTracing());
}
providers: [provideRouter(routes, ...features)];
```

**Symptom: you cannot find the standalone equivalent of `ExtraOptions.scrollOffset`.** Cause: there is
not one in the `with*` list — `withInMemoryScrolling` accepts only `anchorScrolling` and
`scrollPositionRestoration`. Fix: none that I can source. The feature's JSDoc points at
`ViewportScroller` with `@see {@link ViewportScroller}`, which is where to look, but **the
documentation I checked does not state a standalone replacement**; do not assume one exists without
verifying it against the `ViewportScroller` API for the version you are on.

## Interview questions

**★ `provideHttpClient` throws on contradictory features and `provideRouter` validates nothing at all.
Is that an inconsistency?**
No, and the reason is what each set of features provides. Almost every router feature writes a
*distinct* token, so passing one twice degrades to writing the same value twice and passing two
related ones degrades to last-wins — both well-defined outcomes with a visible cause. HTTP's
contradictions target the *same* token with opposite meanings: `withXsrfConfiguration()` and
`withNoXsrfProtection()` are two answers to one question, and letting array position decide would mean
a security posture chosen by import order. So the framework spends a `ngDevMode` guard exactly where
last-wins would be dangerous, and skips it where last-wins is merely redundant — which is the same
"throw for a contradiction, warn for a suspicion" rule chunk 04 draws out of the framework's own code.

**★ Why is `withDebugTracing()` a function that compiles to an empty array in production, rather than
an `enableTracing: boolean` option?**
Because a boolean has to be read at runtime, and reading it requires the implementation to be present
in the bundle. `ExtraOptions.enableTracing` meant the tracing code shipped to every user of
`RouterModule.forRoot` regardless of the value. `withDebugTracing()` is a call site: if you never call
it, the module that implements it is never imported and the bundler removes it. That is the whole
`provide*`/`with*` argument in one example — and the reason the `ExtraOptions` table splits so cleanly
into "fields whose implementation is a class, which became functions" and "fields that are just
values, which stayed values inside `withRouterConfig`".

**★ How would you tell, without asking anyone, which router features are not stable in v22?**
By reading the JSDoc tag on the function in `provide_router.ts`, or the equivalent badge angular.dev
renders — `@developerPreview 19.0` on `withViewTransitions`, `@experimental 21.1` on
`withExperimentalAutoCleanupInjectors` and `withExperimentalPlatformNavigation`, and a bare
`@experimental` on the unlisted `withRouterResources`. What you must *not* use is the public-API
golden: every entry there is tagged `// @public`, which is API-Extractor's release tag and carries no
information about Angular's stability promise. The golden is the right place to answer "does this
export exist" and the wrong place to answer "is it safe to ship".

**Why does a router feature's `ɵproviders` accept `EnvironmentProviders` when an HTTP feature's does
not?**
Because at least one router feature needs to nest another `provide*` call inside itself:
`withEnabledBlockingInitialNavigation()` contributes a `provideAppInitializer(...)`, which returns
`EnvironmentProviders`, and `withDisabledInitialNavigation()` does the same. Widening the array type
to `Array<Provider | EnvironmentProviders>` is what makes that legal. No HTTP feature needs it, so its
array stayed `Provider[]`. The practical lesson for your own features is in chunk 04: decide up front
whether a feature may contain an initializer, because widening the type later is a breaking change to
anyone who has written their own feature against it.

**What is `ɵkind` for, if `provideRouter` never reads it?**
It exists to make each feature's *type* distinct, which is what turns `RouterFeatures` into a
discriminated union and makes `provideRouter(routes, withFetch())` a compile error rather than a
runtime surprise. `provideHttpClient` additionally reads the kinds at runtime to detect
contradictions; the router does not, so in `@angular/router` the tag is purely a type-level device.
That asymmetry is worth noticing when writing your own feature set — the tag costs nothing and buys
type discrimination, and it is *also* what you would need if you ever decided to add validation.

---

← Prev: [The bootstrap listener](07b-the-bootstrap-listener-and-initial-navigation.md) · Index: [Topic index](README.md) · Next → [`withRouterConfig` and `withHashLocation`](08b-with-router-config-and-hash-location.md)
