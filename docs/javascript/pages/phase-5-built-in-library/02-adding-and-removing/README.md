---
title: "02 · Adding and removing"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`push`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`pop`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop), [`shift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`unshift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift), [`splice`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`toSpliced`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced). Documentation-validated.

**Five mutating methods, and three things worth knowing about them:** the adders
return a length while the removers return an element; the **front of an array is
fundamentally more expensive than the back**; and `splice` with a missing
`deleteCount` throws away everything after `start`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`push`, `pop`, `shift`, `unshift`](./01-push-pop-shift-unshift.md)** | The four methods and their return values, why `shift`/`unshift` re-index the whole array while `pop`/`push` do not, the **O(n²) queue** and its two fixes, the `push(...huge)` argument limit, and the non-mutating equivalents |
| 2 | **[`splice`](./02-splice.md)** | Remove, insert and replace with one method; the negative and out-of-range `start` rules; **omitted `deleteCount` deleting to the end**; why `splice` beats `delete`; why you must never `splice` in a forward loop; and `toSpliced` |

## The return values

| Method | Returns |
|---|---|
| `push` / `unshift` | the **new length** |
| `pop` / `shift` | the **removed element** (`undefined` if empty) |
| `splice` | the **removed elements**, as an array |
| `toSpliced` | the **new array** — the original is untouched |

## Mutating → non-mutating

| Mutating | Non-mutating |
|---|---|
| `arr.push(x)` | `[...arr, x]` |
| `arr.unshift(x)` | `[x, ...arr]` |
| `arr.pop()` | `arr.slice(0, -1)` |
| `arr.shift()` | `arr.slice(1)` |
| `arr.splice(…)` | `arr.toSpliced(…)` |
| remove by predicate | `arr.filter(…)` |

**Default to the non-mutating form** unless the array is local to the function you are
writing. In immutable-state code the new identity is what change detection needs.

## Phase gate

You are done with this topic when you can say what `push` returns, why draining a
large queue with `shift()` is quadratic and what to do instead, and what
`arr.splice(2)` does to an array of ten elements.

## Where this connects

- [01 · Holes, `length` and sparse arrays](../01-array-creation-and-shape/02-holes-and-length.md) — `arr.length = n` as the other truncation, and why holes matter
- [Phase 4 · 03 · `delete` and its cost](../../phase-4-objects-and-classes/03-existence-checks-and-delete/03-delete-and-its-cost.md) — why `delete arr[i]` is never the way to remove an element
- [Phase 4 · 04 · What shallow means](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md) — why mutating an array you did not create breaks change detection

---

Start → [`push`, `pop`, `shift`, `unshift`](./01-push-pop-shift-unshift.md)
