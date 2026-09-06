---
title: "`provideEnvironmentInitializer` runs its callback and throws the return value away, and reads its token with `{self: true}` — so an async body is a silent no-op and a route injector never inherits the application's initializers"
sidebar_label: "06d · Environment initializers"
sidebar_position: 6.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideEnvironmentInitializer`](https://angular.dev/api/core/provideEnvironmentInitializer); and
> `angular/angular` at tag `v22.1.5`:
> [`di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts),
> [`di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideEnvironmentInitializer` is the initializer nothing waits for, and its runner is the reason
two very different mistakes both produce silence.** `resolveInjectorInitializers()` calls your
function and drops the result on the floor, so an `async` body delays nothing and reports nothing;
and it reads `ENVIRONMENT_INITIALIZER` with `{self: true}`, so there is no inheritance in either
direction — a route injector runs exactly its own initializers and the application's never run again.
Both behaviours are correct and both are invisible unless you have read the twenty lines that
implement them. This chunk is those lines, the four consequences, and where an environment
initializer is genuinely the right tool rather than a worse app initializer.

## `provideEnvironmentInitializer` — four lines, and a runner that discards

```ts
export function provideEnvironmentInitializer(initializerFn: () => void): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: initializerFn,
    },
  ]);
}
```

> *"This function is used to provide initialization functions that will be executed upon construction
> of an environment injector."*

> *"Note that the provided initializer is run in the injection context."*

> *"Previously, this was achieved using the `ENVIRONMENT_INITIALIZER` token which is now deprecated."*

The runner is `R3Injector.resolveInjectorInitializers()`, verbatim:

```ts
  /** @internal */
  resolveInjectorInitializers() {
    const prevConsumer = setActiveConsumer(null);
    const previousInjector = setCurrentInjector(this);
    const previousInjectImplementation = setInjectImplementation(undefined);
    let prevInjectContext: InjectorProfilerContext | undefined;
    if (ngDevMode) {
      prevInjectContext = setInjectorProfilerContext({injector: this, token: null});
    }

    try {
      const initializers = this.get(ENVIRONMENT_INITIALIZER, EMPTY_ARRAY, {self: true});
      if (ngDevMode && !Array.isArray(initializers)) {
        throw new RuntimeError(
          RuntimeErrorCode.INVALID_MULTI_PROVIDER,
          'Unexpected type of the `ENVIRONMENT_INITIALIZER` token value ' +
            `(expected an array, but got ${typeof initializers}). ` +
            'Please check that the `ENVIRONMENT_INITIALIZER` token is configured as a ' +
            '`multi: true` provider.',
        );
      }
      for (const initializer of initializers) {
        initializer();
      }
    } finally {
      setCurrentInjector(previousInjector);
      setInjectImplementation(previousInjectImplementation);
      ngDevMode && setInjectorProfilerContext(prevInjectContext!);
      setActiveConsumer(prevConsumer);
    }
  }
```

**Four facts, all directly in that method.**

- **`initializer()` — the return value is discarded.** No `await`, no `Promise.all`, no collection.
  Returning a Promise from an environment initializer is a no-op with no diagnostic whatsoever, and
  the `() => void` signature is the only warning you get.
- **`{self: true}`.** The token is read from *this* injector only, with no walk up the parent chain.
  A route injector runs exactly the initializers registered on that route and never re-runs the
  application's. That is the opposite of how nearly every other token behaves, and it is what makes
  "runs once per injector" true rather than "runs once per injector that has an ancestor with one".
- **There is no `catch`, only a `finally`.** An environment initializer that throws propagates
  straight out of injector construction. At bootstrap that means the application never starts; on a
  route it means the navigation fails. The `finally` exists to restore the ambient injector state,
  not to contain the error.
- **`setActiveConsumer(null)`** — reactive reads inside an environment initializer are deliberately
  not tracked, so touching a signal there does not create a dependency on anything.

It runs **before** app initializers: `bootstrap()` calls `resolveInjectorInitializers()` and then
`ApplicationInitStatus.runInitializers()`, steps 2 and 4 of the sequence in
[01](01-app-config-and-what-bootstrap-does-with-it.md). The reason it is called by name rather than
during injector construction is quoted there too — `internalCreateApplication` passes
`runEnvironmentInitializers: false` because *"we need to run them inside the NgZone, which happens
after we get the NgZone instance from the Injector."*

So the choice between the two is mechanical, not stylistic:

```ts
// ✅ synchronous wiring that must exist before anything else — environment initializer
provideEnvironmentInitializer(() => {
  inject(TelemetrySink).installUnhandledHooks();
}),

// ✅ anything the first render must not happen without — app initializer
provideAppInitializer(() => inject(RuntimeConfigService).load()),

// ⛔ silently does nothing: the promise is created, never awaited, and dropped
provideEnvironmentInitializer(() => {
  inject(RuntimeConfigService).load();
}),
```

This is also how the framework builds features that need startup work without adding latency:
`provideBrowserGlobalErrorListeners()` is *nothing but* an environment initializer
([06e](06f-provide-browser-global-error-listeners.md)), and
`provideCheckNoChangesConfig({exhaustive: true, interval})` schedules its periodic check from one
too. Chunk [04](04-writing-your-own-provide-function.md) shows the same shape inside your own
`with*` feature.

## Gotchas

**★ Symptom: `provideEnvironmentInitializer(() => someService.load())` compiles, runs, and delays
nothing — the first render happens against unloaded state.** Cause: `resolveInjectorInitializers`
calls `initializer()` and discards the result. Fix: if the first render must wait, it is an app
initializer —

```ts
// ⛔ the Promise is created and dropped
provideEnvironmentInitializer(() => { inject(SomeService).load(); }),
// ✅
provideAppInitializer(() => inject(SomeService).load()),
```

**★ Symptom: an environment initializer registered in `app.config.ts` does not run again when you
navigate into a lazily-loaded route, and one registered on the route does not re-run the
application's.** Cause: `{self: true}` on the `ENVIRONMENT_INITIALIZER` lookup — each injector runs
only its own list, with no inheritance in either direction. Fix: this is the intended behaviour;
register application startup in `app.config.ts` and feature startup on the route. If a feature
genuinely needs the same work per route injector, register it on the route as well —

```ts
export const adminRoutes: Routes = [
  {
    path: '',
    providers: [
      AdminAuditLog,
      provideEnvironmentInitializer(() => inject(AdminAuditLog).open()),
    ],
    loadComponent: () => import('./admin-shell').then((m) => m.AdminShell),
  },
];
```

**Symptom: `NG0209: Unexpected type of the ENVIRONMENT_INITIALIZER token value (expected an array,
but got function). Please check that the ENVIRONMENT_INITIALIZER token is configured as a multi: true
provider.`** Cause: a hand-written provider for the token without `multi: true`, which replaces the
accumulating record with a single value. Note this is the same error code as the `APP_INITIALIZER`
variant with a different message — read the token name in the text to tell them apart. Fix: use the
function —

```ts
// ⛔
{ provide: ENVIRONMENT_INITIALIZER, useValue: () => inject(TelemetrySink).install() },
// ✅
provideEnvironmentInitializer(() => inject(TelemetrySink).install()),
```

**Symptom: a throw inside an environment initializer takes down the whole application, with a stack
that points at injector construction rather than at your code path.** Cause: `resolveInjectorInitializers`
has a `finally` but no `catch`; the throw escapes injector construction, which at bootstrap means the
application is never created. Fix: an environment initializer is *wiring*, so make it total — do the
fallible part lazily, or catch inside it —

```ts
provideEnvironmentInitializer(() => {
  const errors = inject(ErrorHandler);
  try {
    inject(TelemetrySink).installUnhandledHooks();
  } catch (e) {
    errors.handleError(e);   // telemetry must never prevent the app from starting
  }
}),
```

**Symptom: whatever an environment initializer installed is still installed after the injector is
destroyed — a listener, an interval, a subscription.** Cause: there is no teardown counterpart to
`provideEnvironmentInitializer`; the runner calls your function and forgets it. Fix: register the
teardown yourself while you are still in the injection context —

```ts
provideEnvironmentInitializer(() => {
  const sink = inject(TelemetrySink);
  const id = setInterval(() => sink.flush(), 30_000);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
}),
```

## Interview questions

**★ `provideEnvironmentInitializer` and `provideAppInitializer` have almost the same signature. Name
three ways they differ, and say which difference bites first.**
One: the app initializer is awaited and the environment initializer's return value is discarded, so
an async body in the wrong one is a silent no-op. Two: the environment initializer runs per
*injector*, with a `{self: true}` lookup, so it fires again for every route injector that registers
one and never inherits, while the app initializer runs once per application. Three: the environment
initializer runs earlier — step 2 of bootstrap versus step 4 — so it cannot depend on anything an app
initializer produced, while an app initializer can rely on everything an environment initializer
wired up. The one that bites first is the awaiting difference, because it produces no error at all,
just a first render against state that has not arrived.

**★ Why does `internalCreateApplication` create the application injector with
`runEnvironmentInitializers: false` and then run them by hand?**
Because environment initializers must run inside the `NgZone`, and the `NgZone` is itself resolved
*from* that injector — so it cannot exist until construction has finished. The source comment states
it directly: *"We skip environment initializers because we need to run them inside the NgZone, which
happens after we get the NgZone instance from the Injector."* The practical consequence is that an
environment initializer in an application injector can rely on being inside the zone (or inside the
`NoopNgZone` that stands in for it when zoneless), whereas one in an injector you create yourself with
`createEnvironmentInjector` runs at construction time with no such guarantee.

**An environment initializer on a lazily-loaded route runs the first time you navigate there. Does it
run again on the second navigation?**
Not unless the route injector was destroyed and recreated in between. `resolveInjectorInitializers()`
runs once, at injector construction; the router creates one `EnvironmentInjector` per route
configuration that has `providers`, and reuses it while that route stays loaded. Whether it is ever
destroyed is `RouteReuseStrategy`'s business and, in v22, optionally
`withExperimentalAutoCleanupInjectors()` — see
[08g](08g-tracing-and-the-experimental-end.md). So an environment initializer is "once
per injector lifetime", and the injector's lifetime is a routing decision, not a provider decision.

---

← Prev: [When a startup initializer fails](06c-when-a-startup-initializer-fails.md) · Index: [Topic index](README.md) · Next → [Platform initializers](06e-platform-initializers.md)
