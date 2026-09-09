---
title: "Route providers are visible to guards and resolvers — but `canActivate`, `canActivateChild`, `canDeactivate` and `canMatch` each resolve against a different injector, and one of the two startup initializers silently never runs"
sidebar_label: "15d · Guards, resolvers and route initializers"
sidebar_position: 15.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers#route-providers);
> and `angular/angular` at tag `v22.1.5`:
> [`router/src/operators/check_guards.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/operators/check_guards.ts),
> [`router/src/operators/resolve_data.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/operators/resolve_data.ts),
> [`router/src/utils/config_matching.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config_matching.ts),
> [`router/src/router_state.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_state.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**angular.dev summarises route-provider scope in one sentence — services are available to the route's components, guards and resolvers — and that sentence is true but too coarse to debug with.** There are four guard kinds and they resolve against three different injectors: the route being entered, the route that *declared* the guard, and the route being *left*. Get that wrong and you get an `NG0201` from a guard while the identical `inject()` call works from the component two lines of routing config away. The same page then works through the other half of the surprise — of the two startup providers from [06](06-startup-and-error-listener-providers.md), `provideEnvironmentInitializer()` runs in a route injector and `provideAppInitializer()` does not, silently. [15](15-route-level-providers.md) established the injector; this page is about who can see it and what fires inside it.

## Which injector does a guard run in — the four answers are not the same

The page's most-cited sentence, from angular.dev, is:

> *"Services provided at the route level are available to all components and directives within that route, as well as to its guards and resolvers."*

True, and too coarse to debug with. There are four guard kinds and they resolve against three different injectors, all readable in
[`packages/router/src/operators/check_guards.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/operators/check_guards.ts).

**`canActivate` — the injector of the route being activated:**

```ts
    return defer(() => {
      const closestInjector = futureARS._environmentInjector;
      const guard = getTokenOrFunctionIdentity<CanActivate>(
        canActivate as ProviderToken<CanActivate>,
        closestInjector,
      );
      const guardVal = isCanActivate(guard)
        ? guard.canActivate(futureARS, futureRSS)
        : runInInjectionContext(closestInjector, () =>
            (guard as CanActivateFn)(futureARS, futureRSS),
          );
```

`futureARS` is the snapshot of the route the guard is declared on, and its `_environmentInjector` is the value `recognize` assigned as `route._injector ?? injector`. So a `canActivate` on a route that has `providers` sees them.

**`canActivateChild` — the injector of the route that *declares* the guard, not the child being entered:**

```ts
      const guardsMapped = d.guards.map(
        (canActivateChild: CanActivateChildFn | ProviderToken<unknown>) => {
          const closestInjector = d.node._environmentInjector;
```

`d.node` walks the ancestor path — the guard runs in the ancestor's injector. A `canActivateChild` declared on `/admin` sees `/admin`'s providers even while guarding `/admin/users`, and does **not** see providers declared on `/admin/users`.

**`canDeactivate` — the injector of the route being *left*:**

```ts
  const canDeactivateObservables = canDeactivate.map((c: any) => {
    const closestInjector = currARS._environmentInjector;
```

`currARS` is the *current* snapshot, not the future one. Leaving `/editor` for `/dashboard`, the guard resolves against `/editor`'s injector — which is what you want, because the unsaved-changes service it needs lives there.

**`canMatch` — the injector this navigation just created**, passed positionally rather than read off a snapshot, because at `canMatch` time there is no activated snapshot yet. That is the call in `config_matching.ts` above.

**Resolvers** take the `canActivate` rule. From
[`packages/router/src/operators/resolve_data.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/operators/resolve_data.ts):

```ts
function getResolver(
  injectionToken: ProviderToken<any> | Function,
  futureARS: ActivatedRouteSnapshot,
  futureRSS: RouterStateSnapshot,
): Observable<any> {
  const closestInjector = futureARS._environmentInjector;
  const resolver = getTokenOrFunctionIdentity(injectionToken, closestInjector);
  const resolverValue = resolver.resolve
    ? resolver.resolve(futureARS, futureRSS)
    : runInInjectionContext(closestInjector, () => resolver(futureARS, futureRSS));
  return wrapIntoObservable(resolverValue);
}
```

Note `runInInjectionContext` in every one of these. Functional guards and resolvers may call `inject()` at the top level precisely because the router establishes an injection context around them — and the injector it establishes is the one this page is about.

## Initializers on a route — one runs, one silently does not

Two of the startup providers from [06](06-startup-and-error-listener-providers.md) behave in opposite ways when you put them in a route's `providers`, and the difference is not documented anywhere except in the code that consumes them.

**`provideEnvironmentInitializer()` runs — once, per injector, and only its own.** The runner in `r3_injector.ts` reads the token with `{self: true}`:

```ts
      const initializers = this.get(ENVIRONMENT_INITIALIZER, EMPTY_ARRAY, {self: true});
```

`self: true` means no walk to the parent. So a route injector executes exactly the environment initializers registered in *that route's* `providers`, and does not re-run the application's. That is the mechanism [06d](06d-environment-initializers.md) describes, seen from the route side: an environment initializer is genuinely a per-injector construction hook, and route injectors are the second place one exists.

The practical consequence is a real pattern and a real trap in the same fact. `provideBrowserGlobalErrorListeners()` on a route ([06f](06f-provide-browser-global-error-listeners.md)) installs a **second** pair of `window` listeners scoped to that route injector's lifetime — and since the route injector is not destroyed by default, "scoped" means "until the tab closes".

**`provideAppInitializer()` does not run.** ⚠️ **This is an inference from the mechanism, not a documented sentence — I could not find any Angular documentation that states it.** The reasoning: `provideAppInitializer` contributes to the multi-token that `ApplicationInitStatus` consumes, and `ApplicationInitStatus.runInitializers()` is called once during `bootstrapApplication`, reading the application injector. A route injector does not exist at that moment and is never re-consulted afterwards. Nothing throws, nothing warns, and the function simply never executes. Treat this as high-confidence but unverified, and if you need a route to run setup work, use `provideEnvironmentInitializer()` — which is the token that *is* read per injector.

```ts
export const routes: Routes = [
  {
    path: 'reporting',
    providers: [
      // ✅ runs when this route's injector is constructed
      provideEnvironmentInitializer(() => inject(ReportingTelemetry).start()),
      // ⛔ registered in an injector that bootstrap never reads
      // provideAppInitializer(() => inject(ReportingTelemetry).warmUp()),
    ],
    loadChildren: () => import('./reporting/reporting.routes').then((m) => m.reportingRoutes),
  },
];
```

## The one provider whose documentation names route providers explicitly

Everything above is about mechanism you have to infer. There is exactly one `provide*` in
`@angular/core` whose own JSDoc states that a route is a supported position, and it is worth reading
because it describes the route-injector lifetime as a *feature* rather than a caveat.
`provideExperimentalWebMcpTools`, from
[`core/src/webmcp/provide_tools.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/webmcp/provide_tools.ts), verbatim:

> *"Provides a list of WebMCP tools tied to the lifecycle of the associated `Injector`."*
>
> *"The tools are automatically registered when the environment is initialized and unregistered when the associated injector is destroyed."*
>
> *"The `tools[number].execute` function is invoked in the injection context of the associated `Injector`."*
>
> *"@returns An {@link EnvironmentProviders} that can be used in `bootstrapApplication` or route providers."*
>
> `@experimental`

Three sentences, three of this page's mechanisms. *"registered when the environment is initialized"*
is the `ENVIRONMENT_INITIALIZER` read with `{self: true}` — so a route's tools register when that
route's injector is constructed, and the application's do not re-register. *"unregistered when the
associated injector is destroyed"* is the `DestroyRef` hook, which for a route injector means the
teardown that [15e](15e-the-injector-that-is-never-destroyed.md) explains does not happen by default.
And *"invoked in the injection context"* is the same `runInInjectionContext` wrapper the guards and
resolvers above run inside, so a tool may call `inject()` directly.

[11g](11g-the-standalone-core-providers.md) covers the provider itself and its `@experimental`
standing. What it points here for is the pattern: register a lazy feature's tools on that feature's
route, and their availability follows the feature rather than the application. 🔴 The catch, and it
is the same catch as everywhere else on this page, is that "unregistered when the injector is
destroyed" is conditional on the injector ever being destroyed.

## Gotchas

**★ Symptom: a `canActivateChild` guard cannot see a service the child route provides.** Cause: `canActivateChild` resolves against `d.node._environmentInjector` — the injector of the ancestor route that *declares* the guard, not of the child being entered. The child's injector is below it in the tree, and injectors resolve upward only. Fix: move the guard down to the child as `canActivate`, or move the provider up to the route that declares the guard —

```ts
export const routes: Routes = [
  {
    path: 'admin',
    providers: [AdminPolicy],                 // now visible to canActivateChild
    canActivateChild: [() => inject(AdminPolicy).allows()],
    children: [{ path: 'users', loadComponent: () => import('./users').then((m) => m.Users) }],
  },
];
```

**★ Symptom: a `canDeactivate` guard injects a service and gets the wrong instance during a cross-feature navigation.** Cause: `canDeactivate` uses `currARS._environmentInjector` — the injector of the route being **left**, not the one being entered. That is correct behaviour and almost always what you want, but it surprises people who assume guards run "in the destination". Fix: nothing, once you know it. Rely on it: keep the unsaved-changes state in the outgoing feature's route providers and the guard resolves it naturally.

**★ Symptom: a `canMatch` guard injects a route-provided service and it works — which you did not expect.** Cause: `matchWithChecks` calls `getOrCreateRouteInjectorIfNeeded` immediately *before* `runCanMatchGuards`, so the injector exists by the time the guard runs. Consequence rather than fix: a `canMatch` that returns `false` has still caused the route's injector — and everything the guard injected from it — to be constructed. If the point of the `canMatch` was to avoid paying for the feature, that is only true of the lazy chunk, not of the providers.

**★ Symptom: `provideAppInitializer()` in a route's `providers` never runs, with no error.** Cause: `ApplicationInitStatus` consumes the initializer token once, during bootstrap, from the application injector; a route injector does not exist yet and is never re-read. ⚠️ Stated as an inference from the bootstrap sequence — no Angular documentation asserts it. Fix: use `provideEnvironmentInitializer()`, which `r3_injector` reads per injector with `{self: true}`, so it fires exactly when the route's injector is constructed.

**★ Symptom: `provideBrowserGlobalErrorListeners()` on a route and errors get reported twice.** Cause: environment initializers are read with `{self: true}`, so the route injector runs its own copy in addition to — not instead of — the application's. Two sets of `window` listeners, two reports per error. Fix: call it once, in `app.config.ts`. If a feature needs different error handling, override `ErrorHandler` in the route's providers instead of installing a second listener pair ([06g](06g-error-handler-and-ng0402.md)).

**★ Symptom: a route-provided service calls `inject(ActivatedRoute)` and gets the root route, or params that are always empty.** Cause: angular.dev states it directly — *"Since these services are instantiated independently of the route's components, they do not have direct access to route-specific information."* The service lives in the route's **environment** injector, which is created during recognition and knows nothing about which URL matched; `ActivatedRoute` for a component comes from the outlet's element injector. Fix: pass the parameters in rather than injecting for them —

```ts
@Service()
export class ReportLoader {
  private readonly http = inject(HttpClient);
  load(reportId: string) {
    return this.http.get<Report>(`/api/reports/${reportId}`);
  }
}

// in the routed component, which does have the right ActivatedRoute
export class Detail {
  private readonly route = inject(ActivatedRoute);
  private readonly loader = inject(ReportLoader);
  readonly report = this.loader.load(this.route.snapshot.paramMap.get('id')!);
}
```

**★ Symptom: `withRequestsMadeViaParent()` on a route throws only when the user opens that screen, and never in a production build.** Cause: the check lives inside the `HttpBackend` `useFactory` and is guarded by `ngDevMode` — [10f](10f-requests-made-via-parent.md) works this through. It is a use-time error, not a configuration-time one, which is exactly the shape route providers give everything: the injector does not exist until the route matches, so nothing in it can fail early. Fix: cover the route in a smoke test that actually navigates to it. Nothing at bootstrap will tell you.

## Interview questions

**★ Which injector does a `canActivate` guard resolve against, and how would you prove it?**
The injector of the route the guard is declared on. `runCanActivate` reads `futureARS._environmentInjector` and passes it to both `getTokenOrFunctionIdentity` and `runInInjectionContext`, and that field was set in `recognize` from `route._injector ?? injector` — the route's own injector if it has `providers`, otherwise the nearest providing ancestor's. You can prove it without a debugger by putting a token in a route's `providers` and injecting it from a functional `canActivate` on the same route: it resolves. Move the guard to the parent and it throws `NG0201`, because the parent's injector is above the record.

**★ A `canActivateChild` on the parent and a `canActivate` on the child both `inject(FeatureConfig)`, which is provided on the child. What happens?**
The `canActivate` resolves it; the `canActivateChild` throws `NG0201`. `canActivateChild` runs in `d.node._environmentInjector`, where `d.node` is the ancestor that declared the guard — so it sees the parent's injector, and the child's providers are in a child injector it cannot reach. Injectors resolve upward, never downward. This is the single most common "but the docs said guards can see route providers" confusion, and the sentence in the docs is true; it just does not distinguish the four guard kinds.

**★ Which `provide*` functions are wrong on a route even though they compile?**
Anything consumed once at bootstrap. `provideRouter` — the `Router` read `ROUTES` from the injector it was constructed in and never looks again. `provideZoneChangeDetection` / `provideZonelessChangeDetection` — change detection is configured while the application injector is being built. `provideClientHydration` — hydration is wired against the server-rendered document at bootstrap. `providePlatformInitializer` — it returns `StaticProvider`, not `EnvironmentProviders`, and belongs to the platform injector one level above the application. And `provideAppInitializer`, for the same reason. All of them type-check in a route's `providers` because the position accepts the union; none of them do anything there. The general test is "is this token read once at startup, or read by whoever needs it" — the first kind is bootstrap-only, the second kind is route-shaped.

**Which environment initializers run in a route injector?**
Only the ones registered in that route's own `providers`. The runner in `r3_injector.ts` reads the multi-token with `{self: true}`, which disables the walk to the parent — so the application's environment initializers are not re-run when a route injector is constructed, and a route's are not run at bootstrap. The return value is also discarded, so an initializer returning a promise is not awaited: a route injector's construction is synchronous and nothing blocks navigation on it.

{/* FOOTER */}
