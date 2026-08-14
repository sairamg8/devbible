---
title: "Passing Server Components as children"
sidebar_label: "07 · Server Components as children"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) ("Adding
> interactivity to Server Components" and the note on how the bundler handles it) and
> [`'use client'`](https://react.dev/reference/rsc/use-client) (JSX elements on the
> serializable-props list).
> No sandbox script backs this page; claims are cited, not measured.

**The single most useful RSC technique, and it is a pattern you already know.** A Client
Component can wrap server-rendered content — a card, a modal, a collapsible panel, a tab
strip — without any of that content joining the client graph. The mechanism is
`children`, and the reason it works is that JSX elements are serializable.

## The problem it solves

You have a Server Component that reads a note from the database, and you want it inside a
collapsible panel that needs `useState`. The obvious move fails:

```jsx
// ✖ Expandable is a Client Component; importing Note pulls Note into the client graph
'use client';
import { useState } from 'react';
import Note from './Note';        // Note reads the database

export default function Expandable() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && <Note />}
    </div>
  );
}
```

A Client Component **cannot import a Server Component** — the import puts the module in the
client graph ([topic 02](02-two-module-graphs.md)), where its database access cannot run.
This is the composition rule [topic 10](10-composition-rules.md) states formally.

## The pattern

Invert it. The **Server Component** owns the composition, and the Client Component receives
already-rendered content as a prop:

```jsx
// Notes.js — Server Component, no directive
import Expandable from './Expandable';
import Note from './Note';

export default async function Notes() {
  const notes = await db.notes.findAll();
  return notes.map(note => (
    <Expandable key={note.id} title={note.title}>
      <Note note={note} />           {/* rendered on the server */}
    </Expandable>
  ));
}
```

```jsx
// Expandable.js — Client Component
'use client';
import { useState } from 'react';

export default function Expandable({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>{title}</button>
      {open && children}             {/* already-rendered output */}
    </div>
  );
}
```

react.dev describes exactly this arrangement:

> **This works by first rendering `Notes` as a Server Component, and then instructing the
> bundler to create a bundle for the Client Component `Expandable`. In the browser, the
> Client Components will see output of the Server Components passed as props.**

🔴 **"Will see output of the Server Components passed as props."** The Client Component
never receives `Note` — it receives what `Note` produced. `Note`, the database call and
whatever `Note` imports stay entirely on the server.

## Why it works: an element is data

JSX elements are on the serializable-props list ([topic 05](05-what-crosses-the-boundary.md)),
because an element is not code. It is a description — a type reference plus props — and a
Server Component's output is a tree of such descriptions.

Compare the two things that look similar and are not:

| | Import | Pass as a prop |
|---|---|---|
| What crosses | the **module** | the **rendered output** |
| Client graph gains | the component and its imports | nothing |
| Legal from a Client Component? | ✖ for a Server Component | ✅ |

That table is the whole topic. Everything else is where to apply it.

## `children` is not special — any prop works

`children` is the ergonomic choice, not a requirement. Any prop that takes an element does
the same job, which matters for layouts with several slots:

```jsx
// Server Component
<Layout
  sidebar={<Navigation />}         {/* Server Component output */}
  header={<UserBadge user={user} />}
>
  <Article slug={slug} />
</Layout>
```

`Layout` can be a Client Component with resizable panes and remembered widths, and none of
`Navigation`, `UserBadge` or `Article` enters the client graph.

⚠️ **The prop must hold an element, not a component.** `<Layout sidebar={Navigation}>`
passes the *function*, which is not serializable and fails
([topic 05](05-what-crosses-the-boundary.md)). `<Layout sidebar={<Navigation />}>` passes an
element, which is data. One pair of angle brackets is the difference between working and a
serialization error.

## What you can and cannot do with the children you receive

The Client Component holds output, not a component, so:

- ✅ **Render it, conditionally or repeatedly** — `{open && children}`, or in one branch of a
  tab strip.
- ✅ **Wrap it** in any amount of client-side markup, styling or animation.
- ✅ **Position it**, hide it with CSS, put it in a portal.
- ✖ **Re-render it with different props.** There is no component to call again. The props
  were fixed on the server.
- ✖ **Inspect or transform it meaningfully.** Treat it as opaque.

That last pair is the real constraint, and it is what decides whether the pattern fits. **If
the wrapper needs to *re-run* the inner content with new data, `children` is the wrong
tool** — that content depends on client state, so it belongs in the client graph, or the new
data has to come from a Server Function ([topic 09](09-calling-server-functions.md)) or a
fresh server render.

⚠️ **Conditional rendering is not lazy.** `{open && children}` skips *mounting* the output,
but the server already rendered it and it already arrived in the payload. The saving is DOM
work, not data fetching or bytes. If the content is expensive to produce and rarely opened,
it needs to be fetched on demand rather than passed as `children`.

## Why this is the technique to reach for first

Because it is what makes [topic 11](11-where-interactivity-goes.md) achievable. Without it,
every interactive wrapper drags its whole subtree into the browser, and `'use client'` climbs
towards the root one component at a time. With it, an interactive shell and server-rendered
content coexist at any depth, and the directive stays where it belongs — on the leaf that
owns the state.

## Gotchas

**Symptom:** "A Client Component cannot import a Server Component" — or the server-only
import fails at build time.
**Cause:** importing puts the module in the client graph.
**Fix:** invert the composition. Render the Server Component in a Server Component and pass
it as `children`.

**Symptom:** passing `sidebar={Navigation}` throws a serialization error.
**Cause:** that is a function, not an element.
**Fix:** `sidebar={<Navigation />}`.

**Symptom:** the wrapper needs to re-render its children with new props and cannot.
**Cause:** it received output, not a component; the props were fixed on the server.
**Fix:** either move that content into the client graph, or get new data from a Server
Function or a fresh server render.

**Symptom:** wrapping expensive content in `{open && children}` did not make the page
faster.
**Cause:** the content was rendered on the server and shipped regardless; the condition only
skips mounting.
**Fix:** fetch on demand instead of passing it in.

**Symptom:** the `children` of a Client Component still appear in the client bundle.
**Cause:** something in the client graph imports that component too — the graph is decided
by imports, not by this call site.
**Fix:** trace importers ([topic 02](02-two-module-graphs.md)).

## Interview questions

**★ How do you put server-rendered content inside an interactive Client Component?**
Compose it in the Server Component and pass the element down — usually as `children`. The
Client Component then receives the **output** of the Server Component as a prop rather than
the component itself, so the server code, its imports and its data access never enter the
client graph. react.dev states it directly: in the browser, Client Components see the output
of the Server Components passed as props.

**★ Why can a Client Component receive a Server Component but not import one?**
Because the graph is decided by imports. An import puts the module in the client subtree,
where server-only code cannot run. A prop carries a rendered **element**, which is data — a
type reference plus props — and elements are explicitly on the serializable list. Same
content, entirely different mechanism.

**★ What can the wrapper do with those children, and what can it not?**
It can render them conditionally or repeatedly, wrap them, position them, hide them, portal
them. It cannot re-render them with different props, because there is no component to call —
the props were fixed on the server. If the wrapper needs to re-run the content with new
data, this pattern is the wrong choice.

**Does `{open && children}` avoid the cost of the hidden content?**
Only the mounting cost. The server rendered it and it arrived in the payload either way, so
there is no saving in data fetching or bytes. Genuinely expensive, rarely opened content
should be fetched on demand.

**Is `children` special here?**
No — any prop that holds an element works the same way, which is what makes multi-slot
layouts possible. The one thing that matters is passing an *element*, `<Nav />`, not the
component function `Nav`; the latter is not serializable.

---

← Prev: [Server Function security](06-server-function-security/README.md) ·
Index: [Phase 10](README.md) ·
Next → [Async components](08-async-components.md)
