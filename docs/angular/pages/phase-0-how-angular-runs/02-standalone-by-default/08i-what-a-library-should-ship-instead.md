---
title: "A library in 2026 ships three artefacts and no provider-carrying module — standalone classes exported directly, a `provide*`/`with*` pair built on `makeEnvironmentProviders`, and at most a thin re-export bundle it deprecates for a major before removing"
sidebar_label: "08i · What a library should ship"
sidebar_position: 8.8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev [NgModules overview](https://angular.dev/guide/ngmodules/overview), [`makeEnvironmentProviders`](https://angular.dev/api/core/makeEnvironmentProviders) — and `angular/angular` at tag `v22.1.5`:
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts),
> [`packages/common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts) (the reference `provide*`/`with*` implementation),
> and [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md) (`makeEnvironmentProviders`, `createNgModule`, `createEnvironmentInjector`).
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**The previous four pages were about what a consumer does with somebody else's `NgModule`. This one is
the other side of the same problem: if you are the somebody, what do you publish so that nobody ever has
to call `importProvidersFrom` on your package? Three artefacts and no module — standalone classes
exported directly, a `provide*` function returning `makeEnvironmentProviders`, and, only if your
consumers want the convenience, a thin `NgModule` that declares nothing and re-exports. Getting the
second one right is what removes the pressure: a `ModuleWithProviders` bundles a class whose whole
provider graph gets walked with the small configuration array that was all anyone wanted, and a
`provide*` function is that bundle taken apart. The counterweight — the four situations where the bridge
is still the honest answer — is [08j](08j-when-the-bridge-is-the-honest-answer.md).**

## What a library ships in 2026

Three artefacts, in descending order of importance.

**1 · Standalone classes, exported directly.** A consumer puts the class in their component's `imports`
array. No bundle, no scope, no module.

```ts
// packages/report-widgets/src/report-badge.ts
import {Component, input} from '@angular/core';

@Component({
  selector: 'rw-report-badge',
  template: `<span class="rw-badge">{{ label() }}</span>`,
  styles: `.rw-badge { border-radius: 4px; padding: 2px 6px; }`,
})
export class ReportBadge {
  readonly label = input.required<string>();
}
```

**2 · A `provide*` function returning `EnvironmentProviders`.** This is the replacement for `forRoot()`,
and the return type is the point: the brand makes it legal in `ApplicationConfig.providers` and
`Route.providers`, and a compile error in a component's `providers`
([08d](08d-the-two-errors-importprovidersfrom-raises.md)). `makeEnvironmentProviders`' doc comment states
the intent, verbatim:

> *"Wrap an array of `Provider`s into `EnvironmentProviders`, preventing them from being accidentally
> referenced in `@Component` in a component injector."*

```ts
// packages/report-widgets/src/provide-report-widgets.ts
import {EnvironmentProviders, makeEnvironmentProviders, Provider} from '@angular/core';
import {REPORT_WIDGET_THEME, ReportWidgetTheme} from './theme-token';
import {ReportWidgetRegistry} from './registry';

export interface ReportWidgetsFeature {
  readonly ɵproviders: Provider[];
}

export function withTheme(theme: ReportWidgetTheme): ReportWidgetsFeature {
  return {ɵproviders: [{provide: REPORT_WIDGET_THEME, useValue: theme}]};
}

export function provideReportWidgets(...features: ReportWidgetsFeature[]): EnvironmentProviders {
  return makeEnvironmentProviders([
    ReportWidgetRegistry,
    ...features.flatMap((feature) => feature.ɵproviders),
  ]);
}
```

🔴 **The `with*` split is what makes the library tree-shakable, and it is not decoration.** A consumer
who never calls `withTheme()` never names it, so nothing it references is reachable from their entry
point. An options bag — `provideReportWidgets({theme: 'dark', analytics: true})` — cannot do this,
because the function body has to reference every branch. [Topic 03 · 04](../03-the-provider-array/04-writing-your-own-provide-function.md)
owns the full pattern, including how the framework's own `HttpFeature` discriminated union is built.

**3 · Optionally, a thin `NgModule` that declares nothing.** This is what every first-party Angular
module now is — [chunk 11](11-where-ngmodule-still-legitimately-appears.md) proves it from the `.d.ts`,
where the `Declarations` slot of `RouterModule`, `CommonModule` and `MatButtonModule` is `never`. Ship
one only if your consumers genuinely import six classes at a time:

```ts
// packages/report-widgets/src/report-widgets.module.ts
import {NgModule} from '@angular/core';
import {ReportBadge} from './report-badge';
import {ReportChart} from './report-chart';
import {ReportTable} from './report-table';

const WIDGETS = [ReportBadge, ReportChart, ReportTable] as const;

@NgModule({
  imports: [...WIDGETS],
  exports: [...WIDGETS],
})
export class ReportWidgetsModule {}
```

Note it has **no `providers`**. A bundle module is safe to `importProvidersFrom` because there is nothing
behind it; a provider-carrying module is the thing this whole chapter is about.

## Migrating a library that already ships a module

Three rules, in order.

1. **Add the function beside the module, in a minor.** `provideX()` and `X.forRoot()` can coexist
   indefinitely; consumers migrate on their own schedule.
2. **Make the module delegate to the function**, so the two can never drift. This is exactly what
   `HttpClientModule` does — [08f](08f-the-multi-bucket-worked-end-to-end.md) quotes its two-line body —
   and it is why the module's *body* is the accurate transcription target.
3. **Do not remove the module in a minor.** Deprecate it, name the replacement in the deprecation text,
   and remove it in a major. A consumer's build fails on a missing export with no migration path.

```ts
// packages/report-widgets/src/report-widgets-legacy.module.ts
import {NgModule} from '@angular/core';
import {provideReportWidgets} from './provide-report-widgets';

/**
 * @deprecated Use `provideReportWidgets()` in `ApplicationConfig.providers` instead.
 *   Removed in v4.0.0.
 */
@NgModule({
  providers: [provideReportWidgets()],
})
export class ReportWidgetsRootModule {}
```

## The imperative escape hatch, when none of the shapes fit

Sometimes there is no route and no bootstrap array — a plugin host that instantiates a feature on
demand, a micro-frontend shell, a widget mounted into a page Angular does not own. Two functions cover
it, both `@public` in the v22.1.5 core golden:

```ts
export function createNgModule<T>(ngModule: Type<T>, parentInjector?: Injector): NgModuleRef<T>;

export function createEnvironmentInjector(providers: Array<Provider | EnvironmentProviders>, parent: EnvironmentInjector, debugName?: string | null): EnvironmentInjector;
```

`createEnvironmentInjector` is the one to reach for first, because it takes the same
`Array<Provider | EnvironmentProviders>` a route does — so everything you learned about `provide*`
functions applies, and no module is involved:

```ts
// src/app/plugins/plugin-host.ts
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  Injectable,
} from '@angular/core';
import {provideReportWidgets, withTheme} from '@report-widgets/core';

@Injectable({providedIn: 'root'})
export class PluginHost {
  private readonly parent = inject(EnvironmentInjector);

  createReportingScope(): EnvironmentInjector {
    return createEnvironmentInjector(
      [provideReportWidgets(withTheme('dark'))],
      this.parent,
      'reporting-plugin',
    );
  }
}
```

⚠️ **`createNgModuleRef` was removed in v22.0.0**, along with `ComponentFactory` and
`ComponentFactoryResolver`; `createNgModule` is the survivor
([chunk 08](08-ngmodule-interop-importprovidersfrom.md) has that gotcha). And an injector you create by
hand has a lifetime you own — the banked public-API excerpt used for this page does not settle the
teardown surface of `EnvironmentInjector`, so check the current API before relying on a destroy hook
rather than assuming one.

## Gotchas

**★ Symptom: your library ships both `provideReportWidgets()` and `ReportWidgetsRootModule`, a consumer uses both, and a multi token has twice as many entries as it should.** Cause: the module delegates to the function, so calling both runs the function twice; non-multi records collapse to last-write-wins and look fine, while multi records accumulate. Fix: make the function itself idempotent for the multi parts, or — better — document that the two are alternatives and give the module a deprecation notice that names the function:

```ts
// packages/report-widgets/src/report-widgets-legacy.module.ts
import {NgModule} from '@angular/core';
import {provideReportWidgets} from './provide-report-widgets';

/**
 * @deprecated Use `provideReportWidgets()` instead — do not use both, the widget
 *   registry is a multi-provider and entries accumulate. Removed in v4.0.0.
 */
@NgModule({providers: [provideReportWidgets()]})
export class ReportWidgetsRootModule {}
```

**★ Symptom: you removed the `NgModule` in a minor release and consumer builds fail with a missing export.** Cause: an `NgModule` is part of a library's public API surface exactly like any other export, and removing it is a breaking change no matter how deprecated it was. Fix: keep the export, make it a shim, and remove it in a major. If the module carried declarables, keep the bundle re-exporting the standalone classes so `imports: [ReportWidgetsModule]` keeps compiling:

```ts
// packages/report-widgets/src/report-widgets.module.ts
import {NgModule} from '@angular/core';
import {ReportBadge} from './report-badge';
import {ReportChart} from './report-chart';

const WIDGETS = [ReportBadge, ReportChart] as const;

@NgModule({imports: [...WIDGETS], exports: [...WIDGETS]})
export class ReportWidgetsModule {}
```

**Symptom: you shipped a re-export bundle module and consumers report that one of the classes in it is not usable in their templates.** Cause: `imports` on an `NgModule` makes a class available *inside* that module; `exports` is what re-publishes it to anything importing the module. A standalone class listed only in `imports` is invisible to consumers. Fix: list every re-exported class in both arrays, which is why the corpus pattern is a single `const` spread into both:

```ts
// packages/report-widgets/src/report-widgets.module.ts
import {NgModule} from '@angular/core';
import {ReportBadge} from './report-badge';
import {ReportChart} from './report-chart';
import {ReportTable} from './report-table';

const WIDGETS = [ReportBadge, ReportChart, ReportTable] as const;

@NgModule({imports: [...WIDGETS], exports: [...WIDGETS]})
export class ReportWidgetsModule {}
```

**★ Symptom: your library's `provideX()` takes an options object and consumers report that unused features still ship.** Cause: an options bag forces the function body to reference every branch, so every feature is reachable from any call site. Fix: the discriminated-union `with*` shape, where an unused feature is never named:

```ts
// packages/report-widgets/src/features.ts
import {Provider} from '@angular/core';
import {REPORT_ANALYTICS_SINK, AnalyticsSink} from './analytics';
import {REPORT_WIDGET_THEME, ReportWidgetTheme} from './theme-token';

export interface ReportWidgetsFeature {
  readonly ɵproviders: Provider[];
}

export function withTheme(theme: ReportWidgetTheme): ReportWidgetsFeature {
  return {ɵproviders: [{provide: REPORT_WIDGET_THEME, useValue: theme}]};
}

export function withAnalytics(sink: AnalyticsSink): ReportWidgetsFeature {
  return {ɵproviders: [{provide: REPORT_ANALYTICS_SINK, useValue: sink}]};
}
```

**Symptom: a consumer put your `provideX()` into a component's `providers` array and it compiled.** Cause: your function returns `Provider[]` rather than `EnvironmentProviders`, so nothing stops it — and the consumer now gets one instance of everything per component instance, including registries that were meant to be shared. Fix: wrap in `makeEnvironmentProviders`, which is precisely what its doc comment says it is for:

```ts
// packages/report-widgets/src/provide-report-widgets.ts
import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {ReportWidgetRegistry} from './registry';
import {ReportWidgetsFeature} from './features';

export function provideReportWidgets(...features: ReportWidgetsFeature[]): EnvironmentProviders {
  return makeEnvironmentProviders([
    ReportWidgetRegistry,
    ...features.flatMap((feature) => feature.ɵproviders),
  ]);
}
```

**Symptom: you shipped `forRoot()` as the only configuration path and a consumer cannot scope your library to one route.** Cause: they can — `Route.providers` accepts `importProvidersFrom(YourModule.forRoot(config))` — but they pay every one of the costs the previous five pages enumerate, for a package that could have handed them a function. Fix: ship the function. The `ModuleWithProviders` shape is precisely what makes this expensive: it bundles a *class* whose whole provider graph is walked with the small *configuration array* that was all anyone wanted.

## Interview questions

**★ You maintain a library that ships `FooModule` with a `forRoot()`. What do you publish in the next major, and what do you keep?**
Publish standalone classes exported directly, and a `provideFoo(...features)` function returning `makeEnvironmentProviders`. Keep the module — as a thin bundle that declares nothing and only re-exports the standalone classes, which is what every first-party Angular module is now — and keep `forRoot()` as a shim that delegates to `provideFoo()` so the two cannot drift, exactly as `HttpClientModule` delegates to `provideHttpClient(withInterceptorsFromDi(), withXhr())`. Deprecate `forRoot()` with a notice that names the replacement, and remove it in the major *after* that, because an `NgModule` export is public API and removing it in a minor breaks consumer builds with no migration path.

**When would you build an `EnvironmentInjector` by hand rather than use `Route.providers`?**
When there is no route. A plugin host that instantiates features on demand, a micro-frontend shell mounting a widget into a page Angular does not own, or a service that needs a disposable scope for a background job — none of those have a `Route` to hang providers on. `createEnvironmentInjector(providers, parent, debugName)` takes the same `Array<Provider | EnvironmentProviders>` a route does, so every `provide*` function still applies and no module is involved. The trade-off is that you now own the lifetime: a route injector is created and released by the router, and a hand-built one is not.

**★ Why is a thin re-export `NgModule` safe for a consumer to pass to `importProvidersFrom`, when a provider-carrying one is not?**
Because there is nothing behind it. `importProvidersFrom` collects providers, and a module whose `providers` array is empty and whose `imports` are all standalone classes contributes none — the walk visits it, emits the factory provider it emits for every module type, and finds nothing else. That is why every first-party Angular module can be handled either way without consequence: [chunk 11](11-where-ngmodule-still-legitimately-appears.md) shows their `Declarations` slot is `never` and their job is re-export. It is also the reason a library that must ship a module should ship *that* module and put its wiring in a function: you have made the module boring, and a boring module is not an interop problem.

**Your library must support both `NgModule` and standalone consumers for two more majors. What is the shape?**
One implementation and two entry points. The implementation is `provideFoo(...features)` returning `makeEnvironmentProviders`; the `NgModule` becomes `@NgModule({providers: [provideFoo()]})` and nothing else, so there is exactly one place the provider list lives and the two can never disagree. Declarables are standalone classes exported directly, plus a re-export module for consumers who want the bundle. That is precisely the shape `HttpClientModule` has in 22.1.5 — a two-line class delegating to `provideHttpClient(withInterceptorsFromDi(), withXhr())` — and its one lesson for you as a maintainer is to make the deprecation notice quote the body exactly, because consumers transcribe the notice.

**A consumer says your library "isn't tree-shakable". What in your API surface would you look at first?**
Whether configuration arrives as an options object or as `with*` functions. An options bag forces `provideX()`'s body to reference every feature it might enable, so every feature is reachable from any call site and a bundler cannot drop any of it. The `with*` shape makes each feature a separate function that a consumer either names or does not, which turns feature selection into a reachability question the bundler can answer. That is the same argument that made `provide*` replace `forRoot()` in the first place, applied one level down — and it is why `provideRouter(routes, withComponentInputBinding())` ships one router feature rather than all of them.

---

← Prev: [Narrowing the lifetime](08h-narrowing-the-lifetime-keeping-the-module-lazy.md) · Index: [Topic index](README.md) · Next → [When the bridge is the honest answer](08j-when-the-bridge-is-the-honest-answer.md)
