---
title: "Grouping and partitioning"
sidebar_label: "2 · Grouping and partitioning"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `Collectors#groupingBy` (all three overloads), `#partitioningBy`,
> `#counting`, `#mapping`, `#filtering`, `#flatMapping`, `#summingLong`,
> `#averagingDouble`, `#maxBy`, `#reducing`, `#collectingAndThen`,
> `#teeing`, and `#groupingByConcurrent`.

**`groupingBy` is SQL's `GROUP BY` for objects: a classifier function picks
the bucket, and a *downstream collector* decides what each bucket becomes —
a list by default, but just as easily a count, a sum, a set of mapped
values, or another level of grouping. The downstream idea is the whole
trick: any collector can run *per group*, which turns "orders per customer",
"revenue per product", and "top three per region" from loops with manual
map-merging into single expressions.**

## One argument: buckets of elements

```java
Map<String, List<Order>> byCustomer = orders.stream()
    .collect(Collectors.groupingBy(Order::customerId));
```

Every element lands in exactly one bucket (`classifier` must not return
null — that's an immediate `NullPointerException`, unlike SQL's null
group). Values keep encounter order inside each bucket; the *map* type and
its key order are unspecified — `HashMap` in practice.

## Two arguments: a downstream collector per bucket

```java
Map<String, Long> ordersPerCustomer = orders.stream()
    .collect(Collectors.groupingBy(Order::customerId, Collectors.counting()));

Map<String, Long> revenuePerProduct = orders.stream()
    .collect(Collectors.groupingBy(Order::productId,
                                   Collectors.summingLong(Order::totalCents)));

Map<String, Set<String>> productsPerCustomer = orders.stream()
    .collect(Collectors.groupingBy(Order::customerId,
        Collectors.mapping(Order::productId, Collectors.toSet())));
```

The downstream vocabulary that covers daily work:

- `counting()` — group size, as `Long`.
- `summingInt/Long/Double(fn)`, `averagingInt/Long/Double(fn)` — aggregates.
- `mapping(fn, downstream)` — transform *then* collect, inside the group.
- `filtering(pred, downstream)` (since 9) — filter *inside* the group. The
  difference from `.filter()` before the `groupingBy` is which groups exist:
  pre-filter drops empty groups entirely; `filtering` keeps every key and
  gives the non-matching ones an empty collection. "Show each customer's
  large orders, *including customers with none*" needs `filtering`.
- `flatMapping(fn, downstream)` (since 9) — per-group `flatMap`: customer →
  all line items of all their orders.
- `maxBy(comparator)` / `minBy(comparator)` — best element per group, as
  `Optional<T>` (a group is never empty, but the type can't say so).
- `reducing(...)` — per-group fold when nothing above fits.
- `collectingAndThen(downstream, finisher)` — post-process each group's
  result: `collectingAndThen(maxBy(cmp), Optional::orElseThrow)` unwraps
  the per-group `Optional`; `collectingAndThen(toList(), List::copyOf)`
  makes each group unmodifiable.

**Three levels deep — multi-level grouping** is just a `groupingBy` as the
downstream:

```java
Map<String, Map<Month, Long>> revenueByCustomerByMonth = orders.stream()
    .collect(Collectors.groupingBy(Order::customerId,
        Collectors.groupingBy(o -> o.placedAt().getMonth(),
            Collectors.summingLong(Order::totalCents))));
```

**The phase-gate shape — top N per group** — combines `collectingAndThen`
with a per-group sort-and-limit:

```java
Map<String, List<Order>> latestThree = orders.stream()
    .collect(Collectors.groupingBy(Order::customerId,
        Collectors.collectingAndThen(Collectors.toList(),
            list -> list.stream()
                .sorted(Comparator.comparing(Order::placedAt).reversed())
                .limit(3)
                .toList())));
```

Honest cost note: this materializes every group, then sorts each — fine for
request-sized data; for millions of rows per group a bounded structure (a
`PriorityQueue` of size 3 per group, or the database) wins.

## Three arguments: choosing the map

```java
TreeMap<String, Long> sorted = orders.stream()
    .collect(Collectors.groupingBy(Order::customerId,
                                   TreeMap::new,
                                   Collectors.counting()));
```

The middle argument supplies the map — `TreeMap::new` for key-sorted output,
`LinkedHashMap::new` for first-seen order, `EnumMap` via
`() -> new EnumMap<>(Status.class)` for enum keys (phase 2 topic 10 covers
why that wins).

## `partitioningBy` — exactly two buckets, both always present

```java
Map<Boolean, List<Order>> split = orders.stream()
    .collect(Collectors.partitioningBy(Order::isPaid));
List<Order> paid = split.get(true), unpaid = split.get(false);
```

Versus `groupingBy(o -> o.isPaid())`: `partitioningBy` **guarantees both
keys exist** even when one side is empty — `groupingBy` would simply omit
the absent key, and the innocent `split.get(false)` becomes a null. It also
takes a downstream: `partitioningBy(Order::isPaid, counting())`. When the
predicate is genuinely two-valued and both sides matter, partitioning states
the intent; when the boolean is really an enum in disguise, group by the
enum.

## `teeing` — two collectors over one pass (since 12)

```java
record Stats(long count, long totalCents) {}
Stats s = orders.stream().collect(Collectors.teeing(
    Collectors.counting(),
    Collectors.summingLong(Order::totalCents),
    Stats::new));
```

Every element feeds *both* downstreams; the merger combines the two results.
It replaces the "stream it twice" mistake (illegal on a one-shot stream) and
the manual accumulator class. As a `groupingBy` downstream it computes two
aggregates per group in one pass.

## `groupingByConcurrent` — the parallel special case

`groupingBy` in a parallel stream builds per-thread maps and merges them —
correct, some merge cost. `groupingByConcurrent` accumulates into one
`ConcurrentHashMap` from all threads, trading **encounter order inside
groups** for merge-free accumulation (it's `UNORDERED`). Only reach for it
with a parallel stream, an expensive grouping, and no ordering need — and
phase 4 topic 09 first.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `NullPointerException` the moment the pipeline runs a `groupingBy` | Classifier returned null — null keys are banned, unlike SQL's `GROUP BY` | Map nulls to a sentinel first: `o -> Objects.requireNonNullElse(o.region(), "UNKNOWN")` |
| `split.get(false)` NPEs after switching `partitioningBy` to `groupingBy` | `groupingBy` omits keys with no elements; `partitioningBy` guaranteed both | Use `partitioningBy` for two-way splits, or `getOrDefault(false, List.of())` |
| Customers with zero matching orders vanish from the report | Filtered *before* grouping — empty groups never form | `Collectors.filtering` as the downstream keeps every key with an empty list |
| Per-group `Optional` clutter after `maxBy` | `maxBy` downstream can't prove groups are non-empty | Wrap in `collectingAndThen(maxBy(cmp), Optional::orElseThrow)` |
| Group iteration order random in output | Unspecified map (`HashMap`) from one- and two-arg `groupingBy` | Three-arg overload with `TreeMap::new` or `LinkedHashMap::new` |
| Wrong totals summing money with `summingDouble` | Binary floating point on currency (phase 1 topic 05) | Keep cents in `long` + `summingLong`; `BigDecimal` via `reducing(BigDecimal.ZERO, fn, BigDecimal::add)` |
| Two passes over one stream throw `IllegalStateException` | Computed two aggregates by re-consuming the stream | `teeing`, or collect once and derive both from the result |
| Parallel `groupingBy` results ordered differently than sequential inside groups | Used `groupingByConcurrent` (UNORDERED) without noticing | Plain `groupingBy` preserves encounter order within groups; concurrent trades it away |

## Interview questions

1. **"Count orders per customer in one expression."** —
   `orders.stream().collect(groupingBy(Order::customerId, counting()))`.
   Follow-up "now total revenue instead" swaps the downstream for
   `summingLong(Order::totalCents)` — the answer they want is "change the
   downstream, not the shape".
2. **"`partitioningBy(pred)` vs `groupingBy(pred)` — same thing?"** — No:
   partitioning always materializes both `true` and `false` keys;
   grouping omits empty ones. That's the difference between a safe
   `get(false)` and an NPE.
3. **"Filter inside groups vs before grouping?"** — Pre-filter removes
   elements *and the groups they would have formed*; `Collectors.filtering`
   keeps all keys, filtering each bucket's contents. Choose by whether an
   empty group is information.
4. **"Deepest customer→month→revenue map?"** — Nested `groupingBy` with
   `summingLong` innermost (code above). Mention the map-type overload if
   the months must come out in order (`TreeMap::new`).
5. **"What does `mapping` buy over `.map()` before the collect?"** — A
   `.map()` upstream changes the element for *everything* including the
   classifier; `mapping` transforms only inside the downstream, after
   classification. Group `Order` by customer but keep only product ids:
   classifier needs the `Order`, downstream wants the id — that's `mapping`.
6. **"Average and count per group in one pass?"** — `teeing(averagingLong(fn),
   counting(), Result::new)` as the `groupingBy` downstream — or note that
   `summarizingLong` gives count/sum/min/avg/max in one collector when all
   five are welcome.
7. **"When is `groupingByConcurrent` correct?"** — Parallel stream +
   no within-group order requirement + contended merge actually measured as
   the cost. It's an ordering trade, not a free speedup.
8. **"Why does `groupingBy` reject null classifier results when a `HashMap`
   allows null keys?"** — Contract decision in `Collectors`, documented as
   NPE — the map's tolerance is irrelevant because the collector checks
   first. Sentinel keys make the null group explicit and printable.

---

← Prev: [The everyday collectors](01-everyday-collectors.md) · Index: [Collectors](README.md) · Next → [The machine underneath](03-the-machine-underneath.md)
