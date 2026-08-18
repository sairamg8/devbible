---
title: "Two kinds of order"
sidebar_label: "1 · Two kinds of order"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.lang.Comparable` (contract and "consistent with equals" note),
> `java.util.Comparator`, and the class docs of `TreeMap`, `TreeSet`,
> `Collections#sort` and `Arrays#sort(Object[])`.

**`Comparable<T>` says "instances of this type have one built-in order" —
the type implements `compareTo` and every sorted API can use it without
being told anything. `Comparator<T>` says "here is *an* order" — a
standalone object passed to the use site. A type gets at most one natural
order but any number of external ones, which is the whole design: `String`
is naturally case-sensitive-lexicographic forever, and
`String.CASE_INSENSITIVE_ORDER` exists alongside it as a `Comparator`.**

## The one method, and what its result means

Both interfaces answer with an `int`, read by sign only:

```java
a.compareTo(b)      // Comparable — the type orders itself
cmp.compare(a, b)   // Comparator — a third object orders the two
```

- **negative** — `a` sorts before `b`
- **zero** — tied: neither sorts before the other
- **positive** — `a` sorts after `b`

Only the *sign* is meaningful. `-1`, `-42` and `Integer.MIN_VALUE` all mean
"before" — callers must never assume magnitude, and implementations are free
to return any negative or positive value. (That freedom is also the door the
[subtraction-overflow bug](02-building-comparators.md) walks through.)

## `Comparable` — natural order

```java
public record Version(int major, int minor, int patch)
        implements Comparable<Version> {
    @Override public int compareTo(Version o) {
        int c = Integer.compare(major, o.major);
        if (c != 0) return c;
        c = Integer.compare(minor, o.minor);
        if (c != 0) return c;
        return Integer.compare(patch, o.patch);
    }
}
```

Implement `Comparable` when the order is part of what the type *means*:
numbers by magnitude, strings lexicographically, `LocalDate` chronologically,
a `Version` by precedence. The payoff is that everything works with no
ceremony: `Collections.sort(versions)`, `new TreeSet<Version>()`,
`versions.stream().sorted()`, `Collections.max(versions)`.

The `compareTo` contract (from the Javadoc, the same shape as
[`equals`'s rules](../../phase-2-classes-objects/06-equals-hashcode/01-the-contract.md)):

1. **Antisymmetry** — `sgn(a.compareTo(b)) == -sgn(b.compareTo(a))` for all
   `a`, `b` (implying both throw or neither throws).
2. **Transitivity** — `a > b` and `b > c` imply `a > c`.
3. **Substitutability of ties** — if `a.compareTo(b) == 0`, then `a` and `b`
   compare the same way against every `c`.
4. **Strongly recommended: consistency with `equals`** —
   `a.compareTo(b) == 0` iff `a.equals(b)`. Not required, but the Javadoc
   asks classes that break it to say so ("Note: this class has a natural
   ordering that is inconsistent with equals"), because sorted collections
   behave oddly without it — [chunk 3](03-the-contract.md) shows how.
5. `a.compareTo(null)` **throws `NullPointerException`** — unlike
   `equals(null)`, which returns `false`. Natural order has no place for
   `null`.

Signs that a type should **not** get a natural order: there are several
equally reasonable orders (a `User` — by name? signup date? id?), or the
order is presentation policy rather than domain meaning. Give it none, and
order at the use site with comparators. A wrong natural order is worse than
no natural order, because it silently feeds every sorted API forever.

## `Comparator` — order as a value

```java
Comparator<User> byName   = Comparator.comparing(User::displayName);
Comparator<User> bySignup = Comparator.comparing(User::signupDate);

users.sort(byName);                        // this screen sorts by name
SortedSet<User> agenda = new TreeSet<>(bySignup);   // this set, by date
```

A `Comparator` is an object: pass it, store it in a constant, pick one at
runtime from a `switch` over a sort-key request parameter — the strategy
pattern without the class hierarchy, and since Java 8 usually a one-line
lambda or method-reference chain ([chunk 2](02-building-comparators.md)).

Use a comparator when: the type has no natural order; the natural order is
wrong for this screen; you're sorting someone else's type; or `null`s must
be tolerated (`nullsFirst`/`nullsLast` — natural order refuses them).

## Who consumes which

| API | No argument → natural order | `Comparator` overload |
|---|---|---|
| `list.sort(...)` / `Collections.sort` | `list.sort(null)` / `sort(list)` — elements must be `Comparable` | `list.sort(cmp)` |
| `Arrays.sort(T[])` | yes | `Arrays.sort(arr, cmp)` |
| `TreeSet` / `TreeMap` | no-arg constructor | constructor argument |
| [`PriorityQueue`](../09-queues-deques.md) | no-arg constructor | constructor argument |
| `Stream.sorted()` | no-arg form | `sorted(cmp)` |
| `Collections.max`/`min`, `Stream.max`/`min` | no-arg / — | comparator overloads |
| `Arrays.binarySearch` | yes — **must match the order the array was sorted with** | comparator overload, same warning |

Two traps live in this table. First, the no-argument forms don't check
comparability at compile time everywhere: `new TreeSet<>()` accepts any `T`
and throws `ClassCastException` **on the first `add`** if elements aren't
`Comparable` (the same late failure as `PriorityQueue`). Second,
`binarySearch` trusts you: searching with a different order than the sort
used doesn't throw — it just returns garbage indices.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `ClassCastException: X cannot be cast to Comparable` on `TreeSet.add` or `PriorityQueue.offer` | No-arg constructor + element type without natural order | Pass a `Comparator` at construction, or implement `Comparable` |
| `NullPointerException` from inside a sort | Natural order and plain `comparing` comparators reject `null` elements/keys | `Comparator.nullsFirst`/`nullsLast` around the comparator — a deliberate decision, not a reflex |
| `binarySearch` returns a wrong or negative index on data that's "definitely there" | Array sorted with one order, searched with another (or not sorted at all) | Search with the exact comparator the sort used; the API cannot detect the mismatch |
| Code returns `-1`/`0`/`1` from `compareTo` and a caller does `if (result == -1)` | Callers may only read the *sign* — implementations may return any negative/positive int | Compare with `< 0` / `> 0`, never with specific values |
| A type's "natural" order fights half its call sites | Order was presentation policy, promoted into the type | Remove `Comparable` (or never add it); supply named `Comparator` constants instead |
| `a.compareTo(b)` works, `b.compareTo(a)` throws | Asymmetric handling (e.g. one side null-checks a field the other doesn't) | Honor antisymmetry: both directions must agree, including on exceptions |

## Interview questions

1. **`Comparable` vs `Comparator` — when do you use which?** `Comparable`
   when the type owns exactly one meaning-bearing order (dates, versions,
   money amounts); `Comparator` when the order belongs to the use site, the
   type is someone else's, there are several plausible orders, or `null`s
   must be handled. A type gets one natural order; comparators are unlimited.
2. **What does the int returned by `compare`/`compareTo` mean?** Sign only:
   negative = first argument sorts earlier, zero = tie, positive = later.
   Magnitude is meaningless, and relying on `-1`/`1` specifically is a bug.
3. **Why does `new TreeSet<>()` compile for a type with no natural order,
   and when does it fail?** The no-arg constructor can't constrain `T` to
   `Comparable` — the cast happens at the first `add`, throwing
   `ClassCastException` at runtime. Constructor-with-comparator moves the
   requirement to compile time.
4. **What is "consistent with equals" and is it mandatory?** It means
   `compareTo`/`compare` returns 0 exactly when `equals` is true.
   Recommended, not mandatory — but sorted collections use *compare* for
   membership while hash collections use *equals*, so inconsistency makes
   `TreeSet` and `HashSet` disagree about the same elements (chunk 3).
5. **Why does `compareTo(null)` throw while `equals(null)` returns
   `false`?** The `equals` contract explicitly defines `false` for `null`;
   ordering has no sensible position for `null` (before? after?), so the
   contract mandates NPE and pushes the decision to `nullsFirst`/`nullsLast`
   comparators, where it's explicit.
6. **How would you sort the same `List<User>` three different ways in one
   service?** Three named `Comparator<User>` constants (by name, by date, by
   id), picked per request — order as data. A natural order can't do this;
   it's one fixed choice.
7. **Records and `Comparable` — what does the compiler give you?** Nothing:
   records generate `equals`/`hashCode`/`toString` but no `compareTo`. If a
   record deserves a natural order you implement it yourself (usually by
   delegating to `Integer.compare`/`thenComparing` chains over components).

---

← Index: [Comparable vs Comparator](README.md) · Next → [Building comparators](02-building-comparators.md)
