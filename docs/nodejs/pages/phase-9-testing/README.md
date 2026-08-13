---
title: "Phase 9 — Testing"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example was executed on **Node 24.19.0**, 8 cores. Third-party versions:
> `supertest` 7.2.2 · `express` 5.2.1 · `vitest` 4.1.10 · `jest` 30.4.2 ·
> `testcontainers` 12.1.0 · `pg` 8.23.0 · `fast-check` 4.9.0 ·
> `@stryker-mutator/core` 9.6.1 · `eslint` 10.8.1 · `prettier` 3.9.6 ·
> `@biomejs/biome` 2.5.8 · `zod` 4.4.3.

**Complete — 20 pages.** Node ships a test runner, so this phase is built on
`node:test` rather than on a framework, and reaches for Vitest or Jest only where they
earn it. The measurements are the point: several widely repeated claims about the
runner did not survive being run.

## Testing

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[node:test](./01-node-test-runner.md)** | <span className="db-tier t-master">Master</span> | `*.spec.mjs` is not discovered — a suite named that way runs 0 tests and exits 0 |
| 02 | **[node:assert](./02-node-assert.md)** | <span className="db-tier t-master">Master</span> | `NaN` deep-equals `NaN`, `0` does not equal `-0`, and a class instance never equals an object literal |
| 03 | **[Unit, integration, e2e](./03-unit-integration-e2e.md)** | <span className="db-tier t-master">Master</span> | If mocking the dependency removes the thing that could be wrong, it is an integration test |
| 04 | **[Writing testable code](./04-testable-code.md)** | <span className="db-tier t-master">Master</span> | `process.env` set inside the test changed nothing — the module was evaluated first |
| 05 | **[API testing](./05-api-testing.md)** | <span className="db-tier t-master">Master</span> | `listen(0)`, or `EADDRINUSE` with a race deciding which file fails |
| 06 | **[Async testing](./06-async-testing.md)** | <span className="db-tier t-master">Master</span> | A forgotten `await` does **not** pass silently — the test shows ✔ and the *file* fails |
| 07 | **[Mocking](./07-mocking.md)** | <span className="db-tier t-understand">Understand</span> | `t.mock` auto-restores; the top-level `mock` leaked `FAKE` into the next test |
| 08 | **[Module mocking](./08-module-mocking.md)** | <span className="db-tier t-understand">Understand</span> | Mock first, *then* dynamic-import — a static import at the top defeats it entirely |
| 09 | **[Test doubles](./09-test-doubles.md)** | <span className="db-tier t-understand">Understand</span> | Seven doubles for one assertion is a design report, not a test |
| 10 | **[Fixtures and factories](./10-fixtures-and-factories.md)** | <span className="db-tier t-understand">Understand</span> | A factory with overrides; a transaction per test, rolled back |
| 11 | **[Coverage](./11-coverage.md)** | <span className="db-tier t-understand">Understand</span> | 100 % line, branch and function coverage on a function returning `23.987999999999996` |
| 12 | **[Vitest and Jest](./12-vitest-and-jest.md)** | <span className="db-tier t-understand">Understand</span> | 0.22 s against 1.43 s and 1.52 s on the same 50 tests |
| 13 | **[Testcontainers](./13-testcontainers.md)** | <span className="db-tier t-know">Know</span> | 5.6 s to start, then real `23505` and `23514` — and two env vars for podman |
| 14 | **[Runner flags](./14-runner-flags.md)** | <span className="db-tier t-know">Know</span> | `--test-rerun-failures` reported ✔ and exit 0 for a test edited to throw |
| 15 | **[Snapshot testing](./15-snapshot-testing.md)** | <span className="db-tier t-know">Know</span> | A blind `--test-update-snapshots` rewrote the expectation and went green |
| 16 | **[ESLint, Prettier, Biome](./16-lint-and-format.md)** | <span className="db-tier t-know">Know</span> | 0.75 s for two tools against 0.09 s for one doing more |
| 17 | **[Property and mutation](./17-property-and-mutation.md)** | <span className="db-tier t-when">When Needed</span> | 100 % coverage, 86.67 % mutation score, both survivors on one boundary |
| 18 | **[Load testing](./18-load-testing.md)** | <span className="db-tier t-when">When Needed</span> | A 45 ms mean can contain a 4-second p99 |

## Contract testing

Where a green unit suite still ships a broken frontend.

| # | Page | Tier | In one line |
|---|---|---|---|
| 19 | **[Contract testing](./19-contract-testing.md)** | <span className="db-tier t-understand">Understand</span> | A renamed field caught in 18 ms, in the backend's own suite |
| 20 | **[Schema compatibility](./20-schema-compatibility.md)** | <span className="db-tier t-understand">Understand</span> | Adding is safe on responses and breaking on requests — the same verb, opposite answers |

## What the measurements changed

Five things on these pages contradict what is commonly written, and each was
reproduced before it was written down:

1. **A forgotten `await` is not silent.** The test prints `✔`, but the runner reports
   `generated asynchronous activity after the test ended`, fails the **file**, and
   exits 1. It becomes silent only if the promise is explicitly `.catch()`-ed.
2. **`node --test some/dir` fails** with `MODULE_NOT_FOUND` — a directory positional is
   resolved as a module. Only globs or bare `node --test` work.
3. **`--test-rerun-failures` can report a broken suite as green.** The state file
   replays previous passes without executing them; a test edited to `throw` still
   printed `✔ (passed on attempt 0)` and exited 0.
4. **Test tags need `tags: ['unit']`** — plural, array. The singular `tag:` is silently
   ignored, so a filtered CI job can run zero tests and exit 0. The flag is
   `--experimental-test-tag-filter`, not `--test-name-tag`.
5. **`--test-randomize`**, not `--test-random-order`. On a three-test suite with shared
   state, seeds 1/2/3/7/11 gave 2/1/1/**0**/3 failures — seed 7 passed entirely.

## Where this connects

- **[Phase 6 · Data access](../phase-6-data-access/README.md)** — repositories take a database
  handle as a parameter, which is what makes both dependency injection (page 04) and
  the per-test transaction rollback (pages 10 and 13) possible.
- **[Phase 7 · Background work](../phase-7-background-work/README.md)** — every job handler
  should be run twice in its own test; mock timers (page 07) replace waiting for a
  retry backoff.
- **[Phase 8 · Security](../phase-8-security/README.md)** — validation schemas double as
  contracts (pages 19 and 20).
- **[Phase 10 · Observability](../phase-10-observability/20-benchmarking.md)** — the
  benchmarking methodology behind page 18.
- **Deliberately not here:** CI pipeline configuration and deployment gating, which are
  Phase 11; and API design questions like versioning strategy, which belong to Express.

---

← Prev: [Phase 8 · Security](../phase-8-security/README.md) ·
Next → [Phase 10 · Observability](../phase-10-observability/README.md)
