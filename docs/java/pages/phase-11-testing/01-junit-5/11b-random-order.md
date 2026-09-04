---
title: "Random ordering is the only orderer that is a diagnostic rather than a crutch — it converts a latent order dependence into a failure you can see, and the seed is logged at CONFIG level, which is below the default threshold, so the one thing you must configure is the logging"
sidebar_label: "11b · Random order"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Test Execution Order"
> ([writing-tests/test-execution-order](https://docs.junit.org/6.0.3/writing-tests/test-execution-order.html));
> javadoc for `MethodOrderer.Random`
> ([MethodOrderer.Random](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/MethodOrderer.Random.html))
> and `ClassOrderer.Random`
> ([ClassOrderer.Random](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/ClassOrderer.Random.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Every other `MethodOrderer` in [11](11-execution-order.md) exists to impose an order.
`Random` exists to destroy one — to take the stable-but-nonobvious default and shake it, so
that a test which only passes after another test has run stops passing. It is the honest way
to find order dependence, and it comes with one operational requirement that people skip.**

## What it does, and what the seed is

> *"`MethodOrderer` that orders methods pseudo-randomly."*

> *"By default, the random seed used for ordering methods is the value returned by
> `System.nanoTime()` during static class initialization. In order to support repeatable
> builds, the value of the default random seed is logged at `CONFIG` level. In addition, a
> custom seed (potentially the default seed from the previous test plan execution) may be
> specified via the `"junit.jupiter.execution.order.random.seed"` configuration parameter which
> can be supplied via the `Launcher` API, build tools (e.g., Gradle and Maven), a JVM system
> property, or the JUnit Platform configuration file (i.e., a file named
> `junit-platform.properties` in the root of the class path)."*

Three separate facts, and all three matter operationally.

**1 · The order changes every run.** The default seed is `System.nanoTime()` at static class
initialisation, so consecutive runs get different orders. That is the entire point — it turns a
latent order dependence into a failure that eventually surfaces instead of one that waits for
the day somebody renames a method.

**2 · The seed is logged at `CONFIG` level.** `CONFIG` sits below `INFO` in
`java.util.logging`, so under a default configuration you will never see it. 🔴 **Enabling
random ordering without enabling `CONFIG` logging converts a deterministic latent bug into an
irreproducible flake** — strictly worse than what you started with, and the mistake is
invisible until the first red build.

**3 · A run can be replayed.** Feed the logged seed back:

```properties
junit.jupiter.execution.order.random.seed = 1737065432198703
```

or `-Djunit.jupiter.execution.order.random.seed=1737065432198703`, or through the build tool,
or through the `Launcher` API. Once the seed is fixed, the order is fixed, and the failing run
is a reproducible one.

The property name is available as a constant:

> *"`RANDOM_SEED_PROPERTY_NAME` — Property name used to set the random seed used by this
> `MethodOrderer`: `"junit.jupiter.execution.order.random.seed"`"*

## One seed, both orderers

`ClassOrderer.Random` reads the *same* configuration parameter. So a single seed value
reproduces both the class order and the method order of a run — which is what you need,
because a cross-class dependency and a cross-method dependency present identically and you
cannot tell them apart until you can replay the whole thing.

That also means you cannot randomise classes and fix methods, or vice versa, by seed alone.
The lever is which orderers you enable, not two seeds.

## How to actually turn it on

Locally, on one suspect class:

```java
@TestMethodOrder(MethodOrderer.Random.class)
class SuspectedOrderDependentTests {
}
```

Globally, which is the useful configuration, in
`src/test/resources/junit-platform.properties`:

```properties
junit.jupiter.testmethod.order.default = org.junit.jupiter.api.MethodOrderer$Random
junit.jupiter.testclass.order.default = org.junit.jupiter.api.ClassOrderer$Random
```

Two details in those two lines. The `$` is required because `Random` is a nested class and the
parameter takes a fully qualified class name that has to load. And the **global default only
applies where no annotation overrides it** — the guide says the default orderer *"will be used
for all tests unless the `@TestMethodOrder` annotation is present on an enclosing test class or
test interface"*, so any class you have already annotated is excluded from the experiment,
which is very likely the exact set of classes you most wanted to shake.

## Where it belongs in a build

The failure mode of enabling random ordering everywhere, permanently, is that your main CI
pipeline now fails intermittently for reasons unrelated to the change under review, and people
learn to press "retry". That is the beginning of the retry culture
[14 · flaky tests](14-flaky-tests.md) argues against.

The shape that works is a **separate, scheduled job**: the normal pipeline runs the default
deterministic order, and a nightly or weekly job runs the same suite with random ordering and
`CONFIG` logging on. A failure there is a real defect report — with a seed attached — rather
than a blocked pull request.

⚠️ This is a practice recommendation, not something the JUnit documentation prescribes. The
documentation gives you the mechanism and the seed; how you wire it into a pipeline is yours.

## What random ordering can and cannot find

**Can find:** state left in a `static` field, a database row a previous test inserted, a system
property a previous test set, a file a previous test wrote, an in-memory cache warmed by an
earlier test, a `@TestInstance(PER_CLASS)` instance field mutated by one method and read by
another ([03b](03b-per-class-lifecycle.md)).

**Cannot find:** anything that depends on wall-clock time, on the environment, on network
availability, or on parallel interleaving. Random *ordering* still runs tests one after
another; it is not a concurrency test. `@Execution(CONCURRENT)`
([12 · parallel execution](12-parallel-execution.md)) explores a different and much larger
space, and the two find different bugs.

**Will not find reliably:** a dependence between two specific tests, if the run happens to put
them in the working order. One randomised run is one sample. This is a technique that pays off
over many runs, which is another reason it belongs in a scheduled job rather than in a single
gate.

## Gotchas

**★ Enabling `MethodOrderer.Random` without making `CONFIG` logging visible.**
The seed is logged at `CONFIG`, below the default threshold. Without it you get a failure that
cannot be reproduced — you have converted a deterministic latent bug into a real flake. Fix the
logging first, then enable the orderer.

**★ Putting random ordering on the pull-request pipeline.**
Intermittent unrelated failures on the gate teach the team to click retry, which is the habit
that makes every future flake invisible. Random ordering belongs in a scheduled job whose
failures are triaged as defects.

**★ Expecting the global `order.default` parameter to randomise annotated classes.**
It does not. The global default applies only where no `@TestMethodOrder` is present on an
enclosing class or interface — so classes you have already annotated, which are often the
order-dependent ones, are excluded.

**★ Setting the seed permanently to a fixed value.**
That gives you one arbitrary fixed order forever, which is neither the default's
nonobviousness nor randomness's coverage. Fix the seed to *reproduce* a failure, then remove
it.

**★ Assuming a green randomised run proves independence.**
It proves that one sampled order worked. Order dependence between two specific tests survives
any run that happens to schedule them favourably. Only repeated runs raise confidence, and
even then it is confidence, not proof.

**★ Treating random ordering as a substitute for parallel execution testing.**
It reorders; it does not interleave. Shared mutable state that only breaks when two tests run
*at the same time* is invisible to it.

**★ Forgetting the `$` in the properties file.**
`org.junit.jupiter.api.MethodOrderer$Random`. `Random` is a nested class, the parameter is a
fully qualified class name, and a dot produces a class that cannot be loaded at startup.

**★ Randomising classes but not methods, or the reverse, and drawing conclusions.**
Both orderers read the same seed but are enabled independently. If only one is on, a failure
tells you about that dimension only, and an absence of failure tells you nothing about the
other.

## Interview questions

**★ Why would you deliberately randomise test order?**
Because the default order is stable, and a stable order lets an order dependence sit
undiscovered indefinitely — until a rename, a merge or a new test moves something. Randomising
converts that latent defect into an observable failure. It is the only ordering configuration
whose purpose is to *find* bugs rather than to accommodate them.

**★ How do you make a random test order reproducible?**
Read the seed from the `CONFIG`-level log line Jupiter emits — the default seed is
`System.nanoTime()` at static class initialisation — and set it back with the
`junit.jupiter.execution.order.random.seed` configuration parameter, via
`junit-platform.properties`, a system property, the build tool or the `Launcher` API. If
`CONFIG` logging is not enabled you cannot recover the seed, which makes the whole exercise
counterproductive.

**★ Does one seed control both class order and method order?**
Yes — `MethodOrderer.Random` and `ClassOrderer.Random` read the same
`junit.jupiter.execution.order.random.seed` parameter, so one value reproduces both dimensions
of a run. You cannot give them different seeds; you can only choose which of the two orderers
is active.

**★ A randomised nightly run failed. What is the first thing you do?**
Capture the seed from the log, pin it with the configuration parameter, and reproduce the
failure locally. Then bisect: the failure is almost always a test leaving state behind — a
`static` field, a row, a system property, a file — and with a fixed seed you can delete or
`@Disabled` candidates until the pair is isolated.

**★ Where in a pipeline does random ordering belong, and why not everywhere?**
In a scheduled job, not the pull-request gate. On the gate it produces intermittent failures
unrelated to the change under review, and the reliable human response to that is to retry until
green — which destroys the signal for every other flake as well. As a scheduled job, a failure
is a defect report with a seed attached.

**★ What class of bug does random ordering not find?**
Anything that is not about sequence: clock and time-zone dependence, environment dependence,
network and port problems, and — importantly — concurrency. Random ordering still runs tests
one at a time, so shared state that only breaks under simultaneous access needs
`@Execution(CONCURRENT)`, not a shuffled order.

{/* FOOTER */}
