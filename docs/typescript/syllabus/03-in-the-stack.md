---
title: "Part 3 — TypeScript in the stack"
sidebar_label: "3 · In the stack"
sidebar_position: 3
---

> **Phases 7–9 · 44 topics · 15 Master**
> The same type system pointed at a real application: an Express service, a
> React client, and the untyped data flowing between them.

**Scope note — read before approving.** These three phases deliberately overlap
Express, React and PostgreSQL. The split is *"they own the mechanism, TypeScript
owns the typing of it"*: how a middleware runs is Express's page, how a
middleware is **typed** is here, and each row links out rather than
re-explaining. This is the same shape as the PostgreSQL/Node boundary exception.
If you would rather push the typing rows into React and Express, this part
collapses to one phase — say so before any page is written.

---

:::caution Re-scoped 2026-08-15 — read before using this part
**Phase 7 kept only its five Master rows** (topics 01–05, all written and linked
below). Its ten Understand rows are **dropped**. **Phases 8 and 9 are dropped in
full** — nothing was written for either.

The rows are kept here deliberately, as the record of what the syllabus covered;
they are **not scheduled work**. Reopening any of them needs a new instruction.
Part B's remaining scope is [phases 10 and 12](./04-rigour-and-tooling.md).
:::

## Phase 7 — TypeScript on the server

*15 topics.* A typed Node/Express service, end to end. The recurring theme is
that the server's inputs — env vars, request bodies, database rows, thrown
values — are all `unknown` in reality, whatever their declared types claim.

| Topic | Tier |
|---|---|
| **`tsconfig.json` for a Node 24 service** — `module: nodenext`, `target`, `lib`, `@types/node`, `strict`, and `noEmit` if the runtime strips types itself | <span className="db-tier t-master">Master</span> |
| **Shipping TypeScript to production** — build with `tsc` vs run `.ts` directly on Node 24; source maps, `--enable-source-maps`, and readable stack traces either way | <span className="db-tier t-master">Master</span> |
| **Typing `process.env`** — it is `string \| undefined` and it lies; augmenting `ProcessEnv` vs parsing the environment once into a typed config object (and why parsing wins) | <span className="db-tier t-master">Master</span> |
| **`catch (e: unknown)`** — every error path starts by proving what was thrown; `instanceof Error`, custom error classes, `error.cause`, and the guard that survives bundling | <span className="db-tier t-master">Master</span> |
| **Typed Express handlers** — the `Request` generics (`Params`, `ResBody`, `ReqBody`, `Query`), what each slot does, and why a typed body is a promise the compiler cannot keep | <span className="db-tier t-master">Master</span> |
| **Augmenting `Express.Request`** — adding `req.user` properly with declaration merging, and the `include` mistake that makes it silently not apply | <span className="db-tier t-master">Master</span> |
| **Typing `pg` query results** — `query<T>()` is an **assertion, not a check**: the driver never verifies the row shape, so a renamed column is a runtime `undefined` with a green build | <span className="db-tier t-understand">Understand</span> |
| **Typed middleware** — `RequestHandler`, the four-argument error handler signature TypeScript cannot enforce, and typing `next` | <span className="db-tier t-understand">Understand</span> |
| **Async handlers** — typing `Promise<void>` handlers, Express 5's rejected-promise forwarding, and why the return type matters to the router | <span className="db-tier t-understand">Understand</span> |
| **Typed configuration loading** — schema-validated env at startup, failing fast, and one exported typed `config` | <span className="db-tier t-understand">Understand</span> |
| **DTOs vs domain types vs row types** — three shapes of "a user", why collapsing them into one leaks database columns into HTTP responses | <span className="db-tier t-understand">Understand</span> |
| **Typing the service and repository layer** — keeping driver types out of business logic, and typing a transaction-carrying function | <span className="db-tier t-understand">Understand</span> |
| **Typed errors → HTTP responses** — an error union mapped to status codes with an exhaustiveness check, so a new error type cannot be forgotten | <span className="db-tier t-understand">Understand</span> |
| **Typing MongoDB and Mongoose** — generic documents, `_id` and `ObjectId`, lean queries, and where Mongoose's inference gives up | <span className="db-tier t-understand">Understand</span> |
| **Sharing types with the client** — a shared package, `import type` only, and what must *not* cross the boundary | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** a request can travel body → validated DTO → domain type
→ row type → response, with the type changing at each boundary on purpose, and
you can point at the exact line where the data stops being untrusted.

---

## Phase 8 — TypeScript in React

> ⛔ **DROPPED 2026-08-15.** Nothing written. Kept as a record only.

*14 topics.* Typing components, hooks and events. Almost every row is a pattern
with one well-known wrong version — this phase is largely about knowing which
is which, and why the wrong one is still everywhere online.

| Topic | Tier |
|---|---|
| **Typing props** — a plain `type` for the props object, `ReactNode` for children, and why `React.FC` is no longer the default advice | <span className="db-tier t-master">Master</span> |
| **`useState`** — when inference is enough, when you must write `useState<T \| null>(null)`, and the union you actually wanted | <span className="db-tier t-master">Master</span> |
| **`useRef`** — DOM refs (`useRef<HTMLInputElement>(null)`) vs mutable value refs, and the `.current` null narrowing dance | <span className="db-tier t-master">Master</span> |
| **Event types** — `React.ChangeEvent<HTMLInputElement>`, `FormEvent`, `MouseEvent`, and finding the right one from the handler signature instead of guessing | <span className="db-tier t-master">Master</span> |
| **`useReducer` with a discriminated union of actions** — the pattern where TypeScript pays for itself most obviously in React | <span className="db-tier t-understand">Understand</span> |
| **`useContext`** — the `undefined` default and the custom hook that narrows it, so consumers never check | <span className="db-tier t-understand">Understand</span> |
| **Generic components** — `<Table<Row> …>`, constrained item types, and typing a render prop | <span className="db-tier t-understand">Understand</span> |
| **Discriminated union props** — making mutually exclusive props impossible to combine, instead of documenting that they conflict | <span className="db-tier t-understand">Understand</span> |
| **Typing custom hooks** — returning a tuple with `as const`, returning an object, and the inference difference | <span className="db-tier t-understand">Understand</span> |
| **`ComponentProps<typeof X>`** — extending a native or third-party component's props without restating them | <span className="db-tier t-understand">Understand</span> |
| **Refs across the boundary** — ref-as-prop in React 19 and the `forwardRef` code you still have to maintain | <span className="db-tier t-understand">Understand</span> |
| **`ReactNode` vs `ReactElement` vs `JSX.Element`** — three return types with three different meanings, and which one a prop should accept | <span className="db-tier t-understand">Understand</span> |
| **Typing forms** — controlled inputs, schema-validated submits, and typing a form library's resolver | <span className="db-tier t-understand">Understand</span> |
| Polymorphic components (`as` prop) — the full generic version, and an honest note on its cost | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can type a generic list component with a render
prop and a discriminated set of props, and explain what breaks if you use
`React.FC` instead.

---

## Phase 9 — Types at the boundary

> ⛔ **DROPPED 2026-08-15.** Nothing written. Kept as a record only.

*15 topics.* The phase this whole syllabus builds toward. **Types are erased, so
nothing crosses the network typed.** Every row here is about the seam where a
static guarantee stops and a runtime check has to start.

| Topic | Tier |
|---|---|
| **Static types stop at the network** — an annotated `fetch` result is a *hope*; the API can change and your build stays green | <span className="db-tier t-master">Master</span> |
| **Parse, don't validate** — convert `unknown` into a domain type once, at the edge, and let the type system carry it from there | <span className="db-tier t-master">Master</span> |
| **Schema-first with zod/valibot** — `z.infer` as the single source of truth, and never hand-writing a type that duplicates a schema | <span className="db-tier t-master">Master</span> |
| **`unknown` at the door, never `any`** — the one-line policy that keeps unchecked data from spreading through a codebase | <span className="db-tier t-master">Master</span> |
| **JSON does not round-trip your types** — `Date` becomes a string, `undefined` disappears, `BigInt` throws, `Map`/`Set` flatten; what to do about each | <span className="db-tier t-master">Master</span> |
| **Typed `fetch` wrappers** — `response.json()` is `any` (or `unknown` with the right lib), and how to build a client that cannot skip validation | <span className="db-tier t-understand">Understand</span> |
| **Generated clients** — OpenAPI → TypeScript, GraphQL codegen; types derived from the contract rather than agreed by convention | <span className="db-tier t-understand">Understand</span> |
| **Database row types** — hand-written types vs Kysely/Drizzle/Prisma inference vs generation from the live schema; what each costs when the schema changes | <span className="db-tier t-understand">Understand</span> |
| **Typed environment parsing** — the boundary everyone forgets is a boundary | <span className="db-tier t-understand">Understand</span> |
| **Branded IDs across layers** — a `UserId` that a raw `string` cannot satisfy, and where to mint and unwrap them | <span className="db-tier t-understand">Understand</span> |
| **Error shapes over the wire** — a discriminated union response (`{ ok: true, data } \| { ok: false, error }`) validated on arrival | <span className="db-tier t-understand">Understand</span> |
| **Sharing schemas between form and API** — one schema, validated in the browser and again on the server, and why the second time is not redundant | <span className="db-tier t-understand">Understand</span> |
| **Versioning shared types** — a monorepo package vs a published one, and how a type change becomes a breaking API change | <span className="db-tier t-know">Know</span> |
| **End-to-end inference (tRPC-style)** — what full-stack type inference buys, and the coupling and build-time it costs | <span className="db-tier t-know">Know</span> |
| Contract testing vs shared types — what types cannot prove about a running service | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can point to the exact line in a request path where
data stops being `unknown`, and say what happens to every downstream type if
that line is deleted.

---

## Where this connects

- **Phase 7 → Express Phases 7–8** — layering and validation middleware are
  Express's pages; the types on them are here.
- **Phase 7 → PostgreSQL Phase 9** — the API CRUD patterns are written there in
  SQL and `pg`; this phase types the results and names the assertion in
  `query<T>()`.
- **Phase 8 → React** — React owns rendering, hooks semantics and reconciliation.
  This phase assumes all of it and only types it.
- **Phase 9 → Node Phase 8** — validation as *security* is Node's; validation as
  *the place types begin* is here. Same library, different question.
- **Deliberately not here:** REST design, pagination, auth flows, hook
  semantics, query planning. Every one of those has a home already.

---

← [Part 2 — Types at scale](./02-types-at-scale.md) · Next: [Part 4 — Rigour and tooling](./04-rigour-and-tooling.md) →
