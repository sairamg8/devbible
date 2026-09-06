---
title: "`loadComponent` is the same locality at a route boundary — a component became a sufficient lazy unit the moment its scope moved into its own file, and every guard enforcing that is a development-mode guard"
sidebar_label: "10b · `loadComponent` at a route boundary"
sidebar_position: 10.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NgModules overview](https://angular.dev/guide/ngmodules/overview) —
> and `angular/angular` at tag `v22.1.5`:
> [`router/src/utils/config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config.ts),
> [`router/src/router_config_loader.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config_loader.ts),
> [`router/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/errors.ts),
> [`render3/component_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/component_ref.ts),
> [`core/schematics/collection.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/collection.json).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Before standalone, lazy-loading a route meant lazy-loading an `NgModule`, because a component could
not render without the module that declared it — its compilation scope was assembled somewhere else.
Locality made the component a sufficient unit, and `loadComponent` is the router API that exists only
because of that. 🔴 The uncomfortable half is that nothing enforces the standalone requirement at
build time. `assertStandalone` runs from `router_config_loader.ts` *after* the chunk has already
downloaded, is wrapped in an `ngDevMode` guard, and produces two different NG4014 messages depending
on what the dynamic import actually resolved to. The nearest production-side net, NG0981, is itself
behind `ngJitMode` and a `debugInfo` flag — so the two errors you can rely on seeing are both
development-mode errors.** The mechanism this rests on is
[10](10-why-standalone-makes-the-graph-splittable.md); the rebuild-boundary half is
[10c · Incremental compilation and the scope cache](10c-incremental-compilation-and-the-scope-cache.md).

## `loadComponent` — the same locality, at a route boundary

The v22.1.5 router public API declares it as a function returning the class itself:

```ts
loadComponent?: () =>
  | Type<unknown>
  | Observable<Type<unknown> | DefaultExport<Type<unknown>>>
  | Promise<Type<unknown> | DefaultExport<Type<unknown>>>;
```

which in practice is one dynamic import per route:

```ts
// app.routes.ts
import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'reports/:id',
    loadComponent: () => import('./reports/report-detail').then((m) => m.ReportDetail),
  },
];
```

There is a schematic for converting eager route references, described in
`packages/core/schematics/collection.json` verbatim as:

> *"Updates route definitions to use lazy-loading of components instead of eagerly referencing them"*

```bash
ng generate @angular/core:route-lazy-loading
```

## The guard, and why it is late

🔴 **The standalone requirement here is enforced at runtime, not at build time, and only in
development.** `packages/router/src/utils/config.ts`:

```ts
export function assertStandalone(fullPath: string, component: Type<unknown> | undefined): void {
  if (component && isNgModule(component)) {
    throw new RuntimeError(
      RuntimeErrorCode.INVALID_ROUTE_CONFIG,
      `Invalid configuration of route '${fullPath}'. You are using 'loadComponent' with a module, ` +
        `but it must be used with standalone components. Use 'loadChildren' instead.`,
    );
  } else if (component && !isStandalone(component)) {
    throw new RuntimeError(
      RuntimeErrorCode.INVALID_ROUTE_CONFIG,
      `Invalid configuration of route '${fullPath}'. The component must be standalone.`,
    );
  }
}
```

`RuntimeErrorCode.INVALID_ROUTE_CONFIG` is `4014` in `packages/router/src/errors.ts`, so both of
those surface as **NG4014**. And its only call site on the lazy path, in
`packages/router/src/router_config_loader.ts`, is guarded:

```ts
(typeof ngDevMode === 'undefined' || ngDevMode) &&
  assertStandalone(route.path ?? '', component);
route._loadedComponent = component;
```

Two things follow. The check runs **after** the chunk has already downloaded — it is a navigation-time
assertion, not a build-time one — and it is compiled out of a production build. The nearest
production-side net is the orphan-component check in `packages/core/src/render3/component_ref.ts`,
which is itself guarded by `ngJitMode` and a `debugInfo` flag:

```ts
function verifyNotAnOrphanComponent(componentDef: ComponentDef<unknown>) {
  // TODO(pk): create assert that verifies ngDevMode
  if (
    (typeof ngJitMode === 'undefined' || ngJitMode) &&
    componentDef.debugInfo?.forbidOrphanRendering
  ) {
    if (depsTracker.isOrphanComponent(componentDef.type as Type<any>)) {
      throw new RuntimeError(
        RuntimeErrorCode.RUNTIME_DEPS_ORPHAN_COMPONENT,
        `Orphan component found! Trying to render the component ${debugStringifyTypeForError(
          componentDef.type,
        )} without first loading the NgModule that declares it. It is recommended to make this component standalone in order to avoid this error. If this is not possible now, import the component's NgModule in the appropriate NgModule, or the standalone component in which you are trying to render this component. If this is a lazy import, load the NgModule lazily as well and use its module injector.`,
      );
    }
  }
}
```

`RUNTIME_DEPS_ORPHAN_COMPONENT` is `981`, so **NG0981**. ⚠️ **What an AOT production build actually
does when a non-standalone class reaches `loadComponent` is not stated anywhere I could find, and
nothing was run to find out.** Both guards above are development-mode guards; the honest statement is
that the two errors you can rely on seeing are development-mode errors, and this is a reason to keep
`ng build` and `ng serve` honest with the same routes rather than a reason to guess.

## Gotchas

**★ Symptom: a route with `loadComponent` throws NG4014 — *"Invalid configuration of route '…'. You
are using 'loadComponent' with a module, but it must be used with standalone components. Use
'loadChildren' instead."*** Cause: the dynamic import resolved to an `NgModule` class, usually because
the barrel or the file exports both and the wrong name was picked. Fix: `loadComponent` takes the
component; a module goes through `loadChildren`:

```ts
// wrong
{path: 'reports', loadComponent: () => import('./reports/reports.module').then((m) => m.ReportsModule)},

// right — either load the component
{path: 'reports', loadComponent: () => import('./reports/report-list').then((m) => m.ReportList)},
// or keep the module and use the module-shaped API
{path: 'legacy', loadChildren: () => import('./legacy/legacy.module').then((m) => m.LegacyModule)},
```

**★ Symptom: NG4014 — *"Invalid configuration of route '…'. The component must be standalone."* —
appears only when someone navigates to that route, never at build time.** Cause: `assertStandalone`
is called from `router_config_loader.ts` after the chunk resolves, and it is wrapped in a `ngDevMode`
guard, so it is a development-time navigation assertion. Fix: delete the `standalone: false` on the
routed component and remove it from any `declarations` array:

```ts
// report-detail.ts
@Component({
  selector: 'app-report-detail',
  imports: [DatePipe],
  template: `<h2>{{ title }}</h2><p>{{ generatedAt | date: 'medium' }}</p>`,
})
export class ReportDetail {
  protected readonly title = 'Report';
  protected readonly generatedAt = Date.now();
}
```

**★ Symptom: `loadComponent` works in `ng serve` and the route renders an empty or unstyled component
in production.** Cause: both guards that would have told you — NG4014 and the NG0981 orphan check —
are development-only, so a non-standalone class silently reaches the renderer with no compilation
scope. Fix: exercise the route in a production build before shipping, and make the class standalone
so the question cannot arise:

```bash
ng build --configuration production
```

**★ Symptom: NG0981 "Orphan component found!" appears in one build configuration and not another.**
Cause: the check is doubly conditional — `(typeof ngJitMode === 'undefined' || ngJitMode)` and
`componentDef.debugInfo?.forbidOrphanRendering`. An AOT build without that debug info never reaches
the `isOrphanComponent` call. Fix: treat its absence as no evidence either way; the durable answer is
that the component must be standalone, not that a particular build happens to be quiet.

**Symptom: `ng generate @angular/core:route-lazy-loading` leaves some routes eager.** Cause: the
schematic is described as *"Updates route definitions to use lazy-loading of components instead of
eagerly referencing them"* — it rewrites a `component:` reference into a `loadComponent:` import, and
a route whose target is an `NgModule` is not that shape. Fix: convert the module-shaped routes by
hand to `loadChildren`, or migrate those components to standalone first and rerun it.

**Symptom: a `loadComponent` route works, but the chunk downloads before anyone navigates to it.**
Cause: the same class is also referenced eagerly somewhere — a barrel re-export, a test helper
imported from application code, or another route that names it directly. A dynamic import does not
remove an eager one; it adds a second edge. Fix: search for every import of the class and make the
lazy route the only reference. ⛔ No numbers here — nothing was built and no bundle was measured.

## Interview questions

**★ `loadComponent` throws NG4014 for a non-standalone component. At what moment, and does that
protect a production build?**
At navigation, after the chunk has downloaded, and only in development. The call site in
`router_config_loader.ts` is `(typeof ngDevMode === 'undefined' || ngDevMode) && assertStandalone(...)`,
so the assertion is compiled out of a production bundle. The nearest production-side net, the NG0981
orphan check, is itself guarded by `ngJitMode` and a `debugInfo` flag. Neither is a build-time
guarantee, and what a production AOT build does in that situation is not documented.

**★ NG4014 has two different messages under one code. What distinguishes them, and why does the
distinction matter to the person reading the console?**
`assertStandalone` branches on `isNgModule(component)` first: if the loaded value is a module class
the message names `loadChildren` as the alternative, and only otherwise does it fall through to the
generic *"The component must be standalone."* The first message tells you the import resolved to the
wrong *kind* of thing — a barrel exporting both, or a copy-pasted symbol name. The second tells you
it resolved to the right kind of thing carrying `standalone: false`. Those are two different fixes,
which is why reading past the code to the sentence matters.

**Why was the lazy-loading unit an `NgModule` before standalone, and what exactly changed?**
Because a component could not render without the module that declared it — its compilation scope was
assembled from the module's `imports`, so shipping the component alone shipped something with no
scope. Standalone moved that scope into the component's own file, which made the component a
self-sufficient unit for the first time. `loadComponent` is the router API that exists only because
of that change, and `loadChildren` remains for the module-shaped case.

**Why is the standalone check on `loadComponent` a runtime assertion at all, rather than a compile-time
one?**
Because the value is produced by a function the compiler does not evaluate. `loadComponent` is
`() => Promise<Type<unknown>>` — the class it resolves to is decided at navigation time by module
resolution, and `ngtsc` deliberately does not run your code. That is the same static-analysability
constraint that shapes the rest of this phase, seen from the other side: the compiler's refusal to
execute your configuration is exactly what pushes this particular check to runtime.

---

← Prev: [Why standalone makes the graph splittable](10-why-standalone-makes-the-graph-splittable.md) · Index: [Topic index](README.md) · Next → [Incremental compilation and the scope cache](10c-incremental-compilation-and-the-scope-cache.md)
