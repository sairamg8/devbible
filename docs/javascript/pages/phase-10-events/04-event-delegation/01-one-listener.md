---
title: "04.1 · One listener for a whole list"
sidebar_label: "01 · One listener"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling), [`Element.closest()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest), [`Element.matches()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches). Documentation-validated.

**Delegation is bubbling, used on purpose.** One listener on an ancestor handles every
descendant, because the event comes to it anyway
([01 · The event model](../01-the-event-model/README.md)).

MDN's own framing:

> "Event delegation uses event bubbling to handle interactions on multiple child elements by
> attaching a **single listener to their parent**… Instead of adding click handlers to 16
> individual tiles, a single handler on the container uses `event.target` to identify which
> tile was clicked."

```js
container.addEventListener("click", (event) => {
  event.target.style.backgroundColor = bgChange();
});
```

## Why it is the default, not an optimisation

The listener-count argument is the one usually given and the least important. The real reasons
are structural:

**1. It survives re-renders.** A listener attached to a row dies when the row is replaced.
A listener on the container does not care how many times its children are rebuilt — which
means no re-attachment step, and no listener leak when rows are removed
([Phase 8 · 04](../../phase-8-modules-errors/04-leaks/README.md)).

**2. It works for elements that do not exist yet.** Rows added after page load are handled
with no extra code. Without delegation, every code path that inserts a row must remember to
attach handlers, and one that forgets produces a dead row nobody notices.

**3. There is one place to change the behaviour.** Not one per row, not one per insertion
site.

🔴 **The listener count matters least.** A thousand listeners is real memory, but the
maintenance properties are what make delegation correct even for three rows.

## `closest` is the piece that makes it work

MDN's example uses `event.target` directly, which works when the children are simple. In real
markup the click lands on whatever is innermost — a `<span>`, an icon, a text node's parent —
not on the element you care about:

```html
<li class="row" data-id="42">
  <button class="delete"><svg>…</svg></button>
</li>
```

Clicking the icon gives `target === <svg>`. So match upwards:

```js
list.addEventListener("click", (e) => {
  const btn = e.target.closest(".delete");
  if (!btn) return;                       // click was elsewhere in the list

  const row = btn.closest(".row");
  remove(row.dataset.id);
});
```

**`closest` walks from the element up through its ancestors and returns the first match — or
`null`.** Two things make it the right tool:

- **It starts at the element itself**, so it matches when `target` already *is* the button.
- **It stops at `null`**, giving you the guard clause for free.

`matches` is its non-walking sibling — `e.target.matches(".delete")` tests only the element
itself, which is why it fails on the icon click above. **Use `closest`; reach for `matches`
only when you know the target is the exact element.**

🔴 **`closest` is not bounded by the listener's element.** It keeps walking to the document
root, so a `.row` outside your container would still match. When it matters, check
containment:

```js
const row = e.target.closest(".row");
if (!row || !list.contains(row)) return;
```

## Routing several actions from one listener

Delegation composes well when the markup carries the intent:

```html
<button data-action="delete" data-id="42">Delete</button>
<button data-action="edit" data-id="42">Edit</button>
```

```js
const handlers = { delete: remove, edit: openEditor };

list.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn || !list.contains(btn)) return;
  handlers[btn.dataset.action]?.(btn.dataset.id);
});
```

One listener, one lookup, and adding an action is a markup change plus a map entry. The
`data-*` values are strings ([Phase 9 · 05](../../phase-9-dom/05-attributes-vs-properties/README.md)),
so parse anything numeric.

## Where delegation fails

Five cases, and knowing them is most of the value of this topic.

**1. Events that do not bubble.** `focus`, `blur`, `load`, `error`, and most media events never
reach the ancestor. Use the bubbling counterparts where they exist — **`focusin`/`focusout`**
for focus — and accept per-element listeners where they do not.

**2. `stopPropagation` upstream.** Any handler between the target and your listener can end
the journey ([03 · 01](../03-the-event-object/01-target-default-propagation.md)), and your
delegated handler simply never runs. This is the most common cause of "delegation stopped
working", and the culprit is usually in a different component or a library.

**3. Detached targets.** If a handler earlier in the chain removes the element, `closest` may
find nothing because the node is no longer in the document. Read what you need from the event
before anything can remove it.

**4. Shadow DOM.** `target` is **retargeted** to the shadow host, so a delegated listener
outside the component cannot see the inner element. Use `e.composedPath()[0]`, and note that
events with `composed: false` do not cross the boundary at all.

**5. Very deep trees with a hot event.** A delegated `mousemove` on `document` runs `closest`
on every move. For high-frequency events, delegate to the nearest useful container rather than
the document, and keep the matching cheap.

## Choosing where to attach

**As close to the content as is stable.** The list element, not `document` — it bounds the
walking, avoids clashing with unrelated handlers, and disappears cleanly with the component.

`document`-level delegation is right for genuinely global concerns: a router intercepting
link clicks, an outside-click closer, a keyboard shortcut layer. Those are also exactly the
handlers a stray `stopPropagation` breaks, which is why it is worth being unpopular about
that method.

## Gotchas

**Symptom:** The handler gets a `<span>` or `<svg>` instead of the button
**Cause:** `target` is the innermost element clicked.
**Fix:** `e.target.closest(".button-selector")`.

**Symptom:** `e.target.matches(".delete")` is `false` for a click on the button's icon
**Cause:** `matches` tests only that element; it does not walk up.
**Fix:** `closest`.

**Symptom:** Delegation matches an element outside the container
**Cause:** `closest` walks to the document root regardless of where the listener is.
**Fix:** Also check `container.contains(match)`.

**Symptom:** Delegation works everywhere except one component
**Cause:** Something between the target and your listener calls `stopPropagation`.
**Fix:** Find it and remove it; have that code filter on `e.target` instead.

**Symptom:** Delegated `focus` handling never fires
**Cause:** `focus` does not bubble.
**Fix:** `focusin`/`focusout`.

**Symptom:** Delegation cannot see inside a web component
**Cause:** `target` is **retargeted** to the shadow host.
**Fix:** `e.composedPath()[0]`, if the event is `composed`.

**Symptom:** A delegated `mousemove` on `document` is slow
**Cause:** `closest` runs on every event.
**Fix:** Delegate to a nearer container and keep the selector cheap.

## Interview questions

**★ What is event delegation and why use it?**
One listener on an ancestor handling all descendants, using bubbling. MDN: *"a single handler
on the container uses `event.target` to identify which tile was clicked."* The best reasons are
structural, not the listener count: it **survives re-renders**, it works for elements that do
not exist yet, and there is one place to change the behaviour.

**★ Why `closest` rather than `target` directly?**
Because the click lands on the innermost element — an icon or a span — not the button. `closest`
walks up from the target and returns the first match or `null`, which also gives you the guard
clause. `matches` tests only the element itself and fails on the icon click.

**★ Where does delegation fail?**
Events that **do not bubble** (`focus`, `blur`, `load`); an upstream `stopPropagation`;
targets detached before your handler runs; **shadow DOM**, where `target` is retargeted to the
host; and very high-frequency events on a deep tree.

**★ How do you handle focus with delegation?**
`focusin`/`focusout`, which are the bubbling counterparts of `focus`/`blur`.

**★ Where should the listener go?**
As close to the content as is stable — the list, not `document`. That bounds `closest`'s
walking, avoids clashing with unrelated handlers, and is removed with the component.
`document` is for genuinely global concerns like routing and outside-click.

**Why does delegation not leak listeners when rows are removed?**
Because there was never a listener on the row. The single listener lives on an ancestor that
outlives them, which is also why no re-attachment step is needed after a re-render.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
