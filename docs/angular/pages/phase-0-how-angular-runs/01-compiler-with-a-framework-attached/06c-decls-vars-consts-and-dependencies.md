---
title: "Four fields carry everything the compiler learned about your template's shape — two integers that pre-size an array, a constants pool the instruction indices point into, and a dependency list that is sometimes a function because a forward reference cannot be an array element yet"
sidebar_label: "06c · decls, vars, consts, dependencies"
sidebar_position: 6.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler/src/render3/view/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/compiler.ts) (`compileComponentFromMetadata`, `compileDeclarationList`),
> [`packages/core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts) (`ComponentDef`, `ComponentTemplate`),
> [`packages/core/src/render3/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/definition.ts),
> [`packages/core/src/render3/instructions/element.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/element.ts) (`ɵɵelementStart`).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Strip the boilerplate out of a `ɵɵdefineComponent` call and four fields are doing the interesting work.
`decls` and `vars` are bare integers the compiler counted while walking your template AST, and their doc
comments say plainly what they are for: pre-sizing an array. `consts` is a pool of literal values —
attribute arrays, local reference names — that the instruction calls address by index instead of
inlining, which is why an `ɵɵelementStart(0, 'div', 1)` has two numbers in it that mean completely
different things. And `dependencies` has **four** emit modes, only one of which produces the plain array
everyone pictures; the other three exist because a class you reference may not have been defined yet at
the moment the definition is evaluated. Each of these fields is a place where the compiler paid a cost at
build time so the runtime would not have to pay it per instance.**

## `decls` and `vars` — two counts, one purpose

Their doc comments in `packages/core/src/render3/interfaces/definition.ts` say what they are, verbatim:

> `decls` — *"The number of nodes, local refs, and pipes in this component template. Used to calculate
> the length of the component's LView array, so we can pre-fill the array and set the binding start
> index."*

> `vars` — *"The number of bindings in this component template (including pure fn bindings). Used to
> calculate the length of the component's LView array, so we can pre-fill the array and set the host
> binding start index."*

And the compiler emits them as literals, from `compileComponentFromMetadata`:

```ts
definitionMap.set('decls', o.literal(tpl.root.decls as number));
definitionMap.set('vars', o.literal(tpl.root.vars as number));
```

Two facts to take from that. They are **counted by the compiler while it walks the template AST**, not
computed at runtime — which is possible only because the template's shape is fully known before the
program runs, and is one of the concrete payoffs of the whole "template is a separate language" argument
in [chunk 01](01-the-template-is-a-separate-language.md). And both doc comments say the same thing about
what they are for: *the length of the component's LView array*.

🔴 **Why they are exactly the two region lengths of that array, and what "binding start index" means, is
[chunk 07](07-the-create-pass-and-the-update-pass.md)'s subject in full.** It is arithmetic, it explains
`ɵɵadvance`, and it does not fit here. What belongs here is only that the compiler emits them and that
they are counts of *slots*, not of elements: a local reference and a pipe each consume a `decls` slot,
and a "pure function binding" consumes `vars` slots you did not write.

## `consts` — the pool the instruction indices point into

Instruction calls do not inline their attribute data. They take an index into a per-component constants
array, and `ɵɵelementStart`'s docstring in `packages/core/src/render3/instructions/element.ts` spells out
the encoding, verbatim:

> *"@param index Index of the element in the LView array. @param name Name of the DOM Node.
> @param attrsIndex Index of the element's attributes in the `consts` array. @param localRefsIndex
> Index of the element's local references in the `consts` array."*

> *"Attributes and localRefs are passed as an array of strings where elements with an even index hold an
> attribute name and elements with an odd index hold an attribute value, ex.:
> `['id', 'warning5', 'class', 'alert']`"*

So in a call of the form `ɵɵelementStart(0, 'div', 1)`, the `0` is an **LView slot** and the `1` is a
**`consts` index** — two numbers, two entirely different address spaces, in one call. Reading emitted
output without knowing that is how people conclude the indices are inconsistent.

The compiler emits `consts` in one of two shapes, verbatim:

```ts
if (tpl.consts.length > 0) {
  if (tpl.constsInitializers.length > 0) {
    definitionMap.set(
      'consts',
      o.arrowFn([], [...tpl.constsInitializers, new o.ReturnStatement(o.literalArr(tpl.consts))]),
    );
  } else {
    definitionMap.set('consts', o.literalArr(tpl.consts));
  }
}
```

A plain array when the constants are self-contained; an **arrow function** when some of them need
statements to run first — the `constsInitializers`. That is why the runtime type is a union, and the
field's own doc comment names it: `consts: TConstantsOrFactory | null` — *"Constants associated with the
component's view."*

Note also the outer guard: `if (tpl.consts.length > 0)`. A template with no constants emits **no `consts`
key at all**, and `ɵɵdefineComponent` defaults it with `componentDefinition.consts || null`.

## `dependencies` — four emit modes, and only one is an array

The compiler chooses between two top-level shapes, verbatim from `compileComponentFromMetadata`:

```ts
if (
  meta.declarationListEmitMode !== DeclarationListEmitMode.RuntimeResolved &&
  meta.declarations.length > 0
) {
  definitionMap.set(
    'dependencies',
    compileDeclarationList(
      o.literalArr(meta.declarations.map((decl) => decl.type)),
      meta.declarationListEmitMode,
    ),
  );
} else if (meta.declarationListEmitMode === DeclarationListEmitMode.RuntimeResolved) {
  const args = [meta.type.value];
  if (meta.rawImports) {
    args.push(meta.rawImports);
  }
  definitionMap.set('dependencies', o.importExpr(R3.getComponentDepsFactory).callFn(args));
}
```

and `compileDeclarationList` documents its four modes inline. These comments are the clearest statement
anywhere of why `dependencies` is sometimes a function, verbatim:

```ts
case DeclarationListEmitMode.Direct:
  // directives: [MyDir],
  return list;
case DeclarationListEmitMode.Closure:
  // directives: function () { return [MyDir]; }
  return o.arrowFn([], list);
case DeclarationListEmitMode.ClosureResolved:
  // directives: function () { return [MyDir].map(ng.resolveForwardRef); }
  const resolvedList = list.prop('map').callFn([o.importExpr(R3.resolveForwardRef)]);
  return o.arrowFn([], resolvedList);
case DeclarationListEmitMode.RuntimeResolved:
  throw new Error(`Unsupported with an array of pre-resolved dependencies`);
```

| Mode | Emits | Why |
|---|---|---|
| `Direct` | `[MyDir]` | Every dependency is already defined when the definition is evaluated |
| `Closure` | `() => [MyDir]` | A dependency is defined *later* in the module; deferring the array literal until first call fixes the evaluation order |
| `ClosureResolved` | `() => [MyDir].map(resolveForwardRef)` | Same, plus at least one entry is a `forwardRef` wrapper that has to be unwrapped |
| `RuntimeResolved` | a call to the helper the compiler names `R3.getComponentDepsFactory`, passed the component type and the raw `imports` | The dependency list cannot be resolved at build time at all, so the runtime computes it |

The runtime side mirrors this. `ComponentDef.directiveDefs`' doc comment, verbatim:

> *"Registry of directives and components that may be found in this view. The property is either an array
> of `DirectiveDef`s or a function which returns the array of `DirectiveDef`s. The function is necessary
> to be able to support forward declarations."*

and `dependencies` itself: *"Unfiltered list of all dependencies of a component, or `null` if none."*

### The standalone guard, and what it drops

`ɵɵdefineComponent` copies `dependencies` conditionally, verbatim:

```ts
dependencies: (baseDef.standalone && componentDefinition.dependencies) || null,
```

🔴 **A non-standalone component's `dependencies` are dropped on the floor at runtime.** That is correct
rather than lossy: a declared component's directives and pipes come from its `NgModule`'s compilation
scope, not from its own list ([topic 02 · 04d](../02-standalone-by-default/04d-the-ambient-ngmodule-scope-it-replaced.md)),
and the compiler already refuses an `imports` array on a non-standalone component at build time
([topic 02 · 05d](../02-standalone-by-default/05d-the-errors-that-reject-an-import-outright.md)). The
runtime guard is what catches the JIT path, where no such diagnostic ran.

## Gotchas

**★ Symptom: you are reading emitted output and `dependencies` is a function rather than the array you expected.** Cause: one of the three non-`Direct` emit modes. `Closure` defers the array because a dependency is defined later in the same file; `ClosureResolved` additionally maps `resolveForwardRef` over it; `RuntimeResolved` replaces the whole thing with a call to a runtime helper. None of them is an error. Fix: nothing — but if you were reaching for `forwardRef` to work around a *cross-file* import cycle, that is a different problem with its own diagnostic, and **17 · Consequences you actually hit** *(not written yet)* owns NG3003:

```ts
// src/app/tree/tree-node.ts — a same-file forward reference, which the compiler handles
import {Component, forwardRef} from '@angular/core';
import {TreeBranch} from './tree-branch';

@Component({
  selector: 'app-tree-node',
  imports: [forwardRef(() => TreeBranch)],
  template: `<app-tree-branch />`,
})
export class TreeNode {}
```

**★ Symptom: a component created through `TestBed` or another JIT path ignores its `imports` array.** Cause: `dependencies: (baseDef.standalone && componentDefinition.dependencies) || null` — if the definition is not standalone, the list is discarded and the component's directives are expected to come from a module scope instead. In an AOT build the compiler would have rejected `imports` on a non-standalone component first; JIT has no such gate. Fix: make the class standalone, which is the default from v19 onward, and delete any `standalone: false`:

```ts
// src/app/reports/report-row.ts
import {Component} from '@angular/core';
import {DecimalPipe} from '@angular/common';

@Component({
  selector: 'app-report-row',
  imports: [DecimalPipe],
  template: `<td>{{ amount | number: '1.2-2' }}</td>`,
})
export class ReportRow {
  amount = 0;
}
```

**★ Symptom: you indexed into a component's `consts` array with the number from an `ɵɵelementStart` call and got a plain string where you expected an attribute map.** Cause: two different address spaces in one call. `ɵɵelementStart(index, name, attrsIndex, localRefsIndex)` — the first number is an **LView slot**, the later ones are **`consts` indices** — and the entry you land on is a flat array where *"elements with an even index hold an attribute name and elements with an odd index hold an attribute value"*. Fix: read the docstring's parameter list before decoding a call, and do not build tooling on it — the definition's shape is explicitly not stable across versions:

```ts
// src/app/tooling/describe-component.ts — the supported way to ask about a component
import {reflectComponentType, Type} from '@angular/core';

export function describeOutputs(component: Type<unknown>): string[] {
  return reflectComponentType(component)?.outputs.map((output) => output.templateName) ?? [];
}
```

**Symptom: `consts` is emitted as an arrow function in one component and a plain array in another, with no obvious difference between them.** Cause: `if (tpl.constsInitializers.length > 0)` — when some constants need statements to run before the array can be built, the compiler emits `() => { …initializers…; return [ … ]; }` instead of a literal. That is why the runtime type is `TConstantsOrFactory` rather than an array. Fix: nothing to fix; treat both shapes as the same field and never assume the literal form.

**Symptom: your component has three elements in the template and `decls` is a bigger number than you counted.** Cause: `decls` is *"the number of nodes, local refs, and pipes"* — a `#ref` and a pipe each occupy a slot, and structural blocks introduce containers. `vars` counts bindings *"including pure fn bindings"*, which are slots the compiler allocates for expression caching that you never wrote. Fix: nothing to fix, but do not use either number as a template-complexity metric; what they measure is array length, and [chunk 07](07-the-create-pass-and-the-update-pass.md) is where that becomes arithmetic you can follow.

## Interview questions

**★ Why is `dependencies` sometimes a function rather than an array?**
Because a class you reference may not exist yet at the moment the definition object is evaluated. `ɵcmp` is a static field initialiser, so it runs when the module is first evaluated — and if a dependency is declared further down the same file, an array literal would capture `undefined`. `compileDeclarationList` has four modes for this, and its own comments spell them out: `Direct` emits `[MyDir]`, `Closure` emits `function () { return [MyDir]; }` to defer evaluation to first use, `ClosureResolved` additionally maps `resolveForwardRef` over the list for entries wrapped in `forwardRef`, and `RuntimeResolved` gives up on build-time resolution entirely and emits a call to a runtime helper. The runtime documents the same duality on `directiveDefs`: *"either an array of `DirectiveDef`s or a function which returns the array … necessary to be able to support forward declarations."*

**★ What happens to `dependencies` on a non-standalone component?**
It is discarded. `ɵɵdefineComponent` copies it as `dependencies: (baseDef.standalone && componentDefinition.dependencies) || null`, so a definition that is not standalone gets `null` regardless of what was passed. That is correct, not lossy: a declared component's directives and pipes come from the compilation scope of the `NgModule` that declared it, which is computed separately, so its own list would be meaningless. In an AOT build the compiler rejects an `imports` array on a non-standalone component before you ever reach the runtime; the guard exists for JIT-created definitions, where no diagnostic ran.

**★ Why does the compiler count `decls` and `vars` at build time instead of letting the runtime count them?**
Because it can, and counting at runtime would cost a pass per component class. The compiler has already walked the template AST — it knows exactly how many node slots, local refs and pipes the template has, and exactly how many bindings, including the pure-function binding slots it allocated itself. Both doc comments say what the numbers are for: *"to calculate the length of the component's LView array, so we can pre-fill the array."* A runtime that did not know them would have to grow the array as it discovered nodes, which is precisely the per-instance cost the compile-time design exists to avoid. Why they are *exactly* the two region lengths is [chunk 07](07-the-create-pass-and-the-update-pass.md).

**Why do instruction calls take indices into a `consts` array instead of inlining the attribute data?**
Because the data is per *class* and the instruction runs per *instance*, per *pass*. An element's static attributes never change, so hoisting them into one array on the definition means they exist once in the bundle and once in memory, and the instruction call is three small integers instead of a nested array literal. It also keeps the template function's body uniform, which matters because that body is the hot path. The cost is legibility: `ɵɵelementStart(0, 'div', 1)` mixes an LView slot and a `consts` index in one call, and the docstring's parameter list is the only thing that tells them apart.

**A component's emitted definition has no `consts` key at all. Is something wrong?**
No — the compiler guards the emission with `if (tpl.consts.length > 0)`, so a template with no static attributes and no local references simply does not get the field, and `ɵɵdefineComponent` fills it in with `componentDefinition.consts || null`. That is the same omit-rather-than-default pattern as `selectors` and `encapsulation`, and it is why comparing two components' definitions key by key tells you very little. Anything that needs to reason about a component's metadata should use `reflectComponentType`, which is public and stable, rather than the definition object, whose header says the shape *"can change between versions."*

---

← Prev: [Inside `ɵɵdefineComponent`](06b-inside-definecomponent.md) · Index: [Topic index](README.md) · Next → [The `ɵfac` and the `.d.ts` declaration](06d-the-factory-and-the-d-ts-declaration.md)
