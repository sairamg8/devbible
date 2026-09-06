---
title: "Five distinct mistakes produce the identical `not a known element` sentence, they have a strict cheapest-first order to check them in, and exactly one of them is fixed by a schema"
sidebar_label: "06c · The five causes"
sidebar_position: 6.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8001 Invalid Element](https://angular.dev/errors/NG8001),
> [Anatomy of components](https://angular.dev/guide/components/anatomy-of-components) — and
> `angular/angular` at tag `v22.1.5`:
> [`compiler-cli/src/ngtsc/scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts),
> [`compiler-cli/src/ngtsc/scope/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/util.ts),
> [`compiler/src/schema/dom_element_schema_registry.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/schema/dom_element_schema_registry.ts),
> [`compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The message is the same in all five cases, so the message cannot tell you which one you have —
you have to check, and the order matters because four of the five are free to rule out and the fifth
requires a decision you cannot undo cheaply. The rule underneath all of them is one sentence: a
standalone component's template may reference itself, whatever its own `imports` array names, and
whatever those imported `NgModule`s export. Nothing else. Not what the parent imports, not what a
module elsewhere in the app imports. `StandaloneComponentScopeReader` seeds the scope with
`new Set([clazzMeta])` and adds only what the array resolves to, which is why the failing file is
always the one whose template contains the tag and never the one that defines the component.**

## The scope rule the five causes all violate

angular.dev states the contract, verbatim from the components guide:

> *"To use a component, [directive](guide/directives), or [pipe](guide/templates/pipes), you must add
> it to the `imports` array in the `@Component` decorator"*

and the compiler enforces exactly that. The class doc of `StandaloneComponentScopeReader`, verbatim:

> *"Computes scopes for standalone components based on their `imports`, expanding imported NgModule
> scopes where necessary."*

**Work the five in this order.** Steps 1 to 4 cost a glance at a file; step 5 permanently widens what
the compiler will accept in that component's template.

## 1. The import is simply missing

The overwhelmingly common case, and the only one where the message's line `1.` is literally correct.
**The file to edit is the one whose template contains the tag** — never the child.

```ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-user-card',
  template: `<article class="card">{{ name() }}</article>`,
})
export class UserCard {
  readonly name = input.required<string>();
}
```

```ts
import { Component } from '@angular/core';
import { UserCard } from './user-card';

@Component({
  selector: 'app-team-page',
  imports: [UserCard],
  template: `<app-user-card name="Ada" />`,
})
export class TeamPage {}
```

⚠️ **Importing it into the grandparent does nothing.** `NgModule` scope was transitive and ambient —
one import anywhere in the chain made a directive usable by every class the module declared.
`imports` is neither transitive nor ambient. Every component that *writes the tag* needs its own entry,
and that repetition is the price of the locality that makes `@defer` and incremental builds work.

## 2. The import is there but the selector is misspelled

The class is imported, the compiler agrees the import is a component, and the tag still does not
match — because matching is on `selector`, not on the class name. Compare the two strings character by
character; the error prints the tag, the decorator holds the truth.

```ts
// child: the selector is 'app-user-card', not 'app-usercard' and not 'AppUserCard'
@Component({
  selector: 'app-user-card',
  template: `<article class="card"><ng-content /></article>`,
})
export class UserCard {}

@Component({
  selector: 'app-team-page',
  imports: [UserCard],
  template: `<app-user-card>Ada</app-user-card>`,
})
export class TeamPage {}
```

🔴 **Case is a trap in both directions.** The registry lowercases before lookup — `normalizeTagName`
calls `toLowerCase()` — but the *message* prints your original text, and its hyphen test runs on your
original text. So `<AppUserCard />` reports as `'AppUserCard' is not a known element` **with the
`NO_ERRORS_SCHEMA` suggestion**, because the unmodified string contains no hyphen. The suggestion has
nothing to do with the actual mistake, which is that Angular element selectors are matched against
lower-cased tag names and your component's selector is `app-user-card`.

## 3. The class is not exported

Two distinct readings, both real, and they fail differently.

**The `export` keyword is missing on the class.** TypeScript fails the `import` first, so you normally
see a TS error above the NG8001. But with a barrel file re-exporting a wildcard you can end up with
`undefined` in the `imports` array instead, which is **NG2012**, verbatim from
`makeUnknownComponentImportDiagnostic`:

```
Component imports must be standalone components, directives, pipes, or must be NgModules.
```

```ts
// the fix: import from the file that declares it, and make sure it says `export`
import { UserCard } from './user-card';
```

**It is declared in an `NgModule` that does not export it.** Importing that module gives you only its
`exports`, never its `declarations` — the scope reader copies `ngModuleScope.exported.dependencies`
and nothing else. NG2011's related information says so directly:

```
It's declared in the 'LegacyUiModule' NgModule, but is not exported. Consider exporting it and
importing the NgModule instead.
```

```ts
@NgModule({
  declarations: [LegacyBadge],
  exports: [LegacyBadge],
})
export class LegacyUiModule {}
```

## 4. It is a legacy `standalone: false` declarable

You do not get NG8001 when you try to import it — you get **NG2011** at compile time. The message is
adaptive, built by `makeNotStandaloneDiagnostic`, and its base form is:

```
The component 'LegacyBadge' appears in 'imports', but is not standalone and cannot be imported
directly. It must be imported via an NgModule.
```

Two fixes. Preferred — delete the flag and give the class its own `imports`:

```ts
import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'legacy-badge',
  imports: [DatePipe],
  template: `<span class="badge">{{ issued() | date }}</span>`,
})
export class LegacyBadge {
  readonly issued = input.required<Date>();
}
```

Or, when you cannot edit it, import the module that exports it:

```ts
@Component({
  selector: 'app-team-page',
  imports: [LegacyUiModule],
  template: `<legacy-badge [issued]="today" />`,
})
export class TeamPage {
  readonly today = new Date();
}
```

⚠️ Angular's own TODO admits the hint is incomplete, verbatim: *"TODO(alxhub): the above case handles
directives/pipes in NgModules that are declared in the current compilation, but not those imported
from .d.ts dependencies."* For a third-party library shipped as `.d.ts` you get the bare sentence with
no related information, and you have to find the module yourself.

Note also that after raising NG2011 the compiler poisons the scope, with this comment on the sibling
case: *"Poison the component so that we don't spam further template type-checking errors that result
from misconfigured imports."* That is why one bad import produces one error rather than fifty.

## 5. It is a genuine custom element

Only now is a schema the right answer. In v22 `schemas` is a `@Component` field, not a module field:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import './vendor/stripe-card-element';

@Component({
  selector: 'app-checkout',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<stripe-card-element [publishableKey]="key" />`,
})
export class Checkout {
  readonly key = 'pk_live_placeholder';
}
```

🔴 The registry only consults `CUSTOM_ELEMENTS_SCHEMA` for tags whose normalised name contains a
hyphen, so this is not a general "make the error go away" switch — what it does and refuses to do is
chunk 06d's subject.

## Gotchas

**★ Symptom: `<app-tooltip>` is not a known element even though `AppTooltip` is in `imports`.** Cause:
its selector is an attribute selector, so it never matches an element of that name — the import is
correct and irrelevant. Fix: use it in attribute position:

```ts
@Directive({ selector: '[appTooltip]' })
export class AppTooltip {
  readonly appTooltip = input.required<string>();
}

@Component({
  selector: 'app-team-page',
  imports: [AppTooltip],
  template: `<button type="button" appTooltip="Remove member">Remove</button>`,
})
export class TeamPage {}
```

**★ Symptom: you added the import to the parent component and the child's template still fails.**
Cause: `imports` is per component and non-transitive; the habit is left over from `NgModule`, whose
compilation scope was shared by every class in `declarations`. Fix: add the import to the component
whose template literally contains the tag, in that file. There is no way to grant a scope downward.

**★ Symptom: NG2011 with no hint about which `NgModule` to import.** Cause: the related information is
only computed for modules in the current compilation; the source's own TODO says `.d.ts` dependencies
are not covered. Fix: read the library's public entry point for the module that exports the component
and import that module by name:

```ts
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-toolbar',
  imports: [MatButtonModule],
  template: `<button mat-flat-button type="button">Save</button>`,
})
export class Toolbar {}
```

**★ Symptom: the entry in `imports` is `undefined` and the error is NG2012, not NG8001.** Cause: a
barrel-file re-export cycle, or a missing `export` keyword, left a hole in the array; the tag then
fails separately as an unknown element. Fix: import the class from the file that declares it rather
than through the barrel, and confirm the class carries `export`. If two components genuinely reference
each other, break the cycle with `forwardRef`, which the compiler resolves specifically for this array:

```ts
import { Component, forwardRef } from '@angular/core';
import { TreeNode } from './tree-node';

@Component({
  selector: 'app-tree-branch',
  imports: [forwardRef(() => TreeNode)],
  template: `<app-tree-node [node]="node()" />`,
})
export class TreeBranch {}
```

**★ Symptom: a recursive component reports itself as not a known element.** Cause: something else — a
component is *always* in its own scope. The scope reader seeds with
`new Set<DirectiveMeta | PipeMeta | NgModuleMeta>([clazzMeta])`, and `seen` already contains the class,
so importing itself is a no-op rather than a fix. Fix: check the selector spelling instead; a
self-referencing template that fails has a typo, not a missing import.

**★ Symptom: the fix worked in one component and the identical tag still fails three files away.**
Cause: you fixed one scope. Every component that writes the tag needs its own entry, and there are as
many failures as there are templates. Fix: search the workspace for the tag rather than for the error,
and add the import to each host. A shared **exported** `const` array keeps that from becoming
repetitive, and `imports` flattens nested arrays:

```ts
export const SHARED_UI = [UserCard, AppTooltip] as const;

@Component({
  selector: 'app-team-page',
  imports: [SHARED_UI],
  template: `<app-user-card name="Ada" />`,
})
export class TeamPage {}
```

**★ Symptom: you imported the right `NgModule` and the component is still unknown.** Cause: the module
declares it but does not export it, so `ngModuleScope.exported.dependencies` never contains it. Fix:
add it to that module's `exports`; if the module is third-party, look for a different entry point —
libraries commonly ship one module per feature precisely so that each one exports what it declares.

## Interview questions

**★ Why is the file you must edit never the one that defines the missing component?**
Because the check is a property of the *host* component's compilation scope, not of the child. The
scope reader gives a standalone component exactly itself, plus what its own `imports` names, plus what
any imported `NgModule` exports; the tag failed to match anything in that set. The child compiled
perfectly well — nobody in the parent's scope had a selector for it. This is the single most useful
sentence for debugging the error, and it is the sentence that stops people editing the child.

**★ You import a component and get NG2011 instead of NG8001. What have you learned?**
That the class exists, is reachable, is a real declarable — and carries `standalone: false`. NG8001
means nothing matched the tag; NG2011 means the thing in your array is a directive, component or pipe
that belongs to an `NgModule` and cannot be imported directly. It is a strictly more informative
failure, and if the declaring module is in the same compilation the diagnostic even names it and says
whether it is exported. The compiler then poisons the scope deliberately, so you get one error rather
than a cascade of template type-check failures.

**★ Which of the five causes is `CUSTOM_ELEMENTS_SCHEMA` the correct fix for, and how do you know
before you try it?**
Only the fifth: a genuine custom element that no Angular component defines. You know before trying
because you can answer "which class would match this tag?" — if there is a class, a schema is the
wrong tool and will merely suppress the error while the element renders as an inert tag. If there is
no class, and the tag comes from a script that registers a custom element, the schema is the only
answer. The hyphen in the tag is a necessary condition, not a sufficient one.

**Your `imports` array contains the right class and the tag still fails. What are the two remaining
possibilities?**
The selector does not match what you wrote — including a case mismatch, since element matching happens
against a lower-cased tag name — or the class is not an element-selector directive at all, for example
a directive whose selector is `[appTooltip]`. Both are read off the child's `@Component` or
`@Directive` decorator in one glance, which is why they come before any thought of a schema.

**Why does exporting a class from an `NgModule` still matter in an app that has no modules of its
own?**
Because third-party libraries still ship them, and the standalone scope reader copies only
`ngModuleScope.exported.dependencies` when it flattens an imported module. Whatever a module merely
declares is invisible to you. The `exports` array is the module's public surface, and it is the one
piece of `NgModule` semantics a standalone application still has to understand in order to consume a
library.

**Why is the repetition of `imports` across many components considered a feature rather than a
regression?**
Because it is what makes a component's dependencies decidable from one file. Ambient module scope
meant "which component uses this directive?" was a whole-graph question and no bundler could split on
it. A local, statically analysable array turns it into a one-file question, which is exactly what
`@defer` needs to move a dependency into a separate chunk and what incremental compilation needs to
know which files to rebuild. The verbosity buys locality, and locality is the point of the whole
topic.

---

← Prev: [Compile time vs runtime](06b-runtime-detection.md) · Index: [Topic index](README.md) · Next → [`CommonModule` and `schemas`](06d-commonmodule-and-schemas.md)
