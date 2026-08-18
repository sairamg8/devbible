---
title: "Arrays"
sidebar_label: "09 · Arrays"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §10 (arrays), §10.5 and §4.10.3
> (array covariance and store checks), and the JDK 25 API documentation for
> `java.util.Arrays` and `System.arraycopy`.

**An array is the JVM's lowest-level container: fixed length forever, one
component type, contiguous, fast — and carrying two design decisions from
1995 that modern code has to route around: arrays are *covariant* (a
`String[]` is-a `Object[]`, checked at runtime, not compile time) and they
don't override `equals`/`toString`/`hashCode`. Application code holds data in
collections (Phase 3) and meets arrays at the edges: varargs, I/O buffers,
`String.toCharArray`, performance-critical numeric work.**

## What an array is

```java
int[] counts = new int[10];            // length fixed at creation, all 0
String[] names = {"ada", "linus"};     // initializer form
int[][] grid = new int[3][4];          // array of arrays — NOT a matrix
```

- **Length is fixed at creation** and exposed as the *field* `length` — not a
  method (`arr.length`, but `str.length()` and `list.size()`; the
  inconsistency is historical and permanent).
- **Every element is initialized** to the component type's default (`0`,
  `0.0`, `false`, `null`) — unlike locals, exactly like fields
  ([topic 01](01-primitives-vs-references/README.md)).
- An array is an **object on the heap** — even `int[]`. The variable is a
  reference; `==` compares identity; it inherits `Object`'s methods and
  overrides none of them usefully.
- Indexing is bounds-checked: a bad index throws
  `ArrayIndexOutOfBoundsException` naming the index and the length —
  never silent corruption.
- **`int[][]` is an array of `int[]` references**: rows are independent
  objects, can be different lengths ("jagged"), can be `null`, and each
  hop is a pointer dereference — not a contiguous matrix.

**Primitive arrays store values inline** (`int[1000]` is one object holding
1000 ints — compact, cache-friendly, the reason numeric code uses them).
**Reference arrays store references** — the objects live elsewhere.

## Covariance and `ArrayStoreException`

Arrays are covariant: `String[]` is a subtype of `Object[]`. That makes this
compile — and fail at runtime:

```java
Object[] objects = new String[3];   // legal — covariance
objects[0] = 42;                    // compiles — throws ArrayStoreException
```

Every store into a reference array is runtime-checked against the array's
*actual* component type. The hole exists because pre-generics Java needed
`sort(Object[])` to accept every array; generics chose the opposite
(invariance — `List<String>` is *not* a `List<Object>`, Phase 3) precisely
to move this error to compile time. Two consequences:

- **Passing an array to code that takes `Object[]` lets that code corrupt
  it** — the compiler won't object, only the runtime will.
- **Generic array creation is illegal** (`new T[]`, `new List<String>[10]`):
  covariant arrays + erased generics would defeat the store check. This is
  why collection classes hold `Object[]` internally and why
  `toArray(new T[0])` takes the typed array *from you*.

## `java.util.Arrays` — the missing methods

Arrays override nothing from `Object`, so the useful behaviour lives in a
utility class:

| You want | Wrong | Right |
|---|---|---|
| readable string | `arr.toString()` → `[I@1b6d3586` | `Arrays.toString(arr)` / `Arrays.deepToString(nested)` |
| content equality | `a == b` or `a.equals(b)` — identity | `Arrays.equals(a, b)` / `Arrays.deepEquals` |
| hash of contents | `arr.hashCode()` — identity | `Arrays.hashCode(arr)` |
| copy | assignment (copies the reference) | `Arrays.copyOf(arr, n)`, `arr.clone()`, `Arrays.copyOfRange` |
| sort / search | hand-rolled | `Arrays.sort`, then `Arrays.binarySearch` (sorted input only) |
| fill / bulk set | loop | `Arrays.fill`, `Arrays.setAll` |
| stream | loop | `Arrays.stream(arr)` → `IntStream` for primitives |

`System.arraycopy(src, srcPos, dest, destPos, len)` is the fast bulk copy
underneath `copyOf` — worth recognizing on sight in library code.

The name `[I@1b6d3586` is the JVM's type descriptor (`[I` = `int[]`) plus an
identity hash — the classic log-line giveaway that someone forgot
`Arrays.toString`.

### `Arrays.asList` — the three-trap method

```java
List<Integer> list = Arrays.asList(1, 2, 3);
list.add(4);                 // UnsupportedOperationException — fixed-size view
list.set(0, 9);              // fine — writes through to the array
```

1. It is a **fixed-size view over the array** — `set` works, `add`/`remove`
   throw.
2. With a **primitive array** it does not spread:
   `Arrays.asList(intArray)` is a `List<int[]>` of size 1, because `int[]`
   can't be a `T` — one object, not n elements.
3. Mutating the backing array mutates the list, and vice versa.

Modern code wants `List.of(...)` (truly immutable, Phase 3) or
`Arrays.stream(arr).boxed().toList()`.

## Why collections replace arrays in application code

- **Fixed size** — business data grows; `ArrayList` resizes itself.
- **Invariant generics catch at compile time** what covariant arrays only
  catch at runtime.
- **No useful `equals`/`toString`** — collections have both, which matters
  the moment an array lands in a record component or a test assertion
  (Phase 2's records topic hits this exact edge).
- **No API** — no `contains`, `map`, `filter` without `Arrays.stream`.

Arrays remain the right tool where they are genuinely better: primitive
numeric work (no boxing, contiguous memory), buffers (`byte[]` in I/O,
Phase 7), `String.toCharArray`, and as the implementation detail *inside*
collections. The working rule: **arrays at the edges and in hot loops,
collections in the model and the API.**

## Gotchas

**Symptom:** log line prints `[Ljava.lang.String;@4e25154f` instead of the data
**Cause:** arrays don't override `toString`; you get type descriptor + identity hash
**Fix:** `Arrays.toString(arr)` (or `deepToString` for nested). In string concatenation this is silent — no compile error, no warning

**Symptom:** `ArrayStoreException` deep inside code that "only assigns an element"
**Cause:** the array reference was up-cast via covariance (`Object[] o = stringArray`); the runtime store check caught a wrong-type write
**Fix:** don't share arrays through wider-typed references; use a `List<T>` where the compiler enforces invariance

**Symptom:** `UnsupportedOperationException` from `list.add` on a list that "worked fine before"
**Cause:** the list came from `Arrays.asList` — a fixed-size view, not an `ArrayList`
**Fix:** `new ArrayList<>(Arrays.asList(...))` when mutation is needed; `List.of` when it never is

**Symptom:** `Arrays.asList(myIntArray)` has size 1, element type `int[]`
**Cause:** primitives can't be generic type arguments, so the varargs `T...` binds the whole array as one element
**Fix:** `Arrays.stream(intArray).boxed().toList()`

**Symptom:** two arrays with identical contents fail `assertEquals` / `HashSet` dedup / `Map` lookup
**Cause:** array `equals`/`hashCode` are identity-based
**Fix:** `Arrays.equals` in code, `assertArrayEquals` in tests; never use an array as a map key or set element — use a `List` or a record

**Symptom:** "copied" array changes when the original is modified
**Cause:** `int[][] copy = original.clone()` is shallow — rows are shared references (same for any reference-array clone)
**Fix:** copy each level (`Arrays.stream(m).map(int[]::clone).toArray(int[][]::new)`), or model the data differently

**Symptom:** `binarySearch` returns a wrong/negative index for an element that is present
**Cause:** the array wasn't sorted — `binarySearch`'s contract requires it; results on unsorted input are undefined
**Fix:** `Arrays.sort` first, or use a linear scan / a `Set`

**Symptom:** mutating a "row" of `new int[3][4]` after assigning rows from a shared array changes several rows at once
**Cause:** an `int[][]` holds row *references*; assigning the same `int[]` into two slots aliases them
**Fix:** allocate or clone per row; remember nested arrays are arrays *of arrays*, never a matrix

## Interview questions

**★ Why does `Object[] o = new String[1]; o[0] = 42;` compile but throw?**
Arrays are covariant, so the assignment type-checks; every store into a
reference array is checked at runtime against the actual component type, and
`Integer` into a `String[]` throws `ArrayStoreException`. Generics made the
opposite choice — invariance — which turns the same mistake into a compile
error; that is why `List<String>` is not a `List<Object>`.

**★ Why is `List<int>` impossible but `int[]` fine — and what does that cost?**
Arrays are a JVM-level construct with a real component type at runtime;
generics are erased and work only over reference types. So primitive
sequences either stay arrays (compact, no boxing) or box into
`List<Integer>` (~4× memory per element before cache effects). `IntStream`
and primitive arrays exist exactly to avoid that tax in numeric code.

**★ What does `Arrays.asList` return, exactly?**
A fixed-size, array-backed `List` view: `set` writes through to the array,
`add`/`remove` throw `UnsupportedOperationException`, and changes to the
array show through the list. It is neither immutable nor growable — for
those, `List.of` or `new ArrayList<>(...)` respectively.

**★ Why must you never use an array as a `HashMap` key?**
Arrays inherit identity `equals`/`hashCode` from `Object`, so two arrays
with equal contents are different keys, and the same array re-fetched works
only by reference. Use a `List` or a record, whose value-based contracts
Phase 2 covers.

**Is `int[][]` a two-dimensional array?**
No — an array of `int[]` references. Rows are separate heap objects, may
have different lengths, may be `null`, and access costs two dereferences.
Genuinely contiguous matrix work uses a flat `int[rows * cols]` with manual
indexing.

**What's the difference between `arr.clone()`, `Arrays.copyOf`, and `System.arraycopy`?**
All shallow. `clone` duplicates at the same length; `copyOf` at a chosen
length (truncating or zero/null-padding); `arraycopy` copies a range into an
existing array you allocated. `copyOf` is implemented on `arraycopy`.

**Why does `arr.length` have no parentheses?**
It is a final field baked into the array type by the JLS, not a method —
unlike `String.length()` and `Collection.size()`. Historical inconsistency;
memorize it once.

---

← Prev: [Control flow and `switch` expressions](08-control-flow-switch/README.md) · Next → [Methods: overloading, varargs, pass-by-value](10-methods.md)
