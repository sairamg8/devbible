---
title: "A bundler sees a static `import` and must assume you need it; the compiler has already read your template, knows the dependency is reachable only from inside a `@defer` block, and rewrites that import into a dynamic one before the bundler ever runs"
sidebar_label: "11 · Why `@defer` can split a bundle no bundler could"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer) — and `angular/angular` at tag `v22.1.5`: [`packages/compiler/src/render3/view/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/compiler.ts), [`packages/core/src/defer/interfaces.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/defer/interfaces.ts), [`packages/core/src/defer/instructions.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/defer/instructions.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A bundler is a program that reads JavaScript. It sees `import {HeavyChart} from './heavy-chart';`
at the top of your component file and draws the only honest conclusion available to it: this
module is needed wherever that module is needed. It cannot consult your template, because your
template is a string in a decorator argument written in a language the bundler does not parse —
and even if it did parse it, it would have to prove that `<heavy-chart />` is unreachable until a
trigger fires. The Angular compiler has already done both jobs. It parsed the template into an
AST, matched every element against the component's `imports` array, and therefore knows which of
those classes are reachable *only* from inside a `@defer` block. So it deletes the static import
and emits `import('./heavy-chart')` in its place, wrapped in a function it hands to the runtime.
The chunk boundary is not something the bundler discovered. It is something the compiler told it.**

This chunk is about that hand-off: the exact function the compiler generates, the type the runtime
expects back, and why the same mechanism means a heavy `@placeholder` costs you every byte you
thought you had deferred. The conditions a dependency must satisfy to earn the dynamic import —
and the barrel-file trap that silently revokes it — are the subject of
**11b** *(not written yet)*.

## The information a bundler does not have

Here is the whole input. Nothing is elided; this compiles as written.

```ts
import {Component} from '@angular/core';
import {HeavyChart} from './heavy-chart';

@Component({
  selector: 'app-dashboard',
  imports: [HeavyChart],
  template: `
    <h1>Quarterly sales</h1>
    @defer (on viewport) {
      <heavy-chart [series]="series" />
    } @placeholder {
      <div class="chart-skeleton" aria-hidden="true"></div>
    }
  `,
})
export class Dashboard {
  protected readonly series: readonly number[] = [12, 40, 7, 33];
}
```

Three facts are needed to turn that static import into a dynamic one, and the compiler holds all
three while a bundler holds none of them:

1. **`heavy-chart` in the template is the class `HeavyChart`.** Selector matching is a compiler
   step — it needs the parsed template AST from [chunk 01](01-the-template-is-a-separate-language.md)
   *and* the resolved `imports` array. To a bundler the template is an opaque string literal.
2. **That match happens inside a `@defer` block.** `@defer` is Angular template grammar, not
   JavaScript; a JavaScript parser sees a backtick string containing an at-sign.
3. **`HeavyChart` is referenced nowhere else in the file.** Only after (1) and (2) does this
   third fact become interesting, and it is the one that most often fails silently — see
   **11b** *(not written yet)*.

The guide states the outcome plainly:

> *"The code for any components, directives, and pipes inside the `@defer` block is split into a
> separate JavaScript file and loaded only when necessary, after the rest of the template has been
> rendered."*

and names the mechanism:

> *"Angular's compiler produces a dynamic import statement for each component, directive, and pipe
> used in the `@defer` block. The main content of the block renders after all the imports resolve.
> Angular does not guarantee any particular order for these imports."*

**"A dynamic import statement for each" is the sentence to hold on to.** It is not one import per
block; it is one per dependency, all inside one generated function.

## The function the compiler generates

`packages/compiler/src/render3/view/compiler.ts` at `v22.1.5`, `compileDeferResolverFunction` —
the `PerBlock` branch verbatim. (The `else` branch below it, for `PerComponent` mode, has the same
shape with no `isDeferrable` check; both are covered in **11b** *(not written yet)*.)

```ts
export function compileDeferResolverFunction(
  meta: R3DeferResolverFunctionMetadata,
): o.ArrowFunctionExpr {
  const depExpressions: o.Expression[] = [];

  if (meta.mode === DeferBlockDepsEmitMode.PerBlock) {
    for (const dep of meta.dependencies) {
      if (dep.isDeferrable) {
        // Callback function, e.g. `m () => m.MyCmp;`.
        const innerFn = o.arrowFn(
          // Default imports are always accessed through the `default` property.
          [new o.FnParam('m', o.DYNAMIC_TYPE)],
          o.variable('m').prop(dep.isDefaultImport ? 'default' : dep.symbolName),
        );

        // Dynamic import, e.g. `import('./a').then(...)`.
        const importExpr = new o.DynamicImportExpr(dep.importPath!)
          .prop('then')
          .callFn([innerFn], undefined, undefined, [
            // Necessary, because we might not generate extensions for the path
            // and TS may try to enforce it based on the compiler options.
            tsIgnoreComment(),
          ]);
        depExpressions.push(importExpr);
      } else {
        // Non-deferrable symbol, just use a reference to the type. Note that it's important to
        // go through `typeReference`, rather than `symbolName` in order to preserve the
        // original reference within the source file.
        depExpressions.push(dep.typeReference);
      }
    }
  }

  return o.arrowFn([], o.literalArr(depExpressions));
}
```

`o.arrowFn`, `o.DynamicImportExpr` and `o.literalArr` are output-AST builders, so the function
above does not produce text — it produces a tree that the emitter prints. The printed shape, for
the `Dashboard` component above, is a zero-argument arrow returning an array literal:

```js
// ILLUSTRATIVE — the shape the builders above print, not a byte-exact dump of your build output
() => [import('./heavy-chart').then((m) => m.HeavyChart)]
```

That expression is passed as the third argument of the `ɵɵdefer` instruction in the component's
generated template function. `packages/core/src/defer/instructions.ts` documents that parameter
verbatim:

> *"@param dependencyResolverFn Function that contains dependencies for this defer block."*

**Read the emitted arrow twice, because two separate tricks are packed into it.** The
`import('./heavy-chart')` is a *syntactic* dynamic import with a string-literal specifier, which is
exactly the form every bundler recognises as a code-split point. The `.then((m) => m.HeavyChart)`
narrows the resolved module namespace object down to the one export the runtime wants, so the
runtime never has to guess a symbol name. `isDefaultImport` picks `m.default` instead — Angular
supports `export default class HeavyChart` and stores that flag through to emit.

## The failure mode is in the `else` branch

The `else` in `compileDeferResolverFunction` is the single most useful thing on this page:

```ts
} else {
  // Non-deferrable symbol, just use a reference to the type. Note that it's important to
  // go through `typeReference`, rather than `symbolName` in order to preserve the
  // original reference within the source file.
  depExpressions.push(dep.typeReference);
}
```

🔴 **When a dependency fails to qualify, the compiler does not warn, does not error, and does not
remove your `@defer` block.** It emits the class reference itself as an array entry, alongside the
dynamic imports of the dependencies that did qualify:

```js
// ILLUSTRATIVE — one dependency deferred, one silently not
() => [import('./heavy-chart').then((m) => m.HeavyChart), TinyBadge]
```

The block still renders. The triggers still fire. Everything works, and `TinyBadge` — plus its
transitive dependency graph — sits in the eager bundle. There is no build-time signal at all. This
is why "my `@defer` isn't producing a chunk" is a *bundle-inspection* question rather than an
error-message question, and why **11b** *(not written yet)* exists.

## The runtime contract admits the failure in its type

`packages/core/src/defer/interfaces.ts`, verbatim:

```ts
/**
 * Describes the shape of a function generated by the compiler
 * to download dependencies that can be defer-loaded.
 */
export type DependencyResolverFn = () => Array<Promise<DependencyType> | DependencyType>;
```

🔴 **The `| DependencyType` arm of that union *is* the un-deferred case, written into the public
type.** The runtime is built to receive a mixed array: some entries are promises it must await
before rendering the primary block, and some are classes that are simply already here. Angular did
not bolt a fallback on after the fact; the possibility of a non-deferred dependency is part of the
designed contract, which is precisely why it is silent.

## Triggers decide *when*, not *whether*

The bundling story is settled at compile time; triggers are a runtime concern. A `@defer` block
with `on immediate` still gets a `dependencyResolverFn` full of dynamic imports and still produces
a separate chunk — it just requests that chunk as soon as the surrounding view renders. That is a
genuinely useful configuration: it takes a large component out of the initial chunk without
delaying it behind an interaction. Prefetch triggers (`prefetch on idle`, `prefetch on hover`) run
the same resolver earlier and store the result; they change scheduling, not emission.

⚠️ Angular's documentation states the per-dependency dynamic import as a property of the block, not
of the trigger, and I could find no sentence in the guide that makes an exception for any trigger.
The claim above therefore follows from the emit path rather than from an explicit doc sentence —
treat it as a reading of `compileDeferResolverFunction`, which never inspects the trigger.

## Why `@placeholder`, `@loading` and `@error` ship eagerly

This surprises people, and the reason is structural rather than a policy decision. The `ɵɵdefer`
instruction takes the sub-blocks as *template slot indices*:

> *"@param primaryTmplIndex Index of the template with the primary block content."*
> *"@param loadingTmplIndex Index of the template with the loading block content."*
> *"@param placeholderTmplIndex Index of the template with the placeholder block content."*
> *"@param errorTmplIndex Index of the template with the error block content."*

Only `primaryTmplIndex` has a `dependencyResolverFn` beside it. The other three are ordinary
embedded templates living in the component's own `decls` range — the slot model of
**07 · The create pass and the update pass** *(not written yet)* — so their dependencies are
compiled exactly like any other template dependency in the file. The guide says the same thing
from the outside:

> *"Keep in mind the dependencies of the placeholder block are eagerly loaded."*

and repeats it for `@loading` and `@error`. The practical consequence is blunt: **a placeholder
built from your design-system components can cancel the entire benefit of the block it decorates.**

```html
@defer (on viewport) {
  <heavy-chart [series]="series" />
} @placeholder {
  <div class="chart-skeleton" aria-hidden="true"></div>
}
```

Plain markup and a CSS class cost nothing. `<ds-card><ds-spinner /></ds-card>` drags `DsCard` and
`DsSpinner` — and whatever they import — into the eager bundle, and does it silently, because
eager loading of a placeholder is correct behaviour rather than a mistake.

## Gotchas

**★ Symptom: the `@defer` block works perfectly, the app runs, and the component is still in the
main bundle — with no error, no warning and nothing in the build log.** Cause: the dependency
failed one of the qualification checks, so `compileDeferResolverFunction` took its `else` branch
and emitted `dep.typeReference` — a plain class reference — into the resolver array. A resolver
that returns a class instead of a promise is a *valid* `DependencyResolverFn`. Fix: there is no
compiler signal to wait for, so inspect the output. Build with a stats file and read the chunk
graph:

```bash
ng build --configuration production --stats-json
npx esbuild-visualizer --metadata dist/stats.json --open
```

Then work through the nine conditions in **11b** *(not written yet)*.

**★ Symptom: you deferred a heavy chart, the chunk splits correctly, and the initial bundle barely
shrinks.** Cause: the `@placeholder` (or `@loading`, or `@error`) is built from components, and
those are compiled as ordinary eager template dependencies of the host component. Fix: make the
non-primary blocks plain markup, and if you need a real skeleton component, defer *it* too or
accept the cost knowingly:

```html
@defer (on viewport) {
  <heavy-chart [series]="series" />
} @loading (after 100ms; minimum 300ms) {
  <div class="skeleton skeleton--chart"></div>
} @error {
  <p role="alert">The chart could not be loaded.</p>
}
```

**★ Symptom: the deferred component uses `export default` and you assume that cannot work with the
generated resolver.** Cause: the assumption, not the code — `compileDeferResolverFunction` carries
an `isDefaultImport` flag and emits `m.default` instead of `m.HeavyChart`. Fix: nothing; both
forms are supported. But prefer the named export anyway, because a default export gives the
resolver no symbol name to preserve and makes the emitted code harder to read when you are
diagnosing a failed split:

```ts
export class HeavyChart {}
```

**Symptom: two `@defer` blocks in the same component both load the same dependency and you expect
two network requests.** Cause: expecting the resolver to own the fetch. It does not — it returns
`import(...)`, and the module registry deduplicates; a second `import()` of an already-resolved
specifier yields the same module. Fix: none needed. This also means splitting one big block into
two smaller ones with different triggers does not multiply the download cost of shared
dependencies.

**Symptom: a dependency that is only ever used inside `@defer` blocks still appears in the main
bundle, and moving it to its own file did not help.** Cause: it is not a component, directive or
pipe. The resolver function is built from *template* dependencies; a service, a token, a type
guard or a plain function imported by the component class is a normal TypeScript import and
`@defer` has no opinion about it. Fix: for a service, let the injector do the splitting —
`inject()` inside the deferred component rather than the host, so the service module is reached
only through the deferred chunk.

**Symptom: `@defer` is used inside a component that is itself lazy-loaded by the router, and you
cannot tell which chunk anything landed in.** Cause: two independent splitting mechanisms are
stacked. The route boundary produces one chunk; the `@defer` resolver produces another *inside*
it. Fix: nothing is wrong — but read the chunk graph rather than the chunk list, because the
deferred chunk's parent is the route chunk, not the entry point.

## Interview questions

**★ Angular's compiler emits a dynamic import that no bundler could have inferred. What information
does the compiler have that the bundler does not?**
The parsed template and the resolved `imports` array. A bundler sees a string literal inside a
decorator argument and an ordinary static `import` at the top of the file; from that it cannot
learn that the string contains `@defer` grammar, that `<heavy-chart />` inside it matches the
class `HeavyChart`, or that no other reachable code path uses that class. The compiler establishes
all three during template compilation, and then rewrites the module graph accordingly. That is the
whole argument for compiling templates rather than running them: the dependency graph of the view
becomes a build-time artefact.

**★ `DependencyResolverFn` is typed `() => Array<Promise<DependencyType> | DependencyType>`. Why is
the non-promise arm of that union there?**
Because a dependency that fails to qualify for deferral is emitted as a plain class reference into
the same array — `compileDeferResolverFunction`'s `else` branch pushes `dep.typeReference`. The
runtime has to accept an array where some entries are already-resolved classes and some are
promises. That union is the type-level admission that "this `@defer` block did not actually defer
everything" is a supported, non-error state, which is exactly why the failure is silent.

**★ A colleague puts the app's standard loading spinner component into `@placeholder` and reports
that deferring saved nothing. What happened?**
The four sub-blocks of a `@defer` block are ordinary embedded templates identified by slot index in
the `ɵɵdefer` call; only the primary block gets a `dependencyResolverFn`. So the placeholder's
components are compiled as eager template dependencies of the host, exactly as if they were used
outside the block, and the documentation says so explicitly. If the spinner pulls in a design-system
module, that module is now in the initial bundle. The fix is plain markup in the non-primary
blocks.

**Does `@defer (on immediate)` produce a separate chunk, and if so, why would anyone use it?**
Yes — the emission of the resolver function is independent of the trigger; `compileDeferResolverFunction`
never inspects it. `on immediate` requests the chunk as soon as the surrounding view renders, so it
removes the component from the initial bundle without adding an interaction delay. It is the right
tool for something large that is definitely needed but not needed *first* — you trade a second
request for a smaller critical path.

**Why does the compiler emit `import('./a').then((m) => m.MyCmp)` rather than just `import('./a')`?**
Because the runtime needs the class, not the module namespace object, and it must not have to guess
which export to take. The `.then` callback is generated from the recorded symbol name — or
`m.default` when the source used a default export — so the resolver's array entries all have the
same element type, `Promise<DependencyType>`. It also keeps the specifier a plain string literal,
which is the form bundlers recognise as a split point; anything more dynamic would defeat the
purpose.

**Why is deferring a service different from deferring a component?**
`@defer` operates on *template* dependencies. The resolver function is built from the components,
directives and pipes the deferred template matched, so a service the host component injects is a
normal TypeScript import and stays eager no matter what the template says. Code-splitting a service
is done by moving the `inject()` call into a component that is itself deferred or lazy-routed, so
that the only path to the service's module runs through a dynamic import.

---

← Prev: [10 · Metadata errors, one by one](README.md) · Index: [Topic index](README.md) · Next → **11b · The nine conditions and the barrel trap** *(not written yet)*
