---
title: "View transitions are still developer preview and fail silently on unsupported browsers; in-memory scrolling restores nothing until you pass it options — two features whose defaults are `do nothing`"
sidebar_label: "08d · View transitions and scrolling"
sidebar_position: 8.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`withViewTransitions`](https://angular.dev/api/router/withViewTransitions),
> [`withInMemoryScrolling`](https://angular.dev/api/router/withInMemoryScrolling),
> [`InMemoryScrollingOptions`](https://angular.dev/api/router/InMemoryScrollingOptions); and
> `angular/angular` at tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config.ts),
> [`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts),
> [`goldens/public-api/router/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/router/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Both of these features are opt-in twice: once by calling them, and once by configuring them.**
`withViewTransitions()` wraps route activation in `document.startViewTransition` — but its JSDoc tag is
`@developerPreview 19.0`, and on a browser without the View Transitions API it does nothing and says
nothing. `withInMemoryScrolling()` with no arguments is behaviourally identical to not calling it at
all, because `scrollPositionRestoration` defaults to `'disabled'` and anchor scrolling defaults to off
— and even when configured, its scroller is started by the bootstrap listener rather than by the
provider, so it inherits that listener's first-component guard. This chunk is both features, both sets
of options with the defaults their own documentation states, and the failure modes that produce no
error at all.

## `withViewTransitions` — developer preview, and a silent fallback

```ts
export function withViewTransitions(
  options?: ViewTransitionsFeatureOptions,
): ViewTransitionsFeature {
  performanceMarkFeature('NgRouterViewTransitions');
  const providers = [
    {provide: CREATE_VIEW_TRANSITION, useValue: createViewTransition},
    {
      provide: VIEW_TRANSITION_OPTIONS,
      useValue: {skipNextTransition: !!options?.skipInitialTransition, ...options},
    },
  ];
  return routerFeature(RouterFeatureKind.ViewTransitionsFeature, providers);
}
```

> *"Enables view transitions in the Router by running the route activation and deactivation inside of
> `document.startViewTransition`."*

> *"Note: The View Transitions API is not available in all browsers. If the browser does not support
> view transitions, the Router will not attempt to start a view transition and continue processing the
> navigation as usual."*

🔴 **Its JSDoc tag is `@developerPreview 19.0`.** The public-API golden marks it `// @public`, which is
API-Extractor's release tag and not a stability claim — chunk
[08](08-router-features-one-by-one.md) has the full inventory. Ship it knowing the API may change
inside a major.

The options are two:

```ts
export interface ViewTransitionsFeatureOptions {
    onViewTransitionCreated?: (transitionInfo: ViewTransitionInfo) => void;
    skipInitialTransition?: boolean;
}
```

`skipInitialTransition` is mapped straight onto the internal `skipNextTransition` flag by the feature
body. `onViewTransitionCreated` is a callback per transition; `NavigationBehaviorOptions.info`'s own
documentation describes the intended use, verbatim:

> *"This information could be used in coordination with the View Transitions feature and the
> `onViewTransitionCreated` callback. The information might be used in the callback to set classes on
> the document in order to control the transition animations and remove the classes when the transition
> has finished animating."*

```ts
provideRouter(routes, withViewTransitions({
  skipInitialTransition: true,
  onViewTransitionCreated: ({ transition }) => {
    document.documentElement.classList.add('route-transitioning');
    transition.finished.finally(() =>
      document.documentElement.classList.remove('route-transitioning'),
    );
  },
})),
```

**What it costs.** Route activation and deactivation now run inside `document.startViewTransition`,
which means the browser holds a snapshot of the old DOM across the swap — so a slow activation is a
visibly frozen page rather than a progressive one. It is a feature to enable after your navigations
are fast, not to make them feel fast.

## `withInMemoryScrolling` — the feature that does nothing by default

```ts
export function withInMemoryScrolling(
  options: InMemoryScrollingOptions = {},
): InMemoryScrollingFeature {
  const providers = [
    {
      provide: ROUTER_SCROLLER,
      useFactory: () => new RouterScroller(options),
    },
  ];
  return routerFeature(RouterFeatureKind.InMemoryScrollingFeature, providers);
}
```

> *"Enables customizable scrolling behavior for router navigations."*

Both options default to off, and the documentation says so explicitly:

> *"When set to 'enabled', scrolls to the anchor element when the URL has a fragment. Anchor scrolling
> is disabled by default."*
> *"Anchor scrolling does not happen on 'popstate'. Instead, we restore the position that we stored or
> scroll to the top."*

> *"* 'disabled'- (Default) Does nothing. Scroll position is maintained on navigation."*
> *"* 'top'- Sets the scroll position to x = 0, y = 0 on all navigation."*
> *"* 'enabled'- Restores the previous scroll position on backward navigation, else sets the position to
> the anchor if one is provided, or sets the scroll position to [0, 0] (forward navigation). This option
> will be the default in the future."*

🔴 **`withInMemoryScrolling()` with no arguments changes nothing at all.** It registers a
`RouterScroller` configured with `{}`, which is `scrollPositionRestoration: 'disabled'` and
`anchorScrolling: 'disabled'`. The configuration almost everyone actually wants is:

```ts
provideRouter(routes, withInMemoryScrolling({
  scrollPositionRestoration: 'enabled',
  anchorScrolling: 'enabled',
})),
```

⚠️ **The scroller is started from the bootstrap listener**, not from the provider:
`injector.get(ROUTER_SCROLLER, null, {optional: true})?.init()` in `getBootstrapListener`
([07b](07b-the-bootstrap-listener-and-initial-navigation.md)). If that listener returns early — which
it does for anything that is not the first bootstrapped component — the scroller is provided and never
initialised.

## Per-navigation scroll control lives on the navigation, not on the feature

The feature configures the *default*; an individual navigation can override it through
`NavigationBehaviorOptions.scroll`, whose documentation reads, verbatim:

> *"Configures how scrolling is handled for an individual navigation when scroll restoration is enabled
> in the router."*
> *"- When 'manual', the router will not perform scrolling when the navigation is complete, even if
> scroll restoration is enabled."*
> *"- When 'after-transition', scrolling will be performed after the `NavigationEnd` event, according to
> the behavior configured in the router scrolling feature."*

```ts
// a tab switch inside a long page: keep the user where they are
this.router.navigate(['./details'], { relativeTo: this.route, scroll: 'manual' });
```

⚠️ **The first sentence contains the condition that catches people: *"when scroll restoration is
enabled in the router."*** With the default `scrollPositionRestoration: 'disabled'`, there is no
scrolling to suppress and `scroll: 'manual'` is a no-op — it only means anything once
`withInMemoryScrolling({scrollPositionRestoration: 'enabled'})` is in the configuration.

⚠️ That field's own `@see` tag names `withInMemoryRouterScroller`, **which is not an export in the
v22.1.5 router golden**. Read it as `withInMemoryScrolling`; it appears to be an upstream typo and is
noted here so you do not spend time searching for the function.

## Gotchas

**★ Symptom: `withViewTransitions()` does nothing in one browser and works in another.** Cause: the
documented fallback — *"If the browser does not support view transitions, the Router will not attempt
to start a view transition and continue processing the navigation as usual."* There is no warning by
design. Fix: treat transitions as an enhancement and make the non-transitioning path the one you test;
if you need to know at runtime, feature-detect rather than infer —

```ts
const hasViewTransitions = 'startViewTransition' in document;
```

**★ Symptom: scroll position is not restored on the browser back button even though
`withInMemoryScrolling()` is in the config.** Cause: the feature was called with no options, so
`scrollPositionRestoration` is `'disabled'` — *"(Default) Does nothing."* Fix: pass the option —

```ts
provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
```

**Symptom: the very first page load plays a view transition you did not want.** Cause: the initial
navigation is a navigation like any other. Fix: the option that exists for it, which the feature maps
onto its internal `skipNextTransition` flag —

```ts
provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
```

**Symptom: anchor scrolling works on a link but not when you press back.** Cause: documented —
*"Anchor scrolling does not happen on 'popstate'. Instead, we restore the position that we stored or
scroll to the top."* Fix: none needed, this is the intended behaviour; if you need fragment scrolling
on a popstate, react to the router's `Scroll` event yourself rather than expecting the feature to do
it.

**Symptom: scrolling and preloading both stop working in an application that bootstraps two root
components.** Cause: both are initialised from `getBootstrapListener`, which returns early for any
component that is not `ref.components[0]` — [07b](07b-the-bootstrap-listener-and-initial-navigation.md).
Fix: one root component per `bootstrapApplication` call.

**Symptom: `scroll: 'manual'` on a navigation changes nothing.** Cause: it is documented as applying
*"when scroll restoration is enabled in the router"* — with the default `'disabled'` there is nothing
to suppress. Fix: enable restoration first, then opt individual navigations out —

```ts
providers: [provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))],
// then, per navigation:
this.router.navigate(['./details'], { relativeTo: this.route, scroll: 'manual' });
```

## Interview questions

**★ `withViewTransitions()` is `@developerPreview` in v22 and degrades silently on unsupported
browsers. How does that change how you would adopt it?**
Two ways. The developer-preview tag means the API may change within a major version, so the adoption
cost is a possible refactor at the next `ng update`, not just the feature work — acceptable for a
progressive enhancement, less so for something a design system depends on. The silent degradation
means the non-transitioning path is the one most of your users may be on, and it is the one nothing
will tell you about: no warning, no error, just navigation as usual. So the transition has to be
strictly additive, the tests have to cover the plain path, and any CSS the transition needs must not
be load-bearing for layout.

**`withInMemoryScrolling()` with no arguments — what does it do?**
Nothing observable. It provides a `RouterScroller` built from `{}`, and both options default to
disabled: `scrollPositionRestoration` is *"'disabled'- (Default) Does nothing"* and anchor scrolling is
*"disabled by default"*. That makes it one of the few features where calling it and not calling it are
behaviourally identical, which is a genuinely surprising API shape and a good reason to always pass the
options explicitly. Worth adding that the docs say `'enabled'` *"will be the default in the future"*,
so an application that relies on today's default is relying on something the framework has announced it
intends to change.
**★ `withInMemoryScrolling` sets one behaviour for the whole application. How do you exempt a single
navigation, and what has to be true first?**
Through `NavigationBehaviorOptions.scroll`, passing `'manual'` on the individual
`router.navigate(...)` call — the router then *"will not perform scrolling when the navigation is
complete, even if scroll restoration is enabled"*. The precondition is in that same sentence: it only
applies when restoration is enabled in the first place, so on a default configuration the option is
inert. The realistic use is a tab strip or a filter panel implemented as child routes inside a long
page, where the route genuinely changes but moving the viewport would be wrong.

**Why does `withViewTransitions()` map `skipInitialTransition` onto an internal `skipNextTransition`
flag rather than exposing the internal name?**
Because the public promise is narrower than the internal mechanism. Internally the router needs a
one-shot "do not animate the next one" flag; the only case the public API commits to is the *first*
navigation after bootstrap, which is the one users complain about. Keeping the public name
`skipInitialTransition` leaves the framework free to reuse or change the internal flag — and it is a
good illustration of why reading the provider body is useful but writing against the token it
provides is not: `VIEW_TRANSITION_OPTIONS` is not part of the API you were given.

---

← Prev: [`withComponentInputBinding`](08c-with-component-input-binding.md) · Index: [Topic index](README.md) · Next → [Preloading and navigation errors](08e-preloading-and-navigation-errors.md)
