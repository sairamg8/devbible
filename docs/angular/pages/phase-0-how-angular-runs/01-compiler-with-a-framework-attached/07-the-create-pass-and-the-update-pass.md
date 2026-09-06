---
title: "The template function you saw emitted in chunk 06 is one function called twice with different bit flags — `RenderFlags.Create` once from `renderView`, `RenderFlags.Update` from `refreshView` on every pass — and the two halves live in one closure because nothing at runtime re-derives the numbering they share"
sidebar_label: "07 · The create pass and the update pass"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler) — and `angular/angular` at tag `v22.1.5`: [`core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts), [`interfaces/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/view.ts), [`instructions/render.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/render.ts), [`instructions/change_detection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/change_detection.ts), [`instructions/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/shared.ts), [`instructions/advance.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/advance.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Chunk 06 showed you the artefact: a `template` function of the shape `(rf, ctx) => { … }`
with two `if` blocks in it, sitting inside a `ɵɵdefineComponent` call, next to two bare
integers called `decls` and `vars`. This chunk is why it looks like that.** The function is
called twice with different bit flags — once, ever, to create nodes, and once per
change-detection pass for that view to refresh bindings. The two halves live in one function
because they must agree on the *numbering* of every node and every binding, and the cheapest
way to guarantee agreement is to emit them from one walk of one template AST. Everything else
in this five-page family follows from that: the array those numbers index into ([07b](07b-the-view-is-an-array-decls-and-vars.md)), the two cursors the update half addresses it with ([07c](07c-how-instructions-address-the-array.md)), the forward-only instruction that moves one of them ([07d](07d-advance-is-relative-and-forward-only.md)), and the nine-line function that decides whether a binding touches the DOM at all ([07e](07e-what-actually-performs-the-diff.md)).

## Two passes, one function

The flags are a two-bit enum. `packages/core/src/render3/interfaces/definition.ts`, verbatim:

```ts
/**
 * Flags passed into template functions to determine which blocks (i.e. creation, update)
 * should be executed.
 *
 * Typically, a template runs both the creation block and the update block on initialization and
 * subsequent runs only execute the update block. However, dynamically created views require that
 * the creation block be executed separately from the update block (for backwards compat).
 */
export const enum RenderFlags {
  /* Whether to run the creation block (e.g. create elements and directives) */
  Create = 0b01,

  /* Whether to run the update block (e.g. refresh bindings) */
  Update = 0b10,
}
```

⚠️ **The docstring and the code disagree slightly, and both are right.** The docstring says a
template *"runs both the creation block and the update block on initialization"* — true of the
observable behaviour. But it is not one call with both bits set. It is **two calls of the same
function**, from two different places. Creation, in `instructions/render.ts`:

```ts
    // Execute a template associated with this view, if it exists. A template function might not be
    // defined for the root component views.
    const templateFn = tView.template;
    if (templateFn !== null) {
      executeTemplate<T>(tView, lView, templateFn, RenderFlags.Create, context);
    }
```

Update, inside `refreshView` in `instructions/change_detection.ts`:

```ts
    resetPreOrderHookFlags(lView);

    setBindingIndex(tView.bindingStartIndex);
    if (templateFn !== null) {
      executeTemplate(tView, lView, templateFn, RenderFlags.Update, context);
    }
```

`RenderFlags` is a TypeScript `const enum`, so it is inlined at build time and never exists as
an object at runtime. That is why the emitted template function reads `if (rf & 1)` and
`if (rf & 2)` rather than `if (rf & RenderFlags.Create)` — the same constant, after inlining.
When you are staring at a stack frame in a production bundle, `1` is create and `2` is update.

**Why one function rather than two.** Three reasons, in descending order of importance:

1. **The two halves share a numbering that nothing at runtime re-derives.** The create block
   assigns slot 0 to the first node; the update block addresses that node by walking forward
   from slot 0. If they were emitted independently, nothing would enforce that they counted the
   same way. Emitting both from a single walk of one template AST makes the agreement
   structural rather than a convention someone has to maintain.
2. **One closure, one `ctx` parameter, one call site to profile.** `executeTemplate` wraps the
   call in `ProfilerEvent.TemplateCreateStart` / `TemplateUpdateStart` pairs — two functions
   would double that plumbing and every `tView` field that points at it.
3. **It is smaller.** One function object, one entry in the def, one thing for the minifier to
   name.

The wrapper that makes both calls is `executeTemplate` in `instructions/shared.ts`, verbatim:

```ts
export function executeTemplate<T>(
  tView: TView,
  lView: LView<T>,
  templateFn: ComponentTemplate<T>,
  rf: RenderFlags,
  context: T,
) {
  const prevSelectedIndex = getSelectedIndex();
  const isUpdatePhase = rf & RenderFlags.Update;
  try {
    setSelectedIndex(-1);
    if (isUpdatePhase && lView.length > HEADER_OFFSET) {
      // When we're updating, inherently select 0 so we don't
      // have to generate that instruction for most update blocks.
      selectIndexInternal(tView, lView, HEADER_OFFSET, !!ngDevMode && isInCheckNoChangesMode());
    }

    const preHookType = isUpdatePhase
      ? ProfilerEvent.TemplateUpdateStart
      : ProfilerEvent.TemplateCreateStart;
    profiler(preHookType, context as unknown as {}, templateFn);
    templateFn(rf, context);
  } finally {
    setSelectedIndex(prevSelectedIndex);

    const postHookType = isUpdatePhase
      ? ProfilerEvent.TemplateUpdateEnd
      : ProfilerEvent.TemplateCreateEnd;
    profiler(postHookType, context as unknown as {}, templateFn);
  }
}
```

That comment — *"When we're updating, inherently select 0 so we don't have to generate that
instruction for most update blocks"* — is a code-size optimisation you can see in the emitted
output: the **first** binding in an update block usually needs no `ɵɵadvance` in front of it,
because slot 0 is already selected before the function is entered.
[07d](07d-advance-is-relative-and-forward-only.md) is what that sentence is about.

Note the `try` / `finally` and the two lines that bracket it: the selected index is saved on
entry and restored on exit, because it is **global instruction state** rather than a field on
the view. [07c](07c-how-instructions-address-the-array.md) is where that matters.

## The create call is not only about the template

`renderView` in `instructions/render.ts` is where `RenderFlags.Create` originates, and the
template function is the *second* thing it drives, not the first:

```ts
export function renderView<T>(tView: TView, lView: LView<T>, context: T): void {
  ngDevMode && assertEqual(isCreationMode(lView), true, 'Should be run in creation mode');
  ngDevMode && assertNotReactive(renderView.name);
  enterView(lView);
  try {
    const viewQuery = tView.viewQuery;
    if (viewQuery !== null) {
      executeViewQueryFn<T>(RenderFlags.Create, viewQuery, context);
    }

    // Execute a template associated with this view, if it exists. A template function might not be
    // defined for the root component views.
    const templateFn = tView.template;
    if (templateFn !== null) {
      executeTemplate<T>(tView, lView, templateFn, RenderFlags.Create, context);
    }
```

Three things are worth reading off those nine lines.

**`RenderFlags` is a shared vocabulary, not a template-only one.** The *view query* function —
what your `viewChild` / `viewChildren` declarations compile to — takes the same flag and is
invoked with `RenderFlags.Create` here. So "create pass" is a phase of the whole view, and the
template function is one participant in it.

**View creation asserts that it is not running inside a reactive consumer.**
`assertNotReactive(renderView.name)` is a dev-mode guard: creating a view from inside a
`computed()` would make every signal read during creation a dependency of that computed. The
assertion carries only the function name as its message, and Angular's public documentation
does not discuss it — treat the *reason* above as a reading of the code, not a quoted rule; the
*assertion itself* is verbatim.

**The `templateFn !== null` guard is not defensive coding.** The comment beside it says the
case it exists for: *"A template function might not be defined for the root component views."*

## Gotchas

**★ Symptom: a dynamically created embedded view shows unbound placeholders until something
else triggers change detection.** Cause: the `RenderFlags` docstring's own caveat —
*"dynamically created views require that the creation block be executed separately from the
update block (for backwards compat)."* Creating the view runs only `RenderFlags.Create`; the
`RenderFlags.Update` call comes from `refreshView`, which has not run for that view yet. Fix:
run detection on the view you created:

```ts
import {Component, ViewContainerRef, TemplateRef, viewChild, inject} from '@angular/core';

@Component({
  selector: 'app-tip',
  template: `
    <ng-template #tip><p class="tip">{{ message }}</p></ng-template>
    <div #outlet></div>
  `,
})
export class Tip {
  protected message = 'Press ⌘K to search';
  private readonly tpl = viewChild.required<TemplateRef<unknown>>('tip');
  private readonly vcr = inject(ViewContainerRef);

  show(): void {
    const view = this.vcr.createEmbeddedView(this.tpl());
    view.detectChanges();
  }
}
```

**★ Symptom: you assume the first render is one call with both flag bits set, and write a
template function by hand (or a test double) that branches on `rf === 3`.** Cause: no call site
in the runtime ever passes both bits. `renderView` passes `RenderFlags.Create` (`1`) and
`refreshView` passes `RenderFlags.Update` (`2`); the docstring's *"runs both … on
initialization"* describes two sequential invocations, not one combined flag. Fix: branch on
the bit, never on equality with a combined value:

```ts
// pseudo-code — the shape every emitted template function has
function tpl(rf: number, ctx: unknown): void {
  if (rf & 1) {
    /* create nodes */
  }
  if (rf & 2) {
    /* refresh bindings */
  }
}
```

**Symptom: a component appears to have no template function at all when you inspect its def.**
Cause: both call sites guard with `templateFn !== null`, and the comment in `render.ts` says
why — *"A template function might not be defined for the root component views."* Fix: nothing;
a root host view is a real view with no template of its own.

**Symptom: you call `createComponent()` or `createEmbeddedView()` from inside a `computed()`
and dev mode complains.** Cause: `renderView` opens with
`ngDevMode && assertNotReactive(renderView.name)` — view creation is asserted not to run inside
a reactive consumer, because every signal read during creation would be captured as a
dependency of the computation that triggered it. Fix: create views from an event handler, or
from inside `untracked()` if the call genuinely has to happen during a reactive computation:

```ts
import {Component, ViewContainerRef, inject, untracked, effect, signal} from '@angular/core';
import {Panel} from './panel';

@Component({selector: 'app-shell', template: `<div class="shell"></div>`})
export class Shell {
  private readonly vcr = inject(ViewContainerRef);
  readonly wantsPanel = signal(false);

  constructor() {
    effect(() => {
      if (this.wantsPanel()) {
        untracked(() => this.vcr.createComponent(Panel));
      }
    });
  }
}
```

## Interview questions

**★ Why are the creation block and the update block the same function rather than two separate
ones?**
Because they share a numbering that nothing at runtime re-derives. The create block assigns
node 0, 1, 2 — really `LView[27]`, `[28]`, `[29]` — and the update block reaches them by
advancing a cursor from 0 in the same order. Emitting both halves from one walk of one template
AST is what makes that agreement structural rather than a convention. Secondarily it is smaller
output and a single profiling call site. The `rf` parameter selects the half; at runtime the
two calls come from different places entirely — `renderView` passes `RenderFlags.Create` once,
`refreshView` passes `RenderFlags.Update` on every pass.

**★ If you saw `if (rf & 1)` and `if (rf & 2)` in a bundle with no symbol names, how would you
know which was which?**
`RenderFlags` is a `const enum`, so the values are inlined and the enum itself does not exist at
runtime: `Create = 0b01` and `Update = 0b10`. `1` is the creation block, `2` is the update
block. Corroborate it from the contents — the `1` branch contains element and text creation
with explicit integer indices, and the `2` branch contains `advance` and binding calls with no
indices at all.

**The docstring says a template "runs both the creation block and the update block on
initialization". Is that one invocation or two, and does the difference matter?**
Two. `renderView` calls `executeTemplate(..., RenderFlags.Create, ...)` and `refreshView` later
calls it again with `RenderFlags.Update`; nothing passes `Create | Update`. It matters in three
places. A dynamically created view gets only the create call until someone runs change
detection on it, which is the docstring's own *"for backwards compat"* caveat. Anything you
measure per invocation of the template function sees two entries for the first render, not one.
And an emitted function that branched with `if (rf & 1) { … } else { … }` would still work,
which is why the two-call structure is easy to miss when reading output.

**What else does `RenderFlags.Create` drive, besides creating DOM nodes?**
The view query function. `renderView` reads `tView.viewQuery` and, if it is non-null, calls
`executeViewQueryFn<T>(RenderFlags.Create, viewQuery, context)` *before* the template function
runs. So the flags are the runtime's shared vocabulary for "which half of a two-phase generated
function am I in", used by more than one kind of generated function. That is also why
`viewChild` results are available on a different schedule from ordinary bindings: they are
populated by a separate generated function that participates in the same two phases.

---

← Prev: **06 · What the compiler emits: `ɵcmp`** *(not written yet)* · Index: [Topic index](README.md) · Next → [07b · The view is an array](07b-the-view-is-an-array-decls-and-vars.md)
