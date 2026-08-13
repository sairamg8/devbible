---
title: "02.1 · `push`, `pop`, `shift`, `unshift`"
sidebar_label: "01 · push, pop, shift, unshift"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.shift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`push`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`pop`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop), [`unshift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift). Documentation-validated.

**Four mutating methods, two ends, and one of the two ends is fundamentally more
expensive.** That asymmetry is the whole content of this page.

## The four, and what each returns

| Method | End | Returns | Empty array |
|---|---|---|---|
| `push(…items)` | back | the **new length** | — |
| `pop()` | back | the **removed element** | `undefined` |
| `unshift(…items)` | front | the **new length** | — |
| `shift()` | front | the **removed element** | `undefined` |

All four **mutate in place**. MDN on `shift`: *"The `shift()` method is a mutating
method. It changes the length and the content of `this`."*

**The return values are the thing people get wrong.** The adders return a *length*,
the removers return an *element*:

```js
const arr = [1, 2];
const a = arr.push(3);   // 3   ← the new LENGTH, not the array
const b = arr.pop();     // 3   ← the removed element
```

So `const next = arr.push(x)` gives you a number, and chaining
(`arr.push(x).push(y)`) is a `TypeError` — a number has no `push`. If you want a new
array back, you want spread or `concat`:

```js
const bigger = [...arr, x];    // new array
const smaller = arr.slice(0, -1);  // new array, last element dropped
```

And the removers returning `undefined` on an empty array is indistinguishable from
successfully removing a stored `undefined`. If that distinction matters, check
`arr.length` first.

## The front is expensive; the back is not

`push` and `pop` touch one slot: the element at index `length - 1`. Nothing else
moves.

`shift` and `unshift` cannot work that way. MDN describes what `shift` does: it
*"shifts all values to the left by 1 and decrements the length by 1."* Every remaining
element changes index — element 1 becomes element 0, element 2 becomes element 1, and
so on to the end. `unshift` does the same in reverse to make room at the front.

**That is the specified algorithm, not an implementation detail.** Removing from the
front is defined as re-indexing everything after it, so the work is proportional to
the array's length, while `pop` is proportional to nothing.

### The O(n²) queue

```js
// ❌ each shift re-indexes the whole remaining array
while (queue.length) {
  const job = queue.shift();
  process(job);
}
```

`n` iterations, each re-indexing up to `n` elements — so the loop does work
proportional to **n²** by the specified algorithm, for a task that should be linear.
On a hundred items nobody notices. On a hundred thousand it is the reason the tab
freezes.

**The fix is an index cursor** — never move the elements at all:

```js
// ✅ linear: nothing is re-indexed
let head = 0;
while (head < queue.length) {
  const job = queue[head++];
  process(job);
}
queue.length = 0; // release when done
```

Or reverse the queue once and `pop` from the back, which is also cheap:

```js
const stack = queue.reverse();      // one pass
while (stack.length) process(stack.pop());
```

Or, when items arrive while you are draining, use a real deque — or simply accept
`shift` if the queue is small and bounded. **The rule is not "never use `shift`"**; it
is *"do not `shift` in a loop over a large array"*.

🔴 **One caveat worth stating plainly:** engines optimise array representations
aggressively, and V8 in particular has fast paths for small arrays. The complexity
argument above comes from the **specified algorithm**, which is what the documentation
gives us. This corpus builds no new benchmarks, so there is **no measured multiplier
here** — if the difference matters to your workload, profile your own code.

## Adding many items

```js
arr.push(...manyItems);   // ⚠️ every item becomes an argument
```

Spreading into `push` passes each element as a separate argument, so a very large
array can exceed the engine's argument limit and throw `RangeError: Maximum call stack
size exceeded`. For large batches:

```js
for (const x of manyItems) arr.push(x);   // safe at any size
// or
const combined = arr.concat(manyItems);   // new array, no argument limit
```

For a handful of items the spread form is fine and reads better.

## Mutating versus building new

The four methods on this page all mutate. That is sometimes exactly right — an
accumulator inside a function you own — and sometimes the source of a bug, when the
array came from somewhere else:

```js
function addTag(post, tag) {
  post.tags.push(tag);   // ⚠️ mutates the caller's array
  return post;
}
```

Every other holder of `post.tags` sees the new tag. In an immutable-state codebase
(React, Redux) this also breaks change detection, because the array's **identity** did
not change — the argument from
[Phase 4 · 04 · What shallow means](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md).

The non-mutating equivalents:

| Mutating | Non-mutating |
|---|---|
| `arr.push(x)` | `[...arr, x]` |
| `arr.unshift(x)` | `[x, ...arr]` |
| `arr.pop()` | `arr.slice(0, -1)` |
| `arr.shift()` | `arr.slice(1)` |
| `arr.splice(…)` | `arr.toSpliced(…)` — [chunk 2](./02-splice.md) |

**Default to the non-mutating form** unless the array is local to the function you are
writing, or you are in a hot loop where the extra allocation matters.

## Gotchas

**Symptom:** `TypeError: arr.push(...).push is not a function`
**Cause:** `push` returns the **new length**, a number — not the array.
**Fix:** Call `push` on separate statements, or build a new array with spread.

**Symptom:** A large loop over `shift()` is unexpectedly slow
**Cause:** `shift` is specified to shift *"all values to the left by 1"*, so it
re-indexes the whole remaining array each call. `n` shifts is quadratic work.
**Fix:** Use an index cursor (`queue[head++]`), or `reverse()` once and `pop()`.

**Symptom:** `RangeError: Maximum call stack size exceeded` from `arr.push(...other)`
**Cause:** Spread turns every element into a separate argument, exceeding the engine's
argument limit.
**Fix:** Loop with `push`, or use `concat`.

**Symptom:** An array changed somewhere else in the program
**Cause:** All four of these methods **mutate in place**, so every holder of the
reference sees it.
**Fix:** Build a new array (`[...arr, x]`) when the array is not yours.

**Symptom:** A React component does not re-render after `push`
**Cause:** The array's **identity** is unchanged, so the equality check sees no change.
**Fix:** `setItems([...items, x])` — a new array reference.

**Symptom:** `pop()` returned `undefined` and you assumed the array had a value there
**Cause:** `pop`/`shift` return `undefined` for an empty array — indistinguishable from
removing a stored `undefined`.
**Fix:** Check `arr.length` before removing.

## Interview questions

**★ What do `push` and `pop` return?**
`push` returns the **new length** (and `unshift` likewise); `pop` returns the **removed
element** (and `shift` likewise), or `undefined` if the array was empty. So `push`
cannot be chained — its return value is a number.

**★ Why is `shift` more expensive than `pop`?**
Because `pop` removes the last element and nothing else moves, while `shift` is
specified to shift *"all values to the left by 1"* — every remaining element gets a new
index. So the work is proportional to the array's length rather than constant.

**★ Why is draining a queue with `shift()` in a loop a problem?**
Each `shift` re-indexes the whole remaining array, so `n` iterations do work
proportional to **n²** for a task that should be linear. Use an index cursor
(`queue[head++]`), or reverse once and `pop`. Note this follows from the specified
algorithm — measure your own workload before assuming a multiplier.

**★ How do you add an element without mutating the array?**
`[...arr, x]` for the back and `[x, ...arr]` for the front — both produce a new array
with a new identity, which is what immutable-state change detection depends on.
`slice(1)` and `slice(0, -1)` are the non-mutating removals.

**Why can `arr.push(...hugeArray)` throw?**
Because spread passes each element as a separate argument and there is an engine limit
on argument count. Loop with `push`, or use `concat`, for large batches.

**When is mutating the right choice?**
When the array is local to the function you are writing — an accumulator you just
created — or in a hot loop where the extra allocation matters. When the array came from
a caller or from application state, build a new one.

---

[Topic index](./README.md) · Next → [`splice`](./02-splice.md)
