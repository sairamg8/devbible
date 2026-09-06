---
title: "Angular's entire diff is `Object.is` against one array slot per expression — `bindingUpdated` is nine lines long, there is no tree to walk and no previous vnode to compare, and every surprise people have about mutation, pipes and `ExpressionChangedAfterItHasBeenChecked` falls out of those nine lines"
sidebar_label: "07e · What performs the diff"
sidebar_position: 7.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`core/src/render3/instructions/property.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/instructions/property.ts), [`bindings.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/bindings.ts), [`view/construction.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/view/construction.ts), [`state.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/state.ts) — and MDN for [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) semantics.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Everything the previous four chunks built — the two-call template function, the array, the two
cursors, the forward-only sweep — exists to deliver one value to one function. That function is
`bindingUpdated`, it is nine lines long, and it compares the new value against the one array
slot the cursor is on using `Object.is`.** There is no virtual DOM, no previous tree, no
reconciliation and no heuristic. Which means the whole of Angular's change-detection *behaviour*
— that mutating an array does nothing, that an expensive getter still runs, that
`ExpressionChangedAfterItHasBeenCheckedError` is dev-only, that a pipe returning the wrong
sentinel silently freezes a binding — is readable off nine lines of source.

## The instruction, and what it does not carry

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
never passed in — `getSelectedTNode()` reads the cursor `ɵɵadvance` moved
([07d](07d-advance-is-relative-and-forward-only.md)), and `setPropertyAndInputs` then decides at
runtime whether the write is an element property or a directive input
([07c](07c-how-instructions-address-the-array.md)). And note the ordering: `value` is a
**parameter**, so your expression has already been evaluated by the time anything is compared.
`bindingUpdated` guards the DOM write, not the evaluation.

`return ɵɵproperty;` at the end is why emitted code chains, and the docstring says so
explicitly:

> *"@returns This function returns itself so that it may be chained
> (e.g. `property('name', ctx.name)('title', ctx.title)`)"*

That chaining is also why a run of bindings on one element emits no `ɵɵadvance` between them.

## `bindingUpdated` — the nine lines

From `bindings.ts`:

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

**So Angular's diff is `Object.is` against one array slot, per expression.** Its granularity is
*one binding*, and its cost is one array read and one `Object.is` whether the expression is
`user.name` or a 40-character string concatenation. Three consequences are worth stating
separately, because each is a different bug people file:

- **The incoming `NO_CHANGE` sentinel short-circuits before anything else.** That is how an
  instruction signals "nothing to do here" without an extra flag or a second return channel.
- **The old value comes from the slot, and the slot started life as `NO_CHANGE`** — that is what
  `createViewBlueprint` fills the binding region with
  ([07b](07b-the-view-is-an-array-decls-and-vars.md)), so the first update pass compares
  `Object.is(NO_CHANGE, anything)`, gets `false`, and treats every binding as changed.
- **`Object.is` is not `===`.** `Object.is(NaN, NaN)` is `true` and `Object.is(0, -0)` is
  `false` — the two cases where the two operators disagree, and both are reachable from ordinary
  arithmetic in a template. The source does not state a rationale for choosing it; what it
  states is the behaviour, and the behaviour is what you have to reason against.

## Gotchas

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

**★ Symptom: an expensive getter bound in a template runs on every change-detection pass even
though its result never changes, and you expected the diff to prevent that.** Cause: read the
call order in `ɵɵproperty` — `value` is a *parameter*. The expression is evaluated at the call
site, in the emitted update block, before `bindingUpdated` is reached. The diff decides whether
the **DOM is written**, never whether your code runs. Fix: memoise on the class with a
`computed()`, which does have a cheap "has anything I depend on changed" answer:

```ts
import {Component, input, computed} from '@angular/core';

@Component({
  selector: 'app-invoice',
  template: `<p class="summary">{{ summary() }}</p>`,
})
export class Invoice {
  readonly rows = input.required<ReadonlyArray<{label: string; cents: number}>>();

  // Recomputed only when `rows` changes, not once per change-detection pass.
  protected readonly summary = computed(() => {
    const rows = this.rows();
    const total = rows.reduce((sum, row) => sum + row.cents, 0);
    return `${rows.length} lines · ${(total / 100).toFixed(2)}`;
  });
}
```

**Symptom: a pipe returns a value and the DOM does not update, with no error anywhere.**
Cause: `bindingUpdated` short-circuits on the sentinel — `if (value === NO_CHANGE) return
false;`. A `PipeTransform` that returns Angular's `NO_CHANGE` token (directly, or by
propagating a value it got from another instruction) is telling the runtime "nothing happened".
Fix: return a real value, including an explicit `undefined`, from `transform`; never plumb an
internal sentinel through user code:

```ts
import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'initials'})
export class InitialsPipe implements PipeTransform {
  transform(name: string | null | undefined): string | undefined {
    if (!name) {
      return undefined; // an explicit value, not a sentinel
    }
    return name
      .split(' ')
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
```

**Symptom: a numeric binding that recomputes to `NaN` on every pass never re-renders, and a
binding that flips between `0` and `-0` re-renders every time.** Cause: `Object.is`, not `===`.
`Object.is(NaN, NaN)` is `true`, so once a slot holds `NaN` the binding is considered unchanged
forever; `Object.is(0, -0)` is `false`, so a value oscillating between the two zeroes writes to
the DOM on every pass. Fix: normalise in the expression rather than relying on the comparison:

```ts
import {Component, input, computed} from '@angular/core';

@Component({selector: 'app-delta', template: `<span>{{ delta() }}</span>`})
export class Delta {
  readonly raw = input.required<number>();

  // `-0 + 0` is `+0`; `Number.isNaN` gives NaN an explicit, comparable stand-in.
  protected readonly delta = computed(() => {
    const value = this.raw();
    return Number.isNaN(value) ? null : value + 0;
  });
}
```

**Symptom: you replace an object's contents but keep the reference because "Angular does a deep
check anyway".** Cause: it does not. There is nothing in `bindingUpdated` that walks a value —
one array read, one `Object.is`, one write. Angular has never had a deep comparison at the
binding level, and the granularity is per-expression, so there is nothing that could walk a
structure even in principle without changing what a "binding" is. Fix: treat every value you
bind as immutable, or bind the individual fields so each gets its own slot.

## Interview questions

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

**★ Does the change detector avoid *evaluating* your template expression when nothing has
changed?**
No, and this is the single most consequential misreading of Angular's change detection. Look at
the signature: `ɵɵproperty(propName, value)` takes `value` as an argument, so the emitted update
block has already evaluated `ctx.expensiveGetter` before `bindingUpdated` is called. The diff
gates the *DOM write* and the input propagation, not the expression. Anything expensive in a
template runs once per binding per change-detection pass for that view, and the only way to stop
that is to make the expression itself cheap — a `computed()` read, or a field.

**What is in a binding slot before the first update pass, and why does it matter?**
`NO_CHANGE`. `createViewBlueprint` fills declaration slots with `null` and binding slots with
the `NO_CHANGE` sentinel, so on the first update pass `Object.is(NO_CHANGE, value)` is false
for any real value and every binding is treated as changed — which is exactly what you want the
first time through. `bindingUpdated` also treats an *incoming* `value === NO_CHANGE` as "no
update", which is how instructions signal "nothing to do" without an extra flag, and which is
why leaking that token out of a pipe silently freezes a binding.

**Why `Object.is` rather than `===`, and when does the choice become visible?**
The source uses `Object.is` and states no rationale, so take the behaviour rather than the
reasoning. It differs from `===` in exactly two cases, and both are reachable from ordinary
template arithmetic: `NaN` compares equal to itself under `Object.is`, so a binding that
recomputes to `NaN` stops updating; and `+0` and `-0` compare *unequal*, so a value oscillating
between them writes to the DOM every pass. With `===` those two behaviours would be exactly
reversed.

---

← Prev: [07d · `ɵɵadvance` is relative and forward-only](07d-advance-is-relative-and-forward-only.md) · Index: [Topic index](README.md) · Next → **08 · Instructions, not a virtual DOM** *(not written yet)*
