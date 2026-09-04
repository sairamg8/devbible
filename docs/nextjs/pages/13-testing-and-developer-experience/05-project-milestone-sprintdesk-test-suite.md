---
title: "Project Milestone — SprintDesk's test suite is finished when every layer has written down what it cannot cover, because a suite trusted for things it does not check is worse than no suite"
sidebar_label: "5 · Milestone: SprintDesk test suite"
sidebar_position: 18
description: "The five test layers and the exact boundary between them, unit coverage on the data layer including the tenancy invariant test that is worth more than the rest combined, fixture strategy that survives parallel runs, and coverage configured as a ratchet rather than a target."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Testing](https://nextjs.org/docs/app/guides/testing) (lastUpdated 2026-02-03), [How to set up Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest) (2026-08-25), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (2026-06-17), [How to use environment variables in Next.js](https://nextjs.org/docs/app/guides/environment-variables) (2026-08-25) and [Vitest — Coverage](https://vitest.dev/guide/coverage). Documentation-verified; **no sandbox run, no coverage figures**.
> Target: **Next.js 16.3.4** · React 19.2.8 · **Vitest 5.0.0** · Zod 4.4.3 · Node.js 24.20.0.

**This milestone assembles the four preceding chunks into one suite for one application. It is not a re-teach — the runner configuration is [1](01-unit-and-component-testing-jest-vitest-react-testing-library.md), the Server-Component and Action mechanics are [1b](01b-testing-server-components-and-server-actions.md), Playwright's configuration is [2](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md) and [2b](02b-testing-ppr-activity-and-playwright-in-ci.md). What this page adds is the part those pages cannot supply: a decision about *which* of SprintDesk's failure modes each layer is responsible for, written as acceptance criteria, with an explicit statement per layer of what it does not see. The second half of each section is the one that matters. A team that knows its unit tests cannot detect a broken tenancy predicate will write the test that can; a team that believes 80% coverage means the data layer is safe will not.**

## SprintDesk, as a testable system

The running project is a multi-tenant SaaS task dashboard. The properties that drive test design:

- **Every row belongs to a team.** Tasks, labels, boards, comments and attachments are all team-scoped, and the authorization model is a predicate in the data layer rather than a check in the UI.
- **Auth.js sessions** identify the user; team membership is a join, not a claim in the token.
- **Drizzle on Neon**, with a pooled connection string.
- **The dashboard shell is prerendered** and the board streams in — Cache Components is on, so Partial Prerendering is the default and client navigation keeps the previous route in the DOM via `<Activity>`.
- **Board filters live in the URL**; drag-and-drop mutates optimistically and reconciles against a Server Action.
- **Mutations revalidate by tag** (`board:<teamId>`), so a stale board after a mutation is a caching bug, not a rendering bug.

Each of those is a different kind of failure and lands in a different layer.

## The five layers, and the boundary between them

| Layer | Tool | Owns | Cannot see |
|---|---|---|---|
| **Types** | `tsc` | Shape errors across every call site; route validity | Any value that arrived at runtime |
| **Schemas** | Zod | The request boundaries — `searchParams`, `FormData`, bodies, env, vendors | Ownership, invariants across rows |
| **Unit** | Vitest (node env) | Data-layer helpers, the tenancy predicate, mappers, pure logic | Anything that needs a real database or a real request |
| **Component** | Vitest + jsdom + RTL | Client components, synchronous Server Components | `async` Server Components, streaming order, prefetching, real navigation |
| **End-to-end** | Playwright against `next start` | Auth, board CRUD, streaming order, PPR shell, instant navigation | Anything a browser cannot observe — a query that returns the wrong rows but renders plausibly |

🔴 The eligibility rule that governs rows three and four is not a preference. The Next.js testing guide states it:

> *"Since `async` Server Components are new to the React ecosystem, some tools do not fully support them. In the meantime, we recommend using End-to-End Testing over Unit Testing for `async` components."*

So there is no "integration test of the board page". There is a unit test of `getBoard`, a component test of `<TaskCard>`, and a Playwright test of the board. The gap between them is real, it is a property of the ecosystem rather than of your suite, and pretending otherwise produces a file full of mocks asserting mocks — the diagnosis is in [1b](01b-testing-server-components-and-server-actions.md).

## Layer 3 in detail — unit coverage on the data layer

This is the milestone's named deliverable, and it is worth being precise about what "the data layer" means here. `packages/db` (or `lib/data/`) exports functions like `getBoard`, `listTasks`, `insertTask`, `moveTask`. Three different things live inside them, and only two are unit-testable without a database.

### 3.1 The tenancy predicate — the highest-value test in the suite

Every query must be scoped to a team, and the failure mode of forgetting is catastrophic and invisible: the query works, the page renders, and one customer sees another's tasks. Reviewing for it does not scale. Encode it structurally instead.

```ts
// lib/data/scope.ts
import 'server-only'

/** A team id that has been checked against the caller's session. */
export type TeamScope = { readonly teamId: string; readonly __checked: unique symbol }

export function scopeFor(teamId: string, membership: { teamId: string }): TeamScope {
  if (membership.teamId !== teamId) {
    throw new Error(`scope mismatch: session is not a member of ${teamId}`)
  }
  return { teamId } as TeamScope
}
```

Every exported query takes a `TeamScope`, never a bare string. The type is unforgeable outside `scopeFor`, so a query cannot be called without a checked scope — a compile-time guarantee, not a convention. Then the runtime test asserts the predicate reaches SQL:

```ts
// lib/data/__tests__/tenancy.test.ts
import { describe, expect, it } from 'vitest'
import { buildListTasksQuery } from '../tasks'

describe('every list query is team-scoped', () => {
  it('emits a team_id predicate', () => {
    const { sql, params } = buildListTasksQuery(
      { teamId: '11111111-1111-1111-1111-111111111111' } as never,
      { status: ['todo'] },
    )
    expect(sql).toContain('team_id = ')
    expect(params).toContain('11111111-1111-1111-1111-111111111111')
  })
})
```

The point of `buildListTasksQuery` being a separate, pure function is precisely this: a query builder that returns SQL and parameters is unit-testable, and a function that builds and executes in one step is not. Splitting them is the design change the test asks for, and it is worth making.

### 3.2 Mappers and derived values

Row-to-domain mapping, `isOverdue`, board grouping, the sort comparator, the optimistic-reconciliation merge used by drag-and-drop. All pure, all cheap, all worth exhausting — these are where an off-by-one in ordering or a timezone assumption lives.

```ts
// lib/board/__tests__/group-by-status.test.ts
import { describe, expect, it } from 'vitest'
import { groupByStatus } from '../group-by-status'

describe('groupByStatus', () => {
  it('emits every status column even when empty', () => {
    const columns = groupByStatus([])
    expect(Object.keys(columns)).toEqual(['todo', 'doing', 'blocked', 'done'])
  })

  it('preserves position order within a column', () => {
    const columns = groupByStatus([
      { id: 'b', status: 'todo', position: 2 },
      { id: 'a', status: 'todo', position: 1 },
    ])
    expect(columns.todo.map((t) => t.id)).toEqual(['a', 'b'])
  })
})
```

The first test is the interesting one: "a board with no done tasks still has a done column" is exactly the case that produced the `undefined` in [3](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md), and it is the case a happy-path fixture never covers.

### 3.3 The queries themselves

`getBoard` executing SQL against Neon is not a unit test. It is either an integration test against a real database — a legitimate layer, and one this milestone does not require — or it is covered end-to-end by Playwright reading a seeded board. Choose one and say which. What you must not do is mock the Drizzle client and call the result a data-layer test: that asserts your mock returns what you told it to.

### What layer 3 cannot cover

- That the scoped query is *called* by the page. A perfectly-tested `listTasks` is irrelevant if `page.tsx` calls a different function.
- That the SQL is valid. String assertions on generated SQL catch a missing predicate, not a syntax error.
- Migrations, indexes, connection pooling, or anything about Neon.
- Whether `revalidateTag` was called with the right tag. That is an Action-level and E2E concern.

### Acceptance criteria — layer 3

- [ ] Every exported query accepts a `TeamScope`, never a bare `teamId` string.
- [ ] `scopeFor` has tests for the match, the mismatch and the missing-membership cases.
- [ ] Every list/read query has a builder test asserting the `team_id` predicate and the bound parameter.
- [ ] Every mapper and comparator has a test for the empty case and the ordering case.
- [ ] No test in this layer imports the Drizzle client.
- [ ] The suite runs with no database available.

## Layers 1 and 2 — the criteria

Types and schemas are covered in full on [3](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md) through [3e](03e-env-schemas-and-contract-tests.md). The milestone's criteria for them:

- [ ] `tsconfig.json` has `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax`.
- [ ] `typedRoutes: true`, with `.next/types/**/*.ts` in `include`.
- [ ] CI runs `next typegen && tsc --noEmit` as a distinct step from `next build`.
- [ ] A schema exists for board `searchParams`, every Server Action's `FormData`, every Route Handler body, and the server and client environment.
- [ ] The env schemas parse at module scope and throw, so a missing variable fails the build rather than being cached ([4c](04c-hashing-caching-and-cache-poisoning.md)).
- [ ] Every third-party response has a schema and a scheduled contract test ([3e](03e-env-schemas-and-contract-tests.md)).

## Layer 3b — Server Actions

Each action gets **three** tests, because the Server Actions guide is explicit that a schema covers only one obligation:

> *"Schema validation (zod or similar) only checks the shape of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

- [ ] **Shape** — a table of good and bad `FormData` inputs, asserting the returned `fieldErrors`.
- [ ] **Authorization** — a fake session for a non-member; the action must reject before touching the repository.
- [ ] **Effect** — the repository received the expected write, and the expected tag was revalidated.

Mechanics — importing a `'use server'` module, faking the session, what the directive does and does not change — are [1b](01b-testing-server-components-and-server-actions.md).

## Test data that survives a parallel run

Two requirements pull in opposite directions: tests must not see each other's data, and the suite must run in parallel. The usual answer — truncate the database between tests — forces serial execution and makes the suite slower every time it grows.

SprintDesk is multi-tenant, so it already has the isolation mechanism built in: **give every test its own team**.

```ts
// test/factories.ts
import { randomUUID } from 'node:crypto'

export function aTeam(overrides: Partial<Team> = {}): Team {
  return { id: randomUUID(), name: `team-${randomUUID().slice(0, 8)}`, ...overrides }
}

export function aTask(scope: { teamId: string }, overrides: Partial<Task> = {}): Task {
  return {
    id: randomUUID(),
    teamId: scope.teamId,
    title: 'Write the migration',
    status: 'todo',
    position: 1,
    assigneeId: null,
    dueAt: null,
    ...overrides
  }
}
```

Builders with sensible defaults and an overrides parameter — not shared fixture constants. A shared `TASK_FIXTURE` object gets mutated by one test and breaks another an hour later, and the failure appears in a file nobody touched.

Environment reproducibility is not a convention here, it is enforced by the framework: `.env.local` is deliberately not read when `NODE_ENV` is `test`, because *"you expect tests to produce the same results for everyone."* So every value a test depends on belongs in the committed `.env.test`, and the runner needs `loadEnvConfig` from `@next/env` to read it at all ([3e](03e-env-schemas-and-contract-tests.md)).

## Coverage: configure it as a ratchet

Two Vitest facts change what a coverage number means.

**By default only files touched by a test appear in the report.** A module with no tests at all is invisible, so a suite covering three files can report a high percentage while most of the codebase is untested. Set `coverage.include` so untested files count:

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
      exclude: ['**/*.stories.tsx', '**/__tests__/**'],
      thresholds: {
        autoUpdate: true,
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
        'lib/data/**': { lines: 90, functions: 90, branches: 80, statements: 90 },
      },
    },
  },
})
```

`thresholds.autoUpdate` *"Update all threshold values … when current coverage is better than the configured thresholds"* — which turns the global thresholds into a ratchet: they can only go up, and a commit that lowers coverage fails without anyone having chosen a target. The per-glob entry is the deliberate exception: the data layer is where a gap is expensive, so it gets a real floor.

⚠️ **No source states a correct coverage percentage, and this page will not invent one.** The numbers above are illustrative of the *mechanism*; the defensible position is a ratchet plus a high floor on the directory where untested code costs the most.

`thresholds.perFile` checks each file against the thresholds rather than the aggregate — stricter, and worth turning on for `lib/data` once the floor is met, because an aggregate hides one completely untested module behind several well-tested ones.

## Gotchas

**★ Symptom: coverage is high and a whole module has no tests.** Cause: by default Vitest reports only files that were loaded during the run; a module nothing imports is absent from the denominator. Fix: set `coverage.include` to a glob over your source, so untested files are counted as zero rather than omitted.

**★ Symptom: a data-layer test passes and production leaks another team's rows.** Cause: the test mocked the database client, so it asserted the mock's return value rather than the query. Fix: split query construction from execution and test the built SQL and parameters, as in `buildListTasksQuery` — a pure function is the only part of a query that a unit test can honestly assert.

**★ Symptom: tests pass locally and fail in CI on a missing environment variable.** Cause: the value lives in `.env.local`, which is not loaded under `NODE_ENV=test` by design. Fix: move it to the committed `.env.test`, and load environment the way Next.js does with `loadEnvConfig(process.cwd())` in a `globalSetup` file.

**★ Symptom: the suite is flaky when run in parallel and stable with `--no-file-parallelism`.** Cause: tests share database rows or a global fixture object. Fix: a fresh team id per test from a builder, so isolation comes from the tenancy column rather than from serialisation. If a test truly needs exclusive access to a shared resource, isolate that one file rather than serialising the suite.

**★ Symptom: a fixture change breaks a test in an unrelated file.** Cause: a shared mutable fixture constant. Fix: builder functions returning fresh objects with an overrides parameter; never export a fixture object.

**★ Symptom: `vitest` in CI never exits.** Cause: the Next.js Vitest guide's script is `"test": "vitest"`, which watches by default. Fix: `vitest run` in CI, and a separate `test:watch` script — which is also the two-task split Turborepo needs ([4](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md)).

**★ Symptom: a Server Action test passes and the action is exploitable.** Cause: only the schema was tested. Shape validation says nothing about ownership, and render-time gating is not a security boundary because requests can be sent without going through the UI. Fix: the three-test rule — shape, authorization, effect — with the authorization test using a session that is not a member of the target team.

**★ Symptom: an `async` Server Component test is a wall of mocks and asserts nothing real.** Cause: it is not testable in jsdom; the guide recommends end-to-end testing for `async` components. Fix: unit-test the data function the component calls, and assert the rendered result in Playwright. Delete the mock-heavy test rather than maintaining it.

**★ Symptom: raising the coverage threshold becomes a quarterly argument.** Cause: a target was picked by opinion, so every change to it is a negotiation. Fix: `thresholds.autoUpdate` — the floor becomes whatever the suite already achieves, and the only rule anyone has to agree on is "do not go down". Reserve explicit numbers for the directories where a gap is genuinely expensive.

**★ Symptom: coverage of `lib/data` is 92% and the untested 8% is the whole authorization path.** Cause: an aggregate percentage over a directory hides a single completely-untested file. Fix: `thresholds.perFile: true` for that glob, so the floor applies to each file rather than to their average.

## Interview questions

**★ Why is "what this layer cannot cover" a required part of a milestone rather than a caveat?**
Because the cost of a test suite is not the tests that fail, it is the confidence it creates. A team that believes end-to-end tests cover data correctness stops writing data-layer tests; a team that believes unit tests cover the board stops looking at streaming behaviour. Writing the boundary down converts an implicit, wrong belief into an explicit gap that someone can decide to fill or accept. In practice the negative statements are the part of a testing plan that changes behaviour.

**★ What is the single highest-value test in a multi-tenant application?**
The one asserting that every data-access path is scoped to a tenant. Its failure mode is a cross-customer data leak, it produces no error and no visible symptom, and code review does not reliably catch a missing `WHERE team_id = ?` in the twentieth query. The strongest form is not a test at all but a type — a scope value that only a membership check can construct — with a runtime test confirming the predicate reaches the SQL. Everything else in a data-layer suite is ordinary correctness work by comparison.

**★ Why split a query builder from its execution?**
Because it is the difference between a testable and an untestable function. `listTasks(scope, filters)` that builds SQL and awaits the driver can only be tested by mocking the driver, which asserts the mock. `buildListTasksQuery(scope, filters)` returning SQL text and bound parameters is pure, and a test over it genuinely checks that the tenancy predicate and the filters made it into the query. The design change the test demands is one worth having anyway — it also makes the query loggable and reviewable.

**★ How do you get test isolation without serialising the suite?**
Use the isolation the domain already has. In a multi-tenant application every row carries a team id, so a test that creates its own team cannot see any other test's data, no matter how many run concurrently — no truncation, no transactions-per-test, no ordering constraints. This is a general technique: find the dimension the data model already partitions on and give each test its own value. It fails only for genuinely global state, which should then be the only thing serialised.

**★ What coverage percentage should the data layer have?**
No source states one, and a number chosen by opinion becomes a thing to argue about rather than a thing to act on. What is defensible is the shape: a repo-wide ratchet that only moves up (`thresholds.autoUpdate`), a real floor on the directories where an untested path is expensive, and `perFile` checking there so an aggregate cannot hide one untested module. The more useful question than "what percentage" is "which specific failure would this suite not catch", and that is answered by the per-layer boundary table, not by a number.

**★ Why is there no "integration test of the board page"?**
Because the board page is an `async` Server Component, and the Next.js testing guide recommends end-to-end testing over unit testing for `async` components — the jsdom-based renderers do not resolve a component that returns a promise. The layer that would sit there does not exist as a supported thing. What replaces it is a unit test of the data function the page awaits, plus a Playwright test of the rendered route, and the honest consequence is that the wiring between them — that the page calls the right function with the right scope — is only checked end-to-end.

---

← [Linting after `next lint`](13-linting-after-next-lint.md) · [Chapter 13 overview](01-explanation.md) · Next → [The Playwright flows: auth and board CRUD](05b-the-playwright-flows-auth-and-board-crud.md)
