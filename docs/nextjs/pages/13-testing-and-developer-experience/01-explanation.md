---
title: "13 · Testing and developer experience — every layer in this chapter is defined by what it cannot see, and a suite is finished when each layer has written its blind spot down rather than when the coverage number looks good"
sidebar_label: "Overview"
sidebar_position: 0
description: "Chapter 13 index: what a jsdom runner is eligible to render, Server Components and Actions, Playwright against a production build, PPR and Activity, strict TypeScript as a test suite, typed routes, Zod at the request boundaries, Turborepo, and the SprintDesk milestone."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Testing](https://nextjs.org/docs/app/guides/testing), [Jest](https://nextjs.org/docs/app/guides/testing/jest), [Vitest](https://nextjs.org/docs/app/guides/testing/vitest), [Playwright](https://nextjs.org/docs/app/guides/testing/playwright), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions), [environment variables](https://nextjs.org/docs/app/guides/environment-variables), [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) and [preserving UI state with Activity](https://nextjs.org/docs/app/guides/preserving-ui-state) — plus [playwright.dev](https://playwright.dev/docs/best-practices), [vitest.dev](https://vitest.dev/guide/migration), [turborepo.dev](https://turborepo.dev/docs) and [zod.dev](https://zod.dev). Every chunk carries its own `> Verified:` line naming the pages and `lastUpdated` values it was written from.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · `@playwright/test` 1.62.1 · Vitest 5.0.0 · Jest 30.5.1 · `zod` 4.4.3 · `turbo` 2.10.12 · Node 24.20.0. `next` is **not installed in this checkout**, so nothing framework-level is probed — documentation-verified throughout, with **no sandbox run** and no timings.

**The organising fact of testing an App Router application is that the framework's most important properties are not visible from inside a test runner. A jsdom runner cannot render an async Server Component at all. A unit test of a Server Action bypasses the entire request path — the CSRF check, the encrypted action id, the serialization boundary, the router refresh — so it verifies the function and none of the machinery. An end-to-end test against `next dev` is testing an environment with prefetching switched off. A test that asserts the settled DOM cannot tell a streamed page from a blocking one. Each layer is therefore defined by its blind spot, and the chapter's argument — which the milestone turns into an acceptance criterion — is that a suite is finished when every layer has written down what it cannot cover, not when a coverage percentage crosses a line. Type-safety belongs here for the same reason: `strict: true` is a family of nine checks, and the two flags that catch the bugs your unit tests were going to catch are not among them.**

## 🔴 What this chapter corrects

Six claims in wide circulation are wrong at 16.3.4, each corrected with a verbatim source on the page that owns it:

| Claim you will meet | What the documentation says | Where |
|---|---|---|
| `next build` runs your linter, so CI is covered | **`next lint` was removed in 16** and `next build` no longer lints — an upgraded project silently stops linting until you wire ESLint or Biome up yourself | [17](13-linting-after-next-lint.md) |
| `strict: true` is the strict setting | It is a family of nine checks, and the two that catch the bugs your unit tests were going to catch — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — are **not in it** | [5](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md) |
| Validate your environment by handing `process.env` to a schema | The docs are explicit that *"dynamic lookups will not be inlined"*, so the whole-object pattern is the one approach Next.js documents as not working | [9](03e-env-schemas-and-contract-tests.md) |
| `transpilePackages` is how a monorepo shares source | Turbopack transpiles workspace packages **automatically** in 16, which retires most of that advice; the internal-package problem it leaves is a different one | [11](04b-shared-packages-and-transpilation.md) |
| Read the build table in CI to prove a route is prerendered | It is human-facing output whose format has already changed — 16 removed `size` and `First Load JS` — so assert the observable property with `instant()` instead | [4](02b-testing-ppr-activity-and-playwright-in-ci.md) · [14](10-the-instant-playwright-helper.md) |
| A Server Action unit test proves the mutation is safe | It bypasses the `Origin`/`Host` check, the body size limit, encrypted action ids and closure variables, serialization, and the router refresh in the same response | [2](01b-testing-server-components-and-server-actions.md) |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Unit and component testing](01-unit-and-component-testing-jest-vitest-react-testing-library.md)** | what `next/jest` configures and what it leaves you; 🔴 the eligibility boundary that decides what jsdom can render; the four Vitest 5 defaults that rewrite an existing suite |
| 2 | **[Server Components and Actions](01b-testing-server-components-and-server-actions.md)** | 🔴 why a sync Server Component renders and an async one does not; the three tests every Action needs; `.env.local` deliberately not loaded; `loadEnvConfig` |
| 3 | **[End-to-end flows with Playwright](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md)** | 🔴 `next start`, never `next dev`; the `webServer` option that is deprecated; the setup-project auth pattern; asserting streaming **order**, not final state |
| 4 | **[PPR, Activity and CI](02b-testing-ppr-activity-and-playwright-in-ci.md)** | 🔴 Activity keeps the previous route in the DOM, so raw CSS and text locators match hidden content; sharding, retries, the flake budget, `if: !cancelled()` |
| 5 | **[Strict TS config as a test suite](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md)** | 🔴 the two flags outside `strict` that earn their keep, and the class of bug each one moves from runtime to compile time |
| 6 | **[Module syntax and where types stop](03b-module-syntax-and-where-types-stop.md)** | 🔴 import elision — the one place erasing types changes runtime behaviour; `verbatimModuleSyntax` and the `server-only` graph |
| 7 | **[Typed routes and generated types](03c-typed-routes-and-generated-types.md)** | `typedRoutes` as a **generated build artefact**, so every failure mode is a staleness failure; `next typegen`; `PageProps` globally available without an import |
| 8 | **[Zod at the request boundaries](03d-zod-contract-tests-at-the-boundaries.md)** | 🔴 a type is a promise about the interior, a schema is a check at the edge; `searchParams`, `FormData`, handler bodies, third-party responses |
| 9 | **[Env schemas and contract tests](03e-env-schemas-and-contract-tests.md)** | 🔴 why `Schema.parse(process.env)` is the documented non-starter; `.env.test` committed, `.env.test.local` ignored |
| 10 | **[Turborepo: the task graph](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md)** | a task scheduler around a content-addressed cache, so every real problem is a hash that missed an input or a task that was not deterministic |
| 11 | **[Shared packages and transpilation](04b-shared-packages-and-transpilation.md)** | 🔴 Turbopack transpiles workspace packages automatically in 16; what the internal-package boundary still costs |
| 12 | **[Hashing, caching and poisoning](04c-hashing-caching-and-cache-poisoning.md)** | 🔴 anything that changes behaviour without changing the hash is not a miss you get away with; `inputs`, `outputs`, what must never be cached |
| 13 | **[Turborepo in CI](04d-turborepo-in-ci-and-affected-filtering.md)** | 🔴 affected-package filtering is the whole point, and it is defeated by the one checkout setting almost every CI ships with |
| 14 | **[The `instant()` Playwright helper](10-the-instant-playwright-helper.md)** | scoping assertions to the UI that exists **before the network answers**, which turns a feeling into a failing test |
| 15 | **[Instant tests in CI](10b-instant-tests-in-ci-and-regression-causes.md)** | 🔴 an `instant()` test against `next dev` is testing an environment with prefetching off; the regression causes worth naming |
| 16 | **[TypeScript 7 and build type checking](12-typescript-7-and-build-type-checking.md)** | `next build` already shells out to your project's `tsc`, so adopting TS 7 is a dependency decision; ⚠️ `experimental.useTypeScriptCli` is an opt-**out** |
| 17 | **[Linting after `next lint`](13-linting-after-next-lint.md)** | 🔴 the removal, the codemod, flat config, Biome as a first-class choice, and the silent window where nothing lints |
| 18 | **[Milestone: the SprintDesk test suite](05-project-milestone-sprintdesk-test-suite.md)** | 🔴 finished when every layer has written down what it **cannot** cover — a suite trusted for coverage it does not have is worse than no suite |
| 19 | **[The Playwright flows: auth and board CRUD](05b-the-playwright-flows-auth-and-board-crud.md)** | the end-to-end half of the milestone, and why both flows are harder than they look under Cache Components |

## Phase gate

You are done with this chapter when, given any behaviour in an App Router application, you can name the cheapest layer that can actually observe it — and say what that layer would still miss. Work the four hard ones: a Server Action that writes to the database and returns an error, a route that must keep its static shell, a `searchParams` value a user can type anything into, and a monorepo change that should not rebuild the other eleven packages.

The common stopping point is a passing suite with a high coverage number. That number is available to a suite that renders no Server Component, exercises no request path, and never sees a streamed response — which is why the milestone's acceptance criteria are written as blind-spot statements rather than thresholds. ⚠️ No primary source states a coverage percentage worth targeting; any number you see in this chapter is illustrating a **mechanism** (the ratchet, per-glob floors), not proposing a target.

## Where this connects

- [Chapter 5 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — the model that makes PPR the default and makes the build table's classifications worth asserting
- [Chapter 3 · Server vs Client Components](../03-server-components-vs-client-components/01-explanation.md) — the eligibility boundary that decides what a jsdom runner can render at all
- [Chapter 10 · Forms, auth and security hardening](../10-forms-authentication-and-security-hardening/02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md) — the same Zod boundary from the security side, including what a schema does not check
- [Chapter 14 · Agent-driven development](../14-agent-driven-development/05b-the-verification-loop-guardrails-and-review-discipline.md) — why the failing assertion is written first, and what a test that got *easier* tells you
- [Chapter 16 · Deployment, scaling and observability](../16-deployment-scaling-and-observability/01c-the-edge-network-and-skew-protection.md) — why CI must target the commit preview URL rather than the branch one
- [Appendix C · the CLI surface](../19-appendices/03c-appendix-c-the-cli-surface.md) — `next typegen`, `next build --debug-prerender`, and the codemods this chapter runs
- [Appendix D · production readiness](../19-appendices/04-appendix-d-production-readiness-checklist-security.md) — the gate this chapter deliberately does not duplicate

---

Start → [1 · Unit and component testing](01-unit-and-component-testing-jest-vitest-react-testing-library.md)
