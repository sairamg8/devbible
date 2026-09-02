---
title: "The union costs one ergonomic — you cannot destructure it before narrowing — and TypeScript 4.4 and 4.6 between them pay most of that cost back"
sidebar_label: "01c · Narrowing at the call site"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript **4.4** release note on
> [control flow analysis of aliased conditions and discriminants](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html),
> the TypeScript **4.6** release note on
> [control flow analysis for destructured discriminated unions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-6.html),
> the handbook on
> [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
> (the `in` operator, type predicates, `never`), and the **zod 4.4.3**
> `ZodSafeParseResult` declaration read in this repo
> (`zod/v4/classic/parse.d.cts`).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**The one real complaint about `AsyncState<T>` is that `const {status, data} =
useAsync(…)` does not compile, and the person making it is right.** `data` is
not a property of the union, only of one member, so the destructuring fails
before any narrowing can occur. There are exactly two answers — narrow first,
or declare the absent fields as `?: never` — and the choice has consequences
for every consumer. Around that sit the narrowing rules that decide whether the
`if` you wrote actually reaches the property you want: aliased discriminants,
destructured discriminants, the component boundary, and the places narrowing
quietly stops.

## The destructuring that does not compile, and the two fixes

```ts
const {status, data} = useAsync(fetchProduct, [slug]);
//              ^^^^ Property 'data' does not exist on type 'UseAsync<Product>'
```

**Fix one — narrow, then destructure.** The narrowed value is a single member,
so every field on it is destructurable:

```ts
const state = useAsync(fetchProduct, [slug]);
if (state.status === 'success') {
  const {data} = state;          // Product
}
```

**Fix two — `?: never` on the members that lack the field.** This is what zod
does. Verbatim from `zod/v4/classic/parse.d.cts`:

```ts
export type ZodSafeParseResult<T> = ZodSafeParseSuccess<T> | ZodSafeParseError<T>;
export type ZodSafeParseSuccess<T> = { success: true;  data: T;         error?: never };
export type ZodSafeParseError<T>   = { success: false; data?: never;    error: ZodError<T> };
```

With `?: never` present on every member the property exists on the union, the
destructuring is legal, and TypeScript 4.6's analysis narrows the resulting
*variables*:

> *"When destructuring individual properties into a `const` declaration, or
> when destructuring a parameter into variables that are never assigned to,
> TypeScript will check for if the destructured type is a discriminated union.
> If it is, TypeScript can now narrow the types of variables depending on
> checks of other variables."*

```ts
const {success, data, error} = ProductSchema.safeParse(json);
if (success) { data.slug; }      // data: Product   — 4.6 narrowed the VARIABLE
else         { error.issues; }   // error: ZodError<Product>
```

**This app takes fix one for `AsyncState` and zod takes fix two for
`safeParse`, and both are right.** `safeParse` is called on one line in the
middle of other code and `const {data, error} =` is the shape its users write
constantly; `AsyncState` is switched on across four branches in a component
body, where the narrowing exists anyway. The cost of fix two is four `?: never`
declarations per member and a `data` that is `T | undefined` for anyone who
destructures without checking.

## Aliased discriminants: pulling `status` out is safe, if it is `const`

TypeScript 4.4 made the extracted discriminant narrow the **original object**:

```ts
const state = useAsync(fetchProduct, [slug]);
const {status} = state;
if (status === 'success') { render(state.data); }   // ← narrows `state`
```

The release note's own example is the same shape, and the rule it states is
narrow:

> *"When TypeScript sees that we are testing a **const** value, it will do a
> little bit of extra work to see if it contains a type guard. If that type
> guard operates on a `const`, a `readonly` property, or an un-modified
> parameter, then TypeScript is able to narrow that value appropriately."*

Make that `let status = state.status`, or reassign `state` anywhere in the
function, and the analysis switches off and `state.data` is an error again —
with no diagnostic explaining that a `let` twelve lines away caused it.

The note also says the analysis is transitive, which is what makes the
two-hook screen readable:

```tsx
const product = useAsync((s) => api.get('/products/:slug', {slug}, s), [slug]);
const reviews = useAsync((s) => api.get('/products/:slug/reviews', {slug}, s), [slug]);

const bothReady = product.status === 'success' && reviews.status === 'success';
if (bothReady) {
  return <ProductPage product={product.data} reviews={reviews.data} />;
  //                            ^^^^^^^^^^^^        ^^^^^^^^^^^^  both narrowed
}
```

> *"One neat feature here is that this analysis works transitively. TypeScript
> will hop through constants to understand what sorts of checks you've already
> performed."*

📌 **And it has a limit the note states out loud** — *"there's a cutoff -
TypeScript doesn't go arbitrarily deep when checking these conditions"*. When a
derived condition stops narrowing for no visible reason, the chain of consts is
the first thing to shorten.

## Narrowing stops at the component boundary

```tsx
// ✗ the child re-narrows what the parent already knew
function ProductPanel({state}: {state: UseAsync<Product>}) {
  if (state.status !== 'success') return null;    // again
  return <ProductDetail product={state.data} />;
}
```

Passing the whole state down means every child repeats the switch, and each
repetition is a place a new member can be forgotten. Pass the **narrowed
member** — extracting it from the union by its discriminant so the child's prop
type stays derived rather than hand-written:

```tsx
type SuccessOf<T> = Extract<AsyncState<T>, {status: 'success'}>;

function ProductPanel({state}: {state: SuccessOf<Product>}) {
  return <ProductDetail product={state.data} />;   // no check, none possible
}
```

Better still, pass `product: Product` and let the parent's switch be the only
place the union is mentioned. **The union belongs to the screen that owns the
fetch;** components below it take data. `Extract` is
[chapter 08·05](../08-utility-types-in-app-code/05-exclude-extract-and-distributivity.md).

## `assertNever` and why it returns `never`

```ts
// packages/shared/src/assert.ts
export function assertNever(value: never, where: string): never {
  throw new Error(`${where}: unhandled ${JSON.stringify(value)}`);
}
```

The parameter is `never`, so it accepts a value only where the compiler has
proved no members remain; the **return** type is `never`, so a call in tail
position satisfies a function whose declared return type is `ReactNode` without
returning one. Both halves are load-bearing:
[chapter 04·03](../04-discriminated-unions/03-exhaustiveness-in-the-ui-and-on-the-wire.md)
owns the argument and this is the copy the hooks use.

## Gotchas

**★ `const {status, data} = useAsync(…)` fails, and the error names the wrong
thing.** The message is about `data` not existing on the union, which reads as
"the hook does not return data" rather than "you have not narrowed yet". Every
developer meeting this type hits it once; the fix is `const state = …` plus a
switch, and it is worth saying so in the hook's doc comment.

**★ Changing `const` to `let` silently disables aliased narrowing.** A refactor
that turns `const state` into `let state` — to reassign it in a branch, say —
makes every `state.data` in the function an error, and the errors appear at the
property accesses, not at the `let`. The same happens if the discriminant is
pulled out with `let status = state.status`. The rule from the 4.4 note is the
one to remember: the guard must operate on a `const`, a `readonly` property, or
an un-modified parameter.

**★ Narrowing does not follow the value into a callback you write later.**
The safe pattern is to capture the narrowed *value*, not to rely on the guard
holding inside the closure:

```tsx
if (state.status === 'success') {
  const product = state.data;                       // capture, then close over
  return <button onClick={() => addToCart(product)}>Add</button>;
}
```

Referencing `state.data` inside the arrow instead makes the narrowing a
question about the checker's treatment of captured bindings, which is a
question you never need to ask if the value is already in a `const`.

**★ A type predicate is an assertion the compiler does not check.**
A predicate declared as
`isSuccess<T>(s: AsyncState<T>): s is Extract<AsyncState<T>, {status:'success'}>`
is convenient, and its *body* — `return s.status === 'success'` — is not
verified against the claim. Invert the comparison by
mistake and every caller is narrowed to the wrong member with no diagnostic
anywhere. For a four-member union switched on directly, the predicate is
ceremony that adds an unchecked step; use it when the check is genuinely
non-trivial, and keep the body one expression long.

**★ `'previous' in state` is the narrowing to reach a field that only some
members declare.** For the keep-previous union
([01b](01b-idle-and-keep-previous.md)), `state.previous` is an error on the
union because `idle` and `success` lack it. The `in` operator is the handbook's
listed narrowing for exactly this case, and it is the right tool inside a state
updater where the incoming value has not been switched on.

**★ Truthiness on `previous` swallows the legitimately empty result.**
`state.previous ? <DataTable rows={state.previous}/> : <Skeleton/>` shows a
skeleton for a filter that genuinely matched zero rows, because `[]` is truthy
but `previous` was set to `null` for "no previous". Distinguish "never loaded"
from "loaded nothing" by keeping `previous: T | null` and testing `!== null`,
not by testing truthiness of whatever `T` happens to be.

**★ The switch must be over `state.status`, not over a copy taken before an
update.** In an event handler that both reads state and dispatches, the
`state` in the closure is the one from the render the handler was created in.
That is a React rule, not a TypeScript one, and the types cannot see it — the
narrowing is perfectly sound and the value is stale. Read fresh state in the
updater function, as
[chunk 04](04-usereducer-and-the-action-union.md) does for the cart.

## Interview questions

**★ Someone writes `const {status, data} = state` and it fails to compile.
What are the options and which does this app take?**
Either narrow first — `if (state.status === 'success')` and then destructure
the narrowed value — or declare `data?: never` and `error?: never` on the
members that lack them, which makes the properties exist on every member so the
destructuring is legal and TypeScript 4.6's destructured-discriminant analysis
narrows the resulting variables. This app narrows first;
`ZodSafeParseResult` takes the `?: never` route because `const {data, error} =
safeParse(x)` is the ergonomic its users hit on every line.

**★ Does pulling the discriminant into a variable break narrowing?**
Not since TypeScript 4.4, provided the variable is a `const` and the object it
came from is a `const`, a `readonly` property or an un-modified parameter —
`const {status} = state; if (status === 'success') state.data` narrows `state`
itself. Change either binding to `let` and the analysis stops, and the errors
surface at the property accesses rather than at the declaration that caused
them.

**★ How do you type a child component that only renders the success state?**
Give its prop the extracted member —
`Extract<AsyncState<Product>, {status: 'success'}>` — so it cannot be handed a
loading state and needs no check of its own. Or, usually better, give it
`product: Product` and keep the union in the screen that owns the fetch.
Passing the whole state to children means every child repeats the switch, and
each repetition is a place a new member gets forgotten.

**★ Why is `assertNever`'s parameter `never` and its return type also `never`?**
The parameter being `never` means the call type-checks only where the compiler
has eliminated every union member — that is the exhaustiveness check. The
return type being `never` means the call is assignable to any declared return
type, so `return assertNever(state, 'ProductPage')` satisfies a function
declared to return `ReactNode` without inventing a value. Drop either and the
pattern stops working: a parameter of `unknown` never errors, and a return of
`void` forces a bogus `return null` after it.

**★ When is a type predicate the wrong tool for narrowing this union?**
Whenever the check is a single discriminant comparison. The predicate's body is
not verified against its declared claim, so it introduces an unchecked
assertion in exchange for saving one comparison, and if the body is ever
inverted or extended incorrectly, every call site is narrowed to a type the
value does not have. Reserve predicates for checks the compiler genuinely
cannot express, and keep those bodies to one expression.

---

← Prev: [`idle` and keep-previous](01b-idle-and-keep-previous.md) ·
[Overview](README.md) ·
Next → [Generic hooks and where inference comes from](02-generic-hooks-and-inference.md)
