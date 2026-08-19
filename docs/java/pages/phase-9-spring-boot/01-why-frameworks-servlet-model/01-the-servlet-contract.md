---
title: "The servlet contract"
sidebar_label: "1 · The servlet contract"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Jakarta Servlet 6.1 specification
> (jakarta.ee — the `Servlet` interface, lifecycle, `ServletContext`, filters
> and the `FilterChain`, mapping rules), the Spring Framework 7.0 reference
> *Web on Servlet Stack* (docs.spring.io/spring-framework/reference/web/), and
> the Spring Boot 4.0 Migration Guide (github.com/spring-projects/spring-boot
> wiki — the Servlet 6.1 baseline and the removal of Undertow).
> Spring Boot 4.1.0, Spring Framework 7.0.x, Jakarta EE 11, JDK 25.

**A servlet container is not a framework. It is four things bolted together: a
socket that accepts TCP connections, a parser that turns bytes into an
`HttpServletRequest`, a thread pool that hands each request to a thread, and a
mapping table from URL patterns to objects implementing one five-method
interface. That is the entire contract, and it is deliberately tiny — it has
nothing to say about JSON, dependency injection, validation, or how to
structure an application. Spring MVC exists because that gap between "here is a
request on a thread" and "here is a validated `Order` object, please return
201" is enormous, and every team that does not adopt a framework ends up
writing a worse one.**

## The interface everything sits on

```java
package jakarta.servlet;   // NOT javax — the rename landed in Jakarta EE 9

public interface Servlet {
    void init(ServletConfig config) throws ServletException;
    ServletConfig getServletConfig();
    void service(ServletRequest req, ServletResponse res)
            throws ServletException, IOException;
    String getServletInfo();
    void destroy();
}
```

Five methods, and only one of them does work. `service` is called once per
request, on a thread the container owns, with a request object it parsed and a
response object it will flush when you return.

`HttpServlet` is the abstract subclass nearly everyone actually extends. Its
`service` implementation reads the HTTP method off the request and dispatches
to `doGet`, `doPost`, `doPut`, `doDelete`, `doHead`, `doOptions` or `doTrace`:

```java
public class OrderServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws IOException {
        String id = req.getPathInfo();          // you parse the path yourself
        res.setStatus(200);
        res.setContentType("application/json");
        res.getWriter().write("{\"id\":\"" + id + "\"}");   // and the JSON, by hand
    }
}
```

Look at what that code has to do and what nobody gave it. There is no routing
beyond a URL pattern — the `/{id}` segment arrives as a raw string you split.
There is no deserialization; `req.getReader()` gives you characters. There is
no content negotiation, no validation, no error model, and no way to say "this
returns an `Order`". Every one of those is a thing Spring MVC adds, and every
one of them is a thing a team without a framework writes badly six times.

### The `javax` → `jakarta` rename is not cosmetic

Oracle transferred Java EE to the Eclipse Foundation but not the `javax`
namespace, so Jakarta EE 9 renamed every package. `javax.servlet.Servlet` and
`jakarta.servlet.Servlet` are **different types to the JVM** — not versions of
one type. A jar compiled against `javax.servlet` cannot satisfy a
`jakarta.servlet` dependency, and the failure is a `NoClassDefFoundError` or a
filter that silently never runs, not a compile error, if the old jar is still
on the classpath. Spring Framework 6 was the cutover release; **Framework 7
removed `javax.annotation` and `javax.inject` support entirely.**

## The lifecycle, and why it produces a threading rule

The container calls `init` **once**, `service` **many times and concurrently**,
and `destroy` **once**. There is one servlet instance per registration, shared
by every request thread.

That single sentence is the origin of the most important rule in Spring
application design:

> **A servlet — and therefore every Spring bean reachable from one — is shared
> mutable state unless it holds no mutable state at all.**

```java
public class BrokenCounterServlet extends HttpServlet {

    private int hits;            // ⚠️ one field, every request thread

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) {
        hits++;                  // lost updates under any real concurrency
        // ...
    }
}
```

`hits++` is a read-modify-write on a field with no happens-before edge between
threads — the exact defect
[Phase 6 · Race conditions](../../phase-6-concurrency/03-race-conditions/README.md)
takes apart. The container gives you no protection, and it never warns you.
This is why "Spring beans are stateless singletons" is repeated everywhere:
it is not a style preference, it is the servlet lifecycle showing through.

## Gotchas

### The `javax.servlet` jar that is still on the classpath

**Symptom.** A filter or servlet you registered never runs, or the application
fails at startup with `NoClassDefFoundError: javax/servlet/http/HttpServletRequest`
from inside a library you did not write.

**Cause.** A transitive dependency still compiles against the pre-Jakarta
namespace. `javax.servlet.Filter` and `jakarta.servlet.Filter` are unrelated
types, so the container's `jakarta` chain never sees your `javax` filter — no
error, no registration, nothing.

**Fix.** Find it and exclude it, then use a Jakarta-era version of the library:

```xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>legacy-web-utils</artifactId>
  <exclusions>
    <exclusion>
      <groupId>javax.servlet</groupId>
      <artifactId>javax.servlet-api</artifactId>
    </exclusion>
  </exclusions>
</dependency>
```

`mvn dependency:tree -Dincludes=javax.servlet` finds every path that pulls it
in — see
[Phase 8 · Transitive dependencies and mediation](../../phase-8-build-dependencies/03-transitive-and-mediation/README.md).

### State on a servlet or a singleton bean

**Symptom.** A counter that is wrong under load, a field that holds the
*previous* user's data, an intermittent `NullPointerException` that never
reproduces locally.

**Cause.** One instance, many concurrent threads in `service`. Instance fields
are shared, and nothing in the servlet contract synchronizes them.

**Fix.** Hold no mutable instance state. Where you genuinely need per-request
state, put it in a local variable, in the request attributes, or in a
request-scoped bean — never a field:

```java
@Service
public class OrderService {
    private final OrderRepository repo;         // ✅ final, immutable collaborator

    OrderService(OrderRepository repo) { this.repo = repo; }

    public Order find(String id) {
        Order order = repo.byId(id);            // ✅ local — one per invocation
        return order;
    }
}
```

### Overriding `service` and wondering why `doGet` stopped running

**Symptom.** You add an override of `service(HttpServletRequest, HttpServletResponse)`
to log something, and every `doGet`/`doPost` method in the class goes dead.

**Cause.** `HttpServlet.service` *is* the dispatcher — the method-to-`doXxx`
routing lives in its body. Replacing it without delegating removes the routing.

**Fix.** Always call `super.service(...)`, or do the work in a filter instead,
which is the better answer for anything cross-cutting:

```java
@Override
protected void service(HttpServletRequest req, HttpServletResponse res)
        throws ServletException, IOException {
    long start = System.nanoTime();
    try {
        super.service(req, res);      // ✅ without this, doGet/doPost never run
    } finally {
        record(System.nanoTime() - start);
    }
}
```

## Interview questions

**★ What is a servlet container actually responsible for, and what is it explicitly not responsible for?**
It owns the network socket, HTTP parsing, the connection and thread lifecycle,
the session mechanism, and a mapping table from URL patterns to servlets and
filters. It is responsible for calling `init` once, `service` per request on a
container-managed thread, and `destroy` at shutdown. It is *not* responsible
for routing beyond coarse URL patterns, serialization, validation, dependency
management, transactions, security beyond the basic constraints in `web.xml`,
or any application structure at all. Everything in that second list is why
Spring MVC exists — the container's contract stops at "here is a request on a
thread".

**★ How many instances of a servlet does the container create, and what does that imply for your code?**
One per registration, shared across all request threads. `init` runs once,
`service` runs concurrently. The implication is that instance fields are shared
mutable state with no synchronization, so servlets — and by extension the
singleton Spring beans behind them — must be stateless. Per-request data lives
in locals, request attributes, or request-scoped beans. This is not advice; it
is the direct consequence of the lifecycle, and it is why "stateless singleton"
is the default shape of every service class in a Spring codebase.

**★ `javax.servlet` versus `jakarta.servlet` — what actually changed, and why does it break things so badly?**
Only the package name, but that is enough: the JVM identifies types by their
fully-qualified name, so `javax.servlet.Filter` and `jakarta.servlet.Filter`
are two unrelated interfaces. Ownership of Java EE moved to the Eclipse
Foundation without the `javax` namespace, forcing the rename in Jakarta EE 9.
It breaks badly because the failure is usually *silent* — a `javax` filter on
the classpath is simply never registered by a `jakarta` container — or a
`NoClassDefFoundError` deep inside a third-party library rather than a compile
error in your code. Spring Framework 6 was the cutover; Framework 7 removed the
last `javax.annotation` and `javax.inject` support.

**★ What does `HttpServlet` add over the raw `Servlet` interface?**
It implements `service` to read the HTTP method from the request and dispatch
to a protected `doGet`, `doPost`, `doPut`, `doDelete`, `doHead`, `doOptions` or
`doTrace` method, each of which defaults to returning a `405`. That is the
whole of it — the dispatch is a `switch` on a string, not magic. Knowing this
explains a common self-inflicted bug: overriding `service` without calling
`super.service` deletes the routing, and every `doXxx` method in the class
silently stops being called.

**★ Why is `hits++` in a servlet field a bug rather than merely a race you can ignore?**
Because it is a read-modify-write across threads with no happens-before edge:
each request thread may read a stale value and write back a value that
overwrites another thread's increment, so updates are lost, and there is no
guarantee any thread ever observes another's write at all. It is not a rare
interleaving you can accept — it is unsynchronized shared state, which the Java
Memory Model gives no ordering guarantees about whatsoever. The fixes are the
ones from Phase 6: don't keep the state, or make it an `AtomicInteger`, or put
it behind a lock — and in a web application the first is almost always right.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The container's own extension points](02-filters-and-the-container.md)
