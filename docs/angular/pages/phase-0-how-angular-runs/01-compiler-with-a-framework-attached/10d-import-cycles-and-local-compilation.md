---
title: "Two error families are not about your symbol at all but about which file it lives in — NG3003 fires because writing the import Angular needs would create a cycle, and the NG11xxx pair fires because local compilation mode has drawn a boundary around one file and your constant is on the other side of it"
sidebar_label: "10d · Import cycles and local mode"
sidebar_position: 10.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG3003: Import Cycle Detected](https://angular.dev/errors/NG3003) — and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run** — every message below is a string literal read from one of those files or quoted from angular.dev.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not** — it comes from research prose rather than a line of `error_code.ts`. Match on the message text.

**Every other page in this catalogue is about a value the compiler could not compute. These two families are about *geography*. NG3003 says your code is fine and the import the compiler would have to write to make it work would close a cycle. The NG11xxx pair says your code is fine and the compilation unit was deliberately shrunk to one file, so a constant one directory away is now unreachable by construction. Both are errors you cannot fix by changing an expression, which is why they feel so much worse than the rest — and both have precise, documented escapes.**

## NG3003 — the import that would close a cycle

**Symptom.** `One or more import cycles would need to be created to compile this component, which is not supported by the current compiler configuration.` followed by one related note per offending dependency, each rendering the cycle. angular.dev shows that note's shape, verbatim:

> *"The component Child is used in the template but importing it would create a cycle: /parent.ts -> /child.ts -> /parent.ts"*

**Cause.** The compiler must write a reference to every directive your template uses into your component's generated code. If the class it needs to reference already imports *you*, that reference closes a loop. angular.dev [NG3003](https://angular.dev/errors/NG3003) explains the exact setup, verbatim:

> *"There is already an import from `child.ts` to `parent.ts` since the `Child` references the `Parent` in its constructor."*

> *"The generated code for this template must therefore contain a reference to the `Child` class. In order to make this reference, the compiler would have to add an import from `parent.ts` to `child.ts`, which would cause an import cycle."*

The throw site, from `annotations/component/src/handler.ts`, verbatim:

```ts
throw new FatalDiagnosticError(
  ErrorCode.IMPORT_CYCLE_DETECTED,
  node,
  'One or more import cycles would need to be created to compile this component, ' +
    'which is not supported by the current compiler configuration.',
  relatedMessages,
);
```

with the related notes built by `makeCyclicImportInfo(dir.ref, dir.isComponent ? 'component' : 'directive', cycle)` — one per dependency, which is why a component with three cyclic children reports three notes and not one.

### Why an NgModule app sometimes never sees this: remote scoping

The same function has a branch that runs *instead of* the throw when an `NgModule` is available:

```ts
const moduleSymbol = this.semanticDepGraphUpdater.getSymbol(scope.ngModule);
// …
moduleSymbol.addRemotelyScopedComponent(symbol, symbol.usedDirectives, symbol.usedPipes);
```

angular.dev names and prices this, verbatim:

> *"If you are using NgModules, to avoid adding imports that create cycles, additional code is added to the `NgModule` class where the component that wires up the dependencies is declared. This is known as \"remote scoping\"."*

> *"Unfortunately, \"remote scoping\" code is side-effectful —which prevents tree shaking— and cannot be used in libraries. So when building libraries using the `\"compilationMode\": \"partial\"` setting, any component that would require a cyclic import will cause this `NG3003` compiler error to be raised."*

🔴 **The consequence for a standalone-era codebase, spelled out: a standalone component has no NgModule to remote-scope into, so NG3003 is a hard error for it.** The escape hatch that quietly absorbed this problem in NgModule applications does not exist for the code you are writing today. That is the single most important sentence on this page, and no documentation states it directly — the doc names the library case and stops.

### The three documented fixes, each in code

angular.dev gives three, verbatim:

> *"Try to rearrange your dependencies to avoid the cycle. For example, using an intermediate interface that is stored in an independent file that can be imported to both dependent files without causing an import cycle."*

> *"Move the classes that reference each other into the same file, to avoid any imports between them."*

> *"Convert import statements to type-only imports (using `import type` syntax) if the imported declarations are only used as types, as type-only imports do not contribute to cycles."*

**Fix 1 — the intermediate interface.** The cycle exists because the child names the parent *class*. Give it an interface instead, in a third file that neither imports:

```ts
// src/app/panel-host.ts — imported by both, imports neither.
export interface PanelHost {
  readonly title: string;
  collapse(): void;
}
```

```ts
// src/app/panel-item.ts
import {Component, inject} from '@angular/core';
import {PANEL_HOST} from './panel-host-token';

@Component({
  selector: 'app-panel-item',
  template: `<button type="button" (click)="host.collapse()">Collapse</button>`,
})
export class PanelItem {
  protected readonly host = inject(PANEL_HOST);
}
```

```ts
// src/app/panel-host-token.ts
import {InjectionToken} from '@angular/core';
import type {PanelHost} from './panel-host';

export const PANEL_HOST = new InjectionToken<PanelHost>('PANEL_HOST');
```

```ts
// src/app/panel.ts — imports the child; the child does not import back.
import {Component} from '@angular/core';
import {PANEL_HOST} from './panel-host-token';
import {PanelItem} from './panel-item';
import type {PanelHost} from './panel-host';

@Component({
  selector: 'app-panel',
  imports: [PanelItem],
  providers: [{provide: PANEL_HOST, useExisting: Panel}],
  template: `<h2>{{ title }}</h2><app-panel-item />`,
})
export class Panel implements PanelHost {
  readonly title = 'Settings';

  collapse(): void {
    this.title;
  }
}
```

**Fix 2 — one file.** Blunt, and legitimate when the two classes genuinely are one unit:

```ts
// src/app/tree.ts — both classes, no imports between them, no cycle possible.
import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-tree-node',
  imports: [],
  template: `<li>{{ label }}</li>`,
})
export class TreeNode {
  @Input({required: true}) label!: string;
}

@Component({
  selector: 'app-tree',
  imports: [TreeNode],
  template: `<ul><app-tree-node label="root" /></ul>`,
})
export class Tree {}
```

**Fix 3 — `import type`, and it is the one that costs nothing.** If the child only ever uses the parent as a *type*, the import is erased at emit and never existed as far as the module graph is concerned:

```ts
// src/app/child.ts
import {Component} from '@angular/core';
// ⛔ `import {Parent} from './parent';` — a real edge in the module graph.
// ✅ erased entirely at emit; contributes nothing to the cycle.
import type {Parent} from './parent';

@Component({
  selector: 'app-child',
  template: `<span class="child">{{ parentTitle }}</span>`,
})
export class Child {
  parentTitle = '';

  attachTo(parent: Parent): void {
    this.parentTitle = parent.title;
  }
}
```

⚠️ **`import type` only works when the usage really is type-only.** A constructor parameter typed `parent: Parent` is type-only; `inject(Parent)` or `parent instanceof Parent` is not, because the class is a runtime value there. That distinction is the whole test, and TypeScript will tell you immediately if you get it wrong.

## Local compilation mode — NG11001 and NG11003

`compilationMode: 'experimental-local'` in `angularCompilerOptions` tells `ngtsc` to compile each file **without reading any other file**. It buys speed and it costs the partial evaluator its reach: a constant one import away is now, by definition, outside the compilation unit. Two dedicated codes exist for exactly that, and their numbers are stated inside their own doc comments in `error_code.ts` — so unlike most numbers in this catalogue, these two are not daggered.

> `LOCAL_COMPILATION_UNRESOLVED_CONST = 11001` — *"In local compilation mode a const is required to be resolved statically but cannot be so since it is imported from a file outside of the compilation unit. This usually happens with const being used as Angular decorators parameters such as `@Component.template`, `@HostListener.eventName`, etc."*

> `LOCAL_COMPILATION_UNSUPPORTED_EXPRESSION = 11003` — *"In local compilation mode a certain expression or syntax is not supported. This is usually because the expression/syntax is not very common and so we did not add support for it yet."*

**Symptom.** A long, unusually chatty message that names the field and then lists numbered solutions. The `selector` one, verbatim from `annotations/directive/src/shared.ts`:

```ts
assertLocalCompilationUnresolvedConst(
  compilationMode,
  resolved,
  null,
  'Unresolved identifier found for @Component.selector field! Did you ' +
    'import this identifier from a file outside of the compilation unit? ' +
    'This is not allowed when Angular compiler runs in local mode. Possible ' +
    'solutions: 1) Move the declarations into a file within the compilation ' +
    'unit, 2) Inline the selector',
);
```

The `template` field has its own message in the same shape, whose numbered solutions are, verbatim: *"1) Move the declaration into a file within the compilation unit, 2) Inline the template, 3) Move the template into a separate .html file and include it using @Component.templateUrl"*. ⚠️ The opening sentence of that second message is not quoted here because this page did not read it verbatim; assume it mirrors the `selector` one and match on the numbered list, which is quoted exactly.

**Cause.** Not that your constant is unresolvable — in ordinary mode it resolves fine. Only that the compilation unit was drawn around one file.

**Fix.** Inline it. In local mode, metadata constants stop being a refactoring win and become a build failure:

```ts
import {Component} from '@angular/core';

// ⛔ under `compilationMode: 'experimental-local'`, this import puts the value out of reach.
// import {CARD_SELECTOR} from './card-config';
// @Component({selector: CARD_SELECTOR, template: '…'})

// ✅ inline — the only form guaranteed to work in every compilation mode.
@Component({
  selector: 'app-user-card',
  template: `<h2 class="name">{{ name }}</h2>`,
})
export class UserCard {
  protected readonly name = 'Ada';
}
```

🔴 **The rule of thumb worth carrying out of this page: metadata written to survive local compilation survives every other mode too.** The reverse is not true. If you want one habit, it is that a selector and a template are literals, always, and anything you were tempted to share belongs in a spread ([10b](10b-the-decorator-argument-itself.md)) or in a class field rather than in the decorator.

## Gotchas

**★ Symptom: NG3003 on a standalone component, and every fix you read about mentions NgModules.** Cause: remote scoping — the mechanism that silently absorbed this in NgModule applications — writes extra code into the declaring NgModule, and a standalone component has none. Fix: use one of the three real fixes above. `import type` is free when the usage is type-only; the intermediate interface is the right answer when it is not:

```ts
// src/app/collapsible.ts — the shared shape, imported by both sides, importing neither.
export interface Collapsible {
  collapse(): void;
}
```

**★ Symptom: NG3003 appears only when you build the library, never in the demo application that consumes it.** Cause: `"compilationMode": "partial"` cannot use remote scoping — angular.dev, verbatim: *"\"remote scoping\" code is side-effectful —which prevents tree shaking— and cannot be used in libraries."* So the same cycle that an application quietly absorbed is a hard error in the library build. Fix: break the cycle in the library source; there is no configuration that makes it go away.

**Symptom: you break the cycle and NG3003 moves to a different component.** Cause: `makeCyclicImportInfo` emits one related note per offending dependency, but the throw is per component — a component with several cyclic children reports all of them, and a *graph* with several cyclic components reports them one component at a time. Fix: read all the related notes on each error before editing; they name every dependency involved in that component's cycles, which is usually enough to see the shape of the whole knot.

**Symptom: changing `import {Parent}` to `import type {Parent}` fails to compile the class body.** Cause: the class is used as a runtime value somewhere — `inject(Parent)`, `instanceof`, a `providers` entry, a `useExisting`. Type-only imports are erased, so those references have nothing left to point at. Fix: replace the runtime use with an `InjectionToken` typed by an interface, which is the intermediate-interface fix wearing different clothes:

```ts
import {InjectionToken} from '@angular/core';
import type {Collapsible} from './collapsible';

export const COLLAPSIBLE = new InjectionToken<Collapsible>('COLLAPSIBLE');
```

**Symptom: NG11001 in CI and a clean build locally.** Cause: the two builds are not using the same `compilationMode`. Local compilation mode is opt-in through `angularCompilerOptions`, so this is a configuration divergence, not a code difference. Fix: compare the `angularCompilerOptions` blocks of both tsconfigs before touching a line of TypeScript.

**Symptom: the NG11001 message reads like advice rather than an error and you scroll past it.** Cause: these two messages are unusually long and end with a numbered list of solutions, which does not look like the terse one-liners the rest of the compiler emits. Fix: read the numbered list — it is the fix, written by the compiler, for your exact field. `@Component.template` even offers the third option (`templateUrl`) that the `selector` message cannot.

**Symptom: you move a constant "into the compilation unit" and NG11001 persists.** Cause: in local mode the compilation unit is the **file**, not the project or the directory. A sibling file is outside it. Fix: inline the value into the decorator, which is the only placement that is unconditionally safe.

## Interview questions

**★ You get NG3003 on a standalone component. Remote scoping is not available to you — name two fixes and say which one costs nothing at runtime.**
Convert the offending import to `import type` when the imported declaration is only used as a type, or introduce an intermediate interface in a third file that both sides import and neither depends on. `import type` costs nothing at all: TypeScript erases it at emit, so it never becomes an edge in the module graph and no code changes. The interface costs nothing at runtime either — interfaces are erased — but it does cost a refactor, because the runtime reference that created the cycle has to be replaced, usually by an `InjectionToken` typed by that interface. The third documented fix, moving both classes into one file, is free at runtime as well but forfeits the file boundary, which matters if the two classes should be code-split apart.

**★ Why is remote scoping described as side-effectful, and why does that disqualify it for libraries?**
Because it works by writing extra code into the declaring NgModule that registers the component's directive and pipe dependencies after the fact — a statement that runs for its effect rather than producing a tree-shakable value. A bundler cannot prove that statement is unused, so it survives into the output even when the component does not. angular.dev states both halves: the code *"is side-effectful —which prevents tree shaking— and cannot be used in libraries"*, and consequently a library built with `"compilationMode": "partial"` raises NG3003 rather than reaching for it.

**★ Why does NG3003 exist at all when TypeScript itself tolerates circular imports?**
Because Angular is not merely reading the imports you wrote — it is *writing new ones*. TypeScript can live with a cycle that resolves at runtime because module initialisation order happens to work out. Angular has to add an edge to the graph that the developer never wrote, from the parent to the child, purely to make the generated template code able to name the child class, and it declines to create a cycle on your behalf. The error is the compiler refusing to make a decision with runtime consequences that you did not ask for.

**What does local compilation mode change about which metadata is legal, and what is the one habit that makes the question moot?**
It shrinks the compilation unit to a single file, so the partial evaluator can no longer follow an import to read a constant — anything it would have folded from another file becomes NG11001. Nothing about the expression changed; the reach changed. The habit that makes it moot is writing selectors and templates as literals in the decorator and keeping everything shareable out of the decorator entirely, either spread into the literal or moved to a class field. Metadata that compiles under local mode compiles under every mode; the converse does not hold.

**An error names a cycle `/parent.ts -> /child.ts -> /parent.ts`. Which of those two files do you open first?**
The child. The cycle exists because the child already imports the parent — that is the pre-existing edge, and the parent's import of the child is the one Angular would have had to add and refused to. So the edge you can remove is the child's, and the question to answer in `child.ts` is whether its reference to `Parent` is a type (fix it with `import type`) or a runtime value (fix it with a token and an interface). Opening the parent first leads you to try to remove a template usage, which is the feature, not the bug.

---

← Prev: [10c · Symbols it cannot resolve](10c-symbols-the-compiler-cannot-resolve.md) · Index: [Topic index](README.md) · Next → [Values that resolve but do not fold](10e-values-that-resolve-but-do-not-fold.md)
