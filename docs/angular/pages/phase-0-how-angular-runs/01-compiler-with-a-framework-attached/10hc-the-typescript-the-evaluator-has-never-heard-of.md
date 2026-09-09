---
title: "Every list of Angular's metadata restrictions was written before `satisfies`, before logical assignment and before `import.meta` — so the node kinds most likely to break your build today are the ones no document mentions, and `x satisfies CardConfig` fails while `x as CardConfig` is invisible"
sidebar_label: "10hc · TypeScript it never heard of"
sidebar_position: 10.72
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts);
> and `microsoft/TypeScript` at tag `v6.0.3`:
> [`src/compiler/types.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/types.ts) and
> [`src/compiler/parser.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/parser.ts) for the node kinds and how they are produced.
> Documentation-validated; **no sandbox run** — every claim below is a node-kind comparison between two verbatim source reads, not a build result.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not**. Match on the message text.

**`visitExpression`'s chain tests twenty conditions. TypeScript's expression grammar has considerably more node kinds than that, and the ones Angular's documentation warns about — `new`, arrow functions, tagged templates — are the *old* ones, because the documentation was written in 2018 and the language has not stopped moving. The kinds that will actually surprise you in a codebase written this year are `satisfies`, the angle-bracket type assertion, logical-assignment defaults, `import.meta`, dynamic `import()` and an array elision, none of which appears in any Angular document. Each of them falls through the same final `else` and prints the same eight words. This chunk is the list, checked node kind by node kind against TypeScript's own type definitions, with the fix in code for each.**

## How this list was produced, so you can extend it

Two verbatim reads, compared. Angular's `visitExpression` (quoted in full in [09c](09c-the-partial-evaluator-is-the-grammar.md)) tests these node kinds and nothing else:

`TrueKeyword` · `FalseKeyword` · `NullKeyword` · `StringLiteral` · `NoSubstitutionTemplateLiteral` · `TemplateExpression` · `NumericLiteral` · `ObjectLiteralExpression` · `Identifier` · `PropertyAccessExpression` · `CallExpression` · `ConditionalExpression` · `PrefixUnaryExpression` · `BinaryExpression` · `ArrayLiteralExpression` · `ParenthesizedExpression` · `ElementAccessExpression` · `AsExpression` · `NonNullExpression` · a named class declaration.

Anything whose `kind` is not in that list is door one. **So the procedure for any expression you are unsure about is: find its interface in TypeScript's `types.ts`, read its `kind`, and check the list.** That is a thirty-second check with no build, and it is how every row below was settled.

## `satisfies` — `ts.SatisfiesExpression`

The single highest-traffic modern trap, because `satisfies` is exactly the operator people reach for when writing a typed configuration constant — which is exactly what metadata constants are.

TypeScript gives it its own interface with its own kind:

```ts
export interface SatisfiesExpression extends Expression {
    readonly kind: SyntaxKind.SatisfiesExpression;
    readonly expression: Expression;
    readonly type: TypeNode;
}
```

`ts.isAsExpression` matches `SyntaxKind.AsExpression` only, so `satisfies` gets none of `as`'s transparency:

```ts
interface CardConfig {
  readonly selector: string;
  readonly exportAs: string;
}

// ⛔ `satisfies` is a node kind with no branch -> This syntax is not supported.
// export const CARD_CONFIG = {
//   selector: 'app-user-card',
//   exportAs: 'userCard',
// } satisfies CardConfig;

// ✅ get the same type-checking with a typed declaration, which is not an expression at all.
export const CARD_CONFIG: CardConfig = {
  selector: 'app-user-card',
  exportAs: 'userCard',
};
```

🔴 **The annotation form is not merely a workaround — it is strictly better here.** `satisfies` and `as` are both expression-level, and the evaluator either ignores one or chokes on the other; a type annotation on the *declaration* is checked by TypeScript and never reaches `visitExpression` at all.

## The angle-bracket type assertion — `ts.TypeAssertion`

`x as string` and `<string>x` mean the same thing to TypeScript and are two different node kinds:

```ts
export interface TypeAssertion extends UnaryExpression {
    readonly kind: SyntaxKind.TypeAssertionExpression;
    readonly type: TypeNode;
    readonly expression: UnaryExpression;
}
```

`SyntaxKind.TypeAssertionExpression` is not `SyntaxKind.AsExpression`, and only the latter is tested. So in a file that still uses the old cast style:

```ts
declare const RAW_SELECTOR: unknown;

// ⛔ selector: <string>RAW_SELECTOR     -> This syntax is not supported.
// ✅ selector: RAW_SELECTOR as string  -> transparent; folds if RAW_SELECTOR folds
```

⚠️ This one is easy to misdiagnose as a resolution failure, because the *operand* is usually something dubious too. Change the cast style first — if the message changes, the cast was the syntax problem and the operand is the next one.

## Logical assignment and defaults — the `??=` family

`||=`, `&&=` and `??=` are `ts.BinaryExpression` nodes whose operator tokens are absent from `BINARY_OPERATORS`, so they exit through door three rather than door one — same message, different line of source. The complete absent-operator set is [10hd](10hd-the-two-operator-maps.md). The reason it belongs here as well is that it is *modern* syntax nobody warns about, and the fix is not the obvious one:

```ts
// ⛔ a "default it if unset" idiom, in a module that builds metadata.
// let selector = readSelector();
// selector ||= 'app-fallback';

// ✅ the conditional operator IS in the chain, and folds when its parts do.
export const CARD_SELECTOR = 'app-user-card';
```

## `import.meta` — `ts.MetaProperty`

```ts
export interface MetaProperty extends PrimaryExpression, FlowContainer {
    readonly keywordToken: SyntaxKind.NewKeyword | SyntaxKind.ImportKeyword;
    readonly name: Identifier;
}
```

One interface covers both `import.meta` and `new.target`, and neither is tested. This bites in exactly one modern situation: a Vite-flavoured build where configuration comes from `import.meta.env`.

```ts
// ⛔ selector: import.meta.env['NG_APP_CARD_SELECTOR'],
//    -> This syntax is not supported. on `import.meta`,
//       plus Unable to evaluate this expression statically. on the property access

// ✅ a plain module constant. Metadata is fixed at build time by definition —
// there is no configuration to read that is not already known when it compiles.
export const CARD_SELECTOR = 'app-user-card';
```

The two-note trace is the re-wrap described in [10h](10h-syntax-the-evaluator-cannot-read.md): `visitPropertyAccessExpression` evaluates its left-hand side, gets the `DynamicValue` from `import.meta`, and returns `fromDynamicInput`.

## Dynamic `import()` — a call whose callee is a keyword

TypeScript models a dynamic import as a call expression with a keyword callee:

```ts
export interface ImportCall extends CallExpression {
    readonly expression: ImportExpression | ImportDeferProperty;
}

export interface ImportExpression extends PrimaryExpression {
    readonly kind: SyntaxKind.ImportKeyword;
}
```

So `ts.isCallExpression` **does** match, and `visitCallExpression` runs — but its first line is `const lhs = this.visitExpression(node.expression, context);`, and `node.expression` is an `ImportKeyword` node that matches none of the chain's tests. Door one fires on the `import` keyword, and `visitCallExpression`'s `if (lhs instanceof DynamicValue)` re-wraps it.

```ts
// ⛔ trying to lazily supply metadata:
// template: (await import('./user-card.template')).TEMPLATE,

// ✅ lazy loading of a component's *dependencies* is @defer's job, and it is
// a template construct, not a metadata one.
```

Deferred loading that actually works is [11 · Why `@defer` can split a bundle](11-why-defer-can-split-a-bundle.md); `deferredImports` accepts identifiers, not import calls.

## An array elision — `ts.OmittedExpression`

Verified on both sides. TypeScript's parser produces an `OmittedExpression` for a hole in an array literal, verbatim from `parser.ts`:

```ts
function parseArgumentOrArrayLiteralElement(): Expression {
    return token() === SyntaxKind.DotDotDotToken ? parseSpreadElement() :
        token() === SyntaxKind.CommaToken ? finishNode(factory.createOmittedExpression(), getNodePos()) :
        parseAssignmentExpressionOrHigher(/*allowReturnTypeInArrowFunction*/ true);
}
```

and `visitArrayLiteralExpression` special-cases only spreads, sending everything else to `visitExpression`, verbatim:

```ts
for (let i = 0; i < node.elements.length; i++) {
  const element = node.elements[i];
  if (ts.isSpreadElement(element)) {
    array.push(...this.visitSpreadElement(element, context));
  } else {
    array.push(this.visitExpression(element, context));
  }
}
```

`OmittedExpression` is not in the chain, so a hole is unsupported syntax:

```ts
// ⛔ a comma left behind by a deletion.
// imports: [UserCard, , UserRow],

// ✅
// imports: [UserCard, UserRow],
```

⚠️ This settles the array-literal case only. [10f](10f-destructuring-in-metadata.md) leaves the behaviour of holes and rest elements inside a *binding pattern* explicitly open, and nothing on this page closes it — a binding pattern is walked by `visitBindingElement`, which is a different function with a different failure mode.

## The rest of the absent set, with what each is worth

| syntax | node kind | realistic in metadata? |
|---|---|---|
| `x++` / `x--` | `ts.PostfixUnaryExpression` | rare, but the chain tests only `isPrefixUnaryExpression`, so postfix is door one while `++x` is door two ([10hd](10hd-the-two-operator-maps.md)) |
| `yield x` | `ts.YieldExpression` | no — but it is the reason a generator body can never contribute a folded value |
| `/^app-/` | `ts.RegularExpressionLiteral` | yes, in a custom decorator's options object |
| `10n` | `ts.BigIntLiteral` | rare; note it is **not** a `NumericLiteral`, so `ts.isNumericLiteral` is false for it |
| `this` | `ts.SyntaxKind.ThisKeyword` | only three keyword kinds are tested — `true`, `false`, `null` — so `this` is door one |
| `x, y` | `ts.BinaryExpression` with `CommaToken` | the comma operator is a binary operator with no map entry — door three |

```ts
// ⛔ a regex in a custom decorator's evaluated options.
// @Validated({pattern: /^app-[a-z-]+$/})

// ✅ carry the source and flags as strings; build the RegExp where it is used.
export const SELECTOR_PATTERN = '^app-[a-z-]+$';
```

## Gotchas

**★ Symptom: adding `satisfies` to a working metadata constant breaks the build, and removing it fixes it.** Cause: `satisfies` is `SyntaxKind.SatisfiesExpression`, a different node kind from `SyntaxKind.AsExpression`, and only `as` is tested by the chain — so the constant's whole initializer became unsupported syntax the moment you added it. Fix: annotate the declaration instead of asserting the expression, which gives you stronger checking and is invisible to the evaluator:

```ts
interface CardConfig {
  readonly selector: string;
}

// ⛔ export const CARD_CONFIG = {selector: 'app-user-card'} satisfies CardConfig;
// ✅
export const CARD_CONFIG: CardConfig = {selector: 'app-user-card'};
```

**★ Symptom: `<string>value` fails and `value as string` does not, in the same file.** Cause: two node kinds for one operation; `ts.isAsExpression` recurses into the operand, and `ts.TypeAssertion` has no branch at all. Fix: use `as` in any file that contributes metadata. There is no configuration that makes the angle-bracket form work — and note that it is already forbidden in `.tsx` files for unrelated reasons, so a project-wide lint rule against it costs nothing.

**★ Symptom: a component reads its selector from `import.meta.env` and fails with two notes, one of which points at `import.meta`.** Cause: `ts.MetaProperty` is not in the chain; the inner note is door one, and the outer note is the property access re-wrapping it. Fix: metadata is fixed at build time, so there is nothing an environment variable can tell it that a module constant cannot. If the value genuinely differs per build, generate the constants file in the build step rather than reading the environment inside the decorator.

**★ Symptom: a stray comma inside `imports` produces a syntax complaint rather than a missing-import complaint.** Cause: TypeScript parses the hole as a `ts.OmittedExpression`, `visitArrayLiteralExpression` passes it to `visitExpression`, and there is no branch — so the array as a whole becomes dynamic and the note lands on the empty slot. Fix: delete the comma. This is worth knowing precisely because a hole is invisible in review and the error text says nothing about arrays.

**Symptom: a regular expression in a decorator's options object is reported as unsupported, and stringifying it fixes the build.** Cause: `ts.RegularExpressionLiteral` is not in the chain — it is a literal to TypeScript but not one of the four literal kinds Angular tests. Fix: store the pattern and flags as strings and construct the `RegExp` at the point of use, where nothing is being statically evaluated.

**Symptom: `++counter` and `counter++` produce the same message from different lines of the compiler.** Cause: they are different node kinds. The postfix form is `ts.PostfixUnaryExpression`, absent from the chain — door one. The prefix form *is* a `ts.PrefixUnaryExpression`, so it enters `visitPrefixUnaryExpression` and fails the map lookup — door two. Fix: neither belongs in metadata; the value in a decorator is computed once at compile time and there is nothing to increment.

**Symptom: your team's "no `as`, prefer `satisfies`" lint rule broke Angular metadata across the codebase.** Cause: the rule is correct for application code and inverted for decorator metadata, because the evaluator recurses through `as` and cannot see `satisfies` at all. Fix: scope the rule so that metadata modules are exempt, and prefer declaration annotations in those files — which satisfies the rule's real intent (checked, not asserted) without using either operator.

## Interview questions

**★ How would you decide, without building, whether a new TypeScript feature is usable in Angular decorator metadata?**
Find the node kind the feature parses to in TypeScript's `types.ts`, then check that kind against the twenty conditions in `StaticInterpreter.visitExpression`. If the kind is tested, the expression can fold subject to its operands folding; if it is not, the final `else` returns `DynamicValue.fromUnsupportedSyntax` and the field reports that the value could not be determined statically. For binary and prefix-unary expressions there is a second step, because the *kind* being supported does not mean the *operator* is — you also have to find the token in `BINARY_OPERATORS` or `UNARY_OPERATORS`. That two-step check settles every "can I write this?" question there is, costs one file read, and does not depend on any documentation existing.

**★ `x as CardConfig` is invisible to the evaluator and `x satisfies CardConfig` breaks it. Both are type-level operators with no runtime meaning. Why the difference?**
Because the evaluator's support is a list of node kinds, not a principle about what has runtime meaning. `ts.isAsExpression` was in the chain long before `satisfies` existed, and nobody added `ts.isSatisfiesExpression` when TypeScript shipped it; the chain has no default rule that says "type-level syntax is transparent". That is the whole explanation, and it is worth being able to give it, because the alternative explanation — that Angular has a considered position on which type operators are allowed in metadata — will lead you to look for a flag or an option that does not exist. The right response is structural: move the type onto the declaration, where no expression node is involved at all.

**Why is a hole in an array literal a *syntax* error rather than being treated as `undefined`?**
Because TypeScript represents it as a real node, `ts.OmittedExpression`, produced by `parseArgumentOrArrayLiteralElement` when it sees a comma where an element should be — and `visitArrayLiteralExpression` sends every non-spread element straight to `visitExpression`, which has no branch for that kind. The evaluator never gets as far as deciding what a hole *means*; it fails on the node's kind. The practical value of knowing this is diagnostic rather than semantic: a message about unsupported syntax with a span on empty whitespace inside `imports` is otherwise completely baffling, and the fix is a single character.

**Dynamic `import()` matches `ts.isCallExpression`. Why does it still fail?**
Because `visitCallExpression` evaluates the callee before it does anything else, and the callee of a dynamic import is not a function reference — TypeScript types it as an `ImportExpression` whose kind is `SyntaxKind.ImportKeyword`. That node matches none of the chain's tests, so door one fires on the keyword itself, and `visitCallExpression`'s first `if (lhs instanceof DynamicValue)` re-wraps the failure at the call node. It is a good illustration of why "the node kind is supported" is never the whole answer: the chain admitted the call, and the call's own first step rejected it. The same shape explains why calling a `const`-bound arrow function fails at the arrow rather than at the call ([10hb](10hb-code-as-a-metadata-value.md)).

**Every Angular document about metadata restrictions names `new`, arrow functions and tagged templates. What does the omission of `satisfies` and `import.meta` tell you?**
That the lists are historical rather than derived. They were written for View Engine's collector, in an era before those language features existed, and nothing regenerates them from the current implementation — so they will always describe the traps of the year they were written. The evaluator's chain, by contrast, is regenerated every time someone edits it, which is why the reliable procedure is to read the chain rather than the list. It also predicts the future accurately: whatever TypeScript ships next will be unsupported in metadata on the day it lands, silently, and no document will say so.

← Prev: [Code as a metadata value](10hb-code-as-a-metadata-value.md) · Index: [Topic index](README.md) · Next → [The two operator maps](10hd-the-two-operator-maps.md)
