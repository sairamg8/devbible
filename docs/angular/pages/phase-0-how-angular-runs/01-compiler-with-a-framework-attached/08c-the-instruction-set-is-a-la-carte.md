---
title: "The compiler models every instruction as a `{name, moduleName}` pair and there are 215 of them, which is why the interpolation and pure-function families are numbered rather than variadic — your template references the exact members it needs and nothing else, and the definition holding them is itself droppable"
sidebar_label: "08c · The instruction set is à la carte"
sidebar_position: 8.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler/src/render3/r3_identifiers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_identifiers.ts) (216 `static` declarations, 215 carrying a `name` — counted directly in the file at this tag), [`packages/core/src/util/closure.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/closure.ts); angular.dev [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), whose "Reasons you might want to use AOT" table is quoted verbatim (⚠️ the same page is stale on the compiler's *architecture* — see [06](06-what-the-compiler-emits.md)); and the published `@angular/core@22.1.5` manifest on `registry.npmjs.org` for its `peerDependenciesMeta`.
> Documentation-validated; **no sandbox run** — no bundle was built, measured or compared, and no byte count appears on this page.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[08b](08b-the-selector-problem-and-reference-inversion.md) made the argument; this chunk is the
machinery that cashes it. The compiler does not "call into the framework" — it holds a table of 215
named external references, each one a `{name, moduleName}` pair naming an exported symbol of
`@angular/core`, and it emits a reference to precisely the members a given template needs. That is
why the interpolation, pure-function and pipe-binding families are numbered instead of variadic: a
template that interpolates two expressions references `ɵɵtextInterpolate2` and leaves the other nine
members of its family unreachable. On top of that, the definition object holding the whole thing is
wrapped in `noSideEffects` so an unreferenced component's `ɵcmp` is itself deletable. The one piece
of hard evidence that all of it works is in your lockfile: `@angular/compiler` is an **optional**
peer dependency of `@angular/core`.**

## The compiler's model of an instruction is a `{name, moduleName}` pair

`packages/compiler/src/render3/r3_identifiers.ts` is a single class of static fields. Verbatim, the
constant and four representative members:

```ts
const CORE = '@angular/core';

export class Identifiers {
  static element: o.ExternalReference = {name: 'ɵɵelement', moduleName: CORE};
  static conditional: o.ExternalReference = {name: 'ɵɵconditional', moduleName: CORE};
  static repeater: o.ExternalReference = {name: 'ɵɵrepeater', moduleName: CORE};
  static defer: o.ExternalReference = {name: 'ɵɵdefer', moduleName: CORE};
}
```

Read what an `ExternalReference` *is*: a module specifier plus an exported name. The compiler never
holds a function; it holds the address of one. So what an emitted template function depends on is a
**set of named exports**, and the emitted code names exactly the ones its own template required.
Whether your bundler then collapses that to the minimum is the bundler's job and not Angular's
claim — but the input to that job is as narrow as it can be made.

Counted in the file at `v22.1.5`: **216 `static` declarations, 215 of which carry a `name`.** (The
odd one out is `static core`, whose `name` is `null` — it addresses the module itself rather than a
symbol in it.) Not all 215 are instructions; the table also holds definition functions, declaration
types, features and sanitizers. The breadth is the point rather than the number.

| family | members declared in the file |
|---|---|
| element creation | `ɵɵelement` `ɵɵelementStart` `ɵɵelementEnd` `ɵɵelementContainer` `ɵɵelementContainerStart` `ɵɵelementContainerEnd` |
| DOM-only variants | `ɵɵdomElement` `ɵɵdomElementStart` `ɵɵdomElementEnd` `ɵɵdomElementContainer` `ɵɵdomTemplate` `ɵɵdomListener` `ɵɵdomProperty` |
| text and interpolation | `ɵɵtext` `ɵɵtextInterpolate` `ɵɵtextInterpolate1` … `ɵɵtextInterpolate8` `ɵɵtextInterpolateV` |
| generic interpolation | `ɵɵinterpolate` `ɵɵinterpolate1` … `ɵɵinterpolate8` `ɵɵinterpolateV` |
| bindings | `ɵɵproperty` `ɵɵattribute` `ɵɵclassProp` `ɵɵclassMap` `ɵɵstyleProp` `ɵɵstyleMap` `ɵɵariaProperty` `ɵɵtwoWayProperty` `ɵɵtwoWayListener` `ɵɵtwoWayBindingSet` |
| control flow | `ɵɵconditional` `ɵɵconditionalCreate` `ɵɵconditionalBranchCreate` `ɵɵrepeater` `ɵɵrepeaterCreate` `ɵɵrepeaterTrackByIndex` `ɵɵrepeaterTrackByIdentity` |
| `@let` | `ɵɵdeclareLet` `ɵɵstoreLet` `ɵɵreadContextLet` — see [03](03-declarations-and-the-let-block.md) |
| `@defer` | `ɵɵdefer`, 22 trigger variants across the eager / `Prefetch` / `Hydrate` flavours, and `ɵɵdeferEnableTimerScheduling` |
| pure functions | `ɵɵpureFunction0` … `ɵɵpureFunction8` `ɵɵpureFunctionV` |
| pipes | `ɵɵpipe` `ɵɵpipeBind1` … `ɵɵpipeBind4` `ɵɵpipeBindV` |
| queries | `ɵɵviewQuery` `ɵɵcontentQuery` `ɵɵviewQuerySignal` `ɵɵcontentQuerySignal` `ɵɵqueryRefresh` `ɵɵqueryAdvance` `ɵɵloadQuery` |
| i18n | `ɵɵi18n` `ɵɵi18nStart` `ɵɵi18nEnd` `ɵɵi18nExp` `ɵɵi18nApply` `ɵɵi18nAttributes` `ɵɵi18nPostprocess` |
| navigation | `ɵɵadvance` `ɵɵnextContext` `ɵɵgetCurrentView` `ɵɵrestoreView` `ɵɵresetView` `ɵɵreference` |
| features | `ɵɵNgOnChangesFeature` `ɵɵInheritDefinitionFeature` `ɵɵProvidersFeature` `ɵɵHostDirectivesFeature` `ɵɵExternalStylesFeature` `ɵɵControlFeature` |
| sanitizers | `ɵɵsanitizeHtml` `ɵɵsanitizeStyle` `ɵɵsanitizeUrl` `ɵɵsanitizeResourceUrl` `ɵɵsanitizeScript` `ɵɵsanitizeUrlOrResourceUrl` `ɵɵvalidateAttribute` |

## Arity is in the name, and that is not an accident of style

Four families are numbered, and the numbering goes to the same place every time — one member per
arity, plus a `V` for the variadic fallback:

- `ɵɵtextInterpolate` and `ɵɵtextInterpolate1` … `ɵɵtextInterpolate8`, then `ɵɵtextInterpolateV`
- `ɵɵinterpolate` and `ɵɵinterpolate1` … `ɵɵinterpolate8`, then `ɵɵinterpolateV`
- `ɵɵpureFunction0` … `ɵɵpureFunction8`, then `ɵɵpureFunctionV`
- `ɵɵpipeBind1` … `ɵɵpipeBind4`, then `ɵɵpipeBindV`

⚠️ **The source states no rationale for the shape**, so take the consequence rather than a motive.
The consequence is exact: a template writing `{{ firstName }} {{ lastName }}` causes the compiler to
emit a reference to `ɵɵtextInterpolate2` and to *nothing else in that family*. The other nine
members are never named by your build, so nothing retains them. A single variadic
`interpolate(strings, values)` would be one symbol that every template in every application
references, and it would carry the loop, the array allocation and the general path along with it.

`ɵɵpureFunction0` … `ɵɵpureFunction8` is the same trick applied to memoised sub-expressions, and
`ɵɵpipeBind1` … `ɵɵpipeBind4` to pipe arguments. It is a design consequence of instructions-not-vnodes
that has no analogue in a virtual-DOM framework — and it is the honest answer to "why does the
internal API surface look like that". It is not bloat; it is the tree-shaking contract, written out
one arity at a time.

## The definition itself is droppable

Referencing few instructions is only half of it. A component nobody uses should take its whole
`ɵcmp` with it, and the obstacle is that building a `ComponentDef` is real work — resolving directive
and pipe defs, running features, computing an id — which an optimiser must treat as a side effect and
therefore may not remove. Angular's answer is six lines in
`packages/core/src/util/closure.ts` that convince the optimiser otherwise. Verbatim from its
docstring:

> *"Convince closure compiler that the wrapped function has no side-effects."*

> *"Closure compiler always assumes that `toString` has no side-effects. We use this quirk to allow
> us to execute a function but have closure compiler mark the call as no-side-effects. It is
> important that the return value for the `noSideEffects` function be assigned to something which is
> retained otherwise the call to `noSideEffects` will be removed by closure compiler."*

[06b](06b-inside-definecomponent.md) walks the function itself and the `_?: unknown` field that
exists purely to retain its result. The point *here* is that the two mechanisms compose: the
instruction table narrows what a template references, and `noSideEffects` makes the object holding
those references removable when nothing names the component.

## The payoff you can check in your own lockfile

Every other claim on this page is about mechanism. This one is a fact you can read out of the
published manifest for `@angular/core@22.1.5`:

```json
{
  "peerDependencies": {
    "rxjs": "^6.5.3 || ^7.4.0",
    "zone.js": "~0.15.0 || ~0.16.0",
    "@angular/compiler": "22.1.5"
  },
  "peerDependenciesMeta": {
    "zone.js": {"optional": true},
    "@angular/compiler": {"optional": true}
  }
}
```

🔴 **`@angular/compiler` is an optional peer dependency of `@angular/core`.** The runtime declares
that it can function without the compiler present at all — which is only a coherent thing to declare
because an ahead-of-time build leaves nothing for the compiler to do. That is the tree-shaking
argument reduced to a line of package metadata, and it is checkable without building anything.

## What the documentation claims for it, verbatim

angular.dev's AOT page lists the reasons in a table. All four, unedited:

> *"Smaller Angular framework download size — There's no need to download the Angular compiler if the
> application is already compiled. The compiler is roughly half of Angular itself, so omitting it
> dramatically reduces the application payload."*

> *"Faster rendering — With AOT, the browser downloads a pre-compiled version of the application. The
> browser loads executable code so it can render the application immediately, without waiting to
> compile the application first."*

> *"Fewer asynchronous requests — The compiler inlines external HTML templates and CSS style sheets
> within the application JavaScript, eliminating separate ajax requests for those source files."*

> *"Better security — AOT compiles HTML templates and components into JavaScript files long before
> they are served to the client. With no templates to read and no risky client-side HTML or
> JavaScript evaluation, there are fewer opportunities for injection attacks."*

⛔ **Do not turn *"roughly half of Angular itself"* into a byte count.** It is a documentation phrase,
not a measurement, and there is no sandbox behind this corpus to produce one. Quote it and stop.
Note also what the four claims are *not*: none of them says an instruction stream renders faster
than a vnode diff. The rendering claim is about not waiting to compile at startup.

## Gotchas

**★ Symptom: you see `@angular/compiler` sitting in your application's `dependencies` and conclude the compiler ships to your users.** Cause: presence in `package.json` is not presence in the bundle. What ends up in the output is what is *reachable from the entry point*, and an AOT-built application never reaches the compiler — which is exactly what `"@angular/compiler": {"optional": true}` in `@angular/core`'s `peerDependenciesMeta` records. What does drag it in is any code path that compiles a decorator at runtime. Fix: never import it from application code, and if a build tool needs it, keep the dependency and keep the import out of the runtime graph:

```ts
// ⛔ In an application source file this makes the compiler reachable from the entry point.
// import '@angular/compiler';

// ✅ Application code touches only the runtime.
import {Component} from '@angular/core';

@Component({selector: 'app-root', template: `<h1>Storefront</h1>`})
export class App {}
```

**★ Symptom: you expected an `@if` branch that never executes to cost nothing, and its contents are in the bundle anyway.** Cause: reachability, again — the compiler emitted a reference to the branch's dependencies whether or not the condition is ever true, and `ɵɵconditional` is referenced because the template contains a conditional at all. The instruction set is not the lever; the *dependency graph* is. Fix: use the one construct that turns a static reference into a dynamic import, which is `@defer` — and note it moves the block's dependencies, not the instruction:

```html
@if (user().isAdmin) {
  @defer (on viewport) {
    <app-audit-log [userId]="user().id" />
  } @placeholder {
    <div class="audit-placeholder">Audit log</div>
  }
}
```

**★ Symptom: a script or lint rule that greps emitted output for `ɵɵelement` misses half the components after an upgrade.** Cause: the table holds parallel families. `ɵɵelement` / `ɵɵelementStart` / `ɵɵelementEnd` sit beside `ɵɵdomElement` / `ɵɵdomElementStart` / `ɵɵdomElementEnd`, and `ɵɵproperty` beside `ɵɵdomProperty`; which one the compiler picks is an internal decision that can change between versions, and the table itself grows every release. Any tool matching instruction names is matching a private, versioned surface. Fix: do not build tooling on emitted output. If you need a component's metadata, `reflectComponentType` is the public, supported question:

```ts
import {reflectComponentType} from '@angular/core';
import {DataTable} from './data-table';

const meta = reflectComponentType(DataTable);
if (meta !== null) {
  // Supported, and stable across the versions this API is published in.
  console.log(meta.selector, meta.inputs, meta.outputs, meta.isStandalone);
}
```

**Symptom: you imported an instruction directly — `ɵɵproperty`, `ɵɵelementStart` — to build something dynamic by hand.** Cause: the `ɵ` prefix marks a private export, and everything in [07c](07c-how-instructions-address-the-array.md) and [07d](07d-advance-is-relative-and-forward-only.md) applies to it: the instruction reads implicit cursors from global state, expects a slot the compiler allocated, and asserts against a `TView` you do not have. Calling one from outside an emitted template function is not a supported thing to do. Fix: everything dynamic goes through the public creation APIs, which start from a compiled class:

```ts
import {Component, ViewContainerRef, viewChild} from '@angular/core';
import {ChartWidget} from './chart-widget';

@Component({
  selector: 'app-dashboard',
  template: `<ng-container #slot />`,
})
export class Dashboard {
  private readonly slot = viewChild.required('slot', {read: ViewContainerRef});

  protected addChart(series: ReadonlyArray<number>): void {
    const ref = this.slot().createComponent(ChartWidget);
    ref.setInput('series', series);
  }
}
```

## Interview questions

**★ Why does Angular emit `ɵɵtextInterpolate2` instead of a variadic `interpolate([...])`?**
Because the compiler's model of an instruction is an `ExternalReference` — a module specifier plus
an exported name — so what your emitted template function depends on is a set of *named exports*.
With a numbered family, a template interpolating two expressions names `ɵɵtextInterpolate2` and
nothing else in that family, leaving the other nine members unreachable from your application. With
one variadic entry point, every template in every application would reference the same symbol, and
that symbol would carry the loop, the array allocation and the general path with it. The source
states no rationale, so the honest framing is the consequence rather than a motive — but the
consequence is exactly what an à-la-carte instruction set needs, and it is the reason the internal
API surface looks like padding when it is a contract.

**★ `@angular/compiler` is an optional peer dependency of `@angular/core`. Why, and what breaks if it is not there?**
Because an ahead-of-time build leaves nothing for it to do: templates have already become
instruction calls and decorators have already become static fields, so the runtime that executes
them never needs the thing that produced them. Marking it `"optional": true` in
`peerDependenciesMeta` is Angular stating that in machine-readable form, and it is the single most
concrete piece of evidence for the whole tree-shaking argument — no benchmark, just a package
manifest. What breaks without it is any path that compiles at runtime rather than at build time,
which is to say JIT. The documentation's own reason for caring is that *"the compiler is roughly
half of Angular itself, so omitting it dramatically reduces the application payload"* — a phrase to
quote, never to convert into a number.

**★ Angular's AOT page lists four reasons to compile ahead of time. Which of them can you verify without running anything, and which is most often over-claimed?**
The verifiable one is the smaller download, and you verify it by reading `@angular/core`'s published
`peerDependenciesMeta` and seeing `@angular/compiler` marked optional — the runtime declaring it does
not need the compiler. The over-claimed one is "faster rendering", because people read it as
"Angular renders faster than a virtual DOM". The doc's actual claim is narrower and about startup:
the browser downloads executable code and can render immediately *"without waiting to compile the
application first"*. That is a comparison against JIT Angular, not against another framework.

**What does `noSideEffects` add that a narrow instruction set does not, and why is it needed at all?**
A narrow instruction set controls what a component's definition *refers to*; `noSideEffects` controls
whether the definition itself can be deleted. Building a `ComponentDef` runs real code at module
evaluation time — resolving directive and pipe defs, running features, computing an id — and an
optimiser is obliged to keep code with side effects. Wrapping the body in `{toString: fn}.toString()`
exploits the fact that optimisers assume `toString` is pure, so the call is marked side-effect-free
and the whole definition becomes removable when nothing references the class. The docstring adds the
condition people miss: *"It is important that the return value for the `noSideEffects` function be
assigned to something which is retained"* — which is why `ComponentDef` carries a field whose
documentation says never to read it.

---

← Prev: [08b · The selector problem and reference inversion](08b-the-selector-problem-and-reference-inversion.md) · Index: [Topic index](README.md) · Next → [08d · What the fixed shape costs](08d-what-the-fixed-shape-costs.md)
