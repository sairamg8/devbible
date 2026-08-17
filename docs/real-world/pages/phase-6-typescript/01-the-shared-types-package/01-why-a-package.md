---
title: "Why a package, and what goes in it"
sidebar_label: "01 · Why a package"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [Node.js `exports` documentation](https://nodejs.org/api/packages.html#exports)
> and the [Yarn workspaces docs](https://yarnpkg.com/features/workspaces).
> Concept homes: **`type` vs `interface`** is
> [TypeScript 1·07](../../../../typescript/pages/phase-1-type-vocabulary/07-type-vs-interface.md);
> **the service `tsconfig`** is
> [TypeScript 7·01](../../../../typescript/pages/phase-7-server/01-tsconfig-for-a-node-service/README.md).
> The **eleven tables** these types describe are fixed in
> [chapter 0·02](../../phase-0-the-app/02-architecture-and-data-model.md).

## The problem

The API returns an order. The client renders an order. Both need to agree on
what an order *is* — and there are only three ways to make that happen.

| Approach | What it costs |
|---|---|
| **Duplicate the interface** on each side | Free today, and wrong within a sprint. Nothing tells you the two drifted; a renamed field is discovered by a user |
| **Import across the boundary** — client reaches into `api/src/types` | No duplication, but the client's build now walks server code, and one careless import pulls `pg` into the browser bundle |
| **One package both import** | A workspace, a build step, and a boundary you have to define — but the only option where "they agree" is enforced rather than hoped for |

This app takes the third. The rest of this chunk is the two decisions that
choice forces: **what belongs inside**, and **how each side consumes it**.

## The layout

```
storefront/
├── package.json          { "workspaces": ["packages/*", "apps/*"] }
├── packages/
│   └── shared/           @storefront/shared
│       ├── package.json
│       └── src/
│           ├── index.ts        the public surface — re-exports only
│           ├── order.ts        Order, OrderStatus, OrderLine
│           ├── product.ts      Product, ProductImage, Category
│           ├── money.ts        Money, CurrencyCode
│           └── api.ts          request/response shapes per endpoint
├── apps/
│   ├── api/              imports @storefront/shared
│   └── web/              imports @storefront/shared
```

**`index.ts` re-exports and declares nothing.** A single entry point is what
makes the next chunk's `exports` map meaningful, and it gives one place to see
the whole public surface. A type that is not re-exported is private to the
package by construction.

## What belongs in it

The test is one question: **would both sides be wrong if they disagreed about
this?**

✅ **In:**

- **Domain shapes** — `Order`, `Product`, `Money`, `Address`. The nouns.
- **Enumerations that cross the wire** — `OrderStatus`, `CurrencyCode`. The
  order state machine is **chapter 04 · Discriminated unions** *(not written
  yet)*; its *type* lives here.
- **Request and response shapes, per endpoint.** These are the contract, and
  they are the thing most likely to drift silently.
- **The error shape** from the
  [error contract](../../phase-3-express-api/09-the-error-contract.md) — a
  client that renders errors needs to know their structure.

🔴 **Out, and this is the half that gets it wrong:**

- **Database row types.** `products.deleted_at` is a column, not a field the
  client has any business knowing. Row types live beside their query module —
  see **chapter 03 · Typing raw `pg` results** *(not written yet)*.
- **Anything importing `pg`, `express`, `fs` or `node:*`.** A single such
  import makes the package unusable in a browser build, and the failure is a
  bundler error at the far end of the repo that reads as the *client's* fault.
- **Server-only config.** Secrets, connection strings, queue names. Not because
  a type leaks a value, but because the shape documents the infrastructure to
  anyone who reads the bundle.
- **React types.** The API app has no business depending on `@types/react`
  transitively.

⚠️ **The distinction that matters is row vs resource.** A `products` row and a
`Product` resource look almost identical early on, which is exactly why people
share one type — and then the schema grows `search_vector`, `deleted_at` and
`internal_notes`, and the client's type claims it receives them. **They are two
types that happen to overlap**, and the mapping between them is real code in
the data layer.

## Types only, or runtime values too?

The package holds both, deliberately, and the split is worth naming:

- **Types** — erased at build, cost nothing at runtime, and are the reason the
  package exists.
- **A small number of runtime constants** — the `ORDER_STATUSES` array the
  status union is derived from, the `CURRENCIES` allowlist the
  [validation engine](../../phase-5-js-functions/05-the-validation-engine.md)
  checks against.

🔴 **A value in a types package is a real import in both bundles**, so each one
has to earn its place. `ORDER_STATUSES` earns it because deriving the union
from the array (rather than writing both) is what stops them diverging:

```ts
export const ORDER_STATUSES = [
  'pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
```

One declaration, two artifacts — a value the API can validate against and a
type the client can switch on exhaustively. Writing the union separately means
adding a status in one place and not the other, which compiles.

⚠️ **`as const` is load-bearing.** Without it the array widens to `string[]`
and `typeof ORDER_STATUSES[number]` collapses to `string`, so every status
check silently accepts anything. The compiler stops complaining, which reads
like success.

## Gotchas

**Symptom:** The client bundle suddenly includes `pg`
**Cause:** A shared file imported a row type from a query module
**Fix:** Row types stay out; the boundary is enforced by review and by the
`exports` map in the next chunk

**Symptom:** Two identical-looking `Order` types will not assign to each other
**Cause:** Both sides have their own copy; structural typing usually hides this
until one gains a field
**Fix:** One package — this is the failure the whole chapter exists to prevent

**Symptom:** Adding an order status compiles everywhere and breaks at runtime
**Cause:** The union was written by hand alongside the array
**Fix:** Derive the union from the array with `as const`

**Symptom:** Every status comparison passes, including typos
**Cause:** `as const` missing, so the union widened to `string`
**Fix:** `as const` — and a test that asserts the union is not `string`

**Symptom:** The client type says a field exists that the API never sends
**Cause:** A row type was shared as a resource type
**Fix:** Two types and an explicit mapping in the data layer

**Symptom:** A circular import between the shared package and an app
**Cause:** The package imported something app-specific for convenience
**Fix:** The package depends on nothing in the workspace. It is a leaf, always

## Interview questions

1. **★ Why not just import the API's types directly from the client?** Because
   the import path is a build path: the client's bundler now walks server code,
   and one transitive `pg` or `node:fs` import breaks the browser build. A
   package with its own dependency list makes the boundary explicit rather than
   incidental.
2. **★ What is the test for whether a type belongs in the shared package?**
   Whether both sides would be wrong if they disagreed about it. A response
   shape passes; a database row type fails, because the client has no stake in
   what columns exist.
3. **★ Why derive `OrderStatus` from an array rather than writing the union?**
   Because the array is needed at runtime for validation and the union at
   compile time for exhaustiveness, and writing both means they can diverge —
   silently, since adding a status to one and not the other compiles.
4. **What breaks without `as const` on that array?** It widens to `string[]`,
   so the indexed access yields `string` and every status check accepts any
   string. Nothing errors; the types simply stop meaning anything, which is
   worse than a compile failure.
5. **Row type and resource type look identical today. Why keep them separate?**
   Because they diverge on schedule — the row grows `deleted_at`,
   `search_vector`, internal columns — and a shared type then claims the client
   receives fields it never sees. The overlap is a coincidence of timing, not a
   relationship.
6. **Why should the shared package depend on nothing else in the workspace?**
   So it stays a leaf in the dependency graph. Anything else risks a cycle, and
   a cycle in a types package means one side's build depends on the other's,
   which is the coupling the package was meant to remove.
7. **What is the cost of putting a runtime constant in a types package?** It
   becomes a real import in both bundles rather than being erased. That is
   acceptable for something like the status array, whose whole purpose is to be
   the single source both artifacts derive from, and not acceptable for
   convenience helpers that belong in the app that uses them.

---

← [Overview](README.md) · Next → [Consuming it from both sides](02-consuming-it.md)
