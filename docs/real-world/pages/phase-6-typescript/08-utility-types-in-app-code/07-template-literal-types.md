---
title: "Template literal types turn a naming convention into a checked one, and the moment two unions are combined in one template the cost stops being free"
sidebar_label: "07 · Template literal types"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the TypeScript handbook on
> [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html),
> the **4.1** release note introducing
> [template literal types and key remapping](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html),
> and the intrinsic declarations in `lib.es5.d.ts` read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout) —
> `type Uppercase<S extends string> = intrinsic;`,
> `type Lowercase<S extends string> = intrinsic;`,
> `type Capitalize<S extends string> = intrinsic;`,
> `type Uncapitalize<S extends string> = intrinsic;`.
> Target: **TypeScript 7.0.2** (phase spine).
> Documentation-validated; **no console blocks, no timings**.

**Every codebase has string conventions the compiler does not know about —
`/api/products`, `cart:item_added`, `data-testid="row-42"` — and a template
literal type is how a convention becomes a constraint.** This app uses them in
two places and declines them in a third, and the reason for the decline is the
important part: the types are built by combining unions, so a template over two
five-member unions is a twenty-five-member union, and a template over three is
where a build starts to feel it.

## Route paths, already used

```ts
// packages/client/src/path.ts — chapter 07·03b
export type PathParams<P extends string> =
  P extends `${string}:${infer Param}/${infer Rest}`
    ? {[K in Param]: string} & PathParams<Rest>
    : P extends `${string}:${infer Param}`
      ? {[K in Param]: string}
      : {};
```

That is the *pattern-matching* use: `infer` inside a template literal binds a
substring, and the recursion walks the string. It is fully explained in
[chapter 07·03b](../07-the-typed-api-client/03b-typed-path-parameters.md); what
belongs here is the other direction — building strings rather than taking them
apart.

## Building: analytics event names

```ts
// packages/shared/src/events.ts
type Entity = 'cart' | 'order' | 'product' | 'review';
type Verb   = 'viewed' | 'created' | 'updated' | 'deleted';

export type EventName = `${Entity}:${Verb}`;
//   'cart:viewed' | 'cart:created' | … | 'review:deleted'   — 16 members

export function track(event: EventName, props: Record<string, unknown>): void { … }

track('cart:viewed', {});        // ✓
track('cart:opened', {});        // ✗ not assignable to EventName
track('carts:viewed', {});       // ✗
```

**The convention is now the type.** A misspelled event name — the classic
analytics bug, where a dashboard quietly loses a funnel step because someone
wrote `cart:view` — is a compile error, and the set of valid names is
enumerable by tooling.

⚠️ **And it is 4 × 4 = 16 members from two four-member unions.** Add a fifth
entity and a fifth verb and it is 25. Add a `_${Platform}` suffix with three
platforms and it is 75. The combinatorics are the cost, and they are silent
until a build slows down.

## Building: CSS custom properties and test ids

```ts
type Token = 'brand' | 'surface' | 'text' | 'danger';
type CssVar = `--db-${Token}`;
//   '--db-brand' | '--db-surface' | '--db-text' | '--db-danger'

function cssVar(name: CssVar): string { return `var(${name})`; }
```

```ts
type TestId = `row-${number}` | `cell-${string}`;
const id: TestId = `row-${order.id}`;      // ✓ — `${number}` matches any numeric
```

📌 **`${number}` and `${string}` are patterns, not enumerations.**
`` `row-${number}` `` does not expand to infinitely many members; it stays a
*pattern type* that any matching literal is assignable to. That is why mixing a
pattern into a template is cheap and mixing two finite unions is not.

## Key remapping, the other half of the 4.1 feature

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type ProductGetters = Getters<Pick<ProductRow, 'slug' | 'stock'>>;
//   { getSlug: () => string; getStock: () => number }
```

The four intrinsics — `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize` —
are declared as `intrinsic`, meaning the compiler implements them directly
rather than in the type system. `string & K` is the idiom for narrowing a
`keyof T` (which is `string | number | symbol`) down to the string keys the
template needs, and it does the same job as
[`Extract<keyof T, string>`](05-exclude-extract-and-distributivity.md) with
fewer characters and less clarity — prefer `Extract` in code other people read.

🔴 **Getters generated from a data type are almost always the wrong feature.**
The example is here because it is the canonical demonstration of key remapping,
not because this app has any. Where remapping *does* earn its place is
transforming a shape you do not control — snake_case rows into camelCase DTOs —
and that is a decision
[chapter 02·04b](../02-zod-as-the-source-of-truth/04b-wire-types-and-envelopes.md)
made once for the whole app, at the schema level, where the runtime mapping
lives too.

## Gotchas

**★ The union sizes multiply, and there is a hard limit.** A template combining
several unions produces the cross product; the compiler refuses beyond a
certain size with a "expression produces a union type that is too complex to
represent" error. There is no partial credit — the type either works or the
build stops — so a design that reaches for three combined unions should be
reconsidered rather than tuned.

**★ `${string}` makes a *pattern*, not "any string".** `` `row-${string}` ``
accepts `'row-'` and `'row-anything'` and rejects `'col-1'`, and it stays one
type rather than expanding. That is what makes patterns composable where finite
unions are not, and it is why a test-id type is free and an event-name type is
not.

**★ `${number}` does not validate the number.** `` `row-${number}` `` accepts
`'row-1e10'`, `'row--3'` and `'row-NaN'`, because those are all valid
`number`-to-string conversions in the type's view. If the format matters, the
check is at run time.

**★ A template literal type does not constrain a `string` variable.**
`const name = 'cart:viewed'` infers `string` unless it is `const`-declared or
otherwise given a literal type, and passing a `string` where `EventName` is
expected fails. That is correct, and it means every dynamic event name needs a
narrowing step — which is usually a sign the event name should have been a
value from a table rather than a constructed string.

**★ Concatenating two template-typed strings at run time gives you `string`.**
`` `${prefix}${suffix}` `` in an expression is a `string` unless both operands
have literal types *and* the result is const-asserted. The type-level template
and the value-level template look identical and behave differently, which is
the single most confusing thing about the feature.

**★ Key remapping with `as` in a mapped type filters as well as renames.**
Mapping a key to `never` removes it — `[K in keyof T as K extends 'internal'
? never : K]` is a `StrictOmit` with a different shape. That is genuinely
useful and it is also why remapping expressions become unreadable quickly; two
transformations in one line of type syntax is where reviewers stop reading.

**★ The intrinsics are compiler magic and do not compose with your own string
logic.** `Uppercase<S>` is declared `intrinsic`; you cannot write it yourself,
you cannot see how it handles Unicode from the declaration, and there is no
`Trim`, `Split` or `Replace` intrinsic — those are written by hand with
recursive conditional types, which is where template literal type code starts
being genuinely expensive to compile.

**★ Deriving names from a data type couples them to it.** `Getters<ProductRow>`
means renaming a column renames a method, which is either exactly what you
wanted or an API break your migration caused. Same judgement as
[chunk 01](01-derive-never-redeclare.md): derive when they *should* move
together.

## Interview questions

**★ What does a template literal type actually buy over `string`?**
It turns a naming convention into something the compiler enforces.
`` `${Entity}:${Verb}` `` makes a misspelled analytics event a build error
rather than a dashboard that silently loses a funnel step, and it makes the set
of legal names enumerable — for a test, a mock, or a lookup table. The
mechanism is that the type is the cross product of the unions in the template.

**★ What is the cost, and when does it stop being free?**
The cross product is materialised: two four-member unions give sixteen members,
adding a third three-member union gives forty-eight, and the compiler eventually
refuses with "union type that is too complex to represent". Patterns like
`` `row-${number}` `` are the cheap case, because `${number}` and `${string}`
stay patterns rather than expanding. Two finite unions is a good rule of thumb;
three is a design smell.

**★ How does `PathParams` extract `:slug` from a path?**
By pattern matching with `infer` inside a template literal:
`` P extends `${string}:${infer Param}/${infer Rest}` `` binds the parameter
name and the remainder, then recurses; a second pattern handles a trailing
parameter. That is the *reading* direction of the feature, as opposed to the
*building* direction that produces event names, and both come from the same 4.1
release.

**★ What is key remapping and where is it worth using?**
The `as` clause in a mapped type — `[K in keyof T as \`get${Capitalize<string &
K>}\`]` — which renames or, by mapping to `never`, removes keys. It is worth it
for transforming a shape you do not control, such as snake_case database rows
into camelCase DTOs, and it is not worth it for generating getters from a data
type. This app does the snake-to-camel transformation at the schema level
instead, so the runtime mapping and the type change together.

**★ Why does a run-time template string not have a template literal type?**
Because the value-level and type-level features are unrelated despite the
identical syntax. `` `${a}-${b}` `` in an expression produces a `string` unless
both operands have literal types and the result is const-asserted, so a value
built at run time will not satisfy an `EventName` parameter without a narrowing
step. Needing that step usually means the name should have come from a table of
constants rather than being assembled.

---

← Prev: [`satisfies` versus annotation versus `as`](06-satisfies-versus-annotation.md) ·
[Overview](README.md) ·
Next → [`keyof` and indexed access](08-keyof-and-indexed-access.md)
