---
title: "A missing template and a missing stylesheet share one error code and have opposite blast radii, because one is thrown and the other is pushed — and both deliberately poison the incremental build so the next run re-analyses a file that did not change"
sidebar_label: "10ib · Resources that are not there"
sidebar_position: 10.81
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run**. Every message quoted below is a string literal read from one of those files at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Every number on this page is undaggered — all were read from a line of `error_code.ts` that assigns them.

**[10i](10i-the-field-shape-family.md) covered the fields whose *value* is wrong. This chunk covers the one member of the family where the value was perfectly good and the **file it named does not exist** — `NG2008: COMPONENT_RESOURCE_NOT_FOUND`. It gets its own page for two reasons that neither the message nor the error code tells you. First, the same code is delivered two completely different ways: a missing template is `throw`n and ends the component's analysis, while a missing stylesheet is `push`ed and lets everything else keep running, so one typo produces one error and the other appears to produce a dozen. Second, both paths call `recordDependencyAnalysisFailure` before they report, which marks your unchanged `.ts` file as un-reusable — and that single line is why creating the missing file is enough to clear the error in a watch build without touching the component.**

## `Could not find template file` / `Could not find stylesheet file` — NG2008, and an asymmetry

**Symptom.** One of three sentences, all NG2008 `COMPONENT_RESOURCE_NOT_FOUND`. `annotations/component/src/resources.ts`, verbatim:

```ts
export function makeResourceNotFoundError(
  file: string,
  nodeForError: ts.Node,
  resourceType: ResourceTypeForDiagnostics,
): FatalDiagnosticError {
  let errorText: string;
  switch (resourceType) {
    case ResourceTypeForDiagnostics.Template:
      errorText = `Could not find template file '${file}'.`;
      break;
    case ResourceTypeForDiagnostics.StylesheetFromTemplate:
      errorText = `Could not find stylesheet file '${file}' linked from the template.`;
      break;
    case ResourceTypeForDiagnostics.StylesheetFromDecorator:
      errorText = `Could not find stylesheet file '${file}'.`;
      break;
  }

  return new FatalDiagnosticError(ErrorCode.COMPONENT_RESOURCE_NOT_FOUND, nodeForError, errorText);
}
```

Three sentences, and the third clause of the middle one is load-bearing: `linked from the template` means the missing stylesheet was referenced by a `<link>` element inside your HTML, not by the decorator. That is the only signal you get that the compiler has walked into your template looking for resources at all.

🔴 **The asymmetry.** The same code is delivered two different ways. A missing **template** is *thrown*:

```ts
      throw makeResourceNotFoundError(
        templateUrl,
        templateUrlExpr,
        ResourceTypeForDiagnostics.Template,
      );
```

A missing **stylesheet** is *collected*, in `annotations/component/src/handler.ts`:

```ts
        diagnostics.push(
          makeResourceNotFoundError(styleUrl.url, styleUrl.expression, resourceType).toDiagnostic(),
        );
```

A `FatalDiagnosticError` that is thrown aborts the analysis of that component; a diagnostic that is pushed does not. So one missing `.html` gives you exactly one error and no template type-checking for that component at all, while one missing `.css` gives you that error **plus** every other diagnostic the component would have produced. If a single typo in a `styleUrl` appears to have caused twelve unrelated errors, nothing cascaded — you were simply always going to see the other eleven.

**And it poisons the incremental build deliberately.** Both call sites are preceded by the same comment, verbatim:

```ts
      if (depTracker !== null) {
        // The analysis of this file cannot be re-used if the template URL could
        // not be resolved. Future builds should re-analyze and re-attempt resolution.
        depTracker.recordDependencyAnalysisFailure(node.getSourceFile());
      }
```

That is why creating the missing file and saving *it* is enough to clear the error in a watch build: the component's source file was marked as un-reusable, so the next build re-analyses it even though it did not change.

**Fix.** The path is resolved relative to the containing `.ts` file, through the CLI's resource loader:

```ts
import {Component} from '@angular/core';

// ⛔ NG2008 if `./invoice-row.html` does not exist next to this file.
@Component({
  selector: 'acme-invoice-row-external',
  templateUrl: './invoice-row.html',
  styleUrl: './invoice-row.css',
})
export class InvoiceRowExternal {}
```


## What "resolve" actually means here, and why the message quotes your string back

Both failure paths are `try` / `catch` around one call — `resourceLoader.resolve(url, containingFile)` — and the error is built from the *unresolved* string, not from an absolute path:

```ts
      throw makeResourceNotFoundError(
        templateUrl,
        templateUrlExpr,
        ResourceTypeForDiagnostics.Template,
      );
```

`templateUrl` there is the value the evaluator produced, so the quoted string in `Could not find template file 'X'.` is **exactly what your metadata folded to**. That is more useful than it looks. If the quoted string is not the string you wrote, the field folded through a constant, a template literal or a helper and the fold produced something else — and you have a metadata problem rather than a filesystem one. If the quoted string *is* what you wrote, the file genuinely is not where the resource loader looked.

🔴 **The compiler does not tell you where it looked.** `resolve` is supplied by the host — the CLI's `@angular/build` in a normal app, a language-service host in an editor, a test host in a unit test — and the failure surfaces as a caught exception with the message discarded. So an NG2008 that appears in `ng build` and not in the editor, or vice versa, is a statement about two different `ResourceLoader` implementations, not about your source.

## The third sentence is a different search

`ResourceTypeForDiagnostics.StylesheetFromTemplate` produces `Could not find stylesheet file 'X' linked from the template.` — and that clause is the only signal the compiler gives you that it walks your HTML looking for resources at all. If you see it, stop looking at the decorator: the reference is a `link` element inside the template, and `_extractTemplateStyleUrls(template)` found it. The decorator variant, `StylesheetFromDecorator`, has no such clause.

The two are merged into one list before resolution, in `annotations/component/src/handler.ts`, verbatim:

```ts
    const styleUrls: StyleUrlMeta[] = [
      ...extractComponentStyleUrls(this.evaluator, component),
      ..._extractTemplateStyleUrls(template),
    ];
```

so a component can raise both variants in one build, and the two sentences are how you tell which list each came from.

## Gotchas

**★ Symptom: a missing `styleUrl` produced one error plus a dozen template errors, and you assume the styles broke the template.** Cause: the stylesheet failure is a *pushed diagnostic*, not a thrown one, so analysis continued and every other diagnostic the component had was also reported. A missing `templateUrl` is thrown and would have suppressed them. Fix: treat NG2008-on-a-stylesheet as an independent error and read the other twelve on their own merits — they were always there.

**★ Symptom: you created the missing `.html` file, the watch build still fails, and you restart the dev server.** Cause: nothing was wrong — but the reason it *does* recover without a restart is worth knowing, because it is the opposite of the usual incremental-build intuition. `recordDependencyAnalysisFailure` marks the component's **source file** as un-reusable when a resource fails to resolve, so the next build re-analyses a `.ts` file that did not change. Fix: none needed; if it genuinely does not recover, the failure was not a resource resolution failure and you are looking at the wrong error.

**★ Symptom: `Could not find template file` quotes a path you have never written anywhere.** Cause: the quoted string is the *resolved value* of the `templateUrl` expression, not its source text. A constant, a template literal with a substitution, or a single-return helper ([09d](09d-the-single-return-function-rule.md)) folded to that string. Fix: this is a metadata bug, not a filesystem one — find the expression that produced it:

```ts
import {Component} from '@angular/core';

export const TEMPLATE_DIR = './templates';

// ⛔ folds to './templates/invoice-row.html'; if that is not the quoted path,
// TEMPLATE_DIR is not what you think it is.
@Component({
  selector: 'acme-invoice-row-computed',
  templateUrl: `${TEMPLATE_DIR}/invoice-row.html`,
})
export class InvoiceRowComputed {}

// ✅ a literal is its own documentation and its own error message.
@Component({
  selector: 'acme-invoice-row',
  templateUrl: './invoice-row.html',
})
export class InvoiceRow {}
```

**★ Symptom: NG2008 in `ng build` but not in the editor, or the reverse.** Cause: `resourceLoader.resolve` is host-supplied, and the build, the language service and a test harness install different hosts with different roots and different `include` globs. The compiler catches whatever the host threw and reports only its own sentence, so the host's reason is never printed. Fix: compare the two hosts' configuration — `tsconfig.app.json` versus the root `tsconfig.json` is the usual pair — rather than the source.

**Symptom: `Could not find stylesheet file 'X' linked from the template.` and there is no `styleUrl` anywhere on the component.** Cause: the reference is a `link` element in the HTML, found by `_extractTemplateStyleUrls`, not by the decorator. The clause `linked from the template` is the entire difference between the two messages. Fix: search the template, not the decorator.

**Symptom: two stylesheets are missing and you brace for two rounds of fix-and-rebuild.** Cause: there is only one round. The decorator's URLs and the template's URLs are concatenated into a single `styleUrls` list *before* the loop, and the loop pushes a diagnostic per failing URL instead of throwing on the first, so every failing stylesheet in the component is reported in the same build. Fix: fix all of them at once. If a second NG2008 genuinely appears only after you fix the first, it is not a stylesheet failure — a thrown template failure earlier in the same component would have ended analysis before the style loop ran at all.

## Interview questions

**★ Why is a missing stylesheet less disruptive to a build than a missing template, given that both are NG2008?**
Because of how the error is delivered, not what it says. The template failure is `throw makeResourceNotFoundError(...)` — a `FatalDiagnosticError` that aborts the analysis of that component, so nothing downstream of analysis runs and you get one error. The stylesheet failure is `diagnostics.push(makeResourceNotFoundError(...).toDiagnostic())` — collected, analysis continues, and the component still produces every other diagnostic it had, including full template type-checking. Same error code, same message shape, opposite blast radius. It is the clearest example in the compiler of severity being a property of the call site rather than of the error code, which is why an error-triage process keyed on codes rather than on call sites mis-ranks these two.

**★ A resource failure marks an unchanged `.ts` file as un-reusable. Why would a compiler deliberately do that, and what breaks if it does not?**
Because the analysis result for that component is a function of files the compiler does not otherwise track. Incremental compilation reuses an analysis when the inputs it knows about have not changed; a `templateUrl` that failed to resolve produced no dependency edge to record, because the file it would have pointed at does not exist. Without `recordDependencyAnalysisFailure`, creating the missing `.html` would change nothing the compiler watches, the stale failed analysis would be reused, and the error would persist until the `.ts` file was touched. The comment in the source says exactly this: the analysis cannot be re-used, and future builds should re-analyze and re-attempt resolution. It is a small, precise concession that a build system's dependency graph cannot represent an edge to a file that is absent.

**★ The message quotes a path. Under what circumstances is that path *not* something you can search your repository for?**
Whenever `templateUrl` or `styleUrl` was not a string literal. The quoted string is the value the partial evaluator produced, so a constant, a template literal with a resolvable substitution, or a call to a single-return helper all fold to a string that never appears in the source in that form. That makes NG2008 a rare error where the useful first move is to check whether the quoted string matches what you wrote: if it does not, the bug is in the metadata expression and the filesystem is fine. It is also the argument against computing resource paths at all — you trade a one-line deduplication for an error message that no longer points anywhere.

**Why does the compiler not tell you which directory it searched?**
Because it does not know. `resourceLoader.resolve` is a host method, and the host is `@angular/build` in a CLI build, the language-service host in an editor and something else again in a test. The compiler wraps the call in `try` / `catch` and constructs its own message from the URL it passed in, discarding whatever the host threw. That is why the same source can produce NG2008 under one tool and not another, and why the productive investigation is of the two hosts' configuration rather than of the component.

← Prev: [The field-shape family](10i-the-field-shape-family.md) · Index: [Topic index](README.md) · Next → [Stylesheets and the scalar fields](10ic-stylesheets-and-the-scalar-fields.md)
