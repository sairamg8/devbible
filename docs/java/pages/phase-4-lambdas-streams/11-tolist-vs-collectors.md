---
title: "Stream.toList() vs collect(Collectors.toList())"
sidebar_label: "11 · toList() vs Collectors.toList()"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 API documentation
> (docs.oracle.com/en/java/javase/25/) for `Stream.toList()`,
> `Collectors.toList()` and `Collectors.toUnmodifiableList()`, and the
> JDK 16 release notes for JDK-8180352 (the change that added
> `Stream.toList()`).

**`stream.toList()` and `stream.collect(Collectors.toList())` both end a
pipeline in a `List`, and they are not interchangeable. `toList()` (JDK 16+)
returns an *unmodifiable* list that permits null elements;
`Collectors.toList()` returns a list with *no guarantees at all* about type
or mutability — today it happens to be an `ArrayList`, and the spec
explicitly reserves the right to change that. The choice decides whether
downstream `add`/`sort` calls work, throw, or silently rely on an
implementation detail.**

## What each one actually promises

| | `Stream.toList()` | `Collectors.toList()` | `Collectors.toUnmodifiableList()` |
|---|---|---|---|
| Since | JDK 16 | JDK 8 | JDK 10 |
| Mutability | **unmodifiable** | **unspecified** (currently mutable `ArrayList`) | unmodifiable |
| Null elements | **allowed** | allowed | **rejected — `NullPointerException`** |
| Spec wording | "an unmodifiable List" | "no guarantees on the type, mutability, serializability, or thread-safety" | "an unmodifiable List … disallows null values" |
| Reads as | "give me the result" | "give me a list I may keep building" | "unmodifiable, and I promise no nulls" |

Three details worth memorising:

- **`toList()` is not `collect(toUnmodifiableList())` with a shorter name.**
  Both return unmodifiable lists, but they disagree about `null`:
  `toList()` keeps null elements, `toUnmodifiableList()` throws on them.
  A pipeline whose `map` can produce nulls behaves differently under each.
- **`Collectors.toList()`'s mutability is an accident of history.** Every
  JDK so far has returned an `ArrayList`, an enormous amount of code
  quietly depends on that, and the Javadoc still says the returned type is
  unspecified. Code that *needs* a mutable list should say so:
  `collect(Collectors.toCollection(ArrayList::new))` — that is the only
  form that puts the requirement in the type of the expression.
- **`toList()` may also outperform `collect(toList())`** for sized
  pipelines — the stream knows its size and can allocate once rather than
  grow an `ArrayList` — but that is an implementation detail, not the
  reason to choose it. Choose it for the immutability.

## The default, and when to deviate

**Default to `toList()`.** A terminal list is usually a *result* — handed
to a caller, rendered, serialized — and results should not be mutable.
Unmodifiability turns "someone mutated my return value" from a latent
aliasing bug into an immediate `UnsupportedOperationException` at the
mutation site (the fail-fast argument made in
[immutable design](../phase-2-classes-objects/12-immutable-design.md)).

Deviate in exactly two situations:

```java
// 1. You genuinely keep building the list afterwards — say so in the code:
List<Row> rows = query.results().stream()
        .map(Row::of)
        .collect(Collectors.toCollection(ArrayList::new));
rows.add(totalsRow(rows));                 // legal, and visibly intended

// 2. You need the no-nulls guarantee enforced at collection time:
List<Email> emails = users.stream()
        .map(User::email)                  // must never be null here
        .collect(Collectors.toUnmodifiableList());   // throws NPE if it is
```

Reaching for `Collectors.toList()` itself is now mostly a habit from
pre-16 code — it makes the weakest promise of the three.

## The migration trap

Mechanically replacing `collect(Collectors.toList())` with `toList()`
across a codebase — the refactor every IDE offers — is **not
behaviour-preserving**. The result flips from (in practice) mutable to
unmodifiable, and every downstream mutation becomes a runtime exception:

```java
List<OrderLine> lines = order.lines().stream()
        .filter(OrderLine::billable)
        .toList();                          // was collect(toList())

lines.sort(byAmount);                       // UnsupportedOperationException
lines.removeIf(OrderLine::isVoided);        // UnsupportedOperationException
Collections.shuffle(lines);                 // UnsupportedOperationException
```

The compiler cannot warn — `List` is `List`. The mutation may be far from
the pipeline (another class, another module, a framework), so the crash
surfaces at run time, on the code path that mutates, not the line that
changed. Sorting inside the pipeline (`.sorted(byAmount)`) or collecting
into an explicit `ArrayList` are the honest fixes.

The same trap runs through serialization frameworks: some deserializers
and mappers reuse or mutate the lists they are handed. A DTO populated
with `toList()` results can break a framework that previously mutated the
`ArrayList` it found there.

## Gotchas

**Symptom:** `UnsupportedOperationException` from `List.sort` / `add` / `remove`, nowhere near any stream code
**Cause:** the list was produced by `toList()` (or a bulk `collect(toList())` → `toList()` refactor) and is unmodifiable; the mutation site and the pipeline are far apart
**Fix:** mutate inside the pipeline (`sorted`, `filter`) or collect into `Collectors.toCollection(ArrayList::new)` when the caller genuinely builds on the result

**Symptom:** `NullPointerException` at the terminal operation after switching to `toUnmodifiableList()`
**Cause:** `toUnmodifiableList()` rejects null elements; the pipeline's `map` produces nulls that `toList()` and `Collectors.toList()` would have accepted
**Fix:** filter the nulls first (`.filter(Objects::nonNull)`), map them to a default, or use `toList()` if null is a legitimate element value

**Symptom:** code casts a collected list to `ArrayList` and it works — review flags it anyway
**Cause:** `Collectors.toList()` documents *no* guarantee about the returned type; the cast pins an implementation detail the spec reserves the right to change
**Fix:** `Collectors.toCollection(ArrayList::new)` — the only spelling that *promises* an `ArrayList`

**Symptom:** unit tests pass, production throws on mutation — only some code paths crash
**Cause:** unmodifiability is enforced at the *mutation*, not the creation: an unused mutable path in tests hid the mutation that production exercises
**Fix:** treat any `toList()` result as read-only everywhere; if a single caller needs mutation, copy at that boundary (`new ArrayList<>(result)`)

**Symptom:** `List.copyOf(streamResult)` throws `NullPointerException` though the stream "worked"
**Cause:** `toList()` allowed null elements through; `List.copyOf` (like `List.of`) rejects nulls — the two unmodifiable-list families have different null policies
**Fix:** decide the null policy at the pipeline (`filter(Objects::nonNull)`), not at the copy

## Interview questions

**★ What are the differences between `toList()` and `collect(Collectors.toList())`?**
`toList()` (JDK 16) returns an unmodifiable list that permits nulls.
`Collectors.toList()` returns a list with unspecified type and mutability —
in practice a mutable `ArrayList`, but the spec makes no such promise.
So they differ on the two things that matter: whether callers may mutate
the result, and what the specification actually guarantees.

**★ Why is replacing `collect(toList())` with `toList()` across a codebase risky?**
It is not behaviour-preserving: results flip from de-facto mutable to
unmodifiable, and every downstream `add`/`sort`/`removeIf` on them becomes
an `UnsupportedOperationException` — at run time, at the mutation site,
which may be in another module. The type system gives no warning because
both are just `List`.

**★ How do `toList()` and `Collectors.toUnmodifiableList()` differ, given both are unmodifiable?**
Null policy. `toList()` accepts null elements; `toUnmodifiableList()`
throws `NullPointerException` on them. Choose `toUnmodifiableList()` when
"no nulls" is an invariant you want enforced at collection time.

**★ You genuinely need a mutable `ArrayList` from a stream. What is the correct spelling and why?**
`collect(Collectors.toCollection(ArrayList::new))`. It is the only form
whose contract *guarantees* the concrete type — `Collectors.toList()`
returning `ArrayList` is an implementation detail, and `toList()` is
unmodifiable by design.

**Why did the JDK add `Stream.toList()` at all when `collect(toList())` existed?**
Ergonomics and stronger semantics: the most common terminal operation got
a short spelling with a *better* contract (unmodifiable, null-tolerant,
size-aware allocation) instead of the collector's deliberately weak one.
It also works directly on the stream without importing `Collectors`.

**A teammate argues all three return "basically the same list". What one-line demo settles each difference?**
`toList().add(x)` throws where `collect(toList()).add(x)` (today) does
not — mutability; `Stream.of((String) null).toList()` succeeds where
`.collect(toUnmodifiableList())` throws — null policy; and casting
`collect(toList())` to `ArrayList` compiles but pins unspecified
behaviour — the spec gap.

---

← Prev: [Stateful lambdas and side effects](10-stateful-lambdas.md) · Next → [Infinite streams](12-infinite-streams.md)
