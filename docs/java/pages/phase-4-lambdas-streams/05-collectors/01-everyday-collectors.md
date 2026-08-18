---
title: "The everyday collectors: toList, toSet, toMap, joining"
sidebar_label: "1 · The everyday collectors"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `Collectors#toList`, `#toSet`, `#toUnmodifiableList`, `#toUnmodifiableSet`,
> `#toCollection`, `#toMap` (all three overloads), `#toUnmodifiableMap`,
> `#joining`, and `Stream#toList`.

**Four factory families cover most terminal collections: `toList`/`toSet`
(and their `toUnmodifiable*` siblings), `toCollection` when you need to name
the implementation, `toMap` — the one with the production crash — and
`joining` for strings. The rule that keeps you safe: every `toMap` over data
you did not generate yourself gets a merge function, because "the keys are
unique" is a claim about today's data, not a property of the code.**

## Lists and sets — and what the Javadoc refuses to promise

```java
List<String> emails = users.stream().map(User::email).collect(Collectors.toList());
List<String> emails2 = users.stream().map(User::email).toList();        // since 16
Set<String> domains  = users.stream().map(User::domain).collect(Collectors.toSet());
```

The fine print, straight from the API docs:

- `Collectors.toList()` — "There are no guarantees on the type, mutability,
  serializability, or thread-safety of the `List` returned." In practice it
  is an `ArrayList` today; code that *relies* on mutating the result is
  leaning on an implementation detail the spec explicitly withholds.
- `Collectors.toSet()` — same disclaimer, and **no guarantee of iteration
  order** (in practice a `HashSet`). Need order kept? `toCollection(LinkedHashSet::new)`.
- `Collectors.toUnmodifiableList()` / `toUnmodifiableSet()` /
  `toUnmodifiableMap()` (since 10) — guaranteed unmodifiable, and they
  **reject null elements** with `NullPointerException`, like `List.of`.
- `Stream.toList()` (since 16) is the shortest spelling and returns an
  **unmodifiable** list that, unlike the `toUnmodifiable*` collectors,
  *tolerates null elements*. It is not shorthand for
  `collect(Collectors.toList())` — the mutability differs. Phase 4's topic
  11 is that distinction in full.
- `toCollection(TreeSet::new)`, `toCollection(ArrayDeque::new)` — the escape
  hatch whenever the *implementation* matters: sortedness, insertion order,
  or a deliberately mutable result.

## `toMap` — and the crash that ships

The two-argument overload is the one everyone writes first:

```java
Map<String, User> byEmail = users.stream()
    .collect(Collectors.toMap(User::email, u -> u));
```

Its contract, per the Javadoc: **if the mapped keys contain duplicates, an
`IllegalStateException` is thrown when the collection operation is
performed.** Not at compile time, not on the first element — when the
duplicate arrives. This is the classic ships-then-crashes bug:

- Test fixtures have three users with three distinct emails → green.
- Production has a re-registered user, an imported legacy row, a
  case-variant duplicate → `IllegalStateException: Duplicate key
  alice@example.com (attempted merging values User[id=17] and User[id=203])`
  from the middle of a request handler, weeks after the deploy.

The message names the *key* and both *values* (since 9 — earlier versions
named only the value, making diagnosis worse). The fixes, in order of
honesty about the data:

```java
// 1 · Keep one deliberately — last write wins:
Collectors.toMap(User::email, u -> u, (first, second) -> second)

// 2 · Keep the "better" one — an actual merge decision:
Collectors.toMap(User::email, u -> u,
    (a, b) -> a.updatedAt().isAfter(b.updatedAt()) ? a : b)

// 3 · Duplicates are real data, not noise → you wanted groupingBy:
Map<String, List<User>> byEmail = users.stream()
    .collect(Collectors.groupingBy(User::email));
```

The merge function receives the two *values* (never the key) and runs only
on collision. Choosing between fix 1/2 and fix 3 is a modelling question:
**is a duplicate an error, a tie to break, or a group?** Say which in code.

Two more `toMap` behaviours the Javadoc commits to:

- **Null values throw.** `toMap` uses `Map.merge` internally, so a value
  mapper that returns `null` throws `NullPointerException` even with no
  duplicate keys. Mapping to a nullable field? Filter first, or collect with
  the three-arg `collect` into a `HashMap` that tolerates nulls.
- **The returned map type is unspecified** (practically `HashMap`). Need
  order or a specific type — the four-argument overload takes a map
  supplier:

```java
Map<String, User> ordered = users.stream()
    .collect(Collectors.toMap(User::email, u -> u,
        (a, b) -> b, LinkedHashMap::new));   // keeps encounter order
```

`toUnmodifiableMap` mirrors both overloads (with and without merge) minus
the supplier, and rejects null keys *and* values.

## `joining` — strings without the manual comma dance

```java
String csv  = names.stream().collect(Collectors.joining(", "));
String sql  = ids.stream().map(String::valueOf)
    .collect(Collectors.joining(", ", "IN (", ")"));   // IN (1, 2, 3)
```

- Three overloads: no args, delimiter, delimiter + prefix + suffix. The
  prefix/suffix form emits `prefix + suffix` even for an empty stream —
  `IN ()` — which is invalid SQL; guard the empty case yourself.
- It works only on `Stream<CharSequence>` — a `Stream<Integer>` needs a
  `.map(String::valueOf)` first; the compile error says so bluntly.
- Under the hood it accumulates into a `StringBuilder` (single allocation
  path), so it replaces both the `+=`-in-a-loop anti-pattern and the manual
  "trailing comma" fix-up.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `IllegalStateException: Duplicate key …` in production, tests green | Two-arg `toMap` over data whose keys were "unique" until they weren't | Add a merge function; or admit duplicates are groups and use `groupingBy` |
| `NullPointerException` from `toMap` with no duplicate anywhere | Value mapper returned `null` — `toMap` merges via `Map.merge`, which rejects null values | `filter` nulls out first, or collect into a null-tolerant map with three-arg `collect` |
| `UnsupportedOperationException` on `.add(...)` to a collected list | Result of `Stream.toList()` or `toUnmodifiableList()` — both unmodifiable | Collect with `Collectors.toList()`/`toCollection(ArrayList::new)` when mutation is the plan |
| `NullPointerException` collecting with `toUnmodifiableList` | Stream contained nulls; the unmodifiable collectors reject them (like `List.of`) | Filter nulls, or use `Stream.toList()` which tolerates them |
| Map iteration order differs run to run after `toMap` | Unspecified map type is a `HashMap`; order was never promised | Four-arg overload with `LinkedHashMap::new` (encounter order) or `TreeMap::new` (key order) |
| `IN ()` reaching the database from a `joining` with prefix/suffix | Empty stream still emits prefix + suffix | Check emptiness before building the clause |
| `joining` won't compile on a `Stream<Integer>` | `joining` requires `CharSequence` elements | `.map(String::valueOf)` before collecting |
| Set silently loses "duplicate" domain objects | `toSet` dedupes by `equals`/`hashCode`; your class inherited identity equality or an over-broad `equals` | Fix the `equals` contract (phase 2 topic 06) or collect to a list |

## Interview questions

1. **"What does `toMap` do with duplicate keys?"** — Two-arg overload:
   throws `IllegalStateException` at collection time, naming the key and
   both values. Three-arg: calls your merge function with the two values.
   The follow-up — "which do you write in production?" — the merge form,
   unless a duplicate genuinely indicates corrupt input, in which case the
   crash *is* the correct behaviour and you should be able to say so.
2. **"`collect(Collectors.toList())` vs `Stream.toList()`?"** — Unspecified
   (practically mutable `ArrayList`) vs guaranteed unmodifiable;
   `Stream.toList()` also tolerates nulls where `toUnmodifiableList`
   doesn't. Shorter is not a synonym.
3. **"How do you keep insertion order when collecting to a map?"** —
   Four-arg `toMap` with `LinkedHashMap::new` as the map supplier. `toMap`
   without a supplier promises nothing about the map type.
4. **"Why does `toMap` NPE on null values even without duplicates?"** — Its
   accumulator uses `Map.merge`, whose contract rejects null values. Either
   filter nulls before collecting or use the three-arg `collect` form with
   an explicit `HashMap` if nullable values are legitimate.
5. **"Build `IN (1, 2, 3)` from a `List<Long>`."** —
   `ids.stream().map(String::valueOf).collect(joining(", ", "IN (", ")"))` —
   and mention the empty-stream `IN ()` trap unprompted; that's the senior
   half of the answer.
6. **"When do you reach for `toCollection`?"** — When the implementation is
   the point: `TreeSet::new` for sorted-unique, `LinkedHashSet::new` for
   ordered-unique, `ArrayList::new` when you need guaranteed mutability that
   `toList()` withholds.
7. **"Is the result of `Collectors.toSet()` ordered?"** — No promise at all;
   practically `HashSet`, so iteration order can even change between JDK
   versions (hash randomization aside, capacity changes reorder). Ordered
   dedupe is `LinkedHashSet` via `toCollection`.

---

← Index: [Collectors](README.md) · Next → [Grouping and partitioning](02-grouping-partitioning.md)
