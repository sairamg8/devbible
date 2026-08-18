---
title: "Class, not instance"
sidebar_label: "1 · Class, not instance"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.3.1.1 (static fields), §8.4.8.2
> (hiding of class methods), §15.12.4.1 (compile-time step 3: is the method
> static?), and the JDK 25 API documentation.

**A `static` member is resolved against a class, never an object. That single
fact explains every behaviour on this page: why a static method cannot see
`this`, why statics *hide* instead of *override*, why calling one through an
instance variable is legal and misleading, and why the receiver expression in
such a call is evaluated and then thrown away — null and all.**

## What static actually means

```java
public class Counter {
    static int created;          // one field, shared by every instance
    int id;                      // one field per instance

    Counter() {
        created++;               // read-modify-write on shared state (chunk 3)
        this.id = created;
    }
}
```

- A static field exists once, regardless of how many instances exist — even
  zero. It is initialized when the class is initialized (first active use —
  the lazy-loading story from
  [the JVM at run time](../../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md),
  and [chunk 2](02-initialization-clinit.md) of this topic).
- A static method is invoked on the class, needs no instance, and therefore
  **cannot touch instance state** (`this` does not exist inside it). The
  compile error "non-static variable cannot be referenced from a static
  context" — the first error every Java learner meets in `main` — is this
  rule, not a mystery.
- The reverse direction is fine: instance methods can read and write static
  state freely (that's what `Counter()` above does). The asymmetry is pure
  arithmetic — a class always exists by the time an instance does; an
  instance may never exist at all.
- Statics are held via the class, so they are GC roots in practice: **whatever
  a static field references stays reachable for the life of the process**
  ([the GC model](../../phase-0-platform-jvm/08-garbage-collection.md) —
  statics are the canonical unintentional-retention scope; chunk 3 owns the
  leak taxonomy).

## Statics do not override — they hide

Instance methods dispatch dynamically on the runtime type. Static methods
resolve **at compile time, by the static type of the reference** (JLS
§8.4.8.2). A subclass declaring an identically-signed static method *hides*
the parent's; nothing ever dispatches dynamically:

```java
class Base   { static String who() { return "base"; } }
class Child extends Base { static String who() { return "child"; } }

Base ref = new Child();
// ref.who() compiles — and resolves to Base.who(), because ref's TYPE is Base.
```

Two consequences:

- Calling a static method *through an instance variable* is legal and
  misleading — the instance is ignored entirely. The infamous shape:
  `myThread.sleep(1000)` compiles, and puts the **current** thread to sleep,
  because it means `Thread.sleep(1000)`. Always call statics on the class
  name; IDEs and linters flag the instance form for exactly this reason.
- `@Override` on a static method is a compile error — the compiler is telling
  you the mechanism you are imagining does not exist.

## The receiver is evaluated, then discarded

When a static method is invoked through an expression, the JLS (§15.12.4.1)
says the expression **is evaluated — for its side effects — and its value is
discarded**. No null check ever happens, because no receiver is needed:

```java
Counter c = null;
int n = c.created;      // compiles, runs, no NPE — reads Counter.created
c.someStaticMethod();   // same: works fine on a null "receiver"
```

This is the sharpest proof that the call never involved the object. It is
also why the instance-call spelling is banned by every style guide: it makes
code that *looks* like it depends on an object and provably does not.

## Static nested types and static's other meaning

On a nested class, `static` means "no hidden reference to an enclosing
instance" — a `static class Node` inside `LinkedList` is just a top-level
class with a scoped name. That half of the keyword belongs to
**Phase 2 · [Nested classes](../../phase-2-classes-objects/11-nested-classes.md)**,
where the *non*-static inner-class form is the memory-leak shape. The mental
unifier: `static` always means "does not belong to an instance."

## Static imports

`import static org.assertj.core.api.Assertions.assertThat;` makes test code
read as prose, and `import static java.lang.Math.*` makes a formula legible.
Outside those two shapes, a static import hides *where a method comes from* —
`process(order)` that is secretly `OrderUtils.process` costs every future
reader a jump-to-definition. Use them for DSL-like APIs (assertions,
`Mockito.when`) and mathematics; write the class name elsewhere.

## Gotchas

**Symptom:** `myThread.sleep(5000)` — and the *current* thread sleeps, not `myThread`
**Cause:** `sleep` is static; the call resolves to `Thread.sleep` by the reference's type, and the instance is ignored
**Fix:** call statics on the class (`Thread.sleep(...)`). There is no API to sleep *another* thread — that would be interruption territory

**Symptom:** a subclass's static method "override" never runs when called through a parent-typed reference
**Cause:** statics hide, they don't override — resolution is compile-time by static type
**Fix:** if you need dispatch, you need instance methods (or a sealed hierarchy + `switch`). `@Override` refusing to compile on a static was the early warning

**Symptom:** a static call through a `null` variable ran without a `NullPointerException` — reviewer assumed it couldn't
**Cause:** for a static invocation the receiver expression is evaluated and its value discarded (JLS §15.12.4.1); no dereference occurs
**Fix:** none needed at run time — but rewrite the call onto the class name so the code stops lying about depending on the instance

**Symptom:** `Base.staticMethod()` visible through `Child.staticMethod()` — and the two drift when someone later adds a real `Child` version
**Cause:** static members are *inherited into scope* (accessible via the subclass name) until the subclass hides them — two spellings, one method, then silently two methods
**Fix:** always name the declaring class at the call site; treat a hiding static as a code-review flag rather than a feature

**Symptom:** `import static` made two utility methods with the same name collide, or made `max(...)` ambiguous to readers
**Cause:** star static imports pull unrelated namespaces into one scope
**Fix:** import specific members, keep static imports to assertion DSLs and `Math`; qualify with the class everywhere else

## Interview questions

**★ What does `static` mean, and when is a static field initialized?**
The member belongs to the class — one copy total, not one per instance —
initialized when the class is initialized, which the JVM does lazily at first
active use. It then lives until the class is unloaded: for application code,
the life of the process.

**★ Can a static method be overridden?**
No — it can only be *hidden*. Static calls are resolved at compile time by
the static type of the reference; there is no dynamic dispatch. That is why
`@Override` on a static is a compile error and why calling a static through
an instance reference is misleading.

**★ Why can't a static method use `this` or instance fields?**
There may be zero, one, or a thousand instances when it runs — the method has
no instance in hand, so `this` is undefined by construction. Static context
can only reach static state.

**What happens when you call a static method through a null reference?**
It runs. The receiver expression is evaluated for side effects and its value
discarded — invocation resolves purely on the static type, so no null check
and no NPE. The lesson is stylistic: the instance spelling of a static call
is always a lie.

**Why do style guides ban calling statics through instances even though it works?**
Because resolution uses the declared type, not the object: `myThread.sleep()`
sleeps the current thread, and a `Base`-typed variable holding a `Child`
still calls `Base`'s static. The spelling implies dispatch that does not
exist.

---

← Index: [`static`](README.md) · Next → [Initialization and `<clinit>`](02-initialization-clinit.md)
