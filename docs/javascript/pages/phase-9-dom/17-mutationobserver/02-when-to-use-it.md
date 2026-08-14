---
title: "02 · When to use it"
sidebar_label: "02 · When to use it"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [`MutationObserver.observe()`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [Custom elements / `customElements.define()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define). Documentation-validated; **no timings**.

The API is small; knowing when *not* to use it is the actual skill. Most `MutationObserver` code in
the wild is a workaround for not owning the code that makes the change.

## The decision table

| The question you are asking | The right tool |
|---|---|
| did **my** code change this? | react where you changed it — no observer |
| is this element **visible / in view**? | `IntersectionObserver` |
| has this element **changed size**? | `ResizeObserver` |
| has this **input's value** changed? | the `input` / `change` events |
| has this **attribute I own** changed? | change the state in one place and re-render |
| has a **third party** injected or altered something? | 🔴 **`MutationObserver`** |
| has my custom element been **inserted into the document**? | `connectedCallback`, not an observer |
| has **route content** finished rendering? | your router's own hook |

🔴 **Every row above the red one has a cheaper, more precise answer.** `MutationObserver` gives you
"something changed", after the fact, with no semantics — you have to re-derive what it meant. The
purpose-built observers hand you the answer directly, and their callbacks are delivered after
layout so reading their entries forces nothing
([12 · Layout thrashing](../12-layout-thrashing/02-fixing-it.md)).

## The cases where it genuinely is the answer

**A third-party script you cannot edit.** A payment widget, a chat bubble, an ad slot, a CMS
plugin — anything that injects markup on its own schedule. You need to know when it lands, and it
offers no callback.

```js
const observer = new MutationObserver((records, obs) => {
  const widget = document.querySelector('.vendor-widget');
  if (!widget) return;
  obs.disconnect();                  // one-shot: stop the moment it appears
  enhance(widget);
});
observer.observe(document.body, { childList: true, subtree: true });
```

The one-shot shape — **disconnect inside the callback** — is the most common correct use, and it
keeps the expensive `subtree` watch alive for the shortest possible time.

**A `contenteditable` region.** The user's typing, pasting and dragging all mutate the DOM directly
and there is no event that describes the resulting tree. Editors watch it and reconcile.

**Enforcing an invariant on content you do not own.** Re-applying `rel="noopener"` to links a CMS
keeps re-inserting, or keeping `aria-*` correct on a widget that resets it.

**Waiting for an element that has no ready signal**, in a userscript or an extension — where you
genuinely cannot hook into the page's own lifecycle.

## Cheaper alternatives, in order

Before writing an observer, work down this list:

1. **Own the change.** If any code you control makes the mutation, put the reaction there. One
   call site beats a watcher over the whole tree.
2. **A custom element.** `connectedCallback` fires when the element is inserted into the document,
   and `attributeChangedCallback` fires for the attributes you list in `observedAttributes` — the
   platform's own targeted version of what you would otherwise observe. That is
   **18 · Shadow DOM and custom elements** *(not written yet)*.
3. **`IntersectionObserver` / `ResizeObserver`**, when the real question is visibility or size.
4. **Event delegation** on a stable ancestor, when the real question is "did the user interact with
   something that may not have existed yet" —
   [Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md).
   A delegated listener needs no observer at all, because it never binds to the new node.
5. **`MutationObserver`**, last.

## Keeping the cost down when you do use it

**Scope the target as tightly as you can.** `document.body` with `subtree: true` sees every change
on the page, including ones your own framework makes on every render.

```js
// ❌ the whole document, every change, forever
observer.observe(document.body, { childList: true, subtree: true, attributes: true });

// ✅ one container, one attribute, no subtree
observer.observe(panel, { attributeFilter: ['data-state'] });
```

**Use `attributeFilter`.** Watching all attributes on a busy component means a record for every
`class` change your animations make.

**Disconnect as soon as the answer arrives.** The one-shot pattern above.

**Do the cheap check first.** Inside the callback, `querySelector` for what you actually want
before iterating records — often you do not need to inspect the records at all, and the DOM query
is simpler than reconstructing state from a batch.

**Debounce the expensive reaction, not the observer.** The callback itself is already batched, but
a mutation storm still produces several batches; coalesce your response with a flag rather than
doing full work per callback ([11 · Batching DOM work](../11-batching-dom-work/02-not-freezing-the-page.md)).

**The trade-off, stated plainly:** a tightly scoped observer costs little and buys you a hook the
platform does not otherwise offer. A `document.body` + `subtree` + all-attributes observer is a
callback on nearly every frame of a busy app, and the work you do inside it lands in the middle of
someone else's script — which is the shape of a jank report nobody can trace.

## Gotchas

**Symptom: the observer fires constantly and the profile shows your callback everywhere.**
Cause — `document.body` with `subtree: true`, usually with `attributes: true` as well.
Fix — scope to the smallest container, add `attributeFilter`, and disconnect once satisfied.

**Symptom: the element you are waiting for is already there and the callback never fires.**
Cause — observers report **changes**, not current state; an element that existed before you
observed produces no record.
Fix — check for it once before observing, and only then start watching.

**Symptom: you observe to detect your own component being added.**
Cause — using a global watcher for a lifecycle you already own.
Fix — a custom element's `connectedCallback`, or simply run the code where you insert it.

**Symptom: the observer catches the node but its children are not there yet.**
Cause — a script may insert an empty container first and fill it later; one `childList` record does
not mean the subtree is complete.
Fix — keep observing until the content you need matches, then disconnect.

**Symptom: an extension's observer breaks when the host page re-renders.**
Cause — the observed node was replaced, and the registration was on the old node.
Fix — observe a stable ancestor, or re-observe on replacement. `observe()` follows the *node*, not
the selector.

## Interview questions

**★ When would you reach for `MutationObserver` in production code?**
When something you do not control changes the DOM: a third-party widget, a CMS, a
`contenteditable` region, or a userscript context. If your own code made the change, react at the
change site instead.

**★ Why is `IntersectionObserver` preferred where it applies?**
It answers the actual question — is this in view — instead of "something changed, go and work out
what". It fires only on threshold crossings and its entries are delivered after layout, so reading
them forces no reflow.

**★ How do you observe cheaply?**
Smallest possible target, `attributeFilter` instead of all attributes, `subtree` only when needed,
and `disconnect()` as soon as the condition is met — the one-shot pattern.

**★ Why does your observer never fire for an element that is clearly on the page?**
Because it was already there. Observers report mutations, not state. Check for the element first,
then observe for the case where it has not arrived yet.

**What is the custom-element alternative?**
`connectedCallback` for insertion and `attributeChangedCallback` with `observedAttributes` for
attribute changes — the same signals, scoped to the element that cares, with no tree-wide watcher.

---

← [01 · The API](./01-the-api.md) · [Topic index](./README.md) ·
**18 · Shadow DOM and custom elements** *(not written yet)* →
