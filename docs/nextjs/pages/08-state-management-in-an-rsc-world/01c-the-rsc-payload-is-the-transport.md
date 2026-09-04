---
title: "Props are not function arguments across the RSC boundary — they are input to a serializer, and every strange rule about what may cross falls out of that one fact"
sidebar_label: "01c · The payload is the transport"
sidebar_position: 101
description: "Two module graphs and the two things that cross them, what the RSC payload actually contains, React's exact serializable and non-serializable sets, why class instances failing to serialize is a security feature, and why passing rendered elements beats passing data."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) (`lastUpdated: 2026-08-25`), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`), [Data Security](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`) and React's [`'use client'`](https://react.dev/reference/rsc/use-client) reference.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**The `'use client'` directive is described as a boundary, and reading it as a boundary between "server code" and "client code" is what makes people think props are function arguments. They are not. Props named on a Server Component's JSX are inputs to a *serializer*: the server produces an RSC payload containing rendered output, references to Client Component bundles, and a serialized copy of every prop crossing into them, and the browser reconstructs values from that payload. Everything strange about the boundary — why a function throws, why a Prisma model throws, why a `<Cart />` passed as `children` renders on the server anyway, why `Menu.Item` becomes `undefined` — falls out of that single fact.**

## Two module graphs, and the two things that cross

> *"Each component's module belongs to the server module graph, the client module graph, or both. Next.js compiles a module used by both graphs separately for each environment."*

> *"During rendering, the server graph produces references to Client Components and serializes the props passed to them. The client graph does not import the server graph. The client graph receives the references and serialized props through the RSC Payload."*
> — [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)

The two crossing rules, verbatim:

> *"**Code** crosses through imports. Whatever a Client Component imports is pulled into the client bundle."*
> *"**Data** crosses through props, and it must be serializable, so functions like event handlers cannot cross."*

Code crossing is transitive and unconditional. React states it without hedging:

> *"As dependencies of `RichTextEditor`, `formatDate` and `Button` will also be evaluated on the client regardless of whether their modules contain a `'use client'` directive."*
> — [`'use client'`](https://react.dev/reference/rsc/use-client)

And Next.js states the boundary's scope precisely, including what it does *not* cover:

> *"Once a file is marked with `"use client"`, **all of its imports and the components it directly renders are included in the client bundle**. […] It does not apply to Server Components passed as children or other props. Those components are not imported into the Client Component's module graph. They are rendered on the server and passed to the Client Component as rendered output."*
> — [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

That last sentence is the single most useful lever in RSC state design, and [02d](02d-look-alikes-forms-boundaries-and-streaming.md) spends a section on it.

## What is actually in the payload

> *"The RSC Payload is a compact, serialized representation of the rendered React Server Components tree. It's used by React on the client to update the browser's DOM. The RSC Payload contains:*
> *· The rendered result of Server Components*
> *· Placeholders for where Client Components should be rendered and references to their JavaScript files*
> *· Any props passed from a Server Component to a Client Component"*

Read the third bullet as a security statement, because that is what it is. **Every prop you hand a Client Component is in a document the user can open.** Not "could be extracted with effort" — it is transmitted verbatim, in the HTML on first load and in the payload on navigation. The Data Security guide's bad example is exactly this:

```tsx filename="app/page.tsx"
// EXPOSED: This exposes all the fields in userData to the client because
// we are passing the data from the Server Component to the Client.
return <Profile user={userData} />
```

The fix the guide gives is not "encrypt it"; it is "do not select it":

```ts filename="data/user.ts"
import { sql } from './db'

export async function getUser(slug: string) {
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const user = rows[0]

  // Return only the public fields
  return {
    name: user.name,
  }
}
```

## The serializable set, exactly

React's `'use client'` reference enumerates it. This is the list to know cold, because the failures are runtime and the error text is generic.

> *"Prop values passed from a Server Component to Client Component must be serializable."*

**Serializable:**

| Group | Members |
| :--- | :--- |
| Primitives | `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, and symbols **only** if registered globally via `Symbol.for` |
| Iterables of serializable values | `String`, `Array`, `Map`, `Set`, `TypedArray`, `ArrayBuffer` |
| Other | `Date`, plain objects created with object initializers, **Server Functions**, Client or Server Component elements (JSX), and **Promises** |

**Not serializable:**

> *"Functions that are not exported from client-marked modules or marked with `'use server'`"* · *"Classes"* · *"Objects that are instances of any class (other than built-ins mentioned) or objects with a null prototype"* · *"Symbols not registered globally (ex. `Symbol('my new symbol')`)"*

Three of these are worth stopping on.

**`Promise` is serializable.** This is the streaming lever: a Server Component starts a fetch, does not await it, and passes the pending promise down. The Client Component reads it with `use`, and the nearest `<Suspense>` boundary shows a fallback until it resolves. The request starts before the client runs, so the Client Component does not need to fetch after mount — which removes the most common reason people reach for a client data library.

**Class instances are not serializable, and the docs treat that as a feature.** The Data Access Layer example says so in a code comment:

```ts filename="data/auth.ts"
// Cached helper methods makes it easy to get the same value in many places
// without manually passing it around. This discourages passing it from Server
// Component to Server Component which minimizes risk of passing it to a Client
// Component.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const decodedToken = await decryptAndValidate(token)
  // Don't include secret tokens or private information as public fields.
  // Use classes to avoid accidentally passing the whole object to the client.
  return new User(decodedToken.id)
})
```

Wrapping your session object in a class turns "I leaked the session" into a build-time-shaped runtime error. It is a cheap and underused guard rail. The same reasoning is why the docs note: *"Functions and classes are already blocked from being passed to Client Components by default."*

**Server Functions cross as references, plain functions throw.**

> *"Passing a function as a prop from a Server Component to a Client Component throws. An event handler like `onClick` cannot cross. A Server Function marked with `'use server'` crosses as a reference."*

And because a Server Function is a function like any other at the type level, the tooling uses a naming convention instead:

> *"A Server Function is not distinguishable from a plain function by its type. The TypeScript plugin allows a Client Component prop typed as a function when its name is `action` or ends in `Action`. The plugin flags other function props."*

## Elements cross, so composition beats prop-drilling

A rendered element is serializable data, which is what makes the slot pattern work:

> *"A rendered React element can cross the boundary because it is serializable data. Passing rendered output as `children` lets a Server Component nest inside a Client Component without importing the Server Component's code into the client graph."*

```tsx filename="app/page.tsx"
import { Cart } from '@/app/ui/cart'
import { Modal } from '@/app/ui/modal'

// Page and Cart are Server Components. Modal is a Client Component
export default function Page() {
  return (
    <Modal title={<div>Your cart</div>}>
      <Cart />
    </Modal>
  )
}
```

The docs spell out why `Cart` still runs on the server, using React's owner/parent distinction:

> *"Because `Cart`'s owner is a Server Component, `Cart` renders on the server. `Modal` is only the parent, so `Modal` receives `Cart`'s output to place but not its code to run. This separation lets a Client Component display a Server Component it never imported."*

**Consequence for state design:** a Client Component can hold interactive state *around* server-rendered content without that content ever entering the client bundle. Most "we need a store because this modal wraps a data view" arguments end here.

## Gotchas

**★ Symptom: `Error: Functions cannot be passed directly to Client Components` on a prop you thought was fine.** Cause: you passed a plain function — a formatter, a comparator, an `onSelect` — from a Server Component. Only Server Functions cross, as references. Fix: either define the handler inside the Client Component, or make the function a Server Function.

```tsx filename="app/board/page.tsx"
import { archiveTask } from './actions' // 'use server' module
import { TaskRow } from './task-row'

export default async function Page() {
  const tasks = await listTasks()
  // 🔴 <TaskRow onArchive={(id) => archive(id)} />   plain closure: throws
  // ✅ a Server Function reference crosses, and the prop name ends in "Action"
  return tasks.map((t) => <TaskRow key={t.id} task={t} archiveAction={archiveTask} />)
}
```

**★ Symptom: a prop typed as a function is flagged by the TypeScript plugin even though it is a Server Function.** Cause: the plugin cannot tell a Server Function from a plain function by type, so it uses the name — `action`, or a name ending in `Action`. Fix: rename the prop. Note that renaming only silences the *check*; it does not make a plain function crossable.

```tsx
'use client'

export function TaskRow({
  task,
  archiveAction, // ✅ accepted by the plugin
}: {
  task: TaskDTO
  archiveAction: (id: string) => Promise<void>
}) {
  return <button onClick={() => archiveAction(task.id)}>Archive</button>
}
```

**★ Symptom: an ORM model passed as a prop throws, but the same object spread into a literal works.** Cause: instances of classes are not serializable; a plain object created with an initializer is. The spread silently converted it. Fix: do not spread — that is how every field, including ones you never render, ends up in the payload. Project explicitly.

```ts filename="data/tasks.ts"
import 'server-only'

export type TaskDTO = { id: string; title: string; done: boolean }

export async function listTasks(): Promise<TaskDTO[]> {
  const rows = await db.task.findMany()
  // 🔴 rows.map((r) => ({ ...r }))  — serializable, and leaks internalNotes, ownerEmail…
  return rows.map((r) => ({ id: r.id, title: r.title, done: r.done }))
}
```

**★ Symptom: a compound Client Component's subcomponent is `undefined` and React throws `Element type is invalid`.** Cause: a Server Component that imports a Client Component receives a *client reference*, not the function object, so static properties like `Menu.Item` do not exist on it. Fix: expose the pieces as named exports.

```tsx filename="app/ui/menu.tsx"
'use client'

export function Menu({ children }: { children: React.ReactNode }) { return <div>{children}</div> }
// 🔴 Menu.Item = MenuItem
export function MenuItem({ label }: { label: string }) { return <div>{label}</div> }
```

```tsx filename="app/page.tsx"
import { Menu, MenuItem } from '@/app/ui/menu' // ✅ named exports cross fine

export default function Page() {
  return <Menu><MenuItem label="Archive" /></Menu>
}
```

**★ Symptom: the HTML document is enormous and the page has almost no visible content.** Cause: props are serialized into the payload, which ships inside the HTML on first load — so a 400-row array passed to a Client Component is in the document twice, once as rendered markup and once as serialized props. Fix: stop passing the data across the boundary and pass the rendered output instead.

```tsx filename="app/board/page.tsx"
import { BoardShell } from './board-shell'   // 'use client'
import { TaskCard } from './task-card'       // Server Component

export default async function Page() {
  const tasks = await listTasks()
  // 🔴 <BoardShell tasks={tasks} />  — every field of every row, serialized
  return (
    <BoardShell>
      {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
    </BoardShell>
  )
}
```

**★ Symptom: a `useEffect` or `useMemo` whose dependency is an object prop re-runs on every server render.** Cause: the prop is reconstructed from the payload, so referential identity across payloads is not something you can rely on. ⚠️ The documentation does not state whether React ever preserves references across payloads — treat it as unspecified rather than assuming either way. Fix: depend on a primitive derived from the value.

```tsx
'use client'

import { useMemo } from 'react'

export function TaskStats({ tasks }: { tasks: TaskDTO[] }) {
  // 🔴 useMemo(..., [tasks])
  const key = tasks.map((t) => t.id).join(',')
  const openCount = useMemo(() => tasks.filter((t) => !t.done).length, [key, tasks])
  return <span>{openCount} open</span>
}
```

**★ Symptom: a locally created symbol used as a prop value arrives as `undefined` or throws.** Cause: only symbols in the global registry are serializable — *"symbols not registered globally (ex. `Symbol('my new symbol')`)"* are not. Fix: use `Symbol.for`, or, far better, use a string union, which is what you actually wanted.

```ts
// 🔴 export const COMPACT = Symbol('compact')
export const COMPACT = Symbol.for('sprintdesk.density.compact') // crosses
export type Density = 'compact' | 'comfortable'                 // crosses and type-checks
```

**★ Symptom: a third-party component using `useState` throws when rendered from a Server Component.** Cause: the package has no `'use client'` directive, so Next.js has no way to know it needs the client. Fix: re-export it through a one-line module of your own that carries the directive.

```tsx filename="app/ui/carousel.tsx"
'use client'

import { Carousel } from 'acme-carousel'

export default Carousel
```

## Interview questions

**★ Why is "props are just function arguments" a dangerous mental model at the RSC boundary?**
Because between the Server Component that writes the JSX and the Client Component that receives it, there is a serializer and a network. The server produces a payload containing rendered output, references to client bundles, and a serialized copy of every prop; the browser rebuilds values from that. Once you hold that model, the boundary stops being surprising: a function has no serial form so it throws, a class instance has no serial form so it throws, a rendered element does have one so it crosses, and a promise has one so streaming works. And the security consequence is immediate — a prop is a transmitted document, not a reference.

**★ How does a Server Component render inside a Client Component without ending up in the client bundle?**
By being passed as a prop rather than imported. The directive's reach is the module graph — imports and directly rendered components — and a component handed in as `children` was never imported by the client module. React distinguishes the *owner* (whose JSX contains it) from the *parent* (who renders it in the tree); the owner here is a Server Component, so the server renders it and the Client Component receives only the output to place. This is the mechanism behind almost every "we do not need a store" answer in this chapter.

**★ Someone says class instances not being serializable is an annoying limitation. Argue the other side.**
It is the cheapest data-leak guard you can buy. The Data Access Layer pattern in the Next.js docs deliberately returns a class instance from `getCurrentUser` with the comment *"Use classes to avoid accidentally passing the whole object to the client"* — because the moment somebody adds `<Profile user={user} />` the app fails loudly instead of quietly shipping the session token in the payload. Serialization failure is a type error that arrives at runtime; a leaked field arrives as an incident.

**★ Why does the TypeScript plugin key on prop names ending in `Action`?**
Because a Server Function's type is indistinguishable from a plain function's type — both are `(args) => Promise<T>` — and only one of them can cross the boundary. There is no type-level marker to check, so the plugin falls back to a naming convention: a function-typed prop on a Client Component is allowed when its name is `action` or ends in `Action`, and flagged otherwise. It is a lint heuristic, not a guarantee. Naming a plain closure `onSelectAction` silences the plugin and still throws at runtime.

**★ What is the cost of passing a large array of server data to a Client Component?**
It is paid twice and it is permanent. Once as rendered HTML for the initial paint, once as serialized props inside the RSC payload that ships in the same document, and again in the payload of every navigation that re-renders that subtree. Passing rendered children instead pays only for the markup. That is why "lift the client boundary up and pass rendered output down" is a performance decision as much as an architectural one.

**★ Can you pass a `Map` across the boundary? Should you?**
You can — `Map` and `Set` are both on React's serializable list, along with `Date`, typed arrays and `ArrayBuffer`. Whether you should depends on what the Client Component does with it. A `Map` reconstructed from a payload is a new object on the other side, so anything that depends on referential identity across renders will misbehave; and if you are passing a `Map` because the client needs to look rows up by id, you are usually about to build a client-side cache of server state, which is the drift bug in [01c](01e-the-stale-mirror-and-the-drifting-store.md).

---

← [01b · The categories the table omits](01b-the-categories-the-table-omits.md) · [Chapter 8 overview](01-explanation.md) · Next → [01d · Request scope versus process scope](01d-request-scope-versus-process-scope.md)
