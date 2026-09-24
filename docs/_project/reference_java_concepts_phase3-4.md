---
name: reference-java-concepts-phase3-4
description: Java phases 3–4 — load-bearing claims and sources (written 2026-08-18, session 01Ph138u)
metadata:
  type: reference
---

# Java phases 3–4 — load-bearing claims and sources (written 2026-08-18, session 01Ph138u)

For review/reuse without re-reading the pages. All documentation-validated (no sandbox);
sources are on each page's `> Verified:` line — JDK 25 Javadoc, JLS SE 25, JEPs.

## Phase 3 · Generics and collections (16/16)

- **Erasure** (02): one `.class` per generic type; no `new T[]`, no `instanceof List<String>`;
  overloads differing only in type args clash. JLS §4.6, §8.4.8.3 (bridge methods).
- **PECS** (03): `? extends` = producer/read, `? super` = consumer/write; canonical signature
  `Collections.copy(List<? super T>, List<? extends T>)`.
- **Map is not a Collection** (04); `SequencedCollection`/`SequencedMap` are JDK 21 (JEP 431).
- **ArrayList wins over LinkedList** (05) on cache locality despite big-O; growth ~1.5×.
- **HashMap** (07): bucket treeification at collision depth 8 (untreeify 6), power-of-two
  capacity, keys must have stable `hashCode`.
- **LinkedHashMap LRU** (08): `accessOrder=true` + `removeEldestEntry` override = 10-line LRU;
  ⚠️ access-order `get` is a structural-adjacent mutation → CME risk while iterating.
- **Comparator contract** (10, 3 chunks): TimSort throws "Comparison method violates its
  general contract!" data-dependently; subtraction comparators overflow into intransitivity;
  comparators inconsistent with `equals` make TreeSet disagree with HashSet (BigDecimal
  1.0 vs 1.00). SortedSet Javadoc carries the warning.
- **CME** (11, 3 chunks): fail-fast via `modCount` is best-effort, single-thread bugs included;
  silent-skip quirk removing second-to-last element; safe: `Iterator.remove`, `removeIf`,
  collect-then-mutate; COW/CHM iterators are snapshot/weakly-consistent, never throw.
- **Immutable collections** (12): `List.of` null-hostile (even `contains(null)` NPEs),
  `Set.of`/`Map.of` iteration order randomized per JVM run; `copyOf` no-op on already-immutable;
  `unmodifiableList` is a live VIEW.
- **`Arrays.asList`** (13): fixed-size write-through view; `set` works, `add` throws.

## Phase 4 · Lambdas, streams and Optional (13/13)

- **Lambdas** (01, 3 chunks): capture is by value of effectively-final locals; `this` is the
  enclosing instance (unlike anon classes). Chunk 3: `andThen`/`compose` order, `Predicate.not`,
  `java.util.function` declares no `throws` → 5 wrapper patterns, `UncheckedIOException` is the
  JDK's own precedent.
- **Method refs** (02): bound-receiver refs capture the receiver AT CREATION (stale-receiver /
  creation-time NPE bug); unbound `String::toLowerCase` shifts arity. JLS §15.13.3.
- **Pipeline** (03, 3 chunks): nothing runs before the terminal op; `count()` may elide `peek`
  (sized shortcut); streams are single-use (`IllegalStateException`); `Files.lines` needs
  try-with-resources.
- **Collectors** (05, 3 chunks): `toMap` throws `IllegalStateException` on duplicate keys —
  fix = merge fn or `groupingBy`; `toMap` NPEs on null VALUES (uses `Map.merge`); collector
  anatomy supplier/accumulator/combiner/finisher.
- **reduce** (06): identity must be a true identity (`reduce(0, Integer::max)` wrong for
  negatives-only… actually wrong when all < 0 → phantom 0); combiner runs only in parallel;
  money = `long` cents, `Math.addExact`.
- **Optional** (07, 3 chunks): return type only — not fields/params (serialization,
  identity-sensitive warning in Javadoc); `orElse` ALWAYS evaluates its arg vs `orElseGet`;
  `ofNullable` at legacy seams; JSpecify direction for the null-annotation alternative.
- **Parallel streams** (09): one process-wide `ForkJoinPool.commonPool` sized cores−1;
  blocking tasks starve it; NQ heuristic; custom-pool submission trick is unsupported folklore.
- **`Stream.toList()`** (11): unmodifiable but null-permitting; `Collectors.toList()`
  mutability is documented as unguaranteed; only `toCollection(ArrayList::new)` guarantees.
- **Gatherers** (13): JEP 485 final in JDK 24; `windowFixed` = batch-without-Guava;
  `mapConcurrent` runs on virtual threads with a concurrency cap; integrator returning false =
  short-circuit.

## Traps found this run (also in the cursor file)

- ⚠️ **fixlinks.py blind spot**: resolves `NN-topic.md` against directory `NN-topic/`, so a
  link to a deleted single file converted to a dir reports as fine. After any file→dir
  conversion, grep for the old path; don't trust "0 unresolved".
- ⚠️ Overnight-run forks can die AFTER writing a topic's README chunk table but BEFORE the
  last chunk — audit chunk tables against `ls`, not just the board (two stranded chunks found:
  comparator chunk 3, lambdas chunk 3).
