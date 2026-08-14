---
title: "suppressHydrationWarning and the two-pass render"
sidebar_label: "05 · The two escapes"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) — the
> "Suppressing unavoidable hydration mismatch errors" and "Handling different client and
> server content" sections, including the `isClient` example and its stated cost.
> No sandbox script backs this page; claims are cited, not measured.

**Two escapes, and both are for content that is *genuinely* client-only.** Neither is a fix
for a mismatch you could have prevented ([topic 02](02-hydration-mismatches.md)) — reaching
for them first is how a real bug gets buried.

## Escape 1 — `suppressHydrationWarning`

```jsx
<h1 suppressHydrationWarning={true}>
  Current Date: {new Date().toLocaleDateString()}
</h1>
```

> **This only works one level deep, and is intended to be an escape hatch. Don't overuse it.
> React will not attempt to patch mismatched text content.**

Three separate limits in one sentence, and each matters:

- **One level deep.** It covers *this* element's own content. A mismatching child still
  warns, and adding it to a wrapper does nothing for the tree below.
- **An escape hatch.** The docs' own framing.
- **🔴 React will not patch the text.** This is the part people misread. It does not
  reconcile the difference — **the server's text stays on screen** until something else
  causes a re-render. You suppressed the *warning*, not the *mismatch*.

That last point decides when it is honest. It is right when the difference does not matter
and the server's value is acceptable to display — a timestamp that will be replaced a moment
later, an element whose text a third party rewrites. It is wrong whenever the client's value
is the correct one, because the user keeps seeing the server's.

## Escape 2 — the deliberate two-pass render

Render what the server rendered, then switch after mount:

```jsx
import { useState, useEffect } from "react";

export default function App() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return <h1>{isClient ? 'Is Client' : 'Is Server'}</h1>;
}
```

The mechanism is exact: `useState(false)` makes the **first** client render match the server,
and the effect — which never runs on the server — flips it afterwards. There is no mismatch
because at the moment hydration compares, both sides agree.

### What it costs, in the docs' own words

> **This approach makes hydration slower because your components have to render twice. Be
> mindful of the user experience on slow connections. The JavaScript code may load
> significantly later than the initial HTML render, so rendering a different UI immediately
> after hydration may also feel jarring to the user.**

Two costs, and the second is the one teams underestimate. On a slow connection the gap
between HTML and hydration can be seconds, so a "flash of server content" is not a flicker —
it is a visible, readable, *wrong* UI that then changes under the user's eyes. Layout shift
is the usual symptom.

⚠️ **Which is why the server branch should be a neutral placeholder, not a wrong answer.**
Rendering `<DesktopNav />` on the server and swapping to `<MobileNav />` after hydration is
worse than rendering a skeleton of the right size and filling it in.

## Choosing between them

| | `suppressHydrationWarning` | Two-pass render |
|---|---|---|
| The mismatch | still there, unpatched | **eliminated** |
| Which value shows | **the server's** | the server's, then the client's |
| Cost | none at runtime | an extra render, plus a visible swap |
| Reaches children | no — one level | yes, it is ordinary state |
| Right when | the server's value is acceptable | the client's value is the correct one |

**A useful rule:** if the server's value is *wrong*, suppression is the wrong tool, because
wrong is exactly what stays on screen.

## What neither is for

Both exist for content that cannot be the same on both sides. Neither is for:

- **A timestamp you could have passed as a prop.** Render it on the server, send the value
  down, format it identically.
- **Locale formatting.** Format on one side only, deliberately.
- **`typeof window` branching.** That is the bug topic 02 names; the two-pass render is its
  fix, but only after you have accepted the double render as a real cost.
- **Invalid HTML nesting.** Suppression will not help — the browser restructured the DOM
  before React saw it.
- **A browser extension.** Nothing you write fixes that.

## A third option worth knowing

For a value that genuinely differs between server and client and that you read from an
external source, `useSyncExternalStore` takes a **server snapshot** as its third argument —
so the server renders the snapshot and the client subscribes to the live value, with no
mismatch and no second render of the whole subtree
([Phase 7 · external stores](../phase-7-custom-hooks/03-share-logic-not-state/04-external-stores.md)).
It is the tidiest answer for things like a media query or a theme preference.

## Gotchas

**Symptom:** `suppressHydrationWarning` added and the wrong text is still displayed.
**Cause:** it suppresses the warning; React **does not patch mismatched text content**.
**Fix:** if the client's value is the correct one, use the two-pass render instead.

**Symptom:** it was added to a parent and a child still warns.
**Cause:** it only works one level deep.
**Fix:** it is not a subtree switch. Fix the child.

**Symptom:** a visible flash of the wrong UI seconds after load.
**Cause:** the two-pass render swapping content after hydration, on a slow connection.
**Fix:** make the server branch a neutral placeholder of the right size, not a wrong answer.

**Symptom:** hydration got measurably slower after adopting `isClient`.
**Cause:** documented — components have to render twice.
**Fix:** scope the flag to the smallest component that needs it, not the app root.

**Symptom:** suppression is spreading through the codebase.
**Cause:** it is being used to silence real mismatches.
**Fix:** each one is a bug with a cause in topic 02's list.

## Interview questions

**★ What does `suppressHydrationWarning` actually do?**
It silences the mismatch warning for **one element, one level deep**. It does **not** make
React reconcile the difference — the docs say React will not attempt to patch mismatched text
content — so the server's value stays on screen. It is explicitly an escape hatch.

**★ When is suppression the wrong choice?**
Whenever the client's value is the correct one, because the server's is what remains
displayed. Suppression is honest only when the difference does not matter or the server's
value is acceptable.

**★ How does the two-pass render avoid a mismatch, and what does it cost?**
`useState(false)` makes the first client render reproduce the server's output, and an
effect — which never runs on the server — flips it afterwards, so the two sides agree at the
moment hydration compares. The cost is that **components render twice**, plus a visible swap
that on a slow connection can be seconds later and feels jarring.

**What is the design rule for the server branch in a two-pass render?**
Make it a neutral placeholder of the right size rather than a plausible wrong answer.
Rendering a desktop nav and swapping to a mobile one shows the user something incorrect for
as long as the bundle takes to arrive; a skeleton does not.

**Is there a better option than either?**
Often, yes — `useSyncExternalStore` takes a server snapshot as its third argument, so the
server renders the snapshot and the client subscribes to the live value with no mismatch and
no double render of the subtree. It is the cleanest answer for media queries and similar.

---

← Prev: [`hydrateRoot`](04-hydrateroot.md) ·
Index: [Phase 11](README.md) ·
Next → [Streaming SSR with Suspense](06-streaming-ssr.md)
