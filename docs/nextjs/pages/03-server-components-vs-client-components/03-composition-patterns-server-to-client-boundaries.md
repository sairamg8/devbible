---
title: "Every composition pattern in the App Router is a variation on one rule — a Client Component may not import a Server Component, but it may receive one as a prop, and the fix for almost every boundary problem is turning an import into a prop"
sidebar_label: "03 · Composition patterns"
sidebar_position: 3
description: "The pattern catalogue for server-to-client boundaries: children-as-slots, named slots, the serializable-props rule and what counts, why prop-drilling is not the answer, and the cases where no pattern helps and you must move the boundary instead."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (page header `version: 16.3.4`, `lastUpdated` 2026-08-25), via research banked for this track on 2026-09-04.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.
> ⚠️ The boundary *rule* itself is established in [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md). This page assumes it and covers the patterns built on top.

**Once you know that `'use client'` marks a module-graph boundary, every composition question in the App Router reduces to a single decision: does this component arrive by `import` or by prop? Imports cross into the client bundle; props do not. Almost every "I can't do this in the App Router" problem is an import that should have been a prop, and this page is the catalogue of what that looks like in practice — plus the cases where no amount of rearranging helps and the boundary itself is in the wrong place.**

## The rule, restated as a decision

| Client Component wants to… | Allowed? | Why |
|---|---|---|
| `import` a Server Component | **No, in effect** | The import pulls it into the client module graph, so it stops being a Server Component |
| Receive one via `children` | **Yes** | Not in the module graph; rendered on the server, passed as output |
| Receive one via a named prop | **Yes** | Same mechanism as `children` — nothing special about the name |
| Receive a function prop | **No** | Props cross inside the RSC payload and must be serializable |
| Receive a Server Action | **Yes** | Encoded as a reference, not a value |

⚠️ **"Not allowed" is worth stating precisely, because a common phrasing gets it wrong.** Importing a Server Component into a Client Component does not raise "you may not do this". It *silently makes it a Client Component* — it joins the client module graph along with everything it imports. The failure is not an error; it is a component you believed was server-side now shipping to the browser, with any server-only code inside it breaking at a different, more confusing point.

## Pattern 1 — children as a slot

The workhorse. A Client Component owns behaviour; the content is passed in.

```tsx
// app/ui/tabs.tsx
'use client'
import { useState } from 'react'

export function Tabs({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div role="tablist">{/* buttons; client state lives here */}</div>
      {children}
    </div>
  )
}
```

```tsx
// app/page.tsx — a Server Component
import { Tabs } from './ui/tabs'
import { Report } from './ui/report'   // Server Component; queries the DB

export default function Page() {
  return (
    <Tabs>
      <Report />        {/* stays server-side, ships no JS */}
    </Tabs>
  )
}
```

`Report` renders on the server and arrives as output. **The `import` of `Tabs` is a client import; the `import` of `Report` sits in a server file, so it stays server.** The direction of the import is what matters, not the fact that one exists.

## Pattern 2 — named slots, for more than one region

`children` is not special. Any prop works, which matters as soon as a component has two or three regions:

```tsx
// app/ui/split-pane.tsx
'use client'
export function SplitPane({
  left, right,
}: { left: React.ReactNode; right: React.ReactNode }) {
  const [ratio, setRatio] = useState(0.5)   // the only client concern
  return <div><aside>{left}</aside><main>{right}</main></div>
}
```

```tsx
// app/page.tsx
<SplitPane left={<Filters />} right={<Results />} />   // both Server Components
```

🔴 **Note the type: `React.ReactNode`, not `React.ComponentType`.** You pass *rendered elements*, not component references. `left={Filters}` would be passing a function — unserializable, and the error message points at serialization rather than at the real mistake.

## Pattern 3 — the provider, which looks like an exception and is not

React context is not supported in Server Components, so a provider must be a Client Component. People conclude that wrapping the app in one makes the app client-side. It does not, because a provider takes `children`:

```tsx
// app/layout.tsx — Server Component
import ThemeProvider from './theme-provider'   // 'use client'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body><ThemeProvider>{children}</ThemeProvider></body></html>
}
```

Everything under `{children}` still renders on the server. The documented advice is to *"render providers as deep as possible in the tree"* — but that is an optimisation argument (it helps Next.js optimise the static parts around it), not a correctness one. Hoisting a provider to the root is a cost, not a bug.

## Pattern 4 — interleaving, which is the pattern people believe is impossible

Because slots nest, server and client can alternate down the tree as many times as you like:

```tsx
// Server → Client → Server → Client
<Modal>                    {/* client: open/close state */}
  <Cart>                   {/* server: queries the DB */}
    <QuantityStepper />    {/* client: buttons */}
  </Cart>
</Modal>
```

`Cart` is a Server Component rendered *inside* a Client Component and it can still hit the database, because `Modal` never imported it — `page.tsx` did, and passed it in. **There is no depth limit and no alternation limit.** The constraint is only ever about the direction of imports.

## The serializable-props rule, concretely

Props travel inside the RSC payload, so they must survive serialization. In practice:

| Passes | Does not pass |
|---|---|
| strings, numbers, booleans, `null` | functions and callbacks |
| plain objects and arrays of the above | class instances |
| `Date`, `Map`, `Set` (React-serializable) | anything with methods you intend to call |
| JSX elements (the slot patterns above) | Symbols (except registered ones) |
| Server Actions | Promises you expect the client to `await` without `use` |

The most common casualty is an ORM result object. `db.user.findFirst()` frequently returns a model instance rather than a plain object, and passing it straight into a Client Component fails at the boundary rather than at the query:

```tsx
// ❌ a model instance is not a plain object
const user = await db.user.findFirst()
return <Profile user={user} />

// ✅ project to exactly what the client needs — smaller payload, and it serializes
const user = await db.user.findFirst({ select: { id: true, name: true, avatarUrl: true } })
return <Profile user={user} />
```

🔴 **Selecting fields is the right fix, not a workaround.** Every prop you pass is serialized into the payload and sent over the wire — passing a whole row to render a name is a bandwidth cost on every request as well as a serialization risk.

## When no pattern helps: move the boundary

Some cases genuinely cannot be composed, and recognising them saves hours:

- **A Client Component must decide *whether* to fetch, based on client state.** A slot is rendered eagerly by the server parent; it cannot be conditionally produced by client logic. Either fetch it anyway and let the client hide it, or move the fetch to a Route Handler the client calls.
- **A client hook needs server data on every keystroke.** Slots are per-render, not per-interaction. That is a Server Action or a Route Handler.
- **A third-party client component wants a component reference**, not an element — a `renderItem={Component}` API. That is a function prop; wrap it on the client side instead.

**The tell is the same in all three: you want the *server* to react to *client* state.** Slots flow one way — server renders, client receives. When you need the other direction, the answer is a request (Server Action or Route Handler), not a composition pattern.

## Gotchas

**★ Symptom: a Server Component that queries the database "became" a Client Component and now errors about server-only code.** Cause: a Client Component imported it. The import does not raise "not allowed" — it silently pulls the component into the client module graph, and the failure surfaces later at whatever server-only thing it touches. Fix: pass it as a prop from a server parent instead of importing it.

```tsx
// ❌ inside a 'use client' file
import { Report } from './report'        // Report is now client code
// ✅ in the server page
<Tabs><Report /></Tabs>                  // Report stays server
```

**★ Symptom: `Functions cannot be passed directly to Client Components`, on a prop you thought was a component.** Cause: passing a component *reference* rather than an element — `left={Filters}` instead of `left={<Filters />}`. A reference is a function. Fix: pass the element, and type the prop `React.ReactNode` rather than `React.ComponentType`, so the mistake is a type error rather than a runtime one.

**★ Symptom: an ORM result fails to serialize at the boundary although the query succeeded.** Cause: many ORMs return model instances, not plain objects, and only plain data survives the RSC payload. Fix: `select` exactly the fields the client needs. This also shrinks the payload, so it is the correct fix rather than a workaround.

**★ Symptom: the whole app is client-rendered because a context provider is at the root.** Cause: assuming a Client Component makes its subtree client. It does not — the provider receives `children`, which still render on the server. Fix: keep the provider; render it as deep as is practical. The depth advice is about letting Next.js optimise the static parts, not about correctness.

**★ Symptom: a Client Component needs to fetch based on user input and no slot arrangement works.** Cause: trying to make the server react to client state. Slots are rendered once by the server parent; they cannot be produced conditionally by client logic. Fix: stop composing and make a request — a Server Action or a Route Handler.

**Symptom: a `children` slot renders but its data is stale after a client interaction.** Cause: the slot was rendered by the server on the last server render; client state changes do not re-render it. Fix: if it must update with client state, it is not a slot — it is a request.

**Symptom: passing a `Date` works but a custom class with methods does not.** Cause: serialization preserves data, not behaviour. React handles `Date`, `Map` and `Set`; a class instance loses its prototype. Fix: pass the data and put the behaviour in a function the client already has.

**Symptom: two sibling slots both fetch the same record.** Cause: each Server Component fetches independently, which is the intended design. Fix: this is usually fine — request memoization deduplicates identical `GET` fetches within one render. Verify the calls are genuinely identical, including options, before restructuring.

## Interview questions

**★ Can a Client Component render a Server Component? Answer precisely.**
It cannot import one, and it can receive one. The distinction is the module graph: an import pulls the component into the client bundle, so it stops being a Server Component; a prop does not, because the component is rendered on the server and passed in as output. So the pattern is a Client Component with a `children` or named slot, filled by a server parent. Precision matters here because the common phrasing — "you're not allowed to" — implies an error, and there isn't one. The import silently converts the component, and you find out later when its server-only code breaks somewhere confusing.

**★ What can and cannot be passed as a prop across the boundary?**
Anything React can serialize into the RSC payload: strings, numbers, booleans, null, plain objects and arrays, `Date`, `Map`, `Set`, and JSX elements — which is what makes the slot patterns work. What fails is anything carrying behaviour: functions, callbacks, class instances. The exception is a Server Action, which is passed as a reference the runtime encodes rather than as a value. The most common real-world casualty is an ORM model instance; the fix is to `select` the fields you need, which is also better for payload size.

**★ How deeply can server and client components alternate?**
Without limit. `Modal` (client) containing `Cart` (server) containing `QuantityStepper` (client) is fine, and so is continuing further down. The constraint is never depth or alternation — it is only ever the direction of imports at each step. `Cart` can query the database inside a client `Modal` because `Modal` never imported it; the server page did, and passed it in.

**Someone says wrapping the app in a context provider makes everything client-rendered. Are they right?**
No. The provider itself must be a Client Component, since React context is not supported in Server Components at all. But it receives `children`, and children are not in its module graph — they still render on the server. The docs do advise rendering providers as deep as possible, and it is worth knowing that is an optimisation argument: it makes it easier for Next.js to optimise the static parts of the surrounding Server Components. Hoisting one to the root costs you some optimisation, not correctness.

**A Client Component needs to fetch data based on what the user typed. Which composition pattern handles that?**
None, and recognising that quickly is the useful skill. Slots flow one way: the server renders them and the client receives them, once. Anything where the *server* must react to *client* state is outside what composition can express. That is a request — a Server Action or a Route Handler. The same tell covers the related cases: conditional fetching driven by client state, and per-keystroke server data.

**Why is `React.ReactNode` the right type for a slot prop rather than `React.ComponentType`?**
Because you pass rendered elements, not component references. `<Filters />` is an element and serializes; `Filters` is a function and does not. Typing the prop as `ReactNode` makes the wrong version a type error at the call site, where the mistake actually is. With `ComponentType` you get a runtime serialization error instead, and its message points at serialization rather than at the confusion between a component and an element.

---

← Prev [02 · `'use client'`: when and why to opt in](02-use-client-when-and-why-to-opt-in-interactivity-browser-apis.md) · [Index](01-explanation.md) · Next → [04 · React 19.2 primitives](04-react-192-primitives-useeffectevent-for-non-reactive-side-ef.md)
