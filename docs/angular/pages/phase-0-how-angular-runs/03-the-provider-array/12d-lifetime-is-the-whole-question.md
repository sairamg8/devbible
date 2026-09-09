---
title: "Triage step two asks one question — how many of this thing should exist and for how long — and Angular's four answers differ in a way the identical type signature of two of them actively hides"
sidebar_label: "12d · Lifetime is the question"
sidebar_position: 12.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers#route-providers),
> [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection) — and
> `angular/angular` at tag `v22.1.5`:
> [`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The question is never "is this service important". It is "how many of these should exist, and
for how long" — and that question has exactly four answers in Angular, two of which have an
identical type signature and completely different lifetimes.** This is triage step two: the entry
is correct, the class is correct, and it is simply registered in an injector that outlives what it
describes. Getting it wrong is invisible in a single-user development session and shows up as
shared state between two screens the first time somebody opens two of something.

## The four positions

| One instance per… | Where it goes | Declared type |
|---|---|---|
| application | `ApplicationConfig.providers` | `Array<Provider \| EnvironmentProviders>` |
| screen or feature area | `Route.providers` | `Array<Provider \| EnvironmentProviders>` |
| component instance | `Component.providers` | `Provider[]` |
| component instance, hidden from projected content | `Component.viewProviders` | `Provider[]` |

🔴 **The type column is why "move it to the route" always works for a `provide*()` and "move it to
the component" never does.** `Route.providers` is the *same union* as the application config —
from
[`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts),
verbatim:

```ts
  /**
   * A `Provider` array to use for this `Route` and its `children`.
   *
   * The `Router` will create a new `EnvironmentInjector` for this
   * `Route` and use it for this `Route` and its `children`. If this
   * route also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be
   * used as the parent of the lazy loaded module.
   */
  providers?: Array<Provider | EnvironmentProviders>;
```

Component positions are `Provider[]`, so a `provide*()` there is a compile error and `NG0207` if
the compile error is bypassed — [03](03-environmentproviders-vs-provider.md) has both variants. The
difference between the last two rows is an element-injector question that **Phase 6 — Dependency
injection** *(not written yet)* owns; name it and stop.

**The identical signature on the first two rows is the trap.** Nothing in
`Array<Provider | EnvironmentProviders>` says that one of these positions is instantiated once per
application and the other once per route activation. Two lines that look the same and read the same
produce a global singleton and a per-screen instance respectively, and the only way to know which
you wrote is to know which file you are in.

## The route case, from angular.dev

Its own example, verbatim from
[Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers#route-providers):

```ts
// routes.ts
export const routes: Routes = [
  {
    path: 'admin',
    providers: [
      AdminService, // Only loaded with admin routes
      {provide: FEATURE_FLAGS, useValue: {adminMode: true}},
    ],
    loadChildren: () => import('./admin/admin.routes'),
  },
  {
    path: 'shop',
    providers: [
      ShoppingCartService, // Isolated shopping state
      PaymentService,
    ],
    loadChildren: () => import('./shop/shop.routes'),
  },
];
```

with the guidance it sits under, verbatim:

> *"Use route-level providers for:"*
>
> *"- **Feature-specific services** - Services only needed for particular routes or feature modules"*
>
> *"- **Lazy-loaded module dependencies** - Services that should only load with specific features"*
>
> *"- **Route-specific configuration** - Settings that vary by application area"*

and the sentence that defines the reach of the move:

> *"Services provided at the route level are available to all components and directives within that
> route, as well as to its guards and resolvers."*

🔴 And the sentence that is the price of it:

> *"Since these services are instantiated independently of the route's components, they do not have
> direct access to route-specific information."*

Read the two together. A route-provided service is visible to more than people expect — guards and
resolvers included, which is exactly what you want for an authorisation cache — and knows less than
people expect, because it is not a component and has no `ActivatedRoute` of its own. Both halves
surprise somebody on every project.

## The component-instance case

State that must not outlive the screen and must not be shared between two of them:

```ts
@Component({
  selector: 'app-order-wizard',
  providers: [OrderWizardState],
  template: `<app-order-step-one /><app-order-step-two />`,
  imports: [OrderStepOne, OrderStepTwo],
})
export class OrderWizard {
  protected readonly state = inject(OrderWizardState);
}
```

Two of these on one page get two independent `OrderWizardState` instances, which is the entire
reason to write it this way, and the step components find their own wizard's state by walking up
from wherever they are rendered. Put `OrderWizardState` in `app.config.ts` instead and the second
wizard silently shares the first one's draft — with no error, at any point, in any build.

**This is the position with no alternative.** Steps 1 and 3 of the triage were about ownership and
had several defensible answers; per-instance lifetime has exactly one home, because it is the only
injector in the framework created per usage of a component. **15 · Route-level `providers`** *(not
written yet)* works through the route half in detail.

## Gotchas

**★ Symptom: you moved a `provide*()` call onto a component's `providers` and got
`Type 'EnvironmentProviders' is not assignable to type 'Provider'`.** Cause: `Component.providers`
is `Provider[]` and every `provide*` returns `EnvironmentProviders`. Fix: the nearest legal narrower
home is a route, not a component:

```ts
// wrong
@Component({selector: 'app-admin', providers: [provideHttpClient()], template: ''})
export class Admin {}

// right — the route that owns the screen
{path: 'admin', providers: [provideHttpClient(withInterceptors([adminInterceptor]))],
 loadComponent: () => import('./admin').then((m) => m.Admin)}
```

**★ Symptom: you moved a service to two sibling routes' `providers` and got two instances.** Cause:
each `Route` with a `providers` array gets **its own** `EnvironmentInjector` — the doc comment says
so — so two sibling routes are two injectors. Fix: if the two screens must share, hoist the
`providers` onto their common parent route, which both children then inherit:

```ts
// two instances
{path: 'orders', providers: [OrderCache], loadComponent: …},
{path: 'invoices', providers: [OrderCache], loadComponent: …},

// one instance, shared by both children
{path: 'billing', providers: [OrderCache], children: [
  {path: 'orders', loadComponent: …},
  {path: 'invoices', loadComponent: …},
]},
```

**★ Symptom: you moved a service to a route's `providers` and it still behaves like a singleton
across the whole application.** Cause: the class is still `@Injectable({providedIn: 'root'})` *and*
something outside the route injects it — a root-provided class and a route-provided one are two
records, and each consumer gets whichever its injector reaches first. Fix: remove `providedIn:
'root'` from a class you intend to scope to a route. The same double-registration trap is worked in
[04](04-writing-your-own-provide-function.md).

**★ Symptom: a service you moved to a route's `providers` cannot read the route's params.** Cause:
angular.dev states it outright — *"Since these services are instantiated independently of the
route's components, they do not have direct access to route-specific information."* The injector is
created for the route, but the service is not a component and has no `ActivatedRoute` of its own.
Fix: inject `Router` and read `router.routerState.snapshot`, or pass the parameter in from the
component that does have an `ActivatedRoute`. **Phase 8 — Routing** *(not written yet)* owns the
general question.

**★ Symptom: a guard cannot see a service you provided on the route it guards.** Cause: it usually
can — the documentation includes guards and resolvers in the reach of a route's providers — so if
it cannot, the guard is declared on a *parent* route, whose injector is created before the child's
and cannot see into it. Fix: move the guard down to the route that owns the providers, or move the
providers up to the route that owns the guard. Which of the two is right is a scope decision, not a
mechanical one.

**★ Symptom: per-component state leaks between two instances of the same component on one page.**
Cause: the state class is provided in `app.config.ts` or `providedIn: 'root'`, so both components
inject the same instance. Fix: list the class in the component's own `providers`, which creates a
record per component instance:

```ts
// leaks — one shared instance for every wizard on the page
@Injectable({providedIn: 'root'})
export class OrderWizardState {}

// isolated — one per <app-order-wizard>
@Injectable()
export class OrderWizardState {}

@Component({selector: 'app-order-wizard', providers: [OrderWizardState], template: ''})
export class OrderWizard {}
```

⚠️ Note the decorator loses `providedIn` in the second form. Leaving `providedIn: 'root'` on it as
well is legal and registers it in both places, which works but leaves a root instance nothing uses.

**★ Symptom: a service you scoped to a route is still constructed at bootstrap.** Cause: something
in the root injector injects it — an initializer, an interceptor, another root service — and the
root record it finds is a different one from the route's. Fix: find the root-level consumer first;
scoping is only real if nothing above the scope reaches in. This is the same shape as the previous
gotcha and is why "move it to the route" is a two-part change: add it there, and remove every way
of getting it from above.

**★ Symptom: a route-provided service is never destroyed and holds a subscription open after you
navigate away.** Cause: route injectors are not automatically cleaned up by default. Fix: implement
`ngOnDestroy` on the service and rely on the injector's own destruction where it happens, and treat
long-lived subscriptions in route-provided services as something to review deliberately;
`withExperimentalAutoCleanupInjectors()` is the experimental opt-in and is covered in
[08g](08g-tracing-and-the-experimental-end.md). ⚠️ Do not assume the injector is destroyed on
navigation — verify it for your version before relying on it.

## Interview questions

**★ How do you decide between the application config, a route's `providers`, and a component's
`providers`?**
By lifetime and by nothing else — "how many of these should exist, and for how long". One per
application is the config. One per screen or feature area is the route, and you get a real
`EnvironmentInjector` created by the `Router` for that route and its children. One per component
instance is the component's `providers`, and that is the only one of the three that gives you a new
instance per usage of the component, which is what makes it right for per-instance state like a
wizard's draft. There is a hard type constraint underneath: route and application positions are
both `Array<Provider | EnvironmentProviders>`, so any `provide*()` is legal in either, while
component positions are `Provider[]`, so a `provide*()` there will not compile. The practical
decision is therefore really two decisions — application versus route is a scope judgement, and
component versus either is usually settled by the type before you get to judge anything.

**★ A colleague says route-level providers are just application providers with extra steps. What is
the substantive difference?**
Three things, none of which is style. Lifetime and identity: the `Router` creates a distinct
`EnvironmentInjector` per route with `providers`, so two sibling routes get two instances of the
same class, and a parent route's providers are shared by its children — you get a scope you can
reason about instead of one global one. Loading: a route's providers live in the route's chunk, so a
lazy feature's wiring is not in the initial bundle, which an application config entry always is.
Blast radius: an accidental duplicate registration inside one route's providers changes behaviour on
that route only, whereas the same mistake in the config changes it everywhere. The type is
identical, which is exactly what makes the difference easy to miss — nothing in the signature tells
you that one of the two positions is instantiated once per route activation.

**★ Why is the "two wizards on one page share their draft" bug so hard to catch before production?**
Because every mechanism involved behaves correctly and quietly. A root-provided state class is a
legal, idiomatic singleton; the component injects it successfully; nothing is undefined and nothing
throws. The bug only exists when two instances of the component are alive at the same time, which
in a development session usually never happens — you open one wizard, it works, you ship. It
surfaces in a split view, a modal opened over a page that already had one, or a list that renders
the component per row. The defence is not a test after the fact but the triage question asked up
front: *how many of these should exist?* If the answer is "one per component", the only correct
home is the component's `providers`, and no amount of care in the root config substitutes for it.

**★ A route's providers are visible to that route's guards and resolvers. Why is that worth
knowing?**
Because it is what makes a route's providers a real feature-scope rather than just a lazy-loading
trick. An authorisation cache, a feature-flag snapshot or a per-area API client can be provided on
the route and used by the guard that decides whether the route may be entered at all, without
existing anywhere else in the application. The documentation states the reach explicitly. The
complement is the sentence right after it — those services are instantiated independently of the
route's components and so have no direct access to route-specific information — which means the
guard can read the service, but the service cannot read the route. Design for information flowing
in that direction and route-scoped services stay simple.

{/* FOOTER */}
