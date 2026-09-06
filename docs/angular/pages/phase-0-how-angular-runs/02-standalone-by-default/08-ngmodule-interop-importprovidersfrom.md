---
title: "`importProvidersFrom` is the one supported bridge from a library that still ships an `NgModule` into a standalone bootstrap — it takes a class or a `ModuleWithProviders`, returns an opaque brand, and is legal in exactly two places"
sidebar_label: "08 · Interop, honestly — `importProvidersFrom`"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`importProvidersFrom`](https://angular.dev/api/core/importProvidersFrom),
> [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and `angular/angular` at tag
> `v22.1.5`:
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts),
> [`packages/router/src/router_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_module.ts),
> and `goldens/public-api/core/index.api.md` at the same tag.
> Version spine: `@angular/cli` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated;
> **no sandbox run**.

**A v22 application has no `NgModule` in it, but `node_modules` still does. `importProvidersFrom()` is
the single supported way to get a legacy module's providers into a standalone bootstrap, and its
signature already tells you what kind of tool it is: it takes a module class or the
`ModuleWithProviders` object a `forRoot()` returns, and it gives you back a branded value with no
readable members — `{ ɵproviders, ɵfromNgModule }`, both fields private API. You cannot list what it
collected, filter it, or take half. It is legal in `ApplicationConfig.providers` and in
`Route.providers`, and nowhere else, because those two are typed
`Array<Provider | EnvironmentProviders>` while a component's `providers` array is not. This chunk is
what the function is and where it may appear; [08b · What it drags in](08b-what-importprovidersfrom-drags-in.md) is the bill,
[08d · The two errors it raises](08d-the-two-errors-importprovidersfrom-raises.md) is the two errors it raises, and
[08e · The interop shapes that beat it](08e-the-interop-shapes-that-beat-it.md) is the interop that is better than it.

## The signature, and the two brands it stamps on the result

From `goldens/public-api/core/index.api.md` at `v22.1.5`:

```ts
export function importProvidersFrom(...sources: ImportProvidersSource[]): EnvironmentProviders;

export type ImportProvidersSource =
  | Type<unknown>
  | ModuleWithProviders<unknown>
  | Array<ImportProvidersSource>;
```

Three things are accepted: a module **class**, the `ModuleWithProviders` **object** a `forRoot()` or
`forChild()` call returns, and arbitrarily nested arrays of either. The implementation, verbatim from
`packages/core/src/di/provider_collection.ts`:

```ts
export function importProvidersFrom(...sources: ImportProvidersSource[]): EnvironmentProviders {
  return {
    ɵproviders: internalImportProvidersFrom(true, sources),
    ɵfromNgModule: true,
  } as InternalEnvironmentProviders;
}
```

Two fields, both `ɵ`-prefixed and therefore private API. `ɵproviders` is the flattened array; reading it
is reaching into internals and is not supported. `ɵfromNgModule: true` exists for exactly one purpose —
it lets NG0207 print a *more specific* message when the offending value came from this function rather
than from a generic `provide*()` call, which is
[08d · The two errors it raises](08d-the-two-errors-importprovidersfrom-raises.md)'s subject.

Its doc comment is the contract, verbatim:

> *"Collects providers from all NgModules and standalone components, including transitively imported
> ones."*

> *"Providers extracted via `importProvidersFrom` are only usable in an application injector or another
> environment injector (such as a route injector). They should not be used in component providers."*

## The two places it may appear, from its own `@usageNotes`

Both examples below are copied verbatim out of the `importProvidersFrom` doc comment in
`provider_collection.ts` — they are the framework's own statement of where the return value is legal.

```ts
await bootstrapApplication(RootComponent, {
  providers: [
    importProvidersFrom(NgModuleOne, NgModuleTwo)
  ]
});
```

```ts
export const ROUTES: Route[] = [
  {
    path: 'foo',
    providers: [
      importProvidersFrom(NgModuleOne, NgModuleTwo)
    ],
    component: YourStandaloneComponent
  }
];
```

`ApplicationConfig.providers` and `Route.providers` are both typed
`Array<Provider | EnvironmentProviders>`; `@Component.providers` is inherited from `Directive` and typed
`Provider[]` with no `EnvironmentProviders` member. That type asymmetry is the whole fence —
[chunk 07b](07b-imports-split-in-two-and-providers-gained-four-homes.md) has the four-homes table, and
the type here is a branded phantom with no readable members at all:

```ts
// @public
export type EnvironmentProviders = {
    ɵbrand: 'EnvironmentProviders';
};
```

🔴 **The choice between the two call sites is not stylistic.** The bootstrap form puts everything in the
root environment injector for the life of the process. The route form makes the router create a child
`EnvironmentInjector` for that route subtree, so the providers are created on first navigation and are
invisible everywhere else. When both work, the route form is strictly better, and
[08g · Narrowing the injector](08g-narrowing-the-injector-and-the-lifetime.md) shows the shape.

## The anatomy of a `ModuleWithProviders`, in six lines

`RouterModule.forChild` is the smallest honest example, verbatim from
`packages/router/src/router_module.ts`:

```ts
static forChild(routes: Routes): ModuleWithProviders<RouterModule> {
  return {
    ngModule: RouterModule,
    providers: [{provide: ROUTES, multi: true, useValue: routes}],
  };
}
```

Two halves in one object: the **class**, whose whole provider graph gets walked, and a small
**configuration** array. `importProvidersFrom(SomeLibModule.forRoot(config))` gets you the config you
wanted *and* the class you did not ask about. `provideSomeLib(config)` would have given you only the
first half. That asymmetry — not verbosity, not style — is the entire reason the `provide*` convention
exists, and [topic 03 · The provider array is the wiring](../03-the-provider-array/README.md) owns the
argument in full.

## Where it fits in the four-way interop picture

`importProvidersFrom` is one of four ways a v22 app touches an `NgModule`, and choosing the wrong one is
the most common interop mistake:

| You have | Reach for | Why |
|---|---|---|
| A library module with no `provide*` equivalent, needed app-wide | `importProvidersFrom(LibModule)` in `ApplicationConfig.providers` | The only supported route for a class you do not control |
| The same, but needed by one feature | `importProvidersFrom(LibModule)` in that route's `providers` | Scoped to a child `EnvironmentInjector`, created on navigation |
| A legacy *feature* module of your own with its own routes | `loadChildren: () => import('…').then(m => m.FeatureModule)` | Stays lazy; the route's injector parents the module's ([08c · Ordering, cycles and multi tokens](08c-ordering-cycles-and-multi-tokens.md)) |
| A module class you must instantiate imperatively | `createNgModule(LibModule, parentInjector)` | Still `@public` in 22.1.5; `createNgModuleRef` was **removed in v22.0.0** |

Nothing in that table is a template-scope mechanism. A module's *directives and pipes* reach a component
only through that component's own `imports` array — [chunk 04](04-what-imports-actually-means.md) — and
`importProvidersFrom` contributes nothing to it.

## Gotchas

**★ Symptom: you want to keep only *some* of what a module provides and there is no API to do it.** Cause: `EnvironmentProviders` is `{ ɵbrand: 'EnvironmentProviders' }` — an opaque brand with the payload on a private `ɵproviders` field. There is no filter, no spread, no inspection. Fix: import it whole and override the token afterwards, since the last non-multi provider wins ([08c · Ordering, cycles and multi tokens](08c-ordering-cycles-and-multi-tokens.md)):

```ts
bootstrapApplication(App, {
  providers: [
    importProvidersFrom(VendorSdkModule.forRoot({region: 'eu'})),
    {provide: VENDOR_LOGGER, useClass: OurQuietLogger},
  ],
});
```

For a `multi: true` token such as `HTTP_INTERCEPTORS` that override does **not** work — a multi record
accumulates rather than replaces — so there the only real fix is to stop importing the module and
provide the pieces yourself ([08f · The multi bucket, worked end to end](08f-the-multi-bucket-worked-end-to-end.md)).

**★ Symptom: `importProvidersFrom(SharedModule)` sits in `main.ts` and nobody on the team can say what it brings in.** Cause: this is the function working exactly as designed — a transitive walk with no report and an opaque result. Fix: read `SharedModule`'s own `imports` and `providers` by hand and convert them one at a time, deleting each entry from the module as you go, until the module is empty and the call can be deleted with it. There is no tooling shortcut for the reading step; the schematic in chunk [09 · The standalone migration schematic](09-the-standalone-migration-schematic.md) converts what it recognises and leaves the rest.

**★ Symptom: you added `importProvidersFrom(MatCardModule)` and the template still says `'mat-card' is not a known element`.** Cause: you used a provider mechanism for a template-scope problem. `importProvidersFrom` collects providers; it does not put a single directive into any component's compilation scope. Fix: import the class in the component that renders it:

```ts
import {Component} from '@angular/core';
import {MatCardModule} from '@angular/material/card';

@Component({
  selector: 'app-report-summary',
  imports: [MatCardModule],
  template: `<mat-card><p>Nothing to report.</p></mat-card>`,
})
export class ReportSummary {}
```

[Chunk 06](06-not-a-known-element.md) owns that error in full.

**★ Symptom: `importProvidersFrom(LegacyModule)` compiles at the top level of `main.ts` but a colleague's copy inside a `@Component.providers` array does not.** Cause: the two arrays have different types. `ApplicationConfig.providers` and `Route.providers` are `Array<Provider | EnvironmentProviders>`; `Directive.providers`, which `Component` inherits, is `Provider[]`. The brand exists precisely to make that assignment fail. Fix: move it to an environment injector — and prefer the narrow one:

```ts
// src/app/app.routes.ts
export const routes: Routes = [
  {
    path: 'reports',
    providers: [importProvidersFrom(LegacyReportingModule)],
    loadComponent: () => import('./reports/report-list').then((m) => m.ReportList),
  },
];
```

**★ Symptom: you reached for `createNgModuleRef` after an upgrade to v22 and the symbol no longer exists.** Cause: `createNgModuleRef` was **removed in v22.0.0**, along with `ComponentFactory` and `ComponentFactoryResolver`. Fix: `createNgModule` is the survivor and is still `@public` in the 22.1.5 core golden:

```ts
import {createNgModule, EnvironmentInjector, inject} from '@angular/core';
import {LegacyReportingModule} from './legacy/reporting.module';

export function loadLegacyReporting(): void {
  const parent = inject(EnvironmentInjector);
  const moduleRef = createNgModule(LegacyReportingModule, parent);
  moduleRef.injector.get(LegacyReportBootstrapper).start();
}
```

## Interview questions

**★ Why does `importProvidersFrom` return an opaque branded type instead of a `Provider[]` you could inspect?**
Because a readable array would immediately be treated as one — filtered, spread, sliced, and passed into a `@Component.providers` array where none of it is legal. The brand `{ ɵbrand: 'EnvironmentProviders' }` makes the value assignable to `ApplicationConfig.providers` and `Route.providers` (both `Array<Provider | EnvironmentProviders>`) and unassignable to `Directive.providers` (`Provider[]`), which is a compile error rather than a runtime one. The runtime backs the fence up with NG0207, and the extra `ɵfromNgModule` flag lets that error name `importProvidersFrom` specifically. Opacity is the feature.

**★ Why does `forChild(routes)` returning `{ngModule: RouterModule, providers: [...]}` explain the whole `provide*` convention?**
Because it makes the conflation visible in six lines. A `ModuleWithProviders` bundles a *class* — whose entire provider graph will be walked and retained — with a small *configuration array* that is the only part you wanted. Every `forRoot()` in every library has that same shape. `provideRouter(routes)` is what you get when you keep the configuration and drop the class, which is why the replacement for a `forRoot` is always a function and never a smaller module.

**★ Does `importProvidersFrom(MatCardModule)` let a component render a `mat-card` in its template?**
No, and this is the single most common interop confusion. `@NgModule.imports` used to do two unrelated jobs — contribute exported directives and pipes to a compilation scope, *and* collect providers into an injector — and standalone split them. `importProvidersFrom` inherited only the provider half. Template scope now comes exclusively from the consuming component's own `imports` array, resolved at compile time in that one file. A module can appear in both places for different reasons, and neither substitutes for the other.

**When is the route form of `importProvidersFrom` strictly better than the bootstrap form, and when is it not available?**
It is better whenever only one feature needs the module: `Route.providers` makes the router create a child `EnvironmentInjector` for that route and its children, so the providers are constructed on first navigation and cannot be injected from anywhere else in the app. It is not available when the module contributes something the framework consumes during bootstrap — an app initialiser, a global error handler, an `HTTP_INTERCEPTORS` entry every request must pass through — because a route injector does not exist yet when those run. The test is "does anything outside this route subtree need to inject it".

**Why is the `ɵproviders` field prefixed with `ɵ`, and what happens if you read it anyway?**
`ɵ` is Angular's marker for a symbol exported for the framework's own use and excluded from the public API golden — `goldens/public-api/core/index.api.md` lists `importProvidersFrom` and `EnvironmentProviders`, not `ɵproviders`. Nothing stops you casting to `any` and reading the array; nothing also promises it will exist next patch, keep the same name, or hold objects in the same shape. Any code reading it is a private-API dependency and will break on an upgrade with no deprecation cycle and no migration.

**A teammate says "just wrap every legacy module in `importProvidersFrom` at bootstrap and move on". What is wrong with that as a strategy, in one sentence each?**
It converts lazy features into eager ones, because everything in `ApplicationConfig.providers` is collected before the first render. It removes your ability to see what you depend on, because the result is opaque. It defeats tree-shaking, because each module class is referenced by value from the entry point. And it hides the work rather than doing it — every remaining call is a module somebody still has to convert, and the count is the only honest progress metric you have.

---

← Prev: [The fields that moved, and the ones deleted](07c-the-fields-that-moved-and-the-ones-deleted.md) · Index: [Topic index](README.md) · Next → [What it drags in](08b-what-importprovidersfrom-drags-in.md)
