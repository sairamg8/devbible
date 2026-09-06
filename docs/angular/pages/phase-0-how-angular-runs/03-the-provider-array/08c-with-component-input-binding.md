---
title: "`withComponentInputBinding()` binds four sources of route state straight to component inputs with resolvers winning every collision — and writes `undefined` into any bound input the current route does not supply"
sidebar_label: "08c · `withComponentInputBinding`"
sidebar_position: 8.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`withComponentInputBinding`](https://angular.dev/api/router/withComponentInputBinding),
> [`ComponentInputBindingOptions`](https://angular.dev/api/router/ComponentInputBindingOptions); and
> `angular/angular` at tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`withComponentInputBinding()` removes the `ActivatedRoute` boilerplate from routed components by
binding route state directly to their inputs — and it comes with two rules that are the opposite of the
obvious guess.** Four sources feed the same input namespace, and when two of them use the same key the
*resolver* wins, so a `?page=3` in the URL can be invisible to a component whose route resolves a
`page`. And when a key disappears from the route, the binder writes `undefined` rather than leaving the
previous value, because the routed component instance survives navigations and stale inputs would
outlive the state that produced them. v22 adds `ComponentInputBindingOptions` to narrow both
behaviours. This chunk is the feature, both rules with their documentation quoted, and the four ways
they surprise people.

## `withComponentInputBinding` — one token, four sources, one precedence rule

```ts
export function withComponentInputBinding(
  options: ComponentInputBindingOptions = {},
): ComponentInputBindingFeature {
  const providers = [
    {
      provide: INPUT_BINDER,
      useFactory: () =>
        new RoutedComponentInputBinder(options, inject(ROUTER_RESOURCES_FEATURE, {optional: true})),
    },
  ];

  return routerFeature(RouterFeatureKind.ComponentInputBindingFeature, providers);
}
```

> *"Enables binding information from the `Router` state directly to the inputs of the component in
> `Route` configurations. Can also accept an `ComponentInputBindingOptions` object to set which sources
> are allowed to bind."*

The precedence rule is the part worth memorising, verbatim:

> *"The router bindings information from any of the following sources:"*
> *"- query parameters"*
> *"- path and matrix parameters"*
> *"- static route data"*
> *"- data from resolvers"*
> *"Duplicate keys are resolved in the same order from above, from least to greatest, meaning that
> resolvers have the highest precedence and override any of the other information from the route."*

🔴 **A resolver silently wins over a query parameter with the same name.** That is the correct
behaviour and it is also how a `?page=3` in the URL stops reaching a component whose route has a
`resolve: { page: … }`.

```ts
// src/app/products/product-list.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-product-list',
  template: `<h1>Page {{ page() }} of {{ category() }}</h1>`,
})
export class ProductList {
  readonly category = input.required<string>();      // from the path parameter
  readonly page = input<number>(1);                  // from the query parameter
}
```

```ts
// src/app/app.routes.ts
export const routes: Routes = [
  {
    path: 'products/:category',
    loadComponent: () => import('./products/product-list').then((m) => m.ProductList),
  },
];

// src/app/app.config.ts
providers: [provideRouter(routes, withComponentInputBinding())],
```

### The `undefined` rule, and the option that changes it

> *"Importantly, when an input does not have an item in the route data with a matching key, this input
> is set to `undefined`. This prevents previous information from being retained if the data got removed
> from the route (i.e. if a query parameter is removed). Default values can be provided with a resolver
> on the route to ensure the value is always present or an input and use an input transform in the
> component."*

v22's `ComponentInputBindingOptions` adds a second answer to the same question:

```ts
export interface ComponentInputBindingOptions {
    queryParams?: boolean;
    unmatchedInputBehavior?: 'alwaysUndefined' | 'undefinedIfStale';
}
```

> *"When true (default), will configure query parameters to bind to component inputs."*

> *"Configures the behavior when an input is not matched by any key in the router data."*
> *"- `'alwaysUndefined'`: (Default) Binds `undefined` to the input. This ensures that stale data is
> not retained."*
> *"- `'undefinedIfStale'`: Binds `undefined` only if the input was previously available in the router
> data during the lifetime of the active route in this outlet. This avoids setting `undefined` for
> inputs that were never expected to be set by the router."*

⚠️ **So the paragraph above and the option are two settings of one switch.** `'alwaysUndefined'` is the
behaviour that paragraph describes and remains the default; `'undefinedIfStale'` narrows it to inputs
the router has actually set at least once, which is what you want when a routed component also receives
inputs from somewhere else.

```ts
// ✅ the router stops clobbering inputs it never set
provideRouter(routes, withComponentInputBinding({ unmatchedInputBehavior: 'undefinedIfStale' })),
```

## Gotchas

**★ Symptom: a bound input goes `undefined` the moment a query parameter is removed from the URL.**
Cause: the documented default, `unmatchedInputBehavior: 'alwaysUndefined'` — *"This prevents previous
information from being retained if the data got removed from the route"*. Fix: give the value a
guaranteed source, which the docs name as the supported answer —

```ts
{
  path: 'products/:category',
  resolve: { page: (route: ActivatedRouteSnapshot) => Number(route.queryParamMap.get('page') ?? 1) },
  loadComponent: () => import('./products/product-list').then((m) => m.ProductList),
},
```

**★ Symptom: an input that another part of the app sets is being reset to `undefined` on every
navigation.** Cause: the same default, applied to an input the router was never meant to own. Fix: the
v22 option that exists for exactly this —

```ts
provideRouter(routes, withComponentInputBinding({ unmatchedInputBehavior: 'undefinedIfStale' })),
```

**★ Symptom: `?page=3` in the URL never reaches the component, and no error appears.** Cause: a
resolver on the route contributes a key with the same name, and resolvers have the highest precedence
of the four sources. Fix: rename one of them, or have the resolver read the query parameter and return
it, so there is one owner of the key —

```ts
resolve: { page: (route: ActivatedRouteSnapshot) => Number(route.queryParamMap.get('page') ?? 1) },
```

**Symptom: input binding does not work for a component that is not the routed component.** Cause: the
binder is wired to the router outlet's component instance, so a child component inside the routed
template receives nothing from the router. Fix: pass it down explicitly; that is an ordinary template
binding, and the routed component is the boundary —

```html
<app-product-table [category]="category()" [page]="page()" />
```

**Symptom: after adding `withComponentInputBinding({ queryParams: false })`, inputs that used to come
from the URL are `undefined`.** Cause: `queryParams` is *"When true (default), will configure query
parameters to bind to component inputs"* — setting it to `false` removes query parameters as a binding
source for the whole application, not just for the component you were thinking about. Fix: leave the
source on and read the specific parameters you want to keep out of the binding through
`ActivatedRoute`, or move the value into route `data` or a resolver so it has a single owner —

```ts
{
  path: 'products/:category',
  data: { view: 'grid' },       // static, always bound, never affected by the URL
  loadComponent: () => import('./products/product-list').then((m) => m.ProductList),
},
```

## Interview questions

**★ `withComponentInputBinding()` binds from four sources. What is the precedence, and where does it
bite?**
Query parameters, then path and matrix parameters, then static route data, then resolver data — *"from
least to greatest, meaning that resolvers have the highest precedence"*. It bites when two sources use
the same key, because the loser disappears with no warning: a `?page=3` in the URL is invisible to a
component whose route resolves a `page`. The practical rule is to give every bound key exactly one
owner, and where a URL parameter genuinely needs a default, make the *resolver* the owner and have it
read the query parameter itself, so the precedence question never arises.

**★ Why does the router set a bound input to `undefined` when its key vanishes from the route, instead
of leaving the previous value?**
Because the alternative retains stale state across navigations — the docs say it directly: *"This
prevents previous information from being retained if the data got removed from the route (i.e. if a
query parameter is removed)."* The routed component is reused across navigations when the component
type does not change, so without the reset, removing `?page=3` from the URL would leave the component
showing page 3 forever. v22 adds `unmatchedInputBehavior: 'undefinedIfStale'` for the case where the
blanket reset is wrong — an input the router never set, because something else owns it — and that
option narrows the reset to inputs the router has previously supplied in the current route's lifetime.

**A routed component's input is bound, then a navigation to a sibling route reuses the same component
type. What does the router do to the inputs?**
It re-binds every input from the new route's data and writes `undefined` into any bound input the new
route does not supply, because the component instance survives the navigation and the binder's job is
to make its inputs reflect the *current* route rather than the union of every route visited. That is
the same mechanism as the query-parameter case, just triggered by a route change instead of a URL
edit — and it is why `input.required<T>()` on a routed component is a stronger contract than it looks:
if the new route does not supply the key, the router is contractually going to try to write
`undefined` into it.
---

← Prev: [`withRouterConfig` and `withHashLocation`](08b-with-router-config-and-hash-location.md) · Index: [Topic index](README.md) · Next → [View transitions and scrolling](08d-view-transitions-and-scrolling.md)
