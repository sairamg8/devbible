---
title: "A @State object is not a place to keep variables, it is a declaration of what is shared with whom — and choosing Scope.Benchmark for something that is written to turns a benchmark of your code into a benchmark of contention"
sidebar_label: "05 · State"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH annotation sources** on `master` — `State`, `Scope`,
> `Setup`, `TearDown`, `Param`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/tree/master/jmh-core/src/main/java/org/openjdk/jmh/annotations)) —
> and the samples `JMHSample_03_States`, `JMHSample_04_DefaultState`,
> `JMHSample_05_StateFixtures`. JMH 1.37, JDK 25.
> 🔴 **No sandbox** — no benchmark was run for this page.

**`@State` exists because [02c](02c-constant-folding-and-loop-hoisting.md) needs somewhere to
put inputs the compiler cannot fold. But its `Scope` is a concurrency declaration, and that
is the part that quietly decides what your multi-threaded benchmark actually measures.**

## What a state object is

> *"State objects naturally encapsulate the state on which benchmark is working on. The
> `Scope` of state object defines to which extent it is shared among the worker threads."*

> *"State objects are usually injected into `Benchmark` methods as arguments, and JMH takes
> care of their instantiation and sharing."*

🔴 **You never construct a state object.** You declare a class, annotate it, and take it as a
parameter — which is also why the `@Benchmark` javadoc restricts parameters to state classes
and JMH infrastructure types ([04](04-the-annotations.md)).

Two further capabilities that are easy to miss:

- **Staged initialisation.** *"State objects may also be injected into `Setup` and `TearDown`
  methods of other `State` objects to get the staged initialization. In that case, the
  dependency graph between the `State`-s should be directed acyclic graph."*
- **Inheritance.** *"State objects may be inherited: you can place `State` on a super class
  and use subclasses as states."*

⚠️ **A cycle in that graph is your bug to avoid** — the javadoc states the DAG requirement as a
precondition, not as something JMH will untangle for you.

## The three scopes, in the enum's own words

| Scope | Shared with | Fixtures run |
|---|---|---|
| `Scope.Benchmark` | *"all instances of the same type will be shared across all worker threads"* | *"by one of the worker threads, and only once per `Level`"* |
| `Scope.Group` | *"all threads within the same group. Each thread group will be supplied with its own state object"* | *"by one of the group threads, and only once per `Level`"* |
| `Scope.Thread` | *"all instances of the same type are distinct, even if multiple state objects are injected in the same benchmark"* | *"by single worker thread exclusively, and only once per `Level`"* |

Each entry ends with the same guarantee — *"No other threads would ever touch the state
object"* — which is what makes fixture methods safe to write without synchronisation.

🔴 **`Scope.Thread` is the right default for single-threaded benchmarks and for anything you
mutate.** `Scope.Benchmark` is correct when the shared thing *is* the subject: a concurrent
map, a connection pool, a lock. Using it for a scratch buffer measures cache-line ping-pong
between cores.

⚠️ **`Scope.Group` only means anything with `@Group`/`@GroupThreads`** — asymmetric benchmarks
where different threads run different methods against one shared object (producer/consumer,
reader/writer). Phase 6 owns the concurrency concepts; this topic owns the plumbing.

## The benchmark class is itself a state object

`JMHSample_04_DefaultState` exists to make one point: you can annotate the enclosing
benchmark class with `@State` and use its fields directly, which is why so many samples read
like plain classes with a couple of fields. It is convenient and it is the same mechanism —
the implicit state object is the benchmark instance.

⚠️ **Convenient, and easy to over-share.** The default in samples is `@State(Scope.Thread)` on
the class; if you copy a class-level `@State(Scope.Benchmark)` you have made every field
shared without writing a line about threading.

## Fixtures: `@Setup` and `@TearDown`

> *"Since fixture methods manage the `State` lifecycles, `Setup` can only be declared in
> `State` classes. The `Setup` method will be executed by a thread which has the access to
> `State`, and it is not defined which thread exactly. Note that means `TearDown` may be
> executed by a different thread, if `State` is shared between the threads."*

🔴 **Different threads may run setup and teardown for the same object.** Anything thread-bound
— a `ThreadLocal`, a lock you acquired, a thread-affine native handle — must not be
established in `@Setup` and released in `@TearDown` on a shared state.

The default level is `Level.Trial` (`Level value() default Level.Trial`), which is the one
you want most of the time: build the input once for the whole run. The other levels, and the
extensive warnings attached to the most tempting of them, are
[the next page](05b-fixture-levels.md).

## Where inputs should come from

Combining this page with [02c](02c-constant-folding-and-loop-hoisting.md) gives the working
rule:

```java
@State(Scope.Thread)
public static class Input {
    @Param({"10", "1000", "100000"})
    int size;

    int[] data;

    @Setup(Level.Trial)
    public void setup() {
        data = new Random(1234).ints(size).toArray();   // deterministic, but opaque
    }
}

@Benchmark
public long sum(Input in) {
    long s = 0;
    for (int v : in.data) s += v;
    return s;                                            // consumed by the harness
}
```

Three properties, all deliberate: the field is **non-final** and set in `@Setup`, so nothing
folds; the seed is **fixed**, so runs are comparable; and the result is **returned**, so
nothing is eliminated. ⚠️ **A fixed seed makes runs comparable, not realistic** — it is one
input distribution, chosen by you.

`@Param` is the idiomatic sweep: JMH runs the benchmark once per value and the values are
injected as strings the compiler cannot see through.

## Gotchas

🔴 **`@Setup` cannot live on the benchmark class unless that class is itself a `@State`.**
The javadoc is explicit that fixtures may only be declared in state classes; a stray `@Setup`
on a non-state class fails at generation.

🔴 **A `Scope.Benchmark` state that any thread writes to turns the benchmark into a
contention benchmark.** With enough threads the dominant cost is cache coherence on your
scratch field, not the code under test.

⚠️ **State injected into another state's fixture must form a DAG.** Staged initialisation is
supported; circular dependencies are not.

⚠️ **`@State` is `@Inherited` and applies to subclasses.** A shared benchmark base class can
therefore set a scope for classes that never mention it.

⚠️ **Mutating state across invocations changes what you measure over time.** The
`LinkedList`-insertion example in [Modes](04b-modes.md) is the canonical case: without a
`@Setup(Level.Iteration)` that resets it, every invocation faces a bigger list than the last.

⚠️ **Reusing one state object across benchmark methods in a class means they share warm-up
effects and data layout.** That is sometimes what you want and sometimes an invisible
coupling — a benchmark whose result depends on which sibling ran first.

⚠️ **Do not do I/O in `@Setup(Level.Trial)` and then assume the OS page cache is cold.** The
first measured invocation may hit a warm cache created by setup; if cold I/O is the subject,
that must be arranged explicitly and measured with `SingleShotTime`.

⚠️ **A `@State` object's allocation is not free and is not measured.** Large setup structures
change GC behaviour for the whole run — a benchmark whose state is a gigabyte-sized array is
also a benchmark of your collector.

## Interview questions

**★ What does `@State` actually declare?**
The object holding the data a benchmark works on, and — through its `Scope` — how widely
that object is shared among worker threads. JMH instantiates and injects it; you never
construct it yourself.

**★ Compare `Scope.Thread`, `Scope.Benchmark` and `Scope.Group`.**
`Thread`: a distinct instance per worker thread, even if several states are injected.
`Benchmark`: one instance shared across all worker threads. `Group`: one instance per thread
group, for asymmetric `@Group` benchmarks. In all three, fixtures run once per level and no
other thread touches the object.

**★ Why is `Scope.Benchmark` a dangerous default?**
Because any write to it introduces cross-core cache-coherence traffic, so a multi-threaded run
measures contention on your state rather than the code under test. Reserve it for cases where
the shared object *is* the subject — a concurrent collection, a pool, a lock.

**★ Which thread runs `@Setup`?**
Unspecified — *"a thread which has the access to `State`, and it is not defined which thread
exactly"*. For shared state, `@TearDown` may be run by a different thread than `@Setup`, so
thread-bound resources must not be paired across them.

**★ What is the default fixture level?**
`Level.Trial` — once before and after the whole run of that benchmark. It is the correct
default for building inputs.

**★ How do you sweep a benchmark across input sizes?**
`@Param` on a state field, with the values as strings. JMH runs the benchmark once per value
and injects them, which also keeps the input opaque to constant folding.

**★ Can state objects depend on each other?**
Yes — a state can be injected into another state's `@Setup`/`@TearDown` for staged
initialisation, provided the dependency graph is acyclic. The javadoc states the DAG
requirement explicitly.

**★ Why do so many samples have no visible `@State` class?**
Because the benchmark class itself is annotated with `@State` and its fields are the state.
It is the same mechanism with the boilerplate removed — and the reason to check what scope
that class-level annotation declares before copying it.

Next: [Fixture levels](05b-fixture-levels.md).

{/* FOOTER */}
