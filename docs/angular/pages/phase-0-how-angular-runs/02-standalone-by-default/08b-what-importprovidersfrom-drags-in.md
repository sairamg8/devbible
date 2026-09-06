---
title: "The walk is eager and total, the module class is referenced by value so nothing tree-shakes, and the result is an opaque brand you cannot audit — three costs you can read off `internalImportProvidersFrom` without measuring anything"
sidebar_label: "08b · What it drags in"
sidebar_position: 8.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [NgModules overview](https://angular.dev/guide/ngmodules/overview),
> [`importProvidersFrom`](https://angular.dev/api/core/importProvidersFrom) — and `angular/angular` at
> tag `v22.1.5`:
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts)
> (`internalImportProvidersFrom`, `walkProviderTree`), and `goldens/public-api/core/index.api.md` at the
> same tag.
> Version spine: `@angular/cli` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated;
> 🔴 **no sandbox run, and no bundle-size or timing figure on this page is measured — none is stated.**

**The reason to treat `importProvidersFrom` as a migration residue rather than an interop tool is not
taste, and it is not a benchmark nobody here ran. It is properties you can read directly off the source.
The walk is eager and total — every provider in the module's transitive `imports` chain lands in one
flat array before your first render, and `walkProviderTree` even emits a factory provider for each
module type it visits so the class itself is constructed with the injector. The module class is
referenced by value from your entry point, so its `ɵinj` definition and everything that definition names
are statically reachable and cannot be dropped by a bundler — which is a reachability argument, decidable
by reading the graph, and emphatically not a byte count. And the result is a brand with no readable
members, so you cannot audit what you took on or subset it afterwards.
[08c](08c-ordering-cycles-and-multi-tokens.md) covers the two remaining costs — how the walk resolves
conflicts, and where it goes quiet in production.**

## The collector, complete and unelided

```ts
export function internalImportProvidersFrom(
  checkForStandaloneCmp: boolean,
  ...sources: (ImportProvidersSource | AbstractType<unknown>)[]
): Provider[] {
  const providersOut: SingleProvider[] = [];
  const dedup = new Set<Type<unknown> | AbstractType<unknown>>(); // already seen types
  let injectorTypesWithProviders: InjectorTypeWithProviders<unknown>[] | undefined;

  const collectProviders: WalkProviderTreeVisitor = (provider) => {
    providersOut.push(provider);
  };

  deepForEach(sources, (source) => {
    if ((typeof ngDevMode === 'undefined' || ngDevMode) && checkForStandaloneCmp) {
      const cmpDef = getComponentDef(source);
      if (cmpDef?.standalone) {
        throw new RuntimeError(
          RuntimeErrorCode.IMPORT_PROVIDERS_FROM_STANDALONE,
          `Importing providers supports NgModule or ModuleWithProviders but got a standalone component "${stringifyForError(
            source,
          )}"`,
        );
      }
    }

    // Narrow `source` to access the internal type analogue for `ModuleWithProviders`.
    const internalSource = source as Type<unknown> | InjectorTypeWithProviders<unknown>;
    if (walkProviderTree(internalSource, collectProviders, [], dedup)) {
      injectorTypesWithProviders ||= [];
      injectorTypesWithProviders.push(internalSource);
    }
  });
  // Collect all providers from `ModuleWithProviders` types.
  if (injectorTypesWithProviders !== undefined) {
    processInjectorTypesWithProviders(injectorTypesWithProviders, collectProviders);
  }

  return providersOut;
}
```

Twenty lines with three jobs: a development-only argument check
([08d](08d-the-two-errors-importprovidersfrom-raises.md)), a transitive walk, and a deferred replay of
`ModuleWithProviders` entries ([08c](08c-ordering-cycles-and-multi-tokens.md)). Nothing about it is
conditional on your build being large, your module being complex, or the providers being used.

## 1 · It is eager and total

`walkProviderTree`'s own doc comment says what it visits, verbatim:

> *"The logic visits an `InjectorType`, an `InjectorTypeWithProviders`, or a standalone `ComponentType`,
> and all of its transitive providers and collects providers."*

There is no depth limit, no filter and no lazy path. Every provider in the module's transitive `imports`
chain is pushed into `providersOut` while `bootstrapApplication` runs — before the root component's
first render. Angular's own words for the consequence, from the
[NgModules overview](https://angular.dev/guide/ngmodules/overview):

> *"Any providers included in this way are eagerly loaded, increasing the JavaScript bundle size of your
> initial page load."*

That is a documentation claim about `forRoot`, quotable as such. **No figure on this page is measured.**

The practical shape of it: a `SharedModule` that imports `HttpClientModule`, `MatDialogModule` and your
own `AnalyticsModule` contributes all three modules' providers, plus whatever those three import, in one
call — and you wrote one identifier.

**The walk also provides the module classes themselves.** From `walkProviderTree`, with the comment that
says why:

```ts
// Append extra providers to make more info available for consumers (to retrieve an injector
// type), as well as internally (to calculate an injection scope correctly and eagerly
// instantiate a `defType` when an injector is created).

// Provider to create `defType` using its factory.
visitor({provide: defType, useFactory: factory, deps: EMPTY_ARRAY}, defType);
```

So a module class in an environment injector is not a lazy record — it is constructed with the injector.
An `NgModule` with a constructor that does work (a common legacy pattern for registering icons, locales
or feature flags) does that work at bootstrap.

## 2 · Nothing tree-shakes, and this is a reachability argument, not a benchmark

You wrote `importProvidersFrom(ReportsModule)`, so `ReportsModule` is referenced **by value** in a
module-level array in `main.ts`. Its `ɵinj` injector definition is a static property on that class, its
`providers` array is a static array on that definition, and every class named in that array is therefore
statically reachable from your entry point. A bundler that dropped any of it would be unsound.

Contrast a `provide*` function:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withComponentInputBinding())],
};
```

`withComponentInputBinding()` is referenced; every other router feature — `withDebugTracing`,
`withHashLocation`, `withPreloading` and the rest — is not named anywhere in your graph and is dropped.
That is the difference the convention buys, and
[topic 03 · The provider array is the wiring](../03-the-provider-array/README.md) owns the argument in
full.

⚠️ **Be precise about what this claim is.** Reachability is a necessary condition for retention, and it
is decidable by reading the graph. *How much* it weighs is not — no byte count, percentage or load-time
delta appears on this page, because nothing here was built.

## 3 · You cannot see what you got

The return type has no readable members:

```ts
// @public
export type EnvironmentProviders = {
    ɵbrand: 'EnvironmentProviders';
};
```

There is no supported way to list, filter or subset the collected providers. This matters most when a
module contributes something global you did not want — an `HTTP_INTERCEPTORS` entry, a startup hook, an
`ErrorHandler` override. You find out at runtime, and your recourse is to override the token afterwards
or to stop importing the module at all.

The honest consequence for a codebase: **the number of `importProvidersFrom` calls is the only progress
metric a standalone migration has.** Each one is a module nobody has finished converting, and the call
itself tells you nothing about how much is behind it.

## Gotchas

**★ Symptom: you moved a feature's `importProvidersFrom` call from `Route.providers` up to `ApplicationConfig.providers` "to simplify", and the initial page got heavier.** Cause: the bootstrap array is walked during `bootstrapApplication`, before the first render, and lands in the root environment injector. You converted a lazily-created child injector into an eager global one. Fix: put it back on the route, where the router creates a child `EnvironmentInjector` on first navigation:

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

**★ Symptom: a legacy module's constructor side effect (registering icons, installing a locale, seeding a feature-flag cache) runs at startup even though nothing has injected anything from the module.** Cause: `walkProviderTree` emits `visitor({provide: defType, useFactory: factory, deps: EMPTY_ARRAY}, defType)` for the module type itself, and the comment above it says the extra providers exist *"to calculate an injection scope correctly and eagerly instantiate a `defType` when an injector is created"*. Fix: move the side effect to something that runs when you want it to — `provideAppInitializer` if it must happen before the app starts, or a `providedIn: 'root'` service if it can wait for first injection:

```ts
// src/app/app.config.ts
import {ApplicationConfig, inject, provideAppInitializer} from '@angular/core';
import {IconRegistry} from './core/icon-registry';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => {
      inject(IconRegistry).registerDefaults();
    }),
  ],
};
```

**★ Symptom: a service inside a legacy module is constructed at startup and you cannot find who injected it.** Cause: same mechanism, one level down — the module class is instantiated eagerly, and a legacy module frequently injects its own services in its constructor to "wire them up". Fix: give the service its own lifetime and delete it from `@NgModule.providers`:

```ts
// src/app/legacy/telemetry.service.ts
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class TelemetryService {
  private queued = 0;
  record(event: string): void {
    this.queued += event.length > 0 ? 1 : 0;
  }
}
```

`providedIn: 'root'` records are created on first injection and are dropped entirely by the bundler when
nothing injects them — the two properties `@NgModule.providers` cannot give you.

**★ Symptom: you split a legacy module into two smaller ones to "import less" and nothing changed.** Cause: the walk is transitive. If the two halves still import each other, or both import the same base module, `walkProviderTree` reaches the same set either way — splitting a module changes the class graph's shape, not its reachable set. Fix: the reduction has to come from deleting an import edge, not from moving one. Convert the piece you actually need into a `provide*` function and drop the module from the call entirely:

```ts
// src/app/reports/provide-report-cache.ts
import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {REPORT_CACHE_TTL_MS, ReportCacheService} from './report-cache.service';

export function provideReportCache(ttlMs: number): EnvironmentProviders {
  return makeEnvironmentProviders([
    ReportCacheService,
    {provide: REPORT_CACHE_TTL_MS, useValue: ttlMs},
  ]);
}
```

**★ Symptom: a code review asks "what does this line pull in?" and the honest answer is "open the module and read it".** Cause: there is no report, no `--why` flag, and no runtime introspection — the result is an opaque brand and the walk leaves no trace. Fix: treat every `importProvidersFrom` call site as requiring a comment naming *what you needed*, so the next reader knows what to check before deleting it:

```ts
// src/app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    // Needed only for LEGACY_REPORT_FORMATTER; everything else SharedModule provides is
    // already available via providedIn: 'root'. Delete once vendor ships provideReporting().
    importProvidersFrom(SharedModule),
  ],
};
```

## Interview questions

**★ What exactly does `importProvidersFrom(SomeModule)` cost that `provideSomething()` does not?**
Three things, all structural. It walks `SomeModule`'s *entire transitive* `imports` graph and flattens every provider it finds into one array at bootstrap, so there is no per-feature granularity. It references the module class by value, so the class, its `ɵinj` definition, and everything that definition reaches are statically reachable from your entry point and cannot be dropped by a bundler — whereas `provideRouter(routes, withComponentInputBinding())` only references the one feature you passed. And the result cannot be inspected or partially applied. No figure is being claimed here; this is a reachability argument you can read off the source, plus Angular's own documented statement that `forRoot` providers *"are eagerly loaded, increasing the JavaScript bundle size of your initial page load."*

**★ Why is "it does not tree-shake" a claim you can make without measuring anything?**
Because tree-shaking is a *reachability* analysis, and reachability is decidable by reading the graph. `importProvidersFrom(SomeModule)` names the class in a module-level array reachable from the entry point; the class carries a static `ɵinj` whose `providers` array names more classes; those are reachable in turn. A bundler that dropped any of them would be unsound. What you cannot claim without measuring is *how much* — a byte count, a percentage, a load-time delta. The honest statement is about what is retained, not about what it weighs.

**★ Does `importProvidersFrom` instantiate anything, or does it only collect provider records?**
It collects records, but the records it collects include one per module type — `walkProviderTree` calls `visitor({provide: defType, useFactory: factory, deps: EMPTY_ARRAY}, defType)`, with a comment saying the extra providers exist partly to *"eagerly instantiate a `defType` when an injector is created"*. So the collection itself is a synchronous traversal, and the instantiation happens when the environment injector is created — at bootstrap for `ApplicationConfig.providers`, at first navigation for `Route.providers`. A legacy module whose constructor does work will do that work at whichever of those two moments applies.

**Your app boots noticeably later after adding one `importProvidersFrom`. Where do you look first, and what do you not conclude?**
Look at the module's transitive `imports` chain, because the walk is total — one identifier can pull in three levels of modules — and at whether any module in that chain has a constructor that does work, since each module type gets an eagerly-instantiated factory provider. What you do not conclude is that `importProvidersFrom` itself is slow: the walk is a synchronous traversal of a static graph, and the cost that shows up in a page load is almost always *what was collected and constructed*, not the collecting.

**Why does splitting a fat legacy module into two smaller modules usually change nothing?**
Because the walk is transitive and deduplicated by type. If both halves still reach the same base modules — and they almost always do, because that is why they were one module — `walkProviderTree` collects the same set from either entry point. What reduces the set is deleting an import *edge*: converting the piece you need into a `provide*` function and removing the module from the call. Reorganising the class graph without cutting it is motion, not progress.

**What is the only reliable progress metric for a standalone migration, and why is it the call count rather than something finer?**
The number of `importProvidersFrom` call sites left, because nothing finer is observable. The result is an opaque brand with no readable members, the walk emits no report, and there is no flag that tells you what a given call contributed. So you cannot measure "percentage of providers migrated" — you can only count the bridges you have not yet burned. That crudeness is itself an argument for converting modules rather than wrapping them.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **09 · The standalone migration schematic** *(not written yet)*
