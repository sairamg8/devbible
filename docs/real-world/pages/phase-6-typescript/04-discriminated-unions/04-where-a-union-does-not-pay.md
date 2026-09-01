---
title: "A discriminated union costs a mapper, a parse and a rewrite of every consumer, so the cases where a nullable field is the right answer deserve naming"
sidebar_label: "04 · Where it does not pay"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook on
> [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) and
> [union types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types),
> and the
> [PostgreSQL 17 `ALTER TYPE` reference](https://www.postgresql.org/docs/17/sql-altertype.html).
> **TypeScript 7.0.2**, PostgreSQL **17**. Concept homes:
> [TypeScript 5·09 — type-level performance](../../../../typescript/pages/phase-5-type-level/09-type-level-performance/README.md),
> [TypeScript 5·08 — knowing when to stop](../../../../typescript/pages/phase-5-type-level/08-knowing-when-to-stop/README.md),
> [TypeScript 3·13 — when not to write a generic](../../../../typescript/pages/phase-3-generics/13-when-not-to-write-a-generic/README.md).

**Every technique in this chapter has a cost, and the previous three chunks
argued only the benefits.** A discriminated union means a mapper at the data
boundary, a parse at the wire boundary, a rewrite of every consumer that used to
read a flat object, and a rebuild of the client whenever a member is added. When
the union has two members, one consumer and no per-member payload, all of that
buys a `switch` where an `if` would have done. This chunk is the other side of
the argument — where to stop, and the three ways this pattern misfires in a real
codebase.

## Three shapes that do not need a union

**A nullable field that is genuinely optional data.**
`products.description` defaults to `''` and `product_images.object_key` is
`not null`; but `reviews.body` may be empty and a review's images may be absent.
`images: string[]` with a possibly-empty array is the right model. A
`{kind: 'with-images'; images} | {kind: 'no-images'}` union adds a discriminant
that carries no information `images.length === 0` did not already carry.

📌 **The test: does any consumer behave differently in a way the empty case
cannot express?** For images, no — the grid renders zero of them. For the cart
owner, yes — one path merges and the other does not, and they need *different
ids*.

**A field that is nullable because it is not filled in yet, and no code
branches on it.** `orders.updated_at` is never null; `sessions.user_id` is, and
[chunk 01](01-impossible-states-and-the-schema.md) argued that one *is* a union
because guest and account sessions are handled differently. If a nullable
column is only ever displayed — "last login: never" — `Date | null` is the
model, and a union is ceremony.

**A flag with exactly two states and no payload on either side.**
`reviews.status` has three members and no per-member data, so
`ReviewStatus = 'pending' | 'approved' | 'rejected'` is a literal union and
that is the end of it. Exhaustiveness still applies — a `switch` in the
moderation queue benefits — but there are no object members and no mapper.

⚠️ **A literal union is not a discriminated union**, and conflating the two is
how "we use discriminated unions everywhere" becomes a slogan. `OrderStatus` is
a literal union; `CartOwner` is a discriminated union. The first costs nothing
and gives exhaustiveness; the second costs a mapper and gives
unrepresentable-illegal-states.

## The three ways this misfires

**1 · The union is designed from the UI and the schema cannot support it.**
Already named in [chunk 01](01-impossible-states-and-the-schema.md), and it is
the most expensive of the three because the mapper must invent a value. The
symptom is a member with a field the row type does not have and a mapper line
that reaches for the nearest plausible column.

**2 · The union grows past what a human reads.** A union with eleven members,
each with six fields, switched on in nine components, is a type that everybody
copies from and nobody reads. The compiler is fine with it; the reviewers are
not. When a union gets there, the usual real fix is that two or three members
share a shape and want a nested union, or that half the members are actually a
different concept sharing a table.
[TypeScript 5·09](../../../../typescript/pages/phase-5-type-level/09-type-level-performance/README.md)
covers the compiler-side cost of very large unions; the human-side cost arrives
first.

**3 · The union and the database enum drift.** Adding a member in TypeScript
and forgetting the migration produces code handling a state that cannot exist;
adding it in SQL and forgetting TypeScript produces a parse failure on a live
order. The
[`pg_enum` parity test](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md)
is the closure, and the PostgreSQL manual's rule bears repeating here because
it decides the *deploy order*:

> *"If `ALTER TYPE ... ADD VALUE` (the form that adds a new value to an enum
> type) is executed inside a transaction block, the new value cannot be used
> until after the transaction has been committed."*

So the safe sequence is: migration adding the value (its own transaction) →
deploy the code that can render it → deploy the code that produces it. Reverse
any two and there is a window in which a live client meets a status it cannot
name.

## What a sixth status actually costs

Worth pricing, because "the compiler walks you to every place" is a benefit and
a bill:

| Place | Change |
|---|---|
| `ORDER_STATUSES` | one line |
| `order_status` in Postgres | a migration, alone in its own transaction |
| `TRANSITIONS` | fails to compile until the new key is added — **the gate firing** |
| `OrderStatusBadge` | fails to compile — a case and a label |
| the admin filter tabs | fails to compile |
| the email-template chooser in the worker | fails to compile |
| the parity test | passes once both sides are done |
| deployed clients | reject the value until refreshed |

**Six edits, five of them compile errors that name themselves.** That is the
whole argument for the chapter, expressed as a checklist rather than a claim —
and it is also, honestly, six edits where a `status: string` codebase would have
had one and a bug.

## Gotchas

**★ "Use discriminated unions everywhere" turns literal unions into object
unions for no benefit.** `{kind: 'pending'} | {kind: 'paid'} | …` for a status
with no per-member data is strictly worse than `'pending' | 'paid' | …`: more
allocation, more mapping, worse ergonomics at every comparison, and identical
exhaustiveness.

**★ A union with a member that is never constructed is dead code the compiler
protects.** Every switch handles it, every reviewer reads it, and nothing
produces it. Unions decay this way when a state is removed from the product but
not from the type. The `pg_enum` parity test catches it in one direction only —
the enum still has the label — so removing a state means removing it from both,
and removing an enum label in Postgres is genuinely awkward, which is part of
the cost of enum columns.

**★ A discriminated union in a React prop forces every parent to narrow.**
`<OrderCard order={order} />` where `Order` is a union means the card narrows
internally — fine — but a parent that wants to pass only the shipped variant
has to narrow first, and `order as ShippedOrder` starts appearing. If a
component only ever renders one member, its prop type should be that member.

**★ Exhaustiveness on a union with a `string` fallback member is not
exhaustiveness.** Adding `| {unknown: string}` to make a lenient client parse
possible means `assertNever` can never be reached, so the compiler stops
reporting missing cases. If you take the lenient route, the fallback member
must be handled *explicitly* and the remaining literal members still switched
individually — do not collapse them into the fallback.

**★ Narrowing does not survive a `structuredClone`, a `JSON.parse` round trip
or a state setter typed loosely.** `useState<Order>(order)` keeps the union;
`useState<any>(order)` throws it away, and so does storing the object in
`localStorage` and reading it back
([4·05's mirror](../../phase-4-react-ui/05-uselocalstorage-and-cart.md)).
Anything that leaves the process needs the parse on the way back in.

**★ A `switch` over a union in a `.map` callback re-narrows per element, which
is correct, and a `switch` over a union captured in a closure may not.** If the
value can change between the narrowing and the use — a mutable ref, a stale
closure over a state variable — the narrowing describes a value that is no
longer there. Readonly members make this a compile error rather than a runtime
surprise.

## Interview questions

**★ When is a nullable field the right model and a union the wrong one?**
When no consumer branches in a way the empty or null case cannot already
express. An order with no images renders zero images; there is no second code
path and no second set of data, so `images: string[]` is complete. A cart with a
session id and a cart with a user id take different code paths *and* carry
different ids — that is what makes it a union.

**★ What is the difference between a literal union and a discriminated union,
and why does it matter here?**
A literal union is a set of primitive values — `OrderStatus`. A discriminated
union is a set of object types sharing a literal-typed property — `CartOwner`.
Both give exhaustiveness; only the second makes illegal *combinations of data*
unrepresentable, and only the second costs a mapper and a parser. Reaching for
the second where the first suffices adds allocation and ceremony for no
guarantee.

**★ Price a sixth order status. What breaks and where?**
One line in `ORDER_STATUSES`, one migration in its own transaction, and then
four compile errors that name themselves: the transition table's `satisfies`
check, the status badge, the admin filter, and the worker's email-template
switch. The parity test goes green when both halves land. Deployed clients
reject the value until they are refreshed, which is why the migration ships
before the code that produces the status.

**★ Why does the migration adding an enum value have to be its own
transaction?**
Because the PostgreSQL manual states that a value added by `ALTER TYPE … ADD
VALUE` inside a transaction block cannot be used until that transaction commits.
A migration that adds the label and immediately writes it fails at the write,
with an error naming the value rather than the transaction — so it reads as
though the label was never created.

**★ Your union has eleven members and nine switch sites. What do you do?**
Stop and ask whether it is one concept. Usually two or three members share a
shape and want to become a nested union, or a subset of the members is really a
different entity that happens to live in the same table. The compiler will
carry eleven members happily; the reviewers will not, and a type nobody reads is
a type nobody maintains.

**★ Someone adds `default: return null` to the status badge "for safety". What
have they done?**
Removed the phase gate. The switch becomes total, the trailing `assertNever` is
unreachable for any value, and the next status added to the union renders as
nothing with no error at build time and no throw at run time. It is the exact
inversion of the intent: the defensive line is what makes the failure silent.

---

← Prev: [Exhaustiveness and the wire](03-exhaustiveness-in-the-ui-and-on-the-wire.md) ·
[Overview](README.md) ·
Next chapter → **Typed Express handlers** *(not written yet)*
