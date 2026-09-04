---
title: "A port number and a database row are the same mistake as a hardcoded path — the test names something the machine shares — and the two rules that dissolve almost all of it are bind port zero then ask what you got, and never assert on a value the database chose"
sidebar_label: "14h · Ports, network and the database"
sidebar_position: 57
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x javadoc for `TestSocketUtils`
> ([TestSocketUtils](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/util/TestSocketUtils.html));
> javadoc for `java.net.ServerSocket`
> ([ServerSocket](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/net/ServerSocket.html));
> the JUnit 6.0.3 User Guide — "Timeouts"
> ([writing-tests/timeouts](https://docs.junit.org/6.0.3/writing-tests/timeouts.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**[14d](14d-environment.md) is the filesystem. This is the other two shared resources a test
reaches for — the network stack and the database — and both fail in the same shape: the test
assumes exclusive ownership of a number (a port, an id) that something else is also allocating.**
Process globals and CI-versus-laptop drift are [14i](14i-process-globals-and-drift.md).

## Ports and the network

### 🔴 Fixed ports

`8080` in a test is a `BindException` waiting for the day two of your builds land on one agent,
or the day a developer leaves the application running in another window. It is also, quietly, a
correctness problem: if something *else* is listening on 8080, the test may connect to it and
assert against the wrong process.

**Bind port zero and ask what you got.** The `ServerSocket` javadoc spells it out:

> *"A port number of 0 means that the port number is automatically allocated, typically from an
> ephemeral port range. This port number can then be retrieved by calling `getLocalPort`."*

```java
// plain sockets
try (ServerSocket server = new ServerSocket(0)) {
    int port = server.getLocalPort();
    // ...
}
```

In Spring Boot, `webEnvironment = RANDOM_PORT` plus `@LocalServerPort` is the same idea with the
wiring done for you; Testcontainers does it for container ports. Both belong to later topics in
this phase.

### The find-a-port anti-pattern

Utilities that scan for a free port and hand you the number are a check-then-act race: the port
was free when it was probed and is not necessarily free when you bind it. Spring removed the
original one and says so on the replacement's javadoc, which is worth reading in full because it
is the clearest statement of the rule:

> *"This is a limited form of the original `org.springframework.util.SocketUtils` class which was
> removed in Spring Framework 6.0."*

> *"`TestSocketUtils` can be used in integration tests which start an external server on an
> available random port. However, these utilities make no guarantee about the subsequent
> availability of a given port and are therefore unreliable. Instead of using `TestSocketUtils` to
> find an available local port for a server, it is recommended that you rely on a server's
> ability to start on a random ephemeral port that it selects or is assigned by the operating
> system. To interact with that server, you should query the server for the port it is currently
> using."*

Bind first, then read the port. Never probe, then bind.

### The rest of the network

- **Real calls to real services.** DNS, an expired TLS certificate, a rate limit, a vendor
  sandbox that is down, or an agent with no egress at all. A unit test that reaches the internet
  is not a unit test and its red is not your bug.
- **`localhost` is ambiguous.** It resolves to `127.0.0.1` or `::1` depending on the host's
  resolver and the JVM's IPv6 settings; a server bound to one and a client connecting to the
  other fails with connection refused on exactly the machines configured differently from yours.
  Bind and connect to the same literal address in a test.
- **`TIME_WAIT`.** A socket closed by the local side lingers, so a test that closes and
  immediately rebinds the same fixed port can fail even with nothing else running. Another reason
  for ephemeral ports.
- **Timeouts as the only defence.** If a test does make a network call, it needs a connect and a
  read timeout, or a broken network turns the test into a hang and the build into a
  timeout with no report ([13](13-timeouts.md)).

## The database

[14](14-flaky-tests.md) covers the state that leaks between tests. This is what the *environment*
adds on top.

**A shared database is a shared global.** If two developers, or two CI jobs, point at one
instance, every test in both runs is racing every test in the other. The failures look like order
dependence and are not fixable by anything inside the suite. One disposable database per run is
the only stable answer — a container per build (topic 07 of this phase), or at minimum a schema
per run.

**Identity values are not yours to predict.** `assertThat(saved.id()).isEqualTo(1L)` passes on an
empty database exactly once. Sequences do not reset on rollback, are usually cached in blocks, and
are shared across concurrent transactions. Assert that the id is non-null and that a lookup by it
returns the row.

**The database has its own clock and its own time zone.** `now()` evaluated on the server is not
`Instant.now()` in the JVM, they can differ by the machines' clock skew, and the session time zone
affects how a `TIMESTAMP WITHOUT TIME ZONE` round-trips. If a test asserts on a timestamp the
database generated, it is asserting about a clock it did not inject
([14b](14b-time-and-determinism.md)).

**Migration state drifts.** A test database that was created by an older migration set and then
patched by hand passes locally and fails on CI, which builds the schema from scratch. Rebuild the
schema from the migrations on every run; that is also the only way the migrations themselves get
tested.

**Connection pool exhaustion presents as a timeout in an innocent test.** A test that opens a
connection and does not close it removes one from the pool for the rest of the run. The Nth test
after it blocks and fails with a pool timeout naming a query that is not the problem.

## Order dependence is an environment problem too

Everything above is worse when tests run in an order nobody chose. The topic already argues the
mechanism and the tooling: [11](11-execution-order.md) for why Jupiter's default order is
deliberately nonobvious, [11b](11b-random-order.md) for randomised ordering as a diagnostic and
the seed-logging you must configure to use it, [11c](11c-class-order.md) for class ordering, and
[11d](11d-when-order-is-a-smell.md) for why needing an order is nearly always two tests sharing
state. The environment angle is only this: **run the suite in a random order, in a fresh
container, at the CI parallelism, before you believe it is green.**

## Gotchas

**★ A fixed port number anywhere in a test.**
Two builds on one agent, or one forgotten local process, and you get a `BindException` — or worse,
a successful connection to the wrong process. Bind port `0` and read back what you were given.

**★ Scanning for a free port and then binding it.**
A check-then-act race. Spring removed `SocketUtils` over it and states on the replacement that
these utilities *"make no guarantee about the subsequent availability of a given port and are
therefore unreliable."* Bind first, ask second.

**★ Assuming `localhost` means one address.**
It resolves to `127.0.0.1` or `::1` depending on the host and the JVM's IPv6 configuration. Bind
and connect using the same literal address.

**★ A test that calls a real external service.**
Its red means the vendor is down, the certificate expired, the rate limit hit, or CI has no
egress — none of which is your code. Stub it, or run a real dependency you control in a container.

**★ A network call in a test with no connect or read timeout.**
A hung socket becomes a hung suite and the pipeline kills the job with no report at all. A
`@Timeout` ([13](13-timeouts.md)) is the backstop; the socket timeouts are the actual fix.

**★ Sharing one database instance between developers or CI jobs.**
Every test in one run races every test in the other, and the symptom is indistinguishable from
order dependence inside your own suite. Nothing inside the suite can fix it.

**★ Asserting on a generated primary key.**
Sequences are cached in blocks, are not rolled back, and are shared across concurrent
transactions. Assert the id is non-null and that the row is retrievable by it.

**★ Asserting on a timestamp the database generated.**
That is the database server's clock and session time zone, not the JVM's, and they differ. Inject
a `Clock` and pass the value in, or assert a range you can defend.

**★ Leaking a connection in a test.**
It is removed from the pool for the rest of the run, and the test that eventually fails is
whichever one exhausts the pool — never the one that leaked.

## Interview questions

**★ Why is a hardcoded port in an integration test a bug rather than a style issue?**
Because it makes the test dependent on a resource shared with every other process on the machine.
Two builds on one agent, or one developer's forgotten local server, produce a `BindException` —
and the more dangerous outcome is the one where something else *is* listening and the test
connects to it, so it passes or fails based on a process it knows nothing about. Bind port zero:
the operating system assigns an unused ephemeral port and you read back the number.

**★ What is wrong with a utility that finds a free port for you?**
It is check-then-act. The port was unbound when the utility probed it and there is no guarantee it
is still unbound when you bind. Spring removed `SocketUtils` in Framework 6.0 for this reason and
the replacement's javadoc states plainly that such utilities *"make no guarantee about the
subsequent availability of a given port and are therefore unreliable"* — recommending instead that
you let the server take an ephemeral port and then query it for the port it is using.

**★ Your repository tests share one database instance across the team. What breaks?**
Everything that assumes the test owns its data: `count()` assertions, "the newest row", unique
constraints, and any fixture with a fixed key. The failures arrive as order dependence — test A
fails when test B ran — except that B is in someone else's build, so no amount of reordering or
isolating inside your suite reproduces it. The only fix is a database per run: a container per
build, or at minimum a schema per run with a name derived from the build id.

**★ Why should a test never assert on a generated id?**
Because the value is chosen by the database, not by the test. Sequences are typically cached in
blocks, are not rolled back when a transaction is, and are handed out across concurrent sessions,
so `id == 1` holds only on a freshly created database with one test in it. Assert that the id is
non-null and that fetching by it returns the row you saved — that is the actual behaviour you
cared about.
{/* FOOTER */}
