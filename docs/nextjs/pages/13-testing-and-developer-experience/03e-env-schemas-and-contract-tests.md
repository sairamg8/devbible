---
title: "The obvious way to validate environment variables — hand the whole process.env object to a schema — is the one way Next.js documents as not working, and a contract test against a third-party API is a different test from the schema test that looks identical"
sidebar_label: "3e · Env schemas and contract tests"
sidebar_position: 105
description: "Why Schema.parse(process.env) breaks NEXT_PUBLIC inlining, splitting the server and client env schemas, when a throwing env module fails the build instead of the request, .env.test and loadEnvConfig, and the two-test split that makes third-party contract tests useful instead of flaky."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to use environment variables in Next.js](https://nextjs.org/docs/app/guides/environment-variables) (lastUpdated 2026-08-25), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (2026-06-17), [Playwright: Best Practices](https://playwright.dev/docs/best-practices) and [Zod — Basics](https://zod.dev/basics). Zod surface **probed on the installed package** (`zod` **4.4.3**).
> Target: **Next.js 16.3.4** · **Zod 4.4.3** · Node.js 24.20.0. Continues [3d · Zod at the request boundaries](03d-zod-contract-tests-at-the-boundaries.md).

**Two boundaries remain after the request itself: the environment your process starts in, and the APIs it talks to. Both are usually handled by writing a schema and feeling finished, and both have a mechanism underneath that punishes that. Environment variables in Next.js are not read at runtime on the client — they are *textually substituted into the bundle at build time*, and the substitution is defeated by exactly the code an env-schema library makes you write. Third-party responses do not need a schema so much as a schedule: a schema pinned to a vendor's API is only worth having if something re-runs it against the real vendor and tells you when they changed it.**

## Boundary 4 — the environment

### The inlining rule, and how a schema breaks it

> *"In order to make the value of an environment variable accessible in the browser, Next.js can “inline” a value, at build time, into the js bundle that is delivered to the client, replacing all references to `process.env.[variable]` with a hard-coded value."*

Replacement is textual and syntactic. The docs then name the two forms that defeat it:

> *"Note that dynamic lookups will not be inlined"*

```js
// This will NOT be inlined, because it uses a variable
const varName = 'NEXT_PUBLIC_ANALYTICS_ID'
setupAnalyticsService(process.env[varName])

// This will NOT be inlined, because it uses a variable
const env = process.env
setupAnalyticsService(env.NEXT_PUBLIC_ANALYTICS_ID)
```

🔴 **The second example is the one that matters here**, because it is what every naive env schema does:

```ts
// ✗ lib/env.ts — parses nothing useful on the client
import { z } from 'zod'

export const env = z
  .object({
    NEXT_PUBLIC_APP_URL: z.url(),
    DATABASE_URL: z.url(),
  })
  .parse(process.env) // ← passing the whole object IS a dynamic lookup
```

In a client-reachable module this throws in the browser: nothing was inlined, `process.env` is an empty object (or absent), and the schema reports every field missing. The version that works enumerates each variable as a literal member access, because that is the expression the compiler rewrites:

```ts
// lib/env/client.ts — every read is a literal `process.env.X`
import { z } from 'zod'

const ClientEnv = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
})

export const clientEnv = ClientEnv.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
})
```

That object literal is not boilerplate you can factor away. Every key must be written twice by construction, and any helper that loops over key names reintroduces the dynamic lookup.

### Split the schema, and guard the server half

Server variables must never be enumerated in a module a client component can import — not because of inlining (they are not inlined) but because the *module* would be bundled and the values are secrets in your build environment.

```ts
// lib/env/server.ts
import 'server-only'
import { z } from 'zod'

const ServerEnv = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  DIGEST_EMAILS_ENABLED: z.stringbool().default(false),
})

export const serverEnv = ServerEnv.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SMTP_PORT: process.env.SMTP_PORT,
  DIGEST_EMAILS_ENABLED: process.env.DIGEST_EMAILS_ENABLED,
})
```

`z.stringbool()` rather than `z.coerce.boolean()` is not a preference. Coercion is `Boolean(input)`, so the string `"false"` is `true` and your feature flag is permanently on. `z.stringbool()` understands `"true"/"1"/"yes"/"on"` and `"false"/"0"/"no"/"off"`, case-insensitively.

### When does that `.parse` run?

This is the question nobody asks and everybody eventually debugs. `serverEnv` is parsed at **module evaluation** — the first time anything imports it. In a Next.js app that means:

- During `next build`, if a prerendered route imports it. A missing variable then fails the **build**, not a request. That is usually what you want, and it is why CI needs the same variables the runtime does.
- At request time, in a dynamically-rendered route, if nothing prerendered pulls it in first.

If you deliberately want a *runtime* read — one Docker image promoted across environments — the documented mechanism is to force dynamic rendering before the read:

```tsx
import { connection } from 'next/server'

export default async function Component() {
  await connection()
  const value = process.env.MY_VALUE
  return <span>{value}</span>
}
```

> *"This allows you to use a singular Docker image that can be promoted through multiple environments with different values."*

And the corresponding warning for the public half, which no schema can rescue you from:

> *"After being built, your app will no longer respond to changes to these environment variables."*

A `NEXT_PUBLIC_` variable is frozen at `next build`. If the value differs per environment and you promote a single artefact, it must not be a `NEXT_PUBLIC_` variable — the docs say plainly that you *"have to set up your own API to provide them to the client"*.

### Load order, and the two rules that make test runs reproducible

Lookup stops at the first hit:

1. `process.env`
2. `.env.$(NODE_ENV).local`
3. `.env.local` — **not checked when `NODE_ENV` is `test`**
4. `.env.$(NODE_ENV)`
5. `.env`

> *"`.env.local` won't be loaded, as you expect tests to produce the same results for everyone."*

> *"Next.js will not load environment variables from `.env.development` or `.env.production` in the testing environment."*

So `.env.test` is the file your test runs read, it *"should be included in your repository"*, and `.env.test.local` should not. The consequence for the suite: a test that passes only on your machine because of `.env.local` cannot exist — which is precisely the property you want, and the reason to put every test-relevant default in `.env.test` rather than in a `beforeAll`.

Vitest and Jest are not Next.js and do not load any of this on their own. The documented bridge is `@next/env`:

```ts
// test/setup-env.ts — referenced from globalSetup in the runner config
import { loadEnvConfig } from '@next/env'

export default async () => {
  loadEnvConfig(process.cwd())
}
```

## Boundary 5 — third-party responses, and what a "contract test" actually is

`await res.json()` is `any`. Annotating it is a claim about a system that a different company deploys on a different schedule. The schema is the right first move — and on its own it converts a silent wrong-shape bug into a loud parse failure **in production**, which is an improvement and not a test.

The confusion worth clearing up: there are **two** tests here, they look nearly identical, and they fail for opposite reasons.

| | Schema test | Contract test |
|---|---|---|
| Input | A committed fixture | The live third-party API |
| Runs | Every commit, in the normal suite | On a schedule, in its own workflow |
| Fails when | *You* changed the schema or the mapping | *They* changed the API |
| A red result means | Block the merge | Open an issue; do not block deploys |
| Needs network / credentials | No | Yes |

```ts
// lib/billing/subscription-schema.ts
import { z } from 'zod'

// Deliberately NOT strictObject: a vendor adding a field must not break us.
export const Subscription = z.object({
  id: z.string(),
  status: z.enum(['trialing', 'active', 'past_due', 'canceled']),
  current_period_end: z.number().int(),
  items: z.object({
    data: z.array(z.object({ price: z.object({ id: z.string() }) })),
  }),
})

export type Subscription = z.infer<typeof Subscription>
```

```ts
// lib/billing/__tests__/subscription-schema.test.ts   ← runs on every commit
import { describe, expect, it } from 'vitest'
import subscriptionFixture from './fixtures/subscription.active.json'
import { Subscription } from '../subscription-schema'

describe('Subscription schema', () => {
  it('accepts the recorded active-subscription payload', () => {
    expect(Subscription.safeParse(subscriptionFixture).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    const bad = { ...subscriptionFixture, status: 'paused' }
    expect(Subscription.safeParse(bad).success).toBe(false)
  })
})
```

```ts
// contract/billing.contract.test.ts   ← its own Vitest project, nightly workflow
import { expect, it } from 'vitest'
import { z } from 'zod'
import { Subscription } from '@/lib/billing/subscription-schema'

it('the live provider still returns the shape we parse', async () => {
  const res = await fetch(`${process.env.BILLING_API}/subscriptions/${process.env.BILLING_FIXTURE_ID}`, {
    headers: { authorization: `Bearer ${process.env.BILLING_API_KEY}` },
  })
  expect(res.status).toBe(200)

  const parsed = Subscription.safeParse(await res.json())
  if (!parsed.success) {
    throw new Error(`billing contract drift:\n${z.prettifyError(parsed.error)}`)
  }
})
```

Three design decisions in there that are the whole value of the pattern:

- **The object is not strict.** A vendor adding `metadata` to a response is a non-event; making it a red build teaches the team to ignore red builds. You are testing for *removals and type changes*, which a non-strict schema catches and an additive change does not.
- **The contract test lives outside the normal suite** — a separate Vitest project or directory, excluded from the default `include`, run by its own scheduled workflow. It needs credentials and the network, so it is not something a contributor's `vitest run` should attempt.
- **The failure is a notification, not a gate.** The vendor changed their API; blocking your deploys does not un-change it. Open an issue, page whoever owns the integration, and let the schema failure in production be the second line of defence.

At the E2E layer you do the opposite and cut the third party out entirely. Playwright's own best-practice guidance is to fulfil the route:

> *"`page.route('**/api/…', route => route.fulfill({ status: 200, body: testData }))`"*

Which gives the clean division: E2E tests assert *your* behaviour against a stubbed vendor, the contract test asserts the vendor still matches the stub.

## What no schema can check

Worth stating plainly, because a well-schema'd codebase generates a strong and false sense of coverage:

- **Ownership.** *"Schema validation (zod or similar) only checks the shape of the input. A well-formed `Item` object can still refer to a row the caller does not own."*
- **Cross-row invariants.** "A task's assignee must be a member of the task's team" is a join, not a shape.
- **Idempotency and ordering.** Two valid requests, correct individually, wrong together.
- **Freshness.** A schema will happily parse a `current_period_end` from 2019.
- **That the schema is applied.** Nothing checks that a new Route Handler remembered to parse its body. That one is a lint rule or a review habit, not a type.

## Gotchas

**★ Symptom: an env schema throws "Required" for every `NEXT_PUBLIC_` variable, in the browser only.** Cause: the schema was given the whole `process.env` object, and the documentation states that a non-literal access *"will NOT be inlined, because it uses a variable"* — including `const env = process.env`. Fix: build an explicit object literal whose values are each a literal `process.env.NEXT_PUBLIC_X` read.

**★ Symptom: a `NEXT_PUBLIC_` variable is correct in staging and wrong in production, from the same image.** Cause: public variables are inlined at `next build`, and *"After being built, your app will no longer respond to changes to these environment variables."* Fix: either build per environment, or stop making it public — serve the value from a Route Handler and fetch it, which is what the docs recommend for promoted artefacts.

**★ Symptom: `next build` fails on a missing secret that only production needs.** Cause: a prerendered route imports the server env module, so the `.parse` runs during the build. Fix: this is usually correct — give CI the variable. If the value genuinely cannot exist at build time, move the read behind `await connection()` so the route is dynamic and the variable is read per request.

**★ Symptom: `process.env.DATABASE_URL` is `undefined` inside a Drizzle config or a Vitest setup file.** Cause: `.env*` loading is done by the Next.js runtime, and neither an ORM CLI nor a test runner is the Next.js runtime. Fix: `loadEnvConfig(process.cwd())` from `@next/env`, imported from the config file or a `globalSetup` module.

**★ Symptom: a test passes locally and fails in CI with a missing variable.** Cause: the value was in `.env.local`, and `.env.local` is deliberately not read when `NODE_ENV` is `test`. Fix: put test defaults in `.env.test` and commit it. Keep machine-specific overrides in `.env.test.local`, which stays gitignored — and never let a test depend on one.

**★ Symptom: a feature flag set to `DIGEST_EMAILS_ENABLED=false` is on.** Cause: `z.coerce.boolean()` is `Boolean(input)`; every non-empty string is truthy. Fix: `z.stringbool()`.

**★ Symptom: `SMTP_PORT` is the string `'587'` and a library rejects it.** Cause: everything in `process.env` is a string; a schema that types it `z.number()` fails, and one that types it `z.string()` propagates the string. Fix: `z.coerce.number().int()` — coercion is the correct tool here precisely because the source is documented to be text.

**★ Symptom: the vendor added a field and the nightly contract test went red.** Cause: the schema is a `strictObject`, so any addition is an error. Fix: use a non-strict object for third-party responses. Strictness is for payloads *you* receive from callers you want to correct; a vendor's additive change is not a defect.

**★ Symptom: the contract test is flaky and everyone has learned to re-run it.** Cause: it runs in the same job as the unit suite, against a live API, with shared credentials and rate limits. Fix: move it to its own workflow on a schedule, give it its own credentials and a dedicated fixture record, and make its failure open an issue rather than fail the branch. A test whose red is routinely ignored is worse than no test.

**★ Symptom: production throws a Zod error from a third-party parse at 3 a.m.** Cause: the vendor shipped a breaking change and no contract test was watching. Fix: the schedule is the fix — but also make the production path degrade rather than throw. `safeParse` at the integration boundary plus a logged, alerting failure beats an exception surfacing as a 500 on a page that could have rendered without the vendor's data.

**★ Symptom: a new Route Handler skips validation and nobody notices for a month.** Cause: nothing enforces that a boundary is parsed; it is a convention. Fix: make it structural — a shared `withValidatedBody(schema, handler)` wrapper that every handler uses, so an unwrapped export is visible in review and greppable in CI.

## Interview questions

**★ Why does `Schema.parse(process.env)` fail in a client component but work on the server?**
Because on the server `process.env` is a real object populated by Node, and on the client it does not exist — the only way a value reaches the browser is textual substitution at build time, which the compiler performs on the literal expression `process.env.NEXT_PUBLIC_X`. Passing the whole object is what the documentation calls a dynamic lookup, and it is explicitly not inlined; the compiler has nothing to substitute. So the client schema must enumerate each variable as its own literal read, which is why every env library for Next.js makes you write the key twice.

**★ When does an env schema's `.parse` actually execute in a Next.js app, and why does it matter?**
At module evaluation, so the timing depends on who imports it and when that importer runs. If a prerendered route pulls it in, the parse happens during `next build` and a missing variable is a build failure. If only dynamic routes import it, the parse happens on the first request that reaches it. The distinction decides whether a misconfiguration is caught in CI or in production, and it is why CI needs the runtime's variables even though CI is not the runtime. Forcing the runtime case is deliberate: `await connection()` before the read.

**★ Why is `.env.local` ignored under `NODE_ENV=test`?**
So that a test run is the same for everyone. `.env.local` is the file where a developer keeps overrides for their own machine; if tests read it, a suite can be green on one laptop and red in CI for reasons that have nothing to do with the code. The documentation states the intent directly — you expect tests to produce the same results for everyone — and the practical rule that follows is that every value a test depends on lives in the committed `.env.test`.

**★ What is the difference between a schema test and a contract test, given both call the same schema?**
The input and the meaning of a failure. The schema test feeds a committed fixture, runs on every commit, and fails when you changed something — so it gates merges. The contract test feeds the live third-party response, runs on a schedule, and fails when the vendor changed something — so it should notify rather than gate, because blocking your own deploys does not undo their release. Conflating them produces either a suite that cannot run offline or a vendor change nobody hears about until production.

**★ Should a third-party response schema be strict?**
No, in almost every case. A vendor adding a field is a normal, non-breaking event; a strict schema turns it into a red build, and a build that goes red for non-defects trains people to ignore it. You want to detect removals and type changes, which a permissive object still catches because the fields you named are still required. Strictness is the right choice in the opposite direction — on payloads you receive from callers whose mistakes you want to report.

**★ Your contract test is red. What do you do before the next deploy?**
Read the parse error to classify the change: a removed field or a changed type is breaking and the integration is already failing in production or about to; an added field or a widened union is not. If breaking, the immediate action is to make the production path degrade — `safeParse`, log, render without the vendor's data — and then adapt the schema. What you do *not* do is loosen the schema to make the test pass, because the schema is the only written record of what you believed the vendor's API to be.

**★ How do you test code that depends on a third party without hitting it in CI?**
Three layers, each with a different double. Unit tests parse a committed fixture with no network at all. Integration tests inject a fake client implementing the same interface, so the mapping from parsed response to domain object is exercised. End-to-end tests intercept at the network layer — Playwright's `page.route(...).fulfill(...)` — so the browser sees a controlled response and the rest of the stack is real. The live API appears in exactly one place, the scheduled contract test, and its job is to tell you the fixtures have gone stale.

{/* FOOTER */}
