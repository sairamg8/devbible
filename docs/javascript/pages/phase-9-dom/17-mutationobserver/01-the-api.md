---
title: "01 · The API"
sidebar_label: "01 · The API"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [`MutationObserver.observe()`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe), [`MutationRecord`](https://developer.mozilla.org/en-US/docs/Web/API/MutationRecord), [`MutationObserver.takeRecords()`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords), [`MutationObserver.disconnect()`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect). Documentation-validated; **no timings**.

`MutationObserver` watches the DOM for changes **you did not make** — a third-party script, a CMS
widget, a legacy page you cannot edit, an editor's `contenteditable` region. It is the API that
replaced polling with `setInterval` and the deprecated mutation events.

🔴 **It is a Know-tier tool for a reason: reaching for it in your own code is usually a design
smell.** If your code made the change, react at the point of change. `MutationObserver` is for
changes that arrive from outside your control.

## The shape

```js
const observer = new MutationObserver((records, obs) => {
  for (const record of records) {
    // react
  }
});

observer.observe(target, { childList: true, subtree: true });

// later
observer.disconnect();
```

The callback receives an **array of records**, not one — mutations are batched and delivered
together — plus the observer itself, which is what lets you `obs.disconnect()` from inside.

## The options, and the ones that throw

```js
observer.observe(target, {
  childList: true,             // children added or removed
  attributes: true,            // attribute changed
  characterData: true,         // text node's data changed
  subtree: true,               // …anywhere in the descendants, not just the target
  attributeOldValue: true,     // include the previous value in the record
  characterDataOldValue: true,
  attributeFilter: ['class', 'data-state'],   // only these attributes
});
```

🔴 **At least one of `childList`, `attributes` or `characterData` must be `true`, or `observe()`
throws `TypeError`.** The other three throws MDN documents are all "you asked for detail on
something you are not observing":

| Config | Result |
|---|---|
| all three main options false | **`TypeError`** |
| `attributes: false` with `attributeOldValue: true` or an `attributeFilter` | **`TypeError`** |
| `characterData: false` with `characterDataOldValue: true` | **`TypeError`** |

The implications go the other way and are convenient: `attributeOldValue: true` **implies**
`attributes: true`, an `attributeFilter` implies `attributes: true`, and
`characterDataOldValue: true` implies `characterData: true`. So the short form is legal:

```js
observer.observe(el, { attributeFilter: ['class'] });   // attributes: true is implied
```

⚠️ **`subtree` is the flag that decides the cost.** Without it you see changes to the target's own
children and attributes only. With it you see the whole tree beneath — which is what you usually
want for "did anything change in this region", and also what turns a busy page into a firehose of
records.

**Two calls, two registrations.** One observer can `observe()` several nodes with different
configs, and a node can be watched by several observers. Calling `observe()` again on the *same*
node with a new config replaces that node's configuration rather than adding a second one.

## Reading a `MutationRecord`

```js
const observer = new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'childList') {
      r.addedNodes.forEach(scan);          // NodeList, not an array
      r.removedNodes.forEach(cleanUp);
    } else if (r.type === 'attributes') {
      console.log(r.attributeName, r.oldValue);   // oldValue only if you asked for it
    }
  }
});
```

| Property | Meaning |
|---|---|
| `type` | `'childList'`, `'attributes'` or `'characterData'` |
| `target` | the node the mutation happened to |
| `addedNodes` / `removedNodes` | `NodeList`s — empty, not `null`, when nothing changed |
| `previousSibling` / `nextSibling` | where in the child list it happened |
| `attributeName`, `attributeNamespace` | which attribute |
| `oldValue` | **`null` unless** you passed the matching `*OldValue` option |

🔴 **There is no "new value" in a record.** For attributes you read the current value off the
element (`target.getAttribute(name)`); the record only carries the *old* one, and only on request.
That asymmetry surprises people who expect a change event.

📌 `addedNodes` contains **nodes**, not elements — text nodes and comments included. Filter by
`node.nodeType === Node.ELEMENT_NODE` before treating one as an element, the same care
[07 · Traversal](../07-traversal/01-the-two-families.md) describes for the `Node` family.

## Delivery timing: batched, and after your code

Records are queued as mutations happen and the callback runs **after the current script finishes**
— at microtask time, so before the next render, but not synchronously inside the mutation. Two
consequences:

- **One callback can carry many records.** Ten `appendChild` calls in a loop produce one callback
  with ten records, not ten callbacks. That is the batching that made this API viable where
  mutation events were not.
- **You cannot cancel or veto a mutation.** By the time you see it, it has happened. This is an
  observer, not a hook.

### `takeRecords()` — the queue you would otherwise lose

`takeRecords()` returns the pending records **and empties the queue**. The reason it exists is
`disconnect()`: disconnecting throws away anything queued but not yet delivered, so a "stop
watching now" that must not lose the last batch is two calls:

```js
const pending = observer.takeRecords();   // drain first
observer.disconnect();
if (pending.length) handle(pending);      // …then handle what was in flight
```

It is also the escape from the classic re-entrancy problem: before making your *own* change inside
the callback, drain the queue so your change does not come back to you as a new record.

## Not leaking the observer

`disconnect()` stops everything the observer was watching. Forget it and you keep both the observer
and every observed node alive — the detached-node leak from
[10 · Removing and replacing](../10-removing-and-replacing/02-cleanup.md), with the observer as the
referrer.

```js
class Widget {
  #observer = new MutationObserver(() => this.#sync());

  connect(root) { this.#observer.observe(root, { childList: true, subtree: true }); }
  destroy() { this.#observer.disconnect(); }     // not optional
}
```

There is no `{ signal }` option on `observe()` the way there is on `addEventListener`, so an
`AbortController` cleanup path needs an explicit listener:

```js
controller.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
```

## Gotchas

**Symptom: `observe()` throws `TypeError`.**
Cause — none of `childList`, `attributes`, `characterData` is `true`, or you asked for
`attributeOldValue` / `attributeFilter` / `characterDataOldValue` while the matching option is
explicitly `false`.
Fix — set at least one main option; drop the explicit `false` and let the implication do it.

**Symptom: `record.oldValue` is always `null`.**
Cause — the `*OldValue` option was not passed; old values are opt-in.
Fix — `attributeOldValue: true` or `characterDataOldValue: true`.

**Symptom: the callback never fires for a change deeper in the tree.**
Cause — no `subtree: true`; you are only watching the target's own children and attributes.
Fix — add `subtree: true`, and narrow with `attributeFilter` so the extra breadth does not become
noise.

**Symptom: `addedNodes.forEach` blows up on `node.classList`.**
Cause — `addedNodes` contains text nodes and comments too.
Fix — filter on `nodeType === Node.ELEMENT_NODE`.

**Symptom: your own DOM writes in the callback trigger the callback again, forever.**
Cause — the observer sees every mutation, including yours.
Fix — `takeRecords()` before writing, or disconnect, write, re-observe. A guard flag also works
but is easy to get wrong across async boundaries.

**Symptom: records are missing after you stopped observing.**
Cause — `disconnect()` discards the queue.
Fix — `takeRecords()` first, then `disconnect()`.

**Symptom: a removed widget's memory is never reclaimed.**
Cause — the observer is still connected and holds its target.
Fix — `disconnect()` in the teardown path.

## Interview questions

**★ What does `MutationObserver` do that an event listener cannot?**
It reports DOM changes made by code you do not control, in batches, after the fact. There is no
event for "a node was added"; the old mutation events that tried are deprecated for being
synchronous and slow.

**★ Which options are required, and what implies what?**
At least one of `childList`, `attributes`, `characterData`, or `observe()` throws `TypeError`.
`attributeOldValue` and `attributeFilter` imply `attributes: true`; `characterDataOldValue` implies
`characterData: true`; combining one of those with an explicit `false` also throws.

**★ How do you get the new value of a changed attribute?**
Read it from `record.target` — the record carries only `oldValue`, and only if you asked for it.

**★ What is `takeRecords()` for?**
It returns and clears the pending queue. Use it before `disconnect()`, which would otherwise
discard anything queued, and before making your own changes inside the callback so they do not come
back as new records.

**★ How do you avoid an infinite loop when the callback modifies the DOM?**
Drain with `takeRecords()` before writing, or disconnect, write and re-observe. The observer does
not exempt your own mutations.

**When is `MutationObserver` the wrong tool?**
When your own code made the change — react where the change happens instead. It is for content you
do not control, and `subtree: true` on a busy region is expensive enough that it should be a
deliberate choice.

---

[Topic index](./README.md) · [02 · When to use it](./02-when-to-use-it.md) →
