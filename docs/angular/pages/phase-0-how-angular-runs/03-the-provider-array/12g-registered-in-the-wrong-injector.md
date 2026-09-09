---
title: "The worst category is not the misplaced entry but the one that compiles, registers successfully and is read by a consumer living in a different injector — `providePlatformInitializer` in `app.config.ts` is the case nothing in the framework will ever tell you about"
sidebar_label: "12g · Registered in the wrong injector"
sidebar_position: 12.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/platform/platform.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/platform.ts)
> (source and JSDoc, quoted verbatim), the `core` public-API golden,
> [`router/src/router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router.ts),
> and `CHANGELOG.md` at `v21.0.0`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every other category in this triage is caught by something: a compile error, a bundle report, a
code review, a second instance somebody notices.** This one is caught by nothing. The entry
type-checks, the injector registers it, no error is thrown at any point in the application's life,
and the thing you configured simply does not happen — because the code that reads the token lives
in a different injector, created before yours existed. `providePlatformInitializer()` in
`app.config.ts` is the purest example in the framework, and it is worth learning as a *shape*
rather than as one fact, because at least four other providers fail the same way.

## `providePlatformInitializer` — the one that nothing catches

From
[`core/src/platform/platform.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/platform.ts),
verbatim:

```ts
export function providePlatformInitializer(initializerFn: () => void): StaticProvider {
  return {
    provide: PLATFORM_INITIALIZER,
    useValue: initializerFn,
    multi: true,
  };
}

function runPlatformInitializers(injector: Injector): void {
  const inits = injector.get(PLATFORM_INITIALIZER, null);
  runInInjectionContext(injector, () => {
    inits?.forEach((init) => init());
  });
}
```

🔴 **Look at the return type: `StaticProvider`, not `EnvironmentProviders`.** In the whole `provide*`
surface of `@angular/core` at `v22.1.5` it is the only one. That single fact is what disarms every
guard the rest of the topic relies on: a `StaticProvider` is a `Provider`, `ApplicationConfig.providers`
accepts `Provider`, so the call compiles in `app.config.ts` with no complaint, no `NG0207`, and
nothing for a reviewer to notice. Compare [03](03-environmentproviders-vs-provider.md), where the
branded type is precisely what stops every other `provide*` from landing in the wrong place.

What happens next is that it registers correctly — in the **application** injector. And
`runPlatformInitializers` reads `PLATFORM_INITIALIZER` from the **platform** injector, which was
created first, by `createOrReusePlatformInjector`, before `bootstrapApplication` ever built the
application injector. Two different injectors; the token is read from the one your entry is not in.
`injector.get(PLATFORM_INITIALIZER, null)` supplies `null` as the not-found value, so there is not
even an `NG0201` — the lookup succeeds, returns `null`, and `inits?.forEach` does nothing.

The JSDoc says where it goes, verbatim, including its own usage snippet:

> *"This function is used to provide initialization functions that will be executed upon
> initialization of the platform injector."*
>
> *"The platform initializer should be provided during platform creation:"*

```ts
const platformRef = platformBrowser([ providePlatformInitializer(() =>  ...) ]);

bootstrapApplication(App, appConfig, { platformRef })
```

So the fix is to create the platform yourself and pass it as `bootstrapApplication`'s third
argument:

```ts
// wrong — compiles, registers, never runs
bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    providePlatformInitializer(() => installGlobalPolyfill()),
  ],
});

// right — the token is registered in the injector that reads it
const platformRef = platformBrowser([
  providePlatformInitializer(() => installGlobalPolyfill()),
]);

bootstrapApplication(App, appConfig, {platformRef});
```

⚠️ **Ask first whether you needed the platform at all.** Almost everything people reach for
`providePlatformInitializer` for belongs one level down, in
`provideAppInitializer()` or `provideEnvironmentInitializer()`, which run in the application
injector and can inject application services —
[06e](06e-platform-initializers.md) draws the line between the three.

One SSR footnote that matters if you were planning to reach the platform later: the v21.0.0
`CHANGELOG.md` states, verbatim:

> *"In addition, `getPlatform()` and `destroyPlatform()` will now return `null` and be a no-op
> respectively when running in a server environment."*

so platform-level state is not a place to keep anything the server render needs.

## The same shape, four more times

The diagnosis generalises: **registration is local to the injector you put the entry in;
consumption happens wherever the consumer was constructed.** When those differ, and the consumer
looks the token up with a not-found default, you get silence.

| Entry | Put here | Read by | Result |
|---|---|---|---|
| `providePlatformInitializer()` | `app.config.ts` | `runPlatformInitializers`, from the **platform** injector | never runs |
| `provideRouter()` | a route's `providers` | the root `Router`, from the injector it was created in | route table ignored |
| `provideAppInitializer()` | a route's `providers` | `ApplicationInitStatus`, at bootstrap | ⚠️ cannot run — see below |
| `provideZoneChangeDetection()` | a route's `providers` | change detection, configured at bootstrap | no effect |
| `provideClientHydration()` | a route's `providers` | hydration, which runs during bootstrap | no effect |

The router row is worth spelling out because it looks so plausible. The `Router` is root-provided
and reads its configuration once, as `inject(ROUTES, {optional: true})?.flat() ?? []`, in the
injector where *it* was constructed. A `ROUTES` record created later, in a route's
`EnvironmentInjector`, is never consulted by that instance. So `provideRouter()` on a route
registers a perfectly good multi entry that nothing reads. Put route-scoped **services** on the
route and the route **table** in the root call, via `children` or `loadChildren` —
[07](07-provide-router-and-the-route-array.md).

⚠️ **The `provideAppInitializer` row is an inference, not a quoted rule.** `ApplicationInitStatus`
is constructed and its initializers are run during bootstrap
([06b](06b-initializer-ordering-and-failure.md)), and a route's `EnvironmentInjector` does not
exist at that point, so mechanically the route-registered initializer cannot be reached. I found no
documentation sentence stating this outright. Treat it as following from the mechanism, and do not
quote it as a documented guarantee.

**The one that does work on a route, and why**, is worth knowing as the contrast:
`provideEnvironmentInitializer()`. Route injectors resolve their own environment initializers with
`{self: true}`, so an environment initializer on a route runs when that injector is created
([06d](06d-environment-initializers.md)). Same-sounding API, opposite outcome — which is exactly
why "does this compile" is not the question to ask.

## Gotchas

**★ Symptom: you added a provider and it silently did nothing — no error, no warning, no log.**
Cause: in this topic that symptom has three distinct causes, and they are worth checking in this
order. One, the entry is in an injector that the consumer does not read from — this chunk's whole
subject. Two, a later entry for the same non-multi token shadowed it
([12b](12b-collisions-multi-tokens-and-the-triage-order.md)). Three, the provider is dev-mode-only
and you are running a production build ([12h](12h-experimental-preview-and-dev-only.md)). Fix:
identify which of the three before changing anything, because the three fixes are unrelated.

**★ Symptom: `providePlatformInitializer()` in `app.config.ts` compiles cleanly and the function
never executes.** Cause: it returns `StaticProvider`, so the type system's usual guard against a
misplaced `provide*` does not apply; the entry registers `PLATFORM_INITIALIZER` in the application
injector while `runPlatformInitializers` reads it from the platform injector with a `null`
not-found default. Fix: create the platform explicitly and pass it through — the code above — or,
much more often, use `provideAppInitializer()` instead, which is almost always what was actually
wanted.

**★ Symptom: `provideRouter()` on a lazy route's `providers` and none of its routes are
reachable.** Cause: the root `Router` read `ROUTES` from its own injector at construction and never
looks again at a child injector's records. Fix: contribute the routes through the route tree
instead:

```ts
// wrong — the ROUTES record is registered where nothing reads it
{path: 'admin', providers: [provideRouter(adminRoutes)], loadComponent: …}

// right — the router loads the child table itself
{path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes)}
```

**★ Symptom: a `provideAppInitializer()` you moved onto a route to make it lazy never runs.**
Cause: application initializers are consumed once, during bootstrap, and the route's injector did
not exist then. Fix: use `provideEnvironmentInitializer()` on the route, which route injectors do
resolve for themselves:

```ts
// never runs
{path: 'admin', providers: [provideAppInitializer(() => warmAdminCache())], loadComponent: …}

// runs when the route's injector is created
{path: 'admin', providers: [provideEnvironmentInitializer(() => warmAdminCache())], loadComponent: …}
```

⚠️ The two have different failure semantics as well — an application initializer can block
bootstrap by returning a promise, an environment initializer returns `void`
([06d](06d-environment-initializers.md)).

**★ Symptom: `provideZoneChangeDetection()` or `provideClientHydration()` on a route changes
nothing.** Cause: both configure decisions taken during bootstrap, before any route injector is
created. Fix: they belong in `app.config.ts`, and the fact that a route's `providers` accepts them
is a consequence of the shared `Array<Provider | EnvironmentProviders>` type rather than a
statement that they are meaningful there. See [05](05-change-detection-providers.md) and
[11](11-hydration-animations-and-the-rest.md).

**★ Symptom: a code review cannot tell whether a `provide*` on a route is legitimate.** Cause: the
type gives no signal at all — route and application `providers` have the identical type, so
everything compiles in both. Fix: use the consumer as the test, not the type. If the thing that
reads the token is constructed at bootstrap, the entry belongs at bootstrap; if it is constructed
per route activation, the route is legitimate. `provideHttpClient(withRequestsMadeViaParent())` is
the canonical route-shaped case ([10f](10f-requests-made-via-parent.md)).

**★ Symptom: you moved `providePlatformInitializer` to `platformBrowser([...])` and now
`bootstrapApplication` ignores your `appConfig`.** Cause: the third argument is an options object —
`{platformRef}` — not a replacement for the second. Passing the platform in the wrong position
either fails to type-check or silently changes what the second argument means. Fix: keep the shape
in the JSDoc exactly: `bootstrapApplication(App, appConfig, {platformRef})`.

## Interview questions

**★ Why is `providePlatformInitializer()` in `app.config.ts` worse than a type error?**
Because it compiles, registers, and never runs, and nothing in the framework will ever tell you.
It is the only `provide*` in `@angular/core` that returns `StaticProvider` rather than
`EnvironmentProviders`, so the branded-type guard that catches every other misplaced `provide*` —
at compile time, and as `NG0207` if the compile check is bypassed — simply does not apply to it.
The entry then creates a real `PLATFORM_INITIALIZER` record in the application injector, while
`runPlatformInitializers` reads the token from the platform injector using `null` as the not-found
value, so there is no `NG0201` either: the lookup succeeds and returns nothing. A type error costs
thirty seconds. This costs however long it takes someone to suspect that a line they can see in the
config has never executed, which in practice means it is found by accident, if at all.

**★ You have four `provide*` calls on a route and one of them does nothing. How do you work out
which?**
Not from the type — route `providers` and application `providers` have the identical declared type,
so all four compile and the signature carries no information. Ask instead where the *consumer* of
each token is constructed. If the consumer is built during bootstrap — `ApplicationInitStatus` for
application initializers, the change-detection configuration, hydration, the root `Router` reading
`ROUTES` — then a record created later in a route injector is never seen, and the call is dead. If
the consumer is created per route activation, or resolves through the route's injector at use time,
the route is the right place; `provideHttpClient(withRequestsMadeViaParent())` and route-scoped
services are the clean cases. The general rule is that registration is local and consumption
happens wherever the consumer was constructed, so a provider only works when those two injectors
line up.

**★ `provideAppInitializer()` on a route does nothing, but `provideEnvironmentInitializer()` on a
route runs. What is the difference?**
Application initializers are collected once by `ApplicationInitStatus` during bootstrap, so the
only injector that can contribute to them is the one that exists at bootstrap — a route's injector
is created later and its records are never gathered. Environment initializers are resolved by each
environment injector for itself, with `{self: true}`, as part of that injector's own creation, so
every route injector runs its own set at the moment it is created. That is the difference between
"a global startup hook" and "a per-injector construction hook", and the naming does very little to
convey it. Worth flagging in an interview: the claim that a route-level `provideAppInitializer`
never runs follows from the mechanism rather than from a documented sentence, and it is the kind of
thing to verify against the version you are on rather than assert.

**★ What is the general lesson from a provider that compiles and does nothing?**
That in Angular's DI, the type system checks *shape* and never checks *placement*. `Provider` and
`EnvironmentProviders` encode which kind of injector may hold an entry, and that is a real and
useful guarantee — it is what makes `provideHttpClient()` on a component a compile error. But
nothing in the type of a provider says which injector will be asked for the token, and nothing can,
because that is a runtime property of whoever calls `inject()`. So there is a whole class of
correct-looking configuration whose only defence is knowing the consumer. That is why the
`provide*` convention matters beyond ergonomics: a function named for its subsystem is at least a
hint about where its subsystem lives, which a bare `{provide: TOKEN, useValue: x}` never is.

{/* FOOTER */}
