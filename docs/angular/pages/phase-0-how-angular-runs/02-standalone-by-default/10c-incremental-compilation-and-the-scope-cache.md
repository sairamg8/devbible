---
title: "The compilation-scope cache is keyed on the component class, so the invalidation unit is one component — and the same locality shows up for humans as a text search that is actually complete"
sidebar_label: "10c · Incremental compilation and the scope cache"
sidebar_position: 10.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts),
> [`annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`annotations/ng_module/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/ng_module/src/handler.ts) —
> and angular.dev [NgModules overview](https://angular.dev/guide/ngmodules/overview).
> Documentation-validated; **no sandbox run**; ⛔ **no build times or bundle sizes** — nothing was
> measured.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The third payoff of locality is the one nobody demos, because it has no API: the compiler caches a
compilation scope keyed on the component class, so the unit of invalidation on a rebuild is one
component. A module-keyed scope invalidates every declaration the module holds — and worse, the
`NgModule` handler's own doc comment admits that a change anywhere in a module's *transitive*
standalone imports may change that module's emit. That is a rebuild surface two hops wide, on a
class you did not touch. The human-scale version of the same property is that a text search for a
class name is a complete answer to "who can use this?", because the only route into a template scope
is a class reference in an `imports` array.** ⚠️ Both claims here are readings of two scope readers
and one doc comment, not documented guarantees, and are marked as such where they appear. The route
boundary is [10b](10b-loadcomponent-at-a-route-boundary.md); the mechanism both rest on is
[10](10-why-standalone-makes-the-graph-splittable.md).

## The cache key is the invalidation unit

The same cache line from the standalone scope reader, read as a rebuild property rather than a
compile-time one:

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

Two lists of exactly what this one template named. Nothing about the file the component happens to
sit next to, nothing about what a sibling declaration uses.

## The `NgModule` side has to track something much less precise

The `NgModule` handler's own doc comment says why —
`packages/compiler-cli/src/ngtsc/annotations/ng_module/src/handler.ts`, verbatim:

> *"`SemanticSymbol`s of the transitive imports of this NgModule which came from imported standalone
> components. Standalone components are excluded/included in the `InjectorDef` emit output of the
> NgModule based on whether the compiler can prove that their transitive imports may contain exported
> providers, so a change in this set of symbols may affect the compilation output of this NgModule."*

Read that sentence slowly, because it is doing a lot of work. The module's *emitted output* depends
on whether the compiler can prove something about the transitive imports of the standalone components
it imports. So a change to a component two hops away — one you did not edit, in a file the module
never names — can change what this module compiles to. A standalone component has no equivalent
surface: its scope is computed from its own `imports` array and cached under its own class.

The human-scale version of the same property: because the only route into a template scope is a class
reference in an `imports` array, a text search is a complete answer to "who can use this?"

```bash
grep -rn 'RevenueChart' src/
```

Under module scope it was not, because the reference could be three modules away and never name the
class at all. ⚠️ That is an argument from the two scope readers, not a documented guarantee.

## Gotchas

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

**★ Symptom: every component is standalone, yet edits anywhere still recompile broad swathes of the
app.** Cause: one surviving `NgModule` is enough — if it imports standalone components, its own emit
depends on their transitive imports, and every class it still declares shares one scope. Converting
the leaves without deleting the module keeps the expensive key. Fix: finish the migration; the module
has to go, not merely stop declaring things:

```bash
ng generate @angular/core:standalone --mode=prune-ng-modules
```

**Symptom: `grep` for a directive class name returns only its own file, but templates elsewhere
clearly use it.** Cause: those templates reach it through an `NgModule`'s `exports`, so the consuming
files name the module, not the class. Fix: search for the module name as well, and treat the result
as the list of files to migrate:

```bash
grep -rn --include='*.ts' 'SharedUiModule' src/
```

**Symptom: you assume that because a standalone component's scope is cached per class, the cache
never has to be thrown away.** Cause: the map is `Map<ClassDeclaration, StandaloneScope | null>` —
the key is the *declaration node*, so a change that produces a new node for the same class still
misses. Locality bounds how far invalidation spreads; it does not make a component's own edits free.
Fix: nothing to fix; the claim to make is "one edit invalidates one scope", not "edits are free".

## Interview questions

**★ Why does editing one file in a shared feature module recompile more than that file?**
Because the compilation scope is keyed on the module, not on the declaration. Every class the module
declares shares one scope object, so invalidating it invalidates all of them. On top of that, the
`NgModule` handler's own doc says a change in the set of transitive symbols coming from imported
standalone components *"may affect the compilation output of this NgModule"* — so the module's emit
depends on things two hops away. A standalone component's scope is keyed on the class and has neither
property.

**★ What does keying the compilation-scope cache on the component class buy, beyond compiler
performance?**
It makes the invalidation unit a component. `private cache = new Map<ClassDeclaration, StandaloneScope | null>()`
means one edit invalidates one scope, where a module-keyed scope invalidates every declaration the
module holds. The same locality shows up for humans as a text search that is actually complete,
because the only way into a template scope is a class reference in an `imports` array.

**Is `grep` really a complete answer to "who can use this directive?" — and how confident should you
be in that claim?**
Under standalone, the only route into a component's template scope is a class reference in that
component's own `imports` array, so a text search for the class name finds every consumer. That is a
reading of `StandaloneComponentScopeReader`, not a documented guarantee, and it should be stated that
way. Under `NgModule` scope it was definitively *not* true: the consuming file could name only the
module, three imports away, and never mention the directive at all.

**Unpack the `NgModule` handler's doc comment. What is the compiler actually trying to prove, and why
does failing to prove it cost you a rebuild?**
It is trying to prove whether an imported standalone component's *transitive imports may contain
exported providers*. If they might, that component has to be included in the module's `InjectorDef`
emit output; if they cannot, it is excluded. Because the answer depends on symbols two hops away, the
handler has to record those symbols as semantic dependencies of the module — and a change to any of
them can change the module's compiled output. The cost is that the invalidation edge runs from a file
nobody edited to a module nobody touched.

**`symbol.usedDirectives` and `symbol.usedPipes` are filtered lists, not the whole `imports` array.
Why does that distinction matter for rebuilds?**
Because the semantic dependency is on what the template *used*, not on what the component *imported*.
An entry in `imports` that no binding names is filtered out by `isUsedDirective` / `isUsedPipe`, so
it does not become an edge in the dependency graph. That is the same filtering NG8113 reports on, seen
from the incremental-build side: an unused standalone import costs you an ES import edge, but not a
recompilation edge.

---

← Prev: [`loadComponent` at a route boundary](10b-loadcomponent-at-a-route-boundary.md) · Index: [Topic index](README.md) · Next → [Where `NgModule` still legitimately appears](11-where-ngmodule-still-legitimately-appears.md)
