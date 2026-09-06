---
title: "The guide names two conditions a dependency must meet to be deferred; the compiler applies eight in `registerDeferrableCandidate` and a ninth at the whole-import-declaration level, and not one of the nine produces a single line of build output"
sidebar_label: "11b · The nine conditions and the barrel trap"
sidebar_position: 11.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer) — and `angular/angular` at tag `v22.1.5`: [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts), [`packages/compiler-cli/src/ngtsc/imports/src/deferred_symbol_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/imports/src/deferred_symbol_tracker.ts), [`packages/compiler/src/render3/view/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/compiler.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[11](11-why-defer-can-split-a-bundle.md) showed the `else` branch that emits a plain class
reference when a dependency does not qualify for deferral, and pointed out that it produces no
error, no warning and no build-log line. This chunk is the list of ways to land in it.** The
guide names two conditions. The compiler's `registerDeferrableCandidate` returns early in nine places,
eight of which are qualification failures, and `DeferredSymbolTracker.canDefer` adds a ninth condition on
a completely different unit — the whole `import` statement rather than the symbol. That last one is the
reason a barrel file kills your chunk *before* the bundler is even asked, and it is both the easiest to
hit by accident and the hardest to see.

## What the guide says, and what it leaves out

`defer.md`, verbatim:

> *"In order for the dependencies within a `@defer` block to be deferred, they need to meet two
> conditions:"*
> *"1. **They must be standalone.** Non-standalone dependencies cannot be deferred and are still
> eagerly loaded, even if they are inside of `@defer` blocks."*
> *"2. **They cannot be referenced outside of `@defer` blocks within the same file.** If they are
> referenced outside the `@defer` block or referenced within ViewChild queries, the dependencies
> will be eagerly loaded."*

with a carve-out that is easy to misread as a third condition and is actually a relaxation:

> *"The transitive dependencies of the components, directives and pipes used in the `@defer` block
> do not strictly need to be standalone; transitive dependencies can still be declared in an
> `NgModule` and participate in deferred loading."*

Both quoted conditions are real and appear in the source below, as conditions 5, 6 and 7 of nine.

## `registerDeferrableCandidate` — eight ways to fail, all of them quiet

`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`, verbatim. **Every `return`
in this function is a silently un-deferred dependency:**

```ts
private registerDeferrableCandidate(
  componentClassDecl: ClassDeclaration,
  element: ts.Expression,
  isDeferredImport: boolean,
  allDeferredDecls: Set<ClassDeclaration>,
  eagerlyUsedDecls: Set<ClassDeclaration>,
  resolutionData: ComponentResolutionData,
) {
  const node = tryUnwrapForwardRef(element, this.reflector) || element;

  if (!ts.isIdentifier(node)) {
    // Can't defer-load non-literal references.
    return;
  }

  const imp = this.reflector.getImportOfIdentifier(node);
  if (imp === null) {
    // Can't defer-load symbols which aren't imported.
    return;
  }

  const decl = this.reflector.getDeclarationOfIdentifier(node);
  if (decl === null) {
    // Can't defer-load symbols which don't exist.
    return;
  }

  if (!isNamedClassDeclaration(decl.node)) {
    // Can't defer-load symbols which aren't classes.
    return;
  }

  // Are we even trying to defer-load this symbol?
  if (!allDeferredDecls.has(decl.node)) {
    return;
  }

  if (eagerlyUsedDecls.has(decl.node)) {
    // Can't defer-load symbols that are eagerly referenced as a dependency
    // in a template outside of a defer block.
    return;
  }

  // Is it a standalone directive/component?
  const dirMeta = this.metaReader.getDirectiveMetadata(new Reference(decl.node));
  if (dirMeta !== null && !dirMeta.isStandalone) {
    return;
  }

  // Is it a standalone pipe?
  const pipeMeta = this.metaReader.getPipeMetadata(new Reference(decl.node));
  if (pipeMeta !== null && !pipeMeta.isStandalone) {
    return;
  }

  if (dirMeta === null && pipeMeta === null) {
    // This is not a directive or a pipe.
    return;
  }

  // Keep track of how this class made it into the current source file.
  // Store the full `Import` info so that callers can correctly determine the
  // exported name (handling aliasing) and the module specifier.
  resolutionData.deferrableDeclToImportDecl.set(decl.node, imp);

  this.deferredSymbolTracker.markAsDeferrableCandidate(
    node,
    imp.node,
    componentClassDecl,
    isDeferredImport,
  );
}
```

| # | The check | The code you wrote that trips it |
|---|---|---|
| 1 | `!ts.isIdentifier(node)` | `imports: [...SHARED_IMPORTS]` or `imports: MY_IMPORTS` — the array element is not an identifier. `forwardRef(() => X)` is unwrapped before this check and survives it ([11c](11c-diagnosing-a-defer-that-did-not-split.md)) |
| 2 | `getImportOfIdentifier(node) === null` | the class is declared **in the same file** as the component, so there is no import declaration to rewrite |
| 3 | `getDeclarationOfIdentifier(node) === null` | the identifier does not resolve to a declaration at all |
| 4 | `!isNamedClassDeclaration(decl.node)` | the entry is not a named class — an alias to an expression, a re-export shape the reflector cannot follow to a class |
| — | `!allDeferredDecls.has(decl.node)` | **not a failure** — the one `return` of the nine that is a filter rather than a rejection: this class is simply not used inside any `@defer` block in this template |
| 5 | `eagerlyUsedDecls.has(decl.node)` | the same class is used in the template **outside** the `@defer` block — including in a `ViewChild` query |
| 6 | `dirMeta !== null && !dirMeta.isStandalone` | a non-standalone component or directive |
| 7 | `pipeMeta !== null && !pipeMeta.isStandalone` | a non-standalone pipe |
| 8 | `dirMeta === null && pipeMeta === null` | not a directive, component or pipe at all — a service, a token, a plain class |

## Condition 9: the unit of deferral is the whole `import` statement

`packages/compiler-cli/src/ngtsc/imports/src/deferred_symbol_tracker.ts` — the class doc first,
because it states the unit explicitly:

> *"Allows to register a symbol as deferrable and keep track of its usage. This information is
> later used to determine whether it's safe to drop a regular import of this symbol (actually the
> entire import declaration) in favor of using a dynamic import for cases when defer blocks are
> used."*

and the decisive function, verbatim:

```ts
/**
 * Whether all symbols from a given import declaration have no references
 * in a source file, thus it's safe to use dynamic imports.
 */
canDefer(importDecl: ts.ImportDeclaration): boolean {
  if (!this.imports.has(importDecl)) {
    return false;
  }

  const symbolsMap = this.imports.get(importDecl)!;
  for (const refs of symbolsMap.values()) {
    if (refs === AssumeEager || refs.size > 0) {
      // There may be still eager references to this symbol.
      return false;
    }
  }

  return true;
}
```

🔴 **This is the fact the documentation does not have, and it is the ninth condition.** The unit of
deferral is the whole `import { … } from '…'` declaration, not the symbol. If **one** named import in
that statement still has any eager reference anywhere in the file, the statement cannot be removed — so
**none** of its symbols can be defer-loaded, including the one you used only inside `@defer`.

```ts
// ILLUSTRATIVE — the shape of the trap, not compiler output
import {HeavyChart, TinyBadge} from './widgets';   // one declaration, two symbols

@Component({
  selector: 'app-dashboard',
  imports: [HeavyChart, TinyBadge],
  template: `
    <tiny-badge />
    @defer (on viewport) { <heavy-chart /> }
  `,
})
export class Dashboard {}
```

`TinyBadge` is used eagerly, so `canDefer` on that import declaration returns `false`, so
`HeavyChart` ships in the main bundle even though it is only used inside `@defer`. **The fix is
to split the import statement**, which is a one-line change with no runtime consequence:

```ts
import {TinyBadge} from './widgets';
import {HeavyChart} from './widgets/heavy-chart';
```

## The barrel file is that trap at industrial scale

A barrel — an `index.ts` re-exporting a folder — is one
`import {Card, Badge, Chart, Table} from './widgets'` declaration covering a dozen symbols, of
which you will almost certainly use at least one eagerly. `canDefer` then returns `false` for the
whole declaration, so the one class you carefully used only inside `@defer` is not deferred
either. The fix is the same single line as above: import the deferred component directly from its
own file, leaving the barrel for everything else.

⚠️ **Angular's guide documents a *different* barrel failure with an identical symptom** — the bundler
treating the barrel module as one indivisible unit — and names only that one. Both are real, both produce
"no lazy chunk", and importing directly happens to cure both, which is exactly why they get conflated.
Telling them apart matters the day the fix does not work: [11c](11c-diagnosing-a-defer-that-did-not-split.md).

## Gotchas

**★ Symptom: a shared `imports` constant compiles perfectly and nothing in any `@defer` block in
the app produces a chunk.** Cause: condition 1. `imports: [...SHARED_IMPORTS]` makes every array
element a spread rather than an identifier, and `registerDeferrableCandidate` bails on the first
line after the `forwardRef` unwrap — *"Can't defer-load non-literal references."* Fix: write the
identifiers literally in the `imports` array of any component that has a `@defer` block:

```ts
import {Component} from '@angular/core';
import {HeavyChart} from './heavy-chart';
import {TinyBadge} from './tiny-badge';

@Component({
  selector: 'app-dashboard',
  imports: [HeavyChart, TinyBadge], // literal identifiers, not a spread
  template: `<tiny-badge /> @defer (on viewport) { <heavy-chart /> }`,
})
export class Dashboard {}
```

**★ Symptom: you moved a big component into its own `@defer` block, it is used nowhere else, and
it still ships eagerly — and the component is declared in the same file as its host.** Cause:
condition 2 — *"Can't defer-load symbols which aren't imported."* Deferral works by rewriting an
import declaration; a class in the same file has none. Fix: move the deferred component into its
own file and import it.

**★ Symptom: adding a `viewChild` for the deferred component un-defers it.** Cause: condition 5.
The guide names this case explicitly — *"If they are referenced outside the `@defer` block or
referenced within ViewChild queries, the dependencies will be eagerly loaded."* A query is an
eager reference. Fix: query the DOM element or a template reference instead of the component
type, or accept the eager cost knowingly. If you need the instance, get it from the deferred
subtree at runtime rather than by type:

```ts
import {Component, viewChild, ElementRef} from '@angular/core';

@Component({
  selector: 'app-dashboard',
  imports: [],
  template: `@defer (on viewport) { <div #chartHost><heavy-chart /></div> }`,
})
export class Dashboard {
  // an ElementRef query does not name the deferred class, so it is not an eager reference
  private readonly chartHost = viewChild<ElementRef<HTMLDivElement>>('chartHost');
}
```

**Symptom: a non-standalone component inside a `@defer` block loads eagerly and you conclude
`@defer` does not work with `NgModule`s at all.** Cause: conditions 6 and 7 apply to the
dependency itself, not to what it uses. The guide draws that line precisely — *"only standalone
components, directives and pipes can be deferred"*, while *"transitive dependencies can still be
declared in an `NgModule` and participate in deferred loading."* Fix: make the *directly
deferred* class standalone; anything it pulls in can stay module-declared.

## Interview questions

**★ Why does `imports: [...SHARED_IMPORTS]` break lazy loading when the component compiles and
runs perfectly?**
Because deferral is a source-level rewrite and a spread destroys the thing being rewritten.
`registerDeferrableCandidate` starts with `if (!ts.isIdentifier(node)) return;` — the comment is
*"Can't defer-load non-literal references."* To emit `import('./heavy-chart').then((m) => m.HeavyChart)`
the compiler needs a specific identifier, traced back to a specific import declaration with a
specific module specifier and exported name. An array element that is a spread of some other array
gives it none of those. Nothing fails: the component compiles, the template matches, the block
renders, and the class stays in the eager bundle.

**★ Is the unit of deferral the symbol or the import statement, and how would you demonstrate the
difference?**
The import statement. `DeferredSymbolTracker.canDefer` takes a `ts.ImportDeclaration` and returns
`false` if *any* symbol from it still has eager references — its own doc comment says the decision
is whether *"it's safe to drop a regular import of this symbol (actually the entire import
declaration)"*. To demonstrate it: put two components in one import statement, use one eagerly in
the template and the other only inside `@defer`, and neither will be deferred. Split the statement
into two lines, change nothing else, and the deferred one splits out. That is also the mechanism
behind most barrel-file failures, ahead of anything the bundler does.

**★ The documentation names two conditions. Name three the documentation does not mention.**
A dependency must be reachable through an identifier in the `imports` array, so a spread or a
computed array un-defers everything. It must be imported from another file, so a same-file class
can never be deferred. And every *other* symbol in the same `import` statement must be free of
eager references, because the compiler removes the whole declaration or none of it. There are more —
the entry must resolve to a named class declaration, and it must actually be used inside a
`@defer` block in this template — but those three are the ones people hit while following the
documented advice exactly.


---

← Prev: [11 · Why `@defer` can split a bundle no bundler could](11-why-defer-can-split-a-bundle.md) · Index: [Topic index](README.md) · Next → [11c · Diagnosing a `@defer` that did not split](11c-diagnosing-a-defer-that-did-not-split.md)
