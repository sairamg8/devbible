---
title: "Two ways to fix self-invocation by changing where the transaction is declared — one of which is right, and one of which works but hides the boundary"
sidebar_label: "4 · Fixing self-invocation"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Core → AOP →
> Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)),
> *Programmatic transaction management*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html))
> and *Using `@Transactional`*
> ([.../declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**There are five fixes in circulation. All of them work, and they are not equally
good — a neutral list of options is the wrong way to present them, because in
almost every real codebase one is correct and the other four are things you reach
for when the first is inconvenient. This chunk covers the two that fix the problem
by restructuring the call; [chunk 4b](04b-the-escape-hatches.md) covers the three
escape hatches, one of which Spring itself calls "highly discouraged". The order
across both chunks is the order you should consider them in.**

## 1 · Extract to a second bean — the right answer

```java
@Service
public class OrderService {

    private final OrderWriter writer;                 // ← injected PROXY

    OrderService(OrderWriter writer) { this.writer = writer; }

    public long placeOrder(NewOrder order) {
        validate(order);
        return writer.saveOrderAndLines(order);       // external call → intercepted
    }
}

@Component
class OrderWriter {

    private final JdbcClient db;

    OrderWriter(JdbcClient db) { this.db = db; }

    @Transactional
    public long saveOrderAndLines(NewOrder order) {
        long id = db.sql("INSERT INTO orders (customer_id, total) VALUES (?, ?) RETURNING id")
                    .params(order.customerId(), order.total())
                    .query(Long.class).single();
        for (Line line : order.lines()) {
            db.sql("INSERT INTO order_lines (order_id, sku, qty) VALUES (?, ?, ?)")
              .params(id, line.sku(), line.qty())
              .update();
        }
        return id;
    }
}
```

**Verdict: use this unless you have a specific reason not to.**

Why it is not merely "the fix that works" but the fix that is *right*: the
transaction boundary is a design decision, and this is the only option that makes
it visible in the design. A separate bean says "this is one unit of work" in a way
a reviewer can see without knowing anything about proxies. There is no Spring API
in the business code, no configuration flag, no build step, and the boundary
survives every future change to proxy strategy, weaving mode and Spring version.

The objection is always the same — "that is a class with one method". It usually
is, and that is fine. The alternative is a boundary that exists only in the
annotation and is enforced by nothing.

⚠️ **Extraction only works if the new class is a *bean*.** A helper object you
`new` inside the service is a target with no proxy, exactly as before.

## 2 · Self-injection — a compromise that keeps one class

```java
@Service
public class OrderService {

    private final JdbcClient db;
    private OrderService self;                        // the proxy, injected

    OrderService(JdbcClient db) { this.db = db; }

    @Autowired
    void setSelf(@Lazy OrderService self) { this.self = self; }

    public long placeOrder(NewOrder order) {
        validate(order);
        return self.saveOrderAndLines(order);         // through the proxy
    }

    @Transactional
    public long saveOrderAndLines(NewOrder order) { ... }
}
```

**Verdict: works, and it is a smell. Acceptable as a local fix; not a pattern to
spread.**

The bean is injected with its own proxy, so the call is external in the only
sense that matters. `@Lazy` (or setter/field injection rather than constructor
injection) is what breaks the circular dependency — a constructor asking for
itself cannot be satisfied.

What is wrong with it is not that it fails; it is what it hides. `self.method()`
is a line that only makes sense if you know about proxies, so it converts a
design question into framework trivia. It also does not scale: a class with three
transactional methods called internally acquires three `self.` calls and no
clearer boundary than it had.

⛔ **It does not work in `@PostConstruct`** — see
[chunk 3b](03b-the-initialization-variant.md). That is the one case where the
field has nothing correct to hold.

## The trade-off

Both fixes on this page work by **changing where the transaction is declared**,
not by rescuing the declaration that was ignored. That is worth saying plainly,
because it is the honest summary of the whole subject: self-invocation is never
repaired, it is designed around. Fix 1 pays a class for a boundary a reviewer can
see; fix 2 keeps one file and pays with a line of code that only makes sense to
someone who knows about proxies. Only one of the five options —
[AspectJ weaving](04b-the-escape-hatches.md) — makes the ignored annotation
actually start working, and it costs a build.

## Gotchas

**⚠️ Extracting the method into a `new`-ed helper**
**Symptom:** the refactor lands, the annotation is on a different class, and there
is still no transaction.
**Cause:** the helper is not a Spring bean, so there is no proxy.
**Fix:** make it a bean and inject it.

**⚠️ Extracting into a nested (inner) class**
**Symptom:** the same, unless the nested class happens to be registered as a bean.
**Cause:** a non-static inner class holds an implicit reference to the outer
instance and is not a bean by virtue of being nested.
**Fix:** a separate top-level `@Component`, or a `static` nested class explicitly
registered.

**⚠️ Self-injection with constructor injection**
**Symptom:** `BeanCurrentlyInCreationException` at startup.
**Cause:** a constructor cannot be given the bean it is constructing.
**Fix:** setter or field injection, with `@Lazy`.

**⚠️ Self-injection into a `@PostConstruct` path**
**Symptom:** still no transaction, and possibly a startup failure.
**Cause:** the proxy is created after initialization callbacks run.
**Fix:** [chunk 3b](03b-the-initialization-variant.md) — defer the work.

**⚠️ Self-injecting the concrete class under a JDK proxy**
**Symptom:** the injection fails to resolve, or resolves to something that is not
your class.
**Cause:** a JDK proxy is not an instance of the target class.
**Fix:** declare the `self` field as the interface type. In Boot, CGLIB is the
default and this does not arise — which is why it surprises people when the proxy
strategy changes.

**⚠️ Fixing self-invocation and forgetting the transaction is now bigger**
**Symptom:** extracting the inner method into a bean and calling it from a
`@Transactional` outer method produces one transaction, not two.
**Cause:** the default propagation joins the existing transaction.
**Fix:** that is usually what you want. If it is not,
[chunk 10](10-requires-new.md).

**⚠️ Extracting a method and leaving the annotation on the caller too**
**Symptom:** two annotations, one transaction, and a reader who cannot tell which
one is load-bearing.
**Cause:** the outer annotation opens the transaction; the inner one joins it and
its own settings are silently ignored — see
[chunk 8](08-propagation-required.md).
**Fix:** annotate the boundary, once, at the level that represents the unit of
work.

## Interview questions

**★ What is the correct fix for self-invocation, and why is it correct rather
than merely working?**
Extract the transactional method into a second bean and call it through an
injected reference. It is correct because it makes the transaction boundary a
visible piece of the design rather than a property of the proxying mechanism: the
boundary is "a call to another object", which is what a boundary is under any
implementation. It introduces no Spring API into business code, needs no
configuration, and cannot be broken by a later change to proxy strategy, weaving
mode or framework version. Every other fix either couples the class to Spring's
AOP internals, hides the boundary behind a `self.` call that only makes sense to
someone who knows about proxies, or requires infrastructure that is
disproportionate to the problem.

**★ Self-injection works and keeps the class together. What is actually wrong with
it?**
Nothing at runtime — the bean is injected with its own proxy and the call is
external in the only sense that matters. What is wrong is that it encodes
framework knowledge into the call site. `self.saveOrder(order)` is a line whose
meaning cannot be derived from the code around it; you have to know that `self`
and `this` are different objects and why. It also does not scale — three internal
transactional calls become three `self.` calls with no better articulated
boundary — and it fails outright in `@PostConstruct`, where the proxy does not
exist yet. As a tactical fix in a class you are not allowed to split this week,
with a comment explaining it, it is defensible. As a house pattern it replaces a
design conversation with a trick.

**★ Why does self-injection need `@Lazy` or setter injection?**
Because constructor injection would create a circular dependency the container
cannot resolve: to construct the bean it must first obtain the bean, which does
not exist yet, and you get `BeanCurrentlyInCreationException`. Setter or field
injection breaks the cycle because the field is populated *after* the object has
been constructed, at which point a reference — eventually the proxy — is
available. `@Lazy` achieves the same thing differently, by injecting a lazy proxy
that resolves the real bean on first use rather than at injection time. Either
works. What neither can do is make the reference usable during initialization
callbacks, because the transactional proxy is not created until after those have
run.

**★ You apply a fix and now there is one transaction where you expected two.
What happened?**
The default propagation happened. Extracting the inner method into its own bean
makes its `@Transactional` reachable, but `REQUIRED` — the default — joins an
existing transaction rather than starting a second one. If the outer method is
also transactional, both logical scopes map to the same physical transaction, one
connection and one commit. That is usually exactly right. If you genuinely need
the inner work to commit or roll back independently, you need `REQUIRES_NEW`,
which starts a separate physical transaction on a second connection — and brings
its own pool-sizing constraint. Fixing reachability and choosing propagation are
two separate decisions, and conflating them is how a fix turns into a
connection-pool incident.

**★ "That is a class with one method" — how do you answer that objection?**
By agreeing with the observation and disagreeing with the conclusion. It usually
is a class with one method, and that method is a unit of work — the thing that
must be all-or-nothing. Naming it gives the boundary somewhere to live that is
visible to a reviewer who knows nothing about proxies, and it makes the boundary
testable in isolation. The alternative on offer is a boundary that exists only in
an annotation and is enforced by whether the call happens to arrive from outside,
which is a property nobody can see at the call site. If the class genuinely feels
too thin, that is usually a sign the extraction was drawn at the wrong line, not
that it should not have happened — the right seam is often a slightly larger
piece of behaviour that the transaction naturally wraps.

**★ Does the extraction have to be into a different class, or is a different
*bean* enough?**
A different bean, and the distinction matters. What is required is that the call
goes through a reference Spring handed you, so that the reference is a proxy.
That means the target must be a bean — a `@Component`, a `@Bean` method's return
value, or anything else the container manages and proxies. Extracting to a class
you instantiate with `new` fixes nothing, because you hold the raw object. In
practice a different bean is almost always a different class, but the rule to
remember is about bean-ness, not about file boundaries, which is also why a nested
helper class or a lambda held in a field does not count.

**★ Self-injection is a circular reference. Does Spring Boot still allow that?**
Not by default, which is a change worth knowing before you reach for the fix.
`SpringApplication.setAllowCircularReferences` is documented as "Sets whether to allow
circular references between beans and automatically try to resolve them. Defaults to
`false`", and that default has been in place since Boot 2.6. A plain setter or field
self-injection is a cycle the container would previously have resolved silently, and
now it refuses, so the context fails to start. `@Lazy` is what makes the fix still
viable: it injects a lazy proxy that resolves the target on first use rather than
during wiring, so there is no cycle to resolve at injection time. Two conclusions
follow. `@Lazy` on the `self` field is not decoration — it is load-bearing. And
switching `spring.main.allow-circular-references` back on to make a self-injection work
is the wrong trade: it re-enables cycle resolution for the whole application in order
to avoid extracting one class.

---

← Prev: [3c · Bound receivers](03c-bound-receivers.md) · Index: [04 · Spring @Transactional](README.md) · Next → [4b · The escape hatches](04b-the-escape-hatches.md)
