---
title: "App initializers are started concurrently and awaited together, so array position decides when one *starts* and nothing else — and the injection context they run in ends at the first `await`"
sidebar_label: "06b · Initializer ordering"
sidebar_position: 6.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideAppInitializer`](https://angular.dev/api/core/provideAppInitializer),
> [`runInInjectionContext`](https://angular.dev/api/core/runInInjectionContext); and
> `angular/angular` at tag `v22.1.5`:
> [`application/application_init.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_init.ts),
> [`di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`runInitializers()` starts every app initializer in one synchronous pass and then waits for all of
them with a single `Promise.all`. Two rules follow, and both of them contradict what the array
literal looks like it means.** Array position decides when an initializer is *invoked*, never when it
*finishes*, so two initializers where one reads what the other writes is a race that will pass every
review and fail on a slow connection. And the injection context those callbacks run in is
synchronous: it is established by `runInInjectionContext` and torn down the moment the function first
suspends, so `inject()` after an `await` throws. This chunk is those two rules and the scope boundary
that falls out of them. The runner is quoted in
[06](06-startup-and-error-listener-providers.md); what happens when one of them rejects is
[06c](06c-when-a-startup-initializer-fails.md).

## Array position is start order, and that is all it is

```ts
// ⛔ a race: both start immediately, and flags may read config before it has loaded
providers: [
  provideAppInitializer(() => inject(RuntimeConfigService).load()),
  provideAppInitializer(() => inject(FeatureFlagService).load()),
],
```

Both callbacks are invoked in the same synchronous pass of the `for` loop.
`FeatureFlagService.load()` begins while `RuntimeConfigService.load()` is still in flight, and
whether it observes loaded configuration depends entirely on which network response arrives first. On
a fast local API it will look correct every time; it will fail in production, intermittently, for the
users with the worst connections.

**The framework provides no ordering primitive at all**, and deliberately so: the design assumes
initializers are independent, which is what makes three unrelated startup fetches cost one round trip
rather than three. A real dependency is expressed in JavaScript, inside one initializer:

```ts
// ✅ one initializer that owns the order
providers: [
  provideAppInitializer(async () => {
    const config = inject(RuntimeConfigService);
    const flags = inject(FeatureFlagService);
    await config.load();
    await flags.load(config.snapshot.apiBaseUrl);
  }),
],
```

⚠️ **Do not collapse initializers that genuinely have no dependency on one another.** You would be
serialising network time for the aesthetics of determinism. Collapse exactly the pairs where one
reads what another writes, and leave the rest parallel.

## The injection context ends at the first `await`

Both `inject()` calls above sit before the first `await`, and that is load-bearing.
`runInInjectionContext(this.injector, appInits)` sets a module-level *current injector*, calls the
function, and restores the previous value in a `finally`. That restore happens when the function
first suspends — not when the Promise it returned settles.

```ts
// ⛔ throws: the second inject() runs in a later microtask, outside the injection context
provideAppInitializer(async () => {
  const config = inject(RuntimeConfigService);
  await config.load();
  const flags = inject(FeatureFlagService);   // too late
  await flags.load(config.snapshot.apiBaseUrl);
}),
```

When the dependency you need genuinely depends on an awaited value, capture the injector itself
rather than trying to keep the context alive:

```ts
provideAppInitializer(async () => {
  const injector = inject(Injector);           // synchronous, before any await
  const config = inject(RuntimeConfigService);
  await config.load();

  // Which implementation to use is only known after the config has loaded.
  const strategy = config.snapshot.featureFlags['newPricing']
    ? injector.get(NewPricingLoader)
    : injector.get(LegacyPricingLoader);
  await strategy.warm();
}),
```

`Injector.get` is an ordinary method call on an object you are holding; it does not consult the
ambient context and therefore works in any task.

## What an initializer can see — and the scope decision hiding in that

The injector handed to `runInInjectionContext` is the application `EnvironmentInjector`. An app
initializer therefore reaches everything in `ApplicationConfig.providers`, everything
`providedIn: 'root'`, and everything the platform injector above it provides. It cannot reach
anything provided on a route, on a component, or in an environment injector created later: those are
children, and injection walks upward only.

🔴 **That is the mechanical reason "load this feature's configuration in an app initializer" quietly
forces the feature's configuration up to application scope.** The service has to be visible from the
root injector for the initializer to inject it, so a feature-scoped service becomes a root-scoped
service, and the feature's lifetime becomes the application's lifetime. Often the right answer is not
a cleverer initializer but route-level `providers` — chunk 15 — with the loading done by a resolver
or by the feature's own component.

⚠️ **The mirror image — `provideAppInitializer()` placed in a route's `providers` — appears to
compile and, mechanically, cannot run.** `ApplicationInitStatus` is constructed and its
`runInitializers()` called during bootstrap, before any route injector exists, and it reads
`APP_INITIALIZER` from the application injector; a record registered later in a child injector has
nothing that will ever look at it. **I could not find a documentation sentence stating this**, so
treat it as an inference from the construction order rather than a documented guarantee — but do not
write it, and if you inherit it, move the work to a route resolver or the feature component's own
initialisation.

## Gotchas

**★ Symptom: two `provideAppInitializer` calls, and the second intermittently reads data the first
was supposed to have fetched.** Cause: the `for` loop starts every initializer synchronously and
`Promise.all` waits for them together — array position is start order only. Fix: collapse the
dependent pair into one initializer that awaits in the order you need —

```ts
provideAppInitializer(async () => {
  const config = inject(RuntimeConfigService);
  const flags = inject(FeatureFlagService);
  await config.load();
  await flags.load(config.snapshot.apiBaseUrl);
}),
```

**★ Symptom: you reordered `app.config.ts`, the race disappeared in development, and it came back in
production.** Cause: reordering changes which callback is *invoked* first by microseconds; it does
not make the first one *finish* first. What actually changed was your network latency. Fix: the same
single-initializer collapse. If you are reasoning about provider order to fix a startup race, the
ordering model you are imagining does not exist — chunk 13 is what provider order really decides.

**★ Symptom: `inject()` inside an app initializer throws, and only in the `async` ones.** Cause:
`runInInjectionContext` covers the synchronous part of the callback; after an `await` you are in a
later microtask with no active injector. Fix: hoist every `inject()` above the first `await` —

```ts
provideAppInitializer(async () => {
  const config = inject(RuntimeConfigService);   // before any await
  const flags = inject(FeatureFlagService);      // before any await
  await config.load();
  await flags.load(config.snapshot.apiBaseUrl);
}),
```

**Symptom: an app initializer needs a service that is only provided on a lazily-loaded route, and
`inject()` throws at bootstrap.** Cause: the runner uses the application `EnvironmentInjector`;
resolution walks *up* from there, and a route injector is below it and does not exist yet. Fix:
decide which scope the work belongs to — if it must block the first render, it is application-scoped
and so is the service —

```ts
// ✅ the service moves up to where the initializer can see it
@Injectable({ providedIn: 'root' })
export class RuntimeConfigService { /* … */ }
```

**Symptom: `provideAppInitializer()` in a lazily-loaded route's `providers` never runs.** Cause:
`ApplicationInitStatus` runs once at bootstrap, reading `APP_INITIALIZER` from the application
injector; a record added to a child injector afterwards is never consulted. Fix: use the router's own
hooks for per-route startup work —

```ts
export const adminRoutes: Routes = [
  {
    path: '',
    resolve: { adminConfig: () => inject(AdminConfigService).load() },
    loadComponent: () => import('./admin-shell').then((m) => m.AdminShell),
  },
];
```

**Symptom: an initializer that needs a dependency chosen at runtime cannot be written without a
second `inject()` after the `await`.** Cause: the ambient injection context is synchronous. Fix:
capture `Injector` up front and use `injector.get(...)` afterwards, as in "The injection context ends
at the first `await`" above. This is also the shape to reach for when an initializer must branch on
a feature flag it has just fetched.

## Interview questions

**★ Why are app initializers started concurrently rather than in array order, and what would it take
to sequence them?**
Because the loop that starts them is synchronous and the waiting is one `Promise.all` at the end, so
three independent startup fetches cost one round trip instead of three. The framework offers no
ordering primitive, and that is a design position rather than an oversight: a real dependency is
expected to be expressed in JavaScript, inside a single initializer that awaits in order. Every other
approach — relying on array position, having one initializer set a token another reads, sharing a
module-scope Promise — is either a race or a hand-rolled `await` with more moving parts and no type
checking.

**★ Where does an app initializer resolve its dependencies from, and what can it therefore not see?**
From the application `EnvironmentInjector`, because the runner calls
`runInInjectionContext(this.injector, appInits)` with exactly that injector. It sees everything in
`ApplicationConfig.providers`, everything `providedIn: 'root'`, and everything the platform injector
above it provides. It cannot see anything provided on a route, in a component, or in an environment
injector created later — those are children, and injection walks upward only. So an initializer that
needs feature-scoped configuration has already forced that configuration up to application scope,
which is usually a decision worth reversing rather than a constraint worth working around.

**★ Why is `inject()` legal at the top of an `async` initializer but not after its first `await`?**
Because the injection context is a synchronous, dynamically-scoped construct rather than a property
of the callback. `runInInjectionContext` assigns a module-level current injector, invokes the
function, and restores the previous value in a `finally` — and for an `async` function, that `finally`
runs the first time the function suspends, which is the first `await`, not when its Promise settles.
Everything after the first `await` executes in a fresh task with no ambient injector, so `inject()`
has nothing to read. The fix is to capture `Injector` before suspending and call `injector.get()`
later, which is an ordinary method call and depends on no ambient state.

**Someone puts `provideAppInitializer()` in a lazily-loaded route's `providers` and reports that it
never fires. What do you tell them?**
That the placement cannot work, because `ApplicationInitStatus` is constructed at bootstrap and reads
`APP_INITIALIZER` from the application injector at that moment; a route injector is created on
navigation, long afterwards, and nothing re-runs the initializer list. Then that the *intent* is
usually right and the tool is wrong: per-route startup work belongs in a `resolve` on the route, in
the feature component's own initialisation, or in a route-level `provideEnvironmentInitializer` if it
is synchronous wiring rather than something to be awaited. Worth flagging honestly that Angular's
documentation does not spell this out — it falls out of the construction order rather than a
documented rule.

---

← Prev: [Startup and error-listener providers](06-startup-and-error-listener-providers.md) · Index: [Topic index](README.md) · Next → [When a startup initializer fails](06c-when-a-startup-initializer-fails.md)
