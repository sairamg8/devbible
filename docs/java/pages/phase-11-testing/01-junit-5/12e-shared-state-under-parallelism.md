---
title: "Turning on parallelism does not create shared-state bugs, it reveals the ones already there — and this is the catalogue of every category that breaks, with what makes each one fail and what the actual fix is rather than the resource lock that hides it"
sidebar_label: "12e · Shared state under parallelism"
sidebar_position: 45
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html)),
> "Test Instance Lifecycle"
> ([writing-tests/test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html))
> and "Built-in Extensions"
> ([writing-tests/built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Every failure on this page existed before you enabled `@Execution(CONCURRENT)`. Concurrency
did not introduce them; it removed the accidental serialisation that was hiding them. That
reframing matters, because the reflex — turn parallelism back off — restores the hiding rather
than fixing anything.**

Read this alongside [12c](12c-resource-locks.md): a lock is the right answer for the categories
where the state is genuinely global to the JVM, and the wrong answer for every category where
the state could have been per-test.

## The categories, and what each one actually needs

### 1 · `static` mutable fields

The archetype. A `static Map` cache, a `static` counter, a `static` builder holding the last
value, a `static` list a test appends to.

**How it fails:** two threads read-modify-write the same field. The symptom is a wrong value in
a test that never mentions the field.

**The fix:** make it an instance field. Under the default `PER_METHOD` lifecycle a new instance
is constructed per test ([03](03-the-lifecycle.md)), so an instance field *is* per-test state
and needs no coordination at all. `static` in a test class is almost always either a constant
(fine, if immutable) or a bug.

### 2 · `@TestInstance(PER_CLASS)` instance fields

`PER_CLASS` shares one instance across methods ([03b](03b-per-class-lifecycle.md)), which turns
instance fields into exactly the problem category 1 describes.

**How it fails:** it does not, by default — the guide excludes `PER_CLASS` classes from the
concurrent default, and *"test authors have to ensure that the test class is thread-safe"* if
they add `@Execution(CONCURRENT)`. It fails the moment somebody adds that annotation without
reading the sentence.

**The fix:** drop back to `PER_METHOD` if you were only using `PER_CLASS` for non-static
`@BeforeAll` — which, since Java 16 permits `static` members in inner classes, you no longer
need.

### 3 · System properties

One `System.getProperties()` per JVM. A test that calls `System.setProperty` is mutating global
state for every concurrently running test.

**The fix:** if the code under test reads a property, inject the value instead — a constructor
parameter, a `Function<String, String>` lookup, a configuration object. Where you genuinely
cannot, `@ResourceLock(Resources.SYSTEM_PROPERTIES)` with `READ`/`READ_WRITE`
([12c](12c-resource-locks.md)) and a backup/restore pair, which is the guide's own example.

### 4 · Default `Locale` and `TimeZone`

`Locale.setDefault` and `TimeZone.setDefault` are process-global, and a test that sets one to
check a formatter has changed the formatting for every other test in flight.

**The fix:** pass the `Locale` or `ZoneId` explicitly —
`DateTimeFormatter.ofPattern(p, locale)`, `LocalDate.now(clock)` with a zoned `Clock`. Code that
cannot be told its locale is code that will misbehave in production too. If you must set the
default, `Resources.LOCALE` and `Resources.TIME_ZONE` exist for exactly this.

### 5 · `System.out` / `System.err` redirection

A test that calls `System.setOut` to capture output has redirected it for the whole JVM.

**The fix:** have the code under test write to an injected `PrintStream` or a logger you can
attach a test appender to. Where the API really only writes to `System.out`,
`Resources.SYSTEM_OUT` / `SYSTEM_ERR` — and Jupiter's own output capture
([12b](12b-parallelism-configuration.md)), remembering that it only captures the executing
thread.

### 6 · The clock

`Instant.now()`, `LocalDate.now()`, `System.currentTimeMillis()` in production code.

**How it fails under parallelism specifically:** not as a race, but through scheduling. A test
that assumed it would run within a few milliseconds of another now runs seconds later, and a
test that straddles midnight or a DST boundary becomes a lottery. Parallelism widens every
timing window.

**The fix:** inject a `java.time.Clock`. `Clock.fixed(instant, zone)` in tests, the system clock
in production. This is the single highest-value change on this page because it fixes an entire
category of [14 · flaky tests](14-flaky-tests.md) at once.

### 7 · Fixed filesystem paths

`new File("target/test-output.txt")`, `Paths.get("/tmp/report.json")`.

**How it fails:** two concurrent tests write the same path, and one reads the other's bytes —
or one deletes the file the other is still writing.

**The fix:** `@TempDir` ([09 · @TempDir](09-tempdir-and-resources.md)), which gives each
declaration its own directory. This category is the reason `@TempDir` exists, and it is the one
place where the correct fix is a single annotation.

### 8 · Fixed ports

`new ServerSocket(8080)`, a WireMock stub pinned to a port, `server.port=8080` in a test
property.

**How it fails:** the second test to start gets `BindException`, or worse, connects to the
*other* test's server and asserts against its responses.

**The fix:** port `0` — let the OS allocate and ask the server what it got. That is precisely
what the guide's own `HttpServerResource` does with `new HttpServerResource(0)`
([10j](10j-store-cleanup.md)). For Spring, `@SpringBootTest(webEnvironment = RANDOM_PORT)` and
`@LocalServerPort`.

### 9 · Database rows and sequences

Two tests inserting a row with the same natural key; a test asserting `count() == 1`; a test
that truncates a table another test is reading.

**The fix, in order of preference:** unique data per test (a random or per-test-derived key), a
transaction rolled back per test, a schema per thread, or — last — a `@ResourceLock` naming the
table or schema. Truncating shared tables is the pattern that cannot survive parallelism at all.

### 10 · A shared Spring context

Spring's `TestContext` framework caches contexts, so several concurrent test classes share one
`ApplicationContext` and every singleton in it.

**How it fails:** one test's `@MockitoBean` stubbing, or a mutated singleton's field, is visible
to another test running at the same time. `@DirtiesContext` makes it worse under parallelism —
one class evicting the context while another is mid-test.

**The fix:** this is topic 05's material. The short version: mutable singletons in a shared
context are shared state, and a bean override is a mutation of a cached object. Where a class
must dirty the context, it is a strong candidate for `@Isolated`
([12d](12d-dynamic-locks-and-isolation.md)).

### 11 · Testcontainers containers

A singleton container is shared, which is usually the point; the state *inside* it is shared
too, which usually is not.

**The fix:** share the container, isolate the data — per-test schema, per-test database, or
rollback. Topic 07's material.

### 12 · `ThreadLocal`-bound state

Spring's transaction synchronisation, `SecurityContextHolder`, SLF4J's `MDC`, Hibernate's
session binding.

**How it fails under parallelism:** it mostly does *not*, and that is the interesting part —
`ThreadLocal` gives each test thread its own copy, so parallel execution is fine. What breaks it
is running the test body on a *different* thread from its setup, which is what
`assertTimeoutPreemptively` and `@Timeout(threadMode = SEPARATE_THREAD)` do
([13 · timeouts](13-timeouts.md)). Note also that `SAME_THREAD` is defined as *the same thread
as the parent*, which is precisely the guarantee this state needs.

### 13 · Extension instance fields

An extension is usually instantiated once and serves every test its registration covers, so a
field on it is shared across threads ([10h](10h-keeping-state.md)).

**The fix:** the `ExtensionContext.Store`, keyed by a namespace that includes the context.

### 14 · Mutable static test fixtures

A `static final List<Order> SAMPLE_ORDERS` that a test sorts in place; a shared builder instance;
a `static` `ObjectMapper` a test reconfigures.

**How it fails:** `static final` prevents reassignment, not mutation. One test calls
`Collections.sort` or `mapper.configure(...)` and every concurrent test sees it.

**The fix:** immutable constants (`List.of`), or a factory method returning a fresh instance per
call. Topic 08's builders and object mothers exist for this.

### 15 · Environment variables and the working directory

`System.getenv` is read-only in the JVM without reflection hacks, and the current working
directory is process-global and cannot be changed per thread at all.

**The fix:** neither is fixable with a lock, because there is nothing safe to lock *for* — a test
that depends on the working directory is untestable in parallel. Pass paths explicitly and read
configuration through an injected source.

## Why "it passed locally" is the signature failure

Three independent reasons, all of which point the same way:

**Different parallelism.** The default `dynamic` strategy sets parallelism to the core count
([12b](12b-parallelism-configuration.md)). A sixteen-core laptop and a two-core CI agent explore
completely different interleavings, and neither is a subset of the other.

**Different speed.** A race is won by whoever is faster. Faster disks, a warm page cache, a
local database with no network hop — all of them shift which side of a race wins, consistently,
so a race can be reliably invisible locally and reliably visible in CI.

**Different selection.** Running one test class from an IDE runs it alone. There is no other
class to conflict with, so every cross-class shared-state bug on this page is unreachable from
the way developers usually run tests.

The corollary is operational: **a concurrency failure must be reproduced with the CI
configuration, not the local one.** Pin `fixed.parallelism`, run the whole suite, and if it
still will not reproduce, that is data — it means the failure depends on timing you have not
matched, not that it is not real.

## The order to fix them in

1. **Delete the sharing** — instance fields instead of `static`, unique data instead of shared
   rows, `@TempDir` instead of fixed paths, port `0` instead of `8080`.
2. **Inject the global** — a `Clock`, a `Locale`, a `PrintStream`, a configuration object. Now
   there is no global to contend for.
3. **Lock what is left** — `@ResourceLock` with the narrowest name and the weakest mode that is
   correct.
4. **Isolate what cannot be named** — `@Isolated`, sparingly, with the reason written down.

Steps 1 and 2 make the suite *faster*. Steps 3 and 4 make it slower and are the price of not
having done 1 and 2. Every team that starts at step 3 ends up with a parallel configuration that
buys nothing.

## Gotchas

**★ Turning parallelism back off when it exposes a failure.**
The failure was there before; concurrency only removed the accidental serialisation hiding it.
Turning it off restores the hiding, and the bug ships.

**★ Reaching for `@ResourceLock` before trying to delete the sharing.**
A lock is a scheduling constraint you pay for on every run. Most categories on this page —
`static` fields, fixed paths, fixed ports, shared rows — have a fix that costs nothing and makes
the suite faster.

**★ `static final` read as "immutable".**
It prevents reassignment. `static final List<Order> ORDERS = new ArrayList<>()` is fully mutable
and fully shared. `List.of(...)` is not.

**★ Assuming `@TestInstance(PER_CLASS)` is safe because Jupiter excludes it from the concurrent
default.**
It is safe until someone adds `@Execution(CONCURRENT)` to the class, at which point the guide
hands thread safety to you in writing. The exclusion is a default, not a guard.

**★ Debugging a CI concurrency failure with the local parallelism.**
The default strategy ties parallelism to core count, so your laptop is running a different
experiment. Pin `fixed.parallelism` to the CI value before concluding anything.

**★ Running one test class in the IDE and calling it reproduced.**
Running a class alone eliminates every cross-class interaction, which is where most of this
page's failures live. The reproduction has to be the whole suite.

**★ Fixing a clock-dependent test by widening a tolerance.**
Parallelism widens timing windows arbitrarily — a test can be descheduled for a long time. A
tolerance is a guess about scheduling; an injected `Clock` is a fact.

**★ Locking the database as a whole.**
`@ResourceLock("database")` on every data test is a correct and completely self-defeating
configuration: it serialises the slowest half of your suite. Lock the table or the schema, or
better, give each test its own data.

**★ Sharing a Testcontainers container and assuming that is the whole story.**
Sharing the container is right; sharing its contents is the bug. The isolation has to be inside:
schema per class, database per class, or rollback per test.

**★ Assuming `ThreadLocal`-bound state breaks under parallelism.**
It usually does not — each test thread has its own. What breaks it is a *different* thread
running the test body, which is `assertTimeoutPreemptively` and `SEPARATE_THREAD` timeouts, not
`@Execution(CONCURRENT)`.

**★ Trying to make a working-directory-dependent test parallel-safe.**
You cannot. The working directory is process-global with no per-thread equivalent, so there is
nothing to lock and no way to isolate. The test has to stop depending on it.

## Interview questions

**★ Does enabling parallel execution create new bugs?**
No — it removes the accidental serialisation that was concealing existing ones. Every category
that fails under concurrency was already a latent defect: shared `static` state, fixed paths,
fixed ports, a real clock, mutated globals. The right response to a new failure is to fix the
sharing, not to turn concurrency off, because the same defects also fail under reordering, under
a different machine, and eventually in production.

**★ Why does a concurrency failure so often pass locally?**
Three reasons that compound. The default `dynamic` strategy sets parallelism to the core count,
so a laptop and a CI agent run different degrees of concurrency. Local hardware is faster, and a
race is decided by which side is faster. And developers run one class at a time from an IDE,
which removes every cross-class interaction. Reproducing requires the CI parallelism, pinned with
the `fixed` strategy, and the whole suite.

**★ Name five categories of state that break under parallel execution and the fix for each.**
`static` mutable fields — make them instance fields, since a new instance is built per test.
Fixed file paths — `@TempDir`. Fixed ports — bind port `0` and ask what you got. The real clock —
inject a `java.time.Clock`. System properties, default `Locale` and `TimeZone` — inject the
value, or `@ResourceLock` on the corresponding `Resources` constant with backup and restore.

**★ In what order should you fix shared state?**
Delete the sharing first, inject the global second, lock what remains third, isolate the
unnameable last. The first two make the suite faster as well as correct; the last two cost
wall-clock time on every run and exist to cover what genuinely cannot be made per-test. Teams
that start with locks end up with a parallel configuration that buys nothing.

**★ Is `ThreadLocal`-bound state a problem under `@Execution(CONCURRENT)`?**
Generally not — each test thread gets its own copy, which is exactly what Spring's transaction
synchronisation and `SecurityContextHolder` rely on. It becomes a problem when the test body runs
on a different thread from its lifecycle methods, which is what `assertTimeoutPreemptively` and
`@Timeout(threadMode = SEPARATE_THREAD)` do. Note that `SAME_THREAD` is defined as the same
thread as the parent for precisely this reason.

**★ Your team locks `"database"` across every data test and the parallel suite is no faster.
Why?**
Because a single lock name shared by the slowest half of the suite serialises the slowest half
of the suite. Resource locks are only useful when the contended set is small. The fix is to
narrow the resource — a table, a schema — or to remove the contention by giving each test unique
data or a rolled-back transaction.

{/* FOOTER */}
