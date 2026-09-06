---
title: "Route-scoped providers narrow the injector and nothing else — the router builds a child `EnvironmentInjector` for the route and its children, which confines a legacy module's blast radius without reducing by one byte what the bundler has to keep"
sidebar_label: "08g · Narrowing the injector"
sidebar_position: 8.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev [`importProvidersFrom`](https://angular.dev/api/core/importProvidersFrom) — and `angular/angular` at tag `v22.1.5`:
> [`packages/router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts) (`Route.providers`),
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts) (`walkProviderTree`),
> and `goldens/public-api/core/index.api.md` at the same tag (`makeEnvironmentProviders`, `provideAppInitializer`).
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**[08e](08e-the-interop-shapes-that-beat-it.md) and [08f](08f-the-multi-bucket-worked-end-to-end.md)
were about deleting the `importProvidersFrom` call. The next two pages are about the shapes that do not
delete it — and about being honest that they do not. This one is the injector narrowing: move the
providers from `ApplicationConfig.providers` onto the route that needs them, and the router builds a
child `EnvironmentInjector` for that route and its children. The providers are constructed on first
navigation instead of at bootstrap, and nothing outside the subtree can inject them. What does not change
is the set: the walk is still eager and total once that injector exists, the module class is still named
by value in your route file, and the bundler retains exactly as much as before. Knowing precisely which
of the four costs this fixes — and which it leaves untouched — is the difference between containment and
a conversion you only think you did.**

## The sentence this rests on

`packages/router/src/models.ts`, `Route.providers`' own doc comment, verbatim:

> *"A `Provider` array to use for this `Route` and its `children`. The `Router` will create a new
> `EnvironmentInjector` for this `Route` and use it for this `Route` and its `children`. If this route
> also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be used as the
> parent of the lazy loaded module."*

Three facts in three sentences. The array's reach is **this route and its children** — not its siblings,
not its parent. The injector is a **new `EnvironmentInjector`**, which is why `EnvironmentProviders`
values are legal there and a `@Component.providers` array's rules do not apply
([08d](08d-the-two-errors-importprovidersfrom-raises.md) owns that fence). And a lazily loaded `NgModule`
reached from the same route is **parented to it** — that third sentence is the whole of
[08h](08h-narrowing-the-lifetime-keeping-the-module-lazy.md).

## The shape

```ts
// src/app/app.routes.ts
import {Routes} from '@angular/router';
import {provideReporting} from './reports/reporting.providers';

export const routes: Routes = [
  {
    path: 'reports',
    providers: [provideReporting({cacheTtlMs: 60_000})],
    loadComponent: () => import('./reports/report-list').then((m) => m.ReportList),
  },
];
```

Anything in that array — a `provide*` call, a plain `Provider`, or an `importProvidersFrom` you have not
converted yet — is constructed when the user first navigates to `/reports`, and cannot be injected from
anywhere else in the app. That is the shape [chunk 08](08-ngmodule-interop-importprovidersfrom.md)
promised when it said the route form is strictly better whenever both work.

🔴 **It narrows *where*, never *what*.** `importProvidersFrom(LegacyReportingModule)` on a route still
walks the module's entire transitive `imports` chain, still names the class by value in `app.routes.ts`,
and still hands you an opaque brand. Against [08b](08b-what-importprovidersfrom-drags-in.md)'s three
costs, the score is: *eager and total* — fixed for the bootstrap phase, unchanged within the route;
*nothing tree-shakes* — unchanged, the class is still statically reachable; *you cannot see what you got*
— unchanged. One and a half out of three, and the half is real.

## What cannot move to a route

Anything the framework consumes *before* the first navigation, because the route injector does not exist
yet when those are read:

- an initialiser that must run before the app starts;
- a global `ErrorHandler`;
- an interceptor, a locale or a date adapter that every part of the app depends on;
- anything a component outside the route subtree injects.

The test is one question: **does anything outside this subtree need to inject it?** One yes and it
belongs in `ApplicationConfig.providers`. The usual answer for a module that fails the test is to split
it, so the startup half stays at the root as an explicit call and the rest goes to the route:

```ts
// src/app/app.config.ts
import {ApplicationConfig, ErrorHandler, inject, provideAppInitializer} from '@angular/core';
import {ReportCatalog} from './reports/report-catalog';
import {TelemetryErrorHandler} from './core/telemetry-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(ReportCatalog).warm()),
    {provide: ErrorHandler, useClass: TelemetryErrorHandler},
  ],
};
```

## Gotchas

**★ Symptom: you moved an `importProvidersFrom` call from `ApplicationConfig.providers` down to a route and an initialiser inside the module stopped running.** Cause: `Route.providers` populates an injector the router creates on first navigation; anything the framework reads during bootstrap is read before that injector exists. Fix: split the module and name the startup half explicitly at the root, as in the `app.config.ts` above. The route then carries only what the route uses:

```ts
// src/app/app.routes.ts
import {Routes} from '@angular/router';
import {importProvidersFrom} from '@angular/core';
import {LegacyReportingModule} from './reports/legacy-reporting.module';

export const routes: Routes = [
  {
    path: 'reports',
    providers: [importProvidersFrom(LegacyReportingModule)],
    loadComponent: () => import('./reports/report-list').then((m) => m.ReportList),
  },
];
```

**★ Symptom: you put the same `provide*` call on two routes and a service you expected to be a singleton now has two instances holding different state.** Cause: `makeEnvironmentProviders` produces records, not singletons, and each route builds its own `EnvironmentInjector` — so each gets its own instance of every class named in the array. The module you replaced had one instance because it was registered once, at the root. Fix: decide per class. Anything genuinely app-wide uses `providedIn: 'root'` and does not appear in the array at all:

```ts
// src/app/reports/report-cache.service.ts
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class ReportCacheService {
  private readonly entries = new Map<string, unknown>();

  knownIds(): string[] {
    return [...this.entries.keys()];
  }
}
```

**★ Symptom: a route-scoped provider works for one page and throws a missing-provider error on the page next to it.** Cause: the second page is a *sibling* route, not a child. The doc comment's reach is *"this `Route` and its `children`"* and nothing else. Fix: hang the providers on the common parent and give it children, so both branches inherit them:

```ts
// src/app/app.routes.ts
import {Routes} from '@angular/router';
import {provideReporting} from './reports/reporting.providers';

export const routes: Routes = [
  {
    path: 'reports',
    providers: [provideReporting({cacheTtlMs: 60_000})],
    children: [
      {path: '', loadComponent: () => import('./reports/report-list').then((m) => m.ReportList)},
      {path: 'archive', loadComponent: () => import('./reports/archive').then((m) => m.Archive)},
    ],
  },
];
```

**Symptom: you scoped a vendor module to a route to contain it, and it still affects the whole app.** Cause: containment only works for things resolved *through* the injector tree. A module whose side effects are global — patching `window`, registering a locale, mutating a shared singleton from its constructor — is unaffected by which injector constructed it, and [08b](08b-what-importprovidersfrom-drags-in.md) showed that `walkProviderTree` emits a factory provider for every module type it visits, so the class *is* constructed. Fix: there is no injector-level fix; the constructor has to stop doing the work. If you control the module, move the effect to something that runs when you want it to:

```ts
// src/app/vendor/vendor-bootstrap.ts
import {EnvironmentProviders, inject, makeEnvironmentProviders, provideEnvironmentInitializer} from '@angular/core';
import {VendorSdk} from './vendor-sdk';

export function provideVendorSdk(apiKey: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    VendorSdk,
    provideEnvironmentInitializer(() => inject(VendorSdk).configure(apiKey)),
  ]);
}
```

**Symptom: the route form compiles for `provideRouter`'s own features and rejects one of yours with a type error.** Cause: `Route.providers` is `Array<Provider | EnvironmentProviders>` and accepts both — but a *component's* `providers` array is `Provider[]`, and a route object nested inside `children` is still a route while a component sitting next to it is not. The error is usually a copy-paste from the wrong array. Fix: keep environment-level wiring on the `Route` object and per-instance state on the component:

```ts
// src/app/reports/report-row.ts
import {Component} from '@angular/core';
import {RowEditBuffer} from './row-edit-buffer';

@Component({
  selector: 'app-report-row',
  providers: [RowEditBuffer],
  template: `<span>{{ buffer.label() }}</span>`,
})
export class ReportRow {
  constructor(readonly buffer: RowEditBuffer) {}
}
```

## Interview questions

**★ Why is putting `importProvidersFrom` on a route an improvement, and what exactly does it fail to improve?**
It narrows the injector. `Route.providers`' doc comment says the router *"will create a new `EnvironmentInjector` for this `Route` and use it for this `Route` and its `children`"*, so the providers are constructed on first navigation and cannot be injected from outside that subtree. What it does not change is the set or the reachability: the walk is still eager and total once that injector is built, the module class is still named by value in your route file, and the bundler must still retain the class, its `ɵinj` definition and everything that definition reaches. You have moved *when* and *where*, not *how much* — and saying so out loud is the difference between containment and believing you migrated something.

**★ A colleague argues route scoping is "just hiding the problem". Are they right?**
Half right, and the half matters. It does not reduce the `importProvidersFrom` call count, which [08b](08b-what-importprovidersfrom-drags-in.md) argues is the only observable progress metric a standalone migration has — so on the migration's own scoreboard it scores zero. What it changes is the blast radius: a module confined to a route injector cannot be injected from elsewhere, cannot participate in a startup ordering surprise, and is not constructed for users who never visit that route. That turns an unbounded, invisible dependency into a bounded one, which is what makes the eventual conversion a small diff rather than an audit.

**★ How do you decide whether a given provider *can* move to a route, without running anything?**
Ask who injects it, and when. If the answer includes anything the framework reads during bootstrap — an app initialiser, the `ErrorHandler`, a root HTTP interceptor, a `LOCALE_ID` — it cannot move, because the route injector does not exist at that point in the sequence. If the answer includes a component or a guard outside the route subtree, it cannot move either, because the doc comment scopes the array to *"this `Route` and its `children`"*. Everything else can. The question is answerable by reading imports, which is why it is a code-review question rather than a debugging one.

**Your app has an interceptor from a vendor module you cannot remove. What can route scoping actually buy you here?**
It can confine which injector supplies it. Imported at the root, the interceptor affects every request in the app and there is no way to remove a multi contribution ([08f](08f-the-multi-bucket-worked-end-to-end.md)). Moved to a route, only requests made from injectors inside that subtree see it. What route scoping cannot buy you is protection from a non-DI side effect: if the module's constructor patches a global, the class is still constructed — `walkProviderTree` emits a factory provider for every module type it visits — and the effect is global regardless of which injector did the constructing.

**Two routes both carry `provideReporting()`. Is that a bug?**
Only if you expected shared state. Each route builds its own `EnvironmentInjector`, so each gets its own instance of every class in the array — which is often exactly right for per-feature caches and exactly wrong for anything the two features are supposed to agree on. The module you converted had one instance because a module's providers are registered once; a per-route array is registered per route by construction. The fix is per class rather than per array: promote the genuinely shared classes to `providedIn: 'root'` and leave the per-feature ones in the array.

---

← Prev: [The multi bucket, worked end to end](08f-the-multi-bucket-worked-end-to-end.md) · Index: [Topic index](README.md) · Next → [Narrowing the lifetime](08h-narrowing-the-lifetime-keeping-the-module-lazy.md)
