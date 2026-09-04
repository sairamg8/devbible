---
title: "@SpringBootTest starts no server by default, and the moment you ask it to start a real one you have moved the client onto a different thread from the server — which silently ends the rollback guarantee your other tests were relying on"
sidebar_label: "04b · webEnvironment"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Boot 4.1.1 reference *Testing → Testing Spring Boot
> Applications → Working with Random Ports* and *Testing with a Running Server*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)),
> and the Boot 4.1.0 javadoc for `SpringBootTest.WebEnvironment` — all four constants quoted
> from it verbatim.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> **No sandbox** — no server was started to write this page.

**`webEnvironment` is one attribute with four values, and choosing between them is really
choosing whether a socket exists. That sounds like a performance question and is mostly a
correctness one: two of the four values put your test client and your application on different
threads, and a transaction is bound to a thread.**

## The four values, quoted

**`MOCK`** — the default:

> *"Creates a `WebApplicationContext` with a mock servlet environment if servlet APIs are on the
> classpath, a `ReactiveWebApplicationContext` if Spring WebFlux is on the classpath or a regular
> `ApplicationContext` otherwise."*

and, decisively:

> *"Embedded servers are not started."*

**`RANDOM_PORT`**:

> *"Creates a web application context (reactive or servlet-based) and sets a `server.port=0`
> `Environment` property (which usually triggers listening on a random port). Requires a
> dependency on `spring-boot-web-server`."*

**`DEFINED_PORT`** — the same, but without setting `server.port=0`, so your configured port is
used. Same dependency requirement.

**`NONE`**:

> *"Creates an `ApplicationContext` and sets `SpringApplication.setWebApplicationType(WebApplicationType.NONE)`."*

⚠️ Note the dependency named in Boot 4 is **`spring-boot-web-server`**, not `spring-boot-starter-web`
as older material says. If a `RANDOM_PORT` test refuses to start a server, that is the first
thing to check.

## `MOCK` is not "a mocked application"

The name misleads more than any other word in this topic. `MOCK` does **not** mean your beans
are mocks, and it does not mean requests are faked. It means there is **no servlet container and
no socket** — the servlet API objects are Spring's mock implementations
(`MockHttpServletRequest` and friends), and requests are dispatched straight into your real
`DispatcherServlet` in the calling thread.

Everything real still runs: your filters, your handler mapping, your argument resolvers, your
controller, your message converters, your exception handlers. What is absent is HTTP itself —
no connection, no wire format, no server-side threading.

This is the same machinery `MockMvc` uses, which is why `@SpringBootTest` + `@AutoConfigureMockMvc`
is a coherent combination and why topic 06 belongs where it does
([06 · MockMvc](../06-mockmvc/01-no-socket-no-server.md)).

## 🔴 The transaction consequence — the reason this chunk exists

The reference states it plainly:

> *"as using this arrangement with either `RANDOM_PORT` or `DEFINED_PORT` implicitly provides a
> real servlet environment, the HTTP client and server run in separate threads and, thus, in
> separate transactions. Any transaction initiated on the server does not roll back in this
> case."*

Unpack what that means for a test you have probably written:

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Transactional                                   // ← does almost nothing you want here
class OrderApiTest {

    @Autowired RestTestClient client;

    @Test
    void createsAnOrder() {
        client.post().uri("/orders").body(request).exchange()
              .expectStatus().isCreated();
    }
}
```

The `@Transactional` on the test opens a transaction **on the test's thread**. The HTTP request
travels over a real socket and is handled on a **server thread**, which starts its own
transaction and **commits it**. When the test method ends, the test's own (empty) transaction
rolls back and cleans up nothing.

So: **the row is still there.** The next test sees it. The suite develops an order dependence
that appears only when tests run in a particular sequence — which is exactly the failure
[topic 01 · 11d](../01-junit-5/11d-when-order-is-a-smell.md) describes from the JUnit side.

**With `MOCK` this does not happen**, because the request is dispatched on the test's own thread,
inside the test's transaction, and rolls back with it. The rollback guarantee people rely on is a
property of `MOCK`, not of `@Transactional`.

The fix when you genuinely need a real server is not `@Transactional` — it is explicit cleanup:
truncate the tables, use a fresh database per class, or assert-then-delete. Say so in the test,
because the absence of `@Transactional` there looks like an oversight to the next reader.

## What each value costs, and when to pick it

| Value | Socket | Startup cost | Pick it when |
|---|---|---|---|
| `MOCK` | none | context only | Almost always. You are asserting on handler behaviour, status and body |
| `RANDOM_PORT` | real, ephemeral | context + server bind | You need real HTTP: a filter that reads the connection, a client library under test, WebSockets, SSE, a real `RestClient` round trip |
| `DEFINED_PORT` | real, fixed | context + server bind | Almost never — see below |
| `NONE` | none | smallest | The application is not a web application, or the test is about a batch job or a listener |

🔴 **`DEFINED_PORT` is a flakiness generator.** It binds the port from your configuration, so two
builds on the same CI agent collide, and a leftover process from a killed run blocks the next
one. This is the fixed-port failure mode in general form; topic 01 argues it at length in
[14h · Ports, network and the database](../01-junit-5/14h-ports-network-and-the-database.md).
Use `RANDOM_PORT` and ask what you got.

## Getting the port when it is random

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class OrderApiTest {

    @LocalServerPort int port;          // injected after the server binds

    @Autowired RestTestClient client;   // already pointed at the right port
}
```

`@LocalServerPort` is a `@Value("${local.server.port}")` in disguise. In practice you rarely need
it: the auto-configured clients are already bound to the running port. Reach for it when you are
constructing a client yourself, or building a URL for something outside Spring.

## Gotchas and pitfalls

**★ Believing `@SpringBootTest` starts a server.**
It does not. `MOCK` is the default and *"Embedded servers are not started."* A test that expects
to `curl` its own application, or that injects a client expecting a real port, fails in a
confusing way because the port property was never set.

**★ Reading `MOCK` as "the beans are mocked".**
Nothing is mocked. Your whole application context is loaded and your real controller runs. Only
the servlet environment is a mock implementation, and requests are dispatched in-process.

**★ `@Transactional` on a `RANDOM_PORT` test.**
It gives you the *appearance* of rollback and none of the substance: the server thread's
transaction commits, and the test's transaction has nothing to roll back. Data leaks into the
next test. This is the single most-repeated mistake in Spring integration tests.

**★ `DEFINED_PORT` on CI.**
Two concurrent builds, or one leftover process, and the bind fails. It is a fixed shared
resource by definition. `RANDOM_PORT` plus `@LocalServerPort` costs nothing and cannot collide.

**★ Assuming `RANDOM_PORT` is more realistic and therefore better.**
It is more realistic and it is slower, flakier and it takes away rollback. Realism is a cost you
pay for a reason; pay it when the thing under test is HTTP itself, not by default.

**★ Using `NONE` and then wondering why `MockMvc` is not available.**
`NONE` sets the web application type to `NONE`, so there is no `WebApplicationContext` and no
web infrastructure at all. `@AutoConfigureMockMvc` has nothing to configure.

**★ Expecting `RANDOM_PORT` to fix `@MockitoBean` not being seen by the server.**
It is the same context, so the mock *is* the bean the server thread uses. What changes is
threading and transactions, not bean identity — which is worth knowing because people sometimes
switch modes hoping to fix a mock that was never the problem.

## Interview questions

**★ What does `webEnvironment = MOCK` actually mock?**
The servlet environment, and nothing else. There is no embedded server and no socket; Spring's
`MockHttpServletRequest`/`MockHttpServletResponse` stand in for the container's, and requests are
dispatched directly into the real `DispatcherServlet` on the calling thread. Your whole
application context is loaded and every filter, resolver, controller and converter is the real
one.

**★ Why does `@Transactional` stop rolling back when you switch to `RANDOM_PORT`?**
Because a transaction is bound to a thread. With a real server the request is handled on a server
thread, which opens and commits its own transaction; the test's transaction is on a different
thread and has nothing of the server's work to undo. The reference states it directly: *"Any
transaction initiated on the server does not roll back in this case."*

**★ So how do you clean up after a `RANDOM_PORT` test?**
Explicitly. Truncate or delete in an `@AfterEach`, use a per-class or per-method database, or
have the test remove what it created. Whatever you choose, make it visible — the missing
`@Transactional` reads as an omission to the next person, so it is worth a comment saying why it
is absent.

**★ When is `RANDOM_PORT` genuinely the right choice?**
When HTTP itself is what you are testing: a client library you wrote, a filter that inspects the
connection, WebSocket or SSE behaviour, content negotiation over the wire, or a round trip
through a real `RestClient`. If your assertion is about status codes and JSON bodies, `MOCK` gives
you the same answer without a socket.

**★ What is wrong with `DEFINED_PORT`?**
It binds a fixed port, which is a shared machine resource. Two builds on one CI agent collide, and
a process left over from a killed run blocks the next one. It is the classic fixed-resource flake
and `RANDOM_PORT` with `@LocalServerPort` removes it entirely.

**★ How do you find out which port a `RANDOM_PORT` test is using?**
Inject `@LocalServerPort int port`, which resolves the `local.server.port` property Boot sets once
the server has bound. Usually unnecessary — the auto-configured test clients are already pointed
at it — and needed mainly when you construct a client or a URL yourself.

**★ What dependency does `RANDOM_PORT` require in Boot 4?**
`spring-boot-web-server`. Older material names `spring-boot-starter-web`, which is one of many
small Boot 4 renames that make copied configuration fail in ways that look unrelated to the
change you made.

{/* FOOTER */}
