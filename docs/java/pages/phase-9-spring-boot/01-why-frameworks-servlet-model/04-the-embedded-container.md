---
title: "The embedded container"
sidebar_label: "4 · The embedded container"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Servlet Web
> Applications* (docs.spring.io/spring-boot/reference/web/servlet.html —
> `ServletWebServerApplicationContext`, `WebServerFactoryCustomizer`,
> `server.*` properties, `register-default-servlet`, the `src/main/webapp`
> warning), the Spring Boot reference *Structuring Your Code*, and the
> Spring Boot 4.0 Migration Guide (github.com/spring-projects/spring-boot
> wiki — the `spring-boot-starter-web` → `spring-boot-starter-webmvc` rename,
> the Servlet 6.1 baseline, the removal of Undertow support).
> Spring Boot 4.1.0, Spring Framework 7.0.x, Tomcat 11.0.22, JDK 25.

**For twenty years a Java web application was a guest: you built a `.war` and
handed it to a container somebody else installed, versioned and restarted.
Spring Boot inverted that relationship, and the inversion is more consequential
than it first sounds — the server became a dependency in your POM, its version
became your responsibility, its lifecycle became your `ApplicationContext`'s
lifecycle, and the deployable became one file that runs the same way on a
laptop and in a container image. Almost everything people like about Boot
follows from this one change rather than from any annotation.**

## The inversion: the container becomes a library

The old model was **deploy into a container**. You built a `.war`, the
operations team ran a Tomcat, and the two had independent lifecycles and
version schedules. The container was infrastructure; your application was a
guest inside it.

Spring Boot inverted it. The container is a *dependency*:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-webmvc</artifactId>
  <!-- ⚠️ Boot 4 rename: this was spring-boot-starter-web in 3.x and earlier -->
</dependency>
```

That starter brings embedded Tomcat, and `SpringApplication.run` starts it:

```java
@SpringBootApplication
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

Under the hood this uses `ServletWebServerApplicationContext`, a
`WebApplicationContext` that finds a `ServletWebServerFactory` bean in itself
and uses it to create and start the web server as part of context refresh. The
server's lifecycle is the context's lifecycle — which is why a bean that fails
to initialise takes the HTTP listener down with it, and why the port is not
bound until the application is genuinely ready to serve.

Consequences worth stating plainly:

- **One artifact.** `java -jar app.jar` runs the same bytes in every
  environment, container image included. There is no "which Tomcat version is
  on the server" question, because the answer is in your POM.
- **The server version is a dependency you own.** A Tomcat CVE is a dependency
  bump and a redeploy, not an operations ticket — see
  [Phase 8 · Versioning, updates and CVEs](../../phase-8-build-dependencies/07-versioning-updates-cve/README.md).
- **`src/main/webapp` is dead for jar packaging.** The Boot documentation is
  explicit that the directory works only with war packaging and is silently
  ignored otherwise. Static content goes in `src/main/resources/static`,
  `/public`, `/resources` or `/META-INF/resources`.

### Switching and tuning the server

Jetty instead of Tomcat is a dependency swap — exclude the Tomcat starter and
add the Jetty one. Properties cover the common configuration:

```yaml
server:
  port: 8080
  servlet:
    context-path: /api
    register-default-servlet: false     # the default in a stand-alone Boot app
  tomcat:
    threads:
      max: 200                          # documented default
    max-http-form-post-size: 2MB
```

Anything the properties do not reach is a `WebServerFactoryCustomizer` bean:

```java
@Bean
WebServerFactoryCustomizer<TomcatServletWebServerFactory> tuning() {
    return factory -> factory.addConnectorCustomizers(
            connector -> connector.setProperty("relaxedQueryChars", "[]"));
}
```

## Servlet 6.1, and what it cost Undertow

Jakarta EE 11 ships **Servlet 6.1**, and Spring Boot 4 takes it as a hard
baseline. That baseline had a casualty: **Spring Boot 4.0 removed Undertow as
an embedded server option**, including `spring-boot-starter-undertow`, because
no Servlet 6.1-compatible Undertow release existed. Spring Framework 7 removed
its Undertow support in the same cycle.

The practical consequence, if you inherit an Undertow service: **swap to Tomcat
or Jetty before you bump the Boot version**, not after, because the build fails
at dependency resolution the moment the starter cannot resolve at 4.x. Any
`server.undertow.*` properties and `UndertowServletWebServerFactory`
customizers have to be re-expressed against the replacement — they have no
automatic equivalent.

## The trade-off: what the servlet contract costs you

The contract is synchronous and thread-bound by design. `service` is a blocking
call — you return when the response is done — and the container proves it
scales by having a lot of threads. That is a genuine simplicity win: your code
reads top to bottom, a stack trace is a real stack, and a debugger works. It is
also the exact property that made reactive stacks look attractive for a decade,
and the exact property virtual threads changed the arithmetic on. Both halves
of that argument are [chunk 5](05-thread-per-request.md).

## Gotchas

### `spring-boot-starter-web` does not resolve on Boot 4

**Symptom.** The first thing that happens after bumping the parent version to
4.x is a dependency-resolution failure naming `spring-boot-starter-web`.

**Cause.** Boot 4 renamed it to **`spring-boot-starter-webmvc`**, to stop the
long-standing confusion with WebFlux. `spring-boot-starter-web-services` became
`spring-boot-starter-webservices` and `spring-boot-starter-aop` became
`spring-boot-starter-aspectj` in the same pass.

**Fix.** Rename it in the POM. Do this as its own commit before any code
changes, so that the inevitable second wave of failures is clearly separated
from the rename.

### Expecting `src/main/webapp` to be packaged

**Symptom.** JSPs or static files under `src/main/webapp` are missing at
runtime and 404, with no build warning.

**Cause.** That directory is a war-packaging convention. With jar packaging
most build tools ignore it silently.

**Fix.** Put static content under `src/main/resources/static` (or `/public`,
`/resources`, `/META-INF/resources`), which is on the classpath and is served
by Boot's resource handling.

### Tuning the server through a property that does not exist

**Symptom.** A `server.tomcat.*` property has no effect and no error.

**Cause.** Unknown properties under a `@ConfigurationProperties` prefix are
ignored rather than rejected by default, so a typo or a property that was
renamed between versions fails silently.

**Fix.** Add `spring-boot-configuration-processor` so the IDE validates
property names against the metadata, and reach for a
`WebServerFactoryCustomizer` for anything genuinely not exposed as a property
rather than guessing at names. Typed, validated configuration is
**Topic 06 — Configuration and profiles** *(not written yet)*.

### The server starts but the application is not ready

**Symptom.** A container orchestrator routes traffic to the pod, and the first
requests fail, even though the process is up and the port is open.

**Cause.** "Port bound" and "ready to serve" are not the same event. Caches may
still be warming, a migration may still be running, a downstream connection
pool may not have filled.

**Fix.** Do not use port-open as a readiness signal. Split liveness from
readiness with Actuator's probes — which Boot 4 enables by default — and point
the orchestrator's readiness check at the readiness endpoint. That is
**Topic 13 — Actuator** *(not written yet)*.

## Interview questions

**★ What changes when the servlet container becomes an embedded dependency instead of a deployment target?**
Ownership and lifecycle. The server version moves into your POM, so it is
versioned, reviewed and patched like any other dependency rather than managed
separately by operations. The artifact becomes a self-contained jar that runs
identically everywhere with `java -jar`, which is what makes container images
straightforward. And the server's lifecycle becomes the `ApplicationContext`'s
lifecycle via `ServletWebServerApplicationContext` — the port is not bound
until the context has refreshed, so a failed bean stops the service from
accepting traffic rather than serving errors.

**★ How do you change the embedded server's configuration, and when is a property not enough?**
Common settings are `server.*` properties — `server.port`,
`server.servlet.context-path`, `server.tomcat.threads.max` and so on. When a
setting has no property, declare a `WebServerFactoryCustomizer<T>` bean for the
relevant factory type and configure the factory (or, for Tomcat, add a
`Connector` customizer) programmatically. Switching containers entirely is a
dependency change: exclude the Tomcat starter and add the Jetty one. Be aware
that unknown `server.*` properties are silently ignored, so a typo looks
exactly like a setting that does not work.

**★ Spring Boot 4 dropped Undertow. Why, and what does an Undertow user have to do?**
Boot 4 requires a **Jakarta Servlet 6.1** baseline (Jakarta EE 11), and no
Servlet 6.1-compatible Undertow release existed when Boot 4.0 shipped, so
`spring-boot-starter-undertow` was removed along with Undertow support in
Spring Framework 7. An existing Undertow service must migrate to Tomcat or
Jetty **before** bumping the Boot version, because after the bump the starter
does not resolve at 4.x and the build fails at dependency resolution. Any
`server.undertow.*` properties and `UndertowServletWebServerFactory`
customizers have to be re-expressed against the replacement.

**★ Why was `spring-boot-starter-web` renamed in Boot 4, and what else was renamed with it?**
It became `spring-boot-starter-webmvc` because "web" had never distinguished
Spring MVC from WebFlux, and the ambiguity cost people real time when both
stacks were on the table. The same harmonisation pass renamed
`spring-boot-starter-web-services` to `spring-boot-starter-webservices` and
`spring-boot-starter-aop` to `spring-boot-starter-aspectj`, and added dedicated
`spring-boot-starter-restclient` and `spring-boot-starter-webclient` starters.
It is the first failure you hit on a Boot 4 upgrade, and worth doing as an
isolated commit.

**★ How does the embedded web server's lifecycle relate to the Spring context's?**
`ServletWebServerApplicationContext` creates and starts the web server as part
of context refresh: it locates a `ServletWebServerFactory` bean and uses it to
build the server, and the server is stopped when the context closes. The
practical consequence is that a bean which fails to initialise prevents the
port from ever being bound, so a broken application refuses connections rather
than accepting them and returning errors — which is the behaviour you want
behind a load balancer. It is also why graceful shutdown is a context concern
(`server.shutdown=graceful`) rather than something you script around the
process.

---

← Prev: [DispatcherServlet, the front controller](03-dispatcherservlet.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Thread per request, and what virtual threads changed](05-thread-per-request.md)
