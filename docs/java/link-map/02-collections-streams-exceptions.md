---
title: "Link map · Java · Part 2 (phases 3–4–5)"
sidebar_label: "02 · collections streams exceptions"
sidebar_position: 2
---

# Link map · Java · Part 2 (phases 3–4–5)

Covers every topic row of phases 3, 4 and 5 in `docs/java/syllabus/02-core-library.md`: generics and collections (T03-01 to T03-16), lambdas, streams and `Optional` (T04-01 to T04-13), and exceptions (T05-01 to T05-08). That is 37 rows, and every one has a written page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Four pages (the JDK bug tracker, the NUS wiki, Techie Delight, Coding the Wheel) refuse plain scripted requests but load in a page reader; they were read there.

🔴 **Version note.** Our syllabus targets **Java 25 LTS** (`docs/java/README.md`; JDK 26 is the latest release). Official links point at the Java SE 25 API docs on docs.oracle.com, which were live on 2026-10-13. The Java Tutorials pages (docs.oracle.com/javase/tutorial) are written for older releases and say so in their own way: no sequenced collections, no `Stream.toList()`, no gatherers. Most third-party picks below were written for Java 8 to 11. They stay accurate for the concept but not for what is new: `Stream.toList()` (16), `takeWhile` (9), `List.copyOf` (10), gatherers (final in 24). Each such block says so.

---

## Phase 3 — Generics and collections

### T03-01 · Generics, raw types and the diamond — Master · ✅ written `docs/java/pages/phase-3-generics-collections/01-generics-raw-types/01-the-contract-with-the-compiler.md`
- **Read this:** [Raw Types and Unchecked Warnings](https://docs.oracle.com/javase/tutorial/java/generics/rawTypes.html) · The Java Tutorials · defines a raw type, shows assigning a raw type to a parameterized one gives an unchecked warning, and says raw types push errors to run time (*read*) · covers our angle: **partial** — no worked failing example and no diamond · fetched 2026-10-13
- **Beyond the docs:** [Java — Don't use raw types](https://dev.to/doppelmutzi/java-dont-use-raw-types-jn0) · Sebastian Weber, DEV Community, 2021-12-17 · shows a helper taking a raw `List` that slips an `Integer` into a `List<String>` with only warnings, then fails later, which is the "bug factory" in concrete form · fetched 2026-10-13 (*read*)
- **Our delta:** the diamond `<>` and why the warning is the compiler giving up on you.

### T03-02 · Type erasure — what it breaks — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/02-type-erasure.md`
- **Read this:** [Type Erasure](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html) · The Java Tutorials · the three steps: replace type parameters with bounds or `Object`, insert casts, generate bridge methods (*read*) · covers our angle: **partial** — states the mechanism, not the list of things it breaks; the restrictions page below is that list · fetched 2026-10-13
- **Also good:** [Restrictions on Generics](https://docs.oracle.com/javase/tutorial/java/generics/restrictions.html) · The Java Tutorials · the seven restrictions with the reason for each: no primitive type arguments, no `new E()`, no static fields of a type-parameter type, no casts or `instanceof` with parameterized types, no arrays of parameterized types, no generic `Throwable` subclasses, no overloads that erase to the same signature (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Arrays in Java Generics](https://angelikalanger.com/Articles/Papers/JavaGenerics/ArraysInJavaGenerics.htm) · Angelika Langer and Klaus Kreft, last updated 2003-10-30 · explains why arrays of parameterized types are a problem: arrays check element types at run time, and erasure leaves `Pair<Integer,Integer>[]` as just `Pair[]`; written for Java 5 era, covers the array rule only · fetched 2026-10-13 (*read*)
- **Our delta:** the full list (`instanceof`, `new T`, overloads on `List<A>` vs `List<B>`, one `.class` per generic type).

### T03-03 · Bounded types, wildcards and PECS — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/03-wildcards-pecs.md`
- **Read this:** [Wildcard Guidelines](https://docs.oracle.com/javase/tutorial/java/generics/wildcardGuidelines.html) · The Java Tutorials · the PECS rule under another name: an "in" variable (supplies data) takes `? extends T`, an "out" variable (receives data) takes `? super T`, `?` when only `Object` methods are used, no wildcard when it is both; shows why `List<? extends NaturalNumber>` rejects `add` (*read*) · covers our angle: **partial** — never says "PECS" and the "in/out" naming runs from the method's point of view · fetched 2026-10-13
- **Also good:** [Lower Bounded Wildcards](https://docs.oracle.com/javase/tutorial/java/generics/lowerBounded.html) · The Java Tutorials · the `? super` syntax with `addNumbers(List<? super Integer>)` accepting `List<Integer>`, `List<Number>` or `List<Object>`; defers the in/out guidance to the page above (*read*) · fetched 2026-10-13
- **Beyond the docs:** [PECS (Producer Extends Consumer Super)](https://github.com/nus-cs2030/2021-s1/wiki/PECS-%28Producer-Extends-Consumer-Super%29) · NUS CS2030 course wiki, last edit 2020-11-30 by the editor bingmeow1999 (original author not named) · puts the rule as "put into a structure: super; get out of a structure: extends", with `ChessPiece` lists and `Consumer.andThen` · fetched 2026-10-13 (*read*)
- **Our delta:** reading `Collections.copy(List<? super T>, List<? extends T>)` in one pass.

### T03-04 · The collection hierarchy — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/04-collection-hierarchy.md`
- **Read this:** [Outline of the Collections Framework](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/doc-files/coll-reference.html) · Java SE 25 API docs · the official outline of the interfaces, general-purpose and concurrent implementations, wrappers and legacy classes, one line each (*read*) · covers our angle: **partial** — an outline, not an explanation, and it does not mention the Java 21 sequenced interfaces · fetched 2026-10-13
- **Also good:** [Java Collections Framework](https://docs.oracle.com/en/java/javase/25/core/java-collections-framework.html) · Java SE 25 Core Libraries guide · lists the components and links to unmodifiable and sequenced collections (JDK 21); does not draw the hierarchy (*read*) · fetched 2026-10-13
- **Our delta:** the map (including that `Map` is not a `Collection`) and sequenced collections in one picture.

### T03-05 · `ArrayList` — growth and why `LinkedList` rarely wins — Master · ✅ written `docs/java/pages/phase-3-generics-collections/05-arraylist/01-the-default-list.md`
- **Read this:** [ArrayList](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html) · Java SE 25 API docs · says capacity grows automatically but the growth policy is not specified beyond constant amortized time for `add`; `ensureCapacity` and `trimToSize` (*read*) · covers our angle: **partial** — nothing on cache locality or `LinkedList` · fetched 2026-10-13
- **Beyond the docs:** [ArrayList vs LinkedList Puzzle (Issue 334)](https://www.javaspecialists.eu/archive/Issue334-ArrayList-vs-LinkedList-Puzzle.html) · Heinz Kabutz, The Java Specialists' Newsletter, 2026-04-28 · times adding 100 million elements on Java 25: `ArrayList` about 7x faster with the default GC but `LinkedList` faster under ZGC; the author calls it "not meant to be a thorough benchmark" (one laptop, one run), so treat it as a caution against quoting big-O alone · fetched 2026-10-13 (*read*)
- **Our delta:** the growth factor and the cache-locality argument stated as our own measured claim, not a quoted one. Searched also for a benchmark that confirms the locality argument; none was clean enough to cite.

### T03-06 · Sets — `HashSet`, `LinkedHashSet`, `TreeSet` — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/06-sets.md`
- **Read this:** [The Set Interface](https://docs.oracle.com/javase/tutorial/collections/interfaces/set.html) · The Java Tutorials · the three general-purpose implementations and the dedupe idioms (`new HashSet<>(c)`, `new LinkedHashSet<>(c)` to keep order, `Collectors.toSet()`); written for JDK 8 (*read*) · covers our angle: **partial** — nothing on `equals`/`hashCode` traps · fetched 2026-10-13
- **Also good:** [Set](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Set.html) · Java SE 25 API docs · the contract: no duplicates by `equals`, behaviour unspecified if an element is mutated in a way that changes `equals`, `Set.of` and `copyOf` are unmodifiable (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Difference between HashSet, TreeSet, and LinkedHashSet in Java](https://www.techiedelight.com/difference-between-hashset-treeset-linkedhashset-java) · Techie Delight · a side-by-side of structure, order, cost, null handling and navigation methods; page shows no author or date · fetched 2026-10-13 (*read*)
- **Our delta:** dedupe a list in one constructor call, and the `equals`/`hashCode` and comparator consistency traps.

### T03-07 · `HashMap` internals — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/07-hashmap-internals.md`
- **Read this:** [HashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) · Java SE 25 API docs · load factor 0.75, capacity as bucket count, rehash on growth, "many keys with the same `hashCode()`" slows any hash table, and `Comparable` keys may be used to break ties (*read*) · covers our angle: **partial** — never uses the word treeification and gives no thresholds · fetched 2026-10-13
- **Also good:** [JEP 180: Handle Frequent HashMap Collisions with Balanced Trees](https://openjdk.org/jeps/180) · OpenJDK · the design note for the Java 8 change: balanced trees replace long bucket lists, worst-case lookup O(n) to O(log n), helps any `Comparable` key; gives no threshold (*read*) · fetched 2026-10-13
- **Beyond the docs:** [HashMap performance improvements in Java 8](https://nurkiewicz.com/2014/04/hashmap-performance-improvements-in.html) · Tomasz Nurkiewicz, 2014-04-22 · a long bucket is replaced by a tree once it passes `TREEIFY_THRESHOLD = 8`, ordered by hash and then by `Comparable`, and why that blunts collision attacks; written against Java 8 · fetched 2026-10-13 (*read*)
- **Our delta:** why keys must be immutable, and the hash spreading step.

### T03-08 · `LinkedHashMap` (LRU) and `TreeMap` — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/08-linkedhashmap-treemap.md`
- **Read this:** [LinkedHashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedHashMap.html) · Java SE 25 API docs · the access-order constructor, which accesses count (`get`, `put`, `merge` and others), `removeEldestEntry` with a `MAX_ENTRIES` sample, and that a `get` in access-order is a structural modification (*read*) · covers our angle: **partial** — no `TreeMap` · fetched 2026-10-13
- **Also good:** [NavigableMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/NavigableMap.html) · Java SE 25 API docs · `lowerKey`, `floorKey`, `ceilingKey`, `higherKey`, the range views `subMap`, `headMap`, `tailMap` with inclusive or exclusive bounds, and `descendingMap` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [LRU Cache From LinkedHashMap (Issue 246)](https://javaspecialists.eu/archive/Issue246-LRU-Cache-From-LinkedHashMap.html) · Heinz Kabutz, The Java Specialists' Newsletter, 2017-02-28 · builds the LRU cache as a subclass: `true` as the access-order argument, `removeEldestEntry` returns true past the maximum, with a five-entry demo of what is evicted · fetched 2026-10-13 (*read*)
- **Our delta:** the `TreeMap` range queries; the thread-safety warning for the LRU idiom.

### T03-09 · Queues — `ArrayDeque` and `PriorityQueue` — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/09-queues-deques.md`
- **Read this:** [ArrayDeque](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html) · Java SE 25 API docs · "likely to be faster than `Stack` when used as a stack, and faster than `LinkedList` when used as a queue"; null elements are prohibited (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [PriorityQueue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html) · Java SE 25 API docs · heap-based, O(log n) `offer` and `poll`, constant-time `peek`, and the iterator "does not return the elements in any particular order" (*read*) · fetched 2026-10-13
- **Our delta:** job-scheduling shapes. Two searches found only thin tutorials and blog explainers of the heap, so no non-official pick is given.

### T03-10 · `Comparable` vs `Comparator` — Master · ✅ written `docs/java/pages/phase-3-generics-collections/10-comparable-comparator/01-two-orders.md`
- **Read this:** [Comparator](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Comparator.html) · Java SE 25 API docs · the sign and transitivity rules, "consistent with equals", `comparing`, `thenComparing` and `nullsFirst` (*read*) · covers our angle: **partial** — the contract that the "comparison method violates its general contract" crash breaks, but not the crash itself · fetched 2026-10-13
- **Also good:** [Comparable](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Comparable.html) · Java SE 25 API docs · natural ordering, the signum and transitivity rules, "consistent with equals" and `BigDecimal` (4.0 vs 4.00) as the standing exception (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Tidbits #2 from JCrete 2022 — TimSort](https://horstmann.com/unblog/2022-07-25/index.html) · Cay Horstmann · TimSort can detect an ordering that is not a total order and throws that exception; shows a pathological comparator, a JDK bug fixed in Java 9, and recommends `Comparator.comparing` over handwritten ones; the page shows no date (the URL carries 2022-07-25) · fetched 2026-10-13 (*read*)
- **Our delta:** the null-handling recipes and a small reproducer.

### T03-11 · Iteration and `ConcurrentModificationException` — Master · ✅ written `docs/java/pages/phase-3-generics-collections/11-concurrent-modification/01-fail-fast-machinery.md`
- **Read this:** [ArrayList](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html) · Java SE 25 API docs · fail-fast iterators throw unless the change goes through the iterator's own `remove` or `add`; best-effort only, "to detect bugs"; `set` is not structural (*read*) · covers our angle: **partial** — no `removeIf` and no for-each pitfall · fetched 2026-10-13
- **Also good:** [ConcurrentModificationException](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ConcurrentModificationException.html) · Java SE 25 API docs · the exception "does not always indicate" another thread; one thread can trigger it; fail-fast is best-effort and "should be used only to detect bugs" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Solving ConcurrentModificationException in Java](https://debugly.pages.dev/blog/posts/concurrentmodificationexception-java-guide/) · Debugly blog, 2025-12-15 (no author shown) · the `modCount` check on each `next()`, then `it.remove()`, `removeIf` (preferred), backward index loop and collect-then-`removeAll`; says the exception often has nothing to do with threads · fetched 2026-10-13 (*read*)
- **Our delta:** why the exception is a feature.

### T03-12 · Immutable collections — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/12-immutable-collections.md`
- **Read this:** [List — Unmodifiable Lists](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html) · Java SE 25 API docs · `List.of` and `List.copyOf`: mutators throw `UnsupportedOperationException`, no nulls, value-based (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Collection — Unmodifiable Collections and View Collections](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collection.html) · Java SE 25 API docs · "unmodifiable is not necessarily immutable", and an unmodifiable view's backing collection can still change (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Stop Mixing Up Unmodifiable Views and Immutable Lists](https://dev.to/amanshaw4511/stop-mixing-up-unmodifiable-views-and-immutable-lists-39jg) · Aman, DEV Community, 2025-12-24 · a short example where `unmodifiableList` follows a later `add` on the source but `List.copyOf` does not; its thread-safety remark is the author's, not checked against the docs · fetched 2026-10-13 (*read*)
- **Our delta:** shallow immutability with mutable elements.

### T03-13 · `Collections` and `Arrays` utilities — Understand · ✅ written `docs/java/pages/phase-3-generics-collections/13-collections-arrays-utilities.md`
- **Read this:** [Arrays](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html) · Java SE 25 API docs · `asList` is "a fixed-size list backed by the specified array"; changes write through in both directions, size-changing methods throw `UnsupportedOperationException`, a mismatched component type can give `ArrayStoreException` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Collections](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collections.html) · Java SE 25 API docs · `sort` (stable), `binarySearch` (negative insertion-point result, list must be sorted), `shuffle`, `fill`, `unmodifiableList` as a view (*read*) · fetched 2026-10-13
- **Our delta:** the `asList` traps (primitive array, no add, write-through). Two searches turned up blog posts on `asList`, but the readable ones either returned 403 or were thin, so none is cited.

### T03-14 · Choosing a collection — the decision table — Master · ✅ written `docs/java/pages/phase-3-generics-collections/14-choosing-a-collection/01-the-decision-table.md`
- **Read this:** [Implementations (The Java Tutorials)](https://docs.oracle.com/javase/tutorial/collections/implementations/index.html) · The Java Tutorials · the interface-by-implementation table, "clearly the one to use for most applications" for `HashSet`, `ArrayList` and `HashMap`, shared traits (not synchronized, fail-fast, nulls allowed) and "when in doubt, measure" (*read*; JDK 8 era) · covers our angle: **partial** — no mutation-pattern axis · fetched 2026-10-13
- **Also good:** [Outline of the Collections Framework](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/doc-files/coll-reference.html) · Java SE 25 API docs · one-line outline of every implementation, wrappers and concurrent classes (*read*) · fetched 2026-10-13
- **Our delta:** the table by lookup, order and mutation. Searches found only cheat sheets with disagreeing cells, and a Baeldung decision guide that returned 403, so no non-official pick is given.

### T03-15 · Writing an `Iterable` — Know · ✅ written `docs/java/pages/phase-3-generics-collections/15-writing-an-iterable.md`
- **Read this:** [Iterable](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Iterable.html) · Java SE 25 API docs · the contract for use in for-each, `forEach` as an enhanced for loop over `this` (*read*) · covers our angle: **partial** — never says each `iterator()` call must return a fresh iterator · fetched 2026-10-13
- **Also good:** [Iterator](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Iterator.html) · Java SE 25 API docs · `remove` is optional, once per `next()`, default throws `UnsupportedOperationException` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Implement Iterable Interface to work with for-each loops in Java](https://techiedelight.com/implement-iterable-interface-for-each-loops/) · Techie Delight · starts with a class that implements only `Iterator` (no for-each), then fixes it by implementing `Iterable` and returning a fresh iterator each call; a short basics example, no author or date shown · fetched 2026-10-13 (*read*)
- **Our delta:** fresh iterator per call, `remove`, and fail-fast behaviour.

### T03-16 · Legacy types — `Vector`, `Hashtable`, `Stack` — Know · ✅ written `docs/java/pages/phase-3-generics-collections/16-legacy-types.md`
- **Read this:** [Vector](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Vector.html) · Java SE 25 API docs · retrofitted to `List` in 1.2; "Unlike the new collection implementations, `Vector` is synchronized. If a thread-safe implementation is not needed, it is recommended to use `ArrayList`" (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Hashtable](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Hashtable.html) · [Stack](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Stack.html) · Java SE 25 API docs · `HashMap` instead of `Hashtable`, `ConcurrentHashMap` if thread-safety is wanted, no null keys or values; `Stack` says `Deque` "should be used in preference to this class" (*read*); the `ArrayDeque` page (T03-09, *read*) is the official "use this instead of `Stack`" line · fetched 2026-10-13
- **Our delta:** recognizing them in old code and the replacement for each. The one IDE-inspection page found returned 404, so no non-official pick is given.

---

## Phase 4 — Lambdas, streams and `Optional`

### T04-01 · Lambdas and functional interfaces — Master · ✅ written `docs/java/pages/phase-4-lambdas-streams/01-lambdas-functional-interfaces/01-syntax-capture-and-this.md`
- **Read this:** [java.util.function](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/function/package-summary.html) · Java SE 25 API docs · the naming scheme: `Function` T to R, `Consumer` T to void, `Predicate` T to boolean, `Supplier` nothing to R, `Bi` prefixes, primitive specializations (*read*) · covers our angle: **partial** — vocabulary, not capture or `this` · fetched 2026-10-13
- **Also good:** [State of the Lambda](https://cr.openjdk.org/~briangoetz/lambda/lambda-state-final.html) · OpenJDK, dated September 2013, author not named on the page (links point to Brian Goetz) · what counts as a functional interface and how the compiler decides (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Java 8 Tutorial](https://winterbe.com/posts/2014/03/16/java-8-tutorial/) · winterbe, 2014-03-16 · a hands-on walk through lambdas, the built-in `Predicate`, `Function`, `Supplier`, `Consumer` and `Comparator`, and which variables a lambda may capture; Java 8 era · fetched 2026-10-13 (*read*)
- **Our delta:** `this` inside a lambda versus an anonymous class.

### T04-02 · Method references — Understand · ✅ written `docs/java/pages/phase-4-lambdas-streams/02-method-references.md`
- **Read this:** [Method References](https://docs.oracle.com/javase/tutorial/java/javaOO/methodreferences.html) · The Java Tutorials · the four kinds with the equivalent lambda for the arbitrary-object form: `(a, b) -> a.compareToIgnoreCase(b)` (*read*) · covers our angle: **partial** — no advice on when a lambda reads better · fetched 2026-10-13
- **Also good:** [State of the Lambda](https://cr.openjdk.org/~briangoetz/lambda/lambda-state-final.html) · OpenJDK, September 2013 · method references as lambdas that name an existing method, with `Person::getName` as the example (*read*) · fetched 2026-10-13
- **Our delta:** when a reference reads worse than a lambda. No separate non-official pick: the winterbe tutorial (T04-01) covers three of the four forms only.

### T04-03 · The stream pipeline — Master · ✅ written `docs/java/pages/phase-4-lambdas-streams/03-stream-pipeline/01-lazy-until-terminal.md`
- **Read this:** [java.util.stream package summary](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/package-summary.html) · Java SE 25 API docs · source, intermediate (always lazy) and terminal operations; a stream cannot be reused after a terminal operation (*read*) · covers our angle: **full** for the model, not the print-debugging surprise · fetched 2026-10-13
- **Beyond the docs:** [Java 8 Stream Tutorial](https://winterbe.com/posts/2014/07/31/java8-stream-tutorial-examples/) · winterbe, 2014-07-31 · quotes that intermediate operations run only with a terminal operation and shows elements moving through the chain one at a time, so filter before map saves work · fetched 2026-10-13 (*read*)
- **Our delta:** the `peek` print-debugging surprise.

### T04-04 · Core ops — `map`, `filter`, `flatMap`, `sorted`, `distinct`, `limit`, `peek` — Master · ✅ written `docs/java/pages/phase-4-lambdas-streams/04-map-filter-flatmap/01-the-transforming-trio.md`
- **Read this:** [Stream](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/Stream.html) · Java SE 25 API docs · the method reference for each operation; `peek` "exists mainly to support debugging" (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Java 8 Streams: Definitive Guide to flatMap()](https://stackabuse.com/java-8-streams-definitive-guide-to-flatmap/) · Hiram Kamau, Stack Abuse, last updated 2023-05-17 · `map` on words gives a list of lists, `flatMap` returns one flat list; one-to-many transformations; the `Optional` counterpart · fetched 2026-10-13 (*read*)
- **Our delta:** orders to all their line items; `peek` as debug only.

### T04-05 · Collectors and the `toMap` duplicate-key trap — Master · ✅ written `docs/java/pages/phase-4-lambdas-streams/05-collectors/01-everyday-collectors.md`
- **Read this:** [Collectors](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/Collectors.html) · Java SE 25 API docs · two-argument `toMap` throws `IllegalStateException` on a colliding key; the three-argument merge form; `groupingBy` and `partitioningBy` (which always holds both keys) (*read*; first 100000 characters of a longer page) · covers our angle: **partial** — `counting` and `joining` not checked · fetched 2026-10-13
- **Beyond the docs:** [Java Collectors.toMap(): Collecting Stream Items into Map](https://howtodoinjava.com/java/stream/collect-stream-to-map/) · Lokesh Gupta, HowToDoInJava, page shows 2026-10-10 · the "Duplicate key 3 (attempted merging ...)" message, keep-first, keep-last, join and count merge functions, and groupingBy when you want every value · fetched 2026-10-13 (*read*)
- **Our delta:** the production story of the one that ships and then meets real data.

### T04-06 · `reduce` and primitive streams — Understand · ✅ written `docs/java/pages/phase-4-lambdas-streams/06-reduce-primitive-streams.md`
- **Read this:** [IntStream](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/IntStream.html) · Java SE 25 API docs · `sum()` is documented as `reduce(0, Integer::sum)`; `boxed()` and `mapToObj` are the way back to object streams (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Reduction (The Java Tutorials)](https://docs.oracle.com/javase/tutorial/collections/streams/reduction.html) · The Java Tutorials · `mapToInt(...).sum()` beside `reduce(0, (a, b) -> a + b)`, and why `reduce` suits single values while `collect` mutates a container (*read*; JDK 8 era) · fetched 2026-10-13
- **Beyond the docs:** [Java Stream Performance — Your Ideas](https://nipafx.dev/java-stream-performance-your-ideas/) · Nicolai Parlog, 2015-09-18 · benchmarks show the dominant factor is primitives versus objects, and a reader's claim that `mapToInt` before `max` is about twice as fast is checked against the post's own numbers, which show roughly 1.6x; the author reports unreliable boxed results (error margins up to about 56%) and guesses at accidental deoptimization; Java 8 era numbers · fetched 2026-10-13 (*read*)
- **Our delta:** summing money in cents without boxing, in a runnable example.

### T04-07 · `Optional` used correctly — Master · ✅ written `docs/java/pages/phase-4-lambdas-streams/07-optional/01-the-contract.md`
- **Read this:** [Optional](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Optional.html) · Java SE 25 API docs · API note: "primarily intended for use as a method return type where there is a clear need to represent 'no result'"; `orElse` takes an already-built value, `orElseGet` a supplier (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Java 8 SE Optional, a strict approach](https://nipafx.dev/stephen-colebourne-java-optional-strict-approach/) · Nicolai Parlog, 2015-08-27 · sets Stephen Colebourne's rules (no `Optional` fields, none in setters or constructors, return type only) beside his own two: stricter on `null` (design optionality away, otherwise prefer `Optional` to `null`) but looser on placement, since he allows fields and parameters, which differs from our page's position, so read it as the other side of the debate · fetched 2026-10-13 (*read*)
- **Our delta:** `orElse` always evaluates its argument, `map` and `flatMap` chains instead of `isPresent` plus `get`. A search for a Goetz or Marks primary text found only secondary pages; Stack Overflow could not be fetched.

### T04-08 · Streams vs loops — Understand · ✅ written `docs/java/pages/phase-4-lambdas-streams/08-streams-vs-loops.md`
- **Read this:** [Java streams vs for loop](https://jdriven.com/blog/2019/10/loop/) · Ties van de Ven, JDriven blog, 2019-10-14 · loops win on small lists, parallel streams add overhead, and he argues maintenance cost outweighs hardware cost; his conclusion leans toward streams (*read*) · covers our angle: **partial** — no early-exit or index-math rule · fetched 2026-10-13
- **Our delta:** the honest line: transformations to streams; early exit, index math and mutated locals to loops. No official page takes a side on this.

### T04-09 · Parallel streams — Understand · ✅ written `docs/java/pages/phase-4-lambdas-streams/09-parallel-streams.md`
- **Read this:** [When to use parallel streams](https://gee.cs.oswego.edu/dl/html/StreamParallelGuidance.html) · Doug Lea with contributions from Brian Goetz, Paul Sandoz, Aleksey Shipilev, Heinz Kabutz and others, dated 1 September 2014 and marked as a draft · independent per-element work, a splittable source, and roughly N times Q of 10,000 or more; `ArrayList` and arrays split well, `LinkedList` does not; avoid small workloads and blocking I/O (*read*) · covers our angle: **partial** — nothing on the common pool in a web app · fetched 2026-10-13
- **Also good:** [Parallelism (The Java Tutorials)](https://docs.oracle.com/javase/tutorial/collections/streams/parallelism.html) · The Java Tutorials · side effects, interference, stateful lambdas (*read*) · fetched 2026-10-13
- **Our delta:** the shared common pool and the benchmark that lied. The winterbe stream tutorial (T04-03, *read*) mentions the shared `ForkJoinPool.commonPool()` and blocking operations slowing other parallel code.

### T04-10 · Stateful lambdas and side effects — Understand · ✅ written `docs/java/pages/phase-4-lambdas-streams/10-stateful-lambdas.md`
- **Read this:** [java.util.stream package summary — Stateless behaviors, Side-effects](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/package-summary.html) · Java SE 25 API docs · the `Set` plus `map` example that gives nondeterministic results in parallel, and the preferred pattern of `filter` then `toList()` instead of `forEach` into a list (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Parallelism (The Java Tutorials)](https://docs.oracle.com/javase/tutorial/collections/streams/parallelism.html) · The Java Tutorials · the `map(e -> { parallelStorage.add(e); return e; })` example and the interference example that throws `ConcurrentModificationException` (*read*) · fetched 2026-10-13
- **Our delta:** the hidden ordering bug in a serial pipeline.

### T04-11 · `Stream.toList()` vs `Collectors.toList()` — Know · ✅ written `docs/java/pages/phase-4-lambdas-streams/11-tolist-vs-collectors.md`
- **Read this:** [JDK-8260559: convert JDK code to use Stream.toList()](https://bugs.openjdk.org/browse/JDK-8260559) · OpenJDK bug tracker, reported by Stuart Marks · `Stream.toList()` (JDK 16) is unmodifiable, `Collectors.toList()` is unspecified though an `ArrayList` in practice; serialized results do not read on older JDKs; "en masse conversion is inappropriate" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Collectors](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/Collectors.html) · Java SE 25 API docs · `toList` gives "no guarantees on the type, mutability, serializability, or thread-safety"; `toCollection(ArrayList::new)` for control (*read*) · fetched 2026-10-13
- **Our delta:** the null-element difference against `toUnmodifiableList`. Blog posts found repeat the bug text, so none is cited.

### T04-12 · Infinite streams — `iterate`, `generate`, `takeWhile`, `dropWhile` — Know · ✅ written `docs/java/pages/phase-4-lambdas-streams/12-infinite-streams.md`
- **Read this:** [Stream](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/Stream.html) · Java SE 25 API docs · `iterate` in both forms (the three-argument one stops when `hasNext` fails), `generate` (infinite, unordered), `takeWhile` and `dropWhile` as the longest-prefix operations on ordered streams (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Java 9 Additions to Stream](https://nipafx.dev/java-9-stream/) · Nicolai Parlog, 2016-06-20 · `takeWhile` returns the longest prefix that passes, `dropWhile` is the opposite, behaviour on unordered streams, and the three-argument `iterate` (`Stream.iterate(1, i -> i <= 10, i -> 2 * i)`) · fetched 2026-10-13 (*read*)
- **Our delta:** the short-circuit rule that keeps an infinite stream finite.

### T04-13 · Stream gatherers — Know · ✅ written `docs/java/pages/phase-4-lambdas-streams/13-stream-gatherers.md`
- **Read this:** [JEP 485: Stream Gatherers](https://openjdk.org/jeps/485) · OpenJDK · final in JDK 24 after previews in 22 and 23; the built-ins `fold`, `mapConcurrent`, `scan`, `windowFixed` and `windowSliding`; `windowFixed` turns 1 to 9 into three lists of three (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Gatherers](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/Gatherers.html) · Java SE 25 API docs · one-line contracts for `fold`, `mapConcurrent` (virtual threads, preserves order), `scan`, `windowFixed`, `windowSliding` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Stream Gatherers (JEP 485)](https://horstmann.com/unblog/2024-10-01/index.html) · Cay Horstmann · motivates gatherers by the awkward stateful lambda for dropping adjacent duplicates, then builds a custom gatherer with `Gatherer.ofSequential`; page shows no date (the URL carries 2024-10-01) · fetched 2026-10-13 (*read*)
- **Our delta:** fixed-size batches in one line.

---

## Phase 5 — Exceptions and failure design

### T05-01 · The hierarchy, checked vs unchecked — Master · ✅ written `docs/java/pages/phase-5-exceptions/01-hierarchy-checked-unchecked/01-the-tree.md`
- **Read this:** [Unchecked Exceptions — The Controversy](https://docs.oracle.com/javase/tutorial/essential/exceptions/runtime.html) · The Java Tutorials · runtime exceptions signal programming errors; checked exceptions are part of a method's API; the guideline "If a client can reasonably be expected to recover from an exception, make it a checked exception" (*read*) · covers our angle: **partial** — the tutorial leans toward checked, our page notes the modern lean to unchecked · fetched 2026-10-13
- **Also good:** [Throwable](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Throwable.html) · Java SE 25 API docs · `Error` and `Exception` as the two conventional branches; checked means a `Throwable` that is neither a `RuntimeException` nor an `Error` (*read*) · fetched 2026-10-13
- **Our delta:** why not to catch `Error`. A first search found opinion pieces only; no primary-grade debate piece was fetchable.

### T05-02 · `try`/`catch`/`finally`, multi-catch — Master · ✅ written `docs/java/pages/phase-5-exceptions/02-try-catch-finally/01-catch-ordering-multicatch.md`
- **Read this:** [The finally Block](https://docs.oracle.com/javase/tutorial/essential/exceptions/finally.html) · The Java Tutorials · `finally` runs after `return`, `break` and `continue`; may not run if the JVM exits; advises try-with-resources for resources (*read*) · covers our angle: **partial** — nothing on `finally` that throws or returns · fetched 2026-10-13
- **Also good:** [Catching and Handling Exceptions](https://docs.oracle.com/javase/tutorial/essential/exceptions/catch.html) · The Java Tutorials · handler order, multi-catch with `|`, and that the multi-catch parameter is implicitly `final` (*read*) · fetched 2026-10-13
- **Our delta:** what happens when `finally` itself throws or returns (the pending exception is lost). The page that covers it best in the search results was unreachable.

### T05-03 · try-with-resources — Master · ✅ written `docs/java/pages/phase-5-exceptions/03-try-with-resources/01-the-desugaring.md`
- **Read this:** [The try-with-resources Statement](https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html) · The Java Tutorials · `AutoCloseable`, reverse close order, and that the body's exception propagates while close exceptions are suppressed and readable via `getSuppressed()` (*read*) · covers our angle: **partial** — no desugaring · fetched 2026-10-13
- **Also good:** [AutoCloseable](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/AutoCloseable.html) · Java SE 25 API docs · `close()` need not be idempotent (unlike `Closeable`), and should not throw `InterruptedException` because it may be suppressed (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Java Try With Resources](https://jenkov.com/tutorials/java-exception-handling/try-with-resources.html) · Jakob Jenkov, last updated 2019-08-25 · contrasts it with try-catch-finally, where an exception in `finally` replaces the earlier one and the first is lost rather than suppressed; also an effectively final variable as a resource (Java 9) · fetched 2026-10-13 (*read*)
- **Our delta:** the compiler desugaring, step by step.

### T05-04 · Custom exceptions and translation at layer boundaries — Understand · ✅ written `docs/java/pages/phase-5-exceptions/04-custom-exceptions-translation.md`
- **Read this:** [Throwable — cause and `initCause`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Throwable.html) · Java SE 25 API docs · a cause is attached by constructor or `initCause`, with a `LowLevelException` to `HighLevelException` example (*read*) · covers our angle: **partial** — the mechanism, no layering advice · fetched 2026-10-13
- **Beyond the docs:** [Effective Java: Throw exceptions appropriate to the abstraction](https://dev.to/kylec32/effective-java-throw-exceptions-appropriate-to-the-abstraction-1d4e) · Kyle Carter, DEV Community, 2021-09-09 (edited 2023-09-07) · a summary of the Effective Java item: translate to a type that fits the abstraction, chain the cause, and do not silently log and ignore; a book summary, not the book · fetched 2026-10-13 (*read*)
- **Our delta:** `SQLException` to `OrderRepositoryException` to a clean HTTP 500.

### T05-05 · Reading a stack trace fast — Master · ✅ written `docs/java/pages/phase-5-exceptions/05-reading-stack-traces/01-anatomy-and-the-scan.md`
- **Read this:** [Reading a stack trace properly](https://codingthewheel.com/articles/reading-a-stack-trace/) · Coding the Wheel · find the first frame in your own code, read the message, and in a "Caused by" chain the last one is the root cause; a general skill with Java examples, also covers Python and Node.js; no author or date shown · covers our angle: **partial** — nothing on traces lost by a rethrow without cause (*read*) · fetched 2026-10-13
- **Also good:** [Chained Exceptions](https://docs.oracle.com/javase/tutorial/essential/exceptions/chained.html) · The Java Tutorials · `getCause`, `initCause`, and a `getStackTrace()` loop over `StackTraceElement` (*read*) · [StackTraceElement](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/StackTraceElement.html) · Java SE 25 API docs · what one frame holds and the `module/Class.method(File.java:line)` shape (*read*) · fetched 2026-10-13
- **Our delta:** the lost-stack-trace case, and the your-code-first scan.

### T05-06 · Checked exceptions inside lambdas — Understand · ✅ written `docs/java/pages/phase-5-exceptions/06-checked-exceptions-lambdas.md`
- **Read this:** [Exceptions in lambdas](https://blog.frankel.ch/exceptions-lambdas/) · Nicolas Fränkel, 2022-10-16 · compares inline try/catch, a wrapper class, Lombok `@SneakyThrow`, Commons Lang `Failable` and Vavr's `Try`; notes `Failable` surfaces as `UndeclaredThrowableException` (*read*) · covers our angle: **partial** — `Files.lines` is not the example · fetched 2026-10-13
- **Also good:** [Stream Gatherers (JEP 485)](https://horstmann.com/unblog/2024-10-01/index.html) · Cay Horstmann · mentions a `mapChecked` gatherer for checked exceptions (*read*) · fetched 2026-10-13
- **Our delta:** the plain wrapper pattern and when to stop at it.

### T05-07 · Exceptions as control flow — Understand · ✅ written `docs/java/pages/phase-5-exceptions/07-exceptions-as-control-flow.md`
- **Read this:** [Exceptional performance](https://shipilev.net/blog/2014/exceptional-performance/) · Aleksey Shipilev, last updated 2016-02-02 · the stack trace is captured at construction and its cost grows with call-stack depth (about 83 µs at depth 1024 against 2 µs at depth 0 on JDK 7u40); a stackless or preallocated exception is far cheaper; rule of thumb around 10 to the minus 4 frequency; old JDK, so read for the shape not the numbers (*read*) · covers our angle: **partial** — no `Optional` or result-type side · fetched 2026-10-13
- **Also good:** [Optional](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Optional.html) · Java SE 25 API docs · the return type for "no result" (*read*) · fetched 2026-10-13
- **Our delta:** expected absence returns `Optional`; broken invariants throw.

### T05-08 · Where the global handler lives — Know · ✅ written `docs/java/pages/phase-5-exceptions/08-global-handler.md`
- **Read this:** [Controller Advice (Spring Framework reference)](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-advice.html) · Spring Framework docs · `@ExceptionHandler` in a `@ControllerAdvice` or `@RestControllerAdvice` applies to any controller, and runs after the controller's own handlers (*read*) · covers our angle: **partial** — MVC only; nothing on other threads · fetched 2026-10-13
- **Also good:** [Thread.UncaughtExceptionHandler](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.UncaughtExceptionHandler.html) · Java SE 25 API docs · the JVM queries the thread's handler when it is about to terminate; if none is set the `ThreadGroup` acts as the handler and may forward to the default; "Any exception thrown by this method will be ignored by the Java Virtual Machine" (*read*) · fetched 2026-10-13
- **Our delta:** why `catch (Exception e) {}` mid-stack is where incidents hide. Search results on swallowed executor exceptions were forum answers I could not tie to the Javadoc, so none is cited.
