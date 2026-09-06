---
title: "The two router features that only write configuration — `withRouterConfig` is a single `useValue` that replaces rather than merges, and `withHashLocation` is one non-multi provider that loses to anything later in the array"
sidebar_label: "08b · `withRouterConfig` and `withHashLocation`"
sidebar_position: 8.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`RouterConfigOptions`](https://angular.dev/api/router/RouterConfigOptions),
> [`withRouterConfig`](https://angular.dev/api/router/withRouterConfig),
> [`withHashLocation`](https://angular.dev/api/router/withHashLocation); and `angular/angular` at tag
> `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config.ts),
> [`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two of the twelve router features bring no implementation with them at all — they write a value into
one token and stop.** `withRouterConfig(options)` is `{provide: ROUTER_CONFIGURATION, useValue: options}`
and `withHashLocation()` is `{provide: LocationStrategy, useClass: HashLocationStrategy}`. Being
single non-multi providers is exactly what makes both of them fragile in the same way: a second
`withRouterConfig` does not merge with the first, it *replaces* it and silently reverts every field it
does not mention; and `withHashLocation` loses outright to any later provider for `LocationStrategy`,
including one a testing helper adds. This chunk is both features, all six `RouterConfigOptions` fields
with the defaults their own documentation states, and the two-part recipe `onSameUrlNavigation`
requires and nobody reads.

## `withRouterConfig` — the value bag that stayed a value bag

```ts
export function withRouterConfig(options: RouterConfigOptions): RouterConfigurationFeature {
  const providers = [{provide: ROUTER_CONFIGURATION, useValue: options}];
  return routerFeature(RouterFeatureKind.RouterConfigurationFeature, providers);
}
```

One provider, one token, `useValue`. The token defaults to an empty object, so the router's own
per-field defaults apply when the feature is absent:

```ts
export const ROUTER_CONFIGURATION = new InjectionToken<ExtraOptions>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'router config' : '',
  {
    factory: () => ({}),
  },
);
```

🔴 **`useValue` replaces, it does not merge.** Two `withRouterConfig({...})` calls in the same
`provideRouter` — or in two `provideRouter` calls — mean the later object becomes the whole
configuration and every field of the earlier one is lost, including the fields the later object does
not mention.

The six fields, with the defaults their own documentation states:

| Field | Values | Default | What it decides |
|---|---|---|---|
| `paramsInheritanceStrategy` | `'emptyOnly'` · `'always'` | **`'always'`** (changed in v22) | whether a child route inherits params, data and resolved data from *all* parents or only from empty-path/componentless ones |
| `onSameUrlNavigation` | `'reload'` · `'ignore'` | `'ignore'` | whether navigating to the current URL reprocesses it |
| `urlUpdateStrategy` | `'deferred'` · `'eager'` | `'deferred'` | whether the address bar updates before or after a successful navigation |
| `canceledNavigationResolution` | `'replace'` · `'computed'` | `'replace'` | how browser history is restored when a navigation is cancelled |
| `defaultQueryParamsHandling` | `'merge'` · `'preserve'` · `'replace'` · `''` | replace | the default for `Router.createUrlTree`, and so for `RouterLink` |
| `resolveNavigationPromiseOnError` | `boolean` | `false` | whether a navigation error resolves the promise with `false` instead of rejecting it |

The two whose documentation is worth quoting in full, because both are easy to get backwards:

> *"'reload' : The router processes the URL even if it is not different from the current state. …
> Note that this only configures whether or not the Route reprocesses the URL and triggers related
> actions and events like redirects, guards, and resolvers. By default, the router re-uses a component
> instance when it re-navigates to the same component type without visiting a different component
> first. This behavior is configured by the `RouteReuseStrategy`. In order to reload routed components
> on same url navigation, you need to set `onSameUrlNavigation` to `'reload'` _and_ provide a
> `RouteReuseStrategy` which returns `false` for `shouldReuseRoute`."*

> *"Defines when the router updates the browser URL. By default ('deferred'), update after successful
> navigation. Set to 'eager' if prefer to update the URL at the beginning of navigation. Updating the
> URL early allows you to handle a failure of navigation by showing an error message with the URL that
> failed."*

⚠️ `'computed'` for `canceledNavigationResolution` has a documented incompatibility:

> *"Note: the 'computed' option is incompatible with any `UrlHandlingStrategy` which only handles a
> portion of the URL because the history restoration navigates to the previous place in the browser
> history rather than simply resetting a portion of the URL."*

## `withHashLocation` — one provider, and it loses to whatever comes after it

```ts
export function withHashLocation(): RouterHashLocationFeature {
  const providers = [{provide: LocationStrategy, useClass: HashLocationStrategy}];
  return routerFeature(RouterFeatureKind.RouterHashLocationFeature, providers);
}
```

> *"Provides the location strategy that uses the URL fragment instead of the history API."*

That is the whole feature. It is a plain non-multi provider for `LocationStrategy`, so **anything
later in the flattened array that also provides `LocationStrategy` wins** — a hand-written
`{provide: LocationStrategy, useClass: PathLocationStrategy}` further down the array, another
library's location wiring, or a testing module that swaps it out. There is no warning; the URLs simply
come out in the other style.

The cost of the feature itself is the cost of hash URLs: no server-side route resolution, fragments
unavailable for anchors, and analytics tools that need configuring to see the part after the `#`. It
exists for deployments that cannot configure a server rewrite, and it is a deployment decision that
happens to be expressed as a provider.

## Gotchas

**★ Symptom: two `withRouterConfig()` calls, and options from the first one are gone.** Cause: the
feature is `{provide: ROUTER_CONFIGURATION, useValue: options}` — `useValue` replaces the record
outright, so the later object *is* the configuration and every unmentioned field reverts to its
default. Fix: merge in your own code, once —

```ts
providers: [
  provideRouter(routes, withRouterConfig({
    paramsInheritanceStrategy: 'emptyOnly',
    onSameUrlNavigation: 'reload',
    urlUpdateStrategy: 'eager',
  })),
],
```

**★ Symptom: `withHashLocation()` is in the config and the URLs are still path-style.** Cause: it is
one non-multi `{provide: LocationStrategy, useClass: HashLocationStrategy}` and something later in the
flattened array provides `LocationStrategy` too — most often a testing helper, a
`provideLocationMocks()`, or a hand-written provider added during an SSR experiment. Fix: find the
later provider and remove it; if it must stay, put it *before* the `provideRouter` call so the feature
wins —

```ts
providers: [
  { provide: LocationStrategy, useClass: PathLocationStrategy },   // earlier: loses
  provideRouter(routes, withHashLocation()),                        // later: wins
],
```

**★ Symptom: `onSameUrlNavigation: 'reload'` is set and the component still is not recreated.** Cause:
the documented half nobody reads — reloading the *route* is not reusing-or-not the *component*. Fix:
the docs' own two-part recipe, both halves —

```ts
providers: [
  provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
  { provide: RouteReuseStrategy, useClass: NeverReuseStrategy },
],
```

## Interview questions

**★ `withRouterConfig` takes an options object. Does calling it twice merge the two objects?**
No, and this is the most common way to lose router configuration silently. The feature is a single
`{provide: ROUTER_CONFIGURATION, useValue: options}`, and `ROUTER_CONFIGURATION` is not `multi` — so
`R3Injector.processProvider` ends with `records.set(token, record)` and the later object becomes the
whole configuration. Every field the earlier object set and the later one omits reverts to its default,
not to the earlier value. The consequence is that a shared "base router config" helper plus a
per-environment override is a trap unless the merge happens in *your* code before the single call.

**★ Why did the six `RouterConfigOptions` fields stay an options object when everything else in
`ExtraOptions` became a `with*` function?**
Because none of them brings code with it. `paramsInheritanceStrategy` and `urlUpdateStrategy` change
the behaviour of the navigation pipeline, which is present in every application that has a router at
all — so there is nothing for a bundler to drop and nothing a function call would buy. The `with*`
convention exists to make an implementation's *import* conditional; where there is no separate
implementation, a value is the honest shape. That is the same rule chunk 04 gives for your own
features: a boolean that only toggles already-present code belongs in the options object, and anything
that pulls in a class belongs in a feature function.

**★ `withHashLocation()` is in the provider array and the URLs are still path-style. What is your first
move?**
Search the flattened provider list for any other provider of `LocationStrategy`. The feature is one
non-multi `useClass` provider, so anything registered later for that token replaces it — a testing
module, `provideLocationMocks()`, a hand-written `PathLocationStrategy` left over from an SSR
experiment, or `withExperimentalPlatformNavigation()`, which pairs a `Location` implementation with a
`StateManager`. There is no warning for any of these, because from the injector's point of view
nothing unusual happened: a token was provided twice and the last one won. Once you have found it, the
fix is either to delete the later provider or to move it earlier than the `provideRouter` call.

**When is hash routing still the right answer, and what does it cost?**
When you cannot configure the server to rewrite unknown paths to `index.html` — a static host you do
not control, a file:// deployment, an embedded webview, or an application served from an arbitrary
sub-path by something you cannot change. The costs are real and worth naming: the server never sees
the route, so there is no server-side rendering of a deep link and no server-side redirect or auth
gate on a path; the fragment is no longer available for its original purpose, so in-page anchor links
need care; and analytics and error-reporting tools have to be configured to read the part after the
`#` or they will report every page as the same URL. It is a deployment constraint expressed as a
provider, which is why the decision belongs to whoever owns the deployment.

---

← Prev: [Router features, one by one](08-router-features-one-by-one.md) · Index: [Topic index](README.md) · Next → [`withComponentInputBinding`](08c-with-component-input-binding.md)
