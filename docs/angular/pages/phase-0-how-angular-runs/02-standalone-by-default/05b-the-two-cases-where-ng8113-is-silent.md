---
title: "The two places NG8113 gets a component's imports wrong are both heuristics you can read: a shared array is exempted by whether it is `export`ed, and a symbol used only inside `@defer` counts as used because the binder records deferred matches in the same map"
sidebar_label: "05b · The two cases where NG8113 is silent"
sidebar_position: 5.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`unused_standalone_imports_rule.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts),
> [`typecheck/src/checker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/checker.ts),
> [`compiler/src/render3/view/t2_binder.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/t2_binder.ts) —
> and angular.dev [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer),
> [NG8113 `unusedStandaloneImports`](https://angular.dev/extended-diagnostics/NG8113).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two of NG8113's seven exemptions are not simple gates — they are judgement calls the compiler
makes on your behalf, and both are worth reading in full because one of them can be wrong in your
favour and the other can be wrong against you. The shared-imports heuristic decides whether a symbol
*might* have arrived from an array some other component also uses, and it decides that by walking up
the AST to the nearest `VariableStatement` and checking for an `export` keyword — a rule Angular's
own comment admits produces false positives. Deferred usage is the opposite case: the intuition that
a component referenced only inside a `@defer` block is "not really used in the template" is wrong,
and tracing why takes you through the exact place where the template binder splits *used* from
*eagerly used* — the same split the emit path later relies on to build lazy chunks.**

## The shared-imports heuristic, read off the code

This is the exemption that produces "but I *am* using it" bug reports.
`isPotentialSharedReference` answers one question — *could this symbol have arrived from an array
that some other component also uses?*

```ts
private isPotentialSharedReference(reference: Reference, rawImports: ts.Expression): boolean {
  // If the reference is defined directly in the `imports` array, it cannot be shared.
  if (reference.getIdentityInExpression(rawImports) !== null) {
    return false;
  }

  let current: ts.Node | null = reference.getIdentityIn(rawImports.getSourceFile());

  while (current !== null) {
    if (ts.isVariableStatement(current)) {
      return !!current.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    }
    current = current.parent ?? null;
  }

  return true;
}
```

Three branches, and each one is a different day at work:

- **Written literally in the array** ⇒ never "shared" ⇒ always checked. This is the normal case and
  the one the diagnostic is designed around.
- **Reached through a `const` in the same file** ⇒ checked **only if that `const` is not exported**.
  Angular's comment admits the trade-off verbatim: *"this has the potential for false positives if a
  non-exported array of imports is shared between components in the same file."*
- **Reached through a `const` in another file** ⇒ the identifier is not present in this source file,
  the `while` loop never runs, `return true` ⇒ **skipped entirely**.

The practical rule that falls out: a shared imports barrel is exempt, and the way to make a
same-file shared array exempt is to `export` it.

```ts
// shared-imports.ts — exported, so NG8113 leaves every consumer alone
import { RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';

export const SHARED_IMPORTS = [RouterLink, AsyncPipe, DatePipe] as const;
```

```ts
// order-row.ts — `imports: [SHARED_IMPORTS]` is never flagged, used or not
import { Component } from '@angular/core';
import { SHARED_IMPORTS } from './shared-imports';

@Component({
  selector: 'app-order-row',
  imports: [SHARED_IMPORTS],
  template: `<a [routerLink]="['/orders', id]">{{ placedAt | date }}</a>`,
})
export class OrderRow {
  id = 41;
  placedAt = new Date();
}
```

## 🔴 A symbol used only inside `@defer` is *not* unused

This deserves tracing, because the two halves of the compiler track usage differently and the wrong
guess is very plausible. The rule calls `TemplateTypeChecker.getUsedDirectives`, which forwards to
`R3BoundTarget.getUsedDirectives()`, which returns everything in the template binder's `directives`
map. The binder populates that map like this:

```ts
private trackMatchedDirectives(node: DirectiveOwner, matchedDirectives: DirectiveT[]) {
  if (matchedDirectives.length > 0) {
    const directives = this.dedupeAndMergeDirectives(node, matchedDirectives);
    this.directives.set(node, directives);
    if (!this.isInDeferBlock) {
      this.eagerDirectives.push(...directives);
    }
  }
}
```

The `isInDeferBlock` check gates only `eagerDirectives`; `this.directives` is set unconditionally.
Pipes behave identically — `this.usedPipes.add(ast.name)` always, `this.eagerPipes.add(ast.name)`
only when `!this.scope.isDeferred`. **So a component referenced only inside a `@defer` block counts
as used and NG8113 stays silent.** That is the right answer, and it is exactly why the emit path
needs its own separate `eagerlyUsed` / `wholeTemplateUsed` bookkeeping rather than reusing this one.

⚠️ This was settled by reading `v22.1.5` source along that call chain, not by running a build.


## Gotchas

**★ Symptom: NG8113 flags a symbol that another component in the same file is visibly using.**
Cause: the shared array is a `const` in that file and is **not exported**, so
`isPotentialSharedReference` walks up to the enclosing `VariableStatement`, finds no `export`
modifier and returns `false` — the reference is treated as private to the component being checked.
Fix: export the array, which is also the honest signal that it is shared:

```ts
// before — flagged on whichever component in this file does not use RouterLink
const LIST_IMPORTS = [RouterLink, DatePipe];

// after — NG8113 stays silent for every consumer
export const LIST_IMPORTS = [RouterLink, DatePipe];
```


**Symptom: a component appears only inside a `@defer` block and you expect an unused-import
warning.** Cause: you will not get one, and that is correct — the binder records every matched
directive in `this.directives` regardless of defer, and only the separate `eagerDirectives` list is
gated on `!this.isInDeferBlock`. Fix: none. If that block is not producing a lazy chunk, the cause
is elsewhere — a reference to the same symbol outside the block, a barrel import, or HMR, none of
which NG8113 can see.


**★ Symptom: a shared imports barrel has accumulated entries nothing uses any more, and no build
has ever mentioned it.** Cause: the third branch of `isPotentialSharedReference` — a symbol reached
through a `const` in *another* file has no identity in the current source file, so the `while` loop
never runs and the function returns `true`, exempting it permanently. A cross-file barrel is a
blind spot by design, not a bug. Fix: nothing in the compiler will help, so make the array small
enough to audit by eye, and prefer per-component literal arrays for anything not genuinely used by
every consumer:

```ts
// shared-imports.ts — keep this to things every consumer really uses
export const SHARED_IMPORTS = [AsyncPipe] as const;
```

```ts
// order-row.ts — everything else is literal, so NG8113 polices it
@Component({
  selector: 'app-order-row',
  imports: [SHARED_IMPORTS, RouterLink, DatePipe],
  template: `<a [routerLink]="['/orders', id]">{{ placedAt | date }}</a>`,
})
export class OrderRow {
  id = 41;
  placedAt = new Date();
}
```

**Symptom: you moved a shared array out to its own file to silence a false positive, and now *all*
the warnings for those components are gone — including the ones you wanted.** Cause: you changed
branch two of the heuristic (same-file, exempt only when exported) for branch three (cross-file,
always exempt). Fix: keep the array in the same file and add the `export` keyword instead, which
exempts it without moving it out of the diagnostic's reach for future edits:

```ts
// same file as the components, exported — branch two, not branch three
export const LIST_IMPORTS = [RouterLink, DatePipe];
```

**Symptom: a `@defer` block renders instantly in `ng serve` and nothing warns about the imports it
uses.** Cause: two independent things, neither of which NG8113 can see. Deferred usage is real
usage, so no warning is expected; and HMR fetches every defer chunk eagerly regardless of triggers.
Fix: for the eager-loading half, take HMR out of the picture before drawing conclusions:

```bash
ng serve --no-hmr
```

## Interview questions

**★ Why does NG8113 sometimes flag a symbol you are demonstrably using?**
The shared-array heuristic. If the reference is not written literally in the `imports` expression,
`isPotentialSharedReference` walks up to the enclosing `VariableStatement` and exempts the symbol
only when that statement is `export`ed. A file-local, non-exported array shared between two
components in the same file therefore gets flagged for whichever component does not use the entry.
Angular documents the false positive in a comment and accepts it, because the blast radius is one
file rather than the application.


**★ Does NG8113 fire for a directive used only inside a `@defer` block?**
No. `TemplateTypeChecker.getUsedDirectives` forwards to `R3BoundTarget.getUsedDirectives()`, which
reads the binder's `directives` map; `trackMatchedDirectives` writes that map unconditionally and
gates only the separate `eagerDirectives` array on `!this.isInDeferBlock`. Pipes behave the same way
via `usedPipes` versus `eagerPipes`. Deferred usage is usage.

**★ What is the difference between the binder's `getUsedDirectives` and
`getEagerlyUsedDirectives`, and which one does NG8113 use?**
`getUsedDirectives()` returns everything in the `directives` map — every directive matched anywhere
in the template, defer blocks included. `getEagerlyUsedDirectives()` returns the separate
`eagerDirectives` array, which `trackMatchedDirectives` only appends to when `!this.isInDeferBlock`.
NG8113 goes through `TemplateTypeChecker.getUsedDirectives`, so it uses the *whole-template* set.
The emit path uses the eager set, because that is the one that decides which dependencies can be
moved into a lazy chunk.

**If you move a component's only usage from the main template into a `@defer` block, does NG8113
change its mind about it?**
No, and that is the point of the split. The rule's view of "used" is the whole template; only the
emit path cares where in the template the usage was. Moving the usage changes what ends up in a lazy
chunk, not whether the import is considered live.

**Why does Angular accept a known false positive in the shared-imports heuristic?**
Because the compiler cannot see the other consumers of a symbol from inside a single-file validator
rule, so it has to guess, and it picks the guess with the smallest blast radius. Angular's comment
spells the trade-off out: the false positive only occurs for a non-exported array shared between
components *in the same file*, so the worst case is that a developer refactors within one file
rather than across an application.

---

← Prev: **05 · Unused imports and the compiler diagnostics** *(not written yet)* · Index: [Topic index](README.md) · Next → **05c · What a stale import costs, and the tooling that removes it** *(not written yet)*
