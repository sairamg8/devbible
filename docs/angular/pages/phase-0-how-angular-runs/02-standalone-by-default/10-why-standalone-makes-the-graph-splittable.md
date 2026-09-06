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
> [`scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts),
> [`core/src/metadata/directives.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/directives.ts),
> [`render3/deps_tracker/deps_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/deps_tracker/deps_tracker.ts).
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
component instead of everything a module declared. This page is the mechanism and the first of those
payoffs.** The route boundary is
[10b · `loadComponent` at a route boundary](10b-loadcomponent-at-a-route-boundary.md) and the rebuild
property is
[10c · Incremental compilation and the scope cache](10c-incremental-compilation-and-the-scope-cache.md).
The rule with teeth that falls out of all of it — **`@defer` silently refuses anything that is not
standalone** *(not written yet)* — is still to be written.

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
load. That is the silent failure of a non-deferrable `@defer` block seen from the emit side: a
`@defer` wrapped around something the compiler could not make deferrable is not an error, it is an
empty list.

⚠️ **`@Component.deferredImports` exists and is not yours to use.** Its doc comment in
`packages/core/src/metadata/directives.ts` is explicit on both counts:

> *"Angular *always* generates dynamic imports for such symbols and removes the regular/eager import.
> Make sure that imports which bring symbols used in the `deferredImports` don't contain other
> symbols."*

> *"Note: this is an internal-only field, use regular `@Component.imports` field instead."*

The field is tagged `@internal // 3p-only` in the v22.1.5 typings. Write `imports` and let the
compiler decide per symbol.

## Gotchas

**★ Symptom: a `@defer` block compiles, renders correctly, and produces no separate chunk at all.**
Cause: the block's dependency list came out empty, so `compileDeferBlocks` stored `null` instead of a
resolver function — there is nothing to dynamically import. That happens when the deferred content
uses only built-in control flow and plain elements, or when its dependencies are also referenced
eagerly elsewhere in the same template. Fix: check what is actually inside the block; a `@defer`
around markup with no component, directive or pipe of its own has nothing to split:

Nothing to defer — no components, directives or pipes inside the block:

```html
@defer (on viewport) {
  <p>{{ description }}</p>
}
```

One dependency, one dynamic import:

```html
@defer (on viewport) {
  <app-revenue-chart [series]="series" />
}
```

**★ Symptom: a `@defer` block with several dependencies is no faster to appear than the eager version
was.** Cause: one dynamic import is emitted *per* dependency and *"The main content of the block
renders after all the imports resolve"* — with no guaranteed order — so the slowest request sets the
latency for the whole block. Fix: keep a deferred block's dependency list small, and split one wide
block into several narrow ones rather than treating `@defer` as free:

```html
@defer (on viewport) { <app-revenue-chart /> }
@defer (on viewport) { <app-cohort-table /> }
```

**★ Symptom: you found `deferredImports` in the `@Component` typings and want to use it to force a
symbol to be deferred.** Cause: it is tagged `@internal // 3p-only` and its own doc says *"this is an
internal-only field, use regular `@Component.imports` field instead."* Fix: put the symbol in
`imports` and let the compiler decide per symbol — its doc also warns *"Make sure that imports which
bring symbols used in the `deferredImports` don't contain other symbols"*, which is a constraint you
inherit the moment you reach for the field and do not have otherwise.

**★ Symptom: you cannot decide whether converting an eager `import` to a dynamic one is safe, and no
tool will tell you.** Cause: the symbol is declared in an `NgModule`, so its visibility is the union
of every declaration in that module and every module that imports it transitively — a whole-program
property that is not knowable from the file you are editing. Fix: make the consumers standalone
first. Once the only route into a template scope is a class reference in an `imports` array, the
question is answered by reading one file.

**Symptom: a barrel file re-exports a component that a `@defer` block also uses, and the chunk never
splits.** Cause: an eager `import` anywhere in the same compilation unit keeps the symbol in the main
graph; the deferred dynamic import is then redundant rather than exclusive. Fix: import deferred
components from their own module path rather than through a barrel that something else already pulls
in eagerly. ⛔ No numbers here — nothing was built and no bundle was measured.

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

**★ `computeNgModuleScope` and `StandaloneComponentScopeReader` answer the same question. What is
the difference that matters?**
What they are keyed on, and therefore what they have to read. `computeNgModuleScope` walks
`def.imports`, recurses into each imported module's scope, and merges the exported directives and
pipes into one `compilation` set shared by every declaration in the module — so its answer depends on
the whole import chain. `StandaloneComponentScopeReader` caches
`Map<ClassDeclaration, StandaloneScope | null>` and computes a scope from one class's own `imports`.
The first cannot answer "who can reference this symbol?" without a whole-program walk; the second
answers it from the file in front of you.

**Why is `deferredImports` in the `@Component` typings if the guide never mentions it?**
It is the internal mechanism the compiler uses when it decides to defer a symbol, exposed as a field
for first-party tooling only — tagged `@internal // 3p-only`, with the note *"this is an internal-only
field, use regular `@Component.imports` field instead."* Its doc also describes the behaviour you get
for free from `imports`: *"Angular always generates dynamic imports for such symbols and removes the
regular/eager import."* Reaching for it buys nothing and couples you to an internal field.

**What happens, exactly, when a `@defer` block turns out to have no deferrable dependencies?**
Nothing visible. `compileDeferBlocks` builds a `Map` from block to expression and writes `null` for
any block whose dependency list is empty, so no resolver function is emitted for it — the block still
renders, the trigger still works, and no chunk boundary is created. There is no diagnostic, which
makes "my `@defer` did not split anything" a reading exercise rather than a debugging one: look at
what the block actually contains.

**Is "we adopted standalone" the same claim as "our bundles got smaller"?**
No, and conflating them is the most common mistake here. Standalone makes the dependency graph
*splittable* — it does not split anything. `@defer` and `loadComponent` are what cut a boundary, and
both can be defeated by a barrel file, an eager reference elsewhere in the same template, or a
dependency that is still module-declared.

---

← Prev: [Mode 2 — prune NgModules](09c-mode-2-prune-ng-modules.md) · Index: [Topic index](README.md) · Next → [`loadComponent` at a route boundary](10b-loadcomponent-at-a-route-boundary.md)
