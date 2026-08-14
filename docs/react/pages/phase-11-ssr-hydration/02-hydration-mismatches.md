---
title: "Hydration mismatches"
sidebar_label: "02 · Hydration mismatches"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) — the caveats,
> the documented list of common causes, the consequences of not fixing them,
> `suppressHydrationWarning`, and the `isClient` two-pass pattern.
> No sandbox script backs this page; claims are cited, not measured.

**Hydration assumes the server's HTML and the client's first render agree.** When they do
not, React tells you — and the sentence in the docs that matters most is not the warning
text, it is what happens if you ignore it.

## The contract

> **`hydrateRoot()` expects the rendered content to be identical with the server-rendered
> content. You should treat mismatches as bugs and fix them.**
>
> **The React tree you pass to `hydrateRoot` needs to produce the same output as it did on
> the server.**

Not "similar". **Identical.** React is not diffing the server's HTML against a fresh render
and reconciling the difference — it is attaching to markup it assumes is already correct.

> **In development mode, React warns about mismatches during hydration. There are no
> guarantees that attribute differences will be patched up in case of mismatches. This is
> important for performance reasons because in most apps, mismatches are rare, and so
> validating all markup would be prohibitively expensive.**

🔴 **"No guarantees that attribute differences will be patched up."** That is the design
decision behind the whole topic: React deliberately does not verify everything, because
verifying everything would cost as much as re-rendering. You are trusted to have got it
right.

## 🔴 Why "it still renders fine" is not a defence

> **React recovers from some hydration errors, but you must fix them like other bugs. In the
> best case, they'll lead to a slowdown; in the worst case, event handlers can get attached
> to the wrong elements.**

Two named consequences, and the second is the one to quote in a code review. **An `onClick`
can end up on the wrong element.** A mismatch is not cosmetic and it is not confined to
development — a page that "looks fine" can have its Delete button wired to the row above.

## The documented causes

react.dev lists them, and they are worth memorising in this order because that is roughly
how often you meet them:

> - **Extra whitespace (like newlines) around the React-generated HTML inside the root node.**
> - **Using checks like `typeof window !== 'undefined'` in your rendering logic.**
> - **Using browser-only APIs like `window.matchMedia` in your rendering logic.**
> - **Rendering different data on the server and the client.**

### 1. Whitespace around the root

The one nobody suspects, because it is in the HTML template rather than in React.

```html
<!-- ✖ the newline and indentation are text nodes inside #root -->
<div id="root">
  <!--ssr-->
</div>

<!-- ✅ -->
<div id="root"><!--ssr--></div>
```

It costs an afternoon precisely because the React code is innocent.

### 2. `typeof window !== 'undefined'` in render

The intuitive fix for "this only works in the browser", and it is the bug:

```jsx
// ✖ server renders one branch, client's FIRST render produces the other
function Nav() {
  return typeof window !== 'undefined' ? <MobileNav /> : <DesktopNav />;
}
```

The check is honest about the environment and dishonest about *timing*: hydration's first
client render must reproduce **the server's** output, not the browser's eventual one.

### 3. Browser-only APIs during render

`window.matchMedia`, `localStorage`, `navigator`, element measurements — same problem in a
different costume. They are unavailable on the server and give real answers on the client, so
the two renders diverge by construction.

### 4. Different data on each side

The broad category:

- **`new Date()` and `Date.now()`** — different by definition. Any rendered timestamp,
  "2 minutes ago" label, or copyright year computed at render time.
- **`Math.random()`** and anything seeded from it, including generated ids.
- **Locale and timezone** — `toLocaleDateString()` formats with the *server's* locale and
  timezone on one side and the *user's* on the other. This one ships to production happily
  and then breaks for one region.
- **Data that changed between the two renders** — a request-time fetch on the server and a
  cached value on the client.

⚠️ **Invalid HTML nesting belongs here too**, and it is worth calling out separately because
the error looks unrelated: a `<div>` inside a `<p>`, or a `<p>` inside a `<p>`, is
*repaired by the browser's parser* before React ever sees it. The server sent valid-looking
markup, the browser restructured it, and now the DOM does not match what React expects.

**Browser extensions** cause the same class of failure by injecting attributes and elements
into the page before hydration. You cannot fix those; you can recognise them by their
disappearance in a clean profile.

## Fixing each

| Cause | Fix |
|---|---|
| Whitespace around the root | close the tag up; no newline inside `#root` |
| `typeof window` in render | render the server's branch first, switch in an effect ([topic 05](05-suppresshydrationwarning.md)) |
| Browser API in render | read it in `useEffect`, or `useSyncExternalStore` with a server snapshot |
| `Date` / `Math.random` | pass a value from the server as a prop, or render it after mount |
| Locale / timezone | format on one side only — pick the client, after mount |
| Invalid nesting | fix the HTML; check what the parser actually produced |
| Extension interference | reproduce in a clean profile before investigating |

**The pattern behind every row:** decide *which* render is authoritative for that value —
usually the server's — and make the client's first render agree with it, changing afterwards
if you must.

## The escape hatches, and their price

Two exist, both covered in [topic 05](05-suppresshydrationwarning.md), both quoted here
because they belong to the diagnosis:

> To silence hydration warnings on an element, add `suppressHydrationWarning={true}`. **This
> only works one level deep, and is intended to be an escape hatch. Don't overuse it. React
> will not attempt to patch mismatched text content.**

And the two-pass render — an `isClient` state set in an effect:

> **This approach makes hydration slower because your components have to render twice.**

Neither is free, and neither is a fix for a bug. They are for content that is *genuinely*
client-only.

## Gotchas

**Symptom:** a mismatch warning appears and the page looks perfect.
**Cause:** React recovered.
**Fix:** still a bug. Best case a slowdown, worst case handlers attached to the wrong
elements.

**Symptom:** the warning points at a component whose code is obviously deterministic.
**Cause:** whitespace inside the root element, or invalid nesting the parser repaired.
**Fix:** look at the HTML template and the actual parsed DOM, not just the component.

**Symptom:** a timestamp mismatches every reload.
**Cause:** `new Date()` during render.
**Fix:** pass the server's value as a prop, or render the formatted value after mount.

**Symptom:** it works locally and breaks for users in another timezone.
**Cause:** `toLocaleDateString()` uses the server's locale on one side and the user's on the
other.
**Fix:** format on one side only.

**Symptom:** `typeof window !== 'undefined'` was used to "fix" a crash and caused a mismatch.
**Cause:** the client's first render must match the **server's** output, not the browser's
eventual one.
**Fix:** render the server branch first and switch in an effect.

**Symptom:** mismatches only for some users, and irreproducible.
**Cause:** a browser extension modified the DOM before hydration.
**Fix:** reproduce in a clean profile before spending time on it.

**Symptom:** `suppressHydrationWarning` was added and a child still warns.
**Cause:** it only works one level deep.
**Fix:** it is an escape hatch, not a silencer — fix the cause.

## Interview questions

**★ What is a hydration mismatch, and why does it matter if the page looks right?**
It is the server's HTML disagreeing with the client's first render, when `hydrateRoot`
requires them to be **identical**. It matters because React makes no guarantee that
attribute differences are patched up — validating all markup would be prohibitively
expensive — so in the best case you get a slowdown and in the worst case **event handlers
attached to the wrong elements**.

**★ Name the documented causes.**
Extra whitespace around the React-generated HTML inside the root node; `typeof window`-style
checks in rendering logic; browser-only APIs like `window.matchMedia` used during render; and
rendering different data on the server and the client. To that list add invalid HTML nesting,
which the browser's parser silently repairs before React sees it, and browser extensions,
which you cannot fix.

**★ Why is `typeof window !== 'undefined'` in render a bug rather than a guard?**
Because it is honest about environment and wrong about timing. The client's **first** render
during hydration has to reproduce the server's output; taking a different branch guarantees
divergence. Render the server's branch first and switch in an effect.

**★ Why is a locale-formatted date a classic mismatch?**
Because `toLocaleDateString()` resolves against the server's locale and timezone on one side
and the user's on the other. It passes every local test and breaks for one region in
production — which is what makes it worth naming specifically rather than filing under
"different data".

**What are the escapes, and what do they cost?**
`suppressHydrationWarning`, which works **only one level deep**, is explicitly an escape
hatch, and does not make React patch mismatched text; and a deliberate two-pass render with
an `isClient` flag set in an effect, which the docs say **makes hydration slower because
components render twice**. Both are for genuinely client-only content, not for silencing a
bug.

**Where do you start when the warning names an innocent component?**
The HTML template, for whitespace inside the root, and the parsed DOM, for nesting the
browser repaired. Both produce mismatches whose warning points somewhere that looks
blameless.

---

← Prev: [CSR vs SSR vs SSG vs streaming vs RSC](01-csr-ssr-ssg-streaming-rsc.md) ·
Index: [Phase 11](README.md) ·
Next → [The three server renderers](03-the-server-renderers.md)
