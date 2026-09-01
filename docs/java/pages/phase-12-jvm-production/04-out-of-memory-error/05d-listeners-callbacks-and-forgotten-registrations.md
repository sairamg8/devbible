---
title: "Every register call is a promise to deregister, and the observer pattern's defining property — that the subject holds a strong reference to the observer and knows nothing about its lifetime — is the reason a listener list is the leak that survives every refactor"
sidebar_label: "05d · Listeners and registrations"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 source and API documentation at tag `jdk-25+36`** —
> `java.sql.DriverManager` (`deregisterDriver`), `java.lang.Runtime`
> (`addShutdownHook` / `removeShutdownHook`), `java.util.concurrent.Flow.Subscription`,
> `javax.management.MBeanServer` and `java.beans.PropertyChangeSupport`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/DriverManager.html)),
> and the **Eclipse Memory Analyzer documentation** for GC root types
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/gcroots.html)).
> **No sandbox** — the Java below is illustrative source, never a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The observer pattern has a memory contract that nobody writes down: the subject holds a strong
reference to every observer, the subject usually lives longer than the observer, and the subject
has no idea when the observer stops caring. So an observer that is registered and not removed is
retained by definition — along with everything it captures, which for a lambda or an inner class is
its enclosing instance and everything *that* reaches. This is the leak that is hardest to see in
review, because the registering line is one call in a constructor and the missing line is nowhere
at all.**

## The shape

```java
class ReportView {
    private final Model model;
    private final byte[] renderBuffer = new byte[8 * 1024 * 1024];

    ReportView(Model model) {
        this.model = model;
        model.addListener(this::onChange);   // registered. Never removed.
    }

    private void onChange(Event e) { /* ... */ }
}
```

`this::onChange` is a method reference that captures `this`. The `Model` — long-lived, probably
application-scoped — now holds a strong reference to every `ReportView` ever constructed, and each
one holds its eight-megabyte buffer. There is no `removeListener` anywhere and nothing in the
compiler, the linter or the code review will point that out.

**In a dump:** the `Model`'s listener list is the accumulation point, the retained size is large,
and the "interesting object" MAT names above it is your `Model` class. The instances all look
identical and there are thousands of them.

## The registrations people forget, in rough order of frequency

**JDBC drivers.** `DriverManager` holds a static list. `deregisterDriver` exists for exactly this:
*"Removes the specified driver from the `DriverManager`'s list of registered drivers."* In a
container, the driver is loaded by the application's loader and the list is held by a class from a
loader that outlives it — which is a classloader leak
([05c](05c-finding-a-classloader-leak-in-a-dump.md)), not merely a heap leak.

**MBeans.** `MBeanServer.registerMBean` is permanent until `unregisterMBean`. A management bean
registered per tenant, per cache or per connection pool and never unregistered pins the whole
object graph behind it, and the MBean server is application-scoped.

**Metrics.** A gauge registered with a strong reference to the object it measures keeps that object
alive for the life of the registry. This is the reason Micrometer's gauge API takes a weak
reference to its subject by design — **topic 08 · Metrics with Micrometer** *(not written yet)* owns
the API; the memory consequence is that a gauge holding a strong reference is a leak with a
dashboard.

**Shutdown hooks.** `Runtime.addShutdownHook` retains the thread — and therefore its `Runnable`,
and therefore whatever that captured — until the JVM exits. `removeShutdownHook` is the pair. A
component that adds a hook per instance and is itself created repeatedly accumulates them.

**Event buses and application listeners.** Spring's `ApplicationEventPublisher`, Guava's
`EventBus`, any in-house publish/subscribe. A `@Component` listener is fine because its lifecycle is
the context's; a listener registered imperatively by a prototype-scoped or manually constructed
object is not.

**Reactive subscriptions.** `Flow.Subscription`, Reactor's `Disposable`, RxJava's `Disposable`. A
subscription that is never cancelled or disposed keeps the whole chain — including the subscriber's
captured state — alive, and an infinite source means "never" is literal.

**Caches keyed by a listener.** The inversion: the observer is fine, but something holds a map from
observer to metadata and nothing removes the entry.

**`PropertyChangeSupport` and the JavaBeans family.** Strong references to every listener, with the
same add/remove asymmetry.

## Four fixes, in increasing order of robustness

### 1 · Actually call remove

```java
final class ReportView implements AutoCloseable {
    private final Model model;
    private final Consumer<Event> listener = this::onChange;

    ReportView(Model model) {
        this.model = model;
        model.addListener(listener);
    }

    @Override public void close() {
        model.removeListener(listener);
    }
}
```

⚠️ **Note that the listener is stored in a field.** `model.removeListener(this::onChange)` does not
work: each evaluation of a method reference may produce a distinct object, and removal is by
`equals`, so removing "the same" lambda you added is not guaranteed to match. This is a real and
common bug — the remove call is present, does nothing, and reviews as correct.

### 2 · Tie it to a lifecycle the framework already manages

```java
@Component
class ReportView {
    private final Model model;
    private final Consumer<Event> listener = this::onChange;

    ReportView(Model model) { this.model = model; }

    @PostConstruct void register()   { model.addListener(listener); }
    @PreDestroy   void deregister()  { model.removeListener(listener); }
}
```

The framework guarantees the pairing. This is strictly better than remembering, because the
guarantee survives someone else editing the class.

### 3 · Return a handle instead of relying on symmetry

```java
interface Registration extends AutoCloseable { @Override void close(); }

Registration addListener(Consumer<Event> l) {
    listeners.add(l);
    return () -> listeners.remove(l);
}

// then
try (Registration r = model.addListener(this::onChange)) {
    ...
}
```

This is the API design lesson: **an `add` that returns `void` invites the leak; an `add` that
returns a closeable handle makes the removal impossible to forget and impossible to get wrong**,
because the handle closes over the exact object that was added. If you own the subject, this is the
signature to write.

### 4 · Hold the listener weakly — with a caveat

```java
private final Set<Consumer<Event>> listeners =
        Collections.newSetFromMap(new WeakHashMap<>());
```

⚠️ **Weak listeners are a trap in the specific case that matters most.** A lambda or method
reference registered inline — `model.addListener(e -> refresh())` — has no other strong reference,
so it becomes collectable immediately and the listener silently stops firing. The observer must be
strongly held *somewhere else* for a weak registry to work, which pushes the lifetime question back
onto the caller rather than answering it. And the `WeakHashMap` javadoc's implementation note
applies: *"The value objects in a `WeakHashMap` are held by ordinary strong references. Thus care
should be taken to ensure that value objects do not strongly refer to their own keys, either
directly or indirectly, since that will prevent the keys from being discarded."*

[07 · References and caches](07-references-and-caches.md) is the full treatment.

## Finding it in a dump

The signature is distinctive and easy to recognise once you have seen it:

1. Dominator tree sorted by retained heap. The accumulation point is a `Object[]`,
   `CopyOnWriteArrayList` or `ConcurrentHashMap$Node[]` — the listener list's backing store.
2. The children are **many instances of the same type**, which is the observer class.
3. Each observer's own dominator subtree contains its captured state, which is where the bytes
   actually are.
4. Path to GC Roots on one observer ends at a **System Class** static field, or at the
   long-lived subject held by one.

A lambda's captured state is worth expanding specifically: a synthetic `$$Lambda` class instance
with a field named `arg$1` holding the enclosing object is the compiler telling you the method
reference captured `this`.

## Gotchas

**★ `remove(this::onChange)` does not necessarily remove `add(this::onChange)`.**
Each evaluation of a method reference may produce a distinct object, and removal is by `equals`.
Store the listener in a field and pass that field to both calls. A remove call that silently matches
nothing is worse than no remove call, because it reviews as correct.

**★ A lambda captures its enclosing instance whenever it touches `this`.**
`e -> this.refresh()` and `this::refresh` both retain the whole enclosing object and everything it
reaches. A lambda that touches nothing from the enclosing scope does not, and the JVM may even
reuse a single instance for it — which is why "some listeners leak and some do not" looks arbitrary
until you look at what each one captured.

**★ An anonymous inner class always captures the enclosing instance, even if it uses nothing.**
`new Listener() { ... }` holds a synthetic `this$0` field regardless. This is the pre-lambda version
of the same bug and it is strictly worse, because there is no "captures nothing" case.

**★ A shutdown hook is retained until the JVM exits.**
`Runtime.addShutdownHook` registers a `Thread`, which is a GC root. Anything the hook's `Runnable`
captured lives for the life of the process. `removeShutdownHook` is the pair, and a component that
adds one per instance needs it.

**★ An un-deregistered JDBC driver is a classloader leak, not just a heap leak.**
`DriverManager`'s list is static and held by a class loaded by a loader that outlives the
application's. The driver instance pins its class, which pins its loader, which pins every byte of
metadata that loader allocated.

**★ A metrics gauge holding a strong reference to its subject is a leak with a graph attached.**
The registry is application-scoped by design. If the gauge holds the object strongly, the object
lives as long as the registry, which is for ever. Every serious metrics library provides a weak
form; using the strong one on a short-lived object is the mistake.

**★ Weak listener lists silently stop working for inline lambdas.**
An inline `e -> ...` has no other strong reference, so a `WeakHashMap`-backed registry drops it at
the next collection and the listener never fires again. The bug is intermittent, timing-dependent
and appears as "the event handler works in dev and not in production".

**★ An `add` that returns `void` is an API design that causes leaks.**
It puts the entire burden of pairing on the caller, and the caller has to reconstruct the exact
object to remove. Returning a closeable `Registration` moves the guarantee into the API and closes
over the right object automatically. If you control the subject, change the signature.

**★ A reactive subscription on an infinite source never completes, so "it will be cleaned up when
it finishes" is false.** `Flux.interval`, a websocket stream, a `Sinks.Many` — none of them ends.
The `Disposable` must be disposed explicitly, and it must be disposed by whatever owns the
subscriber's lifecycle.

**★ Registration in a constructor publishes `this` before the object is fully built.**
Beyond the leak, `model.addListener(this::onChange)` in a constructor lets another thread observe a
partially constructed object. Registering in `@PostConstruct`, an `init` method or a factory avoids
both problems at once.

## Interview questions

**★ Why is the observer pattern a memory-leak generator?**
Because the reference direction is the opposite of the lifetime direction. The subject holds a
strong reference to each observer, the subject is typically long-lived and application-scoped, and
the observer is typically short-lived and request- or view-scoped — and nothing in the pattern tells
the subject when an observer stops being relevant. So every registration is a promise to
deregister, and the promise is enforced by nothing. The amount leaked is not the listener object
but everything it captured, which for a lambda that touches `this` is the entire enclosing instance
and its transitive graph.

**★ A colleague adds `model.removeListener(this::onChange)` to a `close` method and the leak
persists. Why?** Because that is a different object. Each evaluation of a method reference can
produce a new instance, and list removal is by `equals`, which for lambdas and method references
is identity unless something guarantees otherwise. The removal matches nothing and returns
quietly. The fix is to store the listener in a field —
`private final Consumer<Event> listener = this::onChange;` — and pass that same field to both
`addListener` and `removeListener`. This is one of the very few leaks where the fix is present in
the source and still does not work.

**★ How would you design a listener API so that this cannot happen?**
Make `add` return a handle. `Registration addListener(Consumer<Event> l)` returning an
`AutoCloseable` that closes over the exact object added means the caller cannot reconstruct the
wrong thing to remove, can use try-with-resources when the scope is lexical, and can store the
handle alongside whatever owns the lifecycle when it is not. It also makes the leak visible in
review: an ignored return value from a method that returns a resource is something a static
analyser can flag, whereas a missing call to a `void` method is invisible. Weak listener lists are
the alternative and they are worse, because an inline lambda has no other strong reference and
silently stops firing.

**★ When is a weak listener registry the right answer, and when is it a trap?**
It is right when the observer is independently and strongly held for its natural lifetime — a
long-lived component that registers itself, where the weak reference exists only so that the subject
does not *extend* that lifetime. It is a trap for the common case of an inline lambda or method
reference, which has no other strong reference at all and becomes collectable immediately: the
listener works until the next collection and then silently stops, producing an intermittent bug
that is far harder to diagnose than the leak it was meant to prevent. `WeakHashMap`'s own javadoc
adds the second trap — values are held strongly, so a value that refers back to its key prevents
the key from ever being discarded.

**★ What does a listener leak look like in a heap dump?**
An accumulation point at a list or map backing array — `Object[]`, `CopyOnWriteArrayList`,
`ConcurrentHashMap$Node[]` — whose children are many instances of one type, each retaining its own
captured state. Path to GC Roots on one child ends at a static field or a long-lived
application-scoped object, which identifies the subject. If the children are synthetic `$$Lambda`
classes, expanding one shows a field like `arg$1` holding the enclosing instance, which is the
compiler's record of what the method reference captured — and that enclosing object, not the
lambda, is where the memory is.

{/* FOOTER */}
