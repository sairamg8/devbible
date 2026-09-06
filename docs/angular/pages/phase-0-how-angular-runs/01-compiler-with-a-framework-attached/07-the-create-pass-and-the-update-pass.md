---
title: "The template function you saw emitted in chunk 06 is called twice with different flags — once to build the DOM and once per change-detection tick to refresh it — and every strange thing about it, from `if (rf & 1)` to `ɵɵadvance(2)` to the two integers `decls` and `vars`, is a consequence of the compiler knowing your template's shape before the program runs"
sidebar_label: "07 · The create pass and the update pass"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler) — and `angular/angular` at tag `v22.1.5`: [`core/src/render3/interfaces/definition.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/definition.ts), [`interfaces/view.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/interfaces/view.ts), [`view/construction.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/view/construction.ts), [`instructions/render.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/render.ts), [`instructions/change_detection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/change_detection.ts), [`instructions/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/shared.ts), [`instructions/advance.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/advance.ts), [`instructions/property.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/property.ts), [`bindings.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/bindings.ts), [`state.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/state.ts), [`assert.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/assert.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Chunk 06 showed you the artefact: a `template` function of the shape `(rf, ctx) => { … }`
with two `if` blocks in it, sitting inside a `ɵɵdefineComponent` call, next to two bare
integers called `decls` and `vars`. This chunk is why it looks like that.** The function is
called twice with different bit flags — once, ever, to create nodes, and once per
change-detection pass for that view to refresh bindings. The two halves live in one function
because they must agree on the *numbering* of every node and every binding, and the cheapest
way to guarantee agreement is to emit them from one walk of one template AST. That numbering
is not decoration: an Angular view is a plain JavaScript array, node 0 is a fixed offset into
it, and `decls` and `vars` are literally how long each region of that array is. Once you can
see the array, every remaining oddity — why `ɵɵadvance` takes a *delta* rather than an index,
why it refuses to go backwards, why a child's `ngOnInit` fires in the middle of the parent's
bindings — stops being trivia and becomes arithmetic.

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
is the translation. After the header the array is laid out in three regions, and
`view/construction.ts` computes the boundaries in four lines:

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

The blueprint is built once per component type and then `slice()`d for every instance —
copying an array is cheaper than constructing one. Note what it is pre-filled with:

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
what makes every binding compare as changed on its very first update pass.

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
`expandoStartIndex` in `interfaces/view.ts` says it outright, and it is the single best
sentence in this topic:

> *"Unlike the "decls" and "vars" sections of `LView`, the length of this section cannot be
> calculated at compile-time because directives are matched at runtime to preserve locality."*

Node count and binding count are properties of *your* template, which the compiler has in
front of it. How many directives match `<div class="card">` depends on the `imports` of the
component *and* on the definitions of the things it imports — knowledge the compiler
deliberately refuses to require, because requiring it is exactly what locality forbids (chunk
12). So the array is sized precisely up to `expandoStartIndex` and grows past it at runtime as
directives are matched and their `hostVars` are appended.

## The create pass writes slots; the update pass walks them

The create instructions take an explicit index because they are *assigning* addresses. In dev
mode there is an assertion that catches an index in the wrong region, in
`render3/assert.ts`:

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

The update pass, by contrast, passes **no indices at all**. It runs on two implicit cursors,
both stored in the global instruction state rather than in the `LView`:

- **The selected index** — which node subsequent instructions act on. Moved only by
  `ɵɵadvance`, and pre-set to `HEADER_OFFSET` by `executeTemplate`.
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
whole-view corruption rather than one wrong value.

## `ɵɵadvance` is relative, forward-only, and runs your lifecycle hooks

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

Its own docstring carries the canonical example of the emitted shape — this is Angular's
illustration of generated output, not a build I ran:

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
by the definition quoted above this view's `decls` is 3 and its slots are `LView[27]`,
`LView[28]`, `LView[29]`. The update block starts with slot `27` already selected, advances by
a **delta of 2** to reach `29`, and binds there.

🔴 **`assertGreaterThan(delta, 0, 'Can only advance forward')` is the load-bearing line on this
page.** Because the cursor can only move forward, the update block *must* visit nodes in the
same order the create block declared them. There is no addressing mode that lets an update
block jump back to an earlier node, which means the compiler must linearise the template once
and both halves must obey that order. This is the mechanism behind "an Angular template's shape
is fixed at compile time" — not a policy, an addressing limitation.

`ɵɵadvance` also does something people do not expect from a cursor move. `selectIndexInternal`,
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
trace. Note also the `if (!checkNoChangesMode)` guard: the dev-mode verification pass
deliberately **skips** the hook flush, so it is not a faithful replay of the real pass.

## What actually performs the diff

`instructions/property.ts`, verbatim, is fourteen lines that answer four questions at once:

```ts
export function ɵɵproperty<T>(
  propName: string,
  value: T,
  sanitizer?: SanitizerFn | null,
): typeof ɵɵproperty {
  const lView = getLView();
  const bindingIndex = nextBindingIndex();
  if (bindingUpdated(lView, bindingIndex, value)) {
    const tView = getTView();
    const tNode = getSelectedTNode();
    setPropertyAndInputs(tNode, lView, propName, value, lView[RENDERER], sanitizer);
    ngDevMode && storePropertyBindingMetadata(tView.data, tNode, propName, bindingIndex);
  }
  return ɵɵproperty;
}
```

The binding slot is never passed in — `nextBindingIndex()` takes the next one. The node is
never passed in — `getSelectedTNode()` reads the cursor `ɵɵadvance` moved. And the "diff" is
`bindingUpdated`, from `bindings.ts`:

```ts
export function bindingUpdated(lView: LView, bindingIndex: number, value: any): boolean {
  ngDevMode &&
    assertLessThan(bindingIndex, lView.length, `Slot should have been initialized to NO_CHANGE`);

  if (value === NO_CHANGE) {
    return false;
  }

  const oldValue = lView[bindingIndex];

  if (Object.is(oldValue, value)) {
    return false;
  }
  lView[bindingIndex] = value;
  return true;
}
```

*(The real function has an extra `ngDevMode && isInCheckNoChangesMode()` branch between the
`Object.is` check and the write, which raises `ExpressionChangedAfterItHasBeenCheckedError`;
it is elided here only because it is shown in the gotcha below. Everything else is verbatim.)*

**So Angular's diff is `Object.is` against one array slot, per expression.** There is no tree
to walk, no previous vnode to compare, no reconciliation. That single fact is what chunk 08
argues about; here it is enough to see that its granularity is *one binding*, and that its cost
is one array read and one `Object.is` whether the expression is `user.name` or a 40-character
string concatenation. `return ɵɵproperty;` at the end is why emitted code chains:
`ɵɵproperty('name', ctx.name)('title', ctx.title)`.

The doc comment above `ɵɵproperty` contains a locality receipt worth quoting, since it explains
a runtime check that looks like waste:

> *"If the property name also exists as an input property on one of the element's directives,
> the component property will be set instead of the element property. This check must be
> conducted at runtime so child components that add new `@Inputs` don't have to be re-compiled"*

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

**★ Symptom: `ExpressionChangedAfterItHasBeenCheckedError` names a property you did not think
you changed, and it disappears in a production build.** Cause: `bindingUpdated` has a branch
that runs only under `ngDevMode && isInCheckNoChangesMode()`. The verification pass re-runs the
update block and compares each binding slot against the value the real pass stored there; a
mismatch means something mutated state *during* rendering. It vanishes in production because
`ngDevMode` is compiled out — the bug does not vanish, only the report does. Fix: move the
write out of the render pass, usually into a signal computed from its inputs rather than an
assignment in a hook:

```ts
import {Component, input, computed} from '@angular/core';

@Component({
  selector: 'app-order-total',
  template: `<span class="total">{{ total() }}</span>`,
})
export class OrderTotal {
  readonly lines = input.required<ReadonlyArray<{qty: number; price: number}>>();
  protected readonly total = computed(() =>
    this.lines().reduce((sum, line) => sum + line.qty * line.price, 0),
  );
}
```

**★ Symptom: you `push()` onto an array bound into the template and nothing re-renders.**
Cause: the diff is `Object.is(oldValue, value)` against one array slot. A mutated array is the
same reference, so `bindingUpdated` returns `false` and the instruction never runs. Fix: give
it a new reference, which with signals means `update` returning a new array:

```ts
import {Component, signal} from '@angular/core';

interface Todo {
  readonly id: number;
  readonly title: string;
}

@Component({
  selector: 'app-todo-list',
  template: `
    <ul>
      @for (todo of todos(); track todo.id) {
        <li>{{ todo.title }}</li>
      }
    </ul>
    <button type="button" (click)="add()">Add</button>
  `,
})
export class TodoList {
  protected readonly todos = signal<ReadonlyArray<Todo>>([]);

  protected add(): void {
    this.todos.update((current) => [...current, {id: current.length + 1, title: 'New todo'}]);
  }
}
```

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

**Symptom: you reorder two elements in a template and a stale HMR session renders garbage
until you hard-reload.** Cause: reordering changes every subsequent `ɵɵadvance` delta and every
slot index in the create block. A module replaced in place with a new template function but an
`LView` array built from the old `TView` blueprint is addressing the old layout with the new
numbering. Fix: reload the page. Structurally, this is also why generated output is never
hand-editable — the indices are a global allocation, not local names.

**Symptom: you write a `ɵɵdefineComponent` call by hand for a test harness or a micro-benchmark
and get silent misrendering.** Cause: nothing computes `decls` and `vars` for you. They are
compile-time counts the compiler derives from the template AST, and a hand-written def with the
wrong values sizes the array wrongly. Fix: do not hand-write component definitions. If you need
a component built at runtime, use the supported API, which runs the real compiler:

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

**Symptom: you assume one component means one flat slot array, and the numbers in the emitted
output do not add up.** Cause: every embedded view — each `@if` branch, each `@for` row, each
`<ng-template>` — is its **own** `LView` with its own `TView`, its own `decls` and `vars`, and
its own template function with its own `if (rf & 1)` / `if (rf & 2)` pair. The parent's
`decls` counts the *container*, not the contents. Fix: read nested template functions as
separate address spaces; the numbering restarts at 0 in each one.

**Symptom: the array length you observe at runtime is longer than `HEADER_OFFSET + decls +
vars`.** Cause: the expando region past `expandoStartIndex` — injectors, directive instances,
host binding values — is appended as directives are matched. The `createTView` comment says it
plainly: *"This length does not yet contain host bindings from child directives because at this
point, we don't know which directives are active on this template."* Fix: none needed; treat
`initialViewLength` as a floor, not a size.

**Symptom: a dynamically created embedded view shows unbound placeholders until something else
triggers change detection.** Cause: the `RenderFlags` docstring's own caveat — *"dynamically
created views require that the creation block be executed separately from the update block (for
backwards compat)."* Creating the view runs only `RenderFlags.Create`. Fix: run detection on
the view you created:

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

**Symptom: a component appears to have no template function at all when you inspect its def.**
Cause: both call sites guard with `templateFn !== null`, and the comment in `render.ts` says
why — *"A template function might not be defined for the root component views."* Fix: nothing;
a root host view is a real view with no template of its own.

**Symptom: a pipe returns a value and the DOM does not update, with no error anywhere.**
Cause: `bindingUpdated` short-circuits on the sentinel — `if (value === NO_CHANGE) return
false;`. A `PipeTransform` that returns Angular's `NO_CHANGE` token (directly, or by
propagating a value it got from another instruction) is telling the runtime "nothing happened".
Fix: return a real value, including an explicit `undefined`, from `transform`; never plumb an
internal sentinel through user code.

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

**★ What is `decls` counting, and why can the compiler know it when it cannot know how many
directive instances the view will hold?**
`decls` is *"the number of nodes, local refs, and pipes in this component template"* — a
property of the template text, which the compiler is looking at. Directive instances depend on
which directives match each element, which depends on the resolved definitions of everything in
`imports`, which the compiler deliberately refuses to require. Angular's own comment on
`expandoStartIndex` says the length of that region *"cannot be calculated at compile-time
because directives are matched at runtime to preserve locality."* So the array is sized exactly
up to `HEADER_OFFSET + decls + vars` and grows past it at runtime.

**★ Why is `ɵɵadvance` forward-only, and what would change if it were not?**
`ɵɵadvance` asserts `delta > 0` with the message `Can only advance forward`. Forward-only means
the update block must visit nodes in declaration order, which in turn means one linearisation
of the template serves both passes and no per-node index table is needed in the emitted code —
a delta is usually 1, which minifies to nothing. If it could go backwards you would need
absolute indices in the update block, larger output, and a runtime that could no longer assume
a monotonic sweep — which is also what makes the pre-order hook flush inside
`selectIndexInternal` correct, since it fires hooks for everything up to the new index.

**★ What performs the diff in Angular, and what is its granularity?**
`bindingUpdated`, and the granularity is one expression against one array slot. It reads
`lView[bindingIndex]`, compares with `Object.is`, and on a difference writes the new value and
returns `true`; the instruction that called it then touches the DOM. There is no vnode tree and
no reconciliation. The practical consequence is the one that catches people: mutating an object
or array in place produces the same reference, `Object.is` says unchanged, and the DOM is never
touched.

**★ Where does `ExpressionChangedAfterItHasBeenCheckedError` actually come from?**
From a branch inside `bindingUpdated` gated on `ngDevMode && isInCheckNoChangesMode()`. In dev
mode the framework re-runs the update pass in a verification mode and compares each binding
slot with what the real pass left there; a difference means state was mutated during rendering.
Two details worth knowing: it is dev-only, so a production build hides the report but not the
bug; and `checkNoChangesMode` deliberately skips the pre-order hook flush in
`selectIndexInternal`, so the verification pass is not a faithful replay of the real one.

**How does the update pass know which binding slot to use when no instruction is passed one?**
A cursor. `refreshView` calls `setBindingIndex(tView.bindingStartIndex)` immediately before
invoking the template function, and every binding instruction consumes one slot via
`nextBindingIndex()`, which is literally `bindingIndex++`. So the *n*-th binding instruction in
source order always lands in the *n*-th binding slot, and `vars` is the compile-time count of
how many times that increment will run in one pass.

**Why does the first binding in most emitted update blocks have no `ɵɵadvance` in front of it?**
Because `executeTemplate` pre-selects it. Its comment: *"When we're updating, inherently select
0 so we don't have to generate that instruction for most update blocks."* Slot `HEADER_OFFSET`
is already selected before the update half runs, so an `advance` is only emitted when the first
binding is not on node 0.

**What is in a binding slot before the first update pass, and why does it matter?**
`NO_CHANGE`. `createViewBlueprint` fills declaration slots with `null` and binding slots with
the `NO_CHANGE` sentinel, so on the first update pass `Object.is(NO_CHANGE, value)` is false
for any real value and every binding is treated as changed — which is exactly what you want the
first time through. `bindingUpdated` also treats an incoming `value === NO_CHANGE` as "no
update", which is how instructions signal "nothing to do" without an extra flag.

**Why can generated template code never be hand-edited, even to fix an obvious mistake?**
Because the indices are a global allocation across the whole view, not local names. Inserting
one node shifts every later slot index in the create block, changes at least one `ɵɵadvance`
delta in the update block, and changes `decls` — and `decls` sizes the array that both halves
address. Three coordinated edits, any one of which silently misaddresses the array in a
production build where every range assertion has been compiled out.

**If you saw `if (rf & 1)` and `if (rf & 2)` in a bundle with no symbol names, how would you
know which was which?**
`RenderFlags` is a `const enum`, so the values are inlined and the enum itself does not exist at
runtime: `Create = 0b01` and `Update = 0b10`. `1` is the creation block, `2` is the update
block. Corroborate it from the contents — the `1` branch contains element and text creation
with explicit integer indices, and the `2` branch contains `advance` and binding calls with no
indices at all.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **08 · Instructions, not a virtual DOM** *(not written yet)*
