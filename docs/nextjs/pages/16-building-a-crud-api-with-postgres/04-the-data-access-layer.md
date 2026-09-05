---
title: "The Data Access Layer is the decision that the number of places a rule lives stops depending on the number of entry points — so a Route Handler that imports the driver has not saved a layer, it has created a second copy of every rule that will drift from the first"
sidebar_label: "04 · The Data Access Layer"
sidebar_position: 13
description: "The three documented obligations, the cards DAL laid out module by module, server-only and the lint boundary that turns a convention into an import error, the error vocabulary the transports map, what the DAL must never know about, and why the split is the same one that makes mutations testable."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Data Access Layer*, § *Using a Data Access Layer for mutations*, § *Preventing client-side execution of server-only code*, § *Auditing*) — `version: 16.3.4` — and [Drizzle · Get started with PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql).
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**Chapter 15 argued the pattern. This topic builds it for one resource and then spends four chunks on the ways it fails, because a Data Access Layer that exists as a folder is not the same object as one that exists as an invariant. The property that matters is arithmetic: without a DAL, the number of places the ownership rule lives is the number of entry points, and entry points multiply — a Server Action for the board UI, a Route Handler for the API, later a queue consumer and a cron job. With a DAL it is one, permanently. Everything else on this page is in service of making "one" enforceable rather than aspirational.**

## The three obligations

Not a style guide — the documented definition, and each bullet is load-bearing:

> *"For new projects, we recommend creating a dedicated **Data Access Layer (DAL)**. This is an internal library that controls how and when data is fetched, and what gets passed to your render context."*

> *"A Data Access Layer should:"*
> *"* Only run on the server.
> * Perform authorization checks.
> * Return safe, minimal **Data Transfer Objects (DTOs)**."*

> *"This approach centralizes all data access logic, making it easier to enforce consistent data access and reduces the risk of authorization bugs. You also get the benefit of sharing an in-memory cache across different parts of a request."*
> — [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security)

A folder of query helpers satisfies none of the three: it can be imported from a Client Component, it trusts whatever id it is handed, and it returns whatever the ORM returned. Those three failures are [04b](04b-what-server-only-does-not-protect.md), [04c](04c-the-ownership-predicate.md) and [04d](04d-projections-not-rows.md) respectively, which is why this topic has five chunks rather than one.

## The layout

```text
lib/
├─ env.ts              'server-only'  the ONLY reader of process.env
└─ dal/
   ├─ db.ts            'server-only'  the ONLY constructor of a Pool / drizzle instance
   ├─ errors.ts        'server-only'  the vocabulary the transports map onto status codes
   ├─ pg-errors.ts     'server-only'  SQLSTATE → that vocabulary  (02b)
   ├─ session.ts       'server-only'  the ONLY caller of auth()
   ├─ access.ts        'server-only'  the ownership predicate     (04c)
   └─ cards.ts         'server-only'  one exported function per use case (04e)

app/
├─ api/boards/[boardId]/cards/route.ts    imports lib/dal/cards + lib/dal/errors
├─ api/cards/[cardId]/route.ts            imports lib/dal/cards + lib/dal/errors
└─ boards/[boardId]/actions.ts            'use server' — imports lib/dal/cards
```

Read the "ONLY" comments as the actual specification. Each of them is a claim that can be checked with a command rather than a review, which is the difference between an invariant and a preference.

## `server-only` is a build error, not a runtime check

> *"To prevent server-only code from being executed on the client, you can mark a module with the `server-only` package"*

> *"This ensures that proprietary code or internal business logic stays on the server by causing a build error if the module is imported in the client environment."*

> *"Next.js handles `server-only` imports internally. The contents of these packages from NPM are not used. However, if your linting rules flag extraneous dependencies, you may install them to avoid issues."*
> — [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security)

Two things to carry from that. It is a **compile-time** guarantee about the transitive import graph, which is why it catches the case nobody reviews — a `lib/` helper imported by another helper imported by a Client Component four levels down. And the npm package is a formality: Next.js resolves the import itself, so installing it only keeps linters quiet.

It also composes with `'use server'` rather than conflicting with it, which is the question everyone asks on first contact:

> *"**Good to know:** You can use `import 'server-only'` in both the Data Access Layer and the `"use server"` file itself. Both work when the action is imported into a Client Component (for example, to pass it to `useActionState`), because `"use server"` modules are resolved in a server-only webpack layer."*

What `server-only` does **not** do is the subject of [04b](04b-what-server-only-does-not-protect.md), and skipping that chunk is how people end up filing a module-topology lint under "security".

## Only the DAL reads `process.env`

> *"**Good to know:** Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`. This keeps secrets from being exposed to other parts of the application."*

and the audit question that makes it mechanical:

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*

That is the whole value of the rule: it converts a judgement into a grep. `lib/env.ts` from [03b](03b-the-arithmetic-and-the-three-escapes.md) is the single door, and once it exists, "is a secret read somewhere it might leak?" is a command over one directory.

## Making it an invariant, not a convention

A convention degrades with team size. An import error does not.

```jsonc
// eslint.config — nothing outside lib/dal may reach the driver or the client module
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [
        { "name": "pg", "message": "Import from @/lib/dal/* — the DAL owns the pool." },
        { "name": "drizzle-orm/node-postgres", "message": "Import from @/lib/dal/* — the DAL owns the client." },
        { "name": "@neondatabase/serverless", "message": "Import from @/lib/dal/* — the DAL owns the transport." }
      ],
      "patterns": ["@/lib/dal/db", "@/db/schema"]
    }]
  }
}
```

With that in place, writing a query in a route file is a lint failure rather than a review comment. `@/db/schema` is in the pattern list deliberately: importing the table definitions outside the DAL is the first step of writing a query outside the DAL, and it is the one a reviewer is least likely to object to.

🔴 **A DAL introduced as a convention is a coin flip on every new file.** The entire benefit — one rule, one place, regardless of how many doors — depends on there being no alternative route to the database. If there is one, the arithmetic that justified the layer no longer holds.

## The error vocabulary

The DAL cannot return a status code, because it does not know it is being called over HTTP. What it can do is throw from a small, closed set that every transport knows how to translate.

```ts
// lib/dal/errors.ts
import 'server-only'

/** No usable credential. → 401 */
export class Unauthorized extends Error {}

/** The resource does not exist, OR the caller may not see it. Deliberately one class. → 404 */
export class NotFound extends Error {}

/** Parsed fine, a domain rule said no. → 422 */
export class DomainInvalid extends Error {}

/** The current state of the resource makes this impossible. → 409 */
export class Conflict extends Error {}

/** A precondition stated in a REQUEST HEADER was false — If-Match. → 412 */
/** A version passed as an argument or a body field that no longer matches is a `Conflict`. → 409 */
export class VersionConflict extends Error {}

/** Transient. The DAL retries; if it reaches a transport, something is wrong. */
export class Retryable extends Error {}
```

⚠️ **This is the DAL's *local* vocabulary, and it is not the shape that goes on the wire.** The chapter defines exactly one response envelope and it belongs to [10 · Errors and one response shape](10-errors-and-one-response-shape.md), which supersedes both this class list and the `DomainError` carrier introduced in [05ca](05ca-mapping-sqlstate-to-status-codes.md). The progression is deliberate rather than three competing designs — this page needs a way to *name* failures before the reader has met the envelope, and topic 05 needs one to carry a SQLSTATE translation. Topic 10 then unifies all of them into `ApiFailure`, and its argument for doing so is the reason to prefer it: a class that carries `status: 409` has already decided HTTP is its only caller, which is exactly what a Server Action cannot use. 🔴 **In real code, define the envelope once, topic 10's way.** These classes are how the idea is introduced, not a second design to maintain.

**`NotFound` covers two situations on purpose** — the card is gone, and the card is not yours. That collapse is the disclosure decision from [01b](01b-the-six-routes-and-the-codes-they-commit-to.md), and putting it in the type means no transport can un-collapse it even if the author wanted to.

The Route Handler adds status codes and nothing else:

```ts
// app/api/cards/[cardId]/route.ts
import { Unauthorized, NotFound, DomainInvalid, Conflict, VersionConflict } from '@/lib/dal/errors'
import { readCard, deleteCard } from '@/lib/dal/cards'

const CODE_FOR = new Map<Function, number>([
  [Unauthorized, 401],
  [NotFound, 404],
  [DomainInvalid, 422],
  [Conflict, 409],
  [VersionConflict, 412],
])

function toResponse(reason: unknown): Response {
  const status = CODE_FOR.get((reason as object)?.constructor) ?? 500
  if (status === 500) console.error('cards route failed', reason)
  return new Response(null, { status })   // body: the error envelope, topic 10
}

export async function GET(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  try {
    return Response.json(await readCard(cardId), { status: 200 })
  } catch (reason) {
    return toResponse(reason)
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  try {
    await deleteCard(cardId)
    return new Response(null, { status: 204 })
  } catch (reason) {
    return toResponse(reason)
  }
}
```

And the Server Action adds cache invalidation and nothing else:

```ts
// app/boards/[boardId]/actions.ts
'use server'
import 'server-only'
import { revalidateTag } from 'next/cache'
import { deleteCard } from '@/lib/dal/cards'

export async function deleteCardAction(cardId: string, boardId: string) {
  await deleteCard(cardId)      // the only place the rule lives
  revalidateTag(`board:${boardId}`)   // the only thing this transport adds
}
```

**Neither door contains a rule.** Adding a third — a queue consumer, a cron job, a GraphQL resolver — adds no new copy of anything.

## What the DAL must never know about

The line is drawn at *transport knowledge*, and it is worth being explicit because the leaks are all one-line conveniences.

| Not in the DAL | Why |
|---|---|
| `Request`, `Response`, status codes | It does not know it is being called over HTTP; a cron job has no response |
| `revalidateTag`, `revalidatePath`, `next/cache` | Router cache invalidation is the *entry point's* concern; a worker has no router |
| `redirect()`, `notFound()` from `next/navigation` | They throw framework control-flow signals a Route Handler cannot use as intended |
| `cookies()` for anything except deriving identity | Reading a request-shaped preference in the DAL couples it to a browser |
| Field-level formatting for a UI | The DAL returns data; a locale is a presentation concern |

⚠️ **`notFound()` is the tempting one**, because [ch10's DAL](../10-forms-authentication-and-security-hardening/06f-milestone-authorization-on-the-board.md) uses it — correctly, because that DAL serves pages, where `notFound()` renders the not-found UI. In a DAL that also serves a JSON API it is wrong: a Route Handler catching a framework navigation signal and turning it into a `404` body is fighting the framework. Throw `NotFound` from your own vocabulary and let each transport decide what that means.

## The testability argument, which is the same argument

A Server Action does not exist as a callable function at runtime in the way a test wants — it compiles into a reference, and exercising it end to end means driving a browser or synthesising a POST the origin check will reject. A Route Handler is testable only through a `Request`/`Response` round trip. **A DAL function is a plain async function: import it, seed a session, call it, assert.**

So the proportion of your logic that lives in the DAL is directly the proportion of your test suite that can be fast and framework-free. If mutations are hard to test, the logic is in the wrong layer — and the fix is exactly the one security wanted. That is not a coincidence; both properties come from the same fact, that a thin entry point has nothing in it worth testing.

## Gotchas

**★ Symptom: a fix applied to the Server Action left the same bug live in the API.** Cause: the rule was in the door rather than in the room. Fix: move it into the DAL and reduce both entry points to translation — the action adds `revalidateTag`, the handler adds status codes.

**★ Symptom: the DAL exists and half the codebase still queries the database directly.** Cause: it was introduced as a convention, so every new file is a coin flip. Fix: remove the alternative. One `server-only` module constructs the client and does not re-export it, and `no-restricted-imports` makes a direct import of `pg` or of `@/db/schema` a lint error.

**★ Symptom: a Route Handler over the DAL returns `500` for a permission failure and monitoring pages someone.** Cause: the DAL threw a domain error the handler had no mapping for. Fix: the closed error vocabulary above plus the `CODE_FOR` map, with `?? 500` reserved for genuinely unknown failures — and only that branch logging.

**★ Symptom: the action grew a second authorization check "to be safe" and the two now disagree.** Cause: defence in depth applied to the wrong axis. Duplicating a decision is not depth; it is two decisions that will diverge. Fix: exactly one authorization site per operation, in the DAL, with the entry points translating its failure.

**★ Symptom: `revalidateTag` was called from inside a DAL function and a queue consumer started throwing.** Cause: cache invalidation leaked downward, and a worker has no router to invalidate. Fix: keep `next/cache` out of the DAL entirely. If you find yourself wanting to invalidate from inside it, the real requirement is a domain event that each entry point reacts to in its own way.

**★ Symptom: a Client Component import of a DAL module compiled fine and shipped a driver to the browser.** Cause: `import 'server-only'` was missing from that one module. Coverage is opt-in per file, and the file you forgot is the one that leaks. Fix: the pill on every module under `lib/dal/`, and a check in CI that every file in that directory has it.

**★ Symptom: the linter flags `server-only` as an extraneous dependency.** Cause: Next.js resolves the import internally and *"the contents of these packages from NPM are not used"*, so it is not in `package.json`. Fix: install it — the documentation explicitly sanctions doing so *"to avoid issues"* with lint rules.

**★ Symptom: unit-testing a mutation requires spinning up Next.js.** Cause: the logic is in the action, which only exists as a compiled reference. Fix: the DAL function is a plain async function — import it in a test directly, with no framework. Difficulty testing a mutation is a reliable signal that the split is wrong.

**★ Symptom: two DAL functions were merged into one that takes an `options` object, and the ownership check now depends on a flag.** Cause: generalisation applied to the layer whose value is being specific. Fix: one exported function per use case, argued in [04e](04e-function-per-use-case.md) — the moment a caller can pass a flag that changes what the query filters on, the caller is back in control of the rule.

**★ Symptom: a `process.env` read appeared in a component and nobody noticed for months.** Cause: no invariant to violate. Fix: adopt the documented rule — *"only the Data Access Layer should access `process.env`"* — enforce it with `no-restricted-properties` or a grep in CI, and route every secret through `lib/env.ts`.

**★ Symptom: a `cache()`-wrapped DAL function runs twice in one request and the session is read twice.** Cause: one call site sits inside a `use cache` scope and one outside — *"[`React.cache`] operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."* Fix: choose a side. Read the value outside and pass it into the cached function as an argument, where it also becomes part of the cache key. And write every DAL function so that running twice is correct, because the memoisation is an optimisation and never a guarantee.

**★ Symptom: a DAL module imports something from `app/`.** Cause: a type or a helper that happened to live next to a route. Fix: invert it — the DAL is the bottom layer and must not depend on the entry points, or the "call it from a worker" property that justified the split stops being true. If a type is shared, it belongs in `contracts/` where both can import it and neither owns it.

**★ Symptom: the entry points are thin, the DAL is one 900-line file, and merges conflict constantly.** Cause: thin doors were achieved and the room was never partitioned. Fix: one module per resource under `lib/dal/`, with the shared pieces — session, access, errors, projections — as their own modules, exactly as the layout at the top of this page shows. The invariant is about *which* modules may reach the driver, not about there being only one of them.

## Interview questions

**★ What makes a module a Data Access Layer rather than a folder of query helpers?**
Three properties, and all three have to hold. It runs only on the server, enforced at build time with `import 'server-only'` rather than by convention. It performs the authorization check itself, deriving identity from the request envelope instead of accepting it as a parameter. And it returns minimal DTOs shaped for the caller, not database rows. A folder of query helpers has none of those: it is importable from a Client Component, it trusts whatever id it is handed, and it hands back whatever the ORM returned. The distinction matters because only the first version makes the number of places a rule lives independent of the number of entry points, which is the entire reason the layer exists.

**★ Why does a Route Handler that imports the driver directly not save you a layer?**
Because the layer is not code, it is the guarantee that there is one copy of the rule. A handler that queries directly has to carry authentication, the ownership predicate, the projection and the error translation itself — so you have not removed a layer, you have inlined it into one door. The moment a second door exists, and one always does, that inlined copy must be reproduced, and copies drift: one gets tightened during an incident and the other is discovered by a pentest a year later. The measurable version of this is the audit question the documentation actually asks — *"Is database access delegated to a `server-only` Data Access Layer?"* — which is a question about topology precisely because topology is what you can check.

**★ Can a `'use server'` file also be `server-only`, given a Client Component imports it?**
Yes, and the documentation says so explicitly: *"You can use `import 'server-only'` in both the Data Access Layer and the `"use server"` file itself. Both work when the action is imported into a Client Component… because `"use server"` modules are resolved in a server-only webpack layer."* The apparent contradiction dissolves once you remember what the client-side import compiles into — not a module import at all, but an action reference: an identifier plus a dispatcher. The module body never enters the client graph, so the poison pill has nothing to object to.

**★ Why should `revalidateTag` never appear inside the DAL?**
Because it is transport knowledge. It exists because a React router is holding a cached tree, and a DAL function called from a queue consumer, a cron job or a test has no such router — so the call is at best a no-op and at worst an error in exactly the contexts you added the layer to support. Keeping `next/cache` in the entry points means the DAL stays a plain async module you can call from anywhere, and it keeps the split honest: each door contributes what its own transport needs, and only that. The corollary is that if a DAL function seems to need invalidation, the real requirement is a domain event, and each entry point should react to it in its own way.

**★ How do you make the DAL an invariant rather than a convention?**
By removing the alternative. Construct the database client in exactly one `server-only` module, do not re-export it, and add a lint rule forbidding imports of the driver package, of that module and of the schema from anywhere outside the DAL directory. Do the same for `process.env`, which the documentation restricts to the DAL. At that point writing a query in a component is an import error rather than a review comment, and the audit instruction — *"verify that database packages and environment variables are not imported outside the Data Access Layer"* — becomes a command in CI rather than somebody's afternoon. The schema import is worth including specifically, because importing the table definitions is the first step of writing a query outside the layer and the one a reviewer is least likely to challenge.

**★ Why is the error vocabulary a closed set of classes rather than strings or codes?**
Because a closed set is exhaustively mappable and a string is not. With classes, the transport's translation is a lookup keyed on the constructor, so adding a new failure mode without a mapping falls into the `?? 500` branch — visible, logged, and obviously wrong. With strings you get silent near-misses: `'Forbidden'` in one place and `'forbidden'` in another, matching nowhere. It also encodes decisions in the type system rather than in prose: there is one `NotFound` class covering both "gone" and "not yours" precisely so that no transport can distinguish them, which is the disclosure rule from the contract made structural rather than remembered.

**★ What does the DAL split do to your test suite?**
It moves the majority of the logic into plain async functions, which are the only thing in this stack that is cheap to test. A Server Action is compiled into a reference and does not exist as a callable in the way a test wants; a Route Handler is testable only through a `Request`/`Response` round trip; a DAL function is import, seed, call, assert, with no framework at all. So the ratio of logic in the DAL to logic in the entry points is directly the ratio of your suite that runs fast. The useful diagnostic is the reverse direction: if a mutation is hard to test, the logic is in the wrong layer, and the fix is the same one the security argument was asking for.

---

← [03d · What the pooler removes](03d-what-does-not-survive-the-pooler.md) · [Chapter 16 overview](01-explanation.md) · Next → [04b · What `server-only` does not protect](04b-what-server-only-does-not-protect.md)
