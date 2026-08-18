---
title: "Sets"
sidebar_label: "06 · Sets"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API documentation for `java.util.Set`,
> `HashSet`, `LinkedHashSet`, `TreeSet`, `SortedSet` and `NavigableSet` —
> including the `SortedSet` class doc's "consistent with equals" warning.

**A `Set` is a collection that refuses duplicates — and the three standard
implementations differ in exactly two dimensions: iteration order and cost.
`HashSet`: no order, constant-time membership. `LinkedHashSet`: insertion
order, constant-time membership. `TreeSet`: sorted order, log-time
membership. Pick by the order you need; and know that `HashSet` defines
"duplicate" by `equals`/`hashCode` while `TreeSet` defines it by
`compareTo`/`Comparator` — two definitions that can disagree.**

## The three, by what you need

```java
Set<String> members = new HashSet<>(emails);        // fastest, order = none
Set<String> inOrder = new LinkedHashSet<>(emails);  // keeps first-seen order
Set<String> sorted  = new TreeSet<>(emails);        // sorted, navigable
```

| | Order | `add`/`contains`/`remove` | Backed by | Nulls |
|---|---|---|---|---|
| `HashSet` | none — can change on resize | O(1) expected | a `HashMap` (topic 07's machinery) | one null allowed |
| `LinkedHashSet` | insertion order | O(1) expected | hash table + linked list through entries | one null allowed |
| `TreeSet` | comparator/natural order | O(log n) | red-black tree (`TreeMap`) | rejected under natural ordering¹ |

¹ `TreeSet.add(null)` throws `NullPointerException` with natural ordering —
`null.compareTo` cannot be called; a custom `Comparator` handling null is
possible and almost never worth it.

**Never iterate a `HashSet` and depend on the order** — it's unspecified,
changes with capacity, and differs across JDK versions. Tests that pass by
hash-order luck are the classic flake.

## The one-constructor dedupe

Every implementation's copy constructor deduplicates:

```java
List<String> emails = loadEmails();                       // has duplicates
var unique       = new LinkedHashSet<>(emails);           // deduped, first-seen order kept
var deduped      = new ArrayList<>(unique);               // back to a List if needed
```

`new LinkedHashSet<>(list)` is the idiomatic "dedupe but keep order";
`stream().distinct().toList()` does the same in pipeline form (and is
specified to keep encounter order for ordered streams). Case-insensitive
dedupe — the phase-gate wording — is a `TreeSet` job:

```java
Set<String> unique = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
unique.addAll(emails);                    // "Bob@x.com" and "bob@x.com" collide
```

…with the corollary below: that set now considers the two spellings *equal*,
and only the first-added one survives.

## Two definitions of "duplicate"

`HashSet` asks `hashCode` + `equals`
(**[the Phase 2 contract](../phase-2-classes-objects/06-equals-hashcode/README.md)**).
`TreeSet` never calls either — membership is `compareTo(...) == 0` (or the
`Comparator`). The `SortedSet` Javadoc warns about exactly this: an ordering
inconsistent with equals makes the set "behave strangely" — it still keeps
its own contract, but breaks the general `Set` contract stated in terms of
`equals`.

The canonical demonstration is `BigDecimal`
(**[Phase 1, topic 05](../phase-1-language-core/05-floating-point-bigdecimal/README.md)**):
`1.0` and `1.00` are `compareTo`-equal but not `equals`-equal — a `HashSet`
holds both, a `TreeSet` holds one. Same data, different cardinality,
depending on the implementation you picked. `String.CASE_INSENSITIVE_ORDER`
creates the same divergence on purpose.

## Mutation while inside — the disappearing element

Hash sets locate elements by hash bucket; trees locate by comparison path.
Mutate a field that feeds `hashCode`/`compareTo` *while the object is in the
set*, and the set files it under the old address forever: `contains` says
false, `remove` fails, and the "same" element can be added twice.
**[Phase 2, chunk 3 of the contract topic](../phase-2-classes-objects/06-equals-hashcode/03-where-it-breaks-in-production.md)**
dissects this failure; the collection-side rule is one line: **set elements
and map keys are immutable, or at least immutable in their
identity-bearing fields.**

## `TreeSet` beyond `contains` — the navigable API

Sorted order buys range and neighbour queries (`NavigableSet`):

```java
TreeSet<Integer> ports = new TreeSet<>(usedPorts);
ports.first();  ports.last();          // min / max
ports.floor(8080);                     // greatest ≤ 8080, or null
ports.ceiling(8080);                   // least ≥ 8080, or null
ports.headSet(1024);                   // all < 1024 (a live view)
ports.subSet(8000, 9000);              // range [8000, 9000) — live view
```

If you find yourself sorting a `HashSet`'s contents on every read, the data
wanted a `TreeSet` (write-time ordering) — or one `stream().sorted()` at the
single read point. The map-shaped versions of these queries are topic 08's
`TreeMap`.

## Set algebra

`addAll` (union), `retainAll` (intersection), `removeAll` (difference) —
mutating, so run them on a copy: `var overlap = new HashSet<>(a);
overlap.retainAll(b);`. For membership-only views there is also
`Collections.unmodifiableSet` and, mirroring lists, `Set.of`/`Set.copyOf`
(immutable, null-rejecting — and `Set.of` throws `IllegalArgumentException`
on duplicate *arguments*, catching fixture typos at construction).

## Gotchas

**Symptom:** test asserting on a collection's order passes locally, fails in CI
**Cause:** the collection is a `HashSet` — iteration order is unspecified and varies with capacity history and JDK
**Fix:** `LinkedHashSet` when order is part of the contract; or assert with order-insensitive matchers

**Symptom:** `TreeSet` "loses" elements a `HashSet` keeps
**Cause:** comparator considers them equal (`compareTo == 0`) though `equals` doesn't — `BigDecimal` scales, case-insensitive strings
**Fix:** intended for dedupe-by-rule; otherwise make the comparator consistent with `equals` — e.g. `comparing(...).thenComparing(...)` until it breaks all real ties (topic 10)

**Symptom:** `NullPointerException` from `TreeSet.add`, but only for one input
**Cause:** null element meets natural ordering — `compareTo` needs to be called on or with null
**Fix:** don't put null in sets; if a comparator must tolerate it, `Comparator.nullsFirst(...)` exists (topic 10) — but model absence instead

**Symptom:** element is in the set (debugger shows it) but `contains` returns false
**Cause:** an identity-bearing field mutated after insertion — hash bucket (or tree position) is now stale
**Fix:** immutable elements (records — Phase 2); if mutation is unavoidable, remove → mutate → re-add

**Symptom:** `set.retainAll(other)` destroyed data another module still needed
**Cause:** the algebra methods mutate in place, and the set was shared
**Fix:** copy first (`new HashSet<>(a)`) — or keep sets private and expose `Set.copyOf` snapshots (topic 05, chunk 3 semantics)

**Symptom:** `IllegalArgumentException: duplicate element` from a `Set.of(...)` fixture
**Cause:** `Set.of` rejects duplicate arguments by specification — usually a copy-paste in test data
**Fix:** fix the fixture; if runtime data may contain duplicates, `Set.copyOf(collection)` dedupes silently instead

## Interview questions

**★ HashSet vs LinkedHashSet vs TreeSet — how do you choose?**
By ordering need: none → `HashSet`; first-seen order (dedupe-preserving,
predictable display) → `LinkedHashSet`; sorted or range queries →
`TreeSet`. Cost follows: O(1) expected for the hash pair, O(log n) for the
tree.

**★ How does a `TreeSet` decide two elements are duplicates, and why can that disagree with a `HashSet`?**
`TreeSet` uses only `compareTo`/`Comparator` — zero means duplicate;
`HashSet` uses `hashCode`/`equals`. When ordering isn't consistent with
equals (`BigDecimal`, case-insensitive comparators), the two implementations
report different sizes for the same data — the `SortedSet` Javadoc calls
this out explicitly.

**★ Dedupe a `List` keeping first-seen order — one line?**
`new ArrayList<>(new LinkedHashSet<>(list))` — or
`list.stream().distinct().toList()`.

**★ Why must set elements be immutable?**
Both membership mechanisms cache position information derived from the
element's state at insertion — hash bucket or comparison path. Mutating an
identity-bearing field strands the element at a stale address: lookups miss
it, removal fails, duplicates get in.

**What does `floor(x)` give you that `contains(x)` can't, and where does that matter?**
The greatest element ≤ x even when x is absent — nearest-neighbour and
range logic: last deploy before this timestamp, price tier for an amount,
first free port after a base. Hash sets answer only exact membership.

**Why is there one null slot in `HashSet` but none in `TreeSet`?**
`HashSet` special-cases the null hash; `TreeSet` must call compare, and
`null.compareTo(x)` / `x.compareTo(null)` throw by contract. Either way the
practical rule is the same: no nulls in collections.

---

← Prev: [ArrayList](05-arraylist/README.md) · Next → [HashMap internals](07-hashmap-internals.md)
