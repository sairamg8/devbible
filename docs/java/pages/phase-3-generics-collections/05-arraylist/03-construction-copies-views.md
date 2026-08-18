---
title: "Construction, copies and views"
sidebar_label: "3 · Construction, copies, views"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.List` (`of`, `copyOf`, `subList`), `java.util.Arrays.asList`,
> `java.util.ArrayList` (copy constructor, `toArray`) and the
> `ConcurrentModificationException` class doc.

**Five expressions produce "a list of those elements" and no two behave the
same: `new ArrayList<>(c)` (mutable copy), `Arrays.asList(...)` (fixed-size
view over an array), `List.of(...)` (immutable, null-hostile),
`List.copyOf(c)` (immutable copy, but a no-op on an already-immutable list),
and `list.subList(a, b)` (live window into the original). Most of this
phase's `UnsupportedOperationException`s and a good share of its
"list changed behind my back" bugs are one of these five picked wrong.**

## The construction menu

```java
var mutable   = new ArrayList<>(source);   // independent, growable copy
var fixedView = Arrays.asList(arr);        // view over arr: set OK, add/remove throw
var immutable = List.of("a", "b");         // truly unmodifiable, rejects null
var frozen    = List.copyOf(source);       // immutable snapshot of a collection
var window    = list.subList(2, 5);        // live view of list[2..4]
```

| | Mutable? | Independent of source? | Nulls? |
|---|---|---|---|
| `new ArrayList<>(c)` | fully | yes — shallow copy | allowed |
| `Arrays.asList(arr)` | `set` only | no — writes through to `arr` | allowed |
| `List.of(...)` | no | (no source) | **rejected — NPE at creation** |
| `List.copyOf(c)` | no | yes¹ | rejected |
| `subList(a, b)` | as the backing list | no — it *is* the backing list | as backing |

¹ `List.copyOf` returns the same instance when the source is already one of
the `List.of`-family immutable lists — cheap idempotent snapshotting.

**Every copy here is shallow** — elements are shared references, never
cloned. An "immutable" `List.of(mutableOrder)` is an unchangeable list of
changeable things;
**[Phase 2's immutable-design topic](../../phase-2-classes-objects/12-immutable-design/README.md)**
is the other half of actual safety.

## `unmodifiableList` vs `copyOf` — view vs snapshot

`Collections.unmodifiableList(list)` wraps: *you* can't modify through the
wrapper, but anyone holding the original still can, and you see their
changes. `List.copyOf(list)` snapshots: nobody can change what you hold.
Returning internals from a getter wants `copyOf` (or an accessor that
copies); `unmodifiableList` is for exposing a *live but read-only* window on
purpose. Choosing the wrapper when you meant the snapshot is how "defensive"
getters still leak mutable state.

## `subList` — a window, not a copy

`subList(from, to)` returns a view backed by the original: non-structural
changes flow both ways, and structural changes *through the view* work
(`window.clear()` deletes that range from the parent — the Javadoc's own
idiom `list.subList(from, to).clear()`). The trap is the other direction:
**structurally modify the parent directly, and the view's behaviour becomes
undefined** — in `ArrayList`'s implementation it fails fast with
`ConcurrentModificationException` on next use.

Use it short-lived: pagination slices, range deletion, passing a window to
an algorithm. Copy it (`new ArrayList<>(view)` / `List.copyOf(view)`) the
moment it must outlive the parent's next mutation.

## `toArray` — crossing back to arrays

```java
String[] arr = list.toArray(new String[0]);   // classic
String[] arr2 = list.toArray(String[]::new);  // since 11 — same thing, clearer
Object[] raw = list.toArray();                // Object[] — cannot be cast to String[]
```

The no-arg form returns `Object[]` — *not* castable to `String[]` even when
every element is a `String` (the array's runtime component type is
`Object`; **[Phase 1's arrays topic](../../phase-1-language-core/09-arrays.md)**
explains why that cast checks the actual array type). Passing `new String[0]`
supplies the component type; the sized-zero array is idiomatic — the method
allocates the right size itself.

The reverse direction, `Arrays.asList(arr)`, plus its three traps
(fixed-size, write-through, one-element primitive lists) is covered in
**[Phase 1, topic 09](../../phase-1-language-core/09-arrays.md)** — this
chunk's table above places it in the menu.

## Choosing, quickly

- **Building up results** → `new ArrayList<>()` (sized if known), or a
  stream `.toList()`.
- **Constants and fixtures** → `List.of`.
- **Storing a caller's collection in your object** → `List.copyOf` at the
  boundary (defensive + immutable in one call).
- **Returning internals** → `List.copyOf`, or expose a wrapper knowingly.
- **A slice** → `subList`, short-lived; copy it to keep it.

## Gotchas

**Symptom:** `UnsupportedOperationException` from `add` — but only on some inputs
**Cause:** the method receives sometimes a real `ArrayList`, sometimes `List.of`/`Arrays.asList` results — the `List` interface hides which; mutability is not part of the type
**Fix:** methods that mutate a parameter list should document it and copy defensively (`new ArrayList<>(input)`) — or better, return a new list and mutate nothing

**Symptom:** `NullPointerException` constructing a fixture with `List.of(a, b, c)`
**Cause:** one element was null — the `List.of` family rejects nulls at creation by specification
**Fix:** don't store null in collections (model absence explicitly); if a legacy shape truly needs it, `Arrays.asList` or `new ArrayList<>` accept nulls

**Symptom:** "defensive" getter `Collections.unmodifiableList(items)` — yet callers observe the list changing
**Cause:** the wrapper is a live view; the owning class keeps mutating the backing list
**Fix:** `List.copyOf(items)` for a snapshot per call, or maintain the field itself as immutable and swap wholesale

**Symptom:** `ConcurrentModificationException` from code using a saved `subList`, single-threaded
**Cause:** the parent list was structurally modified after the view was created — the view detects it fail-fast; no threads involved
**Fix:** treat `subList` as ephemeral; copy the range if it must survive parent mutations

**Symptom:** `ClassCastException: Object[] cannot be cast to String[]`
**Cause:** `(String[]) list.toArray()` — the no-arg overload allocates an `Object[]`; the runtime cast checks the array's actual type
**Fix:** `list.toArray(new String[0])` or `list.toArray(String[]::new)`

**Symptom:** `List.copyOf` "didn't copy" — the result is the same object as the input
**Cause:** documented optimization — the input was already an unmodifiable `List.of`-family list, so a new copy would be pointless
**Fix:** nothing to fix — the semantics (immutable, contents fixed) already hold; rely on the contract, not object identity

**Symptom:** mutation through `Arrays.asList` result corrupted an array another module still reads
**Cause:** the list is a write-through view — `set` writes into the original array
**Fix:** `List.of(arr)` (immutable) or `new ArrayList<>(Arrays.asList(arr))` (independent) at the boundary; never share the view when the array has other readers

## Interview questions

**★ `Arrays.asList` vs `List.of` vs `new ArrayList<>(...)` — the thirty-second version?**
`Arrays.asList`: fixed-size, write-through view over an array — `set` works,
`add` throws, array mutations show through. `List.of`: truly immutable,
rejects nulls. `new ArrayList<>(...)`: independent mutable shallow copy. The
choice is ownership semantics, not spelling.

**★ Why did `subList().clear()` become the idiomatic range-delete?**
Because the view's structural changes write through to the parent — the
Javadoc itself recommends `list.subList(from, to).clear()`. The same
liveness is why the view goes undefined (fail-fast in practice) once the
parent is structurally modified directly.

**★ `unmodifiableList` or `List.copyOf` for a getter — and what's the failure mode of the wrong choice?**
`copyOf` snapshots; `unmodifiableList` is a read-only *live* view. Choosing
the wrapper while continuing to mutate internals means callers see your
private state changing — the classic "defensive copy that wasn't a copy".

**★ Why does `list.toArray()` return `Object[]` instead of `T[]`?**
Erasure: at runtime the list has no `T` to allocate an array of
(**this phase's type-erasure topic** *(not written yet)*). The typed overload takes the
component type from the array you pass — which is why
`toArray(new String[0])` works and the cast of the no-arg result cannot.

**Are any of these copies deep?**
None. Every one copies references; shared elements remain shared. Deep
safety comes from immutable element types, not from any list-copying API.

**When is `List.copyOf` free?**
When the input is already a `List.of`-family immutable list — the method
returns it unchanged, making repeated defensive snapshotting of
already-immutable data cost nothing.

---

← Prev: [vs LinkedList — the honest comparison](02-arraylist-vs-linkedlist.md) · Index: [ArrayList](README.md)
