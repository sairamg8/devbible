---
title: "Nowhere in the path from a `@Component` class to a mutated DOM node does a value exist that represents the tree — Angular deleted the vnode and kept only the annotations, in executable form, which is the far end of the spectrum Vue's own documentation describes"
sidebar_label: "08 · Instructions, not a virtual DOM"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts) — and Vue's [Rendering Mechanism](https://vuejs.org/guide/extras/rendering-mechanism.html), quoted verbatim for the contrasting design.
> Documentation-validated; **no sandbox run** — nothing was built, measured or compared, and every code block below is either source read from a named file or ordinary application code.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Chunks 06 and 07 traced the whole path from a `@Component` class to a mutated DOM node, and at no
point along it does a value exist that represents "the tree". There is no vnode, no previous render
to compare against, no reconciler walking anything. That absence is the design, not an optimisation
bolted on afterwards — and it is best understood not as "Angular is different from React" but as a
position on a spectrum that Vue's own documentation lays out: purely-runtime vnodes at one end,
compiler-informed vnodes in the middle, and Angular at the far end, having deleted the tree and kept
only the annotations as executable code. This chunk establishes what is absent and what stands in
its place. [08b](08b-the-selector-problem-and-reference-inversion.md) is the argument for why.**

## What the last five chunks left you with

Read back what the pipeline actually produces, because the shape of the argument is already visible
in it:

- a **static field** `ɵcmp` bolted onto your class, holding a template function
  ([06](06-what-the-compiler-emits.md), [06b](06b-inside-definecomponent.md));
- **two integers**, `decls` and `vars`, that are literally the lengths of two regions of an array
  ([06c](06c-decls-vars-consts-and-dependencies.md), [07b](07b-the-view-is-an-array-decls-and-vars.md));
- **one function called twice**, with `RenderFlags.Create` and then `RenderFlags.Update`
  ([07](07-the-create-pass-and-the-update-pass.md));
- update instructions that carry **no index at all**, riding two cursors held in global state
  ([07c](07c-how-instructions-address-the-array.md), [07d](07d-advance-is-relative-and-forward-only.md));
- and a diff that is **`Object.is` against one array slot** ([07e](07e-what-actually-performs-the-diff.md)).

Nothing in that list is a tree. `LView` is a flat array of slots, `TView` is the shared blueprint for
that array, and the only tree in the system is the real DOM. The central data structure of a
virtual-DOM framework — the thing your render function *returns* — has no counterpart here at all.

## What a vnode tree is for, in the words of a framework that keeps one

Vue's rendering-mechanism guide states the cost of the general approach more plainly than any
Angular page does, and it is worth having the sentence in front of you before judging Angular's
choice. Verbatim:

> *"The virtual DOM implementation in React and most other virtual-DOM implementations are purely
> runtime: the reconciliation algorithm cannot make any assumptions about the incoming virtual DOM
> tree, so it has to fully traverse the tree and diff the props of every vnode in order to ensure
> correctness."*

That is the whole trade in one sentence. A vnode tree is a **value**: it can be produced by any
expression, shaped by any control flow, memoised, snapshotted, asserted on, and handed to a
different renderer. The price of that generality is precisely that the reconciler is forbidden to
assume anything about it, so it has to walk all of it every time.

Vue's answer is to keep the tree and annotate it. Verbatim:

> *"In Vue, the framework controls both the compiler and the runtime. This allows us to implement
> many compile-time optimizations that only a tightly-coupled renderer can take advantage of. The
> compiler can statically analyze the template and leave hints in the generated code so that the
> runtime can take shortcuts whenever possible."*

> *"We call this hybrid approach **Compiler-Informed Virtual DOM**."*

## The spectrum, and where Angular sits on it

Vue's framing gives the right axis, and it is not "compiled versus not compiled" — every one of
these compiles something. The axis is **how much of the tree survives to runtime.**

| | What the render step produces | What the runtime may assume | Who decides what changed |
|---|---|---|---|
| Purely runtime vnodes | a tree of vnodes | nothing — *"cannot make any assumptions"* | a full traversal and a per-vnode prop diff |
| Compiler-informed vnodes (Vue) | a tree of vnodes **plus** compile-time hints | whatever the hints assert | the reconciler, taking the compiler's shortcuts |
| Instructions (Angular) | **no tree** — a function that mutates `LView` and the DOM in place | that the emitted call order is exactly right | nothing traverses; each binding compares its own slot |

Angular is the far end of Vue's own spectrum. It does not annotate the tree — it removes the tree
and keeps the annotations, in executable form. Everything good and everything awkward about
Angular's rendering follows from having taken that last step, which is why the two halves of this
chunk group are the tree-shaking win ([08c](08c-the-instruction-set-is-a-la-carte.md)) and the bill
([08d](08d-what-the-fixed-shape-costs.md), [08f](08f-the-cost-of-generated-code.md)).

## Three things a tree is, that an instruction stream is not

Being explicit about what was removed is more useful than the slogan, because each of these becomes
a concrete constraint later.

1. **A tree is a value you can return.** A render function that returns a vnode can build it with
   any control flow — a `map`, a ternary, an early return, a recursive helper. Angular's template
   function returns `void` and does its work by side effect, so the only control flow available is
   the control flow the *template language* has: `@if`, `@for`, `@switch`, `@defer`.
2. **A tree is a value you can inspect.** You can log it, snapshot it, assert on its shape. Angular's
   nearest equivalents, `TView` and `LView`, are positional private arrays whose layout the source
   documents as unstable; there is no supported way to read "the tree Angular is about to render".
3. **A tree is a value you can hand to another renderer.** Angular's extension point for a non-DOM
   target is not a tree at all — it is `Renderer2`, an abstraction over the *operations*
   (create element, set attribute, append child) that the instructions perform. The seam is at the
   verbs, not at a data structure.

None of the three is a defect. Each is a deliberate exchange, and
[08b](08b-the-selector-problem-and-reference-inversion.md) is what was bought with them.

## Gotchas

**★ Symptom: you concluded that because there is no virtual DOM there is no diff, and therefore that mutating a bound object is fine, or that change detection is free.** Cause: two different things are absent and only one of them is the comparison. What Angular does not have is the *tree* and the *traversal*. It very much has a comparison, and it is `bindingUpdated` — one array slot, one `Object.is`, per expression ([07e](07e-what-actually-performs-the-diff.md)). The granularity being *one binding* is exactly why mutation is invisible: the slot still holds the same reference, so the comparison says "unchanged". Fix: bind the values you want compared, not the container that holds them, so each gets its own slot and its own comparison:

```ts
import {Component, input} from '@angular/core';

interface Customer {
  readonly id: number;
  readonly name: string;
  readonly tier: 'standard' | 'gold';
}

@Component({
  selector: 'app-customer-badge',
  // Two bindings, two `vars` slots, two independent `Object.is` comparisons.
  // Binding `customer()` into a single child input would be ONE slot, and
  // mutating that object would leave the slot's reference untouched.
  template: `
    <span class="name">{{ customer().name }}</span>
    <span class="tier">{{ customer().tier }}</span>
  `,
})
export class CustomerBadge {
  readonly customer = input.required<Customer>();
}
```

**★ Symptom: you went looking for Angular's vnode tree in the debugger — a value you could log, snapshot or assert on — and could not find one.** Cause: there is nothing to find. The create pass writes DOM nodes into `LView` slots and mutates the document as it goes; the intermediate representation a vnode framework hands you as a return value does not exist as a value here. The nearest structures are `TView` and `LView`, both private, positional and documented as unstable. Fix: assert on the rendered DOM through the public testing surface, which is the layer Angular actually contracts to:

```ts
import {TestBed} from '@angular/core/testing';
import {CustomerBadge} from './customer-badge';

it('renders the tier', async () => {
  const fixture = TestBed.createComponent(CustomerBadge);
  fixture.componentRef.setInput('customer', {id: 1, name: 'Ada', tier: 'gold'});
  await fixture.whenStable();

  const tier: HTMLElement = fixture.nativeElement.querySelector('.tier');
  expect(tier.textContent).toBe('gold');
});
```

**Symptom: you tried to write a custom renderer by intercepting the tree Angular produces, the way you would with a vnode framework, and there was no seam to hook.** Cause: the seam is not at a data structure, because there is no data structure. Angular abstracts the *operations* — `Renderer2` has `createElement`, `setAttribute`, `appendChild`, `listen` — and the instructions call through it. That is why the renderer reference is stored in the view itself and read out of `lView[RENDERER]` by the instruction that needs it ([07e](07e-what-actually-performs-the-diff.md)). Fix: target the operation layer, and get the renderer by injection rather than by reaching into the view:

```ts
import {Directive, ElementRef, Renderer2, effect, input, inject} from '@angular/core';

@Directive({selector: '[appHighlight]'})
export class Highlight {
  readonly appHighlight = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  constructor() {
    effect(() => {
      // Goes through the same abstraction the emitted instructions use,
      // so it keeps working on a non-DOM rendering target.
      this.renderer.setStyle(this.host.nativeElement, 'background-color', this.appHighlight());
    });
  }
}
```

## Interview questions

**★ Vue calls its approach a "Compiler-Informed Virtual DOM". Where does Angular sit relative to that, and what does it give up?**
Vue's own sentence sets the axis: purely-runtime virtual DOM implementations *"cannot make any
assumptions about the incoming virtual DOM tree, so it has to fully traverse the tree and diff the
props of every vnode in order to ensure correctness"*, and Vue's compiler fixes that by leaving
hints in the generated code that let the runtime take shortcuts. Angular starts from the same
premise — the framework controls both the compiler and the runtime — and takes one further step: it
drops the tree entirely and keeps only the hints, as executable instruction calls. What it gives up
is everything the tree was a *value* for. You cannot build markup with ordinary control flow, you
cannot return a different tree shape on a later render, and you cannot hand the intermediate
representation to anything. Angular substitutes a first-class construct for each of those — `@if`,
`@for`, `@defer`, `ng-template`, `ViewContainerRef` — and that substitution is precisely the cost.

**★ "Angular has no virtual DOM" — what exactly is absent, and what is not?**
Absent: the vnode tree as a data structure, the reconciliation algorithm, and the traversal. Present,
and often forgotten: a comparison. `bindingUpdated` reads one `LView` slot, compares the new value
with `Object.is`, writes it back on a difference and returns a boolean the instruction uses to decide
whether to touch the DOM. So Angular does diff — it diffs *one expression against one slot*, with no
tree involved. Getting this wrong in both directions is common: people conclude mutation must work
because "there's no diff", and people conclude expensive template expressions are skipped because
"there is a diff". Neither follows. The comparison gates the DOM write, not the evaluation, and its
unit is a binding rather than a node.

**If a vnode tree is a value and Angular has no such value, what is the closest thing, and why is it not a substitute?**
`TView` and `LView`. `TView` is the per-component blueprint computed on first render and shared by
every instance; `LView` is the per-instance array whose slots the instructions address. They are not
a substitute for three reasons. They are positional rather than structural — a slot index means
nothing without the `consts` pool and the `TView` beside it. They are private: the source's own
definition headers say the shape can change between versions. And they are *not produced per render*
— an `LView` is created once and mutated in place, so there is never a "previous" one to compare a
"next" one against. A vnode framework's tree is a fresh value per render, which is exactly what makes
diffing two of them meaningful.

**Angular supports rendering targets other than the browser DOM. If there is no tree to hand to an alternative renderer, where is the seam?**
At the operations. `Renderer2` exposes the verbs the instructions perform — creating an element,
setting an attribute or a property, appending a child, attaching a listener — and the renderer for a
view is stored in the view itself, which is why an instruction like `ɵɵproperty` reaches for
`lView[RENDERER]` when it decides to write. Abstracting the verbs rather than a data structure is
consistent with the rest of the design: there is no moment at which a complete description of the
intended output exists, so the only thing that *can* be abstracted is each individual mutation as it
is issued.

---

← Prev: [07e · What performs the diff](07e-what-actually-performs-the-diff.md) · Index: [Topic index](README.md) · Next → [08b · The selector problem and reference inversion](08b-the-selector-problem-and-reference-inversion.md)
