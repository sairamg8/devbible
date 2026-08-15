---
title: "Phase 7 — TypeScript on the server"
sidebar_label: "Phase 7 · TypeScript on the server"
sidebar_position: 7
---

> Verified: 2026-08 against the **TypeScript handbook** (*Modules → Reference*,
> *Modules → Theory*), the **`tsconfig` reference** on typescriptlang.org, the
> **Node.js API docs** (*Modules: TypeScript*, *Command-line API*), the
> **Express 5 documentation**, and the **DefinitelyTyped** sources for
> `@types/node`, `@types/express` and `@types/pg`. Targets **TypeScript 7.0.2**
> and **Node 24.19.0** (Active LTS).
> **No sandbox, no console blocks** — nothing on these pages was run, so nothing
> here is presented as a transcript. Where a claim depends on a version
> boundary, the version is named.

:::caution Re-scoped 2026-08-15 — this phase is COMPLETE at 5 topics
On the user's instruction, Part B was cut to **phases 10 and 12 only**, with
anything already written kept. This phase keeps its **five written Master
topics** (01–05); its **ten unwritten Understand rows are dropped** and are
struck through in the table below.

**Nothing was deleted.** The five topics here are complete, build-verified and on
the reading path. The dropped rows stay listed as a record of what the syllabus
covered — reopening any of them needs a new instruction.
:::

**5 topics in scope** (originally 15). Phases 0–6 taught the type system as a language. This is the
first phase where TypeScript meets **other people's code** — Node's standard
library, Express's router, a database driver, and an environment you do not
control.

The theme that runs through all fifteen topics, and the reason this phase is
front-loaded with Master rows:

> **Every input to a server is `unknown`, whatever its declared type says.**
> The request body, `process.env`, a database row, a thrown value, a JSON
> payload — each one arrives as bytes and is *given* a type by an annotation
> somebody wrote. The annotation is a claim, not a check.

Phase 9 is where that observation becomes a discipline (*parse, don't
validate*). This phase is where you learn to **see** it — to look at
`req.body.email` and know that the compiler has been told something nobody
verified.

The other half of the phase is less philosophical and more practical: a
TypeScript service has a build story, and getting `tsconfig.json` wrong is the
single most common reason a Node project's types "just don't work".

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [`tsconfig.json` for a Node 24 service](./01-tsconfig-for-a-node-service/README.md) *(5 chunks)* | <span className="db-tier t-master">Master</span> | The two decisions the whole file follows from, and the annotated config for each |
| 02 | [Shipping TypeScript to production](./02-shipping-to-production/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | `tsc` build vs running `.ts` on Node 24; source maps and readable stack traces either way |
| 03 | [Typing `process.env`](./03-typing-process-env/README.md) *(3 chunks)* | <span className="db-tier t-master">Master</span> | It is `string \| undefined` and it lies — why parsing beats augmenting `ProcessEnv` |
| 04 | [`catch (e: unknown)`](./04-catch-e-unknown/README.md) *(4 chunks)* | <span className="db-tier t-master">Master</span> | Proving what was thrown; `instanceof Error`, custom classes, `error.cause` |
| 05 | [Typed Express handlers](./05-typed-express-handlers/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | The four `Request` generics, and why a typed body is a promise the compiler cannot keep |
| ~~06~~ | ~~Augmenting `Express.Request`~~ | <span className="db-tier t-master">Master</span> | ⛔ **dropped** — `req.user` by declaration merging, and the `include` mistake that silently no-ops it |
| ~~07~~ | ~~Typing `pg` query results~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — `query<T>()` is an **assertion, not a check** — a renamed column is `undefined` with a green build |
| ~~08~~ | ~~Typed middleware~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — `RequestHandler`, typing `next`, and the four-argument signature TypeScript cannot enforce |
| ~~09~~ | ~~Async handlers~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — `Promise<void>` handlers, Express 5's rejected-promise forwarding, and the return type |
| ~~10~~ | ~~Typed configuration loading~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — Schema-validated env at startup, failing fast, one exported typed `config` |
| ~~11~~ | ~~DTOs vs domain types vs row types~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — Three shapes of "a user", and what collapsing them leaks |
| ~~12~~ | ~~Typing the service and repository layer~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — Keeping driver types out of business logic; typing a transaction-carrying function |
| ~~13~~ | ~~Typed errors → HTTP responses~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — An error union mapped to status codes with an exhaustiveness check |
| ~~14~~ | ~~Typing MongoDB and Mongoose~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — Generic documents, `ObjectId`, lean queries, and where inference gives up |
| ~~15~~ | ~~Sharing types with the client~~ | <span className="db-tier t-understand">Understand</span> | ⛔ **dropped** — A shared package, `import type` only, and what must *not* cross |

⛔ **Struck-through rows are dropped** (2026-08-15) and are not scheduled work.

## The scope boundary — read this before you look for missing material

These pages deliberately overlap Express, PostgreSQL and MongoDB. The split is
**"they own the mechanism, TypeScript owns the typing of it"**:

- *How* a middleware runs, in what order, and what `next(err)` does — that is
  Express's phase on middleware, and it is written.
- *How* a middleware is **typed**, and why `RequestHandler`'s four-argument
  overload is not enforceable — that is here.

So a row that looks thin is usually a row that links out. If you want the
mechanism, follow the link; if you want the types, stay.

## Phase gate

Move on when a request can travel **body → validated DTO → domain type → row
type → response**, with the type changing at each boundary *on purpose*, and you
can point at the exact line where the data stops being untrusted.

The failure this gate is checking for is the one-type service: a single `User`
interface used for the request body, the business logic, the database row and
the JSON response. It compiles, it works, and it leaks your `password_hash`
column into an HTTP response the first time somebody adds a column.

## Where this connects

- **← [Phase 0 · `tsconfig.json` anatomy](../phase-0-how-typescript-runs/06-tsconfig-anatomy.md)**
  — the option-by-option tour. Topic 01 here is the *service-shaped* version of it.
- **← [Phase 0 · Three ways to run TypeScript](../phase-0-how-typescript-runs/03-three-ways-to-run.md)**
  — `tsc`, a bundler, or Node's own stripping. Topic 02 picks between them.
- **← [Phase 2 · `unknown` in `catch`](../phase-2-narrowing/12-unknown-in-catch.md)**
  — the language rule. Topic 04 is what to do with it on a server.
- **← [Phase 3 · Generics](../phase-3-generics/README.md)** — `query<T>()`,
  `Request<P, ResBody, ReqBody, Query>` and `Repository<T>` are all constrained
  generics wearing domain names.
- **→ Phase 9 · Types at the boundary** *(dropped 2026-08-15)* — where "the
  annotation is a claim, not a check" becomes an architecture.

---

← [TypeScript explanations index](../README.md) · Start → [01 · `tsconfig.json` for a Node 24 service](./01-tsconfig-for-a-node-service/README.md)
