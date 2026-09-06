---
title: "`ɵɵdefineComponent` is a normaliser wrapped in a `toString` trick — it turns the compiler's definition object into a different type, computes four fields the compiler never emitted, and does all of it inside six lines whose only purpose is to let a bundler delete the result"
sidebar_label: "06b · Inside ɵɵdefineComponent"
sidebar_position: 6.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/core/src/render3/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/definition.ts),
> [`packages/core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts),
> [`packages/core/src/util/closure.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/closure.ts),
> [`packages/core/src/change_detection/constants.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/constants.ts),
> and the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[06](06-what-the-compiler-emits.md) showed what the compiler writes into the `ɵɵdefineComponent` call.
This page is the other end of that call, and the important thing about it is that the object going in and
the object coming out are **different types**. `ComponentDefinition<T>` is what the compiler emits;
`ComponentDef<T>` is what the runtime uses, and the function in between defaults roughly a dozen fields,
computes four that were never emitted at all — `onPush`, `directiveDefs`, `pipeDefs` and `id` — and
returns a `Writable<ComponentDef<T>>` it has finished mutating. One of those computed fields is a v22
breaking change hiding in an initialiser: `onPush` is now true unless you opted out, and the enum member
called `Default` is the opt-out. And the whole body sits inside `noSideEffects`, six lines exploiting the
fact that every minifier hard-codes `toString` as pure — which is the entire reason an unreferenced
component can be deleted from your bundle.**

## The function, in full

`packages/core/src/render3/definition.ts`, verbatim:

```ts
export function ɵɵdefineComponent<T>(
  componentDefinition: ComponentDefinition<T>,
): ComponentDef<any> {
  return noSideEffects(() => {
    // Initialize ngDevMode. This must be the first statement in ɵɵdefineComponent.
    // See the `initNgDevMode` docstring for more information.
    (typeof ngDevMode === 'undefined' || ngDevMode) && initNgDevMode();

    const baseDef = getNgDirectiveDef(componentDefinition as DirectiveDefinition<T>);
    const def: Writable<ComponentDef<T>> = {
      ...baseDef,
      decls: componentDefinition.decls,
      vars: componentDefinition.vars,
      template: componentDefinition.template,
      consts: componentDefinition.consts || null,
      ngContentSelectors: componentDefinition.ngContentSelectors,
      onPush: componentDefinition.changeDetection !== ChangeDetectionStrategy.Eager,
      directiveDefs: null!, // assigned in noSideEffects
      pipeDefs: null!, // assigned in noSideEffects
      dependencies: (baseDef.standalone && componentDefinition.dependencies) || null,
      getStandaloneInjector: baseDef.standalone
        ? (parentInjector: EnvironmentInjector) => {
            return parentInjector.get(StandaloneService).getOrCreateStandaloneInjector(def);
          }
        : null,
      getExternalStyles: null,
      signals: componentDefinition.signals ?? false,
      data: componentDefinition.data || {},
      encapsulation: componentDefinition.encapsulation || ViewEncapsulation.Emulated,
      styles: componentDefinition.styles || EMPTY_ARRAY,
      _: null,
      schemas: componentDefinition.schemas || null,
      tView: null,
      id: '',
    };
    // …
    initFeatures(def);
    const dependencies = componentDefinition.dependencies;
    def.directiveDefs = extractDefListOrFactory(dependencies, extractDirectiveDef);
    def.pipeDefs = extractDefListOrFactory(dependencies, getPipeDef);
    def.id = getComponentId(def);

    return def;
  });
}
```

Read it as four groups. **Copied straight through:** `decls`, `vars`, `template`, `ngContentSelectors`.
**Defaulted:** `consts`, `data`, `encapsulation`, `styles`, `schemas`, `signals` — each with an `||` or a
`??`, which is why [06](06-what-the-compiler-emits.md)'s omitted keys cost nothing. **Computed:**
`onPush`, `directiveDefs`, `pipeDefs`, `id`. **Placeholders the runtime fills later:** `tView: null`
and `_: null`.

## `onPush` is a v22 breaking change hiding in a field initialiser

```ts
onPush: componentDefinition.changeDetection !== ChangeDetectionStrategy.Eager,
```

The enum is where the trap is. `packages/core/src/change_detection/constants.ts`, verbatim:

```ts
export enum ChangeDetectionStrategy {
  OnPush = 0,   // "NOTE: OnPush is enabled by default."
  Eager = 1,
  /**
   * This value is equivalent to setting `Eager` and is due to be removed.
   * @deprecated Use `Eager` instead.
   */
  Default = 1,
}
```

`Default` and `Eager` are **both `1`**. So an *omitted* `changeDetection` is not `Eager` and therefore
yields `onPush: true`, while an explicit `ChangeDetectionStrategy.Default` yields `onPush: false` — the
member named "Default" is the opt-*out* from the default. The v22.0.0 CHANGELOG states it, verbatim:

> *"Component with undefined `changeDetection` property are now `OnPush` by default. Specify
> `changeDetection: ChangeDetectionStrategy.Eager` to keep the previous behavior."*

with the accompanying feature line *"Set default Component changeDetection strategy to OnPush"*.

## `noSideEffects` — the whole tree-shaking trick, in six lines

`packages/core/src/util/closure.ts`, verbatim including the doc comment:

```ts
/**
 * Convince closure compiler that the wrapped function has no side-effects.
 *
 * Closure compiler always assumes that `toString` has no side-effects. We use this quirk to
 * allow us to execute a function but have closure compiler mark the call as no-side-effects.
 * It is important that the return value for the `noSideEffects` function be assigned
 * to something which is retained otherwise the call to `noSideEffects` will be removed by closure
 * compiler.
 */
export function noSideEffects<T>(fn: () => T): T {
  return {toString: fn}.toString() as unknown as T;
}
```

Read what it is doing. Building a `ComponentDef` is real work — it resolves directive and pipe defs, runs
`initFeatures`, computes an id. A static initialiser that does real work is, to an optimiser, a side
effect, and code with side effects cannot be removed. `{toString: fn}.toString()` runs `fn`, but a
minifier's built-in knowledge says `toString` is pure, so the call is treated as side-effect-free and a
`ɵcmp` nobody references becomes dead code.

That is also why `ComponentDef` carries a field whose doc comment tells you never to read it — the
`_?: unknown` slot, verbatim:

> *"Used to store the result of `noSideEffects` function so that it is not removed by closure compiler.
> The property should never be read."*

The trick only works if the return value is *retained*, which the docstring says explicitly, and `_` is
where it is retained.

## The two placeholders, and what fills them

`tView: null` is filled on the component's first run. Its field doc comment, verbatim:

> *"Ivy runtime uses this place to store the computed tView for the component. This gets filled on the
> first run of component."*

That is the definition's one piece of mutable, per-class runtime state: the `TView` is computed once from
`decls`, `vars` and the template function and shared by every instance thereafter, which is the
arithmetic [chunk 07](07-the-create-pass-and-the-update-pass.md) unpacks.

`id: ''` is replaced immediately by `def.id = getComponentId(def)`, and the field's doc comment says what
it is for, verbatim:

> *"Unique ID for the component. Used in view encapsulation and to keep track of the injector in
> standalone components."*

The second half of that sentence pairs with `getStandaloneInjector`, which is set to a real function only
when `baseDef.standalone` is true and to `null` otherwise. A standalone component carries its own hook
into `StandaloneService` for building the injector its `imports` array implies; a non-standalone one has
nothing to build, because its dependencies come from an `NgModule` scope
([topic 02 · 04d](../02-standalone-by-default/04d-the-ambient-ngmodule-scope-it-replaced.md)).

## Gotchas

**★ Symptom: you set `changeDetection: ChangeDetectionStrategy.Default` after upgrading to v22, expecting "the framework default", and the component now re-checks on every tick.** Cause: `Default` and `Eager` are both `1` in the enum, and `onPush` is computed as `changeDetection !== ChangeDetectionStrategy.Eager`. So `Default` is the **opt-out** from `OnPush`, and it is marked *"@deprecated Use `Eager` instead"*. Fix: delete the field to get the v22 default, or name `Eager` explicitly if you genuinely want the old behaviour, with a comment saying why:

```ts
// src/app/dashboard/live-ticker.ts
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
  selector: 'app-live-ticker',
  // Deliberately opts OUT of the v22 OnPush default: driven by a third-party library
  // that mutates its inputs in place rather than replacing them.
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<span>{{ price }}</span>`,
})
export class LiveTicker {
  price = 0;
}
```

**★ Symptom: you hand-wrote a `ɵɵdefineComponent` call for a test harness or a micro-benchmark, and the object you got back is missing fields you passed or has fields you did not.** Cause: the input type `ComponentDefinition<T>` and the output type `ComponentDef<T>` are different shapes. The function defaults about six fields, computes `onPush`, `directiveDefs`, `pipeDefs` and `id`, and leaves `tView` and `_` as placeholders — and the interface header says outright *"never create the object directly since the shape of this object can change between versions."* Fix: do not hand-write definitions. If you need a component built at runtime, compile a real class and let the compiler do it:

```ts
// src/app/testing/make-host.ts
import {Component, Type} from '@angular/core';

export function makeHost(template: string, imports: Type<unknown>[]): Type<unknown> {
  @Component({selector: 'test-host', template, imports})
  class TestHost {}
  return TestHost;
}
```

**★ Symptom: a component you deleted every usage of is still in the production bundle.** Cause: `noSideEffects` makes the *definition* droppable, but only if nothing retains the class. Something still names it — a barrel re-export, a route table entry, a `declarations` array in a module that survived, a `providers` entry, or a value import used only for a type. Fix: tree-shaking is a reachability question and the trick does not change that; delete the last reference. The docstring makes the same point from the other side: *"It is important that the return value for the `noSideEffects` function be assigned to something which is retained otherwise the call to `noSideEffects` will be removed."*

```ts
// src/app/reports/index.ts — a barrel is a reference; deleting the component is not enough
export {ReportList} from './report-list';
export {provideReporting} from './reporting.providers';
```

**Symptom: you read `SomeComponent.ɵcmp.tView` in a debugger before the component has ever rendered and it is `null`.** Cause: it is initialised to `null` in the definition literal and, per its own doc comment, *"gets filled on the first run of component."* The `TView` is derived state, computed once per class from `decls`, `vars` and the template function. Fix: nothing to fix in the framework, but nothing outside `@angular/core` should be reading it. If you want per-component information at runtime, use the public reflection API:

```ts
// src/app/tooling/describe-component.ts
import {reflectComponentType, Type} from '@angular/core';

export function describeInputs(component: Type<unknown>): string[] {
  return reflectComponentType(component)?.inputs.map((input) => input.propName) ?? [];
}
```

**Symptom: a dynamically created non-standalone component cannot resolve the directives its template uses.** Cause: `getStandaloneInjector` is a real function only when `baseDef.standalone` is true; for a non-standalone component the field is `null`, because there is no `imports` array to build an injector from — its dependencies come from whichever `NgModule` declared it. Fix: make the component standalone, which is the v19+ default anyway, and let its own `imports` array carry its dependencies:

```ts
// src/app/reports/report-detail.ts
import {Component} from '@angular/core';
import {DatePipe} from '@angular/common';

@Component({
  selector: 'app-report-detail',
  imports: [DatePipe],
  template: `<time>{{ generatedAt | date: 'medium' }}</time>`,
})
export class ReportDetail {
  generatedAt = new Date();
}
```

## Interview questions

**★ Why is the entire body of `ɵɵdefineComponent` wrapped in `noSideEffects(() => …)`, and how does a six-line function change anything?**
Because building the definition is real work — resolving directive and pipe defs, running `initFeatures`, computing an id — and a static initialiser that does real work cannot be removed by an optimiser, since removing it might change behaviour. `noSideEffects` is `return {toString: fn}.toString()`: it calls `fn`, but minifiers hard-code the knowledge that `toString` is pure, so the call is treated as side-effect-free and the whole definition becomes droppable when nothing references the class. The docstring adds the necessary condition — the return value must be *retained*, which is what the `ComponentDef._` field is for, and whose own doc comment says *"The property should never be read."*

**★ In v22, what is the difference between `ChangeDetectionStrategy.Default` and omitting `changeDetection` entirely?**
They are opposites, which is the trap. Omitting the field gives you `OnPush`, because `ɵɵdefineComponent` computes `onPush: componentDefinition.changeDetection !== ChangeDetectionStrategy.Eager` and an undefined value is not `Eager`. Writing `ChangeDetectionStrategy.Default` gives you the *eager* strategy, because `Default` and `Eager` are both `1` in the enum and `Default` is the deprecated alias, marked *"@deprecated Use `Eager` instead"*. So a member named `Default` is now the opt-out, and the v22.0.0 CHANGELOG confirms it: *"Component with undefined `changeDetection` property are now `OnPush` by default."*

**★ Why does `ɵɵdefineComponent` take one type and return another, rather than just returning what it was given?**
Because the compiler's output and the runtime's input are different problems. `ComponentDefinition<T>` is optimised for emission — fields are omitted when they would hold a default, so a component with no constants emits no `consts` key at all. `ComponentDef<T>` is optimised for the render loop, where a missing key would mean a property check on every access, so every field is present and defaulted. On top of that the function computes four fields the compiler never emitted: `onPush` from `changeDetection`, `directiveDefs` and `pipeDefs` from `dependencies`, and `id` from the whole definition. Returning the input would push all of that work into the hot path.

**What is the `_` field on `ComponentDef` for, and why does its doc comment forbid reading it?**
It exists purely to retain the return value of `noSideEffects`. The trick depends on the result being assigned to something the optimiser considers live; an unassigned call would be deleted along with everything it was protecting. So `_` is the anchor, holding a value that has no meaning — and the doc comment says *"Used to store the result of `noSideEffects` function so that it is not removed by closure compiler. The property should never be read."* Reading it would give you the definition object itself, circularly, which is not information; the field is scaffolding for the minifier, not API.

**`tView` is `null` in the emitted definition. What fills it, when, and why is it on the definition rather than on each instance?**
The runtime fills it on the component's first render — *"Ivy runtime uses this place to store the computed tView for the component. This gets filled on the first run of component."* It lives on the definition, which is per *class*, because everything in it is derived from things that are per class: the template function, `decls`, `vars`, the constants array. Two thousand instances of a component share one `TView` and differ only in their `LView` arrays. That split — static structure computed once, per-instance data in a plain array — is the arithmetic [chunk 07](07-the-create-pass-and-the-update-pass.md) is built on.

---

← Prev: [What the compiler emits: `ɵcmp`](06-what-the-compiler-emits.md) · Index: [Topic index](README.md) · Next → [`decls`, `vars`, `consts` and `dependencies`](06c-decls-vars-consts-and-dependencies.md)
