---
title: "The query string is the only application state a stranger can type, so the filter contract is one pure module that parses it, defaults it, re-serialises it and predicates on it — and every field falls back rather than throwing"
sidebar_label: "07b · Milestone: the filter contract"
sidebar_position: 44
description: "Chapter 8's capstone, step one: the shape searchParams actually resolves to, lib/board/filters.ts as the single parse/serialise/predicate module, why every field ends in .catch() instead of throwing, and the rule that decides between a fallback and a notFound()."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [`page.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/page)
> (`lastUpdated: 2026-06-09`) and the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`). Schema behaviour probed against the installed **zod 4.4.3**
> (matches the corpus pin). Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zod 4.4.3**.
> Documentation-verified; **no sandbox run**.

**A query string is the only part of your application state that a stranger can type.** `?status=doing&assignee=u_7g2&q=flaky` arrives on the request as three attacker-controlled values of unknown shape, and every one of them is about to become part of a database predicate and part of the rendered page. The contract that turns them into a trusted `Filters` object is a single module — not a `z.parse` inlined in `page.tsx`, because three other call sites need the same rules: the filter bar that writes URLs, the optimistic reducer that decides whether a moved card still matches, and the tests. This step builds that module. Rendering with it is [07c](07c-milestone-reading-filters-in-the-page.md).

## `searchParams` is a promise, and a plain object

Two facts from the reference, both of which people get wrong from memory:

> *"`searchParams` (optional) — A promise that resolves to an object containing the search parameters of the current URL."*
>
> *"Since the `searchParams` prop is a promise. You must use `async/await` or React's `use` function to access the values."*
>
> *"`searchParams` is a plain JavaScript object, not a `URLSearchParams` instance."*
> — [`page.js`, Props](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)

So there is no `.get()`, no `.getAll()`, no `.has()`. And repeated keys collapse into arrays, which the reference's own table states:

| Example URL | `searchParams` |
|---|---|
| `/shop?a=1` | `Promise<{ a: '1' }>` |
| `/shop?a=1&b=2` | `Promise<{ a: '1', b: '2' }>` |
| `/shop?a=1&a=2` | `Promise<{ a: ['1', '2'] }>` |

The resolved type is therefore `{ [key: string]: string | string[] | undefined }` and every field of your schema has to survive all three shapes. A schema written as `z.object({ status: z.enum([...]) })` throws the moment somebody appends `&status=done` twice, which a user does by clicking a filter chip in two browser tabs and copying the wrong URL.

## The contract module

`lib/board/filters.ts` is imported by the Server Component, by the Client Component filter bar and by the optimistic reducer. It is the only module in the milestone that crosses the server/client line on purpose, and it contains no I/O so that crossing is free.

```ts filename="lib/board/filters.ts"
import { z } from 'zod'

export const STATUSES = ['todo', 'doing', 'blocked', 'done'] as const
export type Status = (typeof STATUSES)[number]

/** Collapse the `string | string[] | undefined` shape to a single string. */
const first = z.preprocess(
  (v) => (Array.isArray(v) ? v[0] : v),
  z.string(),
)

/** Collapse it to an array, whatever arrived. */
const many = z.preprocess(
  (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string()),
)

export const filtersSchema = z.object({
  // Multi-valued: ?status=doing&status=blocked
  status: many
    .pipe(z.array(z.enum(STATUSES)))
    .catch([]),
  // Single-valued opaque id. Shape only — it is not an authorisation check.
  assignee: first
    .pipe(z.string().regex(/^u_[a-z0-9]{1,24}$/))
    .optional()
    .catch(undefined),
  // Free text. Trimmed and length-capped so it cannot become a 4KB LIKE pattern.
  q: first
    .pipe(z.string().trim().max(80))
    .catch(''),
})

export type Filters = z.infer<typeof filtersSchema>

export const EMPTY_FILTERS: Filters = { status: [], assignee: undefined, q: '' }

export function parseFilters(
  raw: Record<string, string | string[] | undefined>,
): Filters {
  // Never throws: every field carries its own .catch().
  return filtersSchema.parse(raw)
}

/** The inverse. One writer of query strings, so the URL shape stays canonical. */
export function toSearchParams(f: Filters): URLSearchParams {
  const sp = new URLSearchParams()
  for (const s of f.status) sp.append('status', s)
  if (f.assignee) sp.set('assignee', f.assignee)
  if (f.q) sp.set('q', f.q)
  return sp
}

/** The predicate, shared with the optimistic reducer on the client. */
export function matchesFilters(
  card: { status: Status; assigneeId: string | null; title: string },
  f: Filters,
): boolean {
  if (f.status.length > 0 && !f.status.includes(card.status)) return false
  if (f.assignee && card.assigneeId !== f.assignee) return false
  if (f.q && !card.title.toLowerCase().includes(f.q.toLowerCase())) return false
  return true
}
```

Four exports, four jobs, and the fact that they sit together is the design: `parseFilters` and `toSearchParams` are inverses, so a round trip through the URL is provably lossless for known keys, and `matchesFilters` is defined next to the schema that gives it meaning rather than three directories away in a client component.

## Why every field ends in `.catch()`

`.catch(value)` makes the field fall back instead of throwing. That is a deliberate choice about what a malformed URL *means*.

A malformed filter is not a missing resource and it is not an attack you need to announce. `?status=bogus` should render the unfiltered board, not a 500 and not a `notFound()`. The user got here by editing a URL, following a stale bookmark from before you renamed a status, or clicking a link a colleague hand-edited. Every one of those deserves a board.

The rule that decides between `.catch()` and throwing: **does the invalid value change *which resource* you are looking at?** `boardId` does — a bad board id is a `notFound()`, because there is no sensible board to render. A bad `status` does not; it narrows a view of a resource that exists. Filters get `.catch()`; path params get `notFound()`.

There is a second reason, specific to a shared link. A URL that throws is a URL that cannot be recovered from by anyone: the recipient sees an error page and has no idea which of the five parameters is the bad one. A URL that falls back renders something, and the filter bar — which re-serialises from the parsed object — immediately rewrites the address bar into a form that is valid. Fallback is self-healing; throwing is not.

## What `.catch()` must never hide

`assignee` here is validated for *shape* only, and that is fine because filtering by a user id you are not allowed to see returns zero cards rather than someone else's cards. The authorisation lives in the board read, which is scoped by session. If a filter value ever selected *rows* rather than narrowing an already-authorised set, it would need the same treatment as a Server Action argument — and the Server Actions guide states exactly why shape validation is not enough there:

> *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*
> — [Server Actions and Mutations, Security](https://nextjs.org/docs/app/guides/server-actions#security)

The test to apply to any new filter you add: **if this parameter were set to an arbitrary attacker-chosen value, could the response contain a row the session is not entitled to?** For `status`, `assignee` and `q` against a session-scoped board read, no. For a hypothetical `?teamId=` that changed which team's cards were read, yes — and that parameter does not belong in the filter schema at all; it belongs in the path, behind the access check.

## Gotchas

**★ Symptom: the board renders fine until someone shares a link, then it 500s.** Cause: a bare `z.enum` in the schema and a URL with a repeated or renamed param — `?status=done&status=done` resolves to `['done', 'done']`, which is not a member of the enum, and `parse` throws inside a Server Component, which is an uncaught render error. Fix: preprocess the shape *before* validating the value, and terminate every field with `.catch()`:

```ts
status: z.preprocess(
  (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string()),
).pipe(z.array(z.enum(STATUSES))).catch([]),
```

**★ Symptom: a user pastes a URL with `?q=` containing 4,000 characters and the query takes seconds.** Cause: unbounded free text reaching a `LIKE`/`ILIKE` predicate. Fix: `.max(80)` in the schema, before the value can reach the database — which is what `first.pipe(z.string().trim().max(80)).catch('')` does. The `.catch('')` is what turns an over-long value into "no filter" rather than an error page, so the pasted link still renders a board.

**★ Symptom: filters work on the server and silently disagree with what the board shows after a drag.** Cause: the predicate was written twice — once as a SQL `WHERE`, once inline in the client reducer — and they drifted, usually on case-sensitivity or on how an empty filter is treated. Fix: `matchesFilters` lives in `lib/board/filters.ts`, is pure, imports nothing, and is imported by both sides. If the server-side version must be SQL for size reasons, the two implementations get a shared table of cases and a test that runs both over it; do not settle for "they look the same".

**★ Symptom: an unknown query param silently disappears when the filter bar next writes the URL.** Cause: `toSearchParams` rebuilds the query string from the parsed `Filters` object, so anything the schema does not know about — a UTM tag, an experiment flag, a `?card=` deep link — is dropped. Fix: decide explicitly, and if you preserve, preserve by exclusion rather than by an allow-list you will forget to extend:

```ts
const KNOWN = new Set(['status', 'assignee', 'q'])

export function toSearchParams(f: Filters, keep?: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (keep) for (const [k, v] of keep) if (!KNOWN.has(k)) sp.append(k, v)
  for (const s of f.status) sp.append('status', s)
  if (f.assignee) sp.set('assignee', f.assignee)
  if (f.q) sp.set('q', f.q)
  return sp
}
```

**★ Symptom: `.catch()` swallows a bug you needed to see — a rename shipped and every board silently showed unfiltered results.** Cause: fallback is indistinguishable from "no filter supplied", so a schema that no longer matches the URLs your own UI writes fails invisibly. Fix: make the fallback observable without making it fatal. `safeParse` per field is verbose; a single wrapper that reports and then falls back is not:

```ts
export function parseFilters(raw: Record<string, string | string[] | undefined>): Filters {
  const strict = filtersSchema.safeParse(raw)
  if (!strict.success) {
    // Non-fatal: log the mismatch, then take the .catch() path.
    console.warn('board filters fell back', { raw, issues: strict.error.issues })
  }
  return filtersSchema.parse(raw)
}
```

⚠️ The two-pass version above parses twice on the failure path. That is deliberate — the cost is paid only when a filter is already malformed, and the alternative (hand-rolling per-field recovery) reintroduces the drift the module exists to prevent.

**★ Symptom: `q` round-trips with different whitespace than the user typed, and the URL changes under them mid-session.** Cause: `.trim()` in the schema means `parseFilters` returns a trimmed value, and `toSearchParams` then writes the trimmed form back — so a trailing space typed by a user is deleted from the address bar. Fix: this is usually what you want and should simply be known; if it is not, trim only at the predicate and keep the raw value in the serialised form. Do not "fix" it by trimming in three places.

## Interview questions

**★ When should an invalid query parameter throw, and when should it fall back?**
Fall back when the parameter narrows a view; throw or `notFound()` when it selects the resource. `?status=bogus` narrows a board that exists, so rendering the unfiltered board is a better answer than an error page — nobody is harmed and the user gets somewhere. `/boards/does-not-exist` selects nothing, so there is no view to degrade to. The mechanical version of the rule: if you can produce a sensible page by ignoring the value, ignore it; if ignoring it would render a *different* resource than the URL names, that is a lie and you should not render it.

**★ Your schema validates `assignee` with a regex. Does that make it safe to interpolate into a query?**
No, and conflating the two is how injection survives a code review that "added validation". The regex constrains shape; safety against injection comes from parameterised queries or a query builder, and safety against reading other people's data comes from the board access check that scopes the read to the session. The Server Actions guide makes the same point about mutations — schema validation checks the shape, and a well-formed object can still name a row the caller does not own. Validation is a filter on garbage, not an authorisation mechanism.

**★ Three modules need the filter logic — the page, the filter bar and the optimistic reducer. Two of them are client code. Isn't a shared module across the server/client boundary a smell?**
It would be if it carried I/O or secrets. `lib/board/filters.ts` has neither: it is a schema, a type, a serialiser and a pure predicate, all of which are the *definition* of the contract rather than an implementation of one side of it. Splitting it into a server copy and a client copy is the actual smell, because then the same rule exists twice and the failure mode when they drift is a card visibly in the wrong place. The boundary to police is data and capability crossing the line, not types and pure functions.

**★ Why write `toSearchParams` at all — the filter bar could build the query string inline?**
Because then there are two definitions of what a canonical board URL looks like, and they disagree about the boring cases: whether an empty `q` is written as `q=` or omitted, whether statuses are repeated keys or a comma-joined value, what order the keys appear in. Those differences are invisible until something compares URLs — a cache, an analytics funnel, a test asserting on `router.replace`, or a user wondering why two identical-looking views produce different links. One serialiser makes the round trip `parseFilters(toSearchParams(f))` an identity you can assert in a test, which is the actual reason to have it.

**★ What is the argument for validating `searchParams` at all, given the values only ever reach a `WHERE` clause you already parameterise?**
Three things, none of which is injection. First, types: without a parse, everything downstream handles `string | string[] | undefined` and every consumer writes its own coercion. Second, bounds: an unbounded `q` is a denial-of-service vector against your own database, and the schema is the only place that can cap it before it becomes a query. Third, a closed set: `status` reaching the query as an arbitrary string means your `WHERE status = $1` silently returns zero rows for a typo instead of ignoring an unknown filter, which is a different and worse behaviour than the one you designed. Validation is where the URL stops being text and starts being a value with rules.

---

← [07 · Milestone: state ownership](07-project-milestone-sprintdesk-board-filters-in-the-url.md) · [Chapter 8 overview](01-explanation.md) · Next → [07c · Reading filters in the page](07c-milestone-reading-filters-in-the-page.md)
