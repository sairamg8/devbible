---
title: "Adding `CommonModule` is the v14 reflex that Angular's own compiler still suggests and Angular's own migration guide contradicts — both sentences ship in v22.1.5, and the guide is the one to follow"
sidebar_label: "06e · The CommonModule anti-fix"
sidebar_position: 6.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev —
> [Control flow migration](https://angular.dev/reference/migrations/control-flow),
> [Built-in control flow](https://angular.dev/guide/templates/control-flow),
> [NG8113](https://angular.dev/extended-diagnostics/NG8113) — and `angular/angular` at tag `v22.1.5`:
> [`typecheck/extended/checks/missing_control_flow_directive/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/extended/checks/missing_control_flow_directive/index.ts),
> [`common/src/common_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/src/common_module.ts),
> [`common/src/directives/ng_if.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/src/directives/ng_if.ts),
> [`validation/src/rules/unused_standalone_imports_rule.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is what people reach for when the error will not go away, and it is wrong for the reason it is
chosen. `CommonModule` fixes an unknown *element* never — it exports directives and pipes, not
components — and fixes an unknown *property* only by pulling in twenty-four symbols to reach one,
three of which are deprecated. Angular's own DOM schema checker still recommends it in the `ng-`
branch of NG8002, and Angular's own control-flow migration says you no longer need it: both sentences
ship in v22.1.5 and neither is a bug, because the schema checker has no way to know you meant `@if`.
Worst of all, `imports: [CommonModule]` is the one import that Angular's unused-import diagnostic is
structurally unable to see, so it is the one that rots silently for years.**

## Four reasons it is the wrong default in v22

The reflex was correct in v14: `*ngIf`, `*ngFor`, `async` and the pipes all came from one module, and
one import restored all of them.

**(a) Built-in control flow is template syntax with nothing to import.** angular.dev's control-flow
migration, verbatim:

> *"[Control flow syntax](guide/templates/control-flow) is available from Angular v17. The new syntax
> is baked into the template, so you don't need to import `CommonModule` anymore."*

Supporting observation about the document itself: angular.dev's control-flow guide describes `@if`,
`@for`, `@switch` and `@let` without ever mentioning an import, because there is nothing to import.

**(b) Angular's own diagnostic now recommends the built-in first.** NG8103 is assembled from this
template — note the order of its two suggestions:

```ts
const errorMessage = formatExtendedError(
  ErrorCode.MISSING_CONTROL_FLOW_DIRECTIVE,
  `The \`*${controlFlowAttr.name}\` directive was used in the template, ` +
    `but neither the \`${directiveAndBuiltIn?.directive}\` directive nor the \`CommonModule\` was imported. ` +
    `Use Angular's built-in control flow ${directiveAndBuiltIn?.builtIn} or ` +
    `make sure that either the \`${directiveAndBuiltIn?.directive}\` directive or the \`CommonModule\` ` +
    `is included in the \`@Component.imports\` array of this component.`,
);
```

driven by this map:

```ts
export const KNOWN_CONTROL_FLOW_DIRECTIVES = new Map([
  ['ngIf', {directive: 'NgIf', builtIn: '@if'}],
  ['ngFor', {directive: 'NgFor', builtIn: '@for'}],
  ['ngSwitchCase', {directive: 'NgSwitchCase', builtIn: '@switch with @case'}],
  ['ngSwitchDefault', {directive: 'NgSwitchDefault', builtIn: '@switch with @default'}],
]);
```

**(c) `NgIf`, `NgFor` and `NgSwitch` are themselves deprecated.** Verbatim from `ng_if.ts` at v22.1.5:

> *"@deprecated 20.0 Use the `@if` block instead. Intent to remove in a future major release"*

**(d) `CommonModule` is a bundle of twenty-four symbols** — eleven directives and thirteen pipes — and
the module class is nothing but a re-export:

```ts
@NgModule({
  imports: [COMMON_DIRECTIVES, COMMON_PIPES],
  exports: [COMMON_DIRECTIVES, COMMON_PIPES],
})
export class CommonModule {}
```

🔴 **And the diagnostic that would tell you it went stale is blind to it.** NG8113
(`unusedStandaloneImports`) only inspects entries that resolve to a *directive* or a *pipe*;
`CommonModule` resolves to neither, so `imports: [CommonModule]` never produces a warning no matter
how long ago the last `*ngIf` left the template. It is also why
`ng generate @angular/core:cleanup-unused-imports` will not remove it — the schematic reads NG8113's
output back out and can only delete what that rule can see.

## What you actually wanted

| You reached for `CommonModule` because of | The v22 answer |
|---|---|
| `*ngIf` | `@if` — no import |
| `*ngFor` | `@for` — no import, and `track` is required |
| `[ngSwitch]` | `@switch` — no import |
| `async` pipe | `import { AsyncPipe } from '@angular/common'` |
| `date`, `currency`, `json`, `keyvalue`, `slice`, … | import the individual pipe class |
| `ngClass` / `ngStyle` | `NgClass` / `NgStyle` — **not** deprecated in 22.1.5; the `ngclass-to-class` and `ngstyle-to-style` schematics move you to plain `class` / `style` bindings, which need no import |
| `ngTemplateOutlet` / `ngComponentOutlet` | `NgTemplateOutlet` / `NgComponentOutlet` — no built-in replacement exists |

```ts
import { Component, input } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';

@Component({
  selector: 'app-order-list',
  imports: [AsyncPipe, DatePipe],
  template: `
    @for (order of orders(); track order.id) {
      <p>{{ order.placedAt | date }} — {{ order.total$ | async }}</p>
    } @empty {
      <p>No orders yet.</p>
    }
  `,
})
export class OrderList {
  readonly orders = input.required<readonly Order[]>();
}
```

The two survivors in that table are worth stating plainly, because both are commonly mis-reported:
**`NgClass` and `NgStyle` are not deprecated in 22.1.5**, despite the schematics that move you off
them, and **`NgTemplateOutlet` and `NgComponentOutlet` have no block equivalent at all** — for those
two, importing the class is the modern answer and always will be until a replacement exists.

## Gotchas

**★ Symptom: the compiler tells you to add `CommonModule` while the migration guide tells you it is no
longer needed.** Cause: both statements ship in v22.1.5 and neither is a bug — the DOM schema checker
cannot know you meant `@if`, and its `ng-` branch predates built-in control flow. Fix: follow the
guide, not the diagnostic; convert the structural directive to a block. The compiler's suggestion is
the only one of its numbered lines that has aged.

**★ Symptom: `[ngIf]="cond"` produces a hard error instead of the friendlier NG8103 warning.** Cause:
NG8103's own class doc scopes it to structural-directive syntax, verbatim: *"this check only handles
the cases when structural directive syntax is used (e.g. `*ngIf`). Regular binding syntax (e.g.
`[ngIf]`) is handled separately in type checker and treated as a hard error instead of a warning."*
Fix: use `@if`, or import `NgIf` explicitly if you are mid-migration:

```ts
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-panel',
  imports: [NgIf],
  template: `<ng-container [ngIf]="ready()">Ready</ng-container>`,
})
export class Panel {
  readonly ready = input(false);
}
```

**★ Symptom: `imports: [CommonModule]` sits in a component that has used `@if` for a year and nothing
warns.** Cause: NG8113 only inspects entries that resolve to a directive or a pipe; `CommonModule` is
an `NgModule` and is skipped entirely. Fix: delete it by hand — no diagnostic and no schematic will
find it for you. Import the individual classes instead, so the next time one goes unused NG8113 can
say so:

```ts
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-live-total',
  imports: [AsyncPipe],
  template: `<strong>{{ total$ | async }}</strong>`,
})
export class LiveTotal {
  readonly total$ = inject(CartService).total$;
}
```

**★ Symptom: `*ngSwitch` produces no warning while `*ngSwitchCase` does.** Cause: NG8103's map
deliberately omits `ngSwitch`, and the class doc says why, verbatim: *"there is no `ngSwitch` here
since it's typically used as a regular binding (e.g. `[ngSwitch]`), however the `ngSwitchCase` and
`ngSwitchDefault` are used as structural directives and a warning would be generated."* Fix: convert
the whole construct to `@switch`, which has no directives to import at all:

```ts
@Component({
  selector: 'app-status',
  template: `
    @switch (state()) {
      @case ('loading') { <p>Loading…</p> }
      @case ('error') { <p>Something went wrong.</p> }
      @default { <p>Ready.</p> }
    }
  `,
})
export class Status {
  readonly state = input<'loading' | 'error' | 'ready'>('loading');
}
```

**★ Symptom: NG8103 never appears on a component you know is missing `NgIf`.** Cause: the check bails
out on non-standalone components — verbatim from the rule, *"Avoid running this check for
non-standalone components."* Fix: the component carries `standalone: false`, so you get the blunter
DOM schema error instead. Removing the flag restores the better diagnostic along with everything else
standalone gives you.

**★ Symptom: you replaced `*ngFor` with `@for` and the build fails on the block itself.** Cause:
`@for` requires a `track` expression; there is no untracked form. Fix: name a stable identity, and use
`$index` only when the collection genuinely has no key:

```ts
@Component({
  selector: 'app-tag-list',
  template: `
    @for (tag of tags(); track tag.id) {
      <span class="tag">{{ tag.label }}</span>
    }
  `,
})
export class TagList {
  readonly tags = input.required<readonly { id: string; label: string }[]>();
}
```

## Interview questions

**★ Adding `CommonModule` used to fix this. Why is it usually wrong now, and when is it still right?**
It was never a fix for an unknown *element* — `CommonModule` exports directives and pipes, not
components. For an unknown property it was the v14 answer because `*ngIf`, `*ngFor` and the pipes all
lived there. In v22 the control-flow half is template syntax that needs no import, `NgIf` / `NgFor` /
`NgSwitch` are deprecated since 20.0, and importing the module pulls in twenty-four symbols to reach
one. It is still defensible in exactly one situation: a file mid-migration that genuinely uses several
members and is not worth converting yet. Even then, importing the individual classes is better,
because NG8113 can then tell you when they go unused — which it can never do for the module.

**★ Why does `imports: [CommonModule]` never produce an unused-import warning?**
Because NG8113 resolves each entry with `getDirectiveMetadata` and `getPipeMetadata` and skips
anything that is neither. `CommonModule` is an `NgModule`, so the rule passes over it silently. The
consequence is asymmetric rot: an unused `AsyncPipe` import gets flagged, an unused `CommonModule`
import does not, and the cleanup schematic — which simply reads NG8113's output back — inherits the
same blind spot. It is the strongest practical argument for importing individual classes.

**★ Why can't the compiler just tell you "you meant `@if`" in the `<ng-container *ngIf>` case?**
Two different checkers with different information. The DOM schema check only knows that a property
name did not resolve on a tag, and its `ng-` branch was written before built-in control flow existed.
The checker that *does* know is NG8103, which carries a map of `ngIf → @if`, `ngFor → @for`,
`ngSwitchCase → @switch with @case` and recommends the block first. It is an extended diagnostic, it
bails out entirely on non-standalone components, and it only handles structural-directive syntax — so
which of the two messages you get for the same mistake depends on which checker reached it first.

**Angular ships a compiler that recommends `CommonModule` and a guide that says you do not need it.
How should a reference page handle that?**
By naming the disagreement and saying which source is authoritative. Both texts are in the shipped
v22.1.5 tree, and the collision is structural: the DOM schema checker cannot infer intent, so its
advice is generic and dated, while the migration guide is written against the current syntax. The
guide is the one to follow. Silently repeating either one — as most search results do — is how the
reflex survives a decade.

**Which members of `CommonModule` still have no built-in replacement, and what follows from that?**
`NgTemplateOutlet` and `NgComponentOutlet`, plus the pipes. It follows that "never import from
`@angular/common`" is the wrong lesson to take from this page — the right one is "import the class,
not the module". `NgClass` and `NgStyle` are a middle case: not deprecated in 22.1.5, but with
`ngclass-to-class` and `ngstyle-to-style` schematics that move you to plain `class` and `style`
bindings, which need no import at all.

**Why is `track` mandatory in `@for` when `*ngFor` made `trackBy` optional?**
Because the block is compiled rather than interpreted, so the identity function is part of the
generated code rather than an optional input read at runtime. Making it required removes the most
common source of list-rendering bugs — silent full re-creation of DOM nodes — at the cost of one
expression per loop. It is the clearest single example of the built-in blocks being able to demand
things a directive could only suggest.

---

← Prev: [Legacy declarables and custom elements](06d-legacy-declarables-and-custom-elements.md) · Index: [Topic index](README.md) · Next → [What `schemas` actually does](06f-what-schemas-actually-does.md)
