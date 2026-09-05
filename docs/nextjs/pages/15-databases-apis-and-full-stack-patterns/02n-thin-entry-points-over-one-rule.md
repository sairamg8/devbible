---
title: "Once the rule lives in a server-only module, an action and a Route Handler each shrink to the thing their transport actually requires — and a third entry point costs nothing"
sidebar_label: "02n · Thin entry points"
sidebar_position: 28
description: "Applying the Data Access Layer pattern to mutations, why a 'use server' file can also be server-only, two doors over one rule with the action adding cache invalidation and the handler adding status codes, and the documented audit checklist as a set of greps."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Using a Data Access Layer for mutations*, § *Preventing client-side execution of server-only code*, § *Auditing*) — `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**A Data Access Layer earns its keep on the write path more than the read path, because writes are where the drift happens. Once authentication, authorisation and the database work live in one `server-only` module, an action reduces to "call it, then invalidate the router's cache" and a Route Handler reduces to "call it, then map the error onto a status code" — and adding a queue consumer or a cron job later adds no third copy of the rule. This chunk is what that looks like in code, and the audit checklist that tells you whether you actually did it.**

## The DAL for mutations

> *"Just as we recommend a Data Access Layer for reading data, you can apply the same pattern to mutations. This keeps authentication, authorization, and database logic in a dedicated `server-only` module, while `"use server"` actions stay thin."*

```ts
// data/posts.ts
import 'server-only'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const post = await db.post.findUnique({ where: { id: postId } })

  if (post.authorId !== session.user.id) {
    throw new Error('Forbidden')
  }

  await db.post.delete({ where: { id: postId } })
}
```

```ts
// app/actions.ts
'use server'

import { deletePost } from '@/data/posts'
import { revalidatePath } from 'next/cache'

export async function deletePostAction(postId: string) {
  await deletePost(postId) // Auth + authz happen inside the DAL
  revalidatePath('/posts')
}
```

And the second door, for callers who are not your UI ([02l](02l-the-decision-rule.md)):

```ts
// app/api/posts/[id]/route.ts
import { deletePost } from '@/data/posts'

export async function DELETE(_req: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params
  try {
    await deletePost(id)
    return new Response(null, { status: 204 })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    if (message === 'Unauthorized') return new Response(null, { status: 401 })
    if (message === 'Forbidden') return new Response(null, { status: 403 })
    throw reason
  }
}
```

Each door contains exactly what its transport needs and nothing else: the action invalidates the router's cache, the handler maps errors to status codes. Adding a third door — a GraphQL resolver, a queue consumer, a cron job — adds no new copy of the rule.

⚠️ The docs' `deletePost` reads then compares in JavaScript. A single `deleteMany` with `where: { id, authorId: session.user.id }` removes the check-then-act window entirely and returns a `count` you can log ([02e](02e-authentication-and-authorisation-at-the-entry-point.md)). Both shapes are correct; the predicate form is stronger under concurrency.

It composes with `'use server'` rather than conflicting with it:

> *"**Good to know:** You can use `import 'server-only'` in both the Data Access Layer and the `"use server"` file itself. Both work when the action is imported into a Client Component (for example, to pass it to `useActionState`), because `"use server"` modules are resolved in a server-only webpack layer."*

That answers the question everyone asks on first contact: yes, an actions file can be `server-only`, and a Client Component can still import the actions from it, because the import is compiled into an action reference rather than a module import ([02b](02b-what-a-server-action-compiles-into.md)).

## The audit checklist, verbatim


> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*

> *"**`"use client"` files:** Are the Component props expecting private data? Are the type signatures overly broad?"*

> *"**`"use server"` files:** Are the Action arguments validated in the action or inside the Data Access Layer? Is the user re-authorized inside the action? Does the action check ownership of the resource (authorization, not just authentication)? Are return values filtered to only what the client needs? Is database access delegated to a `server-only` Data Access Layer?"*

> *"**`/[param]/.`** Folders with brackets are user input. Are params validated?"*

> *"**`proxy.ts` and `route.ts`:** Have a lot of power. Spend extra time auditing these using traditional techniques. Perform Penetration Testing or Vulnerability Scanning regularly or in alignment with your team's software development lifecycle."*

Every one of those is a question a DAL turns from "read the code and judge" into "run a grep".

## Gotchas

**Symptom: an actions file cannot be marked `server-only` because a Client Component imports it.** Cause: a reasonable assumption that is wrong. Fix: mark it anyway — *"`"use server"` modules are resolved in a server-only webpack layer"*, so a Client Component importing an action from a `server-only` file compiles fine.

**Symptom: the DAL exists and half the codebase still queries the database directly.** Cause: a DAL introduced as a convention rather than an invariant. Fix: make the database client itself `server-only` and exported from exactly one module under `data/`, so a direct query outside the DAL is an import error, not a style disagreement.
**★ Symptom: the DAL exists and half the codebase still queries the database directly.** Cause: a DAL introduced as a convention rather than an invariant, so every new file is a coin flip. Fix: make the database client itself impossible to reach from outside — one `server-only` module constructs it, nothing else exports it, and a lint boundary makes a direct import an error rather than a style disagreement.

```json
// eslint.config — nothing outside data/ may import the driver or the client module
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [
        { "name": "@prisma/client", "message": "Import from @/data/* — the DAL owns the client." },
        { "name": "pg", "message": "Import from @/data/* — the DAL owns the pool." }
      ],
      "patterns": ["@/data/db"]
    }]
  }
}
```

**★ Symptom: the action grew a second authorisation check "to be safe", and now the two disagree.** Cause: defence in depth applied to the wrong axis — duplicating a decision is not depth, it is two decisions. Fix: keep exactly one authorisation site per operation, in the DAL, and let the entry point translate its failure.

```ts
// app/posts/actions.ts — the whole action
'use server'
import { revalidateTag } from 'next/cache'
import { deletePost } from '@/data/posts'

export async function deletePostAction(postId: string) {
  await deletePost(postId)     // the only place the rule lives
  revalidateTag('posts')       // the only thing this transport adds
}
```

**★ Symptom: a Route Handler over the DAL returns 500 for a permission failure, and monitoring pages someone at 3am.** Cause: the DAL throws domain errors and the handler did not translate them. Fix: give the DAL a small error vocabulary the transports can map.

```ts
// data/errors.ts
import 'server-only'
export class Unauthorized extends Error {}
export class Forbidden extends Error {}
export class NotFound extends Error {}
```

```ts
// app/api/posts/[id]/route.ts
import { Unauthorized, Forbidden, NotFound } from '@/data/errors'
import { deletePost } from '@/data/posts'

const STATUS = new Map<Function, number>([[Unauthorized, 401], [Forbidden, 403], [NotFound, 404]])

export async function DELETE(_req: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params
  try {
    await deletePost(id)
    return new Response(null, { status: 204 })
  } catch (reason) {
    const status = STATUS.get((reason as object)?.constructor) ?? 500
    if (status === 500) console.error('deletePost failed', reason)
    return new Response(null, { status })
  }
}
```

**Symptom: the action calls the DAL and *also* calls `revalidateTag` from inside the DAL.** Cause: cache concerns leaked downward. Fix: keep `next/cache` out of the DAL — it is transport knowledge. A queue consumer calling the same function has no router to invalidate, and a `revalidateTag` call in that context is at best a no-op and at worst an error.

**Symptom: unit-testing the mutation requires spinning up Next.js.** Cause: the logic is in the action, which only exists as a compiled reference. Fix: the DAL function is a plain async function — import it in a test directly, with no framework at all. That testability is a side effect of thin entry points, and a good early signal that you got the split right.

## Interview questions

**★ Where should the ownership check live: the action, the Route Handler, or the DAL?**
The DAL, with the entry points thin. The other placements execute correctly but scale badly with the number of doors: a second entry point means a second copy, and copies drift — one gets an ownership predicate during an incident and the other is found by a pentest a year later. Putting it in the DAL means the action adds only cache invalidation, the handler adds only status-code mapping, and a future queue consumer or cron job inherits the rule for free. That is why the official audit question is *"Is database access delegated to a `server-only` Data Access Layer?"* rather than "is each action correct?".

**★ Can a `'use server'` file also be `server-only`, given a Client Component imports it?**
Yes, and the docs say so explicitly: *"You can use `import 'server-only'` in both the Data Access Layer and the `"use server"` file itself. Both work when the action is imported into a Client Component (for example, to pass it to `useActionState`), because `"use server"` modules are resolved in a server-only webpack layer."* The apparent contradiction dissolves once you remember what the client import compiles into — not a module import at all, but an action reference: an encrypted ID plus a dispatcher. The module's body never enters the client graph, so `server-only` has nothing to object to.

**★ How do you make a Data Access Layer an invariant rather than a convention?**
By removing the alternative. Construct the database client in exactly one `server-only` module, do not re-export it, and add a lint rule forbidding imports of the driver package and of that module from anywhere outside `data/`. Do the same for `process.env`, which the docs restrict to the DAL. At that point writing a query in a component is an import error rather than a review comment, and the audit checklist's *"verify that database packages and environment variables are not imported outside the Data Access Layer"* becomes a command in CI rather than a person's afternoon. A convention degrades with team size; an import error does not.

**★ Can you use a Data Access Layer if the backend belongs to another team?**
Yes, and the docs cover it as a distinct approach: for existing large applications, keep calling the REST or GraphQL endpoints from Server Components with `fetch` under a Zero Trust model. What you should not do is mix approaches — *"We recommend choosing one data fetching approach and avoiding mixing them"* — because an auditor then has three possible answers to "where is the check for this read?". A defensible middle path is a DAL that is the only module allowed to call the external API, so authorisation and DTO shaping still happen in one place even though the storage is somebody else's. That keeps the invariant, which is what the pattern is actually for.

**Should the DAL know about `revalidateTag` and `revalidatePath`?**
No. Cache invalidation is transport knowledge — it exists because a React router is holding a cached tree, and a DAL function called from a queue consumer, a cron job or a test has no such router. Keeping `next/cache` imports in the action layer means the DAL stays a plain async module you can call from anywhere and test with no framework, and it keeps the split honest: the entry point contributes what its transport needs, and only that. The corollary is that if you find yourself wanting to invalidate from inside the DAL, the real requirement is usually a domain event, and the entry points should each react to it in their own way.

**What is the test-shape argument for thin entry points?**
A Server Action does not exist as a callable function at runtime in the way your test wants — it is compiled into a reference, and exercising it end-to-end means driving a browser or synthesising a POST that the origin check will reject. A Route Handler is testable but only through a `Request`/`Response` round trip. A DAL function is a plain async function: import it, seed a session, call it, assert. So the ratio of logic in the DAL to logic in the entry points is directly the ratio of your test suite that can be fast and framework-free. If mutations are hard to test, the logic is in the wrong layer, and the fix is the same one security wants.

---

← [02m · The Data Access Layer](02m-the-data-access-layer.md) · Next → [03 · Real-time: SSE and WebSockets](03-real-time-server-sent-events-and-websockets-in-a-serverless.md)
