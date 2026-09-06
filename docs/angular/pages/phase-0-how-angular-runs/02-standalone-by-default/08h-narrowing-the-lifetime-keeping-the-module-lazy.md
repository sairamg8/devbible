---
title: "Reaching a legacy `NgModule` through `loadChildren` is the one interop shape that beats `importProvidersFrom` without converting anything — the class is named only inside a dynamic import, so it leaves the initial chunk, and the route's injector becomes the parent of the module's"
sidebar_label: "08h · Narrowing the lifetime"
sidebar_position: 8.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts) (`Route.providers`, `LoadChildren`, the `loadChildren` usage notes),
> [`packages/router/src/router_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_module.ts) (`RouterModule.forChild`),
> [`packages/core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts) (`processProvider`),
> and [`goldens/public-api/router/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/router/index.api.md) at the same tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**[08g](08g-narrowing-the-injector-and-the-lifetime.md) narrowed the injector and left the bundle alone.
This shape narrows the lifetime and fixes the bundle too, and it is the only one of the three that costs
no conversion work at all: you leave the legacy `NgModule` exactly as it is and stop calling
`importProvidersFrom` on it. Naming the class only inside a dynamic `import()` makes it unreachable from
the entry point, so it gets its own chunk. Its providers are constructed when that chunk resolves, in a
module injector the router parents to the route's — the third sentence of `Route.providers`' doc comment,
which almost nobody has read. And its `RouterModule.forChild(routes)` composes with the root
`provideRouter` rather than fighting it, because `ROUTES` is `multi: true` and contributions append. An
unconverted module reached this way is cheaper on every axis than the same module hoisted to the root,
and the honest caveat is that you have deferred the conversion rather than performed it.**

## `loadChildren` still takes a module class in v22.1.5

From `goldens/public-api/router/index.api.md`, verbatim:

```ts
export type LoadChildren = LoadChildrenCallback;

export type LoadChildrenCallback = () =>
  | Type<any>
  | NgModuleFactory<any>
  | Routes
  | Observable<Type<any> | Routes | DefaultExport<Type<any>> | DefaultExport<Routes>>
  | Promise<NgModuleFactory<any> | Type<any> | Routes | DefaultExport<Type<any>> | DefaultExport<Routes>>;
```

Both shapes are documented in `packages/router/src/models.ts`'s own usage notes, verbatim — the module
form and the plain-routes form:

```ts
[{
  path: 'lazy',
  loadChildren: () => import('./lazy-route/lazy.module').then(mod => mod.LazyModule),
}];
```
```ts
[{
  path: 'lazy',
  loadChildren: () => import('./lazy-route/lazy.routes').then(mod => mod.ROUTES),
}];
```

> *"If the lazy-loaded routes are exported via a `default` export, the `.then` can be omitted"*

```ts
[{
  path: 'lazy',
  loadChildren: () => import('./lazy-route/lazy.routes'),
}];
```

The module form is not a deprecated leftover — it is a live, typed member of the union, and it is what
makes an unconverted module a first-class citizen of a standalone app.

## The parenting rule, and why `forChild` composes

`Route.providers`' doc comment ends with the sentence that makes this work, verbatim:

> *"If this route also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be
> used as the parent of the lazy loaded module."*

So the module gets its own injector, parented to the route's, built when the chunk resolves. Its
providers are scoped to that subtree and invisible everywhere else — the same containment
[08g](08g-narrowing-the-injector-and-the-lifetime.md) buys, obtained for free.

The route table composes for a different reason: `ROUTES` is a multi token. From
`packages/router/src/router_module.ts`, verbatim:

```ts
static forChild(routes: Routes): ModuleWithProviders<RouterModule> {
  return {
    ngModule: RouterModule,
    providers: [{provide: ROUTES, multi: true, useValue: routes}],
  };
}
```

`R3Injector.processProvider`'s multi branch appends rather than replaces
([08c](08c-ordering-cycles-and-multi-tokens.md)), so the child table joins the root table instead of
overwriting it. The property that usually bites — *you can never take a multi contribution back* — is the
one that makes routing work.

## The complete shape, three files

```ts
// src/app/app.routes.ts
import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: 'reports',
    loadChildren: () =>
      import('./reports/legacy-reporting.module').then((m) => m.LegacyReportingModule),
  },
];
```

```ts
// src/app/reports/legacy-reporting.module.ts — unconverted, and that is fine
import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {ReportCacheService} from './report-cache.service';
import {ReportDetail} from './report-detail';
import {ReportList} from './report-list';
import {REPORT_CACHE_TTL_MS} from './report-tokens';

@NgModule({
  imports: [
    RouterModule.forChild([
      {path: '', component: ReportList},
      {path: ':id', component: ReportDetail},
    ]),
  ],
  providers: [ReportCacheService, {provide: REPORT_CACHE_TTL_MS, useValue: 60_000}],
})
export class LegacyReportingModule {}
```

```ts
// src/app/reports/report-list.ts — standalone, referenced by the route table, declared by nobody
import {Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ReportCacheService} from './report-cache.service';

@Component({
  selector: 'app-report-list',
  imports: [RouterLink],
  template: `
    @for (id of cache.knownIds(); track id) {
      <a [routerLink]="[id]">{{ id }}</a>
    }
  `,
})
export class ReportList {
  readonly cache = inject(ReportCacheService);
}
```

Note what the module does **not** do: it has no `declarations`. `ReportList` and `ReportDetail` are
standalone and the route table references them directly. The module survives purely as a provider carrier
with a route table attached — one of the four legitimate residues
[chunk 11](11-where-ngmodule-still-legitimately-appears.md) enumerates, and the reason a module in a 2026
codebase is not automatically a defect.

Compare the same module hoisted to the root with `importProvidersFrom(LegacyReportingModule)` in
`ApplicationConfig.providers`: identical providers, but constructed at bootstrap, injectable from
anywhere, and — because the class is named by value in `main.ts` — in the initial chunk. This shape is
better on all three counts and it is *less* work, because you write no conversion at all.

## Gotchas

**★ Symptom: you moved a legacy module behind `loadChildren` and it is still in the initial chunk.** Cause: something else still names it statically — a barrel re-exporting it, a leftover `importProvidersFrom` in `main.ts`, or a value import used only for a type. Any one of those makes the class reachable from the entry point, and a dynamic `import()` elsewhere cannot undo that. Fix: name the module in exactly one place, inside the dynamic import, and make every type-only reference an `import type`:

```ts
// src/app/reports/reports-facade.ts
import type {LegacyReportingModule} from './legacy-reporting.module';

export function describeReportingModule(mod: typeof LegacyReportingModule): string {
  return mod.name;
}
```

**★ Symptom: a lazily loaded module's `RouterModule.forChild` routes render at the wrong URL, or twice.** Cause: `ROUTES` is `multi: true`, so every contribution appends; a `forChild` table is resolved *relative to the route that loaded it*, and a second `forChild` anywhere in the same lazy chain appends a second table rather than replacing the first. Fix: one `forChild` per lazily loaded module, and let the parent route own the prefix — the child table's first entry is `path: ''`:

```ts
// src/app/reports/legacy-reporting.module.ts
import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {ReportDetail} from './report-detail';
import {ReportList} from './report-list';

@NgModule({
  imports: [
    RouterModule.forChild([
      {path: '', component: ReportList},
      {path: ':id', component: ReportDetail},
    ]),
  ],
})
export class LegacyReportingModule {}
```

**★ Symptom: a token is provided by both the route and the lazily loaded module it points at, and the module's value wins even though the route "came first".** Cause: the parenting sentence doing its job — the route's `EnvironmentInjector` is *"used as the parent of the lazy loaded module"*, so the module's injector is the child, and a child's record shadows its parent's for anything resolved from inside the module. A guard on the parent route still sees the route's value, which is two answers for one token depending on where the request originated. Fix: provide it in one place. If it is configuration the route chooses, keep it on the route and delete it from the module:

```ts
// src/app/reports/legacy-reporting.module.ts
import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {ReportList} from './report-list';

@NgModule({
  imports: [RouterModule.forChild([{path: '', component: ReportList}])],
})
export class LegacyReportingModule {}
```

**★ Symptom: you converted the module's routes to a plain `Routes` array and the feature's providers disappeared.** Cause: the two `loadChildren` forms are not equivalent. Returning a module class creates an `NgModuleRef` with its own injector; returning a `Routes` array creates no injector at all, so `@NgModule.providers` has nowhere to go. Fix: when you drop the module, its providers move onto the route explicitly — that is the same conversion [08e](08e-the-interop-shapes-that-beat-it.md) describes, arriving one route at a time:

```ts
// src/app/reports/reports.routes.ts
import {Routes} from '@angular/router';
import {provideReporting} from './reporting.providers';

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideReporting({cacheTtlMs: 60_000})],
    children: [
      {path: '', loadComponent: () => import('./report-list').then((m) => m.ReportList)},
      {path: ':id', loadComponent: () => import('./report-detail').then((m) => m.ReportDetail)},
    ],
  },
];
```

**Symptom: a service the lazy module provides is constructed on the very first page load, before anyone navigates to the feature.** Cause: the class is provided in two places — once by the lazy module and once, from an earlier migration attempt, by a `providedIn: 'root'` annotation or a root provider array. The root record is the one the app's initial components resolve, and it is created on first injection wherever that happens. Fix: pick one home. If it belongs to the feature, remove `providedIn: 'root'` and let the module provide it:

```ts
// src/app/reports/report-cache.service.ts
import {Injectable} from '@angular/core';

@Injectable()
export class ReportCacheService {
  private readonly entries = new Map<string, unknown>();

  knownIds(): string[] {
    return [...this.entries.keys()];
  }
}
```

**Symptom: the lazy chunk downloads on first navigation and you expected it to be prefetched.** Cause: nothing about `loadChildren` prefetches; the chunk is fetched when the route is activated. Fix: this is a router-features decision rather than an interop one — `provideRouter(routes, withPreloading(...))` is where it lives, and topic 03 owns the feature list. Do not reach for `importProvidersFrom` at the root to "make it load earlier": that trades a deferred chunk for a permanent one.

## Interview questions

**★ Why is `loadChildren` with an unconverted legacy `NgModule` better than `importProvidersFrom` of the same module, given it leaves the module in place?**
Because it is the only shape that gets all three properties at once and costs no conversion work. The class is named only inside a dynamic `import()`, so it is not statically reachable from the entry point and the bundler gives it its own chunk. Its providers are created when the chunk resolves, in a module injector that the route's injector is — in `Route.providers`' own words — *"used as the parent of"*, so the scoping is explicit rather than global. And its `RouterModule.forChild(routes)` composes with the root `provideRouter` instead of fighting it, because `ROUTES` is `multi: true` and contributions append. The honest caveat is that you have deferred the conversion, not performed it: the module still exists and still counts.

**★ Both the route and the lazily loaded module it points at provide the same token. Which wins, and why is the answer not "the one that ran first"?**
The module's. Injector resolution is hierarchical, not chronological: the route's `EnvironmentInjector` is the *parent* of the lazily loaded module's injector, by the explicit guarantee in `Route.providers`' doc comment, so a lookup starting inside the module finds the module's record and stops. Anything resolved from outside the module — a guard on the parent route, for instance — still sees the route's value. That is two different answers for one token depending on where the request originated, which is why the honest fix is to provide it in exactly one place rather than to reason about which one you want.

**★ When would you deliberately choose this shape over finishing the conversion, in a codebase with time to do either?**
When the module is a self-contained legacy feature that nobody else imports and that is not on the critical path — an admin area, a reporting section, an old settings screen. Converting it buys a smaller module count and very little else, because a lazily loaded module already costs the initial bundle nothing and already scopes its providers. Spend the conversion effort on the modules sitting in `ApplicationConfig.providers` instead, where all of `importProvidersFrom`'s costs are being paid at full price by every user on every page load.

**A `loadChildren` route and a `loadComponent` route sit side by side. Which injectors exist, and when?**
Both routes get an `EnvironmentInjector` if — and only if — they carry a `providers` array, and it is created on first navigation to that route. The difference is what happens *below* it. `loadComponent` resolves to a standalone component, which gets its own standalone injector from its `imports` array but adds no environment injector of its own. `loadChildren` returning a module class creates an `NgModuleRef` with a module injector, and `Route.providers`' doc comment guarantees the route's injector is *"used as the parent of the lazy loaded module"* — so that branch has one more level in the chain than the `loadComponent` one. That extra level is where an unconverted module's providers live, and it is why the two forms shadow tokens differently.

**What is the difference between `loadChildren` returning a module class and returning a `Routes` array, in terms of injectors?**
Returning a module class creates an `NgModuleRef`, which brings its own injector, parented to the route's — so `@NgModule.providers` has somewhere to live and stays scoped to that subtree. Returning a `Routes` array creates no injector at all; the routes are simply added to the table and any providers they need must be declared on the route objects themselves. That is why converting a lazy module to a lazy route file is not a cosmetic change: it is the moment the module's provider array has to be rewritten as `Route.providers`, and forgetting that step is how a feature silently loses its configuration.

**Why does `RouterModule.forChild` still exist in a framework that tells you not to write `NgModule`s?**
Because it is the only way a module that *is* still an `NgModule` can contribute routes, and Angular did not break that path. Its implementation is six lines and provides one thing — `{provide: ROUTES, multi: true, useValue: routes}` — which is exactly what `provideRouter` provides at the root. The multi-ness is what lets a lazily loaded module extend the table instead of replacing it. In a fully converted app you never write it, because a lazy `Routes` array does the same job with no class; in a hybrid app it is the reason the two worlds compose at all.

---

← Prev: [Narrowing the injector](08g-narrowing-the-injector-and-the-lifetime.md) · Index: [Topic index](README.md) · Next → [What a library should ship](08i-what-a-library-should-ship-instead.md)
