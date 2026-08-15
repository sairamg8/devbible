---
title: "Portals and SSR"
sidebar_label: "17 · Portals and SSR"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`createPortal`](https://react.dev/reference/react-dom/createPortal) (description, the
> `domNode` parameter, returns, the event-propagation caveat, and the "Rendering React
> components into non-React server markup" usage section), with
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) for the hydration
> constraint.
> **⬜ The `createPortal` reference does not discuss server rendering at all.** What follows is
> reasoned from its documented parameter contract, and says so at each step.
> No sandbox script backs this page; claims are cited, not measured.

**A portal is a placement instruction, not a rendering mode:**

> `createPortal` lets you render some children into a different part of the DOM.

> A portal only changes the physical placement of the DOM node. In every other way, the JSX you
> render into a portal acts as a child node of the React component that renders it.

Which is why portals and server rendering are awkward together — and why the awkwardness is not
a bug, and not something React documents a fix for.

## The argument, from the parameter contract

The whole topic follows from one sentence in the parameters:

> `domNode`: Some DOM node, such as those returned by `document.getElementById()`. **The node
> must already exist.**

Three steps, and none of them requires a claim the reference does not make:

1. `createPortal` requires **an actual DOM node**, and it must already exist.
2. **Server rendering produces an HTML string or a stream — there is no DOM and no `document`**
   to get a node from. That is what the server renderers in
   [topic 03](03-the-server-renderers.md) do.
3. Therefore there is nothing to pass, and no target to render into, during a server render.

🔴 **So the practical rule is: a portal's content is client-only.** Whatever you portal is not in
the HTML the server sends, and it cannot be, because its destination does not exist yet.

⬜ **Stated carefully, because the source is silent.** `createPortal`'s reference never mentions
server rendering, so this page does not put words in it. What it documents is the requirement
above, and the requirement is not satisfiable on the server. **This page does not assert what
React does if you try** — whether it throws, warns, or renders nothing — because no primary
source settles it and there is no run to appeal to.

## The mount-guard pattern

The pattern that follows is the standard one, and it is a consequence of the contract rather than
an API React provides: **render nothing until the component has mounted on the client, then
render the portal.**

```jsx
function Modal({children}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.getElementById('modal-root'));
}
```

**Why it works is the part worth understanding, and it is a hydration argument.** The server
renders `null`. The client's *first* render — the one hydration compares against the server's
HTML — also renders `null`, because the effect has not run yet. They match. Only afterwards does
the state flip and the portal appear, as an ordinary update.

⚠️ **The tempting shortcut is the broken one.** A guard like
`typeof document !== 'undefined'` produces `null` on the server and the portal on the client's
very first render, which is precisely the two-pass mismatch
[topic 02 · Hydration mismatches](02-hydration-mismatches.md) is about. The effect is doing
something specific here: it delays the difference until *after* hydration, where a difference is
allowed. Compare
[topic 05 · `suppressHydrationWarning` and the two-pass render](05-suppresshydrationwarning.md),
which is the same manoeuvre for content that genuinely differs.

**The cost is honest and worth naming:** portalled content is never in the server response. For a
modal or a toast that is usually right — nobody needs a closed dialog in their HTML, and a
crawler certainly does not. For anything a crawler or a no-JavaScript reader should see, a portal
is the wrong tool, and the fix is to render the content in place and position it with CSS.

## The target has to exist too

The same requirement bites a second time. `document.getElementById('modal-root')` returns `null`
if nothing rendered that element — and on a server-rendered page, the container usually lives in
the HTML template rather than in your React tree.

Two arrangements, both fine:

- **The container is in the server-rendered HTML** — a `<div id="modal-root">` in the document
  shell. The node exists before React ever runs.
- **The container is created on the client**, in the same effect that flips the mount flag, and
  appended to `document.body`.

⚠️ **What does not work is portalling into a node your own React tree renders later in the same
pass.** *"The node must already exist"* is not advice.

And a related caveat, documented: *"Passing a different DOM node during an update will cause the
portal content to be recreated."* A target computed inline, rather than held stable, remounts the
subtree — losing state and re-running effects.

## The thing people actually get wrong: events

> Events from portals propagate according to the React tree rather than the DOM tree. For
> example, if you click inside a portal, and the portal is wrapped in `<div onClick>`, that
> `onClick` handler will fire. If this causes issues, either stop the event propagation from
> inside the portal, or move the portal itself up in the React tree.

🔴 **This is the single most surprising thing about portals**, and it is the direct consequence of
*"acts as a child node of the React component that renders it"*. The DOM node is somewhere else;
the React parent is unchanged, so events *"still bubble up from children to parents according to
the React tree."*

A modal rendered inside a clickable card will trigger the card's `onClick` even though the modal
is a sibling of `<body>` in the DOM. React names both fixes: stop propagation inside the portal,
or move the portal higher in the React tree.

## The usage section that is not about SSR

`createPortal`'s reference has a section called *"Rendering React components into non-React
server markup"*, and the name misleads. It is about the opposite direction from this topic: a page
whose HTML was generated by something else — a template engine, a CMS — into which you mount
React components at specific nodes. **The React rendering there is entirely client-side.** It is
not React server rendering, and it says nothing about portals during SSR.

Worth knowing because it is the section a search lands you on when you ask this question.

## Gotchas

**Symptom:** a portal's content is missing from the server-rendered HTML.
**Cause:** the portal target must already exist as a DOM node, and there is no DOM during a
server render.
**Fix:** expected. Guard on mount; if the content must be in the HTML, do not use a portal.

**Symptom:** a hydration mismatch appears after adding a portal.
**Cause:** the guard used `typeof document`, so the client's first render differed from the
server's HTML.
**Fix:** flip a state flag in an effect instead, so the first client render still matches.

**Symptom:** `createPortal` gets `null` as its container.
**Cause:** `getElementById` ran before the element existed.
**Fix:** put the container in the document shell, or create it in the same effect that sets the
mount flag.

**Symptom:** clicking inside a modal triggers a handler on the card behind it.
**Cause:** documented — events propagate according to the **React** tree, not the DOM tree.
**Fix:** stop propagation inside the portal, or move the portal up in the React tree.

**Symptom:** portalled content remounts and loses its state on every render.
**Cause:** *"Passing a different DOM node during an update will cause the portal content to be
recreated."* The target is being recomputed.
**Fix:** hold the node in a ref or state, not in an expression evaluated each render.

**Symptom:** a portalled banner is invisible to search engines.
**Cause:** it is client-only by construction — it was never in the response.
**Fix:** render it in the tree and position it with CSS.

## Interview questions

**★ Why can't a portal render on the server?**
Because `createPortal` needs an existing DOM node as its target — *"The node must already
exist"* — and a server render produces a string or a stream with no DOM at all. Note that the
reference does not discuss SSR itself; this follows from the parameter contract.

**★ What is the mount-guard pattern, and why an effect rather than a `typeof document` check?**
Return `null` until a state flag set in an effect flips. It works because the server and the
client's first render both produce `null`, so hydration matches; the portal appears afterwards as
an ordinary update. A `typeof document` check differs on the first client render, which is a
hydration mismatch.

**★ Where do events from a portal bubble to?**
Up the **React** tree, not the DOM tree. A click inside a portal fires handlers on the React
ancestors that rendered it, even though the DOM node lives elsewhere. Fix by stopping propagation
inside, or by moving the portal up the React tree.

**★ When is a portal the wrong tool on a server-rendered page?**
Whenever the content needs to be in the HTML — for crawlers, for link previews, for readers
without JavaScript. Portalled content is client-only by construction. Render it in place and use
CSS for the positioning.

**★ Why does portal content sometimes remount unexpectedly?**
Because a different DOM node was passed during an update, which the reference says causes the
portal content to be recreated. Keep the target stable.

---

← Index: [Phase 11](README.md) ·
Prev: [`<script async>` support (19)](16-async-scripts.md)
