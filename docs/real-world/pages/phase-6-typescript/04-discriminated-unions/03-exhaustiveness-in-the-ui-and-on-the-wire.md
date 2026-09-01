---
title: "Adding a sixth order status should break every screen that renders one, and JSON has no unions so the discriminant has to survive the wire"
sidebar_label: "03 · Exhaustiveness & the wire"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the TypeScript handbook's
> [exhaustiveness checking](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking)
> and the **zod 4.4.3** declarations in this repo
> (`classic/schemas.d.ts` — `discriminatedUnion`). **TypeScript 7.0.2**, zod
> **4.4.3**, React **19**. Concept homes:
> [TypeScript 2·06 — exhaustiveness](../../../../typescript/pages/phase-2-narrowing/06-exhaustiveness.md),
> [TypeScript 1·06 — `any`, `unknown`, `never`, `void`](../../../../typescript/pages/phase-1-type-vocabulary/06-any-unknown-never-void.md).
> The client this lands in is
> [Phase 4's React UI](../../phase-4-react-ui/README.md).

**The phase gate for this whole phase is a single sentence: add an order status
and the compiler walks you to every place that renders one.** Exhaustiveness is
the mechanism that makes it true, and it has exactly one enemy — the `default:`
clause, which is written by well-meaning people as defensive programming and
which converts every future compile error into a silent fallthrough. This chunk
is the pattern, the places it is applied in this app, and the boundary where a
union has to be reconstituted from JSON before any of it means anything.

## `assertNever`, and why it is a function

```ts
// packages/shared/src/assert-never.ts
export function assertNever(value: never, context?: string): never {
  throw new Error(
    `unhandled case${context ? ` in ${context}` : ''}: ${JSON.stringify(value)}`,
  );
}
```

Two things at once, which is why it is a function rather than a comment:

- **At build time**, the parameter typed `never` accepts an argument only if the
  compiler has proved the value cannot exist. Miss a case and the residual
  union is passed where `never` is required — a compile error naming the
  unhandled member.
- **At run time**, it throws with the value in the message. That matters
  because types are erased: a `'packed'` status arriving from a database
  someone edited by hand reaches this line, and the message says which value
  it was.

## The badge, exhaustively

```tsx
// apps/web/src/components/OrderStatusBadge.tsx
import {assertNever} from '@storefront/shared';
import type {OrderStatus} from '@storefront/shared';

export function OrderStatusBadge({status}: {status: OrderStatus}) {
  switch (status) {
    case 'pending':   return <Badge tone="neutral">Awaiting payment</Badge>;
    case 'paid':      return <Badge tone="info">Paid</Badge>;
    case 'shipped':   return <Badge tone="info">On its way</Badge>;
    case 'delivered': return <Badge tone="success">Delivered</Badge>;
    case 'cancelled': return <Badge tone="muted">Cancelled</Badge>;
  }
  return assertNever(status, 'OrderStatusBadge');
}
```

🔴 **There is no `default:` clause, and that is the entire design.** With one,
`status` inside it is `never` already, the `assertNever` call still compiles,
and adding `'refunded'` to `ORDER_STATUSES` produces **no error anywhere** — the
new status quietly renders whatever the default returns. The `default` clause is
the single most common way this pattern is defeated, and it is usually added by
someone making the code "safer".

⚠️ **`switch` with returns and no `default` needs the compiler to know the
switch is exhaustive**, which it does when the discriminant is a literal union
and every member has a case. If the function's declared return type is
`ReactNode`, an unhandled member makes the trailing `assertNever(status)` fail
with `Argument of type 'refunded' is not assignable to parameter of type
'never'`. That error message *names the missing case*, which is why it is worth
more than a lint rule.

## Where else exhaustiveness earns its keep in this app

| Union | Switch site | What a new member breaks |
|---|---|---|
| `OrderStatus` | the badge, the admin filter tabs, the timeline, the email template chooser | four places, all at build time |
| `CartOwner['kind']` | the merge-on-login path, the cart lookup | two places |
| `AsyncState<T>['status']` | every screen that renders loading / error / data | every consumer of `useAsync` |
| the error `code` union | the client's error panel | the one place errors are rendered |
| `sort` (`newest \| price_asc \| price_desc`) | the SQL sort table, the sort selector | the query module and the control together |

📌 **The value of the pattern scales with the number of switch sites, not with
the size of the union.** A five-member union switched on in one place is barely
worth the ceremony; the same union switched on in six places across two apps is
where "the compiler walks you to every one" stops being a slogan.

## JSON has no unions

The server sends `{"id": 41, "status": "shipped", "total_cents": 4999}`, and the
client's `fetch` produces a value with no useful type: the DOM's
`Response.json()` is declared `Promise<any>`, and Node's undici typings in this
repo declare it `json(): Promise<unknown>`
(`node_modules/undici-types/dispatcher.d.ts`). Whichever runtime you are on,
**every guarantee in this chunk evaporates at exactly the point the data
arrives** — `any` because it checks nothing, `unknown` because it permits
nothing until parsed. There are two honest responses and this app uses both,
in different places.

**Response 1 — parse the discriminant back.** For any union whose members differ
in shape, `z.discriminatedUnion` is the reconstitution:

```ts
import {z} from 'zod';

export const CartOwnerSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('guest'),   sessionId: z.number().int()}),
  z.object({kind: z.literal('account'), userId: z.number().int()}),
]);
export type CartOwner = z.infer<typeof CartOwnerSchema>;
```

The declaration, verbatim from `zod/v4/classic/schemas.d.ts`:

```ts
export declare function discriminatedUnion<
  Types extends readonly [core.$ZodTypeDiscriminable<Disc>, ...core.$ZodTypeDiscriminable<Disc>[]],
  Disc extends string,
>(discriminator: Disc, options: Types, params?: string | core.$ZodDiscriminatedUnionParams)
  : ZodDiscriminatedUnion<Types, Disc>;
```

`z.discriminatedUnion` differs from `z.union` in the error it produces, and the
difference is worth the extra argument: a plain union reports *every* member's
failure, so a malformed guest cart yields two error trees and a reader has to
work out which one was meant. The discriminated form reads the discriminant
first and reports only against the matching member.

**Response 2 — for a plain literal union, `z.enum` is enough.** `OrderStatus`
has no per-member shape, so parsing it is `OrderStatusSchema` from
[chapter 2·05](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md).
An unknown status becomes a parse failure at the client's boundary — which is
the correct behaviour when a newer server sends a status this client does not
know how to render.

🔴 **The discriminant must be a field on the wire, not a computed one.** A union
whose branches are distinguished by "has `sessionId`" rather than by
`kind` cannot round-trip through `z.discriminatedUnion` and cannot be narrowed
by a `switch`. If a union is going to cross HTTP, it gets an explicit
discriminant property, and that property is part of the API contract.

## The other direction: what a new status does to a running client

Exhaustiveness protects the *build*. It says nothing about the deployed client
from last Tuesday that has never heard of `'refunded'`. Two honest options:

- **Parse strictly and fail.** `OrderStatusSchema.parse` rejects, the response
  fails, the user sees an error. Correct for anything money-shaped; hostile for
  an order list.
- **Parse leniently and degrade.** `z.enum(ORDER_STATUSES).catch('pending')`
  would be *wrong* — it silently mislabels. The honest lenient form keeps the
  unknown value:

```ts
export const RenderableStatus = z.union([
  OrderStatusSchema,
  z.string().transform((s) => ({unknown: s}) as const),
]);
```

and the badge grows one more case for `{unknown: string}` — which the compiler
then requires everywhere, exactly as it should. **This app takes the strict
option** and pairs it with the deployment rule that clients are refreshed on a
new status, because an order list showing a status the client cannot name is
worse than an error that says "reload".

## Gotchas

**★ A `default:` clause silently disables the entire mechanism.**
It makes the switch total for the compiler, so adding a union member produces no
error anywhere. Every one of these switches has *no* `default`, and the
`assertNever` call sits after the switch rather than inside it.

**★ `assertNever` written as `(x: never) => void` instead of `=> never` breaks
control-flow analysis.** The `never` return is what tells the compiler the
function does not come back, which is what lets a `switch` with returns
type-check without a `default`. Declaring it `void` gives "not all code paths
return a value" errors that people then fix with a `default`.

**★ `if / else if` chains do not exhaust.** Only `switch` on a discriminant —
and `if` chains ending in a final `else` that calls `assertNever` — give the
compiler the residual `never`. An `if` chain with no final `else` narrows
nothing at the end of the function and silently returns `undefined`.

**★ A union arriving over HTTP is unnarrowed until it is parsed.**
Where `Response.json()` gives `any` — the DOM declaration — a `switch` on
`data.status` compiles for every case label, including misspelled ones, and
matches nothing at run time. Where it gives `unknown`, the property access
itself fails, which is the better failure. The parse is not optional ceremony; it is where the type starts being
true.

**★ `z.union` where `z.discriminatedUnion` belongs produces unreadable errors.**
A failure reports against every member, so a one-character typo in a guest cart
yields a tree of issues about accounts. Use the discriminated form whenever a
literal discriminant exists — and note that it *requires* one, so a union
without an explicit `kind` field cannot use it.

**★ A discriminant computed from the presence of a field cannot cross the
wire.** `'sessionId' in owner` narrows in TypeScript and is invisible to a
parser reading JSON. Any union that is serialised needs a real discriminant
property; adding one later is a wire-contract change.

**★ Exhaustiveness in the API's email-template chooser is as valuable as in the
UI, and easier to forget.** The worker that turns an `order.confirmed` outbox
row into an email switches on status too
([2·04](../../phase-2-node-services/04-outbox-relay-and-email.md)). A new status that
silently sends no email is a support ticket nobody connects to a deploy.

**★ `assertNever(status)` with no context string produces a useless log.**
`unhandled case: "refunded"` from an unknown file at 3 a.m. is one grep away
from an answer; `unhandled case in OrderStatusBadge: "refunded"` is zero. The
second parameter costs nothing.

**★ Narrowing is lost across a callback boundary.** `orders.map((o) =>
render(o.status))` narrows inside `render`, not at the call site; but
`useMemo(() => { if (o.kind === 'guest') … }, [o])` re-narrows on each run and a
mutable `o` can change between them. `readonly` union members
([chunk 01](01-impossible-states-and-the-schema.md)) and
[TypeScript 2·11 — narrowing lost](../../../../typescript/pages/phase-2-narrowing/11-narrowing-lost/README.md)
cover the general case.

## Interview questions

**★ Why does adding a `default:` clause defeat exhaustiveness checking?**
Because it makes the switch total from the compiler's point of view: there is no
residual union left to flow into the `assertNever` call, so adding a member
produces no error. The pattern depends on the compiler being *unable* to reach
the code after the switch for any handled value.

**★ Why must `assertNever` return `never` rather than `void`?**
Because the `never` return type tells control-flow analysis the call does not
return, which is what allows a `switch` whose cases all `return` to type-check
without a `default`. With `void`, the compiler believes execution continues past
the call and demands a return value, and the usual fix for that demand is the
`default` clause that breaks everything.

**★ The compiler proved every status is handled. Why does `assertNever` still
throw at run time?**
Because the proof is about the code, not about the data. Types are erased, and
the value arriving from the database or the network is whatever it actually is —
a status added by a migration this build predates, a hand-edited row, an older
service. The throw converts an unrenderable value into a loud, identifiable
failure instead of a blank badge.

**★ What does `z.discriminatedUnion` give you over `z.union`?**
Error quality and parsing cost. It reads the discriminant first and validates
against only the matching member, so a failure reports one coherent set of
issues instead of one per member. The price is that it requires an explicit
literal discriminant — which a union crossing HTTP needs anyway.

**★ Why can a union narrowed by `'sessionId' in owner` not cross the wire?**
Because the narrowing is a property-existence test the TypeScript compiler
performs, and JSON carries no type information for a parser to reproduce it
reliably — an object with an extra field, or a null, defeats it. Serialised
unions need a real discriminant field, which makes the shape part of the API
contract rather than an implementation detail.

**★ A new order status ships to the server. What happens to the client that is
already loaded in someone's browser?**
Its parse rejects the unknown value, because this app chose the strict option.
The user sees an error and a reload fixes it. The alternative — a lenient parse
that keeps the unknown string and a union member for it — is available and is
correct for a client that cannot be refreshed on demand, but it moves the
problem into the UI as a case that must be rendered rather than deleting it.

---

← Prev: [The transition table](02-the-transition-table.md) ·
[Overview](README.md) ·
Next → [Where a union does not pay](04-where-a-union-does-not-pay.md)
