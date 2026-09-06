---
title: "Adding `CommonModule` is the v14 reflex the compiler itself still suggests and Angular's own migration guide contradicts — and `schemas` is not a hint, it is two early returns inside the DOM registry"
sidebar_label: "06e · CommonModule and schemas"
sidebar_position: 6.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev —
> [Control flow migration](https://angular.dev/reference/migrations/control-flow),
> [Built-in control flow](https://angular.dev/guide/templates/control-flow),
> [NG8002 Invalid Attribute](https://angular.dev/errors/NG8002) — and `angular/angular` at tag
> `v22.1.5`:
> [`compiler/src/schema/dom_element_schema_registry.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/schema/dom_element_schema_registry.ts),
> [`core/src/metadata/schema.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/schema.ts),
> [`typecheck/extended/checks/missing_control_flow_directive/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/extended/checks/missing_control_flow_directive/index.ts),
> [`common/src/common_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/src/common_module.ts),
> [`common/src/directives/ng_if.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/src/directives/ng_if.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**These are the two things people reach for when the error will not go away, and both are usually
wrong for the reason they are chosen. `CommonModule` fixes an unknown *element* never — it exports
directives and pipes, not components — and fixes an unknown *property* only by pulling in
twenty-four symbols to reach one, three of which are deprecated. Angular's own DOM schema checker
still recommends it in one branch, and Angular's own migration guide says you no longer need it: both
sentences ship in v22.1.5 and neither is a bug. A schema is a real fix, but a much narrower one than
its reputation — `CUSTOM_ELEMENTS_SCHEMA` is consulted only for tags whose normalised name contains a
hyphen, and `NO_ERRORS_SCHEMA` is a short-circuit that turns off both checks for the entire component.
Worst of all, `imports: [CommonModule]` is the one import Angular's unused-import diagnostic is
structurally unable to see, so it is the one that rots silently.**

## 🔴 The anti-fix: adding `CommonModule`

The v14-era reflex was correct then: `*ngIf`, `*ngFor`, `async` and the pipes all came from one
module, and one import restored all of them. Four independent pieces of evidence say it is the wrong
default in v22.

**(a) Built-in control flow is template syntax with nothing to import.** angular.dev's control-flow
migration, verbatim:

> *"[Control flow syntax](guide/templates/control-flow) is available from Angular v17. The new syntax
> is baked into the template, so you don't need to import `CommonModule` anymore."*

Supporting observation about the document itself: angular.dev's control-flow guide describes `@if`,
`@for`, `@switch` and `@let` without ever mentioning an import, because there is nothing to import.

**(b) Angular's own diagnostic now recommends the built-in first.** NG8103 is assembled from this
template, and note the order of its two suggestions:

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
`ng generate @angular/core:cleanup-unused-imports` will not remove it — the schematic reads NG8113
back out and can only delete what that rule can see.

What you actually wanted, and what to write instead:

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

## What `schemas` actually does

Two tokens, both still exported from `@angular/core` 22.1.5. Their doc comments, verbatim:

```ts
/**
 * Defines a schema that allows an NgModule to contain the following:
 * - Non-Angular elements named with dash case (`-`).
 * - Element properties named with dash case (`-`).
 * Dash case is the naming convention for custom elements.
 */
export const CUSTOM_ELEMENTS_SCHEMA: SchemaMetadata = {name: 'custom-elements'};

/**
 * Defines a schema that allows any property on any element.
 *
 * This schema allows you to ignore the errors related to any unknown elements or properties in a
 * template. The usage of this schema is generally discouraged because it prevents useful validation
 * and may hide real errors in your template. Consider using the `CUSTOM_ELEMENTS_SCHEMA` instead.
 */
export const NO_ERRORS_SCHEMA: SchemaMetadata = {name: 'no-errors-schema'};
```

They are not hints. They are early returns inside the registry:

```ts
override hasElement(tagName: string, schemaMetas: SchemaMetadata[]): boolean {
  if (schemaMetas.some((schema) => schema.name === NO_ERRORS_SCHEMA.name)) {
    return true;
  }

  const normalizedTag = normalizeTagName(tagName);
  if (normalizedTag.includes('-')) {
    if (isNgContainer(normalizedTag) || isNgContent(normalizedTag)) {
      return true;
    }

    if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
      // Allow any custom elements
      return true;
    }
  }

  return this._schema.has(normalizedTag);
}
```

Read the guard: 🔴 **`CUSTOM_ELEMENTS_SCHEMA` is only consulted when the normalised tag contains a
hyphen.** It cannot rescue `<usercard>` or `<dvi>`, by design — the custom-elements specification
requires a hyphen, so a hyphen-free unknown tag can only be a typo or a missing import.
`NO_ERRORS_SCHEMA` short-circuits before any of that.

`hasProperty` is the same shape with one asymmetry that matters:

```ts
const normalizedTag = normalizeTagName(tagName);
if (normalizedTag.includes('-')) {
  if (isNgContainer(normalizedTag) || isNgContent(normalizedTag)) {
    return false;
  }

  if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
    // Can't tell now as we don't know which properties a custom element will get
    // once it is instantiated
    return true;
  }
}
```

`<ng-container>` and `<ng-content>` are *always* known elements and *never* have known properties, and
the `CUSTOM_ELEMENTS_SCHEMA` branch is unreachable for them because the `isNgContainer` check returns
first. That is the precise reason a binding on `<ng-container>` cannot be silenced by
`CUSTOM_ELEMENTS_SCHEMA`, and lands instead in the `ng-` branch of NG8002 — the branch that tells you
to add `CommonModule`.

**That collision is not a bug, and it is worth naming.** The DOM schema checker has no way to know you
meant `@if`; its message was written before built-in control flow existed. So v22.1.5 ships a compiler
that recommends `CommonModule` and a migration guide that says you no longer need it, and the guide is
the one to follow.

## Gotchas

**★ Symptom: you added `CUSTOM_ELEMENTS_SCHEMA` and `<usercard>` still fails.** Cause: `hasElement`
only reaches the `CUSTOM_ELEMENTS_SCHEMA` check inside `if (normalizedTag.includes('-'))`, so a
hyphen-free tag never gets there. Fix: give the custom element a hyphenated name, which the
custom-elements specification requires anyway:

```ts
@Component({
  selector: 'app-checkout',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<user-card data-user-id="42"></user-card>`,
})
export class Checkout {}
```

**★ Symptom: `CUSTOM_ELEMENTS_SCHEMA` does not silence a binding on `<ng-container>`.** Cause:
`hasProperty` returns `false` for `isNgContainer` / `isNgContent` **before** the schema check, so
nothing short of `NO_ERRORS_SCHEMA` applies. Fix: the binding is almost always `*ngIf` — replace it
with the built-in block, which needs neither an import nor a schema:

```ts
@Component({
  selector: 'app-team-page',
  imports: [UserCard],
  template: `
    @if (user(); as u) {
      <app-user-card [name]="u.name" />
    }
  `,
})
export class TeamPage {
  readonly user = input<{ name: string } | null>(null);
}
```

**★ Symptom: the compiler tells you to add `CommonModule` while the migration guide tells you it is no
longer needed.** Cause: both statements ship in v22.1.5 and neither is a bug — the DOM schema checker
cannot know you meant `@if`. Fix: follow the guide, not the diagnostic; convert the structural
directive to a block. The compiler's suggestion is the only one of its numbered lines that has aged.

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
find it for you. Import the individual classes instead, so that the next time one goes unused NG8113
can say so.

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
non-standalone components."* Fix: the component carries `standalone: false`; you will get the DOM
schema error instead, which is less helpful. Removing the flag restores the better diagnostic.

**★ Symptom: someone added `NO_ERRORS_SCHEMA` and a genuine typo shipped to production.** Cause: it
returns `true` from both `hasElement` and `hasProperty` before any other logic runs, disabling element
*and* property validation for the whole component. Angular's own doc comment warns about exactly this,
verbatim: *"The usage of this schema is generally discouraged because it prevents useful validation
and may hide real errors in your template."* Fix: replace it with `CUSTOM_ELEMENTS_SCHEMA`, which
still validates every hyphen-free tag.

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

**What does `CUSTOM_ELEMENTS_SCHEMA` actually change, and what will it refuse to rescue?**
It makes `DomElementSchemaRegistry.hasElement` and `hasProperty` return `true` — but only inside the
`if (normalizedTag.includes('-'))` branch. So it whitelists hyphenated tags and their properties and
nothing else. It will not rescue a hyphen-free tag such as `<usercard>` or `<dvi>`, and it will not
rescue a binding on `<ng-container>` or `<ng-content>`, because `hasProperty` returns `false` for
those before the schema check runs.

**Why does `NO_ERRORS_SCHEMA` exist at all if the documentation discourages it?**
Because it is the only escape for a template whose tags are genuinely not knowable at build time — a
host element for a third-party widget library, or a wrapper rendering markup it does not own. Angular
is blunt about the cost in its own doc comment: it *"prevents useful validation and may hide real
errors in your template"*. It short-circuits both checks before any other logic, so it disables
element *and* property validation for the whole component, which is why the same comment tells you to
prefer `CUSTOM_ELEMENTS_SCHEMA`.

**★ Why can't the compiler just tell you "you meant `@if`" in the `<ng-container *ngIf>` case?**
Two different checkers with different information. The DOM schema check only knows that a property
name did not resolve on a tag, and its `ng-` branch was written before built-in control flow existed.
The checker that *does* know is NG8103, which carries a map of `ngIf → @if`, `ngFor → @for`,
`ngSwitchCase → @switch with @case` and recommends the block first. It is an extended diagnostic, it
bails out entirely on non-standalone components, and it only handles structural-directive syntax — so
which of the two messages you get for the same mistake depends on which checker reached it first.

**Angular ships a compiler that recommends `CommonModule` and a guide that says you do not need it.
How should a page like this handle that?**
By naming the disagreement and saying which source is authoritative. Both texts are in the shipped
v22.1.5 tree, and the collision is structural: the DOM schema checker cannot infer intent, so its
advice is generic and dated, while the migration guide is written against the current syntax. The
guide is the one to follow. Silently repeating either one — as most search results do — is how the
reflex survives.

---

← Prev: [Legacy declarables and custom elements](06d-legacy-declarables-and-custom-elements.md) · Index: [Topic index](README.md) · Next → **07 · What replaced each `NgModule` responsibility** *(not written yet)*
