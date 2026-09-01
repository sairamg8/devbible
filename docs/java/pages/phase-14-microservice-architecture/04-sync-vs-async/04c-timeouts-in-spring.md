---
title: "Spring Boot 4.1 documents no default connect or read timeout for its HTTP clients, so an unconfigured RestClient will wait as long as the underlying library lets it — which is the single most common production surprise in this whole band"
sidebar_label: "13 · Timeouts in Spring"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Spring Boot **4.1** reference, "Calling REST Services"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/io/rest-client.html)) and
> the Boot 4.1 "Common Application Properties" appendix
> ([docs.spring.io](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> cross-checked against the same appendix for Boot **4.0** and Boot **3.5**; and the Spring
> Framework 7.0.x reference, "REST Clients"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)).
> 🔴 **No sandbox.** No timing, log line or observed default appears here; every property
> name and every default-or-absence-of-default was read out of the documentation.
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A timeout you did not set is not "the framework's sensible default" — on Boot 4.1 it is
whatever the HTTP library that happened to be on your classpath does, and the reference
documents no value for either `spring.http.clients.connect-timeout` or
`spring.http.clients.read-timeout`. That means a synchronous hop with no explicit timeout can
hold a request thread for as long as the socket stays open, which is exactly the resource
exhaustion the previous two chunks are about. Setting timeouts is not tuning. It is the
minimum viable implementation of a synchronous dependency.**

## The property names, and the trap in them

🔴 **The prefix is `spring.http.clients` — plural — on Boot 4.x. It was `spring.http.client`
— singular — on Boot 3.x.** Checked in the properties appendix for all three lines:

| Boot line | Prefix | Properties documented |
|---|---|---|
| 3.5 | `spring.http.client` | `connect-timeout`, `read-timeout`, `factory`, `redirects`, `ssl.bundle` |
| 4.0 | `spring.http.clients` | `connect-timeout`, `read-timeout`, `redirects`, `ssl.bundle`, `imperative.factory`, `reactive.connector` |
| 4.1 | `spring.http.clients` | as 4.0, plus `cookie-handling` |

This matters more than a rename normally would, because **an unrecognised property in
`application.yml` is silently ignored by default.** Migrate a Boot 3.x application to Boot 4.x,
carry `spring.http.client.read-timeout: 2s` across, and you have a config file that reads as
though timeouts are configured and an application that has none. There is no error and no
warning unless you have configuration-property validation turned on or your IDE flags the
unknown key.

Also note that `factory` moved: on 3.5 it is `spring.http.client.factory`; on 4.x the
imperative and reactive stacks are configured separately as
`spring.http.clients.imperative.factory` and `spring.http.clients.reactive.connector`.

## The global setting

```yaml
spring:
  http:
    clients:
      connect-timeout: 2s
      read-timeout: 1s
      redirects: dont-follow
```

The appendix describes these as *"Default connect timeout for a client HTTP request"* and
*"Default read timeout for a client HTTP request"*, and — the load-bearing observation —
**lists no default value for either.** Absence of a documented default is not the same as a
documented absence, so state this carefully: the Boot reference does not specify one, which
means the effective behaviour comes from whichever client library is selected, and that
selection is itself classpath-dependent.

Which library that is, and how much else changes with it, is
[14 · The client object you actually get](04c2-the-client-you-actually-get.md).

## Per-group timeouts, which is what you actually want

A single global read timeout is wrong for any service with more than one dependency, because
different dependencies deserve different budgets — that is the whole argument of
[11 · The latency budget](04-the-latency-budget.md). Boot 4.x's HTTP Service Clients solve
this with **groups**.

Declare the interface:

```java
public interface PricingClient {

    @GetExchange("/quote")
    Money quote(@RequestParam String sku, @RequestParam int quantity);
}
```

Import it into a named group:

```java
@SpringBootApplication
@ImportHttpServices(group = "pricing", types = PricingClient.class)
@ImportHttpServices(group = "customer", types = CustomerClient.class)
public class OrderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

And configure each group independently:

```yaml
spring:
  http:
    clients:
      connect-timeout: 1s          # the floor for every client
    serviceclient:
      pricing:
        base-url: "https://pricing.internal"
        connect-timeout: 500ms
        read-timeout: 250ms
      customer:
        base-url: "https://customer.internal"
        connect-timeout: 500ms
        read-timeout: 150ms
```

The Boot reference states what a group is: *"An HTTP Service group is a collection of HTTP
Service interfaces that share common features such as URLs, connection timeouts, and SSL
settings"*, that properties live under `spring.http.serviceclient.<group-name>`, and that the
configurable aspects include *"the base URL, default headers, API versioning configuration,
redirect settings, connection and read timeouts, [and] SSL bundles to use"*. It also notes
that clients with no group named are associated with a group called `default`.

**This is the single most useful thing in the Boot 4.x HTTP client story for this topic**,
because it makes the latency budget expressible in configuration rather than scattered through
Java. The allocation from [11](04-the-latency-budget.md) — 250 ms for this hop, 150 ms for
that one — has a place to live.

## Gotchas

**★ The Boot 3 → 4 property rename fails silently.** `spring.http.client.read-timeout` on Boot
4.x is an unknown key. Nothing errors. The application starts, the clients have no configured
read timeout, and the first slow dependency exhausts the request threads. If you migrate,
grep for `spring.http.client.` and check every hit — and consider turning on relaxed-binding
validation or an `@ConfigurationProperties` scan so unknown keys are visible.

**★ There is no documented default timeout, so "we didn't change it" is not a safe state.**
The appendix lists both timeout properties with descriptions and no default value. Whatever
happens without them is a property of the selected client library, which is a property of your
classpath, which changes when a transitive dependency changes. Set them explicitly on every
service.

**★ One global read timeout is the wrong shape for a service with several dependencies.**
Each hop has a different budget and a different latency profile; a single number is either too
short for the slow dependency or too long for the fast one, and usually both. Groups exist
precisely so that the budget can differ per dependency.

**★ A read timeout does not bound the whole call.** It bounds the wait for data. DNS
resolution, TCP connect, the TLS handshake and — on most clients — the wait to acquire a
pooled connection are governed separately or not at all. Brooker's article names this
explicitly: *"There are also implementations where the timeout doesn't cover all remote calls,
like DNS or TLS handshakes."* See
[14 · The timeout that is not a timeout](04d-the-timeout-that-is-not-a-timeout.md).

**★ Timeouts configured per group still need enforcing at the operation level.** Three hops of
250 ms each, run in sequence, is 750 ms regardless of what any single group says. The per-hop
timeout bounds one hop; the operation needs its own bound as well — a scope timeout, a
propagated deadline, or both.

## Interview questions

**★ What happens if you do not configure a timeout on a Spring Boot 4.1 `RestClient`?**
The Boot reference documents `spring.http.clients.connect-timeout` and
`spring.http.clients.read-timeout` with no default value, so the behaviour falls through to the
selected HTTP client library — and which library is selected depends on the classpath, with a
documented preference order of Apache, Jetty, Reactor Netty, then the JDK client. The practical
consequence is that "unconfigured" is not a defined state you can reason about, and a hop with
no read timeout can hold a request thread for as long as the peer keeps the socket open.

**★ You migrate a service from Boot 3.5 to 4.1 and its timeouts stop applying. Why?**
The property prefix changed from `spring.http.client` to `spring.http.clients`. The old key is
simply unknown on Boot 4.x and is ignored without an error, so the configuration file still
reads as though timeouts are set while the clients have none. It is a rename that fails open,
which is the worst kind, and the only reliable defence is to grep for the old prefix during the
migration and to validate unknown configuration keys in CI.

**★ How would you give two different dependencies two different timeouts in Boot 4.1?**
Put their HTTP interfaces into different HTTP Service groups with `@ImportHttpServices(group =
"…")` and configure each group under `spring.http.serviceclient.<group>` — base URL, connect
timeout, read timeout, headers, SSL bundle. That is exactly the mechanism the latency budget
needs, because each hop's allocation is different and a single global value cannot express two
allocations.

**★ Your service has a 400 ms budget and four hops. How do you express that in Boot 4.1
configuration?**
Put each dependency in its own HTTP Service group and give each group a read timeout drawn from
its share of the budget — the fan-out branches can each have the remaining budget because they
overlap, whereas a serial chain has to subdivide it. Set a conservative global
`spring.http.clients.connect-timeout` as a floor so no client is left unbounded. Then bound the
operation itself as well, because per-hop timeouts do not add up to an operation-level
guarantee — a scope timeout or a propagated deadline is what enforces the 400 ms.

{/* FOOTER */}
