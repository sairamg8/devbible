---
title: "NG2003 is the field-shape family's outlier — its headline names a constructor parameter, its second sentence is one of six, its related notes are hand-written rather than traced, and it is one of only two `NG2xxx` codes angular.dev documents, for a reason that is literally a minus sign"
sidebar_label: "10ig · NG2003 and the sign of the enum"
sidebar_position: 10.86
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/di.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts);
> and angular.dev — [NG2003: Missing Token](https://angular.dev/errors/NG2003), [Error Encyclopedia](https://angular.dev/errors).
> Documentation-validated; **no sandbox run**. Every message quoted below is a string literal read from one of those files at that tag, or quoted from angular.dev.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Every number on this page is undaggered — all were read from a line of `error_code.ts` that assigns them.

**NG2003 belongs to this family for the reason the decoder gives: no trace, and a headline that names a field — except the field is a constructor parameter, and the fix is a change to a declaration rather than to an expression. It is also the family's most instructive member for two reasons that have nothing to do with dependency injection. It carries **related information that is not a trace**, which is the single easiest thing to misread in an Angular diagnostic, because an editor renders hand-written hints and traced breadcrumbs in exactly the same panel. And it is one of only two `NG2xxx` codes with a documentation page, because Angular encodes "this code is documented" in the *sign* of the enum value — a fact nothing on angular.dev states, and which turns the presence or absence of a `Find more at` line into reliable information.**

## NG2003 — Missing Token, the family's outlier

**Symptom.** `No suitable injection token for parameter 'repo' of class 'InvoiceService'.`, a second sentence suggesting a remedy, and one or two related-information notes.

**Cause.** `annotations/common/src/di.ts` builds the chain by hand. The headline, verbatim:

```ts
  const chain: ts.DiagnosticMessageChain = {
    messageText: `No suitable injection token for parameter '${param.name || index}' of class '${
      clazz.name.text
    }'.`,
```

🔴 **Read `param.name || index`.** If the parameter is destructured or otherwise unnamed, the message quotes a **number** — `parameter '2'` — which reads like a typo and is not. That is the positional index of the constructor parameter.

**The second sentence is one of six, and it is the actual diagnosis.** All verbatim from the same `switch`:

| `ValueUnavailableKind` | chain message | related notes |
|---|---|---|
| `UNSUPPORTED` | `Consider using the @Inject decorator to specify an injection token.` | `This type is not supported as injection token.` |
| `NO_VALUE_DECLARATION` | `Consider using the @Inject decorator to specify an injection token.` | `This type does not have a value, so it cannot be used as injection token.` and, if known, `The type is declared here.` |
| `TYPE_ONLY_IMPORT` | `Consider changing the type-only import to a regular import, or use the @Inject decorator to specify an injection token.` | `This type is imported using a type-only import, which prevents it from being usable as an injection token.` and `The type-only import occurs here.` |
| `NAMESPACE` | `Consider using the @Inject decorator to specify an injection token.` | `This type corresponds with a namespace, which cannot be used as injection token.` and `The namespace import occurs here.` |
| `UNKNOWN_REFERENCE` | `The type should reference a known declaration.` | `This type could not be resolved.` |
| `MISSING_TYPE` | `Consider adding a type to the parameter or use the @Inject decorator to specify an injection token.` | none |

**Those related notes are not a trace.** They are hand-written `makeRelatedInformation` calls with fixed strings, chosen by a `switch` on why the token was unavailable. Nothing here came from `traceDynamicValue`, no `DynamicValue` was involved, and the partial evaluator never ran. That distinction matters because an editor renders hand-written related information and a trace identically — same panel, same style — so a reader who has learned "related information means follow the trace" will look for a chain that does not exist. **The rule from [10i](10i-the-field-shape-family.md) holds: no `NG2xxx` in this family has a trace. Some of them have hints.**

angular.dev's [NG2003](https://angular.dev/errors/NG2003) page adds the runtime consequence, verbatim:

> *"This error is commonly thrown when a constructor defines parameters with primitive types such as `string`, `number`, `boolean`, and `Object`."*

> *"Use the `@Injectable` method or `@Inject` decorator from `@angular/core` to ensure that the type you are injecting is reified (has a runtime representation). Make sure to add a provider to this decorator so that you do not throw NG0201: No Provider Found."*

**Fix, per cause.** The `TYPE_ONLY_IMPORT` case is the one that catches teams who turned on `verbatimModuleSyntax` or let an editor auto-fix imports, and it is the only one where the fix is in a *different file's import statement*:

```ts
// ⛔ `import type` erases the value, so there is no token left to inject.
// import type {InvoiceRepository} from './invoice-repository';
//
// @Injectable({providedIn: 'root'})
// export class InvoiceServiceBad {
//   constructor(private readonly repo: InvoiceRepository) {}
// }

// ✅ a value import: the class survives to runtime and is its own token.
import {Injectable} from '@angular/core';
import {InvoiceRepository} from './invoice-repository';

@Injectable({providedIn: 'root'})
export class InvoiceService {
  constructor(private readonly repo: InvoiceRepository) {}
}
```

For `MISSING_TYPE` and `UNSUPPORTED` — a primitive, an interface, a union — there is no class to import, so the token must be explicit:

```ts
import {inject, Injectable, InjectionToken} from '@angular/core';

export interface ApiConfig {
  readonly baseUrl: string;
  readonly retries: number;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');

// ✅ `inject()` in a field initialiser: no constructor parameter, so NG2003
// cannot apply to it at all.
@Injectable({providedIn: 'root'})
export class ApiClient {
  private readonly config = inject(API_CONFIG);

  url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }
}
```

🔴 **That last example is the general escape.** NG2003 is raised while reflecting over *constructor parameters*. A dependency taken with `inject()` in a field initialiser is a function call with an explicit token, so the reflection that produces this error never looks at it. Migrating a class to `inject()` does not "work around" NG2003; it removes the construct the check applies to.

## The three other errors the same file raises on a constructor parameter

`di.ts` is a small file and it throws four different diagnostics, three of which are not NG2003 and none of which have a trace. All verbatim:

```ts
        if (name === 'Inject') {
          if (dec.args === null || dec.args.length !== 1) {
            throw new FatalDiagnosticError(
              ErrorCode.DECORATOR_ARITY_WRONG,
              dec.node,
              `Unexpected number of arguments to @Inject().`,
            );
          }
```

```ts
        } else if (name === 'Attribute') {
          if (dec.args === null || dec.args.length !== 1) {
            throw new FatalDiagnosticError(
              ErrorCode.DECORATOR_ARITY_WRONG,
              dec.node,
              `Unexpected number of arguments to @Attribute().`,
            );
          }
```

```ts
        } else {
          throw new FatalDiagnosticError(
            ErrorCode.DECORATOR_UNEXPECTED,
            dec.node,
            `Unexpected decorator ${name} on parameter.`,
          );
        }
```

`DECORATOR_ARITY_WRONG` is **NG1002**, the same code as `Incorrect number of arguments to @Component decorator` ([10b](10b-the-decorator-argument-itself.md)) — so the parameter decorators share their arity gate's code with the class decorators while wearing a completely different sentence. `DECORATOR_UNEXPECTED` is **NG1005**, and its `else` catches any parameter decorator that is not one of the six the compiler knows: `Inject`, `Optional`, `SkipSelf`, `Self`, `Host`, `Attribute`. That list, in that `if` / `else if` chain, is the complete set of parameter decorators `ngtsc` understands — there is no extension point, and a decorator from another library on a constructor parameter of an Angular class is an error, not a no-op.

⚠️ Note the filter above the chain: `.filter((dec) => isCore || isAngularCore(dec))`. A parameter decorator that is *not* from `@angular/core` is filtered out before the chain runs, so `Unexpected decorator X on parameter.` fires for something the compiler believes came from `@angular/core` — an alias, a re-export, or a wrapper. That narrows the search considerably.

## Why NG2003 is documented and NG2001, NG2004, NG2008 and NG2021 are not

Because of its sign. `error_code.ts`, verbatim:

```ts
  COMPONENT_MISSING_TEMPLATE = 2001,
  PIPE_MISSING_NAME = 2002,
  PARAM_MISSING_TOKEN = -2003,
  DIRECTIVE_MISSING_SELECTOR = 2004,
```

and, further down:

```ts
  COMPONENT_INVALID_SHADOW_DOM_SELECTOR = -2009,
```

A **negative** enum value is Angular's marker for "this code has a documentation page", and `addDiagnosticDetails` appends the `Find more at …` link only for those ([10](10-metadata-errors-one-by-one.md), [13](13-where-the-compiler-runs-ngtsc.md)). Of the twenty-eight `NG2xxx` codes in the enum, exactly two are negative: `PARAM_MISSING_TOKEN` and `COMPONENT_INVALID_SHADOW_DOM_SELECTOR`. Both appear in angular.dev's compiler-errors table; the other twenty-six do not, and no page describes them.

**So the absence of a `Find more at` line under a field-shape error is information, not a defect.** It tells you the message text *is* the documentation — which, for this family, is unusually true: NG2001 and NG2021 both state their own fix in the sentence.


## Gotchas

**★ Symptom: NG2003 quoting a parameter name that is a number — `parameter '2'`.** Cause: `param.name || index` falls back to the positional index when the parameter has no simple name, which includes a destructured parameter. Fix: read it as a zero-based position and count the constructor parameters. It is not a mangled name and it is not a bug.

**★ Symptom: NG2003 appeared across a codebase after enabling `verbatimModuleSyntax` or accepting an editor's "convert to type-only import" fix.** Cause: `import type` erases the binding at emit, so the class has no runtime value to serve as its own DI token — the `TYPE_ONLY_IMPORT` branch, whose related note says exactly that and points at the import statement. Fix: make the import a value import for anything injected by class. This is the one NG2003 whose fix is in a different statement from the one the headline names, and the related note is what tells you which.

**★ Symptom: you migrated a service to `inject()` and an NG2003 disappeared, and you are not sure whether you fixed it or hid it.** Cause: you removed the construct. NG2003 is raised while reflecting over constructor parameters to derive tokens; a field initialiser calling `inject(TOKEN)` states its token explicitly and is never reflected over. Fix: nothing — but be clear that a dependency with no valid token is still a dependency with no valid token. If the underlying problem was a missing provider, it survives the migration as a runtime `NG0201`.

**★ Symptom: `Unexpected decorator Foo on parameter.` for a decorator you imported from your own library.** Cause: the chain that raises it runs only for decorators that passed `isAngularCore(dec)`, so the compiler concluded the decorator came from `@angular/core` — which happens when it is re-exported through a barrel that also re-exports core, or aliased. Fix: import parameter decorators directly from `@angular/core` and keep your own decorators off constructor parameters of Angular classes entirely; the six the compiler knows are `@Inject`, `@Optional`, `@SkipSelf`, `@Self`, `@Host` and `@Attribute`, and there is no seventh.

**Symptom: `Unexpected number of arguments to @Inject().` on a bare `@Inject` with no parentheses.** Cause: `dec.args === null` shares the message with a two-argument call, exactly as the class-decorator arity gate does ([10b](10b-the-decorator-argument-itself.md)) — zero arguments and three arguments produce the same sentence. Fix: `@Inject(TOKEN)`, one argument, always.

**Symptom: a `Find more at https://v22.angular.dev/errors/NG2001` line you cannot find in your terminal.** Cause: there is none. Only negatively-declared codes get that suffix, and of the `NG2xxx` family only `PARAM_MISSING_TOKEN` and `COMPONENT_INVALID_SHADOW_DOM_SELECTOR` are negative. Fix: stop looking for a page. The sentence is the documentation.


## Interview questions

**★ NG2003 has related-information notes. Does that make it a traced error?**
No, and this is the sharpest distinction in the whole catalogue. A trace is produced by `traceDynamicValue` walking a `DynamicValue` and can only exist after the partial evaluator has attempted and failed to fold something. NG2003's notes are hand-written `makeRelatedInformation` calls with fixed strings, selected by a `switch` over six `ValueUnavailableKind` values — the evaluator was never involved, because the check is reflection over constructor parameter *types*, not evaluation of an expression. Editors render the two identically, so the only way to tell is to know which errors can have a trace at all. The rule from this family holds: an `NG2xxx` never has a trace; some of them have hints, and the hints are often better than a trace would be, because they name the fix.

**★ Why does angular.dev document NG2003 and NG2009 but none of NG2001, NG2004, NG2008 or NG2021?**
Because documentation status is encoded in the sign of the enum value. `PARAM_MISSING_TOKEN = -2003` and `COMPONENT_INVALID_SHADOW_DOM_SELECTOR = -2009` are the only negative members of the `NG2xxx` range; `addDiagnosticDetails` appends a `Find more at …` link for negatively-declared codes only, and the error encyclopedia's compiler table lists exactly the negatively-declared set. So there are precisely two documented `NG2xxx` codes, and it is not a coincidence or an oversight in the other twenty-six — the compiler is telling you, per error, whether a page exists. Practically: the absence of that link means the message text is the whole documentation, which is why the messages in this family are unusually long and unusually prescriptive.

**★ A team enables `verbatimModuleSyntax` and gets NG2003 across dozens of services. What happened, and what is the minimal fix?**
Their editor or linter converted class imports used only as constructor parameter types into `import type`, which is correct as far as TypeScript is concerned — the type is all TypeScript needs — but erases the binding from the emitted JavaScript. Angular's DI uses the class itself as the injection token, so erasing the value erases the token, and the compiler reports `No suitable injection token for parameter 'x' of class 'Y'.` with the `TYPE_ONLY_IMPORT` chain message, which uniquely among the six names two alternative fixes and points a related note at the offending import statement. The minimal fix is to restore the value import for any class that is injected. The structural fix is `inject()` in field initialisers, which takes the token explicitly and removes constructor-parameter reflection from the picture entirely.


**Angular's compiler knows exactly six parameter decorators. Where is that list written, and what happens to a seventh?**
It is written as an `if` / `else if` chain in `annotations/common/src/di.ts` — `Inject`, `Optional`, `SkipSelf`, `Self`, `Host`, `Attribute` — with a final `else` that throws `Unexpected decorator ${name} on parameter.` under NG1005. There is no registry, no extension point and no way to teach it a seventh. What saves most codebases is the filter one line above the chain, `.filter((dec) => isCore || isAngularCore(dec))`, which discards any parameter decorator the compiler does not believe came from `@angular/core` before the chain sees it. So a third-party parameter decorator normally passes through silently, and when you *do* see NG1005 the interesting question is why the compiler thought your decorator was a core one — usually a barrel re-export or an alias.


{/* FOOTER */}
