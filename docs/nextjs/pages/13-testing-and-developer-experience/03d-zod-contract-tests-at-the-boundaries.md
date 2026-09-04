---
title: "A type is a promise about the interior of your program and a schema is a check at its edge, and the two request-shaped edges of an App Router app — searchParams and FormData — are typed accurately enough that nobody notices they are unvalidated"
sidebar_label: "3d · Zod at the request boundaries"
sidebar_position: 104
description: "Choosing between parse, safeParse and parseAsync, parsing searchParams including repeated keys and the degrade-don't-404 rule, parsing FormData in a Server Action including files and multi-value fields, the flattenError shape useActionState wants, and route handler bodies."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [Zod — Basics](https://zod.dev/basics), [Zod — API](https://zod.dev/api) and [Zod — Error formatting](https://zod.dev/error-formatting); [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (lastUpdated 2026-06-09) and [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (2026-06-17). Zod surface **probed on the installed package** (`zod` **4.4.3**, `require`-time key inspection); no other code was run.
> Target: **Next.js 16.3.4** · **Zod 4.4.3** · Node.js 24.20.0. Continues [3c · Typed routes and generated types](03c-typed-routes-and-generated-types.md).

**There are five places where data enters a Next.js application from outside the type system, and TypeScript describes all five with types that are technically correct and operationally worthless. `searchParams` really is `{ [key: string]: string | string[] | undefined }`. `formData.get('title')` really does return `FormDataEntryValue | null`. Being correct about the shape of a lie is not validation. A schema is the only thing that turns those types into facts, and the reason it is on a testing page is that a schema is *executable specification*: it is the assertion you would otherwise have written a hundred unit tests to approximate, and it runs in production on every request.**

## Pick the right entry point

Zod gives four ways in, and they are not interchangeable:

| Call | Returns | Use it when |
|---|---|---|
| `.parse(input)` | a *"strongly-typed **deep clone** of the input"*; throws `ZodError` | The caller cannot recover — startup config, an invariant you want to crash on |
| `.safeParse(input)` | a discriminated union, `{ success: true, data }` or `{ success: false, error }` | Anything user-facing. A failed parse is a 400 or a form error, not an exception |
| `.parseAsync` / `.safeParseAsync` | as above, awaited | The schema contains an async `.refine()` or `.transform()` — e.g. "this slug is unique" |
| `.check()` | adds a custom validation to a schema | Building the schema, not consuming it |

Two facts about `.parse` that people trip over. It returns a **deep clone**, so the object you validate is not the object you passed in — mutate the input afterwards and the parsed copy does not change. And the error object exposes `error.issues`, an array where each issue carries `code`, `path` and `message`.

⚠️ zod.dev also documents `.validate()` — a boolean type guard that *"never builds an error"* and is much faster than `.safeParse().success`. **It does not exist in Zod 4.4.3**, which is the version this corpus pins; a `require`-time probe of the installed package returns `undefined` for both `z.validate` and `schema.validate`. Treat it as available only after a deliberate upgrade.

## Boundary 1 — `searchParams`

The framework's own type is the problem:

> *"`searchParams: Promise<{ [key: string]: string | string[] | undefined }>`"*

and

> *"`searchParams` is a plain JavaScript object, not a `URLSearchParams` instance."*

So a repeated key changes the *shape*, not just the value: `/shop?a=1&a=2` gives `Promise<{ a: ['1', '2'] }>`. Any schema over search params that ignores this is wrong for a URL a user can construct by hand, and board filters are exactly the feature where users construct URLs by hand.

```ts
// lib/board/board-search-params.ts
import { z } from 'zod'

const TaskStatus = z.enum(['todo', 'doing', 'blocked', 'done'])

/** A key that may arrive once, many times, or not at all. */
const many = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([item, z.array(item)])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]))

export const BoardSearchParams = z.object({
  status: many(TaskStatus),
  assignee: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(500).catch(1),
  q: z.string().trim().max(120).optional(),
})

export type BoardSearch = z.infer<typeof BoardSearchParams>
```

Used from the page:

```tsx
// app/teams/[teamId]/board/page.tsx
import { BoardSearchParams } from '@/lib/board/board-search-params'
import { getBoard } from '@/lib/data/boards'

export default async function BoardPage(props: PageProps<'/teams/[teamId]/board'>) {
  const { teamId } = await props.params
  const raw = await props.searchParams

  const parsed = BoardSearchParams.safeParse(raw)
  const filters = parsed.success ? parsed.data : BoardSearchParams.parse({})

  const board = await getBoard(teamId, filters)
  return <Board board={board} filters={filters} />
}
```

🔴 **A bad query string is not a 404.** Someone shared a link, someone hand-edited it, a crawler mangled it, a marketing tool appended `?utm_source=…`. The right behaviour for a filter is to fall back to the default view — which is why `page` uses `.catch(1)` rather than failing the whole object, and why the page-level failure path renders the unfiltered board instead of calling `notFound()`. Reserve hard failure for params that *identify* something; `teamId` not existing is a 404, `status=purple` is not.

Note also that the schema is a leaf module: it imports nothing from the data layer, so a client component can import it to build the same URL the server will parse. That symmetry is the actual payoff — one definition of "what a board URL means", used by the link builder and the reader.

## Boundary 2 — `FormData` in a Server Action

`formData.get('title')` returns `FormDataEntryValue | null`, a union of `string` and `File`. Every line downstream of that read is an assertion until something checks it.

The tempting one-liner is wrong:

```ts
// ✗ loses every repeated field, and puts File objects into a "string" schema
const data = TaskSchema.parse(Object.fromEntries(formData))
```

`Object.fromEntries` keeps only the **last** value for a repeated key, so a multi-select of labels silently becomes one label. Collect properly:

```ts
// lib/forms/form-data.ts
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key)
    out[key] = values.length > 1 ? values : values[0]
  }
  return out
}
```

The action itself:

```ts
// app/teams/[teamId]/board/actions.ts
'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { formDataToObject } from '@/lib/forms/form-data'
import { requireTeamMember } from '@/lib/auth/session'
import { insertTask } from '@/lib/data/tasks'

const CreateTask = z.object({
  teamId: z.uuid(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  status: z.enum(['todo', 'doing', 'blocked', 'done']).default('todo'),
  labelIds: z
    .union([z.uuid(), z.array(z.uuid())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  dueAt: z.coerce.date().optional(),
})

export type CreateTaskState = {
  ok: boolean
  fieldErrors?: Record<string, string[] | undefined>
  formErrors?: string[]
}

export async function createTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const parsed = CreateTask.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error)
    return { ok: false, fieldErrors: flat.fieldErrors, formErrors: flat.formErrors }
  }

  // 🔴 Separate check. The schema proved the shape; it proved nothing about
  // who is calling. Identity comes from the session, never from the form.
  const member = await requireTeamMember(parsed.data.teamId)

  await insertTask({ ...parsed.data, createdBy: member.userId })
  revalidateTag(`board:${parsed.data.teamId}`)
  return { ok: true }
}
```

The error shape is chosen for the consumer. `z.flattenError` produces `{ formErrors: string[], fieldErrors: Record<string, string[]> }`, and the Zod docs justify it in one line — *"the majority of schemas are flat — just one level deep."* — which is exactly true of an HTML form. That object drops straight into `useActionState` and maps one-to-one onto inputs. Use `z.treeifyError` when the payload is genuinely nested (a JSON body with sub-objects); `z.formatError()` is deprecated in favour of it. `z.prettifyError` gives a human-readable multi-line string and belongs in a log line, not in a response.

🔴 **`z.coerce.date()` on an empty input.** An untouched `<input type="date">` submits `''`, `new Date('')` is `Invalid Date`, and the coercion produces a date object that fails the schema with an unhelpful message. Either mark the field `z.union([z.literal(''), z.coerce.date()])` and map `''` to `undefined`, or strip empty strings in `formDataToObject`. Decide once, in the helper, not per form.

**File uploads are not this schema's job.** `formData.get('attachment')` is a `File` in a Server Action; validate it with `z.instanceof(File)` plus explicit `size` and `type` checks, and remember the framework's own limit — the Server Actions body size cap is 1 MB by default and configurable through `serverActions.bodySizeLimit`. A schema cannot save you from a request that was rejected before your code ran.

## What the schema did not do

The Server Actions guide is unusually direct about this, and it is the sentence to remember from this whole page:

> *"Schema validation (zod or similar) only checks the shape of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

and

> *"Render-time gating (only rendering a form on an authenticated page) is not a security boundary, because requests can be sent without going through the UI."*

So a Server Action has three independent obligations, and a Zod schema discharges exactly one:

1. **Shape** — the schema. Testable with a table of good and bad inputs, no database.
2. **Authorization** — the session lookup and the ownership check. Testable with a fake session and a mocked repository.
3. **Effect** — the row written, the tag revalidated. Testable at the data layer or in Playwright.

A suite that only tests (1) is the most common shape of a green test suite over a broken action. The three-test breakdown lives in [1b · Server Components and Actions](01b-testing-server-components-and-server-actions.md).

## Boundary 3 — Route Handler bodies

`await request.json()` returns `any`, and it also *throws* on an empty or malformed body before your schema is ever reached. A handler that does not distinguish the two returns 500 where it should return 400:

```ts
// app/api/teams/[teamId]/tasks/route.ts
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/auth/session'
import { insertTask } from '@/lib/data/tasks'

const Body = z.strictObject({
  title: z.string().trim().min(1).max(200),
  status: z.enum(['todo', 'doing', 'blocked', 'done']).default('todo'),
})

export async function POST(request: Request, ctx: RouteContext<'/api/teams/[teamId]/tasks'>) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'expected application/json' }, { status: 415 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'malformed JSON body' }, { status: 400 })
  }

  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 })
  }

  const { teamId } = await ctx.params
  const member = await requireTeamMember(teamId)
  const task = await insertTask({ ...parsed.data, teamId, createdBy: member.userId })
  return NextResponse.json(task, { status: 201 })
}
```

`z.strictObject` is deliberate here. The default object schema **strips** unknown keys silently; `z.strictObject` *"throws an error when unknown keys are found"*, producing an `unrecognized_keys` issue with a message of the form `Unrecognized key: "extraKey"` and an empty `path`. For a public API that is the friendlier behaviour: a client sending `titel` gets told, rather than getting a 201 and a task called "Untitled". For an internal endpoint you control, stripping is fine and forward-compatible. Choose per endpoint, and know which one you chose.

⚠️ The empty `path` on `unrecognized_keys` matters if you are mapping issues onto form fields — the issue is about the object, not about any field in it, so it belongs in `formErrors`, not `fieldErrors`. `z.flattenError` already puts it there.

The remaining two boundaries — environment variables and third-party API responses — plus the *contract test* proper are [3e · Env schemas and third-party contract tests](03e-env-schemas-and-contract-tests.md).

## Gotchas

**★ Symptom: a multi-select field arrives with only its last value.** Cause: `Object.fromEntries(formData)` keeps one entry per key, and HTML sends one entry per selected option. Fix: build the object with `formData.getAll(key)` as shown in `formDataToObject`, and give every repeatable field a schema that accepts both the single and the array form.

**★ Symptom: `?status=todo&status=doing` fails validation on a schema that works in every test.** Cause: the tests passed strings; a repeated query key makes the value an array. The Next.js docs state it directly — `/shop?a=1&a=2` is `Promise<{ a: ['1', '2'] }>`. Fix: the `many()` combinator above, applied to every filter a user could plausibly repeat.

**★ Symptom: a stray `?utm_source=twitter` sends users to a 404.** Cause: the page called `.parse()` on the whole search-params object and treated failure as "route does not exist". Fix: `safeParse` with a fallback to defaults; use `.catch()` per field for values that have a sensible default. Reserve `notFound()` for params that identify a resource.

**★ Symptom: `page=1e3` or `page=-5` reaches the database.** Cause: `z.coerce.number()` alone accepts any `Number()`-convertible string, including exponents, infinities and negatives. Fix: chain the constraints — `z.coerce.number().int().min(1).max(500)` — and give it a `.catch()` so a garbage page number renders page 1 instead of erroring.

**★ Symptom: an empty date input fails with "Invalid date".** Cause: `z.coerce.date()` runs `new Date('')`, which is an `Invalid Date` object, not `undefined`. Fix: strip empty strings to `undefined` in the FormData helper, or accept `z.literal('')` explicitly and transform it.

**★ Symptom: `z.coerce.boolean()` treats an unchecked checkbox as `true`.** Cause: coercion is `Boolean(input)`, and any non-empty string is truthy — `"false"` included. Fix: for form checkboxes, test for the presence of the key (an unchecked box sends nothing at all); for string-encoded booleans from config or query strings, use `z.stringbool()`, which understands `"true"/"1"/"yes"/"on"` and `"false"/"0"/"no"/"off"` case-insensitively.

**★ Symptom: the API returns 500 for a request with no body.** Cause: `request.json()` throws before the schema runs; the handler had no `try`. Fix: wrap the `json()` call and return 400 on the catch, as above. Check `content-type` first and return 415, so a client sending form-encoded data to a JSON endpoint gets a diagnosis rather than a parse failure.

**★ Symptom: a client sends `titel: 'x'` and the endpoint returns 201 with an empty title.** Cause: Zod object schemas strip unknown keys by default, so the typo was discarded and the real field was absent — or filled from a `.default()`. Fix: `z.strictObject` on any endpoint with external callers.

**★ Symptom: the action validated perfectly and a user edited another team's task.** Cause: the schema checked that `taskId` is a UUID; nothing checked that the UUID belongs to the caller's team. Fix: derive identity from the session and scope the query by it — `updateTask({ id, teamId: member.teamId })` — so the ownership check is in the `WHERE` clause and cannot be forgotten. A schema is not an authorization mechanism.

**★ Symptom: the parsed object and the input disagree after a later mutation.** Cause: `.parse` returns a deep clone; mutating the original afterwards does not affect it, and vice versa. Fix: use the parsed value everywhere downstream and stop referring to the raw input at all. Naming helps — `raw` and `parsed`, never one variable reused.

**★ Symptom: `.parse` succeeds but the inferred type has the wrong shape.** Cause: a `.transform()` in the schema makes the input and output types diverge, and `z.infer` is the *output*. Fix: use `z.input<typeof Schema>` where you need the pre-transform shape — building a form's default values, for instance — and `z.output` (which is what `z.infer` aliases) for everything downstream of the parse.

**★ Symptom: an async `.refine()` never runs.** Cause: it was called through `.parse` / `.safeParse` rather than the async variants. Fix: `await Schema.safeParseAsync(input)`. A uniqueness check that queries the database is async by nature; if the schema has one, every call site must be async, which is a good reason to keep such checks out of the schema and in the action.

## Interview questions

**★ `searchParams` is already typed. What does a schema add?**
It converts a description into a decision. The framework type says a value may be a string, an array of strings, or absent — all three of which are true, and none of which tells you what your page should render. The schema states the intent: `status` is zero or more of four known values, `page` is an integer in a range with a default, an unknown key is ignored. After the parse you have a value whose type you can trust because something checked it, rather than a type you asserted. And because the schema is a value, the same definition can build the URL on the client and read it on the server.

**★ Why `safeParse` for a form and `parse` for configuration?**
Because the two failures have different audiences. A form's caller is a user who can fix the input, so the failure must become data — field errors rendered next to inputs — and an exception is the wrong control flow for that. Configuration's caller is the operator, and there is no correct behaviour for an application that started with a missing database URL; throwing at startup is the desired outcome. The rule is: `safeParse` where a human can correct the input, `parse` where nobody can.

**★ A colleague says Zod at the boundary makes their unit tests redundant. Are they right?**
Partly, and dangerously so. The schema does replace the family of tests that assert "rejects a missing title", "rejects a 300-character title", "coerces the page number" — those become properties of a declaration, and testing a declaration mostly tests Zod. What it does not replace is the test that the *right schema* is applied at the right place, the authorization test, and the effect test. The documentation is explicit that shape validation says nothing about ownership. So: fewer input-validation tests, and the ones that remain are more important, not less.

**★ Why is `Object.fromEntries(formData)` a bug rather than a shortcut?**
Because `FormData` is a multimap and a plain object is not. Repeated keys — checkbox groups, multi-selects, arrays of hidden inputs — collapse to the last value, and the loss is silent: the schema receives a valid single value and passes. The failure appears in production as "only one label saved" and looks like a database bug. Iterating `formData.keys()` and using `getAll` preserves the multimap semantics, and it costs six lines once.

**★ When would you choose `z.strictObject` over the default?**
When an unrecognised key is more likely to be a caller's mistake than your own forward-compatibility. Public or partner-facing endpoints get strict objects, because a client that misspells a field deserves a 400 rather than a silent default. Internal endpoints and anything you version by adding fields get the default stripping behaviour, because a newer client sending a field an older server does not know about should keep working. The decision is about who is on the other end, not about strictness as a virtue.

**★ Where should the schema live in the module graph?**
In a leaf module with no server-only imports. Schemas are values, so `import type` cannot keep them out of a client bundle; any client component that shares a schema drags the whole module in with it. Putting `board-search-params.ts` next to the database client means the database client is now a client dependency. Keeping schemas in their own files is a bundling decision as much as an organisational one — see [3b](03b-module-syntax-and-where-types-stop.md).

**★ What does `.parse` returning a deep clone imply for performance-sensitive paths?**
That parsing a large payload costs an allocation proportional to the payload, not a constant. For a request body that is already small this is irrelevant. For a hot path where you only need a yes-or-no answer, Zod 4.5 added `.validate()`, a boolean type guard that never builds an error object — but it is absent from 4.4.3, which is what this corpus pins, so on the current version the honest answer is `safeParse` and accept the clone. Do not micro-optimise a request-boundary parse; the network call next to it is four orders of magnitude more expensive.

{/* FOOTER */}
