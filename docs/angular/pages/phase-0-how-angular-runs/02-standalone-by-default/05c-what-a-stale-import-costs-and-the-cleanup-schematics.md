---
title: "An unused standalone import is filtered out of the component definition and costs you nothing at runtime, but an unused NgModule is emitted unconditionally and marked unconditionally eager — so the entry NG8113 cannot see is the only one that actually costs you a chunk boundary"
sidebar_label: "05c · What a stale import costs, and the cleanup"
sidebar_position: 5.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG8113 `unusedStandaloneImports`](https://angular.dev/extended-diagnostics/NG8113),
> [Extended diagnostics](https://angular.dev/extended-diagnostics),
> [Clean up unused imports](https://angular.dev/reference/migrations/cleanup-unused-imports),
> [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer),
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) — and
> `angular/angular` at tag `v22.1.5`:
> [`annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> [`unused_imports_migration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/cleanup-unused-imports/unused_imports_migration.ts),
> [`fix_unused_standalone_imports.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/language-service/src/codefixes/fix_unused_standalone_imports.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"Delete the unused import" sounds like tidiness advice, and for a standalone directive it very
nearly is — the compiler already filters it out of the emitted component definition, so the cost is
a diagnostic and an import statement, not a payload. The asymmetry is what makes this worth a page.
The same `switch` that `continue`s past an unused directive has an `NgModule` branch with no filter
at all, because a module's providers still have to be collected; and one function later, every
`NgModule` dependency is added to the eager set unconditionally, which is precisely the reason
`@defer` cannot move it. So the import the diagnostic can see is cheap, and the import it is blind
to is the expensive one. This page is that cost model, the safe way to promote NG8113 to a build
failure, and the two schematics that clean up each half.**

## Why an unused import is not merely untidy

angular.dev's own justification is narrow, and worth quoting for what it does *not* claim:

> *"The unused imports add unnecessary noise to your code and can increase your compilation time."*

**Compilation time, not bundle size.** The reason is in `componentDependenciesToDeclarations`, and
the asymmetry is the whole story:

```ts
switch (dep.kind) {
  case MetaKind.Directive:
    if (!wholeTemplateUsed.has(dep.ref.node) || dep.matchSource !== MatchSource.Selector) {
      continue;
    }
    // ... emit it ...
    break;
  case MetaKind.NgModule:
    const ngModuleType = this.refEmitter.emit(dep.ref, context);
    assertSuccessfulReferenceEmit(ngModuleType, node.name, 'NgModule');

    declarations.set(dep.ref.node, {
      kind: R3TemplateDependencyKind.NgModule,
      type: ngModuleType.expression,
      importedFile: ngModuleType.importedFile,
    });
    break;
}
```

An unused standalone **directive or pipe** is `continue`d and never reaches the component
definition. An **`NgModule`** has no such filter — it is emitted unconditionally, because its
providers still have to be collected. And in `handleDependencyCycles` it is also marked permanently
eager:

```ts
const eagerDeclarations = Array.from(declarations.values()).filter((decl) => {
  return decl.kind === R3TemplateDependencyKind.NgModule || eagerlyUsed.has(decl.ref.node);
});
```

`decl.kind === R3TemplateDependencyKind.NgModule ||` — that disjunct is the `@defer` blocker, and
angular.dev states the same rule from the other side:

> *"`@defer` blocks are compatible with both standalone and NgModule-based components, directives
> and pipes. However, **only standalone components, directives and pipes can be deferred**.
> NgModule-based dependencies are not deferred and are included in the eagerly loaded bundle."*

So the honest, source-backed hierarchy of cost:

| What is in `imports` and unused | NG8113 sees it | Emitted into `ɵcmp` | Deferrable |
|---|---|---|---|
| Standalone directive / pipe | ✅ warns | ❌ filtered out | n/a |
| Standalone component | ✅ warns | ❌ filtered out | ✅ |
| `NgModule` | ❌ **never** | ✅ **always** | ❌ **never** |

⛔ There are no numbers on this page. Nothing was built and no bundle was measured; every claim
above is structural — read off the compiler's own branching — rather than quantitative.

## Promoting it, and the one way to do it that is safe

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "unusedStandaloneImports": "error"
      }
    }
  }
}
```

`"suppress"` in the same slot turns it off entirely. What you should **not** reach for is
`defaultCategory`, and angular.dev says why in as many words:

> *"The Angular team intends to add or enable new extended diagnostics in **minor** versions of
> Angular […] This means that upgrading Angular may show new warnings in your existing codebase."*

> *"However, setting `"defaultCategory": "error"` will promote such warnings to hard errors. This
> can cause a minor version upgrade to introduce compilation errors, which may be seen as a semver
> non-compliant breaking change."*

Naming each check explicitly under `checks` gives you the same CI gate with none of that exposure.

## The cleanup schematic

> *"As of version 19, Angular reports when a component's `imports` array contains symbols that
> aren't used in its template."*

> *"Running this schematic will clean up all unused imports within the project."*

```bash
ng generate @angular/core:cleanup-unused-imports
```

Its `schema.json` at v22.1.5 declares `"properties": {}` — **no options at all**, no `path`, no
`mode`. It is whole-project or nothing, unlike the standalone migration, which takes both.

🔴 **It re-enables the diagnostic behind your back**, which is why it works even in a repository
that has suppressed NG8113 in `tsconfig.json`:

```ts
override createProgram(tsconfigAbsPath: string, fs: FileSystem): ProgramInfo {
  return super.createProgram(tsconfigAbsPath, fs, {
    extendedDiagnostics: {
      checks: {
        // Ensure that the diagnostic is enabled.
        unusedStandaloneImports: DiagnosticCategoryLabel.Warning,
      },
    },
  });
}
```

It then reads NG8113 straight back out of the compiler's diagnostics, filtering on
`diag.code === ngErrorCode(ErrorCode.UNUSED_STANDALONE_IMPORTS)`, and deletes the ranges those
diagnostics point at. Two consequences follow directly: **it can only remove what NG8113 can see**
— so it will never remove `CommonModule`, and it will never touch a shared exported array — and it
**empties the array rather than deleting the key**, which is why the migration's own published
after-example is:

```ts
// After
@Component({
  template: 'Hello',
  imports: [],
})
export class MyComp {}
```

The editor equivalent is a real TypeScript code fix keyed on the same error code, in
`packages/language-service/src/codefixes/fix_unused_standalone_imports.ts`, whose `description` and
`fixAllDescription` are both the string `Remove all unused imports`.

For the `CommonModule` half — the half NG8113 is blind to — the schematic you want is a different
one, new in 21.0.0, which replaces the module with the individual symbols so that the diagnostic can
then see them:

```bash
ng generate @angular/core:common-to-standalone
ng generate @angular/core:cleanup-unused-imports
```

That ordering is the point: the first makes the entries visible, the second removes the dead ones.

## Gotchas

**★ Symptom: `ng generate @angular/core:cleanup-unused-imports` reports nothing and leaves
`imports: [CommonModule]` on a component whose template has no `NgIf`, `NgFor` or pipe in it.**
Cause: the schematic only deletes what NG8113 flagged, and NG8113 never inspects an `NgModule` entry
— it asks `getDirectiveMetadata` and `getPipeMetadata`, both of which return `null` for a module
class. Fix: run the module-aware schematic first, then the cleanup:

```bash
ng generate @angular/core:common-to-standalone
ng generate @angular/core:cleanup-unused-imports
```

**★ Symptom: a minor `ng update` turned a green CI red with template warnings you never enabled.**
Cause: `"defaultCategory": "error"` promotes *every* extended diagnostic, including ones Angular
adds in minor releases — behaviour its own documentation describes as *"may be seen as a semver
non-compliant breaking change."* Fix: name the checks you want individually and leave
`defaultCategory` alone:

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "unusedStandaloneImports": "error",
        "missingControlFlowDirective": "error"
      }
    }
  }
}
```

**★ Symptom: `ng generate @angular/core:cleanup-unused-imports --path=src/app/orders` fails or
silently migrates the whole workspace.** Cause: the schematic's `schema.json` declares
`"properties": {}` — it has no `path` option and no `mode` option, unlike
`@angular/core:standalone`, which has both. Fix: there is no scoping flag, so scope it with source
control instead — run it on a clean tree and check in only the directory you meant:

```bash
git checkout -- .
ng generate @angular/core:cleanup-unused-imports
git add src/app/orders
git checkout -- .
```

**Symptom: you set `"unusedStandaloneImports": "suppress"` and the cleanup schematic still rewrote
your files.** Cause: the migration's `createProgram` override injects
`unusedStandaloneImports: DiagnosticCategoryLabel.Warning` into the compiler options it builds,
ignoring yours, with the comment *"Ensure that the diagnostic is enabled."* Fix: there is no flag to
make it honour the suppression — `schema.json` declares no options at all — so simply do not run it
in that repository.

**Symptom: after the cleanup schematic, dozens of components carry a bare `imports: []`.** Cause:
the migration empties the array rather than removing the property; its own published after-example
is `imports: []`. Fix: nothing is broken, and `ng generate component` emits exactly the same empty
array, so leaving it matches generated code. Delete the key by hand only in files you are already
editing for another reason.

**Symptom: you removed an unused `MatButtonModule` from a component and a lazy chunk appeared in the
build where there was none before.** Cause: an `NgModule` dependency is added to `eagerDeclarations`
unconditionally, so while it was in `imports` every dependency it pulled in was pinned eager,
`@defer` included. Fix: import the standalone class rather than the bundle module, which also lets
NG8113 tell you when that import goes stale:

```ts
@Component({
  selector: 'app-checkout',
  imports: [MatButton],
  template: `<button matButton (click)="pay()">Pay</button>`,
})
export class Checkout {
  pay(): void {}
}
```

## Interview questions

**★ Which costs more at build output: an unused standalone component in `imports`, or an unused
`NgModule`? Why?**
The `NgModule`, and it is not close. `componentDependenciesToDeclarations` `continue`s past any
directive or pipe not in `wholeTemplateUsed`, so an unused standalone dependency produces no entry
in the component definition at all. The `MetaKind.NgModule` branch has no such filter and emits
unconditionally, because the module's providers still have to be collected. Then
`handleDependencyCycles` builds its eager set with
`decl.kind === R3TemplateDependencyKind.NgModule || eagerlyUsed.has(decl.ref.node)`, so the module
reference is permanently eager and `@defer` can never move it.

**★ What happens if you set `"defaultCategory": "error"` and then run `ng update` to the next
minor?**
Your build can break on a diagnostic you never opted into. Angular's documentation calls this out
directly: new extended diagnostics ship in **minor** versions, and promoting the default category
turns each new one into a compilation error — *"which may be seen as a semver non-compliant breaking
change."* Naming each check under `checks` gives the same enforcement without the exposure.

**★ Why can the cleanup schematic remove imports in a repository that has NG8113 suppressed?**
Because it does not read your setting. Its `createProgram` override passes
`unusedStandaloneImports: DiagnosticCategoryLabel.Warning` into the program it builds, with the
comment *"Ensure that the diagnostic is enabled."*, then filters the compiler's diagnostics for
`ngErrorCode(ErrorCode.UNUSED_STANDALONE_IMPORTS)`. The suppression in your `tsconfig.json` applies
to your builds, not to the program the migration constructs.

**Why does the cleanup schematic leave `imports: []` behind instead of deleting the property?**
Because it works by deleting the source ranges that NG8113's diagnostics point at, and those ranges
are the entries, not the property. It is also harmless: `ng generate component` emits `imports: []`
on every new component, so an empty array is what generated code looks like anyway.

**Angular says unused imports "can increase your compilation time" — why does it not say bundle
size?**
Because for the imports NG8113 can flag, bundle size is the wrong claim: an unused standalone
directive or pipe is filtered out of the emitted definition. What remains is compiler work — the
scope is still computed and the symbol is still resolved. The bundle claim only holds for
`NgModule` entries, which are exactly the ones the diagnostic never mentions.

---

← Prev: [05b · The two cases where NG8113 is silent](05b-the-two-cases-where-ng8113-is-silent.md) · Index: [Topic index](README.md) · Next → [05d · The errors that reject an import](05d-the-errors-that-reject-an-import-outright.md)
