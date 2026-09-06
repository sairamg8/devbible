---
title: "`ɵɵadvance` takes a delta rather than an index, asserts that the delta is positive, and flushes your child components' `ngOnInit` on the way past — three facts that together explain why an Angular template's shape is fixed at compile time and why lifecycle hooks interleave with parent bindings"
sidebar_label: "07d · `ɵɵadvance`"
sidebar_position: 7.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`core/src/render3/instructions/advance.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/advance.ts), [`instructions/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/shared.ts), [`interfaces/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/view.ts), [`instructions/change_detection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/change_detection.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One of the two cursors from [07c](07c-how-instructions-address-the-array.md) has a public
instruction that moves it, and that instruction is the most consequential twelve lines in the
render engine.** `ɵɵadvance` moves the selected index by a *relative* delta, refuses a delta
that is not positive, and — before it moves anything — flushes every pre-order lifecycle hook
belonging to the nodes it is sweeping past. The first fact is a code-size decision. The second
is why your template's node order is fixed at compile time and cannot be rearranged at runtime.
The third is why a child's `ngOnInit` appears in a stack trace *between* two of the parent's
binding updates, which looks like a bug and is the design.

## The instruction, in full

From `instructions/advance.ts`, the body verbatim:

```ts
export function ɵɵadvance(delta: number = 1): void {
  ngDevMode && assertGreaterThan(delta, 0, 'Can only advance forward');
  selectIndexInternal(
    getTView(),
    getLView(),
    getSelectedIndex() + delta,
    !!ngDevMode && isInCheckNoChangesMode(),
  );
}
```

`getSelectedIndex() + delta` — relative, not absolute. `delta` defaults to `1`, which is the
common case and the reason `ɵɵadvance()` with no argument appears everywhere in emitted output:
consecutive nodes are one apart, and an argument that is almost always `1` is an argument worth
not emitting.

Its own docstring carries the canonical example of the emitted shape — this is Angular's
illustration of generated output, not a build anyone ran:

```ts
// From the ɵɵadvance docstring in packages/core/src/render3/instructions/advance.ts
(rf: RenderFlags, ctx: any) => {
  if (rf & 1) {
    text(0, 'Hello');
    text(1, 'Goodbye')
    element(2, 'div');
  }
  if (rf & 2) {
    advance(2); // Advance twice to the <div>.
    property('title', 'test');
  }
}
```

Read it against the array model and it is unambiguous. Three declaration slots are taken, so
this view's `decls` is 3 and its slots are `LView[27]`, `LView[28]`, `LView[29]`. The update
block starts with slot `27` already selected — `executeTemplate` did that — advances by a
**delta of 2** to reach `29`, and binds there.

🔴 **`assertGreaterThan(delta, 0, 'Can only advance forward')` is the load-bearing line on this
page.** Because the cursor can only move forward, the update block *must* visit nodes in the
same order the create block declared them. There is no addressing mode that lets an update
block jump back to an earlier node, which means the compiler must linearise the template once
and both halves must obey that order. This is the mechanism behind "an Angular template's shape
is fixed at compile time" — not a policy, an addressing limitation.

Note also that the assertion is `ngDevMode`-gated. A negative or zero delta in a production
build does not throw; it moves the cursor to a slot the update block has already passed, or
leaves it where it is, and the next binding writes to the wrong node.

## The cursor move is also a lifecycle-hook flush

`ɵɵadvance` does something people do not expect from a cursor move. `selectIndexInternal`,
verbatim:

```ts
export function selectIndexInternal(
  tView: TView,
  lView: LView,
  index: number,
  checkNoChangesMode: boolean,
) {
  ngDevMode && assertIndexInDeclRange(lView[TVIEW], index);

  // Flush the initial hooks for elements in the view that have been added up to this point.
  // PERF WARNING: do NOT extract this to a separate function without running benchmarks
  if (!checkNoChangesMode) {
    const hooksInitPhaseCompleted =
      (lView[FLAGS] & LViewFlags.InitPhaseStateMask) === InitPhaseState.InitPhaseCompleted;
    if (hooksInitPhaseCompleted) {
      const preOrderCheckHooks = tView.preOrderCheckHooks;
      if (preOrderCheckHooks !== null) {
        executeCheckHooks(lView, preOrderCheckHooks, index);
      }
    } else {
      const preOrderHooks = tView.preOrderHooks;
      if (preOrderHooks !== null) {
        executeInitAndCheckHooks(lView, preOrderHooks, InitPhaseState.OnInitHooksToBeRun, index);
      }
    }
  }

  // We must set the selected index *after* running the hooks, because hooks may have side-effects
  // that cause other template functions to run, thus updating the selected index, which is global
  // state. If we run `setSelectedIndex` *before* we run the hooks, in some cases the selected index
  // will be altered by the time we leave the `ɵɵadvance` instruction.
  setSelectedIndex(index);
}
```

**`ngOnInit` and `ngDoCheck` on a child fire from inside the parent's `ɵɵadvance` call.** There
is no separate hook-walking phase for pre-order hooks; they are flushed as the parent's update
cursor sweeps past the nodes they belong to. That is the whole explanation for the interleaving
of parent bindings and child init hooks that looks wrong the first time you see it in a stack
trace.

Three details in that function are each worth a gotcha of their own. The `index` argument is
passed *into* the hook executors, so the flush is bounded — it runs hooks for nodes up to the
new position, not for the whole view. The `if (!checkNoChangesMode)` guard means the dev-mode
verification pass deliberately **skips** the hook flush, so it is not a faithful replay of the
real pass. And the closing comment explains an ordering that looks arbitrary: the cursor is
moved *after* the hooks precisely because a hook can run another view's template function and
clobber the global cursor.

## Gotchas

**★ Symptom: a child's `ngOnInit` logs between two of the parent's binding updates, and you
conclude change detection is broken.** Cause: pre-order hooks are flushed inside
`selectIndexInternal`, which is what `ɵɵadvance` calls — so a child's `ngOnInit` runs at the
moment the parent's update cursor sweeps past that child's slot, not before or after the
parent's whole update block. Fix: nothing to fix; it is the design. If you need work that is
genuinely after the parent's bindings settle, use `afterNextRender` rather than a lifecycle
hook:

```ts
import {Component, afterNextRender, ElementRef, inject} from '@angular/core';

@Component({
  selector: 'app-measured-panel',
  template: `<div class="panel">{{ label }}</div>`,
})
export class MeasuredPanel {
  protected readonly label = 'Panel';
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    afterNextRender(() => {
      this.width = this.host.nativeElement.getBoundingClientRect().width;
    });
  }

  private width = 0;
}
```

**★ Symptom: you set a breakpoint in a child's `ngDoCheck` and the dev-mode second pass never
hits it, so you conclude the second pass does not run.** Cause: `selectIndexInternal` guards the
entire hook flush with `if (!checkNoChangesMode)`. The verification pass re-runs the update
block — bindings, expressions, `bindingUpdated` comparisons — but deliberately fires no
pre-order hooks. Fix: none, but stop treating the second pass as a replay. If you are hunting an
`ExpressionChangedAfterItHasBeenCheckedError`, the mutation you are looking for happened during
the *first* pass; the second pass only observes the difference. See
[07e](07e-what-actually-performs-the-diff.md).

**Symptom: you reorder two elements in a template and a stale HMR session renders garbage
until you hard-reload.** Cause: reordering changes every subsequent `ɵɵadvance` delta and every
slot index in the create block. A module replaced in place with a new template function but an
`LView` array built from the old `TView` blueprint is addressing the old layout with the new
numbering. Fix: reload the page. Structurally, this is also why generated output is never
hand-editable — the indices are a global allocation, not local names.

**Symptom: you expect one `ɵɵadvance` before every binding and cannot map a run of binding calls
back to elements.** Cause: the cursor is *sticky*. Several bindings on the same element emit no
`advance` between them, and `ɵɵproperty` returns itself so they chain —
`ɵɵproperty('name', ctx.name)('title', ctx.title)`. An `advance` appears only where the node
changes. Fix: read the update block as segments delimited by `advance` calls; everything between
two of them belongs to one node.

**Symptom: a hand-written or code-generated update block calls `ɵɵadvance(0)` to "stay on the
current node", and it works in `ng serve` and misrenders in production.** Cause:
`assertGreaterThan(delta, 0, 'Can only advance forward')` is behind `ngDevMode` and is stripped
from a production build, so the zero delta stops being an error and becomes a silent no-op that
the surrounding numbering was not written for. Fix: emit no instruction at all when the cursor
is already on the target node — that is exactly what the compiler does, and it is why
`executeTemplate` pre-selects slot `HEADER_OFFSET` before the update half runs.

## Interview questions

**★ Why is `ɵɵadvance` forward-only, and what would change if it were not?**
`ɵɵadvance` asserts `delta > 0` with the message `Can only advance forward`. Forward-only means
the update block must visit nodes in declaration order, which in turn means one linearisation
of the template serves both passes and no per-node index table is needed in the emitted code —
a delta is usually 1, which minifies to nothing. If it could go backwards you would need
absolute indices in the update block, larger output, and a runtime that could no longer assume
a monotonic sweep — which is also what makes the pre-order hook flush inside
`selectIndexInternal` correct, since it fires hooks for everything up to the new index.

**★ Where exactly does a child component's `ngOnInit` run, relative to its parent's bindings?**
Inside the parent's `ɵɵadvance` call, at the moment the parent's update cursor reaches that
child's slot. `selectIndexInternal` flushes `tView.preOrderHooks` (or `preOrderCheckHooks` once
the init phase has completed) up to the index it is about to select, then sets the index. So the
hooks of a child declared at slot 3 fire after the parent has bound slots 0 through 2 and before
it binds slot 3 — interleaved, not batched. The practical consequence is that a parent binding
evaluated *later* in the update block can observe state a child's `ngOnInit` wrote.

**Why is the cursor moved *after* the hooks rather than before?**
Because a hook can run another template function. The comment is explicit —

> *"hooks may have side-effects that cause other template functions to run, thus updating the
> selected index, which is global state"*

— and its second sentence spells out the consequence of the other ordering: setting the index
before running the hooks would let a hook alter it before `ɵɵadvance` returns. Setting it last
means the last write wins and it is the one this instruction intended.

**Why can generated template code never be hand-edited, even to fix an obvious mistake?**
Because the indices are a global allocation across the whole view, not local names. Inserting
one node shifts every later slot index in the create block, changes at least one `ɵɵadvance`
delta in the update block, and changes `decls` — and `decls` sizes the array that both halves
address. Three coordinated edits, any one of which silently misaddresses the array in a
production build where every range assertion has been compiled out.

**Why does `ɵɵadvance` default its parameter to `1` instead of requiring it?**
Because the overwhelmingly common case is "the next node", and the default lets the compiler
emit `ɵɵadvance()` instead of `ɵɵadvance(1)`. That is a byte per occurrence in a construct that
occurs once per bound node in every component in the application. It is the same class of
decision as `executeTemplate` pre-selecting slot `HEADER_OFFSET` so the first binding needs no
`advance` at all — both exist to keep the half of the emitted function that runs on every
change-detection pass as small as possible.

---

← Prev: [07c · Addressing the array](07c-how-instructions-address-the-array.md) · Index: [Topic index](README.md) · Next → [07e · What performs the diff](07e-what-actually-performs-the-diff.md)
