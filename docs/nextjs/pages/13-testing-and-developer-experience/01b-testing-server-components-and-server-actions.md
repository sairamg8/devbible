---
title: "An async Server Component is not unit-testable today and a Server Action is trivially unit-testable, and both facts come from the same place — what the compiler leaves behind for a Node process to import"
sidebar_label: "1b · Server Components and Actions"
sidebar_position: 2
description: "Why a synchronous Server Component renders in jsdom and an async one does not, the three tests every Server Action needs and why shape validation is only one of them, testing Route Handlers as plain functions, and the .env.local rule that makes test runs reproducible."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [Testing](https://nextjs.org/docs/app/guides/testing) (lastUpdated 2026-02-03), [How to set up Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest) (2026-08-25), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (2026-06-17) and [How to use environment variables in Next.js](https://nextjs.org/docs/app/guides/environment-variables) (2026-08-25).
> Target: **Next.js 16.3.4** · React 19.2.8 · continues [1 · Unit and component testing](01-unit-and-component-testing-jest-vitest-react-testing-library.md).

**Two server-side constructs sit next to each other in an App Router codebase and have opposite testability. An `async` Server Component cannot be unit-tested, because rendering a component that returns a promise requires a React renderer that resolves it, and the ecosystem's jsdom renderers do not. A Server Action can be unit-tested almost trivially, because `'use server'` changes nothing about the function itself — it only changes how *client* bundles refer to it. On the server side it is still an exported async function you can import and call. Understanding why one is easy and the other is not tells you exactly where the framework boundary is, and therefore where Playwright has to take over.**

## Synchronous Server Components render; async ones do not

A Server Component with no `await` in it is, from a renderer's point of view, an ordinary function returning JSX. React Testing Library renders it. The Next.js Vitest and Jest guides both do this in their first example — a default-exported page component with a heading and a `Link`, imported directly into a test file and rendered.

An `async` Server Component returns a promise of an element. The framework's server renderer knows how to await that; a jsdom-hosted client renderer does not. The docs are unambiguous about the consequence:

> *"Since `async` Server Components are new to the React ecosystem, some tools do not fully support them."*

The recommendation attached to that is End-to-End testing rather than unit testing for `async` components, and both the Jest and the Vitest guides repeat it in their own words.

### What to do instead, concretely

Do not try to render the async component. Split it. An async Server Component is almost always two things wearing one hat: a data acquisition step and a presentation step. Separate them and each half becomes testable by its natural tool.

```tsx title="app/board/[id]/page.tsx"
import { getBoardWithTasks } from '@/lib/dal/boards'
import { BoardView } from './board-view'

export default async function Page(props: PageProps<'/board/[id]'>) {
  const { id } = await props.params
  const board = await getBoardWithTasks(id)
  return <BoardView board={board} />
}
```

```tsx title="app/board/[id]/board-view.tsx"
import type { BoardWithTasks } from '@/lib/dal/boards'

export function BoardView({ board }: { board: BoardWithTasks }) {
  return (
    <section>
      <h1>{board.name}</h1>
      <ul>
        {board.tasks.map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
    </section>
  )
}
```

`BoardView` is synchronous and pure, so it renders in jsdom and you can assert on every branch — empty board, one task, a task with a missing title — cheaply. `getBoardWithTasks` is a plain async function with no JSX, so it gets a Node-environment test against a real test database or a fake. The three-line `Page` that glues them together is the only part with no unit test, and it is also the only part with no logic. That residue is what the Playwright suite covers.

This is not a workaround for a temporary tooling gap. It is the same decomposition you would want anyway, and it survives whatever the renderers eventually support.

## Server Actions: three different tests, only one of which is about shape

The Server Actions guide describes the compilation exactly. The `'use server'` directive tells the compiler to replace the function's implementation in client bundles with a reference — an action ID plus a dispatcher that POSTs back to the server. The implementation itself never leaves the server. Which means: in a Node test process, importing the module gives you the real function.

```ts title="app/tasks/actions.ts"
'use server'

import * as z from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { CreateTaskSchema } from '@/lib/schemas/task'

export async function createTask(_prev: unknown, formData: FormData) {
  const session = await auth()
  if (!session?.user) return { ok: false as const, error: 'unauthenticated' }

  const parsed = CreateTaskSchema.safeParse({
    boardId: formData.get('boardId'),
    title: formData.get('title'),
  })
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const board = await db.board.findFirst({
    where: { id: parsed.data.boardId, ownerId: session.user.id },
  })
  if (!board) return { ok: false as const, error: 'forbidden' }

  const task = await db.task.create({
    data: { boardId: board.id, title: parsed.data.title },
  })
  return { ok: true as const, id: task.id }
}
```

Four early returns, four tests. The guide is explicit about why two of them exist and are separate:

- **Authentication.** Render-time gating is not a security boundary — a form only rendered on an authenticated page is still reachable by anyone who can send the same POST. So "no session" is a branch that must be asserted, not assumed.
- **Shape.** `safeParse` rejecting malformed input.
- **Ownership.** The guide makes the sharpest point in the whole page here: schema validation only checks the *shape* of the input, and a well-formed object can still name a row the caller does not own. Shape passing and authorization passing are two independent facts. A test suite that only covers the schema has tested neither.
- **Effect.** The happy path actually wrote what it claimed to write.

```ts title="app/tasks/actions.test.ts"
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTask } from './actions'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth')

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('createTask', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('rejects an anonymous caller', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createTask(null, form({ boardId: 'b1', title: 'Ship it' }))
    expect(result).toEqual({ ok: false, error: 'unauthenticated' })
  })

  it('rejects an empty title before touching the database', async () => {
    const result = await createTask(null, form({ boardId: 'b1', title: '' }))
    expect(result.ok).toBe(false)
    expect(await db.task.count()).toBe(0)
  })

  it('refuses a board the caller does not own', async () => {
    const board = await db.board.create({ data: { name: 'Theirs', ownerId: 'user-2' } })
    const result = await createTask(null, form({ boardId: board.id, title: 'Ship it' }))
    expect(result).toEqual({ ok: false, error: 'forbidden' })
    expect(await db.task.count()).toBe(0)
  })

  it('creates the task on the happy path', async () => {
    const board = await db.board.create({ data: { name: 'Mine', ownerId: 'user-1' } })
    const result = await createTask(null, form({ boardId: board.id, title: 'Ship it' }))
    expect(result.ok).toBe(true)
    expect(await db.task.findFirst({ where: { boardId: board.id } })).toMatchObject({
      title: 'Ship it',
    })
  })
})
```

Note the two negative tests assert on database state, not just on the return value. An action that returns `{ ok: false }` *and* writes anyway is a real bug shape, and only the state assertion catches it.

`FormData` and `File` are globals in Node 18 and later, so constructing an action's input in a Node-environment test needs nothing installed.

### What this test does not cover, and what does

It does not cover: the CSRF `Origin`-versus-`Host` check, the 1MB body size limit, action ID encryption, closure variable encryption, serialization of the return value across the boundary, or the router refresh that follows. All of those are framework behaviour on the request path, and the request path is not in the test. They are Playwright's territory, or in the case of the size limit and allowed origins, configuration you verify once rather than per action.

It also does not cover the cache-update choice. `updateTag`, `revalidateTag`, `revalidatePath` and `refresh` differ in whether the action's own response waits for fresh data — `updateTag` gives read-your-own-writes, `revalidateTag` with a stale-while-revalidate profile deliberately does not. Whether the user sees their change immediately is an end-to-end assertion by construction; a unit test can only verify that the right function was called.

## Route Handlers are functions too

A `route.ts` export is an async function taking a `Request` and returning a `Response`. Both are Node globals. There is no framework machinery to stub for the basic case:

```ts title="app/api/tasks/route.test.ts"
import { expect, it } from 'vitest'
import { POST } from './route'

it('rejects a payload with no title', async () => {
  const response = await POST(
    new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ boardId: 'b1' }),
    })
  )

  expect(response.status).toBe(400)
  await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) })
})
```

The limit shows up the moment the handler reads `cookies()`, `headers()`, or `params` from the route context. Those are request-scoped APIs the framework populates; calling the exported function directly does not populate them. At that point you either inject the values (pass a session object rather than reading it inside), or you move the test to Playwright's `request` fixture, which drives a real server.

## Environment variables: the rule that makes runs reproducible

Next.js has a third environment beyond development and production. When `NODE_ENV` is `test`, `.env.test` is loaded and — the part that matters — `.env.development` and `.env.production` are not.

The critical rule is about `.env.local`. It is deliberately **not** loaded in the test environment, so that a test run produces the same result on your machine and on someone else's. Your personal overrides do not silently leak into the suite. The consequence is the mirror image: anything a test genuinely needs must be in `.env.test`, and `.env.test` is a file you commit. `.env.test.local` is the one that stays out of Git.

Test runners normally set `NODE_ENV=test` for you. `next/jest` loads `.env` files into `process.env` as part of its setup. Vitest does not, because it is not a Next.js tool — so if a unit test needs the same env-loading Next.js performs, do it explicitly in a setup file:

```ts title="vitest.setup.ts"
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
```

## Gotchas

**★ `vi.mock('@/lib/auth')` inside a `describe` block throws on Vitest 5.**
Mock calls are hoisted to the top of the file, so writing one inside a callback never executed where it appeared. Vitest 4 warned; Vitest 5 throws and names the offending call and its location. Move it to the module's top level, or use `vi.doMock`, which is not hoisted.

**★ Testing the Zod schema and calling it "the action is tested".**
Shape validation and authorization are independent. A perfectly-shaped `{ boardId, title }` naming someone else's board passes every schema test you can write. The ownership branch needs its own test with its own fixture, and the assertion belongs on the database, not on the return value.

**★ Asserting only the return value of a failed action.**
An action that returns an error and still performs its write is a real failure mode — an early return placed after the mutation, a `revalidate` call that fired anyway. Assert that nothing was written.

**★ Importing a `'use server'` module into a jsdom-environment test.**
It works, and that is the trap: you are now running server code with a fake DOM attached for no reason, and any accidental DOM dependency in your data layer goes unnoticed. Put action and DAL tests in a `node` environment so a stray `document` reference fails loudly.

**★ Trying to render an `async` Server Component "just to see".**
It does not fail with a clear message about async support; it fails with a React error about what the component returned, which reads like a bug in your component. Recognise the shape and split the component instead.

**★ Reaching for `cookies()` or `headers()` inside a directly-called Route Handler.**
Those are request-scoped and populated by the framework's request lifecycle, which is not running when you call the exported function yourself. Either inject what the handler needs as an argument, or test that path end-to-end.

**★ Expecting `.env.local` to apply during tests, and building a fixture on top of it.**
It is not loaded, by design. A test that passes locally because of a value in `.env.local` will fail for everyone else — including the version of you that just cloned into a fresh directory. Put it in `.env.test` and commit it.

**★ Committing `.env.test.local`.**
The naming is deliberately confusing. `.env.test` is shared and committed; `.env.test.local` matches the `.env*.local` gitignore pattern and holds anything personal or secret.

**★ A test database shared across parallel workers.**
Vitest and Jest both parallelise across files by default. Two files creating a board named "Mine" against the same database will interfere, and the failure will be intermittent and order-dependent. Use a transaction rolled back per test, or a schema/database per worker, and never point a test at the development database.

**★ Assuming a mocked `auth()` reflects the real session shape.**
`vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } })` will happily return a shape your real `auth()` never produces, and every downstream assertion then tests fiction. Type the mock against the real return type so a change to the session shape breaks the test rather than silently invalidating it.

**★ Unit-testing which revalidation function an action called, and calling that a cache test.**
Asserting `expect(updateTag).toHaveBeenCalledWith('board-1')` verifies a call, not an outcome. Whether the user sees fresh data in the same round trip depends on which function it was and on the cache profile behind the tag — an observable end-to-end behaviour.

## Interview questions

**★ Why can you unit-test a Server Action but not an `async` Server Component?**
Because `'use server'` does not change the function on the server — it changes how client bundles reference it, replacing the implementation with an action ID and a dispatcher. Import the module in a Node process and you get the real async function; call it and it runs. An `async` Server Component, by contrast, returns a promise of an element, and rendering it requires a renderer that awaits that promise before committing. The jsdom-hosted renderers that Jest and Vitest use do not, which is why the docs steer async components to end-to-end tests.

**★ How do you make an `async` Server Component testable without waiting for tooling to catch up?**
Split it into a data function and a synchronous presentational component. The data function is a plain async function with no JSX and gets a Node-environment test; the presentational component is synchronous and renders in jsdom, so every rendering branch is cheap to cover. What remains in the page file is a few lines of glue with no logic, and that glue is covered by the end-to-end suite. This is also just better design, so it does not become dead weight when renderer support improves.

**★ Which branches of a Server Action deserve tests, and why is the schema test the least interesting one?**
Authentication, input shape, authorization, and the effect. The schema test is the least interesting because it verifies the smallest claim: that malformed input is rejected. The docs make the point directly — schema validation only checks shape, and a well-formed payload can still name a resource the caller does not own. The authorization test is the one that stops a real attack, and it must assert on persisted state, because an action can return an error and still have written.

**★ Why should a negative action test assert on the database rather than on the return value?**
Because the return value and the side effect can disagree. An early return placed after the mutation, an exception swallowed by a `catch` that still returns an error object, a `revalidate` that fired before validation — all produce an error result alongside a completed write. Only the state assertion distinguishes "rejected" from "rejected, after doing it anyway".

**★ What can a Server Action unit test never cover?**
Everything on the request path: the `Origin`-versus-`Host` CSRF check, the body size limit, encrypted action IDs and closure variables, serialization of the return value across the server/client boundary, and the router refresh that ships in the same response. Calling the function directly bypasses all of it. Those are end-to-end concerns, or one-off configuration checks.

**★ Why is `.env.local` deliberately not loaded in the test environment?**
So that a test run is reproducible across machines. `.env.local` is the file for personal overrides; if it applied during tests, a suite could pass on your laptop because of a value nobody else has. The corollary is that anything a test genuinely depends on belongs in `.env.test`, which is committed — while `.env.test.local` matches the ignored `.env*.local` pattern and stays out.

**★ Vitest does not load your Next.js env files. How do you get the same behaviour?**
Call `loadEnvConfig(process.cwd())` from `@next/env` in a setup file. That is the same loader Next.js itself uses, so the resolution order and the environment-specific rules are identical, rather than approximated with `dotenv`.

**★ A test passes in isolation and fails when the suite runs. Where do you look first?**
Shared mutable state across parallel workers — almost always a test database. Both runners parallelise across files, so two files writing the same fixture rows collide non-deterministically. The fix is isolation per test: a transaction that rolls back, or a database or schema per worker. The second place to look is mock history bleeding between tests, though Vitest 5's `clearMocks` default removes most of that class.

**★ How would you test a Route Handler that reads `cookies()`?**
Not by calling the exported function, because `cookies()` is request-scoped and the framework populates it during a real request that is not happening here. Either restructure so the handler receives the session or the relevant value as an argument — which makes it a pure function of its inputs and trivially testable — or drive it through Playwright's `request` fixture against a running server, which exercises the real lifecycle.

---

← [Unit and component testing](01-unit-and-component-testing-jest-vitest-react-testing-library.md) · [Chapter 13 overview](01-explanation.md) · Next → [End-to-end flows with Playwright](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md)
