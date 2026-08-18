---
title: "Part 2 — The core library"
sidebar_label: "2 · Core library"
sidebar_position: 2
---

> Phases 3–6 · Generics, collections, streams, exceptions and concurrency

The standard library is where Java earns its keep. Collections and streams are
what you write all day; exceptions are how failures cross layers; concurrency is
where the JVM is a decade ahead of most runtimes — and where the bugs are worst.

---

## Phase 3 — Generics and collections

Every request handler you will ever write moves data through these types.
Choosing the right one — and knowing its cost model — is daily work.

| Topic | Tier |
|---|---|
| Generics: why raw types (`List` instead of `List<Order>`) are a bug factory the compiler can no longer help with; the diamond `<>` | <span className="db-tier t-master">Master</span> |
| **Type erasure** — what it breaks: no `new T[]`, no `instanceof List<String>`, one `.class` per generic type. Why overloads on `List<A>` vs `List<B>` won't compile | <span className="db-tier t-understand">Understand</span> |
| Bounded types and wildcards: `? extends` / `? super`, **PECS** — reading a library signature like `Collections.copy(List<? super T>, List<? extends T>)` without flinching | <span className="db-tier t-understand">Understand</span> |
| The collection hierarchy: `Collection`, `List`, `Set`, `Map` (not a `Collection`!), `Queue`, `Deque` — the map of what exists | <span className="db-tier t-understand">Understand</span> |
| **`ArrayList`** — the default list, its growth strategy, and why `LinkedList` almost never wins in practice despite what the big-O table promises (cache locality) | <span className="db-tier t-master">Master</span> |
| Sets: `HashSet` for membership, `LinkedHashSet` for iteration order, `TreeSet` for sorted — dedupe a list in one constructor call | <span className="db-tier t-understand">Understand</span> |
| **`HashMap` internals**: buckets, hashing, treeification at collision depth — enough to explain why keys must be immutable and `hashCode` must spread | <span className="db-tier t-understand">Understand</span> |
| `LinkedHashMap` (access-order = a 10-line LRU cache) and `TreeMap` (range queries, `floorKey`/`ceilingKey`) | <span className="db-tier t-understand">Understand</span> |
| Queues: `ArrayDeque` for stacks and queues, `PriorityQueue` for "next most urgent" — job scheduling shapes | <span className="db-tier t-understand">Understand</span> |
| **`Comparable` vs `Comparator`**: natural vs external order, `Comparator.comparing(...).thenComparing(...)`, null handling, and the "comparison method violates its general contract" crash from an inconsistent comparator | <span className="db-tier t-master">Master</span> |
| Iteration and **`ConcurrentModificationException`** — removing from a list while iterating it: `removeIf`, iterators, and why the exception is a feature | <span className="db-tier t-master">Master</span> |
| **Immutable collections**: `List.of`/`Map.of`/`Set.of`, `copyOf`, vs `Collections.unmodifiableList` (a view — the underlying list can still change under you) | <span className="db-tier t-understand">Understand</span> |
| `Collections` and `Arrays` utilities: `sort`, `binarySearch`, `shuffle`, `asList` (fixed-size trap), `fill` | <span className="db-tier t-understand">Understand</span> |
| **Choosing a collection — the decision table**: by lookup pattern, ordering need, and mutation pattern. The API-shape question in every design interview | <span className="db-tier t-master">Master</span> |
| Writing an `Iterable` — implementing iteration for your own types | <span className="db-tier t-know">Know</span> |
| Legacy types: `Vector`, `Hashtable`, `Stack` — recognize them in old code, never write them | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** given "look up users by id, keep signup order for
display, dedupe emails case-insensitively", you name the exact types —
`HashMap`, `LinkedHashSet` or a list, `TreeSet` with a comparator — and the cost
of each operation.

---

## Phase 4 — Lambdas, streams and `Optional`

Functional Java is how collection-shaped work reads since Java 8. The skill is
knowing the collectors — and knowing when a plain loop is clearer.

| Topic | Tier |
|---|---|
| **Lambdas and functional interfaces**: `Function`, `Supplier`, `Consumer`, `Predicate`, `BiFunction` — the vocabulary every modern Java API speaks | <span className="db-tier t-master">Master</span> |
| Method references: `User::getEmail`, `String::toLowerCase`, constructor refs — when they read better than lambdas and when they don't | <span className="db-tier t-understand">Understand</span> |
| **The stream pipeline**: source → intermediate (lazy!) → terminal. Nothing runs until the terminal op — the print-debugging surprise | <span className="db-tier t-master">Master</span> |
| Core ops: `map`, `filter`, **`flatMap`** (orders → all their line items), `sorted`, `distinct`, `limit`, `peek` (debug only) | <span className="db-tier t-master">Master</span> |
| **Collectors**: `toList`, `toSet`, **`toMap` and its duplicate-key `IllegalStateException`** (the one that ships and then meets real data), `groupingBy`, `counting`, `joining`, `partitioningBy` | <span className="db-tier t-master">Master</span> |
| `reduce`, and primitive streams (`IntStream`, `mapToInt`) — summing money-in-cents without boxing every element | <span className="db-tier t-understand">Understand</span> |
| **`Optional` used correctly**: a return type, not a field or parameter; `orElse` (always evaluated!) vs `orElseGet`; `map`/`flatMap`/`filter` chains vs `isPresent`+`get` | <span className="db-tier t-master">Master</span> |
| Streams vs loops — the honest line: transformation pipelines → streams; early exit, index math, mutation of locals → loop | <span className="db-tier t-understand">Understand</span> |
| **Parallel streams** — why `.parallel()` in a web app is usually a mistake: the shared common pool, tiny workloads, and the benchmark that lied | <span className="db-tier t-understand">Understand</span> |
| Stateful lambdas and side effects inside pipelines — the hidden ordering bug | <span className="db-tier t-understand">Understand</span> |
| `Stream.toList()` (unmodifiable) vs `collect(Collectors.toList())` (mutable, by accident of history) | <span className="db-tier t-know">Know</span> |
| Infinite streams: `Stream.iterate`, `generate`, `takeWhile`/`dropWhile` | <span className="db-tier t-know">Know</span> |
| **Stream gatherers** (`Stream.gather`, final in 24): windowing and custom intermediate ops — fixed-size batches without a third-party library | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can turn "group orders by customer, keep the three
most recent each, as `Map<CustomerId, List<Order>>`" into one readable pipeline —
and can also say when you'd refuse to and write the loop.

---

## Phase 5 — Exceptions and failure design

Exceptions are Java's failure channel across every layer boundary. Most codebases
get them wrong in one of two directions: swallowing, or wrapping without cause.

| Topic | Tier |
|---|---|
| The hierarchy: `Throwable` → `Error` (don't catch) / `Exception` → `RuntimeException`. **Checked vs unchecked** — the debate, and the modern lean toward unchecked in application code | <span className="db-tier t-master">Master</span> |
| `try`/`catch`/`finally`, multi-catch (`catch (IOException \| SQLException e)`), and what happens when `finally` itself throws or returns | <span className="db-tier t-master">Master</span> |
| **try-with-resources**: `AutoCloseable`, close order (reverse), suppressed exceptions — the reason connection leaks stopped being routine | <span className="db-tier t-master">Master</span> |
| Custom exceptions and **translation at layer boundaries**: `SQLException` → `OrderRepositoryException` → a 500 with a clean message. Always pass the cause | <span className="db-tier t-understand">Understand</span> |
| Reading a stack trace fast: `Caused by` chains, your-code-first scanning, lost stack traces from re-`throw new` without cause | <span className="db-tier t-master">Master</span> |
| Checked exceptions inside lambdas — why `Files.lines(...).map(...)` fights you, and the wrapper patterns | <span className="db-tier t-understand">Understand</span> |
| Exceptions as control flow — why not: cost of `fillInStackTrace`, and returning `Optional`/result types for *expected* absence vs throwing for *broken invariants* | <span className="db-tier t-understand">Understand</span> |
| Where the global handler lives in a real service — `@ControllerAdvice` (Phase 9), thread `UncaughtExceptionHandler`, and why `catch (Exception e) {}` in the middle of the stack is where incidents go to hide | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** your repository layer throws one domain exception with
the SQL cause attached, nothing in between logs-and-rethrows (double logging),
and the stack trace at the top still names the original line.

---

## Phase 6 — Concurrency

The deepest phase in the syllabus, on purpose. Virtual threads made concurrent
Java simple to *write* — the model underneath is unchanged, and it is the model
that pages you at 3am if you skip it.

| Topic | Tier |
|---|---|
| Threads: creation, lifecycle, daemon threads, `join`, `interrupt` — and interruption as cooperative cancellation, not a kill switch | <span className="db-tier t-understand">Understand</span> |
| **Platform vs virtual threads (21+)**: millions of cheap threads, thread-per-request without pools — what changed, what didn't (CPU work is still CPU work) | <span className="db-tier t-master">Master</span> |
| **Race conditions**: check-then-act, read-modify-write — the double-charge bug written as two innocent lines | <span className="db-tier t-master">Master</span> |
| `synchronized` and intrinsic locks: what it guards, granularity, lock on private final objects not `this` | <span className="db-tier t-master">Master</span> |
| The **Java Memory Model**: visibility, **happens-before**, `volatile` — why a plain `boolean running` flag can never stop another thread | <span className="db-tier t-understand">Understand</span> |
| **`ExecutorService` and pools**: fixed vs cached vs `newVirtualThreadPerTaskExecutor`; sizing for CPU vs I/O; shutdown done right (`shutdown` → `awaitTermination` → `shutdownNow`) | <span className="db-tier t-master">Master</span> |
| **`CompletableFuture`**: `supplyAsync`, `thenApply`/`thenCompose` (the map/flatMap of async), `allOf`, `exceptionally`, timeouts — fan-out to three services and join | <span className="db-tier t-understand">Understand</span> |
| **Structured concurrency** (`StructuredTaskScope`) — preview through 25/26, finalizing in 27: subtasks that cannot leak, fail-fast fan-out | <span className="db-tier t-know">Know</span> |
| Explicit locks: `ReentrantLock` (tryLock with timeout — the deadlock escape), `ReadWriteLock`, when `synchronized` is still fine | <span className="db-tier t-know">Know</span> |
| Atomics: `AtomicLong`, `compareAndSet`, `LongAdder` for hot counters — lock-free single-variable state | <span className="db-tier t-understand">Understand</span> |
| **Concurrent collections**: `ConcurrentHashMap` (`computeIfAbsent` — the one-line thread-safe cache, and the "don't mutate inside compute" rule), `CopyOnWriteArrayList`, `BlockingQueue` for producer/consumer | <span className="db-tier t-understand">Understand</span> |
| `ThreadLocal` — request context, its leak in pooled threads — and **`ScopedValue`** (finalized in 25) as the virtual-thread-era replacement | <span className="db-tier t-understand">Understand</span> |
| **Deadlock, livelock, starvation**: the lock-ordering rule, and reading a thread dump that says `BLOCKED` — diagnosis before theory | <span className="db-tier t-understand">Understand</span> |
| Virtual-thread pinning: what pinned means, `synchronized` pinning fixed in 24 (JEP 491), remaining cases (native calls), JFR `jdk.VirtualThreadPinned` (the old `-Djdk.tracePinnedThreads` flag was removed in JDK 24) | <span className="db-tier t-know">Know</span> |
| **Immutability as the first concurrency strategy**: share nothing mutable, and most of this phase's hazards vanish — the payoff of Phase 2's design habits | <span className="db-tier t-master">Master</span> |
| Coordination primitives: `CountDownLatch` (tests love it), `Semaphore` (bounding concurrent calls to a fragile downstream), `CyclicBarrier` | <span className="db-tier t-know">Know</span> |
| `wait`/`notify` — the legacy protocol: recognize it in old code, reach for higher-level tools in new code | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why `counter++` from two threads loses
updates, fix it three ways (`synchronized`, `AtomicLong`, confinement), and say
which of the three you'd ship and why virtual threads change none of it.

---

← Prev: [Part 1 — Foundations](01-foundations.md) · Next → [Part 3 — Application layer](03-application.md)
