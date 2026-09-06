---
title: "The payoff of standalone is not that you type less — it is that a component's whole dependency set is knowable from one file, which is the only reason `ngtsc` can compute a per-template graph and cut a chunk boundary through it"
sidebar_label: "10 · Why standalone makes the graph splittable"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer),
> [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and `angular/angular` at tag
> `v22.1.5`:
> [`annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`annotations/ng_module/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/ng_module/src/handler.ts),
> [`scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts),
> [`core/src/metadata/directives.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/directives.ts),
> [`render3/component_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/component_ref.ts),
> [`render3/deps_tracker/deps_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/deps_tracker/deps_tracker.ts),
> [`router/src/utils/config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config.ts),
> [`router/src/router_config_loader.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config_loader.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every argument for standalone that stops at "no more boilerplate" has missed the point. The
property standalone actually buys is *locality*: the complete set of a component's template
dependencies is written in that component's own file, as a literal array of identifiers, and nothing
outside that file can add to it. Locality turns "which templates can reference `RevenueChart`?" from
a whole-program question into a one-file question — and rewriting an eager `import` into a dynamic
`import()` is only sound when that question has a cheap, exact answer. Three capabilities in Angular
22 are downstream of exactly that: `@defer` emits one dynamic import per dependency of a block,
`loadComponent` lazy-loads a single component with no module wrapped around it, and the compiler
caches a compilation scope per component class rather than per module, so a rebuild invalidates one
component instead of everything a module declared. This page is the mechanism and those three
payoffs. The rule with teeth that falls out of it — `@defer` silently refuses anything that is not
standalone — is the next chunk.**

## Locality is a compiler property before it is an ergonomic one

Under `NgModule`, a component's compilation scope was assembled somewhere else. The runtime version
of that algorithm, `computeNgModuleScope` in
`packages/core/src/render3/deps_tracker/deps_tracker.ts`, is the shape in eight lines:

```ts
// Analyzing imports
for (const imported of maybeUnwrapFn(def.imports)) {
  if (isNgModule(imported)) {
    const importedScope = this.getNgModuleScope(imported);

    // When this module imports another, the imported module's exported directives and pipes
    // are added to the compilation scope of this module.
    addSet(importedScope.exported.directives, scope.compilation.directives);
    addSet(importedScope.exported.pipes, scope.compilation.pipes);
  }
}
```

**One `compilation` set, shared by every declaration in the module, fed transitively by every module
in the import chain.** The sibling chunk on the ambient `NgModule` scope owns that story in full;
what matters here is the consequence for tooling. To answer *"is it safe to make this directive's
import dynamic?"* under module scope, a compiler must walk the entire module graph — the symbol is
visible to every component the module declares, and to every component in every module that imports
it, transitively. That set is not knowable from the file being compiled.

The standalone reader answers the same question from one class.
`packages/compiler-cli/src/ngtsc/scope/src/standalone.ts`, whose class doc reads:

> *"Computes scopes for standalone components based on their `imports`, expanding imported NgModule
> scopes where necessary."*

and whose first two lines are the whole difference:

```ts
export class StandaloneComponentScopeReader implements ComponentScopeReader {
  private cache = new Map<ClassDeclaration, StandaloneScope | null>();
```

🔴 **The rewrite-safety argument above is reasoning from those two code paths, not a quotation.** No
Angular document states it in these words; it is what the two scope readers make true. Everything
below it *is* documented or read from source, and is marked as such.

## What `@defer` does with that graph

angular.dev, verbatim, on what a `@defer` block buys:

> *"The code for any components, directives, and pipes inside the `@defer` block is split into a
> separate JavaScript file and loaded only when necessary, after the rest of the template has been
> rendered."*

and on the emitted shape:

> *"Angular's compiler produces a [dynamic import] statement for each component, directive, and pipe
> used in the `@defer` block. The main content of the block renders after all the imports resolve.
> Angular does not guarantee any particular order for these imports."*

**One dynamic import per dependency, not one per block.** In `handler.ts`, `resolveDeferBlocks` walks
each block's bound template and fills a per-block dependency list; `compileDeferBlocks` turns each
non-empty list into a resolver function:

```ts
const blocks = new Map<TmplAstDeferredBlock, o.Expression | null>();
for (const [block, dependencies] of perBlockDeps) {
  blocks.set(
    block,
    dependencies.length === 0 ? null : compileDeferResolverFunction({mode, dependencies}),
  );
}
```

A block whose dependency list came out **empty** emits `null` — no resolver function, nothing to
load. That is the silent failure of the next chunk seen from the emit side: a `@defer` block wrapped
around something the compiler could not make deferrable is not an error, it is an empty list.

⚠️ **`@Component.deferredImports` exists and is not yours to use.** Its doc comment in
`packages/core/src/metadata/directives.ts` is explicit on both counts:

> *"Angular *always* generates dynamic imports for such symbols and removes the regular/eager import.
> Make sure that imports which bring symbols used in the `deferredImports` don't contain other
> symbols."*

> *"Note: this is an internal-only field, use regular `@Component.imports` field instead."*

The field is tagged `@internal // 3p-only` in the v22.1.5 typings. Write `imports` and let the
compiler decide per symbol.

## `loadComponent` — the same locality, at a route boundary

Before standalone, lazy-loading a route meant lazy-loading an `NgModule`, because a component could
not be rendered without the module that declared it. With locality, the component is a sufficient
unit. The v22.1.5 router public API declares it as a function returning the class itself:

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

## Incremental compilation: a scope you can invalidate per component

The same cache line, read as a rebuild property:

```ts
private cache = new Map<ClassDeclaration, StandaloneScope | null>();
```

**The cache key is the invalidation unit.** Editing a standalone component invalidates that
component's scope. An `NgModule` scope is keyed on the module, so touching the module invalidates the
scope of every declaration in it.

The semantic dependency graph records the same shape. In `handler.ts`, a component symbol keeps the
exact list of directives and pipes its template used:

```ts
symbol.usedDirectives = Array.from(declarations.values())
  .filter(isUsedDirective)
  .map(getSemanticReference);
symbol.usedPipes = Array.from(declarations.values())
  .filter(isUsedPipe)
  .map(getSemanticReference);
```

The `NgModule` side of the same graph has to track something considerably less precise, and its own
doc comment says why — `packages/compiler-cli/src/ngtsc/annotations/ng_module/src/handler.ts`,
verbatim:

> *"`SemanticSymbol`s of the transitive imports of this NgModule which came from imported standalone
> components. Standalone components are excluded/included in the `InjectorDef` emit output of the
> NgModule based on whether the compiler can prove that their transitive imports may contain exported
> providers, so a change in this set of symbols may affect the compilation output of this NgModule."*

A change *anywhere* in a module's transitive standalone imports can change that module's emit. A
standalone component has no such surface.

The human-scale version of the same property: because the only route into a template scope is a class
reference in an `imports` array, a text search is a complete answer to "who can use this?"

```bash
grep -rn 'RevenueChart' src/
```

Under module scope it was not, because the reference could be three modules away and never name the
class at all. ⚠️ That is an argument from the two scope readers, not a documented guarantee.

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

**★ Symptom: a one-line change to a shared feature module triggers a rebuild that recompiles far more
than the file you touched.** Cause: an `NgModule`-keyed compilation scope invalidates every
declaration in the module, and the module's own emit depends on its transitive standalone imports —
*"a change in this set of symbols may affect the compilation output of this NgModule."* Fix: there is
no configuration for this; the fix is to remove the module and let each component carry its own
`imports`, which is what the standalone migration schematic does mode by mode.

**★ Symptom: you cannot answer "who uses this directive?" without running the app.** Cause: the
directive is exported from an `NgModule` that other modules import, so no consuming file names it.
Fix: once the consumers are standalone, every use is a class reference in an `imports` array and the
search is exhaustive:

```bash
grep -rn --include='*.ts' 'HighlightDirective' src/
```

## Interview questions

**★ Why does deferring or lazy-loading a *component* only become possible once components are
standalone?**
Because both are the same rewrite: an eager ES import becomes a dynamic one. That rewrite is sound
only if the compiler knows every template that can reference the symbol. With `imports`, that set is
one array literal in one file. Under `NgModule` scope the symbol is visible to every declaration in
the module and to every module importing it transitively, so no single-file rewrite is safe — which
is why the pre-standalone lazy unit was the module, not the component.

**★ How many dynamic imports does a `@defer` block containing three components produce?**
Three. angular.dev: *"Angular's compiler produces a dynamic import statement for each component,
directive, and pipe used in the `@defer` block"*, and *"Angular does not guarantee any particular
order for these imports."* The block's content renders after all of them resolve, so the slowest one
sets the latency — a reason to keep a deferred block's dependency list small rather than to treat
`@defer` as free.

**★ `loadComponent` throws NG4014 for a non-standalone component. At what moment, and does that
protect a production build?**
At navigation, after the chunk has downloaded, and only in development. The call site in
`router_config_loader.ts` is `(typeof ngDevMode === 'undefined' || ngDevMode) && assertStandalone(...)`,
so the assertion is compiled out of a production bundle. The nearest production-side net, the NG0981
orphan check, is itself guarded by `ngJitMode` and a `debugInfo` flag. Neither is a build-time
guarantee, and what a production AOT build does in that situation is not documented.

**Why is `deferredImports` in the `@Component` typings if the guide never mentions it?**
It is the internal mechanism the compiler uses when it decides to defer a symbol, exposed as a field
for first-party tooling only — tagged `@internal // 3p-only`, with the note *"this is an internal-only
field, use regular `@Component.imports` field instead."* Its doc also describes the behaviour you get
for free from `imports`: *"Angular always generates dynamic imports for such symbols and removes the
regular/eager import."* Reaching for it buys nothing and couples you to an internal field.

**What does keying the compilation-scope cache on the component class buy, beyond compiler
performance?**
It makes the invalidation unit a component. `private cache = new Map<ClassDeclaration, StandaloneScope | null>()`
means one edit invalidates one scope, where a module-keyed scope invalidates every declaration the
module holds. The same locality shows up for humans as a text search that is actually complete,
because the only way into a template scope is a class reference in an `imports` array.

**Is "we adopted standalone" the same claim as "our bundles got smaller"?**
No, and conflating them is the most common mistake here. Standalone makes the dependency graph
*splittable* — it does not split anything. `@defer` and `loadComponent` are what cut a boundary, and
both can be defeated by a barrel file, an eager reference elsewhere in the same template, or a
dependency that is still module-declared. The two later chunks in this topic are exactly those two
failure sets.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **11 · Where `NgModule` still legitimately appears** *(not written yet)*
