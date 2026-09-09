---
title: "A multi-provided token never overwrites, so a second `provideRouter()` call is not a duplicate but an addition — one concatenated route table where a wildcard in the first shadows the second, and two bootstrap listeners whose own guard does not stop them both running"
sidebar_label: "13e · Multi tokens append"
sidebar_position: 13.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config_loader.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config_loader.ts),
> [`router/src/router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The dangerous half of last-wins is that it is quiet; the dangerous half of multi is that it is
additive, and additive failures survive review.** Nobody looks at two `provideRouter()` calls and
sees a bug, because neither call is wrong — the bug is that both took effect. This chunk lists the
multi tokens a normal application already writes and works through the two that a second
`provideRouter()` breaks; [13f](13f-interceptors-and-initializers-append.md) does the same for the
interceptor and initializer tokens.

## The multi tokens a plain `app.config.ts` already writes

| Token | Written by | What appending does |
|---|---|---|
| `ROUTES` | `provideRouter(routes)` | route tables concatenate, first match wins |
| `APP_BOOTSTRAP_LISTENER` | `provideRouter(...)` | the listener body runs once per entry |
| `APP_INITIALIZER` | `provideAppInitializer(fn)` | every `fn` starts, all are awaited together |
| `ENVIRONMENT_INITIALIZER` | `provideEnvironmentInitializer(fn)`, `withDebugTracing()` | every `fn` runs, per injector, return value discarded |
| `HTTP_INTERCEPTOR_FNS` | `provideHttpClient(...)`, `withInterceptors([...])`, `withJsonpSupport()` | array order is execution order |
| `HTTP_ROOT_INTERCEPTOR_FNS` | framework interceptors set only in root | appended *after* the local ones |

Every row is `multi: true` in source, so every row takes `processProvider`'s push branch
([13](13-order-dependence.md)). What differs is what the *consumer* does with the accumulated array,
and that is what makes each row fail differently.

## `ROUTES` — two calls, one route table, first match wins

The token's declared type is the tell, from
[`router/src/router_config_loader.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config_loader.ts):

```ts
export const ROUTES = new InjectionToken<Route[][]>(
```

`Route[][]` — an array *of route tables*, one per contributor. And the `Router` flattens it, from
[`router/src/router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router.ts):

```ts
  config: Routes = inject(ROUTES, {optional: true})?.flat() ?? [];
```

So the failing arrangement is one that reads as perfectly ordinary:

```ts
// ⛔ Both tables register. The wildcard in publicRoutes shadows every admin route,
// because `.flat()` preserves contribution order and the router matches first-wins.
const publicRoutes: Routes = [
  {path: '', component: HomePage},
  {path: 'login', component: LoginPage},
  {path: '**', component: NotFoundPage},
];
const adminRoutes: Routes = [{path: 'admin', component: AdminPage}];

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(publicRoutes), provideRouter(adminRoutes)],
};
```

```ts
// ✅ One call. You control concatenation, so the wildcard is last where it belongs.
export const appConfig: ApplicationConfig = {
  providers: [provideRouter([...adminRoutes, ...publicRoutes])],
};
```

That is the fix [02](02-why-provide-functions-replaced-forroot.md) points here for — *"call it once
and concatenate the arrays yourself"* — and the reason it is phrased as concatenation rather than
deduplication is that appending was never the failure. Ordering the concatenation was.

⚠️ **`{optional: true}` means no `provideRouter` call at all is legal.** `config` becomes `[]`, the
`Router` still exists (it is `@Service()`, so root-provided regardless), and navigation resolves to
nothing. An empty route table and a missing router are different diagnoses;
[07](07-provide-router-and-the-route-array.md) has the distinction.

## `APP_BOOTSTRAP_LISTENER` — the second effect of that same second call

`provideRouter` also contributes `{provide: APP_BOOTSTRAP_LISTENER, multi: true, useFactory: getBootstrapListener}`,
so two calls install two listeners. The listener body, verbatim:

```ts
export function getBootstrapListener() {
  const injector = inject(Injector);
  return (bootstrappedComponentRef: ComponentRef<unknown>) => {
    const ref = injector.get(ApplicationRef);

    if (bootstrappedComponentRef !== ref.components[0]) {
      return;
    }

    const router = injector.get(Router);
    const bootstrapDone = injector.get(BOOTSTRAP_DONE);

    if (injector.get(INITIAL_NAVIGATION) === InitialNavigation.EnabledNonBlocking) {
      router.initialNavigation();
    }

    injector.get(ROUTER_PRELOADER, null, {optional: true})?.setUpPreloading();
    injector.get(ROUTER_SCROLLER, null, {optional: true})?.init();
    router.resetRootComponentType(ref.componentTypes[0]);
    if (!bootstrapDone.closed) {
      bootstrapDone.next();
      bootstrapDone.complete();
      bootstrapDone.unsubscribe();
    }
  };
}
```

🔴 **The `if (bootstrappedComponentRef !== ref.components[0]) return;` guard does not protect you
here.** It filters *which bootstrapped component* a listener acts on — it is there for applications
that bootstrap more than one root component. Two listeners invoked for the *same* first component
both pass the guard, so `router.initialNavigation()`, `setUpPreloading()`, `init()` and
`resetRootComponentType()` each run twice. The only statement with a re-entry guard is the
`BOOTSTRAP_DONE` block, protected by `if (!bootstrapDone.closed)`.

The fix is the same single call as above — there is no way to keep two `provideRouter()` calls and
suppress the duplicate listener, because the listener is not exposed as a feature.
[07b](07b-the-bootstrap-listener-and-initial-navigation.md) covers what each of those four
statements does.

## Gotchas

**★ Symptom: routes from your second `provideRouter()` call are unreachable.** Cause: `ROUTES` is
`multi: true`, `.flat()` preserves contribution order, and the router matches first-wins — so a
`{path: '**'}` in the first table shadows everything the second contributes. Fix: one
`provideRouter()` call, and concatenate the tables yourself with the wildcard last:
`provideRouter([...adminRoutes, ...publicRoutes])`.

**★ Symptom: initial navigation appears to run twice, or a preloading strategy starts twice.** Cause:
two `provideRouter()` calls installed two `APP_BOOTSTRAP_LISTENER` entries, and the listener's
`components[0]` guard filters by bootstrapped component, not by listener — both entries pass it. Fix:
collapse to one `provideRouter()` call. There is no feature to suppress the duplicate listener.

**★ Symptom: `provideRouter()` in a lazily-loaded route's `providers` had no effect on the route
table.** Cause: the root `Router` read `ROUTES` from the injector it was constructed in and holds the
result in a field; a route injector's `ROUTES` record is never consulted by it. Fix: contribute lazy
routes through `loadChildren`, and keep route-scoped *services* in the route's `providers` —
**15 · Route-level providers** *(not written yet)*.

## Interview questions

**★ Why does calling `provideRouter()` twice concatenate route tables instead of replacing one with
the other?**
Because `ROUTES` is declared `multi: true` and typed `InjectionToken<Route[][]>` — an array of route
tables, one entry per contributor. `processProvider`'s multi branch pushes rather than sets, and the
`Router` reads the accumulated value with `inject(ROUTES, {optional: true})?.flat() ?? []`. So both
tables survive and are concatenated in registration order, which also means a wildcard route in the
first table shadows everything in the second. `RouterModule.forChild` and a raw
`{provide: ROUTES, multi: true}` contribute to the same array by the same mechanism.

**★ Two `provideRouter()` calls have a second consequence beyond the route table. What is it, and why
does the listener's own guard not prevent it?**
Two `APP_BOOTSTRAP_LISTENER` entries. The guard inside the listener is
`if (bootstrappedComponentRef !== ref.components[0]) return;`, which exists so a listener acts only
for the *first bootstrapped component* in an application that bootstraps several — it is a filter on
the argument, not a once-only latch. Both listeners are invoked with the same first component, both
pass, and `router.initialNavigation()`, preloader setup, scroller init and `resetRootComponentType`
all run twice. Only the `BOOTSTRAP_DONE` block is idempotent, via `if (!bootstrapDone.closed)`.

{/* FOOTER */}
