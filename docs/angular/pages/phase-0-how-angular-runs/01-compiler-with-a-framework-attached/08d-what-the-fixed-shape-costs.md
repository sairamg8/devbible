---
title: "The first half of the bill for deleting the tree is a template whose slot count is decided when the build runs and markup that no code of yours may produce — which is why `@if` and `@for` are constructs rather than sugar, and why `track` is mandatory instead of an optimisation"
sidebar_label: "08d · What the fixed shape costs"
sidebar_position: 8.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler/src/render3/r3_identifiers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_identifiers.ts) (the two distinct `ɵɵrepeaterTrackBy*` external references, read directly in the file at this tag).
> Documentation-validated; **no sandbox run** — every code block below is ordinary application code or source read from a named file.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A page that lists only the wins is a sales page. This is the other half. Deleting the vnode tree
buys everything [08b](08b-the-selector-problem-and-reference-inversion.md) and
[08c](08c-the-instruction-set-is-a-la-carte.md) describe, and the first instalment of the bill is
two constraints that shape how every non-trivial Angular feature has to be written: the number of
slots a template uses is fixed when the build runs, and markup cannot be produced by code. Neither
is a rough edge to be smoothed later — both fall directly out of `decls` and `vars` being integer
literals and `ɵɵadvance` being forward-only. They are why `@if` and `@for` are language constructs
rather than sugar over JavaScript, and why `track` is compulsory when a keyed reconciler treats keys
as optional.**

## Cost 1 — the template's shape is fixed when the build runs

`decls` and `vars` are integer literals in the definition
([06c](06c-decls-vars-consts-and-dependencies.md)), and they are exactly the lengths of two regions
of the `LView` array ([07b](07b-the-view-is-an-array-decls-and-vars.md)). `ɵɵadvance` takes a
positive delta and asserts on it ([07d](07d-advance-is-relative-and-forward-only.md)). Put those
together: **a template function must touch the same slots, in the same order, on every update
pass.** A vnode render function is free to return a five-node tree this time and a two-node tree
next time, because the reconciler will work out the difference. Angular has nothing that could work
it out.

So every structure whose *shape* varies has to become a different view rather than a different path
through the same one. That is what `@if`, `@for`, `@switch` and `@defer` are: not sugar over an
`if`, but constructs that create and destroy **embedded views**, each with its own slot count and
its own `LView`. The cost is not that you type `@if` instead of a ternary — it is that anything
shape-varying you invent must be expressed as one of these, because there is no lower-level
primitive you are permitted to reach for.

## Cost 2 — you cannot compute a template

The `template` (or `templateUrl`) in a `@Component` has to be there for the compiler to read at
build time, in the source file, as a literal. Chunk 01 established this as the separate-language
rule and chunk 09 establishes it as the static-analysability rule; the consequence here is narrower
and blunter: **there is no `render()` you can write.** No method returns markup. No helper assembles
a fragment. No expression produces "some template" that Angular then renders.

What you get instead is a template *reference* that can be passed around as a value — but it too is
a compiled artefact, produced by the compiler from a block you wrote in a template:

```ts
import {Component, TemplateRef, viewChild} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';

interface Row {
  readonly id: number;
  readonly label: string;
}

@Component({
  selector: 'app-row-list',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #compact let-row>
      <span class="compact">{{ row.label }}</span>
    </ng-template>

    <ng-template #detailed let-row>
      <div class="detailed">
        <strong>{{ row.label }}</strong>
        <small>#{{ row.id }}</small>
      </div>
    </ng-template>

    @for (row of rows; track row.id) {
      <ng-container
        [ngTemplateOutlet]="dense ? compact() : detailed()"
        [ngTemplateOutletContext]="{$implicit: row}"
      />
    }
  `,
})
export class RowList {
  protected readonly dense = false;
  protected readonly rows: ReadonlyArray<Row> = [
    {id: 1, label: 'First'},
    {id: 2, label: 'Second'},
  ];

  // Both are compiled template functions. You choose BETWEEN them; you cannot build one.
  private readonly compact = viewChild.required<TemplateRef<{$implicit: Row}>>('compact');
  private readonly detailed = viewChild.required<TemplateRef<{$implicit: Row}>>('detailed');
}
```

Read what that does and does not give you. It gives you **selection among templates the compiler
already saw**. It does not give you construction. Every branch has to exist in source, which is the
same rule from the other side: [08e](08e-only-compiled-classes-are-renderable.md) shows what happens
when you try to escape it with a string.

## Gotchas

**★ Symptom: the build fails telling you the `@for` block needs a `track` expression, and you resent it because your previous framework treated keys as optional.** Cause: a reconciler that holds both the previous and the next tree can always fall back to matching children by position, using the key only to do better. Angular holds neither. What it has is a set of live embedded views, each owning real DOM and real component instances, so when the collection changes it must decide which existing view belongs to which new item — a question with no positional answer once items can move. Identity is therefore not inferable; it has to be stated. The compiler even resolves your choice to a different symbol: `ɵɵrepeaterTrackByIndex` and `ɵɵrepeaterTrackByIdentity` are two separate entries in the instruction table. Fix: track something stable across reorderings, and treat `$index` as correct only for a list that never reorders:

```ts
import {Component, signal} from '@angular/core';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

@Component({
  selector: 'app-ticket-board',
  template: `
    <ul>
      @for (ticket of tickets(); track ticket.id) {
        <li><input [value]="ticket.title" /></li>
      } @empty {
        <li class="empty">No tickets</li>
      }
    </ul>
  `,
})
export class TicketBoard {
  // `track ticket.id` keeps each <li> — and the focus and scroll state inside it —
  // attached to its ticket across a reorder. `track $index` would reassign them.
  protected readonly tickets = signal<ReadonlyArray<Ticket>>([
    {id: 'T-1', title: 'Login fails'},
    {id: 'T-2', title: 'Slow report'},
  ]);
}
```

**★ Symptom: you wrote a method on the component that returns a fragment of markup, and there is no way to render its result.** Cause: cost 2 — there is no value in the system that means "some template". A method can return data, a class, or a `TemplateRef` you obtained from a compiled `ng-template`, but never markup. Fix: put the fragment in an `ng-template` and pass the reference, with a typed context so the consumer knows what it will be handed:

```ts
import {Component, TemplateRef, input} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';

@Component({
  selector: 'app-empty-state',
  imports: [NgTemplateOutlet],
  template: `
    <div class="empty">
      <p>{{ message() }}</p>
      <ng-container [ngTemplateOutlet]="action()" [ngTemplateOutletContext]="{$implicit: message()}" />
    </div>
  `,
})
export class EmptyState {
  readonly message = input.required<string>();
  // A compiled template handed in by the parent — not markup this class produced.
  readonly action = input.required<TemplateRef<{$implicit: string}>>();
}
```

**Symptom: a component renders correctly and then throws a range assertion once a condition flips, and you had "simplified" a structural block away.** Cause: cost 1 — the slot count is fixed, so anything that changes the *number* of nodes has to be a view boundary. Varying values inside a fixed shape is free; adding or removing nodes without a structural construct breaks the contract the emitted indices depend on ([07c](07c-how-instructions-address-the-array.md)). Fix: keep the structural construct and vary only values inside it:

```html
@if (banner(); as text) {
  <aside class="banner">{{ text }}</aside>
}
<p class="body">{{ body() }}</p>
```

**Symptom: a child component's state — an open dropdown, a half-typed input, a scroll position — resets whenever the parent's list re-sorts, even though the same items are present.** Cause: the same missing-identity problem, but in its silent form rather than its build-error form. `track $index` compiles, so the build passes; at runtime the view that was showing item A is reused for whatever item now sits at that index, and the DOM inside it comes along. Fix: track the item's own key, and if the collection genuinely has no stable key, give it one at the boundary where it enters your application:

```ts
import {Injectable} from '@angular/core';

interface RawRow {
  readonly sku: string;
  readonly qty: number;
}

export interface KeyedRow extends RawRow {
  readonly key: string;
}

@Injectable({providedIn: 'root'})
export class RowKeyer {
  // Assign identity once, at the edge, so every `@for` downstream can track it.
  keyRows(rows: ReadonlyArray<RawRow>): ReadonlyArray<KeyedRow> {
    return rows.map((row, index) => ({...row, key: `${row.sku}#${index}`}));
  }
}
```

## Interview questions

**★ What can a virtual-DOM framework do that an instruction stream structurally cannot, and how does Angular cover the gap?**
Three things, all consequences of the tree being a value. It can produce markup with ordinary
control flow, because a render function returns a tree and any expression can build one. It can
return a *differently shaped* tree on a later render, because the reconciler works out the
difference. And it can hand that tree to anything — a test asserter, a serialiser, an alternative
renderer. Angular can do none of those directly: the template function returns `void`, the slot
counts `decls` and `vars` are baked into the definition, and `ɵɵadvance` only moves forward. It
covers the gap with first-class constructs that each create a *new view* rather than reshaping an
existing one — `@if`, `@for`, `@switch`, `@defer`, `ng-template` with `ngTemplateOutlet`, and
`ViewContainerRef`. The gap it does not cover is construction: you can select among compiled
templates, never build one.

**★ Why does `@for` require a `track` expression when keyed reconcilers treat keys as optional?**
Because a reconciler that has both the previous and the next tree can always fall back to matching
children by position, and use the key only to do better. Angular has no previous tree. What it has
is a set of live embedded views, each holding real DOM and real component instances, and when the
collection changes it must decide which existing view corresponds to which new item — a question
with no positional answer once items can move. So `track` is not a performance hint that may be
omitted, it is the only source of identity in the system, and the compiler treats supplying it as a
compile-time decision: `ɵɵrepeaterTrackByIndex` and `ɵɵrepeaterTrackByIdentity` are distinct entries
in the instruction table. The practical rule is that `$index` is correct only for a list that never
reorders, because otherwise state living inside a row — focus, scroll position, an open menu — gets
reassigned to a different item.

**★ Why is there no `render()` method in Angular, and what is the closest thing?**
Because the compiler has to read the template at build time to emit instruction calls and to
determine the dependency list; a template produced at runtime by your code is invisible to it. The
closest thing is a `TemplateRef`, but it is not the substitute people hope for: a `TemplateRef` is a
*compiled* template function that the compiler produced from an `ng-template` block you wrote in
source, wrapped so it can be instantiated into an embedded view at a chosen place. You can pass it
around, hand it to a child as an input, and render it with `ngTemplateOutlet` and a context object.
What you cannot do is manufacture one. Every branch that could ever render has to exist somewhere in
your source.

**If `decls` and `vars` are fixed integers, how does an `@if` block change the number of nodes on screen without violating that?**
It does not change the number of nodes in *its own* view. The `@if` block compiles to a container
in the parent's slot layout — a fixed slot — and the branch's content becomes a **separate** view
with its own `decls`, its own `vars` and its own `LView` array, created and destroyed as the
condition flips. The parent's shape never changes; what changes is how many child views are attached
at that container. That is the general trick behind every structural construct in the language, and
it is why they cannot be expressed as ordinary expressions: an expression can produce a value, but
only a construct can introduce a view boundary.

---

← Prev: [08c · The instruction set is à la carte](08c-the-instruction-set-is-a-la-carte.md) · Index: [Topic index](README.md) · Next → [08e · Only compiled classes are renderable](08e-only-compiled-classes-are-renderable.md)
