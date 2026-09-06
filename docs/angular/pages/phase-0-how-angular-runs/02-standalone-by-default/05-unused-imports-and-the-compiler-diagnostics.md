---
title: "NG8113 is a warning, not an error, and it only ever asks two questions of an `imports` entry — is this a standalone directive, is this a standalone pipe — so an NgModule is invisible to it by construction"
sidebar_label: "05 · Unused imports and the compiler diagnostics"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Extended diagnostics](https://angular.dev/extended-diagnostics),
> [NG8113 `unusedStandaloneImports`](https://angular.dev/extended-diagnostics/NG8113),
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) — and
> `angular/angular` at tag `v22.1.5`:
> [`unused_standalone_imports_rule.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts),
> [`core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> [`imported_symbols_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/imports/src/imported_symbols_tracker.ts),
> [`typecheck/src/checker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/checker.ts),
> [`compiler/src/render3/view/t2_binder.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/t2_binder.ts),
> [`diagnostics/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts),
> [`diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular 19 shipped a diagnostic that reads your `imports` array, compares it against the
directives and pipes your template actually matched, and tells you which entries are dead. It is
NG8113, it is a *warning*, and the source line that decides that is a single ternary in which only
the exact string `'error'` produces a build failure. What almost nobody knows is the shape of its
blind spot. The rule's per-entry loop asks exactly two questions — `getDirectiveMetadata`, then
`getPipeMetadata` — and each branch demands `isStandalone` before an entry can be called unused. An
`NgModule` answers neither question, so it is skipped, silently and by construction; a
`standalone: false` directive is skipped too, because it is already a hard error one layer up. That
is not a bug, but it inverts the intuition you brought: the diagnostic is loud about the import that
costs you nothing and mute about the one that pins a chunk boundary. This page is the rule itself:
the severity, the two message strings it can emit, and the seven distinct ways it stays silent.**

## NG8113 is a warning, and one ternary decides it

The default is set in `NgCompiler.getTypeCheckingConfig()`. The line appears **twice** — once in
the `strictTemplates` branch, once in the non-strict branch — identically:

```ts
unusedStandaloneImports:
  this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
```

and the only thing that overrides it is an explicit entry under `checks`:

```ts
if (this.options.extendedDiagnostics?.checks?.unusedStandaloneImports !== undefined) {
  typeCheckingConfig.unusedStandaloneImports =
    this.options.extendedDiagnostics.checks.unusedStandaloneImports;
}
```

The rule turns that label into a TypeScript diagnostic category with a two-way ternary — note that
**anything that is not the exact string `'error'` becomes a warning**:

```ts
const category =
  this.typeCheckingConfig.unusedStandaloneImports === 'error'
    ? ts.DiagnosticCategory.Error
    : ts.DiagnosticCategory.Warning;
```

angular.dev states the same contract for the whole family:

> *"Extended diagnostics are warnings by default and do not block compilation."*

> *"`error` | The compiler emits the diagnostic as an error and fails the compilation. The compiler
> will exit with a non-zero status code if one or more errors are emitted."*

> *"`suppress` | The compiler does _not_ emit the diagnostic at all."*

⚠️ **Do not infer severity from the sign of the enum value.** `UNUSED_STANDALONE_IMPORTS = 8113` is
positive while `SCHEMA_INVALID_ELEMENT = -8001` is negative, and that difference is about
*documentation links*, not severity: `ngErrorCode()` maps every code onto a `-99…` prefix so
TypeScript's `TS` renders as `NG`, and a negative **enum member** separately marks a code that has an
error-guide page on angular.dev. NG8001 is a hard build failure; NG8113 is a warning.

## The two messages, exactly

There are precisely two, and which one you get depends on whether *every* entry is unused:

```ts
if (unused.length === metadata.imports.length && propertyAssignment !== null) {
  return makeDiagnostic(
    ErrorCode.UNUSED_STANDALONE_IMPORTS,
    propertyAssignment.name,
    'All imports are unused',
    undefined,
    category,
  );
}

return unused.map((ref) => {
  const diagnosticNode =
    ref.getIdentityInExpression(metadata.rawImports!) ||
    ref.getIdentityIn(node.getSourceFile()) ||
    metadata.rawImports!;

  return makeDiagnostic(
    ErrorCode.UNUSED_STANDALONE_IMPORTS,
    diagnosticNode,
    `${ref.node.name.text} is not used within the template of ${metadata.name}`,
    undefined,
    category,
  );
});
```

So the strings are `All imports are unused` and, for example,
`AvatarBadge is not used within the template of UserCard`.

🔴 **A consequence nobody documents: you can never see `All imports are unused` if any `NgModule`
sits in the array.** `metadata.imports` is the flattened entry list and counts the module; `unused`
can never contain it (next section); so the two lengths cannot match, and you always fall through to
the per-symbol form.

⚠️ These are built with `makeDiagnostic`, **not** `formatExtendedError`, so an NG8113 message
carries **no** trailing `Find more at https://v22.angular.dev/extended-diagnostics/NG8113`. NG8116
does. If you are matching on that suffix in a log filter, NG8113 slips through it.

The `diagnosticNode` fallback chain is worth reading too: the squiggle lands on the identifier
inside the array if it is there, otherwise on the identifier **anywhere in the file** — which in
practice is your `import { AvatarBadge } from './avatar-badge';` line — and only then on the array
expression as a whole.

## What NG8113 refuses to flag — seven exemptions, all in the source

The entry gate rejects whole components outright:

```ts
if (
  !metadata ||
  !metadata.isStandalone ||
  metadata.rawImports === null ||
  metadata.imports === null ||
  metadata.imports.length === 0
) {
  return null;
}
```

Then the per-entry loop asks only two questions — `getDirectiveMetadata`, then `getPipeMetadata` —
and each branch requires `isStandalone` before an entry can be pushed onto `unused`. Everything
else falls out of the loop untouched. The full list:

1. **A `standalone: false` component.** Never inspected. If it also has an `imports` array, you
   already have NG2010, a hard error, and this warning would be noise on top of it.
2. **An absent, non-literal or empty `imports` array.**
3. 🔴 **Every `NgModule`.** `imports: [CommonModule]` on a component whose template is the literal
   text `Hello` produces **no warning at all**, ever. This is the single most useful fact on this
   page: the diagnostic meant to police your imports array is blind to precisely the entries that
   carry providers and pin your bundle.
4. **Non-standalone directives and pipes.** They fail the `isStandalone` test before the used-check
   runs, because they are already NG2011.
5. **A reference that might come from a shared imports array.** The heuristic that decides this is
   the one place NG8113 is occasionally *wrong* rather than merely silent — it gets its own page,
   [05b · The two cases where NG8113 is silent](05b-the-two-cases-where-ng8113-is-silent.md).
6. **A component that is already broken.** `getUsedDirectives` / `getUsedPipes` return `null` when
   the component failed to bind, with the comment *"These will be null if the component is invalid
   for some reason."* — so NG8113 goes quiet on exactly the file you are already fighting, and
   reappears on the build after you fix the other error.
7. **A file the rule never opens.** `shouldCheck` gates on the file, not the class:

```ts
shouldCheck(sourceFile: ts.SourceFile): boolean {
  return (
    this.typeCheckingConfig.unusedStandaloneImports !== 'suppress' &&
    (this.importedSymbolsTracker.hasNamedImport(sourceFile, 'Component', '@angular/core') ||
      this.importedSymbolsTracker.hasNamespaceImport(sourceFile, '@angular/core'))
  );
}
```

`hasNamedImport` keys on the **exported** name and only scans top-level import declarations whose
module specifier is the literal string `'@angular/core'`. So
`import { Component as NgComponent } from '@angular/core';` is still checked — the tracker records
the exported name, not the local alias — but a component that gets its decorator through a
re-export barrel, `import { Component } from '../platform/angular-shim';`, is invisible to NG8113
forever.

Two more skips live one level up, in `NgCompiler`: the validator is not constructed at all when the
compilation already has construction diagnostics, and it returns early for `.d.ts` files and
`.ngtypecheck.ts` shims.

⚠️ **One gate you might expect is missing, and it is a documentation/source disagreement.**
angular.dev says of the family: *"Extended diagnostics will emit when `strictTemplates` is
enabled."* But NG8113 is not mechanically an extended template check — it is a
`SourceFileValidatorRule`, and in `runAdditionalChecks` the `sourceFileValidator` call carries **no
`strictTemplates` guard** while the extended checks do. Read literally, the source says NG8113 emits
even with `strictTemplates: false`. **Nothing was run to confirm that**, and it barely matters in
practice: `strictTemplates` defaults to `true` in v22 — the getter is
`return this.options.strictTemplates !== false;` — so you would have to opt out on purpose to find
out.

## The neighbouring codes, so you can tell them apart

| Code | Enum member | What it means (verbatim enum doc, or the message) |
|---|---|---|
| NG2013 | `HOST_DIRECTIVE_INVALID` | *"Raised when the compiler wasn't able to resolve the metadata of a host directive."* |
| NG2014 | `HOST_DIRECTIVE_NOT_STANDALONE` | `Host directive Foo must be standalone` |
| NG2015 | `HOST_DIRECTIVE_COMPONENT` | `Host directive Foo cannot be a component` |
| NG2022 | `COMPONENT_UNKNOWN_DEFERRED_IMPORT` | `Component deferred imports must be standalone components, directives or pipes.` |
| NG2023 | `NON_STANDALONE_NOT_ALLOWED` | *"Raised when a `standalone: false` component is declared but `strictStandalone` is set."* — see [chunk 03](03-standalone-by-default-which-version-changed-what.md) |
| NG2024 | `MISSING_NAMED_TEMPLATE_DEPENDENCY` | *"Raised when a named template dependency isn't defined in the component's source file."* |
| NG2025 | `INCORRECT_NAMED_TEMPLATE_DEPENDENCY_TYPE` | *"Raised if an incorrect type is used for a named template dependency."* |
| NG8012 | `DEFERRED_PIPE_USED_EAGERLY` | a `deferredImports` pipe used outside a `@defer` block |
| NG8013 | `DEFERRED_DIRECTIVE_USED_EAGERLY` | a `deferredImports` directive used outside a `@defer` block |
| NG8014 | `DEFERRED_DEPENDENCY_IMPORTED_EAGERLY` | a symbol present in both `deferredImports` and `imports` |
| NG8116 | `MISSING_STRUCTURAL_DIRECTIVE` | *"A structural directive is used in a template, but the directive is not imported."* |

⚠️ The three deferred codes reference `deferredImports`, which is marked `@internal // 3p-only` in
the v22.1.5 typings. It is real and it has diagnostics, but it is not a field application authors
write — use `@defer` in the template and let the compiler decide.

NG8113 and NG8116 are mirror images of each other: one says you imported something you do not use,
the other says you used something you did not import. NG8116 is assembled by `formatExtendedError`,
so unlike NG8113 it *does* carry a trailing `Find more at …/NG8116` link.

## Gotchas

**★ Symptom: you know a file has dead imports and NG8113 says nothing about it.** Cause: one of
three gates. The component has another error, so `getUsedDirectives` returned `null` and the rule
bailed; or the file imports `Component` from a re-export barrel rather than the literal
`'@angular/core'`, so `shouldCheck` never opened it; or somebody set `"unusedStandaloneImports":
"suppress"` in a `tsconfig` you are not reading. Fix: import the decorator from the real module
specifier, and grep every config in the workspace, not just the root one:

```bash
grep -rn 'unusedStandaloneImports\|defaultCategory' --include='tsconfig*.json' .
```

**★ Symptom: `imports: [CommonModule]` sits on a component whose template contains no `NgIf`,
`NgFor`, `NgClass` or pipe, and no tool ever complains.** Cause: exemption 3 — the loop asks
`getDirectiveMetadata` and `getPipeMetadata`, both of which return `null` for a module class, so the
entry never reaches `unused`. Fix: replace the module with the individual symbols so the diagnostic
can see them, then let it tell you they are dead:

```ts
@Component({
  selector: 'app-invoice-line',
  imports: [DatePipe],
  template: `<span>{{ issuedAt | date: 'mediumDate' }}</span>`,
})
export class InvoiceLine {
  issuedAt = new Date();
}
```

**Symptom: the warning underlines your `import { AvatarBadge } from './avatar-badge';` line rather
than the entry in the array.** Cause: the `diagnosticNode` fallback chain — when the reference has
no identity inside the `imports` expression, the rule falls back to `getIdentityIn(sourceFile)`,
which finds the import specifier. Fix: none needed; read the message text, which names both the
symbol and the component that does not use it.

**Symptom: a `standalone: false` component with an `imports` array produces a hard error and no
unused-import warning.** Cause: NG8113's gate requires `metadata.isStandalone`, and the compiler has
already raised NG2010 and poisoned the component. Fix: delete the `standalone: false`; the warning
becomes available on the next build, once the class is a valid standalone component again.

## Interview questions

**★ Is NG8113 an error or a warning, and where exactly is that decided?**
A warning, in three places that agree. `NgCompiler.getTypeCheckingConfig()` defaults
`unusedStandaloneImports` to `extendedDiagnostics.defaultCategory || DiagnosticCategoryLabel.Warning`
in both the strict and non-strict branches; an explicit entry under `extendedDiagnostics.checks`
overrides that; and the rule maps the resulting label with a ternary in which only the exact string
`'error'` yields `ts.DiagnosticCategory.Error`. So a build with NG8113 outstanding still exits zero.

**★ Why does `imports: [CommonModule]` never produce an unused-import warning, even when the
template uses nothing from it?**
Because the rule's per-entry loop only ever asks `getDirectiveMetadata` and then `getPipeMetadata`.
An `NgModule` answers neither, so it can never be added to `unused`. That is by construction rather
than oversight — but it also means the cleanup schematic cannot remove it, which is why a separate
`common-to-standalone` migration had to ship in v21.

**What does a negative value in ngtsc's `ErrorCode` enum mean?**
Not severity. `ngErrorCode()` maps every code onto a `-99…` prefixed number so that TypeScript's
hard-coded `TS` prefix renders as `NG`; separately, a negative *enum member* marks a code that has an
error-guide page on angular.dev. `SCHEMA_INVALID_ELEMENT = -8001` is a hard error;
`UNUSED_STANDALONE_IMPORTS = 8113` is positive and is a warning. The sign tells you where the
documentation lives, nothing more.

**Does NG8113 require `strictTemplates`?**
The documentation says the extended-diagnostics family does. The source says otherwise for this
particular check: NG8113 is a `SourceFileValidatorRule`, and in `runAdditionalChecks` the
`sourceFileValidator` branch carries no `strictTemplates` guard while the extended-template branch
does. Nothing here was run to settle it, and it is nearly moot — `strictTemplates` is `true` by
default in v22, so you would have to disable it deliberately to find out.

**What is the smallest change that makes NG8113 stop analysing a file entirely?**
Import `Component` from something other than `'@angular/core'` — a re-export barrel is enough.
`shouldCheck` calls `hasNamedImport(sourceFile, 'Component', '@angular/core')`, and the tracker only
scans top-level import declarations matching that literal module specifier. Aliasing the local name
does not help or hurt, because the tracker keys on the exported name.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → [05b · The two cases where NG8113 is silent](05b-the-two-cases-where-ng8113-is-silent.md)
