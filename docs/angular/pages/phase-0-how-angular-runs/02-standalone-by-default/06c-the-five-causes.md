---
title: "Five distinct mistakes produce the identical `not a known element` sentence, and the first three — a missing import, a mismatched selector, and a class nothing can reach — are free to rule out before you touch anything"
sidebar_label: "06c · The five causes (1–3)"
sidebar_position: 6.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8001 Invalid Element](https://angular.dev/errors/NG8001),
> [Anatomy of components](https://angular.dev/guide/components/anatomy-of-components) — and
> `angular/angular` at tag `v22.1.5`:
> [`compiler-cli/src/ngtsc/scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts),
> [`compiler-cli/src/ngtsc/scope/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/util.ts),
> [`compiler/src/schema/dom_element_schema_registry.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/schema/dom_element_schema_registry.ts),
> [`compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The message is identical in all five cases, so the message cannot tell you which one you have —
you have to check, and the order matters because four of the five are free to rule out and the fifth
permanently widens what the compiler will accept in that template. The rule underneath all of them is
one sentence: a standalone component's template may reference itself, whatever its own `imports`
array names, and whatever those imported `NgModule`s export. Nothing else. Not what the parent
imports, not what a module elsewhere in the app imports. `StandaloneComponentScopeReader` seeds the
scope with `new Set([clazzMeta])` and adds only what the array resolves to, which is why the failing
file is always the one whose template contains the tag and never the one that defines the component.
This chunk is causes 1 to 3 — the import path itself; causes 4 and 5 are chunk 06d.**

## The scope rule the five causes all violate

angular.dev states the contract, verbatim from the components guide:

> *"To use a component, [directive](https://angular.dev/guide/directives), or [pipe](https://angular.dev/guide/templates/pipes), you must add
> it to the `imports` array in the `@Component` decorator"*

and the compiler enforces exactly that. The class doc of `StandaloneComponentScopeReader`, verbatim:

> *"Computes scopes for standalone components based on their `imports`, expanding imported NgModule
> scopes where necessary."*

**Work the five in this order.** Steps 1 to 4 cost a glance at a file; step 5 is a decision.

| # | Cause | What it actually costs to check |
|---|---|---|
| 1 | The import is missing | open the failing component, read its `imports` |
| 2 | The selector does not match the tag | open the child, read its `selector` |
| 3 | The class is not exported — from its file, or from its `NgModule` | read one `export` keyword or one `exports` array |
| 4 | It is a legacy `standalone: false` declarable | you already know: the error is NG2011, not NG8001 (chunk 06d) |
| 5 | It is a genuine custom element | a judgement call, and the only one a schema fixes (chunk 06d) |

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
`imports` is neither transitive nor ambient. Every component that *writes the tag* needs its own
entry, and that repetition is the price of the locality that makes `@defer` and incremental builds
work.

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
nothing to do with the actual mistake, which is that your component's selector is `app-user-card`.

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
// the fix: import from the file that declares it, and make sure that file says `export`
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

**★ Symptom: the entry in `imports` is `undefined` and the error is NG2012, not NG8001.** Cause: a
barrel-file re-export cycle, or a missing `export` keyword, left a hole in the array; the tag then
fails separately as an unknown element. Fix: import the class from the file that declares it rather
than through the barrel. If two components genuinely reference each other, break the cycle with
`forwardRef`, which the compiler resolves specifically for this array via `createForwardRefResolver`:

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
`new Set<DirectiveMeta | PipeMeta | NgModuleMeta>([clazzMeta])`, and `seen` already contains the
class, so importing itself is a no-op rather than a fix. Fix: check the selector spelling instead; a
self-referencing template that fails has a typo, not a missing import.

**★ Symptom: the fix worked in one component and the identical tag still fails three files away.**
Cause: you fixed one scope. Every component that writes the tag needs its own entry, so there are as
many failures as there are templates. Fix: search the workspace for the tag rather than for the error,
and add the import to each host. A shared **exported** `const` array keeps that from becoming
repetitive, and `imports` flattens nested arrays to any depth:

```ts
export const SHARED_UI = [UserCard, AppTooltip] as const;

@Component({
  selector: 'app-team-page',
  imports: [SHARED_UI],
  template: `<app-user-card name="Ada" />`,
})
export class TeamPage {}
```

**★ Symptom: the array entry is computed and the build fails before any template error appears.**
Cause: `imports` is read by `ngtsc`'s static evaluator at build time, not executed at runtime, so a
value that comes from a function call or a computed key cannot be resolved. Fix: name classes
directly, or put them in a statically resolvable exported `const`; only `forwardRef` and
`ModuleWithProviders` have dedicated resolvers.

**★ Symptom: you imported the right `NgModule` and the component is still unknown.** Cause: the module
declares it but does not export it, so `ngModuleScope.exported.dependencies` never contains it. Fix:
add it to that module's `exports`; if the module is third-party, look for a different entry point —
libraries commonly ship one module per feature precisely so each one exports what it declares.

## Interview questions

**★ Why is the file you must edit never the one that defines the missing component?**
Because the check is a property of the *host* component's compilation scope, not of the child. The
scope reader gives a standalone component exactly itself, plus what its own `imports` names, plus what
any imported `NgModule` exports; the tag failed to match anything in that set. The child compiled
perfectly well — nobody in the parent's scope had a selector for it. This is the single most useful
sentence for debugging the error, and it is the sentence that stops people editing the child.

**★ Your `imports` array contains the right class and the tag still fails. What are the two remaining
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

**★ Why is the repetition of `imports` across many components a feature rather than a regression?**
Because it makes a component's dependencies decidable from one file. Ambient module scope meant "which
component uses this directive?" was a whole-graph question, and no bundler could split on it. A local,
statically analysable array turns it into a one-file question — exactly what `@defer` needs to move a
dependency into a separate chunk, and what incremental compilation needs in order to know which files
to rebuild. The verbosity buys locality, and locality is the point of the whole topic.

**Why can a component reference itself without importing itself?**
Because `StandaloneComponentScopeReader` initialises the dependency set with the component's own
metadata before it looks at `imports` at all, and adds the class to `seen` at the same time. A
self-import is therefore skipped by the dedupe check rather than rejected. It also means a recursive
template — a tree node rendering child nodes — needs no special handling, and that an error on such a
template is never about the import.

**What kinds of value can `imports` hold, and why does that matter for debugging?**
Class references and arbitrarily nested arrays of them, resolved statically by the compiler, with
special handling for `forwardRef` and `ModuleWithProviders`. It matters because it tells you the
failure is always a build-time resolution failure: nothing in that array is evaluated when your app
runs, so no amount of runtime logging will tell you what went into it. You read the `.ts` file the way
the compiler does.

---

← Prev: [Compile time vs runtime](06b-runtime-detection.md) · Index: [Topic index](README.md) · Next → [Legacy declarables and custom elements](06d-legacy-declarables-and-custom-elements.md)
