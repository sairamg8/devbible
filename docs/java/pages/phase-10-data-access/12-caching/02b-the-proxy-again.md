---
title: "`@Cacheable` is proxy-based advice, so a method calling another method of its own class caches nothing at all — the same failure as `@Transactional`, from the same cause, with a quieter symptom"
sidebar_label: "2b · The proxy, again"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching* (the "Limitations" note on proxy mode and method
> visibility)
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html))
> and *Core → AOP → Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**If you already understand why `@Transactional` does nothing on a self-invoked method, you
already understand this page — it is the same interceptor mechanism, the same
`this`-versus-proxy distinction and the same silence. What differs is the symptom.
A missing transaction eventually shows up as half-written data. A missing cache shows up as
nothing at all: the method simply runs, returns the right answer, and is slow.**

## The same code, one annotation changed

```java
@Service
public class ProductService {

    private final ProductRepository repository;

    ProductService(ProductRepository repository) { this.repository = repository; }

    /** Called by the controller. Not annotated. */
    public List<Product> catalogue(List<String> skus) {
        return skus.stream()
                   .map(this::findProduct)      // ← a plain call on `this`
                   .toList();
    }

    @Cacheable("products")
    public Product findProduct(String sku) {
        return repository.findBySku(sku).orElseThrow();
    }
}
```

**Nothing is cached here.** Not on the first call, not on the thousandth. `catalogue` runs
`findProduct` once per SKU, every request, and every one of them hits the database — which
is a per-row query loop, and therefore an N+1 with extra steps
([../08-the-n-plus-1-problem/README.md](../08-the-n-plus-1-problem/README.md)).

The framework says why in a single sentence:

> *"In proxy mode (the default), only external method calls coming in through the proxy are
> intercepted. This means that self-invocation (in effect, a method within the target object
> that calls another method of the target object) does not lead to actual caching at runtime
> even if the invoked method is marked with `@Cacheable`. Consider using the `aspectj` mode
> in this case."*

The mechanism is worked through in full, with the object diagram and the two-object model,
in [../04-spring-transactional/02-the-proxy.md](../04-spring-transactional/02-the-proxy.md)
and [../04-spring-transactional/03-the-self-invocation-trap.md](../04-spring-transactional/03-the-self-invocation-trap.md).
Nothing about it is different for caching. **The container injects a proxy into your
callers; `this` inside the bean is the target object; a call on `this` never crosses the
proxy; advice lives on the proxy.**

## Why this one is harder to notice

The transactional version of this bug has a loud failure mode: some rows are committed and
some are not, and eventually somebody finds an order with two of its five lines.

The caching version has **no failure mode at all**. Every answer is correct — freshly
computed, in fact, which is the most correct an answer can be. The only symptom is latency,
and latency is exactly what everybody expected to improve, so the observation is *"the cache
did not help as much as we hoped"* rather than *"the cache is not running"*. Teams spend
real time tuning TTLs and key generators on a cache that has never been consulted.

Three things make it worse in a caching context specifically:

**1 · Caches are usually added to existing code.** `@Transactional` tends to be written when
the method is written. `@Cacheable` is bolted onto a method that already has callers, and
some of those callers are inside the same class. The bug arrives with the annotation.

**2 · The natural place to cache is the inner method.** The expensive lookup is the leaf
call, and leaf calls are the ones most likely to be invoked from a sibling method rather
than from outside the bean.

**3 · Partial success is normal.** The method usually has *some* external callers, so the
cache genuinely fills and genuinely serves hits — just not for the code path that was slow.
A non-zero hit rate is the strongest possible argument that the annotation is working, and
it is not evidence at all.

## Everything else on that page applies too

Self-invocation is the headline, but proxying imposes the same set of constraints on cache
advice as on transaction advice, and each one has already been argued in topic 04:

| Constraint | Where it is worked through |
|---|---|
| Only public methods are advised | [../04-spring-transactional/02c-visibility-and-the-interface-question.md](../04-spring-transactional/02c-visibility-and-the-interface-question.md) |
| `final` methods and `final` classes cannot be subclass-proxied | [../04-spring-transactional/02-the-proxy.md](../04-spring-transactional/02-the-proxy.md) |
| Annotations are not inherited from a superclass method | [../04-spring-transactional/02d-the-inheritance-rule.md](../04-spring-transactional/02d-the-inheritance-rule.md) |
| An annotation on a bean nobody injects is dead | [../04-spring-transactional/05-annotations-that-do-nothing.md](../04-spring-transactional/05-annotations-that-do-nothing.md) |
| Calls from a constructor or `@PostConstruct` run before advice applies | [../04-spring-transactional/03b-the-initialization-variant.md](../04-spring-transactional/03b-the-initialization-variant.md) |

The visibility one is worth restating because the framework documents it for caching
independently, in the same words it uses for transactions: annotate a `protected`, `private`
or package-visible method and "no error is raised, but the annotated method does not exhibit
the configured caching settings".

## The fixes, in the order you should prefer them

These are the same four moves as
[../04-spring-transactional/04-fixing-self-invocation.md](../04-spring-transactional/04-fixing-self-invocation.md),
and the ranking is the same, but the *first* one is better here than it is there.

**1 · Move the call to the caller.** Best fix, and for caching it is usually also the right
design. If the controller or the orchestrating service calls `findProduct`, the call crosses
the proxy and the cache works. In the example above the honest fix is better still: stop
looping over SKUs and fetch them in one query, then cache the batch — the loop was the
problem and the cache was hiding it.

**2 · Split the class.** Put the cacheable method on a separate bean and inject it. This is
often the right shape anyway, because a cacheable method is a *lookup* and the caller is a
*use case*, and mixing them is what created the self-call.

**3 · Inject the proxy into itself.** Self-injection works and is ugly:

```java
@Service
public class ProductService {
    @Autowired private ProductService self;      // the proxy, not `this`
    public List<Product> catalogue(List<String> skus) {
        return skus.stream().map(self::findProduct).toList();
    }
}
```

It is honest in that the indirection is visible in the code, and it survives refactoring
badly — a reader who "simplifies" `self::findProduct` to `this::findProduct` silently
removes the cache. If you use it, comment the field.

**4 · Switch to AspectJ weaving**, which the framework's own note suggests. It removes the
constraint entirely because the advice is woven into the class rather than wrapped around
it, and it costs you a build-time or load-time weaving setup, plus the fact that nobody on
the team will expect it. Argued in
[../04-spring-transactional/04c-aspectj-weaving.md](../04-spring-transactional/04c-aspectj-weaving.md).

⚠️ **What is not a fix: calling `AopContext.currentProxy()` without enabling it.** It
requires `exposeProxy` to be turned on and it hard-couples your business code to Spring AOP.
The escape hatches and their costs are in
[../04-spring-transactional/04b-the-escape-hatches.md](../04-spring-transactional/04b-the-escape-hatches.md).

## Proving it, rather than believing it

There is no exception to catch, so you need a positive check. Two that work without a
running database:

**Assert the bean is proxied and the method is advised.** The same technique as
[../04-spring-transactional/05c-proving-it-and-preventing-it.md](../04-spring-transactional/05c-proving-it-and-preventing-it.md)
— `AopUtils.isAopProxy(bean)`, and then that the cache interceptor's advisor matches the
method. A test that asserts this fails the moment somebody makes the method package-private.

**Count invocations of the target, not of the cache.** Spy the collaborator the cacheable
method calls and assert it was called once across two invocations. This catches
self-invocation, wrong keys and a disabled cache manager in one assertion, and it does not
depend on any provider's statistics being enabled.

Reading a provider's hit-rate metric is the weakest of the three, because a partially-working
cache reports a healthy hit rate while the path you care about never reaches it.

## Gotchas

**★ A non-zero hit rate proves nothing about the call path you care about.** External callers
fill the cache; the internal caller bypasses it. The metric looks healthy and the slow
endpoint is unchanged.

**★ Adding `@Cacheable` to an existing method is exactly when this bites.** The method already
has callers, and the ones inside its own class do not go through the proxy.

**★ There is no exception, no log line and no startup failure.** Unlike a missing transaction,
a missing cache produces only correct answers, so nothing anywhere reports it.

**★ A `this::method` reference is a self-invocation, and it does not look like one.** Method
references and lambdas over instance methods are the shape this bug most often hides in now
— `map(this::findProduct)` reads like delegation and compiles to a call on the target.

**★ Making the method `private` to "stop it being called from outside" removes the cache.**
The annotation stays, the compiler is happy, and the documented behaviour is that nothing
happens.

**★ It composes with the transactional version.** A self-invoked method annotated with both
`@Transactional` and `@Cacheable` loses both, and the transaction failure will be diagnosed
first — after which somebody "fixes" the transaction by moving the annotation and never
revisits the cache.

**★ `@Cacheable` on an inner loop is often a signal to delete the loop.** The reason the
method is called N times from a sibling method is usually that the query should have been one
query. Fixing the self-invocation makes an N+1 fast instead of making it correct.

**★ Self-injection breaks silently under refactoring.** `self::find` and `this::find` differ
by four characters and by the entire behaviour of the feature; no tool warns about the
change.

## Interview questions

**★ Why does `@Cacheable` do nothing when the method is called from within the same class?**
Because the caching advice lives on the proxy, not on your object. Spring injects a proxy
into your callers; inside the bean, `this` is the target object, and a call on `this` never
crosses the proxy, so the interceptor that would consult the cache never runs. The framework
documents exactly this for proxy mode and suggests AspectJ if you need to defeat it. It is
the same mechanism that makes `@Transactional` inert on a self-invoked method — one proxy,
several kinds of advice, one rule.

**★ How is this different from the `@Transactional` version in practice?**
The mechanism is identical; the detectability is not. A missing transaction shows up as
partially-committed data, which is loud and eventually undeniable. A missing cache shows up
as correct answers computed slowly, which is indistinguishable from a cache that is working
badly. So teams tune keys and TTLs for a while before checking whether the interceptor runs
at all. I treat "the cache did not help as much as expected" as a reason to prove the advice
applies before touching any configuration.

**★ How would you prove a cache is actually being consulted?**
By counting invocations of what the cached method depends on, not by reading a hit-rate
metric. Spy the repository or the collaborator, call the method twice with the same argument
through the proxy, and assert exactly one call to the collaborator. That single assertion
catches self-invocation, a wrong key, a missing `@EnableCaching` and a no-op cache manager.
Hit-rate metrics are the weakest evidence available here, because a cache that works for
external callers and not for the internal one reports perfectly healthy numbers.

**★ Which fix would you pick and why?**
Moving the call out to the caller, or splitting the lookup onto its own bean — both make the
call cross a proxy boundary naturally rather than fighting the container. Self-injection
works but it encodes the workaround in a field that a future reader will helpfully delete.
AspectJ removes the constraint properly and costs a weaving setup plus the surprise of a
teammate who does not know it is on. In the specific case of a method being called in a loop
by a sibling method, my first question is whether the loop should exist at all, because a
cached N+1 is still an N+1 on a cold start.

**★ Someone made a cacheable method package-private for encapsulation. What happens?**
The cache silently stops working. With proxies only public methods are advised, and the
documentation states that annotating anything else raises no error while the method "does not
exhibit the configured caching settings". So it is a change with no compile error, no runtime
error and no log line, whose entire effect is a performance regression that will be blamed on
something else. It is a good argument for having a test that asserts the advice is applied
rather than trusting the annotation to be self-enforcing.

**★ Does a method reference like `this::findProduct` count as self-invocation?**
Yes, and it is the version most likely to slip through review, because it reads as delegation
rather than as a call. The bound method reference captures the target object, so the resulting
call goes straight to the implementation and never touches the proxy. The same is true of a
lambda that calls an instance method, and of anything you pass `this` into and let call back.
This is covered directly in the transactional topic's discussion of bound receivers.

**★ Could you argue that AspectJ mode should just be the default?**
You can, and the trade is real. Weaving removes an entire class of invisible bug — no
self-invocation rule, no public-only rule, no `final` restriction — and those bugs are silent,
which is the worst property a bug can have. What it costs is a build or launch-time step that
has to keep working across every environment and IDE, behaviour that differs from what every
Spring tutorial describes, and a debugging story that surprises people. Most teams are better
served by the proxy default plus a test that asserts advice is applied, because that keeps the
mental model that everyone already has.

{/* FOOTER */}
