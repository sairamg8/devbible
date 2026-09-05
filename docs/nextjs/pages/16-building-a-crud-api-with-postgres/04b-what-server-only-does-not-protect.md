---
title: "`server-only` guards exactly one edge — a module specifier entering the client graph — and a Route Handler is not on the far side of that edge, so the pill that everybody reaches for to enforce the Data Access Layer cannot enforce it at all"
sidebar_label: "04b · What it does not protect"
sidebar_position: 14
description: "The one edge the poison pill guards drawn precisely, why it is silent about a Route Handler importing the driver, the four leaks it is structurally incapable of catching applied to the cards API, and the checks that actually cover each one including the build step your test suite is not."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Preventing client-side execution of server-only code*, § *Auditing*) and [Next.js · Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — both `version: 16.3.4`. Builds on [ch3 · 05b](../03-server-components-vs-client-components/05b-what-server-only-does-not-protect.md), which derives the same limits from the compiler's specifier lists.
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no penetration testing performed**; **no timings**. The leaks below are derived from the documented transport, not observed.

**[04](04-the-data-access-layer.md) put `import 'server-only'` at the top of every DAL module and called it enforcement. That is true of exactly one thing and false of the thing this chapter most needs. The pill causes a build error when a module specifier enters the *client* graph. A Route Handler is server code — it is not in the client graph, it never will be, and `import 'server-only'` in `lib/dal/db.ts` has no opinion whatsoever about `app/api/cards/[cardId]/route.ts` importing it and running its own query. The mechanism that stops that is a lint rule, and conflating the two is how a codebase ends up believing it has an invariant it does not have.**

## The one edge, drawn precisely

> *"This ensures that proprietary code or internal business logic stays on the server by causing a build error if the module is imported in the client environment."*
> — [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security)

*In the client environment.* That is the whole scope.

| Edge | Guarded by `server-only`? | What actually guards it |
|---|---|---|
| A DAL module compiled into the client bundle | ✅ build error | the compiler's specifier list |
| **A Route Handler importing the driver directly** | ❌ | `no-restricted-imports` in ESLint |
| **A Server Action bypassing the DAL and querying** | ❌ | the same lint rule |
| A card row serialized into the RSC payload as a prop | ❌ | projecting at the boundary ([04d](04d-projections-not-rows.md)) |
| A module that reads a secret and has no pill | ❌ | one poisoned `lib/env.ts` that throws on a missing variable |
| A Server Action's return value | ❌ | an explicit projection, never a row |
| Who may invoke a Server Action | ❌ | the ownership predicate inside the DAL ([04c](04c-the-ownership-predicate.md)) |
| The same code under Vitest, `tsc` or `next lint` | ❌ | `next build` as a required check |

The two bold rows are the ones this chapter cares about most, and they are the two people most often believe the pill covers.

## 1 · The server-to-server edge, which is not an edge at all

```ts
// app/api/cards/[cardId]/route.ts
// 🔴 Compiles. Builds. Deploys. Passes every check that mentions `server-only`.
import { db } from '@/lib/dal/db'
import { cards } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  const rows = await db.select().from(cards).where(eq(cards.id, cardId))
  return Response.json(rows[0] ?? null)
}
```

`lib/dal/db.ts` has `import 'server-only'` at the top. It is doing its job perfectly: nothing here is in the client graph. And the handler has just returned a card to anyone who knows its id, with `deleted_at` and every other internal column attached, with no membership check anywhere.

**The pill was never going to catch this.** The rule "only the DAL touches the driver" is a rule about which *server* module may import which other *server* module, and Next.js has no opinion about that. The tool that does is the lint boundary from [04](04-the-data-access-layer.md):

```jsonc
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [
        { "name": "pg", "message": "Import from @/lib/dal/* — the DAL owns the pool." },
        { "name": "drizzle-orm", "message": "Import from @/lib/dal/* — the DAL owns the queries." },
        { "name": "drizzle-orm/node-postgres", "message": "Import from @/lib/dal/* — the DAL owns the client." }
      ],
      "patterns": ["@/lib/dal/db", "@/db/schema"]
    }]
  }
}
```

with the rule disabled inside `lib/dal/` itself via an override. Two things about that configuration are deliberate:

- **`@/db/schema` is in the pattern list.** Importing the table definitions is the first move of writing a query outside the DAL, and it is the one a reviewer waves through because it looks like a type import.
- **The messages name the replacement.** A lint error that says "do not do this" makes people disable the rule; one that says where to go instead does not.

🔴 **A lint rule is weaker than a compiler error and it is what is available.** Anyone can add an `eslint-disable` comment. The difference from a convention is that the disable comment is visible in the diff, greppable across the repository, and has to be written deliberately — which is the whole of what enforcement means here. Do not describe it as equivalent to `server-only`; describe it as the thing that covers the edge `server-only` cannot see.

## 2 · A card row passed as a prop

The pill is on the *module*. The *value* is free to travel, and props travel by definition — the RSC payload carries the props a Server Component passes to a Client Component, and the payload goes to the browser.

```tsx
// app/boards/[boardId]/page.tsx — a Server Component. No error anywhere in this file.
import 'server-only'
import { listBoardCards } from '@/lib/dal/cards'
import { CardColumn } from './card-column'   // 'use client'

export default async function Page({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const cards = await listBoardCards(boardId)
  // 🔴 If listBoardCards returns rows, `deletedAt` and anything added by a future
  // migration is now in the RSC payload, readable in the network tab.
  return <CardColumn cards={cards} />
}
```

`server-only` is satisfied — `lib/dal/cards` never entered the client graph. The data left anyway, in the response body. The fix is that the DAL returns a projection rather than a row, which is [04d](04d-projections-not-rows.md), and it is a fix in the DAL rather than in the page precisely so that no page can get it wrong.

⚠️ **This is not a "view source" problem you can rate as low severity.** The payload is fetched again on client-side navigation, cached, and readable by any browser extension with host permissions.

## 3 · The module nobody poisoned

Coverage is opt-in per module, so the file you forgot is the one that leaks. A `lib/reports.ts` that reads `process.env.ANALYTICS_KEY` and carries no pill is unprotected, and the failure is silent — Next.js substitutes an **empty string** for an unprefixed environment variable read in client code rather than leaving it `undefined`, so nothing throws and a request simply goes out with an empty header.

The countermeasure is architectural rather than per-file: **exactly one module reads `process.env`**, it is poisoned, and it throws on a missing variable. That is `lib/env.ts` from [03b](03b-the-arithmetic-and-the-three-escapes.md), and the `required()` throw is doing work independent of the pill — it converts the empty-string substitution into a loud failure in the cases the compiler never sees.

A cheap CI check closes the per-module gap for the DAL itself:

```bash
# Every file under lib/dal must carry the pill. Prints offenders; exits non-zero if any.
! grep -L "^import 'server-only'" lib/dal/*.ts | grep .
```

## 4 · Who may call the Server Action

The row with the worst consequences, and the one the pill is furthest from covering. A Server Action is a **network endpoint**: the client holds a reference, the runtime encodes it into the payload, and invoking it is an HTTP request. Being unable to *import* the module says nothing about being unable to *call* the function.

```ts
// app/boards/[boardId]/actions.ts
'use server'
import 'server-only'
import { db } from '@/lib/dal/db'
import { cards } from '@/db/schema'
import { eq } from 'drizzle-orm'

// 🔴 Any signed-in user can delete any card by id. The pill is present and irrelevant.
export async function deleteCardAction(cardId: string) {
  await db.delete(cards).where(eq(cards.id, cardId))
}
```

The board page only renders the delete button for members. That changes what is rendered, not what is reachable. The correct version delegates to the DAL, whose predicate is part of the statement:

```ts
'use server'
import 'server-only'
import { revalidateTag } from 'next/cache'
import { deleteCard } from '@/lib/dal/cards'

export async function deleteCardAction(cardId: string, boardId: string) {
  await deleteCard(cardId)            // membership is in the WHERE clause — 04c
  revalidateTag(`board:${boardId}`)
}
```

The audit checklist asks exactly these questions, and each is a question about the action rather than about the pill:

> *"**`"use server"` files:** Are the Action arguments validated in the action or inside the Data Access Layer? Is the user re-authorized inside the action? Does the action check ownership of the resource (authorization, not just authentication)? Are return values filtered to only what the client needs? Is database access delegated to a `server-only` Data Access Layer?"*

> *"**`proxy.ts` and `route.ts`:** Have a lot of power. Spend extra time auditing these using traditional techniques."*
> — [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security)

That second quote is the documentation acknowledging the gap in this page's opening paragraph: route files get "extra time… using traditional techniques" because no compiler check covers them.

## 5 · Anything that is not `next build`

The check runs in the SWC transform during `next dev` and `next build`, and nowhere else. Three consequences that matter to a CI configuration:

- **Your test suite does not enforce it.** A Vitest or Jest run importing modules directly applies no such transform, so a poisoned module imports happily in a test. A green suite is not evidence the boundary holds.
- **`tsc` does not enforce it.** It type-checks the import; it has no concept of a client graph.
- **`next lint` does not enforce it.** This is a compiler diagnostic, not an ESLint rule, so a lint-only job passes a build that would fail.

**Therefore `next build` is the only step that verifies the server/client split, and it belongs on the pull request rather than at deploy time.** Note the asymmetry that makes this topic awkward: the client-graph edge is checked by `next build` and not by lint, while the server-to-server edge is checked by lint and not by `next build`. Neither tool covers both, so a pipeline that runs only one of them has an uncovered edge either way.

## Gotchas

**★ Symptom: a Route Handler queries the database directly, every module has `server-only`, and no check fires.** Cause: `server-only` guards the client graph and a Route Handler is server code, so there is no edge to guard. Fix: `no-restricted-imports` covering `pg`, `drizzle-orm` and `@/db/schema`, with an override inside `lib/dal/`. Do not expect the pill to do this; it structurally cannot.

**★ Symptom: an internal column appears in the browser's network tab and every server module is poisoned.** Cause: the value rode the RSC payload as a prop. `server-only` constrains modules, not values. Fix: the DAL returns a projection, so the page has no row to leak ([04d](04d-projections-not-rows.md)).

**★ Symptom: a field nobody exposed becomes visible after an unrelated migration.** Cause: a DAL function returns the whole row, so adding a column widens every response carrying it — a leak introduced by a migration, in a file nobody edited. Fix: enumerate columns at every boundary and treat "returns the model" as a review failure.

**★ Symptom: a user deletes a card they do not own, and the audit log shows a legitimate session.** Cause: the Server Action trusted its argument because the button is only rendered for members. Rendering is not a control. Fix: the ownership predicate inside the statement, in the DAL, so the delete affects zero rows for a non-member.

**★ Symptom: a secret reached the browser with no build error anywhere.** Cause: the module that read it never imported `server-only`; coverage is opt-in and the gap is where nobody was thinking. Fix: one poisoned `lib/env.ts` that throws on a missing variable, plus the CI grep that fails when any DAL file lacks the pill.

**★ Symptom: the pill is in place, the tests pass, and production leaked anyway.** Cause: the check lives in the Next.js compiler and Vitest, `tsc` and `next lint` all bypass it. Fix: make `next build` a required check on the pull request rather than a deploy-time step.

**★ Symptom: `server-only` was removed from a DAL module because a test could not import it.** Cause: the test was importing the module through a bundler configured with the client conditions. Fix: fix the test configuration, not the module. Removing the pill to make a test pass removes the only compile-time guarantee in the whole design, in exchange for a test that was already running in the wrong environment.

**★ Symptom: someone adds `eslint-disable-next-line no-restricted-imports` to a route file and it merges.** Cause: the lint boundary is weaker than a compiler error and always will be. Fix: make the disable comment itself reviewable — a periodic `grep -rn 'no-restricted-imports' app/` is a two-second check that finds every place the invariant was consciously suspended, which is exactly the list you want.

**★ Symptom: the team believes `server-only` enforces the DAL and stops looking for other gaps.** Cause: a module-topology lint filed mentally under "security". Fix: the table at the top of this page, kept somewhere people read. The pill guards one edge extremely well, and knowing which edge is the difference between a design and a comfortable assumption.

## Interview questions

**★ What exactly does `import 'server-only'` guarantee?**
That the module will not be compiled into the client bundle — a **build error** if it ever ends up in the client graph, which is a compile-time statement about the transitive import graph. That is stronger than any convention, because it catches the case nobody reviews: a helper imported by another helper imported by a Client Component four levels down. What it says nothing about is values, callers, or which *server* module imports which other server module. So it is a topology check that people file under security, and the misfiling is how the leaks get through.

**★ Why can `server-only` not enforce that only the DAL touches the driver?**
Because both sides of that boundary are server code. The pill fires when a specifier enters the client environment, and a Route Handler never does — it is compiled for the server, runs on the server, and is exactly as entitled to import `pg` as your DAL is, as far as the compiler is concerned. So the rule "only `lib/dal` may import the driver" is a rule Next.js has no mechanism to express, and the tool that can express it is a lint rule with an override for the DAL directory. That is a genuinely weaker guarantee — anyone can write a disable comment — but the disable comment appears in the diff and is greppable, which is the practical definition of enforcement here.

**★ Which of your CI steps actually checks the server/client boundary?**
Only `next build`. The check is a compiler diagnostic in the SWC transform, so Vitest and Jest bypass it entirely — they import the module directly and nothing objects — `tsc` has no notion of a client graph, and `next lint` is a different tool answering different questions. That produces an unpleasant asymmetry: the client-graph edge is covered by the build and not by lint, and the server-to-server edge is covered by lint and not by the build. A pipeline running only one of them has an uncovered edge, and which edge depends on which one you kept.

**★ Give an example of a leak that satisfies every rule in this design and still ships data to the browser.**
A Server Component calls a DAL function that returns rows and passes the result straight to a Client Component. Every module is poisoned, nothing is in the client graph, the lint boundary is satisfied, and the whole row — including `deletedAt` and whatever the last migration added — is serialized into the RSC payload and readable in the network tab. The pill constrains modules; props are values, and values travel by definition. The fix belongs in the DAL rather than in the page, because a fix in the page has to be repeated in every page, which is the same arithmetic argument that produced the DAL in the first place.

**★ Why is "the button is only shown to members" not an authorization control?**
Because it governs rendering, and a Server Action is a network endpoint. The client holds a reference to the action, the runtime encodes it into the payload, and invoking it is an HTTP request that anyone who can construct it may send — with any arguments they like. So the security of the mutation would depend on the attacker choosing to use your UI, which is not a property you can rely on. The documented audit questions ask this directly: *"Is the user re-authorized inside the action? Does the action check ownership of the resource?"* Both are questions about the action, not about what was rendered, and the answer to both is that the check lives in the DAL where every entry point inherits it.

**★ How would you audit this codebase for the gaps `server-only` leaves?**
Four commands and one review habit. `grep -L "^import 'server-only'" lib/dal/*.ts` finds DAL modules missing the pill. A `no-restricted-imports` run finds server modules reaching the driver, and `grep -rn 'no-restricted-imports' app/` finds every place someone consciously suspended it. A grep for `process.env` outside `lib/env.ts` covers the secret-reads rule the documentation states. And the review habit is the one thing no command covers: every place a DAL result crosses into a Client Component prop or an action return value, check that it is a projection and not a row — because that leak is introduced by migrations rather than by edits, so nobody is looking at the file when it happens.

---

← [04 · The Data Access Layer](04-the-data-access-layer.md) · [Chapter 16 overview](01-explanation.md) · Next → [04c · The ownership predicate](04c-the-ownership-predicate.md)
