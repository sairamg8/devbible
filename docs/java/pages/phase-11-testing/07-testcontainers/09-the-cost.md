---
title: "Testcontainers costs you a container runtime on every machine that runs the suite, an image pull the first time, and a startup on every fresh application context — and the honest answer to all three is not to make containers cheaper but to run far fewer tests that need one"
sidebar_label: "09 · The cost"
sidebar_position: 48
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Testcontainers **Supported container runtimes**
> ([java.testcontainers.org](https://java.testcontainers.org/supported_docker_environment/)) and
> **CI · Docker-in-Docker patterns**
> ([java.testcontainers.org](https://java.testcontainers.org/supported_docker_environment/continuous_integration/dind_patterns/))
> documentation, and the **2.0.5** sources at tag `2.0.5`
> ([github.com/testcontainers](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> benchmark — and this page in particular refuses to give you a number, because the honest ones are
> all "it depends on your image, your machine and your network".

**[01](01-passed-on-h2-proves-nothing.md) argued that a test whose assertion depends on what the
SQL returned must run on the real engine. [01b](01b-where-the-line-is.md) drew the other half of
that line: **and every other test should not be touching a database at all**. This chunk is why the
second half matters as much as the first. Testcontainers is not free, the costs are structural
rather than incidental, and every technique for reducing them — the singleton, reuse, pre-pulling —
is a smaller lever than the one [01b](01b-where-the-line-is.md) already handed you.**

**[09b](09b-ci-and-alternative-runtimes.md) is the operational half — the CI socket-mounting
pattern, why Docker-in-Docker is a last resort, and what Podman, Colima and Rancher Desktop each
need.**


## The four costs, and which ones you can actually move

| Cost | Paid | Movable? |
|---|---|---|
| **A container runtime must exist** on every machine that runs the suite | always | ❌ no — it is a hard prerequisite |
| **The image pull** | first run on a cold machine or agent | ✅ yes — pre-pull, cache the layer store |
| **Container startup** | once per application context that owns a container | ✅ partly — singleton, container-as-bean, reuse |
| **Test wall-clock** on tests that use it | every such test | 🔴 **yes, and this is the big one — have fewer of them** |

The first three get all the attention and the fourth is worth more than all of them combined. A
suite where four hundred tests need a database and one where twenty do are different suites, and no
amount of container tuning closes that gap.

## 1 · The prerequisite: a runtime on every machine

> *"To run Testcontainers-based tests, you need a Docker-API compatible container runtime, such as
> using Testcontainers Cloud or installing Docker locally."*

That is a real constraint on a team, not a footnote. It means:

- **Every developer** needs a working runtime, including the ones who only touch the front end and
  now cannot run `./gradlew test`.
- **Every CI agent** needs one, with the socket arrangement in [09b](09b-ci-and-alternative-runtimes.md).
- **Licensing and policy** apply — Docker Desktop's licence terms are a procurement question at
  some organisations, which is a large part of why Podman, Colima and Rancher Desktop appear in
  the documentation at all.

🔴 **Design for the machine without a runtime.** `@Testcontainers(disabledWithoutDocker = true)`
skips rather than fails — but understand what you have bought: a green build that ran none of your
integration tests. If you use it, the CI job that *does* have a runtime must be the one that gates
merging, or the skip is simply a hole. See **03 · The JUnit integration** *(not written yet)*.

## 2 · The image pull, and why it looks like flakiness

The startup budget covers the pull. From [07b](07b-genericcontainer-and-waiting.md): Testcontainers
waits up to sixty seconds for readiness, and on a cold agent that same budget has to absorb
downloading the image first. The result is the most misdiagnosed failure in this whole topic — **a
test that fails only in CI, only on the first run after the cache was cleared, and passes on a
rerun**. It gets labelled flaky and retried, which hides it.

The fixes, in order of preference:

1. **Pre-pull in CI**, as an explicit step before the test task. It moves the cost somewhere
   visible and makes the failure a pull failure rather than a test failure.
2. **Cache the image layer store** between runs, if the CI platform offers it.
3. **Prefer small images** — `postgres:18-alpine` over `postgres:18` — and pin the tag, so the
   cache actually hits ([07c](07c-networks-and-image-names.md)).
4. **Raise `withStartupTimeout`** only after the first three, and knowing that you have made every
   genuine hang take that much longer to report.

Registry authentication is worth setting up deliberately rather than discovering: Testcontainers
authenticates *"using the following strategies in order: Environment variables
(`DOCKER_AUTH_CONFIG`) or Docker config at `DOCKER_CONFIG` or `{HOME}/.docker/config.json`"*. On a
private registry, and on Docker Hub once you meet its rate limits, that is the difference between a
pull and a 429 in the middle of a build.

## 3 · Startup, and the three levers on it

Ordered from most to least worth doing:

1. 🔴 **Share the context, not just the container.** A container lives as long as the application
   context that owns it, so the real lever is having *few distinct contexts* — which is the context
   cache, and belongs to [05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md).
   Every gratuitous `@MockitoBean`, property override or `@DirtiesContext` fragments the cache and
   multiplies the number of container starts. **Most "Testcontainers is slow" complaints are
   context-cache problems wearing a costume.**
2. **The singleton pattern or a container bean** — one container for the suite instead of one per
   test class. **05 · The singleton pattern** *(not written yet)*.
3. **Reuse** — one container across JVM *runs*, on a developer machine. It is opt-in on the machine
   as well as in code, it is documented as experimental and explicitly *"not suited for CI usage"*,
   and it leaks state between runs. **05b · Reuse** *(not written yet)*.

## 🔴 4 · The lever that dwarfs the others: fewer tests that need a container

Testcontainers' own documentation makes the same point, in the middle of a page selling database
containers:

> *"Of course, it's still important to have as few tests that hit the database as possible, and make
> good use of mocks for components higher up the stack."*

That is the whole of [01b](01b-where-the-line-is.md), restated by the project itself. Applied:

- **Domain logic** — pricing rules, state machines, validation — needs no Spring and no database.
  It is a plain unit test, and it is the bulk of a healthy suite.
- **A controller's request/response contract** is a `@WebMvcTest` slice with the service mocked —
  [06 · MockMvc](../06-mockmvc/README.md).
- **The mapping and the query** need the real engine. That is the Testcontainers test, and there
  should be relatively few of them.
- **The wiring end to end** gets a small number of `@SpringBootTest` cases, not one per feature.

A team that fixes its pyramid finds that container cost stops being a topic. A team that instead
tunes reuse settings on a suite of four hundred integration tests is optimising the wrong variable
and will be back in six months.

## When a slice is enough

Reach for the slice, not the container, when the assertion does not depend on what the database
actually did:

- you are asserting on **JSON shape, status codes or validation messages** → `@WebMvcTest`;
- you are asserting on **a service's branching**, with the repository mocked → a plain unit test;
- you are asserting that **a query method's derived name compiles** → that is a startup check, not
  a data check;
- you are asserting on **domain rules** → no framework at all.

And do not reach for the slice when the assertion *is* about the engine — the SQL, the mapping, the
constraint, the transaction, the isolation behaviour. That is [01b](01b-where-the-line-is.md)'s line
and this chunk does not move it; running the wrong test quickly is not a saving.

## Where this continues

[09b · CI and alternative runtimes](09b-ci-and-alternative-runtimes.md) covers the machines rather
than the tests: the sibling-container socket-mount pattern CI should use, the Docker-in-Docker
caveat, and the environment variables Podman, Colima and Rancher Desktop each require — including
the rootless-Podman setting that turns off cleanup.

## Gotchas

**★ The startup budget includes the image pull, so a cold agent fails and a warm one passes.**
It gets diagnosed as flakiness and retried, which hides it permanently. Pre-pull in CI as an
explicit step so the failure is a pull failure with a pull error message.

**★ `disabledWithoutDocker = true` converts a missing runtime into a silently green build.**
The tests do not run and nothing says the coverage vanished. It is only safe if some CI job that
definitely has a runtime is the one gating merges.

**★ Tuning reuse and singletons on a badly-shaped suite is optimising the wrong variable.**
The dominant cost is the *number of tests that need a container*. Testcontainers' own docs say to
*"have as few tests that hit the database as possible"*.

**★ "Testcontainers is slow" is usually a context-cache problem.**
A container lives as long as the context that owns it, so every gratuitous `@MockitoBean`, property
override or `@DirtiesContext` fragments the cache and multiplies container starts. Fix the cache
first — [05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md).

**★ An unpinned or `-slim`-less image quietly costs you the cache hit.**
`latest` changes and invalidates the layer cache on a day nobody committed. Pin the tag and prefer
the smaller variant.

**★ Reuse is explicitly not for CI.**
The documentation says it is *"not suited for CI usage"* and that not all features work with it.
Enabling it in a CI image is a way to get containers that never stop.

**★ Raising `withStartupTimeout` makes every genuine hang slower to report.**
It is the correct last resort and a poor first one: you have traded a fast wrong answer for a slow
one, and the diagnostic gets worse.

## Interview questions

**★ What does Testcontainers actually cost a team?**
A Docker-API-compatible runtime on every machine that runs the suite — developers and CI agents
alike, with the licensing and support burden that implies; an image pull the first time on any cold
machine; a container start per application context that owns one; and wall-clock on every test that
uses one. The last is the largest, and it is governed by how many tests need a database at all.

**★ A test passes locally and fails on CI, but only on the first run after the cache is cleared.
What is happening?**
The startup budget covers pulling the image as well as starting the service, and a cold agent
spends most of it downloading. Pre-pull as an explicit CI step, cache the layer store, and prefer a
small pinned image — rather than raising the timeout, which makes every real hang slower to
diagnose.

**★ Somebody proposes `@Testcontainers(disabledWithoutDocker = true)` so the build passes for
front-end developers. What do you say?**
That it is reasonable only if a CI job that definitely has a runtime is what gates merging.
Otherwise you have converted "the integration tests fail to run" into "the integration tests
silently did not run", which is worse.

**★ Your integration suite is slow. What do you look at first?**
The context cache, not the containers. A container lives as long as the application context that
owns it, so a suite that fragments the cache with per-class bean overrides and `@DirtiesContext`
starts many containers where it could start one. After that, the singleton pattern or container
beans — and above both, the number of tests that need a container at all.

**★ Testcontainers' own documentation tells you to use fewer of its containers. Where, and why?**
On the database-modules page: *"it's still important to have as few tests that hit the database as
possible, and make good use of mocks for components higher up the stack."* Because the dominant
cost is not per-container, it is per-test, and the pyramid is what governs it.

**★ When is a slice test the right answer instead of a container?**
Whenever the assertion does not depend on what the database actually did — JSON shape, status
codes, validation messages, service branching, domain rules. When the assertion *is* about the SQL,
the mapping, a constraint or isolation behaviour, no slice substitutes and you are back to
[01b](01b-where-the-line-is.md)'s line.

**★ Why is container reuse a developer-machine feature rather than a CI one?**
Because it is documented as experimental and *"not suited for CI usage"*, its containers do not
stop after the tests finish, and it deliberately preserves state between runs — which is a
convenience locally and a source of false results on a build agent.

{/* FOOTER */}

{/* FOOTER */}
