---
title: "The random host port that makes parallel test runs safe is the one thing another container cannot use, so container-to-container traffic goes by network alias and original port — and the hostname that reaches back into your own test process is not localhost, because inside a container localhost is the container"
sidebar_label: "07c · Networks and image names"
sidebar_position: 47
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Testcontainers **Networking** documentation
> ([java.testcontainers.org](https://java.testcontainers.org/features/networking/)) and the
> **2.0.5** sources at tag `2.0.5`
> ([github.com/testcontainers](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[07b](07b-genericcontainer-and-waiting.md) covered getting one container up and knowing when it
is ready. The moment there are two of them, or the container has to call back into the test that
started it, the mapped-port mechanism stops helping — and it stops helping *silently*, as a
connection refused that reads like a firewall problem. This chunk is the addressing rules, and the
image-naming decisions that determine whether the container you tested against is the container you
will get next week.**

## Networks — when two containers must see each other

The mapped-port mechanism is for *your test* reaching a container. It does not help one container
reach another, because inside the Docker network the random host port does not exist.

```java
Network network = Network.newNetwork();

GenericContainer<?> app = new GenericContainer<>("acme/app:1.0")
        .withNetwork(network)
        .withNetworkAliases("app");

GenericContainer<?> proxy = new GenericContainer<>("acme/proxy:1.0")
        .withNetwork(network)
        .withEnv("UPSTREAM", "http://app:8080");     // the alias and the CONTAINER port
```

Two rules follow, and both are routinely got wrong:

- **Between containers, use the alias and the original port** — `app:8080`, not `getHost()` and
  `getMappedPort(8080)`. The mapping exists on the host, not on the network.
- ⚠️ *"Testcontainers currently only allows a container to be on a single network."* A topology
  that needs a container on two networks needs a different topology.

### And when the container must reach your test

```java
Testcontainers.exposeHostPorts(localServerPort);
```

Called **before** the container starts, this makes a port on your machine reachable from inside the
container at the hostname `host.testcontainers.internal`, on the same port number. It is how a
container calls back into a `@SpringBootTest(webEnvironment = RANDOM_PORT)` server, or into a
WireMock stub the test is running — and `host.testcontainers.internal` is the only hostname that
works for it. `localhost` inside a container is the container.

## Image names, and the substitution check

```java
new GenericContainer<>(DockerImageName.parse("ghcr.io/acme/postgres-with-extensions:18")
        .asCompatibleSubstituteFor("postgres"));
```

Module containers verify that the image you named looks like the one they know how to drive.
`asCompatibleSubstituteFor` is you asserting that your fork, mirror or internal rebuild behaves
like the upstream image — which is exactly what you need for an internal registry, and exactly the
assertion to be careful with, because you have just turned a check into a promise.

🔴 **Pin a tag, always, and never `latest`.** A container image is a dependency; an unpinned one is
a dependency that changes on a day nobody touched the repository, and the failure arrives as a
mysterious behaviour change in a test that was green yesterday.


## Gotchas

**★ Between containers, the mapped host port does not exist.**
Container-to-container traffic uses the network alias and the *original* container port. Passing
`getMappedPort(8080)` to a second container is a connection refused that looks like a firewall
problem.

**★ A container can only be on one network.**
*"Testcontainers currently only allows a container to be on a single network."* Plans that assume
otherwise fail late, after the topology is already written.

**★ `localhost` inside a container is the container.**
To reach a server your test is running, call `Testcontainers.exposeHostPorts(port)` before starting
the container and use `host.testcontainers.internal`. Nothing else resolves.

**★ `asCompatibleSubstituteFor` turns a safety check into your promise.**
It is the right tool for an internal mirror or a rebuilt image. It is also how a genuinely
incompatible image gets past the check that would have caught it.

**★ An unpinned image tag is an unpinned dependency.**
`latest` changes on a day nobody committed anything, and the resulting failure looks like flakiness
rather than an upgrade.

## Interview questions

**★ Container A needs to call container B. What address does it use?**
B's network alias and B's *original* port, with both containers on the same `Network`. The mapped
host port exists on the host, not inside the Docker network, so passing `getMappedPort` produces a
connection refused.

**★ A container needs to call back into a server your test is running. How?**
`Testcontainers.exposeHostPorts(port)` before the container starts, then reach it from inside the
container at `host.testcontainers.internal` on the same port number. `localhost` inside a container
refers to the container itself.

**★ What does `asCompatibleSubstituteFor` do, and when is it risky?**
It tells a module container that your image — a mirror, a fork, an internal rebuild — behaves like
the upstream one it knows how to drive, bypassing the name check. It is the correct tool for a
private registry, and it is also exactly how a genuinely incompatible image gets past the guard.

{/* FOOTER */}
