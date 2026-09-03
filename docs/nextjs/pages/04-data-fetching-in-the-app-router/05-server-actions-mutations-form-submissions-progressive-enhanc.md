---
title: "'use server' does not mean 'this runs on the server' — it means 'compile every export of this scope into a public POST endpoint', which is why a helper you exported from an actions file for a unit test is now reachable by anyone on the internet"
sidebar_label: "05 · The 'use server' directive"
sidebar_position: 5
description: "The two placements of 'use server' and the caveats that govern them, why importing an action from client code requires module scope, what an inline action in a Server Component can and cannot do, why every export of a 'use server' module is an endpoint, and the confusion with 'use client'."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against React's [`'use server'`](https://react.dev/reference/rsc/use-server) directive reference and [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (docs `lastUpdated` 2026-06-17). Hook and export surfaces **probed** on the installed packages — `react` **19.2.8**, `react-dom` **19.2.8**.
> Target: **Next.js 16.3.4**, React **19.2.8**, App Router, Node >= 20.9. Documentation-verified and probe-verified; **no sandbox run**.

**`'use server'` is the most badly named directive in the framework, because the thing it does is nearly the opposite of what it says. It does not mark code as server-side — a Server Component is already server-side and needs no directive. It marks a function as a **Server Function**: something whose implementation stays on the server while a *reference to it* is compiled into the client bundle, along with a dispatcher that POSTs back. In other words, applying the directive is how you create a public HTTP endpoint, and the scope you apply it at decides how many you create. Put it at the top of a module and every export in that module becomes one, including the helper you exported so a unit test could reach it. Put it inside a function body and only that function becomes one — but then client code cannot import it, only receive it as a prop. This page is about that choice and the rules around it. Invoking an action is [05b](05b-invoking-an-action-and-what-progressive-enhancement-really-buys.md); what crosses the wire is [05c](05c-what-crosses-the-wire.md); the model of the response is on [01b](01b-server-actions-and-mutations.md).**

## Two placements, and the rule connecting them

React's directive reference gives exactly two positions. At the top of an **async function body**, marking that one function. Or at the top of a **file**, marking every export in it.

```ts
// (a) module scope — app/projects/actions.ts
'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function archiveProject(projectId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  await db.project.updateMany({
    where: { id: projectId, ownerId: session.user.id },
    data: { archived: true },
  })
}
```

```tsx
// (b) function scope — inside a Server Component
// app/projects/[id]/page.tsx  (no 'use client' anywhere in this file)
import { ArchiveButton } from './archive-button'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  async function archive() {
    'use server'                     // first line of the function body
    await db.project.update({ where: { id }, data: { archived: true } })
  }

  return <ArchiveButton action={archive} />   // passed to a Client Component as a prop
}
```

The rule that connects the two placements is the one people discover by breaking it:

> *"To import a Server Functions from client code, the directive must be used on a module level."*

An inline action can be **passed** to a Client Component as a prop. It cannot be **imported** by one. So the moment a `'use client'` file wants `archiveProject` by name, the action has to live in a module-scope `'use server'` file — which is why almost every real codebase converges on a per-feature `actions.ts`.

## The caveats, in the order they bite

React's reference lists them; here they are with what each one costs when ignored.

- **The directive must be at the very beginning of the function or module, above any other code including imports.** Comments above it are fine. A `'use server'` under an import is not a directive; it is a string expression that evaluates and is discarded.
- **Single or double quotes, not backticks.** `` `use server` `` is a template literal, not a directive, and nothing warns you.
- **It can only be used in server-side files.** You cannot put `'use server'` in a `'use client'` module — the two are not composable, and a Client Component that needs an action imports it from elsewhere.
- **It can only be used on async functions**, because the underlying network call is always asynchronous. A synchronous function with the directive is an error rather than a silently-sync endpoint.
- **Server Functions can be passed to Client Components through props**, provided their arguments and return values are serializable ([05c](05c-what-crosses-the-wire.md)).
- **Arguments are untrusted input**, and every mutation must be authorized inside the function ([05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md), [01c](01c-server-action-hooks-optimistic-ui-and-security.md)).
- **Server Functions should be called in a Transition.** A form's `action` and a button's `formAction` do this automatically; an event handler does not ([05b](05b-invoking-an-action-and-what-progressive-enhancement-really-buys.md)).

## 🔴 Every export of a `'use server'` module is an endpoint

This is the consequence of module-scope placement that nobody states plainly, and it is worth stating plainly: the directive at the top of a file marks **all exports within** it as Server Functions. Not the ones you meant. All of them.

```ts
// app/projects/actions.ts
'use server'

// ✅ intended: a Server Function
export async function archiveProject(projectId: string) { /* … */ }

// 🔴 NOT a test helper. This is now a public POST endpoint that resets the database.
export async function __resetForTests() {
  await db.$executeRaw`TRUNCATE projects CASCADE`
}
```

The mitigations Next.js applies — encrypted action IDs, and dead-code elimination of Server Functions nothing references — are build-time optimisations, not access control ([01c](01c-server-action-hooks-optimistic-ui-and-security.md)). The moment anything client-side references the module, the endpoints for its exports exist. Keep a `'use server'` file to the actions you intend to expose, and put helpers, types and constants in a sibling module that the actions import.

⚠️ The directive is documented as marking *all exports* as Server Functions, and only async functions can be Server Functions. What happens to a non-function export from such a module — a constant, a type object — is not stated on the pages verified here. Do not find out in production: keep constants out of `'use server'` files.

## What the compiler actually does

At build time the directive makes the compiler swap the function's implementation, in client bundles, for a reference: an action ID plus a dispatcher that POSTs back to the server. The implementation never reaches the browser; the route to reach it does. Two framework behaviours follow, both covered in depth on [01b](01b-server-actions-and-mutations.md) and [01c](01c-server-action-hooks-optimistic-ui-and-security.md):

- Action references are **encrypted** at build time, and unreferenced Server Functions are stripped from client bundles.
- Variables **captured by an inline action are encrypted** before being sent to the client, which is what makes the closure in the `archive()` example above safe — and what makes `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` mandatory across a multi-instance deployment.

The mental model that prevents every security mistake on the following pages: **an action is a route with a nicer calling convention.** The `import` gives you the illusion of a local call. What ships is an ID and a POST.

## Choosing the placement

| | Module scope (`actions.ts`) | Function scope (inline) |
|---|---|---|
| Importable from a Client Component | ✅ | ❌ |
| Passable to a Client Component as a prop | ✅ | ✅ |
| Can close over render-scope values | ❌ — take them as arguments | ✅ — captured and encrypted |
| Number of endpoints created | one **per export** | one per function |
| Testable by importing the function | ✅ | ❌ — it does not exist outside the render |
| Best for | anything a client calls by name; anything reused | a per-row action bound to data the row already has |

The inline form's real advantage is the closure: a list of a hundred projects can render a hundred archive buttons, each holding an action already bound to its own id, with no id crossing the wire from the client at all. That is not merely convenient — it removes an entire class of authorization bug, because the client never gets to say *which* record.

```tsx
// app/projects/page.tsx — a Server Component
export default async function ProjectList() {
  const projects = await db.project.findMany({ where: { ownerId: await currentUserId() } })

  return (
    <ul>
      {projects.map((project) => {
        const archive = async () => {
          'use server'
          // `project.id` is captured here, encrypted, and never supplied by the client
          await db.project.update({ where: { id: project.id }, data: { archived: true } })
        }
        return (
          <li key={project.id}>
            {project.name}
            <ArchiveButton action={archive} />
          </li>
        )
      })}
    </ul>
  )
}
```

🔴 The closure is encrypted, not omitted. It still crosses the wire, and it is still decrypted by *your* server, so a captured value is protected from the browser but the action still runs for anyone who can replay the request. Authorization inside the function remains mandatory — see [05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md).

## Gotchas

**★ Symptom: the directive appears to do nothing — the function runs on the client, or the build complains it is not a Server Function.** Cause: `'use server'` must be at the very beginning of the function or module, above any other code including imports. Only comments may precede it. Fix: move it to line one.

```ts
// ❌ not a directive — an expression that evaluates and is discarded
import { db } from '@/lib/db'
'use server'

// ✅
'use server'
import { db } from '@/lib/db'
```

**★ Symptom: a template-literal directive silently does nothing.** Cause: directives must be written with single or double quotes, not backticks. A backticked `` `use server` `` is an ordinary template literal. Fix: `'use server'`. This is worth a lint rule, because nothing at build or run time will tell you.

**★ Symptom: a helper exported from `actions.ts` for a test turns out to be callable over HTTP.** Cause: module-scope `'use server'` marks **all exports** as Server Functions. Every one is a public endpoint once anything client-side references the module. Fix: keep the file to actions you intend to expose; helpers and fixtures live in a sibling module.

```ts
// app/projects/actions.ts
'use server'
export async function archiveProject(id: string) { /* … */ }

// app/projects/queries.ts   ← no directive; imported by the action, not exposed
export function buildArchiveWhere(id: string, ownerId: string) { /* … */ }
```

**★ Symptom: a build error about `'use server'` in a Client Component.** Cause: the directive can only be used in server-side files, and `'use client'` and `'use server'` are not composable in one module. Fix: put the action in its own module-scope file and import it into the Client Component — which is exactly the case the module-level rule exists for.

**★ Symptom: a Client Component imports an action defined inline inside a Server Component and the build fails.** Cause: importing a Server Function from client code requires the directive at module level. An inline action is not an importable binding — it only exists during that render. Fix: either move it to `actions.ts`, or keep it inline and **pass it as a prop**, which is supported.

**★ Symptom: `'use server'` added to the top of a page file makes the whole page behave strangely.** Cause: it marks every export of that module as a Server Function — including the default export, which was your component. Fix: remove it. A Server Component needs no directive; `'use server'` is not "this file is server-side", it is "these exports are endpoints".

**★ Symptom: a synchronous function marked `'use server'` errors at build.** Cause: the directive can only be used on async functions, because the network call underlying every Server Function is asynchronous. Fix: make it `async`, even when the body has nothing to await — the signature is part of the contract, not a formality.

**★ Symptom: `'use server'` and `'use client'` get applied to the wrong files by pattern-matching.** Cause: the names suggest they are opposites of the same kind, and they are not. `'use client'` marks a **boundary**: everything from that module down is client code. `'use server'` marks **exports as callable endpoints**. A file with neither is a Server Component. Fix: read the directive as what it creates — a boundary versus an endpoint — rather than as a location.

**★ Symptom: an inline action's captured variable is visible in the network payload, and someone concludes closures are unsafe.** Cause: they are encrypted, not omitted, so the ciphertext is on the wire. Fix: nothing, provided `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set and identical across every instance; without it, one instance cannot decrypt a reference minted by another and the failure is intermittent ([01c](01c-server-action-hooks-optimistic-ui-and-security.md)).

**Symptom: a constant exported from a `'use server'` module behaves oddly when imported.** Cause: the directive marks all exports as Server Functions, and only async functions can be Server Functions; what happens to a non-function export is not stated on the pages verified here. Fix: do not export constants or types from a `'use server'` file. Put them in a plain module both sides can import.

**Symptom: an action reachable only from an admin page turns out to be reachable by anyone.** Cause: render-time gating is not a boundary — a POST does not have to originate from your UI, and dead-code elimination is a bundle optimisation, not access control. Fix: authenticate and authorize inside the function, every time, including for actions you believe nobody can see.

**Symptom: a per-row action takes the row id as an argument, and a user completes another user's row.** Cause: the client supplied the identifier, so the client chose the record. Fix: where the action is inline in a Server Component, capture the id in the closure so it never comes from the browser; where it must be an argument, look the row up by ownership derived from the session.

## Interview questions

**★ What does `'use server'` actually do, and why is the name misleading?**
It marks a function as a React Server Function: the compiler leaves the implementation on the server and puts a reference in client bundles — an action ID plus a dispatcher that POSTs back. So applying it *creates a public HTTP endpoint*. The name misleads because a Server Component already runs on the server with no directive at all, so people read `'use server'` as "make this file server-side" and add it to page files, where it converts every export, the component included, into a Server Function. The accurate reading is "expose these exports as endpoints".

**★ Where can the directive be placed, and what does each placement allow?**
Two places: the top of an async function body, marking that function; or the top of a file, marking every export in it. Function scope lets the action close over render-scope values, which are encrypted before being sent to the client, and lets it be *passed* to a Client Component as a prop. Module scope is the only form a Client Component can *import* by name — the documentation is explicit that importing a Server Function from client code requires the directive at module level. That single rule is why per-feature `actions.ts` files exist at all.

**★ Why is "every export of a `'use server'` module is an endpoint" a security statement rather than a trivia question?**
Because the file grows. It starts as three actions, and then somebody exports a helper so a test can reach it, or a seed function, or a `__reset`. Each of those is now a POST endpoint that the framework will happily route to. Encrypted action IDs and dead-code elimination narrow the window — an unreferenced function is stripped — but they are build optimisations, not authorization, and anything the client bundle references is live. The discipline is that a `'use server'` file contains only the functions you would be comfortable seeing in an API specification.

**★ A Client Component needs to call an action defined inline in a Server Component. What are the options?**
Two, and only two. Pass it down as a prop — Server Functions may be passed to Client Components through props, which is precisely the mechanism that makes per-row actions work. Or move it to a module-scope `'use server'` file and import it, which is required if the client wants it by name. What is not available is importing an inline action: it is not a module binding, it exists only for the duration of that render, and the build will say so.

**★ What is the advantage of capturing a record id in an inline action's closure rather than taking it as an argument?**
The client never gets to choose the record. A closure variable is captured on the server, encrypted, and sent as opaque data the browser cannot meaningfully alter; an argument is supplied by the caller and is therefore attacker-controlled by definition. That does not remove the need for authorization — the request can still be replayed by whoever holds the encrypted reference, and your server will decrypt it — but it removes an entire class of "change the id in the payload" bug from the surface, which is worth having in a list view rendering a hundred buttons.

**★ Why must a Server Function be async, and why must the directive sit above the imports?**
Async because the call is a network call: the client-side reference is a dispatcher that POSTs, so the return is inherently a promise and the framework rejects a synchronous declaration rather than pretending otherwise. Above the imports because a directive is only a directive in prologue position; anywhere else it is an ordinary string expression that evaluates to a string and is thrown away — which is a silent failure, and the reason a linted codebase catches this and an unlinted one ships it.

**★ What is the difference between `'use client'` and `'use server'` as directives, structurally?**
`'use client'` marks a boundary: it says that this module and everything it imports below it belongs in the client bundle. `'use server'` marks exports: it says these particular functions are callable endpoints whose bodies stay on the server. They are not opposites of each other and they cannot coexist in one module. A file with neither directive, inside `app`, is a Server Component — which is the case people forget when they reach for `'use server'` to "make sure" something runs on the server.

**Someone says "the action is not in any client bundle, so it has no endpoint". Is that right?**
It is right about the mechanism and dangerous as a habit. Unreferenced Server Functions are eliminated at build and genuinely have no endpoint. But that is a property of today's import graph, not of the code — the moment any client component references the module, every export in it becomes live, and nobody reviews the bundle graph when adding an import. Treat every retained action as public and put the authorization inside it, so the security property does not depend on a build optimisation.

**What is the one sentence that prevents most Server Action security bugs?**
"It is a route with a nicer calling convention." The `import` makes it look like a local function call; what actually ships to the browser is an action ID and a dispatcher that POSTs. Anyone who can send that POST reaches the function, with arguments of their choosing, without going through your UI at all. Once that is the mental model, authorizing inside the action, validating every argument and constraining every return value all read as obvious rather than as ceremony.

---

← [04f · Config, runtime and CORS](04f-caching-runtime-cors-and-the-public-endpoint-contract.md) · [Chapter 4 overview](01-explanation.md) · Next → [05b · Invoking an action](05b-invoking-an-action-and-what-progressive-enhancement-really-buys.md)
