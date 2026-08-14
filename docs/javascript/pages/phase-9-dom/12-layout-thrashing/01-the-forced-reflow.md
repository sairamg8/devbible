---
title: "01 · The forced reflow"
sidebar_label: "01 · The forced reflow"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect), [`HTMLElement.offsetWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth), [`Element.clientWidth`](https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth), [`Element.scrollTop`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop), [`Window.getComputedStyle()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle), [`HTMLElement.innerText`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText), [`Element.scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView); the Chrome team's *Avoid large, complex layouts and layout thrashing* (web.dev) and Paul Irish's *What forces layout / reflow* gist for the enumeration. Documentation-validated; **no timings**.

## The pipeline, and where the batching happens

Per frame, the browser does roughly:

> **JavaScript → style → layout → paint → composite**

Your script runs first. DOM writes during it do **not** each trigger a layout — they mark the
affected part of the tree **dirty** and the engine defers the actual work until it needs the
answer, which is normally once, just before paint.

That deferral is the entire optimisation, and there is exactly one thing that defeats it:
**asking a question whose answer depends on layout while layout is dirty.** The engine cannot
answer from stale data, so it stops and computes — a **forced synchronous layout**, also called a
forced reflow.

One forced layout is not a problem. **The problem is the loop:**

```js
for (const el of rows) {
  el.classList.add('tall');          // invalidate
  console.log(el.getBoundingClientRect().height);   // force layout — every iteration
}
```

`n` rows, `n` full layout passes. This is layout thrashing, and it is why a list that renders
instantly at 20 items crawls at 2,000.

## What actually forces layout

The rule generalises better than any list: **anything that returns a geometry, a resolved style,
or a scroll position.** Learn the shape, then keep the list for the surprises.

**On an element**

| Group | Members |
|---|---|
| offset family | `offsetTop`, `offsetLeft`, `offsetWidth`, `offsetHeight`, `offsetParent` |
| client family | `clientTop`, `clientLeft`, `clientWidth`, `clientHeight` |
| scroll family | `scrollTop`, `scrollLeft`, `scrollWidth`, `scrollHeight` |
| explicit geometry | `getBoundingClientRect()`, `getClientRects()` |
| scrolling methods | `scrollBy()`, `scrollTo()`, `scrollIntoView()`, `scrollIntoViewIfNeeded()` |
| surprises | **`innerText`**, `focus()` |

**On `window` / `document`**

`getComputedStyle()`, `scrollX`/`scrollY`, `innerWidth`/`innerHeight`, `visualViewport`,
`document.scrollingElement`, `document.elementFromPoint()`.

Three of those deserve a note:

🔴 **`innerText` is the trap.** It returns text *as rendered* — respecting `display: none`,
line-breaking and text-transform — so it needs layout. Its neighbours `textContent` and
`innerHTML` do not. That difference is exactly why
[04 · `textContent` vs `innerText` vs `innerHTML`](../04-text-vs-html/README.md) tells you to
prefer `textContent`: it is not only about safety, it is a performance boundary too.

🔴 **`getComputedStyle` forces it** — for layout-dependent properties, the returned value is the
*resolved* value, which the engine cannot know without laying out. This is why
[08 · Classes and styles](../08-classes-and-styles/README.md) warns against reading it straight
after a write.

⚠️ **`focus()` and `scrollIntoView()` are writes that also read.** Both need geometry to decide
where to scroll, so a "set some styles, then focus the field" sequence contains a forced layout
you did not think you asked for.

**Not on the list:** reading a property you wrote yourself, such as `el.style.width` — that is the
inline attribute, no layout involved. Reading `className`, `dataset`, `textContent` or any
attribute is free in this sense.

## Two invalidations, not one

Style and layout are separate steps, and a write can dirty either:

- Changing something **geometric** — width, padding, font-size, adding a node — invalidates
  **layout**.
- Changing a **paint-only** property — `color`, `background`, `box-shadow` — invalidates paint but
  not layout.
- Changing `transform` or `opacity` on a composited element can often be handled by the
  **compositor**, skipping layout *and* paint. That is the basis of the animation advice in
  [02 · Fixing it](./02-fixing-it.md).

So "does my write force a later read to reflow?" depends on **what** you wrote. Toggling a colour
class does not invalidate layout, and a following `getBoundingClientRect()` costs nothing extra.

## Recognising it

You do not have to guess. In the DevTools performance panel a forced layout appears as a
**"Recalculate Style" / "Layout"** block *inside* a scripting task — often flagged with a warning
triangle and the phrase **forced reflow** — with a stack trace pointing at the exact line that
read the property.

The signature to look for is a **sawtooth**: script, layout, script, layout, repeated, all inside
one long task. Batching turns that into script-then-one-layout.

⚠️ **Do not trust intuition about which line did it.** The forcing read is often several
functions away from the write — a shared helper, a library call, a `console.log` of a rect during
debugging. The stack trace in the panel is the only reliable answer, and it is why this page
carries no numbers: the honest instruction is *profile the app you actually have*.

## The one time you force it deliberately

Restarting a CSS animation requires the browser to notice the class was removed before it is
re-added. In one task, both writes coalesce and nothing happens; forcing a layout between them
makes the removal take effect:

```js
el.classList.remove('shake');
void el.offsetWidth;            // deliberate forced reflow
el.classList.add('shake');
```

This is the famous "reflow hack", and it is worth knowing precisely because it looks like dead
code — the `void` is there to say *the value is not the point*. The modern alternatives are
`el.getAnimations().forEach(a => a.cancel())` or driving the animation with the Web Animations
API, which do not need the trick.

## Gotchas

**Symptom:** A loop is fast for 20 items and unusable for 2,000
**Cause:** A read inside the loop forces layout on every iteration.
**Fix:** Split into a read phase and a write phase.

**Symptom:** Reading `innerText` is slow while `textContent` is not
**Cause:** `innerText` is layout-dependent — it reflects what is actually rendered.
**Fix:** `textContent` unless you specifically need the rendered text.

**Symptom:** A `console.log` of a rect made a handler janky
**Cause:** Logging it still reads it, so it still forces layout.
**Fix:** Remove the log, or collect the values in a read phase.

**Symptom:** DevTools blames a line that only sets a class
**Cause:** The class write invalidated layout; the *next* read paid for it, possibly elsewhere.
**Fix:** Read the stack trace on the forced-layout warning rather than assuming.

**Symptom:** `focus()` inside a loop is slow
**Cause:** `focus()` (and `scrollIntoView()`) needs geometry, so it forces layout.
**Fix:** Do it once, after the writes.

**Symptom:** Batching reads did not help
**Cause:** A helper or a library call inside the "write phase" reads geometry.
**Fix:** Check what the callees do; the read may not be in your loop body.

**Symptom:** A colour-only change was blamed for a reflow
**Cause:** It probably was not — paint-only properties do not invalidate layout.
**Fix:** Look for the geometric write in the same task.

**Symptom:** Removing and re-adding an animation class does nothing
**Cause:** Both writes coalesce in one task, so the engine never sees the removal.
**Fix:** The deliberate `void el.offsetWidth` between them, or cancel via `getAnimations()`.

## Interview questions

**★ What is layout thrashing?**
Alternating DOM writes and geometry reads so that each read forces a synchronous layout the
browser would otherwise have batched. `n` iterations become `n` layout passes.

**★ Why is one read after a write expensive?**
The write marks layout dirty; the read needs an answer that depends on layout, so the engine must
compute it immediately instead of once before paint. Reads are only cheap while the layout is
clean.

**★ Name properties that force layout.**
The offset, client and scroll families; `getBoundingClientRect()`/`getClientRects()`;
`getComputedStyle()`; `window.scrollY`/`innerHeight`; `document.elementFromPoint()`; the scrolling
methods; and the two surprises — **`innerText`** and **`focus()`**.

**★ Why is `innerText` on that list and `textContent` not?**
`innerText` returns text **as rendered**, honouring `display: none`, line breaks and
text-transform — so it needs layout. `textContent` is a pure tree read.

**★ How do you find one?**
The DevTools performance panel flags **forced reflow** inside a scripting task, with a stack
trace. The visual signature is a sawtooth of script/layout pairs in one long task.

**★ Does building nodes in a `DocumentFragment` prevent thrashing?**
No — they are independent problems. Off-document building removes rendering churn during
construction; thrashing is about reading geometry between writes, and you can do that on a fully
built, inserted tree.

**Why does `void el.offsetWidth` appear in animation-restart code?**
It deliberately forces a reflow so the engine registers the class removal before the re-add;
otherwise both writes coalesce in one task and the animation never restarts. `getAnimations()` and
the Web Animations API are the modern alternatives.

---

[Topic index](./README.md) · Next → [02 · Fixing it](./02-fixing-it.md)
