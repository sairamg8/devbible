---
title: "02.1 · The selector methods"
sidebar_label: "01 · The selector methods"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Document.querySelectorAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll), [`Document.querySelector()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector), [`Document.getElementById()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById), [`NodeList`](https://developer.mozilla.org/en-US/docs/Web/API/NodeList), [`HTMLCollection`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCollection). Documentation-validated.

**Two families, and the difference that matters is not speed — it is whether the result
keeps changing after you get it.**

## The methods

| Method | Returns | Not found |
|---|---|---|
| `getElementById(id)` | a single `Element` | **`null`** |
| `querySelector(sel)` | the **first** match | **`null`** |
| `querySelectorAll(sel)` | a **static** `NodeList` | **empty list** |
| `getElementsByTagName(t)` | a **live** `HTMLCollection` | empty collection |
| `getElementsByClassName(c)` | a **live** `HTMLCollection` | empty collection |

🔴 **The "not found" column is where the bugs are.** A single-element method returns `null`,
so the next line throws `TypeError: Cannot read properties of null`. A list method returns an
**empty list**, so a loop over it runs zero times and nothing throws at all — silently doing
nothing.

```js
document.querySelector("#missing").textContent = "hi";   // ⚠️ TypeError
document.querySelectorAll("#missing").forEach(…);        // ⚠️ silently nothing
```

The empty-list case is the harder one to debug precisely because it is quiet.

## Static versus live

MDN, on `querySelectorAll`:

> "returns a **static (not live)** `NodeList` representing a list of the document's elements
> that match the specified group of selectors."

> "A **non-live** `NodeList` containing one `Element` object for each element that matches at
> least one of the specified selectors or an empty `NodeList` in case of no matches."

The `getElementsBy*` family instead returns a **live `HTMLCollection`**, which updates itself
as the document changes.

```js
const live = document.getElementsByClassName("item");   // live
const snap = document.querySelectorAll(".item");        // static

document.body.append(makeItem());                        // add one more

live.length;   // includes the new one
snap.length;   // does NOT — it was a snapshot
```

**Live sounds better and is usually worse.** Two reasons:

**1. Live collections make loops dangerous.**

```js
const items = document.getElementsByClassName("item");
for (let i = 0; i < items.length; i++) {
  items[i].remove();          // ⚠️ removes half of them
}
```

Each removal shrinks the collection while the index advances, so every other element is
skipped — the classic mutate-while-iterating bug, except the collection is mutating itself.
The static `NodeList` from `querySelectorAll` has no such problem:

```js
document.querySelectorAll(".item").forEach((el) => el.remove());   // ✅ removes all
```

**2. A static list can go stale — and that is a different bug.** If you hold a `NodeList`
across a re-render, it references nodes that are no longer in the document. They are not
`null`; they are detached, so writes to them succeed and change nothing visible — and they
are a leak ([Phase 8 · 04](../../phase-8-modules-errors/04-leaks/README.md)).

**The rule: query late, use immediately, do not store the result.** Both failure modes come
from holding a collection longer than the DOM stays still.

## Neither is an array

`NodeList` and `HTMLCollection` are both array-*like*: indexed, with `length`, and no other
array methods. MDN's example shows the one exception:

```js
const highlightedItems = userList.querySelectorAll(".highlighted");

highlightedItems.forEach((userItem) => {
  deleteUser(userItem);
});
```

🔴 **`NodeList` has `forEach`. `HTMLCollection` has nothing.** So this works on the result of
`querySelectorAll` and throws on the result of `getElementsByClassName`. When you need real
array methods:

```js
[...document.querySelectorAll(".item")].map((el) => el.textContent);
Array.from(document.getElementsByClassName("item")).filter(…);
```

Spreading also **freezes a live collection into an array**, which is the other correct fix
for the removal loop above.

## Selectors are matched against the document

`element.querySelector(sel)` searches within `element`'s descendants — but the selector
itself is still evaluated against the **whole document**, so ancestors outside the element
can participate in a match:

```html
<div id="wrap"><p class="a">x</p></div>
```

```js
wrap.querySelector("#wrap p");    // ✅ matches — #wrap is an ancestor, even though the
                                  //    search is scoped to wrap's descendants
```

This surprises people who expect the selector to be relative. When you need "a direct child
of *this* element", use `:scope`:

```js
wrap.querySelectorAll(":scope > p");   // direct children only
```

## Choosing

- **`getElementById`** — the fastest and clearest way to fetch one known element. Still worth
  using; `#id` in `querySelector` is equivalent but not clearer.
- **`querySelector` / `querySelectorAll`** — the default for everything else. One syntax, the
  full CSS selector language, and a static result.
- **`getElementsBy*`** — reach for these only when you specifically want a **live** collection
  and are not iterating it destructively.

**Performance is almost never the deciding factor.** `querySelectorAll` does more work than
`getElementById`, and on any realistic page the difference is irrelevant next to the layout
and paint that follow. Choose on semantics — static or live — and on readability.

One genuine performance point does exist: **repeatedly querying inside a loop is a real
cost**, because each call walks the tree. Hoist the query out.

```js
for (const row of rows) {
  document.querySelector(".total").textContent = …;   // ⚠️ re-queries every iteration
}
const total = document.querySelector(".total");        // ✅ once
```

## Gotchas

**Symptom:** `TypeError: Cannot read properties of null`
**Cause:** `querySelector`/`getElementById` returns **`null`** when nothing matches.
**Fix:** Check before use, or use optional chaining. Confirm the element exists when the
script runs — with modules it will, since they are deferred.

**Symptom:** A loop over a query result does nothing and throws nothing
**Cause:** The list method returned an **empty** list. Silence is the symptom.
**Fix:** Assert the length when a match is required.

**Symptom:** A removal loop removes every other element
**Cause:** A **live** `HTMLCollection` shrinks as you iterate while the index advances.
**Fix:** `querySelectorAll(...).forEach(...)`, or spread the live collection into an array
first.

**Symptom:** `forEach is not a function` on a query result
**Cause:** It was an `HTMLCollection` from `getElementsBy*`, which has no iteration methods.
**Fix:** `Array.from(...)` or spread. `NodeList` does have `forEach`.

**Symptom:** Writes to elements succeed but nothing changes on screen
**Cause:** A stored static `NodeList` holds **detached** nodes from before a re-render.
**Fix:** Re-query. Do not store collections across renders — and note detached nodes are also
a leak.

**Symptom:** `el.querySelector("div p")` matches when you expected it not to
**Cause:** The selector is evaluated against the **whole document**; only the search is
scoped to descendants.
**Fix:** `:scope` — `el.querySelectorAll(":scope > p")`.

## Interview questions

**★ What is the difference between `querySelectorAll` and `getElementsByClassName`?**
`querySelectorAll` returns a **static** `NodeList` — MDN: *"static (not live)"* — a snapshot
at call time. `getElementsByClassName` returns a **live** `HTMLCollection` that updates as the
DOM changes. Live is usually worse: it breaks removal loops, because the collection shrinks
while the index advances.

**★ What do the selector methods return when nothing matches?**
Single-element methods return **`null`**, so the next line throws. List methods return an
**empty list**, so a loop runs zero times and nothing throws — the quieter and harder bug.

**★ Is a `NodeList` an array?**
No — array-like. `NodeList` does have **`forEach`**; `HTMLCollection` has no iteration methods
at all. For real array methods, spread or `Array.from`, which also freezes a live collection.

**★ Why does a `for` loop that removes elements only remove half of them?**
Because the collection is **live**. Each removal shortens it while the index moves forward, so
every other element is skipped. Use `querySelectorAll(...).forEach(...)`, or spread first.

**★ Does `el.querySelector()` evaluate the selector relative to `el`?**
No — the search is scoped to `el`'s descendants, but the selector is matched against the
**whole document**, so ancestors outside `el` can participate. Use `:scope` for genuinely
relative selectors.

**Is `getElementById` worth using over `querySelector("#id")`?**
Both are fine. `getElementById` is marginally faster and states the intent, but performance is
essentially never the deciding factor here — the real cost is re-querying inside a loop, which
you fix by hoisting the query out.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
