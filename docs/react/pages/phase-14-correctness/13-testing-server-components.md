---
title: "Testing Server Components"
sidebar_label: "13 · Testing Server Components"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **Next.js 16.3.1 docs** (last updated 2026-02-11), from
> documentation —
> [Setting up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest):
> *"Since `async` Server Components are new to the React ecosystem, Jest currently does not
> support them. While you can still run **unit tests** for synchronous Server and Client
> Components, we recommend using an **E2E tests** for `async` components."* and
> [Setting up Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest), which
> says the same of Vitest: *"Vitest currently does not support them … we recommend using
> **E2E tests** for `async` components."*
> No sandbox script backs this page; claims are cited, not measured.

## The state of it, plainly

**An `async` Server Component cannot be unit-tested with Jest or Vitest today.** Both
frameworks' own guides say so in the same words, and both give the same recommendation: use
end-to-end tests for those components.

That is the whole headline, and it is worth stating without hedging because a great deal of
time gets spent trying to make it untrue. What *is* supported:

| Component | Unit-testable with RTL? |
|---|---|
| Client Components (`'use client'`) | ✅ yes — everything in this phase applies unchanged |
| **Synchronous** Server Components | ✅ yes — the Next.js docs say so explicitly |
| **`async`** Server Components | ❌ no — E2E is the documented answer |
| Server Functions (`'use server'`) | ✅ as plain functions — see below |

## Why an async component resists

A Server Component runs on the server, may await data directly in its body, and returns a
description that is streamed to the client rather than rendered into a DOM there. RTL's
`render` expects a synchronous client render into a jsdom document — there is no supported
way to hand it a promise-returning component and have the framework's server environment,
data layer and streaming protocol behave as they do in production.

⚠️ **A workaround circulates: `render(await Page({ params }))`.** Calling the component as a
plain function and rendering what it returns does execute in a test. Understand what it is:
you are invoking a function the framework normally invokes, in an environment that is not the
server, without the request context, caching, or streaming that surround it in production.
It can be a pragmatic way to check rendering logic, and it is **not** a supported API — treat
anything it proves as provisional, and do not build a suite's confidence on it.

## What to test instead

The good news is that most of what is worth testing is not in the async component.

**1 · Extract the data access and test it directly.**

```js
// lib/orders.js — a plain async function, ordinary to test
export async function getOpenOrders(customerId) { … }
```

An async Server Component that awaits `getOpenOrders` and maps the result into markup has two
parts: a data function you can test as a normal async function, and a rendering that is
mostly pass-through.

**2 · Push presentation into components you *can* render.**

```jsx
// app/orders/page.tsx — async Server Component, thin
export default async function OrdersPage() {
  const orders = await getOpenOrders(userId);
  return <OrdersTable orders={orders} />;          // ← the testable part
}
```

`OrdersTable` — a synchronous Server Component or a Client Component — takes props and
renders. That is fully testable with everything in this phase: roles, queries, empty state,
error state. **The thin async shell is the part you cannot unit-test, and by design it is the
part with the least logic in it.**

This is not a testing trick; it is the same separation that makes the components reusable.

**3 · Test Server Functions as functions.**

```js
"use server";
export async function createInvoice(prevState, formData) { … }
```

A Server Function is an async function taking `(previousState, formData)`
([topic 08](08-testing-forms-and-actions.md)). Build a `FormData`, call it, assert the
returned state and any effect on your data layer. Its `'use server'` directive does not
prevent you importing and calling it in a test.

**4 · Cover the rest end-to-end.** Playwright or Cypress against a running app is what the
framework docs recommend, and it is the only place the real behaviour exists: the server
render, the streaming, the client hydration, the navigation. A handful of tests over the
critical journeys, not a mirror of the unit suite.

## What this means for how you split a page

A useful design consequence, which is why this topic is worth reading even if you never test
a Server Component:

- **Async Server Component** → fetch and compose. Keep it thin. Covered by E2E.
- **Sync Server / Client Component** → all the presentation and interaction. Covered by unit
  tests.
- **Plain module** → data access, transformation, validation. Covered by ordinary function
  tests.

A page written that way has almost nothing living in the untestable layer. A page that fetches
*and* filters *and* formats *and* renders in one async function has put its logic exactly
where the tools cannot reach.

## The caveat about this page

This is the area of the phase most likely to age. Both quotes above say *"currently"*, and the
ecosystem is actively working on it. **Check the current Next.js testing guides before
concluding that something is impossible** — if support has landed since this was written, the
guides will say so, and this page is the one to distrust.

## Gotchas

**Symptom:** rendering an async Server Component with RTL produces a promise, an empty
container, or an obscure error.
**Cause:** it is not supported by either runner.
**Fix:** test the data function and the presentational child separately; cover the composition
end-to-end.

**Symptom:** `render(await Page())` works, and the team starts relying on it.
**Cause:** the component is being called as a plain function outside the server environment.
**Fix:** use it knowingly for rendering logic at most. There is no request context, cache or
streaming, so a passing test is weaker evidence than it looks.

**Symptom:** a Client Component test fails with a Server-Component-related error.
**Cause:** it imports something from a server-only module, directly or transitively.
**Fix:** separate the modules. A client-importable module should not reach into server-only
code — the test is reporting a real boundary violation.

**Symptom:** the page is impossible to test at all.
**Cause:** fetching, filtering, formatting and rendering all live in one async function.
**Fix:** split it — data access into a module, presentation into a child component. The
async shell should be nearly empty.

## Interview questions

**★ Can you unit-test an async Server Component?**
No. The Next.js guides for both Jest and Vitest state that neither currently supports async
Server Components, and both recommend E2E tests for them. Synchronous Server Components and
Client Components can be unit-tested normally.

**★ So how do you get coverage of a page built from async Server Components?**
Split it. The data access becomes a plain async function tested directly; the presentation
becomes a synchronous or client component tested with RTL; the async shell that awaits the
data and renders the child keeps almost no logic and is covered end-to-end. Server Functions
are just async functions taking `(previousState, formData)`, so they are tested by calling
them with a `FormData` and asserting the returned state.

**★ What do you think of `render(await Page())`?**
It runs, and it is not a supported API. You are calling the component as a function outside
the server environment, so there is no request context, no caching and no streaming — the
things most likely to break in production are exactly what it omits. Fine as a pragmatic check
of rendering logic, wrong as the foundation of a suite.

**How does this change the way you structure a page?**
It pushes logic out of the async layer. Fetch and compose in the Server Component, put
presentation and interaction in children, put transformation and validation in plain modules.
That leaves very little in the part the tools cannot reach — and it is the same separation
that makes the pieces reusable.

---

← Prev: [Snapshot tests](12-snapshot-tests.md) ·
Index: [Phase 14](README.md) ·
Next → [Flaky tests, fake timers and CI](14-flaky-tests-and-ci.md)
