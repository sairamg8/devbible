---
title: "⚠️ The enum holds 18 checks and the documentation table lists 16 — `unusedLetDeclaration` and `controlFlowPreventingContentProjection` are fully configurable with no doc page, the `NG` code is not what you write in `checks`, and the code range is a heuristic rather than a rule"
sidebar_label: "15b · The roster of checks"
sidebar_position: 15.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.ts) (the authoritative list, quoted complete),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts) (every doc comment below),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts) —
> against [angular.dev · Extended diagnostics](https://angular.dev/extended-diagnostics).
> ⚠️ The enum and the documentation table disagree on the number of checks; **both counts below were made by counting the entries, not by repeating a number stated anywhere**, and the discrepancy is the subject of this page.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[15](15-extended-diagnostics.md) covered the mechanism. This is the catalogue, and it needs its own
page because the obvious source for it is incomplete. The documentation's overview table lists
sixteen checks; the enum that actually defines the configurable names holds eighteen. Two real, fully
configurable diagnostics are missing from the docs entirely and have no page of their own. On top of
that, the `NG` code your terminal prints is *not* the string you write in `checks`, and the codes are
not even all in the range you would guess — two of the eighteen sit in the NG80xx range, while two
codes inside NG81xx are hard errors that cannot be configured at all. So the list here is read from
the enum, and every description is the compiler's own doc comment.**

## The authoritative list, verbatim

`extended_template_diagnostic_name.ts` at `v22.1.5`, complete:

```ts
/**
 * Enum holding the name of each extended template diagnostic. The name is used as a user-meaningful
 * value for configuring the diagnostic in the project's options.
 *
 * See the corresponding `ErrorCode` for documentation about each specific error.
 * packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts
 *
 * @publicApi
 */
export enum ExtendedTemplateDiagnosticName {
  INVALID_BANANA_IN_BOX = 'invalidBananaInBox',
  NULLISH_COALESCING_NOT_NULLABLE = 'nullishCoalescingNotNullable',
  OPTIONAL_CHAIN_NOT_NULLABLE = 'optionalChainNotNullable',
  MISSING_CONTROL_FLOW_DIRECTIVE = 'missingControlFlowDirective',
  MISSING_STRUCTURAL_DIRECTIVE = 'missingStructuralDirective',
  TEXT_ATTRIBUTE_NOT_BINDING = 'textAttributeNotBinding',
  UNINVOKED_FUNCTION_IN_EVENT_BINDING = 'uninvokedFunctionInEventBinding',
  MISSING_NGFOROF_LET = 'missingNgForOfLet',
  SUFFIX_NOT_SUPPORTED = 'suffixNotSupported',
  SKIP_HYDRATION_NOT_STATIC = 'skipHydrationNotStatic',
  INTERPOLATED_SIGNAL_NOT_INVOKED = 'interpolatedSignalNotInvoked',
  CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION = 'controlFlowPreventingContentProjection',
  UNUSED_LET_DECLARATION = 'unusedLetDeclaration',
  UNINVOKED_TRACK_FUNCTION = 'uninvokedTrackFunction',
  UNUSED_STANDALONE_IMPORTS = 'unusedStandaloneImports',
  UNPARENTHESIZED_NULLISH_COALESCING = 'unparenthesizedNullishCoalescing',
  UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION = 'uninvokedFunctionInTextInterpolation',
  DEFER_TRIGGER_MISCONFIGURATION = 'deferTriggerMisconfiguration',
}
```

🔴 **`@publicApi`, and *"used as a user-meaningful value for configuring the diagnostic"*.** The
enum's string values are the contract. That is where the name in `checks` comes from, and it is why
the `NG` code is the wrong thing to reach for when writing configuration.

**Count them: eighteen.** The documentation's overview table lists sixteen.

## The two that are configurable and undocumented

Present in the enum, absent from the docs table, with no per-check page:

| code | name | `error_code.ts` doc comment, verbatim |
|---|---|---|
| **NG8112** | `unusedLetDeclaration` | *"A `@let` declaration in a template isn't used."* |
| **NG8011** | `controlFlowPreventingContentProjection` | *"A control flow node is projected at the root of a component and is preventing its direct descendants from being projected, because it has more than one root node."* |

Both are real, both emit, and both accept `warning` / `error` / `suppress` exactly like the others.
If you have ever seen a warning you could not find documentation for, one of these two is a good
first guess.

## The code range is not a guide

Most are `NG81xx`. Two are not:

- `controlFlowPreventingContentProjection` is **NG8011**
- `deferTriggerMisconfiguration` is **NG8021**

Both sit in the NG80xx template-semantics range alongside NG8001 and NG8002. So *"NG81xx means
extended diagnostic"* is a useful heuristic and a false rule.

The reverse also holds — two codes inside NG81xx are **not** extended diagnostics but hard errors,
from `error_code.ts`:

- **NG8110** `UNSUPPORTED_INITIALIZER_API_USAGE` — *"Initializer-based APIs can only be invoked from
  inside of an initializer."*
- **NG8118** `FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION` — *"A required initializer is being invoked
  in a forbidden context such as a property initializer or a constructor."*

Neither can be configured, suppressed or demoted. Naming either in `checks` produces NG4005, per
[15d · Configuring it, and getting it wrong](15d-configuring-extended-diagnostics.md).

## Every check, with the compiler's own description

All doc comments verbatim from `error_code.ts`:

| code | name | what it catches |
|---|---|---|
| NG8011 | `controlFlowPreventingContentProjection` | *"A control flow node is projected at the root of a component and is preventing its direct descendants from being projected, because it has more than one root node."* |
| NG8021 | `deferTriggerMisconfiguration` | *"Raised when an `@defer` block defines unreachable or redundant triggers. Examples: multiple main triggers, 'on immediate' together with other mains or any prefetch, prefetch timer delay that is not earlier than the main timer, or an identical prefetch"* |
| NG8101 | `invalidBananaInBox` | *"A two way binding in a template has an incorrect syntax, parentheses outside brackets. For example: `<div ([foo])="bar" />`"* |
| NG8102 | `nullishCoalescingNotNullable` | *"The left side of a nullish coalescing operation is not nullable. `{{ foo ?? bar }}` When the type of foo doesn't include `null` or `undefined`."* |
| NG8103 | `missingControlFlowDirective` | *"A known control flow directive (e.g. `*ngIf`) is used in a template, but the `CommonModule` is not imported."* |
| NG8104 | `textAttributeNotBinding` | *"A text attribute is not interpreted as a binding but likely intended to be. For example: `attr.x="value"`, `class.blue="true"`, `style.margin-right.px="5"` … All of the above attributes will just be static text attributes and will not be interpreted as bindings by the compiler."* |
| NG8105 | `missingNgForOfLet` | *"NgForOf is used in a template, but the user forgot to include let in their statement."* |
| NG8106 | `suffixNotSupported` | *"Style bindings support suffixes like `style.width.px`, `.em`, and `.%`. These suffixes are not supported for attribute bindings. For example `[attr.width.px]="5"` becomes `width.px="5"` when bound. This is almost certainly unintentional…"* |
| NG8107 | `optionalChainNotNullable` | *"The left side of an optional chain operation is not nullable. `{{ foo?.bar }}` `{{ foo?.['bar'] }}` `{{ foo?.() }}` When the type of foo doesn't include `null` or `undefined`."* |
| NG8108 | `skipHydrationNotStatic` | *"`ngSkipHydration` should not be a binding (it should be a static attribute). … cannot be a binding and can not have values other than "true" or an empty value"* |
| NG8109 | `interpolatedSignalNotInvoked` | *"Signal functions should be invoked when interpolated in templates."* |
| NG8111 | `uninvokedFunctionInEventBinding` | *"A function in an event binding is not called. For example: `<button (click)="myFunc"></button>` This will not call `myFunc` when the button is clicked."* |
| NG8112 | `unusedLetDeclaration` | *"A `@let` declaration in a template isn't used."* |
| NG8113 | `unusedStandaloneImports` | *"A symbol referenced in `@Component.imports` isn't being used within the template."* |
| NG8114 | `unparenthesizedNullishCoalescing` | *"An expression mixes nullish coalescing and logical and/or without parentheses."* |
| NG8115 | `uninvokedTrackFunction` | *"The function passed to `@for` track is not invoked. … For the track function to work properly, it must be invoked."* |
| NG8116 | `missingStructuralDirective` | *"A structural directive is used in a template, but the directive is not imported."* |
| NG8117 | `uninvokedFunctionInTextInterpolation` | *"A function in a text interpolation is not invoked."* |

The four that need more than a line — and the five that are one mistake in disguise — are
[15c · The checks worth understanding](15c-the-checks-worth-understanding.md).

## 🔴 Two of the eighteen are not really extended diagnostics

`controlFlowPreventingContentProjection` and `unusedStandaloneImports` are fields of
`TypeCheckingConfig` — the object [14k](14k-the-checks-with-no-switch.md) quotes in full. They are
produced by the type checker rather than by the extended-diagnostics pass, and their category is
plumbed through by hand:

```ts
controlFlowPreventingContentProjection:
  this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
unusedStandaloneImports:
  this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
```

and then, separately, the per-check override:

```ts
if (
  this.options.extendedDiagnostics?.checks?.controlFlowPreventingContentProjection !== undefined
) {
  typeCheckingConfig.controlFlowPreventingContentProjection =
    this.options.extendedDiagnostics.checks.controlFlowPreventingContentProjection;
}
if (this.options.extendedDiagnostics?.checks?.unusedStandaloneImports !== undefined) {
  typeCheckingConfig.unusedStandaloneImports =
    this.options.extendedDiagnostics.checks.unusedStandaloneImports;
}
```

**The distinction is invisible to a user and very visible in source.** You configure them exactly
like the other sixteen; they simply arrive by a different route. Worth knowing for two reasons: it
explains why they appear in the type-checking config at all, and it is a reminder that "extended
diagnostic" names a *configuration surface* rather than one implementation.

## Gotchas

**★ Symptom: you put an `NG` code in `checks` and the build fails with NG4005.** Cause: the
configurable name is the enum's string value, not the code. `checks` wants `"invalidBananaInBox"`,
never `"NG8101"`. Fix:

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {"invalidBananaInBox": "error"}
    }
  }
}
```

**★ Symptom: a warning fires and you cannot find any documentation for it.** Cause: very likely
`unusedLetDeclaration` (NG8112) or `controlFlowPreventingContentProjection` (NG8011) — both are in
the enum, both are configurable, and neither is in the docs table or has a page. Fix: the doc
comments above are the description; treat the enum as the roster and the docs table as a subset of
it.

**★ Symptom: NG8110 or NG8118 cannot be suppressed and you assumed they were extended diagnostics
because of the code range.** Cause: they are hard errors about initializer-API misuse that happen to
live inside NG81xx. Fix: the code has to change; there is no category to set, and naming them in
`checks` produces NG4005. Use the enum, not the number, to decide whether something is configurable.

**★ Symptom: your team's list of extended diagnostics is missing two entries against a colleague's.**
Cause: one of you built the list from the docs table (sixteen) and the other from the enum
(eighteen). Fix: the enum is `@publicApi` and is the roster; the docs table has not kept pace. This is
worth settling explicitly if you maintain a shared config, because the two undocumented checks are
exactly the ones nobody thinks to configure.

**Symptom: `controlFlowPreventingContentProjection` behaves like a type-checking option in some
tooling.** Cause: it genuinely is one — a field of `TypeCheckingConfig` whose category is plumbed
through from `extendedDiagnostics`. Fix: configure it under `extendedDiagnostics.checks` like any
other; the dual nature does not change the configuration surface.

**Symptom: a check you configured has no effect and there is no error.** Cause: if the name is valid
but the check never fires, the likeliest reasons are that `strictTemplates` is off — which disables
the whole family, per [15](15-extended-diagnostics.md) — or the pattern genuinely does not occur. Fix:
verify `strictTemplates` first; an invalid *name* would have produced NG4005, so silence means the
name was accepted.

## Interview questions

**★ Where does the string you write in `extendedDiagnostics.checks` come from?**
From `ExtendedTemplateDiagnosticName`, an enum in `@angular/compiler-cli` marked `@publicApi`, whose
doc comment says the name *"is used as a user-meaningful value for configuring the diagnostic in the
project's options"*. It is emphatically **not** the `NG` code your terminal prints — writing
`"NG8101"` instead of `"invalidBananaInBox"` produces NG4005. The enum is also the authoritative
roster: it holds eighteen entries while the documentation's overview table lists sixteen, so two
configurable checks, `unusedLetDeclaration` and `controlFlowPreventingContentProjection`, exist with
no documentation page at all.

**★ Is every extended diagnostic in the NG81xx range?**
No, in both directions. `controlFlowPreventingContentProjection` is NG8011 and
`deferTriggerMisconfiguration` is NG8021, both in the NG80xx template-semantics range. And two codes
*inside* NG81xx are not extended diagnostics but hard errors — NG8110
`UNSUPPORTED_INITIALIZER_API_USAGE` and NG8118 `FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION` — which
cannot be configured or suppressed at all. So the code range is a heuristic, not a rule, and the enum
is the only reliable way to know whether something is configurable.

**★ Two of the eighteen are implemented differently from the rest. Which, and does it matter to a
user?**
`controlFlowPreventingContentProjection` and `unusedStandaloneImports` are fields of
`TypeCheckingConfig` rather than products of the extended-diagnostics pass — produced by the type
checker, with their category plumbed through by hand from `extendedDiagnostics.defaultCategory` and
then overridden individually if `checks` names them. It does not matter to a user, which is the
point: you configure them exactly like the other sixteen. It matters when reading source, and it is a
reminder that "extended diagnostic" names a configuration surface rather than a single
implementation.

**How would you audit which extended diagnostics your project actually has enabled?**
Start from the enum rather than the docs, because the docs table is a subset. Then read
`extendedDiagnostics.defaultCategory` for the baseline — absent means `warning` — and the `checks`
map for overrides, remembering that a name absent from `checks` takes the default. Finally confirm
`strictTemplates` is not `false`, since that disables the whole family regardless of what the
configuration says, and would additionally produce NG4003 if `extendedDiagnostics` is configured at
the same time.

**A colleague says a diagnostic is "not real" because it has no documentation page. How do you
settle it?**
By checking the enum, which is `@publicApi`. `unusedLetDeclaration` and
`controlFlowPreventingContentProjection` both emit, both accept all three categories, and neither
appears in the overview table or has a page. Documentation coverage and existence are different
questions here, and the compiler's own doc comments in `error_code.ts` are the description when the
website has none.

---

← Prev: [15 · Extended diagnostics](15-extended-diagnostics.md) · Index: [Topic index](README.md) · Next → [15c · The checks worth understanding](15c-the-checks-worth-understanding.md)
