---
title: "A default method, a lambda and a method reference all bind to the target instance, so the call is a self-invocation with no visible 'this'"
sidebar_label: "3c · Bound receivers"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Core → AOP →
> Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html))
> and *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 3](03-the-self-invocation-trap.md) is caught in review, eventually — a
method calling a method is at least visible. These three are not, because none of
them contains a `this.` anywhere. In all three the call is dispatched on the
target instance, and in the last two the invocation happens somewhere else
entirely, so the usual "is the caller external?" heuristic gives the wrong
answer.**

## 1 · Interface default methods

```java
public interface Archivable {

    void archiveOne(long id);          // implemented, and annotated, in the class

    default void archiveAll(List<Long> ids) {
        ids.forEach(this::archiveOne); // ← runs on the implementing instance
    }
}
```

A `default` method has no separate object. Its body executes with `this` bound to
the implementing instance — the target — so every call it makes is a target call.
The code contains no class, no field and no obvious `this.method()`, which is
exactly why it survives review.

⚠️ **This also interacts with the proxy type in a way that produces a very
confusing symptom.** Under a JDK proxy the *entry* call to `archiveAll` **is**
intercepted, because `archiveAll` is declared on the interface and therefore
exists on the proxy. So an annotation on `archiveAll` works, while an annotation
on `archiveOne` is bypassed. One method of the pair behaving and the other not is
a strong hint you are looking at this shape rather than a configuration problem.

## 2 · Lambdas and anonymous inner classes

```java
@Service
public class ImportService {

    public void importAll(List<Row> rows) {
        rows.forEach(row -> importOne(row));       // captures the enclosing `this`
    }

    @Transactional
    public void importOne(Row row) { ... }
}
```

A lambda declared inside an instance method captures the enclosing `this` the
moment it references an instance member. `importOne(row)` inside the lambda is
`ImportService.this.importOne(row)` — the target. Nothing changes if the lambda
is stored in a field, passed to another bean, or executed much later; the
captured reference is still the target.

Anonymous inner classes behave the same way, and so does a nested class that
holds an explicit `Outer.this`.

## 3 · Method references

```java
rows.forEach(this::importOne);                     // bound to the target
```

This is the compact version of case 2 and the hardest to spot, because there is
no method body to read at all. `this::importOne` creates a function object bound
to the target instance at the moment the reference is *evaluated*. Handing that
function to another bean, an executor, a retry helper or a stream does not change
what it is bound to.

**The binding happens where the reference is created, not where it is invoked.**
That is the sentence that makes this shape different from every other one on
these three chunks: the eventual caller genuinely is external, and it makes no
difference at all.

## The fix, for all three

Bind to the collaborator instead of to yourself:

```java
@Service
public class ImportService {

    private final RowImporter importer;            // a different bean → a proxy

    ImportService(RowImporter importer) { this.importer = importer; }

    public void importAll(List<Row> rows) {
        rows.forEach(importer::importOne);         // bound to the PROXY
    }
}
```

`importer` holds the proxy Spring injected. `importer::importOne` is bound to
that proxy, so each invocation passes through the transaction interceptor and
each row gets its own transaction.

⚠️ **Per-item transactions are a deliberate choice, not a free upgrade.** The
loop above now performs one begin/commit per row. That is correct if each row is
independently valid and you want a bad row skipped rather than the batch lost; it
is wrong if the batch is one unit of work. Decide which, then write the boundary
that says so.

## The one-line test that identifies all of them

Ask: **what object is the invocation dispatched on, and did Spring hand me that
object?**

| Call site | Dispatched on | Intercepted? |
|---|---|---|
| `this.method()` | the target | no |
| `method()` inside the same class | the target | no |
| `this::method` | the target | no |
| `x -> method(x)` inside an instance method | the target | no |
| a `default` method's internal call | the target | no |
| `collaborator.method()` | the injected proxy | **yes** |
| `collaborator::method` | the injected proxy | **yes** |
| `new MyService().method()` | a fresh target | no |

Every row of "no" is the same fact wearing a different syntax.

## The trade-off

Spotting these is worth more than any single fix, because the fix is always the
same — get a proxy reference into the call — and the difficulty is never applying
it, it is *noticing that you need to*. The cost of relying on spotting is that
spotting fails: none of these produces a diagnostic, and the happy path passes in
every one. That is the argument for a build-time rule rather than vigilance,
which the last question below takes up.

## Gotchas

**⚠️ An interface default method calling an annotated method**
**Symptom:** a silent bypass in code that looks nothing like a self-invocation.
**Cause:** a default method body executes on the implementing instance, so its
calls are `this` calls on the target.
**Fix:** treat a default method exactly like a method on the class.

**⚠️ One method of an interface pair works and the other does not**
**Symptom:** `archiveAll` is transactional; `archiveOne` is not; both are
annotated identically.
**Cause:** under a JDK proxy the entry call to the interface method is
intercepted, and the default method's internal call to the other one is not.
**Fix:** put the boundary on the entry point only, and do not annotate methods
that are only ever reached from inside.

**⚠️ A lambda or inner class capturing `this` and calling back in**
**Symptom:** a callback that was supposed to run transactionally does not.
**Cause:** a lambda inside an instance method captures the enclosing `this`,
which is the target.
**Fix:** capture an injected reference to the collaborator bean instead.

**⚠️ A `Stream`, `Optional` or `forEach` chain calling a method reference**
**Symptom:** `list.forEach(this::processOne)` runs `processOne` without a
transaction.
**Cause:** `this::processOne` is bound to the target instance.
**Fix:** `list.forEach(processor::processOne)` where `processor` is the injected
bean.

**⚠️ Passing `this::method` to another bean and assuming distance fixes it**
**Symptom:** a scheduler, retry helper or event dispatcher in a different class
invokes the callback, and it is still not transactional.
**Cause:** the binding happened where the reference was created, not where it is
invoked. Who calls it is irrelevant.
**Fix:** create the reference from the injected proxy, or pass the bean rather
than a function.

**⚠️ Fixing the binding and accidentally changing the transaction shape**
**Symptom:** the loop becomes transactional and throughput collapses, or a
partial batch now commits where it used to fail wholesale.
**Cause:** `importer::importOne` gives one transaction per item; the previous
code had either one outer transaction or none.
**Fix:** decide the unit of work first. If the batch is atomic, the boundary
belongs on the method that runs the loop, not on the item.

**⚠️ A `Runnable` field initialised once and reused**
**Symptom:** the callback is untransactional for the life of the application, and
no amount of changing the call site helps.
**Cause:** the binding was fixed when the field was initialised, inside the
constructor or a field initialiser, where no proxy existed at all.
**Fix:** build the function from an injected reference, and not during
construction — see [chunk 3b](03b-the-initialization-variant.md).

## Interview questions

**★ You have a method with `@Transactional` that never opens a transaction. Walk
me through the diagnosis.**
Start with "is the proxy even in the call path?", because that splits the space
in half. Check who calls it: if the caller is another method of the same class —
or a lambda, a method reference, or a default method executing on that instance —
it is self-invocation and nothing about the annotation matters. If the caller is
external, check that the object it holds is the proxy: was it injected by Spring,
created with `new`, or unwrapped? Then check whether the method *can* be advised
at all: `private`, `static` and `final` methods never can, and under a JDK proxy
the method must be public and declared on the proxied interface. Only after all
that is it worth checking whether the transaction infrastructure is configured
and whether the attribute lookup found the annotation. The whole diagnosis is a
checklist rather than a log search, because every one of these failures is
silent.

**★ Does a lambda passed to another bean get intercepted when that bean invokes
it?**
No, and this is the detail that makes lambdas harder than an ordinary
self-invocation rather than easier. What matters is the receiver the function is
bound to, and that is decided where the lambda or method reference is *created*,
not where it is *called*. `this::importOne` captures the target instance; handing
it to a scheduler, an executor, a retry template or an event bus changes nothing
about that binding. The call still lands on the target. The counter-intuitive
part is that the invocation genuinely comes from outside the class, so the usual
"is the caller external?" heuristic gives the wrong answer — you have to ask what
the function is bound to instead.

**★ An interface `default` method calls an annotated method on the same
interface. What happens?**
The default method's body runs with `this` bound to the implementing instance, so
the internal call is a target call and the annotation on the invoked method is
ignored. What makes this shape confusing is that the *entry* into the default
method may well have been intercepted — under a JDK proxy the default method is
an interface method and therefore on the proxy, so an annotation on it works. The
result is one method of the pair behaving transactionally and the other not,
which looks like an inconsistency in Spring and is actually the same rule applied
twice. The practical guidance is to keep transaction boundaries off interface
default methods entirely; a default method is shared implementation, and shared
implementation is exactly what a boundary should not be attached to.

**★ Why does capturing `this` in a lambda bind to the target and not to the
proxy?**
Because the lambda is compiled inside the target class, and at the moment its
body runs, `this` means whatever `this` meant in the enclosing method. When the
enclosing method is executing, the proxy has already delegated to the target, so
`this` is the target instance — the proxy is a *separate object* that holds a
reference to yours, not something your code can reach by looking inward. A lambda
has no mechanism to discover that it is running inside a proxied invocation. The
only reference to the proxy anywhere in the JVM at that moment is the one the
caller holds and the one Spring stashed in a `ThreadLocal` if `exposeProxy` is
enabled — which is precisely why `AopContext.currentProxy()` exists, and why the
reference calls using it "highly discouraged".

**★ You fix `rows.forEach(this::importOne)` to
`rows.forEach(importer::importOne)`. Is that always an improvement?**
It is always more *correct*, in that the annotation now means what it says, but
it is not always the behaviour you want. Before the fix there was no transaction
at all, so every row committed individually by autocommit. After the fix there is
one explicit transaction per row: same granularity, but now with begin and commit
round trips and rollback semantics per item. If the intent was that the whole
import is atomic, neither version is right and the boundary belongs on
`importAll` instead — and once it is there, the inner annotation becomes
irrelevant, because the inner calls join the outer transaction under the default
propagation. The fix to make is the one that matches the unit of work, not the
one that makes the annotation fire.

**★ How would you stop this class of bug reaching production rather than finding
it each time?**
Make the boundary structurally impossible to bypass. The strongest version is a
convention that transactional methods live only on beans whose *only* public
methods are transactional entry points, so there is no non-annotated method in
the same class to call them from. Below that, an ArchUnit rule can assert that no
method annotated `@Transactional` is invoked from within its own declaring class,
which catches every shape on this page at build time — including method
references, since they compile to an invocation on the declaring class. Code
review helps least, because each call site looks completely ordinary. The one
thing that does *not* work is testing, unless the test both goes through the
container and deliberately triggers a failure partway through the unit of work.

**★ The table says `this::method` is never intercepted. Does that make every method
reference on `this` a bug?**
No, and getting this calibration right matters, because the table is easy to
over-apply. Interception only ever mattered for methods that carry a proxy-backed
annotation — `@Transactional`, `@Async`, `@Cacheable`, `@Retryable`, `@PreAuthorize`,
`@Validated`, or a custom aspect's pointcut. `list.stream().map(this::toDto)` calls an
ordinary method with no advice attached, so there is nothing to bypass and nothing to
fix; rewriting it to route through another bean would add indirection for no reason.
The rule to apply in review is narrower than the table looks: **a self-bound reference
is a bug only when its target is advised.** The corollary is the thing worth watching
for, because it is the version that bites later — adding `@Transactional` to a method
that is *already* being called as `this::method` somewhere is a change that appears to
do something and does nothing, and nothing in the diff shows the call site.

---

← Prev: [3b · The initialization variant](03b-the-initialization-variant.md) · Index: [04 · Spring @Transactional](README.md) · Next → [4 · Fixing self-invocation](04-fixing-self-invocation.md)
