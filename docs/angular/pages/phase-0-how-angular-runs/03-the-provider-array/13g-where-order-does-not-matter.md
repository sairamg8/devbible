---
title: "Most of `app.config.ts` is order-independent, and the reason is that registration is eager while construction is lazy — so moving a `provide*` earlier can change which record exists but can never change when a service is built"
sidebar_label: "13g · Where order does not matter"
sidebar_position: 13.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts)
> — and angular.dev [Creating and using services](https://angular.dev/guide/di/creating-and-using-services).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[13b](13b-mixing-multi-and-non-multi.md) through [13f](13f-interceptors-and-initializers-append.md)
are a complete list of the ways order matters, which means everything not on that list is
order-independent — and that is most of the file.** This is worth stating as loudly
as the hazards, because the standard failure mode in a stuck debugging session is to start moving
lines. Reordering a provider array is nearly always a no-op, and on the rare occasion it is not, it
changes several things at once. Knowing where the rule *cannot* apply is what turns "try moving it"
back into a diagnosis.

## Registration is eager, construction is lazy — so position never moves a constructor call

The first thing `R3Injector`'s constructor does is walk the whole array and create a record for every
provider. What it does **not** do is call any of them. The multi branch quoted in
[13](13-order-dependence.md) shows the value a fresh record starts with:

```ts
        multiRecord = makeRecord(undefined, NOT_YET, true);
```

`NOT_YET` is the sentinel for "registered, not built". A record's value is materialised on the first
`get` for its token, not at registration.

🔴 **So the following two configurations construct exactly the same objects, in exactly the same
order, at exactly the same moments:**

```ts
providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor]))]
providers: [provideHttpClient(withInterceptors([authInterceptor])), provideRouter(routes)]
```

`Router`, `HttpClient` and `authInterceptor`'s dependencies are all built on first injection. What
array position controls is **which record exists** when that first injection happens — never **when**
it happens. Any theory of a bug that requires "service A was created before service B because its
provider was listed first" is wrong before you test it.

## `useExisting` and `useFactory` resolve at injection time, so an alias may precede its target

A record is a *description of how to build a value*, not the value. Nothing in `processProvider`
resolves a `useExisting` alias or calls a `useFactory` — both are stored and evaluated on the first
`get`, by which point every provider in the array has been registered. So the arrangement people
instinctively avoid is fine:

```ts
// Legal, and works. The alias is resolved when ANALYTICS_SINK is first injected,
// long after both records exist.
providers: [
  {provide: ANALYTICS_SINK, useExisting: TelemetryService},
  TelemetryService,
]
```

The same is true of a `useFactory` that calls `inject()` for something declared later in the array,
and of a `useClass` whose constructor injects something below it. **Forward references between
providers are a non-problem at registration time**; the only forward reference that needs
`forwardRef()` is one your *TypeScript module* cannot evaluate yet, which is a different layer
entirely.

⚠️ **What this does not buy you is protection from last-wins.** If a later entry replaces
`TelemetryService`'s record, the alias resolves to the replacement — aliases follow the token, not
the record that existed when they were written. That is usually what you want, and it is
occasionally a surprise:

```ts
// ANALYTICS_SINK yields a NoopTelemetryService, not a TelemetryService.
providers: [
  {provide: ANALYTICS_SINK, useExisting: TelemetryService},
  TelemetryService,
  {provide: TelemetryService, useClass: NoopTelemetryService},
]
```

## Two `provide*` calls that write disjoint tokens

This is the common case, and it is why most reordering achieves nothing. `provideRouter` writes
`ROUTES`, `ActivatedRoute` and `APP_BOOTSTRAP_LISTENER`. `provideHttpClient` writes `HttpClient`,
`FetchBackend`, `HttpInterceptorHandler`, `HttpHandler`, `HttpBackend` and `HTTP_INTERCEPTOR_FNS`.
The intersection is empty, so no ordering between the two calls is observable — in either direction,
for any token.

The same holds for `provideBrowserGlobalErrorListeners()` against `provideRouter()`, for
`provideAppInitializer()` against `provideHttpClient()`, and for essentially every pair of
subsystem-level `provide*` functions. **The rule to carry: two `provide*` calls interact only where
they write the same token, and the way to know is to read the ten lines each function returns.**

## Anything `providedIn: 'root'` is not in the array at all

angular.dev, on v22's `@Service` decorator:

> *"The `@Service` decorator serves as a modern, ergonomic shorthand for the traditional
> `@Injectable({ providedIn: 'root' })` syntax."*

A class carrying either one compiles its own provider record onto the class (`ɵprov`), and the
injector finds that record on demand — it was never a member of your `providers` array, so it has no
position in it. This is why the `Router` exists whether or not you call `provideRouter()`, and why in
v22 `inject(HttpClient)` works with an empty `app.config.ts`: `HttpClient`, `HttpHandler` and
`HttpBackend` are all root-provided, and `HTTP_INTERCEPTOR_FNS` carries its own default factory:

```ts
export const HTTP_INTERCEPTOR_FNS = new InjectionToken<readonly HttpInterceptorFn[]>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'HTTP_INTERCEPTOR_FNS' : '',
  {factory: () => [xsrfInterceptorFn]},
);
```

⚠️ **A token with a default factory is already provided; listing it in the array is an override, not
a registration.** That is the ordering-relevant consequence — a `{provide: SOME_TOKEN, useValue: x}`
for a token whose factory already returns something is a case of last-wins against an invisible
opponent, and it wins because the array is consulted before the factory. The comparison to keep
straight is covered in [14 · `providedIn: 'root'` vs the array](14-providedin-root-vs-the-array.md).

## Route providers are a different injector, not a later position

A route's `providers` array does not extend the application's array. It configures a *child*
environment injector created when the route activates, so the relationship between an application
provider and a route provider is hierarchical: the route's record shadows the application's for
anything resolved through the route's injector, and the application's is untouched everywhere else.

```ts
// This is NOT "PaymentsApi provided later than ApiClient". It is a second injector.
export const routes: Routes = [
  {
    path: 'payments',
    providers: [{provide: ApiClient, useClass: PaymentsApi}],
    loadComponent: () => import('./payments-page').then((m) => m.PaymentsPage),
  },
];
```

Two consequences that people reach for array ordering to explain, and should not:

- **A service already constructed against the application injector stays that instance.** A route
  provider cannot retroactively re-point an existing singleton, whatever order anything was in.
- **An `EnvironmentProviders` value that is only read at bootstrap does nothing in a route.**
  `provideZoneChangeDetection()` in a route's `providers` type-checks and registers, and is never
  read, because `NgZone` and `ZONELESS_ENABLED` were resolved once at bootstrap
  ([05b](05b-provide-zone-change-detection-the-opt-out.md) has this case). No reordering makes it
  work.

The hierarchy itself is Phase 6's subject; [15 · Route-level providers](15-route-level-providers.md) is the
chunk in this topic that covers the route array.

## Multi accumulation across *different* tokens

`APP_INITIALIZER` and `ENVIRONMENT_INITIALIZER` are both multi and both run at startup, and they are
completely independent arrays. Interleaving `provideAppInitializer()` and
`provideEnvironmentInitializer()` calls in the array changes the order *within* each token's array and
never the relationship between the two — environment initializers run from
`resolveInjectorInitializers()`, app initializers from `ApplicationInitStatus.runInitializers()`, and
the sequence between those two call sites is fixed in `bootstrap()`, not in your file.

```ts
// These two arrangements are identical in every observable way.
providers: [provideAppInitializer(a), provideEnvironmentInitializer(x), provideAppInitializer(b)]
providers: [provideEnvironmentInitializer(x), provideAppInitializer(a), provideAppInitializer(b)]
// App initializers: [a, b] in both. Environment initializers: [x] in both.
```

## The triage procedure, instead of reordering

When something in `app.config.ts` behaves unexpectedly, the question is never "what order should
these be in". It is four questions, in this order:

1. **Which token is misbehaving?** Not which function — which token. `provideHttpClient` writes six.
2. **Is that token `multi: true`?** Read the `provide*` function's body; it is usually under ten
   lines. Multi means every contributor survives and the consumer decides what to do with the array.
   Non-multi means exactly one record exists.
3. **How many entries in the flattened array write it?** Flattened, so expand every helper constant
   and every `provide*` call. If the answer is one, ordering is not your bug.
4. **Are they in the same injector?** An application provider and a route provider are not competing
   for a position; they are in different injectors, and the resolution rule is hierarchy, not order.

Only if steps 1–4 land on *two entries, same token, same injector* is reordering even a candidate —
and at that point the fix is to delete one of them, not to move either.

## Gotchas

**★ Symptom: you moved a `provide*` to the top of the array to make its service "initialise first",
and nothing changed.** Cause: registration creates a record with the `NOT_YET` sentinel; construction
happens on first injection. Position decides which record exists, never when it is built. Fix: if you
need work at startup, that is `provideAppInitializer()` — an explicit hook — not provider position.

**★ Symptom: swapping `provideRouter()` and `provideHttpClient()` "fixed" a bug, and it came back.**
Cause: those two calls write disjoint tokens, so the swap was a no-op and the intermittent behaviour
was always intermittent. Fix: identify the token, per the triage list above. A change that cannot
affect anything, appearing to fix something, is a strong signal that the real cause is timing or data,
not wiring.

**★ Symptom: a provider in a route's `providers` did not override the application's.** Cause: it did
— but only for injections resolved through that route's injector, and only for instances created
after the route activated. Anything already constructed against the application injector keeps its
existing instance. Fix: decide the lifetime deliberately; if the whole application should use the
override, it belongs in `ApplicationConfig.providers`.

**★ Symptom: you provided a token that already has a default factory and expected an error about
duplication.** Cause: a factory-defaulted token is provided *by the token itself*, not by the array,
so there are not two entries in the array to collide. The array entry simply wins. Fix: none needed,
but be deliberate — `HTTP_INTERCEPTOR_FNS`, `ZONELESS_ENABLED` and `INITIAL_NAVIGATION` all have
default factories, and overriding one by hand silently discards the framework's default value.

**★ Symptom: you interleaved app and environment initializers to control which runs first.** Cause:
they are separate multi tokens read by separate runners at fixed points in `bootstrap()`. Array
interleaving changes the order within each token's own array and nothing else. Fix: if one must
precede the other, express it inside one initializer, and read
[06d](06d-environment-initializers.md) for what an environment initializer can and cannot await.

**★ Symptom: reordering fixed the symptom you were chasing and broke something unrelated.** Cause: a
reorder moves *every* colliding token at once — the same two lines can carry a `LocationStrategy`
collision and an `HttpBackend` collision. Fix: revert, and delete the duplicate entry instead. A
provider array should have exactly one entry per token you intend to control, so that its order is
irrelevant by construction.

**★ Symptom: you reordered providers so that a `useExisting` alias came after its target, "to be
safe".** Cause: aliases and factories are stored, not resolved, during the registration walk — they
are evaluated on the first `get`, when every record already exists. The reorder was a no-op. Fix:
leave the order alone; if the alias genuinely resolves to the wrong thing, look for a *later* entry
replacing the target's record, because an alias follows the token rather than the record it was
written next to.

## Interview questions

**★ Does moving a `provide*` earlier in the array ever change when a service is constructed?**
No. The provider walk is eager and creates records only — the multi branch's
`makeRecord(undefined, NOT_YET, true)` shows the sentinel a record starts with — and instantiation
happens on the first `get` for the token. Array position determines *which record exists* at the
moment of that first injection, which can change *what* is constructed, but never *when*. Anyone
reasoning about startup ordering from provider position is reasoning about the wrong mechanism; the
explicit hooks are `provideAppInitializer` and `provideEnvironmentInitializer`.

**★ How would you decide, without running anything, whether two `provide*` calls in one array can
interact?**
Read what each returns. These functions are short and each one is a literal list of providers —
`provideRouter` is four entries plus the mapped features, `withHashLocation()` is one. Take the set of
tokens each writes and intersect them. An empty intersection means no possible interaction in either
direction; a non-empty one means you then ask whether the shared token is `multi: true`, which decides
whether the outcome is last-wins or accumulation. That two-step reading answers the question
completely and takes about a minute.

**★ An application provider and a route provider both provide `ApiClient`. Which wins, and is that an
ordering question?**
Neither wins in the sense the question implies, and it is not an ordering question. They live in
different injectors: the route's `providers` configure a child environment injector, so anything
resolved through that route sees the route's record and everything else sees the application's. There
is no flattened array containing both, so `processProvider` never compares them. The practical trap is
that a singleton already constructed against the application injector is not re-created for the route
— so the override applies to new resolutions through the child injector, not retroactively.

**Why is "reorder until it works" specifically dangerous here rather than merely ineffective?**
Because on the rare occasions it does something, it does several things. Two adjacent lines can
collide on more than one token, and a swap flips all of them simultaneously with no diagnostic for
any. You then have a configuration that passes the test you were looking at and has silently changed
a backend, a location strategy or an error handler. The safe operation is deletion, not movement:
reduce every token to one intended entry, at which point ordering becomes irrelevant and stays
irrelevant through the next refactor.

**If most of the array is order-independent, why does the framework not sort it or de-duplicate it?**
Because there is no key to sort by that the framework could infer, and de-duplication would break the
override mechanism the framework itself depends on — `...(appProviders || [])` spread last is what
lets your `ErrorHandler` beat the default. Any automatic de-duplication would need to know which
duplicate was intentional, and that information exists only in your head. The framework instead spends
its diagnostics on the cases where the outcome would otherwise be *undefined* — mixing multi with
non-multi, contradictory HTTP features, both change-detection providers — and leaves the defined ones
silent.

**Does a `useExisting` or `useFactory` provider need its target to be registered first?**
No. `processProvider` stores a record — `providerToRecord(provider)` — and never evaluates the alias
or calls the factory; both happen on the first `get` for the token, after the whole array has been
walked. So ordering between an alias and its target is unobservable. The subtlety worth knowing is
that the alias binds to the *token*, not to the record present at the time it was declared, so a
later provider replacing the target changes what the alias yields — which is last-wins reaching
through an indirection, not an ordering rule of its own.

← Prev: [Interceptors and initializers](13f-interceptors-and-initializers-append.md) · Index: [Topic index](README.md) · Next → [Five collisions in one config](13h-five-collisions-in-one-config.md)
