---
title: "Create instructions carry an explicit slot index because they are assigning addresses; update instructions carry none because they run on two implicit cursors held in global state — and every dev-mode range assertion in the runtime exists to catch the moment those two disagree"
sidebar_label: "07c · Addressing the array"
sidebar_position: 7.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`core/src/render3/assert.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/assert.ts), [`state.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/state.ts), [`interfaces/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/view.ts), [`instructions/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/shared.ts), [`instructions/change_detection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/change_detection.ts), [`instructions/advance.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/advance.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Read any emitted template function side by side and one asymmetry jumps out: the create half
passes integers everywhere — `ɵɵelementStart(0, 'div')`, `ɵɵtext(1)` — and the update half
passes almost none. That is not a stylistic difference. The create half is *assigning*
addresses into the array [07b](07b-the-view-is-an-array-decls-and-vars.md) described; the
update half is *walking* the addresses that were already assigned, using two cursors that live
in module-global instruction state rather than in the view.** Which is why the update block is
so much smaller than the create block, why an emitted binding instruction has no idea which
node or which slot it is about to touch, and why every safety check on those two cursors is
compiled out of your production bundle.

## The create pass writes slots

The create instructions take an explicit index because they are *assigning* addresses. In dev
mode there is an assertion that catches an index in the wrong region, in `render3/assert.ts`:

```ts
export function assertTNodeCreationIndex(lView: LView, index: number) {
  const adjustedIndex = index + HEADER_OFFSET;
  assertIndexInRange(lView, adjustedIndex);
  assertLessThan(
    adjustedIndex,
    lView[TVIEW].bindingStartIndex,
    'TNodes should be created before any bindings',
  );
}

export function assertIndexInDeclRange(tView: TView, index: number) {
  assertBetween(HEADER_OFFSET, tView.bindingStartIndex, index);
}

export function assertBetween(lower: number, upper: number, index: number) {
  if (!(lower <= index && index < upper)) {
    throwError(`Index out of range (expecting ${lower} <= ${index} < ${upper})`);
  }
}
```

Three facts are encoded in those fifteen lines. The `+ HEADER_OFFSET` in
`assertTNodeCreationIndex` is the translation from *instruction index space* into *`LView`
index space* — the same translation `interfaces/view.ts` says should exist nowhere else. The upper
bound is `bindingStartIndex`, so the assertion is literally "a declaration must land in the
declaration region". And the message it throws — `TNodes should be created before any
bindings` — names the invariant the whole layout depends on.

## The update pass walks them, on two cursors

The update pass passes **no indices at all**. It runs on two implicit cursors, both stored in
the global instruction state rather than in the `LView`:

- **The selected index** — which node subsequent instructions act on. Moved only by
  `ɵɵadvance` ([07d](07d-advance-is-relative-and-forward-only.md)), and pre-set to
  `HEADER_OFFSET` by `executeTemplate` before the update half is entered.
- **The binding index** — which array slot the next binding reads and writes. Reset at the top
  of every update pass by `setBindingIndex(tView.bindingStartIndex)`, then consumed one at a
  time. From `state.ts`, in full:

```ts
export function nextBindingIndex(): number {
  return instructionState.lFrame.bindingIndex++;
}

export function incrementBindingIndex(count: number): number {
  const lFrame = instructionState.lFrame;
  const index = lFrame.bindingIndex;
  lFrame.bindingIndex = lFrame.bindingIndex + count;
  return index;
}
```

A post-increment. That is the entire binding allocator. `vars` is the compile-time count of how
many times that `++` will run in one pass — which is why an off-by-one in either direction is a
whole-view corruption rather than one wrong value. The second function,
`incrementBindingIndex(count)`, is how an instruction that needs *several* consecutive slots
reserves them in one move: an interpolation with three expressions, or a pure pipe that has to
remember its arguments, takes a block rather than calling `nextBindingIndex()` repeatedly.

Note where both cursors live: `instructionState.lFrame`. Not on the `LView`, not on the
`TView` — on a frame in module-level state, pushed and popped as the runtime enters and leaves
views. That is what makes the emitted code so small (no cursor is ever passed as an argument)
and it is also the reason `executeTemplate` brackets the call in `try` / `finally` and restores
the previously selected index: the state is shared by every view in the application.

## The cursor gives you a node, not a destination

The doc comment above `ɵɵproperty` contains a locality receipt worth quoting, since it explains
a runtime check that looks like waste:

> *"If the property name also exists as an input property on one of the element's directives,
> the component property will be set instead of the element property. This check must be
> conducted at runtime so child components that add new `@Inputs` don't have to be re-compiled"*

That is `setPropertyAndInputs` doing a lookup on every changed binding, forever, so that adding
an `@Input` to a child component never forces a recompile of every parent that binds to it. It
is the same trade as `expandoStartIndex` in [07b](07b-the-view-is-an-array-decls-and-vars.md):
a small permanent runtime cost bought in exchange for the compiler not having to know anything
about the components you use.

## Why the asymmetry is the right trade

The create block runs **once**. The update block runs on **every change-detection pass for that
view**, forever. So the compiler puts the cost where it is paid once: explicit integers in the
create half, an implicit monotonic walk in the update half. The update half's instructions
carry only the data that actually varies — a property name and a value — because the *node* is
whatever the cursor is on and the *slot* is whatever the counter is at.

That is also why the two halves cannot be reordered or interleaved by a later tool. The update
half is correct only if the create half ran first, in the same order, on the same view.

## Gotchas

**★ Symptom: `Index out of range (expecting 27 <= 31 < 30)` in `ng serve`, and in a production
build the same page renders subtly wrong instead of throwing.** Cause: an instruction addressed
a slot outside its region — an index beyond `decls`, or a binding index beyond `vars`. Every
one of those checks is behind `ngDevMode` (`assertIndexInDeclRange`, `assertTNodeCreationIndex`,
the `assertLessThan` in `bindingUpdated`), so production reads or writes whatever happens to be
at that array position. Fix: this is not a user error and there is no template you can write to
cause it — it is a compiler/runtime version-skew bug class. Check that every `@angular/*`
package is on the same version, that no library ships pre-compiled output from a newer major,
and file it upstream with the template:

```bash
npx ng version
npm ls @angular/core @angular/compiler @angular/compiler-cli
```

**★ Symptom: a getter used in a binding synchronously renders another view, and afterwards
bindings land on the wrong element.** Cause: the selected index is global instruction state.
`selectIndexInternal` says so in its own comment — *"hooks may have side-effects that cause
other template functions to run, thus updating the selected index, which is global state."*
`executeTemplate`'s `finally` restores the index across a nested `executeTemplate`, but a
side-effect that moves the cursor *without* going through `executeTemplate` has nothing
restoring it. Fix: never render, create or destroy a view from inside an expression that a
binding evaluates. Move it to an event handler or an effect:

```ts
import {Component, ViewContainerRef, inject, signal} from '@angular/core';
import {Panel} from './panel';

@Component({selector: 'app-shell', template: `<button type="button" (click)="open()">Open</button>`})
export class Shell {
  private readonly vcr = inject(ViewContainerRef);
  protected readonly isOpen = signal(false);

  protected open(): void {
    this.isOpen.set(true);
    this.vcr.createComponent(Panel);
  }
}
```

**Symptom: you write a debugging helper that reads `lView[0]` expecting the first element of
your template.** Cause: `lView[0]` is `HOST`. Your first declaration slot is
`lView[HEADER_OFFSET]`, and `HEADER_OFFSET` is `27` at `v22.1.5` — a constant of the
instruction set, not a public API. Its own comment says it *"should only be referred to the in
the `ɵɵ*` instructions"*. Fix: never hard-code the number. Read the header constants from the
same module you are debugging against, and treat any tooling that bakes in `27` as broken by
the next minor:

```ts
// pseudo-code — debugging only, and only against the exact version you built with
import {HEADER_OFFSET, TVIEW} from '@angular/core/src/render3/interfaces/view';

function firstDeclSlot(lView: unknown[]): unknown {
  return lView[HEADER_OFFSET];
}
```

**Symptom: a conditional in a template appears to shift which value a binding shows.** Cause:
this cannot happen through the binding cursor, and knowing *why* is the useful part. The cursor
is reset to `tView.bindingStartIndex` at the top of every update pass and advanced by exactly
one post-increment per binding instruction, and the instruction sequence in the update block is
straight-line code with no conditionals in it — everything conditional in your template became
a separate embedded view with its own `LView` and its own cursor. Fix: look for the real cause
(a shared mutable object, an `@if` re-creating a view and resetting component state), not for a
slot mix-up. If you *do* see slot-level corruption, it is the version-skew bug class above.

**Symptom: an instruction that binds three interpolated expressions seems to consume one slot,
not three.** Cause: it consumes three, but through `incrementBindingIndex(3)` rather than three
calls to `nextBindingIndex()`. `vars` counts slots, not instructions. Fix: when reconciling a
`vars` figure against an update block by hand, count *expressions plus memoisation slots*, not
instruction calls.

## Interview questions

**★ Why do create instructions take an explicit index while update instructions take none?**
Because the create half assigns addresses and the update half walks them. `ɵɵelementStart(0,
'div')` is a write to `LView[27]`; the number is the address being allocated. The update half
does not need to say which node or which slot it means, because the selected index and the
binding index are already positioned — the selected index by `ɵɵadvance`, the binding index by
a post-increment per binding. The pay-off is size where it counts: the create block runs once
per view, the update block runs on every change-detection pass, so the compiler spends bytes on
the half that runs once and keeps the half that runs forever as small as possible.

**★ How does the update pass know which binding slot to use when no instruction is passed one?**
A cursor. `refreshView` calls `setBindingIndex(tView.bindingStartIndex)` immediately before
invoking the template function, and every binding instruction consumes one slot via
`nextBindingIndex()`, which is literally `bindingIndex++`. So the *n*-th binding instruction in
source order always lands in the *n*-th binding slot, and `vars` is the compile-time count of
how many times that increment will run in one pass. Instructions needing several consecutive
slots take a block with `incrementBindingIndex(count)` instead.

**Why does the first binding in most emitted update blocks have no `ɵɵadvance` in front of it?**
Because `executeTemplate` pre-selects it. Its comment: *"When we're updating, inherently select
0 so we don't have to generate that instruction for most update blocks."* Slot `HEADER_OFFSET`
is already selected before the update half runs, so an `advance` is only emitted when the first
binding is not on node 0.

**Why does `executeTemplate` save and restore the selected index in a `try` / `finally` rather
than resetting it at the end?**
Because the body between them can throw, and because it can re-enter. The selected index lives
in global instruction state, and a lifecycle hook flushed during the update walk can cause an
entirely different view's template function to run — `selectIndexInternal`'s comment says
exactly that. Without the `finally`, an exception thrown from a binding or a hook would leave
the global cursor pointing into a view that is no longer being processed, and the next
instruction to run would write to whatever slot that happened to be.

**Both cursors live in `instructionState.lFrame`, not on the `LView`. What does that buy, and
what does it cost?**
It buys the smallest possible emitted code: no instruction ever passes a cursor, a view or a
frame, so a binding is `ɵɵproperty('title', ctx.title)` and nothing more. It costs
re-entrancy safety, which has to be bought back explicitly — a frame stack, `enterView` /
`leaveView`, and the `try` / `finally` in `executeTemplate`. It also means every range
assertion on those cursors is a *global* invariant check rather than a local one, which is why
they are all `ngDevMode`-gated: they are cheap to state and not cheap to run on every binding
of every view.

**What does the message `TNodes should be created before any bindings` protect?**
The region boundary. `assertTNodeCreationIndex` translates the instruction index into `LView`
space with `+ HEADER_OFFSET` and then asserts it is below `tView.bindingStartIndex`. If a
declaration were allowed to land at or above that boundary it would occupy a slot the binding
cursor is going to write, and the two would silently overwrite each other — one slot holding a
`TNode` on the create pass and a previous binding value on the update pass. The assertion turns
that into a thrown error in dev and is absent in production.

**Why does `ɵɵproperty` look up whether the property is also a directive input, on every changed
binding, instead of the compiler resolving it once?**
Because resolving it at compile time would require the compiler to know the full input surface
of every directive that might match the element — which is the knowledge locality exists to
avoid requiring. The doc comment says it outright: *"This check must be conducted at runtime so
child components that add new `@Inputs` don't have to be re-compiled"*. It is the same trade as
`expandoStartIndex` being un-computable at build time: a permanent, small runtime cost in
exchange for a component being compilable without reading its dependencies' definitions.

---

← Prev: [07b · The view is an array](07b-the-view-is-an-array-decls-and-vars.md) · Index: [Topic index](README.md) · Next → [07d · `ɵɵadvance` is relative and forward-only](07d-advance-is-relative-and-forward-only.md)
