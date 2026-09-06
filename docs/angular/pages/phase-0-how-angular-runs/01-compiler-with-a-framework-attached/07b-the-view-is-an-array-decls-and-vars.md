---
title: "An Angular view is a plain JavaScript array with a 27-slot header, and `decls` and `vars` are literally the lengths of the two regions that follow it — which is also the reason the compiler can count them and cannot count directive instances"
sidebar_label: "07b · The view is an array"
sidebar_position: 7.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`core/src/render3/interfaces/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/view.ts), [`interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts), [`view/construction.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/view/construction.ts) — with angular.dev — [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler) for the compile-time framing.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The numbering that [07](07-the-create-pass-and-the-update-pass.md) said the two halves of the
template function must agree on is not an abstraction. It is an offset into a flat JavaScript
array, and `decls` and `vars` — the two bare integers sitting next to `template` in every
`ɵɵdefineComponent` call — are the lengths of two consecutive regions of that array.** Once you
can see the array, the whole shape of Ivy stops being trivia: why `ɵɵelementStart(0, 'div')`
does not mean "the first div", why the compiler pre-computes exactly two numbers and not three,
why a view can grow at runtime past the size the compiler chose, and why the one thing it
cannot size in advance is the one thing locality forbids it from knowing.

## An Angular view is an array, and the slots are addresses

`interfaces/view.ts` is blunt about it:

```ts
export interface LView<T = unknown> extends Array<any> {
```

A view is a JavaScript array. The first 27 entries are a fixed header — `HOST`, `TVIEW`,
`FLAGS`, `PARENT`, `NEXT`, `T_HOST`, `HYDRATION`, `CLEANUP`, `CONTEXT`, `INJECTOR`,
`ENVIRONMENT`, `RENDERER`, `CHILD_HEAD`, `CHILD_TAIL`, three `DECLARATION_*` slots,
`PREORDER_HOOK_FLAGS`, `QUERIES`, `ID`, `EMBEDDED_VIEW_INJECTOR`, `ON_DESTROY_HOOKS`,
`EFFECTS_TO_SCHEDULE`, `EFFECTS`, `REACTIVE_TEMPLATE_CONSUMER`,
`AFTER_RENDER_SEQUENCES_TO_ADD`, `ANIMATIONS` — and then:

```ts
/**
 * Size of LView's header. Necessary to adjust for it when setting slots.
 *
 * IMPORTANT: `HEADER_OFFSET` should only be referred to the in the `ɵɵ*` instructions to translate
 * instruction index into `LView` index. All other indexes should be in the `LView` index space and
 * there should be no need to refer to `HEADER_OFFSET` anywhere else.
 */
export const HEADER_OFFSET = 27;
```

So `ɵɵelementStart(0, 'div')` does not mean "the first div". It means **`LView[27]`**. The
index argument in every create instruction is an offset into a flat array, and `HEADER_OFFSET`
is the translation. Angular's own comment restricts that translation to the `ɵɵ*` instructions —
which is the source's way of saying that the number `27` is an implementation detail of the
instruction set and nothing outside it should hard-code it.

The constants themselves carry a comment worth noticing, because it explains why a *view* is an
array rather than an object with named fields in the first place:

```ts
// Below are constants for LView indices to help us look up LView members
// without having to remember the specific indices.
// Uglify will inline these when minifying so there shouldn't be a cost.
```

`lView[TVIEW]` costs nothing after minification, because `TVIEW` is a module-level `const` the
minifier folds to `1`. A property access on an object would survive minification as a string.

After the header the array is laid out in three regions, and `view/construction.ts` computes
the boundaries in four lines:

```ts
  const bindingStartIndex = HEADER_OFFSET + decls;
  // This length does not yet contain host bindings from child directives because at this point,
  // we don't know which directives are active on this template. As soon as a directive is matched
  // that has a host binding, we will update the blueprint with that def's hostVars count.
  const initialViewLength = bindingStartIndex + vars;
  const blueprint = createViewBlueprint(bindingStartIndex, initialViewLength);
```

and stores them on the `TView` as `bindingStartIndex` and `expandoStartIndex`:

```ts
    data: blueprint.slice().fill(null, bindingStartIndex),
    bindingStartIndex: bindingStartIndex,
    expandoStartIndex: initialViewLength,
```

## The `TView` is the blueprint; the `LView` is the copy

`TView` is described in `interfaces/view.ts` as *"The static data for an LView (shared between
all templates of a given type)"*, and the field that matters here says why it exists:

```ts
  /**
   * This is a blueprint used to generate LView instances for this TView. Copying this
   * blueprint is faster than creating a new LView from scratch.
   */
  blueprint: LView;
```

The blueprint is built once per component type and `slice()`d for every instance. Note what it
is pre-filled with:

```ts
function createViewBlueprint(bindingStartIndex: number, initialViewLength: number): LView {
  const blueprint = [];

  for (let i = 0; i < initialViewLength; i++) {
    blueprint.push(i < bindingStartIndex ? null : NO_CHANGE);
  }

  return blueprint as LView;
}
```

Declaration slots start `null`; **binding slots start as the `NO_CHANGE` sentinel**, which is
what makes every binding compare as changed on its very first update pass — see
[07e](07e-what-actually-performs-the-diff.md) for the nine lines that consume it.

The two boundary fields carry their own doc comments, and they are the compile-time/runtime
seam of the entire framework:

```ts
  /**
   * The binding start index is the index at which the data array
   * starts to store bindings only. Saving this value ensures that we
   * will begin reading bindings at the correct point in the array when
   * we are in update mode.
   *
   * -1 means that it has not been initialized.
   */
  bindingStartIndex: number;

  /**
   * The index where the "expando" section of `LView` begins. The expando
   * section contains injectors, directive instances, and host binding values.
   * Unlike the "decls" and "vars" sections of `LView`, the length of this
   * section cannot be calculated at compile-time because directives are matched
   * at runtime to preserve locality.
   *
   * We store this start index so we know where to start checking host bindings
   * in `setHostBindings`.
   */
  expandoStartIndex: number;
```

## `decls` and `vars` are exactly those two region lengths

This is the whole answer to "what are those two numbers in the def?". From
`interfaces/definition.ts`, verbatim, including the `TODO`:

```ts
  /**
   * The number of nodes, local refs, and pipes in this component template.
   *
   * Used to calculate the length of the component's LView array, so we
   * can pre-fill the array and set the binding start index.
   */
  // TODO(kara): remove queries from this count
  readonly decls: number;

  /**
   * The number of bindings in this component template (including pure fn bindings).
   *
   * Used to calculate the length of the component's LView array, so we
   * can pre-fill the array and set the host binding start index.
   */
  readonly vars: number;
```

Three things worth reading twice. **`decls` counts more than elements** — nodes, template local
references (`#ref`), pipe instances, and, per that `TODO`, queries. **`vars` counts more than
interpolations** — every binding, *including* the extra slots a pure pipe or a pure function
call needs to memoise its arguments. And both exist for exactly one purpose: sizing the array.

🔴 **Why the compiler can count these and cannot count directive instances.** The comment on
`expandoStartIndex` quoted above says it outright, and it is the single best sentence in this
topic:

> *"Unlike the "decls" and "vars" sections of `LView`, the length of this section cannot be
> calculated at compile-time because directives are matched at runtime to preserve locality."*

Node count and binding count are properties of *your* template, which the compiler has in
front of it. How many directives match `<div class="card">` depends on the `imports` of the
component *and* on the definitions of the things it imports — knowledge the compiler
deliberately refuses to require, because requiring it is exactly what locality forbids (chunk
12). So the array is sized precisely up to `expandoStartIndex` and grows past it at runtime as
directives are matched and their `hostVars` are appended.

## Gotchas

**★ Symptom: you assume one component means one flat slot array, and the numbers in the emitted
output do not add up.** Cause: every embedded view — each `@if` branch, each `@for` row, each
`<ng-template>` — is its **own** `LView` with its own `TView`, its own `decls` and `vars`, and
its own template function with its own `if (rf & 1)` / `if (rf & 2)` pair. The parent's
`decls` counts the *container*, not the contents. Fix: read nested template functions as
separate address spaces; the numbering restarts at 0 in each one. `LView`'s own doc comment
states the rule — *"Each embedded view and component view has its own `LView`."*

**★ Symptom: the array length you observe at runtime is longer than `HEADER_OFFSET + decls +
vars`.** Cause: the expando region past `expandoStartIndex` — injectors, directive instances,
host binding values — is appended as directives are matched. The `createTView` comment says it
plainly: *"This length does not yet contain host bindings from child directives because at this
point, we don't know which directives are active on this template."* Fix: none needed; treat
`initialViewLength` as a floor, not a size.

**Symptom: you add one element to a template and `decls` jumps by three.** Cause: `decls` is
*"the number of nodes, local refs, and pipes in this component template"*, plus queries per the
`TODO(kara)` still in the source. A single line of markup can contribute a node, a local
reference and a pipe instance. Fix: stop reading `decls` as an element count. If you are
diffing two builds' emitted output, diff the create block's instruction list rather than the
integer — the integer is a sum over four different kinds of thing:

```html
<!-- three decls from one line: the element, the #ref, the pipe instance -->
<img #hero [src]="url | trustedResource" alt="" />
```

**Symptom: you write a `ɵɵdefineComponent` call by hand for a test harness or a micro-benchmark
and get silent misrendering.** Cause: nothing computes `decls` and `vars` for you. They are
compile-time counts the compiler derives from the template AST, and a hand-written def with the
wrong values sizes the array wrongly — too small and instructions write past the end, too large
and the binding region starts in the wrong place. Fix: do not hand-write component definitions.
If you need a component built at runtime, use the supported API, which runs the real compiler:

```ts
import {Component, ViewContainerRef, inject} from '@angular/core';

@Component({selector: 'app-badge', template: `<span class="badge">{{ text }}</span>`})
export class Badge {
  text = 'new';
}

@Component({selector: 'app-host', template: `<div #slot></div>`})
export class Host {
  private readonly vcr = inject(ViewContainerRef);

  addBadge(): void {
    const ref = this.vcr.createComponent(Badge);
    ref.setInput('text', 'sale');
    ref.changeDetectorRef.detectChanges();
  }
}
```

## Interview questions

**★ What is `decls` counting, and why can the compiler know it when it cannot know how many
directive instances the view will hold?**
`decls` is *"the number of nodes, local refs, and pipes in this component template"* — a
property of the template text, which the compiler is looking at. Directive instances depend on
which directives match each element, which depends on the resolved definitions of everything in
`imports`, which the compiler deliberately refuses to require. Angular's own comment on
`expandoStartIndex` says the length of that region *"cannot be calculated at compile-time
because directives are matched at runtime to preserve locality."* So the array is sized exactly
up to `HEADER_OFFSET + decls + vars` and grows past it at runtime.

**★ You add a directive to a component's `imports` that matches an element already in the
template. Which of `decls`, `vars` and the runtime array length change?**
Neither `decls` nor `vars` — no node was added and no binding was added, and both are counts
over the template text, which did not change. The runtime array length does change: the
directive instance and any `hostVars` it declares are appended in the expando region past
`expandoStartIndex`. That asymmetry is the compile-time/runtime seam stated as a number. It is
also why adding a directive to `imports` cannot invalidate the emitted template function of a
component that already compiled — the thing that changed lives entirely past the region the
template function addresses.

**Why is an `LView` an array rather than an object with named fields?**
Two reasons visible in the source. The header constants are module-level `const`s and the
comment beside them says *"Uglify will inline these when minifying so there shouldn't be a
cost"* — `lView[TVIEW]` minifies to `lView[1]`, while `lView.tView` would survive as a string
property. And the declaration and binding regions are *indexed*, not named: the whole point of
the create/update numbering is that instruction `n` addresses slot `n + HEADER_OFFSET` with
integer arithmetic. An object would need a map from index to key to do the same job.

**Why does Angular copy a blueprint array instead of constructing a fresh `LView` per
instance?**
Because the source says copying is faster: the `blueprint` field's comment is *"Copying this
blueprint is faster than creating a new LView from scratch."* The blueprint is built once per
`TView` — that is, once per component type — with the declaration region pre-filled `null` and
the binding region pre-filled `NO_CHANGE`, so instantiating a view is one `slice()` rather than
a loop that has to re-decide what each slot starts as.

**A colleague says "`vars` is the number of interpolations in the template". Where does that
break down?**
On anything that needs memoisation slots. The doc comment is *"The number of bindings in this
component template (including pure fn bindings)"* — a pure pipe or a pure function call
allocates extra binding slots to hold its previous arguments so it can skip re-evaluation, and
those slots are counted in `vars` even though nothing in the template looks like an extra
interpolation. Property bindings, attribute bindings and class/style bindings are all in the
count too; interpolations are one contributor among several.

---

← Prev: [07 · The create pass and the update pass](07-the-create-pass-and-the-update-pass.md) · Index: [Topic index](README.md) · Next → [07c · Addressing the array](07c-how-instructions-address-the-array.md)
