---
title: "Read the clauses in order — `Path:` names the failing token, `Source:` names where the walk began — and the first two of the three causes separate cleanly: the provider does not exist, or it exists in an injector that is not on the consumer's ancestor chain"
sidebar_label: "16g · Not there, or not reachable"
sidebar_position: 16.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`router/src/router_outlet_context.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_outlet_context.ts) (verbatim),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`NG0201` means one thing only: a walk that started at some injector reached the end without finding a record.** Three quite different mistakes produce that, and the clauses of the message discriminate between them — which is why the previous chunks spent so long on how the message is built. This chunk gives the reading order and works the first two causes with the config that produces each and the config that fixes it. The second is the one that costs an afternoon, because the provider is right there in a file you can open; the reason it does not work is that injectors resolve upward only, and a route's injector is a child of the application injector, never an ancestor of it.

## One symptom, three causes — and the message tells you which

An `NG0201` for token `X` means only this: *a walk that started at some injector reached the end
without finding a record for `X`*. Three quite different mistakes produce it, and the clauses of
the message discriminate between them.

**Read the error in this order.**

1. **Is there a `Path:` clause?** If yes, the last entry is the token that was actually missing
   and the earlier ones are the chain that asked for it. If there is no `Path:`, either the
   failing token was requested directly (path length 1) or you are in a production build and
   there is no message at all.
2. **What does `Source:` say?** It names the injector where the walk *began* — the debug name of
   the outermost injector on the stack. `Environment Injector` is the application injector from
   `bootstrapApplication`.
3. **Does the token in the message exist anywhere in a `providers` array or an
   `@Injectable`/`@Service` decorator?** If no, you are in cause 1. If yes, you are in cause 2 or
   cause 3, and the next question is whether the *consumer* can reach the injector the provider
   is in.

### Cause 1 — the provider genuinely is not there

The boring one, and still the most common. A class with no `providedIn` and no array entry:

```ts
// report-store.ts — no decorator argument, so no root registration
@Service()
export class ReportStore {
  readonly rows = signal<Row[]>([]);
}
```

```ts
// app.config.ts — and it is not here either
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()],
};
```

Fix — pick one, do not do both ([14](14-providedin-root-vs-the-array.md) argues which):

```ts
@Service({providedIn: 'root'})
export class ReportStore {
  readonly rows = signal<Row[]>([]);
}
```

### Cause 2 — it is there, in an injector this consumer cannot reach

This is the one that wastes the afternoon, because you can see the provider in the file. The
provider is registered; the consumer resolves through a different branch of the tree.

The route-level version is the sharpest, and it is exactly the case
[15](15-route-level-providers.md) sets up:

```ts
// routes.ts — ReportStore lives in the /reports route injector
export const routes: Routes = [
  {
    path: 'reports',
    providers: [ReportStore],
    loadComponent: () => import('./reports').then((m) => m.Reports),
  },
];
```

```ts
// a root singleton — created by the application injector, which is ABOVE the route injector
@Service({providedIn: 'root'})
export class Analytics {
  private readonly store = inject(ReportStore);   // 🔴 NG0201, always
}
```

Injectors resolve **upward only**. `Analytics` is instantiated by the application injector, whose
parent chain does not contain the route injector — the route injector is its *child*. The
message will read `Source: Environment Injector.` because the walk started at the application
injector, which is the clue: a route-provided token can never appear in a walk that starts
above it.

Fix, if `Analytics` genuinely needs it, is to move the provider up:

```ts
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), ReportStore],
};
```

Fix, if `Analytics` is really a per-report concern, is to move the *consumer* down — provide it
on the route beside the store, and it resolves:

```ts
export const routes: Routes = [
  {
    path: 'reports',
    providers: [ReportStore, Analytics],
    loadComponent: () => import('./reports').then((m) => m.Reports),
  },
];
```

The mechanism that decides which injector a routed component is created in is one field read.
From
[`packages/router/src/router_outlet_context.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_outlet_context.ts):

```ts
  get injector(): EnvironmentInjector {
    return this.route?.snapshot._environmentInjector ?? this.rootInjector;
  }
```

That `??` is the whole rule. A route with `providers` has an `_environmentInjector` on its
snapshot and its component is created in it; a route without providers falls through to
`rootInjector`. [15b](15b-when-the-injector-is-created.md) walks the six hops that put the
injector on the snapshot in the first place.

The component-level version of cause 2 is the same shape one tree down:

```ts
@Component({
  selector: 'app-editor',
  providers: [DraftState],            // element injector, this component and its children
  template: `<app-toolbar />`,
})
export class Editor {}

@Component({selector: 'app-sidebar', template: ''})
export class Sidebar {
  private readonly draft = inject(DraftState);   // 🔴 NG0201 — Sidebar is not inside Editor
}
```

🔴 **Element-injector resolution order is Phase 6's subject and this page stops here.** What
belongs to *this* topic is only the diagnostic consequence: the provider you can see in a
`providers:` array is real, and the question to ask is never *"is it provided"* but *"is it
provided somewhere on the consumer's ancestor chain"*.

## Gotchas

**★ Symptom: a `providedIn: 'root'` service throws `NG0201` for a token you can see in a route's `providers`.** Cause: injectors resolve upward. The root singleton is created by the application injector; the route injector is its child, not its ancestor. Fix — move the provider up, or the consumer down:

```ts
// up: the token becomes application-wide
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), ReportStore],
};

// down: the consumer joins the route that owns the state
export const routes: Routes = [
  {path: 'reports', providers: [ReportStore, Analytics], loadComponent: () => import('./reports').then((m) => m.Reports)},
];
```

**★ Symptom: a sibling component cannot see a service another component lists in `providers`.** Cause: a component's `providers` array creates an element injector visible to that component and its template descendants only. A sibling resolves through their common parent. Fix: lift the provider to the common ancestor component, or to the route both are under —

```ts
@Component({
  selector: 'app-editor-shell',
  providers: [DraftState],                    // now visible to both children
  template: `<app-editor /><app-sidebar />`,
})
export class EditorShell {}
```


**★ Symptom: a guard throws `NG0201` for a service the routed component injects without any trouble.** Cause: a guard does not necessarily resolve against the route being entered. `canActivateChild` resolves against the injector of the ancestor route that *declares* it, and `canDeactivate` against the route being **left** — [15d](15d-guards-resolvers-and-route-initializers.md) has all four guard kinds and the three injectors they use. The component, meanwhile, is created with `OutletContext.injector`, which is the entered route's injector. Fix: move the guard down to the route that owns the provider, or move the provider up to the route that declares the guard —

```ts
export const routes: Routes = [
  {
    path: 'admin',
    providers: [AdminPolicy],                        // visible to the guard declared here
    canActivateChild: [() => inject(AdminPolicy).allows()],
    children: [{path: 'users', loadComponent: () => import('./users').then((m) => m.Users)}],
  },
];
```

**★ Symptom: two sibling routes provide the same service and each screen sees its own copy, which you did not intend.** Cause: `Route.providers` creates one `EnvironmentInjector` **per route**, cached on `route._injector`; two routes with the same entry are two registrations in two injectors, not one shared record. The absence of an error is what makes this hard — it fails as duplicated state, never as `NG0201`. Fix: hoist the provider to the common parent route, which both children then resolve upward into —

```ts
export const routes: Routes = [
  {
    path: 'reports',
    providers: [ReportStore],                        // one injector, one instance
    children: [
      {path: 'daily', loadComponent: () => import('./daily').then((m) => m.Daily)},
      {path: 'weekly', loadComponent: () => import('./weekly').then((m) => m.Weekly)},
    ],
  },
];
```

**★ Symptom: the unit test passes and the application throws `NG0201` on the same component.** Cause: `TestBed` builds an environment injector from the providers you hand it; it does not build your route tree. A component that depends on a route-provided service resolves it happily from the testing injector and has nothing to resolve it from at runtime, because in the application it is mounted under a route that does not declare the provider. Fix: make the test's injector match the shape of the real one — configure the provider at the same level the application does, and if the dependency is genuinely route-scoped, exercise it through the router rather than by constructing the component directly. [14f](14f-testing-overrides.md) works through the override mechanics.

## Interview questions

**★ Walk me through diagnosing an `NG0201` you have never seen before.**
Three questions in order. Is there a `Path:`? If so, the last entry is the token that was actually missing and the earlier ones are the chain that asked for it; if not, the failing injection is either the one you wrote directly or you are looking at a production build with no message at all. What does `Source:` say — that is where the walk began, so it identifies the consumer's injector. Then: does the token exist anywhere at all? If it does not, it is a missing registration. If it does, the question is whether the provider's injector is an ancestor of the consumer's, which is where route-level and component-level providers bite: a `providedIn: 'root'` service can never see a token provided on a route, because the route injector is a child of the application injector and resolution goes upward only. And if the provider *is* on an ancestor and it still throws, you are looking at token identity — two `InjectionToken` instances with the same description, or two copies of the same class from duplicated packages, both of which print the same name in the message because `stringify` prints `.name`.

**★ Why can a route-provided service never be injected by a `providedIn: 'root'` singleton?**
Because of when and where each is constructed. The root singleton is instantiated by the application injector, whose parent chain runs up to the platform injector and the `NullInjector` — it does not contain any route injector, because route injectors are created later and hang *below* it. Resolution only ever walks upward, so the token is unreachable, and the error will read `Source: Environment Injector.` because that is where the walk began. The router side of the mechanism is a single field read: `OutletContext.injector` returns `this.route?.snapshot._environmentInjector ?? this.rootInjector`, so a routed component gets the route's injector when the route declares `providers` and the root injector otherwise. The fix is to decide which lifetime the service really has — move the provider to `app.config.ts` if it is application-wide, or move the consumer onto the route if it is a per-feature concern.

← Prev: [How a token is printed](16f-how-a-token-is-printed.md) · Index: [Topic index](README.md) · Next → [When it is a different token](16h-when-it-is-a-different-token.md)
