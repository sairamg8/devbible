---
title: "zod schemas as the source of truth"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** type declarations read directly
> from `node_modules/zod/v4/` in this repo, the
> [zod API reference](https://zod.dev/api) and
> [JSON Schema docs](https://zod.dev/json-schema), and
> **`@types/express-serve-static-core` 5.1.3**. Target: **TypeScript 7.0.2** on
> **Node 24.19.0**, Express **5**, PostgreSQL **17**.
> Documentation- and declaration-validated; **no console blocks, no timings**.

**Types are erased and SQL is unchecked, so at the two edges of this app the
compiler knows nothing.** A schema is the only artifact that runs at the
boundary *and* produces a type — one declaration, two readings, no way for the
check and the type to disagree. This chapter is what follows from that, in the
order it bites.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[One schema, two artifacts](01-one-schema-two-artifacts.md)** | Why the arrow points schema → type; `z.infer` is literally `z.output`, verbatim from the declaration; the four schema families and where each lives; the one place the arrow legitimately reverses (`z.ZodType<T>`) and why it is a **one-directional** check |
| 2 | **[Input types and output types](02-input-versus-output.md)** | 🔴 The chapter's hinge — `$ZodDefaultInternals` and `ZodCoercedNumber<T = unknown>` verbatim; why `z.input` of this app's query schemas is nearly `unknown`; the separate client request schema and the compile-time bridge that keeps the pair honest |
| 3 | **[Defaults, optionals and the parsed shape](02b-defaults-and-optionals.md)** | Four chains that read alike and infer differently; why order matters; why 3·12's OpenAPI is right to mark defaulted fields required; `.catch()` as `.default()`'s dangerous cousin; the one place `z.input` is the type you want |
| 4 | **[The validated request type](03-the-validated-request-type.md)** | `Valid<S>` as a **homomorphic** mapped type; the typed `validate` factory on `safeParse`'s discriminated result; the single unsound line and why it exists |
| 5 | **[The route helper](03b-the-route-helper.md)** | Parsed values as an *argument*, so inference replaces declaration merging; the response schema in the signature; the three routes that deliberately opt out; `RequestHandler`'s `unknown` return in Express 5's types |
| 6 | **[Response schemas and the mappers](04-response-schemas-and-mappers.md)** | Turning 3·12's "declared, not enforced" into a build-time check by typing the mapper's **return**; why `satisfies` is the wrong tool here; 🔴 the excess-property hole; `res.json`'s `ResBody = any` |
| 7 | **[Wire types and envelopes](04b-wire-types-and-envelopes.md)** | `Date` is not a wire type; integer cents as a claim about a driver setting; the page envelope generic and the one function whose return type must **never** be annotated; what still cannot be checked |
| 8 | **[The status enum, four ways](05-the-status-enum-four-ways.md)** | One `as const` array → union, `z.enum`, runtime list; 🔴 the fourth artifact is the Postgres enum and no type reaches it — the `pg_enum` parity test; `ALTER TYPE … ADD VALUE` inside a transaction, quoted |
| 9 | **[Composition and branded ids](05b-composition-and-branded-ids.md)** | `.pick`/`.omit`/`.extend`/`.partial` and why zod's masks are checked when `Omit` is not; `.merge()` deprecated; branded ids so `OrderId` and `CartId` stop being the same `number`; `.brand()` with no argument is a no-op |

## The four sentences to keep

1. **`z.infer` is `z.output`** — the post-parse type. The pre-parse type is
   `z.input`, and for a coercing schema it is `unknown`.
2. **A response schema is a document until it appears in a function's return
   type.** The mapper is that function, and its explicit annotation is the
   whole mechanism.
3. **Derive on the schema, read the type off the result.** zod's masks reject
   unknown keys; TypeScript's `Omit` does not.
4. **The database enum is outside the type system.** Where a type cannot
   reach, a test in CI must.

## Phase gate

You are done with this topic when you can say why a client must not build
requests against `z.input`, place `.default()` on the correct side of a
request/response line and justify it, explain what makes `Valid<S>`
homomorphic and what breaks if it is not, name the one cast in the route
helper and why it is confined there, and describe the check that keeps the
Postgres enum and the TypeScript union from drifting.

## Where this connects

Backwards to [the shared package](../01-the-shared-types-package/README.md),
which decides what may cross the wire at all, and to
[3·02's validation boundary](../../phase-3-express-api/02-the-validation-boundary.md),
which is the code being typed. Forwards to
[the row types](../03-typing-raw-pg-results/README.md) that feed the mappers,
[the order state machine](../04-discriminated-unions/README.md) whose union is
`OrderStatus`, and
[the typed API client](../07-the-typed-api-client/README.md), which parses
responses back with the very same schemas.

---

Phase index: [Phase 6 — TypeScript across the stack](../README.md) ·
Next chapter → [Typing raw `pg` results](../03-typing-raw-pg-results/README.md)
