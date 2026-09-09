---
title: "`selector: ''` is an error on a `@Directive` and silently becomes `ng-component` on a `@Component` — and the ShadowDom check that is supposed to catch the rest has three sentences, two regular expressions and an escape hatch that skips any selector containing a bracket"
sidebar_label: "10if · Selector shape"
sidebar_position: 10.85
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/ng_module/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/ng_module/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/diagnostics.ts),
> [`packages/compiler/src/schema/dom_element_schema_registry.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/schema/dom_element_schema_registry.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts);
> and angular.dev — [NG2009: Invalid Shadow DOM selector](https://angular.dev/errors/NG2009).
> Documentation-validated; **no sandbox run**. Every message quoted below is a string literal read from one of those files at that tag, or quoted from angular.dev.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Every number on this page is undaggered — all were read from a line of `error_code.ts` that assigns them.

**That a selector must *fold to a string* is [09e](09e-selector-must-reduce-to-a-string.md)'s subject. This chunk is everything that happens to the string afterwards, and it is where the family's least defensible behaviour lives. The same two lines of source raise `Directive Foo has no selector, please add it!` on a `@Directive` whose selector folded to `''` and raise **nothing at all** on a `@Component` in the identical situation, because the component handler passes a default selector and the directive handler passes `null`. The message that does fire hard-codes the noun `Directive` even for a component, while a second call site in the NgModule handler computes it correctly — so the noun tells you which check fired. And NG2009, the check meant to catch a selector that cannot be a custom element, returns `null` and checks nothing at all for any selector containing a dot or a bracket pair. Three checks, three codes, and every one of them has an edge the documentation does not mention. The last member of the family, `NG2003: Missing Token`, is [10ig](10ig-ng2003-and-the-sign-of-the-enum.md).**

## After the string: three checks, three codes

Once `selector` has folded, `annotations/directive/src/shared.ts` does two more things with it, and a third check happens much later. Verbatim:

```ts
    if (typeof resolved !== 'string') {
      throw createValueHasWrongTypeError(expr, resolved, `selector must be a string`);
    }
    // use default selector in case selector is an empty string
    selector = resolved === '' ? defaultSelector : resolved;
    if (!selector) {
      throw new FatalDiagnosticError(
        ErrorCode.DIRECTIVE_MISSING_SELECTOR,
        expr,
        `Directive ${clazz.name.text} has no selector, please add it!`,
      );
    }
```

| check | code | when |
|---|---|---|
| `selector must be a string` | NG1010 | the folded value is not a string |
| `Directive X has no selector, please add it!` | NG2004 | the folded value is `''` **and there is no default selector** |
| the three ShadowDom sentences | NG2009 | the selector is fine but incompatible with `ViewEncapsulation.ShadowDom` |

The fourth member of the family — `NG2003: Missing Token`, whose headline names a constructor parameter rather than a metadata field — is [10ig · NG2003 and the sign of the enum](10ig-ng2003-and-the-sign-of-the-enum.md).

## 🔴 `selector: ''` is an error on a `@Directive` and not on a `@Component`

`defaultSelector` is a parameter, and the two handlers pass different things. From `annotations/directive/src/handler.ts`, verbatim, comment included:

```ts
      /* defaultSelector */ null,
```

From `annotations/component/src/handler.ts`, verbatim:

```ts
      this.elementSchemaRegistry.getDefaultComponentElementName(),
```

and that method, from `packages/compiler/src/schema/dom_element_schema_registry.ts`, verbatim:

```ts
  override getDefaultComponentElementName(): string {
    return 'ng-component';
  }
```

So the same two lines of source produce opposite outcomes:

- **`@Directive({selector: ''})`** — `defaultSelector` is `null`, `!selector` is true, NG2004 fires with a message that says *missing* about a selector you can see.
- **`@Component({selector: ''})`** — `defaultSelector` is `'ng-component'`, `!selector` is false, **no error at all**, and the component is compiled with the selector `ng-component`.

⚠️ **That second case is not a hypothetical and it is not benign.** A selector constant that folds to `''` — an environment string that was not set, a lookup that missed, a barrel re-export of the wrong name — silently gives a component the same selector as every other component in that situation. It compiles, it ships, and the symptom is a template that matches the wrong component or nothing at all, with no diagnostic anywhere. It is one of the very few places in this catalogue where the correct outcome is an error and you get silence.

**Fix.** There is nothing to configure; the defence is to never let a selector be computed from anything that can be empty:

```ts
import {Component, Directive} from '@angular/core';

// ⛔ NG2004 — `Directive Highlight has no selector, please add it!`
// @Directive({selector: ''})
// export class Highlight {}

// ⚠️ NO ERROR — this component's selector is `ng-component`.
export const MAYBE_EMPTY = '';

@Component({
  selector: MAYBE_EMPTY,
  template: `<ng-content />`,
})
export class SilentlyDefaulted {}

// ✅ a literal cannot be empty by accident.
@Component({
  selector: 'acme-status-panel',
  template: `<ng-content />`,
})
export class StatusPanel {}
```

## The other NG2004: a class declared in an NgModule with no selector at all

Omitting `selector` entirely is **legal** — the `!selector` check lives inside `if (directive.has('selector'))`, so a component with no `selector` key never reaches it. A routed component that is only ever instantiated by the router does not need one.

It becomes an error only when the class is *declared in an NgModule*. A second call site, `annotations/ng_module/src/handler.ts`, verbatim:

```ts
          if (dirMeta.selector === null) {
            throw new FatalDiagnosticError(
              ErrorCode.DIRECTIVE_MISSING_SELECTOR,
              decl.node,
              `${refType} ${decl.node.name.text} has no selector, please add it!`,
            );
          }
```

Note the difference from the first site: `refType` is computed as `Component` or `Directive` from the metadata, so this one says `Component Foo has no selector, please add it!` where the `shared.ts` site hard-codes the word `Directive` even for a `@Component`. **The noun in the message tells you which call site fired**, and therefore whether the cause is an empty selector on a directive or a selectorless class in an NgModule's `declarations`.

## NG2009 — the ShadowDom selector check, and its escape hatch

**Symptom.** One of three sentences, on the `selector` expression, only on a component using `ViewEncapsulation.ShadowDom`.

**Cause.** `annotations/component/src/diagnostics.ts`, the whole function, verbatim — it is short and every line matters:

```ts
export function checkCustomElementSelectorForErrors(selector: string): string | null {
  // Avoid flagging components with an attribute or class selector. This isn't bulletproof since it
  // won't catch cases like `foo[]bar`, but we don't need it to be. This is mainly to avoid flagging
  // something like `foo-bar[baz]` incorrectly.
  if (selector.includes('.') || (selector.includes('[') && selector.includes(']'))) {
    return null;
  }

  if (!/^[a-z]/.test(selector)) {
    return 'Selector of a ShadowDom-encapsulated component must start with a lower case letter.';
  }

  if (/[A-Z]/.test(selector)) {
    return 'Selector of a ShadowDom-encapsulated component must all be in lower case.';
  }

  if (!selector.includes('-')) {
    return 'Selector of a component that uses ViewEncapsulation.ShadowDom must contain a hyphen.';
  }

  return null;
}
```

Three things to take from it.

**The first check is an escape hatch that the docs do not mention.** A selector containing a `.` or a bracket pair returns `null` immediately — no check at all. So `@Component({selector: 'MyThing[shadow]'})` with ShadowDom encapsulation passes, because it looks like an attribute selector. The comment says openly that this is not bulletproof and does not need to be.

**The rules are string tests, not a custom-element-name validator.** `/^[a-z]/`, `/[A-Z]/`, `includes('-')` — three regular expressions over the folded string. Nothing here consults the DOM's actual custom-element rules, which is why the message wording differs from the browser's.

**It is raised as a collected diagnostic, not thrown**, and only when the encapsulation is `ShadowDom` or `ExperimentalIsolatedShadowDom`. So, like the stylesheet failures in [10ib](10ib-resources-that-are-not-there.md), it does not abort the component's analysis.

angular.dev's [NG2009](https://angular.dev/errors/NG2009) page states the rule as a list, verbatim:

> *"In order for a tag name to be considered a valid custom element name, it has to: Be in lower case. Contain a hyphen. Start with a letter (a-z)."*

**Fix.** Rename the selector. The docs' own before/after is a one-word change, and the compiler is checking the string you gave it, not the class name:

```ts
import {Component, ViewEncapsulation} from '@angular/core';

// ⛔ NG2009 — `Selector of a component that uses ViewEncapsulation.ShadowDom must contain a hyphen.`
// @Component({
//   selector: 'panel',
//   encapsulation: ViewEncapsulation.ShadowDom,
//   template: `<ng-content />`,
// })
// export class PanelBad {}

// ✅
@Component({
  selector: 'acme-panel',
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `<ng-content />`,
})
export class ShadowPanel {}
```

## `exportAs must be a string`

The same check, one field over, and worth naming only because it is the field people forget is evaluated at all:

```ts
      throw createValueHasWrongTypeError(expr, resolved, `exportAs must be a string`);
```

NG1010, chain sentence, trace when the value did not fold. Everything [09e](09e-selector-must-reduce-to-a-string.md) says about `selector` applies here unchanged.

## Gotchas

**★ Symptom: a component with a visible `selector:` key and no error, but nothing in any template ever matches it.** Cause: the selector folded to `''`, and for a `@Component` the empty string is a *request for the default*, which is `'ng-component'`. No diagnostic is raised because `!selector` is false. Fix: never compute a selector from something that can be empty. There is no compiler setting that makes this an error:

```ts
import {Component} from '@angular/core';

// ⛔ silently becomes `ng-component` if the constant is empty.
// selector: SELECTOR_FROM_CONFIG,

// ✅
@Component({selector: 'acme-report-card', template: `<ng-content />`})
export class ReportCard {}
```

**★ Symptom: `Directive Foo has no selector, please add it!` on a class that is unmistakably a `@Component`.** Cause: the `shared.ts` call site hard-codes the noun `Directive` in its message, regardless of which decorator it is analysing. The other call site, in the NgModule handler, computes it. Fix: use the noun to identify the *call site*, not the class — `Directive` means an empty-string selector on either decorator, `Component` means a class with no selector at all that was listed in an NgModule's `declarations`.

**★ Symptom: NG2009 on one ShadowDom component and silence on another with an equally invalid tag name.** Cause: the check returns `null` immediately for any selector containing a `.` or a bracket pair, because those look like class or attribute selectors. A component selector such as `Panel[shadow]` is never checked. Fix: none available in the compiler — treat NG2009 as a partial check by design, and do not infer from its silence that a selector is a valid custom element name.

**Symptom: `selector must be a string` and you expect a "missing selector" error because the constant is empty.** Cause: two different checks in sequence. `typeof resolved !== 'string'` fires first and only for non-strings; an empty string *is* a string and passes it, reaching the default-selector line below. Fix: read which of the two you got — they mean opposite things about whether the expression folded.

**Symptom: `exportAs must be a string` on a field you did not know was evaluated.** Cause: `exportAs` goes through the identical `evaluator.evaluate` + `typeof` pair as `selector`. Fix: same rules, same fixes ([09e](09e-selector-must-reduce-to-a-string.md)); there is nothing special about it.

## Interview questions

**★ `selector: ''` — what happens, and does it depend on the decorator?**
It depends entirely on the decorator, and the difference is undocumented. The compiler reads the empty string as a request for a caller-supplied default: `selector = resolved === '' ? defaultSelector : resolved`. The `@Directive` handler passes `null` for that default, so `!selector` is true and NG2004 fires — `Directive Foo has no selector, please add it!`, a *missing* selector error for a selector you can see. The `@Component` handler passes `getDefaultComponentElementName()`, which returns `'ng-component'`, so the default is truthy, no error is raised, and the component compiles with the selector `ng-component`. The second case is the dangerous one: a selector constant that unexpectedly folds to empty produces no diagnostic at all and a component that quietly will not match its own template usage.

**★ Two call sites raise NG2004 with almost the same sentence. How do you tell which one you hit, and why does it matter?**
By the noun. `annotations/directive/src/shared.ts` hard-codes `Directive ${name} has no selector, please add it!` even when it is analysing a `@Component`; `annotations/ng_module/src/handler.ts` computes `${refType}` from the metadata and says `Component` or `Directive` correctly. So a `@Component` class reported as `Directive` came from the first site, which means the selector expression folded to `''`. A `@Component` class reported as `Component` came from the second, which means the class has no `selector` key at all and was listed in an NgModule's `declarations` — a completely different fix, because omitting a selector is otherwise perfectly legal for a routed component.

**The ShadowDom selector check skips anything containing a dot or a bracket pair. Is that a bug?**
No, and the source says so in a comment: it exists to avoid flagging `foo-bar[baz]`, it is admitted not to be bulletproof, and the author states it does not need to be. The check's purpose is to catch the common mistake — a one-word tag name on a ShadowDom component, which the browser will reject as a custom element name — not to be a complete custom-element validator. The reader-facing consequence is what matters: NG2009 firing means your selector is definitely wrong, but NG2009 *not* firing does not mean it is right. Treating a partial check as a total one is how a wrong tag name reaches the browser with a green build behind it.

← Prev: [The standalone gates](10ie-the-standalone-gates.md) · Index: [Topic index](README.md) · Next → [NG2003 and the sign of the enum](10ig-ng2003-and-the-sign-of-the-enum.md)
