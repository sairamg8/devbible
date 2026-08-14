---
title: "02 · What removal does not clean up"
sidebar_label: "02 · What removal does not clean up"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`IntersectionObserver.disconnect()`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/disconnect), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`MutationObserver.disconnect()`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`Node.isConnected`](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected). Documentation-validated; **no timings**.

## The detached-node leak

```js
const cache = new Map();

function addRow(item) {
  const row = buildRow(item);
  row.addEventListener('click', () => open(item));
  cache.set(item.id, row);            // 🔴 the leak
  list.append(row);
}

function clear() {
  list.replaceChildren();             // rows are out of the document…
}                                     // …and still in `cache`, with their listeners
```

`replaceChildren` detached every row. Nothing collected them, because `cache` still points at each
one — and each row's listener closes over `item`, so the data is retained too. Do this on every
navigation and the page grows forever.

**The rule:** a node is collectable when **nothing reachable references it**. Being out of the
document is not enough. Common referrers, in the order they bite:

- a `Map`, array or object you wrote to and never cleaned
- a closure held by a listener on a **surviving** element (`window`, `document`, a parent)
- an observer that is still observing
- a timer or interval whose callback mentions the node

Detached nodes are the DOM-specific leak, covered at Master depth in
[Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md). The DevTools memory
profiler has a **Detached elements** view precisely because this is so common.

⚠️ **A listener on the removed node itself is not the leak** — if the node becomes unreachable,
the listener goes with it. The leak is a listener on something that *survives*, holding the node
alive through its closure. `window.addEventListener('resize', () => reposition(panel))` keeps
`panel` alive forever.

## `AbortController` is the one-call teardown

`addEventListener` takes a `signal` option. Aborting the controller removes **every** listener
registered with that signal — however many, on however many targets:

```js
const controller = new AbortController();
const { signal } = controller;

window.addEventListener('resize', onResize, { signal });
document.addEventListener('keydown', onKey, { signal });
panel.addEventListener('click', onClick, { signal });

// teardown — all three, one line
controller.abort();
```

🔴 **This is the modern answer to listener cleanup**, and it is strictly better than paired
`removeEventListener` calls, which require you to keep the *exact same function reference* — the
identity trap that makes `removeEventListener(..., handler.bind(this))` silently do nothing.

The same signal also cancels a `fetch` (`fetch(url, { signal })`), so one `abort()` can tear down
a component's listeners **and** its in-flight request together. `AbortSignal.timeout(ms)` gives
you the same thing on a deadline.

`{ once: true }` is the other automatic form: the listener removes itself after firing once.

## Observers do not stop on their own

An observer holds a reference to what it observes, so leaving one running keeps the element alive
*and* keeps doing work:

```js
io.unobserve(row);      // stop watching one element
io.disconnect();        // stop watching everything
resizeObserver.disconnect();
mutationObserver.disconnect();
```

**Disconnect in the same place you remove the element.** An `IntersectionObserver` set up for
infinite scroll and never disconnected is the classic version — it survives the list it was built
for, and fires against detached sentinels.

## Timers and animation frames

```js
clearTimeout(id);
clearInterval(id);
cancelAnimationFrame(rafId);
```

An interval whose callback touches a removed node keeps the node alive **and** keeps running —
usually throwing, or silently writing to something nobody can see. A `requestAnimationFrame` loop
that reschedules itself needs an explicit stop condition; `node.isConnected` is a reasonable one:

```js
function tick() {
  if (!node.isConnected) return;      // stop when the node has left the document
  // …
  rafId = requestAnimationFrame(tick);
}
```

## Delegation makes removal free

The structural fix beats every teardown discipline: **put one listener on a container that is not
going anywhere**, and child nodes can be added and removed with no cleanup at all.

```js
list.addEventListener('click', (e) => {
  const row = e.target.closest('[data-id]');
  if (row) open(row.dataset.id);
});
```

There is nothing to remove when a row goes, nothing to re-attach when one arrives, and no closure
per row holding data alive. This is why
[Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md) is the row
that pays for its phase — and it is the answer worth giving *first* when asked about listener
cleanup.

## Per-node data: `WeakMap`, not `Map`

When you must associate data with a node, a `WeakMap` holds its keys **weakly**, so the entry
disappears when the node becomes unreachable:

```js
const meta = new WeakMap();
meta.set(row, { item, renderedAt });
```

The same code with a `Map` is a leak by construction — the map keeps every node it has ever seen.
A `WeakMap` is not enumerable, which is the price, and is usually fine because you look data up
*by node* anyway.

## The cleanup you will forget: focus

**Removing the focused element sends focus to `<body>`**, which silently destroys the user's place
in the keyboard order and, for a screen-reader user, their position on the page entirely.

```js
const wasFocused = row.contains(document.activeElement);
row.replaceWith(newRow);
if (wasFocused) newRow.querySelector('button')?.focus();
```

Note `contains` includes the node itself, from
[07 · Traversal](../07-traversal/README.md) — the check must cover focus *inside* the row, not
only on it.

The same applies to deleting the last item in a list: move focus somewhere deliberate — the next
item, or a heading — rather than letting it fall to the body. This is the difference between a
list that is usable by keyboard and one that is not, and it costs three lines.

## Gotchas

**Symptom:** Memory grows on every navigation, with no obvious cause
**Cause:** Detached nodes held by a `Map`, a cache, or a closure on a surviving listener.
**Fix:** Drop the references; use `WeakMap` for per-node data; check the DevTools **Detached elements** view.

**Symptom:** `removeEventListener` did nothing
**Cause:** A different function reference — an inline arrow, or a fresh `.bind()`.
**Fix:** Register with `{ signal }` and call `controller.abort()` instead.

**Symptom:** A handler fires for an element that is no longer on the page
**Cause:** The listener lives on a surviving ancestor, `document` or `window`.
**Fix:** Abort the signal when the owning UI goes away, and guard with `isConnected` if needed.

**Symptom:** An `IntersectionObserver` keeps firing after the list is gone
**Cause:** It was never disconnected, and it holds its targets alive.
**Fix:** `disconnect()` at the same point you remove the elements.

**Symptom:** An interval throws after a component closes
**Cause:** `clearInterval` was never called.
**Fix:** Clear it in the same teardown as the listeners.

**Symptom:** A `requestAnimationFrame` loop runs forever
**Cause:** It reschedules unconditionally.
**Fix:** Stop on `!node.isConnected`, or cancel the id explicitly.

**Symptom:** Keyboard users are thrown to the top of the page after deleting an item
**Cause:** The focused element was removed, so focus fell to `<body>`.
**Fix:** Capture whether focus was inside, and move it deliberately afterwards.

**Symptom:** A `Map` keyed by DOM node never shrinks
**Cause:** `Map` holds keys strongly.
**Fix:** `WeakMap`.

## Interview questions

**★ Does removing an element remove its event listeners?**
No. The node is detached, not destroyed — it keeps its listeners and works again if re-inserted.
It is collected only when nothing reachable references it, which is why a cache or a closure on a
surviving element turns removal into a leak.

**★ What is a detached-node leak?**
A node out of the document that something still points at — a `Map`, a closure held by a listener
on `window`/`document`, an observer, a timer. The node, its subtree and everything its closures
capture stay in memory. DevTools has a **Detached elements** view for exactly this.

**★ What is the cleanest way to remove many listeners at once?**
Register them with `{ signal }` from an `AbortController` and call `controller.abort()` — one call
removes all of them, on any number of targets, and the same signal can cancel an in-flight
`fetch`. It also sidesteps the `removeEventListener` identity trap.

**★ Why does `removeEventListener` sometimes do nothing?**
It matches on the exact function reference (plus the capture flag). An inline arrow or a fresh
`.bind()` is a different function every time, so there is nothing to match.

**★ How do you avoid listener cleanup entirely?**
Event delegation — one listener on a container that outlives the children. Rows can come and go
with no attach or detach step and no per-row closure.

**★ What breaks for keyboard users when you remove a row?**
Focus falls to `<body>`. Check whether `document.activeElement` was inside the removed subtree
(with `contains`, which counts the node itself) and move focus somewhere deliberate afterwards.

**Why `WeakMap` for per-node data?**
It holds keys weakly, so an entry vanishes when the node becomes unreachable. A `Map` keyed by
nodes is a leak by construction.

**What must you disconnect besides listeners?**
`IntersectionObserver`, `ResizeObserver` and `MutationObserver` — each holds its targets — plus
intervals, timeouts and animation frames whose callbacks reference the removed nodes.

---

← [01 · The removal and replacement API](./01-the-api.md) · [Topic index](./README.md) ·
**11 · Batching DOM work** *(not written yet)* →
