---
title: "GenericContainer gives you any image at all, and hands you back the one problem every module was quietly solving on your behalf — Testcontainers waits sixty seconds for the first mapped port to start listening, and a great many services accept a TCP connection well before they can answer a request"
sidebar_label: "07b · GenericContainer and waiting"
sidebar_position: 46
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Testcontainers **Startup and waits**
> ([java.testcontainers.org](https://java.testcontainers.org/features/startup_and_waits/)) and
> **Networking**
> ([java.testcontainers.org](https://java.testcontainers.org/features/networking/)) documentation,
> and the **2.0.5** sources at tag `2.0.5`
> ([github.com/testcontainers](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[07](07-beyond-postgres.md) ended on the case with no module: you name an image and configure it
yourself. `GenericContainer` is that, and it is also the class every module is built on, so
everything here applies to `PostgreSQLContainer` too — you have simply not had to think about it,
because the module already answered the hard question. The hard question is **when is it ready**,
and the default answer is a TCP port accepting connections, which for a great many services is
strictly earlier than being able to serve a request. [02](02-what-testcontainers-is.md) called the
wait strategies most of Testcontainers' value. This is why.**

**[07c](07c-networks-and-image-names.md) is the other half of what a module was doing for you:
container-to-container networking, reaching back into your own test process, and pinning the image.**


## The shape

```java
import org.testcontainers.containers.GenericContainer;   // 🔴 still in .containers, still generic

@Container
static GenericContainer<?> service = new GenericContainer<>("ghcr.io/acme/pricing:1.4.2")
        .withExposedPorts(8080)
        .withEnv("PRICING_MODE", "test")
        .waitingFor(Wait.forHttp("/actuator/health").forStatusCode(200));
```

🔴 Note the generics. [02](02-what-testcontainers-is.md) covered the 2.0 change that removed the
self-type parameter from *module* container classes — **`GenericContainer<SELF>` was not part of
that**. It is unchanged and still generic, which is why `` `GenericContainer<?>` `` is correct
while `` `PostgreSQLContainer<?>` `` now resolves to a deprecated shim. This single inconsistency
produces a lot of confused migration diffs.

## Ports: never hardcode one

Testcontainers publishes the container's port to a *random* host port. The documentation gives the
reason directly — randomized mapping exists *"to avoid port collisions that may arise with locally
running software or in between parallel test runs."*

```java
Integer firstMappedPort  = container.getMappedPort(8080);
Integer secondMappedPort = container.getMappedPort(8081);
String  address = container.getHost() + ":" + container.getMappedPort(8080);
```

⚠️ *"the container must be running at the time `getMappedPort` is called."* That is a real
constraint on how you write the wiring, not a footnote: a `@DynamicPropertySource` method works
because it is invoked lazily, after start; a field initialiser computing the URL does not. It is
the same lazy-`Supplier` argument made in
**04c · `@DynamicPropertySource`** *(not written yet)*.

`getHost()` matters for the same reason — the container is not necessarily on `localhost`. A remote
Docker daemon, a VM-backed runtime or a CI agent can all put it elsewhere, and the code that
hardcodes `localhost` is the code that works on one developer's machine.

## 🔴 Waiting: the default, and why it is usually wrong

> *"Ordinarily Testcontainers will wait for up to 60 seconds for the container's first mapped
> network port to start listening."*

Two independent problems with that as a default:

1. **"Listening" is not "ready."** A database accepts TCP long before it finishes recovery; an
   application server binds its port before its context is up; a broker listens before its
   controller has elected. The connection succeeds and the first real request fails — usually
   intermittently, and usually only on a loaded CI machine.
2. **Only the first mapped port** is considered. A container exposing 8080 and 9090 is judged ready
   on 8080 alone.

> *"If waiting for a listening TCP port is not sufficient to establish whether the container is
> ready, you can use the `waitingFor()` method"*

### The strategies

| Strategy | Use it when |
|---|---|
| **port listening** (the default) | the service is ready the instant it binds — rare |
| `Wait.forHttp("/")` | there is an HTTP endpoint that means "ready" |
| `Wait.forLogMessage(".*Ready to accept connections.*\\n", 1)` | the image prints a readiness line and offers nothing else |
| `Wait.forHealthcheck()` | 🔴 **the image already declares a `HEALTHCHECK`** — then use it |
| a subclass of `AbstractWaitStrategy` | nothing above expresses the condition |

The HTTP strategy is the one with real configuration:

```java
Wait.forHttp("/actuator/health")
    .forStatusCode(200)
    .forStatusCode(301)                                    // several acceptable codes
    .forStatusCodeMatching(it -> it >= 200 && it < 300 || it == 401)   // or a predicate
    .usingTls();
```

🔴 **`forStatusCodeMatching` accepting `401` is not a curiosity — it is the common case.** A secured
endpoint that answers *"unauthorized"* has proved the application is up far more convincingly than
one that answers `200` because it is unsecured. Readiness is "the service responded", not "the
service liked my request".

`Wait.forHealthcheck()` deserves its own note: if the image's author already declared what healthy
means, that is better information than anything you will infer from outside. Check the image before
writing a log-message matcher.

### The timeout is separate from the strategy

```java
new GenericContainer<>("ghcr.io/acme/pricing:1.4.2")
        .withExposedPorts(8080)
        .waitingFor(Wait.forHttp("/actuator/health"))
        .withStartupTimeout(Duration.ofMinutes(2));
```

The 60-second default covers the whole start, **including pulling the image**. A first run on a cold
CI agent pulls hundreds of megabytes and then starts the service; the same container on a warm
machine does neither. This is the single most common cause of "it only fails in CI, and only the
first time", and it is why **09 · The cost** *(not written yet)* argues for pre-pulling images in CI
rather than raising timeouts forever.

### Startup check strategies — a different question

Wait strategies ask *"is the service ready?"*. Startup **check** strategies ask *"did the container
start at all, and should it still be running?"* — which is a different question and matters for
one-shot containers:

| Strategy | Behaviour |
|---|---|
| `IsRunningStartupCheckStrategy` | the default — the container is running |
| `OneShotStartupCheckStrategy` | waits for **exit code 0** — for a container that does a job and stops |
| `IndefiniteWaitOneShotStartupCheckStrategy` | the same with no timeout |
| `MinimumDurationRunningStartupCheckStrategy` | still running after a minimum duration — catches a container that starts and immediately crashes |

`OneShotStartupCheckStrategy` is what you want for a migration runner, a fixture loader or a
schema-generation step packaged as an image: the default strategy would consider its clean exit a
failure, because the container is no longer running.

## Where this continues

[07c · Networks and image names](07c-networks-and-image-names.md) covers what the mapped-port
mechanism deliberately does *not* solve — one container reaching another, and a container reaching
back into the server your test is running — plus `DockerImageName` substitution and why an
unpinned tag is an unpinned dependency.

## Gotchas

**★ `GenericContainer` is still generic; the module classes are not.**
`GenericContainer<SELF>` in `org.testcontainers.containers` was untouched by 2.0, while every module
container class lost its self-type parameter. So `` `GenericContainer<?>` `` is right and
`` `PostgreSQLContainer<?>` `` now binds to a deprecated shim — in the same file, in code that looks
symmetrical.

**★ The default wait is "the first mapped port is listening", and services listen before they serve.**
*"Ordinarily Testcontainers will wait for up to 60 seconds for the container's first mapped network
port to start listening."* The connection succeeds, the first request fails, and it fails
intermittently — worst on a loaded CI machine, which is where you will see it.

**★ Only the *first* mapped port is watched.**
A container exposing two ports is declared ready on the first one. The second may not be bound at
all.

**★ The 60-second startup timeout includes the image pull.**
A cold CI agent pulls the image and then starts the service inside the same budget. This is the
mechanism behind "fails only in CI, only on the first run" — and the fix is pre-pulling, not an
ever-larger timeout.

**★ `getMappedPort` throws if the container is not running.**
*"the container must be running at the time `getMappedPort` is called."* Which is why URLs must be
computed lazily — in a `@DynamicPropertySource` supplier, in a `@BeforeAll`, not in a field
initialiser.

**★ Hardcoding `localhost` works until the Docker daemon is not local.**
A remote daemon, a VM-backed runtime or a CI agent puts the container elsewhere. `getHost()` exists
for this and costs nothing to use.

**★ `OneShotStartupCheckStrategy` exists because the default treats a clean exit as a failure.**
A migration runner or fixture loader packaged as an image finishes and stops, which
`IsRunningStartupCheckStrategy` reads as "not running". Use the one-shot strategy and it waits for
exit code 0 instead.

**★ `Wait.forLogMessage` couples your test to the image's log text.**
A patch release rewords the line and every test that waited on it hangs until the timeout. Prefer a
`HEALTHCHECK` the image already declares, or an HTTP endpoint, and treat log matching as the last
resort it is.

**★ Waiting for HTTP 200 on a secured endpoint waits forever.**
The service is up and answering `401`. `forStatusCodeMatching` with `401` accepted is the correct
readiness condition — you are asking whether it responded, not whether it authorised you.

## Interview questions

**★ What is Testcontainers' default wait strategy, and why is it usually not good enough?**
It waits up to sixty seconds for the container's first mapped port to start listening. Listening is
earlier than ready for most services — a database still recovering, an app server that has bound
before its context is up, a broker before controller election — so the connection succeeds and the
first real request fails, intermittently.

**★ Name the wait strategies and when each fits.**
Port listening (the default, when binding really does mean ready); `Wait.forHttp` when there is an
endpoint that means ready; `Wait.forLogMessage` when the image only announces readiness in its log;
`Wait.forHealthcheck` when the image already declares a `HEALTHCHECK` — the best option when
available, because the image's author defined healthy; and a subclass of `AbstractWaitStrategy` for
anything else.

**★ Why would you accept HTTP 401 as a readiness condition?**
Because readiness is "the service responded", not "the service authorised me". A secured endpoint
returning `401` has proved the application is up; waiting for `200` on it waits forever.
`forStatusCodeMatching` is what expresses that.

**★ Why does Testcontainers map to random host ports?**
*"to avoid port collisions that may arise with locally running software or in between parallel test
runs."* It is what lets the same suite run twice concurrently on one machine without a fixed-port
conflict.

**★ Why can you not compute a container's URL in a field initialiser?**
Because *"the container must be running at the time `getMappedPort` is called"* and it is not
running yet. The URL has to be produced lazily — a `@DynamicPropertySource` supplier, a
`@BeforeAll`, or a service connection that does it for you.

**★ Your test only fails on CI, and only on the first run of the day. What is the likely cause?**
The 60-second startup budget covers the image pull as well as the service starting. A cold agent
pulls first and runs out of budget; a warm one does not. Pre-pull the images in CI rather than
raising the timeout indefinitely.

**★ What is the difference between a wait strategy and a startup check strategy?**
A wait strategy asks whether the *service* is ready. A startup check strategy asks whether the
*container* started and should still be running. That difference matters for a one-shot container —
a migration runner exits cleanly, which the default check reads as a failure, so it needs
`OneShotStartupCheckStrategy`, which waits for exit code 0.

**★ Why is `GenericContainer<?>` still written with generics when `PostgreSQLContainer` is not?**
Because 2.0 removed the self-type parameter from module container classes only.
`GenericContainer<SELF>` and `JdbcDatabaseContainer` kept theirs and kept their package. The
asymmetry is real and is a frequent source of confusion in a migration diff.

**★ Why is `Wait.forLogMessage` a last resort?**
It couples the test to the image's log wording, which is not an API. A patch release rewords the
line and every test waiting on it hangs to the timeout, with a failure that says nothing about the
cause.

{/* FOOTER */}

{/* FOOTER */}
