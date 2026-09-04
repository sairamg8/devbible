---
title: "A query string is user input with the same trust level as a request body — one zod schema at the page boundary turns any URL a stranger can type into values your code can use, and it still does not authorise anything"
sidebar_label: "03j · Validating query state, and canonical URLs"
sidebar_position: 128
description: "A zod schema for searchParams with per-field catch and bounded strings, why validation is not authorisation, the URL length budget set by chat clients rather than browsers, and keeping URLs canonical by omitting defaults and sorting keys."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (`lastUpdated: 2026-06-09`),
> [nuqs — Limits](https://nuqs.dev/docs/limits), [nuqs — Server-Side usage](https://nuqs.dev/docs/server-side) and
> [nuqs — Options](https://nuqs.dev/docs/options) (`nuqs` **2.10.1**).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zod 4.4.3**.
> Documentation-verified; **no sandbox run**.

**Normalising a query parameter fixes its shape. It does not fix its meaning — that `page` is a positive integer inside your dataset, that `sort` names a real column, that `from` precedes `to`, that a 40 kB search string is not something you will send to the database. A URL arrives from a bookmark, a campaign, a crawler, a colleague's paste and from someone deliberately editing the address bar, and it reaches your query with exactly the trust level of a request body. One schema at the page boundary handles all of that. What it emphatically does not handle is whether the requester is allowed to see the thing they named, and confusing those two checks is how a filter bug becomes an incident.**

## One zod schema, at the page boundary

```ts filename="app/[tenant]/board/search-params.ts"
import { z } from 'zod'

const SORTS = ['age', 'priority', 'title'] as const
const STATUSES = ['open', 'blocked', 'done', 'archived'] as const

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

export const boardSearchParams = z.object({
  status: z.preprocess(first, z.enum(STATUSES)).catch('open'),
  sort: z.preprocess(first, z.enum(SORTS)).catch('age'),
  dir: z.preprocess(first, z.enum(['asc', 'desc'])).catch('desc'),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(500)).catch(1),
  q: z.preprocess(first, z.string().trim().max(120)).catch(''),
  tags: z
    .preprocess(
      (v) =>
        v === undefined
          ? []
          : (Array.isArray(v) ? v : [v]).flatMap((s) => String(s).split(',')),
      z.array(z.string().min(1).max(40)).max(20),
    )
    .catch([]),
  from: z.preprocess(first, z.iso.date()).optional().catch(undefined),
  to: z.preprocess(first, z.iso.date()).optional().catch(undefined),
})

export type BoardQuery = z.infer<typeof boardSearchParams>

export function parseBoardQuery(
  raw: Record<string, string | string[] | undefined>,
): BoardQuery {
  return boardSearchParams.parse(raw)
}
```

```tsx filename="app/[tenant]/board/task-list.tsx"
import { parseBoardQuery } from './search-params'

export async function TaskList({
  searchParams,
}: Pick<PageProps<'/[tenant]/board'>, 'searchParams'>) {
  const query = parseBoardQuery(await searchParams)
  const tasks = await db.tasks.list(query)     // every field is now a real type
  return <TaskTable tasks={tasks} />
}
```

Four things that schema does which hand-rolled parsing usually forgets:

1. **`.catch(default)` per field, not `safeParse` for the whole object.** A garbage `page` should not blank the board; it should fall back to page 1 while `status` still applies. Field-level `catch` degrades gracefully, which is the right behaviour for a URL a stranger may have mangled — and the wrong behaviour for a request body, which is a useful reminder that the two are validated with the same tool for different reasons.
2. **`.max()` on everything unbounded.** `q` capped at 120 characters and `tags` at 20 entries are not politeness; they are what stops a crafted URL becoming a slow query or an unbounded cache key ([03c](03c-caching-query-driven-routes.md)).
3. **`z.iso.date()` rather than `new Date(value)`.** `new Date('banana')` is `Invalid Date` — an object, therefore truthy, therefore it sails through `if (from)` and into your query. A schema rejects the string before a `Date` ever exists.
4. **`z.infer` gives the rest of the app the type.** The parsed object is what you pass to the database layer, to a cached function's arguments, and back into a link builder — one definition, three consumers.

### Cross-field rules go on the object, not the field

```ts
export const boardSearchParams = z
  .object({ /* … fields as above … */ })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'from must not be after to',
    path: ['from'],
  })
```

A `.refine` that throws is usually the wrong shape for a URL, though — a stranger produces `?from=2026-12-01&to=2026-01-01` with two mis-clicks. Prefer normalising to something sane:

```ts
  .transform((v) =>
    v.from && v.to && v.from > v.to ? { ...v, from: v.to, to: v.from } : v,
  )
```

The general rule for URL validation: **repair what a confused human would plausibly produce, reject what only a probe would produce.** A reversed date range is a mis-click. A `sort` value that is not a column is a probe.

## 🔴 Validation is not authorisation

This is the failure that turns a filter bug into an incident.

```tsx
// ❌ `tenant` and `assignee` are valid strings. That says nothing about whether
//    this viewer may see this tenant's tasks.
const { tenant, assignee } = parseBoardQuery(await searchParams)
const tasks = await db.tasks.list({ tenant, assignee })
```

A schema proves a value is *well-formed*. It cannot prove the requester is entitled to it. Anything identifying a subject — a tenant, an owner, an organisation, another user's id — must be checked against the session, on the server, after parsing:

```tsx filename="app/[tenant]/board/task-list.tsx"
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { parseBoardQuery } from './search-params'

export async function TaskList({
  searchParams,
  tenant,
}: Pick<PageProps<'/[tenant]/board'>, 'searchParams'> & { tenant: string }) {
  const session = await getSession()
  if (!session.tenants.includes(tenant)) notFound()   // ✅ authorisation, not validation

  const query = parseBoardQuery(await searchParams)
  const tasks = await db.tasks.list({ ...query, tenant, viewer: session.userId })
  return <TaskTable tasks={tasks} />
}
```

The corollary is a design rule rather than a guard: **do not put identity in the query string at all.** A filter naming *whose* tasks to show invites exactly this mistake on every future edit of the file. Derive the viewer from the session and let the URL carry only what is genuinely a view preference — then the class of bug does not exist to be guarded.

`nuqs` is explicit that its own server-side loaders do not close this gap either:

> *"Loaders **don't validate** your data. If you expect positive integers or JSON-encoded objects of a particular shape, you'll need to feed the result of the loader to a schema validation library, like Zod."*
> — [nuqs, Server-Side usage](https://nuqs.dev/docs/server-side)

It does offer a stricter mode for the parse itself, which is worth knowing exists:

> *"If a search param contains an invalid value for the associated parser (eg: `?count=banana` for `parseAsInteger`), the default behaviour is to return the default value if specified, or `null` otherwise. You can turn on **strict mode** to instead throw an error on invalid values when running the loader"*
> — same page

## Length: the URL is not a database

> *"Most modern browsers enforce a max URL length, which can vary: **Chrome:** ~2 MB (practically, you might encounter issues at around 2,000 characters). **Firefox:** ~65,000 characters. **Safari:** Generally has more restrictive limits (around 80,000 characters). **IE/Edge:** Historically limited to 2,083 characters (IE), although Edge has relaxed this limit."*
> — [nuqs, Max URL lengths](https://nuqs.dev/docs/limits#max-url-lengths)

> *"Additionally, transport mechanisms like social media, messaging apps, and emails may impose significantly lower limits on URL length. Long URLs may be truncated, wrapped, or rendered unusable when shared on these platforms."*
> — same section

> *"Keep in mind that not all application state should be stored in URLs. Exceeding the 2,000-character range may indicate the need to reconsider your state management approach."*
> — same section

The practical ceiling is therefore **not** the browser's limit; it is whatever a chat client will not mangle. Treat roughly 2,000 characters as the design budget — and note that the entire point of URL state is sharing, so a URL that survives Chrome and breaks in Slack has failed at its only job.

When the state is genuinely large — a 500-row selection, a saved report definition — persist it server-side and put the *id* in the URL:

```tsx
// ❌ ?ids=a1,a2,a3,…,a500
// ✅ ?selection=sel_9f2c   — rows stored server-side, id is 12 characters
```

That also shortens the cache key, removes the parse, and gives you a place to expire the thing.

## Canonicality: omit defaults, sort keys

Two URLs that mean the same thing should be the same URL. Otherwise you get duplicate cache entries ([03c](03c-caching-query-driven-routes.md)), duplicate analytics rows, and — if the page is indexable — duplicate content.

```ts filename="lib/build-query.ts"
const DEFAULTS = { status: 'open', sort: 'age', dir: 'desc', page: '1' } as const
const FROZEN = new Set(['from', 'to'])   // meaning must not shift under a bookmark

export function buildQuery(next: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === '') continue
    if (!FROZEN.has(key) && DEFAULTS[key as keyof typeof DEFAULTS] === value) continue
    params.set(key, value)
  }
  params.sort()                                   // stable key order
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
```

⚠️ **Omitting defaults has a cost worth stating.** If you later change a default, every old bookmark silently changes meaning, because the URL never recorded a value — it recorded "whatever the default is". `nuqs` documents exactly this tension and offers the opt-out:

> *"However, sometimes you might want to keep the search parameter in the URL, because **default values *can* change**, and the meaning of the URL along with it."*
> — [nuqs, Clear on default](https://nuqs.dev/docs/options#clear-on-default)

It also flipped its own default between major versions — `clearOnDefault` was `false` in v1 and is `true` in v2 — which is a fair indication that neither answer is obviously right. So: omit defaults for cosmetic parameters where a changed default is acceptable, and write them explicitly for anything whose meaning must be frozen at the moment the link was created.

## Gotchas

**★ Symptom: `?page=banana` throws a database error instead of showing page 1.** Cause: the value was coerced with `Number()` and `NaN` reached the query. Fix: coerce and bound in a schema, with a per-field fallback.

```ts
page: z.preprocess(first, z.coerce.number().int().min(1).max(500)).catch(1)
```

**★ Symptom: `?from=banana` produces rows from 1970, or none at all.** Cause: `new Date('banana')` is `Invalid Date` — an object, therefore truthy — so the guard `if (from)` passed. Fix: validate the string format; never construct a `Date` to test one.

```ts
from: z.preprocess(first, z.iso.date()).optional().catch(undefined)
```

**★ Symptom: one bad parameter blanks the whole page.** Cause: `safeParse` on the whole object, with a failure treated as "no filters at all". Fix: `.catch()` per field so a mangled `page` does not discard a valid `status`.

```ts
status: z.preprocess(first, z.enum(STATUSES)).catch('open'),
page:   z.preprocess(first, z.coerce.number().int().min(1)).catch(1),
```

**★ Symptom: a crafted URL with a 40 kB `q` value makes database CPU spike.** Cause: nothing bounded the free-text parameter, so an attacker chose its length. Fix: cap it in the schema, and cap array parameters too.

```ts
q: z.preprocess(first, z.string().trim().max(120)).catch('')
tags: /* … */ z.array(z.string().min(1).max(40)).max(20)
```

**★ Symptom: `?from=2026-12-01&to=2026-01-01` returns nothing and users report "the date filter is broken".** Cause: nothing checked the ordering, so the query asked for rows after December and before January. Fix: normalise rather than reject — a reversed range is almost always a mis-click.

```ts
.transform((v) => (v.from && v.to && v.from > v.to ? { ...v, from: v.to, to: v.from } : v))
```

**★ Symptom: one workspace's tasks are visible to another by editing the URL.** Cause: the parameter was *validated* — it was a well-formed string — and then used directly in the query. Fix: authorise against the session, as a separate check, after parsing.

```tsx
const session = await getSession()
if (!session.tenants.includes(tenant)) notFound()
```

**★ Symptom: two identical filter states produce two cache entries and two analytics rows.** Cause: the keys were written in different orders by two call sites. Fix: sort the params before serialising.

```ts
params.sort()
return `?${params.toString()}`
```

**★ Symptom: an old bookmark silently shows different data after a release.** Cause: a default was omitted from the URL and then changed, so the link recorded "the default" rather than a value. Fix: keep the value explicit for parameters whose meaning must be frozen.

```ts
if (!FROZEN.has(key) && DEFAULTS[key] === value) continue   // FROZEN params are always written
```

**★ Symptom: a "share this view" link works in the browser and breaks when pasted into a chat client.** Cause: the URL exceeded the *transport's* limit and was truncated or wrapped — not the browser's. Fix: move the payload server-side and share an id.

```ts
const id = await saveSelection(selectedIds)      // server-side
router.replace(`?selection=${id}`, { scroll: false })
```

**★ Symptom: the schema exists in three places — the page, the link builder and a client component — and they have drifted.** Cause: three call sites each parsed the URL their own way. Fix: one module exporting the schema, the inferred type and the serialiser, imported everywhere — which is precisely the shape a library like [03k](03k-nuqs-typed-search-params-as-a-library.md) sells.

**★ Symptom: `z.coerce.number()` accepts an empty string as `0`.** Cause: `Number('')` is `0`, and coercion runs before the numeric constraints. Fix: bound it, so the absurd value is caught by the range rather than by the coercion.

```ts
page: z.preprocess(first, z.coerce.number().int().min(1).max(500)).catch(1)
// '' -> 0 -> fails .min(1) -> .catch(1)
```

## Interview questions

**★ Why validate `searchParams` at all — are these not just your own links?**
No. A URL arrives from bookmarks, marketing campaigns, crawlers, browser autocomplete, a colleague's paste, and from people deliberately probing your app. It has the same trust level as a request body, and unlike a body it is trivially editable in the address bar by anyone looking at the page. Unvalidated, it reaches your database query as whatever the user typed: an out-of-range page number, a 40 kB search string that spikes CPU, an ordering column that is not a column, a date that is `Invalid Date` and therefore truthy. A schema at the page boundary converts all of that into either a valid value or a sane default, once, in one place.

**★ Why per-field `.catch()` rather than `safeParse` on the whole object?**
Because the desired failure behaviour for a URL is degradation, not rejection. A user who has hand-edited one parameter — or received a link from an older deploy — should still see a board, with the parameters that survived. `safeParse` on the object gives you one boolean for the whole query string, and the natural implementation of "it failed" is to drop every filter, which is a worse page than the one they asked for. Field-level `catch` keeps the valid parts and repairs the invalid ones. The opposite bias is right for a request body, where a partially valid mutation is usually more dangerous than a rejected one.

**★ What is the difference between validating a query parameter and authorising it, and why does the distinction matter here specifically?**
Validation proves a value is well-formed; authorisation proves the requester is entitled to it. They feel like the same check because both reject bad input, and a schema that passes a tenant id gives a false sense of completion. But `?tenant=acme` is a perfectly valid string for a user who has never had access to Acme. Anything in a URL that identifies a subject — tenant, owner, organisation, another user's id — has to be checked against the session on the server after parsing. The stronger design rule is not to put identity in the URL at all: derive the viewer from the session and let the query string carry only view preferences, which removes the class of bug rather than guarding each instance.

**★ How long can a URL be, in practice?**
The browser limits are large and largely irrelevant — roughly 2 MB in Chrome, 65,000 characters in Firefox, around 80,000 in Safari, with older IE at 2,083. The real ceiling is the transport: messaging apps, email clients and social platforms truncate, wrap or linkify long URLs, and the entire point of URL state is that a link can be shared. Treat about 2,000 characters as the design budget, and read anything approaching it as a signal that this state does not belong in the URL. The escape is to persist the payload server-side and put a short id in the query string, which also shortens the cache key, removes the parse, and gives the state somewhere to expire.

**★ Should a parameter be omitted from the URL when it equals its default?**
It makes URLs shorter, canonical and easier to cache, so yes for most parameters — and canonicality is worth real money in cache hit rate and analytics cleanliness. The cost is that an omitted value is not recorded, so if you later change the default, every existing bookmark silently changes meaning. Keep the value explicit for any parameter whose semantics must be frozen at the moment the link was created — a report's date range, an audit filter someone pasted into a ticket — and omit the cosmetic ones. `nuqs` makes this exact trade an option and flipped its own default between major versions, which is a fair indication that neither answer is universally right.

**★ When should a bad parameter be repaired and when should it be rejected?**
Repair what a confused human would plausibly produce; reject what only a probe would produce. A reversed date range, a page number past the end of the dataset, a search string with leading whitespace — all of these come from real users doing normal things, and silently normalising them produces the page they meant. A `sort` value that is not a column, an enum value that has never existed, a numeric field containing a word — these are either an attack or a stale link, and the right response is the documented default rather than an attempt to guess. The dividing line is not severity; it is whether a sensible repair exists at all.

**★ Why put the parse in one module rather than in the page?**
Because at least three consumers need the same answer: the Server Component building the database query, the link builder producing the next URL, and any client component reasoning about the current state. If each parses independently they drift — different coercions, different defaults, different handling of a repeated key — and the bug appears as "the URL from the filter bar works but the one in my bookmark does not". One module exporting the schema, the inferred type and the serialiser makes the URL format a single definition. That is also the strongest argument for adopting a dedicated library, whose entire value proposition is exactly that shared definition.

---

← [03i · Encoding and parsing query state](03i-url-as-state-encoding-and-parsing.md) · [Chapter 8 overview](01-explanation.md) · Next → [03k · nuqs — typed search params as a library](03k-nuqs-typed-search-params-as-a-library.md)
