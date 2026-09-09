---
title: "`A string value could not be determined statically.` has exactly two producers and neither of them is a string-typed field — it is always an object *key* or a template-literal *span*, one level below the thing the headline names"
sidebar_label: "10gc · Dynamic strings and computed keys"
sidebar_position: 10.62
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/result.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/result.ts).
> Documentation-validated; **no sandbox run** — no build was executed. Every message string below is a string literal read from a named file at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Nothing on this page is daggered; the trace note here arrives under `VALUE_HAS_WRONG_TYPE = 1010`, read from the assigning line of `error_code.ts` ([10g](10g-calls-enums-and-the-values-in-between.md)).

**Of the ten trace notes the compiler can emit, this is the one most often read at the wrong altitude. `A string value could not be determined statically.` never fires on `selector`, `templateUrl` or any other string field. It fires in exactly two places — `visitObjectLiteralExpression`, when a computed property *name* did not fold to a string, and `visitTemplateExpression`, when an interpolated *span* did not reduce to a primitive. Both are inside the expression that produced your field's value, which is usually in a different file from the decorator you are staring at. This page shows both producers in source, and the shared `literal()` helper that decides what counts as a primitive — the same helper that governs binary operators in [10gb](10gb-builtins-and-invalid-expression-types.md), which is why an enum member is a legal template span and an object literal is not.**

## `A string value could not be determined statically.` — two producers, both structural

`DYNAMIC_STRING`'s doc comment in `dynamic.ts` names both, and they are the only two:

> *"A string could not be statically evaluated. (E.g. a dynamically constructed object property name or a template literal expression that could not be statically resolved to a primitive value.)"*

**Producer 1 — a computed property name in an object literal.** `visitObjectLiteralExpression` asks `stringNameFromPropertyName` for a key and refuses to continue without one:

```ts
const name = this.stringNameFromPropertyName(property.name, context);
// Check whether the name can be determined statically.
if (name === undefined) {
  return DynamicValue.fromDynamicInput(node, DynamicValue.fromDynamicString(property.name));
}
```

and `stringNameFromPropertyName` is the whole rule for what may be a key:

```ts
private stringNameFromPropertyName(node: ts.PropertyName, context: Context): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  } else if (ts.isComputedPropertyName(node)) {
    const literal = this.visitExpression(node.expression, context);
    return typeof literal === 'string' ? literal : undefined;
  } else {
    return undefined;
  }
}
```

🔴 **A computed key is allowed — it just has to fold to a string.** A key written as a template literal in brackets works if the interpolated constant folds:

```ts
export const PREFIX = 'acme';

// ✅ the computed key folds to the string 'acme-role'.
export const ROLES = {[`${PREFIX}-role`]: 'admin'};
```

A key computed from a symbol does not, because the result is not a string. And a computed key that folds to a **number** is rejected too: the check is `typeof literal === 'string'`, and a numeric *literal* key is handled by the earlier branch while a computed expression yielding `42` is not.

Note the wrapping. The failure is `fromDynamicInput(node, fromDynamicString(...))`, so you get two notes: `Unable to evaluate this expression statically.` on the whole object literal, and `A string value could not be determined statically.` on the key. The second one is the diagnosis.

**Producer 2 — a template-literal span that does not reduce to a primitive.** `visitTemplateExpression`:

```ts
const value = literal(this.visit(span.expression, context), () =>
  DynamicValue.fromDynamicString(span.expression),
);
if (value instanceof DynamicValue) {
  return DynamicValue.fromDynamicInput(node, value);
}
pieces.push(`${value}`, span.literal.text);
```

The `literal()` helper is what decides, and it is the same helper the literal binary operators use ([10gb](10gb-builtins-and-invalid-expression-types.md)):

```ts
function literal(
  value: ResolvedValue,
  reject: (value: ResolvedValue) => ResolvedValue,
): ResolvedValue {
  if (value instanceof EnumValue) {
    value = value.resolved;
  }
  if (
    value instanceof DynamicValue ||
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return reject(value);
}
```

So a span may be a string, number, boolean, `null`, `undefined` — **or an enum member**, which `literal()` silently unwraps to its `resolved` value before testing. A span that resolves to a class `Reference`, an object literal (`Map`), an array or a module is rejected with `A string value could not be determined statically.`

```ts
// src/app/selectors.ts
import {CardComponent} from './card';

export const PREFIX = 'acme';
export const CONFIG = {area: 'billing'};

export const OK_1 = `${PREFIX}-card`;          // ✅ string span
export const OK_2 = `${PREFIX}-${2}`;          // ✅ number span
export const OK_3 = `${PREFIX}-${CONFIG.area}`;// ✅ span folds to a string
// export const BAD_1 = `${CONFIG}-card`;       ⛔ a Map — not a primitive
// export const BAD_2 = `${CardComponent}-x`;   ⛔ a Reference — not a primitive
```

⚠️ **Neither producer is a string-typed metadata field.** If your `selector` fails, the trace note you get is about the key or the span *inside* the expression that built it. That is why this note so often appears one file away from the decorator — the object literal or template literal it points at is usually in a constants module. [09e](09e-selector-must-reduce-to-a-string.md) is the field-side view of the same failure.

## Gotchas

**★ Symptom: `selector must be a string` with the trace note `A string value could not be determined statically.`, and your selector is obviously a string.** Cause: the note is not about the selector. It is about a computed object key or a template-literal span in whatever expression produced it, usually in a constants file the decorator imports. Fix: follow the note's span, not the headline's. Split the constant so the failing piece gets its own statement and its own trace entry:

```ts
// src/app/selectors.ts
export const PREFIX = 'acme';

// ⛔ one statement, and the failing part is a key deep inside it.
// export const SELECTORS = {[buildKey()]: `${PREFIX}-card`};

// ✅ each piece is its own statement, so each gets its own trace entry.
export const CARD_KEY = 'card';
export const CARD_SELECTOR = `${PREFIX}-card`;
export const SELECTORS = {[CARD_KEY]: CARD_SELECTOR};
```

**Symptom: an enum member interpolates into a template literal but an object constant does not.** Cause: `literal()` unwraps an `EnumValue` to its `resolved` value before testing, so an enum member is a legal template span; an object literal resolves to a `Map`, which is not. How enums fold in the first place is [10gd](10gd-enum-members-and-the-core-guard.md). Fix: interpolate the member you want, not the container — `` `${CONFIG.area}-panel` `` folds because the property access resolves to a string first.

**Symptom: a computed object key works in one constants file and not another.** Cause: the rule is `typeof literal === 'string'` on the folded key expression. A key that folds to a number is rejected by the computed branch even though a plain numeric literal key (`{0: 'x'}`) is accepted by the earlier branch. Fix: make computed keys fold to strings — wrap a numeric constant in a template literal, which folds to a string by construction.

## Interview questions

**★ You get `A string value could not be determined statically.` under a `selector must be a string` headline. Where do you look?**
Not at the selector. That note has exactly two producers, and neither is a string-typed field: a computed property name in an object literal that did not fold to a string, and a template-literal span that did not reduce to a primitive. Both are one level *below* the field — typically inside a shared constants module that the decorator imports — so the file you need to open is usually not the file the error is reported on. The headline names the field, the chain sentence says the evaluator gave up, and the trace note names the key or the span that did it. Follow the note's span.

**Why can an enum member appear inside a template literal when an object literal cannot?**
Because both go through the same `literal()` helper, and `literal()` has an explicit unwrapping step for `EnumValue` — the enum having already been folded into a `Map` of member name to `EnumValue` by `visitEnumDeclaration` ([10gd](10gd-enum-members-and-the-core-guard.md)): if the value is one, it is replaced by its `resolved` before the primitive test runs. The test then accepts `DynamicValue`, `null`, `undefined`, string, number and boolean, and rejects everything else — a `Map` (which is what a resolved object literal is), an array, a `ResolvedModule`, and a `Reference`. So an enum member is not a special case at the template-literal site; it is a special case in the shared helper, which is also why `Flags.A | Flags.B` folds in a binary expression ([10gb](10gb-builtins-and-invalid-expression-types.md)).

**A computed object key sometimes works and sometimes does not. What is the actual rule?**
`stringNameFromPropertyName` accepts an identifier, a string literal or a numeric literal directly, and for a computed name it evaluates the expression and keeps the result **only if `typeof result === 'string'`**. So computed keys are supported, but only when they fold to a string: `` [`${PREFIX}-role`] `` is fine, `[SOME_SYMBOL]` is not, and a computed key folding to `42` is not either — even though the plain literal key `42` is accepted by the earlier branch. When the key is rejected the whole object literal becomes dynamic, wrapped as `fromDynamicInput` around `fromDynamicString`, so you see two notes and the useful one is the inner one.

← Prev: [Builtins and invalid expression types](10gb-builtins-and-invalid-expression-types.md) · Index: [Topic index](README.md) · Next → [Enum members and the core guard](10gd-enum-members-and-the-core-guard.md)
