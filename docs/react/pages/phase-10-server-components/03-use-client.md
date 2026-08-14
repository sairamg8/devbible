---
title: "'use client'"
sidebar_label: "03 · 'use client'"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`'use client'`](https://react.dev/reference/rsc/use-client) — the caveats, the
> "Building with interactivity and state", "Using client APIs" and "Using third-party
> libraries" sections, including the exact list of React APIs that force a component onto
> the client.
> No sandbox script backs this page; claims are cited, not measured.

**`'use client'` does not mean "this file is a component". It marks an entry point into the
client graph** — a door, with everything behind it. [Topic 02](02-two-module-graphs.md)
established the mechanism; this topic is about where to put the directive, when you
genuinely need it, and what it costs when you put it in the wrong place.

## The placement rules, briefly

> **`'use client'` must be at the very beginning of a file, above any imports or other code
> (comments are OK). They must be written with single or double quotes, but not backticks.**

Three failure modes, all quiet: after an import, in backticks, or pushed down by a
license-header or codegen tool. The file stays in the server graph and you get a hooks error
somewhere else entirely.

```js
// ✅ comments above are fine
'use client';

import { useState } from 'react';
```

## When you genuinely need it

### State and event handlers

> **As `Counter` requires both the `useState` Hook and event handlers to increment or
> decrement the value, this component must be a Client Component and will require a
> `'use client'` directive at the top.**

This is the ordinary case, and the important half is the sentence that follows it:

> **In contrast, a component that renders UI without interaction will not need to be a
> Client Component.**

### Browser APIs

> **Your React app may use client-specific APIs, such as the browser's APIs for web storage,
> audio and video manipulation, and device hardware, among others.** … **Since those APIs
> are only available in the browser, it must be marked as a Client Component.**

`localStorage`, `IntersectionObserver`, `matchMedia`, the media element APIs, anything on
`navigator` — the environment argument from
[topic 01](01-what-a-server-component-is/README.md) applies directly.

### 🔴 The React APIs that force it

react.dev gives a precise list, and it is worth memorising because it is what you check a
dependency against:

> **Third-party components that use any of the following React APIs must run on the client:
> `createContext`, `react` and `react-dom` Hooks (excluding `use` and `useId`),
> `forwardRef`, `memo`, `startTransition`, and if they use client APIs.**

| Forces the client | Does **not** |
|---|---|
| `createContext` | `use` |
| every `react` / `react-dom` hook… | …**except** `use` and `useId` |
| `forwardRef` | plain function components |
| `memo` | `async` components |
| `startTransition` | rendering JSX, reading props |
| any browser API | |

Two entries deserve a second look. **`memo` and `forwardRef` are on the list** — neither has
anything to do with interactivity, yet either one is enough to pull a module into the client
graph. And **`use` and `useId` are the two exceptions**: `use` is how a Client Component
consumes a promise created on the server ([topic 08](08-async-components.md)), and `useId`
produces stable ids across the boundary, so both are usable from server code.

## When you do not need it

> **There are also components that don't use any server or client-only features and can be
> agnostic to where they render… In this case, we don't add the `'use client'` directive,
> resulting in `FancyText`'s *output* (rather than its source code) to be sent to the browser
> when referenced from a Server Component.**

🔴 **"Output rather than source code" is the sentence to keep.** A presentational component
with no state, no handlers and no browser API is not neutral about the directive — leaving it
off means the browser receives the rendered result and never the component. Add
`'use client'` "just in case" and you have converted rendered output into shipped JavaScript
for no behavioural gain.

Note the asymmetry with topic 02's caveat: an agnostic component *can* still end up in the
client graph if a client module imports it, and then its source does ship. Agnostic means
"decided by the importer", not "never client".

### The parent almost never needs it

> **For example, `Counter`'s parent component, `CounterContainer`, does not require
> `'use client'` as it is not interactive and does not use state. In addition,
> `CounterContainer` must be a Server Component as it reads from the local file system on the
> server, which is possible only in a Server Component.**

```jsx
// CounterContainer.js — no directive
import { readFile } from 'node:fs/promises';
import Counter from './Counter';        // Counter.js has 'use client'

export default async function CounterContainer() {
  const initialValue = await readFile('/path/to/counter_value');
  return <Counter initialValue={initialValue} />;
}
```

The container reads a file, `await`s, and hands a **serializable** prop to the interactive
leaf. Interactivity below, data access above, boundary exactly at the join. That shape is the
whole of [topic 11](11-where-interactivity-goes.md).

## Third-party libraries

> **If these libraries have been updated to be compatible with React Server Components, then
> they will already include `'use client'` markers of their own, allowing you to use them
> directly from your Server Components.**

So a modern, RSC-aware package needs nothing from you: it marks its own entry points and you
import it from a Server Component as normal.

> **If a library hasn't been updated, or if a component needs props like event handlers that
> can only be specified on the client, you may need to add your own Client Component file in
> between the third-party Client Component and your Server Component where you'd like to use
> it.**

Two distinct reasons, and the second catches people using perfectly modern libraries:

```jsx
// ChartClient.js — your file, one line of ceremony
'use client';
export { Chart } from 'some-charting-lib';
```

```jsx
// HandlerWrapper.js — the second reason: the handler must be defined client-side
'use client';
import { Widget } from 'some-widget-lib';

export function ClickableWidget({ label }) {
  return <Widget label={label} onClick={() => console.log('clicked')} />;
}
```

A Server Component cannot write that `onClick` — a function is not serializable
([topic 05](05-what-crosses-the-boundary.md)) — so the handler has to be authored inside the
client graph. The wrapper is not a workaround; it is where the handler legitimately lives.

⚠️ **Re-exporting is not free.** `export { Chart } from 'some-charting-lib'` puts the whole
resolved module — and its dependencies — in the client graph. Re-export the specific entry
point, not the package index, or you ship the library's entire surface to browsers.

## The cost model, stated plainly

Each `'use client'` file is an **entry point**, and the bundler ships its transitive closure
([topic 02](02-two-module-graphs.md)). Two consequences worth holding:

- **Height in the tree is the cost driver.** A directive on a page pulls the page's whole
  import subtree; the same directive on a button pulls a button. Nothing else about the two
  files differs.
- **Count is not the enemy.** Many small client entry points are usually *cheaper* than one
  high one, because each closure is small and shared dependencies deduplicate. "Reduce the
  number of `'use client'` files" is the wrong optimisation; "lower each one" is the right
  one.

## Gotchas

**Symptom:** a hooks error in a file that clearly has `'use client'` at the top.
**Cause:** it is not at the *very* top — an import, a header comment block that emits code,
or backticks instead of quotes.
**Fix:** check the first non-comment line and the quote characters.

**Symptom:** a library component throws about hooks or context when rendered from a Server
Component.
**Cause:** it uses `createContext`, a hook, `forwardRef`, `memo` or `startTransition`, and
the package has not been updated to mark its own entry points.
**Fix:** add a one-line `'use client'` re-export file of your own between it and the Server
Component.

**Symptom:** the library *is* RSC-aware and it still fails.
**Cause:** the second reason in the docs — you are passing a prop, such as an event handler,
that can only be specified on the client.
**Fix:** wrap it in your own Client Component and define the handler there.

**Symptom:** a purely presentational component was marked `'use client'` "for safety" and the
bundle grew.
**Cause:** without the directive, only its *output* reaches the browser; with it, its source
does.
**Fix:** remove the directive. Agnostic components should stay agnostic.

**Symptom:** wrapping a library in a client file pulled in far more than expected.
**Cause:** re-exporting the package index puts the whole resolved module graph in the client
subtree.
**Fix:** re-export the specific submodule you use.

**Symptom:** `useId` or `use` was assumed to require `'use client'`.
**Cause:** they are the two documented exceptions to the hooks rule.
**Fix:** neither forces a client boundary; `use` in particular is how a client leaf consumes
a promise created on the server.

## Interview questions

**★ What does `'use client'` actually mark?**
An **entry point into the client graph** — not "this file is a component". It creates a
boundary in the module dependency tree, and everything reachable by import from that file is
sent to and run by the client. That is why *where* you put it matters far more than how many
times you put it.

**★ Which React APIs force a component onto the client?**
`createContext`, all `react` and `react-dom` hooks **except `use` and `useId`**, `forwardRef`,
`memo`, `startTransition` — and any browser API. `memo` and `forwardRef` are the two that
surprise people, because neither implies interactivity and either is enough on its own.

**★ What happens to a component that has no directive and needs no client feature?**
It stays agnostic, and when a Server Component renders it, its **output** rather than its
source code is sent to the browser. Adding `'use client'` "just in case" converts free
rendered output into shipped JavaScript. But agnostic means decided by the importer — a
client-graph importer still pulls its source in.

**★ A third-party component throws when you render it from a Server Component. Why, and what
do you do?**
Either it uses one of the client-forcing React APIs and the package has not been updated to
include its own `'use client'` markers, or it needs a prop — typically an event handler —
that can only be specified on the client. Both are fixed the same way: a Client Component
file of your own in between. Re-export the specific entry point rather than the package
index, or you pull the whole library into the client graph.

**Is it better to have fewer `'use client'` files?**
No — it is better to have *lower* ones. The cost is each entry point's transitive closure, so
a directive on a page is expensive and the same directive on a button is not. Many small
client entry points typically beat one high one, since the closures are small and shared
dependencies deduplicate.

**Why does the parent of a Client Component usually not need the directive?**
Because it is not interactive. The documented shape is a Server Component that reads data —
from the filesystem or a database, which only a Server Component can do — and passes a
serializable prop down to the interactive leaf. Interactivity below, data access above, the
boundary exactly at the join.

---

← Prev: [The two module graphs](02-two-module-graphs.md) ·
Index: [Phase 10](README.md) ·
Next → [`'use server'`](04-use-server.md)
